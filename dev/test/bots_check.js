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
for(let i=0;i<2000;i++){
  const mk=()=>{const n=R(11,100000),lo=R(1,50);return{lo,hi:lo+n-1}};
  const fv=mk(),ov=Math.random()<.2?{lo:fv.lo,hi:fv.hi}:mk();
  for(const dir of ['h','l']){
    const mnF=dir==='h'?fv.lo:fv.lo+1,mxF=dir==='h'?fv.hi-1:fv.hi,x=R(mnF,mxF);
    const xo=ctx.spreadX(x,fv,ov,dir),mn=dir==='h'?ov.lo:ov.lo+1,mx=dir==='h'?ov.hi-1:ov.hi;
    if(!Number.isInteger(xo)||xo<mn||xo>mx)fail('spreadX bounds '+xo+JSON.stringify([x,fv,ov,dir]));
    if(ctx.spreadX(x,fv,fv,dir)!==x)fail('spreadX identity '+x+JSON.stringify(fv)+dir);
  }
}
{const a=ctx.spreadX(500,{lo:1,hi:1000},{lo:1,hi:100},'h'),b=ctx.spreadX(500,{lo:1,hi:1000},{lo:1001,hi:1100},'h');
 if(a!==50||b!==1050)fail('spreadX relative '+a+' '+b)}
console.log('PASS bots');
