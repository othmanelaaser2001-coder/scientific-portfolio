import { ARTICLES, CATEGORIES, CAT_BY_ID, META } from './data.js';
import { syncSchedule, upcoming, hasNativeTriggers } from './scheduler.js';

const store = self.MLawStore;

/* ------------------------------------------------------------------- i18n */

const UI = {
  ar: {
    skip: 'تخطى إلى المحتوى',
    appName: 'عارف حقك',
    appTag: 'القانون المغربي، مبسّط ومُوثّق',
    searchPlaceholder: 'بحث فـ القوانين…',
    all: 'الكل',
    noResults: 'ماكاين حتى نتيجة.',
    back: 'رجوع',
    results: (n) => `${n} فقرة`,
    darija: 'بالدارجة',
    sourceLabel: 'المرجع',
    verify: 'راجع النص الرسمي',
    share: 'مشاركة',
    copied: 'تنسخ ✓',
    notifTitle: 'تنبيهات عشوائية',
    notifIntro: 'التطبيق كيصيفط ليك فقرات قانونية قصيرة فـ أوقات عشوائية خلال النهار.',
    notifEnable: 'تفعيل التنبيهات',
    perDay: 'عدد التنبيهات فـ النهار',
    fromHour: 'من الساعة',
    toHour: 'إلى الساعة',
    notifCats: 'المواضيع اللي بغيتي',
    testNotif: 'جرّب تنبيه دابا',
    reshuffle: 'عاود الجدولة',
    upcoming: 'التنبيهات الجاية',
    aboutTitle: 'على التطبيق',
    permDenied: 'التنبيهات مسدودة من إعدادات المتصفح. خاصك تسمح بيها من هناك.',
    permNeeded: 'خاص الإذن ديال التنبيهات.',
    onOk: (n) => `مفعّلة — ${n} تنبيه مبرمج.`,
    off: 'التنبيهات مطفية.',
    iosNote:
      'ملاحظة: على iPhone، خاص تزيد التطبيق للشاشة الرئيسية باش تخدم التنبيهات، وحتى دبا ماكيضمنش المتصفح التوقيت بدقة.',
    windowBad: 'ساعة البداية خاصها تكون قبل ساعة النهاية.',
    unverified:
      '⚠️ هاد النسخة تجريبية: النصوص خاصها تتراجع مع الجريدة الرسمية قبل الاعتماد عليها.',
  },
  fr: {
    skip: 'Aller au contenu',
    appName: 'Aref Haqqak',
    appTag: 'Le droit marocain, simplifié et sourcé',
    searchPlaceholder: 'Rechercher dans les lois…',
    all: 'Tout',
    noResults: 'Aucun résultat.',
    back: 'Retour',
    results: (n) => `${n} fiche${n > 1 ? 's' : ''}`,
    darija: 'En darija',
    sourceLabel: 'Référence',
    verify: 'Vérifier le texte officiel',
    share: 'Partager',
    copied: 'Copié ✓',
    notifTitle: 'Rappels aléatoires',
    notifIntro:
      "L'application vous envoie de courtes fiches juridiques à des moments aléatoires de la journée.",
    notifEnable: 'Activer les notifications',
    perDay: 'Notifications par jour',
    fromHour: 'À partir de',
    toHour: "Jusqu'à",
    notifCats: 'Thèmes souhaités',
    testNotif: 'Tester maintenant',
    reshuffle: 'Reprogrammer',
    upcoming: 'Prochains rappels',
    aboutTitle: "À propos",
    permDenied:
      "Les notifications sont bloquées dans les réglages du navigateur. Autorisez-les depuis là.",
    permNeeded: "L'autorisation de notification est requise.",
    onOk: (n) => `Activées — ${n} rappel(s) programmé(s).`,
    off: 'Notifications désactivées.',
    iosNote:
      "Note : sur iPhone, ajoutez l'app à l'écran d'accueil pour que les notifications fonctionnent — et même ainsi, l'horaire exact n'est pas garanti par le navigateur.",
    windowBad: "L'heure de début doit précéder l'heure de fin.",
    unverified:
      '⚠️ Version de démonstration : les textes doivent être vérifiés au Bulletin Officiel avant tout usage réel.',
  },
};

