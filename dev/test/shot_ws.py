from playwright.sync_api import sync_playwright
import subprocess,time
srv=subprocess.Popen(['python3','-m','http.server','8767','--directory','/home/claude/hl/site'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':430,'height':900}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8767/deaths.html'); pg.wait_for_timeout(800)
    pg.click('[data-kind="piano"]'); pg.wait_for_timeout(2600); pg.screenshot(path='shots/w_deaths.png')
    pg.evaluate("document.getElementById('scrub').value=1500;document.getElementById('scrub').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    print('scrub',pg.evaluate("[document.getElementById('tread').textContent,anims().length,anims().every(a=>a.playState==='paused')]"))
    pg.click('[data-v="fix"]'); pg.fill('#note','legs look odd at 2.1s'); pg.click('[data-sp="0.5"]'); pg.wait_for_timeout(400)
    print('rate',pg.evaluate("anims().slice(0,3).map(a=>a.playbackRate)"), pg.evaluate("localStorage.getItem('hl-deathlab')"), 'errs',errs)
    pg2=b.new_page(viewport={'width':430,'height':900}); e2=[];pg2.on('pageerror',lambda e:e2.append(str(e)))
    pg2.goto('http://localhost:8767/sounds.html'); pg2.wait_for_timeout(600)
    pg2.click('[data-open="yes"]'); pg2.wait_for_timeout(200); pg2.click('.lb >> nth=3'); pg2.wait_for_timeout(300); pg2.screenshot(path='shots/w_sounds.png')
    print('picks',pg2.evaluate("localStorage.getItem('hl-soundlab')"),'rows',pg2.evaluate("document.querySelectorAll('[data-now]').length"),e2)
    b.close()
srv.kill()
