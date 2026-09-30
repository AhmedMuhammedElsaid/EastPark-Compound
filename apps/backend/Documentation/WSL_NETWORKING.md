# WSL2 Networking — How Frontend & Backend Connect

## Where everything runs

```
Your PC (Windows)
├── WSL2 (Linux VM inside Windows)
│   └── NestJS backend  →  listens on 0.0.0.0:3000
│       └── WSL's own IP: 172.27.220.64  (changes on every WSL restart)
│
└── Windows itself
    ├── LAN IP: 192.168.1.191  (assigned by your router — stable)
    └── Expo Metro bundler  →  serves the JS bundle to your phone
```

```
Your Phone (on same WiFi)
└── Expo Go app
    ├── Downloads JS bundle from Metro  →  192.168.1.191:8081
    └── Makes API calls to backend     →  192.168.1.191:3000
```

---

## The problem: WSL2 is behind a NAT

Your phone sees **one IP: `192.168.1.191`** (your Windows machine). It has no idea WSL exists.

When the phone calls `192.168.1.191:3000`, the request hits **Windows** — but NestJS is running inside **WSL**, which is a separate Linux VM with its own IP. Windows does not automatically bridge that gap.

```
Phone → 192.168.1.191:3000 → Windows → ??? → WSL:3000 (NestJS)
                                    ↑
                           nothing here by default
```

---

## The fix: Windows port proxy

Two commands, run once in **PowerShell as Administrator**:

```powershell
# Forward any traffic arriving on Windows port 3000 → WSL port 3000
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.27.220.64

# Open Windows Firewall to allow the phone's traffic through
netsh advfirewall firewall add rule name="WSL NestJS 3000" dir=in action=allow protocol=TCP localport=3000
```

After this:

```
Phone → 192.168.1.191:3000 → Windows → portproxy → WSL 172.27.220.64:3000 → NestJS ✓
```

The **firewall rule is permanent** — add it once, never again.

The **portproxy rule must be re-run every time WSL restarts** because the WSL internal IP changes (see below).

---

## Why the WSL IP changes on restart

WSL2 is a VM. Windows assigns it a random internal IP at boot — like DHCP for a VM. So `172.27.220.64` is only valid for the current session.

**Each time WSL restarts:**

```bash
# 1. Get the new WSL IP
hostname -I

# 2. Re-run the portproxy with the new IP
# (in PowerShell as Administrator)
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<new-ip>
```

---

## Why the backend runs in WSL and not on Windows

Nothing forces it — NestJS is just Node.js and can run on either. But there are two reasons WSL is the right choice here:

**1. Docker runs in WSL.**
All local dev services (Postgres, Redis, MinIO, Mailpit) run as Docker containers inside WSL. NestJS connects to them via `localhost:5432`, `localhost:6379`, etc. If NestJS ran on Windows, `localhost` would point to Windows — where nothing is listening — and the server would crash on startup.

**2. Linux tooling.**
Most Node/Docker/Prisma docs assume a Linux environment. Fewer edge cases with file permissions, line endings, and shell scripts.

| Where you run `pnpm dev` | Where NestJS runs | Can reach Docker? |
|---|---|---|
| WSL terminal | WSL (`172.27.220.64`) | ✅ Yes — same `localhost` |
| PowerShell / CMD | Windows (`192.168.1.191`) | ❌ No — different `localhost` |

---

## Full request flow when the app is open on the phone

```
1. Phone opens Expo Go
        ↓
2. Connects to Metro bundler at 192.168.1.191:8081
        ↓
3. Downloads the compiled JS bundle (your React Native app)
        ↓
4. Bundle runs on the phone — user sees the app
        ↓
5. App makes API call → 192.168.1.191:3000/v1/shops
        ↓
6. Windows receives the request
        ↓
7. portproxy forwards it → WSL 172.27.220.64:3000
        ↓
8. NestJS handles the request → queries Postgres → returns JSON
        ↓
9. Response travels back through the same chain → phone renders shops
```

---

## Frontend env config

`apps/mobile/.env.local` — this file controls the API URL baked into the JS bundle:

```
EXPO_PUBLIC_API_URL=http://192.168.1.191:3000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.191:3000
```

If your Windows LAN IP changes (e.g. you moved networks), update this file and restart the Expo dev server.

---

## Quick reference

| Task | Command |
|---|---|
| Get WSL IP | `hostname -I` (in WSL) |
| Re-apply portproxy after WSL restart | `netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<wsl-ip>` (PowerShell as Admin) |
| Check existing portproxy rules | `netsh interface portproxy show all` (PowerShell) |
| Delete a portproxy rule | `netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0` (PowerShell as Admin) |
| Start backend | `pnpm dev` (in WSL, inside `apps/backend/`) |
| Start frontend | `pnpm start` (in `apps/mobile/`) |
