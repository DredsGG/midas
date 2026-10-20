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
  });

  // retoma o grind se a página recarregar no meio (crash, deploy do Duolingo, etc.)
  let resumed = false;
  const maybeResume = safe(async () => {
    if (resumed) return;
    resumed = true;
    const { alp_grind } = await chrome.storage.local.get('alp_grind');
    if (alp_grind?.active) {
      setTimeout(() => send('grind', { skip: alp_grind.skip || {}, resume: true }), 2500);
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
        if (data.running === 'grind') active = true;
        else if (data.running === null && data.was === 'grind') active = false;
        await chrome.storage.local.set({ alp_running: data.running, alp_grind: { ...alp_grind, active } });
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
