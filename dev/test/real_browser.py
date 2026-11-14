"""Real-browser smoke test for the web build (site/index.html).

Unlike the jsdom tests this runs real Chrome, so CSS layout and the
Content-Security-Policy are actually enforced.

Run:  cd test && python3 real_browser.py
Prints one line: `PASS real browser (N checks)` or `FAIL real browser: reason`.
Env: HL_SHOTS=0 skips screenshots. HL_FONT_DIR=<dir with @fontsource packages>.
"""
import os, sys, re, time, json, socket, subprocess, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'site'
SHOTS = HERE / 'shots'
CHROME = '/usr/bin/google-chrome'
VIEWPORTS = [(320, 568), (360, 640), (375, 667), (375, 553), (390, 664), (390, 844), (430, 932), (768, 1024), (1280, 800)]
SHOT_VPS = {(390, 844), (320, 568)}
if os.environ.get('HL_VPS'):  # e.g. HL_VPS=320x568,360x640 (all of them get full scenes and screenshots)
    VIEWPORTS = [tuple(int(n) for n in v.split('x')) for v in os.environ['HL_VPS'].split(',')]
    SHOT_VPS = set(VIEWPORTS)
if os.environ.get('HL_SHOT_DIR'):
    SHOTS = pathlib.Path(os.environ['HL_SHOT_DIR'])
WANT_SHOTS = os.environ.get('HL_SHOTS', '1') != '0'
T0 = time.time()
BUDGET_S = int(os.environ.get('HL_BUDGET', '330'))

checks = 0
fails = []      # hard failures
warns = {}      # WARN text -> list of 'viewport screen' where it happened
outside = {}    # outside url -> count (what the page tried to reach)


def fail(msg):
    if msg not in fails:
        fails.append(msg)


def warn(msg, where=''):
    warns.setdefault(msg, [])
    if where and where not in warns[msg]:
        warns[msg].append(where)


def check(ok, msg):
    global checks
    checks += 1
    if not ok:
        fail(msg)


# ---------------------------------------------------------------- fakes
# Same in-memory hub as test/quick.js, injected in place of the vendored
# supabase script so the real page runs its real Supabase code path.
FAKE_SUPABASE = r"""
(function(){
  var hub=window.__hlHub||(window.__hlHub={});
  function makeFakeClient(){
    return {
      channel:function(name){
        var subs=hub[name]||(hub[name]=[]);var me={handlers:[],name:name};
        var ch={
          on:function(t,f,cb){me.handlers.push({event:f.event,cb:cb});return ch},
          subscribe:function(cb){subs.push(me);setTimeout(function(){cb&&cb('SUBSCRIBED')},10);return ch},
          send:function(m){subs.forEach(function(o){if(o===me)return;o.handlers.forEach(function(h){if(h.event===m.event)setTimeout(function(){h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))})},5)})});return Promise.resolve('ok')},
          _me:me};
        return ch},
      removeChannel:function(ch){var s=hub[ch._me.name];var i=s.indexOf(ch._me);if(i>=0)s.splice(i,1);return Promise.resolve('ok')}
    };
  }
  var fc=makeFakeClient();
  window.supabase={createClient:function(){return fc}};
})();
"""

INIT = r"""
window.__csp=[];
document.addEventListener('securitypolicyviolation',function(e){
  window.__csp.push(e.violatedDirective+' blocked '+(e.blockedURI||'inline')+' @'+(e.sourceFile||'')+':'+e.lineNumber);
});
window.HL_TEST_Q_MS=300;window.HL_TEST_FILL_MS=500;window.HL_TEST_QJOIN_MS=800;
"""

