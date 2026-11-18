// Controller/route integration checks with transactional storage doubles; no production data used.
const assert=require('node:assert/strict'),path=require('node:path');
const dist=path.resolve('backend/dist');
function mock(file,exports){const filename=path.join(dist,file+'.js');require.cache[filename]={id:filename,filename,loaded:true,exports};}
let state,failAudit=false,transactions=0,summaries=0;
function reset(){state={users:[],orders:[],cases:[],audits:[]};failAudit=false;transactions=0;summaries=0;}
const uuid='8f450ab0-a329-4c39-b865-df40c27c6180';
const prisma={user:{findUnique:async()=>null},supportCase:{findUnique:async()=>null},
 async $transaction(fn){transactions++;const draft=structuredClone(state);
  const tx={
   $queryRaw:async()=>[],
   user:{create:async({data})=>{const u={...data,id:uuid,role:'USER'};draft.users.push(u);return u;},findUniqueOrThrow:async()=>({name:'Test',email:'test@example.com',phone:'+79990000000',isBlocked:false})},
   auditLog:{create:async({data})=>{if(failAudit)throw Error('audit unavailable');draft.audits.push(data);return data;}},
   cartItem:{findMany:async()=>[{id:uuid,size:'S',quantity:1,productId:uuid,product:{isActive:true,price:100}}],deleteMany:async()=>({count:1})},
   order:{create:async({data})=>{const o={...data,id:uuid,contactEmail:null};draft.orders.push(o);return o;}},
   supportCase:{create:async({data})=>{draft.cases.push(data);return data;}},
  };
  const result=await fn(tx);state=draft;return result;
 }};
mock('config/db',{prisma});mock('config/env',{env:{smtp:{host:''}}});
mock('jobs/email.queue',{enqueueEmail:async()=>{}});
mock('services/token.service',{generateAccessToken:()=> 'access',generateRefreshToken:()=> 'refresh',storeRefreshToken:async()=>{}});
mock('services/audit.service',{logAudit:async()=>{}});
mock('middleware/auth',{authenticate:(_req,_res,next)=>next()});
mock('services/support-context.service',{summarizeSupport:async()=>{assert(state.cases.length&&state.audits.length,'consent must be committed before summary processing');summaries++;return {text:'Summary',generated:false};},suggestSupportNote:async()=>null});
const {register}=require(path.join(dist,'controllers/auth.controller.js'));
const {createOrder}=require(path.join(dist,'controllers/orders.controller.js'));
const router=require(path.join(dist,'routes/support.routes.js')).default;
const support=router.stack.find(layer=>layer.route?.path==='/cases'&&layer.route.methods.post).route.stack[0].handle;
const {CONSENT_VERSION,consentProof}=require(path.join(dist,'services/consent.service.js'));
function invoke(handler,body){return new Promise((resolve,reject)=>{
 const req={body,user:{id:uuid,role:'USER'},ip:'127.0.0.1'};
 const res={status(code){this.code=code;return this;},json(data){resolve({code:this.code,data});return this;}};
 Promise.resolve(handler(req,res,error=>reject(error||Error('Unexpected next')))).catch(reject);
});}
const inputs={registration:{email:'test@example.com',name:'Test',password:'strong-test-password'},order:{},support:{id:uuid,messages:[]}};
(async()=>{
 for(const [purpose,handler] of [['registration',register],['order',createOrder],['support',support]]){
  for(const consent of [undefined,{accepted:false,version:CONSENT_VERSION,purpose},{accepted:true,version:'old',purpose},{accepted:true,version:CONSENT_VERSION,purpose:'wrong'}]){
   reset();await assert.rejects(invoke(handler,{...inputs[purpose],consent}));assert.equal(transactions,0);assert.equal(state.audits.length,0);
  }
  reset();const consent={accepted:true,version:CONSENT_VERSION,purpose,sha256:'forged',acceptedAt:'2000-01-01'};
  await invoke(handler,{...inputs[purpose],consent});assert.equal(state.audits.length,1);
  assert.deepEqual(state.audits[0].details.consent,consentProof(purpose));assert.equal(state.audits[0].details.consent.acceptedAt,undefined);
  const entity=purpose==='registration'?'users':purpose==='order'?'orders':'cases';assert.equal(state[entity].length,1);
  reset();failAudit=true;await assert.rejects(invoke(handler,{...inputs[purpose],consent}),/audit unavailable/);assert.equal(state[entity].length,0);assert.equal(state.audits.length,0);assert.equal(summaries,0);
  console.log('PASS '+purpose+': required consent, version/purpose checks, server proof and transactional rollback');
 }
})().catch(e=>{console.error(e);process.exit(1)});
