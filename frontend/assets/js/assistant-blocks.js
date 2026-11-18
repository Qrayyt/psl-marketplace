(() => {
  'use strict';
  const format = window.PSLChatFormat, esc = format.escape;
  const product = id => (window.PRODUCTS || []).find(p => p.id === id || p.catalogSlug === id);
  const href = id => '/product.html?id=' + encodeURIComponent(id);
  const icon = type => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (type === 'spark' ? '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>' : '<path d="m9 5 7 7-7 7"/>') + '</svg>';
  function imageUrl(value) { try { const u = new URL(value,location.href); return u.origin === location.origin && /^https?:$/.test(u.protocol) ? u.href : '/assets/images/psl-logo.svg'; } catch { return '/assets/images/psl-logo.svg'; } }
  const resolveIds = b => Array.isArray(b.ids) ? [...new Set(b.ids)].map(product).filter(Boolean).slice(0,6) : [];
  const price = p => Number(p.price)>0 ? new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(p.price) : 'Цена по запросу';
  const visualHead = title => '<div class="visual-heading">'+icon('spark')+'<span>'+esc(title)+'</span></div>';
  const footer = '<div class="block-footer"><a href="/">Открыть каталог '+icon('arrow')+'</a></div>';
  function card(p) { return `<a class="material-card" href="${href(p.id)}" aria-label="Открыть ${esc(p.name)}"><span class="material-thumb"><img src="${esc(imageUrl(p.image))}" alt="" loading="lazy"></span><span class="material-info"><strong>${esc(p.name)}</strong><span>${esc(p.category === 'Без категории' ? p.brand : p.category || p.brand || '')}</span><b>${esc(price(p))}</b></span><span class="material-arrow">${icon('arrow')}</span></a>`; }
  const renderers = {
    products(b) { return '<div class="material-list">'+resolveIds(b).map(card).join('')+'</div>'; },
    comparison(b){const list=resolveIds(b).slice(0,2);if(list.length<2)return '';return `<section class="visual-block" aria-label="Сравнение материалов">${visualHead('Сравнение материалов')}<div class="compare-scroll"><table class="compare-table"><caption class="sr-only">Данные из карточек каталога PSL</caption><tbody><tr class="compare-name"><th scope="row">Материал</th>${list.map(p=>`<td><img src="${esc(imageUrl(p.image))}" alt=""><a href="${href(p.id)}">${esc(p.name)}</a></td>`).join('')}</tr>${[['Бренд',p=>p.brand],['Категория',p=>p.category],['Формат / фасовка',p=>(p.sizes||[]).join(', ')||'Уточнить у PSL'],['Цена',price],['Описание',p=>p.description]].map(([label,get])=>`<tr><th scope="row">${label}</th>${list.map(p=>`<td>${esc(get(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${footer}</section>`;},
    floor(b){const list=resolveIds(b).slice(0,3);if(!list.length)return '';const labels=['Промышленная плитка','Клей / затирка','Грунтовка'];const tiles=[{y:16,fill:'#dededb',side:'#b9b9b6'},{y:49,fill:'#d2d2ce',side:'#adadaa'},{y:75,fill:'#e9e9e6',side:'#c5c5c2'}];return `<section class="visual-block" aria-label="Иллюстрация слоёв пола">${visualHead('Слои промышленного пола')}<div class="system-layout"><div class="floor-visual"><svg viewBox="0 0 310 230" role="img" aria-label="Три слоя над бетонным основанием. Нажмите на слой, чтобы открыть материал."><path d="m28 158 145-47 111 42-146 52z" fill="#c7c7c5" stroke="#b6b6b3"/><path d="m28 158 110 47v22L28 180z" fill="#aaa9a6"/><path d="m138 205 146-52v22l-146 52z" fill="#bbbcb9"/>${[...list].reverse().map(p=>{const i=list.indexOf(p),{y,fill,side}=tiles[i];return `<a href="${href(p.id)}" aria-label="${labels[i]}: ${esc(p.name)}"><path d="m28 ${72+y} 145-47 111 42-146 52z" fill="${fill}" stroke="#b9b9b6"/><path d="m28 ${72+y} 110 47v9L28 ${81+y}z" fill="${side}"/><path d="m138 ${119+y} 146-52v9l-146 52z" fill="${side}"/>${i===0?`<path d="m100 ${49+y} 111 43M173 ${25+y}l-35 94M28 ${72+y}l145-47" fill="none" stroke="#aaa" stroke-width="1"/>`:''}<circle cx="264" cy="${82+y}" r="10" fill="#fff" stroke="#ccc"/><text x="264" y="${86+y}" text-anchor="middle" font-size="10" font-family="Arial" fill="#555">${i+1}</text></a>`;}).join('')}</svg></div><div class="layer-list">${list.map((p,i)=>`<a class="layer-link" href="${href(p.id)}"><span class="layer-number">${i+1}</span><span><strong>${labels[i]}</strong><small>${esc(p.name)}</small></span><i>${icon('arrow')}</i></a>`).join('')}<div class="layer-link"><span class="layer-number">4</span><span><strong>Бетонное основание</strong><small>Подготовленная поверхность</small></span></div></div></div><p class="scheme-note">Условная иллюстрация, без масштаба и толщин. Состав и совместимость системы уточняются по технической документации.</p></section>`;},

    markdown(b) { return '<div class="answer-text">'+format.render(b.text || b.content || '')+'</div>'; },
    callout(b) { return '<aside class="answer-callout">'+(b.title ? '<strong>'+esc(b.title)+'</strong>' : '')+'<div class="answer-text">'+format.render(b.text || '')+'</div></aside>'; },
    table(b) {
      if (!Array.isArray(b.columns) || !Array.isArray(b.rows)) return '';
      const columns = b.columns.slice(0,10);
      return '<div class="markdown-table" tabindex="0" role="region" aria-label="'+esc(b.title || 'Таблица')+'"><table>'+(b.title?'<caption>'+esc(b.title)+'</caption>':'')+'<thead><tr>'+columns.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+b.rows.slice(0,40).filter(Array.isArray).map(row=>'<tr>'+columns.map((_,i)=>'<td>'+esc(row[i] ?? '')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    },
    details(b) { return '<details class="answer-details"><summary>'+esc(b.title || 'Подробнее')+'</summary><div class="answer-text">'+format.render(b.text || '')+'</div></details>'; },
    links(b) { return '<div class="answer-links">'+(Array.isArray(b.items)?b.items:[]).slice(0,8).map(item=>{const url=format.safeUrl(item?.url);return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(item.title || url)+'</strong><span>'+esc(item.description || '')+'</span>'+icon('arrow')+'</a>':'';}).join('')+'</div>'; }
  };
  // Register extensions from application code; response data never contains executable renderers.
  function register(type, renderer) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(type) || typeof renderer !== 'function' || Object.hasOwn(renderers,type)) throw new TypeError('Invalid or duplicate block renderer');
    renderers[type] = renderer;
  }
  function render(items) {
    if (!Array.isArray(items)) return '';
    return items.slice(0,12).map(b => {
      if (!b || typeof b !== 'object') return '';
      try {
        const renderer = Object.hasOwn(renderers,b.type) ? renderers[b.type] : renderers.markdown;
        return window.DOMPurify.sanitize(renderer(b));
      } catch { return '<div class="answer-text">'+format.render(b.text || '')+'</div>'; }
    }).join('');
  }
  window.PSLChatBlocks = Object.freeze({ render, register });
})();
