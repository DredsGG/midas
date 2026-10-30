// Midas — popup (textos no idioma do navegador: ../src/i18n.js)
const $ = (id) => document.getElementById(id);
const I18N = window[Symbol.for('alp.i18n')] || { t: (k) => k, locale: 'pt-BR', lang: 'pt' };
const T = I18N.t;
const DEFAULTS = { delay: 0, humanize: false, preset: 'rage', debug: false, autoRestart: true };
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

// v0.17.2: contagem a cada segundo com o grind rodando
const fmtLive = (ms) => {
  if (!ms || !isFinite(ms) || ms <= 0) return '–';
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m ${String(x).padStart(2, '0')}s` : `${m}m ${String(x).padStart(2, '0')}s`;
};
let lastEta = null;
setInterval(() => { const e = lastEta; if (e?.running === 'grind' && e.p?.at) document.getElementById('s-eta').textContent = fmtLive(e.p.etaMs - (Date.now() - e.p.at)); }, 1000);
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
    $('s-eta').textContent = st.alp_running === 'grind' && p.at ? fmtLive(p.etaMs - (Date.now() - p.at)) : fmtDur(p.etaMs);
    lastEta = { p, running: st.alp_running };
    $('current').textContent = p.current
      ? `${T(p.current.mode === 'normal' ? 'mode.lesson' : 'mode.legendary')}: ${T('now.where', { u: p.current.u + 1, n: p.current.li + 1 })} · ${typeName(p.current.type)} · ${p.current.name}`
      : T('pop.complete');
  }
  const log = (st.alp_log || []).slice(-150)
    .map((l) => `${new Date(l.t).toLocaleTimeString(I18N.locale)} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${String(l.msg).replace(/\/users\/\d+/g, '/users/…').replace(/\?fields=\S+/g, '')}`)
    .join('\n');
  $('log').textContent = log || T('log.empty');
  const unk = Object.keys(st.alp_unknown || {});
  $('unknown').textContent = unk.length ? T('unk', { list: unk.join(', ') }) : '';
};

// ───────── atualização (v0.13.0) ─────────
let upd = {}, updStatus = null;
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const noteItems = (md) => String(md || '').replace(/^\s*###\s*Install[\s\S]*?\n\s*\n\s*\n/i, '').split(/\r?\n/).map((l) => l.replace(/^\s*(#+|[-*+]|\d+\.)\s*/, '').replace(/[*_`]/g, '').trim())
  .filter((l) => l && !/^install\b/i.test(l) && !/^(download|open `chrome)/i.test(l))
  .flatMap((l) => (l.length > 160 ? l.split(/(?<=[.!?])\s+/) : [l])).filter(Boolean).slice(0, 6);
const renderUpd = () => {
  const u = upd || {}, st = updStatus;
  const stat = typeof st === 'string' ? st : st?.status;
  // v0.17.0: "Depois" adia 1 h; versão URGENTE não adia
  const snoozed = !u.urgent && !!u.snooze && u.snooze.ver === u.latest && Date.now() < u.snooze.until;
  const show = !!u.available && !snoozed;
  $('upd').hidden = !show;
  $('upd-later').hidden = !!u.urgent;
  if (show) {
    $('upd-v').innerHTML = `v${esc(u.current || chrome.runtime.getManifest().version)} → <i>v${esc(u.latest)}</i>`;
    const items = noteItems(u.notes);
    $('upd-notes').innerHTML = items.map((x) => `<li>${esc(x)}</li>`).join('');
    $('upd-notes').hidden = !items.length;
    const m = st?.mode === 'xpi' ? T('upd.howFirefox', { v: u.latest }) : stat === 'downloaded' ? T('upd.howUnpacked', { v: u.latest }) : stat === 'applying' ? T('upd.applying')
      : st?.mode === 'store' && stat ? T('upd.storeWait') : stat === 'error' ? T('upd.error') : '';
    const mm = u.urgent ? [T('upd.urgent'), m].filter(Boolean).join(' ') : m;
    $('upd-msg').textContent = mm; $('upd-msg').hidden = !mm;
    $('upd-apply').disabled = stat === 'applying';
  }
  const ju = u.justUpdated;
  $('updok').hidden = !(ju && Date.now() - ju.at < 30 * 60e3);
  if (!$('updok').hidden) $('updok-t').textContent = T('upd.done', { from: ju.from || '?', to: ju.to });
  $('upd-check').classList.toggle('spin', stat === 'checking');
  const s = $('upd-st');
  s.className = 'upd-st';
  if (stat === 'checking') s.textContent = T('upd.checking');
  else if (u.available) { s.textContent = T('upd.avail', { v: u.latest }); s.classList.add('new'); }
  else if (stat === 'error' || (stat === 'none' && u.error)) s.textContent = T('upd.error');
  else if (stat === 'none') s.textContent = T('upd.none');
  else s.textContent = '';
};
const setDismissed = async (v, clearJust) => {
  const { alp_update = {} } = await chrome.storage.local.get('alp_update');
  const snooze = v && !alp_update.urgent ? { ver: String(v), until: Date.now() + 3600e3 } : (clearJust ? alp_update.snooze ?? null : null);
  await chrome.storage.local.set({ alp_update: { ...alp_update, snooze, ...(clearJust ? { justUpdated: null } : {}) } });
};

const refresh = async () => {
  const st = await chrome.storage.local.get(['alp_running', 'alp_progress', 'alp_log', 'alp_unknown', 'alp_update']);
  render(st);
  upd = st.alp_update || {};
  renderUpd();
};

// textos fixos + balões de ajuda
const applyI18n = () => {
  document.documentElement.lang = I18N.locale || 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = T(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = T(el.dataset.i18nPh)));
  $('copy').title = T('log.copyTitle');
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = T(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
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
  $('autoRestart').checked = cfg.autoRestart !== false;

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
  // v0.19.0: "Reiniciar sozinho se parar" (não mexe no preset)
  $('autoRestart').addEventListener('change', async () => {
    const { alp_cfg: now = {} } = await chrome.storage.local.get('alp_cfg');
    cfg.autoRestart = $('autoRestart').checked;
    await chrome.storage.local.set({ alp_cfg: { ...now, autoRestart: cfg.autoRestart } });
    send('config');
  });
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

  // ───────── relatar bug (v0.14.0) ─────────
  const bugReport = async (what, maxLog = 80) => {
    const st = await chrome.storage.local.get(['alp_log', 'alp_progress', 'alp_update', 'alp_cfg', 'alp_running', 'alp_unknown']);
    const ua = navigator.userAgent;
    const chromeV = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?';
    const os = /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '?';
    const p = st.alp_progress, c = p?.current, cfg = { ...DEFAULTS, ...(st.alp_cfg || {}) };
    const unk = Object.keys(st.alp_unknown || {});
    const meta = [
      `Midas: v${chrome.runtime.getManifest().version} (${st.alp_update?.installType || '?'}) · popup`,
      `Browser: Chrome ${chromeV} · ${os} · UI ${I18N.lang} · ${navigator.language}`,
      `Grind: ${st.alp_running || 'stopped'} · ${cfg.preset} ${cfg.delay} ms${cfg.humanize ? ' · humanized' : ''}`,
      c ? `Now: unit ${c.u + 1}, node ${c.li + 1} · ${c.type} · ${c.name || ''} · ${c.mode}` : '',
      p ? `Path: ${p.eligibleDone ?? '?'}/${p.eligibleTotal ?? '?'} legendary · skipped ${p.skipped || 0}` : '',
      unk.length ? `New types: ${unk.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    const log = (st.alp_log || []).slice(-maxLog).map((l) => `${new Date(l.t).toLocaleTimeString('pt-BR')} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${String(l.msg).replace(/\/users\/\d+/g, '/users/…').replace(/\?fields=\S+/g, '')}`);
    return { what: String(what || '').trim(), meta, log, diag: `${meta}\n\nLog:\n${log.join('\n')}` };
  };
  const bugUrl = async (what) => {
    const r = await bugReport(what);
    const title = '[Bug] ' + (r.what.split('\n')[0].slice(0, 70) || `v${chrome.runtime.getManifest().version}`);
    const make = (log, cut) => `https://github.com/DredsGG/midas/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(
      `### ${T('bug.whatHead')}\n\n${r.what || '-'}\n\n### Diagnostics\n\n\`\`\`text\n${r.meta}\n\nLog${cut ? ' (' + T('bug.trimmed') + ')' : ''}:\n${log.join('\n')}\n\`\`\`\n`)}`;
    let log = r.log, url = make(log, false);
    while (url.length > 7500 && log.length > 5) { log = log.slice(Math.ceil(log.length / 5)); url = make(log, true); }
    return url;
  };
  // v0.19.5 (regra 16): "Apoiar ♥" — quadro opcional; a escolha (Brasil/outro país) fica só para abrir no mesmo lugar
  const SUP = globalThis[Symbol.for('alp.support')];
  $('sup-open').addEventListener('click', (e) => {
    let last = null;
    try { last = localStorage.getItem('alp.support'); } catch { /* ok */ }
    SUP?.open({ mountIn: document.body, styleRoot: document, fixed: true, T, lang: I18N.lang, locale: I18N.locale, project: 'Midas', last,
      onChoice: (c) => { try { c ? localStorage.setItem('alp.support', c) : localStorage.removeItem('alp.support'); } catch { /* ok */ } },
      openUrl: (u) => chrome.tabs.create({ url: u }), returnFocus: e.currentTarget });
  });
  $('bug-open').addEventListener('click', async () => {
    $('bug').hidden = !$('bug').hidden;
    if (!$('bug').hidden) { $('bug-diag').textContent = (await bugReport('')).diag; $('bug-what').focus(); scrollTo(0, 0); }
  });
  $('bug-close').addEventListener('click', () => { $('bug').hidden = true; });
  $('bug-gh').addEventListener('click', async () => { chrome.tabs.create({ url: await bugUrl($('bug-what').value) }); });
  $('bug-copy').addEventListener('click', async () => {
    const r = await bugReport($('bug-what').value, 200);
    try { await navigator.clipboard.writeText(`Midas — bug report\n\n${r.what || '-'}\n\n${r.diag}`); $('bug-copy').textContent = T('bug.copied'); }
    catch { $('bug-copy').textContent = T('log.failed'); }
    setTimeout(() => ($('bug-copy').textContent = T('bug.copy')), 1600);
  });

  $('upd-check').addEventListener('click', async () => {
    updStatus = 'checking'; renderUpd();
    const r = await chrome.runtime.sendMessage({ cmd: 'updCheck' }).catch(() => null);
    updStatus = !r || r.error ? 'error' : r.available ? 'available' : 'none';
    await refresh();
  });
  $('upd-apply').addEventListener('click', async () => {
    updStatus = 'applying'; renderUpd();
    updStatus = (await chrome.runtime.sendMessage({ cmd: 'updApply' }).catch(() => null)) || 'error';
    renderUpd();
  });
  $('upd-guide').addEventListener('click', () => chrome.runtime.sendMessage({ cmd: 'openGuide', hash: '#atualizar' }).catch(() => {}));
  $('upd-later').addEventListener('click', () => setDismissed(upd.latest ?? null));
  $('upd-seen').addEventListener('click', () => setDismissed(null, true));
  $('upd-st').addEventListener('click', () => { if (upd.available) setDismissed(null); });

  // v0.15.0 (Firefox): sem a permissão do duolingo.com os scripts não entram na página → aviso + botão
  const DUO = 'https://www.duolingo.com/*';
  const checkPerm = async () => {
    let ok = true;
    try { ok = await chrome.permissions.contains({ origins: [DUO] }); } catch { /* sem a API: segue */ }
    $('perm').hidden = ok;
  };
  $('perm-btn').addEventListener('click', async () => {
    let ok = false;
    try { ok = await chrome.permissions.request({ origins: [DUO] }); } catch { /* recusado */ }
    if (!ok) $('perm-msg').textContent = T('perm.denied');
    await checkPerm();
  });
  await checkPerm();

  // v0.15.0 (regra 12): tutorial na 1ª abertura, novidades depois de cada atualização, "?" reabre
  const OB = globalThis[Symbol.for('alp.onboard')];
  const VER = chrome.runtime.getManifest().version;
  const showOb = async (kind) => {
    if (!OB) return;
    const { alp_seen } = await chrome.storage.local.get('alp_seen');
    const items = kind === 'news' ? OB.itemsFor(VER, I18N.lang, alp_seen?.news) : null;
    const save = (k) => chrome.storage.local.set({ alp_seen: OB.seenAfter(k, VER, alp_seen) });
    if (kind === 'news' && !items) return save('news');
    OB.open({ kind, mountIn: document.body, styleRoot: document, fixed: true, T, version: VER, items, onClose: save });
  };
  $('howto').addEventListener('click', () => showOb('tutorial'));
  I18N.onChange?.(() => { if (OB?.isOpen) OB.refresh(); if (SUP?.isOpen) SUP.refresh({ lang: I18N.lang, locale: I18N.locale }); });
  {
    const { alp_seen } = await chrome.storage.local.get('alp_seen');
    const k = OB?.decide(alp_seen, VER);
    if (k) showOb(k);
  }

  chrome.storage.onChanged.addListener(refresh);
  await refresh();
  // popup aberto e a última procura tem mais de 1 h: procura de novo em segundo plano
  if (!upd.checkedAt || Date.now() - upd.checkedAt > 3600e3) chrome.runtime.sendMessage({ cmd: 'updCheck' }).catch(() => {});
});
