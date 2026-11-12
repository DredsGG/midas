// Midas — service worker: badge do ícone + atualizações (v0.13.0).
//
// Atualização (pedido do André em 2026-10-23, regra 7 nova):
// - Procura versão nova nos Releases do GitHub (DredsGG/midas): ao abrir o Chrome, a cada 30 min,
//   ao abrir e ao voltar para a aba do Duolingo (máx. 1x/10 min) e no "Procurar atualização".
// - Instalada pela Chrome Web Store: "Atualizar" pede a versão nova ao Chrome e recarrega.
// - Instalada por pasta (modo desenvolvedor): o Chrome não deixa a extensão trocar os próprios
//   arquivos. "Atualizar" baixa o zip; quando os arquivos novos chegam na pasta (zip extraído por
//   cima, ou gravados pela IA), a extensão percebe sozinha em até 1 min e se recarrega — sem ↻.
// - Depois de recarregar, as abas do Duolingo recarregam e o Auto Grind continua sozinho.
const REPO = 'DredsGG/midas';
// v0.15.0: o mesmo arquivo roda como service worker (Chrome, Edge, Brave, Opera GX) e como página de
// fundo (Firefox, "background.scripts"). Nada de window/DOM aqui.
const IS_FIREFOX = typeof browser !== 'undefined' && typeof browser.runtime?.getBrowserInfo === 'function';
const DUO = 'https://www.duolingo.com/*';
// v0.17.0 (regra 14 revisada em 27/10): procura a cada 30 min; a página do Duolingo também pede ao
// abrir e ao voltar para a aba, no máximo 1 vez a cada 10 min (pedido "soft").
const CHECK_EVERY_MIN = 30;
const SOFT_MIN_MS = 10 * 60e3;
const DISK_EVERY_MIN = 1;

// v0.15.0: no Firefox o usuário pode tirar a permissão do duolingo.com em about:addons; sem ela os
// scripts não entram na página. O popup mostra o aviso e o ícone ganha um "!" vermelho.
const hasSitePerm = async () => { try { return await chrome.permissions.contains({ origins: [DUO] }); } catch { return true; } };
const paint = async () => {
  const { alp_running } = await chrome.storage.local.get('alp_running');
  const perm = await hasSitePerm();
  const text = !perm ? '!' : alp_running === 'grind' ? 'AUTO' : alp_running === 'lesson' ? 'ON' : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: !perm ? '#ff4b4b' : alp_running === 'grind' ? '#e0a800' : '#58cc02' });
};
chrome.permissions?.onAdded?.addListener(paint);
chrome.permissions?.onRemoved?.addListener(paint);

// "0.12.10" > "0.12.9"
const cmpVer = (a, b) => {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};
const current = () => chrome.runtime.getManifest().version;
const installType = async () => { try { return (await chrome.management.getSelf()).installType; } catch { return 'development'; } };

const saveUpdate = async (patch) => {
  const { alp_update = {} } = await chrome.storage.local.get('alp_update');
  const next = { ...alp_update, ...patch };
  await chrome.storage.local.set({ alp_update: next });
  return next;
};

