# URE BOY — cross-device cloud saves (setup)

The console stores accounts and saves in the browser by default (per-device).
Turn on **cloud sync** and one account works across every device you set up —
phone, laptop, whatever. It's backed by a single **GitHub Gist** (one JSON file).

> **Security, on purpose:** the gist is *public*, so anyone can read the account
> list and save data. The passcodes are only lightly hashed. **Do not use a real
> password.** The one genuinely sensitive value — the write token — never leaves
> the device you enter it on and is never committed anywhere.

Why a token per device? GitHub has no anonymous write. *Reading* the gist is
public (so any device can log in and pull saves with no setup at all), but
*writing* needs a token. A token committed into this public site would (a) be
auto-revoked by GitHub's secret scanning within minutes and (b) let any visitor
overwrite the store — so instead you paste a token once on each of *your* devices.

---

## One-time setup (≈3 minutes)

### 1. Make a token (each device that should save to the cloud)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** — <https://github.com/settings/tokens/new>
2. Note: `ureboy cloud`. Expiration: your call.
3. Scope: check **only `gist`**. (Nothing else — this token can *only* touch gists, never your repos or the live site.)
4. **Generate token** and copy it (starts with `ghp_…`).

*(A fine-grained token also works if you scope it to "Gists: read and write".)*

### 2. Link your first device

1. Open **isaacure.com/ureboy/**. At the `who are you?` prompt, type **`sync`** and press enter.
2. Paste your token.
3. At `gist id?`, **just press enter** — the console creates a fresh cloud gist for you and prints its **gist id**. Copy it.
4. Now log in / create your account as normal. Play something — your progress uploads automatically.

### 3. Link your other devices

On each additional device:

1. `who are you?` → type **`sync`** → paste that device's token (make one per device, or reuse — your call).
2. At `gist id?`, paste the **gist id from step 2.3** (so every device shares the same cloud).
3. Log in with the **same account name + passcode**. Your saves pull down.

That's it. From then on each device warm-boots straight into your account and
syncs in the background. The 👤 button shows **☁** when a device can read+write,
**☁·** when it's read-only (logged in but no token here).

---

## Notes

- **Read-only devices.** A device with the gist id but no token can still log in
  and *play* from the cloud; new progress just stays local until you add a token
  (`sync` again). Handy for letting a friend peek without handing over a token.
- **Conflicts.** Saves merge per key by "last write wins" (your phone's GTI RUN
  score and your laptop's PIT LANE season both survive). Two devices writing the
  same key within seconds: the later write wins.
- **Unlink a device.** `sync` → type `off`. Clears the token + gist id from *that*
  device only; the cloud data stays.
- **Bake it in (optional).** If you'd rather not enter the gist id on each device,
  put it in `ureboy/cloud.js` → `CFG.gistId`. That ships cloud "read" on for
  everyone (still needs a per-device token to write). The gist id is safe to
  publish; the token is not — never put a token in the file.
- **Offline.** No network? The console falls back to the local save and syncs on
  the next successful connection. Nothing blocks on the cloud.
