const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const script=fs.readFileSync('frontend/assets/js/privacy-ui.js','utf8');
function setup(html='<body></body>'){
 const dom=new JSDOM(html,{url:'https://store.polymer-system.ru/',runScripts:'outside-only'});
 return dom.window;
}
let w=setup();w.eval(script);
assert.equal(w.document.querySelectorAll('.psl-cookie-notice').length,1);
assert.equal(w.document.querySelectorAll('.psl-legal-links a').length,3);
assert(!w.document.querySelector('.psl-cookie-notice').textContent.includes('Принимаю'));
w.document.querySelector('.psl-cookie-notice button').click();assert(!w.document.querySelector('.psl-cookie-notice'));assert.equal(w.localStorage.getItem('psl_cookie_notice_v1'),'2026-11-18');
w.document.querySelector('.psl-legal-links').remove();w.eval(script);assert(!w.document.querySelector('.psl-cookie-notice'));
w=setup('<body><div class="composer-wrap"></div><button data-cookie-notice>Повторить</button></body>');w.localStorage.setItem('psl_cookie_notice_v1','2026-11-18');w.eval(script);assert(w.document.querySelector('.composer-wrap .psl-legal-links'));assert(!w.document.querySelector('.psl-cookie-notice'));w.document.querySelector('[data-cookie-notice]').click();assert(w.document.querySelector('.psl-cookie-notice'));
w=setup();Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});w.eval(script);w.document.querySelector('.psl-cookie-notice button').click();assert(!w.document.querySelector('.psl-cookie-notice'));
console.log('PASS technical-cookie notice, persistence, document links, reopening and blocked storage');
