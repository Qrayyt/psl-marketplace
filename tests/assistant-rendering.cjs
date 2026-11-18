const {JSDOM}=require('jsdom');const fs=require('fs');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://store.polymer-system.ru/ai-chat.html',runScripts:'outside-only'});
for(const f of ['assets/vendor/marked.umd.js','assets/vendor/purify.min.js','assets/js/data.js','assets/js/assistant-format.js','assets/js/assistant-blocks.js'])dom.window.eval(fs.readFileSync('frontend/'+f,'utf8'));
const assert=require('assert/strict'),w=dom.window;
let html=w.PSLChatFormat.render('## Заголовок\n\n**Текст** и [каталог](/)\n\n| Материал | Цена |\n|---|---:|\n| WIRON | 100 |\n\n```js\nconst a = "<script>";\n```\n\n- Один\n  - Два\n\n> Заметка');
w.document.body.innerHTML=html;
assert.equal(w.document.querySelector('h2').textContent,'Заголовок');assert(w.document.querySelector('.markdown-table table'));assert(w.document.querySelector('[data-copy-code]'));assert(w.document.querySelector('ul ul'));assert(w.document.querySelector('a').href==='https://store.polymer-system.ru/');
w.document.body.innerHTML=w.PSLChatFormat.render('<img src=x onerror=alert(1)>\n\n[вредно](javascript:alert(1))');assert(!w.document.querySelector('img,script,[onerror],a[href^="javascript:"]'));
w.document.body.innerHTML=w.PSLChatBlocks.render([{type:'products',ids:['wiron','matrix-hex']},{type:'callout',title:'Важно',text:'**Сверьте** техкарту'},{type:'markdown',text:'### Произвольный блок'},{type:'table',columns:['Имя','Описание'],rows:[['<img onerror=x>','Безопасно']]},{type:'details',title:'Подробнее',text:'Текст'},{type:'new-future-format',text:'**Новый формат**'},{type:'links',items:[{url:'javascript:alert(1)',title:'X'}]}]);
assert.equal(w.document.querySelectorAll('.material-card').length,2);assert(w.document.querySelector('.material-info strong').textContent==='WIRON');assert(w.document.querySelector('.answer-callout strong'));assert(w.document.querySelector('details'));assert(w.document.body.textContent.includes('Новый формат'));assert(!w.document.querySelector('[onerror],img:not([loading]),a[href^="javascript:"]'));assert(w.document.body.textContent.includes('<img onerror=x>'));
w.PSLChatBlocks.register('custom',()=>'<section><script>bad()</script><p>Дополнение</p></section>');w.document.body.innerHTML=w.PSLChatBlocks.render([{type:'custom'}]);assert(!w.document.querySelector('script'));assert(w.document.body.textContent.includes('Дополнение'));
console.log('PASS Markdown, nested lists, tables, code tools, URLs, HTML escaping, product cards, custom blocks and sanitization');

// Unknown IDs never produce invented products or prices.
w.document.body.innerHTML=w.PSLChatBlocks.render([{type:'products',ids:['not-a-product']}]);
assert.equal(w.document.querySelectorAll('.material-card').length,0);
// Code blocks retain literal malicious-looking markup for copying.
w.document.body.innerHTML=w.PSLChatFormat.render('```html\n<img src=x onerror=alert(1)>\n```');
assert.equal(w.document.querySelector('code').textContent.trim(),'<img src=x onerror=alert(1)>');
assert.equal(w.document.querySelectorAll('img').length,0);
