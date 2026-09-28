#!/bin/sh
# Управление коммутатором Cisco CE500 (192.168.1.250) без веб-интерфейса.
#   ./sw.sh show version            - выполнить команду просмотра
#   ./sw.sh --raw "archive download-sw /http http://..."  - команда со слэшами
SW=${SW:-192.168.1.250}
SWAUTH=${SWAUTH:-admin:admin}   # веб під паролем із 21.09.2026
clean(){ sed -e 's/<[^>]*>//g' -e 's/&#34;/"/g' -e 's/[[:space:]]*$//' | grep -viE "^$|^(SW-POE-24|Home.Exec.Configure)|Command base|Complete URL|^Command was|/level/15"; }
if [ "$1" = "--raw" ]; then
  shift
  curl -s -m 60 -u "$SWAUTH" -X POST --data-urlencode "command=$*" --data-urlencode "command_url=/level/15/exec/-" \
    "http://$SW/level/15/exec/-/configure/http" | clean
else
  curl -s -m 60 -u "$SWAUTH" "http://$SW/level/15/exec/$(echo "$*" | sed 's| |/|g')/CR" | clean
fi
