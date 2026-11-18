(function(){
  'use strict';
  const API = window.PSL_API;
  const staff = document.body.dataset.supportMode === 'staff';
  const query = new URLSearchParams(location.search);
  const id = query.get('id');
  const base = '/api/support';
  const roomPath = id ? base + '/cases/' + encodeURIComponent(id) : '';
  const staffPath = id ? base + '/staff/cases/' + encodeURIComponent(id) : '';
  const staffQuery = staff ? 'staff=1&' : '';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const statusNames = { WAITING:'Ожидает менеджера', ACTIVE:'Менеджер подключён', CLOSED:'Завершён' };
  const date = new Intl.DateTimeFormat('ru-RU', { dateStyle:'short', timeStyle:'short' });
  const feedback = $('[data-feedback]');
  const transcript = $('[data-transcript]');
  const compose = $('[data-compose]');
  const suggestionArea = $('[data-suggestions]');
  let after = 0;
  let loading = false;
  let sending = false;
  let pending;
  let actionBusy = false;
  let roomState;

  async function request(path, method = 'GET', body){
    const response = await API.fetch(path, {
      method, ...(body && {body:JSON.stringify(body)}), cache:'no-store', signal:AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      const error = new Error(result?.error?.message || 'Не удалось выполнить действие. Попробуйте ещё раз.');
      error.status = response.status;
      throw error;
    }
    return result.data;
  }

  function update(element, html){
    if (element.dataset.rendered === html) return;
    element.innerHTML = html;
    element.dataset.rendered = html;
  }

  function queue(items){
    const container = $('[data-queue]');
    const page = staff ? '/admin/dialogs/' : '/dialogs/';
    const groups = { WAITING:'Ожидают менеджера', ACTIVE:staff?'В работе':'Активные', CLOSED:'Завершённые' };
    update(container, items.length ? Object.entries(groups).map(([status, label]) => {
      const rows = items.filter(item => item.status === status);
      if (!rows.length) return '';
      return `<div class="queue-group"><h2>${label}</h2><div class="queue-list">${rows.map(item => `
        <a class="queue-card" href="${page}?id=${encodeURIComponent(item.id)}">
          <strong>${esc(item.customer?.name || statusNames[item.status])}</strong>
          <time>${date.format(new Date(item.updatedAt))}${item.manager?.name ? ' · '+esc(item.manager.name) : ''}</time>
          ${staff ? `<p>${esc(item.summary)}</p>` : ''}
        </a>`).join('')}</div></div>`;
    }).join('') : '<p>Диалогов пока нет.</p>');
    container.hidden = false;
  }

  function renderProfile(conversation){
    const customer = conversation.customer;
    const notes = conversation.notes || [];
    $('[data-client]').hidden = false;
    update($('[data-profile]'), `<h2>${esc(customer.name)}</h2>
      <dl><dt>Почта</dt><dd>${esc(customer.email)}</dd>${customer.phone ? `<dt>Телефон</dt><dd>${esc(customer.phone)}</dd>` : ''}</dl>
      <h2>${conversation.generated ? 'Сводка Guardex' : 'Контекст из переписки'}</h2><p>${esc(conversation.summary)}</p>`);
    update(suggestionArea, conversation.canReview
      ? notes.filter(note => note.status === 'PENDING').map(note => `
        <article class="note-suggestion"><small>${note.generated ? 'Guardex' : 'Из переписки'}</small>
          <h3>Добавить в заметку запись</h3><p>${esc(note.body)}</p>
          <div><button class="primary" data-note="${esc(note.id)}" data-decision="ACCEPTED">Добавить</button>
          <button class="secondary" data-note="${esc(note.id)}" data-decision="DISMISSED">Отмена</button></div>
        </article>`).join('') : '');
    const accepted = notes.filter(note => note.status === 'ACCEPTED');
    update($('[data-notes]'), `<h2>Заметки клиента</h2>${accepted.length
      ? accepted.map(note => `<p class="note">${esc(note.body)}</p>`).join('')
      : '<p>Сохранённых заметок пока нет.</p>'}`);
  }

  function renderRoom(conversation){
    roomState = conversation;
    $('[data-room]').hidden = false;
    $('[data-queue-link]').hidden = false;
    const badge = $('[data-status]');
    badge.hidden = false;
    badge.dataset.state = conversation.status;
    if (badge.textContent !== statusNames[conversation.status]) badge.textContent = statusNames[conversation.status];
    if (staff) renderProfile(conversation);

    let label = 'Менеджер ещё не подключился';
    if (conversation.status === 'CLOSED') label = 'Диалог завершён';
    else if (conversation.manager?.name) label = 'Менеджер · ' + conversation.manager.name;
    update($('[data-room-bar]'), `<span>${esc(label)}</span>${
      staff && conversation.status === 'WAITING' ? '<button class="primary" data-case-action="claim">Взять диалог</button>'
      : staff && conversation.canReply ? '<button class="secondary" data-case-action="close">Завершить диалог</button>' : ''}`);
    compose.hidden = staff ? !conversation.canReply : conversation.status === 'CLOSED';

    const lines = conversation.messages.filter(line => line.id > after);
    if (!lines.length) return;
    const nearBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 110;
    transcript.insertAdjacentHTML('beforeend', lines.map(line => {
      const own = line.author === (staff ? 'MANAGER' : 'CUSTOMER');
      const name = line.author === 'CUSTOMER' ? conversation.customer?.name || 'Вы'
        : line.author === 'MANAGER' ? conversation.manager?.name || 'Менеджер' : 'Guardex';
      return `<article class="line ${own?'own':''}"><small>${esc(name)} · ${date.format(new Date(line.createdAt))}</small><p>${esc(line.body)}</p></article>`;
    }).join(''));
    after = lines.at(-1).id;
    if (nearBottom || lines.some(line => line.author === (staff ? 'MANAGER' : 'CUSTOMER'))) transcript.scrollTop = transcript.scrollHeight;
  }

  async function refresh(){
    if (loading) return;
    loading = true;
    try {
      if (id) {
        let data;
        do {
          data = await request(roomPath+'?'+staffQuery+'after='+after);
          renderRoom(data);
        } while (data.messages.length === 200);
      } else {
        queue(await request(base + (staff ? '/staff/queue' : '/cases')));
      }
      if (feedback.dataset.pollError) { feedback.textContent = ''; delete feedback.dataset.pollError; }
    } catch (error) {
      if (error.status === 401) { location.replace(API.authUrl('login',location.href)); return; }
      if (error.status === 403 || error.status === 404) {
        $('[data-room]').hidden = true;
        $('[data-queue]').hidden = true;
      }
      feedback.textContent = error.message;
      feedback.dataset.pollError = '1';
    } finally { loading = false; }
  }

  compose.addEventListener('submit', async event => {
    event.preventDefault();
    const input = compose.elements.message;
    const text = input.value.trim();
    if (!text || sending || !roomState) return;
    if (!pending || pending.body !== text) pending = { key:crypto.randomUUID(), body:text };
    sending = true;
    const button = compose.querySelector('button');
    const restoreFocus = document.activeElement === button;
    button.disabled = true;
    feedback.textContent = '';
    delete feedback.dataset.pollError;
    try {
      await request(roomPath+'/messages'+(staff?'?staff=1':''), 'POST', pending);
      if (input.value.trim() === text) input.value = '';
      pending = undefined;
      await refresh();
    } catch (error) { feedback.textContent = error.message; }
    finally {
      sending = false;
      button.disabled = false;
      if (restoreFocus && !compose.hidden && document.activeElement === document.body) input.focus();
    }
  });

  async function loadTeam(){
    const target = $('[data-team-feedback]');
    target.textContent = '';
    try {
      const users = await request(base+'/staff/team');
      update($('[data-team-list]'), users.map(user => `<div class="team-person">
        <div><strong>${esc(user.name)}</strong><small>${esc(user.email)} · ${user.role==='ADMIN'?'Администратор':'Менеджер'}${user.isBlocked?' · Заблокирован':''}</small></div>
        ${user.role==='MANAGER' ? `<button class="secondary" data-revoke="${esc(user.email)}">Снять роль</button>` : ''}
      </div>`).join(''));
    } catch (error) { target.textContent = error.message; }
  }

  async function setRole(email, role, button){
    const target = $('[data-team-feedback]');
    button.disabled = true;
    try {
      await request(base+'/staff/team','PUT',{email,role});
      await loadTeam();
      if (!target.textContent) target.textContent = role==='MANAGER'?'Роль менеджера назначена.':'Роль менеджера снята.';
      return true;
    } catch (error) { target.textContent = error.message; return false; }
    finally { button.disabled = false; }
  }

  $('[data-role-form]')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (await setRole(form.elements.email.value.trim(),'MANAGER',form.querySelector('button'))) form.reset();
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-team')) { $('[data-team-dialog]').showModal(); await loadTeam(); }
    if (button.dataset.revoke) await setRole(button.dataset.revoke,'USER',button);
    if ((!button.dataset.caseAction && !button.dataset.note) || actionBusy) return;
    actionBusy = true;
    button.disabled = true;
    feedback.textContent = '';
    delete feedback.dataset.pollError;
    try {
      if (button.dataset.caseAction) await request(staffPath+'/'+button.dataset.caseAction,'POST');
      else await request(staffPath+'/notes/'+encodeURIComponent(button.dataset.note),'PATCH',{status:button.dataset.decision});
      await refresh();
    } catch (error) { feedback.textContent = error.message; }
    finally { actionBusy = false; button.disabled = false; }
  });

  async function start(){
    const user = API.getUser();
    if (!user || user.isDemo) { location.replace(API.authUrl('login',location.href)); return; }
    if (staff) {
      try {
        const current = await request('/api/auth/me');
        $('[data-team]').hidden = current.role !== 'ADMIN' || Boolean(id);
        if (current.role === 'MANAGER') {
          const home = $('[data-staff-home]');
          home.href = '/profile.html?view=settings';
          home.textContent = 'В профиль ↗';
          $('.brand').href = home.href;
        }
      } catch { /* The queue will report authorization errors. */ }
    }
    feedback.textContent = '';
    await refresh();
    setInterval(() => { if (!document.hidden) void refresh(); }, 7000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  }
  void start();
})();
