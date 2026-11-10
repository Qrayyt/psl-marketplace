(function(){
  'use strict';
  const api = window.PSL_API;
  const dialog = document.querySelector('.admin-dialog');
  const statusLabels = {
    NEW: 'Новый', PROCESSING: 'В обработке', SHIPPED: 'Отправлен',
    DELIVERED: 'Доставлен', CANCELLED: 'Отменён',
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = value => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
  const date = value => new Date(value).toLocaleString('ru-RU');
  const status = value => escape(statusLabels[value] || value);
  const buyer = order => ({
    name: order.contactName || order.user?.name,
    phone: order.contactPhone || order.user?.phone,
    email: order.contactEmail || order.user?.email,
  });
  const base = '/api/admin/orders';
  let timer;

  async function request(path, options){
    const response = await api.fetch(path, { signal: AbortSignal.timeout(12000), ...options });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw Error(result?.error?.message || 'Не удалось получить данные заказа.');
    return result;
  }

  function list({ query = '', filter = 'all', page = 1, recent = false } = {}){
    const params = new URLSearchParams({ page, limit: recent ? 6 : 12 });
    if (query) params.set('search', query);
    if (statusLabels[filter]) params.set('status', filter);
    clearTimeout(timer);
    timer = setTimeout(() => loadList(), 160);
    return `<section class="panel table-panel" data-server-orders="${escape(params)}" data-recent="${recent}"><p>Загружаем заказы…</p></section>`;
  }

  async function loadList(){
    const root = document.querySelector('[data-server-orders]');
    if (!root) return;
    root.setAttribute('aria-busy', 'true');
    try {
      const { data, meta } = await request(base + '?' + root.dataset.serverOrders);
      if (!root.isConnected) return;
      const rows = data.map(order => {
        const contact = buyer(order);
        return `<tr>
          <td><strong>${escape(order.orderNumber)}</strong><small>${date(order.createdAt)}</small></td>
          <td>${escape(contact.name)}<small>${escape(order.company || contact.phone || contact.email || '')}</small></td>
          <td>${escape(order.items.map(item => item.product.name).join(', '))}</td>
          <td>${money(order.total)}</td>
          <td><span class="status">${status(order.status)}</span></td>
          <td><button class="white-button" data-server-order="${escape(order.id)}">Открыть</button></td>
        </tr>`;
      }).join('');
      root.innerHTML = rows
        ? `<div class="table-scroll"><table><thead><tr><th>Заказ</th><th>Покупатель</th><th>Материалы</th><th>Сумма</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
          ${root.dataset.recent === 'false' ? `<div class="pager"><span>${meta.total} заказов · страница ${meta.page} из ${meta.totalPages}</span><div>
          <button data-page="${meta.page-1}" ${meta.page<=1?'disabled':''} aria-label="Предыдущая страница">←</button>
          <button data-page="${meta.page+1}" ${meta.page>=meta.totalPages?'disabled':''} aria-label="Следующая страница">→</button></div></div>` : ''}`
        : '<div class="empty">Заказы не найдены.</div>';
    } catch (error) {
      if (root.isConnected) root.innerHTML = `<div class="empty">${escape(error.message)} <button class="white-button" data-order-retry>Повторить</button></div>`;
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }

  function modal(title, body){
    dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${escape(title)}</h2><button type="button" data-close-dialog aria-label="Закрыть окно">×</button></div>${body}`;
    if (!dialog.open) dialog.showModal();
  }

  function showOrder(order){
    const contact = buyer(order);
    const phone = (contact.phone || '').replace(/[^+\d]/g, '');
    const history = (order.history || []).map(event => {
      const description = event.action === 'order_status_changed'
        ? status(event.details?.from) + ' → ' + status(event.details?.to)
        : event.action === 'order_cancelled' ? 'Покупатель отменил заказ' : 'Заказ отправлен';
      return `<li>${date(event.createdAt)} · ${description}</li>`;
    }).join('');
    modal(order.orderNumber, `
      <p class="dialog-sub">${date(order.createdAt)} · ${status(order.status)}</p>
      <section class="catalog-documents"><h3>Контакты заказчика</h3><div class="detail-pairs">
        <div><small>Имя</small><strong>${escape(contact.name || '—')}</strong></div>
        <div><small>Компания</small><strong>${escape(order.company || '—')}</strong></div>
        <div><small>Телефон</small><strong>${phone ? `<a href="tel:${escape(phone)}">${escape(contact.phone)}</a>` : '—'}</strong></div>
        <div><small>Почта</small><strong>${contact.email ? `<a href="mailto:${encodeURIComponent(contact.email)}">${escape(contact.email)}</a>` : '—'}</strong></div>
      </div>${order.customerNote ? `<p class="order-note">${escape(order.customerNote)}</p>` : ''}
      ${order.deliveryAddress ? `<p class="order-note">${escape(order.deliveryAddress.city)}, ${escape(order.deliveryAddress.address)}</p>` : ''}</section>
      <section class="catalog-documents"><h3>Состав заказа</h3>
        <div class="dialog-list">${order.items.map(item => `<div><span>${escape(item.product.name)} · ${escape(item.size)} · ${item.quantity} шт.</span><strong>${money(item.price)} / шт.</strong></div>`).join('')}
          <div><strong>Итого за материалы</strong><strong>${money(order.total)}</strong></div>
        </div>
      </section>
      ${history ? `<section class="catalog-documents"><h3>История статусов</h3><ul>${history}</ul></section>` : ''}
      <form data-order-status="${escape(order.id)}"><label class="field">Статус
        <select name="status">${Object.entries(statusLabels).map(([key,label]) => `<option value="${key}" ${order.status===key?'selected':''}>${label}</option>`).join('')}</select></label>
        <p class="dialog-sub" role="status" data-order-message></p>
        <div class="form-foot"><button type="submit" class="black-button">Сохранить статус</button></div>
      </form>`);
  }

  async function openOrder(id){
    modal('Заказ', '<p data-order-loading>Загружаем заказ…</p>');
    const loading = dialog.querySelector('[data-order-loading]');
    try {
      const { data } = await request(base + '/' + encodeURIComponent(id));
      if (loading.isConnected && dialog.open) showOrder(data);
    } catch (error) {
      if (loading.isConnected) loading.textContent = error.message;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.serverOrder) void openOrder(button.dataset.serverOrder);
    if (button?.hasAttribute('data-order-retry')) void loadList();
  });

  dialog.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.dataset.orderStatus) return;
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    if (button.disabled) return;
    button.disabled = true;
    const path = base + '/' + encodeURIComponent(form.dataset.orderStatus);
    try {
      await request(path + '/status', { method: 'PATCH', body: JSON.stringify({ status: form.elements.status.value }) });
      void loadList();
      if (form.isConnected && dialog.open) await openOrder(form.dataset.orderStatus);
    } catch (error) {
      form.querySelector('[data-order-message]').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  window.PSLOrderAdmin = { list, statusLabels };
})();
