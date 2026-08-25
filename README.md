# Relay — Wireless Presentation System

Upload a deck, get an 8-character host code, and drive it wirelessly from
any phone. Built as a static site (HTML/CSS/vanilla JS, ES modules) on top
of Firebase Authentication, Realtime Database, Storage, and Hosting — no
build step required.

```
index.html
css/style.css
js/
  firebase-config.js   ← your project keys (public, replaceable)
  firebase-init.js     ← SDK bootstrap + anonymous auth
  utils.js              icons.js
  room.js              ← Realtime Database room/session logic
  storage.js            presentation.js
  slideshow.js  host.js  remote.js  main.js (router)
database.rules.json    ← Realtime Database Security Rules
storage.rules           firebase.json   .firebaserc
functions/              ← optional PPT/PPTX conversion stub (not required)
```

## 1. Before you deploy — fix the config

I corrected one thing in `js/firebase-config.js`: the `authDomain` you sent
was the Realtime Database URL, but Auth needs the hosting domain shape
`<project-id>.firebaseapp.com`. I set it to
`ff-tournament-app-abcf0.firebaseapp.com` — double-check that matches your
project in **Firebase Console → Project settings → General**.

Also worth knowing: that `apiKey` isn't a secret. It's the standard public
identifier Firebase issues for browser apps — anyone can see it in your
site's source, by design, the same way they can see your project ID. What
actually protects your data is `database.rules.json` and `storage.rules`
(below), never hiding this object. **Never** put a service-account JSON or
Admin SDK credential in frontend code — that *is* a real secret, and the
optional `functions/` folder shows the correct place for anything like that
(a Cloud Function's server-side config).

## 2. Firebase Console setup (one time)

1. **Authentication** → Sign-in method → enable **Anonymous**. This is the
   only auth method the app uses — there is no sign-in screen; every visitor
   is signed in silently on page load so Security Rules have a `uid` to
   check against.
2. **Realtime Database** → Create database → start in locked mode (rules
   below will replace the default).
3. **Storage** → Get started → default bucket is fine.
4. **Hosting** → Get started (only needed if you deploy via `firebase
   deploy`; skip if you're hosting elsewhere).

## 3. Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use ff-tournament-app-abcf0     # or: firebase use --add
firebase deploy --only hosting,database,storage
```

That pushes the static site, `database.rules.json`, and `storage.rules` in
one shot. To run it locally first: `firebase emulators:start` or just serve
the folder with any static server (it's plain ES modules, no bundler).

## 4. How a session works

```
SLIDE SHOW → upload → Storage stores the file → a room is created at
  /rooms/{HOSTCODE} in Realtime Database → code is shown on screen
       ↓
HOST enters the code → subscribes to /rooms/{code} → renders the current
  slide → pushes control commands to /rooms/{code}/state
       ↓
MOBILE REMOTE enters the same code → joins /rooms/{code}/controllers/{uid}
  → sends Next/Prev/First/Last/Play-Pause by writing /rooms/{code}/state →
  every connected screen updates instantly via Firebase's realtime listeners
```

Room shape:

```
rooms/{CODE}/
  meta:  { hostUid, name, fileName, fileType, fileKind, fileURL, slideCount, status, createdAt }
  state: { currentSlide, isPlaying, fullscreen, updatedAt }
  controllers/{uid}: { label, joinedAt, lastSeen }
```

Codes are generated from a 32-character alphabet with easily-confused
characters (`0/O`, `1/I`) removed, e.g. `DAKU7284` — 8 characters gives
32⁸ (≈1.1 trillion) combinations, so accidentally landing on someone else's
live room by mistyping is effectively impossible; `findRoom()` also fully
validates the code exists and hasn't been ended before letting anyone join.

**Reconnection**: the app never implements retry logic itself — it mirrors
Firebase's own `.info/connected` signal, and the SDK transparently
re-establishes the socket and replays listeners on its own, which is what
"Connected / Reconnecting…" reflects on both the Host and Remote screens.

## 5. Security model (`database.rules.json` / `storage.rules`)

- Every visitor is signed in **anonymously** the instant the page loads
  (`ensureSignedIn()`), purely so rules have a stable `auth.uid` to check —
  no login screen is ever required to use the app.
- **Only the uploading host's `uid`** can create, edit, or delete a room's
  `meta` (this is also what `endRoom()` relies on to cascade-delete the
  whole room in one call).
- **Anyone holding the host code** may push playback state
  (`/state/currentSlide`, `isPlaying`, `fullscreen`) — same trust model as
  a physical presentation clicker: knowing the code *is* the authorization,
  and every write is still shape-validated (numbers/booleans only, capped
  ranges) so a controller can't inject arbitrary data.
- A mobile controller can only create/update/delete **its own** presence
  node under `/controllers/{uid}` — never anyone else's.
- Storage: uploads/deletes require `request.auth.uid` to match the folder
  owner and are capped at 250 MB with an allow-listed content-type; reads
  are public so the stage, the mobile preview, and pdf.js can all fetch the
  file by URL without re-authenticating.

## 6. One external dependency to be aware of

PDF rendering loads `pdfjs-dist` from jsDelivr at runtime
(`js/presentation.js`, `PDFJS_VERSION`). If PDFs stop rendering, it's almost
always this — bump `PDFJS_VERSION` to whatever's current on
[npmjs.com/package/pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist).
Everything else (Firebase SDK, fonts) is also CDN-loaded with no build step,
by the same logic — no bundler, no `node_modules` for the frontend itself.

## 7. File format support (be realistic about this)

| Format | Behavior |
|---|---|
| **PDF** | Fully paginated in-browser via [pdf.js](https://mozilla.github.io/pdf.js/) — real slide count, real per-slide rendering. |
| **JPG / PNG / SVG / GIF / WEBP** | Rendered directly as a single slide. |
| **PPT / PPTX / KEY / ODP** | These are proprietary zip/binary formats with **no native browser renderer** — this app does not pretend otherwise. The file still uploads, stores, and drives a fully working room (code generation, host/remote sync, connection status), just as one placeholder "slide" that links out to the original file. For real slide-by-slide control, either export to PDF before uploading, or wire up the optional `functions/index.js` stub, which shows the correct pattern: a Storage-triggered Cloud Function calls a conversion service (CloudConvert, Aspose, or a self-hosted headless LibreOffice) and writes the resulting slide-image URLs + real count back into `meta`. |

## 8. Design

Dark "broadcast control room" theme — Space Grotesk for display type, Inter
for UI text, IBM Plex Mono for the host code and status readouts. The
signature element is the host-code **split-flap board** (`.code-board`) and
the pulsing tally-light dot, both borrowed from on-air studio consoles,
since this is literally a wireless *relay* between a deck and a screen.
