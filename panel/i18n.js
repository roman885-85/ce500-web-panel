'use strict';
/* Локалізація панелі. Перекладає лише відомі фрази зі словника — дані
   (MAC, IP, імена, вивід команд) лишаються як є. Мова: збережена або
   визначена за браузером (не uk/ru → English). */
(function () {
  const DICT = {
    // шапка / вкладки
    "Керування комутатором": "Switch management",
    "Пауза оновлення": "Pause updates", "Відновити оновлення": "Resume updates",
    "Зупинити автоматичне оновлення даних": "Pause automatic data refresh",
    "Світла або темна тема": "Light or dark theme",
    "Як у системі": "System", "Світла": "Light", "Темна": "Dark",
    "Зберегти налаштування": "Save settings",
    "Записати поточні налаштування у пам'ять комутатора": "Write current settings to the switch",
    "Огляд": "Overview", "Порти": "Ports", "Живлення PoE": "PoE power", "Кабелі": "Cables",
    "Мережі VLAN": "VLANs", "Пристрої": "Devices", "Налаштування": "Settings",
    "Безпека": "Security", "Журнал": "Log", "Діагностика": "Diagnostics",
    "Термінал": "Terminal", "Довідка": "Help", "Обслуговування": "Maintenance",
    // огляд
    "Модель": "Model", "Адреса": "Address", "Заводський номер": "Serial number",
    "Працює без перерви": "Uptime", "Активні порти": "Active ports", "живить пристрої": "powering devices",
    "останній запуск:": "last start:", "шлюз": "gateway", "Трафік зараз": "Traffic now",
    "Помилки на портах": "Port errors", "немає": "none", "усі лінії чисті": "all lines clean",
    "Версія ПЗ": "Firmware", "аварійний образ": "emergency image", "звичайний образ": "normal image",
    "Системний монітор": "System monitor", "Процесор": "CPU", "Пам'ять": "Memory",
    "Трафік": "Traffic", "вентилятор": "fan", "температура": "temperature", "живлення": "power",
    "резервне живлення": "backup power", "норма": "OK", "несправний": "faulty",
    "Передня панель": "Front panel", "Передня панель комутатора": "Switch front panel",
    "Натисніть на порт, щоб побачити подробиці та керувати ним.": "Click a port to see details and control it.",
    "Наведіть на порт, щоб побачити його підпис і стан": "Hover over a port to see its label and state",
    "працює": "up", "живить пристрій": "powering device", "вільний": "free",
    "вимкнений": "disabled", "помилка": "error",
    // порти
    "Перелік портів": "Port list", "Пошук": "Search",
    "номер порту, підпис або адреса": "port number, label or address",
    "Перевірити всі камери": "Check all cameras", "Обрано": "Selected",
    "Перезапустити живлення": "Power cycle", "Увімкнути": "Enable", "Вимкнути": "Disable",
    "Перенести в мережу": "Move to VLAN", "Зняти позначки": "Clear selection",
    "Назва": "Name", "Порт": "Port", "Підпис": "Label", "Камера": "Camera",
    "Стан": "State", "Швидкість": "Speed", "Помилки": "Errors", "Живлення": "Power",
    "Відкрити": "Open", "Стан порту": "Port state",
    // картка порту
    "Тип роз'єму": "Connector type", "Мережа VLAN": "VLAN", "Пристрій": "Device",
    "Прив'язка": "Binding", "Підпис порту": "Port label",
    "Адреса пристрою (щоб перевіряти зв'язок)": "Device address (to check connectivity)",
    "Зберегти підпис і адресу": "Save label and address", "Перевірити зв'язок": "Check connectivity",
    "Перенести в мережу": "Move to VLAN", "Увімкнути порт": "Enable port", "Вимкнути порт": "Disable port",
    "Вимкнути живлення": "Disable power", "Увімкнути живлення": "Enable power",
    "Прив'язати пристрій": "Bind device", "Зняти прив'язку": "Unbind",
    "Обмежити зайвий потік": "Limit broadcast", "Зняти обмеження": "Remove limit",
    "Перевірити кабель": "Test cable", "Подробиці від комутатора": "Details from the switch",
    "не перевіряється": "not tested", "відповідає": "responds", "не відповідає": "no response",
    "не перевірено": "not checked", "не видно": "not seen", "немає на гігабітних": "none on gigabit ports",
    "увімкнене, пристрою немає": "enabled, no device", "вимкнене": "disabled",
    "прив'язаний пристрій": "bound device",
    // PoE
    "Бюджет живлення": "Power budget", "Живлення по портах": "Power by port",
    "Стандарт 802.3af: до 15,4 Вт на порт. Камери PoE+ (30 Вт) цей комутатор не потягне.":
      "802.3af: up to 15.4 W per port. PoE+ (30 W) cameras won't power up on this switch.",
    "Режим": "Mode", "Спожито": "Consumed", "Клас": "Class",
    "увімкнено": "on", "вимкнено": "off", "живить": "powering",
    // кабелі
    "Діагностика кабелів": "Cable diagnostics",
    "Перевірити всі вільні порти": "Test all free ports", "Зупинити": "Stop",
    "Перевірено": "Tested", "Пари кабелю": "Cable pairs", "Перевірити": "Test",
    "не перевірявся": "not tested", "обрив": "open", "замикання": "short",
    "ціла": "intact", "погана якість": "poor quality",
    // VLAN
    "Мережі VLAN": "VLANs", "Номер": "Number", "Порти": "Ports", "Додати": "Add",
    "Додати мережу": "Add VLAN", "Видалити": "Delete",
    "Усе обладнання зараз в одній мережі (VLAN 1). Окремі VLAN потрібні лише якщо треба відокремити камери від решти — тоді налаштування потрібне ще й на роутері.":
      "All equipment is on one network (VLAN 1). Separate VLANs are only needed to isolate cameras from the rest — that also requires setup on the router.",
    // пристрої
    "Пристрої, які бачить комутатор": "Devices seen by the switch",
    "Комутатор бачить усі пристрої за апаратною адресою (MAC). IP-адресу він знає лише для тих, хто спілкувався з ним напряму. Кнопка нижче опитує мережу, щоб дізнатися решту адрес.":
      "The switch sees every device by MAC. It only knows the IP of those that talked to it directly. The button below sweeps the network to find the rest.",
    "MAC, IP, виробник або порт": "MAC, IP, vendor or port",
    "Опитати мережу (знайти IP)": "Sweep network (find IPs)",
    "Назва пристрою": "Device name", "IP-адреса": "IP address", "Виробник": "Vendor",
    "Апаратна адреса": "MAC address", "Підпис порту": "Port label",
    "напр. Камера над входом": "e.g. Entrance camera",
    "нічого не знайдено": "nothing found", "випадкова адреса": "random address",
    "віртуальна машина": "virtual machine",
    // налаштування
    "Мережеві параметри": "Network parameters", "Ім'я комутатора": "Switch name",
    "Маска": "Mask", "Шлюз": "Gateway",
    "Зміна IP-адреси розірве зв'язок із панеллю — далі відкривайте її за новою адресою.":
      "Changing the IP will drop the panel — reopen it at the new address.",
    "Застосувати": "Apply", "Час": "Time", "Сервери часу (NTP)": "Time servers (NTP)",
    "Зберегти": "Save", "через кому": "comma-separated", "не задано": "not set",
    "Годинник комутатора:": "Switch clock:", "Сервери часу:": "Time servers:",
    // безпека
    "Пароль на керування": "Management password",
    "Зараз комутатором може керувати будь-хто з вашої мережі — ні пароля, ні входу він не вимагає. Пароль закриє і цю панель, і прямий доступ до комутатора з браузера.":
      "Right now anyone on your network can manage the switch — no password required. A password locks both this panel and direct browser access.",
    "Новий пароль": "New password", "Повторіть": "Repeat",
    "щонайменше 6 символів": "at least 6 characters",
    "Встановити пароль": "Set password", "Зняти пароль": "Remove password",
    "Дозволені латинські літери, цифри та знаки": "Latin letters, digits and symbols allowed",
    "Пароль зберігається в цій панелі, щоб вона могла й далі працювати.":
      "The password is stored in this panel so it keeps working.",
    // журнал
    "Події на портах": "Port events",
    "Коли який порт втрачав і відновлював зв'язок. Якщо камера моргає щоночі — це буде видно тут.":
      "When each port lost and regained link. If a camera blinks nightly, you'll see it here.",
    "Оновити": "Refresh", "Показати": "Show", "події портів": "port events",
    "повний журнал": "full log", "Коли": "When", "Що сталося": "What happened",
    "Подробиці": "Details", "порт піднявся": "port up", "порт погас": "port down",
    "зв'язок з'явився": "link up", "зв'язок зник": "link down",
    "подано живлення PoE": "PoE power granted", "живлення PoE знято": "PoE power removed",
    "комутатор перезапущено": "switch restarted", "збій програми комутатора": "switch software crash",
    "спрацював захист порту": "port security triggered", "широкомовний шторм": "broadcast storm",
    "подій ще немає": "no events yet",
    // діагностика
    "Перевірка зв'язку": "Connectivity check", "Перевірити": "Check", "виконую…": "running…",
    "Команда перегляду": "View command", "Виконати": "Run",
    "Дозволені лише команди перегляду: show, ping, dir, more.": "Only view commands: show, ping, dir, more.",
    "Дзеркалювання порту": "Port mirroring",
    "Комутатор скопіює весь трафік обраного порту на інший. Підключіть у нього ноутбук — і побачите, що саме передає камера. На роботу самої камери це не впливає.":
      "The switch copies all traffic of one port to another. Plug a laptop in and see what a camera sends. It doesn't affect the camera itself.",
    "Звідки копіювати": "Copy from", "Куди подати копію": "Copy to",
    "Історія навантаження процесора": "CPU load history",
    "Це власні графіки комутатора — за останню хвилину, годину й добу.":
      "The switch's own graphs — for the last minute, hour and day.",
    "Комутатор посилає у кабель імпульс і за відлунням визначає, чи ціла кожна пара жил і на якій відстані пошкодження. Перевірка вільного порту безпечна. На порту з увімкненим пристроєм зв'язок обірветься на кілька секунд.":
      "The switch sends a pulse into the cable and uses the echo to tell whether each pair is intact and where a fault is. Testing a free port is safe; on a live port the link drops for a few seconds.",
    // термінал
    "Термінал комутатора": "Switch terminal",
    "Введіть команду. Наприклад: show version, show interfaces status, show power inline":
      "Type a command. For example: show version, show interfaces status, show power inline",
    "введіть команду і натисніть Enter": "type a command and press Enter",
    "Підказки команд": "Command hints", "Сховати підказки": "Hide hints",
    "Очистити": "Clear", "Зберегти вивід у файл": "Save output to file",
    "Небезпечні команди (видалення, перезавантаження, стирання) спитають підтвердження.":
      "Dangerous commands (delete, reload, erase) ask for confirmation.",
    // обслуговування
    "Налаштування комутатора": "Switch configuration",
    "Поточні налаштування у текстовому вигляді. Кнопкою нижче можна зберегти копію на комп'ютер.":
      "Current configuration as text. The button below saves a copy to your computer.",
    "Записати в пам'ять комутатора": "Write to switch",
    "Зберегти звіт про стан": "Save status report", "Завантажити копію": "Download copy",
    "Оновлення програмного забезпечення": "Firmware update",
    "Залити в комутатор": "Upload to switch",
    "Заливка триває кілька хвилин, не вимикайте живлення. Після неї натисніть «Перезавантажити комутатор».":
      "The upload takes a few minutes, don't cut power. Then press “Reboot switch”.",
    "Перезавантаження": "Reboot", "Перезавантажити комутатор": "Reboot switch",
    "Комутатор вимкнеться приблизно на дві хвилини. Усі камери на цей час залишаться без живлення.":
      "The switch will be down for about two minutes. All cameras lose power meanwhile.",
    // довідка (заголовки)
    "Що робити, коли…": "What to do when…", "Пошук по довідці": "Search help",
    "Камера не працює — з чого почати": "A camera isn't working — where to start",
    "Один порт докладно": "One port in detail", "Керування портом": "Port control",
    "Термінал: як ним користуватися": "Terminal: how to use it",
    "Чому панель виглядає саме так": "Why the panel looks like this",
    "Що означають кольори портів": "What the port colours mean",
    "Збереження та обслуговування": "Saving and maintenance",
    // тости / статуси
    "Збережено": "Saved", "Не вдалося:": "Failed:", "не вдалося:": "failed:",
    "Комутатор не відповідає": "Switch not responding", "Нічого змінювати": "Nothing to change",
    "Назву збережено": "Name saved", "Назву прибрано": "Name removed",
    "Підпис порту збережено": "Port label saved", "Підпис збережено": "Label saved",
    "Порт увімкнено": "Port enabled", "Порт вимкнено": "Port disabled",
    "Порти увімкнено": "Ports enabled", "Порти вимкнено": "Ports disabled",
    "Порти перенесено": "Ports moved", "Порт перенесено": "Port moved",
    "Живлення перезапущено": "Power cycled", "Режим живлення змінено": "Power mode changed",
    "Мережу додано": "VLAN added", "Мережу видалено": "VLAN removed",
    "Дзеркалювання увімкнено": "Mirroring enabled", "Дзеркалювання вимкнено": "Mirroring disabled",
    "дзеркалювання вимкнене": "mirroring off",
    "Пароль встановлено": "Password set", "Пароль знято": "Password removed",
    "Паролі не збігаються": "Passwords don't match",
    "Сервери часу збережено": "Time servers saved", "Застосовано. Не забудьте зберегти налаштування.": "Applied. Don't forget to save settings.",
    "Пристрій прив'язано": "Device bound", "Прив'язку знято": "Unbound",
    "Образ залито": "Image uploaded", "Звіт збережено": "Report saved", "Збираю звіт…": "Building report…",
    "Комутатор перезавантажується…": "Switch is rebooting…",
    "Автооновлення зупинено": "Auto-refresh paused", "Автооновлення відновлено": "Auto-refresh resumed",
    "Панель оновилась — перезавантажую": "Panel updated — reloading",
    "Зачекайте, виконується попередня дія": "Wait, previous action is running",
    "Вкажіть адресу файлу прошивки": "Enter the firmware file address",
    "Вкажіть хоча б один сервер": "Enter at least one server",
    "Дозволені номери 2–4094": "Numbers 2–4094 allowed",
    "Дозволені лише команди перегляду": "Only view commands allowed",
    "Порти мають бути різні": "Ports must differ",
    "Спочатку впишіть адреси камер у картках портів": "First enter camera addresses in the port cards",
    "Вільних портів немає": "No free ports", "усі камери відповідають": "all cameras respond",
    "перевірку завершено": "test finished", "зупинено": "stopped", "зупиняю…": "stopping…",
    "готово": "done", "перевіряю…": "checking…", "завантаження…": "loading…", "завантажую…": "loading…",
    "заливаю, це може тривати кілька хвилин…": "uploading, this may take a few minutes…",
    "перевіряю кабель, зачекайте…": "testing cable, please wait…",
    "порожньо": "empty", "не задано": "not set", "(пауза — введення)": "(paused — typing)",
    "(в мережі)": "(on network)", "(виконано, відповіді немає)": "(done, no output)",
    "оновлено": "updated", "Комутатор": "Switch",
    // одиниці / службове
    "Вт": "W", "Мбіт/с": "Mbit/s", "Кбіт/с": "Kbit/s", "біт/с": "bit/s", "Мбіт": "Mbit",
    "вхід": "in", "вихід": "out", "вільно": "free", "з": "of",
  };

  // динамічні фрази з числами
  const RULES = [
    [/^(\d+) з (\d+)$/, "$1 of $2"],
    [/^(\d+) з (\d+) Вт$/, "$1 of $2 W"],
    [/^опитано (\d+) з (\d+)…$/, "polled $1 of $2…"],
    [/^перевіряю (\S+) · (\d+) з (\d+)$/, "testing $1 · $2 of $3"],
    [/^знайдено (\d+) адрес(?:у|и)?$/, "found $1 addresses"],
    [/^готово: знайдено (\d+) адрес(?:у|и)?$/, "done: found $1 addresses"],
    [/^не відповідають: (.+)$/, "not responding: $1"],
    [/^(\d+) Вт з (\d+) Вт · вільно ([\d.]+) Вт$/, "$1 W of $2 W · $3 W free"],
    [/^вільно (\d+) Вт з (\d+) Вт$/, "$1 W free of $2 W"],
    [/^з (\d+) Вт \((\d+)%\)$/, "of $2% ($1 W)"],
    [/^вхід (.+) · вихід (.+)$/, "in $1 · out $2"],
    [/^за хвилину (\d+)% · за 5 хвилин (\d+)%$/, "1 min $1% · 5 min $2%"],
    [/^([\d.]+) з ([\d.]+) МБ$/, "$1 of $2 MB"],
    [/(\d+) днів?/g, "$1 d"], [/(\d+) годин[аи]?/g, "$1 h"], [/(\d+) хвилин[аи]?/g, "$1 min"],
  ];

  // заміна підрядків (одиниці, часті фрази) — застосовується коли точного перекладу немає
  const SUBST = [
    [/Мбіт\/с/g, 'Mbit/s'], [/Кбіт\/с/g, 'Kbit/s'], [/біт\/с/g, 'bit/s'], [/Мбіт/g, 'Mbit'],
    [/ Вт\b/g, ' W'], [/(\d) Вт/g, '$1 W'],
    [/шлюз /g, 'gateway '], [/останній запуск: /g, 'last start: '],
    [/живить пристрої/g, 'powering devices'], [/Заводський номер/g, 'Serial number'],
    [/увімкнення живлення/g, 'power-on'], [/перезавантаження з панелі/g, 'reboot from panel'],
    [/збій програми комутатора/g, 'switch software crash'],
    [/Годинник комутатора: /g, 'Switch clock: '], [/Сервери часу: /g, 'Time servers: '],
    [/за хвилину /g, '1 min '], [/за 5 хвилин /g, '5 min '],
    [/вільно /g, 'free '], [/ з /g, ' of '],
    [/(\d+) днів?/g, '$1 d'], [/(\d+) годин[аи]?/g, '$1 h'], [/(\d+) хвилин[аи]?/g, '$1 min'],
    [/(\d+) тижн(?:ів|і|ь)/g, '$1 w'], [/(\d+) секунд[аи]?/g, '$1 s'],
    [/опитано /g, 'polled '], [/знайдено /g, 'found '], [/перевіряю /g, 'testing '],
    [/адрес(?:у|и)?\b/g, 'addresses'], [/пакетів дійшло/g, 'packets received'],
    [/пристрій за адресою мовчить/g, 'device at this address is silent'],
    [/січня/g,'January'],[/лютого/g,'February'],[/березня/g,'March'],[/квітня/g,'April'],
    [/травня/g,'May'],[/червня/g,'June'],[/липня/g,'July'],[/серпня/g,'August'],
    [/вересня/g,'September'],[/жовтня/g,'October'],[/листопада/g,'November'],[/грудня/g,'December'],
  ];
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function translate(text) {
    const key = norm(text);
    if (!key) return null;
    if (DICT[key] !== undefined) return DICT[key];
    for (const [re, rep] of RULES) { if (re.test(key)) return key.replace(re, rep); }
    // м'який переклад: заміна відомих підрядків
    let out = key, changed = false;
    for (const [re, rep] of SUBST) { const n = out.replace(re, rep); if (n !== out) { out = n; changed = true; } }
    return changed ? out : null;
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE']);
  function skipNode(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (SKIP.has(el.tagName)) return true;
        if (el.classList && (el.classList.contains('term') || el.classList.contains('mono')
            || el.classList.contains('port') || el.dataset && el.dataset.noi18n)) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  let LANG = 'uk';
  function localize(root) {
    if (LANG !== 'en') return;
    root = root || document.body;
    // текстові вузли
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      if (skipNode(n.parentNode)) continue;
      const t = translate(n.nodeValue);
      if (t !== null && t !== norm(n.nodeValue)) {
        const lead = n.nodeValue.match(/^\s*/)[0], trail = n.nodeValue.match(/\s*$/)[0];
        n.nodeValue = lead + t + trail;
      }
    }
    // placeholder / title / value кнопок
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],button,option,th,label') : [];
    for (const el of els) {
      if (skipNode(el)) continue;
      for (const attr of ['placeholder', 'title']) {
        if (el.hasAttribute(attr)) { const t = translate(el.getAttribute(attr)); if (t) el.setAttribute(attr, t); }
      }
    }
  }

  // визначення мови
  try {
    const saved = localStorage.getItem('panelLang');
    if (saved) LANG = saved;
    else {
      const l = (navigator.language || 'en').toLowerCase();
      LANG = (l.startsWith('uk') || l.startsWith('ru')) ? 'uk' : 'en';
    }
  } catch (e) {}

  // перемикач у шапці
  function makeSwitcher() {
    const right = document.querySelector('.hdr-right');
    if (!right || document.getElementById('langBtn')) return;
    const b = document.createElement('button');
    b.id = 'langBtn'; b.className = 'btn'; b.title = 'Мова / Language';
    b.textContent = LANG === 'en' ? 'EN' : 'UK';
    b.onclick = () => {
      LANG = LANG === 'en' ? 'uk' : 'en';
      try { localStorage.setItem('panelLang', LANG); } catch (e) {}
      location.reload();
    };
    right.insertBefore(b, right.firstChild);
  }

  // спостерігач: перекладає нові вузли після перемальовувань
  let pending = false;
  function schedule() {
    if (pending || LANG !== 'en') return;
    pending = true;
    requestAnimationFrame(() => { pending = false; localize(document.body); });
  }
  function start() {
    document.documentElement.lang = LANG;
    makeSwitcher();
    if (LANG === 'en') {
      localize(document.body);
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
      setInterval(() => localize(document.body), 1500);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.__panelLocalize = localize;
})();
