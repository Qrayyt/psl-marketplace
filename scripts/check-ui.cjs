'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..', 'frontend');
const pages = [
  'index.html','product.html','profile.html','auth.html','support.html','ai-chat.html',
  'privacy.html','404.html','handbook/index.html','handbook/article.html',
  'handbook/systems.html','handbook/fixtile-classic.html','handbook/fixtile-pro.html'
];
let checked=0;
for (const page of pages) {
  const html=fs.readFileSync(path.join(root,page),'utf8'),context=page+': ';
  assert.match(html,/<html[^>]+lang="ru"/i,context+'language');
  assert.match(html,/<title>[^<]+<\/title>/i,context+'title');
  assert.match(html,/design-system\.css\?v=1\.1\.0/,context+'shared styles');
  assert.equal((html.match(/class="psl-site-nav"/g)||[]).length,1,context+'one nav');
  for(const href of ['/','/handbook/','/ai-chat.html','/profile.html','/support.html'])
    assert.ok(html.includes('href="'+href+'"'),context+'missing '+href);
  assert.ok((html.match(/aria-current="page"/g)||[]).length<=1,context+'multiple active links');
  for(const match of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/gi)){
    const raw=match[1];
    if(/^(https?:|mailto:|data:|\/\/)/i.test(raw))continue;
    const pathname=raw.split(/[?#]/)[0];
    if(!pathname||pathname.startsWith('#'))continue;
    const target=pathname.startsWith('/')?path.join(root,pathname.slice(1)):path.resolve(root,path.dirname(page),pathname);
    assert.ok(fs.existsSync(target),context+'missing asset '+raw);
  }
  checked++;
}
for(const page of ['admin/index.html','admin/product.html','admin/support.html','admin/legacy.html']){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/admin-polish\.css\?v=1\.1\.0/,page+' shared admin styling');
}
const seed=fs.readFileSync(path.join(__dirname,'..','backend/prisma/seed.ts'),'utf8');
assert.match(seed,/PSL_ALLOW_DESTRUCTIVE_DEMO_SEED/,'Unsafe destructive seed');
assert.ok(!seed.includes("bcrypt.hash('admin123'"),'Known default passwords');
console.log('OK: '+checked+' public pages, 4 admin pages, local assets and safe seeding gate.');
