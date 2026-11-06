
(function(){
  function initIntro(){
    const intro = document.querySelector('[data-intro]');
    if(!intro){
      document.body.classList.remove('intro-lock');
      return;
    }
    let seen = false;
    try{ seen = sessionStorage.getItem('psl_intro_seen') === '1'; }catch(e){}
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = seen || reducedMotion ? 80 : 1650;
    if(!seen){
      try{ sessionStorage.setItem('psl_intro_seen','1'); }catch(e){}
    }
    window.setTimeout(() => {
      intro.classList.add('is-hidden');
      document.body.classList.remove('intro-lock');
      window.setTimeout(() => intro.remove(), 650);
    }, delay);
  }

  initIntro();

  const LS_KEYS = {
    cart: 'marketplace_cart_v2',
    favs: 'marketplace_favs_v2',
    chat: 'marketplace_ai_chat_v1'
  };

  const state = {
    products: window.PRODUCTS || [],
    cart: load(LS_KEYS.cart, []),
    favs: load(LS_KEYS.favs, []),
    chat: load(LS_KEYS.chat, [
      { role: 'assistant', text: 'Напишите название материала или категорию для поиска по каталогу. Технический подбор выполняет специалист PSL.' }
    ])
  };

  function load(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function save(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  function fmtPrice(v){
    return Number(v) > 0 ? new Intl.NumberFormat('ru-RU').format(v) + ' ₽' : 'По запросу';
  }
  function getProduct(id){
    return state.products.find(p => (p.id === id || p.catalogSlug === id));
  }
  function cartCount(){
    return state.cart.reduce((acc, item) => acc + item.qty, 0);
  }
  function inFavs(id){ return state.favs.includes(id); }
  function cartItem(id){ return state.cart.find(i => i.id === id); }

  function syncCounters(){
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      const count = cartCount();
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
    document.querySelectorAll('[data-fav-count]').forEach(el => {
      const count = state.favs.length;
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
  }

  function toast(text){
    if(window.innerWidth <= 767 && navigator.vibrate){ try{ navigator.vibrate(10); }catch(e){} }
    let wrap = document.querySelector('.toast-wrap');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 200);
    }, 1800);
  }

  function toggleFav(id, btn){
    const idx = state.favs.indexOf(id);
    if(idx > -1){
      state.favs.splice(idx, 1);
      save(LS_KEYS.favs, state.favs);
      if(btn){btn.classList.remove('active');btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label','В избранное: '+getProduct(id).name);}
      toast('Убрано из избранного');
    }else{
      state.favs.unshift(id);
      save(LS_KEYS.favs, state.favs);
      if(btn){btn.classList.add('active');btn.setAttribute('aria-pressed','true');btn.setAttribute('aria-label','Убрать из избранного: '+getProduct(id).name);}
      toast('Добавлено в избранное');
    }
    syncCounters();
    renderProfile();
  }

  function addToCart(id, btn){
    const existing = cartItem(id);
    if(existing){
      existing.qty += 1;
    }else{
      state.cart.push({ id, qty: 1, size: (getProduct(id)?.sizes || [])[0] || null });
    }
    save(LS_KEYS.cart, state.cart);
    if(btn){
      btn.classList.add('added');
      btn.innerHTML = iconCheck() + '<span>Добавлено</span>';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.innerHTML = iconQuote() + '<span>В заявке</span>';
      }, 1200);
    }
    syncCounters();
    renderProfile();
    toast('Материал добавлен в заявку');
  }

  function updateCartQty(id, delta){
    const item = cartItem(id);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      state.cart = state.cart.filter(x => x.id !== id);
      toast('Товар удалён из корзины');
    }
    save(LS_KEYS.cart, state.cart);
    syncCounters();
    renderProfile();
  }

  function setCartSize(id, size){
    const item = cartItem(id);
    if(item){
      item.size = size;
      save(LS_KEYS.cart, state.cart);
      renderProfile();
    }
  }

  function removeFromCart(id){
    state.cart = state.cart.filter(i => i.id !== id);
    save(LS_KEYS.cart, state.cart);
    syncCounters();
    renderProfile();
    toast('Товар удалён из корзины');
  }

  let catalogBrand = 'all';
  function brandOf(p){
    return p.brand || ['WIRON','FIXTILE','SILFLEX','DOLOTEX'].find(b => p.name.toUpperCase().includes(b)) || (p.name.toUpperCase().includes('MATRIX') ? 'FIXTILE' : 'PSL');
  }
  function renderProducts(){
    const root = document.querySelector('[data-products]');
    if(!root) return;
    const q = (document.querySelector('[data-search]')?.value || '').trim().toLowerCase();
    const category = document.querySelector('[data-category]')?.value || 'all';
    const sort = document.querySelector('[data-sort]')?.value || 'popular';
    const tags = (document.querySelector('[data-tags]')?.value || '').toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
    let list = state.products.filter(p => {
      const text = [p.name,p.description,p.category,brandOf(p),...(p.tags || [])].join(' ').toLowerCase();
      return (!q || text.includes(q)) && (category === 'all' || p.category === category) && (catalogBrand === 'all' || brandOf(p) === catalogBrand) && tags.every(t => text.includes(t));
    });
    if(sort === 'price-asc' || sort === 'price-desc') list.sort((a,b) => {
      const av = Number(a.price), bv = Number(b.price);
      if(!av && !bv) return 0;
      if(!av) return 1;
      if(!bv) return -1;
      return sort === 'price-asc' ? av-bv : bv-av;
    });
    if(sort === 'name') list.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    document.querySelectorAll('[data-mobile-meta]').forEach(el => {
      const n=list.length, mod=n%100;
      el.textContent = n + ' ' + (mod>=11 && mod<=14 ? 'товаров' : n%10===1 ? 'товар' : n%10>=2 && n%10<=4 ? 'товара' : 'товаров');
    });
    const title=document.querySelector('[data-catalog-title]');
    if(title) title.textContent=q ? 'Результаты поиска' : category!=='all' ? category : catalogBrand!=='all' ? catalogBrand : 'Все материалы';
    root.setAttribute('aria-busy','false');
    root.innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="catalog-empty"><h2>Материалы не найдены</h2><p>Попробуйте другое название или сбросьте фильтры.</p><button class="chip" data-clear-catalog>Сбросить фильтры</button></div>';
    bindCardEvents(root);
    root.querySelector('[data-clear-catalog]')?.addEventListener('click',resetCatalog);
    document.querySelectorAll('[data-brand]').forEach(btn=>{const active=btn.dataset.brand===catalogBrand;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('[data-nav-category]').forEach(a=>a.classList.toggle('active',a.dataset.navCategory===category));
    const tokens = [];
    if(category!=='all')tokens.push(['category',category]);
    if(tags.length)tokens.push(['tags',tags.join(', ')]);
    const active=document.querySelector('[data-active-filters]');
    if(active){active.hidden=!tokens.length;active.innerHTML=tokens.map(([key,value])=>`<button data-remove-filter="${key}" aria-label="Убрать фильтр ${escapeHtml(value)}">${escapeHtml(value)}<span aria-hidden="true">×</span></button>`).join('');active.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{const el=document.querySelector(btn.dataset.removeFilter==='category'?'[data-category]':'[data-tags]');el.value=btn.dataset.removeFilter==='category'?'all':'';renderProducts();});}
    const count=document.querySelector('[data-filter-count]');if(count){count.hidden=!tokens.length;count.textContent=tokens.length;}
    if(document.body.classList.contains('market-home')){
      const url=new URL(location.href);url.search='';
      if(q)url.searchParams.set('q',q);
      if(category!=='all')url.searchParams.set('category',category);
      if(catalogBrand!=='all')url.searchParams.set('brand',catalogBrand);
      if(tags.length)url.searchParams.set('tags',tags.join(','));
      if(sort!=='popular')url.searchParams.set('sort',sort);
      history.replaceState(null,'',url);
    }
  }
  function resetCatalog(){
    catalogBrand='all';
    for(const key of ['search','tags']){const el=document.querySelector('[data-'+key+']');if(el)el.value='';}
    const category=document.querySelector('[data-category]');if(category)category.value='all';
    const sort=document.querySelector('[data-sort]');if(sort)sort.value='popular';
    renderProducts();
  }
  function cardHtml(p){
    const id=escapeHtml(p.id), name=escapeHtml(p.name), href='product.html?id='+encodeURIComponent(p.id);
    return `<article class="product-card"><div class="card-media${p.logoOnly?' logo-only':''}" data-caption="${escapeHtml(p.category)}"><a class="card-link" href="${href}" aria-label="${name}"><img src="${escapeHtml(p.image || p.imageUrl || 'assets/images/psl-logo.svg')}" alt="${name}" width="360" height="280" loading="lazy" decoding="async"></a><div class="card-actions"><button class="card-fab ${inFavs(p.id)?'active':''}" type="button" data-fav="${id}" aria-label="${inFavs(p.id)?'Убрать из избранного':'В избранное'}: ${name}" aria-pressed="${inFavs(p.id)}">${iconHeart()}</button></div></div><div class="card-body"><h3 class="card-name"><a href="${href}">${name}</a></h3><p class="card-description">${escapeHtml(p.description || p.category)}</p>${Number(p.price)>0?`<div class="card-price">${fmtPrice(p.price)}</div>`:''}<button class="add-btn" type="button" data-cart-main="${id}">${iconQuote()}<span>${cartItem(p.id)?'В заявке':'Запросить цену'}</span></button></div></article>`;
  }
  function iconQuote(){return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9M14 3l5 5h-5zM8 8h2M8 12h5M8 16h3"/><circle cx="18" cy="17" r="3"/><path d="m20 19 2 3"/></svg>';}

  function bindCardEvents(root){
    root.querySelectorAll('[data-fav]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        toggleFav(btn.dataset.fav, btn);
      });
    });
    root.querySelectorAll('[data-cart],[data-cart-main]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        addToCart(btn.dataset.cart || btn.dataset.cartMain, btn.matches('[data-cart-main]') ? btn : null);
      });
    });
  }

  function initCatalogControls(){
    if(!document.querySelector('[data-products]')) return;
    const categorySelect=document.querySelector('[data-category]');
    if(categorySelect) categorySelect.innerHTML='<option value="all">Все категории</option>'+[...new Set(state.products.map(p=>p.category).filter(Boolean))].map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    function readUrl(){
      const params=new URLSearchParams(location.search);
      catalogBrand=params.get('brand') || 'all';
      for(const [key,defaultValue] of [['search',''],['category','all'],['sort','popular'],['tags','']]){
        const el=document.querySelector('[data-'+key+']');
        if(el){el.value=params.get(key==='search'?'q':key)||defaultValue;if(el.tagName==='SELECT'&&!el.value)el.value=defaultValue;}
      }
      renderProducts();
    }
    document.querySelectorAll('[data-search],[data-tags]').forEach(el=>el.addEventListener('input',renderProducts));
    document.querySelectorAll('[data-category],[data-sort]').forEach(el=>el.addEventListener('change',renderProducts));
    const search=document.querySelector('.market-search');
    search?.addEventListener('submit',e=>{e.preventDefault();renderProducts();document.querySelector('[data-search]').blur();});
    search?.addEventListener('reset',e=>{e.preventDefault();document.querySelector('[data-search]').value='';renderProducts();});
    document.querySelectorAll('[data-brand]').forEach(btn=>btn.addEventListener('click',()=>{catalogBrand=btn.dataset.brand;renderProducts();}));
    document.querySelectorAll('[data-nav-category],[data-solution],[data-brand-link]').forEach(link=>link.addEventListener('click',e=>{
      e.preventDefault();
      if(link.dataset.brandLink){catalogBrand=link.dataset.brandLink;categorySelect.value='all';}
      else{categorySelect.value=link.dataset.navCategory || link.dataset.solution;catalogBrand='all';}
      renderProducts();
      document.querySelector('[data-catalog-toggle]')?.setAttribute('aria-expanded','false');
      const menu=document.querySelector('#catalog-menu');if(menu)menu.hidden=true;
      if(link.dataset.solution)document.querySelector('#catalog').scrollIntoView({behavior:'smooth'});
    }));
    document.querySelector('[data-reset-filters]')?.addEventListener('click',resetCatalog);
    window.addEventListener('popstate',readUrl);
    readUrl();
  }

  function renderProductPage(){
    const root = document.querySelector('[data-product-page]');
    if(!root) return;

    const params = new URLSearchParams(location.search);
    const brand = window.PSL_BRANDS?.[params.get('brand')];
    if(brand){
      document.title = `${brand.name} — PSL`;
      root.innerHTML = `<div class="brand-presentation"><div class="breadcrumbs"><a href="index.html">Главная</a><span>/</span><a href="index.html#brands">Бренды</a><span>/</span><span>${escapeHtml(brand.name)}</span></div><h1>${escapeHtml(brand.name)}</h1><div class="brand-presentation-grid"><img class="brand-presentation-image" src="${escapeHtml(brand.image)}" alt="${escapeHtml(brand.name)}"><section class="brand-presentation-copy"><span class="section-index">POLYMER SYSTEM LABS</span><h2>${escapeHtml(brand.caption)}</h2><p>${escapeHtml(brand.description)}</p><ul>${brand.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul><a class="outline-link" href="${escapeHtml(brand.url)}" target="_blank" rel="noopener">Сайт бренда <span>↗</span></a></section></div></div>`;
      return;
    }
    const id = params.get('id');
    const p = getProduct(id);
    if(!p){ root.innerHTML = '<div class="empty-state">Материал не найден или каталог временно недоступен. <a class="text-link" href="index.html#catalog">Вернуться к каталогу ↗</a></div>'; return; }
    document.title = `${p.name} — PSL`;

    root.innerHTML = `
      <div class="product-layout">
        <section class="gallery-card">
          <div class="product-main-media">
            <img src="${escapeHtml(p.image || p.imageUrl || 'assets/images/psl-logo.svg')}" alt="${escapeHtml(p.name)}">
          </div>
          <div class="product-thumbs">
            ${(p.imageUrls && p.imageUrls.length > 1 ? p.imageUrls : []).map((url, i) => `<div class="thumb${i===0?' active':''}"><img src="${escapeHtml(url)}" alt="${escapeHtml(p.name)}" data-gallery-idx="${i}"></div>`).join('')}
          </div>
        </section>
        <section class="detail-card">
          <div class="breadcrumbs">
            <a href="index.html">Главная</a>
            <span>•</span>
            <span>${escapeHtml(p.category)}</span>
            <span>•</span>
            <span>${escapeHtml(p.name)}</span>
          </div>
          <h1 class="product-title">${escapeHtml(p.name)}</h1>
          <div class="rating-row">${p.rating ? `★ ${p.rating} · ${p.reviews || 0} отзывов · ` : ''}${escapeHtml(p.color)}</div>
          <div class="product-price">${fmtPrice(p.price)} ${p.oldPrice ? `<span class="old-price" style="font-size:18px;margin-left:8px">${fmtPrice(p.oldPrice)}</span>` : ''}</div>
          <p class="product-copy">${escapeHtml(p.description)}</p>

          ${p.sizes?.length ? `<div class="option-block">
            <div class="option-label">Вариант / фасовка</div>
            <div class="size-row">
              ${(p.sizes || []).map((s,i) => `<button class="size-btn ${i===0?'active':''}" type="button" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
            </div>
          </div>

          ` : ''}
          ${p.details?.length ? `<div class="option-block">
            <div class="option-label">Характеристики</div>
            <ul class="detail-list">
              ${(p.details || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>

          ` : ''}
          <div class="option-block" data-product-documents hidden></div>
          ${p.sourceUrl ? `<a class="source-link" href="${escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener">Информация о материале ↗</a>` : ''}
          <div class="action-row">
            <button class="primary-btn" type="button" data-buy-product="${p.id}">
              ${iconCart()} Добавить в заявку
            </button>
            <button class="ghost-btn ${inFavs(p.id) ? 'active-ish' : ''}" type="button" data-fav-product="${p.id}">
              ${iconHeart()} ${inFavs(p.id) ? 'Убрать из избранного' : 'В избранное'}
            </button>
          </div>
        </section>
      </div>
    `;
    loadProductDocuments(root, p.id);


    let selectedSize = (p.sizes || [])[0] || null;
    root.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-size]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.dataset.size;
      });
    });
    // Галерея: клик по миниатюре меняет главное фото
    root.querySelectorAll('[data-gallery-idx]').forEach(img => {
      img.addEventListener('click', () => {
        const mainImg = root.querySelector('.product-main-media img');
        if(mainImg) mainImg.src = img.src;
        root.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        img.closest('.thumb')?.classList.add('active');
      });
    });

    root.querySelector('[data-buy-product]')?.addEventListener('click', () => {
      const existing = cartItem(p.id);
      if(existing){
        existing.qty += 1;
        existing.size = selectedSize || existing.size;
      }else{
        state.cart.push({ id: p.id, qty: 1, size: selectedSize });
      }
      save(LS_KEYS.cart, state.cart);
      syncCounters();
      toast('Материал добавлен в заявку');
    });
    root.querySelector('[data-fav-product]')?.addEventListener('click', e => {
      toggleFav(p.id, null);
      const button = e.currentTarget;
      button.classList.toggle('active-ish', inFavs(p.id));
      button.innerHTML = iconHeart() + (inFavs(p.id) ? ' Убрать из избранного' : ' В избранное');
    });
  }

  async function loadProductDocuments(root, id){
    const section = root.querySelector('[data-product-documents]');
    const endpoint = (window.PSL_API?.baseUrl || '') + '/api/products/' + encodeURIComponent(id) + '/documents';
    try {
      const response = await fetch(endpoint, {signal: AbortSignal.timeout(5000)});
      if(!response.ok) return;
      const result = await response.json();
      if(!section?.isConnected || !Array.isArray(result.data) || !result.data.length) return;
      section.innerHTML = '<div class="option-label">Документы</div><ul class="detail-list">' +
        result.data.map(doc => '<li><a class="source-link" href="' +
          escapeHtml(endpoint + '/' + encodeURIComponent(doc.id)) + '">' +
          escapeHtml(doc.title) + ' · PDF ↓</a></li>').join('') + '</ul>';
      section.hidden = false;
    } catch {
      // The storefront can still show the product when documents are unavailable.
    }
  }

  function renderProfile(){
    const root = document.querySelector('[data-profile-content]');
    if(!root) return;

    const view = document.querySelector('[data-profile-nav].active')?.dataset.profileNav || 'cart';
    document.querySelectorAll('[data-profile-nav]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-profile-nav]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        renderProfile();
      };
    });

    document.querySelector('[data-stat-cart]') && (document.querySelector('[data-stat-cart]').textContent = cartCount());
    document.querySelector('[data-stat-favs]') && (document.querySelector('[data-stat-favs]').textContent = state.favs.length);
    document.querySelector('[data-stat-total]') && (document.querySelector('[data-stat-total]').textContent = fmtPrice(state.cart.reduce((s,i)=>s+(getProduct(i.id)?.price || 0)*i.qty, 0)));

    if(view === 'cart'){
      if(!state.cart.length){
        root.innerHTML = `<div class="empty-state">Корзина пока пустая. Возвращайся на главную и собирай каталог.</div>`;
        return;
      }
      const total = state.cart.reduce((sum, item) => sum + (getProduct(item.id)?.price || 0) * item.qty, 0);
      root.innerHTML = `
        <div class="list-grid">
          ${state.cart.map(item => {
            const p = getProduct(item.id); if(!p) return '';
            return `
              <article class="profile-product">
                <a class="thumb-small" href="product.html?id=${p.id}"><img src="${p.image}" alt="${escapeHtml(p.name)}"></a>
                <div>
                  <h3 class="card-name" style="margin-bottom:6px"><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
                  <div class="card-meta">${escapeHtml(p.category)} · ${escapeHtml(p.color)}</div>
                  <div class="price-row"><div class="price" style="font-size:18px">${fmtPrice(p.price)}</div></div>
                  <div class="size-row" style="margin-top:10px">
                    ${p.sizes.map(size => `<button class="size-btn ${item.size===size?'active':''}" type="button" data-profile-size="${p.id}|${escapeHtml(size)}">${escapeHtml(size)}</button>`).join('')}
                  </div>
                </div>
                <div class="profile-actions">
                  <button class="ghost-btn" type="button" data-qty-down="${p.id}">−</button>
                  <div class="pill">Кол-во: ${item.qty}</div>
                  <button class="ghost-btn" type="button" data-qty-up="${p.id}">+</button>
                  <button class="ghost-btn" type="button" data-remove-cart="${p.id}">Удалить</button>
                </div>
              </article>
            `;
          }).join('')}
          <section class="summary-box">
            <h3 class="card-name">Итого</h3>
            <div class="divider"></div>
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
              <span class="muted">Товаров: ${cartCount()}</span>
              <strong style="font-size:24px">${fmtPrice(total)}</strong>
            </div>
            <div class="action-row">
              ${state.cart.some(i=>getProduct(i.id)?.catalogOnly) ? `<a class="primary-btn" href="mailto:info@polymer-system.ru?subject=${encodeURIComponent('Запрос стоимости материалов PSL')}&body=${encodeURIComponent(state.cart.map(i=>{const p=getProduct(i.id);return p ? p.name+' — '+i.qty+' шт. ('+(i.size || 'фасовка по согласованию')+')' : '';}).filter(Boolean).join('\n'))}">Запросить стоимость ↗</a>` : '<button class="primary-btn" type="button">Оформить заказ</button>'}
              <a class="ghost-btn" href="index.html#catalog">Продолжить покупки</a>
            </div>
          </section>
        </div>
      `;
      root.querySelectorAll('[data-qty-down]').forEach(btn => btn.onclick = () => updateCartQty(btn.dataset.qtyDown, -1));
      root.querySelectorAll('[data-qty-up]').forEach(btn => btn.onclick = () => updateCartQty(btn.dataset.qtyUp, 1));
      root.querySelectorAll('[data-remove-cart]').forEach(btn => btn.onclick = () => removeFromCart(btn.dataset.removeCart));
      root.querySelectorAll('[data-profile-size]').forEach(btn => btn.onclick = () => {
        const [id,size] = btn.dataset.profileSize.split('|');
        setCartSize(id,size);
      });
      return;
    }

    if(view === 'favs'){
      const items = state.favs.map(getProduct).filter(Boolean);
      if(!items.length){
        root.innerHTML = `<div class="empty-state">В избранном пока пусто. Нажимай на сердечки в каталоге — всё появится здесь.</div>`;
        return;
      }
      root.innerHTML = `
        <div class="list-grid">
          ${items.map(p => `
            <article class="profile-product">
              <a class="thumb-small" href="product.html?id=${p.id}"><img src="${p.image}" alt="${escapeHtml(p.name)}"></a>
              <div>
                <h3 class="card-name" style="margin-bottom:6px"><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
                <div class="card-meta">${escapeHtml(p.category)} · ${escapeHtml(p.color)}</div>
                <div class="price-row"><div class="price" style="font-size:18px">${fmtPrice(p.price)}</div></div>
              </div>
              <div class="profile-actions">
                <button class="primary-btn" type="button" data-add-fav-cart="${p.id}">${iconCart()} В корзину</button>
                <button class="ghost-btn" type="button" data-remove-fav="${p.id}">Убрать</button>
              </div>
            </article>
          `).join('')}
        </div>
      `;
      root.querySelectorAll('[data-add-fav-cart]').forEach(btn => btn.onclick = () => addToCart(btn.dataset.addFavCart));
      root.querySelectorAll('[data-remove-fav]').forEach(btn => btn.onclick = () => toggleFav(btn.dataset.removeFav));
      return;
    }

    root.innerHTML = `
      <div class="summary-box">
        <h3 class="card-name">Аккаунт</h3>
        <p class="muted">Здесь дальше можно подключить авторизацию, адреса доставки, историю заказов, способы оплаты и реальные данные профиля.</p>
        <div class="contact-grid">
          <div class="contact-item"><div class="contact-label">Статус</div><div class="contact-value">Готово под интеграцию</div></div>
          <div class="contact-item"><div class="contact-label">Следующий шаг</div><div class="contact-value">Подключить backend и checkout</div></div>
        </div>
      </div>
    `;
  }

  function renderChat(){
    const root = document.querySelector('[data-chat-messages]');
    if(!root) return;
    root.innerHTML = state.chat.map(msg => `
      <div class="msg ${msg.role === 'user' ? 'user' : 'assistant'}">
        <div class="${msg.role === 'user' ? 'bubble' : 'plain-text'}">${escapeHtml(msg.text)}</div>
      </div>
    `).join('');
    root.scrollTop = root.scrollHeight;
  }

  function initChat(){
    const form = document.querySelector('[data-chat-form]');
    if(!form) return;
    const textarea = form.querySelector('[data-chat-input]');
    const historyButtons = document.querySelectorAll('[data-chat-preset]');
    const menuBtn = document.querySelector('[data-chat-menu]');

    function setChatMenuOpen(next){
      document.body.classList.toggle('chat-menu-open', !!next);
    }
    menuBtn?.addEventListener('click', () => {
      setChatMenuOpen(!document.body.classList.contains('chat-menu-open'));
    });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') setChatMenuOpen(false);
    });
    document.addEventListener('click', e => {
      if(!document.body.classList.contains('chat-menu-open')) return;
      const inSidebar = e.target.closest('.chat-sidebar');
      const opener = e.target.closest('[data-chat-menu]');
      if(!inSidebar && !opener){ setChatMenuOpen(false); }
    });

    historyButtons.forEach(btn => btn.onclick = () => {
      textarea.value = btn.dataset.chatPreset;
      textarea.focus();
      if(window.innerWidth <= 767){ setChatMenuOpen(false); }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = textarea.value.trim();
      if(!text) return;
      state.chat.push({ role: 'user', text });
      const answer = catalogReply(text);
      state.chat.push({ role: 'assistant', text: answer });
      save(LS_KEYS.chat, state.chat);
      textarea.value = '';
      textarea.style.height = '56px';
      renderChat();
    });
    document.querySelector('[data-new-chat]')?.addEventListener('click', () => {
      state.chat = [{ role: 'assistant', text: 'Новый подбор открыт. Опишите основание, нагрузку и условия эксплуатации.' }];
      save(LS_KEYS.chat, state.chat);
      renderChat();
    });
    renderChat();
  }

  function catalogReply(text){
    const q = text.toLowerCase();
    const hasBudget = q.match(/(\d{3,6})/);
    const budget = hasBudget ? parseInt(hasBudget[1],10) : null;
    let picks = [...state.products];
    if(q.includes('бетон')) picks = picks.filter(p => `${p.name} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase().includes('бетон'));
    if(q.includes('гидроизоляц')) picks = picks.filter(p => p.category === 'Гидроизоляция');
    if(q.includes('пол')) picks = picks.filter(p => p.category === 'Промышленные полы');
    if(q.includes('кле')) picks = picks.filter(p => p.category === 'Клеевые системы');
    if(budget) picks = picks.filter(p => p.price <= budget);
    picks = picks.slice(0,3);

    if(q.includes('фасов') || q.includes('расход')){
      return 'Расход и фасовку нужно уточнить по технологической карте конкретного материала. Документы доступны на polymer-system.ru/documents.';
    }
    if(q.includes('систем') || q.includes('подбери')){
      const names = picks.length ? picks.map(p => p.name).join(', ') : 'несколько подходящих материалов';
      return 'Для подбора системы обратитесь к техническому специалисту PSL через polymer-system.ru. Подготовьте данные об основании, нагрузке и условиях эксплуатации.';
    }
    if(q.includes('что ты умеешь')){
      return 'Это поиск по загруженному каталогу. Технические рекомендации и расчёты предоставляет специалист PSL.';
    }
    if(picks.length){
      return 'По вашему запросу подходят: ' + picks.map(p => `${p.name} — ${fmtPrice(p.price)}`).join('; ') + '.';
    }
    return 'По этому запросу точного совпадения не найдено. Уточните тип основания, нагрузку, среду и желаемый результат.';
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function iconHeart(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.1 20.3 4.9 13.3a4.8 4.8 0 1 1 6.8-6.8l.3.3.3-.3a4.8 4.8 0 0 1 6.8 6.8l-7 7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
  function iconPlus(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
  function iconCart(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h2l2 10h10l2-7H7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/></svg>'; }
  function iconCheck(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  function initApp() {
    // Обновляем state.products после асинхронной загрузки из API
    state.products = (window.PRODUCTS || state.products).map(p=>({...p,id:String(p.id),name:p.name || '',tags:p.tags || [],sizes:p.sizes || [],details:p.details || [],color:p.color || '',description:p.description || ''}));
    const view=new URLSearchParams(location.search).get('view');
    if(['account','cart','favs'].includes(view)){document.querySelectorAll('[data-profile-nav]').forEach(btn=>btn.classList.toggle('active',btn.dataset.profileNav===view));}
    syncCounters();
    initCatalogControls();
    renderProductPage();
    renderProfile();
    initChat();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Ждём загрузку товаров из API (асинхронный fetch в api.js)
    var ready = window.PSL_PRODUCTS_READY || Promise.resolve();
    ready.then(initApp).catch(initApp);
  });
})();
