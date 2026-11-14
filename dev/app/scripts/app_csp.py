#!/usr/bin/env python3
"""App build only: add the app's own origins to the CSP meta of www/index.html.
The website CSP (build.py) uses 'self'. Inside Capacitor the page origin is capacitor://localhost (iOS) or
https://localhost (Android); 'self' should match both, but custom-scheme matching in WKWebView is UNVERIFIED, so the
two origins are also listed explicitly for the directives that load our own files. Nothing else is widened
(no new hosts, 'unsafe-eval' or wildcards). Usage: app_csp.py www/index.html   (idempotent)"""
import re, sys, pathlib

ORIGINS = 'capacitor://localhost https://localhost'
DIRECTIVES = ('script-src', 'style-src', 'font-src', 'img-src', 'media-src', 'connect-src', 'manifest-src')
META = re.compile(r'(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")')

def rewrite(html):
    m = META.search(html)
    if not m:
        raise SystemExit('app_csp: no CSP meta found in index.html (build.py changed?)')
    parts = [p.strip() for p in m.group(2).split(';') if p.strip()]
    out = []
    for p in parts:
        name = p.split()[0]
        if name in DIRECTIVES and "'self'" in p and ORIGINS.split()[0] not in p:
            p = p + ' ' + ORIGINS
        out.append(p)
    return html[:m.start(2)] + '; '.join(out) + html[m.end(2):]

if __name__ == '__main__':
    f = pathlib.Path(sys.argv[1])
    f.write_text(rewrite(f.read_text()))