// v0.16.0 (regra 14): o resumo do quadro "Nova versão" vem do changelog da versão nova (PT, EN, ES),
// lido do próprio repo na tag do Release. Só texto: as frases são extraídas, nada é executado.
const fetchNews = async (ver) => {
  const out = {};
  await Promise.all(['pt', 'en', 'es'].map(async (lang) => {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/v${ver}/extension/src/changelog/${lang}.js`, { cache: 'no-store' });
      if (!r.ok) return;
      const src = await r.text();
      const head = src.indexOf(`'${ver}': [`);
      if (head < 0) return;
      const body = src.slice(head + ver.length + 5, src.indexOf('],', head));
      const lines = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).filter(Boolean).slice(0, 6);
      if (lines.length) out[lang] = lines;
    } catch { /* sem rede: o quadro usa as notas do Release */ }
  }));
  return Object.keys(out).length ? out : null;
};

// Release com "URGENTE" no título (o André marca para bug grave): quadro sem X e grind pausado até atualizar
const isUrgent = (j) => /URGENTE?\b/i.test(String(j?.name || ''));
const checkUpdate = async (opts = {}) => {
  if (opts.soft) {
    const { alp_update } = await chrome.storage.local.get('alp_update');
    if (alp_update?.checkedAt && Date.now() - alp_update.checkedAt < SOFT_MIN_MS) return alp_update;
  }
  const cur = current();
  const base = { checkedAt: Date.now(), current: cur, installType: await installType() };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const latest = String(j.tag_name || '').replace(/^v/i, '');
    const zip = (j.assets || []).find((a) => /\.zip$/i.test(a.name))?.browser_download_url || null;
    const xpi = (j.assets || []).find((a) => /\.xpi$/i.test(a.name))?.browser_download_url || null;
    const available = !!latest && cmpVer(latest, cur) > 0;
    const news = available ? await fetchNews(latest) : null;
    const st = await saveUpdate({
      ...base, latest, news, notes: String(j.body || '').slice(0, 4000), page: j.html_url || null, zip, xpi, browser: IS_FIREFOX ? 'firefox' : 'chromium',
      available, urgent: available && isUrgent(j), title: String(j.name || ''), error: null,
    });
    // instalada pela loja + grind rodando sozinho: aplica já (a página recarrega e o grind continua)
    if (st.available && st.installType === 'normal' && !IS_FIREFOX) {
      const { alp_grind } = await chrome.storage.local.get('alp_grind');
      if (alp_grind?.active) await applyUpdate();
    }
    return st;
  } catch (e) {
    return saveUpdate({ ...base, error: String(e?.message || e) });
  }
};

const applyUpdate = async () => {
  const st = (await chrome.storage.local.get('alp_update')).alp_update || {};
  if (IS_FIREFOX) {
    // Firefox: abre o .xpi assinado do Release e o próprio Firefox pede para instalar por cima.
    // (Com o update_url do manifest ele também se atualiza sozinho, em até um dia.)
    const url = st.xpi || st.page || `https://github.com/${REPO}/releases/latest`;
    await chrome.tabs.create({ url, active: true });
    await saveUpdate({ downloadedAt: Date.now() });
    return { mode: 'xpi', status: st.xpi ? 'downloaded' : 'page' };
  }
  if (await installType() === 'normal') {
    // Chrome Web Store: baixa a versão nova e recarrega para aplicar
    const res = await new Promise((ok) => chrome.runtime.requestUpdateCheck((status, details) => ok({ status, details })));
    if (res.status === 'update_available') { setTimeout(() => chrome.runtime.reload(), 1500); return { mode: 'store', status: 'applying' }; }
    return { mode: 'store', status: res.status }; // no_update / throttled
  }
  // por pasta: baixa o zip do Release (a aba aberta só para o download fecha sozinha)
  const url = st.zip || st.page || `https://github.com/${REPO}/releases/latest`;
  await chrome.tabs.create({ url, active: false });
  await saveUpdate({ downloadedAt: Date.now() });
  return { mode: 'download', status: 'downloaded' };
};

// por pasta: arquivos novos na pasta → recarrega sozinho (o manifest é gravado por último;
// espera 15 s para o zip terminar de ser extraído antes de recarregar)
let pendingReload = null;
const watchDisk = async () => {
  if (await installType() !== 'development') return;
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const onDisk = (await r.json()).version;
    if (onDisk && onDisk !== current()) {
      if (pendingReload === onDisk) return;
      pendingReload = onDisk;
      setTimeout(() => chrome.runtime.reload(), 15000);
    }
  } catch { /* manifest no meio da gravação: tenta no próximo minuto */ }
};

// v0.13.6 — sentinela: a aba do grind manda um sinal de vida a cada 10 s (alp_beat). Se a
// página congelar (o Chrome para de responder, nem o reinício de 1 h roda), o sinal some;
// depois de 4 min sem sinal com o grind ligado, recarrega a aba. Se nem isso adiantar,
// fecha a aba travada e abre outra no /learn (o grind retoma sozinho).
const STALE_MS = 4 * 60e3;
const watchGrind = async () => {
  const { alp_grind, alp_beat, alp_lock, alp_outage } = await chrome.storage.local.get(['alp_grind', 'alp_beat', 'alp_lock', 'alp_outage']);
  // grind parado de propósito (ou que terminou sozinho) solta o alp_lock; aba congelada não solta
  if (!alp_grind?.active || !alp_beat?.tabId || !alp_lock) return;
  try { if ((await chrome.tabs.get(alp_beat.tabId)).frozen) return onFrozen(alp_beat.tabId); } catch { /* aba fechada: segue abaixo */ }
  if (alp_outage) return; // v0.19.9: Duolingo fora do ar não é aba travada (a espera é da queda, não recarrega)
  if (Date.now() - alp_beat.at < STALE_MS) return;
  if (alp_beat.kickAt && Date.now() - alp_beat.kickAt < STALE_MS) return; // espera a última ação surtir efeito
  let tab = null;
  try { tab = await chrome.tabs.get(alp_beat.tabId); } catch { /* aba fechada */ }
  if (!tab || !/^https:\/\/www\.duolingo\.com\//.test(tab.url || tab.pendingUrl || '')) {
    await chrome.storage.local.remove('alp_beat'); // fecharam a aba ou saíram do Duolingo: não insiste
    return;
  }
  const kicks = (alp_beat.kicks || 0) + 1;
  await chrome.storage.local.set({ alp_beat: { ...alp_beat, kickAt: Date.now(), kicks }, alp_watch: { at: Date.now(), kicks } });
  if (kicks === 1) {
    await chrome.tabs.reload(tab.id, { bypassCache: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url: 'https://www.duolingo.com/learn', windowId: tab.windowId, index: tab.index + 1, active: tab.active }).catch(() => {});
    await chrome.tabs.remove(tab.id).catch(() => {});
    await chrome.storage.local.remove('alp_beat');
  }
};
// v0.13.6 — o Chrome com "Economia de energia" congela (frozen) a aba que está em segundo
// plano há 5 min gastando CPU: nada roda nela até alguém abrir a aba. Quando isso acontece
// com a aba do grind, recarrega na hora (a página nova volta a rodar e o grind retoma).
const onFrozen = async (tabId) => {
  const { alp_grind, alp_beat, alp_lock } = await chrome.storage.local.get(['alp_grind', 'alp_beat', 'alp_lock']);
  if (!alp_grind?.active || !alp_lock || alp_beat?.tabId !== tabId) return;
  if (alp_beat.frozenAt && Date.now() - alp_beat.frozenAt < 20000) return; // já recarregando
  await chrome.storage.local.set({ alp_beat: { ...alp_beat, frozenAt: Date.now() }, alp_watch: { at: Date.now(), reason: 'frozen' } });
  await chrome.tabs.reload(tabId).catch(() => {});
};
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.frozen === true) onFrozen(tabId); });

