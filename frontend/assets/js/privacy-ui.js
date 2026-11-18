(() => {
  'use strict';
  const noticeVersion = '2026-11-18';
  const storageKey = 'psl_cookie_notice_v1';
  const links = document.createElement('nav');
  links.className = 'psl-legal-links';
  links.setAttribute('aria-label', 'Документы и данные');
  links.innerHTML = '<a href="/documents.html">Документы сайта</a><a href="/privacy.html">Персональные данные</a><a href="/cookies.html">Cookies</a>';
  const composer = document.querySelector('.composer-wrap');
  if (composer) composer.append(links);
  else document.body.append(links);

  function showNotice() {
    if (document.querySelector('.psl-cookie-notice')) return;
    const notice = document.createElement('section');
    notice.className = 'psl-cookie-notice';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-label', 'Технические cookies');
    notice.innerHTML = '<div><strong>Cookies и данные браузера</strong><p>Используем технические cookies и хранилище браузера для входа, корзины и настроек. <a href="/cookies.html">Подробнее</a></p></div><button type="button">Понятно</button>';
    notice.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(storageKey, noticeVersion); } catch {}
      notice.remove();
    });
    document.body.append(notice);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-cookie-notice]')) showNotice();
  });
  let acknowledged = false;
  try { acknowledged = localStorage.getItem(storageKey) === noticeVersion; } catch {}
  if (!acknowledged) showNotice();
})();
