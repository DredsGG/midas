// Midas — popup (textos no idioma do navegador: ../src/i18n.js)
const $ = (id) => document.getElementById(id);
const I18N = window[Symbol.for('alp.i18n')] || { t: (k) => k, locale: 'pt-BR', lang: 'pt' };
const T = I18N.t;
const DEFAULTS = { delay: 0, humanize: false, preset: 'rage', debug: false };
const PRESETS = {
  rage: { delay: 0, humanize: false },
  legit: { delay: 2500, humanize: true },
  manual: {},
};
const TYPES = ['skill', 'story', 'practice', 'unit_review', 'chest', 'duo_radio'];
const typeName = (ty) => (TYPES.includes(ty) ? T('type.' + ty) : ty);
const presetOf = (c) => c.preset || (c.delay === 0 && !c.humanize ? 'rage' : c.delay === 2500 && c.humanize ? 'legit' : 'manual');

const duoTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: 'https://*.duolingo.com/*' });
  if (tab) return tab;
  const [any] = await chrome.tabs.query({ url: 'https://*.duolingo.com/*' });
  return any || null;
};
const send = async (cmd, data) => {
  const tab = await duoTab();
  if (!tab) { $('running').textContent = T('pop.openDuo'); return; }
  try { await chrome.tabs.sendMessage(tab.id, { cmd, data }); }
  catch { $('running').textContent = T('pop.reload'); }
};

const fmtDur = (ms) => {
  if (!ms || !isFinite(ms)) return '–';
  const h = Math.floor(ms / 3.6e6), m = Math.round((ms % 3.6e6) / 6e4);
  if (h >= 48) return `${Math.round(h / 24)} d`;
  return h ? `${h} h ${m} min` : `${m} min`;
};

const render = (st) => {
  const running = st.alp_running;
  $('running').textContent = T(running === 'grind' ? 'pop.running.grind' : running === 'lesson' ? 'pop.running.lesson' : 'chip.stopped');
  const g = $('grind');
  const on = running === 'grind';
  g.textContent = T(on ? 'btn.stop' : 'btn.start');
  g.classList.toggle('on', on);

  const p = st.alp_progress;
  if (p) {
    const total = p.eligibleTotal ?? (p.legendary + p.todo + (p.active || 0) + (p.locked || 0));
    const done = p.eligibleDone ?? p.legendary;
    const left = p.remaining ?? Math.max(0, total - done);
    $('bar-fill').style.width = total ? `${(100 * done) / total}%` : '0';
    $('s-leg').textContent = done.toLocaleString(I18N.locale);
    $('s-todo').textContent = left.toLocaleString(I18N.locale);
    $('s-eta').textContent = fmtDur(p.etaMs);
    $('current').textContent = p.current
      ? `${T(p.current.mode === 'normal' ? 'mode.lesson' : 'mode.legendary')}: ${T('now.where', { u: p.current.u + 1, n: p.current.li + 1 })} · ${typeName(p.current.type)} · ${p.current.name}`
      : T('pop.complete');
  }
  const log = (st.alp_log || []).slice(-150)
    .map((l) => `${new Date(l.t).toLocaleTimeString(I18N.locale)} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${l.msg}`)
    .join('\n');
  $('log').textContent = log || T('log.empty');
  const unk = Object.keys(st.alp_unknown || {});
  $('unknown').textContent = unk.length ? T('unk', { list: unk.join(', ') }) : '';
};

const refresh = async () =>
  render(await chrome.storage.local.get(['alp_running', 'alp_progress', 'alp_log', 'alp_unknown']));