let lang = 'ar';
let t = UI.ar;
let activeCat = null;
let query = '';

/* ----------------------------------------------------------------- helpers */

const $ = (sel) => document.querySelector(sel);

/** Strip Arabic diacritics and unify letter variants so search is forgiving. */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin accents
    .replace(/[ً-ْـ]/g, '') // Arabic harakat + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const searchIndex = new Map(
  ARTICLES.map((a) => [
    a.id,
    normalize(
      [
        a.title.ar, a.title.fr,
        a.fact.ar, a.fact.fr,
        a.body.ar, a.body.fr,
        a.dz || '',
        a.ref.law, a.ref.art,
        (a.tags || []).join(' '),
        CAT_BY_ID[a.cat].ar, CAT_BY_ID[a.cat].fr,
      ].join(' ')
    ),
  ])
);

function matches(article) {
  if (activeCat && article.cat !== activeCat) return false;
  if (!query) return true;
  const hay = searchIndex.get(article.id);
  return normalize(query)
    .split(' ')
    .every((term) => hay.includes(term));
}

function applyStaticI18n() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = t[el.dataset.i18n];
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const [attr, key] = el.dataset.i18nAttr.split(':');
    if (typeof t[key] === 'string') el.setAttribute(attr, t[key]);
  });
  $('#lang-btn').textContent = lang === 'ar' ? 'FR' : 'ع';
  $('#disclaimer-text').textContent =
    (META.verified ? '' : t.unverified + ' ') + META.disclaimer[lang];
  $('#about-text').textContent = `${t.appName} · v${META.version} · ${META.corpusDate}`;
}

/* -------------------------------------------------------------- list view */

function renderChips() {
  const nav = $('#cat-chips');
  nav.replaceChildren();
  const mk = (id, label) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(activeCat === id));
    b.addEventListener('click', () => {
      activeCat = activeCat === id ? null : id;
      renderChips();
      renderCards();
    });
    nav.append(b);
  };
  mk(null, t.all);
  CATEGORIES.forEach((c) => mk(c.id, `${c.icon} ${c[lang]}`));
}

function renderCards() {
  const list = ARTICLES.filter(matches);
  const wrap = $('#cards');
  wrap.replaceChildren();

  for (const a of list) {
    const cat = CAT_BY_ID[a.cat];
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.addEventListener('click', () => {
      location.hash = '#/a/' + a.id;
    });

    const head = document.createElement('div');
    head.className = 'card-head';
    head.innerHTML = `<span class="card-icon">${cat.icon}</span>`;
    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = a.title[lang];
    head.append(title);

    const fact = document.createElement('p');
    fact.className = 'card-fact';
    fact.textContent = a.fact[lang];

    const ref = document.createElement('span');
    ref.className = 'ref';
    ref.textContent = `${cat[lang]} · ${t.sourceLabel} ${a.ref.art}`;

    card.append(head, fact, ref);
    wrap.append(card);
  }

  $('#empty').hidden = list.length > 0;
  $('#result-count').textContent = list.length ? t.results(list.length) : '';
}

/* ------------------------------------------------------------ detail view */

