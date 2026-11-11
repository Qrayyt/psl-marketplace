/* Local catalog responses use the same message format as the future model. */
(function(){
  'use strict';
  const normalize = value => String(value || '').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const all = () => Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const money = new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',maximumFractionDigits:2});
  const floorPrompt = 'Покажи схему слоёв промышленного пола';
  const comparePrompt = 'Сравни MATRIX HEX и MATRIX Квадрат';
  const searchPrompts = ['Покажи защитные покрытия', 'Покажи промышленную плитку'];
  const stop = new Set('покажи материалы материал найти нужен нужна подбери хочу мне для про что как это такое расскажи товар сравни сравнить или'.split(' '));

  function find(text){
    const q = normalize(text);
    const tokens = q.split(' ').filter(token => token.length > 2 && !stop.has(token));
    return all().map(product => {
      const name = normalize(product.name);
      const hay = normalize([product.name,product.brand,product.category,product.description,...(product.tags || [])].join(' '));
      let score = q === name ? 60 : 0;
      if (name.length > 4 && q.includes(name)) score += 30;
      for (const token of tokens) {
        if (name.includes(token)) score += 8;
        else if (hay.includes(token)) score += 3;
        else if (token.length > 4 && hay.includes(token.slice(0,-2))) score += 1;
      }
      return {product, score};
    }).filter(item => item.score > 0).sort((a,b) => b.score-a.score).map(item => item.product);
  }

  function contextProduct(previous){
    for (const message of [...previous].reverse()) {
      if (message.role !== 'assistant') continue;
      const id = message.blocks?.find(block => block.ids?.length)?.ids[0] || message.links?.[0];
      const product = all().find(item => item.id === id || item.catalogSlug === id);
      if (product) return product;
    }
  }

  function reply(text, previous = []){
    const q = normalize(text);
    const compare = /сравн|отлич|разниц/.test(q);
    const floor = /схем|сло[йяие]|пирог/.test(q) && /(?:^| )пол[ауые]?(?: |$)|плит/.test(q);
    let found = find(text);
    if (!found.length && /подробнее|этот|него|нем|первый/.test(q)) {
      const product = contextProduct(previous);
      if (product) found = [product];
    }
    if (floor) {
      const ids = ['matrix-hex','fixtile-se','dolotex-gls100'].filter(id => all().some(p => p.id === id || p.catalogSlug === id));
      return {
        text: '### Пример слоёв плиточного пола\n\n1. Промышленная плитка\n2. Клеевой слой\n3. Грунтовка\n4. Бетонное основание\n\n> Схема условная. Совместимость, расход и толщины нужно сверить по техкартам и подтвердить у специалиста PSL.',
        blocks: ids.length === 3 ? [{type:'floor',ids}] : [],
        followups: [comparePrompt,'Покажи FIXTILE SE'],
      };
    }
    if (/достав|оплат|заказ|налич|цен|стоим/.test(q) && !compare) {
      const matches = found.slice(0,3);
      const prices = matches.map(p => '- **' + p.name + '** — ' + (Number(p.price)>0 ? money.format(p.price) : 'цена не опубликована'));
      return {
        text: (prices.length ? '### Цены в каталоге\n\n'+prices.join('\n')+'\n\n' : 'Напишите название или категорию материала.\n\n') +
          '> Наличие, доставку и условия оплаты можно уточнить у менеджера PSL.',
        blocks: matches.length ? [{type:'products',ids:matches.map(p=>p.id)}] : [],
        followups: searchPrompts,
      };
    }
    if (compare) {
      if (found.length < 2) return {text:'Какие два материала сравнить? Можно указать названия или артикулы.',blocks:[],followups:[comparePrompt,'Сравни FIXTILE SE и FIXTILE ELS700']};
      return {
        text:'Сравнение составлено по карточкам каталога PSL.\n\n> Для выбора системы проверьте расход, совместимость и условия применения по техкартам.',
        blocks:[{type:'comparison',ids:found.slice(0,2).map(p=>p.id)}],
        followups:[floorPrompt,'Расскажи подробнее о первом материале'],
      };
    }
    if (found.length) {
      const direct = found.filter(p => normalize(p.name).length > 4 && q.includes(normalize(p.name)));
      const chosen = direct.length === 1 ? direct : found.slice(0,3);
      const item = chosen[0];
      return {
        text: chosen.length === 1
          ? ['### ' + item.name, item.description || '', item.category && item.category !== 'Без категории' ? '**Категория:** ' + item.category : '', item.sizes?.length ? '**Форматы / фасовки:** ' + item.sizes.join(', ') : ''].filter(Boolean).join('\n\n')
          : 'Нашёл несколько совпадений в каталоге PSL. Откройте карточку, чтобы посмотреть описание, цену и доступные документы.',
        blocks:[{type:'products',ids:chosen.map(p=>p.id)}],
        followups:chosen.some(p=>p.category==='Промышленная плитка') ? [comparePrompt,floorPrompt] : ['Покажи промышленную плитку','Покажи гидроизоляцию SILFLEX'],
      };
    }
    return {
      text:/привет|здравств|умеешь|помощ/.test(q)
        ? 'Я **Guardex**, помощник по каталогу PSL.\n\n- Найду карточку материала.\n- Сравню две позиции по данным каталога.\n- Покажу условную схему плиточного пола.\n\nКакой материал или задачу вы рассматриваете?'
        : 'В каталоге **не нашёл точного совпадения**. Укажите название, бренд или тип материала. Например, «гидроизоляция SILFLEX».',
      blocks:[],followups:['Покажи материалы для защиты бетона',comparePrompt,floorPrompt],
    };
  }

  window.PSLChatCatalog = Object.freeze({reply,find,normalize});
})();
