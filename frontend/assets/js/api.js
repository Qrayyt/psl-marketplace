/**
 * API-слой для PSL Marketplace.
 * Загружает товары из backend API в window.PRODUCTS.
 * Подключается МЕЖДУ data.js и app.js.
 *
 * Стратегия: асинхронная загрузка товаров через fetch.
 * window.PSL_PRODUCTS_READY - промис, который резолвится когда товары загружены.
 * app.js ждёт этот промис перед инициализацией.
 * Если API недоступен - fallback на данные из data.js.
 */

(function(){
  var API_BASE = window.PSL_API_URL || '';

  // Асинхронная загрузка товаров (не блокирует браузер)
  window.PSL_PRODUCTS_READY = fetch(API_BASE + '/api/products/all', { signal: AbortSignal.timeout(5000) })
    .then(function(r){ return r.json(); })
    .then(function(products){
      var pslCategories = ['Защитные покрытия','Клеевые системы','Гидроизоляция','Промышленные полы'];
      var isPslCatalog = Array.isArray(products) && products.some(function(product){
        return pslCategories.indexOf(product.category) !== -1;
      });
      if(Array.isArray(products) && products.length > 0 && isPslCatalog){
        window.PRODUCTS = products;
      }else if(Array.isArray(products) && products.length > 0){
        console.warn('[API] Получен устаревший демо-каталог, используется актуальный PSL fallback.');
      }
    })
    .catch(function(e){
      console.warn('[API] Не удалось загрузить товары с сервера, используем data.js:', e.message);
    });

  // Утилита для API-запросов с авторизацией
  window.PSL_API = {
    baseUrl: API_BASE,

    getToken: function(){
      return localStorage.getItem('psl_access_token');
    },

    setTokens: function(access, refresh){
      localStorage.setItem('psl_access_token', access);
      localStorage.setItem('psl_refresh_token', refresh);
    },

    clearTokens: function(){
      localStorage.removeItem('psl_access_token');
      localStorage.removeItem('psl_refresh_token');
    },

    getUser: function(){
      try {
        var raw = localStorage.getItem('psl_user');
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    },

    setUser: function(user){
      localStorage.setItem('psl_user', JSON.stringify(user));
    },

    clearUser: function(){
      localStorage.removeItem('psl_user');
    },

    // Авторизованный fetch
    fetch: function(path, options){
      options = options || {};
      var token = this.getToken();
      var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      if(token) headers['Authorization'] = 'Bearer ' + token;

      var self = this;
      return fetch(API_BASE + path, Object.assign({}, options, { headers: headers }))
        .then(function(response){
          if(response.status === 401 && token){
            return self.refreshToken().then(function(ok){
              if(ok){
                headers['Authorization'] = 'Bearer ' + self.getToken();
                return fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
              }
              return response;
            });
          }
          return response;
        });
    },

    refreshToken: function(){
      var refreshToken = localStorage.getItem('psl_refresh_token');
      if(!refreshToken) return Promise.resolve(false);

      var self = this;
      return fetch(API_BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken })
      })
      .then(function(response){
        if(!response.ok) throw new Error('Refresh failed');
        return response.json();
      })
      .then(function(data){
        self.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      })
      .catch(function(){
        self.clearTokens();
        self.clearUser();
        return false;
      });
    },

    register: function(email, password, name, phone){
      var self = this;
      return fetch(API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, name: name, phone: phone || undefined })
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.success){
          self.setTokens(data.data.accessToken, data.data.refreshToken);
          self.setUser(data.data.user);
        }
        return data;
      });
    },

    login: function(email, password){
      var self = this;
      return fetch(API_BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.success){
          self.setTokens(data.data.accessToken, data.data.refreshToken);
          self.setUser(data.data.user);
        }
        return data;
      });
    },

    logout: function(){
      var refreshToken = localStorage.getItem('psl_refresh_token');
      var self = this;
      return fetch(API_BASE + '/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken })
      })
      .catch(function(){})
      .then(function(){
        self.clearTokens();
        self.clearUser();
      });
    },

    isLoggedIn: function(){
      return !!this.getToken();
    }
  };
})();
