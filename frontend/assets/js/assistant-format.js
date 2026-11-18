(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parser = new window.marked.Marked({ gfm: true, breaks: false });
  // HTML supplied in a response is displayed as text, never treated as a component.
  parser.use({ renderer: { html(token) { return escape(token.text); } } });
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function render(value) {
    const html = parser.parse(String(value ?? '').slice(0, 100000));
    const template = document.createElement('template');
    template.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','a','ul','ol','li','blockquote','pre','code','hr','table','thead','tbody','tr','th','td','input'],
      ALLOWED_ATTR: ['href','title','class','start','align','type','checked','disabled'],
    });
    template.content.querySelectorAll('a').forEach(a => {
      const url = safeUrl(a.getAttribute('href'));
      if (!url) { a.removeAttribute('href'); return; }
      a.href = url;
      if (new URL(url).origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });
    template.content.querySelectorAll('input').forEach(input => {
      if (input.type !== 'checkbox') input.remove();
      else { input.disabled = true; input.setAttribute('aria-label', input.checked ? 'Выполнено' : 'Не выполнено'); }
    });
    template.content.querySelectorAll('table').forEach(table => {
      const wrap = document.createElement('div'); wrap.className = 'markdown-table';
      wrap.tabIndex = 0; wrap.setAttribute('role','region'); wrap.setAttribute('aria-label','Таблица в ответе');
      table.replaceWith(wrap); wrap.append(table);
    });
    template.content.querySelectorAll('pre').forEach(pre => {
      const wrap = document.createElement('div'); wrap.className = 'markdown-code';
      const bar = document.createElement('div'); bar.className = 'markdown-code-bar';
      const label = document.createElement('span'); label.textContent = pre.querySelector('code')?.className.replace('language-','') || 'Код';
      const copy = document.createElement('button'); copy.type = 'button'; copy.dataset.copyCode = ''; copy.textContent = 'Скопировать'; copy.setAttribute('aria-label','Скопировать код');
      bar.append(label,copy); pre.replaceWith(wrap); wrap.append(bar,pre);
    });
    return template.innerHTML;
  }
  window.PSLChatFormat = Object.freeze({ render, escape, safeUrl });
})();
