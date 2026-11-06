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
  var APP_BASE = new URL('../../', document.currentScript.src);
  function demoUser(){
    try{var login=sessionStorage.getItem('psl_demo_login');if(login!=='1'&&login!=='2')return null;return {id:'demo-'+login,name:login==='2'?'Администратор':'Тестовый пользователь',email:'',phone:'',role:login==='2'?'ADMIN':'USER',isDemo:true};}catch(e){return null;}
  }
  function readAuth(key){try{return sessionStorage.getItem(key)||localStorage.getItem(key);}catch(e){return null;}}
  function authStore(){return sessionStorage.getItem('psl_access_token') ? sessionStorage : localStorage;}
  function safeReturn(value){
    var fallback = new URL('profile.html?view=overview',APP_BASE);
    try{
      if(!value || /[\x00-\x1f\x7f]/.test(value)) return fallback.href;
      var url = new URL(value,APP_BASE);
      if(url.username || url.password || url.origin !== APP_BASE.origin || !/^https?:$/.test(url.protocol) || !url.pathname.startsWith(APP_BASE.pathname)) return fallback.href;
      var path=url.pathname.slice(APP_BASE.pathname.length);
      if(!['','index.html','profile.html','product.html','ai-chat.html','privacy.html','admin/','admin/index.html','admin/legacy.html'].includes(path)) return fallback.href;
      return url.href;
    }catch(e){return fallback.href;}
  }
  function authUrl(mode,target){
    var url=new URL('auth.html',APP_BASE);
    url.searchParams.set('mode',['login','register','forgot','reset'].includes(mode)?mode:'login');
    url.searchParams.set('returnTo',safeReturn(target||location.href));
    return url.href;
  }

  // Асинхронная загрузка товаров (не блокирует браузер)
  window.PSL_PRODUCTS_READY = (document.body.hasAttribute('data-auth-page') || document.body.hasAttribute('data-admin-preview') || demoUser()) ? Promise.resolve() : fetch(API_BASE + '/api/products/all', { signal: AbortSignal.timeout(5000) })
    .then(function(r){ return r.json(); })
    .then(function(products){
      if(Array.isArray(products)){
        var oldDemoCategories = ['Топы','Худи','Брюки','Верхняя одежда','Аксессуары','Обувь'];
        var materials = products.filter(function(product){ return oldDemoCategories.indexOf(product.category) === -1; });
        window.PRODUCTS = materials;
      }
    })
    .catch(function(e){
      console.warn('[API] Не удалось загрузить товары с сервера, используем data.js:', e.message);
    });

  // Утилита для API-запросов с авторизацией
  window.PSL_API = {
    baseUrl: API_BASE,

    safeReturn: safeReturn,
    getDemoUser: demoUser,
    startDemo: function(login){
      if(login!=='1'&&login!=='2')throw Error('Неизвестный тестовый логин');
      this.clearTokens();this.clearUser();sessionStorage.setItem('psl_demo_login',login);
    },
    demoDestination: function(login,target){
      if(login==='2')return new URL('admin/',APP_BASE).href;
      var url=new URL(safeReturn(target));
      return url.pathname.includes('/admin/')?new URL('profile.html?view=overview',APP_BASE).href:url.href;
    },
    authUrl: authUrl,
    redirectToAuth: function(mode,target){ location.assign(authUrl(mode,target)); },
    getToken: function(){ return demoUser()?null:readAuth('psl_access_token'); },
    getRefreshToken: function(){ return demoUser()?null:readAuth('psl_refresh_token'); },
    setTokens: function(access,refresh,remember){
      sessionStorage.removeItem('psl_demo_login');
      var selected=typeof remember==='boolean'?(remember?localStorage:sessionStorage):authStore();
      var other=selected===localStorage?sessionStorage:localStorage;
      try{
        selected.setItem('psl_access_token',access);
        selected.setItem('psl_refresh_token',refresh);
      }catch(e){selected.removeItem('psl_access_token');selected.removeItem('psl_refresh_token');throw Error('Не удалось сохранить сессию. Разрешите хранение данных для этого сайта.');}
      ['psl_access_token','psl_refresh_token','psl_user'].forEach(function(key){other.removeItem(key);});
    },
    clearTokens: function(){
      [localStorage,sessionStorage].forEach(function(storage){storage.removeItem('psl_access_token');storage.removeItem('psl_refresh_token');});
    },
    getUser: function(){if(demoUser())return demoUser();try{var raw=authStore().getItem('psl_user');return raw?JSON.parse(raw):null;}catch(e){return null;}},
    setUser: function(user){if(demoUser())return;authStore().setItem('psl_user',JSON.stringify(user));},
    clearUser: function(){localStorage.removeItem('psl_user');sessionStorage.removeItem('psl_user');},

    // Авторизованный fetch
    fetch: function(path, options){
      options = options || {};
      var demo=demoUser();
      if(demo){
        var method=(options.method || 'GET').toUpperCase(),data;
        if(method==='GET' && path==='/api/auth/me')data=demo;
        else if(method==='GET' && (path.startsWith('/api/orders') || path.startsWith('/api/addresses')))data=[];
        else return Promise.resolve(new Response(JSON.stringify({success:false,error:{message:'Деморежим: серверные операции отключены.'}}),{status:403,headers:{'Content-Type':'application/json'}}));
        return Promise.resolve(new Response(JSON.stringify({success:true,data:data}),{headers:{'Content-Type':'application/json'}}));
      }
      var token = this.getToken();
      var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      if(options.body instanceof FormData) delete headers['Content-Type'];
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
      var refreshToken = this.getRefreshToken();
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
      if(demoUser()){sessionStorage.removeItem('psl_demo_login');return Promise.resolve();}
      var refreshToken = this.getRefreshToken();
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
      return !!demoUser() || !!this.getToken();
    }
  };
})();
