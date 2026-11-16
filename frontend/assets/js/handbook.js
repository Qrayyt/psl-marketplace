(() => {
  const status = document.querySelector('#status');
  const list = document.querySelector('#documents');
  const search = document.querySelector('#search');
  const count = document.querySelector('#count');
  const buttons = [...document.querySelectorAll('[data-section]')];
  const retry = document.querySelector('#retry');
  const reset = document.querySelector('#reset');
  const archive = document.querySelector('#archive');

  const params = new URLSearchParams(location.search);
  search.value = params.get('q') || '';
  let active = buttons.find(button => button.dataset.filter === params.get('section')) || buttons[0];
  let documents = [];
  const { articlePath, articles, sourceTitles } = window.PSLHandbook;

  function normalize(value) {
    return value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е');
  }

  function render() {
    const query = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const visible = documents.filter(item => (!active.dataset.section || item.section === active.dataset.section)
      && query.every(term => item.searchText.includes(term)));
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button === active)));
    reset.hidden = Boolean(visible.length || (!query.length && active === buttons[0]));
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
        link.textContent = item.title;
        title.replaceChildren(link);
        if (!localPath) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        detail.textContent = localPath ? item.section : item.section + ' · Старый справочник';
        info.append(title, detail);
        row.append(info);
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

  function applyFilters() {
    const url = new URL(location.href);
    const query = search.value.trim();
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (active.dataset.filter) url.searchParams.set('section', active.dataset.filter);
    else url.searchParams.delete('section');
    history.replaceState(history.state, '', url);
    render();
  }

  search.addEventListener('input', applyFilters);
  buttons.forEach(button => button.addEventListener('click', () => {
    active = button;
    applyFilters();
  }));
  reset.addEventListener('click', () => {
    search.value = '';
    active = buttons[0];
    search.focus();
    applyFilters();
  });

  async function start() {
    const retryHadFocus = document.activeElement === retry;
    status.textContent = 'Загружаем материалы…';
    retry.disabled = true;
    const response = await fetch('/api/handbook/', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Справочник временно недоступен. Попробуйте позже.');
    const data = (await response.json()).data;
    documents = [...data.articles.flatMap(item => {
      const articleId = new URL(item.source).pathname.match(/^\/page(\d+)\.html$/)?.[1];
      if (articleId === '36603289') return []; // Legacy form confirmation, not an article.
      const article = articles[articleId];
      const title = sourceTitles[articleId] || item.title;
      const searchText = normalize([title, item.title, item.section, article?.terms,
        article?.blocks?.flat(2).join(' '), article?.products?.join(' ')].join(' '));
      return [{ ...item, articleId, title, searchText }];
    }), ...data.documents.map(item => ({
      ...item,
      section: 'Архив сертификатов',
      searchText: normalize([item.title, item.filename, item.product].join(' ')),
    }))];
    render();
    status.hidden = true;
    archive.hidden = false;
    if (retryHadFocus && (document.activeElement === retry || document.activeElement === document.body)) search.focus();
    retry.hidden = true;
  }

  function load() {
    start().catch(() => {
      status.textContent = 'Справочник временно недоступен. Попробуйте загрузить его повторно.';
      retry.disabled = false;
      retry.hidden = false;
    });
  }

  retry.addEventListener('click', load);
  load();
})();
