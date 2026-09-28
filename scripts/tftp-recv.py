#!/usr/bin/env python3
"""Мінімальний TFTP-приймач (лише запис файлів, RFC 1350). Зупиняється сам після простою."""
import os, socket, struct, sys, time
OUT = sys.argv[1]; IDLE = int(sys.argv[2]) if len(sys.argv) > 2 else 120
srv = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
srv.bind(("0.0.0.0", 69)); srv.settimeout(IDLE)
print("TFTP слухає, тека:", OUT, flush=True)
while True:
    try:
        pkt, peer = srv.recvfrom(2048)
    except socket.timeout:
        print("простій — зупиняюсь", flush=True); break
    op = struct.unpack("!H", pkt[:2])[0]
    if op != 2:                      # приймаємо лише запис (WRQ)
        srv.sendto(struct.pack("!HH", 5, 4) + b"only write\0", peer); continue
    name = os.path.basename(pkt[2:].split(b"\0")[0].decode(errors="replace")) or "file.bin"
    path = os.path.join(OUT, name)
    t = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); t.bind(("0.0.0.0", 0)); t.settimeout(15)
    t.sendto(struct.pack("!HH", 4, 0), peer)
    expect, size = 1, 0
    with open(path, "wb") as f:
        while True:
            try:
                data, p2 = t.recvfrom(1024)
            except socket.timeout:
                print("обрив передачі:", name, flush=True); break
            if struct.unpack("!H", data[:2])[0] != 3: continue
            blk = struct.unpack("!H", data[2:4])[0]; body = data[4:]
            if blk == expect:
                f.write(body); size += len(body); expect = (expect + 1) & 0xFFFF
            t.sendto(struct.pack("!HH", 4, blk), p2)
            if blk == (expect - 1) & 0xFFFF and len(body) < 512: break
    t.close()
    print(f"отримано {name}: {size} байт", flush=True)
