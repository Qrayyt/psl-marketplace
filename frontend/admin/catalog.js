(function(){
  'use strict';

  const base = '/api/admin/products';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const path = id => base + '/' + encodeURIComponent(id);
  const imageUrl = item => {
    const image = item.imageUrl || item.imageUrls?.[0] || '';
    if (image.startsWith('assets/')) return '/' + image;
    return /^(?:https?:\/\/|\/[^/\\])/i.test(image) ? image : '';
  };

  async function request(url, options){
    const response = await window.PSL_API.fetch(url, options);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      const error = new Error(result?.error?.message || 'Сервер каталога недоступен.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  let search = '';
  let searchTimer;
  let listRequest;
  let brandsRequest;

  function filters(){
    const params = new URLSearchParams(location.search);
    const page = Number(params.get('page'));
    return {
      name: (params.get('name') || '').slice(0, 200),
      brand: (params.get('brand') || '').slice(0, 100),
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    };
  }

  function updateUrl(values){
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(values)) {
      if (!value || (key === 'page' && value === 1)) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    history.replaceState(history.state, '', url);
  }

  function scheduleList(delay = 0){
    clearTimeout(searchTimer);
    listRequest?.abort();
    document.querySelector('[data-server-catalog]')?.setAttribute('aria-busy', 'true');
    searchTimer = setTimeout(loadList, delay);
  }

  function catalog(query){
    if (query !== search && document.querySelector('[data-catalog-filters]')) updateUrl({page: 1});
    search = query;
    const {name, brand} = filters();
    scheduleList(180);
    setTimeout(loadBrands, 0);
    return `<form class="catalog-filters" data-catalog-filters role="search" aria-label="Фильтры материалов">
      <label class="field">Название товара<input type="search" name="name" value="${escape(name)}" maxlength="200" placeholder="Например, GS9"></label>
      <label class="field">Бренд<select name="brand" disabled>
        <option value="">Все бренды</option>${brand ? `<option selected value="${escape(brand)}">${escape(brand)}</option>` : ''}
      </select></label>
      <button class="white-button" type="button" data-catalog-clear ${name || brand ? '' : 'disabled'}>Сбросить</button>
      <div class="catalog-filter-error" data-catalog-brand-error role="status" hidden>Не удалось загрузить бренды. <button class="white-button" type="button" data-catalog-brand-retry>Повторить</button></div>
    </form>
    <section class="panel catalog-list" data-server-catalog aria-busy="true"><p class="empty">Загружаем каталог…</p></section>`;
  }

  async function loadBrands(){
    const form = document.querySelector('[data-catalog-filters]');
    if (!form) return;
    const error = form.querySelector('[data-catalog-brand-error]');
    error.hidden = true;
    try {
      brandsRequest ??= request('/api/admin/brands').catch(error => {
        brandsRequest = undefined;
        throw error;
      });
      const {data} = await brandsRequest;
      if (!form.isConnected) return;
      const select = form.elements.brand;
      const selected = filters().brand;
      const options = data.map(({name}) => new Option(name, name));
      const current = options.find(option => option.value.toLowerCase() === selected.toLowerCase());
      if (selected && !current) options.push(new Option(selected, selected));
      select.replaceChildren(new Option('Все бренды', ''), ...options);
      select.value = current?.value ?? selected;
      select.disabled = false;
    } catch {
      if (form.isConnected) error.hidden = false;
    }
  }

  function applyFilters(form, delay){
    const name = form.elements.name.value.trim();
    const brand = form.elements.brand.value;
    updateUrl({name, brand, page: 1});
    form.querySelector('[data-catalog-clear]').disabled = !name && !brand;
    scheduleList(delay);
  }

  function pagination({total, page, totalPages}){
    const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
      .filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    return `<nav class="catalog-pagination" aria-label="Страницы материалов">
      <span>Страница <strong>${page}</strong> из ${totalPages} · Всего ${total}</span>
      <div class="catalog-page-controls">
        <button class="white-button" data-catalog-page="${page-1}" ${page<=1?'disabled':''}>← Назад</button>
        ${pages.map((n,i) => (i && n-pages[i-1]>1 ? '<span aria-hidden="true">…</span>' : '') +
          `<button class="catalog-page-number" data-catalog-page="${n}" aria-label="Страница ${n}" ${n===page?'aria-current="page"':''}>${n}</button>`).join('')}
        <button class="white-button" data-catalog-page="${page+1}" ${page>=totalPages?'disabled':''}>Дальше →</button>
      </div>
    </nav>`;
  }

  function productRow(product){
    const url = imageUrl(product);
    const {page, name, brand} = filters();
    const params = new URLSearchParams({id: product.id, page});
    if (name) params.set('name', name);
    if (brand) params.set('brand', brand);
    const target = '/admin/product/?' + params;
    return `<article class="catalog-list-item">
      <a class="catalog-list-photo" href="${escape(target)}" aria-label="${escape(product.name)}">
        <span aria-hidden="true">Без фото</span>
        ${url ? `<img src="${escape(url)}" alt="" loading="lazy" decoding="async">` : ''}
      </a>
      <div class="catalog-list-name"><a href="${escape(target)}">${escape(product.name)}</a>
        ${product.brand ? `<small>${escape(product.brand)}</small>` : ''}
      </div>
      <div class="catalog-list-price">${product.price > 0 ? escape(product.price.toLocaleString('ru-RU')) + ' ₽' : 'Цена не указана'}</div>
      <a class="white-button catalog-edit-link" href="${escape(target)}">Редактировать <span aria-hidden="true">↗</span></a>
    </article>`;
  }

  async function loadList(){
    const root = document.querySelector('[data-server-catalog]');
    if (!root) return;
    root.setAttribute('aria-busy', 'true');
    listRequest?.abort();
    const controller = new AbortController();
    listRequest = controller;
    const {page, name, brand} = filters();
    const params = new URLSearchParams({ page, limit: 12, search, name, brand });
    const isCurrent = () => root.isConnected && !controller.signal.aborted;
    try {
      const { data, meta } = await request(base + '?' + params, {signal: controller.signal});
      if (!isCurrent()) return;
      if (meta.totalPages && page > meta.totalPages) {
        updateUrl({page: meta.totalPages});
        await loadList();
        return;
      }
      root.innerHTML = data.length
        ? `${pagination(meta)}<div class="catalog-list-items">${data.map(productRow).join('')}</div>${meta.totalPages > 1 ? pagination(meta) : ''}`
        : '<div class="empty">Материалы не найдены.</div>';
      root.querySelectorAll('.catalog-list-photo img').forEach(img => {
        const hide = () => { img.hidden = true; };
        img.addEventListener('error', hide, { once: true });
        if (img.complete && !img.naturalWidth) hide();
      });
    } catch (error) {
      if (isCurrent()) {
        root.innerHTML = `<div class="empty">${escape(error.message)} <button class="white-button" data-catalog-reload>Повторить</button></div>`;
      }
    } finally {
      if (isCurrent()) root.setAttribute('aria-busy', 'false');
    }
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (input.name === 'name' && input.form?.hasAttribute('data-catalog-filters')) {
      applyFilters(input.form, 180);
    }
  });

  document.addEventListener('change', event => {
    const select = event.target;
    if (select.name === 'brand' && select.form?.hasAttribute('data-catalog-filters')) {
      applyFilters(select.form, 0);
    }
  });

  document.addEventListener('submit', event => {
    if (!event.target.hasAttribute('data-catalog-filters')) return;
    event.preventDefault();
    applyFilters(event.target, 0);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.catalogPage) {
      const root = button.closest('[data-server-catalog]');
      if (root.getAttribute('aria-busy') === 'true') return;
      const next = Number(button.dataset.catalogPage);
      if (next === filters().page) return;
      updateUrl({page: Math.max(1, next)});
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({block:'start', behavior:'instant'});
      scheduleList();
    }
    if (button.hasAttribute('data-catalog-clear')) {
      button.form.elements.name.value = '';
      button.form.elements.brand.value = '';
      applyFilters(button.form, 0);
    }
    if (button.hasAttribute('data-catalog-brand-retry')) loadBrands();
    if (button.hasAttribute('data-catalog-reload')) scheduleList();
  });

  window.PSLCatalogAdmin = { catalog, request, escape, path, imageUrl, base };
})();
