#!/usr/bin/env python3
"""Compute SFX.GAIN from store/sound-levels.csv and write it into src/sound.js. Usage: sfx_gains.py levels.csv src/sound.js"""
import csv,sys,math,re,json
TIERS=[  # name, target LUFS (effective, see note), keys
 ('TAP',-28,'key del tick pick babble1 babble2 babble3 heart hint lock'),
 ('UI',-25,'join leave yourturn send land spin'),
 ('FOLEY',-23,'k_squeak k_plop k_paper k_gloop k_gloop2 k_bubble k_splash k_woosh k_rattle k_boing k_boing2 k_ring k_crackle k_launch k_zap d_fuse d_ding d_piano k_eat1 k_eat2 k_eat3 k_burp'),
 ('ANSWER',-22,'yes nope error wheelland'),
 ('CREATURE',-21,'k_yelp'),
 ('STING',-21,'win'),
 ('VO',-20,'vo_ready vo_go vo_youwin vo_gameover vo_final vo_hurry vo_timeover vo_wrong'),
 ('IMPACT',-19,'bonk pop zap d_slam k_clang k_slam k_boom k_crack k_explode k_popbang k_crunch'),
]
rows={r['key']:r for r in csv.DictReader(open(sys.argv[1]))}
def leff(r):
    L=float(r['lufs']);d=float(r['duration_s'])
    return L+10*math.log10(d/0.1) if d<0.1 else L   # clips shorter than 100 ms are judged on 100 ms energy
out=[];lines=[];seen=set()
for name,t,keys in TIERS:
    items=[]
    for k in keys.split():
        r=rows[k];seen.add(k)
        g=t-leff(r)
        cap=-float(r['true_peak_dbtp'])+1.0      # never push the file peak more than 1 dB over full scale before the 0.8 master
        capped=g>cap
        g=max(-18.0,min(g,cap))
        items.append("%s:%.2f"%(k,10**(g/20)))
        out.append((name,t,k,float(r['lufs']),float(r['duration_s']),leff(r),g,capped))
    lines.append("    /* %s %d LUFS */%s"%(name,t,','.join(items)))
miss=set(rows)-seen
assert not miss,miss
block="GAIN:{\n"+",\n".join(lines)+"\n  },"
p=sys.argv[2];s=open(p).read()
s=re.sub(r"GAIN:\{.*?\n  \},(?=\n  MAXVOICES)",lambda m:block,s,count=1,flags=re.S)
open(p,'w').write(s)
json.dump(out,open(sys.argv[1]+'.gains.json','w'))
for o in out: print('%-8s %4d %-12s L=%6.1f dur=%.2f Leff=%6.1f gain=%+5.1f dB%s'%(o[0],o[1],o[2],o[3],o[4],o[5],o[6],'  CAPPED' if o[7] else ''))
