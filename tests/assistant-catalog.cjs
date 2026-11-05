const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({window:{}});
for(const file of ['data.js','assistant-catalog.js'])vm.runInContext(fs.readFileSync('frontend/assets/js/'+file,'utf8'),context);
const {reply}=context.window.PSLChatCatalog;
let r=reply('Покажи материалы для защиты бетона');
assert(r.blocks[0].ids.includes('wiron'));
r=reply('Сравни плитку MATRIX HEX и MATRIX Квадрат');
assert.equal(r.blocks[0].type,'comparison');
assert.deepEqual(Array.from(r.blocks[0].ids),['matrix-hex','matrix-square']);
r=reply('Сравни FIXTILE SE и FIXTILE ELS700');
assert.deepEqual(Array.from(r.blocks[0].ids),['fixtile-els700','fixtile-se']);
r=reply('Покажи схему слоёв промышленного пола');
assert.equal(r.blocks[0].type,'floor');
assert.equal(r.blocks[0].ids.length,3);
r=reply('Расскажи подробнее о первом материале',[{role:'assistant',blocks:[{type:'products',ids:['wiron']}]}]);
assert.equal(r.blocks[0].ids[0],'wiron');
r=reply('Какая цена WIRON?');
assert(r.text.includes('уточнить'));
assert(!/\d+\s*₽/.test(r.text));
r=reply('<script>alert(1)</script>');
assert.equal(r.blocks.length,0);
assert(r.text.includes('не нашёл'));
for(const query of ['Покажи WIRON','Покажи гидроизоляцию SILFLEX','Сравни форматы плитки MATRIX','Покажи защитные покрытия']){
 const answer=reply(query);
 for(const b of answer.blocks)for(const id of b.ids)assert(context.window.PRODUCTS.some(p=>p.id===id));
}
console.log('PASS: catalog matching, requested comparisons, visual schema, contextual follow-up, no invented prices or unknown products.');
