# Abderrahmane Scanner

A mobile-first PWA that turns a phone camera into a scanner for **long, narrow
objects** — leather straps, belts, mouldings, rules, fabric strips, machined
parts — that do not fit inside a single photograph.

It behaves like a panorama scanner, not a document scanner: you sweep the phone
along the object, frames are chosen automatically, and the result is one
continuous high-resolution image you can measure in millimetres and centimetres.

Everything runs on the device. There is no backend, and no image ever leaves the
phone.

---

## How it works

```
camera stream
   │
   ├─► sampler (~15 Hz)  ──► vision worker ──► alignment, sharpness, overlap
   │                                              │
   │                             live guidance ◄──┤
   │                                              │
   └─► when overlap reaches the target ───────────┘
             │
             ├─► full-resolution frame ──► JPEG ──► IndexedDB
             └─► low-resolution copy ──► pairwise transform (kept in memory)

Finish Scan
   │
   ├─► refinement pass: re-align stored frames at higher precision
   ├─► global plan: chain transforms, cancel scale drift, straighten, size output
   ├─► progressive render: one frame decoded at a time, exposure-matched, feathered
   ├─► crop analysis: coverage bounds and the object's own bounds
   └─► quality score with plain-language explanations
```

### The alignment core (`src/vision`)

An ORB-style detector and descriptor written from scratch in TypeScript, so
there is no multi-megabyte WebAssembly download and the whole app works offline
on first load:

| Stage | File | Notes |
| --- | --- | --- |
| FAST-9 corners | `fast.ts` | adaptive threshold, Shi-Tomasi ranking, grid bucketing so features spread across the frame |
| Orientation | `fast.ts` | intensity centroid, as in ORB |
| rBRIEF descriptor | `brief.ts` | 256 bits, deterministic Gaussian sampling pattern, 30 pre-rotated copies |
| Matching | `match.ts` | brute-force Hamming with popcount, Lowe ratio test, cross-check |
| Model fitting | `estimate.ts`, `ransac.ts` | RANSAC over 2-point similarity models, iterative refit, optional tightly-bounded affine refinement |
| Fallback | `align.ts` | coarse-to-fine SAD translation search, used only when a surface is too uniform for features; its confidence is capped so it can never look authoritative |

Typical cost is **3–8 ms per frame pair** at 384 px working resolution, which is
what keeps the live loop responsive.

### Why the object is never stretched

The default motion model is a **similarity transform** — rotation, uniform scale
and translation. A similarity has no way to stretch one axis to force frames to
agree, so real proportions survive stitching. A full affine refinement is only
accepted when its shear and anisotropy stay under ~4.5% *and* it fits measurably
better; anything looser is rejected in favour of the similarity.

Two global corrections are applied, both of which preserve shape:

- **Scale-drift cancellation** removes the systematic zoom that accumulates over
  a long chain of pairwise estimates (clamped to ±1% per step).
- **Straightening** rotates the finished mosaic so the object runs along an
  axis. It is skipped entirely if the required angle exceeds 35°, because that
  means the sweep was not straight and rotating would only mislead.

No pixel is ever invented. Regions the camera did not see stay transparent and
are cropped away.

### Live guidance

The sampler measures, every frame: overlap with the last keyframe, a
contrast-normalised variance-of-Laplacian sharpness score, sweep speed in frame
widths per second, and alignment confidence. Those drive the messages —
*Move slowly*, *Good*, *Hold steady*, *Move back slightly*, *Not enough overlap*,
*Scan complete* — and the automatic capture decision. There is no shutter button.

The scanner also shows the previous frame ghosted at its current position, so
the required overlap is something you can see rather than guess at, and a live
preview strip that builds the mosaic up as you move.

### Performance and memory

- Alignment runs on **downscaled copies**; the resulting transforms are applied
  to the full-resolution originals only at render time.
- Full-resolution frames are stored as JPEG blobs in **IndexedDB**, not held in
  the JS heap. The frame budget is derived from the origin's storage quota at
  startup, and capture stops cleanly if the quota runs out.
- Rendering decodes **one frame at a time**, yielding to the UI between frames.
- The output size is probed against the browser's real canvas limits (they vary
  enormously between iOS Safari and desktop Chrome) and backed off until an
  allocation actually succeeds, so nothing is downscaled unnecessarily and
  nothing is attempted that would silently produce a blank canvas.
- Temporary frames are deleted as soon as the mosaic exists.

### Measurements

Calibrate once by tapping two points a known distance apart, then tap any two
points to read a real-world distance in mm or cm. Measurements are anchored to
mosaic coordinates, so they survive cropping, rotation and straightening. They
render as technical-drawing dimension lines and can be burned into the export.

The accuracy indicator combines scan quality, render scale and how precisely the
reference points could be placed. It is an estimate, and the app says so — these
are not laboratory-grade measurements.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 — --host also exposes it on the LAN
npm run build
npm run preview
```

The camera needs a secure context. `localhost` counts; to test from a phone on
your network, serve the build over HTTPS or use a tunnel.

### Tests

```bash
npm run lint
npm run test:unit      # synthetic validation of the alignment core

npm run test:fixtures  # generates ~200 MB of synthetic camera feeds (needs numpy)
npm run build
npm run test:e2e       # drives the built PWA in Chromium with a fake camera
```

`test/make_fixture.py` renders a long leather strap with punched holes,
stitching and a lighting gradient, then sweeps a camera window along it and
writes the result as a Y4M file. Chromium replays that file as the rear camera,
so the end-to-end run exercises the real pipeline: capture decisions, worker
alignment, refinement, stitching, cropping, quality scoring, calibration,
measuring, editing, export, and offline load from the service worker.

Three feeds are covered: a left-to-right sweep, a top-to-bottom sweep, and a
deliberately rushed sweep that must be graded down and explained rather than
silently accepted.

---

## Project layout

```
src/
  vision/     feature detection, matching, robust model fitting, overlap maths
  workers/    vision worker + typed client (all heavy CV runs off the main thread)
  scan/       camera access, sampling loop, capture decisions, live preview
  storage/    IndexedDB frame store and cleanup
  stitch/     refinement pass, global plan, progressive renderer, crop, quality
  viewer/     zoom/pan/rotate/crop viewer, annotations, export
  measure/    calibration and measurement model
  pwa/        service worker registration, install prompt
  ui/         icons, debug panel
test/         synthetic fixtures, unit checks, end-to-end browser run
```

## Browser support

Targets installed PWAs on **iOS Safari** and **Android Chrome**. Safe-area
insets, `playsinline` capture, non-passive gesture handling and a `roundRect`
fallback are all in place; `OffscreenCanvas` and `ctx.filter` are deliberately
avoided because their support is uneven. Exposure compensation is done with
exact composite operations instead.