// textos fixos + balões de ajuda
const applyI18n = () => {
  document.documentElement.lang = I18N.locale || 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = T(el.dataset.i18n)));
  $('copy').title = T('log.copyTitle');
  document.querySelectorAll('button.info').forEach((b) => b.setAttribute('aria-label', T('help.label')));
  if (applyI18n.wired) return; // os balões só são ligados uma vez (troca de idioma reaplica só os textos)
  applyI18n.wired = true;
  const tip = $('tip');
  let cur = null;
  const show = (b) => {
    cur?.classList.remove('on'); cur = b; b.classList.add('on');
    tip.textContent = T(b.dataset.help); tip.hidden = false;
    const r = b.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(Math.max(6, r.left + r.width / 2 - tw / 2), innerWidth - tw - 6) + 'px';
    tip.style.top = (r.bottom + 8 + th < innerHeight - 6 ? r.bottom + 8 : Math.max(6, r.top - th - 8)) + 'px';
  };
  const hide = () => { tip.hidden = true; cur?.classList.remove('on'); cur = null; };
  document.querySelectorAll('button.info').forEach((b) => {
    b.addEventListener('mouseenter', () => show(b));
    b.addEventListener('mouseleave', hide);
    b.addEventListener('focus', () => show(b));
    b.addEventListener('blur', hide);
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cur === b ? hide() : show(b); });
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  // idioma salvo pelas bandeirinhas (fonte da verdade: chrome.storage, compartilhado com a HUD)
  const { alp_lang, alp_theme } = await chrome.storage.local.get(['alp_lang', 'alp_theme']);
  if (alp_lang) I18N.setLang?.(alp_lang);
  // tema: escuro por padrão; o botão alterna e a HUD acompanha (chrome.storage alp_theme)
  let theme = alp_theme === 'light' ? 'light' : 'dark';
  const paintTheme = () => {
    document.documentElement.dataset.theme = theme;
    $('theme').setAttribute('aria-checked', String(theme === 'dark')); // ligado = escuro
    $('theme').title = T(theme === 'dark' ? 'theme.toLight' : 'theme.toDark');
    $('theme').setAttribute('aria-label', $('theme').title);
  };
  paintTheme();
  $('theme').addEventListener('click', async () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    paintTheme();
    await chrome.storage.local.set({ alp_theme: theme });
  });
  applyI18n();
  const markFlag = () => document.querySelectorAll('button.flag').forEach((b) => b.classList.toggle('on', b.dataset.lang === I18N.lang));
  markFlag();
  document.querySelectorAll('button.flag').forEach((b) => b.addEventListener('click', async () => {
    if (!I18N.setLang?.(b.dataset.lang)) return;
    await chrome.storage.local.set({ alp_lang: b.dataset.lang });
    applyI18n(); markFlag(); paintTheme(); showPreset?.(); refresh();
  }));
  try { $('ver').textContent = '· v' + chrome.runtime.getManifest().version; } catch { /* ok */ }
  const { alp_cfg } = await chrome.storage.local.get('alp_cfg');
  const cfg = { ...DEFAULTS, ...(alp_cfg || {}) };
  $('delay').value = cfg.delay;
  $('delay-out').textContent = cfg.delay;
  $('humanize').checked = cfg.humanize;

  const showPreset = () => {
    const p = presetOf(cfg);
    document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    $('hint').textContent = T('preset.' + p);
  };
  const saveCfg = async (preset = 'manual') => {
    const next = { ...cfg, delay: +$('delay').value, humanize: $('humanize').checked, preset };
    Object.assign(cfg, next);
    await chrome.storage.local.set({ alp_cfg: next });
    send('config');
    showPreset();
  };
  $('delay').addEventListener('input', () => ($('delay-out').textContent = $('delay').value));
  $('delay').addEventListener('change', () => saveCfg('manual'));
  $('humanize').addEventListener('change', () => saveCfg('manual'));
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.p];
    if (p.delay != null) { $('delay').value = p.delay; $('delay-out').textContent = p.delay; $('humanize').checked = p.humanize; }
    saveCfg(b.dataset.p);
  }));
  showPreset();
  $('copy').addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const { alp_log = [] } = await chrome.storage.local.get('alp_log');
    const text = alp_log.map((l) => `${new Date(l.t).toLocaleTimeString(I18N.locale)} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${l.msg}`).join('\n');
    try { await navigator.clipboard.writeText(text); $('copy').textContent = T('log.copied'); } catch { $('copy').textContent = T('log.failed'); }
    setTimeout(() => ($('copy').textContent = T('log.copy')), 1500);
  });

  $('grind').addEventListener('click', async () => {
    const { alp_running } = await chrome.storage.local.get('alp_running');
    send(alp_running === 'grind' ? 'stop' : 'grind');
  });
  document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => send(b.dataset.cmd)));

  chrome.storage.onChanged.addListener(refresh);
  refresh();
});
