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

  const initialPage = Number(new URLSearchParams(location.search).get('page'));
  let page = Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1;
  let search;
  let searchTimer;

  function catalog(query){
    if (search !== undefined && query !== search) page = 1;
    search = query;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadList, 180);
    return '<section class="panel catalog-list" data-server-catalog aria-busy="true"><p class="empty">Загружаем каталог…</p></section>';
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
    const target = '/admin/product/?' + new URLSearchParams({id: product.id, page});
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
    const params = new URLSearchParams({ page, limit: 12, search });
    const currentQuery = params.toString();
    root.dataset.query = currentQuery;
    try {
      const { data, meta } = await request(base + '?' + params);
      if (!root.isConnected || root.dataset.query !== currentQuery) return;
      if (meta.totalPages && page > meta.totalPages) {
        page = meta.totalPages;
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
      if (root.isConnected && root.dataset.query === currentQuery) {
        root.innerHTML = `<div class="empty">${escape(error.message)} <button class="white-button" data-catalog-reload>Повторить</button></div>`;
      }
    } finally {
      if (root.dataset.query === currentQuery) root.setAttribute('aria-busy', 'false');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.catalogPage) {
      const next = Number(button.dataset.catalogPage);
      if (next === page) return;
      page = Math.max(1, next);
      const url = new URL(location.href);
      if (page > 1) url.searchParams.set('page', page);
      else url.searchParams.delete('page');
      history.replaceState(null, '', url);
      const root = button.closest('[data-server-catalog]');
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({block:'start', behavior:'instant'});
      loadList();
    }
    if (button.hasAttribute('data-catalog-reload')) loadList();
  });

  window.PSLCatalogAdmin = { catalog, request, escape, path, imageUrl, base };
})();
