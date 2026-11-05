(function(){
  var API = '/api';
  var token = sessionStorage.getItem('psl_access_token') || localStorage.getItem('psl_access_token');
  var currentPage = 'dashboard';

  // --- API утилита ---
  function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    // Для FormData не ставим Content-Type
    if (options.body instanceof FormData) delete headers['Content-Type'];
    return fetch(API + path, Object.assign({}, options, { headers: headers }))
      .then(function(r) {
        if (r.status === 401 || r.status === 403) { showLogin(); throw new Error('Unauthorized'); }
        return r.json();
      });
  }

  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtPrice(v) { return new Intl.NumberFormat('ru-RU').format(v) + ' ₽'; }
  function fmtDate(d) { return new Date(d).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

  function statusBadge(status) {
    var labels = { NEW:'Новый', PROCESSING:'В обработке', SHIPPED:'Отправлен', DELIVERED:'Доставлен', CANCELLED:'Отменен' };
    return '<span class="badge ' + status.toLowerCase() + '">' + (labels[status] || status) + '</span>';
  }

  function roleBadge(role) {
    return '<span class="badge ' + role.toLowerCase() + '">' + (role === 'ADMIN' ? 'Админ' : 'Пользователь') + '</span>';
  }

  // --- Навигация ---
  function initNav() {
    document.querySelectorAll('[data-nav]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-nav]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentPage = btn.dataset.nav;
        renderPage();
      });
    });
    document.querySelector('[data-logout]').addEventListener('click', function() {
      token = null;
      ['psl_access_token','psl_refresh_token','psl_user'].forEach(function(key){sessionStorage.removeItem(key);});
      localStorage.removeItem('psl_access_token');
      localStorage.removeItem('psl_refresh_token');
      localStorage.removeItem('psl_user');
      showLogin();
    });
  }

  // --- Логин ---
  function showLogin() {
    document.querySelector('[data-login-modal]').style.display = 'flex';
    var form = document.querySelector('[data-login-form]');
    form.onsubmit = function(e) {
      e.preventDefault();
      var email = form.email.value;
      var password = form.password.value;
      fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) {
          document.querySelector('[data-login-error]').textContent = data.error.message;
          return;
        }
        if (data.data.user.role !== 'ADMIN') {
          document.querySelector('[data-login-error]').textContent = 'Доступ только для администраторов';
          return;
        }
        token = data.data.accessToken;
        ['psl_access_token','psl_refresh_token','psl_user'].forEach(function(key){sessionStorage.removeItem(key);});
        localStorage.setItem('psl_access_token', data.data.accessToken);
        localStorage.setItem('psl_refresh_token', data.data.refreshToken);
        localStorage.setItem('psl_user', JSON.stringify(data.data.user));
        document.querySelector('[data-login-modal]').style.display = 'none';
        renderPage();
      });
    };
  }

  function renderPage() {
    var content = document.querySelector('[data-content]');
    content.innerHTML = '<div class="loading">Загрузка...</div>';

    switch(currentPage) {
      case 'dashboard': renderDashboard(content); break;
      case 'products': renderProducts(content); break;
      case 'users': renderUsers(content); break;
      case 'orders': renderOrders(content); break;
      case 'discounts': renderDiscounts(content); break;
      case 'exchange': renderExchange(content); break;
      case 'audit': renderAudit(content); break;
    }
  }

  // --- Дашборд ---
  function renderDashboard(el) {
    api('/admin/stats').then(function(res) {
      var d = res.data;
      el.innerHTML = '<h2 style="margin-bottom:20px">Дашборд</h2>' +
        '<div class="metrics-grid">' +
          metric('Заказов сегодня', d.orders.today) +
          metric('Заказов за неделю', d.orders.week) +
          metric('Заказов за месяц', d.orders.month) +
          metric('Выручка сегодня', fmtPrice(d.revenue.today)) +
          metric('Выручка за неделю', fmtPrice(d.revenue.week)) +
          metric('Выручка за месяц', fmtPrice(d.revenue.month)) +
          metric('Пользователей', d.totalUsers) +
          metric('Товаров', d.totalProducts) +
        '</div>' +
        '<div class="table-wrap"><div class="table-header"><h3>Топ товаров</h3></div>' +
        '<ul class="top-list" style="padding:16px">' +
          (d.topProducts.length ? d.topProducts.map(function(t) {
            return '<li><span>' + esc(t.product ? t.product.name : '?') + '</span><strong>' + (t.totalSold || 0) + ' шт</strong></li>';
          }).join('') : '<li class="empty-state">Пока нет продаж</li>') +
        '</ul></div>';
    });
  }

  function metric(label, value) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div></div>';
  }

  // --- Товары ---
  function renderProducts(el, page) {
    page = page || 1;
    api('/admin/products?page=' + page + '&limit=20').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      el.innerHTML = '<h2 style="margin-bottom:20px">Товары</h2>' +
        '<div style="margin-bottom:16px"><button class="btn primary" data-new-product>+ Создать товар</button></div>' +
        '<div class="table-wrap">' +
        '<div class="table-header"><h3>Всего: ' + meta.total + '</h3></div>' +
        '<table><thead><tr>' +
          '<th>Название</th><th>Цена</th><th>Категория</th><th>Активен</th><th>Действия</th>' +
        '</tr></thead><tbody>' +
        items.map(function(p) {
          var is1c = !!p.externalId;
          var actions = '<button class="btn ghost sm" data-edit-product="' + p.id + '">' + (is1c ? 'Просмотр' : 'Ред.') + '</button>';
          if(p.isActive) {
            actions += '<button class="btn danger sm" data-del-product="' + p.id + '">Скрыть</button>';
          } else {
            actions += '<button class="btn primary sm" data-restore-product="' + p.id + '">Восстановить</button>';
          }
          if(!is1c) {
            actions += '<button class="btn danger sm" data-hard-del-product="' + p.id + '" style="margin-left:4px">&times;</button>';
          }
          var name = esc(p.name) + (is1c ? ' <span class="badge onec" title="Из 1С">1С</span>' : '');
          return '<tr' + (p.isActive ? '' : ' style="opacity:0.5"') + '>' +
            '<td>' + name + '</td>' +
            '<td>' + fmtPrice(p.price) + '</td>' +
            '<td>' + esc(p.category) + '</td>' +
            '<td>' + (p.isActive ? '<span style="color:#2e7d32">Да</span>' : '<span style="color:#c62828">Нет</span>') + '</td>' +
            '<td>' + actions + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>' + pagination(meta, function(p) { renderProducts(el, p); }) +
        '</div>';

      el.querySelector('[data-new-product]').onclick = function() { showProductForm(el, page, null); };

      el.querySelectorAll('[data-edit-product]').forEach(function(btn) {
        btn.onclick = function() { showProductForm(el, page, btn.dataset.editProduct); };
      });

      el.querySelectorAll('[data-del-product]').forEach(function(btn) {
        btn.onclick = function() {
          if (!confirm('Скрыть товар? Его можно будет восстановить.')) return;
          api('/admin/products/' + btn.dataset.delProduct, { method:'DELETE' }).then(function() { renderProducts(el, page); });
        };
      });

      el.querySelectorAll('[data-restore-product]').forEach(function(btn) {
        btn.onclick = function() {
          api('/admin/products/' + btn.dataset.restoreProduct + '/restore', { method:'POST' }).then(function() { renderProducts(el, page); });
        };
      });

      el.querySelectorAll('[data-hard-del-product]').forEach(function(btn) {
        btn.onclick = function() {
          if (!confirm('ПОЛНОСТЬЮ удалить товар? Это действие необратимо!')) return;
          api('/admin/products/' + btn.dataset.hardDelProduct + '/hard', { method:'DELETE' }).then(function() { renderProducts(el, page); });
        };
      });
    });
  }

  function showProductForm(el, page, productId) {
    var content = document.querySelector('[data-content]');
    var isEdit = !!productId;
    var title = isEdit ? 'Редактирование товара' : 'Новый товар';

    content.innerHTML = '<h2 style="margin-bottom:20px">' + title + '</h2>' +
      '<div class="table-wrap" style="padding:20px;max-width:600px">' +
      '<form data-product-form>' +
        '<div class="form-group"><label>Название</label><input name="name" required></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Цена</label><input name="price" type="number" min="0" required></div>' +
          '<div class="form-group"><label>Старая цена</label><input name="oldPrice" type="number" min="0" value="0"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Категория</label><select name="category"><option>Защитные покрытия</option><option>Клеевые системы</option><option>Гидроизоляция</option><option>Промышленные полы</option></select></div>' +
          '<div class="form-group"><label>Цвет</label><input name="color" placeholder="Черный"></div>' +
        '</div>' +
        '<div class="form-group"><label>Теги (через запятую)</label><input name="tags" placeholder="oversize, cotton"></div>' +
        '<div class="form-group"><label>Размеры (через запятую)</label><input name="sizes" placeholder="S, M, L, XL"></div>' +
        '<div class="form-group"><label>Описание</label><textarea name="description" rows="3"></textarea></div>' +
        '<div class="form-group"><label>Детали (каждый с новой строки)</label><textarea name="details" rows="3" placeholder="100% хлопок&#10;Плотность 240 gsm"></textarea></div>' +
        '<div class="form-group"><label>Accent (hex цвет)</label><input name="accent" placeholder="#111111"></div>' +
        (isEdit ? '<div class="form-group"><label>Изображения</label><div data-product-gallery class="product-gallery"></div><input type="file" name="image" accept="image/*" data-product-image><div class="hint">Новая загруженная картинка автоматически становится главной</div></div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button type="submit" class="btn primary">' + (isEdit ? 'Сохранить' : 'Создать') + '</button>' +
          '<button type="button" class="btn ghost" data-cancel>Отмена</button>' +
        '</div>' +
      '</form></div>';

    var form = content.querySelector('[data-product-form]');
    content.querySelector('[data-cancel]').onclick = function() { renderProducts(el, page); };

    function renderGallery(mainUrl, urls) {
      var gallery = form.querySelector('[data-product-gallery]');
      if(!gallery) return;
      if(!urls || !urls.length) {
        gallery.innerHTML = '<div class="gallery-empty">Нет изображений</div>';
        return;
      }
      gallery.innerHTML = urls.map(function(u) {
        var isMain = u === mainUrl;
        return '<div class="gallery-item' + (isMain ? ' main' : '') + '">' +
          '<img src="' + esc(u) + '" alt="">' +
          (isMain ? '<span class="gallery-main-badge">Главная</span>' : '') +
          '<div class="gallery-actions">' +
            (isMain ? '' : '<button type="button" class="btn ghost sm" data-set-main="' + esc(u) + '">Сделать главной</button>') +
            '<button type="button" class="btn danger sm" data-del-image="' + esc(u) + '">Удалить</button>' +
          '</div>' +
        '</div>';
      }).join('');

      gallery.querySelectorAll('[data-set-main]').forEach(function(b) {
        b.onclick = function() {
          api('/admin/products/' + productId, { method:'PATCH', body: JSON.stringify({ imageUrl: b.dataset.setMain }) }).then(function() {
            reloadProduct();
          });
        };
      });
      gallery.querySelectorAll('[data-del-image]').forEach(function(b) {
        b.onclick = function() {
          if(!confirm('Удалить это изображение?')) return;
          api('/admin/products/' + productId + '/image', { method:'DELETE', body: JSON.stringify({ imageUrl: b.dataset.delImage }) }).then(function() {
            reloadProduct();
          });
        };
      });
    }

    function reloadProduct() {
      return api('/admin/products?page=1&limit=100').then(function(res) {
        var p = res.data.find(function(item) { return item.id === productId; });
        if(!p) return;
        renderGallery(p.imageUrl, p.imageUrls || []);
        return p;
      });
    }

    // Если редактирование - загрузить данные
    if(isEdit) {
      api('/admin/products?page=1&limit=100').then(function(res) {
        var p = res.data.find(function(item) { return item.id === productId; });
        if(!p) return;
        form.name.value = p.name;
        form.price.value = p.price;
        form.oldPrice.value = p.oldPrice || 0;
        form.category.value = p.category;
        form.color.value = p.color || '';
        form.tags.value = (p.tags || []).join(', ');
        form.sizes.value = (p.sizes || []).join(', ');
        form.description.value = p.description || '';
        form.details.value = (p.details || []).join('\n');
        form.accent.value = p.accent || '';
        renderGallery(p.imageUrl, p.imageUrls || []);

        // Если товар синхронизирован с 1С - блокируем поля, управляемые 1С
        if(p.externalId) {
          var ownedBy1C = ['name','price','oldPrice','category','color','tags','sizes','description','details'];
          ownedBy1C.forEach(function(fieldName) {
            if(form[fieldName]) form[fieldName].setAttribute('readonly', 'readonly');
          });
          var notice = document.createElement('div');
          notice.className = 'notice-1c';
          notice.innerHTML = 'Товар синхронизирован с <strong>1С</strong>. Основные поля редактируются только в 1С. Картинки и accent можно менять здесь.';
          form.insertBefore(notice, form.firstChild);
        }
      });

      // Немедленная загрузка при выборе файла (без сохранения формы)
      var fileInput = form.querySelector('[data-product-image]');
      fileInput.addEventListener('change', function() {
        if(!fileInput.files || !fileInput.files[0]) return;
        var fd = new FormData();
        fd.append('image', fileInput.files[0]);
        api('/admin/products/' + productId + '/image', { method:'POST', body: fd }).then(function(res) {
          fileInput.value = '';
          if(res && res.data) {
            renderGallery(res.data.imageUrl || (res.data.imageUrls || [])[res.data.imageUrls.length - 1], res.data.imageUrls || []);
          } else {
            reloadProduct();
          }
        });
      });
    }

    form.onsubmit = function(e) {
      e.preventDefault();
      var tags = form.tags.value ? form.tags.value.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      var sizes = form.sizes.value ? form.sizes.value.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      var details = form.details.value ? form.details.value.split('\n').map(function(s){return s.trim();}).filter(Boolean) : [];

      var body = {
        name: form.name.value,
        price: parseFloat(form.price.value),
        oldPrice: parseFloat(form.oldPrice.value) || null,
        category: form.category.value,
        color: form.color.value || null,
        tags: tags,
        sizes: sizes,
        description: form.description.value || null,
        details: details,
        accent: form.accent.value || null,
      };

      var method = isEdit ? 'PATCH' : 'POST';
      var url = isEdit ? '/admin/products/' + productId : '/admin/products';

      api(url, { method: method, body: JSON.stringify(body) }).then(function() {
        renderProducts(el, page);
      });
    };
  }

  // --- Пользователи ---
  function renderUsers(el, page) {
    page = page || 1;
    api('/admin/users?page=' + page + '&limit=20').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      el.innerHTML = '<h2 style="margin-bottom:20px">Пользователи</h2>' +
        '<div class="table-wrap">' +
        '<div class="table-header"><h3>Всего: ' + meta.total + '</h3></div>' +
        '<table><thead><tr>' +
          '<th>Email</th><th>Имя</th><th>Роль</th><th>Заблокирован</th><th>Заказов</th><th>Действия</th>' +
        '</tr></thead><tbody>' +
        items.map(function(u) {
          return '<tr>' +
            '<td><a href="#" style="color:#1a1a1a;text-decoration:underline" data-view-user="' + u.id + '">' + esc(u.email) + '</a></td>' +
            '<td>' + esc(u.name) + '</td>' +
            '<td><select data-change-role="' + u.id + '" style="padding:4px 8px;border-radius:8px;border:1px solid #ddd;font-size:12px">' +
              '<option value="USER"' + (u.role === 'USER' ? ' selected' : '') + '>Пользователь</option>' +
              '<option value="ADMIN"' + (u.role === 'ADMIN' ? ' selected' : '') + '>Админ</option>' +
            '</select></td>' +
            '<td>' + (u.isBlocked ? '<span class="badge cancelled">Да</span>' : 'Нет') + '</td>' +
            '<td>' + (u._count ? u._count.orders : 0) + '</td>' +
            '<td>' + (u.isBlocked
              ? '<button class="btn ghost sm" data-unblock="' + u.id + '">Разблок.</button>'
              : '<button class="btn danger sm" data-block="' + u.id + '">Заблок.</button>') +
            '</td></tr>';
        }).join('') +
        '</tbody></table>' + pagination(meta, function(p) { renderUsers(el, p); }) +
        '</div>';

      el.querySelectorAll('[data-view-user]').forEach(function(link) {
        link.onclick = function(e) { e.preventDefault(); showUserCard(el, page, link.dataset.viewUser); };
      });
      el.querySelectorAll('[data-block]').forEach(function(btn) {
        btn.onclick = function() {
          api('/admin/users/' + btn.dataset.block + '/block', { method:'POST' }).then(function() { renderUsers(el, page); });
        };
      });
      el.querySelectorAll('[data-unblock]').forEach(function(btn) {
        btn.onclick = function() {
          api('/admin/users/' + btn.dataset.unblock + '/unblock', { method:'POST' }).then(function() { renderUsers(el, page); });
        };
      });
      el.querySelectorAll('[data-change-role]').forEach(function(sel) {
        sel.onchange = function() {
          api('/admin/users/' + sel.dataset.changeRole, { method:'PATCH', body: JSON.stringify({ role: sel.value }) })
            .then(function() { renderUsers(el, page); });
        };
      });
    });
  }

  function showUserCard(el, page, userId) {
    var content = document.querySelector('[data-content]');
    content.innerHTML = '<div class="loading">Загрузка...</div>';

    api('/admin/users/' + userId).then(function(res) {
      var u = res.data;
      content.innerHTML = '<div style="margin-bottom:16px"><button class="btn ghost" data-back-users>Назад к списку</button></div>' +
        '<h2 style="margin-bottom:20px">' + esc(u.name) + '</h2>' +
        '<div class="metrics-grid">' +
          metric('Email', u.email) +
          metric('Роль', u.role === 'ADMIN' ? 'Администратор' : 'Пользователь') +
          metric('Заблокирован', u.isBlocked ? 'Да' : 'Нет') +
          metric('Регистрация', fmtDate(u.createdAt)) +
        '</div>' +
        (u.addresses && u.addresses.length ? '<div class="table-wrap" style="margin-top:16px"><div class="table-header"><h3>Адреса</h3></div>' +
          '<table><thead><tr><th>Город</th><th>Адрес</th><th>Индекс</th><th>Основной</th></tr></thead><tbody>' +
          u.addresses.map(function(a) {
            return '<tr><td>' + esc(a.city) + '</td><td>' + esc(a.address) + '</td><td>' + (a.postalCode || '-') + '</td><td>' + (a.isDefault ? 'Да' : 'Нет') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '') +
        '<div class="table-wrap" style="margin-top:16px"><div class="table-header"><h3>Заказы</h3></div>' +
        (u.orders && u.orders.length ?
          '<table><thead><tr><th>Номер</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead><tbody>' +
          u.orders.map(function(o) {
            return '<tr><td>' + esc(o.orderNumber) + '</td><td>' + fmtPrice(o.total) + '</td><td>' + statusBadge(o.status) + '</td><td>' + fmtDate(o.createdAt) + '</td></tr>';
          }).join('') + '</tbody></table>'
          : '<div class="empty-state">Нет заказов</div>') +
        '</div>';

      content.querySelector('[data-back-users]').onclick = function() { renderUsers(el, page); };
    });
  }

  // --- Заказы ---
  function renderOrders(el, page) {
    page = page || 1;
    api('/admin/orders?page=' + page + '&limit=20').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      el.innerHTML = '<h2 style="margin-bottom:20px">Заказы</h2>' +
        '<div class="table-wrap">' +
        '<div class="table-header"><h3>Всего: ' + meta.total + '</h3></div>' +
        '<table><thead><tr>' +
          '<th>Номер</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th>Дата</th><th>Действия</th>' +
        '</tr></thead><tbody>' +
        items.map(function(o) {
          return '<tr>' +
            '<td>' + esc(o.orderNumber) + '</td>' +
            '<td>' + esc(o.user ? o.user.name : '') + '</td>' +
            '<td>' + fmtPrice(o.total) + '</td>' +
            '<td>' + statusBadge(o.status) + '</td>' +
            '<td>' + fmtDate(o.createdAt) + '</td>' +
            '<td><select class="btn ghost sm" data-order-status="' + o.id + '" style="padding:4px 8px">' +
              ['NEW','PROCESSING','SHIPPED','DELIVERED','CANCELLED'].map(function(s) {
                return '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + s + '</option>';
              }).join('') +
            '</select></td></tr>';
        }).join('') +
        '</tbody></table>' + pagination(meta, function(p) { renderOrders(el, p); }) +
        '</div>';

      el.querySelectorAll('[data-order-status]').forEach(function(sel) {
        sel.onchange = function() {
          api('/admin/orders/' + sel.dataset.orderStatus + '/status', {
            method:'PATCH', body: JSON.stringify({ status: sel.value })
          }).then(function() { renderOrders(el, page); });
        };
      });
    });
  }

  // --- Скидки ---
  function renderDiscounts(el, page) {
    page = page || 1;
    api('/admin/discounts?page=' + page + '&limit=20').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      el.innerHTML = '<h2 style="margin-bottom:20px">Скидочные правила</h2>' +
        '<div style="margin-bottom:16px"><button class="btn primary" data-new-discount>+ Новое правило</button></div>' +
        '<div class="table-wrap">' +
        '<table><thead><tr>' +
          '<th>Название</th><th>Тип</th><th>Значение</th><th>Промокод</th><th>Приоритет</th><th>Активно</th><th>Действия</th>' +
        '</tr></thead><tbody>' +
        items.map(function(d) {
          return '<tr>' +
            '<td>' + esc(d.name) + '</td>' +
            '<td>' + (d.type === 'PERCENT' ? '%' : 'Фикс') + '</td>' +
            '<td>' + d.value + (d.type === 'PERCENT' ? '%' : ' ₽') + '</td>' +
            '<td>' + (d.promoCode ? esc(d.promoCode) : '-') + '</td>' +
            '<td>' + d.priority + '</td>' +
            '<td>' + (d.isActive ? 'Да' : 'Нет') + '</td>' +
            '<td><button class="btn danger sm" data-del-discount="' + d.id + '">Удал.</button></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>' + pagination(meta, function(p) { renderDiscounts(el, p); }) +
        '</div>';

      el.querySelector('[data-new-discount]').onclick = function() { showDiscountForm(el, page); };
      el.querySelectorAll('[data-del-discount]').forEach(function(btn) {
        btn.onclick = function() {
          if (!confirm('Удалить правило скидки?')) return;
          api('/admin/discounts/' + btn.dataset.delDiscount, { method:'DELETE' }).then(function() { renderDiscounts(el, page); });
        };
      });
    });
  }

  function showDiscountForm(el, page) {
    var content = document.querySelector('[data-content]');
    content.innerHTML = '<h2 style="margin-bottom:20px">Новое правило скидки</h2>' +
      '<div class="table-wrap" style="padding:20px;max-width:500px">' +
      '<form data-discount-form>' +
        '<div class="form-group"><label>Название</label><input name="name" required></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Тип</label><select name="type"><option value="PERCENT">Процент</option><option value="FIXED">Фиксированная сумма</option></select></div>' +
          '<div class="form-group"><label>Значение</label><input name="value" type="number" min="0" required></div>' +
        '</div>' +
        '<div class="form-group"><label>Промокод (опционально)</label><input name="promoCode" placeholder="SALE20"></div>' +
        '<div class="form-group"><label>Теги товаров (через запятую)</label><input name="targetTags" placeholder="cotton, basic"></div>' +
        '<div class="form-group"><label>Пользователи (email через запятую, пусто = для всех)</label><input name="targetUsers" placeholder="user@mail.ru, admin@psl.ru"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Приоритет</label><input name="priority" type="number" value="0"></div>' +
          '<div class="form-group"><label>Суммируемая</label><select name="isStackable"><option value="false">Нет</option><option value="true">Да</option></select></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button type="submit" class="btn primary">Создать</button>' +
          '<button type="button" class="btn ghost" data-cancel>Отмена</button>' +
        '</div>' +
      '</form></div>';

    content.querySelector('[data-cancel]').onclick = function() { renderDiscounts(el, page); };
    content.querySelector('[data-discount-form]').onsubmit = function(e) {
      e.preventDefault();
      var f = e.target;
      var tags = f.targetTags.value ? f.targetTags.value.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      var userEmails = f.targetUsers.value ? f.targetUsers.value.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      api('/admin/discounts', {
        method:'POST',
        body: JSON.stringify({
          name: f.name.value,
          type: f.type.value,
          value: parseFloat(f.value.value),
          promoCode: f.promoCode.value || null,
          targetTags: tags,
          targetUserEmails: userEmails,
          priority: parseInt(f.priority.value) || 0,
          isStackable: f.isStackable.value === 'true',
        })
      }).then(function() { renderDiscounts(el, page); });
    };
  }

  // --- Обмен 1С ---
  function renderExchange(el, page) {
    page = page || 1;
    el.innerHTML = '<h2 style="margin-bottom:20px">Обмен с 1С</h2>' +
      '<div style="margin-bottom:16px"><button class="btn primary" data-sync-1c>Запустить синхронизацию</button></div>' +
      '<div class="table-wrap" data-exchange-table><div class="loading">Загрузка лога...</div></div>';

    el.querySelector('[data-sync-1c]').onclick = function() {
      api('/admin/exchange/sync', { method:'POST' }).then(function(res) {
        alert('Синхронизация: обновлено заказов - ' + res.data.updatedOrders);
        loadExchangeLog(el, page);
      }).catch(function() { alert('Ошибка синхронизации'); });
    };
    loadExchangeLog(el, page);
  }

  function loadExchangeLog(el, page) {
    api('/admin/exchange/log?page=' + page + '&limit=20').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      var wrap = el.querySelector('[data-exchange-table]');
      wrap.innerHTML = '<table><thead><tr>' +
        '<th>Направление</th><th>Тип</th><th>Статус</th><th>Ошибка</th><th>Дата</th>' +
      '</tr></thead><tbody>' +
      (items.length ? items.map(function(l) {
        return '<tr>' +
          '<td>' + (l.direction === 'OUTGOING' ? 'Исходящий' : 'Входящий') + '</td>' +
          '<td>' + esc(l.entityType) + '</td>' +
          '<td><span class="badge ' + l.status.toLowerCase() + '">' + l.status + '</span></td>' +
          '<td>' + (l.error ? esc(l.error) : '-') + '</td>' +
          '<td>' + fmtDate(l.createdAt) + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5" class="empty-state">Нет записей</td></tr>') +
      '</tbody></table>' + pagination(meta, function(p) { loadExchangeLog(el, p); });
    });
  }

  // --- Аудит-лог ---
  function renderAudit(el, page) {
    page = page || 1;
    api('/admin/audit-log?page=' + page + '&limit=50').then(function(res) {
      var items = res.data;
      var meta = res.meta;
      el.innerHTML = '<h2 style="margin-bottom:20px">Аудит-лог</h2>' +
        '<div class="table-wrap">' +
        '<table><thead><tr>' +
          '<th>Действие</th><th>Пользователь</th><th>Объект</th><th>IP</th><th>Дата</th>' +
        '</tr></thead><tbody>' +
        items.map(function(l) {
          return '<tr>' +
            '<td>' + esc(l.action) + '</td>' +
            '<td>' + (l.user ? esc(l.user.email) : '-') + '</td>' +
            '<td>' + esc(l.entityType) + (l.entityId ? ':' + l.entityId.substring(0,8) : '') + '</td>' +
            '<td>' + (l.ip || '-') + '</td>' +
            '<td>' + fmtDate(l.createdAt) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>' + pagination(meta, function(p) { renderAudit(el, p); }) +
        '</div>';
    });
  }

  // --- Пагинация ---
  function pagination(meta, callback) {
    if (!meta || meta.totalPages <= 1) return '';
    var html = '<div class="pagination">';
    html += '<button ' + (meta.page <= 1 ? 'disabled' : '') + ' data-page="' + (meta.page - 1) + '">Назад</button>';
    for (var i = 1; i <= Math.min(meta.totalPages, 10); i++) {
      html += '<button class="' + (i === meta.page ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button ' + (meta.page >= meta.totalPages ? 'disabled' : '') + ' data-page="' + (meta.page + 1) + '">Вперед</button>';
    html += '</div>';

    // Вернем HTML, а привязку делаем через MutationObserver (или после вставки)
    setTimeout(function() {
      document.querySelectorAll('.pagination button[data-page]').forEach(function(btn) {
        btn.onclick = function() {
          var p = parseInt(btn.dataset.page);
          if (p >= 1 && p <= meta.totalPages) callback(p);
        };
      });
    }, 50);

    return html;
  }

  // --- Init ---
  function init() {
    initNav();
    // Проверяем авторизацию
    if (!token) {
      showLogin();
      return;
    }
    // Проверяем что токен валиден
    api('/auth/me').then(function(res) {
      if (res.data.role !== 'ADMIN') {
        token = null;
        showLogin();
        return;
      }
      renderPage();
    }).catch(function() { showLogin(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
