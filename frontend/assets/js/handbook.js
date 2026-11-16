(() => {
  const status = document.querySelector('#status');
  const list = document.querySelector('#documents');
  const search = document.querySelector('#search');
  const count = document.querySelector('#count');
  const buttons = [...document.querySelectorAll('[data-section]')];
  let documents = [];
  let section = '';
  const { articlePath, articles } = window.PSLHandbook;

  function render() {
    const query = search.value.trim().toLocaleLowerCase('ru').split(/\s+/);
    const visible = documents.filter(item => (!section || item.section === section)
      && query.every(term => (item.title + ' ' + (item.filename || '') + ' ' + (articles[item.articleId]?.terms || '')).toLocaleLowerCase('ru').includes(term)));
    count.textContent = visible.length ? 'Материалов: ' + visible.length : 'Материалы не найдены';
    list.replaceChildren(...visible.map(item => {
      const row = document.createElement('li');
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('small');
      title.textContent = item.title;
      if (item.source) {
        const link = document.createElement('a');
        const localPath = articlePath(item.articleId);
        link.href = localPath || item.source;
        link.textContent = localPath ? 'Читать статью →' : 'Открыть в старом справочнике ↗';
        if (!localPath) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        detail.textContent = item.section;
        info.append(title, detail);
        row.append(info, link);
        return row;
      }
      detail.textContent = item.section + ' · ' + item.pages + ' стр. · ' + item.filename;
      const link = document.createElement('a');
      link.href = '/api/handbook/documents/' + encodeURIComponent(item.id);
      link.textContent = 'Скачать PDF ↓';
      link.setAttribute('aria-label', 'Скачать PDF: ' + item.title + ' — ' + item.filename);
      info.append(title, detail);
      row.append(info, link);
      return row;
    }));
  }

  search.addEventListener('input', render);
  buttons.forEach(button => button.addEventListener('click', () => {
    section = button.dataset.section;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));

  async function start() {
    const response = await fetch('/api/handbook/');
    if (!response.ok) throw new Error('Справочник временно недоступен. Попробуйте позже.');
    const data = (await response.json()).data;
    documents = [...data.articles.flatMap(item => {
      const articleId = new URL(item.source).pathname.match(/^\/page(\d+)\.html$/)?.[1];
      if (articleId === '36603289') return []; // Legacy form confirmation, not an article.
      return [{ ...item, articleId, title: articles[articleId]?.title || item.title }];
    }), ...data.documents.map(item => ({ ...item, section: 'Архив сертификатов' }))];
    render();
    status.hidden = true;
    document.querySelector('#archive').hidden = false;
  }

  start().catch(() => { status.textContent = 'Справочник временно недоступен. Попробуйте позже.'; });
})();
