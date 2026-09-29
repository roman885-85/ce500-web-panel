#!/bin/sh
# Заливка панелі в комутатор. Запускати з церковної мережі (комутатор має бачити цей комп'ютер).
SW=${SW:-192.168.1.250}
SWAUTH=${SWAUTH:-admin:admin}
DIR=$(dirname "$0")/../panel
MY=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$MY" ] && { echo "не визначив адресу цього комп'ютера"; exit 1; }
ping -c1 -W 1000 "$SW" >/dev/null 2>&1 || { echo "комутатор $SW не відповідає — ви в церковній мережі?"; exit 1; }

sh "$(dirname "$0")/build-inline.sh" "$DIR" 2>/dev/null
cd "$DIR" || exit 1
python3 -m http.server 8099 --bind 0.0.0.0 >/dev/null 2>&1 &
HP=$!
trap 'kill $HP 2>/dev/null' EXIT INT TERM
sleep 1

post() {
  curl -s -m 120 -u "$SWAUTH" -X POST --data-urlencode "command=$1" --data-urlencode "command_url=/level/15/exec/-" \
    "http://$SW/level/15/exec/-/configure/http" | sed -e 's/<[^>]*>//g' | grep -oE "[0-9]+ bytes copied|%Error.*" | head -1
}
echo "Заливаю панель у комутатор $SW (джерело: $MY:8099)"
for f in app.js style.css index.html home.html logo.png i18n.js favicon.svg version.json; do
  [ -f "$f" ] || continue
  printf "  %-12s " "$f"
  post "copy http://$MY:8099/$f flash:html/$f"
done
echo "Готово. Відкрийте http://$SW/ і оновіть сторінку з очищенням кешу."
