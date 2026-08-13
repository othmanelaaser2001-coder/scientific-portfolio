# عارف حقك — Aref Haqqak

Moroccan law by category, offline, with short legal facts pushed as
notifications at random times of day.

The premise: a right you cannot cite is a right you cannot use. Every fact in
this app carries its article number, so it can be checked — and quoted.

---

## ⚠️ The corpus is a seed, not a source of truth

`META.verified` in `data.js` is `false`, and the app displays a warning banner
while it stays that way. The 33 entries were drafted from the general content
of the cited laws and **must be checked article by article against the official
consolidated texts** published by the Secrétariat Général du Gouvernement
(<https://www.sgg.gov.ma/>) before anyone relies on them.

Do not ship this to real users before that pass is done. An out-of-date "right"
is worse than no app: someone will assert it to an authority and be wrong.

When the review is complete, flip `META.verified` to `true` and the banner
disappears.

## What is here

| File | Role |
| --- | --- |
| `data.js` | The corpus: categories + articles, `ar`/`fr` text and a darija gloss |
| `app.js` | UI, search, routing, settings |
| `scheduler.js` | Builds the rolling plan of random notification times |
| `store.js` | IndexedDB + notification delivery, **shared with the SW** |
| `sw.js` | Offline cache + background delivery |

Plain ES modules and a static server. No build step, no bundler, no backend,
no accounts, no analytics, no network calls at runtime.

## Running it

```sh
cd lawapp
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

Service workers and notifications need a secure context: `localhost` counts,
any other host needs HTTPS.

## How the random notifications work

There is no web API for "wake me in three days". So the app keeps a rolling
7-day plan of concrete timestamps in IndexedDB (`store.js`), each entry
carrying its own pre-rendered title and body — the service worker never needs
the corpus, it just fires what the page prepared.

Delivery uses the best path the browser offers:

1. **Notification Triggers** (`showTrigger` + `TimestampTrigger`) — the only
   true offline timer. Chromium only, feature-detected.
2. **Periodic Background Sync** — fires roughly hourly in installed PWAs.
3. **Foreground catch-up** — on load, on tab focus, and every 5 minutes while
   the app is open. Works everywhere.

Guardrails in `flushDue`:

- entries more than **6 hours** stale are marked delivered but never shown —
  nobody should wake to eleven notifications from a phone that was off;
- at most **2** are shown in a single pass;
- pending entries are capped at **60**, under the iOS limit of 64.

### The iOS caveat — read this before choosing PWA

On iPhone, only path (3) works. The app must be added to the home screen for
notifications to be permitted at all, and even then the browser will not
guarantee that a fact arrives at 14:37 — it arrives when the app is next
opened. The app says this in the settings screen rather than hiding it.

If reliable background notifications turn out to be the feature that matters
most, that is the argument for a native or React Native build. Everything in
`data.js` is plain data and carries over unchanged.

## Adding to the corpus

Append to `ARTICLES` in `data.js`:

```js
{
  id: 'unique-slug',           // used in deep links (#/a/<id>) — never renumber
  cat: 'police',               // one of CATEGORIES
  ref: { law: '…', art: '66' },// shown under every fact; required
  title: { ar: '…', fr: '…' },
  fact:  { ar: '…', fr: '…' }, // ≤ 150 chars — this is the notification body
  dz:    '…',                  // darija gloss, Arabic script
  body:  { ar: '…', fr: '…' }, // the detail card
  tags:  ['…'],                // extra search keywords
}
```

Two rules: **no entry without a citable article**, and keep `fact` short enough
to survive a notification shade.

## Roadmap

- [ ] Verify all 33 entries against the Bulletin Officiel; set `verified: true`
- [ ] Extend to consumer law (31-08), housing/tenancy, and data protection (09-08)
- [ ] Share-as-image, so facts spread through WhatsApp rather than app installs
- [ ] Signed JSON corpus fetched from a CDN, so amendments ship without an app update
- [ ] Native or RN build if background notification reliability proves decisive

## Scope

This app provides general legal information. It is not legal advice, and it is
not a guide to arguing with anyone. It tells you what a text says and where to
find it. For a dispute, see a lawyer.