const onBeat = async (tabId) => {
  if (tabId == null) return;
  const { alp_beat } = await chrome.storage.local.get('alp_beat');
  if (alp_beat?.tabId !== tabId) chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {}); // o Chrome não descarta a aba do grind
  await chrome.storage.local.set({ alp_beat: { tabId, at: Date.now(), kicks: 0 } });
};

// v0.19.0 — vigia do grind dentro do Midas (pedido do André em 2026-10-29; antes era uma tarefa
// agendada 5x/dia). Com o grind ligado (só o Parar desliga) e a chave "Reiniciar sozinho se parar"
// ligada, a cada 10 min e 1,5 min depois de abrir o navegador:
// - nenhuma aba com o lock fresco e a aba do grind sumiu → abre /learn em segundo plano (aba fechada,
//   ou navegador reiniciado sem reabrir as abas); a página nova retoma pelo maybeResume da ponte;
// - a aba do grind existe mas soltou o lock sem o Parar → recarrega a aba (parou sozinho);
// - lock fresco, mas sem avanço há 15 min fora de uma espera de recarga → manda a aba para a mesma
//   espera "travado: recarregando a página em N s" do grind (blockedWait), sem lógica nova;
// - lock velho com a aba existindo = página morta: é com o watchGrind acima (não duplica).
// Antes de agir sem lock, confirma 2 min depois (PC acordando, recarga de 1 h, abas restaurando).
// Cada reinício entra no log da aba (data, hora, causa) e em alp_restarts (os últimos 50).
const LIFE_EVERY_MIN = 10;
const LOCK_FRESH_MS = 60e3;
const STUCK_MS = 15 * 60e3;
const LEARN = 'https://www.duolingo.com/learn';
const isDuo = (t) => !!t && /^https:\/\/www\.duolingo\.com\//.test(t.url || t.pendingUrl || '');
const tabOrNull = async (id) => { if (id == null) return null; try { return await chrome.tabs.get(id); } catch { return null; } };
const noteRestart = async (cause, extra = {}) => {
  const at = Date.now();
  const { alp_restarts = [] } = await chrome.storage.local.get('alp_restarts');
  await chrome.storage.local.set({
    alp_restarts: alp_restarts.concat({ at, cause, ver: current(), ...extra }).slice(-50),
    alp_watch: { at, reason: cause },
  });
};
const openLearn = async () => {
  // reaproveita a aba que a própria vigia abriu antes, se ela ainda existir
  const { alp_life = {} } = await chrome.storage.local.get('alp_life');
  const mine = await tabOrNull(alp_life.tabId);
  if (isDuo(mine)) { await chrome.tabs.reload(mine.id).catch(() => {}); return mine.id; }
  let t = null;
  try { t = await chrome.tabs.create({ url: LEARN, active: false }); } catch {
    // sem janela aberta (ex.: macOS com o Chrome sem janelas): abre uma janela sem foco
    try { t = (await chrome.windows.create({ url: LEARN, focused: false })).tabs?.[0] || null; } catch { /* sem jeito */ }
  }
  if (t?.id != null) await chrome.storage.local.set({ alp_life: { ...alp_life, tabId: t.id } });
  return t?.id ?? null;
};
const lifeOn = async () => {
  const { alp_grind, alp_cfg, alp_update } = await chrome.storage.local.get(['alp_grind', 'alp_cfg', 'alp_update']);
  if (!alp_grind?.active || alp_cfg?.autoRestart === false) return false;
  if (alp_update?.available && alp_update?.urgent) return false; // versão urgente: a pausa é de propósito
  return true;
};
const watchLife = async (trigger = 'tick') => {
  if (!(await lifeOn())) return;
  const { alp_lock, alp_beat, alp_step, alp_restarts = [], alp_outage } = await chrome.storage.local.get(['alp_lock', 'alp_beat', 'alp_step', 'alp_restarts', 'alp_outage']);
  const now = Date.now();
  if (alp_lock && now - alp_lock.at < LOCK_FRESH_MS) {
    // rodando: confere se está avançando
    const tab = await tabOrNull(alp_beat?.tabId);
    if (!tab || !alp_step?.at) return;
    if (alp_outage) return; // v0.19.9: sem avanço porque o Duolingo está fora do ar: não é "travado" (o relógio zera quando a queda acaba)
    if (now < (alp_step.waitUntil || 0) + 60e3) return; // dentro da espera "travado: recarregando em N s"
    if (now - alp_step.at < STUCK_MS) return;
    if (alp_step.kickAt && now - alp_step.kickAt < STUCK_MS) return; // espera o último empurrão surtir efeito
    await chrome.storage.local.set({ alp_step: { ...alp_step, kickAt: now } });
    const mins = Math.round((now - alp_step.at) / 60e3);
    await noteRestart('stuck', { mins });
    await chrome.storage.local.remove('alp_watch'); // o aviso vai direto para a aba (não é página nova)
    try { await chrome.tabs.sendMessage(tab.id, { cmd: 'stuck', data: { at: now, mins } }); }
    catch { await chrome.storage.local.set({ alp_watch: { at: now, reason: 'stuck' } }); await chrome.tabs.reload(tab.id).catch(() => {}); }
    return;
  }
  const beatTab = await tabOrNull(alp_beat?.tabId);
  // lock velho com a aba ainda aberta: página morta/congelada → watchGrind (recarrega e, se precisar, troca a aba)
  if (isDuo(beatTab) && alp_lock) return;
  if (trigger === 'tick') { chrome.alarms.create('alp-life-confirm', { delayInMinutes: 2 }); return; }
  if (isDuo(beatTab)) {
    await noteRestart('stopped');
    await chrome.tabs.reload(beatTab.id).catch(() => {});
    return;
  }
  // a aba do grind sumiu (fechada, ou o navegador abriu de novo sem ela)
  const recentBoot = alp_restarts.some((r) => r.cause === 'startup' && now - r.at < 5 * 60e3);
  const cause = trigger === 'boot' || recentBoot ? 'startup' : 'closed';
  if (!(cause === 'startup' && recentBoot)) await noteRestart(cause);
  else await chrome.storage.local.set({ alp_watch: { at: now, reason: cause } });
  await openLearn();
};
// navegador aberto de novo com o grind ligado: as abas restauradas retomam sozinhas (e registram
// "navegador reiniciado"); se nenhuma assumir em 1,5 min, a vigia abre o /learn.
const onBoot = async () => {
  await chrome.storage.local.remove(['alp_outage', 'alp_outage_fails', 'alp_outage_cap']); // v0.19.9: queda de antes de fechar o navegador não vale mais
  if (!(await lifeOn())) return;
  await chrome.storage.local.remove(['alp_beat', 'alp_lock']); // ids de aba e lock da sessão anterior não valem mais
  await noteRestart('startup');
  chrome.alarms.create('alp-life-boot', { delayInMinutes: 1.5 });
};

