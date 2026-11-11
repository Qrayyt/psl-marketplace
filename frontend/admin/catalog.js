(function(){
  'use strict';

  const api = window.PSL_API;
  const dialog = document.querySelector('.admin-dialog');
  const base = '/api/admin/products';
  const brandEndpoint = '/api/admin/brands';
  const brandDialog = document.createElement('dialog');
  brandDialog.className = 'admin-dialog catalog-brand-dialog';
  brandDialog.setAttribute('aria-labelledby', 'catalog-brand-title');
  document.body.append(brandDialog);
  let previewUrl;
  let selectedBrandControl;
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
        <td>${product.price > 0 ? escape(product.price.toLocaleString('ru-RU')) + ' ₽' : 'Цена не указана'}</td>
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

  function brandOptions(select, brands, selected){
    select.replaceChildren(new Option('Выберите бренд', ''));
    const byKey = new Map(brands.map(brand => [brand.name.toLowerCase(), brand.name]));
    if (selected && !byKey.has(selected.toLowerCase())) byKey.set(selected.toLowerCase(), selected);
    for (const name of byKey.values()) select.add(new Option(name, name));
    select.value = byKey.get(String(selected || '').toLowerCase()) || '';
  }

  async function loadBrands(select, selected){
    brandOptions(select, [], selected);
    try {
      const { data } = await request(brandEndpoint);
      if (select.isConnected) brandOptions(select, data, select.value);
    } catch (error) {
      if (select.isConnected) select.form.querySelector('[data-catalog-message]').textContent = error.message;
    }
  }

  function resetPreview(){
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function edit(product = null){
    const item = product || {};
    const locked = item.externalId ? 'disabled' : '';
    const currentImage = item.imageUrl;
    const preview = currentImage && /^(?:https?:\/\/|\/[^/]|assets\/)/i.test(currentImage)
      ? (currentImage.startsWith('assets/') ? '../' + currentImage : currentImage) : '';
    resetPreview();
    dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${product ? 'Редактировать товар' : 'Создать продукт'}</h2>
      <button type="button" data-close-dialog aria-label="Закрыть окно">×</button></div>
      ${locked ? '<p class="dialog-sub">Основные данные этой позиции обновляются из 1С. Документами и публикацией можно управлять здесь.</p>' : ''}
      <form data-catalog-save data-id="${escape(item.id)}">
        <div class="fields">
          <label class="field full">Картинка
            <div class="catalog-cover">
              <img data-catalog-preview alt="Предпросмотр картинки" ${preview ? 'src="' + escape(preview) + '"' : 'hidden'}>
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
              <small>JPEG, PNG или WebP · до 5 МБ</small>
            </div>
          </label>
          ${field('Название', 'name', item.name, 'required maxlength="120" ' + locked)}
          <div class="field">
            <label for="catalog-product-brand">Бренд</label>
            <select id="catalog-product-brand" name="brand"></select>
            <button type="button" class="white-button" data-catalog-new-brand>+ Создать бренд</button>
          </div>
          ${multiline('Описание', 'description', item.description, locked)}
          ${field('Цена, ₽', 'price', item.price || '', 'type="number" min="0" step="0.01" placeholder="Можно указать позже" ' + locked)}
          ${product ? `
          ${field('Категория', 'category', item.category, 'required maxlength="120" ' + locked)}
          ${field('Артикул', 'sku', item.sku, 'maxlength="120" ' + locked)}
          ${field('Ссылка на основное фото', 'imageUrl', item.imageUrl, 'maxlength="2000"')}
          ${field('Ссылка на источник', 'sourceUrl', item.sourceUrl, 'type="url" maxlength="2000"')}
          <label class="field">Публикация<select name="isActive">
            <option value="true" ${item.isActive === true ? 'selected' : ''}>Опубликован</option>
            <option value="false" ${item.isActive !== true ? 'selected' : ''}>Скрыт</option>
          </select></label>
          ${multiline('Фасовки · по одной на строку', 'sizes', item.sizes?.join('\n'), locked)}
          ${multiline('Характеристики · по одной на строку', 'details', item.details?.join('\n'), locked)}
          ${multiline('Теги · по одному на строку', 'tags', item.tags?.join('\n'), locked)}
          ` : '<p class="catalog-create-note full">Документы можно добавить позже. После сохранения откройте товар в разделе «Материалы».</p>'}
        </div>
        <p class="dialog-sub" data-catalog-message role="status"></p>
        <div class="form-foot"><button type="submit" class="black-button">${product ? 'Сохранить изменения' : 'Создать продукт'}</button></div>
      </form>
      ${product ? `<section class="catalog-documents">
        <h3>Документы</h3>
        <div data-catalog-documents data-id="${escape(item.id)}" aria-live="polite"></div>
        <form data-catalog-upload data-id="${escape(item.id)}">
          <div class="fields">
            ${field('Название документа', 'title', '', 'required maxlength="160"')}
            <label class="field">Тип<select name="kind">${Object.entries(kinds).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
            <label class="field full">Файл PDF · до 5 МБ<input type="file" name="document" required accept="application/pdf,.pdf"></label>
          </div>
          <p class="dialog-sub" data-catalog-message role="status"></p>
          <div class="form-foot"><button type="submit" class="white-button">Прикрепить документ</button></div>
        </form>
      </section>` : ''}`;
    if (!dialog.open) dialog.showModal();
    loadBrands(dialog.querySelector('select[name="brand"]'), item.brand);
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
            <div><strong>${escape(doc.title)}</strong><small>${escape(kinds[doc.kind] || kinds.other)} · PDF · версия ${doc.version || 1} · ${doc.supersededById ? 'Архив' : 'Актуальная'}</small></div>
            <div class="catalog-document-actions">
              <button type="button" class="white-button" data-catalog-download-doc="${escape(doc.id)}" data-filename="${escape(doc.filename)}">Скачать</button>
              ${doc.supersededById ? '' : `<button type="button" class="white-button" data-catalog-replace-doc="${escape(doc.id)}">Заменить PDF</button>
              <button type="button" class="white-button" data-catalog-delete-doc="${escape(doc.id)}">Удалить</button>`}
            </div>
          </div>`).join('')
        : '<p class="dialog-sub">Документы пока не прикреплены.</p>';
    } catch (error) {
      root.textContent = error.message;
    }
  }

  function formData(form){
    const data = Object.fromEntries(new FormData(form));
    delete data.image;
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
    if ('isActive' in data) data.isActive = data.isActive === 'true';
    if (!form.dataset.id) Object.assign(data, { category: 'Без категории', isActive: true });
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
        const product = JSON.stringify(formData(form));
        const image = form.elements.image.files[0];
        let body = product;
        if (image) {
          if (image.size > 5 * 1024 * 1024) throw Error('Размер картинки превышает 5 МБ.');
          body = new FormData();
          body.append('product', product);
          body.append('image', image);
        }
        const { data } = await request(id ? path(id) : base, { method: id ? 'PATCH' : 'POST', body });
        if (form.isConnected && dialog.open) {
          if (id) {
            edit(data);
            dialog.querySelector('[data-catalog-save] [data-catalog-message]').textContent = 'Товар сохранён.';
          } else {
            dialog.close();
            page = 1;
          }
        }
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

  dialog.addEventListener('close', resetPreview);
  dialog.addEventListener('change', event => {
    const input = event.target;
    if (input.name !== 'image') return;
    const img = input.form.querySelector('[data-catalog-preview]');
    if (!Object.hasOwn(img.dataset, 'original')) img.dataset.original = img.getAttribute('src') || '';
    resetPreview();
    if (input.files[0]) previewUrl = URL.createObjectURL(input.files[0]);
    img.src = previewUrl || img.dataset.original;
    img.hidden = !previewUrl && !img.dataset.original;
  });

  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-catalog-new-brand]');
    if (!button) return;
    selectedBrandControl = button.form.elements.brand;
    brandDialog.innerHTML = `<div class="dialog-head"><h2 id="catalog-brand-title">Создать бренд</h2>
      <button type="button" aria-label="Закрыть окно" data-brand-close>×</button></div>
      <form><div class="fields">
        ${field('Название', 'name', '', 'required maxlength="100" autofocus')}
        ${multiline('Описание', 'description', '')}
      </div><p class="dialog-sub" role="status"></p>
      <div class="form-foot"><button class="black-button" type="submit">Создать бренд</button></div></form>`;
    brandDialog.showModal();
  });

  brandDialog.addEventListener('click', event => {
    if (event.target.closest('[data-brand-close]')) brandDialog.close();
  });

  brandDialog.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const select = selectedBrandControl;
    const button = event.submitter;
    const message = form.querySelector('[role="status"]');
    button.disabled = true;
    message.textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      if (!values.name.trim()) throw Error('Введите название бренда.');
      const { data } = await request(brandEndpoint, { method: 'POST', body: JSON.stringify(values) });
      if (select.isConnected) {
        const options = Array.from(select.options).filter(option => option.value).map(option => ({ name: option.value }));
        brandOptions(select, [...options, data], data.name);
      }
      if (brandDialog.open && form.isConnected) brandDialog.close();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
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
    if (button.dataset.catalogDownloadDoc) {
      const root = button.closest('[data-catalog-documents]');
      const endpoint = path(root.dataset.id) + '/documents/' + encodeURIComponent(button.dataset.catalogDownloadDoc);
      try {
        const response = await api.fetch(endpoint);
        if (!response.ok) throw Error('Не удалось скачать PDF.');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = button.dataset.filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        if (root.isConnected) dialog.querySelector('[data-catalog-upload] [data-catalog-message]').textContent = error.message;
      }
    }
    if (button.dataset.catalogReplaceDoc) {
      const root = button.closest('[data-catalog-documents]');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file || !root.isConnected) return;
        const message = dialog.querySelector('[data-catalog-upload] [data-catalog-message]');
        button.disabled = true;
        try {
          if (file.size > 5 * 1024 * 1024) throw Error('Размер PDF превышает 5 МБ.');
          const body = new FormData();
          body.append('document', file);
          await request(path(root.dataset.id) + '/documents/' + encodeURIComponent(button.dataset.catalogReplaceDoc), { method: 'PUT', body });
          if (root.isConnected) {
            message.textContent = 'Загружена новая версия PDF.';
            loadDocuments();
          }
        } catch (error) {
          if (root.isConnected) message.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      }, { once: true });
      input.click();
    }
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
