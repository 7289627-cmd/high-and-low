import json,subprocess,pathlib,re
H=pathlib.Path('/home/claude/hl');st=json.load(open(H/'tools/lab_stats.json'));lib={x['f']:x for x in json.load(open(H/'site/lab/index.json'))}
PICK={
 'k_clang':('kenney-rpg/metalPot3','Deep metal clang: anvil, piano and calculator impacts'),
 'k_ring':('rd-everyday/bell_01','Bell ring after a clang, dinner bell, ghost ding'),
 'k_slam':('rd-wood-metal/metal_slam_01','Hard metal slam layered under impacts'),
 'k_rattle':('rd-wood-metal/metal_falling_02','Metal rattling to a stop after the anvil lands'),
 'k_fall':('slide-whistle/Fast_Drop','Slide whistle dropping as something falls'),
 'k_falllong':('slide-whistle/Tone_Drop_Fast','Longer slide whistle drop, falling down the hole'),
 'k_rise':('slide-whistle/Fast_Rise','Slide whistle rising: banana slip, rocket launch'),
 'k_riseq':('slide-whistle/Quick_Rise_2','Quick slide whistle up: flag pops out'),
 'k_wobble':('slide-whistle/Wobble_Fall','Wobbly slide whistle as the bean melts'),
 'k_womp':('slide-whistle/Wobble_Drop','Sad wobbling drop at the end of every death'),
 'k_boing':('rd-everyday/spring_07','Short spring boing'),
 'k_boing2':('rd-everyday/spring_02','Long wobbling spring'),
 'k_yelp':('rd-creatures/cute_04','The bean yelps when it sees what is coming'),
 'k_ouch':('rd-creatures/hurt_01','The bean getting stung'),
 'k_eat1':('rd-creatures/eat_01','Monster chomp 1'),'k_eat2':('rd-creatures/eat_02','Monster chomp 2'),'k_eat3':('rd-creatures/eat_04','Monster chomp 3'),
 'k_burp':('rd-creatures/burp_01','Monster burp'),
 'k_boom':('rd-bangs/bang_03','Low boom: thunder rumble, stage going dark'),
 'k_crack':('rd-bangs/bang_07','Thunder crack on the lightning strike'),
 'k_explode':('rd-bangs/bang_06','Firework explosion'),
 'k_launch':('rd-bangs/fw_06','Rocket launch'),
 'k_crackle':('rd-bangs/fw_04','Firework crackle after the burst'),
 'k_popbang':('rd-bangs/shot_02','Sharp bang when the bean pops'),
 'k_zap':('kenney-digital/zap1','Electric zap'),
 'k_splash':('rd-water-slime/splash_08','Wet splash as the puddle forms'),
 'k_gloop':('rd-water-slime/slime_15','Gloop'),'k_gloop2':('rd-water-slime/slime_09','Slow drip gloop'),
 'k_bubble':('rd-water-slime/bubble_01','Puddle bubble'),
 'k_plop':('rd-everyday/plop_02','Small plop: things landing, flag planting'),
 'k_squeak':('rd-wood-metal/wood_squeak_02','Squeak: rope tug, pump strokes'),
 'k_woodbreak':('rd-wood-metal/wood_breaking_01','Wood smashing under the piano'),
 'k_glass':('rd-break-fall-hit/bfh1_glass_breaking_06','Tinkling debris after the piano'),
 'k_crunch':('rd-wood-metal/wood_breaking_02','Crunch under the calculator'),
 'k_bug':('rd-creatures/bug_04','Angry bee'),'k_bug2':('rd-creatures2/bug_10','Second angry bee'),
 'k_paper':('rd-everyday/paper_02','Receipt printing'),
 'k_woosh':('wooshes/Classic_Swish_3','Swish: banana toss, skin fluttering down'),
}
rows=json.load(open(H/'tools/sound_rows.json'));known={r['k'] for r in rows};maplines=[]
for k,(src,desc) in PICK.items():
    f='lab/'+src+'.mp3';assert f in st,f
    gain=max(0,min(18,-1.5-st[f]['peak']))
    subprocess.run(['ffmpeg','-nostdin','-y','-loglevel','error','-i',str(H/'site'/f),'-af',f'volume={gain:.1f}dB','-ac','1','-b:a','96k',str(H/'site/sfx'/(k+'.mp3'))],stdin=subprocess.DEVNULL,check=True)
    if k not in known:rows.append({'g':'Deaths','k':k,'d':desc})
    maplines.append(f"{k:10}{lib[f]['src']}")
