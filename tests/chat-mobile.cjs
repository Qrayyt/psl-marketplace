const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of [390,337]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('psl_cookie_notice_v1','2026-11-18');
   const messages=Array.from({length:60},(_,i)=>({role:i%2?'assistant':'user',text:i%2?'Описание материала '+i:'Запрос '+i,...(i%2?{blocks:[{type:'products',ids:['wiron']}]}:{})}));
   localStorage.setItem('psl_assistant_chats_v1',JSON.stringify([{id:'long',title:'Длинная история',messages},{id:'other',title:'Другой чат',messages:[{role:'assistant',text:'Другой диалог'}]}]));
  });
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:[]})});
   const file=path.join(root,'frontend',decodeURIComponent(url.pathname));
   return route.fulfill({status:fs.existsSync(file)?200:404,contentType:types[path.extname(file)]||'application/octet-stream',body:fs.existsSync(file)?fs.readFileSync(file):'not found'});
  });
  await page.goto('https://psl.test/ai-chat.html');await page.waitForFunction(()=>window.PSLChatBlocks);
  await page.locator('.open-sidebar').tap();await page.locator('[data-chat="long"]').tap();
  await page.waitForFunction(()=>{const e=document.querySelector('#conversation');return e.scrollHeight-e.scrollTop-e.clientHeight<3;});
  assert(await page.locator('#conversation').evaluate(e=>e.scrollHeight>e.clientHeight*2));
  for(const selector of ['#message','.history-search input'])assert.equal(await page.locator(selector).evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert(!(await page.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable=no'));
  await page.evaluate(()=>{window.__oldNode=document.querySelector('.thread article');window.PSL_PRODUCTS_READY=new Promise(resolve=>window.__resolveProducts=resolve);});
  await page.locator('#message').tap();
  await page.locator('#message').fill('Покажи WIRON');await page.locator('.send').tap();
  assert(await page.locator('#message').evaluate(e=>document.activeElement===e),'send must keep composer focus');
  assert(await page.evaluate(()=>window.__oldNode===document.querySelector('.thread article')),'existing messages must retain DOM identity');
  await page.evaluate(()=>{const e=document.querySelector('#conversation');e.dispatchEvent(new WheelEvent('wheel',{deltaY:-300}));e.scrollTop=120;});
  await page.waitForTimeout(80);await page.evaluate(()=>window.__resolveProducts());await page.waitForFunction(()=>!document.querySelector('.pending'));
  assert(Math.abs(await page.locator('#conversation').evaluate(e=>e.scrollTop)-120)<4,'incoming answer must not pull a reader to bottom');
  await page.locator('.jump').tap();await page.waitForFunction(()=>{const e=document.querySelector('#conversation');return e.scrollHeight-e.scrollTop-e.clientHeight<3;});
  // Simulate a visual viewport keyboard without changing the layout viewport (Safari model).
  await page.locator('#message').tap();
  await page.evaluate(()=>{
   window.__height=480;window.__top=12;window.__scale=1;
   Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.__height});
   Object.defineProperty(visualViewport,'offsetTop',{configurable:true,get:()=>window.__top});
   Object.defineProperty(visualViewport,'scale',{configurable:true,get:()=>window.__scale});
   visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(()=>document.body.classList.contains('psl-keyboard-open'));
  const composer=await page.locator('.composer').boundingBox(),shell=await page.locator('.workspace').boundingBox();
  assert.equal(Math.round(shell.height),480);assert.equal(Math.round(shell.y),12);assert(composer.y+composer.height<=492);
  assert.equal(await page.locator('.psl-site-nav').isVisible(),false);
  await page.locator('#message').evaluate(e=>e.blur());await page.waitForTimeout(60);assert.equal(await page.locator('.psl-site-nav').isVisible(),false,'dock must stay hidden until keyboard animation ends');
  await page.evaluate(()=>{window.__height=844;window.__top=0;visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>!document.body.classList.contains('psl-keyboard-open'));
  assert(await page.locator('.psl-site-nav').isVisible());
  assert(await page.evaluate(()=>scrollY===0 && document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#conversation').evaluate(e=>getComputedStyle(e).overflowY),'auto');
  // Preserve a reading position when navigating between chats.
  await page.evaluate(()=>{const e=document.querySelector('#conversation');e.dispatchEvent(new WheelEvent('wheel',{deltaY:-300}));e.scrollTop=180;});await page.waitForTimeout(80);
  await page.locator('.open-sidebar').tap();assert(await page.locator('.workspace').evaluate(e=>e.inert));
  await page.locator('[data-chat="other"]').tap();await page.locator('.open-sidebar').tap();await page.locator('[data-chat="long"]').tap();
  assert(Math.abs(await page.locator('#conversation').evaluate(e=>e.scrollTop)-180)<4,'history navigation must restore reading position');
  assert.deepEqual(errors,[]);
  console.log('PASS mobile '+width+'px: stable messages, history position, no auto-follow while reading, focus, keyboard bounds/dismissal and scroll isolation');
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
