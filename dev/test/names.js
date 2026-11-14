// Nickname filter check: loads src/names.js on its own and runs blocked/allowed cases.
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../src/names.js'),'utf8');
const {nameOK,safeName}=new Function(src+';return{nameOK,safeName}')();
let n=0;const fails=[];
const t=(label,got,want)=>{n++;if(got!==want)fails.push(label+' got '+got+' want '+want)};
// strict (public Play)
const BLOCK=['fuck','FUCK','fuuuck','f u c k','f.u.c.k','f_u-c_k','fvck'.replace('v','u'),'fück','Shit','sh1t','$hit','5h1t','b!tch','Bitch','biiiitch','c u n t','cunt','n1gga','nigger','N1GG3R','f4ggot','whore','wh0re','slut','Bastard','dildo','p3n1s','pen15','vagina','rapist','Hitler','H1tl3r','retard','twat','wank','porn','PORN','pu$$y','pussy','asshole','a$$hole','dumbass','dickhead','blowjob','chink','jizz','Dick','D1ck','DICK','d i c k','Dick Van Dyke','BigDick','cock','C0ck','ass','Ass','anal','sex','sexy','nazi','Nazi','rape','kike','spic','coon','paki','cum','kys','faggot','fag','tit','tits','boobs','shemale','tranny','Fuk','fck',
 'puta','PUTA','puto','hijueputa','hijo de puta','hijodeputa','putamadre','pendejo','P3ND3J0','cabron','cabrón','mierda','M13RD4','chingada','chingar','maricon','maricón','verga','culo','pinche','joder','idiota','estúpido','imbécil','gilipollas','pelotudo','coño','sudaca',
 'admin','Admin','4dmin','Administrator','moderator','M0derator','official','Official','Mod','mods','bot','B0T','bots','staff','support','system','owner','HighAndLow','High Low',
 '12345','1234567','...','___','---','???','007','','   ','😀','💀💀','​','​​','🖕','fu​ck','f😀uck','ｆｕｃｋ','fսck'.replace('ս','u'),'fuсk'];
BLOCK.push('Asss','Boooob','Niiigger','Piiiss','c0nn'.slice(0,0)+'fuuuuck');
for(const b of BLOCK)t('block '+JSON.stringify(b),nameOK(b),false);
const ALLOW=['Bob','Con','Pis','As','Therapist','Cassie','cassie','Assassin','Hancock','Peacock','Cockburn','Dickens','Dickinson','Scunthorpe','Class','Classic','Bass','Mass','Pass','Grass','Glass','Assist','Sussex','Essex','Middlesex','Matsuko','Analise','Canal','Titan','Titus','Cumberland','Cucumber','Document','Shiitake'.replace('ii','i').slice(0,3)+'ne','Raccoon','Spice','Spicy','Therapist','Grape','Drape','Skip','Hello','Mia','Leo','Zoe','Omar','Dodgy','Bean','Pickle','Noodle','Biscuit','Waffle','Turnip','Host','Player','You','Ana','Anna','Dani','Vergara','Verga'.slice(0,4)+'ra','Pedro','Pedroza','Computadora','Compu','Putnam','Pera','Zora','Pola','Paco','Jose','José','Muñoz','Niño','Ñandú','Zoë','Chloé','Björn','Fukuda','Fukushima','Nazir','Nazia','Mikasa','Skywalker','Bot'.replace('Bot','Botany'),'Robot','Abbott','Moderna','Modest','Official1'.replace('Official1','Offal'),'Admiral','Sam 2','Mia99','xX_Gamer_Xx','CS2 Pro','Player 1','2Fast','Ryo','Юрий','Алекса','李雷','محمد','Dr. Who','J R','Big Dave','Sleepy Taco','Mr Pickle','Dan The Man','Rocky 7','Hannah','Shannon','Sixx','Cox'];
for(const a of ALLOW)t('allow '+JSON.stringify(a),nameOK(a),true);
// lite (private friends rooms): only the strong substring list
const LB=['fuck','f u c k','sh1t','n1gga','cunt','pendejo','mierda','hijueputa','p0rn'];
for(const b of LB)t('lite block '+b,nameOK(b,true),false);
const LA=['Dick','Dick Van Dyke','cock','ass','sex','puta','Admin','bot','12345','','😀','Cox','Hancock','Mod','verga','Scunthorpe'];
for(const a of LA)t('lite allow '+JSON.stringify(a),nameOK(a,true),true);
// safeName
t('safe pass',safeName('Mia'),'Mia');t('safe block',safeName('fuck'),'Bean');t('safe null',safeName(null),'Bean');t('safe undefined',safeName(undefined),'Bean');
t('safe number',safeName(12345),'Bean');t('safe lite empty',safeName('',true),'');t('safe lite dick',safeName('Dick',true),'Dick');t('safe keeps text',safeName('Cassie'),'Cassie');
t('safe obj',safeName({}),'Bean');
// the game's own generated names must never be blocked
const bl=fs.readFileSync(path.join(__dirname,'../src/botlife.js'),'utf8');
const arr=k=>eval(bl.match(new RegExp('const '+k+'=(\\[.*?\\]);'))[1]);
const F=arr('NM_FIRST'),W=arr('NM_WORD'),P=arr('NM_PRE');let bad=[];
const cap=s=>s[0].toUpperCase()+s.slice(1);
for(const f of F){for(const w of W){for(const p of P){for(const nm of [cap(f),cap(w),cap(f)+cap(w),cap(p)+cap(w),cap(p)+cap(f),f+w,f+'_'+w,f+(7)]){if(!nameOK(nm)&&!bad.includes(nm))bad.push(nm)}}}}
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
for(const nm of eval(main.match(/const FILL_NAMES=(\[.*?\]);/)[1]).concat(eval(fs.readFileSync(path.join(__dirname,'../src/base.js'),'utf8').match(/const BOT_NAMES=(\[.*?\]);/)[1]),['Host','Player','You','Bot']))if(!nameOK(nm)&&nm!=='Bot')bad.push(nm);
n++;if(bad.length)fails.push('generated names blocked: '+bad.slice(0,15).join(','));
if(src.length>3600)fails.push('names.js too big '+src.length);
if(fails.length){console.log('FAIL names: '+fails.length+' of '+n+'\n'+fails.join('\n'))}else console.log('PASS names ('+n+' cases)');
