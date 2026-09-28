#!/bin/sh
# Заливка прошивки в комутатор. Запускати з церковної мережі.
# Використання: ./firmware.sh ~/Downloads/ce500-lanbasek9-tar.122-25.SEG6.tar
SW=${SW:-192.168.1.250}
SWAUTH=${SWAUTH:-admin:admin}
FILE="$1"
[ -f "$FILE" ] || { echo "Вкажіть файл прошивки: ./firmware.sh шлях/до/файлу.tar"; exit 1; }
MY=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$MY" ] && { echo "не визначив адресу цього комп'ютера"; exit 1; }
ping -c1 -W 1000 "$SW" >/dev/null 2>&1 || { echo "комутатор $SW не відповідає — ви в церковній мережі?"; exit 1; }

DIR=$(cd "$(dirname "$FILE")" && pwd); NAME=$(basename "$FILE")
SIZE=$(($(stat -f%z "$FILE") / 1048576))
post() {
  curl -s -m 900 -u "$SWAUTH" -X POST --data-urlencode "command=$1" --data-urlencode "command_url=/level/15/exec/-" \
    "http://$SW/level/15/exec/-/configure/http" | sed -e 's/<[^>]*>//g' -e 's/command completed\.//' \
    | grep -viE "^\s*$|Home.Exec|Command base|Complete URL|Command was|/level/15|^SW-POE-24$"
}
echo "Файл:      $NAME (${SIZE} МБ)"
echo "Комутатор: $SW"
post "dir flash:" | tail -1
echo
printf "Зберігаю поточні налаштування… "; post "copy running-config flash:config.text" | tail -1
cp "$DIR/$NAME" /dev/null 2>/dev/null

cd "$DIR" || exit 1
python3 -m http.server 8099 --bind 0.0.0.0 >/dev/null 2>&1 &
HP=$!; trap 'kill $HP 2>/dev/null' EXIT INT TERM
sleep 1

echo "Заливаю образ (лише IOS, без рідної панелі Cisco). Це кілька хвилин — не вимикайте живлення."
post "archive download-sw /imageonly /overwrite /http http://$MY:8099/$NAME"
echo
echo "Пам'ять після заливки:"; post "dir flash:" | tail -2
echo "Який образ вантажитиметься:"; post "show boot" | head -2
echo
echo "Якщо помилок немає — перезавантажте комутатор командою:"
echo "  $HOME/Documents/cisco-ce500/sw.sh reload"
echo "Після перезапуску відкрийте http://$SW/ — панель має бути на місці."
