(function(){
  'use strict';
  const opening = document.querySelector('[data-opening]');
  if(opening){
    let seen = false;
    try { seen = sessionStorage.getItem('psl_opening_svg_v1') === '1'; sessionStorage.setItem('psl_opening_svg_v1','1'); } catch(e){}
    if(seen || matchMedia('(prefers-reduced-motion: reduce)').matches) opening.remove();
    else {
      document.documentElement.classList.add('opening-active');
      setTimeout(() => { opening.classList.add('opening-leave'); document.documentElement.classList.remove('opening-active'); },1100);
      setTimeout(() => opening.remove(),1700);
    }
    // Restore navigation immediately when returning from the browser cache.
    window.addEventListener('pageshow',e => { if(e.persisted){ opening.remove(); document.documentElement.classList.remove('opening-active'); } });
  }
  const menu = document.querySelector('.menu-toggle');
  const panel = document.querySelector('#mobile-menu');
  function closeMenu(){ if(!menu || !panel) return; menu.setAttribute('aria-expanded','false'); panel.hidden = true; }
  menu?.addEventListener('click',() => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded',String(open)); panel.hidden = !open; });
  panel?.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e => { if(e.key === 'Escape'){ closeMenu(); menu?.focus(); } });
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }),{threshold:.1});
    document.querySelectorAll('.section-intro,.brand-entry,.consult-panel').forEach(el => { el.classList.add('reveal'); observer.observe(el); });
  }
})();
