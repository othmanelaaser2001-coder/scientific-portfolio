/**
 * Random-fact scheduling.
 *
 * The rule that shapes everything here: the web has no reliable "wake me in
 * three days" primitive. So we keep a rolling plan of concrete timestamps in
 * IndexedDB and fire entries through whichever delivery path the browser
 * actually supports, best first:
 *
 *   1. Notification Triggers (`showTrigger`) — the only true offline timer.
 *      Chromium-only and still behind a flag in some builds; feature-detected.
 *   2. Periodic Background Sync — fires roughly hourly in installed PWAs.
 *   3. Foreground catch-up — on load, on tab focus, and on a timer while open.
 *
 * On iOS only (3) works today. That is a real limitation of the PWA route and
 * the README says so plainly rather than pretending otherwise.
 */
import { ARTICLES } from './data.js';

const HORIZON_DAYS = 7;
const MAX_PENDING = 60; // iOS caps local notifications at 64; stay under it.

/** Fisher-Yates on a copy. */
function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomTimeOn(day, startHour, endHour) {
  const start = new Date(day);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(endHour, 0, 0, 0);
  const span = end - start;
  if (span <= 0) return null;
  return new Date(start.getTime() + Math.random() * span);
}

function pool(settings) {
  const cats = settings.categories;
  const picked =
    cats && cats.length ? ARTICLES.filter((a) => cats.includes(a.cat)) : ARTICLES;
  return picked.length ? picked : ARTICLES;
}

/**
 * Build the entries needed to cover the next HORIZON_DAYS, skipping days that
 * are already planned. Recently used articles are pushed to the back of the
 * bag so the rotation does not repeat the same fact twice in a week.
 */
export function planEntries(settings, existing, now = Date.now()) {
  const plannedDays = new Set(
    existing.map((e) => new Date(e.at).toDateString())
  );
  const recentlyUsed = new Set(
    existing.filter((e) => e.at > now - 7 * 864e5).map((e) => e.articleId)
  );

  const candidates = pool(settings);
  let bag = shuffled(candidates.filter((a) => !recentlyUsed.has(a.id)));
  if (!bag.length) bag = shuffled(candidates);

  const lang = settings.lang === 'fr' ? 'fr' : 'ar';
  const created = [];

  for (let d = 0; d < HORIZON_DAYS; d++) {
    const day = new Date(now + d * 864e5);
    if (plannedDays.has(day.toDateString())) continue;

    for (let n = 0; n < settings.perDay; n++) {
      const at = randomTimeOn(day, settings.startHour, settings.endHour);
      if (!at || at.getTime() <= now) continue;

      if (!bag.length) bag = shuffled(candidates);
      const article = bag.pop();

      created.push({
        id: `${at.getTime()}-${article.id}`,
        at: at.getTime(),
        articleId: article.id,
        lang,
        title: article.title[lang],
        body: article.fact[lang],
        fired: false,
        triggered: false,
      });
    }
  }
  return created;
}

/** True if the browser can schedule a notification for a future timestamp. */
export function hasNativeTriggers() {
  return typeof self !== 'undefined' && 'TimestampTrigger' in self;
}

/**
 * Hand pending entries to the browser's own timer where that exists. Entries
 * scheduled this way still stay in IndexedDB: `flushDue` skips them once they
 * are marked fired, and the tag dedupes if both paths race.
 */
async function armNativeTriggers(registration, schedule) {
  if (!hasNativeTriggers()) return;
  const now = Date.now();
  for (const entry of schedule) {
    if (entry.fired || entry.triggered || entry.at <= now) continue;
    try {
      await registration.showNotification(entry.title, {
        body: entry.body,
        tag: 'mlaw-' + entry.articleId,
        icon: './icons/icon.svg',
        badge: './icons/badge.svg',
        lang: entry.lang,
        dir: entry.lang === 'ar' ? 'rtl' : 'ltr',
        data: { url: './#/a/' + entry.articleId },
        showTrigger: new self.TimestampTrigger(entry.at),
      });
      entry.triggered = true;
      entry.fired = true; // the browser owns delivery from here on
    } catch {
      return; // unsupported after all — leave the rest to the fallback paths
    }
  }
}

/**
 * Reconcile stored plan with current settings. Called on load, on settings
 * change, and whenever the tab regains focus.
 */
export async function syncSchedule({ force = false } = {}) {
  const store = self.MLawStore;
  const settings = await store.getSettings();
  let schedule = await store.getSchedule();
  const now = Date.now();

  if (!settings.enabled) {
    if (schedule.length) await store.setSchedule([]);
    return [];
  }

  if (force) {
    schedule = schedule.filter((e) => e.fired && e.at <= now); // keep history only
  }

  schedule = schedule.concat(planEntries(settings, schedule, now));
  schedule.sort((a, b) => a.at - b.at);

  const pending = schedule.filter((e) => !e.fired);
  if (pending.length > MAX_PENDING) {
    const drop = new Set(pending.slice(MAX_PENDING).map((e) => e.id));
    schedule = schedule.filter((e) => !drop.has(e.id));
  }

  // Set by app.js once registration succeeds. Never await
  // `navigator.serviceWorker.ready` directly: in private browsing and in
  // sandboxed frames the object exists but the promise never settles, which
  // would hang scheduling forever instead of falling back.
  const registration = store.registration;
  if (registration) {
    await armNativeTriggers(registration, schedule);
    await store.setSchedule(schedule);
    await store.flushDue(registration, now);
    registerPeriodicSync(registration);
  } else {
    await store.setSchedule(schedule);
  }

  return store.getSchedule();
}

async function registerPeriodicSync(registration) {
  if (!('periodicSync' in registration)) return;
  try {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync',
    });
    if (status.state !== 'granted') return;
    await registration.periodicSync.register('mlaw-facts', {
      minInterval: 60 * 60 * 1000,
    });
  } catch {
    /* not supported; foreground catch-up still applies */
  }
}

/** Entries still ahead of us, soonest first. */
export async function upcoming(limit = 5) {
  const schedule = await self.MLawStore.getSchedule();
  const now = Date.now();
  return schedule.filter((e) => e.at > now).slice(0, limit);
}