// v0.19.9 — "Duolingo fora do ar" não é "Midas travado" (pedido do André em 2026-11-09).
// A página avisa cada falha de leitura/sessão (5xx ou erro de rede). Aqui:
// - 2 falhas em até 60 s E a sonda falhando = queda declarada (uma falha isolada não é queda);
// - navigator.onLine === false é "sem internet": mesma espera, mensagem diferente;
// - alp_outage {since, probes, nextAt, kind: 'down'|'offline', code} é visível a todas as abas;
// - espera crescente com sonda a cada passo: 1, 2, 5, 10, 20, 30 min (teto 30); a 1ª sonda que
//   responde encerra a queda (zera o estado, o relógio de "sem avanço" da vigia e avisa as abas);
// - queda declarada há mais de 6 h: volta ao comportamento de antes (pode ser o lado do André) e
//   registra em alp_restarts (causa 'outageCap'); a trava só solta quando o site responder de novo.
// Sonda: GET https://www.duolingo.com/robots.txt (826 B, texto estático servido pelo mesmo
// servidor do site; escolhido por ser o mais leve que a própria Duolingo serve sem conta: o /health
// responde 0 B mas parece ser do balanceador e não prova que o site responde), com
// credentials:'omit' e referrer vazio: sem cookie, sem conta, sem e-mail/ID, sem consulta no endereço.
const OUT_WAITS_MIN = [1, 2, 5, 10, 20, 30];
const OUT_FAIL_WIN_MS = 60e3;
const OUT_MAX_MS = 6 * 3600e3;
const OUT_PROBE_MS = 8000;
const OUT_PROBE_URL = 'https://www.duolingo.com/robots.txt';
const probeSite = async () => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), OUT_PROBE_MS);
  try {
    const r = await fetch(OUT_PROBE_URL, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ac.signal });
    // 5xx = fora do ar; qualquer outra resposta (2xx, 4xx) = o site está respondendo
    return { ok: r.status < 500, status: r.status };
  } catch { return { ok: false, status: 0 }; } // sem rede, erro de DNS/TLS ou passou de 8 s
  finally { clearTimeout(timer); }
};
let outQueue = Promise.resolve();
const outSerial = (fn) => (outQueue = outQueue.then(fn, fn)); // um sinal de cada vez (várias abas, falhas juntas)
const outAlarm = (when) => { try { chrome.alarms.create('alp-outage', { when }); } catch { /* o tick de 1 min cobre */ } };
const outDeclare = async (kind, code, now) => {
  const o = { since: now, probes: 1, nextAt: now + OUT_WAITS_MIN[0] * 60e3, kind, code: code || 0 };
  await chrome.storage.local.set({ alp_outage: o });
  await chrome.storage.local.remove('alp_outage_fails');
  outAlarm(o.nextAt);
  return o;
};
const outEnd = async (why, o) => {
  const now = Date.now();
  const { alp_step, alp_restarts = [] } = await chrome.storage.local.get(['alp_step', 'alp_restarts']);
  const set = { alp_outage_end: { at: now, why, since: o?.since || now } };
  // a queda não pode virar "15 min sem avanço" logo depois: o relógio da vigia recomeça agora
  if (alp_step) set.alp_step = { ...alp_step, at: now, waitUntil: 0, kickAt: 0 };
  if (why === 'cap') {
    set.alp_outage_cap = { at: now };
    set.alp_restarts = alp_restarts.concat({ at: now, cause: 'outageCap', ver: current(), mins: Math.round((now - (o?.since || now)) / 60e3) }).slice(-50);
  }
  await chrome.storage.local.set(set); // o aviso de fim vai antes de apagar a queda (a aba lê os dois)
  await chrome.storage.local.remove(['alp_outage', 'alp_outage_fails']);
  try { chrome.alarms.clear('alp-outage'); } catch { /* ok */ }
};
const onOutageFail = ({ kind, code } = {}) => outSerial(async () => {
  const { alp_outage, alp_outage_cap, alp_outage_fails = [], alp_outage_probeAt = 0 } =
    await chrome.storage.local.get(['alp_outage', 'alp_outage_cap', 'alp_outage_fails', 'alp_outage_probeAt']);
  if (alp_outage) return { outage: alp_outage };
  if (alp_outage_cap) return { outage: null, capped: true };
  const now = Date.now();
  // sem internet: sem sonda e sem contar falhas (o navegador já sabe). Confere no próprio service worker.
  if (kind === 'offline' && typeof navigator !== 'undefined' && navigator.onLine === false) return { outage: await outDeclare('offline', 0, now) };
  const fails = alp_outage_fails.filter((f) => now - f.at <= OUT_FAIL_WIN_MS).concat({ at: now, code: Number(code) || 0 });
  await chrome.storage.local.set({ alp_outage_fails: fails });
  if (fails.length < 2) return { outage: null };
  if (now - alp_outage_probeAt < 10e3) return { outage: null }; // acabou de sondar e o site respondeu
  await chrome.storage.local.set({ alp_outage_probeAt: now });
  const pr = await probeSite();
  if (pr.ok) return { outage: null };
  const lastCode = fails.slice().reverse().find((f) => f.code)?.code || pr.status || 0;
  const k = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'down';
  return { outage: await outDeclare(k, lastCode, Date.now()) };
});
const onOutageOk = () => outSerial(async () => {
  await chrome.storage.local.remove(['alp_outage_fails', 'alp_outage_cap']); // a página falou com o site: zera as falhas e solta a trava das 6 h
  return { ok: true };
});
const outageStep = () => outSerial(async () => {
  const { alp_outage: o } = await chrome.storage.local.get('alp_outage');
  if (!o) return;
  const now = Date.now();
  if (now - o.since > OUT_MAX_MS) return outEnd('cap', o);
  if (now < o.nextAt - 2000) return; // o tick de 1 min chegou antes da hora
  const pr = await probeSite();
  if (pr.ok) return outEnd('up', o);
  const probes = o.probes + 1;
  const next = Date.now() + OUT_WAITS_MIN[Math.min(probes - 1, OUT_WAITS_MIN.length - 1)] * 60e3;
  const kind = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'down';
  await chrome.storage.local.set({ alp_outage: { ...o, probes, nextAt: next, kind, code: pr.status || o.code || 0 } });
  outAlarm(next);
});

