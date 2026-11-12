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

  // v0.19.10: config salva antes da v0.8.0 não tem "preset"; sem isto o DEFAULTS punha 'rage' por cima
  // e a HUD mostrava Rage com o atraso de outro preset
  const withPreset = (c) => {
    const m = { ...DEFAULTS, ...(c || {}) };
    if (!c?.preset) m.preset = m.delay === 0 && !m.humanize ? 'rage' : m.delay === 2500 && m.humanize ? 'legit' : 'manual';
    return m;
  };
  const pushConfig = safe(async () => {
    const { alp_cfg } = await chrome.storage.local.get('alp_cfg');
    send('config', withPreset(alp_cfg));
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
    if ('alp_outage' in ch || 'alp_outage_cap' in ch) pushOutage(); // v0.19.9: queda do Duolingo começou/avançou/acabou (vale para todas as abas)
    // v0.19.10: preset/atraso mudado no popup ou na HUD de OUTRA aba chega a esta na hora. Antes só a aba ativa
    // (popup) ou a própria aba (HUD) recebia; a aba do grind em segundo plano seguia no preset velho até recarregar.
    if ('alp_cfg' in ch) pushConfig();
  });

  // v0.19.9: Duolingo fora do ar. O estado mora no service worker (alp_outage); aqui só leva para a página.
  // end = como a última queda acabou ('up' o site voltou; 'cap' passou de 6 h e o Midas volta ao normal)
  const pushOutage = safe(async (ack) => {
    const { alp_outage, alp_outage_end, alp_outage_cap } = await chrome.storage.local.get(['alp_outage', 'alp_outage_end', 'alp_outage_cap']);
    send('outage', { state: alp_outage || null, end: alp_outage ? null : alp_outage_end || null, capped: !!alp_outage_cap, ack });
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
  // v0.19.14: 30 → 75 s. Com a aba do grind escondida há mais de 5 min o Chrome espaça o setInterval de 10 s para
  // 1 por minuto; com 30 s, uma aba do Duolingo aberta nesse intervalo achava o lock velho e tomava o grind.
  const LOCK_TTL = 75000;
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
    // v0.19.10: "Parar" do popup chegou a outra aba do Duolingo (a ativa): esta, que roda o grind, para também.
    // Antes o grind seguia rodando aqui com o grind salvo já desligado (parava só na recarga de 1 h).
    const g = ch.alp_grind?.newValue;
    // (a própria aba que recebeu o Parar já para pelo send('stop') do onMessage: stopBy evita o 2º 'parado')
    if (beat && g && g.active === false && g.stopAt && g.stopBy !== tabId && g.stopAt !== ch.alp_grind.oldValue?.stopAt) send('stop');
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
        if (await otherTabRunning()) { send('note', 'otherTab'); recheckResume(1); return; }
        send('grind', { skip: alp_grind.skip || {}, resume: true });
      }), 2500 + Math.floor(Math.random() * 1500));
    }
  });

  // v0.19.14: a outra aba pode ter morrido (fechada, travou) logo antes desta abrir. Confere de novo quando o lock dela
  // venceria (LOCK_TTL + 5 s), até 10 vezes; retoma só se o grind seguir ligado, sem versão urgente e sem outra aba viva.
  const recheckResume = (n) => {
    if (n > 10) return;
    setTimeout(safe(async () => {
      if (beat) return; // esta aba já assumiu (Iniciar, outra retomada)
      const { alp_grind } = await chrome.storage.local.get('alp_grind');
      if (!alp_grind?.active || urgent) return;
      if (await otherTabRunning()) return recheckResume(n + 1);
      send('grind', { skip: alp_grind.skip || {}, resume: true });
    }), LOCK_TTL + 5000);
  };

  // manda progresso/log salvos para a HUD (ela abre com os dados da última sessão)
  const hydrate = safe(async () => {
    const { alp_progress, alp_log, alp_unknown, alp_seen, alp_restarts } = await chrome.storage.local.get(['alp_progress', 'alp_log', 'alp_unknown', 'alp_seen', 'alp_restarts']);
    send('hydrate', { version: chrome.runtime.getManifest().version, progress: alp_progress || null, log: alp_log || [], unknown: alp_unknown || {}, seen: alp_seen || null, restarts: alp_restarts || [] });
  });

  // log circular + progresso → storage (o popup lê daqui)
  let logBuf = [];
  let flushT = null;
  // v0.19.14: as linhas vão para o service worker, que grava em fila (duas abas lendo e gravando o alp_log ao mesmo
  // tempo perdiam linhas). Sem resposta do service worker, grava direto como antes.
  const flush = safe(async () => {
    flushT = null;
    const lines = logBuf; logBuf = [];
    if (!lines.length) return;
    const r = await chrome.runtime.sendMessage({ cmd: 'log', lines }).catch(() => null);
    if (r?.ok) return;
    const { alp_log = [] } = await chrome.storage.local.get('alp_log');
    const have = new Set(alp_log.slice(-lines.length - 50).map((l) => `${l.t}|${l.msg}`));
    await chrome.storage.local.set({ alp_log: alp_log.concat(lines.filter((l) => !have.has(`${l.t}|${l.msg}`))).slice(-500) });
  });

  const onOut = safe(async (e) => {
    const { type, data } = fromPage(e.detail) || {};
    switch (type) {
      case 'ready': {
        await pushConfig();
        await pushLang();
        await hydrate();
        await pushOutage();
        await maybeResume();
        await pushUpdate();
        break;
      }
      case 'outageFail': {
        // v0.19.9: falha de leitura/sessão do Duolingo (5xx ou rede): o service worker decide se é queda
        const r = await chrome.runtime.sendMessage({ cmd: 'outageFail', kind: data?.kind, code: data?.code }).catch(() => null);
        const { alp_outage_end } = await chrome.storage.local.get('alp_outage_end');
        send('outage', { state: r?.outage || null, end: r?.outage ? null : alp_outage_end || null, capped: !!r?.capped, ack: data?.id });
        break;
      }
      case 'outageOk': {
        await chrome.runtime.sendMessage({ cmd: 'outageOk' }).catch(() => {});
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
      case 'blockedDiag': {
        // v0.19.11: diagnóstico do travado (3ª vez seguida sem avanço) vai para o histórico de reinícios (só nó, curso,
        // endereço sem consulta, resultado e status: nada da conta)
        const d = data || {};
        const { alp_restarts = [] } = await chrome.storage.local.get('alp_restarts');
        await chrome.storage.local.set({ alp_restarts: alp_restarts.concat({ at: Date.now(), cause: 'blockedDiag', ver: chrome.runtime.getManifest().version,
          n: Number(d.n) || 0, node: String(d.node || ''), course: String(d.course || ''), url: String(d.url || '').split('?')[0], r: String(d.r || ''), code: Number(d.code) || 0 }).slice(-50) });
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
        // v0.19.10: stopAt avisa a aba que roda o grind (o popup manda o Parar para a aba ATIVA, que pode ser outra)
        await chrome.storage.local.set({ alp_grind: { ...alp_grind, active: false, stopAt: Date.now(), stopBy: tabId } });
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
  setTimeout(() => { hydrate(); pushUpdate(); pushOutage(); softCheck(); }, 300);
  maybeResume();
})();
