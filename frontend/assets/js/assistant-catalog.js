/* Local preview adapter. Replace reply() with a server call returning the same message schema.
 * Blocks: products {ids}, comparison {ids}, floor {ids}. No model-authored HTML/JS is executed.
 */
(function(){
  'use strict';
  const normalize=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const all=()=>Array.isArray(window.PRODUCTS)?window.PRODUCTS:[];
  function find(text){
    const q=normalize(text),tokens=q.split(' ').filter(t=>t.length>2&&!['покажи','материалы','материал','найти','нужен','нужна','подбери','хочу','мне','для','про','что','как','это','такое','расскажи','товар','сравни','сравнить','или'].includes(t));
    return all().map(p=>{const name=normalize(p.name),hay=normalize([p.name,p.brand,p.category,p.description,...(p.tags||[])].join(' '));let score=0;
      if(q===name)score+=60;
      if(name.length>4&&q.includes(name))score+=30;
      tokens.forEach(t=>{if(name.includes(t))score+=8;else if(hay.includes(t))score+=3;else if(t.length>4&&hay.includes(t.slice(0,-2)))score+=1;});
      return {p,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.p);
  }
  function reply(text,previous=[]){
    const q=normalize(text),isCompare=/сравн|отлич|разниц/.test(q),isFloor=/схем|сло[йяие]|пирог/.test(q);let found=find(text);
    if(!found.length&&/подробнее|этот|него|нем|первый/.test(q)){const last=[...previous].reverse().find(m=>m.role==='assistant'&&m.blocks?.some(b=>b.ids?.length));const id=last?.blocks.find(b=>b.ids?.length)?.ids[0];found=all().filter(p=>(p.id===id||p.catalogSlug===id));}
    if(isFloor){const ids=['matrix-hex','fixtile-se','dolotex-gls100'].filter(id=>all().some(p=>(p.id===id||p.catalogSlug===id)));return {text:'Вот иллюстрация слоёв плиточного пола. Нажмите на слой или материал рядом — откроется его страница в каталоге.\n\nЭто демонстрация визуального ответа, а не готовая спецификация: совместимость материалов и состав системы должен подтвердить специалист PSL.',blocks:[{type:'floor',ids}],followups:['Сравни форматы плитки MATRIX','Покажи FIXTILE SE']};}
    if(/достав|оплат|заказ|налич|цен|стоим/.test(q)&&!isCompare){const matches=found.slice(0,3),prices=matches.filter(p=>Number(p.price)>0).map(p=>p.name+' — '+new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(p.price));return {text:(prices.length?prices.join('\n')+'\n\n':'')+'Опубликованные цены указаны в каталоге. Наличие и условия поставки можно уточнить у менеджера PSL.'+(matches.length?'':' Напишите название или категорию материала — покажу карточку.'),blocks:matches.length?[{type:'products',ids:matches.map(p=>p.id)}]:[],followups:['Покажи защитные покрытия','Покажи промышленную плитку']};}
    if(isCompare){if(found.length<2)return {text:'Для сравнения нужны два материала. Например: «Сравни MATRIX HEX и MATRIX Квадрат» или «Сравни FIXTILE SE и FIXTILE ELS700».',blocks:[],followups:['Сравни MATRIX HEX и MATRIX Квадрат','Сравни FIXTILE SE и FIXTILE ELS700']};
      const ids=found.slice(0,2).map(p=>p.id);return {text:'Собрал сравнение по данным каталога. Размеры и описание — из карточек материалов; расход, совместимость и условия применения нужно сверить с технической документацией.',blocks:[{type:'comparison',ids}],followups:['Покажи схему слоёв промышленного пола','Расскажи подробнее о первом материале']};}
    if(found.length){const direct=found.filter(p=>normalize(p.name).length>4&&q.includes(normalize(p.name))),chosen=direct.length===1?direct:found.slice(0,3);return {text:chosen.length===1?chosen[0].description+'\n\nНиже карточка материала. В ней можно посмотреть цену и подробности.':'Нашёл материалы по вашему запросу. Откройте карточку, чтобы посмотреть описание и доступную документацию.',blocks:[{type:'products',ids:chosen.map(p=>p.id)}],followups:chosen.some(p=>p.category==='Промышленная плитка')?['Сравни MATRIX HEX и MATRIX Квадрат','Покажи схему слоёв промышленного пола']:['Покажи промышленную плитку','Покажи гидроизоляцию SILFLEX']};}
    return {text:/привет|здравств|умеешь|помощ/.test(q)?'Привет! Здесь можно найти материал PSL, сравнить товары или посмотреть демонстрационную схему слоёв. Карточки и схемы открываются прямо в чате.\n\nСейчас это предпросмотр: ответы формируются поиском по каталогу, без подключения ИИ-модели.':'В текущем каталоге не нашёл точного совпадения. Попробуйте название бренда — WIRON, FIXTILE, SILFLEX, DOLOTEX — или категорию материала.\n\nСвободные вопросы пока не обрабатываются ИИ: сейчас работает поиск по каталогу и предпросмотр визуальных ответов.',blocks:[],followups:['Покажи материалы для защиты бетона','Сравни MATRIX HEX и MATRIX Квадрат','Покажи схему слоёв промышленного пола']};
  }
  window.PSLChatCatalog=Object.freeze({reply,find,normalize});
})();