# ---------------------------------------------------------------- audit JS
AUDIT = r"""
() => {
  const out={zoom:parseFloat(getComputedStyle(document.documentElement).zoom)||1,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,iw:window.innerWidth,off:[],small:[],clip:[],trunc:[],fold:[]};
  const vis=el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0)return null;
    for(let p=el.parentElement;p;p=p.parentElement){
      if(p.hidden)return null;
      const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden')return null;
      if(parseFloat(c.opacity)===0)return null;
    }
    const r=el.getBoundingClientRect();
    if(r.width<=0||r.height<=0)return null;
    return r;
  };
  const name=el=>{
    let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;
    else if(el.className&&typeof el.className==='string')s+='.'+el.className.trim().split(/\s+/).slice(0,2).join('.');
    const t=(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,18);
    return s+(t?' "'+t+'"':'');
  };
  const saved=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight&&e.clientHeight>0).map(e=>[e,e.scrollTop]);
  const sel='button,[role=button],input,a[href],[data-n],[data-k],[data-pickdir],.card.pick,.g';
  document.querySelectorAll(sel).forEach(el=>{
    const r=vis(el);if(!r)return;
    const cs=getComputedStyle(el);
    if(cs.pointerEvents==='none')return;
    // ignore elements that are inside a scrolled-off area vertically only
    if(r.left<-0.5||r.right>innerWidth+0.5)out.off.push(name(el)+' x='+Math.round(r.left)+'..'+Math.round(r.right));
    if(!(el.type==='range'&&el.hidden)&&(r.width<39.5||r.height<39.5)){
      // effective hit box: probe outward with elementFromPoint, so invisible ::after hit areas (a11, d01) count
      const ok=(x,y)=>{const t=document.elementFromPoint(x,y);return t&&(t===el||el.contains(t))};
      let r2=r;
      if(r.top<0||r.bottom>innerHeight){el.scrollIntoView({block:'center'});r2=el.getBoundingClientRect()}  // scrollers are restored below
      const cx=r2.left+r2.width/2,cy=r2.top+r2.height/2;let L=0,R=0,T=0,B=0;
      const hit=ok(cx,cy);const rr=r2; // covered by a sheet or off-screen: not tappable right now, nothing to measure
      if(hit){while(L<16&&ok(r2.left-L-0.5,cy))L++;while(R<16&&ok(r2.right+R+0.5,cy))R++;while(T<16&&ok(cx,r2.top-T-0.5))T++;while(B<16&&ok(cx,r2.bottom+B+0.5))B++}
      const ew=r.width+L+R,eh=r.height+T+B;
      saved.forEach(([e,t])=>{e.scrollTop=t});
      if(hit&&(ew<39.5||eh<39.5))out.small.push(name(el)+' '+Math.round(ew)+'x'+Math.round(eh)+(ew!==r.width||eh!==r.height?' (box '+Math.round(r.width)+'x'+Math.round(r.height)+')':''));
    }
    if(el.tagName==='BUTTON'){
      // text of the button itself must sit inside the button box (absolute badges are intentional overhangs)
      const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,bad=null;
      while((n=w.nextNode())){
        if(!n.textContent.trim())continue;
        let abs=false;for(let p=n.parentElement;p&&p!==el;p=p.parentElement){const ps=getComputedStyle(p).position;if(ps==='absolute'||ps==='fixed'){abs=true;break}}
        if(abs)continue;
        const rg=document.createRange();rg.selectNodeContents(n);const q=rg.getBoundingClientRect();
        if(q.width&&(q.left<r.left-1||q.right>r.right+1||q.top<r.top-2||q.bottom>r.bottom+2)){bad=n.textContent.trim().slice(0,14);break}
      }
      if(bad)out.clip.push(name(el)+' text "'+bad+'" overflows its button box');
    }
  });
  // a control below the fold must be reachable by scrolling (some ancestor scrolls, or the page does)
  out.unreach=[];
  const canScroll=el=>{
    for(let p=el.parentElement;p;p=p.parentElement){
      const c=getComputedStyle(p);
      if(/(auto|scroll)/.test(c.overflowY)&&p.scrollHeight>p.clientHeight+1&&p!==document.body&&p!==document.documentElement)return true;
    }
    const de=document.documentElement,b=document.body;
    const hid=v=>v==='hidden'||v==='clip';
    return de.scrollHeight>innerHeight+1&&!hid(getComputedStyle(de).overflowY)&&!hid(getComputedStyle(b).overflowY);
  };
  document.querySelectorAll('button,input').forEach(el=>{
    const r=vis(el);if(!r)return;
    if(r.bottom>innerHeight+1&&!canScroll(el))out.unreach.push(name(el)+' bottom='+Math.round(r.bottom)+' vh='+innerHeight);
  });
  ['#lockBtn','#askGo','#againBtn','#startBtn','#playBtn'].forEach(q=>{
    const el=document.querySelector(q);if(!el)return;const r=vis(el);
    if(r&&r.bottom>innerHeight+1)out.fold.push(q+' bottom='+Math.round(r.bottom)+' vh='+innerHeight);
  });
  // any text-bearing box that overflows its own width and is hidden/clipped
  document.querySelectorAll('h1,h2,p,b,span,.btn,.who,.tag,.pill').forEach(el=>{
    const r=vis(el);if(!r)return;
    const cs=getComputedStyle(el);
    if((cs.overflow==='hidden'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1&&el.clientWidth>0&&el.children.length===0)
      out.trunc.push(name(el)+' sw='+el.scrollWidth+' cw='+el.clientWidth);
  });
  return out;
}
"""


