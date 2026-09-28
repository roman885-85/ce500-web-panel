# CE500 Web Panel

A modern browser-based management panel for the **Cisco Catalyst Express 500**
series switch (WS-CE500-24PC and siblings) — a replacement for the long-gone
Device Manager, running **inside the switch itself**.

No software to install: the panel is a set of static files served from the
switch's own flash. It talks to the switch through its built-in HTTP CLI
(`/level/15/...`), so it works from any browser on any OS — the same way the
original Cisco Device Manager did.

> The UI is in Ukrainian (it was built for a specific site). Everything is plain
> HTML/CSS/JS in `panel/` — translating strings or swapping the logo/brand is
> straightforward. See **Make it yours** below.

## Why this exists

These switches are end-of-life. On many second-hand units the flash has been
wiped, so the switch boots from its built-in emergency IOS image (`ucode0:`) and
the Device Manager files are simply gone — every browser just shows the
"Software Recovery" page. This panel puts a full management UI back, without
needing the original firmware. (SSH/telnet are not an option on this model — the
LANBASE image has no `transport input` on the vty lines and never listens on
22/23. Web is the only management channel, by design.)

## Features

- **Front-panel view** — all ports at a glance: link, speed, PoE wattage,
  errors; click a port for details and control.
- **System monitor** — live CPU / memory / traffic / PoE graphs with history,
  plus fan/temperature/power status.
- **Cable diagnostics (TDR)** — per-pair length in metres and fault location
  (open/short), for the whole switch or one port.
- **Per-port traffic & error counters** — spot a failing cable before a camera
  drops.
- **Devices** — everything the switch sees by MAC, with **IP address** (via an
  on-switch ARP sweep), vendor lookup (OUI), the port it's on, and an editable
  **device name** stored on the switch.
- **PoE control** — per-port power reset/enable, budget overview.
- **VLANs**, **port security** (bind a device to a port), **storm control**,
  **port mirroring (SPAN)**.
- **Terminal** — a real in-browser CLI with modes (`configure terminal`,
  `interface Fa5`), history, `?`/Tab hints, and drag-and-drop of a command file
  or a port from the diagram.
- **Event log** as a readable table (which port went up/down and when).
- **Config save/backup**, **state report to a file**, **firmware upload**.
- **Password**, light/dark theme, built-in help.

## Install

You need a machine on the same LAN as the switch (the switch downloads the files
from it over HTTP). Then:

```sh
SW=192.168.1.250 scripts/deploy.sh
```

This serves `panel/` over HTTP and copies each file into `flash:html/` on the
switch. Point the switch's web server at that folder once:

```sh
SW=192.168.1.250 scripts/sw.sh "configure terminal ; ip http path flash:html"
SW=192.168.1.250 scripts/sw.sh "write memory"
```

Open `http://<switch-ip>/` and you're in. After each redeploy, bump the `?v=N`
version in `index.html`/`home.html` (the switch's file server sends a long
cache header).

If the flash was wiped and the switch is on its emergency image, `write memory`
won't work there — the panel and scripts fall back to
`copy running-config flash:config.text` automatically.

## Scripts

All scripts take `SW` (switch IP, default `192.168.1.250`) and `SWAUTH`
(`user:pass`, default `admin:admin`) as environment variables.

| Script | What it does |
|---|---|
| `scripts/sw.sh <cmd>` | Run any switch command (`sw.sh show interfaces status`) |
| `scripts/deploy.sh` | Upload the panel from `panel/` to the switch |
| `scripts/firmware.sh <file.tar>` | Install an IOS image (image-only, keeps the panel) |
| `scripts/restore-config.sh` | Push a saved running-config back |
| `scripts/tftp-recv.py` | Tiny TFTP receiver to pull files off the switch |

## Make it yours

- **Brand:** replace `panel/logo.png` and the church name in
  `panel/index.html` / `home.html` (`<div class="church">`). Colours are CSS
  variables at the top of `panel/style.css`.
- **Password:** default is `admin/admin`. Change it in the panel's *Безпека*
  (Security) tab, or set `SWAUTH` for the scripts.
- **Language:** all strings are inline in `panel/app.js`, `index.html`,
  `home.html`.

## Firmware images

Cisco IOS images (`.bin`/`.tar`) are **not** included — they are proprietary to
Cisco. Obtain them from Cisco under your own entitlement. For this model the
last releases are `12.2(25)SEG*` (`ce500-lanbase...` / `ce500-lanbasek9...`).
The panel's firmware-upload and `scripts/firmware.sh` install an image you
provide.

## Model limits

- Ports 1–24 are 100 Mbit with 802.3af PoE (15.4 W/port, 370 W total). PoE+
  (30 W) cameras won't power up. Two ports are gigabit, no PoE.
- The switch's own HTTPS is SSLv3-only (dead in modern browsers) and is left
  off — put TLS in front of it at the router if you expose it.
- Non-Latin port descriptions aren't supported by the switch; the panel keeps
  names in its own files and writes a transliteration to the port.
- Any `copy running-config` / `write memory` briefly drops the web sessions
  (~30–60 s) while the switch re-applies config. That's normal.

## License

MIT for the panel code and scripts. Cisco firmware is not covered — see `LICENSE`.
