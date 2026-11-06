(function(){
  'use strict';

  const api = window.PSL_API;
  const dialog = document.querySelector('.admin-dialog');
  const base = '/api/admin/products';
  const kinds = {
    technical: 'Техническая карта',
    certificate: 'Сертификат',
    safety: 'Паспорт безопасности',
    other: 'Другой документ',
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const path = id => base + '/' + encodeURIComponent(id);
  let products = [];
  let page = 1;
  let search = '';
  let searchTimer;

  async function request(url, options){
    const response = await api.fetch(url, options);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error?.message || 'Сервер каталога недоступен.');
    }
    return result;
  }

  function catalog(query){
    if (query !== search) page = 1;
    search = query;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadList, 180);
    return '<section class="panel table-panel" data-server-catalog aria-busy="true"><p>Загружаем каталог…</p></section>';
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
      products = data;
      const rows = products.map(product => `<tr>
        <td><strong>${escape(product.name)}</strong><small>${escape(product.brand || product.sku || '')}</small></td>
        <td>${escape(product.category)}</td>
        <td>${product.price > 0 ? escape(product.price.toLocaleString('ru-RU')) + ' ₽' : 'По запросу'}</td>
        <td><span class="status ${product.isActive ? 'dark' : 'outline'}">${product.isActive ? 'Опубликован' : 'Скрыт'}</span></td>
        <td><button class="white-button" data-catalog-edit="${escape(product.id)}">Изменить</button></td>
      </tr>`).join('');
      root.innerHTML = rows
        ? `<div class="table-scroll"><table><thead><tr><th>Материал</th><th>Категория</th><th>Цена</th><th>Статус</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table></div>
          <div class="pager"><span>${meta.total} позиций · страница ${meta.page} из ${meta.totalPages}</span><div>
          <button data-catalog-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Предыдущая страница">←</button>
          <button data-catalog-page="${page + 1}" ${page >= meta.totalPages ? 'disabled' : ''} aria-label="Следующая страница">→</button></div></div>`
        : '<div class="empty">Материалы не найдены.</div>';
    } catch (error) {
      if (root.isConnected && root.dataset.query === currentQuery) {
        root.innerHTML = `<div class="empty">${escape(error.message)} <button class="white-button" data-catalog-reload>Повторить</button></div>`;
      }
    } finally {
      if (root.dataset.query === currentQuery) root.setAttribute('aria-busy', 'false');
    }
  }

  function field(label, name, value, attributes = ''){
    return `<label class="field">${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
  }

  function multiline(label, name, value, disabled = ''){
    return `<label class="field full">${label}<textarea name="${name}" rows="3" maxlength="4000" ${disabled}>${escape(value)}</textarea></label>`;
  }

  function edit(product = null){
    const item = product || {};
    const locked = item.externalId ? 'disabled' : '';
    dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${product ? 'Редактировать материал' : 'Добавить материал'}</h2>
      <button type="button" data-close-dialog aria-label="Закрыть окно">×</button></div>
      ${locked ? '<p class="dialog-sub">Основные данные этой позиции обновляются из 1С. Документами и публикацией можно управлять здесь.</p>' : ''}
      <form data-catalog-save data-id="${escape(item.id)}">
        <div class="fields">
          ${field('Название', 'name', item.name, 'required maxlength="120" ' + locked)}
          ${field('Категория', 'category', item.category, 'required maxlength="120" ' + locked)}
          ${field('Бренд', 'brand', item.brand, 'maxlength="100"')}
          ${field('Артикул', 'sku', item.sku, 'maxlength="120" ' + locked)}
          ${field('Цена, ₽', 'price', item.price || '', 'type="number" min="0" step="0.01" placeholder="По запросу" ' + locked)}
          ${field('Ссылка на основное фото', 'imageUrl', item.imageUrl, 'maxlength="2000"')}
          ${field('Ссылка на источник', 'sourceUrl', item.sourceUrl, 'type="url" maxlength="2000"')}
          <label class="field">Публикация<select name="isActive">
            <option value="true" ${item.isActive === true ? 'selected' : ''}>Опубликован</option>
            <option value="false" ${item.isActive !== true ? 'selected' : ''}>Скрыт</option>
          </select></label>
          ${multiline('Описание', 'description', item.description, locked)}
          ${multiline('Фасовки · по одной на строку', 'sizes', item.sizes?.join('\n'), locked)}
          ${multiline('Характеристики · по одной на строку', 'details', item.details?.join('\n'), locked)}
          ${multiline('Теги · по одному на строку', 'tags', item.tags?.join('\n'), locked)}
        </div>
        <p class="dialog-sub" data-catalog-message role="status"></p>
        <div class="form-foot"><button type="submit" class="black-button">Сохранить материал</button></div>
      </form>
      <section class="catalog-documents">
        <h3>Документы</h3>
        ${product ? `<div data-catalog-documents data-id="${escape(item.id)}" aria-live="polite"></div>
        <form data-catalog-upload data-id="${escape(item.id)}">
          <div class="fields">
            ${field('Название документа', 'title', '', 'required maxlength="160"')}
            <label class="field">Тип<select name="kind">${Object.entries(kinds).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
            <label class="field full">Файл PDF · до 5 МБ<input type="file" name="document" required accept="application/pdf,.pdf"></label>
          </div>
          <p class="dialog-sub" data-catalog-message role="status"></p>
          <div class="form-foot"><button type="submit" class="white-button">Прикрепить документ</button></div>
        </form>` : '<p class="dialog-sub">Сохраните материал, чтобы прикрепить PDF.</p>'}
      </section>`;
    if (!dialog.open) dialog.showModal();
    if (product) loadDocuments();
  }

  async function loadDocuments(){
    const root = dialog.querySelector('[data-catalog-documents]');
    if (!root) return;
    root.textContent = 'Загружаем документы…';
    try {
      const { data } = await request(path(root.dataset.id) + '/documents');
      if (!root.isConnected) return;
      root.innerHTML = data.length
        ? data.map(doc => `<div class="catalog-document-row">
            <div><strong>${escape(doc.title)}</strong><small>${escape(kinds[doc.kind] || kinds.other)} · PDF</small></div>
            <button type="button" class="white-button" data-catalog-delete-doc="${escape(doc.id)}">Удалить</button>
          </div>`).join('')
        : '<p class="dialog-sub">Документы пока не прикреплены.</p>';
    } catch (error) {
      root.textContent = error.message;
    }
  }

  function formData(form){
    const data = Object.fromEntries(new FormData(form));
    for (const key of ['name', 'category']) {
      if (key in data && !data[key].trim()) throw new Error('Введите название и категорию.');
      if (key in data) data[key] = data[key].trim();
    }
    for (const key of ['brand', 'sku', 'sourceUrl', 'description', 'imageUrl']) {
      if (key in data) data[key] = data[key].trim() || null;
    }
    for (const key of ['sizes', 'details', 'tags']) {
      if (key in data) data[key] = data[key].split('\n').map(value => value.trim()).filter(Boolean);
    }
    if ('price' in data) data.price = Number(data.price);
    data.isActive = data.isActive === 'true';
    if (data.imageUrl && !/^(?:https?:\/\/|\/[^/]|assets\/)/i.test(data.imageUrl)) {
      throw new Error('Укажите ссылку на фото или путь к изображению на сайте.');
    }
    return data;
  }

  dialog.addEventListener('submit', async event => {
    const form = event.target;
    const saving = form.hasAttribute('data-catalog-save');
    if (!saving && !form.hasAttribute('data-catalog-upload')) return;
    event.preventDefault();
    const button = event.submitter;
    const message = form.querySelector('[data-catalog-message]');
    if (button) button.disabled = true;
    message.textContent = '';
    try {
      if (saving) {
        const id = form.dataset.id;
        const { data } = await request(id ? path(id) : base, {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(formData(form)),
        });
        if (!id && form.isConnected && dialog.open) edit(data);
        if (form.isConnected) message.textContent = 'Материал сохранён.';
        loadList();
      } else {
        const body = new FormData(form);
        if (body.get('document').size > 5 * 1024 * 1024) throw new Error('Размер PDF превышает 5 МБ.');
        await request(path(form.dataset.id) + '/documents', { method: 'POST', body });
        form.reset();
        message.textContent = 'Документ прикреплён.';
        if (form.isConnected) loadDocuments();
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.catalogEdit) {
      const product = products.find(item => item.id === button.dataset.catalogEdit);
      if (product) edit(product);
    }
    if (button.dataset.catalogPage) {
      page = Math.max(1, Number(button.dataset.catalogPage));
      loadList();
    }
    if (button.hasAttribute('data-catalog-reload')) loadList();
    if (button.dataset.catalogDeleteDoc && confirm('Удалить документ из карточки материала?')) {
      const root = button.closest('[data-catalog-documents]');
      button.disabled = true;
      try {
        await request(path(root.dataset.id) + '/documents/' + encodeURIComponent(button.dataset.catalogDeleteDoc), { method: 'DELETE' });
        if (root.isConnected) loadDocuments();
      } catch (error) {
        const message = dialog.querySelector('[data-catalog-upload] [data-catalog-message]');
        if (root.isConnected && message) message.textContent = error.message;
        button.disabled = false;
      }
    }
  });

  window.PSLCatalogAdmin = { catalog, edit };
})();
