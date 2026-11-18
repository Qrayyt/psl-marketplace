const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),version='2026-11-18-v1';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});let posts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.startsWith('/api/')){
   if(route.request().method()==='POST'){posts.push({url:u.pathname,body:route.request().postDataJSON()});return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({success:false,error:{message:'Test response'}})});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname==='/api/products/all'?[]:{success:true,data:[]})});
  }
  const f=path.join(root,'frontend',decodeURIComponent(u.pathname));
  return route.fulfill({status:fs.existsSync(f)?200:404,contentType:mime[path.extname(f)]||'application/octet-stream',body:fs.existsSync(f)?fs.readFileSync(f):'not found'});
 });
 await page.goto('https://psl.test/auth.html?mode=register');await page.locator('.psl-cookie-notice button').click();
 await page.locator('[data-login-form]').evaluate(f=>{
  for(const [name,value] of Object.entries({name:'Test',email:'test@example.com',password:'strong-test-password',confirm:'strong-test-password'})){f.elements.namedItem(name).value=value;}
 });
 assert.equal(await page.locator('[name=consent]').isChecked(),false);
 assert.equal(await page.locator('.auth-consent a').first().getAttribute('href'),'/consent.html#registration');
 await page.locator('[data-login-form]').evaluate(f=>f.requestSubmit());assert.equal(posts.length,0);
 await page.locator('[name=consent]').check();await page.locator('[data-login-form]').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>document.querySelector('.form-status').dataset.error==='true');
 assert.deepEqual(posts.at(-1).body.consent,{accepted:true,version,purpose:'registration'});
 await page.addInitScript(()=>{sessionStorage.setItem('psl_access_token','test-token');sessionStorage.setItem('psl_user',JSON.stringify({id:'8f450ab0-a329-4c39-b865-df40c27c6180',name:'Test',email:'test@example.com',role:'USER'}));});
 await page.goto('https://psl.test/ai-chat.html');await page.locator('[data-handoff]').click();
 assert.equal(await page.locator('[data-handoff-form] [name=consent]').isChecked(),false);const before=posts.length;
 await page.locator('[data-handoff-form]').evaluate(f=>f.requestSubmit());assert.equal(posts.length,before);
 await page.locator('[data-handoff-form] [name=consent]').check();await page.locator('[data-handoff-form]').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>document.querySelector('[data-handoff-status]').textContent==='Test response');
 assert.deepEqual(posts.at(-1).body.consent,{accepted:true,version,purpose:'support'});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS signup and handoff: unchecked inputs, independent links, blocked unchecked submit and explicit purpose/version payloads');
})().catch(e=>{console.error(e);process.exit(1)});