function renderDetail(id) {
  const a = ARTICLES.find((x) => x.id === id);
  const host = $('#detail');
  host.replaceChildren();
  if (!a) {
    location.hash = '#/';
    return;
  }
  const cat = CAT_BY_ID[a.cat];

  const catLine = document.createElement('p');
  catLine.className = 'cat-line';
  catLine.textContent = `${cat.icon} ${cat[lang]}`;

  const h1 = document.createElement('h1');
  h1.textContent = a.title[lang];

  const lead = document.createElement('p');
  lead.className = 'lead';
  lead.textContent = a.fact[lang];

  host.append(catLine, h1, lead);

  // The darija gloss is the whole point for readers who find legislative
  // Arabic heavy, so it sits above the formal explanation, not below it.
  if (a.dz) {
    const dz = document.createElement('div');
    dz.className = 'dz';
    dz.dir = 'rtl';
    const label = document.createElement('b');
    label.textContent = t.darija;
    const text = document.createElement('span');
    text.textContent = a.dz;
    dz.append(label, text);
    host.append(dz);
  }

  const body = document.createElement('p');
  body.className = 'body-text';
  body.textContent = a.body[lang];
  host.append(body);

  const src = document.createElement('div');
  src.className = 'source-box';
  const cite = document.createElement('div');
  cite.className = 'cite';
  cite.textContent = `${a.ref.law} — ${t.sourceLabel} ${a.ref.art}`;
  const link = document.createElement('a');
  link.href = cat.source;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = t.verify;
  src.append(cite, link);
  host.append(src);

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn ghost';
  shareBtn.type = 'button';
  shareBtn.textContent = t.share;
  shareBtn.addEventListener('click', () => shareArticle(a, shareBtn));
  actions.append(shareBtn);
  host.append(actions);
}

async function shareArticle(a, btn) {
  const text = `${a.title[lang]}\n\n${a.fact[lang]}\n\n${a.ref.law} — ${t.sourceLabel} ${a.ref.art}`;
  const url = location.origin + location.pathname + '#/a/' + a.id;
  try {
    if (navigator.share) {
      await navigator.share({ title: a.title[lang], text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    const original = btn.textContent;
    btn.textContent = t.copied;
    setTimeout(() => (btn.textContent = original), 1600);
  } catch {
    /* user dismissed the share sheet — nothing to report */
  }
}

/* ---------------------------------------------------------------- routing */

function show(viewId) {
  ['view-list', 'view-detail', 'view-settings'].forEach((id) => {
    document.getElementById(id).hidden = id !== viewId;
  });
}

function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/a/')) {
    renderDetail(decodeURIComponent(hash.slice(4)));
    show('view-detail');
  } else if (hash === '#/settings') {
    show('view-settings');
    refreshSettingsView();
  } else {
    show('view-list');
  }
  window.scrollTo(0, 0);
}

/* --------------------------------------------------------------- settings */

let settings = null;

function renderNotifCats() {
  const wrap = $('#notif-cats');
  wrap.replaceChildren();
  const selected = settings.categories;
  for (const c of CATEGORIES) {
    const on = !selected || selected.includes(c.id);
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = `${c.icon} ${c[lang]}`;
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', async () => {
      const current = new Set(settings.categories || CATEGORIES.map((x) => x.id));
      current.has(c.id) ? current.delete(c.id) : current.add(c.id);
      // Refuse to leave the pool empty — there would be nothing to notify about.
      if (current.size === 0) return;
      settings.categories =
        current.size === CATEGORIES.length ? null : [...current];
      await persistSettings({ reschedule: true });
      renderNotifCats();
    });
    wrap.append(b);
  }
}

async function persistSettings({ reschedule = false } = {}) {
  await store.setSettings(settings);
  const schedule = await syncSchedule({ force: reschedule });
  await renderUpcoming();
  updateStatusLine(schedule);
}

function updateStatusLine(schedule) {
  const el = $('#notif-status');
  el.classList.remove('warn');
  if (!settings.enabled) {
    el.textContent = t.off;
    return;
  }
  if (Notification.permission === 'denied') {
    el.textContent = t.permDenied;
    el.classList.add('warn');
    return;
  }
  const pending = (schedule || []).filter((e) => !e.fired || e.triggered).length;
  el.textContent = t.onOk(pending);
  if (!hasNativeTriggers()) {
    el.textContent += ' ' + t.iosNote;
  }
}

async function renderUpcoming() {
  const list = $('#upcoming');
  list.replaceChildren();
  const items = await upcoming(6);
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-MA', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  for (const e of items) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = new Date(e.at).toISOString();
    time.textContent = fmt.format(new Date(e.at));
    const span = document.createElement('span');
    span.textContent = e.title;
    li.append(time, span);
    list.append(li);
  }
}