def audit(pg, label, vp):
    """Run the layout assertions on the current screen."""
    r = pg.evaluate(AUDIT)
    lap('audit ' + label)
    tag = f'[{vp[0]}x{vp[1]}] {label}'
    check(r['sw'] <= r['iw'], f'{tag}: horizontal scroll (scrollWidth {r["sw"]} > innerWidth {r["iw"]})')
    # body.scrollWidth is in zoomed CSS px when c09's html{zoom} is active (tablet/desktop), so compare in viewport px
    check(r['bw'] * r['zoom'] <= r['iw'] + 1, f'{tag}: body wider than viewport ({r["bw"]}*{r["zoom"]} > {r["iw"]})')
    check(not r['off'], f'{tag}: control outside viewport: ' + '; '.join(r['off'][:4]))
    check(not r['unreach'], f'{tag}: control below the fold and nothing scrolls: ' + '; '.join(r['unreach'][:4]))
    check(not r['clip'], f'{tag}: clipped text: ' + '; '.join(r['clip'][:4]))
    checks_inc()  # the tap-size check is a WARN-only check but still counts
    for x in r['small']:
        warn('tap target <40px: ' + x, f'{vp[0]}x{vp[1]} {label}')
    for x in r['trunc']:
        warn('text truncated by ellipsis: ' + x, f'{vp[0]}x{vp[1]} {label}')
    for x in r['fold']:
        warn('primary action below the fold (needs scroll): ' + x, f'{vp[0]}x{vp[1]} {label}')


def checks_inc():
    global checks
    checks += 1


def shot(pg, vp, name):
    if WANT_SHOTS and vp in SHOT_VPS:
        SHOTS.mkdir(exist_ok=True)
        pg.screenshot(path=str(SHOTS / f'rb_{vp[0]}x{vp[1]}_{name}.png'))


DEBUG = os.environ.get('HL_DEBUG')
_t = [time.time()]


def lap(msg):
    if DEBUG:
        n = time.time()
        print(f'  {n-_t[0]:5.1f}s {msg}', flush=True)
        _t[0] = n


def wait_for(pg, js, timeout_ms=15000, step=100):
    t = time.time()
    while (time.time() - t) * 1000 < timeout_ms:
        try:
            v = pg.evaluate(js)
        except Exception:
            v = None
        if v:
            return v
        pg.wait_for_timeout(step)
    return None


def drag_slider(pg, track_sel, frac):
    box = pg.eval_on_selector(track_sel, 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
    y = box[1] + box[3] / 2
    pg.mouse.move(box[0] + box[2] * 0.3, y)
    pg.mouse.down()
    for f in (0.4, frac):
        pg.mouse.move(box[0] + box[2] * f, y)
        pg.wait_for_timeout(30)
    pg.mouse.up()


# ---------------------------------------------------------------- server
def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def font_files():
    """Locate local copies of the two web fonts (so layout matches production)."""
    cands = [os.environ.get('HL_FONT_DIR', ''),
             '/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad/node_modules/@fontsource',
             str(HERE / 'node_modules/@fontsource'), str(HERE.parent / 'node_modules/@fontsource')]
    for c in cands:
        if not c:
            continue
        b = pathlib.Path(c)
        bagel = b / 'bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2'
        if bagel.exists() and (b / 'baloo-2/files/baloo-2-latin-700-normal.woff2').exists():
            d = {'bagel.woff2': bagel.read_bytes()}
            for w in (500, 600, 700, 800):
                d[f'baloo{w}.woff2'] = (b / f'baloo-2/files/baloo-2-latin-{w}-normal.woff2').read_bytes()
            return d
    return None


def main():
    fonts = font_files()
    if not fonts:
        warn('real fonts not found locally: layout measured with fallback fonts (set HL_FONT_DIR)')
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
                           cwd=str(SITE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}'
    try:
        for _ in range(50):
            try:
                socket.create_connection(('127.0.0.1', port), 0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        run(base, fonts)
    finally:
        srv.kill()
        srv.wait()


CSS_FONTS = ('@font-face{font-family:"Bagel Fat One";src:url(https://fonts.gstatic.com/s/bagel.woff2) format("woff2")}'
             + ''.join(f'@font-face{{font-family:"Baloo 2";font-weight:{w};src:url(https://fonts.gstatic.com/s/baloo{w}.woff2) format("woff2")}}'
                       for w in (500, 600, 700, 800)))


def run(base, fonts):
    msgs = []  # console errors / page errors / csp
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--no-first-run'])
        try:
            for vp in VIEWPORTS:
                if time.time() - T0 > BUDGET_S:
                    fail(f'time budget exceeded before {vp[0]}x{vp[1]}')
                    break
                ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]},
                                    is_mobile=vp[0] < 800, has_touch=vp[0] < 800, device_scale_factor=1)
                ctx.add_init_script(INIT)
                handle_routes(ctx, base, fonts)
                pg = ctx.new_page()
                pg.on('pageerror', lambda e, vp=vp: msgs.append(f'[{vp[0]}x{vp[1]}] pageerror: {e}'))

                def on_console(m, vp=vp):
                    if m.type == 'error':
                        loc = m.location.get('url', '') if m.location else ''
                        if m.text.startswith('Failed to load resource') and loc and not loc.startswith('http://127.0.0.1'):
                            return
                        if '404' in m.text and '/music/' in loc:
                            warn('music file missing (404): ' + loc.rsplit('/', 2)[-2] + '/' + loc.rsplit('/', 1)[-1] + ' (site/music is not shipped; MUSIC tolerates this)')
                            return  # an outside request we blocked on purpose; reported separately
                        msgs.append(f'[{vp[0]}x{vp[1]}] console.error: {m.text} {loc}')
                pg.on('console', on_console)
                try:
                    walk(pg, base, vp)
                except Exception as e:
                    fail(f'[{vp[0]}x{vp[1]}] test crashed: {type(e).__name__}: {str(e)[:200]}')
                try:
                    csp = pg.evaluate('window.__csp||[]')
                except Exception:
                    csp = []
                for c in csp:
                    msgs.append(f'[{vp[0]}x{vp[1]}] CSP violation: {c}')
                ctx.close()
        finally:
            b.close()
    for m in dict.fromkeys(msgs):
        fail(m)
    checks_inc_n = 1
    global checks
    checks += checks_inc_n  # one check: no console/page/CSP errors
    finish()


