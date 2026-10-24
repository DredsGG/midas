// Midas — ponte (mundo ISOLATED): chrome.* ⇄ script da página via CustomEvent.
(() => {
  const DEFAULTS = { delay: 0, humanize: false, preset: 'rage', debug: false };
  const send = (cmd, data) =>
    document.dispatchEvent(new CustomEvent('alp:in', { detail: { cmd, data } }));

  // Depois do ↻ em chrome://extensions, esta ponte (da versão antiga) continua viva na aba
  // aberta, mas o chrome.* dela morre: qualquer chamada dá "Extension context invalidated".
  // Aqui ela percebe isso, para de falar com o Chrome e avisa a HUD para recarregar a aba.
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  let dead = false;
  const goDead = () => {
    if (dead) return;
    dead = true;
    document.removeEventListener('alp:out', onOut);
    document.dispatchEvent(new CustomEvent('alp:out', { detail: { type: 'stale' } }));
  };
  const safe = (fn) => async (...a) => {
    if (dead) return;
    if (!alive()) return goDead();
    try { return await fn(...a); } catch (err) { if (!alive()) goDead(); else throw err; }
  };

  const pushConfig = safe(async () => {
    const { alp_cfg } = await chrome.storage.local.get('alp_cfg');
    send('config', { ...DEFAULTS, ...(alp_cfg || {}) });
  });

  // idioma escolhido nas bandeirinhas (vale para HUD, popup e todas as abas)
  const pushLang = safe(async () => {
    const { alp_lang, alp_theme } = await chrome.storage.local.get(['alp_lang', 'alp_theme']);
    if (alp_lang) send('lang', alp_lang);
    if (alp_theme) send('theme', alp_theme);
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.alp_lang?.newValue) send('lang', ch.alp_lang.newValue);
    if (ch.alp_theme?.newValue) send('theme', ch.alp_theme.newValue);
    if (ch.alp_update?.newValue) toHud('update', ch.alp_update.newValue);
  });

  // v0.13.0: atualizações (o service worker procura no GitHub; aqui só leva e traz para a HUD)
  const toHud = (type, data) => document.dispatchEvent(new CustomEvent('alp:out', { detail: { type, data } }));
  const pushUpdate = safe(async () => {
    const { alp_update } = await chrome.storage.local.get('alp_update');
    toHud('update', alp_update || {});
    // a HUD abriu e a última procura tem mais de 1 h: procura de novo
    if (!alp_update?.checkedAt || Date.now() - alp_update.checkedAt > 3600e3) chrome.runtime.sendMessage({ cmd: 'updCheck' }).catch(() => {});
  });

  // v0.12.9: uma aba só roda o grind. Cada aba tem um id que sobrevive ao reload
  // (sessionStorage é por aba); a aba que roda renova alp_lock a cada 10 s.
  let tabId = null;
  try { tabId = sessionStorage.getItem('alp.tab'); } catch { /* ok */ }
  if (!tabId) { tabId = Math.random().toString(36).slice(2); try { sessionStorage.setItem('alp.tab', tabId); } catch { /* ok */ } }
  const LOCK_TTL = 30000;
  const otherTabRunning = async () => {
    const { alp_lock } = await chrome.storage.local.get('alp_lock');
    return !!alp_lock && alp_lock.id !== tabId && Date.now() - alp_lock.at < LOCK_TTL;
  };
  let beat = null, beatStart = 0;
  const holdLock = safe(async () => { await chrome.storage.local.set({ alp_lock: { id: tabId, at: Date.now() } }); });
  const startBeat = () => { if (!beat) { beatStart = Date.now(); holdLock(); beat = setInterval(holdLock, 10000); } };
  const stopBeat = safe(async () => {
    if (beat) { clearInterval(beat); beat = null; }
    const { alp_lock } = await chrome.storage.local.get('alp_lock');
    if (alp_lock?.id === tabId) await chrome.storage.local.remove('alp_lock');
  });
  // outra aba começou o grind: esta sai sem desligar o grind (não é o Parar)
  chrome.storage.onChanged.addListener((ch) => {
    const l = ch.alp_lock?.newValue;
    // duas abas retomando juntas (ex.: ↻ recarrega todas): fica a de id menor
    if (beat && l && l.id !== tabId && (Date.now() - beatStart > 5000 || l.id < tabId)) {
      clearInterval(beat); beat = null; send('yield');
    }
  });

  // retoma o grind se a página recarregar no meio (crash, deploy do Duolingo, etc.) —
  // só se nenhuma outra aba já estiver rodando
  let resumed = false;
  const maybeResume = safe(async () => {
    if (resumed) return;
    resumed = true;
    const { alp_grind } = await chrome.storage.local.get('alp_grind');
    if (alp_grind?.active) {
      setTimeout(safe(async () => {
        if (await otherTabRunning()) { send('note', 'otherTab'); return; }
        send('grind', { skip: alp_grind.skip || {}, resume: true });
      }), 2500 + Math.floor(Math.random() * 1500));
    }
  });

  // manda progresso/log salvos para a HUD (ela abre com os dados da última sessão)
  const hydrate = safe(async () => {
    const { alp_progress, alp_log, alp_unknown } = await chrome.storage.local.get(['alp_progress', 'alp_log', 'alp_unknown']);
    send('hydrate', { version: chrome.runtime.getManifest().version, progress: alp_progress || null, log: alp_log || [], unknown: alp_unknown || {} });
  });

  // log circular + progresso → storage (o popup lê daqui)
  let logBuf = [];
  let flushT = null;
  const flush = safe(async () => {
    flushT = null;
    const { alp_log = [] } = await chrome.storage.local.get('alp_log');
    const merged = alp_log.concat(logBuf).slice(-500);
    logBuf = [];
    await chrome.storage.local.set({ alp_log: merged });
  });

  const onOut = safe(async (e) => {
    const { type, data } = e.detail || {};
    switch (type) {
      case 'ready': {
        await pushConfig();
        await pushLang();
        await hydrate();
        await maybeResume();
        await pushUpdate();
        break;
      }
      case 'updCheck': {
        toHud('updResult', { status: 'checking' });
        const st = await chrome.runtime.sendMessage({ cmd: 'updCheck' });
        toHud('updResult', { status: st?.error ? 'error' : st?.available ? 'available' : 'none', st });
        break;
      }
      case 'updApply': {
        toHud('updResult', { status: 'applying' });
        const r = await chrome.runtime.sendMessage({ cmd: 'updApply' });
        toHud('updResult', r || { status: 'error' });
        break;
      }
      case 'openGuide': {
        await chrome.runtime.sendMessage({ cmd: 'openGuide', hash: data || '' });
        break;
      }
      case 'updDismiss': {
        const { alp_update = {} } = await chrome.storage.local.get('alp_update');
        await chrome.storage.local.set({ alp_update: { ...alp_update, dismissed: data ?? null, justUpdated: null } });
        break;
      }
      case 'saveTheme': {
        await chrome.storage.local.set({ alp_theme: data });
        break;
      }
      case 'saveLang': {
        await chrome.storage.local.set({ alp_lang: data });
        break;
      }
      case 'saveConfig': {
        const { alp_cfg = {} } = await chrome.storage.local.get('alp_cfg');
        await chrome.storage.local.set({ alp_cfg: { ...alp_cfg, ...data } });
        break;
      }
      case 'log':
        logBuf.push(data);
        if (!flushT) flushT = setTimeout(flush, 700);
        break;
      case 'progress':
        await chrome.storage.local.set({ alp_progress: { ...data, at: Date.now() } });
        break;
      case 'grindStep': {
        const { alp_grind = {} } = await chrome.storage.local.get('alp_grind');
        await chrome.storage.local.set({ alp_grind: { ...alp_grind, skip: data.skip } });
        break;
      }
      case 'grindDone': {
        await chrome.storage.local.set({ alp_grind: { active: false, skip: {} } });
        break;
      }
      case 'state': {
        // "active" liga quando o grind começa e só desliga quando ele é parado
        // explicitamente; um reload da página não emite nada, então o grind retoma.
        const { alp_grind = {} } = await chrome.storage.local.get('alp_grind');
        let active = alp_grind.active;
        if (data.running === 'grind') startBeat(); else if (data.running === null && data.was === 'grind') await stopBeat();
        if (data.running === 'grind') active = true;
        // v0.12.7: só o Parar desliga; o grind terminar sozinho não (completo já zera em grindDone)
        else if (data.running === null && data.was === 'grind' && data.manual !== false) active = false;
        await chrome.storage.local.set({ alp_running: data.running, alp_grind: { ...alp_grind, active } });
        break;
      }
      case 'reloading': {
        // recarga programada (1 h) ou por travamento: garante "ativo" salvo antes do reload
        const { alp_grind = {} } = await chrome.storage.local.get('alp_grind');
        await chrome.storage.local.set({ alp_grind: { ...alp_grind, active: true, skip: data?.fresh ? {} : (alp_grind.skip || {}) } });
        if (flushT) { clearTimeout(flushT); await flush(); }
        location.reload();
        break;
      }
      case 'unknownType': {
        const { alp_unknown = {} } = await chrome.storage.local.get('alp_unknown');
        alp_unknown[data.type] = { keys: data.keys, at: Date.now() };
        await chrome.storage.local.set({ alp_unknown });
        break;
      }
    }
  });
  document.addEventListener('alp:out', onOut);

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    (async () => {
      if (msg?.cmd === 'grind') {
        // início manual: zera a lista de pulos salva
        await chrome.storage.local.set({ alp_grind: { active: true, skip: {} } });
        send('grind', {});
      } else if (msg?.cmd === 'stop') {
        const { alp_grind = {} } = await chrome.storage.local.get('alp_grind');
        await chrome.storage.local.set({ alp_grind: { ...alp_grind, active: false } });
        send('stop');
      } else if (msg?.cmd === 'config') {
        await pushConfig();
      } else if (msg?.cmd) {
        send(msg.cmd, msg.data);
      }
      reply({ ok: true });
    })();
    return true;
  });

  pushConfig();
  pushLang();
  setTimeout(hydrate, 300); // o script da página pode ter carregado antes da ponte
  maybeResume();
})();
