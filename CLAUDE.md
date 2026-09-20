# rust-road-traffic-ui

The web interface of [rust-road-traffic](https://github.com/LdDl/rust-road-traffic): a road traffic
detector that watches a camera, tracks vehicles and counts them per zone. This repo is only the
front end; everything it shows comes from that app's REST API.

## How it ships

The backend embeds this UI into its binary at compile time. There is no separate web server.

```shell
npm run build                       # → ./build (adapter-static, no SSR)
cp -r build/* ../../rust_work/rust-road-traffic/src/rest_api/static/build/
# then rebuild the backend: its build.rs picks up src/rest_api/static/build
```

The built files are committed in the backend repo, so a UI change is two commits: one here, one
there. During development run `npm run dev` and point the UI at a running backend — CORS is open
(`allow_any_origin`), and the API base URL is taken from `window.location` with a persisted
override in `src/store/state.ts` (`settings:api_schema` / `_host` / `_port`, default port 42001 in
dev).

## Stack

Svelte 5 + SvelteKit 2 (adapter-static, `fallback: null`, so no client-side routing fallbacks),
Tailwind 4 + daisyUI 5, MapLibre GL + `@mapbox/mapbox-gl-draw` for the map, Fabric.js for the video
canvas, plain `fetch` (axios is a dependency but barely used).

- `src/components/` — the screen: `CanvasComponent` (video frame + zone polygons), `MapComponent`
  (satellite/vector map + the same zones in WGS84), `Toolbar`, `IPForm` (API address),
  `ConfigurationStorage` (zone list), `StylesForm`, `Switchers`.
- `src/lib/` — the drawing layer: `custom_canvas.ts`, `custom_poly.ts`, `custom_line.ts`,
  `edge_labels.ts`, `vertex_labels.ts`, plus `zones.ts` (the `Zone` type) and
  `rest_api_mutations.ts` (writes).
- `src/store/` — `data_storage` (zones as `Map<string, Zone>`), `map`, `state`, `theme`.

Run `npm run check` (svelte-check) before finishing; `npm run format` for prettier.

## What the UI is today

One screen for **setting a camera up**: draw a zone on the video frame, draw the same zone on the
map, link the two, save. That is the calibration step — the backend derives pixels-per-metre from
the two quadrilaterals, so the accuracy of every speed reading comes from how carefully those eight
points are placed.

What it is not yet: anything for **running** the installation. No status, no analytics, no logs, no
settings other than zones. That is what the work below is about.

## The API

Everything is under `/api`, unauthenticated, documented at `/api/docs` (RapiDoc) and
`/api/docs.json` (OpenAPI).

| endpoint | purpose |
| --- | --- |
| `GET /ping` | `pong`; the way to tell the app is up, e.g. after a restart |
| `GET /status` | what is running right now — see below |
| `GET /logs?limit=&level=&scope=` | tail of the log file, newest last |
| `GET/PUT /config` | the settings as saved; PUT takes a partial patch |
| `POST /redis/check` | try a Redis host before saving it |
| `POST /mutations/restart` | restart the app in place |
| `GET /polygons/geojson` | the zones |
| `POST /mutations/zones/{create,update,delete}`, `/mutations/replace_all` | change zones |
| `GET /mutations/save_toml` | write the current zones into the config file |
| `GET /stats/all` | traffic statistics for the last completed period |
| `GET /realtime/occupancy` | how many vehicles are in each zone right now |
| `/live`, `/live/mjpeg` | the annotated video stream (when MJPEG is enabled) |

Both statistics answers carry the zone's `id`, the same one `/polygons/geojson` reports, so a row
joins onto a zone without guessing. The OD matrix is keyed differently, by
`ld-{lane_direction}_ln-{lane_number}` built from the two fields next to that `id`.

### `GET /status`

`equipment_id`, `version`, `uptime_seconds`; `input` (source, `kind` live/file, probed
`width`/`height`/`fps`, `frames_processed`, `frames_dropped`, `processing_fps`, `last_frame_at`);
`detection` (`backend`, `cuda_available`, `model`, `inference_ms`, `postprocess_ms`,
`tracking_ms`); `tracking.description`; `redis`; `logging`; `last_problem` (the most recent warning
or error with its scope); and `restart_required` + `pending_changes`.

### `GET/PUT /config`

`GET` returns the configuration file's contents without the zones, without the Redis password
(`password_set: true|false` instead) and without anything that describes the model — which model
runs, its input size and its class list are part of how the device was built, are set over SSH, and
are neither reported nor accepted here. `PUT` takes only the keys to change:

```json
{"input": {"video_src": "rtsp://cam/stream"}, "verbose": {"level": "debug"}}
```

It validates the same way loading the file does, writes the file immediately, and answers
`{"message": "ok", "restart_required": true, "changed": ["input.video_src"]}`.

## Constraints that shape the design

Read these before drawing any screen. Most of them are not obvious from the endpoint list, and
several of them decide what the analytics view can honestly show.

**Statistics come in windows, and only the last one exists.** The backend aggregates over
`worker.reset_data_milliseconds` (default 30 s). At each boundary it computes the window's numbers,
publishes them, and clears the counters. `GET /stats/all` therefore returns one window — the last
completed one — and its values do not move between boundaries. `period_start` / `period_end` in the
answer identify the window. Windows are independent, not cumulative: do not diff them.

**Nothing is stored server-side.** There is no history endpoint and no database. A chart over time
can only be built by polling and accumulating in the browser, and it starts when the page is
opened. Say so in the interface rather than implying the app remembers.

**Poll faster than the window, or lose windows.** At the default 30 s, polling every 30 s will drop
roughly every other window whenever the two drift. Poll at about a third of
`worker.reset_data_milliseconds` (readable from `/config`) and treat `period_end` as the key: a new
value means a new window to append, the same value means nothing happened yet.

**Period timestamps are not wall clock on a video file.** They start from `Utc::now()` and then
advance by the configured step per processed window, which follows media time. On a file that plays
faster than real time the labels run ahead. For a live camera they behave.

**A restart wipes everything runtime.** Counters, uptime, the OD matrix, `last_problem`. The API is
unreachable for a second or two while it happens. Detect it by `uptime_seconds` going backwards (or
`version` changing) and mark the discontinuity in any accumulated series instead of drawing a line
across it.

**Zones apply immediately, but are not saved until asked.** `replace_all` changes the running app;
only `save_toml` writes them to the configuration file. So a zone edit that was not saved is lost
on the next restart — including a restart the user triggers from the settings screen after changing
something else. Warn before restarting with unsaved zones.

**Zone writes are last-writer-wins.** `replace_all` replaces the whole set, there is no version or
ETag, and two open tabs will overwrite each other silently. Re-fetch `/polygons/geojson` after any
write, and consider refusing to save if the set changed underneath.

**Saved is not running.** `/config` is what the file says, `/status` is what the process is doing;
almost every setting is read once at startup. `status.restart_required` and
`status.pending_changes` are the difference between the two, and they survive a page reload, unlike
the answer to a `PUT`. Show them as a persistent banner, not a toast.

**The API has no authentication yet.** Anyone who can reach the port can read the configuration
(including the RTSP password inside `video_src`), change it, and restart the app. Until the backend
gains a token, do not add a login screen that only pretends to guard any of this — credentials
shown in the UI are a mirror of what the API already hands out to anyone. When the backend does
gain one, a real login belongs here, and every request needs to carry the token.

**The MJPEG stream is a long-lived connection.** Close it when its view is not visible, or a
forgotten tab keeps decoding frames forever.

**`frames_dropped` is the honest health signal.** It counts frames a busy detector never got to;
it is always 0 for a file source. Rising `frames_dropped` with `processing_fps` below the source
`fps` means the device is not keeping up — that is worth surfacing, not hiding.

## The work

### 1. Status bar (do this first)

A persistent header, visible everywhere: reachable or not, `processing_fps` against source `fps`,
`frames_dropped`, uptime, version, equipment id, and a badge for `restart_required` /
`last_problem`. It is small, it exercises the polling and error handling every other view needs,
and it is the thing an installer looks at first.

### 2. Settings

Forms over `GET/PUT /config`, one section at a time: input (`video_src`,
`process_every_nth_frame`), equipment id, Redis (with a **Check connection** button hitting
`/redis/check` before saving), logging (`level`, `logs_folder`, rotation), worker interval,
tracking, detection thresholds. Every save answers with `changed` and `restart_required` — reflect
that, do not assume a change took effect. There is nothing to build for the model: the API neither
reports it nor accepts a change to it.

### 3. Restart

A button that calls `/mutations/restart`, then polls `/ping` until the app answers, showing
progress. Refuse — or at least warn hard — if there are unsaved zones. After it comes back,
re-fetch everything: `status`, `config`, zones.

### 4. Logs

A table over `/logs` with level and scope filters and a follow-tail toggle. Entries carry
`timestamp`, `level`, `scope`, `message` and whatever extra fields the line had; show the extras on
expand rather than in the row. Remember: this reads a file that survives restarts, so it is the one
view that can show what happened before the app came back.

### 5. Analytics

The one that needs thought, because of the constraints above.

What exists per window, per zone: vehicle count by class, average speed by class, aggregate average
speed, `defined_sum_intensity` (how many of those had a usable speed), average headway, and the
OD matrix between zones. Plus live occupancy from `/realtime/occupancy`.

Things worth designing carefully:

- **Live vs history.** Occupancy is instantaneous, statistics are windowed. Do not mix them into
  one number that means neither.
- **The series starts when the page opens.** Make that visible — a note, a start marker on the
  axis — and keep the accumulated windows in memory (or `localStorage`, if they should survive a
  reload; say which).
- **Gaps.** A restart, a lost window, a closed laptop: break the line, do not interpolate.
- **Speeds are only as good as the calibration.** `defined_sum_intensity` vs `sum_intensity` says
  how many vehicles actually got a speed; when the ratio is low, the number on screen deserves a
  caveat rather than three decimal places.
- **The OD matrix** is a small square matrix keyed `ld-{direction}_ln-{lane}`. A heat-map style
  table is enough; the diagonal is U-turns.
- **Zone identity.** Every zone answer carries `id`, the same opaque string
  `/api/polygons/geojson` reports: join on that. The OD matrix keys are
  `ld-{lane_direction}_ln-{lane_number}` instead, so linking a matrix row to a zone means building
  that string from the zone's own fields. Reuse the colour the zone already has on the map so a
  chart and the map are obviously about the same zone.

### 6. Layout

Right now everything is one screen. With monitoring added, propose and justify an information
architecture — for example a persistent status header plus **Live** (video, occupancy, current
window), **Analytics**, **Setup** (the existing canvas/map zone editor plus the settings forms) and
**Logs**. Keep the setup screen as it is until the rest exists: it works, and it is the part people
already know.

## Conventions

- Do not run git commands. Prepare the changes, and hand over a short PR title and body when asked.
- Comments explain why, not what, and only where the reason is not visible in the code.
- English in code, comments and UI text.
- Check the API against `/api/docs.json` on a running backend rather than trusting this file: the
  backend moves, and this document will fall behind.
