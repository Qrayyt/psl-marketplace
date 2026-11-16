(() => {
  const api = window.PSL_API;
  const status = document.querySelector('#status');
  const login = document.querySelector('#login');
  const list = document.querySelector('#documents');
  const search = document.querySelector('#search');
  const count = document.querySelector('#count');
  const buttons = [...document.querySelectorAll('[data-section]')];
  let documents = [];
  let section = '';

  async function download(document, button) {
    button.disabled = true;
    button.textContent = 'Загрузка…';
    status.hidden = true;
    try {
      const response = await api.fetch('/api/handbook/documents/' + document.id);
      if (!response.ok) throw new Error('Не удалось скачать PDF. Обновите страницу и попробуйте ещё раз.');
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      status.textContent = error.message;
      status.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = 'Скачать PDF ↓';
    }
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase('ru').split(/\s+/);
    const visible = documents.filter(item => (!section || item.section === section)
      && query.every(term => (item.title + ' ' + (item.filename || '')).toLocaleLowerCase('ru').includes(term)));
    count.textContent = visible.length ? 'Материалов: ' + visible.length : 'Материалы не найдены';
    list.replaceChildren(...visible.map(item => {
      const row = document.createElement('li');
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('small');
      const button = document.createElement('button');
      title.textContent = item.title;
      if (item.source) {
        const link = document.createElement('a');
        link.href = item.source;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Открыть в старом справочнике ↗';
        detail.textContent = item.section;
        info.append(title, detail);
        row.append(info, link);
        return row;
      }
      detail.textContent = item.section + ' · ' + item.pages + ' стр. · ' + item.filename;
      button.type = 'button';
      button.textContent = 'Скачать PDF ↓';
      button.setAttribute('aria-label', 'Скачать PDF: ' + item.title + ' — ' + item.filename);
      button.addEventListener('click', () => download(item, button));
      info.append(title, detail);
      row.append(info, button);
      return row;
    }));
  }

  function showLogin() {
    status.textContent = 'Войдите в аккаунт PSL с доступом к справочнику.';
    login.href = api.authUrl('login', location.href);
    login.hidden = false;
  }

  search.addEventListener('input', render);
  buttons.forEach(button => button.addEventListener('click', () => {
    section = button.dataset.section;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));

  async function start() {
    if (!api.getToken() && !(api.getRefreshToken() && await api.refreshToken())) return showLogin();
    const response = await api.fetch('/api/handbook/');
    if (response.status === 401) return showLogin();
    if (response.status === 403) {
      status.textContent = 'Доступ к справочнику не выдан. Обратитесь к менеджеру PSL.';
      return;
    }
    if (!response.ok) throw new Error('Справочник временно недоступен. Попробуйте позже.');
    const data = (await response.json()).data;
    documents = [...data.articles, ...data.documents.map(item => ({ ...item, section: 'Архив сертификатов' }))];
    render();
    status.hidden = true;
    document.querySelector('#archive').hidden = false;
  }

  start().catch(() => { status.textContent = 'Справочник временно недоступен. Попробуйте позже.'; });
})();
