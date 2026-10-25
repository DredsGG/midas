// Midas — service worker: badge do ícone + atualizações (v0.13.0).
//
// Atualização (pedido do André em 2026-10-23, regra 7 nova):
// - Procura versão nova nos Releases do GitHub (DredsGG/midas): ao abrir o Chrome, a cada 6 h
//   e quando alguém clica em "Procurar atualização" (HUD ou popup).
// - Instalada pela Chrome Web Store: "Atualizar" pede a versão nova ao Chrome e recarrega.
// - Instalada por pasta (modo desenvolvedor): o Chrome não deixa a extensão trocar os próprios
//   arquivos. "Atualizar" baixa o zip; quando os arquivos novos chegam na pasta (zip extraído por
//   cima, ou gravados pela IA), a extensão percebe sozinha em até 1 min e se recarrega — sem ↻.
// - Depois de recarregar, as abas do Duolingo recarregam e o Auto Grind continua sozinho.
const REPO = 'DredsGG/midas';
const CHECK_EVERY_MIN = 360;
const DISK_EVERY_MIN = 1;

const paint = async () => {
  const { alp_running } = await chrome.storage.local.get('alp_running');
  const text = alp_running === 'grind' ? 'AUTO' : alp_running === 'lesson' ? 'ON' : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: alp_running === 'grind' ? '#e0a800' : '#58cc02' });
};

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

const checkUpdate = async () => {
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
    const st = await saveUpdate({
      ...base, latest, notes: String(j.body || '').slice(0, 4000), page: j.html_url || null, zip,
      available: !!latest && cmpVer(latest, cur) > 0, error: null,
    });
    // instalada pela loja + grind rodando sozinho: aplica já (a página recarrega e o grind continua)
    if (st.available && st.installType === 'normal') {
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
  const { alp_grind, alp_beat, alp_lock } = await chrome.storage.local.get(['alp_grind', 'alp_beat', 'alp_lock']);
  // grind parado de propósito (ou que terminou sozinho) solta o alp_lock; aba congelada não solta
  if (!alp_grind?.active || !alp_beat?.tabId || !alp_lock) return;
  try { if ((await chrome.tabs.get(alp_beat.tabId)).frozen) return onFrozen(alp_beat.tabId); } catch { /* aba fechada: segue abaixo */ }
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

const schedule = () => {
  chrome.alarms.create('alp-update', { delayInMinutes: 1, periodInMinutes: CHECK_EVERY_MIN });
  chrome.alarms.create('alp-disk', { delayInMinutes: DISK_EVERY_MIN, periodInMinutes: DISK_EVERY_MIN });
};
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'alp-update') checkUpdate();
  if (a.name === 'alp-disk') { watchDisk(); watchGrind(); }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.cmd === 'beat') { onBeat(sender?.tab?.id); return false; }
  if (msg?.cmd === 'updCheck') { checkUpdate().then(reply); return true; }
  if (msg?.cmd === 'openGuide') { chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html') + (msg.hash || '') }).then(() => reply({ ok: true })); return true; }
  if (msg?.cmd === 'updApply') { applyUpdate().then(reply, (e) => reply({ status: 'error', error: String(e?.message || e) })); return true; }
  return false;
});

chrome.storage.onChanged.addListener((changes) => { if (changes.alp_running) paint(); });
chrome.runtime.onStartup.addListener(() => { paint(); schedule(); checkUpdate(); });
chrome.runtime.onInstalled.addListener(async (d) => {
  paint();
  schedule();
  // primeira instalação: abre o guia nos primeiros passos
  if (d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html#usar') });
  if (d.reason === 'update') {
    // aviso "atualizado para vX" na HUD/popup + versão nova já conferida no GitHub
    await saveUpdate({ justUpdated: { from: d.previousVersion || null, to: current(), at: Date.now() }, available: false, current: current() });
    // versão nova pode resolver o que fez um nó ser pulado: retenta todos os pulados
    const { alp_grind } = await chrome.storage.local.get('alp_grind');
    if (alp_grind) await chrome.storage.local.set({ alp_grind: { ...alp_grind, skip: {} } });
    // as abas do Duolingo abertas ainda rodam a versão antiga, sem conexão com a extensão:
    // recarregar põe a nova; o Auto Grind retoma sozinho (alp_grind.active fica salvo)
    const tabs = await chrome.tabs.query({ url: 'https://www.duolingo.com/*' });
    for (const t of tabs) chrome.tabs.reload(t.id);
  }
  checkUpdate();
});
