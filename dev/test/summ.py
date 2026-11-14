import json,sys,statistics as st
rows={}
for l in open(sys.argv[1]):
    tag,_,js=l.partition(' ')
    try: d=json.loads(js)
    except: continue
    for k,v in d.items():
        if isinstance(v,dict): rows.setdefault((k,tag),[]).append(v)
for st_ in ['a_home','b_duel_idle','c_slider','d_death','e_wheel']:
    for tag in sorted({t for k,t in rows if k==st_}):
        rs=rows[(st_,tag)]
        f=lambda key:round(st.median(r[key] for r in rs),1)
        print(f"{st_:12} {tag:5} n={len(rs)} avg={f('avg')} p95={f('p95')} fps={f('fps')} lt={f('lt')}/{f('ltms')}ms script%={f('script_pct')} task%={f('task_pct')} style%={f('style_pct')} layout%={f('layout_pct')} rebuild/s={f('rebuild_s')} nodes={f('nodes')} heap={f('heapMB')}")
