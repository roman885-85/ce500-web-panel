#!/bin/sh
# Вбудовує style.css у index.html/home.html як інлайн <style>.
# Комутатор віддає .css з Content-Type text/html, а браузери не застосовують
# зовнішній CSS з таким типом — тому CSS має бути всередині сторінки.
D="$1"; [ -z "$D" ] && D=$(dirname "$0")/embedded
[ -f "$D/style.css" ] || D=$(dirname "$0")/panel
python3 - "$D" <<'PY'
import sys, re, pathlib
d = pathlib.Path(sys.argv[1]); css = (d/"style.css").read_text()
for n in ("index.html","home.html"):
    p = d/n; s = p.read_text()
    if '<style>' in s: s = re.sub(r'<style>.*?</style>', '<style>\n'+css+'\n</style>', s, count=1, flags=re.S)
    else: s = re.sub(r'<link rel="stylesheet" href="style\.css[^"]*">', '<style>\n'+css+'\n</style>', s, count=1)
    p.write_text(s); print(f"  {n}: CSS inline")
PY
