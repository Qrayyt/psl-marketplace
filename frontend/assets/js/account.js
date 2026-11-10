(function(){
  'use strict';
  const root=document.querySelector('[data-account-content]');
  if(!root)return;
  const API=window.PSL_API;
  const basket = window.PSLBasket;
  const keys = { contact: 'psl_quote_contact_v1', prefs: 'psl_account_preferences_v1' };
  const views=['overview','cart','favs','orders','account','settings'];
  const titles={overview:'Обзор',cart:'Корзина',favs:'Избранное',orders:'Заказы',account:'Данные аккаунта',settings:'Настройки'};
  const paths={user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',cart:'<path d="M2 3h3l3 13h11l3-10H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>',heart:'<path d="M20.7 4.6a5.4 5.4 0 0 0-7.6 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.6 7.6L12 21l8.7-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',doc:'<path d="M14 2H5v20h14V7zM14 2v5h5M8 11h8M8 15h8M8 18h5"/>',box:'<path d="m12 2 10 5-10 5L2 7zM2 7v11l10 5 10-5V7M12 12v11"/>',grid:'<path d="M4 4h2v2H4zm7 0h2v2h-2zm7 0h2v2h-2zM4 11h2v2H4zm7 0h2v2h-2zm7 0h2v2h-2zM4 18h2v2H4zm7 0h2v2h-2zm7 0h2v2h-2z"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',check:'<path d="m5 12 4 4L19 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'};
  const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[k]||paths.doc}</svg>`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return value??fallback;}catch{return fallback;}};
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{notice('Не удалось сохранить данные в браузере. Проверьте доступ к хранилищу.');return false;}}
  let { cart, favorites: favs } = basket.state;
  let contact = read(keys.contact, {}), prefs = read(keys.prefs, {});
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) contact = {};
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
  let products=(window.PRODUCTS||[]).map(p=>({...p,id:String(p.id)}));
  let current=route(),orders=[],ordersState='idle',addresses=[],addressState='idle',noticeTimer;
  const dialog=document.querySelector('.account-dialog');
  const pById=id=>products.find(p=>p.id===String(id)||p.catalogSlug===String(id));
  const user=()=>API?.isLoggedIn()?API.getUser():null;
  const qty=()=>cart.reduce((sum,i)=>sum+i.qty,0);
  const price=n=>Number(n)>0?new Intl.NumberFormat('ru-RU').format(Number(n))+' ₽':'Цена не указана';
  const date=d=>{const value=new Date(d);return Number.isNaN(value.getTime())?'':value.toLocaleDateString('ru-RU');};
  function route(){const v=new URLSearchParams(location.search).get('view');return v==='requests'?'orders':views.includes(v)?v:'overview';}
  function notice(text){const el=document.querySelector('.account-notices');clearTimeout(noticeTimer);el.textContent=text;el.classList.add('is-visible');noticeTimer=setTimeout(()=>el.classList.remove('is-visible'),3500);}
  function applyPrefs(){document.body.classList.toggle('compact-account',!!prefs.compact);document.body.classList.toggle('low-motion-account',!!prefs.lowMotion);}
  async function changeBasket(action, message){
    try {
      await action();
      if (message) notice(message);
    } catch (error) {
      notice(error.message);
      render();
    }
  }
  function updateCounters(){
    for(const [key,n] of [['cart',qty()],['fav',favs.length]])document.querySelectorAll(`[data-${key}-count]`).forEach(el=>{el.textContent=n;el.classList.toggle('hidden',!n);});
    for(const [key,n] of [['cart',qty()],['favs',favs.length],['orders',orders.length]]){const el=document.querySelector(`[data-nav-count="${key}"]`);if(el){el.hidden=!n;el.textContent=n;}}
  }
  function navigate(view,push=true){
    current=views.includes(view)?view:'overview';
    if(push){const url=new URL(location.href);url.searchParams.set('view',current);history.pushState(null,'',url);}
    render();if(current==='orders')loadOrders();
    if(current==='account'&&user())loadAddresses();
    if(innerWidth<801)document.querySelector('[data-account-nav][aria-current]')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'nearest'});
  }
  function render(){
    applyPrefs();updateCounters();document.title=titles[current]+' — PSL';
    document.querySelectorAll('[data-account-nav]').forEach(el=>{if(el.dataset.accountNav===current)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    root.innerHTML=({overview,cart:renderCart,favs:renderFavs,orders:renderOrders,account:renderAccount,settings:renderSettings}[current])();
  }
  const go=(view,label,cls='account-button',ico='')=>`<a class="${cls}" href="?view=${view}" data-go="${view}">${ico?icon(ico):''}${label}</a>`;
  function empty(ico,title,text,action='<a class="account-button solid" href="index.html">Перейти в каталог '+icon('arrow')+'</a>'){
    return `<div class="account-empty"><div class="empty-icon">${icon(ico)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
  }
  function banner(){const u=user();return `<section class="account-banner"><div class="banner-icon">${icon('user')}</div><div class="banner-copy"><h2>${u?'Здравствуйте'+(u.name?', '+esc(u.name):''):'Войдите в аккаунт'}</h2><p>${u?'Все материалы, заказы и данные — в одном месте.':'Сохраняйте материалы и управляйте заказами.'}</p><div class="account-buttons">${u?go('account','Данные аккаунта','account-button solid'):'<button type="button" class="account-button solid" data-auth="login">Войти</button><button type="button" class="account-button" data-auth="register">Регистрация</button>'}</div></div></section>`;}
  function miniCard(p){return `<article class="saved-card"><a class="saved-image" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image||p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" width="240" height="180"></a><button type="button" class="save-toggle" data-fav="${esc(p.id)}" aria-label="Убрать из избранного: ${esc(p.name)}">${icon('heart')}</button><h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><p>${esc(p.category)}</p></article>`;}
  function overview(){const saved=favs.map(pById).filter(Boolean).slice(0,3);return `${banner()}<div class="account-stats">${[['cart','cart',qty(),'В корзине'],['favs','heart',favs.length,'В избранном'],['orders','doc',orders.length,'Заказов']].map(([view,ico,n,label])=>`<a class="account-stat account-panel" href="?view=${view}" data-go="${view}">${icon(ico)}<div><strong>${n}</strong><small>${label}</small></div>${icon('arrow')}</a>`).join('')}</div><div class="account-bottom">${prefs.hideSaved?'':`<section class="account-panel saved-panel"><div class="panel-heading"><h2>Сохранённые материалы</h2>${go('favs','Все избранные '+icon('arrow'),'account-text-button')}</div>${saved.length?`<div class="saved-grid">${saved.map(miniCard).join('')}</div>`:empty('heart','Здесь будут ваши материалы','Сохраняйте интересующие позиции сердечком в каталоге.','<a class="account-text-button" href="index.html">Открыть каталог '+icon('arrow')+'</a>')}</section>`}<section class="account-panel quick-panel"><h2>Быстрые действия</h2><a class="quick-action" href="?view=orders" data-go="orders">${icon('doc')}<span>Мои заказы</span>${icon('arrow')}</a><a class="quick-action" href="index.html">${icon('grid')}<span>Перейти в каталог</span>${icon('arrow')}</a></section></div>`;}
  function renderCart(){
    const total = cart.reduce((sum, item) => sum + Math.round((Number(pById(item.id)?.price) || 0) * 100) * item.qty, 0) / 100;
    const orderable = cart.length && cart.every(item => Number(pById(item.id)?.price) > 0);
    const error = basket.state.error
      ? `<p class="account-note">${esc(basket.state.error)} <button class="account-text-button" data-retry-basket>Повторить</button></p>` : '';
    return `<div class="view-heading"><div><h2>Корзина <span class="view-count">${qty()}</span></h2>
      <p>Выберите материалы и количество для заказа.</p></div>
      ${cart.length ? '<button type="button" class="account-text-button" data-clear-cart>Очистить корзину</button>' : ''}</div>
      ${error}
      ${!cart.length ? `<section class="account-panel">${empty('cart','В корзине пока пусто','Добавьте материалы из каталога.')}</section>` :
        `<div class="cart-layout"><div class="cart-list">${cart.map(cartRow).join('')}</div>
          <aside class="account-panel cart-summary"><h3>Ваш заказ</h3>
            <div class="summary-line"><span>Всего единиц</span><strong>${qty()}</strong></div>
            <div class="summary-total"><span>Материалы</span><strong>${orderable ? price(total) : 'Есть недоступные позиции'}</strong></div>
            <button type="button" class="account-button solid" data-checkout ${!orderable || basket.state.error ? 'disabled' : ''}>Оформить заказ ${icon('arrow')}</button>
            <p class="summary-note">Менеджер свяжется с вами для подтверждения заказа и согласования поставки.</p>
          </aside></div>`}`;
  }
  function cartRow(i){const p=pById(i.id);return `<article class="account-panel cart-row">${p?`<a class="cart-image" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image||p.imageUrl)}" alt="${esc(p.name)}" width="118" height="118"></a>`:`<div class="cart-image">${icon('box')}</div>`}<div class="cart-info"><div class="cart-top"><div><h3>${p?`<a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a>`:'Материал недоступен'}</h3><p>${p?esc(p.category):'Позиция временно отсутствует в каталоге'}</p></div><button class="icon-control" data-remove="${esc(i.lineId)}" aria-label="Удалить ${esc(p?.name||i.id)}">${icon('close')}</button></div>${p?.sizes?.length?`<select class="cart-size" data-size="${esc(i.lineId)}" aria-label="Фасовка ${esc(p.name)}">${p.sizes.map(s=>`<option value="${esc(s)}" ${(i.size||p.sizes[0])===s?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}<div class="cart-row-bottom"><div class="qty-control"><button type="button" data-qty="${esc(i.lineId)}" data-delta="-1" aria-label="Уменьшить количество ${esc(p?.name||'материала')}">−</button><input type="number" min="1" max="9999" value="${i.qty}" data-quantity="${esc(i.lineId)}" aria-label="Количество ${esc(p?.name||'материала')}"><button type="button" data-qty="${esc(i.lineId)}" data-delta="1" aria-label="Увеличить количество ${esc(p?.name||'материала')}">+</button></div><strong class="cart-price">${p?price(Number(p.price)*i.qty):'Цена не указана'}</strong></div>${p?`<div class="cart-row-actions" style="margin-top:13px"><button type="button" data-fav="${esc(i.id)}">${favs.includes(i.id)?'Убрать из избранного':'В избранное'}</button></div>`:''}</div></article>`;}
  function renderFavs(){return `<div class="view-heading"><div><h2>Избранное <span class="view-count">${favs.length}</span></h2><p>Материалы, к которым хочется вернуться.</p></div></div>${!favs.length?`<section class="account-panel">${empty('heart','Сохраните нужные материалы','Нажмите на сердечко в каталоге. Здесь они всегда будут под рукой.')}</section>`:`<div class="favorites-grid">${favs.map(id=>{const p=pById(id);return p?`<article class="favorite-card"><a class="saved-image" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image||p.imageUrl)}" alt="${esc(p.name)}" width="320" height="240" loading="lazy"></a><button class="save-toggle active" data-fav="${esc(p.id)}" aria-label="Убрать из избранного: ${esc(p.name)}">${icon('heart')}</button><div class="favorite-copy"><h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><p>${esc(p.description||p.category)}</p><button class="account-button solid" data-add="${esc(p.id)}">${icon('cart')} Добавить в корзину</button></div></article>`:`<article class="favorite-card"><div class="account-empty"><div class="empty-icon">${icon('box')}</div><h3>Материал недоступен</h3><p>Позиция временно отсутствует в каталоге.</p><button class="account-button" data-fav="${esc(id)}">Убрать из избранного</button></div></article>`;}).join('')}</div>`}`;}
  const statusLabels={NEW:'Новый',PROCESSING:'В обработке',SHIPPED:'Отправлен',DELIVERED:'Доставлен',CANCELLED:'Отменён'};
  function renderOrders(){
    return `<div class="view-heading"><div><h2>Заказы</h2><p>Статусы и состав ваших заказов.</p></div></div>${orderList()}`;
  }
  function orderList(){
    if(!user())return `<section class="account-panel">${empty('user','Войдите, чтобы увидеть заказы','История заказов привязана к вашему аккаунту.','<button class="account-button solid" data-auth="login">Войти в аккаунт</button>')}</section>`;
    if(ordersState==='loading')return '<section class="account-panel account-loading">Загружаем заказы…</section>';
    if(ordersState==='error')return `<section class="account-panel">${empty('info','Не удалось загрузить заказы','Проверьте соединение и попробуйте ещё раз.','<button class="account-button" data-retry-orders>Повторить</button>')}</section>`;
    if(!orders.length)return `<section class="account-panel">${empty('box','Заказов пока нет','Оформленные заказы появятся здесь.')}</section>`;
    return `<div class="request-list">${orders.map(o=>`<article class="account-panel request-row"><div class="request-top"><div><h3>${esc(o.orderNumber||o.id)}</h3><p>${date(o.createdAt)} · ${price(o.total)}</p></div><span class="request-badge">${esc(statusLabels[o.status]||o.status)}</span></div><p class="request-detail">${esc((o.items||[]).map(i=>i.product?.name||'Материал').join(', '))}</p><div class="request-bottom"><button class="account-button" data-order-detail="${esc(o.id)}">Подробнее ${icon('arrow')}</button>${o.status==='NEW'?`<button class="account-text-button" data-cancel-order="${esc(o.id)}">Отменить заказ</button>`:''}</div></article>`).join('')}</div>`;
  }
  function field(label,name,value,type='text',extra=''){return `<label class="account-field">${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;}
  function renderAccount(){const u=user();return `<div class="view-heading"><div><h2>Данные аккаунта</h2><p>${u?'Контактная информация и адреса доставки.':'Контакты для заказов.'}</p></div></div>${!u?`<p class="account-note" style="margin:0 0 20px">Вы можете сохранить контакты в этом браузере или <button class="account-text-button" data-auth="login">войти в аккаунт</button>.</p>`:''}<form class="account-panel account-form-panel" data-form="contact"><h3>Контактная информация</h3><div class="account-fields">${field('Имя','name',u?.name||contact.name||'','text','autocomplete="name" required maxlength="100"')}${field('Электронная почта','email',u?.email||contact.email||'','email',u?'readonly':'autocomplete="email" required')}${field('Телефон','phone',u?.phone||contact.phone||'','tel','autocomplete="tel" maxlength="30"')}${field('Компания','company',contact.company||'','text','autocomplete="organization" maxlength="150"')}</div><div class="form-actions"><button type="submit" class="account-button solid">Сохранить изменения</button><p class="form-message" role="status"></p></div><p class="summary-note">${u?'Имя и телефон сохраняются в аккаунте. Компания — в этом браузере для заполнения запросов.':'Контакты сохраняются только в этом браузере и подставляются в черновики запросов.'}</p></form>${u?`<section class="account-panel account-form-panel"><div class="panel-heading"><h3>Адреса доставки</h3><button class="account-text-button" data-address-add>Добавить ${icon('arrow')}</button></div>${addressState==='loading'?'<p class="form-message">Загрузка…</p>':addressState==='error'?'<p class="form-message">Не удалось загрузить адреса. <button class="account-text-button" data-retry-address>Повторить</button></p>':addresses.length?addresses.map(a=>`<div class="address-row"><div><h4>${esc(a.city)}, ${esc(a.address)}</h4><p>${esc(a.postalCode||'')}${a.isDefault?' · Основной адрес':''}</p></div><div class="address-actions">${!a.isDefault?`<button data-address-default="${esc(a.id)}">Сделать основным</button>`:''}<button data-address-edit="${esc(a.id)}">Изменить</button><button data-address-delete="${esc(a.id)}" aria-label="Удалить адрес ${esc(a.address)}">${icon('trash')}</button></div></div>`).join(''):'<p class="form-message">Добавьте адрес, чтобы не вводить его при оформлении заказа.</p>'}</section>`:''}`;}
  function renderSettings(){const rows=[['lowMotion','Меньше анимации','Отключить переходы и анимацию в личном кабинете.'],['compact','Компактная корзина','Уменьшить размер изображений и отступы в списке материалов.'],['hideSaved','Скрыть избранное в обзоре','Сохранённые материалы останутся в разделе «Избранное».']];return `<div class="view-heading"><div><h2>Настройки</h2><p>Настройте личный кабинет под себя.</p></div></div><section class="account-panel account-form-panel"><h3>Интерфейс</h3>${rows.map(([key,title,text])=>`<div class="settings-row"><div><h4>${title}</h4><p>${text}</p></div><label class="account-switch"><input type="checkbox" data-pref="${key}" aria-label="${title}" ${prefs[key]?'checked':''}><span></span></label></div>`).join('')}</section><section class="account-panel account-form-panel"><h3>Аккаунт и безопасность</h3><p class="form-message">${user()?'Вы вошли как '+esc(user().email):'Вы используете личный кабинет без входа.'}</p><div class="account-buttons">${user()?'<button class="account-button" data-auth="forgot">Сбросить пароль</button><button class="account-button" data-logout>Выйти из аккаунта</button>':'<button class="account-button solid" data-auth="login">Войти</button><button class="account-button" data-auth="register">Регистрация</button>'}${user()?.role==='ADMIN'?'<a class="account-button" href="admin/">Админ-панель ↗</a>':''}<a class="account-text-button" href="privacy.html">Конфиденциальность ↗</a></div></section><p class="account-note">Настройки интерфейса, избранное и черновики доступны в этом браузере.</p>`;}
  function openDialog(title,body,sub=''){
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button type="button" data-dialog-close aria-label="Закрыть окно">${icon('close')}</button></div>${sub?`<p class="dialog-sub">${sub}</p>`:''}${body}`;
    if(!dialog.open)dialog.showModal();
  }
  function showAuth(mode){API.redirectToAuth(mode);}
  function confirmAction(title,text,action){openDialog(title,`<div class="account-buttons"><button class="account-button" data-dialog-close>Отмена</button><button class="account-button solid" data-confirm>Подтвердить</button></div>`,text);dialog.querySelector('[data-confirm]').onclick=async e=>{e.currentTarget.disabled=true;try{await action();dialog.close();}catch(err){notice(err.message);e.currentTarget.disabled=false;}};}
  async function request(path,options={}){const response=await API.fetch(path,{...options,signal:AbortSignal.timeout(12000)});let data;try{data=await response.json();}catch{throw Error('Сервис недоступен. Попробуйте позже.');}if(!response.ok||!data.success)throw Error(response.status===401?'Войдите в аккаунт заново.':data.error?.message||'Не удалось выполнить действие.');return data.data;}
  async function loadOrders(){if(!user()||ordersState==='loading')return;ordersState='loading';if(current==='orders')render();try{orders=await request('/api/orders?limit=100');if(!Array.isArray(orders))orders=[];ordersState='ready';}catch{ordersState='error';}if(current==='orders')render();}
  async function loadAddresses(){if(!user()||addressState==='loading')return;addressState='loading';if(current==='account')render();try{addresses=await request('/api/addresses');if(!Array.isArray(addresses))addresses=[];addressState='ready';}catch{addressState='error';}if(current==='account')render();}
  function addressForm(id){const a=addresses.find(a=>a.id===id)||{};openDialog(id?'Изменить адрес':'Новый адрес',`<form data-form="address" data-id="${esc(id||'')}"><div class="account-fields">${field('Город','city',a.city||'','text','autocomplete="address-level2" required')}${field('Индекс','postalCode',a.postalCode||'','text','autocomplete="postal-code"')}<label class="account-field full">Адрес<input name="address" autocomplete="street-address" required value="${esc(a.address||'')}"></label><label class="account-check"><input type="checkbox" name="isDefault" ${a.isDefault?'checked':''}><span>Основной адрес доставки</span></label></div><div class="form-actions"><button type="submit" class="account-button solid">Сохранить адрес</button><p class="form-message" role="status"></p></div></form>`);}
  async function checkout(){
    if (!user()) { showAuth('login'); return; }
    if (user().isDemo) { notice('Войдите в обычный аккаунт, чтобы отправить заказ.'); return; }
    openDialog('Оформление заказа', '<p class="form-message">Проверяем корзину…</p>');
    try {
      const server = await request('/api/cart');
      if (!dialog.open) return;
      if (!server.items.length || server.items.some(item => !item.product.isActive || !(item.product.price > 0))) {
        throw Error('Проверьте доступность материалов в корзине.');
      }
      const u = user();
      openDialog('Оформление заказа', `
        <div class="draft-items">${server.items.map(item => `<div><span>${esc(item.product.name)} · ${esc(item.size)}</span><span>${item.quantity} шт. · ${price(item.product.price)}</span></div>`).join('')}</div>
        <p class="dialog-sub">Материалы: ${price(server.total)}. Условия поставки и оплаты согласует менеджер.</p>
        <form data-form="checkout"><div class="account-fields">
          ${field('Имя', 'name', u.name, 'text', 'required minlength="2" maxlength="120" autocomplete="name"')}
          ${field('Телефон', 'phone', u.phone, 'tel', 'required maxlength="32" autocomplete="tel"')}
          ${field('Электронная почта', 'email', u.email, 'email', 'maxlength="254" autocomplete="email"')}
          ${field('Компания', 'company', '', 'text', 'maxlength="160" autocomplete="organization"')}
          <label class="account-field full">Комментарий<textarea name="note" maxlength="2000" placeholder="Объект, город, сроки или удобное время для звонка"></textarea></label>
          <label class="account-check full"><input type="checkbox" required><span>Согласен с <a href="privacy.html" target="_blank" rel="noopener">обработкой персональных данных</a></span></label>
        </div><div class="form-actions"><button class="account-button solid" type="submit">Отправить заказ</button><p class="form-message" role="status"></p></div></form>`);
      const form = dialog.querySelector('[data-form="checkout"]');
      form.checkout = {
        requestId: crypto.randomUUID(),
        expectedItems: server.items.map(({id, size, quantity, product}) => ({id, size, quantity, price: product.price})),
      };
    } catch (error) {
      if (dialog.open) openDialog('Не удалось оформить заказ', '<button class="account-button" data-dialog-close>Вернуться в корзину</button>', esc(error.message));
    }
  }
  document.addEventListener('click',async e=>{
    const el=e.target.closest('button,a');if(!el)return;
    if(el.matches('[data-account-nav],[data-go]')){e.preventDefault();navigate(el.dataset.accountNav||el.dataset.go);return;}
    if(el.hasAttribute('data-dialog-close')){dialog.close();return;}
    if(el.hasAttribute('data-auth')){showAuth(el.dataset.auth);return;}
    if(el.dataset.fav){await changeBasket(()=>basket.toggleFavorite(el.dataset.fav));return;}
    if(el.dataset.add){await changeBasket(()=>basket.add(el.dataset.add),'Материал добавлен в корзину');return;}
    if(el.dataset.remove){await changeBasket(()=>basket.remove(el.dataset.remove),'Материал удалён из корзины');return;}
    if(el.dataset.qty){await changeBasket(()=>basket.change(el.dataset.qty,{delta:Number(el.dataset.delta)}));return;}
    if(el.hasAttribute('data-clear-cart')){confirmAction('Очистить корзину?','Все материалы будут удалены из текущей корзины.',()=>basket.clear());return;}
    if(el.hasAttribute('data-retry-basket')){await changeBasket(()=>basket.refresh(true));return;}
    if(el.hasAttribute('data-retry-orders')){loadOrders();return;}
    if(el.hasAttribute('data-retry-address')){loadAddresses();return;}
    if(el.hasAttribute('data-address-add')){addressForm();return;}
    if(el.dataset.addressEdit){addressForm(el.dataset.addressEdit);return;}
    if(el.dataset.addressDelete){confirmAction('Удалить адрес?','Адрес будет удалён из аккаунта.',async()=>{await request('/api/addresses/'+encodeURIComponent(el.dataset.addressDelete),{method:'DELETE'});await loadAddresses();});return;}
    if(el.dataset.addressDefault){el.disabled=true;try{await request('/api/addresses/'+encodeURIComponent(el.dataset.addressDefault)+'/default',{method:'PATCH'});await loadAddresses();}catch(err){notice(err.message);el.disabled=false;}return;}
    if(el.hasAttribute('data-logout')){confirmAction('Выйти из аккаунта?','Корзина и избранное сохранятся в аккаунте.',async()=>{await API.logout();orders=[];addresses=[];await basket.refresh();render();notice('Вы вышли из аккаунта');});return;}
    if(el.hasAttribute('data-checkout')){checkout();return;}
    if(el.dataset.orderDetail){el.disabled=true;try{const o=await request('/api/orders/'+encodeURIComponent(el.dataset.orderDetail));openDialog(esc(o.orderNumber||'Заказ'),`<p class="dialog-sub">${date(o.createdAt)} · ${esc(statusLabels[o.status]||o.status)}</p><div class="draft-items">${(o.items||[]).map(i=>`<div><span>${esc(i.product?.name||'Материал')} · ${esc(i.size)}</span><span>${i.quantity} шт.</span></div>`).join('')}</div><p class="dialog-sub">Итого: ${price(o.total)}</p>${o.deliveryAddress?`<p class="dialog-sub">Доставка: ${esc(o.deliveryAddress.city)}, ${esc(o.deliveryAddress.address)}</p>`:''}<button class="account-button" data-dialog-close>Закрыть</button>`);}catch(err){notice(err.message);}finally{el.disabled=false;}return;}
    if(el.dataset.cancelOrder){confirmAction('Отменить заказ?','Отмена будет сохранена в вашем аккаунте.',async()=>{await request('/api/orders/'+encodeURIComponent(el.dataset.cancelOrder)+'/cancel',{method:'POST'});await loadOrders();});}
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.dataset.quantity) await changeBasket(()=>basket.change(el.dataset.quantity,{qty:Number(el.value)}));
    if(el.dataset.size) await changeBasket(()=>basket.change(el.dataset.size,{size:el.value}));
    if(el.dataset.pref){prefs[el.dataset.pref]=el.checked;write(keys.prefs,prefs);applyPrefs();notice('Настройка сохранена');}
  });
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!form.dataset.form)return;e.preventDefault();
    const data=Object.fromEntries(new FormData(form)),btn=e.submitter,message=form.querySelector('.form-message');
    if(btn)btn.disabled=true;if(message){message.textContent='';message.dataset.error='false';}
    try{
      switch(form.dataset.form){
        case 'contact':{
          if(user()){const u=await request('/api/auth/me',{method:'PATCH',body:JSON.stringify({name:data.name.trim(),phone:data.phone.trim()})});API.setUser(u);}
          contact={...contact,...data};if(!write(keys.contact,contact))break;
          if(message)message.textContent='Изменения сохранены';notice('Контакты сохранены');break;
        }
        case 'address':{
          const id=form.dataset.id;await request('/api/addresses'+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify({...data,isDefault:!!form.elements.isDefault.checked})});dialog.close();await loadAddresses();notice('Адрес сохранён');break;
        }
        case 'checkout': {
          if (!form.checkout || form.submitting) return;
          form.submitting = true;
          try {
            const order = await request('/api/orders', { method: 'POST', body: JSON.stringify({
              ...form.checkout,
              contact: { name: data.name, phone: data.phone, email: data.email.trim() || undefined, company: data.company, note: data.note },
            }) });
            if (form.isConnected) dialog.close();
            navigate('orders');
            notice('Заказ ' + order.orderNumber + ' отправлен. Менеджер свяжется с вами.');
            void basket.refresh().catch(() => {});
          } finally {
            form.submitting = false;
          }
          break;
        }
      }
    }catch(err){if(message){message.dataset.error='true';message.textContent=err.name==='TimeoutError'?'Сервис не отвечает. Попробуйте ещё раз.':err.message||'Не удалось сохранить изменения.';}else notice('Не удалось выполнить действие.');}
    finally{if(btn&&btn.isConnected)btn.disabled=false;}
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  window.addEventListener('popstate',()=>{current=route();render();if(current==='account'&&user())loadAddresses();if(current==='orders')loadOrders();});
  window.addEventListener('psl:basket', () => {
    ({ cart, favorites: favs } = basket.state);
    products = (window.PRODUCTS || []).map(p => ({ ...p, id: String(p.id) }));
    if (['overview', 'cart', 'favs'].includes(current)) render();
    else updateCounters();
  });
  render();
  (window.PSL_PRODUCTS_READY||Promise.resolve()).then(()=>{products=(window.PRODUCTS||[]).map(p=>({...p,id:String(p.id)}));if(['overview','cart','favs'].includes(current))render();});
  if(user())request('/api/auth/me').then(u=>{API.setUser(u);render();if(current==='account')loadAddresses();if(current==='orders'||current==='overview')loadOrders();}).catch(()=>{});
})();