// v0.19.14: log das abas em fila (uma gravação por vez; antes cada aba lia e gravava o alp_log e uma apagava a outra)
let logQueue = Promise.resolve();
const appendLog = (lines) => {
  const p = logQueue.then(async () => {
    if (!Array.isArray(lines) || !lines.length) return;
    const { alp_log = [] } = await chrome.storage.local.get('alp_log');
    await chrome.storage.local.set({ alp_log: alp_log.concat(lines.slice(-500)).slice(-500) });
  });
  logQueue = p.catch(() => {}); // a fila segue mesmo se uma gravação falhar; quem chamou recebe o erro (ok:false)
  return p;
};

const schedule = () => {
  chrome.alarms.create('alp-update', { delayInMinutes: 1, periodInMinutes: CHECK_EVERY_MIN });
  chrome.alarms.create('alp-disk', { delayInMinutes: DISK_EVERY_MIN, periodInMinutes: DISK_EVERY_MIN });
  chrome.alarms.create('alp-life', { delayInMinutes: LIFE_EVERY_MIN, periodInMinutes: LIFE_EVERY_MIN });
};
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'alp-update') checkUpdate();
  if (a.name === 'alp-disk') { watchDisk(); watchGrind(); outageStep(); } // o tick de 1 min também move a espera da queda (reserva do alarme)
  if (a.name === 'alp-outage') outageStep();
  if (a.name === 'alp-life') watchLife('tick');
  if (a.name === 'alp-life-confirm') watchLife('confirm');
  if (a.name === 'alp-life-boot') watchLife('boot');
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.cmd === 'beat') { onBeat(sender?.tab?.id); return false; }
  if (msg?.cmd === 'outageFail') { onOutageFail(msg).then(reply, () => reply({ outage: null })); return true; }
  if (msg?.cmd === 'log') { appendLog(msg.lines).then(() => reply({ ok: true }), () => reply({ ok: false })); return true; }
  if (msg?.cmd === 'outageOk') { onOutageOk().then(reply, () => reply({ ok: false })); return true; }
  if (msg?.cmd === 'updCheck') { checkUpdate({ soft: !!msg.soft }).then(reply); return true; }
  if (msg?.cmd === 'openGuide') { chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html') + (msg.hash || '') }).then(() => reply({ ok: true })); return true; }
  if (msg?.cmd === 'updApply') { applyUpdate().then(reply, (e) => reply({ status: 'error', error: String(e?.message || e) })); return true; }
  return false;
});