json.dump(rows,open(H/'tools/sound_rows.json','w'),indent=1)
m=(H/'sounds-src/map.txt').read_text()
m=''.join(l+'\n' for l in m.splitlines() if not l.startswith('k_'))+'\n'.join(maplines)+'\n'
(H/'sounds-src/map.txt').write_text(m)
p=H/'src/sound.js';s=p.read_text()
keys=re.search(r"KEYS:\[(.*?)\]",s).group(1)
have=[x.strip("'") for x in keys.split(',')]
new=[k for k in PICK if k not in have]
s=s.replace(keys,keys+''.join(",'"+k+"'" for k in new));p.write_text(s)
p=H/'src/base.js';s=p.read_text()
i=s.index("const DEATH_SFX={");j=s.index("};",i)+2
s=s[:i]+'''const DEATH_SFX={
 anvil:[['k_squeak',.36,.9],['k_squeak',.62,1.1],['k_fall',.74,1],['k_yelp',.98,1.1],['k_clang',1.36,.72],['k_slam',1.36,.9],['k_ring',1.38,.6,.7],['k_rattle',1.52,1,.7],['k_boing2',1.56,.8,.6],['k_squeak',1.95,.7],['k_squeak',2.2,.75],['k_plop',2.6,1.2],['k_riseq',2.62,1.3,.6]],
 zap:[['k_boom',.55,.7,.5],['key',1.3,1.4],['k_crack',1.5,1.1],['k_zap',1.5,1],['k_yelp',1.53,1.5],['k_zap',1.66,1.25],['zap',1.74],['k_gloop',2.1,1.6,.6],['k_plop',2.7,1.5,.6]],
 rocket:[['d_fuse',.55],['d_fuse',.7,1.1],['d_fuse',.85,1.2],['d_fuse',1,1.3],['d_fuse',1.12,1.4],['k_yelp',1.28,1.2],['k_launch',1.5,1],['k_rise',1.5,.8],['k_explode',2.3,1],['k_crackle',2.38,1,.8],['d_ding',3.04,1.6,.7],['k_boing',3.3,1.3,.7],['k_plop',3.62,1]],
 chomp:[['k_boom',.3,.6,.4],['k_ring',1,1.5,.7],['k_ring',1.12,1.5,.7],['k_ring',1.24,1.5,.7],['k_yelp',1.3,1.2],['k_eat1',1.42],['k_eat2',1.72],['k_eat3',1.96],['k_burp',2.82,.9],['k_plop',3.45,1.1]],
 melt:[['k_wobble',1,.9],['k_gloop2',1.6,.8],['k_gloop',2.05,.7],['k_splash',2.1,.8,.6],['k_bubble',3,1.2],['k_bubble',3.5,1.5]],
 pop:[['k_squeak',.5,.8],['k_squeak',.8,.9],['k_squeak',1.1,1],['k_squeak',1.4,1.1],['k_squeak',1.7,1.2],['k_boing2',1.82,1.4,.7],['k_popbang',2.05,1],['pop',2.05],['k_woosh',2.5,.8],['k_plop',3,.8]],
 piano:[['hint',.15],['hint',.4,1.26],['hint',.65,1.5],['k_fall',.78,.9],['k_yelp',1.1,1],['d_piano',1.42],['k_woodbreak',1.42,.8],['k_clang',1.44,.5,.6],['k_glass',1.5,1,.5],['k_boing',1.62,1.2,.6],['k_riseq',2.08,1.2,.6],['k_plop',2.16,1.4],['k_plop',2.26,1.6]],
 banana:[['k_woosh',.9,1],['k_rise',1.18,1.3],['k_yelp',1.26,1.3],['k_slam',2.1,.8,.8],['bonk',2.1,.9],['k_falllong',2.45,1],['k_ring',2.95,1.8,.6],['k_plop',3.4,.7]],
 bees:[['bonk',.45,1.5,.6],['d_buzz',.6],['k_bug',1.3,1],['d_buzz',1.3,1.15],['k_bug2',1.5,1.2],['k_yelp',1.7,1.3],['bonk',1.95,1.6],['k_ouch',1.97,1.2],['k_boing2',2.1,.7,.7],['d_buzz',2.6,1.3]],
 calc:[['key',.6,1.2],['key',.8,1.2],['key',1,1.2],['error',1.15,1.4],['k_yelp',1.8,1.2],['d_slam',2.05],['k_crunch',2.05,.8],['k_clang',2.07,.9,.5],['k_paper',2.7],['k_paper',2.8],['k_paper',2.9],['k_paper',3,1.2],['k_paper',3.1,1.2]]
};'''+s[j:]
p.write_text(s)
p=H/'src/main.js';s=p.read_text()
a="  d.forEach(x=>sfx(x[0],x[2]?{delay:x[1],rate:x[2]}:{delay:x[1]}));\n  sfx('sad',{delay:Math.max(0,(sceneMs(k)-1500)/1000)});"
assert a in s
s=s.replace(a,"  d.forEach(x=>sfx(x[0],{delay:x[1],rate:x[2]||1,vol:x[3]==null?1:x[3]}));\n  sfx('k_womp',{delay:Math.max(0,(sceneMs(k)-1900)/1000),vol:0.8});")
p.write_text(s)
p=H/'tools/make_workshops.py';s=p.read_text()
a="(DEATH_SFX[st.kind]||[]).forEach(x=>wsT.push(setTimeout(()=>SFX.play(x[0],x[2]?{rate:x[2]}:{}),x[1]*1000/st.speed)));wsT.push(setTimeout(()=>SFX.play('sad'),(ms-1500)/st.speed))"
assert a in s
s=s.replace(a,"(DEATH_SFX[st.kind]||[]).forEach(x=>wsT.push(setTimeout(()=>SFX.play(x[0],{rate:x[2]||1,vol:x[3]==null?1:x[3]}),x[1]*1000/st.speed)));wsT.push(setTimeout(()=>SFX.play('k_womp',{vol:.8}),(ms-1900)/st.speed))")
p.write_text(s)
print(len(PICK),'sounds added;',len(new),'new keys')