def handle_routes(ctx, base, fonts):
    def route(r):
        u = r.request.url
        if u.startswith(base) or u.startswith('data:') or u.startswith('blob:'):
            if '/vendor/supabase-' in u:
                return r.fulfill(status=200, content_type='application/javascript', body=FAKE_SUPABASE)
            return r.continue_()
        key = re.sub(r'\?.*', '', u)
        outside[key] = outside.get(key, 0) + 1
        if fonts and u.startswith('https://fonts.googleapis.com/'):
            return r.fulfill(status=200, content_type='text/css', body=CSS_FONTS)
        if fonts and u.startswith('https://fonts.gstatic.com/s/'):
            name = u.rsplit('/', 1)[1].split('?')[0]
            if name in fonts:
                return r.fulfill(status=200, content_type='font/woff2', body=fonts[name],
                                 headers={'access-control-allow-origin': '*'})
        return r.abort()
    ctx.route('**/*', route)


def walk(pg, base, vp):
    tag = f'[{vp[0]}x{vp[1]}]'
    pg.goto(base + '/index.html', wait_until='load')
    # wait for rooms to be "ok" (fake supabase) and the home panel to render
    ok = wait_for(pg, "typeof roomState!=='undefined'&&roomState==='ok'&&!!document.querySelector('#playBtn')", 8000)
    check(ok, f'{tag} home never became ready (roomState)')
    if not ok:
        return
    pg.evaluate("document.fonts?document.fonts.ready.then(()=>1):1")
    pg.wait_for_timeout(500)
    audit(pg, 'home', vp)
    shot(pg, vp, '01_home')

    # "i" sheet
    pg.click('#infoBtn')
    pg.wait_for_timeout(250)
    check(pg.evaluate("!document.querySelector('#ov').hidden"), f'{tag} info sheet did not open')
    audit(pg, 'info sheet', vp)
    shot(pg, vp, '02_info')
    pg.evaluate("closeOv()")

    # Play with friends
    pg.fill('#nameIn', 'Dodgy')
    pg.click('#friendsBtn')
    pg.wait_for_timeout(500)
    audit(pg, 'play with friends (home)', vp)
    shot(pg, vp, '03_friends')
    lobby = wait_for(pg, "!!document.querySelector('#startBtn')||!!document.querySelector('#lobCode')", 3000)
    if lobby:
        audit(pg, 'friends lobby', vp)
        shot(pg, vp, '03b_lobby')
        pg.evaluate("leaveGame()")
        wait_for(pg, "!!document.querySelector('#playBtn')", 5000)
        pg.wait_for_timeout(300)

    # Play (rated duel): finds a match via fake hub, fill-bot joins
    pg.click('#playBtn')
    pg.wait_for_timeout(200)
    audit(pg, 'finding a match', vp)
    shot(pg, vp, '04_finding')
    sec = wait_for(pg, "!!document.querySelector('#secTrack')", 20000)
    check(sec, f'{tag} never reached the secret-picking slider')
    if not sec:
        return
    pg.wait_for_timeout(500)
    audit(pg, 'secret slider', vp)
    shot(pg, vp, '05_secret')
    drag_slider(pg, '#secTrack', 0.6)
    pg.wait_for_timeout(150)
    audit(pg, 'secret slider (dragged)', vp)
    pg.click('#lockBtn')

    # the duel opens with a direction pick then the ask slider
    got = wait_for(pg, "!!document.querySelector('[data-pickdir]')||!!document.querySelector('#sld')||!!document.querySelector('.g[data-n]')", 25000)
    check(got, f'{tag} never reached the ask phase')
    if not got:
        return
    pg.wait_for_timeout(500)
    # a first-turn overlay (wheel) may be up: audit it, then dismiss it (it is long)
    if pg.evaluate("!document.querySelector('#ov').hidden"):
        audit(pg, 'overlay at start of duel (wheel)', vp)
        shot(pg, vp, '05b_wheel')
        pg.evaluate("closeOv()")
        pg.wait_for_timeout(300)
    if pg.query_selector('[data-pickdir]'):
        audit(pg, 'pick direction', vp)
        shot(pg, vp, '06_dir')
        pg.click('[data-pickdir="h"]')
        pg.wait_for_timeout(500)
    if pg.query_selector('#sld'):
        audit(pg, 'ask slider', vp)
        shot(pg, vp, '07_ask')
        drag_slider(pg, '#sldTrack', 0.55)
        pg.wait_for_timeout(150)
        audit(pg, 'ask slider (dragged)', vp)
        pg.click('#askGo')
        pg.wait_for_timeout(900)
        audit(pg, 'after asking', vp)
        shot(pg, vp, '08_after_ask')
    else:
        warn(f'{tag} ask slider not shown (turn was not ours)')

    # death scenes: force each kind through the real showScene() renderer
    kinds = pg.evaluate("Object.keys(SCENES)")
    sample = kinds if vp in SHOT_VPS else kinds[:2]
    for i, k in enumerate(sample):
        pg.evaluate("""k=>{const me=G.players.find(x=>x.pid!==PID)||G.players[0];const kl=G.players.find(x=>x.pid===PID)||null;
                      showScene(k,me,'It wasn\\'t 42!',me.name+' test scene',20000,kl,42)}""", k)
        pg.wait_for_timeout(1100 if vp in SHOT_VPS else 500)
        audit(pg, f'death scene {k}', vp)
        if vp in SHOT_VPS:
            shot(pg, vp, f'09_death_{k}')
        pg.evaluate("closeOv()")

    # result sheet (win and lose)
    for win in (True, False):
        pg.evaluate("""w=>{const o=G.players.find(x=>x.pid!==PID);G.phase='over';G.win=w?PID:o.pid;
                      G.players.forEach(p=>{if(p.pid!==(w?PID:o.pid)){p.a=0;p.d='anvil'}});publishG();render(true);showWinner()}""", win)
        pg.wait_for_timeout(900)
        audit(pg, 'result sheet ' + ('win' if win else 'lose'), vp)
        shot(pg, vp, '10_result_' + ('win' if win else 'lose'))
        pg.evaluate("closeOv()")
    pg.wait_for_timeout(200)
    audit(pg, 'game over screen', vp)
    shot(pg, vp, '11_over')


def finish():
    print('--- outside requests the page tried (all blocked/stubbed) ---')
    for u, n in sorted(outside.items()):
        print(f'  {n:3d}x {u}')
    if warns:
        print('--- WARN ---')
        for w, where in warns.items():
            vps = sorted({x.split(' ')[0] for x in where})
            scr = len({x.split(' ', 1)[1] for x in where if ' ' in x})
            print(f'  WARN {w}' + (f'  [{len(where)} screens/viewports; {",".join(vps)}]' if where else ''))
    if fails:
        print('--- FAIL details ---')
        for f in fails:
            print('  ' + f)
        print('FAIL real browser: ' + fails[0] + (f' (+{len(fails)-1} more)' if len(fails) > 1 else ''))
    else:
        print(f'PASS real browser ({checks} checks)')


if __name__ == '__main__':
    main()