chrome.storage.onChanged.addListener((changes) => { if (changes.alp_running) paint(); });
// v0.17.0: abrir o navegador de novo desfaz o "adiar" do X (o aviso volta na próxima abertura)
chrome.runtime.onStartup.addListener(async () => { paint(); schedule(); onBoot(); await saveUpdate({ snooze: null }); checkUpdate(); });
const onInstall = async (d) => {
  paint();
  schedule();
  // primeira instalação: abre o guia nos primeiros passos
  if (d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html#usar') });
  // v0.15.0 (regra 12): instalação nova → só o tutorial; atualização → quadro de novidades uma vez
  const { alp_seen } = await chrome.storage.local.get('alp_seen');
  if (d.reason === 'install' && !alp_seen) await chrome.storage.local.set({ alp_seen: { tutorial: false, news: current() } });
  if (d.reason === 'update' && !alp_seen) await chrome.storage.local.set({ alp_seen: { tutorial: true, news: d.previousVersion || '' } });
  if (d.reason === 'update') {
    // aviso "atualizado para vX" na HUD/popup + versão nova já conferida no GitHub
    await saveUpdate({ justUpdated: { from: d.previousVersion || null, to: current(), at: Date.now() }, available: false, urgent: false, snooze: null, current: current() });
    // versão nova pode resolver o que fez um nó ser pulado: retenta todos os pulados
    const { alp_grind } = await chrome.storage.local.get('alp_grind');
    if (alp_grind) await chrome.storage.local.set({ alp_grind: { ...alp_grind, skip: {} } });
    // as abas do Duolingo abertas ainda rodam a versão antiga, sem conexão com a extensão:
    // recarregar põe a nova; o Auto Grind retoma sozinho (alp_grind.active fica salvo)
    // v0.19.0: o lock da aba antiga ainda parece fresco por até 30 s, mas aquela página já não fala com a
    // extensão (morreu no reload). Sem apagar, a aba recarregada achava "o grind está rodando em outra
    // aba", ficava parada e só voltava 4 min depois, pela sentinela (visto ao vivo na troca para a v0.19.0).
    await chrome.storage.local.remove('alp_lock');
    const tabs = await chrome.tabs.query({ url: 'https://www.duolingo.com/*' });
    for (const t of tabs) chrome.tabs.reload(t.id);
  }
  checkUpdate();
};
chrome.runtime.onInstalled.addListener(onInstall);
