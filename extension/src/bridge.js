// Midas — ponte (mundo ISOLATED): chrome.* ⇄ script da página via CustomEvent.
(() => {
  const DEFAULTS = { delay: 0, humanize: false, preset: 'rage', debug: false, autoRestart: true };
  // v0.15.0 (Firefox): objeto criado aqui (mundo isolado) chega à página sem acesso às propriedades.
  // cloneInto (só existe no Firefox) copia o detail para a página; no Chromium o objeto passa direto.
  const toPage = (o) => (typeof cloneInto === 'function' ? cloneInto(o, document.defaultView) : o);
  const fire = (name, detail) => document.dispatchEvent(new window.CustomEvent(name, { detail: toPage(detail) }));
  // e o contrário: no Firefox o detail vindo da página chega embrulhado (Xray); copia para um objeto nosso
  const fromPage = (d) => {
    if (!d || typeof d !== 'object') return d;
    try { return JSON.parse(JSON.stringify(d.wrappedJSObject || d)); } catch { return d; }
  };
  const send = (cmd, data) => fire('alp:in', { cmd, data });

  // Depois do ↻ em chrome://extensions, esta ponte (da versão antiga) continua viva na aba
  // aberta, mas o chrome.* dela morre: qualquer chamada dá "Extension context invalidated".
  // Aqui ela percebe isso, para de falar com o Chrome e avisa a HUD para recarregar a aba.
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  let dead = false;
  const goDead = () => {
    if (dead) return;
    dead = true;
    document.removeEventListener('alp:out', onOut);
    fire('alp:out', { type: 'stale' });
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
    if (ch.alp_update?.newValue) { toHud('update', ch.alp_update.newValue); setUrgent(ch.alp_update.newValue); }
  });

  // v0.13.0: atualizações (o service worker procura no GitHub; aqui só leva e traz para a HUD)
  const toHud = (type, data) => fire('alp:out', { type, data });
  const pushUpdate = safe(async () => {
    const { alp_update } = await chrome.storage.local.get('alp_update');
    toHud('update', alp_update || {});
    setUrgent(alp_update);
  });
  // v0.17.0 (regra 14 revisada): com a página aberta, procura versão nova ao abrir, a cada 30 min e
  // ao voltar para a aba. O service worker segura no máximo 1 procura a cada 10 min ("soft").
  const softCheck = safe(async () => { await chrome.runtime.sendMessage({ cmd: 'updCheck', soft: true }); });
  setInterval(softCheck, 30 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') softCheck(); });
  addEventListener('focus', () => softCheck());
  // versão URGENTE: nada roda até atualizar (o grind salvo continua ligado e retoma depois)
  let urgent = false;
  const setUrgent = (u) => { urgent = !!(u && u.available && u.urgent); if (urgent) send('pause'); };

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
  const resetStep = safe(async () => {
    const { alp_step = {} } = await chrome.storage.local.get('alp_step');
    await chrome.storage.local.set({ alp_step: { ...alp_step, at: Date.now(), waitUntil: 0 } });
  });
  const holdLock = safe(async () => {
    await chrome.storage.local.set({ alp_lock: { id: tabId, at: Date.now() } });
    // v0.13.6: sinal de vida para a sentinela do service worker (recarrega a aba se ela congelar)
    chrome.runtime.sendMessage({ cmd: 'beat' }).catch(() => {});
  });
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
    const { alp_grind, alp_watch } = await chrome.storage.local.get(['alp_grind', 'alp_watch']);
    // a sentinela recarregou esta aba porque ela congelou: registra no log
    if (alp_watch?.at && Date.now() - alp_watch.at < 180000) {
      await chrome.storage.local.remove('alp_watch');
      // v0.19.0: reinício pela vigia (aba fechada, navegador reiniciado, parou sozinho, travado)
      if (['closed', 'startup', 'stopped', 'stuck'].includes(alp_watch.reason)) setTimeout(() => send('restarted', { cause: alp_watch.reason, at: alp_watch.at }), 2000);
      else setTimeout(() => send('note', alp_watch.reason === 'frozen' ? 'frozen' : 'watchdog'), 2000);
    }
    if (alp_grind?.active) {
      setTimeout(safe(async () => {
        if (urgent) { send('note', 'updUrgent'); return; }
        if (await otherTabRunning()) { send('note', 'otherTab'); return; }
        send('grind', { skip: alp_grind.skip || {}, resume: true });
      }), 2500 + Math.floor(Math.random() * 1500));
    }
  });

  // manda progresso/log salvos para a HUD (ela abre com os dados da última sessão)
  const hydrate = safe(async () => {
    const { alp_progress, alp_log, alp_unknown, alp_seen, alp_restarts } = await chrome.storage.local.get(['alp_progress', 'alp_log', 'alp_unknown', 'alp_seen', 'alp_restarts']);
    send('hydrate', { version: chrome.runtime.getManifest().version, progress: alp_progress || null, log: alp_log || [], unknown: alp_unknown || {}, seen: alp_seen || null, restarts: alp_restarts || [] });
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
    const { type, data } = fromPage(e.detail) || {};
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
        // v0.17.0: o X só adia: 1 h (ou até abrir o navegador de novo); versão urgente não adia
        const { alp_update = {} } = await chrome.storage.local.get('alp_update');
        const snooze = data && !alp_update.urgent ? { ver: String(data), until: Date.now() + 3600e3 } : null;
        await chrome.storage.local.set({ alp_update: { ...alp_update, snooze, justUpdated: null } });
        break;
      }
      case 'updJustSeen': {
        const { alp_update = {} } = await chrome.storage.local.get('alp_update');
        await chrome.storage.local.set({ alp_update: { ...alp_update, justUpdated: null } });
        break;
      }
      case 'saveTheme': {
        await chrome.storage.local.set({ alp_theme: data });
        break;
      }
      case 'saveSeen': {
        // v0.15.0: tutorial/novidades vistos (vale para HUD e popup)
        if (data && typeof data === 'object') await chrome.storage.local.set({ alp_seen: { tutorial: !!data.tutorial, news: String(data.news || '') } });
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
      case 'progress': {
        await chrome.storage.local.set({ alp_progress: { ...data, at: Date.now() } });
        // v0.19.0: avanço de verdade (passos restantes ou pulados mudaram) → relógio da vigia de "travado"
        if (beat && data) {
          const sig = `${data.steps}|${Object.keys(data.skip || {}).length}`;
          const { alp_step = {} } = await chrome.storage.local.get('alp_step');
          if (alp_step.sig !== sig) await chrome.storage.local.set({ alp_step: { ...alp_step, sig, at: Date.now() } });
        }
        break;
      }
      case 'waiting': {
        // v0.19.0: espera "travado: recarregando a página em N s" — a vigia não conta como travado
        const { alp_step = {} } = await chrome.storage.local.get('alp_step');
        await chrome.storage.local.set({ alp_step: { ...alp_step, waitUntil: Number(data?.until) || 0 } });
        break;
      }
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
        // v0.17.0: começou a rodar (Iniciar, atalho, popup) com versão urgente pendente → pausa na hora
        if (urgent && data.running) { send('pause'); }
        if (data.running === 'grind') {
          // v0.19.0: o grind (re)começou nesta aba: o relógio de "sem avanço" conta a partir de agora
          // (sem await: não pode atrasar o resto deste handler, que corre junto com a pausa da versão urgente)
          if (!beat) resetStep();
          startBeat();
        } else if (data.running === null && data.was === 'grind') await stopBeat();
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
  // o script da página carrega antes da ponte e o 'ready' dele se perde: manda os dados assim mesmo.
  // v0.16.0: o estado da atualização também (antes só ia no 'ready', e o aviso não aparecia ao abrir a página)
  setTimeout(() => { hydrate(); pushUpdate(); softCheck(); }, 300);
  maybeResume();
})();
