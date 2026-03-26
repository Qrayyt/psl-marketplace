
(function(){
  const LS_KEYS = {
    cart: 'marketplace_cart_v2',
    favs: 'marketplace_favs_v2',
    chat: 'marketplace_ai_chat_v1'
  };

  const state = {
    products: window.PRODUCTS || [],
    cart: load(LS_KEYS.cart, []),
    favs: load(LS_KEYS.favs, []),
    chat: load(LS_KEYS.chat, [
      { role: 'assistant', text: 'Привет. Я AI-консультант магазина. Могу помочь выбрать размер, собрать образ или быстро найти вещи по стилю.' }
    ])
  };

  function load(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function save(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  function fmtPrice(v){
    return new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
  }
  function getProduct(id){
    return state.products.find(p => p.id === id);
  }
  function cartCount(){
    return state.cart.reduce((acc, item) => acc + item.qty, 0);
  }
  function inFavs(id){ return state.favs.includes(id); }
  function cartItem(id){ return state.cart.find(i => i.id === id); }

  function syncCounters(){
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      const count = cartCount();
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
    document.querySelectorAll('[data-fav-count]').forEach(el => {
      const count = state.favs.length;
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
  }

  function toast(text){
    if(window.innerWidth <= 767 && navigator.vibrate){ try{ navigator.vibrate(10); }catch(e){} }
    let wrap = document.querySelector('.toast-wrap');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 200);
    }, 1800);
  }

  function toggleFav(id, btn){
    const idx = state.favs.indexOf(id);
    if(idx > -1){
      state.favs.splice(idx, 1);
      save(LS_KEYS.favs, state.favs);
      if(btn) btn.classList.remove('active');
      toast('Убрано из избранного');
    }else{
      state.favs.unshift(id);
      save(LS_KEYS.favs, state.favs);
      if(btn) btn.classList.add('active');
      toast('Добавлено в избранное');
    }
    syncCounters();
    renderProfile();
  }

  function addToCart(id, btn){
    const existing = cartItem(id);
    if(existing){
      existing.qty += 1;
    }else{
      state.cart.push({ id, qty: 1, size: (getProduct(id)?.sizes || [])[0] || null });
    }
    save(LS_KEYS.cart, state.cart);
    if(btn){
      btn.classList.add('added');
      btn.innerHTML = iconCheck() + '<span>Добавлено</span>';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.innerHTML = iconCart() + '<span>В корзину</span>';
      }, 1200);
    }
    syncCounters();
    renderProfile();
    toast('Товар добавлен в корзину');
  }

  function updateCartQty(id, delta){
    const item = cartItem(id);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      state.cart = state.cart.filter(x => x.id !== id);
      toast('Товар удалён из корзины');
    }
    save(LS_KEYS.cart, state.cart);
    syncCounters();
    renderProfile();
  }

  function setCartSize(id, size){
    const item = cartItem(id);
    if(item){
      item.size = size;
      save(LS_KEYS.cart, state.cart);
      renderProfile();
    }
  }

  function removeFromCart(id){
    state.cart = state.cart.filter(i => i.id !== id);
    save(LS_KEYS.cart, state.cart);
    syncCounters();
    renderProfile();
    toast('Товар удалён из корзины');
  }

  function renderProducts(){
    const root = document.querySelector('[data-products]');
    if(!root) return;

    const q = (document.querySelector('[data-search]')?.value || '').trim().toLowerCase();
    const category = document.querySelector('[data-category]')?.value || 'all';
    const sort = document.querySelector('[data-sort]')?.value || 'popular';
    const tagString = (document.querySelector('[data-tags]')?.value || '').trim().toLowerCase();
    const tags = tagString ? tagString.split(',').map(s => s.trim()).filter(Boolean) : [];
    let list = [...state.products];

    if(q){
      list = list.filter(p => [p.name, p.category, p.color, ...(p.tags || [])].join(' ').toLowerCase().includes(q));
    }
    if(category !== 'all'){
      list = list.filter(p => p.category === category);
    }
    if(tags.length){
      list = list.filter(p => tags.every(tag => p.tags.some(t => t.toLowerCase().includes(tag))));
    }

    if(sort === 'price-asc') list.sort((a,b)=>a.price-b.price);
    if(sort === 'price-desc') list.sort((a,b)=>b.price-a.price);
    if(sort === 'rating') list.sort((a,b)=>b.rating-a.rating);
    if(sort === 'new') list.sort((a,b)=>Number(b.tags.includes('new')) - Number(a.tags.includes('new')));

    if(!list.length){
      root.innerHTML = '<div class="empty-state">По этим фильтрам пока ничего не найдено. Попробуй убрать часть тегов или сменить категорию.</div>';
      return;
    }

    root.innerHTML = list.map(cardHtml).join('');
    bindCardEvents(root);
    document.querySelectorAll('.catalog-meta,[data-mobile-meta]').forEach(meta => {
      meta.textContent = `Найдено ${list.length} товаров`;
    });
  }

  function cardHtml(p){
    return `
      <article class="product-card">
        <a class="card-link" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.name)}">
          <div class="card-media">
            <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
            <div class="card-actions">
              <button class="card-fab ${inFavs(p.id) ? 'active' : ''}" type="button" data-fav="${p.id}" aria-label="В избранное">
                ${iconHeart()}
              </button>
              <button class="card-fab" type="button" data-cart="${p.id}" aria-label="В корзину">
                ${iconPlus()}
              </button>
            </div>
          </div>
        </a>
        <div class="card-body">
          <div class="card-topline">
            <div>
              <h3 class="card-name"><a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
              <div class="card-meta">${escapeHtml(p.category)} · ${escapeHtml(p.color)}</div>
            </div>
            <div class="card-meta">★ ${p.rating}</div>
          </div>
          <div class="price-row">
            <div class="price">${fmtPrice(p.price)}</div>
            ${p.oldPrice ? `<div class="old-price">${fmtPrice(p.oldPrice)}</div>` : ''}
          </div>
          <div class="card-bottom">
            <div class="badges">
              ${p.tags.slice(0,2).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}
            </div>
            <button class="add-btn" type="button" data-cart-main="${p.id}">
              ${iconCart()}<span>В корзину</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function bindCardEvents(root){
    root.querySelectorAll('[data-fav]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        toggleFav(btn.dataset.fav, btn);
      });
    });
    root.querySelectorAll('[data-cart],[data-cart-main]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        addToCart(btn.dataset.cart || btn.dataset.cartMain, btn.matches('[data-cart-main]') ? btn : null);
      });
    });
  }

  function initCatalogControls(){
    const controls = document.querySelectorAll('[data-search],[data-category],[data-sort],[data-tags]');
    controls.forEach(el => el.addEventListener('input', renderProducts));
    controls.forEach(el => el.addEventListener('change', renderProducts));

    const openFiltersBtn = document.querySelector('[data-open-filters]');
    const closeFiltersBtn = document.querySelector('[data-close-filters]');
    const filtersPanel = document.querySelector('[data-filters-panel]');
    function setFiltersOpen(next){
      document.body.classList.toggle('filters-open', !!next);
    }
    openFiltersBtn?.addEventListener('click', () => setFiltersOpen(true));
    closeFiltersBtn?.addEventListener('click', () => setFiltersOpen(false));
    filtersPanel?.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
      if(!document.body.classList.contains('filters-open')) return;
      const insidePanel = e.target.closest('[data-filters-panel]');
      const opener = e.target.closest('[data-open-filters]');
      if(!insidePanel && !opener){ setFiltersOpen(false); }
    });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ setFiltersOpen(false); }
    });

    document.querySelectorAll('[data-quick-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-quick-category]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        const select = document.querySelector('[data-category]');
        if(select){ select.value = btn.dataset.quickCategory; }
        renderProducts();
        if(window.innerWidth <= 767){ setFiltersOpen(false); }
      });
    });
    renderProducts();
  }

  function renderProductPage(){
    const root = document.querySelector('[data-product-page]');
    if(!root) return;

    const params = new URLSearchParams(location.search);
    const id = params.get('id') || state.products[0]?.id;
    const p = getProduct(id) || state.products[0];
    if(!p) return;

    root.innerHTML = `
      <div class="product-layout">
        <section class="gallery-card">
          <div class="product-main-media">
            <img src="${p.image}" alt="${escapeHtml(p.name)}">
          </div>
          <div class="product-thumbs">
            ${Array.from({length:4}).map(() => `<div class="thumb"><img src="${p.image}" alt="${escapeHtml(p.name)}"></div>`).join('')}
          </div>
        </section>
        <section class="detail-card">
          <div class="breadcrumbs">
            <a href="index.html">Главная</a>
            <span>•</span>
            <span>${escapeHtml(p.category)}</span>
            <span>•</span>
            <span>${escapeHtml(p.name)}</span>
          </div>
          <h1 class="product-title">${escapeHtml(p.name)}</h1>
          <div class="rating-row">★ ${p.rating} · ${p.reviews} отзывов · ${escapeHtml(p.color)}</div>
          <div class="product-price">${fmtPrice(p.price)} ${p.oldPrice ? `<span class="old-price" style="font-size:18px;margin-left:8px">${fmtPrice(p.oldPrice)}</span>` : ''}</div>
          <p class="product-copy">${escapeHtml(p.description)}</p>

          <div class="option-block">
            <div class="option-label">Размер</div>
            <div class="size-row">
              ${p.sizes.map((s,i) => `<button class="size-btn ${i===0?'active':''}" type="button" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
            </div>
          </div>

          <div class="option-block">
            <div class="option-label">Что внутри</div>
            <ul class="detail-list">
              ${p.details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>

          <div class="action-row">
            <button class="primary-btn" type="button" data-buy-product="${p.id}">
              ${iconCart()} Добавить в корзину
            </button>
            <button class="ghost-btn ${inFavs(p.id) ? 'active-ish' : ''}" type="button" data-fav-product="${p.id}">
              ${iconHeart()} ${inFavs(p.id) ? 'Убрать из избранного' : 'В избранное'}
            </button>
          </div>
        </section>
      </div>
    `;

    let selectedSize = p.sizes[0] || null;
    root.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-size]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.dataset.size;
      });
    });
    root.querySelector('[data-buy-product]')?.addEventListener('click', () => {
      const existing = cartItem(p.id);
      if(existing){
        existing.qty += 1;
        existing.size = selectedSize || existing.size;
      }else{
        state.cart.push({ id: p.id, qty: 1, size: selectedSize });
      }
      save(LS_KEYS.cart, state.cart);
      syncCounters();
      toast('Товар добавлен в корзину');
    });
    root.querySelector('[data-fav-product]')?.addEventListener('click', e => {
      toggleFav(p.id, null);
      renderProductPage();
    });
  }

  function renderProfile(){
    const root = document.querySelector('[data-profile-content]');
    if(!root) return;

    const view = document.querySelector('[data-profile-nav].active')?.dataset.profileNav || 'cart';
    document.querySelectorAll('[data-profile-nav]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-profile-nav]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        renderProfile();
      };
    });

    document.querySelector('[data-stat-cart]') && (document.querySelector('[data-stat-cart]').textContent = cartCount());
    document.querySelector('[data-stat-favs]') && (document.querySelector('[data-stat-favs]').textContent = state.favs.length);
    document.querySelector('[data-stat-total]') && (document.querySelector('[data-stat-total]').textContent = fmtPrice(state.cart.reduce((s,i)=>s+(getProduct(i.id)?.price || 0)*i.qty, 0)));

    if(view === 'cart'){
      if(!state.cart.length){
        root.innerHTML = `<div class="empty-state">Корзина пока пустая. Возвращайся на главную и собирай каталог.</div>`;
        return;
      }
      const total = state.cart.reduce((sum, item) => sum + (getProduct(item.id)?.price || 0) * item.qty, 0);
      root.innerHTML = `
        <div class="list-grid">
          ${state.cart.map(item => {
            const p = getProduct(item.id); if(!p) return '';
            return `
              <article class="profile-product">
                <a class="thumb-small" href="product.html?id=${p.id}"><img src="${p.image}" alt="${escapeHtml(p.name)}"></a>
                <div>
                  <h3 class="card-name" style="margin-bottom:6px"><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
                  <div class="card-meta">${escapeHtml(p.category)} · ${escapeHtml(p.color)}</div>
                  <div class="price-row"><div class="price" style="font-size:18px">${fmtPrice(p.price)}</div></div>
                  <div class="size-row" style="margin-top:10px">
                    ${p.sizes.map(size => `<button class="size-btn ${item.size===size?'active':''}" type="button" data-profile-size="${p.id}|${escapeHtml(size)}">${escapeHtml(size)}</button>`).join('')}
                  </div>
                </div>
                <div class="profile-actions">
                  <button class="ghost-btn" type="button" data-qty-down="${p.id}">−</button>
                  <div class="pill">Кол-во: ${item.qty}</div>
                  <button class="ghost-btn" type="button" data-qty-up="${p.id}">+</button>
                  <button class="ghost-btn" type="button" data-remove-cart="${p.id}">Удалить</button>
                </div>
              </article>
            `;
          }).join('')}
          <section class="summary-box">
            <h3 class="card-name">Итого</h3>
            <div class="divider"></div>
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
              <span class="muted">Товаров: ${cartCount()}</span>
              <strong style="font-size:24px">${fmtPrice(total)}</strong>
            </div>
            <div class="action-row">
              <button class="primary-btn" type="button">Оформить заказ</button>
              <a class="ghost-btn" href="index.html#catalog">Продолжить покупки</a>
            </div>
          </section>
        </div>
      `;
      root.querySelectorAll('[data-qty-down]').forEach(btn => btn.onclick = () => updateCartQty(btn.dataset.qtyDown, -1));
      root.querySelectorAll('[data-qty-up]').forEach(btn => btn.onclick = () => updateCartQty(btn.dataset.qtyUp, 1));
      root.querySelectorAll('[data-remove-cart]').forEach(btn => btn.onclick = () => removeFromCart(btn.dataset.removeCart));
      root.querySelectorAll('[data-profile-size]').forEach(btn => btn.onclick = () => {
        const [id,size] = btn.dataset.profileSize.split('|');
        setCartSize(id,size);
      });
      return;
    }

    if(view === 'favs'){
      const items = state.favs.map(getProduct).filter(Boolean);
      if(!items.length){
        root.innerHTML = `<div class="empty-state">В избранном пока пусто. Нажимай на сердечки в каталоге — всё появится здесь.</div>`;
        return;
      }
      root.innerHTML = `
        <div class="list-grid">
          ${items.map(p => `
            <article class="profile-product">
              <a class="thumb-small" href="product.html?id=${p.id}"><img src="${p.image}" alt="${escapeHtml(p.name)}"></a>
              <div>
                <h3 class="card-name" style="margin-bottom:6px"><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
                <div class="card-meta">${escapeHtml(p.category)} · ${escapeHtml(p.color)}</div>
                <div class="price-row"><div class="price" style="font-size:18px">${fmtPrice(p.price)}</div></div>
              </div>
              <div class="profile-actions">
                <button class="primary-btn" type="button" data-add-fav-cart="${p.id}">${iconCart()} В корзину</button>
                <button class="ghost-btn" type="button" data-remove-fav="${p.id}">Убрать</button>
              </div>
            </article>
          `).join('')}
        </div>
      `;
      root.querySelectorAll('[data-add-fav-cart]').forEach(btn => btn.onclick = () => addToCart(btn.dataset.addFavCart));
      root.querySelectorAll('[data-remove-fav]').forEach(btn => btn.onclick = () => toggleFav(btn.dataset.removeFav));
      return;
    }

    root.innerHTML = `
      <div class="summary-box">
        <h3 class="card-name">Аккаунт</h3>
        <p class="muted">Здесь дальше можно подключить авторизацию, адреса доставки, историю заказов, способы оплаты и реальные данные профиля.</p>
        <div class="contact-grid">
          <div class="contact-item"><div class="contact-label">Статус</div><div class="contact-value">Готово под интеграцию</div></div>
          <div class="contact-item"><div class="contact-label">Следующий шаг</div><div class="contact-value">Подключить backend и checkout</div></div>
        </div>
      </div>
    `;
  }

  function renderChat(){
    const root = document.querySelector('[data-chat-messages]');
    if(!root) return;
    root.innerHTML = state.chat.map(msg => `
      <div class="msg ${msg.role === 'user' ? 'user' : ''}">
        <div class="avatar">${msg.role === 'user' ? 'Вы' : 'AI'}</div>
        <div class="bubble">${escapeHtml(msg.text)}</div>
      </div>
    `).join('');
    root.scrollTop = root.scrollHeight;
  }

  function initChat(){
    const form = document.querySelector('[data-chat-form]');
    if(!form) return;
    const textarea = form.querySelector('[data-chat-input]');
    const historyButtons = document.querySelectorAll('[data-chat-preset]');
    const menuBtn = document.querySelector('[data-chat-menu]');

    function setChatMenuOpen(next){
      document.body.classList.toggle('chat-menu-open', !!next);
    }
    menuBtn?.addEventListener('click', () => {
      setChatMenuOpen(!document.body.classList.contains('chat-menu-open'));
    });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') setChatMenuOpen(false);
    });
    document.addEventListener('click', e => {
      if(!document.body.classList.contains('chat-menu-open')) return;
      const inSidebar = e.target.closest('.chat-sidebar');
      const opener = e.target.closest('[data-chat-menu]');
      if(!inSidebar && !opener){ setChatMenuOpen(false); }
    });

    historyButtons.forEach(btn => btn.onclick = () => {
      textarea.value = btn.dataset.chatPreset;
      textarea.focus();
      if(window.innerWidth <= 767){ setChatMenuOpen(false); }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = textarea.value.trim();
      if(!text) return;
      state.chat.push({ role: 'user', text });
      const answer = fakeAi(text);
      state.chat.push({ role: 'assistant', text: answer });
      save(LS_KEYS.chat, state.chat);
      textarea.value = '';
      textarea.style.height = '56px';
      renderChat();
    });
    document.querySelector('[data-new-chat]')?.addEventListener('click', () => {
      state.chat = [{ role: 'assistant', text: 'Новый чат открыт. Напиши, что хочешь найти: размер, категорию, стиль или бюджет.' }];
      save(LS_KEYS.chat, state.chat);
      renderChat();
    });
    renderChat();
  }

  function fakeAi(text){
    const q = text.toLowerCase();
    const hasBudget = q.match(/(\d{3,6})/);
    const budget = hasBudget ? parseInt(hasBudget[1],10) : null;
    let picks = [...state.products];
    if(q.includes('худи')) picks = picks.filter(p => p.category === 'Худи');
    if(q.includes('брюк')) picks = picks.filter(p => p.category === 'Брюки');
    if(q.includes('обув')) picks = picks.filter(p => p.category === 'Обувь');
    if(q.includes('аксесс')) picks = picks.filter(p => p.category === 'Аксессуары');
    if(q.includes('бел')) picks = picks.filter(p => p.color.toLowerCase().includes('бел'));
    if(q.includes('чер')) picks = picks.filter(p => p.color.toLowerCase().includes('чер'));
    if(budget) picks = picks.filter(p => p.price <= budget);
    picks = picks.slice(0,3);

    if(q.includes('размер')){
      return 'Для размерной логики здесь уже готова база интерфейса. Дальше можно подключить таблицы размеров по брендам и подсказывать fit на основе параметров пользователя.';
    }
    if(q.includes('образ') || q.includes('лук') || q.includes('собери')){
      const names = picks.length ? picks.map(p => p.name).join(', ') : 'несколько базовых позиций';
      return `Я бы собрал чистый монохромный образ так: ${names}. Дальше можно добавить автоматические подборки и связки товаров из каталога.`;
    }
    if(q.includes('что ты умеешь')){
      return 'Сейчас я демо-консультант. Уже умею вести диалог, сохранять историю локально и могу быть заменён на реальный AI endpoint почти без переделки интерфейса.';
    }
    if(picks.length){
      return 'Вот что подходит по запросу: ' + picks.map(p => `${p.name} — ${fmtPrice(p.price)}`).join('; ') + '.';
    }
    return 'Под такой запрос в демо-каталоге ничего не нашлось. Но UI уже готов — можно подключать реальную базу товаров и AI-поиск.';
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function iconHeart(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.1 20.3 4.9 13.3a4.8 4.8 0 1 1 6.8-6.8l.3.3.3-.3a4.8 4.8 0 0 1 6.8 6.8l-7 7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
  function iconPlus(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
  function iconCart(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h2l2 10h10l2-7H7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/></svg>'; }
  function iconCheck(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  document.addEventListener('DOMContentLoaded', () => {
    syncCounters();
    initCatalogControls();
    renderProductPage();
    renderProfile();
    initChat();
  });
})();
