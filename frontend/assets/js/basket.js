(function(){
  'use strict';
  const api = window.PSL_API;
  const keys = { cart: 'marketplace_cart_v2', favorites: 'marketplace_favs_v2' };
  const standard = 'Стандарт';
  const account = () => api.getToken() && api.getUser()?.id;
  const product = id => (window.PRODUCTS || []).find(p => p.id === id || p.catalogSlug === id);
  const quantity = n => Math.min(9999, Math.max(1, Math.floor(Number(n) || 1)));
  const sizeFor = (p, size) => p?.sizes?.includes(size) ? size : p?.sizes?.[0] || standard;

  function read(key){
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function guest(){
    return {
      cart: read(keys.cart).filter(item => item && item.id != null).map(item => {
        const id = String(item.id), p = product(id), size = sizeFor(p, item.size);
        return { id: p?.id || id, size, qty: quantity(item.qty), lineId: JSON.stringify([p?.id || id, size]) };
      }),
      favorites: [...new Set(read(keys.favorites).filter(id => typeof id === 'string' || typeof id === 'number')
        .map(id => product(String(id))?.id || String(id)))],
    };
  }

  const state = { cart: [], favorites: [], error: null };
  let pending = Promise.resolve();
  const publish = () => window.dispatchEvent(new Event('psl:basket'));

  async function request(path, options = {}){
    const response = await api.fetch(path, { signal: AbortSignal.timeout(12000), ...options });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw Error(result?.error?.message || 'Не удалось связаться с сервером.');
    }
    return result;
  }

  const send = (path, method, body) => request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  function enqueue(action){
    const next = pending.then(action);
    pending = next.catch(() => {});
    return next;
  }

  function setCart(items){
    state.cart = items.map(item => ({ id: item.productId, lineId: item.id, size: item.size, qty: item.quantity }));
  }

  async function readFavorites(){
    const ids = [];
    for (let page = 1; ; page++) {
      const result = await request('/api/favorites?limit=100&page=' + page);
      ids.push(...result.data.map(item => item.productId));
      if (page >= result.meta.totalPages) return ids;
    }
  }

  async function mergeGuest(){
    const local = guest();
    const cartBefore = localStorage.getItem(keys.cart);
    const favBefore = localStorage.getItem(keys.favorites);
    const items = local.cart.filter(item => product(item.id)).map(item => ({
      productId: item.id, size: item.size, quantity: item.qty,
    }));
    const productIds = local.favorites.filter(id => product(id));

    if (items.length) {
      const { data } = await send('/api/cart/sync', 'POST', { items });
      const imported = new Set(data.items.map(item => JSON.stringify([item.productId, item.size])));
      if (localStorage.getItem(keys.cart) === cartBefore) {
        localStorage.setItem(keys.cart, JSON.stringify(local.cart.filter(item => !imported.has(item.lineId))));
      }
    }
    if (productIds.length) {
      const { data } = await send('/api/favorites/sync', 'POST', { productIds });
      const imported = new Set(data.map(item => item.productId));
      if (localStorage.getItem(keys.favorites) === favBefore) {
        localStorage.setItem(keys.favorites, JSON.stringify(local.favorites.filter(id => !imported.has(id))));
      }
    }
  }

  function refresh(merge = false){
    return enqueue(async () => {
      await window.PSL_PRODUCTS_READY;
      const owner = account();
      if (!owner) {
        Object.assign(state, guest(), { error: null });
      } else {
        if (merge) await mergeGuest();
        const [{ data }, favorites] = await Promise.all([request('/api/cart'), readFavorites()]);
        if (account() !== owner) return;
        setCart(data.items);
        Object.assign(state, { favorites, error: null });
      }
      publish();
    });
  }

  function mutate(server, local){
    return enqueue(async () => {
      const owner = account();
      if (owner) {
        if (state.error) throw Error('Обновите корзину перед изменением.');
        await server();
        if (account() !== owner) return;
      } else {
        const fresh = guest();
        local(fresh);
        localStorage.setItem(keys.cart, JSON.stringify(fresh.cart));
        localStorage.setItem(keys.favorites, JSON.stringify(fresh.favorites));
        Object.assign(state, guest(), { error: null });
      }
      publish();
    });
  }

  function replaceLine(item){
    state.cart = [
      ...state.cart.filter(line => line.lineId !== item.id),
      { id: item.productId, lineId: item.id, size: item.size, qty: item.quantity },
    ];
  }

  window.PSLBasket = {
    state, request, refresh,
    ready: refresh(true).catch(error => { state.error = error.message; publish(); }),
    add(id, selectedSize){
      const p = product(id);
      if (!p || !(p.price > 0)) return Promise.reject(Error('Материал пока недоступен для заказа.'));
      const size = sizeFor(p, selectedSize);
      return mutate(async () => replaceLine((await send('/api/cart', 'POST', { productId: p.id, size })).data), fresh => {
        const line = fresh.cart.find(item => item.id === p.id && item.size === size);
        if (line) line.qty = quantity(line.qty + 1);
        else fresh.cart.push({ id: p.id, size, qty: 1 });
      });
    },
    change(lineId, change){
      return mutate(async () => {
        const line = state.cart.find(item => item.lineId === lineId);
        if (!line) return;
        const qty = quantity(change.qty ?? line.qty + (change.delta || 0));
        const { data } = await send('/api/cart/' + encodeURIComponent(lineId), 'PATCH', { quantity: qty, size: change.size });
        state.cart = state.cart.filter(item => item.lineId !== lineId);
        replaceLine(data);
      }, fresh => {
        const line = fresh.cart.find(item => item.lineId === lineId);
        if (!line) return;
        line.qty = quantity(change.qty ?? line.qty + (change.delta || 0));
        if (change.size) {
          const target = fresh.cart.find(item => item !== line && item.id === line.id && item.size === change.size);
          if (target) {
            target.qty = quantity(target.qty + line.qty);
            fresh.cart = fresh.cart.filter(item => item !== line);
          } else line.size = change.size;
        }
      });
    },
    remove(lineId){
      return mutate(async () => {
        await send('/api/cart/' + encodeURIComponent(lineId), 'DELETE');
        state.cart = state.cart.filter(item => item.lineId !== lineId);
      }, fresh => { fresh.cart = fresh.cart.filter(item => item.lineId !== lineId); });
    },
    clear(){
      return mutate(async () => { await send('/api/cart', 'DELETE'); state.cart = []; },
        fresh => { fresh.cart = []; });
    },
    toggleFavorite(id){
      id = product(id)?.id || id;
      const toggle = ids => ids.includes(id) ? ids.filter(item => item !== id) : [id, ...ids];
      return mutate(async () => {
        await send('/api/favorites/' + encodeURIComponent(id), state.favorites.includes(id) ? 'DELETE' : 'POST');
        state.favorites = toggle(state.favorites);
      }, fresh => { fresh.favorites = toggle(fresh.favorites); });
    },
  };

  window.addEventListener('storage', event => {
    if (!account() && Object.values(keys).includes(event.key)) void refresh();
  });
})();