function refreshSettingsView() {
  $('#notif-toggle').checked = settings.enabled;
  $('#per-day').value = settings.perDay;
  $('#per-day-out').value = settings.perDay;
  $('#start-hour').value = settings.startHour;
  $('#end-hour').value = settings.endHour;
  renderNotifCats();
  renderUpcoming();
  store.getSchedule().then(updateStatusLine);
}

async function enableNotifications() {
  if (!('Notification' in window)) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  return perm === 'granted';
}

function wireSettings() {
  $('#notif-toggle').addEventListener('change', async (e) => {
    if (e.target.checked) {
      const ok = await enableNotifications();
      if (!ok) {
        e.target.checked = false;
        settings.enabled = false;
        $('#notif-status').textContent =
          Notification.permission === 'denied' ? t.permDenied : t.permNeeded;
        $('#notif-status').classList.add('warn');
        await store.setSettings(settings);
        return;
      }
    }
    settings.enabled = e.target.checked;
    await persistSettings({ reschedule: true });
  });

  $('#per-day').addEventListener('input', (e) => {
    $('#per-day-out').value = e.target.value;
  });
  $('#per-day').addEventListener('change', async (e) => {
    settings.perDay = Number(e.target.value);
    await persistSettings({ reschedule: true });
  });

  const onHour = async () => {
    const start = Number($('#start-hour').value);
    const end = Number($('#end-hour').value);
    const status = $('#notif-status');
    if (!(start < end)) {
      status.textContent = t.windowBad;
      status.classList.add('warn');
      return;
    }
    settings.startHour = start;
    settings.endHour = end;
    await persistSettings({ reschedule: true });
  };
  $('#start-hour').addEventListener('change', onHour);
  $('#end-hour').addEventListener('change', onHour);

  $('#test-btn').addEventListener('click', async () => {
    if (!(await enableNotifications())) {
      $('#notif-status').textContent = t.permNeeded;
      return;
    }
    const pool = settings.categories
      ? ARTICLES.filter((a) => settings.categories.includes(a.cat))
      : ARTICLES;
    const a = pool[Math.floor(Math.random() * pool.length)];
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(a.title[lang], {
      body: a.fact[lang],
      icon: './icons/icon.svg',
      badge: './icons/badge.svg',
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      data: { url: './#/a/' + a.id },
    });
  });

  $('#reshuffle-btn').addEventListener('click', () =>
    persistSettings({ reschedule: true })
  );
}

/* ------------------------------------------------------------------- boot */

async function setLang(next) {
  lang = next;
  t = UI[lang];
  settings.lang = lang;
  await store.setSettings(settings);
  applyStaticI18n();
  renderChips();
  renderCards();
  route();
  // Queued notification bodies were rendered in the old language; redo them.
  await syncSchedule({ force: true });
}

async function init() {
  settings = await store.getSettings();
  lang = settings.lang === 'fr' ? 'fr' : 'ar';
  t = UI[lang];

  applyStaticI18n();
  renderChips();
  renderCards();
  wireSettings();

  $('#search').addEventListener('input', (e) => {
    query = e.target.value;
    renderCards();
  });
  $('#lang-btn').addEventListener('click', () =>
    setLang(lang === 'ar' ? 'fr' : 'ar')
  );
  $('#settings-btn').addEventListener('click', () => {
    location.hash = '#/settings';
  });
  $('#home-btn').addEventListener('click', () => {
    location.hash = '#/';
  });
  $('#back-btn').addEventListener('click', () => history.back());
  $('#back-btn-2').addEventListener('click', () => history.back());

  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      await syncSchedule();
    } catch (err) {
      console.warn('service worker registration failed', err);
    }
  }

  // Foreground catch-up: the only delivery path that works everywhere.
  const catchUp = async () => {
    if (document.hidden) return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await store.flushDue(reg);
    await syncSchedule();
  };
  document.addEventListener('visibilitychange', catchUp);
  setInterval(catchUp, 5 * 60 * 1000);
}

init();
