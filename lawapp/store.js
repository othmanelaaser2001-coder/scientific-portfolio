/**
 * Shared persistence + notification delivery.
 *
 * Loaded as a CLASSIC script by BOTH the page (<script src="store.js">) and the
 * service worker (importScripts). That is why it uses no ES module syntax and
 * hangs everything off `self.MLawStore` — the service worker has no access to
 * localStorage, so IndexedDB is the only store both sides can read.
 *
 * Scheduled entries carry their own rendered title/body. The service worker
 * therefore never needs the corpus: it just fires what the page prepared.
 */
(function (scope) {
  'use strict';

  const DB_NAME = 'mlaw';
  const STORE = 'kv';
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req ? req.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  const get = (key) => run('readonly', (s) => s.get(key));
  const set = (key, value) => run('readwrite', (s) => s.put(value, key));

  const DEFAULT_SETTINGS = {
    enabled: false,
    perDay: 3,
    startHour: 9,
    endHour: 21,
    lang: 'ar',
    categories: null, // null = all
  };

  async function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, (await get('settings')) || {});
  }

  const setSettings = (s) => set('settings', s);
  const getSchedule = async () => (await get('schedule')) || [];
  const setSchedule = (s) => set('schedule', s);

  /**
   * Fire every entry that has come due.
   *
   * Anything older than STALE_MS is marked delivered but never shown — waking
   * up to eleven notifications from a phone that was off all night is how an
   * app gets uninstalled. At most MAX_BURST are shown in a single pass.
   */
  const STALE_MS = 6 * 60 * 60 * 1000;
  const MAX_BURST = 2;

  async function flushDue(registration, now) {
    now = now || Date.now();
    const settings = await getSettings();
    if (!settings.enabled) return 0;

    const schedule = await getSchedule();
    let shown = 0;
    let dirty = false;

    for (const entry of schedule) {
      if (entry.fired || entry.at > now) continue;
      entry.fired = true;
      dirty = true;
      if (now - entry.at > STALE_MS || shown >= MAX_BURST) continue;

      await registration.showNotification(entry.title, {
        body: entry.body,
        tag: 'mlaw-' + entry.articleId,
        badge: './icons/badge.svg',
        icon: './icons/icon.svg',
        lang: entry.lang,
        dir: entry.lang === 'ar' ? 'rtl' : 'ltr',
        data: { url: './#/a/' + entry.articleId },
        requireInteraction: false,
      });
      shown++;
    }

    if (dirty) {
      // Keep a short tail of delivered entries so the UI can show history.
      const cutoff = now - 3 * 24 * 60 * 60 * 1000;
      await setSchedule(schedule.filter((e) => !e.fired || e.at > cutoff));
    }
    return shown;
  }

  scope.MLawStore = {
    get,
    set,
    getSettings,
    setSettings,
    getSchedule,
    setSchedule,
    flushDue,
    DEFAULT_SETTINGS,
  };
})(self);
