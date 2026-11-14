#!/usr/bin/env python3
"""Trim leading silence (>15 ms, keep 2 ms) and peak-limit to -1 dBTP. Re-encode from the ORIGINAL source named in
sounds-src/map.txt (resolved under /home/claude/hl/sounds-src) when one exists, else from the previous mp3 (ORIG dir).
Usage: sfx_process.py ORIG_MP3_DIR OUT_DIR trimlog.csv"""
import sys,os,re,subprocess,json
sys.path.insert(0,os.path.dirname(__file__))
import numpy as np
from sfx_measure import run,pcm,lead_ms
def tp_only(p):
    t=run(['-i',p,'-af','ebur128=peak=true','-f','null','-']).stderr.decode('utf8','replace')
    m=re.search(r'Peak:\s+(-?[\d.]+|-inf)\s+dBFS',t[t.rfind('Summary:'):])
    return float(m.group(1)) if m else 99.0
SRC='/home/claude/hl/sounds-src'
orig,out,log=sys.argv[1:4]
here=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
smap={}
for l in open(os.path.join(here,'sounds-src/map.txt')):
    m=re.match(r'(\S+?)\s*((?:zips2?|interface-sounds|ui-audio|piano)/.*)$',l.rstrip('\n'))
    if m: smap[m.group(1)]=m.group(2)
def probe(p,f):
    return subprocess.run(['ffprobe','-v','error','-show_entries','stream='+f,'-of','csv=p=0',p],capture_output=True,text=True).stdout.strip()
rows=['key,input,lead_before_ms,trimmed_ms,src_mono_sample_peak_db,final_peak_dbtp']
for fn in sorted(os.listdir(orig)):
    if not fn.endswith('.mp3'): continue
    k=fn[:-4]; om=os.path.join(orig,fn)
    src=os.path.join(SRC,smap[k]) if k in smap and os.path.exists(os.path.join(SRC,smap[k])) else om
    kind='source' if src!=om else 'mp3'
    sr=probe(om,'sample_rate'); br=int(probe(om,'bit_rate') or 96000)
    if br not in (64000,80000,96000,112000,128000,160000): br=96000  # tiny files report a meaningless bit rate
    x=pcm(src); n=len(x)
    pk=float(np.max(np.abs(x))) if n else 1.0
    ceil=-1.5  # target sample peak before mp3 encode (encode adds ~0.3-0.6 dB of overshoot)
    for it in range(8):
        gain=ceil-20*np.log10(max(pk,1e-9))           # dB needed to put the sample peak at the ceiling
        limiter=gain<-2.0 and n>=8820                 # big reduction = clipped/hot source: limit instead of plain gain
        eff=-1.0 if limiter else max(-30.0,min(gain,20.0))   # level change near the onset
        lead=lead_ms(x*10**(eff/20))
        trim=max(0.0,lead-2.0) if (lead>15 and not np.isnan(lead)) else 0.0
        filt=[]
        if trim>0: filt+=['atrim=start=%.4f'%(trim/1000),'asetpts=PTS-STARTPTS']
        if limiter: filt.append('volume=-1dB,alimiter=limit=%.4f:attack=1:release=25:level=0'%(10**((ceil+0.5)/20)))
        elif abs(eff)>0.05: filt.append('volume=%.3fdB'%eff)   # alimiter emits nothing for very short clips, so plain gain there
        if trim>0: filt.append('afade=t=in:d=0.002')
        cmd=['-y','-loglevel','error','-i',src,'-ac','1','-ar',sr]
        if filt: cmd+=['-af',','.join(filt)]
        cmd+=['-c:a','libmp3lame','-b:a',str(br),os.path.join(out,fn)]
        run(cmd)
        tp=tp_only(os.path.join(out,fn))
        if tp<=-1.0: break
        ceil-=max(0.3,tp+1.1)
    tp0=20*np.log10(max(pk,1e-9))
    rows.append('%s,%s,%.1f,%.1f,%.1f,%.1f'%(k,kind,lead if not np.isnan(lead) else -1,trim,tp0,tp))
    print(rows[-1],flush=True)
open(log,'w').write('\n'.join(rows)+'\n')
