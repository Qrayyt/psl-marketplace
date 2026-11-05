(function(){
  'use strict';
  const API=window.PSL_API,root=document.querySelector('[data-auth-content]');
  const params=new URLSearchParams(location.search);
  const returnTo=API.safeReturn(params.get('returnTo'));
  const known=['login','register','forgot','reset'];
  const paths={user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',lock:'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3M12 15v2"/>',arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>',eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="m3 3 18 18M10 5a13 13 0 0 1 2 0c7 0 10 7 10 7a20 20 0 0 1-3 4M6 6a19 19 0 0 0-4 6s3 7 10 7a13 13 0 0 0 6-2M10 10a3 3 0 0 0 4 4"/>'};
  const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[k]}</svg>`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode=known.includes(params.get('mode'))?params.get('mode'):'login',controller=null,emailDraft='',busy=false;
  const back=document.querySelector('[data-back]');back.href=returnTo;
  document.querySelector('[data-year]').textContent=new Date().getFullYear();
  function field(name,label,type,ico,extra=''){
    return `<label class="auth-field"><span class="visually-hidden">${label}</span><span class="field-icon">${icon(ico)}</span><input type="${type}" name="${name}" placeholder="${label}" aria-label="${label}" ${extra}>${type==='password'?`<button class="password-toggle" type="button" data-password="${name}" aria-label="Показать ${name==='confirm'?'повтор пароля':'пароль'}" aria-pressed="false">${icon('eyeOff')}</button>`:''}</label>`;
  }
  function social(){return `<div class="auth-divider">или</div><div class="auth-social"><button class="social-button" type="button" aria-disabled="true" aria-describedby="provider-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.7 3.7 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.9 13.5l-4.8-1.5c-1-.3-1-1 .2-1.5L20 3.3c.9-.3 1.7.2 1.7.4Z"/></svg><span class="provider-name">Telegram</span></button><button class="social-button" type="button" aria-disabled="true" aria-describedby="provider-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.8 10H12v4h5.6a5.8 5.8 0 0 1-5.6 4A6 6 0 1 1 16 7.5l3-2.9A10 10 0 1 0 22 12c0-.7-.1-1.3-.2-2Z"/></svg><span class="provider-name">Google</span></button></div><p class="social-note" id="provider-note">Вход через Telegram и Google пока не подключён.</p>`;}
  function render(){
    controller?.abort();controller=null;busy=false;
    const reg=mode==='register',help=mode==='forgot'||mode==='reset';
    document.title=(help?'Восстановление доступа':reg?'Создать аккаунт':'Вход в аккаунт')+' — PSL';
    root.innerHTML=help?`<h1>Восстановить доступ</h1><p class="auth-intro">Поможем вернуться в ваш аккаунт PSL.</p><section class="auth-help-panel"><p>Автоматическое восстановление пароля пока не подключено. Напишите в поддержку PSL с почты, указанной в аккаунте.</p><a class="auth-submit" href="mailto:info@polymer-system.ru?subject=${encodeURIComponent('PSL — восстановление доступа')}"><span>Написать в поддержку</span>${icon('arrow')}</a></section><a class="auth-switch" href="${esc(API.authUrl('login',returnTo))}" data-mode="login">Вернуться ко входу</a>`:`<h1>${reg?'Создать аккаунт':'Вход в аккаунт'}</h1><p class="auth-intro">${reg?'Сохраняйте материалы и управляйте запросами в личном кабинете PSL.':'Управляйте заказами, сохраняйте материалы<br class="desktop-break"> и отправляйте запросы.'}</p><form class="auth-form" data-login-form>${reg?field('name','Ваше имя','text','user','required autocomplete="name" maxlength="100"'):''}${field('email','Электронная почта','email','user',`required autocomplete="email" inputmode="email" maxlength="254" value="${esc(emailDraft)}"`)}${field('password','Пароль','password','lock',`required autocomplete="${reg?'new-password':'current-password'}" ${reg?'minlength="6"':''}`)}${reg?field('confirm','Повторите пароль','password','lock','required autocomplete="new-password" minlength="6"'):''}<div class="auth-options"><label class="auth-checkbox"><input type="checkbox" name="remember"><span>Запомнить меня</span></label>${!reg?`<a class="auth-link" href="${esc(API.authUrl('forgot',returnTo))}" data-mode="forgot">Забыли пароль?</a>`:''}</div>${reg?'<label class="auth-consent"><input type="checkbox" name="consent" required><span>Согласен с <a href="privacy.html" target="_blank" rel="noopener">политикой конфиденциальности</a></span></label>':''}<p class="form-status" role="status" aria-live="polite" data-error="false"></p><button class="auth-submit" type="submit"><span>${reg?'Создать аккаунт':'Войти'}</span>${icon('arrow')}</button></form>${social()}<a class="auth-switch" href="${esc(API.authUrl(reg?'login':'register',returnTo))}" data-mode="${reg?'login':'register'}">${reg?'Уже есть аккаунт? Войти':'Создать аккаунт'}</a>`;
  }
  function switchMode(next,push=true){
    const email=root.querySelector('[name=email]');if(email)emailDraft=email.value;
    mode=known.includes(next)?next:'login';
    if(push)history.pushState(null,'',API.authUrl(mode,returnTo));
    render();
  }
  root.addEventListener('click',e=>{
    const link=e.target.closest('[data-mode]');if(link){e.preventDefault();switchMode(link.dataset.mode);return;}
    const toggle=e.target.closest('[data-password]');if(toggle){const input=root.querySelector(`[name="${toggle.dataset.password}"]`),show=input.type==='password';input.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',(show?'Скрыть ':'Показать ')+(toggle.dataset.password==='confirm'?'повтор пароля':'пароль'));toggle.innerHTML=icon(show?'eye':'eyeOff');}
    if(e.target.closest('[aria-disabled=true]'))e.preventDefault();
  });
  root.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const form=e.target,status=form.querySelector('.form-status'),submit=form.querySelector('[type=submit]');
    const data=Object.fromEntries(new FormData(form));
    status.textContent='';status.dataset.error='false';
    if(mode==='register'&&data.password!==data.confirm){status.textContent='Пароли не совпадают.';status.dataset.error='true';form.elements.confirm.focus();return;}
    if(mode==='register'&&!data.name.trim()){status.textContent='Введите имя.';status.dataset.error='true';form.elements.name.focus();return;}
    const endpoint=mode==='register'?'/api/auth/register':'/api/auth/login';
    const payload={email:data.email.trim(),password:data.password};if(mode==='register')payload.name=data.name.trim();
    const active=new AbortController();controller=active;const timer=setTimeout(()=>active.abort('timeout'),12000);
    busy=true;submit.disabled=true;submit.querySelector('span').textContent=mode==='register'?'Создаём аккаунт…':'Входим…';
    try{
      const response=await fetch(API.baseUrl+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:active.signal});
      let result;try{result=await response.json();}catch{throw Error('Сервис входа сейчас недоступен. Попробуйте позже.');}
      if(!response.ok||!result.success){throw Error(response.status===401?'Неверная почта или пароль.':response.status===409?'Аккаунт с этой почтой уже существует.':response.status===429?'Слишком много попыток. Попробуйте позже.':response.status>=500?'Сервис входа сейчас недоступен. Попробуйте позже.':'Не удалось войти. Проверьте введённые данные.');}
      const session=result.data;
      if(!session?.accessToken||!session?.refreshToken||!session?.user)throw Error('Не удалось получить сессию. Попробуйте ещё раз.');
      if(active.signal.aborted)return;
      try{API.setTokens(session.accessToken,session.refreshToken,form.elements.remember.checked);API.setUser(session.user);}catch(err){API.clearTokens();API.clearUser();throw err;}
      location.replace(returnTo);
    }catch(err){
      if(controller!==active)return;
      status.dataset.error='true';status.textContent=active.signal.aborted?'Сервис не отвечает. Попробуйте ещё раз.':err instanceof TypeError?'Не удалось подключиться. Проверьте соединение.':err.message;
    }finally{clearTimeout(timer);if(controller===active){busy=false;submit.disabled=false;submit.querySelector('span').textContent=mode==='register'?'Создать аккаунт':'Войти';controller=null;}}
  });
  window.addEventListener('popstate',()=>{const next=new URLSearchParams(location.search).get('mode');switchMode(next,false);});
  window.addEventListener('pageshow',e=>{if(e.persisted)render();});
  render();
})();
