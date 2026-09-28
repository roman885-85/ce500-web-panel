#!/bin/sh
# Повернути збережений конфіг у комутатор. Запускати з церковної мережі.
SW=${SW:-192.168.1.250}; SWAUTH=${SWAUTH:-admin:admin}
MY=$(ipconfig getifaddr en0 2>/dev/null)
DIR=$(dirname "$0")/../config
[ -f "$DIR/running-config-2026-09-21.txt" ] || { echo "немає файлу конфігу"; exit 1; }
ping -c1 -W 1000 "$SW" >/dev/null 2>&1 || { echo "комутатор $SW не відповідає"; exit 1; }
echo "УВАГА: це перезапише поточні налаштування комутатора збереженими від 21.09.2026."
printf "Продовжити? (yes/ні): "; read ans; [ "$ans" = "yes" ] || exit 0
cd "$DIR" && python3 -m http.server 8099 --bind 0.0.0.0 >/dev/null 2>&1 &
HP=$!; trap 'kill $HP 2>/dev/null' EXIT; sleep 1
curl -s -m 60 -u "$SWAUTH" "http://$SW/level/15/exec/copy/http:%2F%2F$MY:8099%2Frunning-config-2026-09-21.txt/running-config/CR" \
  | sed -e 's/<[^>]*>//g' | grep -iE "bytes|Invalid|%" | head -2
echo "Готово. Перевірте, потім збережіть: $(dirname "$0")/sw.sh write memory"
