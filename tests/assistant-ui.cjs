const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),ctx={window:{}};vm.runInNewContext(fs.readFileSync('frontend/assets/js/data.js','utf8'),ctx);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox']});
 for(const width of [1440,390,337]){
 const page=await browser.newPage({viewport:{width,height:width>760?1000:844}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')){await route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname==='/api/products/all'?ctx.window.PRODUCTS:{success:true,data:[]})});return;}const name=path.join(root,'frontend',decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(fs.existsSync(name)&&fs.statSync(name).isFile())await route.fulfill({contentType:types[path.extname(name)]||'application/octet-stream',body:fs.readFileSync(name)});else await route.fulfill({status:404,body:'not found'});});
 await page.goto('https://psl.test/ai-chat.html');await page.waitForFunction(()=>window.PSLChatBlocks && !document.querySelector('.welcome').hidden);await page.locator('.psl-cookie-notice button').click();
 await page.locator('#message').fill('Покажи WIRON');await page.locator('.send').click();await page.locator('.material-card').first().waitFor();
 assert.equal(await page.locator('.material-card').count(),1);assert(await page.locator('.material-info strong').textContent()==='WIRON');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(width<761){const nav=await page.locator('.psl-site-nav').boundingBox(),composer=await page.locator('.composer').boundingBox();assert(composer.y+composer.height<=nav.y,JSON.stringify({nav,composer}));assert.equal(await page.locator('.psl-nav-guardex').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 23, 23)');}

 await page.locator('#message').fill('Сравни плитку MATRIX HEX и MATRIX Квадрат');await page.locator('.send').click();await page.locator('.compare-table').waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#message').fill('Покажи схему слоёв промышленного пола');await page.locator('.send').click();await page.locator('.floor-visual svg').waitFor();
 assert(await page.locator('.floor-visual svg a').count()===3);
 await page.evaluate(()=>{
   window.__copied=''; navigator.clipboard.writeText=async text=>{window.__copied=text;};
   document.querySelector('.thread').insertAdjacentHTML('beforeend','<article class="message"><div class="answer-text">'+PSLChatFormat.render('```js\nconst safe = true;\n```')+'</div></article>');
 });
 await page.locator('[data-copy-code]').click();assert.equal(await page.evaluate(()=>window.__copied),'const safe = true;\n');
 assert.deepEqual(errors,[]);console.log('PASS browser '+width+'px: real chat, product, comparison, floor, overflow, dock and composer');await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
