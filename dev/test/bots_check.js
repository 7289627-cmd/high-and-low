const fs=require('fs'),vm=require('vm');
function fail(w){console.log('FAIL bots: '+w);process.exit(1)}
let store={};
const ctx={document:{body:{classList:{toggle(){}}}},LS:{get:k=>k in store?store[k]:null,set:(k,v)=>{store[k]=v}},LSK:k=>k,PID:'me'};
ctx.window=ctx;vm.createContext(ctx);
try{vm.runInContext(fs.readFileSync(__dirname+'/../src/showdown.js','utf8'),ctx)}catch(e){fail('load '+e.message)}
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
let sum={lo:0,hi:0};
for(const sk of [0.15,0.95]){let tot=0,cnt=0;
  for(let i=0;i<2000;i++){
    const n=R(11,100000),lo=R(1,50),t={lo,hi:lo+n-1};
    for(const dir of ['h','l']){
      const x=ctx.botSplit(t,sk,dir,Math.random(),Math.random());
      const mn=dir==='h'?t.lo:t.lo+1,mx=dir==='h'?t.hi-1:t.hi;
      if(!Number.isInteger(x)||x<mn||x>mx)fail('out of bounds '+x+' '+JSON.stringify(t)+dir);
      const below=x-t.lo+1,side=Math.max(below,n-below)/n;tot+=side;cnt++;
    }}
  sum[sk===0.15?'lo':'hi']=tot/cnt;}
if(sum.lo-sum.hi<0.2)fail('worse-side gap '+(sum.lo-sum.hi).toFixed(3));
store={};if(ctx.botSkillBase()!==0.25)fail('no record');
store['hl-botrec']=[1,1,1];if(Math.abs(ctx.botSkillBase()-0.86)>1e-9)fail('win streak '+ctx.botSkillBase());
store['hl-botrec']=[1,0,0];if(Math.abs(ctx.botSkillBase()-0.2)>1e-9)fail('loss streak '+ctx.botSkillBase());
store={};ctx.botRecord(true);ctx.botRecord(false);for(let i=0;i<6;i++)ctx.botRecord(true);
if(store['hl-botrec'].length!==5)fail('record length');
console.log('PASS bots');
