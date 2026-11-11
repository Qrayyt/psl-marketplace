(function(){
  'use strict';

  const api = window.PSL_API;
  const { base, escape, imageUrl, path, request } = window.PSLCatalogAdmin;
  const root = document.querySelector('[data-product-editor]');
  const brandEndpoint = '/api/admin/brands';
  const brandDialog = document.querySelector('.catalog-brand-dialog');
  const photoDialog = document.querySelector('.editor-photo-dialog');
  const photoInput = photoDialog.querySelector('[data-photo-input]');
  const dropzone = photoDialog.querySelector('[data-dropzone]');
  const photoMessage = photoDialog.querySelector('[data-photo-message]');
  const params = new URLSearchParams(location.search);
  const page = Number(params.get('page'));
  const back = 'index.html' + (Number.isSafeInteger(page) && page > 1 ? '?page=' + page : '') + '#materials';
  document.querySelector('[data-back-materials]').href = back;
  let id = params.get('id');
  let file;
  let previewUrl;
  let selectedBrandControl;
  const kinds = {
    technical: 'Техническая карта',
    certificate: 'Сертификат',
    safety: 'Паспорт безопасности',
    other: 'Другой документ',
  };

  function field(label, name, value, attributes = ''){
    return `<label class="field">${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
  }

  function multiline(label, name, value, disabled = ''){
    return `<label class="field full">${label}<textarea name="${name}" rows="4" maxlength="4000" ${disabled}>${escape(value)}</textarea></label>`;
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
      if (!select.isConnected) return;
      const current = Array.from(select.options).filter(option => option.value).map(option => ({name: option.value}));
      brandOptions(select, [...data, ...current], select.value);
    } catch (error) {
      if (select.isConnected) root.querySelector('[data-editor-message]').textContent = error.message;
    }
  }

  function render(item = {}){
    const editing = Boolean(item.id);
    const title = editing ? 'Редактирование товара' : 'Создать продукт';
    const locked = item.externalId ? 'disabled' : '';
    const cover = imageUrl(item);
    document.title = title + ' — PSL';
    root.innerHTML = `<div class="editor-heading"><h1>${title}</h1>${editing ? `<p>${escape(item.name)}</p>` : ''}</div>
      <form id="product-form" class="editor-grid" data-catalog-save>
        <section class="editor-panel editor-image-panel" aria-labelledby="editor-image-heading">
          <h2 id="editor-image-heading">Картинка</h2>
          <button type="button" class="editor-cover" data-photo-open aria-label="Загрузить картинку товара">
            <span class="editor-cover-empty" aria-hidden="true">Без фото</span>
            ${cover ? `<img src="${escape(cover)}" alt="">` : '<img alt="" hidden>'}
            <span class="editor-cover-overlay" aria-hidden="true"><span>+</span></span>
          </button>
          <p class="editor-image-caption" data-cover-caption>Нажмите на изображение, чтобы загрузить новое.</p>
        </section>
        <section class="editor-panel editor-details" aria-label="Данные товара">
          ${locked ? '<p class="editor-note">Часть полей синхронизируется с 1С.</p>' : ''}
          ${field('Название', 'name', item.name, 'required maxlength="120" ' + locked)}
          <div class="field"><label for="catalog-product-brand">Бренд</label>
            <div class="editor-brand-row">
              <select id="catalog-product-brand" name="brand"></select>
              <button type="button" class="white-button" data-catalog-new-brand>+ Создать бренд</button>
            </div>
          </div>
          ${multiline('Описание', 'description', item.description, locked)}
          ${multiline('Описание для Guardex', 'guardexDescription', item.guardexDescription)}
          ${field('Цена, ₽', 'price', item.price || '', 'type="number" min="0" step="0.01" placeholder="Можно указать позже" ' + locked)}
          <div class="field">
            <label for="editor-tags">Теги</label>
            <div class="editor-tags" data-tags>
              <span class="editor-tag-list" data-tag-list></span>
              <input id="editor-tags" type="text" maxlength="150" placeholder="Введите тег и нажмите запятую" ${locked}>
            </div>
          </div>
          ${editing ? '' : '<p class="editor-note">Документы можно прикрепить после создания товара.</p>'}
        </section>
      </form>
      ${editing ? `<details class="editor-panel editor-documents">
        <summary>Документы <span aria-hidden="true">⌄</span></summary>
        <div data-catalog-documents data-id="${escape(id)}" aria-live="polite"></div>
        <form data-catalog-upload data-id="${escape(id)}">
          <div class="fields">
            ${field('Название документа', 'title', '', 'required maxlength="160"')}
            <label class="field">Тип<select name="kind">${Object.entries(kinds).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
            <label class="field full">Файл PDF · до 5 МБ<input type="file" name="document" required accept="application/pdf,.pdf"></label>
          </div>
          <p class="dialog-sub" data-catalog-message role="status"></p>
          <div class="form-foot"><button type="submit" class="white-button">Прикрепить документ</button></div>
        </form>
      </details>` : ''}
      <div class="editor-actions">
        <p data-editor-message role="status"></p>
        <a class="white-button" href="${back}">К материалам</a>
        <button type="submit" form="product-form" class="black-button">${editing ? 'Сохранить изменения' : 'Создать продукт'}</button>
      </div>`;
    const form = root.querySelector('[data-catalog-save]');
    loadBrands(form.elements.brand, item.brand);
    setupTags(form, item.tags || []);
    const img = form.querySelector('.editor-cover img');
    img.addEventListener('error', () => { img.hidden = true; });
    if (cover && img.complete && !img.naturalWidth) img.hidden = true;
    const docs = root.querySelector('.editor-documents');
    if (docs) docs.addEventListener('toggle', () => { if (docs.open) loadDocuments(); }, {once:true});
  }

  function setupTags(form, tags){
    const input = form.querySelector('#editor-tags');
    const list = form.querySelector('[data-tag-list]');
    function draw(){
      list.innerHTML = tags.map((tag, i) => `<span class="editor-tag">${escape(tag)}
        ${input.disabled ? '' : `<button type="button" data-remove-tag="${i}" aria-label="Удалить тег ${escape(tag)}">×</button>`}</span>`).join('');
    }
    function add(value){
      for (const part of value.split(',')) {
        const tag = part.trim();
        if (tag && !tags.some(existing => existing.toLowerCase() === tag.toLowerCase())) tags.push(tag);
      }
      draw();
    }
    function commit(){
      add(input.value);
      input.value = '';
    }
    input.addEventListener('input', () => {
      if (input.value.includes(',')) {
        const parts = input.value.split(',');
        input.value = parts.pop();
        add(parts.join(','));
      }
    });
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        commit();
      }
    });
    list.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-tag]');
      if (!button) return;
      tags.splice(Number(button.dataset.removeTag), 1);
      draw();
      input.focus();
    });
    form.readTags = () => { commit(); return tags; };
    draw();
  }

  function acceptPhoto(candidate){
    if (!candidate || !/\.(?:jpe?g|png|webp)$/i.test(candidate.name)) {
      photoMessage.textContent = 'Выберите JPEG, PNG или WebP.';
      return;
    }
    if (candidate.size > 5 * 1024 * 1024) {
      photoMessage.textContent = 'Размер картинки превышает 5 МБ.';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    file = candidate;
    previewUrl = URL.createObjectURL(file);
    const img = root.querySelector('.editor-cover img');
    img.src = previewUrl;
    img.hidden = false;
    root.querySelector('[data-cover-caption]').textContent = file.name + ' · загрузится при сохранении товара.';
    photoDialog.close();
  }

  photoInput.addEventListener('change', () => {
    if (photoInput.files[0]) acceptPhoto(photoInput.files[0]);
    photoInput.value = '';
  });
  photoDialog.querySelector('[data-photo-choose]').addEventListener('click', () => photoInput.click());
  photoDialog.querySelector('[data-photo-close]').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => dropzone.classList.remove('is-dragging'));
  photoDialog.addEventListener('dragover', event => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) dropzone.classList.add('is-dragging');
  });
  photoDialog.addEventListener('dragleave', event => {
    if (!photoDialog.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging');
  });
  photoDialog.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    if (event.dataTransfer.files.length !== 1) {
      photoMessage.textContent = 'Перетащите одно изображение.';
      return;
    }
    acceptPhoto(event.dataTransfer.files[0]);
  });

  function openBrand(button){
    selectedBrandControl = button.form.elements.brand;
    brandDialog.innerHTML = `<div class="dialog-head"><h2 id="catalog-brand-title">Создать бренд</h2>
      <button type="button" aria-label="Закрыть окно" data-brand-close>×</button></div>
      <form><div class="fields">
        ${field('Название', 'name', '', 'required maxlength="100" autofocus')}
        ${multiline('Описание', 'description', '')}
      </div><p class="dialog-sub" role="status"></p>
      <div class="form-foot"><button class="black-button" type="submit">Создать бренд</button></div></form>`;
    brandDialog.showModal();
  }

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

  root.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const saving = form.hasAttribute('data-catalog-save');
    if (!saving && !form.hasAttribute('data-catalog-upload')) return;
    const button = event.submitter;
    const message = saving ? root.querySelector('[data-editor-message]') : form.querySelector('[data-catalog-message]');
    if (button) button.disabled = true;
    message.textContent = '';
    try {
      if (saving) {
        const fields = Object.fromEntries(new FormData(form));
        if ('name' in fields && !fields.name.trim()) throw Error('Введите название товара.');
        for (const key of Object.keys(fields)) fields[key] = fields[key].trim() || null;
        if ('price' in fields) fields.price = Number(fields.price);
        if (!form.querySelector('#editor-tags').disabled) fields.tags = form.readTags();
        if (!id) Object.assign(fields, { category: 'Без категории', isActive: true });
        const product = JSON.stringify(fields);
        let body = product;
        if (file) {
          body = new FormData();
          body.append('product', product);
          body.append('image', file);
        }
        const { data } = await request(id ? path(id) : base, { method: id ? 'PATCH' : 'POST', body });
        const creating = !id;
        id = data.id;
        if (creating) {
          params.set('id', id);
          history.replaceState(null, '', '?' + params);
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        file = null;
        const docsOpen = root.querySelector('.editor-documents')?.open;
        render(data);
        if (docsOpen) root.querySelector('.editor-documents').open = true;
        root.querySelector('[data-editor-message]').textContent = creating ? 'Товар создан.' : 'Изменения сохранены.';
      } else {
        const body = new FormData(form);
        if (body.get('document').size > 5 * 1024 * 1024) throw Error('Размер PDF превышает 5 МБ.');
        await request(path(form.dataset.id) + '/documents', { method: 'POST', body });
        form.reset();
        message.textContent = 'Документ прикреплён.';
        loadDocuments();
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });

  async function init(){
    if (!api.getToken()) {
      location.replace(api.authUrl('login', location.href));
      return;
    }
    try {
      await request('/api/auth/me').then(({data}) => {
        if (data.role !== 'ADMIN') throw Error('Редактор доступен администраторам.');
      });
      render(id ? (await request(path(id))).data : undefined);
    } catch (error) {
      const message = error.status === 403 ? 'Сессия не имеет доступа к редактору. Войдите заново под администратором.' : error.message;
      root.innerHTML = `<section class="editor-panel"><h1>${escape(message)}</h1><a class="white-button" href="${escape(api.authUrl('login', location.href))}">Войти заново</a></section>`;
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }
  async function loadDocuments(){
    const root = root.querySelector('[data-catalog-documents]');
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

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-photo-open')) {
      photoMessage.textContent = '';
      photoDialog.showModal();
    }
    if (button.hasAttribute('data-catalog-new-brand')) openBrand(button);
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
        if (root.isConnected) root.parentElement.querySelector('[data-catalog-upload] [data-catalog-message]').textContent = error.message;
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
        const message = root.parentElement.querySelector('[data-catalog-upload] [data-catalog-message]');
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
        const message = root.parentElement?.querySelector('[data-catalog-upload] [data-catalog-message]');
        if (root.isConnected && message) message.textContent = error.message;
        button.disabled = false;
      }
    }
  });

  init();
})();
