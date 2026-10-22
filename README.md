# Workout Plan PWA

A plain HTML/JS app with no build step. It works offline once loaded. All data stays in this browser's `localStorage`.

## Run locally
```
cd app && python3 -m http.server 8765   # open http://localhost:8765
```
To install it on a phone with notifications, it must be served over **HTTPS**, for example on GitHub Pages, Netlify, or Cloudflare Pages. Upload this folder as-is.

## Features
- **Today:** the warm-up and that weekday's session. Tap an exercise to see cues and mistakes; tick the checkbox when done. The session is complete when every item is ticked, or tap "Mark session complete".
- **Week:** this week's sessions with the prescriptions for the current program week.
- **History:** completed sessions, the day streak (rest days don't break it), retest results, the progression rule, and the safety notes.
- **Settings:** plan switcher, per-plan start date, notifications and a daily reminder time, JSON export/import, and print.
- **Reminders:**
  - A modal on the first open of each new program week, listing every prescription change.
  - A "try the harder version" banner once an exercise has been ticked for `harderAfterSessions` consecutive scheduled sessions.
  - A retest banner every `retest.everyWeeks` weeks (weeks 5, 9, … for a 4-week interval).

## Data
| Key | Contents |
|---|---|
| `wk:settings` | `activePlan`, `notify`, `notifyTime`, `lastNotified` |
| `wk:plan:<planId>` | `start`, `checks{date:{exId:true}}`, `complete{date:bool}`, `seenWeek`, `retests`, `dismissed` |

Each plan has its own key, so switching plans never touches another plan's data. Export saves every `wk:*` key; import restores them.

## Adding a plan
1. Copy `plans/example-dummy.js` (a minimal example) to `plans/<your-id>.js`.
2. Edit the object passed to `registerPlan({...})` to follow the schema below. The `id` must be unique and stays fixed, because the stored data is keyed by it.
3. Add the path to `PLAN_FILES` in `plans/index.js`. The first entry is the default plan.
4. Add the file to `ASSETS` in `sw.js` and bump `CACHE` so it's available offline.
5. Reload, then choose the plan in Settings → Plan.

### Schema
```js
registerPlan({
  id: "my-plan-v1",                // unique, stable
  name: "Display name",
  credit: "Footer credit line",
  warmup: [Exercise],              // shown before every training day
  days: { "0": Day, ..., "6": Day },  // 0 = Sunday … 6 = Saturday
  progression: {
    progressDays: [1,2,4,5,6],     // weekdays whose doses progress (others fixed)
    maxSets: 4,                    // cap for setAdd
    harderAfterSessions: 3,        // consecutive ticks before "harder version" prompt
    weeks: [ { week: 1, holdAdd: 0, repAdd: 0, setAdd: 0, summary: "..." }, ... ],  // cumulative vs. base
    text: ["rule lines shown in History"]
  },
  retest: { everyWeeks: 4, items: ["Test 1", "Test 2"] },
  safety: ["line", "line"]
});
// Day      = { label: "Legs + Core", exercises: [Exercise], text: "shown when exercises is empty (rest day)" }
// Exercise = { id: "unique-in-plan", name, tempo, note, harder?: "progression text",
//              dose: { sets: 3, lo: 8, hi: 10, unit: "reps" | "s", suffix: "/ leg" } | { text: "10–15 min" } }
```
`holdAdd` applies to `unit: "s"` doses and `repAdd` to `"reps"` doses. A `{text}` dose never changes. After the last week, the last week's doses stay in place.

`plans/mister-white-v1.js` was generated from `../mister_white_plan_v2.md`. `plans/example-dummy.js` is an example only and is commented out of the index.

## Notification limitations
The daily reminder and week notifications use the Notification API through the service worker. They fire only while the app, or the browser holding it, is running. There's no push server, so a closed app won't notify you. iOS supports notifications only for an app installed to the Home Screen (iOS 16.4+) and still requires the app to be running. Week and retest reminders always appear in the app when you open it.

## Exercise media
Bundled under `media/`: 21 items, about 460 KB total, all cached by the service worker.
- **CDC "Growing Stronger" GIFs:** public domain, kept unmodified.
- **wger.de, Wikimedia Commons, and free-exercise-db stills:** resized to 600 px wide and converted to WebP. Derivatives of CC BY-SA images remain CC BY-SA.

Each exercise can carry an optional `media` field:
```js
media: { file: "media/x.webp", type: "image" | "gif", license: "CC BY-SA 4.0", licenseUrl, author, sourceUrl,
         changes: "Resized…", variant?: "Shown with barbell; do it bodyweight." }
```
The image appears in the exercise detail with a one-line credit. The `variant` text shows as a warning label. Settings → Credits lists every item. When you add media files, add them to `ASSETS` in `sw.js` and bump `CACHE`.
