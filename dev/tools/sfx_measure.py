#!/usr/bin/env python3
"""Measure sfx mp3s with ffmpeg: duration, integrated LUFS (ebur128), true peak dBTP, leading silence ms.
Usage: sfx_measure.py DIR OUT.csv   (dir holds *.mp3)"""
import sys,os,re,subprocess,glob,math
import numpy as np
def run(args):
    return subprocess.run(['ffmpeg','-nostdin','-hide_banner']+args,capture_output=True)
def pcm(path):
    r=run(['-i',path,'-f','f32le','-ac','1','-ar','44100','-'])
    return np.frombuffer(r.stdout,dtype=np.float32)
def lufs_tp(path,dur):
    # loop very short sounds so the 400 ms ebur128 block exists; loudness = mean energy of the sound itself
    loops=max(0,int(math.ceil(2.0/max(dur,0.01)))-1)
    flt='ebur128=peak=true'
    pre=[]
    if loops>0: pre=['-af','aloop=loop=%d:size=%d,%s'%(loops,int(dur*44100)+1,flt)]
    else: pre=['-af',flt]
    r=run(['-i',path]+pre+['-f','null','-'])
    t=r.stderr.decode('utf8','replace')
    i=t.rfind('Summary:')
    s=t[i:]
    li=re.search(r'I:\s+(-?[\d.]+|-inf)\s+LUFS',s)
    tp=re.search(r'Peak:\s+(-?[\d.]+|-inf)\s+dBFS',s)
    return (float(li.group(1)) if li else float('nan')),(float(tp.group(1)) if tp else float('nan'))
def lead_ms(x,thr_db=-50.0):
    thr=10**(thr_db/20)
    idx=np.nonzero(np.abs(x)>thr)[0]
    return (idx[0]/44.1 if len(idx) else float('nan'))
def measure(path):
    x=pcm(path); dur=len(x)/44100
    L,tp=lufs_tp(path,dur)
    return dur,L,tp,lead_ms(x)
if __name__=='__main__':
    d,out=sys.argv[1],sys.argv[2]
    rows=['key,duration_s,lufs,true_peak_dbtp,leading_silence_ms']
    for p in sorted(glob.glob(os.path.join(d,'*.mp3'))):
        k=os.path.basename(p)[:-4]
        du,L,tp,ls=measure(p)
        rows.append('%s,%.3f,%.1f,%.1f,%.1f'%(k,du,L,tp,ls))
    open(out,'w').write('\n'.join(rows)+'\n')
