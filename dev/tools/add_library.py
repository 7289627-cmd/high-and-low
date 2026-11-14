import subprocess,json,re,pathlib,numpy as np
H=pathlib.Path('/home/claude/hl');SRC=H/'sounds-src/zips2/cc0lav';OUT=H/'site/lab'
PACKS={'100-CC0-SFX':'rd-everyday','100-cc0-sfx-2':'rd-everyday2','100-CC0-wood-metal-SFX':'rd-wood-metal','25-CC0-bang-sfx':'rd-bangs','75-cc0-breaking-falling-hit-sfx':'rd-break-fall-hit','40-cc0-water-splash-slime-sfx':'rd-water-slime','80-CC0-creature-SFX':'rd-creatures','80-CC0-creature-sfx-2':'rd-creatures2','30-cc0-weird-sfx':'rd-weird','25-CC0-mud-sfx':'rd-mud','bb - Slide Whistle (Aug 2021)':'slide-whistle','metal_interactions':'metal','kenney_digitalaudio':'kenney-digital','kenney_rpgaudio':'kenney-rpg','bb - Bottle Plops (Apr 2021)':'bottle-plops','Micro Pack - Organic Wooshes':'wooshes'}
lib=json.load(open(OUT/'index.json'));have={x['f'] for x in lib};stats={}
def pcm(f):
    r=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',str(f),'-ac','1','-ar','22050','-f','s16le','-'],stdin=subprocess.DEVNULL,capture_output=True)
    return np.frombuffer(r.stdout,dtype=np.int16).astype(np.float32)/32768
n=0
for d,pack in PACKS.items():
    for f in sorted((SRC/d).rglob('*')):
        if f.suffix.lower() not in('.ogg','.wav','.flac','.mp3'):continue
        x=pcm(f)
        if len(x)<400:continue
        dur=len(x)/22050
        if dur>12:continue
        name=re.sub(r'[^a-zA-Z0-9_-]+','_',f.stem).strip('_')
        dst=OUT/pack/(name+'.mp3');dst.parent.mkdir(parents=True,exist_ok=True)
        rel=f'lab/{pack}/{name}.mp3'
        if not dst.exists():
            subprocess.run(['ffmpeg','-nostdin','-y','-loglevel','error','-i',str(f),'-ac','1','-b:a','96k',str(dst)],stdin=subprocess.DEVNULL)
        peak=float(np.max(np.abs(x)));rms=float(np.sqrt(np.mean(x**2)))
        sp=np.abs(np.fft.rfft(x[:min(len(x),22050)]));fr=np.fft.rfftfreq(min(len(x),22050),1/22050);cen=float((sp*fr).sum()/max(sp.sum(),1e-9))
        env=np.abs(x);w=220;e=np.array([env[i:i+w].max() for i in range(0,len(env)-w,w)]) if len(env)>w else np.array([peak])
        pk=int(e.argmax());att=pk*w/22050
        tail=e[pk:];below=np.where(tail<peak*0.05)[0];ring=float((below[0] if len(below) else len(tail))*w/22050)
        stats[rel]={'dur':round(dur,2),'peak':round(20*np.log10(max(peak,1e-5)),1),'rms':round(20*np.log10(max(rms,1e-5)),1),'cen':int(cen),'att':round(att,2),'ring':round(ring,2)}
        if rel not in have:lib.append({'p':pack,'c':pack,'n':name,'f':rel,'src':'zips2/cc0lav/'+str(f.relative_to(SRC))});have.add(rel)
        n+=1
json.dump(lib,open(OUT/'index.json','w'));json.dump(stats,open(H/'tools/lab_stats.json','w'))
print(n,'analysed; library now',len(lib))
