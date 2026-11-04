(function(){
  'use strict';
  const menu=document.querySelector('#catalog-menu');
  const trigger=document.querySelector('[data-catalog-toggle]');
  function closeMenu(){if(menu)menu.hidden=true;trigger?.setAttribute('aria-expanded','false');}
  trigger?.addEventListener('click',()=>{const open=trigger.getAttribute('aria-expanded')!=='true';trigger.setAttribute('aria-expanded',String(open));if(menu)menu.hidden=!open;});
  document.addEventListener('click',e=>{if(!e.target.closest('#catalog-menu')&&!e.target.closest('[data-catalog-toggle]'))closeMenu();});
  const filters=document.querySelector('[data-filters-panel]');
  const filterTrigger=document.querySelector('[data-open-filters]');
  let restoreFocus;
  function setFilters(open){
    if(!filters)return;
    document.body.classList.toggle('filters-open',open);
    filterTrigger?.setAttribute('aria-expanded',String(open));
    filters.inert=!open;
    // Keep keyboard and screen-reader focus inside the active modal.
    for(const node of document.querySelectorAll('body > header,body > main,body > footer'))node.inert=open;
    if(open){restoreFocus=document.activeElement;setTimeout(()=>{if(document.body.classList.contains('filters-open'))filters.querySelector('button')?.focus();},320);}
    else restoreFocus?.focus();
  }
  filterTrigger?.addEventListener('click',()=>setFilters(true));
  document.querySelectorAll('[data-close-filters]').forEach(btn=>btn.addEventListener('click',()=>setFilters(false)));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(document.body.classList.contains('filters-open'))setFilters(false);
      else if(menu&&!menu.hidden){closeMenu();trigger?.focus();}
    }
    if(e.key==='Tab'&&document.body.classList.contains('filters-open')){
      const items=[...filters.querySelectorAll('button,input,select,a[href]')].filter(x=>!x.disabled);
      const first=items[0],last=items.at(-1);
      if(!filters.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();return;}
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  // Broken external API media must not collapse a card or repeat a failed request.
  document.addEventListener('error',e=>{
    if(e.target instanceof HTMLImageElement && e.target.closest('.card-media')){
      const box=e.target.closest('.card-media');e.target.hidden=true;box.classList.add('logo-only');
      box.dataset.caption=e.target.alt;
    }
  },true);
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
})();
