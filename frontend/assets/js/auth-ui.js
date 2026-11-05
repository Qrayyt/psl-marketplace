/**
 * auth-ui.js - Авторизация, профиль, заказы, cookie-баннер
 * Подключается ПОСЛЕ app.js. Не модифицирует app.js.
 */
(function(){
  var API = window.PSL_API;
  if(!API) return;

  // Authentication lives on its own page; retain the originating URL.
  function showAuthModal(mode){ API.redirectToAuth(mode || 'login'); }

  // --- Обновление UI авторизации ---
  function updateAuthUI(){
    var user = API.getUser();
    var isLogged = API.isLoggedIn();

    // Кнопка входа/профиля в шапке
    var authBtns = document.querySelectorAll('[data-auth-btn]');
    authBtns.forEach(function(btn){
      if(isLogged && user){
        btn.textContent = user.name;
        btn.onclick = function(){ window.location.href = 'profile.html'; };
      } else {
        btn.textContent = 'Войти';
        btn.onclick = function(e){ e.preventDefault(); showAuthModal('login'); };
      }
    });

    // Обновляем профиль если на странице профиля
    renderExtendedProfile();
  }

  // --- Расширенный профиль ---
  function renderExtendedProfile(){
    var root = document.querySelector('[data-profile-content]');
    if(!root) return;

    var activeNav = document.querySelector('[data-profile-nav].active');
    if(!activeNav) return;
    var view = activeNav.dataset.profileNav;

    if(view === 'account'){
      var user = API.getUser();
      if(!user || !API.isLoggedIn()){
        root.innerHTML = '<div class="summary-box">' +
          '<h3 class="card-name">Аккаунт</h3>' +
          '<p class="muted">Войдите чтобы управлять профилем, адресами и заказами.</p>' +
          '<div class="action-row" style="margin-top:16px">' +
            '<button class="primary-btn" data-open-login>Войти</button>' +
            '<button class="ghost-btn" data-open-register>Регистрация</button>' +
          '</div></div>';
        root.querySelector('[data-open-login]').onclick = function(){ showAuthModal('login'); };
        root.querySelector('[data-open-register]').onclick = function(){ showAuthModal('register'); };
        return;
      }

      root.innerHTML = '<div class="summary-box">' +
        '<h3 class="card-name">Профиль</h3>' +
        '<div class="contact-grid">' +
          '<div class="contact-item"><div class="contact-label">Имя</div><div class="contact-value">' + esc(user.name) + '</div></div>' +
          '<div class="contact-item"><div class="contact-label">Email</div><div class="contact-value">' + esc(user.email) + '</div></div>' +
          '<div class="contact-item"><div class="contact-label">Роль</div><div class="contact-value">' + (user.role === 'ADMIN' ? 'Администратор' : 'Пользователь') + '</div></div>' +
        '</div>' +
        '<div class="action-row" style="margin-top:16px">' +
          '<button class="ghost-btn" data-logout-btn>Выйти</button>' +
          (user.role === 'ADMIN' ? '<a class="primary-btn" href="admin/">Админ-панель</a>' : '') +
        '</div></div>' +
        '<div class="summary-box" style="margin-top:16px">' +
          '<h3 class="card-name">История заказов</h3>' +
          '<div data-orders-list><div class="muted">Загрузка...</div></div>' +
        '</div>';

      root.querySelector('[data-logout-btn]').onclick = function(){
        API.logout().then(function(){ updateAuthUI(); showToast('Вы вышли'); });
      };

      // Загрузка заказов
      if(API.isLoggedIn()){
        API.fetch('/api/orders').then(function(r){ return r.json(); }).then(function(res){
          var ordersList = root.querySelector('[data-orders-list]');
          if(!res.success || !res.data.length){
            ordersList.innerHTML = '<div class="muted">Заказов пока нет</div>';
            return;
          }
          var statusLabels = { NEW:'Новый', PROCESSING:'В обработке', SHIPPED:'Отправлен', DELIVERED:'Доставлен', CANCELLED:'Отменен' };
          var statusColors = { NEW:'#1565c0', PROCESSING:'#e65100', SHIPPED:'#2e7d32', DELIVERED:'#1b5e20', CANCELLED:'#c62828' };
          ordersList.innerHTML = res.data.map(function(o){
            return '<div style="padding:12px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
              '<div><strong>' + esc(o.orderNumber) + '</strong><br><span class="muted">' + new Date(o.createdAt).toLocaleDateString('ru-RU') + '</span></div>' +
              '<div style="text-align:right"><span style="color:' + (statusColors[o.status]||'#888') + ';font-weight:500">' + (statusLabels[o.status]||o.status) + '</span><br><strong>' + fmtPrice(o.total) + '</strong></div>' +
              (o.status === 'NEW' ? '<button class="ghost-btn" style="font-size:12px;padding:4px 10px" data-cancel-order="' + o.id + '">Отменить</button>' : '') +
            '</div>';
          }).join('');

          ordersList.querySelectorAll('[data-cancel-order]').forEach(function(btn){
            btn.onclick = function(){
              if(!confirm('Отменить заказ?')) return;
              API.fetch('/api/orders/' + btn.dataset.cancelOrder + '/cancel', { method:'POST' })
                .then(function(){ renderExtendedProfile(); showToast('Заказ отменен'); });
            };
          });
        });
      }
    }
  }

  // --- Оформление заказа ---
  function initCheckout(){
    document.addEventListener('click', function(e){
      var btn = e.target.closest('.primary-btn');
      if(!btn || btn.textContent.trim() !== 'Оформить заказ') return;
      e.preventDefault();

      if(!API.isLoggedIn()){
        showAuthModal('login');
        return;
      }

      // Синхронизируем корзину с API перед оформлением
      syncCartWithApi().then(function(){ showCheckoutModal(); });
    });
  }

  function showCheckoutModal(){
    var overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = '<div class="auth-modal" style="max-width:500px">' +
      '<button class="auth-close" data-checkout-close>&times;</button>' +
      '<h2 style="margin-bottom:16px">Оформление заказа</h2>' +
      '<form data-checkout-form style="display:flex;flex-direction:column;gap:12px">' +
        '<input type="text" name="city" placeholder="Город" required>' +
        '<input type="text" name="address" placeholder="Адрес доставки" required>' +
        '<input type="text" name="postalCode" placeholder="Почтовый индекс">' +
        '<select name="deliveryMethod"><option value="courier">Курьер</option><option value="pickup">Самовывоз</option><option value="post">Почта России</option></select>' +
        '<label class="auth-checkbox"><input type="checkbox" required> Согласен с <a href="privacy.html" target="_blank">обработкой персональных данных</a></label>' +
        '<div class="auth-error" data-checkout-error></div>' +
        '<button type="submit" class="primary-btn">Подтвердить заказ</button>' +
      '</form></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('[data-checkout-close]').onclick = function(){ overlay.remove(); };
    overlay.onclick = function(e){ if(e.target === overlay) overlay.remove(); };

    overlay.querySelector('[data-checkout-form]').onsubmit = function(e){
      e.preventDefault();
      var form = e.target;
      var err = form.querySelector('[data-checkout-error]');
      err.textContent = '';

      API.fetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          address: { city: form.city.value, address: form.address.value, postalCode: form.postalCode.value },
          deliveryMethod: form.deliveryMethod.value,
        })
      }).then(function(r){ return r.json(); }).then(function(data){
        if(!data.success){ err.textContent = data.error.message; return; }
        overlay.remove();
        // Очистить локальную корзину
        localStorage.setItem('marketplace_cart_v2', '[]');
        showToast('Заказ ' + data.data.orderNumber + ' оформлен!');
        // Перезагрузить страницу
        setTimeout(function(){ window.location.reload(); }, 1500);
      });
    };
  }

  // --- Cookie-баннер ---
  function showCookieBanner(){
    if(localStorage.getItem('psl_cookies_accepted')) return;

    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = '<span>Мы используем cookie для работы сайта. <a href="privacy.html">Подробнее</a></span>' +
      '<button class="primary-btn" style="padding:6px 16px;font-size:13px" data-accept-cookies>Принять</button>';
    document.body.appendChild(banner);

    banner.querySelector('[data-accept-cookies]').onclick = function(){
      localStorage.setItem('psl_cookies_accepted', '1');
      banner.remove();
    };
  }

  // --- Хелперы ---
  function esc(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtPrice(v){ return new Intl.NumberFormat('ru-RU').format(v) + ' ₽'; }

  function showToast(text){
    var wrap = document.querySelector('.toast-wrap');
    if(!wrap){ wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateY(8px)'; setTimeout(function(){ t.remove(); },200); },2500);
  }

  // --- Синхронизация корзины с API при логине ---
  function syncCartWithApi(){
    if(!API.isLoggedIn()) return Promise.resolve();

    var localCart = [];
    try { localCart = JSON.parse(localStorage.getItem('marketplace_cart_v2') || '[]'); } catch(e){}

    if(localCart.length > 0){
      var items = localCart.map(function(i){ return { productId: i.id, size: i.size || (window.PRODUCTS && window.PRODUCTS.find(function(p){ return p.id === i.id; })?.sizes?.[0]) || 'M', quantity: i.qty }; });
      return API.fetch('/api/cart/sync', { method:'POST', body: JSON.stringify({ items: items }) })
        .then(function(r){ return r.json(); })
        .catch(function(){ });
    }
    return Promise.resolve();
  }

  // --- Синхронизация избранного с API при логине ---
  function syncFavsWithApi(){
    if(!API.isLoggedIn()) return;

    var localFavs = [];
    try { localFavs = JSON.parse(localStorage.getItem('marketplace_favs_v2') || '[]'); } catch(e){}

    if(localFavs.length > 0){
      API.fetch('/api/favorites/sync', { method:'POST', body: JSON.stringify({ productIds: localFavs }) });
    }
  }

  // --- Промокод в корзине ---
  function initPromoField(){
    // Наблюдаем за summary-box в корзине и добавляем поле промокода
    var observer = new MutationObserver(function(){
      var summaryBox = document.querySelector('.summary-box');
      if(!summaryBox || summaryBox.querySelector('[data-promo-field]')) return;
      if(!API.isLoggedIn()) return;

      var promoDiv = document.createElement('div');
      promoDiv.setAttribute('data-promo-field', '');
      promoDiv.style.cssText = 'display:flex;gap:8px;margin-top:12px;margin-bottom:8px';
      promoDiv.innerHTML = '<input type="text" placeholder="Промокод" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:12px;font-size:14px">' +
        '<button class="ghost-btn" style="white-space:nowrap" data-apply-promo>Применить</button>';

      var divider = summaryBox.querySelector('.divider');
      if(divider) divider.after(promoDiv);
      else summaryBox.prepend(promoDiv);

      promoDiv.querySelector('[data-apply-promo]').onclick = function(){
        var code = promoDiv.querySelector('input').value.trim();
        if(!code) return;
        // Синхронизируем корзину с API перед применением промокода
        syncCartWithApi().then(function(){
          return API.fetch('/api/cart/apply-promo', { method:'POST', body: JSON.stringify({ promoCode: code }) });
        })
          .then(function(r){ return r.json(); })
          .then(function(data){
            if(!data.success){ showToast(data.error.message); return; }
            showToast('Промокод ' + code + ': скидка ' + fmtPrice(data.data.discount));
          });
      };
    });

    var profileContent = document.querySelector('[data-profile-content]');
    if(profileContent) observer.observe(profileContent, { childList: true, subtree: true });
  }

  // --- Адреса доставки в профиле ---
  function renderAddressesInProfile(){
    var root = document.querySelector('[data-profile-content]');
    if(!root || !API.isLoggedIn()) return;

    var activeNav = document.querySelector('[data-profile-nav].active');
    if(!activeNav || activeNav.dataset.profileNav !== 'account') return;

    // Добавляем секцию адресов после заказов
    var existing = root.querySelector('[data-addresses-section]');
    if(existing) return;

    API.fetch('/api/addresses').then(function(r){ return r.json(); }).then(function(res){
      if(!res.success) return;

      var section = document.createElement('div');
      section.setAttribute('data-addresses-section', '');
      section.className = 'summary-box';
      section.style.marginTop = '16px';

      var addresses = res.data || [];
      section.innerHTML = '<h3 class="card-name">Адреса доставки</h3>' +
        (addresses.length ? addresses.map(function(a){
          return '<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<div>' + esc(a.city) + ', ' + esc(a.address) + (a.postalCode ? ', ' + esc(a.postalCode) : '') +
            (a.isDefault ? ' <span style="color:#2e7d32;font-size:12px">(основной)</span>' : '') + '</div>' +
            '<button class="ghost-btn" style="font-size:12px;padding:4px 8px" data-del-address="' + a.id + '">Удалить</button></div>';
        }).join('') : '<div class="muted">Нет сохраненных адресов. Адрес будет добавлен при оформлении заказа.</div>');

      root.appendChild(section);

      section.querySelectorAll('[data-del-address]').forEach(function(btn){
        btn.onclick = function(){
          API.fetch('/api/addresses/' + btn.dataset.delAddress, { method:'DELETE' })
            .then(function(){ section.remove(); renderAddressesInProfile(); });
        };
      });
    });
  }

  // --- Пагинация каталога (кнопка "Показать ещё") ---
  function initCatalogPagination(){
    var productsRoot = document.querySelector('[data-products]');
    if(!productsRoot) return;

    var PAGE_SIZE = 20;

    // Перехватываем рендер каталога: после отрисовки скрываем лишние карточки
    var paginationObserver = new MutationObserver(function(){
      var cards = productsRoot.querySelectorAll('.product-card');
      if(cards.length <= PAGE_SIZE) return;

      // Скрываем карточки после PAGE_SIZE
      var visibleCount = PAGE_SIZE;
      cards.forEach(function(card, i){ card.style.display = i < visibleCount ? '' : 'none'; });

      // Убираем старую кнопку
      var oldBtn = productsRoot.parentElement.querySelector('[data-show-more]');
      if(oldBtn) oldBtn.remove();

      if(cards.length > visibleCount){
        var btn = document.createElement('button');
        btn.setAttribute('data-show-more', '');
        btn.className = 'primary-btn';
        btn.style.cssText = 'display:block;margin:24px auto;padding:12px 32px';
        btn.textContent = 'Показать ещё';
        productsRoot.after(btn);

        btn.onclick = function(){
          visibleCount += PAGE_SIZE;
          cards.forEach(function(card, i){ card.style.display = i < visibleCount ? '' : 'none'; });
          if(visibleCount >= cards.length) btn.remove();
        };
      }
    });

    paginationObserver.observe(productsRoot, { childList: true });
  }

  // --- Динамические категории из API ---
  function loadDynamicCategories(){
    var categorySelect = document.querySelector('[data-category]');
    var chipsContainer = document.querySelector('.chips');
    if(!categorySelect && !chipsContainer) return;

    fetch((window.PSL_API_URL || '') + '/api/products/categories')
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(!res.success || !Array.isArray(res.data)) return;
        var categories = res.data;

        // Обновляем dropdown
        if(categorySelect){
          var current = categorySelect.value;
          categorySelect.innerHTML = '<option value="all">Все категории</option>';
          categories.forEach(function(cat){
            var opt = document.createElement('option');
            opt.textContent = cat;
            opt.value = cat;
            categorySelect.appendChild(opt);
          });
          if(current !== 'all') categorySelect.value = current;
        }

        // Обновляем быстрые кнопки
        if(chipsContainer){
          chipsContainer.innerHTML = '<button class="chip active" type="button" data-quick-category="all">Все</button>';
          categories.forEach(function(cat){
            var btn = document.createElement('button');
            btn.className = 'chip';
            btn.type = 'button';
            btn.setAttribute('data-quick-category', cat);
            btn.textContent = cat;
            btn.onclick = function(){
              chipsContainer.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('active'); });
              btn.classList.add('active');
              if(categorySelect){ categorySelect.value = cat; categorySelect.dispatchEvent(new Event('change')); }
            };
            chipsContainer.appendChild(btn);
          });
          chipsContainer.querySelector('[data-quick-category="all"]').onclick = function(){
            chipsContainer.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('active'); });
            this.classList.add('active');
            if(categorySelect){ categorySelect.value = 'all'; categorySelect.dispatchEvent(new Event('change')); }
          };
        }
      })
      .catch(function(){});
  }

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', function(){
    updateAuthUI();
    initCheckout();
    showCookieBanner();
    initPromoField();
    initCatalogPagination();
    loadDynamicCategories();

    // Синхронизация при загрузке если авторизован
    syncCartWithApi();
    syncFavsWithApi();

    // Наблюдаем за переключением вкладок профиля
    var isRendering = false;
    var observer = new MutationObserver(function(){
      if(isRendering) return;
      isRendering = true;
      renderExtendedProfile();
      setTimeout(function(){ renderAddressesInProfile(); isRendering = false; }, 100);
    });
    var profileContent = document.querySelector('[data-profile-content]');
    if(profileContent) observer.observe(profileContent, { childList: true });
  });
})();
