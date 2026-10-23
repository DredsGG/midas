// Midas — roda no mundo MAIN da página (acesso aos internos do React do Duolingo).
// Uso pessoal. Reescrito do zero; ideias de base do fork Apache-2.0 krisl/autolingo.
(() => {
  'use strict';
  const FLAG = Symbol.for('alp.loaded');
  if (window[FLAG]) return;
  Object.defineProperty(window, FLAG, { value: true });

  // ───────────────────────── config / log ─────────────────────────
  // textos traduzidos (src/i18n.js carrega antes; sem ele, mostra a chave)
  const T = (k, v) => (window[Symbol.for('alp.i18n')]?.t || ((x) => x))(k, v);
  const cfg = { delay: 0, humanize: false, preset: 'rage', debug: false };
  const emit = (type, data) =>
    document.dispatchEvent(new CustomEvent('alp:out', { detail: { type, data } }));
  const report = (msg, level = 'info') => {
    if (cfg.debug || level !== 'info') console.debug('[alp]', msg);
    emit('log', { t: Date.now(), level, msg: String(msg) });
  };

  // ───────────────────────── timing ─────────────────────────
  // Timer num Web Worker: o Chrome freia setTimeout da página para ~1/s quando a
  // aba não está em foco; timers de worker não sofrem esse freio.
  const workerTimer = (() => {
    try {
      const src = 'onmessage=e=>{const{id,ms}=e.data;setTimeout(()=>postMessage(id),ms)}';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      const pending = new Map();
      let seq = 0;
      w.onmessage = (e) => { const r = pending.get(e.data); pending.delete(e.data); r?.(); };
      return (ms) => new Promise((r) => { const id = ++seq; pending.set(id, r); w.postMessage({ id, ms }); });
    } catch { return null; }
  })();
  const sleep = (ms) => (workerTimer ? workerTimer(ms) : new Promise((r) => setTimeout(r, ms)));
  const jitter = (base) => {
    if (!cfg.humanize || base <= 0) return base;
    const u = 1 - Math.random(), v = Math.random();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); // normal(0,1)
    return Math.max(base * 0.4, base + n * base * 0.25);
  };
  const wait = (base = cfg.delay) => sleep(jitter(base));

  // ───────────────────────── react helpers ─────────────────────────
  const reactKey = (el, prefix) => {
    if (!el) return null;
    for (const k in el) if (k.startsWith(prefix)) return el[k];
    return null;
  };
  const fiberOf = (el) => reactKey(el, '__reactFiber$');
  const propsOf = (el) => reactKey(el, '__reactProps$');
  const walkUp = (fiber, pick, max = 150) => {
    for (let i = 0; fiber && i < max; i++, fiber = fiber.return) {
      const r = pick(fiber);
      if (r !== undefined) return r;
    }
    return undefined;
  };

  // ───────────────────────── seletores (único lugar) ─────────────────────────
  const S = {
    path: '[data-test="skill-path"]',
    unit: '[data-test*="skill-path-unit"]',
    header: '[data-test="challenge-header"]',
    next: '[data-test="player-next"]',
    skip: '[data-test="player-skip"]',
    quit: '[data-test="quit-button"]',
    wordBank: '[data-test="word-bank"]',
    tapText: '[data-test="challenge-tap-token-text"]',
    tapToken: '[data-test$="challenge-tap-token"]',
    choice: '[data-test="challenge-choice"]',
    choiceAny: '[data-test*="challenge-choice"]',
    choiceCard: '[data-test="challenge-choice-card"]',
    judge: '[data-test="challenge-judge-text"]',
    translateInput: '[data-test="challenge-translate-input"]',
    textInput: '[data-test="challenge-text-input"]',
    editable: '[contenteditable="true"]',
    legendaryNode: '[data-test="legendary-node-button"]',
    legendaryStart: '[data-test="legendary-start-button"]',
    cta: '[data-test="cta-button"]',
    continueFinal: '[data-test="continue-final-level"]',
    legendaryEnd: '[data-test="legendary-session-end-continue"]',
    sessionDuo: '[data-test="session-duo"]',
  };
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const norm = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
  const isEnabled = (el) =>
    !!el && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const isVisible = (el) => {
    if (!el) return false;
    if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
    return !!el.offsetParent && getComputedStyle(el).visibility !== 'hidden';
  };
  const clickEl = (el) => {
    const target = el?.closest?.('button') || el;
    if (!isEnabled(target)) return false;
    target.click();
    return true;
  };

  // ───────────────────────── estado do player / exercício ─────────────────────────
  const getStatus = () => {
    for (const sel of [S.next, S.header, S.skip, S.sessionDuo, S.quit, S.cta]) {
      const el = $(sel);
      if (!el) continue;
      const s = walkUp(fiberOf(el), (f) => {
        const st = f.memoizedProps?.player?.status;
        return typeof st === 'string' ? st : undefined;
      });
      if (s) return s;
    }
    return null;
  };

  // Duo Radio: não tem challenge-header; o desafio fica num componente com
  // onRadioExerciseGrading acima dos botões. Os controles do player usam imagens
  // em /images/duoRadio/. O áudio corre em tempo real (não dá para pular).
  // v0.12.3: desde out/2026 o exercício "Complete a conversa" (dialogue) também usa os
  // avatares de /images/duoRadio/transcript/ — só é rádio de verdade se NÃO houver
  // challenge-header (senão o loop entrava no ramo do rádio e ficava parado até o timeout)
  const radioOn = () => !$(S.header) && !!document.querySelector('img[src*="/duoRadio/"]');
  const getRadio = () => {
    for (const el of $$('[data-test="challenge-choice"], [data-test$="-challenge-tap-token"], button')) {
      const p = walkUp(fiberOf(el), (f) =>
        f.memoizedProps?.onRadioExerciseGrading && f.memoizedProps.challenge ? f.memoizedProps : undefined, 30);
      if (p) return { props: p, ch: p.challenge, radio: true };
    }
    return null;
  };

  const getChallenge = () => {
    const header = $(S.header);
    if (!header) return radioOn() ? getRadio() : null;
    let props = fiberOf(header)?.memoizedProps?.children?.props;
    if (!props?.challenge) {
      props = walkUp(fiberOf(header), (f) =>
        f.memoizedProps?.challenge?.type ? f.memoizedProps : undefined
      );
    }
    return props?.challenge ? { props, ch: props.challenge } : null;
  };

  // ───────────────────────── erro ao criar sessão ─────────────────────────
  // Alguns nós (ex.: prática "Spaced Repetition") fazem o próprio Duolingo receber
  // 400/503 no POST /sessions — nem o clique manual funciona. Detecta na hora para
  // o grind pular em vez de ficar parado esperando.
  let lastSessionError = null;
  try {
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const res = await origFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || input?.method || 'GET').toUpperCase();
        if (method === 'POST' && /\/sessions(\?|$)/.test(url) && res.status >= 400) {
          lastSessionError = { status: res.status, at: Date.now() };
        }
      } catch { /* ignora */ }
      return res;
    };
  } catch { /* ignora */ }

  // ───────────────────────── primitivas de input ─────────────────────────
  const setNativeValue = (el, value) => {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const typeInto = (el, value) => {
    if (!el || value == null) return false;
    value = String(value);
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      const p = propsOf(el);
      p?.onInput?.({ currentTarget: el, target: el });
      return true;
    }
    el.focus();
    setNativeValue(el, value);
    const p = propsOf(el);
    if (p?.onChange && el.value !== value) p.onChange({ target: { value }, currentTarget: { value } });
    return true;
  };

  const chooseIdx = (sel, idx) => {
    const els = $$(sel);
    if (!els.length || idx == null) return false;
    return clickEl(els[Math.min(idx, els.length - 1)]);
  };
  const pickIndex = (idx, prefer = []) => {
    for (const sel of [...prefer, S.judge, S.choice, S.choiceCard, S.choiceAny]) {
      if ($$(sel).length) return chooseIdx(sel, idx);
    }
    return false;
  };

  // ── tokens (botões do banco de palavras / pares) ──
  // O texto visível pode trazer a romanização junto ("강력한gang nyeok han") e um
  // número de atalho ("1obsessão"), então o casamento usa várias chaves:
  // primeiro nó de texto do span, texto do span e o prefixo do data-test.
  const TOKEN_ANY = '[data-test*="challenge-tap-token"]';
  const tokenButton = (n) => n.closest?.('button') || n;
  const tokenKeys = (btn) => {
    const span = btn.querySelector?.(S.tapText) || btn;
    const dt = btn.getAttribute('data-test') || '';
    const keys = new Set();
    const first = span.childNodes?.[0];
    if (first?.nodeType === 3) keys.add(norm(first.textContent));
    keys.add(norm(span.textContent));
    // v0.12.8: o prefixo do data-test só vale para token de UMA palavra. Em "will take" o
    // data-test é "take-challenge-tap-token will": o prefixo "take" fazia o botão "will take"
    // casar com a resposta "take" (lacunas trocadas → resposta errada → loop no "Corrija o erro")
    if (dt.endsWith('-challenge-tap-token')) {
      const pre = dt.slice(0, -'-challenge-tap-token'.length);
      if (pre) keys.add(norm(pre));
    }
    const words = norm(dt.replace('-challenge-tap-token', ' ')).split(' ');
    return { keys, words };
  };
  const tokenMatches = (btn, value) => {
    const k = norm(value);
    if (!k) return false;
    const { keys, words } = tokenKeys(btn);
    return keys.has(k) || (k.includes(' ') && k.split(' ').every((w) => words.includes(w)));
  };
  const tokenButtons = (scope = document) => {
    const out = [];
    for (const n of $$(TOKEN_ANY, scope)) {
      const b = tokenButton(n);
      if (b.tagName === 'BUTTON' || b.getAttribute?.('role') === 'button' || b === n) {
        if (!out.includes(b) && isEnabled(b) && isVisible(b) && /challenge-tap-token/.test(b.getAttribute('data-test') || '')) out.push(b);
      }
    }
    return out;
  };
  const bankTokens = () => tokenButtons($(S.wordBank) || document);
  // O Duolingo põe cópias invisíveis dos tokens na lacuna (visibility:hidden, para medir a
  // largura) e, depois do toque, a cópia da lacuna fica visível. Com banco de palavras,
  // tocar fora dele DESFAZ a resposta — então só o banco vale.
  // re-consulta o banco antes de cada clique (o React re-renderiza após cada toque)
  // texto exato do botão vence qualquer casamento aproximado
  const tokenText = (b) => {
    const span = b.querySelector?.(S.tapText) || b;
    const first = span.childNodes?.[0];
    return norm(first?.nodeType === 3 ? first.textContent : span.textContent);
  };
  const pickToken = (pool, t) => {
    const k = norm(t);
    return pool.find((b) => tokenText(b) === k) || pool.find((b) => tokenMatches(b, t));
  };
  const findToken = (t) => pickToken(bankTokens(), t) ||
    ($(S.wordBank) ? null : pickToken(tokenButtons(), t));
  const tapTexts = async (texts) => {
    for (const t of texts || []) {
      let btn = findToken(t);
      // resposta com várias palavras ("to go") mas o banco tem uma palavra por botão
      // ("to", "go"): toca cada palavra, se todas existirem
      if (!btn && /\s/.test(String(t).trim())) {
        const words = norm(t).split(' ');
        if (words.every((w) => findToken(w))) {
          for (const w of words) { const b = findToken(w); b?.click(); await wait(Math.max(35, cfg.delay * 0.45)); }
          continue;
        }
        // parte da resposta já vem impressa na frase ("I want to ___" com resposta "to call"
        // e banco só com "call"): toca só as palavras que existem no banco
        const have = words.filter((w) => findToken(w));
        if (have.length) {
          for (const w of have) { const b = findToken(w); b?.click(); await wait(Math.max(35, cfg.delay * 0.45)); }
          continue;
        }
      }
      if (!btn) {
        // diagnóstico: mostra o que havia no banco (uma vez por palavra e exercício)
        const bank = bankTokens().map((b) => norm(b.textContent)).filter(Boolean).join(' · ');
        const key = t + '|' + bank;
        if (key !== lastMissing) { lastMissing = key; report(T('log.tokenNotFound', { t }) + (bank ? ` [${bank}]` : ''), 'warn'); }
        continue;
      }
      btn.click();
      await wait(Math.max(35, cfg.delay * 0.45));
    }
  };
  let lastMissing = null;

  const matchPairs = async (pairs, L, R) => {
    // 1) pares de áudio (sem texto): os dois tokens do par compartilham o data-test
    if ($$(S.tapText).length === 0) {
      const groups = {};
      for (const b of tokenButtons()) (groups[b.getAttribute('data-test')] ||= []).push(b);
      const g = Object.values(groups);
      if (g.length && g.every((x) => x.length === 2)) {
        for (const [a, b] of g) { a.click(); await sleep(90); b.click(); await wait(Math.max(60, cfg.delay * 0.6)); }
        return;
      }
    }
    // 2) pares de texto: re-consulta a cada par (o React re-renderiza após cada acerto)
    for (const pair of pairs || []) {
      const pool = tokenButtons();
      const take = (fields, except) => {
        for (const f of fields) {
          const v = pair[f];
          if (v == null || typeof v === 'object') continue;
          const rest = pool.filter((x) => x !== except);
          const b = pickToken(rest, v);
          if (b) return b;
        }
        return null;
      };
      const a = take(L);
      const b = take(R, a);
      if (!a || !b) {
        report(T('log.pairUnsolved', { a: pair.learningToken ?? pair.character ?? '?', b: pair.fromToken ?? pair.translation ?? '?' }), 'warn');
        continue;
      }
      a.click(); await sleep(90); b.click();
      await wait(Math.max(60, cfg.delay * 0.6));
    }
  };

  // respostas de lacunas a partir dos dados (sem depender da árvore do DOM)
  const blankAnswers = (tokens) =>
    (tokens || [])
      .filter((t) => t && (t.damageStart !== undefined || t.isBlank))
      .map((t) => (t.damageStart !== undefined ? t.text.substring(t.damageStart) : t.text));
  const tableCells = (ch) => (ch.displayTableTokens || []).flatMap((row) => row.map((cell) => cell?.[0]));

  const fillInputs = (answers) => {
    const inputs = $$(`input[type="text"], ${S.textInput}, textarea`).filter((i) => !i.disabled);
    if (inputs.length && inputs.length === answers.length) {
      inputs.forEach((inp, i) => typeInto(inp, answers[i]));
      return true;
    }
    // fallback: cada input conhece seu token via fiber (fullText + damageStart)
    let ok = false;
    for (const inp of inputs) {
      const tok = walkUp(fiberOf(inp), (f) =>
        f.pendingProps?.fullText !== undefined ? f.pendingProps : undefined, 8);
      if (tok) { typeInto(inp, tok.fullText.substring(tok.damageStart ?? 0)); ok = true; }
    }
    return ok;
  };

  // v0.12.6: usa o "Pular"/"Não posso falar agora" VISÍVEL mais recente (pode haver cópia
  // velha no DOM durante a transição). Em tentativas ímpares chama o onClick do React direto.
  const skipButton = () => {
    const vis = $$(S.skip).filter((b) => isEnabled(b) && isVisible(b));
    return vis[vis.length - 1] || $(S.skip);
  };
  const skipChallenge = (attempt = 0) => {
    const b = skipButton();
    if (!isEnabled(b)) return false;
    if (attempt % 2 === 1) {
      const p = propsOf(b);
      if (typeof p?.onClick === 'function') {
        try { p.onClick({ preventDefault() {}, stopPropagation() {}, currentTarget: b, target: b, nativeEvent: new MouseEvent('click') }); return true; } catch { /* cai no clique */ }
      }
    }
    b.click();
    return true;
  };

  // ───────────────────────── solvers ─────────────────────────
  const byIndex = (prefer) => ({ ch }) => pickIndex(ch.correctIndex ?? ch.correctIndices?.[0], prefer);
  const translateLike = async ({ ch }) => {
    const input = $(S.translateInput) || $(S.textInput);
    if (input) return typeInto(input, ch.correctSolutions?.[0] ?? ch.prompt ?? ch.solutionTranslation);
    if (ch.correctTokens?.length && bankTokens().length) return tapTexts(ch.correctTokens);
    return false;
  };
  const listenLike = async ({ ch }) => {
    const input = $(S.translateInput) || $(S.textInput);
    if (input) return typeInto(input, ch.prompt ?? ch.correctSolutions?.[0]);
    return tapTexts(ch.correctTokens || []);
  };
  const matchLike = ({ ch }) =>
    matchPairs(
      ch.pairs,
      ['learningToken', 'learningWord', 'character', 'fromToken'],
      ['fromToken', 'translation', 'transliteration', 'learningWord']
    );

  const choiceText = (c) => (typeof c === 'string' ? c : c?.text ?? c?.word ?? null);
  // escolha que aparece como token no banco de palavras (ex.: patternTapComplete)
  const tapChoice = async (ch) => {
    const want = choiceText(ch.choices?.[ch.correctIndex]);
    if (want != null && bankTokens().some((b) => tokenMatches(b, want))) return tapTexts([want]);
    const toks = bankTokens();
    if (toks[ch.correctIndex]) { toks[ch.correctIndex].click(); return true; }
    return pickIndex(ch.correctIndex);
  };

  // Duo Radio — cada solver devolve true só se de fato respondeu (as opções só
  // aparecem depois do trecho de áudio; até lá o loop tenta de novo)
  const radioChoices = () => $$(S.choice);
  const radioPairs = async () => {
    // listenMatch do rádio: o botão de áudio (inglês) e o da tradução têm o mesmo data-test
    const groups = {};
    for (const b of tokenButtons()) (groups[b.getAttribute('data-test')] ||= []).push(b);
    const pairs = Object.values(groups).filter((g) => g.length === 2);
    if (!pairs.length) return false;
    for (const [a, b] of pairs) { a.click(); await sleep(110); b.click(); await wait(Math.max(80, cfg.delay * 0.5)); }
    return true;
  };
  const radioIndex = (i) => { const c = radioChoices(); if (c.length <= i) return false; clickEl(c[i]) || c[i].click(); return true; };
  // várias respostas (ex.: radioListenRecognize "Selecione 2 palavras que você ouvir")
  const radioIndices = async (idx) => {
    const c = radioChoices();
    if (!idx?.length || idx.some((i) => c.length <= i)) return false;
    for (const i of idx) { clickEl(c[i]) || c[i].click(); await wait(Math.max(80, cfg.delay * 0.4)); }
    return true;
  };
  const RADIO_SOLVERS = {
    radioListenMatch: radioPairs,
    radioListenRecognize: ({ ch }) => radioIndices(ch.correctIndices),
    radioBinary: ({ ch }) => radioIndex(ch.isTrue ? 0 : 1),
    radioSelect: ({ ch }) => radioIndex(ch.correctIndex),
    radioImageSelect: ({ ch }) => radioIndex(ch.correctIndex),
  };
  const radioGeneric = async (c) => {
    const { ch } = c;
    if (ch.pairs?.length) return radioPairs();
    if (typeof ch.isTrue === 'boolean') return radioIndex(ch.isTrue ? 0 : 1);
    if (typeof ch.correctIndex === 'number') return radioIndex(ch.correctIndex);
    if (Array.isArray(ch.correctIndices)) return radioIndices(ch.correctIndices);
    return false;
  };

  // "Siga o modelo" (orderTapComplete): a frase tem várias lacunas e cada uma só recebe
  // palavras depois de clicada (o foco não pula sozinho para a próxima). Ex.:
  // "[Is] Anna [a] [teacher]?" → lacuna 1: Is · lacuna 2: a, teacher.
  const blankGroups = (tokens) => {
    const groups = [];
    let cur = null;
    for (const t of tokens || []) {
      if (t?.isBlank) { if (!cur) groups.push((cur = [])); cur.push(t.text); }
      else if (/\S/.test(t?.text ?? '')) cur = null; // texto fixo separa lacunas; espaço não
    }
    return groups;
  };
  const blankZones = () => {
    const root = $('[data-test^="challenge challenge-"]') || document;
    const bank = $(S.wordBank);
    const zones = $$('div', root).filter((d) => propsOf(d)?.onClick && !d.getAttribute('data-test') &&
      d.querySelector(TOKEN_ANY) && !(bank && (bank.contains(d) || d.contains(bank))));
    return zones.filter((z) => !zones.some((o) => o !== z && o.contains(z))); // só as externas
  };
  const orderTapComplete = async ({ ch }) => {
    const groups = blankGroups(ch.displayTokens);
    const zones = blankZones();
    if (groups.length > 1 && zones.length === groups.length) {
      for (let i = 0; i < groups.length; i++) {
        zones[i].click(); // foca a lacuna
        await wait(Math.max(80, cfg.delay * 0.3));
        await tapTexts(groups[i]);
      }
      return true;
    }
    return tapTexts(groups.flat());
  };

  const SOLVERS = {
    patternTapComplete: ({ ch }) => tapChoice(ch),
    orderTapComplete: orderTapComplete,
    translate: translateLike,
    completeReverseTranslation: async ({ ch }) => {
      const best = ch.challengeResponseTrackingProperties?.best_solution;
      const input = $(S.translateInput);
      if (input && best) return typeInto(input, best);
      return fillInputs(blankAnswers(ch.displayTokens));
    },
    listenComplete: ({ ch }) => fillInputs(blankAnswers(ch.displayTokens)),
    partialReverseTranslate: ({ ch }) => {
      const text = (ch.displayTokens || []).filter((t) => t.isBlank).map((t) => t.text).join('');
      const el = $(S.editable);
      if (!el) return false;
      const fp = fiberOf(el)?.pendingProps;
      if (fp?.onInput) { fp.onInput({ currentTarget: { innerText: text } }); return true; }
      return typeInto(el, text);
    },
    listen: listenLike,
    listenTap: listenLike,
    name: async ({ ch }) => {
      const answer = ch.correctSolutions?.[0] ?? '';
      let text = answer;
      const art = (ch.articles || []).find((a) => answer.startsWith(a));
      if (art) {
        const el = $$(S.judge).find((e) => norm(e.textContent) === norm(art));
        clickEl(el);
        text = answer.slice(art.length).trimStart();
        await wait(cfg.delay * 0.4);
      }
      return typeInto($(S.textInput) || $(S.translateInput), text);
    },
    select: byIndex([S.choiceAny]),
    form: byIndex([S.choice]),
    assist: byIndex([S.choice]),
    gapFill: byIndex([S.choice]),
    readComprehension: byIndex([S.choice]),
    characterSelect: byIndex([S.choiceCard]),
    judge: ({ ch }) => pickIndex(ch.correctIndices?.[0] ?? ch.correctIndex, [S.judge]),
    selectTranscription: byIndex([S.judge]),
    selectPronunciation: byIndex([S.judge]),
    characterIntro: byIndex([S.judge]),
    listenComprehension: byIndex([S.judge]),
    definition: byIndex([S.judge]),
    listenIsolation: byIndex([S.judge]),
    dialogue: byIndex([S.judge]),
    tapComplete: async ({ ch }) => {
      const idx = ch.correctIndices || [];
      const words = idx.map((i) => {
        const c = ch.choices?.[i];
        return typeof c === 'string' ? c : c?.text;
      });
      if (words.length && words.every((w) => w != null)) return tapTexts(words);
      const scope = $(S.wordBank) || document;
      for (const i of idx) { chooseIdx(`${S.wordBank} ${S.tapText}`, i) || clickEl($$(S.tapText, scope)[i]); await wait(Math.max(35, cfg.delay * 0.45)); }
    },
    tapCloze: ({ ch }) => tapTexts(blankAnswers(ch.displayTokens)),
    tapClozeTable: ({ ch }) => tapTexts(blankAnswers(tableCells(ch))),
    tapCompleteTable: ({ ch }) => tapTexts(tableCells(ch).filter((c) => c?.isBlank).map((c) => c.text)),
    typeCloze: ({ ch }) => fillInputs(blankAnswers(ch.displayTokens)),
    typeClozeTable: ({ ch }) => fillInputs(blankAnswers(tableCells(ch))),
    typeCompleteTable: ({ ch }) => fillInputs(blankAnswers(tableCells(ch))),
    typeComplete: ({ ch }) => fillInputs(blankAnswers(ch.displayTokens)),
    match: matchLike,
    listenMatch: matchLike,
    characterMatch: matchLike,
    extendedMatch: matchLike,
    extendedListenMatch: matchLike,
    speak: () => skipChallenge(),
    listenSpeak: () => skipChallenge(),
    characterTrace: () => skipChallenge(),
    characterWrite: () => skipChallenge(),
    svgPuzzle: () => skipChallenge(),
  };

  // solver genérico para tipos novos: tenta pelo formato dos dados
  const genericSolver = async (c) => {
    const { ch } = c;
    if (typeof ch.correctIndex === 'number') {
      if (bankTokens().length && ch.choices?.length) return tapChoice(ch);
      return pickIndex(ch.correctIndex);
    }
    if (ch.pairs?.length) return matchLike(c);
    if (ch.correctTokens?.length && bankTokens().length) return tapTexts(ch.correctTokens);
    if (ch.correctSolutions?.length && ($(S.translateInput) || $(S.textInput))) return translateLike(c);
    const blanks = blankAnswers(ch.displayTokens);
    if (blanks.length) return bankTokens().length ? tapTexts(blanks) : fillInputs(blanks);
    if (Array.isArray(ch.correctIndices) && ch.choices?.length && bankTokens().length) {
      return tapTexts(ch.correctIndices.map((i) => choiceText(ch.choices[i])).filter((t) => t != null));
    }
    if (Array.isArray(ch.correctIndices)) return pickIndex(ch.correctIndices[0]);
    return skipChallenge();
  };

  const unknownTypes = new Set();
  let solving = false;
  const solveCurrent = async () => {
    if (solving) return false;
    solving = true;
    try {
      const c = getChallenge();
      if (!c) return false;
      if (c.radio) {
        const rfn = RADIO_SOLVERS[c.ch.type];
        if (!rfn && !unknownTypes.has(c.ch.type)) {
          unknownTypes.add(c.ch.type);
          emit('unknownType', { type: c.ch.type, keys: Object.keys(c.ch) });
          report(T('log.radioNewType', { type: c.ch.type }), 'warn');
        }
        return !!(await (rfn || radioGeneric)(c));
      }
      const fn = SOLVERS[c.ch.type];
      if (!fn && !unknownTypes.has(c.ch.type)) {
        unknownTypes.add(c.ch.type);
        emit('unknownType', { type: c.ch.type, keys: Object.keys(c.ch) });
        report(T('log.newType', { type: c.ch.type }), 'warn');
      }
      await (fn || genericSolver)(c);
      return true;
    } catch (e) {
      report(T('log.solverError', { e: e?.message || e }), 'error');
      return false;
    } finally {
      solving = false; // nunca trava, mesmo com exceção
    }
  };

  // ───────────────────────── avançar ─────────────────────────
  // sem legendary-start-button: no fim de lição normal ele aparece como upsell e
  // abriria uma Titãs fora de hora (o grind entra em Titãs pela rota)
  const NEXT_SELS = [S.next, S.legendaryEnd, S.continueFinal, S.cta];
  const CONTINUE_RE = /^(continuar|continue|próximo|proximo|next|ok|entendi|got it)$/i;
  const findNext = () => {
    for (const s of NEXT_SELS) {
      const el = $(s);
      if (isEnabled(el)) return el;
    }
    return $$('button, [role="button"]').find(
      (b) => isEnabled(b) && !b.closest(S.quit) && CONTINUE_RE.test(norm(b.textContent))
    );
  };
  const pressNext = () => {
    const el = findNext();
    if (!el) return false;
    el.click();
    return true;
  };

  const onLearnPage = () => location.pathname.startsWith('/learn');
  // A sessão é detectada pelo que está NA TELA, não pela URL: stories do Reforço
  // diário (e outras) abrem por cima do /learn, sem mudar o endereço.
  const STORY_ANCHORS = '[data-test="stories-element"], [data-test="stories-player-continue"], [data-test="stories-player-done"], [data-test="close-button-stories"], [data-test="story-start"]';
  const sessionVisible = () => !!$(STORY_ANCHORS) || !!getStatus() || !!$(S.quit) || !!$(STREAK_OPT);

  // Tela "Escolha uma nova meta de ofensiva" (fim de sessão): André quer sempre a meta
  // mais alta. Opções com data-test="streak-goal-option" ("650 dias de ofensiva · Ganhe
  // 125 cristais"); o botão "Eu consigo!" só habilita depois de escolher.
  const STREAK_OPT = '[data-test="streak-goal-option"]';
  const STREAK_COMMIT_RE = /^(eu consigo|i can do it|¡?puedo hacerlo|me comprometo|i'm committed)!?$/i;
  let streakSeen = 0, streakClicked = false;
  const streakDays = (el) => {
    const m = norm(el.textContent).replace(/(\d)[.,](?=\d{3}\b)/g, '$1').match(/\d+/);
    return m ? +m[0] : -1;
  };
  const handleStreakGoal = async () => {
    const opts = $$(STREAK_OPT).filter(isVisible);
    if (!opts.length) return false;
    const best = opts.reduce((a, b) => (streakDays(b) > streakDays(a) ? b : a));
    const target = best.closest('button, [role="button"], [role="radio"]') || best;
    if (!streakSeen || Date.now() - streakSeen > 60000) { streakSeen = Date.now(); streakClicked = false; } // tela nova
    if (Date.now() - streakSeen > 20000) return false; // não saiu da tela: deixa o fluxo normal seguir
    // um clique só por tela (clicar de novo poderia desmarcar)
    if (!streakClicked) {
      target.click();
      streakClicked = true;
      report(T('log.streakGoal', { n: streakDays(best) }));
      await sleep(350);
    }
    const commit = $$('button, [role="button"]').find((b) => isEnabled(b) && !b.closest(STREAK_OPT) &&
      STREAK_COMMIT_RE.test(norm(b.textContent))) || findNext();
    commit?.click();
    await sleep(400);
    return true;
  };
  // devolve true quando a sessão sumiu da tela por um tempo contínuo
  const goneFor = (ms) => {
    let since = 0;
    return () => {
      if (sessionVisible()) { since = 0; return false; }
      if (!since) since = Date.now();
      return Date.now() - since > ms;
    };
  };

  // ───────────────────────── loop da lição ─────────────────────────
  // GRADING NÃO é espera: o Duolingo fica 3–7 s nele (animação/áudio) com o botão já
  // ativo; clicar pula direto para o próximo exercício (medido: Titãs 77 s → 26 s).
  const WAIT_STATES = new Set([
    'LOADING', 'SHOWING', 'SLIDING', 'SUBMITTING', 'COACH_DUO_SUBMITTING',
    'PARTIAL_XP_DUO_SLIDING', 'COACH_DUO_SLIDING', 'HARD_MODE_DUO_SLIDING',
  ]);

  const runLesson = async (token, { timeoutMs = 8 * 60e3 } = {}) => {
    const t0 = Date.now();
    // o exercício respondido é identificado pelo próprio objeto do desafio: a troca
    // GUESSING → SLIDING → GUESSING pode ser mais rápida que o tick do loop
    let answeredCh = null, answeredAt = 0, idleSince = Date.now(), lastPress = 0, solvedCount = 0;
    let radioDone = null, resolveTries = 0;
    const answeredRadio = new WeakSet();
    const solveCounts = new Map();
    const skipTries = new Map();
    let radioIdleSince = 0;
    const gone = goneFor(1500);
    // evita clique duplo no mesmo botão antes do React trocar de tela
    const press = () => {
      if (Date.now() - lastPress < Math.max(120, cfg.delay * 0.5)) return true;
      if (!pressNext()) return false;
      lastPress = Date.now();
      return true;
    };
    while (!token.stop) {
      if (Date.now() - t0 > timeoutMs) { report(T('log.lessonTimeout'), 'warn'); return 'timeout'; }
      if ($(STREAK_OPT) && (await handleStreakGoal())) { idleSince = Date.now(); continue; }
      if (gone()) return 'done';
      const status = getStatus();
      if (status !== 'GUESSING') answeredCh = null;

      if (status === 'GUESSING' && radioOn()) {
        // Duo Radio: o status fica GUESSING o tempo todo; entre perguntas só toca áudio.
        // Sem regra de "travado" aqui — o limite é o timeout da sessão.
        idleSince = Date.now();
        const rc = getRadio()?.ch;
        // sem pergunta de rádio e sem botão por muito tempo = o loop não entende a tela
        if (rc || findNext()) radioIdleSince = 0;
        else if (!radioIdleSince) radioIdleSince = Date.now();
        else if (Date.now() - radioIdleSince > 90000) { report(T('log.noNext', { status: 'RADIO' }), 'warn'); return 'stuck'; }
        const key = rc && `${rc.type}:${rc.startTime ?? ''}:${rc.prompt ?? ''}`;
        if (rc && key !== radioDone && !answeredRadio.has(rc)) {
          if (await solveCurrent()) { radioDone = key; answeredRadio.add(rc); solvedCount++; await wait(Math.max(150, cfg.delay * 0.5)); }
        }
        press();
      } else if (status === 'GUESSING') {
        idleSince = Date.now();
        // v0.12.2: o exercício é identificado pelo id (ou tipo+texto), não pelo objeto: em
        // alguns tapComplete o React recria o objeto a cada render, e o loop resolvia o mesmo
        // exercício sem parar (6 min de "token não encontrado" até o timeout da lição)
        const curCh = getChallenge()?.ch || null;
        const cur = curCh && (curCh.id || `${curCh.type}|${curCh.prompt ?? ''}|${(curCh.displayTokens || []).map((x) => x?.text ?? '').join('')}`);
        if (cur && cur === answeredCh && !isEnabled($(S.next)) && resolveTries < 2 &&
            Date.now() - answeredAt > 1500) {
          // a resposta não "pegou" (ex.: no modo rage o solver rodou antes dos botões
          // aparecerem). Resolve de novo — os solvers não desfazem o que já foi marcado.
          resolveTries++;
          await solveCurrent();
          answeredAt = Date.now();
        }
        if (cur && cur !== answeredCh) {
          answeredCh = cur;
          resolveTries = 0;
          // trava de segurança: o mesmo exercício resolvido de novo e de novo (o status
          // oscila e zera answeredCh) → pula ou desiste em vez de girar até o timeout.
          // 3 vale: o Duolingo repete no fim da lição um exercício errado, com o mesmo id.
          const n = (solveCounts.get(cur) || 0) + 1;
          solveCounts.set(cur, n);
          if (n > 3) {
            const t = curCh?.type;
            emit('stuckType', { type: t });
            // o Duolingo devolve o exercício pulado/errado ("Corrija o erro de antes"):
            // pular de novo vira loop — depois de 6 voltas desiste da lição
            if (n <= 6 && isEnabled(skipButton())) {
              report(T('log.stuckSkip', { type: t }), 'warn');
              skipChallenge();
              answeredAt = Date.now();
              await sleep(300);
              continue;
            }
            report(T('log.stuckAbandon', { type: t }), 'error');
            return 'stuck';
          }
          if (cfg.delay > 0) await wait(cfg.delay * 0.6);
          if (await solveCurrent()) solvedCount++;
          answeredAt = Date.now();
          // espera o botão "Verificar" habilitar (React registrou a resposta) em vez de tempo fixo
          for (let i = 0; i < 40 && !isEnabled($(S.next)); i++) await sleep(25);
          if (cfg.delay > 0) await wait(cfg.delay * 0.3);
        }
        if (!press() && answeredCh && Date.now() - answeredAt > 4000) {
          const t = getChallenge()?.ch?.type;
          if (isEnabled(skipButton())) {
            // "Pular" que não pula: depois de 4 tentativas desiste da lição (antes girava 8 min)
            const tries = (skipTries.get(answeredCh) || 0) + 1;
            skipTries.set(answeredCh, tries);
            // v0.12.10: "Não posso falar agora" que não pula = a página já desligou a fala
            // antes (o 2º clique na mesma página não faz nada). Depois do reload as lições vêm
            // sem fala → recarrega já, sem gastar tentativa do nó
            if (tries > 2 && /speak/i.test(t || '')) { report(T('log.speakReload'), 'warn'); return 'reload'; }
            if (tries > 4) {
              const all = $$(S.skip);
              report(T('log.skipFailed', { type: t, n: all.length, v: all.filter(isVisible).length, status }), 'error');
              emit('stuckType', { type: t });
              return 'stuck';
            }
            report(T('log.stuckSkip', { type: t }), 'warn');
            emit('stuckType', { type: t });
            skipChallenge(tries);
            answeredAt = Date.now();
          } else if (Date.now() - answeredAt > 15000) {
            // Titãs não tem "Pular": desiste da lição para o grind seguir em frente
            report(T('log.stuckAbandon', { type: t }), 'error');
            emit('stuckType', { type: t });
            return 'stuck';
          }
        }
      } else if (WAIT_STATES.has(status)) {
        idleSince = Date.now();
      } else {
        // GRADING, BLAMING, splashes, *_DUO, END_CAROUSEL, anúncios, status desconhecido
        if (press()) idleSince = Date.now();
        else if (Date.now() - idleSince > 20000) { report(T('log.noNext', { status }), 'warn'); return 'stuck'; }
      }
      // loop rápido: o atraso configurado vale para as ações, não para "ver" o estado
      await sleep(cfg.humanize ? Math.max(60, jitter(cfg.delay * 0.35)) : 40);
    }
    return 'stopped';
  };

  // ───────────────────────── API do Duolingo (leitura do caminho) ─────────────────────────
  const jwt = () => document.cookie.match(/(?:^|;\s*)jwt_token=([^;]+)/)?.[1];
  const userId = () => {
    try { return JSON.parse(atob(jwt().split('.')[1])).sub; } catch { return null; }
  };
  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      credentials: 'include',
      ...opts,
      headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}`);
    return res.json();
  };

  const fetchPath = async () => {
    const fields =
      'currentCourse{id,learningLanguage,fromLanguage,pathSectioned{units{unitIndex,levels{id,state,type,debugName,finishedSessions,totalSessions}}}}';
    const j = await api(`/2023-05-23/users/${userId()}?fields=${encodeURIComponent(fields)}`);
    const course = j.currentCourse;
    const levels = [];
    (course.pathSectioned || []).forEach((sec, si) =>
      (sec.units || []).forEach((u) =>
        (u.levels || []).forEach((l, li) => levels.push({ ...l, sectionIndex: si, unitIndex: u.unitIndex, levelInUnit: li }))
      )
    );
    return { course, levels };
  };

  // ───────────────────────── stories (player separado) ─────────────────────────
  const SB = {
    element: '[data-test="stories-element"]',
    cont: '[data-test="stories-player-continue"]',
    done: '[data-test="stories-player-done"]',
    choice: '[data-test="stories-choice"]',
    token: '[data-test*="challenge-tap-token"]',
    start: '[data-test="story-start"]', // tela "COMEÇAR HISTÓRIA"
  };
  const STORY_BASE = /^(stories-element|audio-button|close-button-stories|stories-player-continue|stories-player-done|story-start|drawer-backdrop|session-complete-slide)$/;
  const inStory = () => !!$(SB.element) || !!$(SB.cont) || !!$(SB.done) || !!$(SB.start);

  // Pular a narração: o player expõe continueStory() nos props do React (alguns
  // níveis acima do botão Continuar). Chamá-lo avança a fala sem esperar o áudio —
  // é o que a AutoLingo original fazia. Medido: story Titãs completa em 10 s.
  const continueStoryFn = () =>
    walkUp(fiberOf($(SB.cont)), (f) => (typeof f.memoizedProps?.continueStory === 'function' ? f.memoizedProps.continueStory : undefined), 12);
  const storyElementOf = (el) =>
    walkUp(fiberOf(el), (f) => f.memoizedProps?.storyElement || undefined, 25);

  // o data-test do token é "<texto>-challenge-tap-token", mas frases com espaço
  // vêm embaralhadas ("거야-challenge-tap-token 말하는"): casa por palavras
  const tapPhrase = async (phrase) => {
    const t = pickToken(tokenButtons(), phrase);
    if (!t) { report(T('log.storyToken', { t: norm(phrase) }), 'warn'); return false; }
    t.click();
    await wait(Math.max(35, cfg.delay * 0.45));
    return true;
  };

  const STORY_SOLVERS = {
    MULTIPLE_CHOICE: (se) => clickEl($$(SB.choice)[se.correctAnswerIndex]),
    SELECT_PHRASE: (se) => clickEl($$(SB.choice)[se.correctAnswerIndex]),
    ARRANGE: async (se) => { for (const i of se.phraseOrder || []) await tapPhrase(se.selectablePhrases[i]); },
    GAP_FILL: async (se) => { for (const i of se.correctIndices || []) await tapPhrase(se.choices[i]); },
    POINT_TO_PHRASE: (se) => {
      const sel = (se.transcriptParts || []).filter((p) => p.selectable);
      return tapPhrase(sel[se.correctAnswerIndex]?.text);
    },
    MATCH: async (se) => {
      for (const h of se.fallbackHints || se.matches || []) {
        await tapPhrase(h.phrase ?? h.learningToken);
        await tapPhrase(h.translation ?? h.fromToken);
      }
    },
  };

  const activeStoryChallenge = () => {
    if (isEnabled($(SB.cont))) return null;
    const el = $$('[data-test]').find((e) => !STORY_BASE.test(e.getAttribute('data-test')) && isEnabled(e));
    return el ? { el, se: storyElementOf(el) } : null;
  };

  const runStory = async (token, { timeoutMs = 10 * 60e3 } = {}) => {
    const t0 = Date.now();
    let lastLine = null, idleSince = Date.now(), lastSkip = 0, solvedAt = 0, storyRetries = 0;
    // v0.12.5: alguns desafios (ex.: GAP_FILL de 2 lacunas) não trazem lineIndex — só
    // trackingProperties.line_index. Com a chave antiga (lineIndex) todos viravam
    // "undefined" e, depois do primeiro, nenhum era resolvido (história travada).
    const lineKey = (se) => `${se.lineIndex ?? se.trackingProperties?.line_index ?? ''}|${se.type}|` +
      `${se.sentence?.text ?? se.question?.text ?? ''}|${(se.choices || []).map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join(',')}`;
    const gone = goneFor(1500);
    while (!token.stop) {
      if (Date.now() - t0 > timeoutMs) { report(T('log.storyTimeout'), 'warn'); return 'timeout'; }
      if ($(STREAK_OPT) && (await handleStreakGoal())) continue;
      if (gone()) return 'done';
      const done = $(SB.done);
      const start = $(SB.start);
      if (isEnabled(start)) { start.click(); idleSince = Date.now(); }
      else if (isEnabled(done)) { if (cfg.delay > 0) await wait(cfg.delay * 0.6); done.click(); idleSince = Date.now(); }
      else {
        const ac = activeStoryChallenge();
        const key = ac?.se ? lineKey(ac.se) : null;
        // resolveu mas o "Continuar" não habilitou e nenhum token foi usado: os cliques
        // foram cedo demais (botões ainda entrando na tela) → resolve de novo (até 3x)
        if (key && key === lastLine && !isEnabled($(SB.cont)) && Date.now() - solvedAt > 2500 && storyRetries < 3 &&
            !$$(SB.token).some((b) => b.getAttribute('aria-disabled') === 'true')) {
          storyRetries++;
          lastLine = null;
        }
        if (key && key !== lastLine) {
          if (key !== lastLine && lastLine !== null) storyRetries = 0;
          lastLine = key;
          solvedAt = Date.now();
          const fn = STORY_SOLVERS[ac.se.type];
          if (cfg.delay > 0) await wait(cfg.delay * 0.8);
          if (fn) { try { await fn(ac.se); } catch (e) { report(T('log.storySolver', { e: e.message }), 'error'); } }
          else {
            emit('unknownType', { type: 'story:' + ac.se.type, keys: Object.keys(ac.se) });
            report(T('log.storyNewType', { type: ac.se.type }), 'warn');
          }
          idleSince = Date.now();
        } else if (isEnabled($(SB.cont))) { $(SB.cont).click(); idleSince = Date.now(); }
        else if (!ac && continueStoryFn() && Date.now() - lastSkip > Math.max(120, cfg.delay * 0.5)) {
          // narração tocando, sem pergunta na tela: pula a fala
          try { continueStoryFn()(); } catch { /* ignora */ }
          lastSkip = idleSince = Date.now();
        }
        else if (!inStory() && pressNext()) { idleSince = Date.now(); } // telas de fim / anúncios
        // narração e animações podem segurar o "Continuar" por vários segundos: só
        // considera travada depois de 45 s sem nenhum avanço
        else if (Date.now() - idleSince > 45000) { report(T('log.storyStuck'), 'warn'); return 'stuck'; }
      }
      await sleep(cfg.humanize ? Math.max(80, jitter(cfg.delay * 0.45)) : 60);
    }
    return 'stopped';
  };

  // espera o player aparecer e roda o runner certo
  const runSession = async (token) => {
    const t0 = Date.now();
    for (let i = 0; i < 50 && !token.stop; i++) {
      if (lastSessionError && lastSessionError.at >= t0) return `session-error-${lastSessionError.status}`;
      if (inStory()) return runStory(token);
      if (getStatus() || $(S.quit)) return runLesson(token);
      await sleep(300);
    }
    return token.stop ? 'stopped' : 'no-session';
  };

  // ───────────────────────── navegação SPA ─────────────────────────
  const go = async (path) => {
    if (location.pathname === path) return;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    await sleep(800);
  };
  const legendaryPath = (lv) => `/lesson/unit/${lv.unitIndex + 1}/legendary/${lv.levelInUnit + 1}`;

  // A rota de Titãs usa os dados da seção que está carregada no app. Para prática
  // (LEGENDARY_LEXEME_PRACTICE) o app manda os skillIds do nó; com outra seção na tela
  // vai skillIds: [] — a sessão roda, mas o servidor não credita o nó (verificado
  // 2026-10-19). Por isso: carregar a seção do nó antes de abrir a rota.
  const renderedUnits = () =>
    $$(S.unit).map((u) => +((u.getAttribute('data-test') || '').match(/skill-path-unit-(\d+)/)?.[1] ?? -1));
  const sectionShown = (range) => renderedUnits().some((u) => u >= range[0] && u <= range[1]);
  const sectionIndexOf = (b) =>
    walkUp(fiberOf(b), (f) => (typeof f.memoizedProps?.section?.index === 'number' ? f.memoizedProps.section.index : undefined), 14);
  const SECTION_BTN = /revisar|continuar|começar|comecar|pular|review|continue|start|jump/i;

  const ensureSection = async (si, range) => {
    await go('/learn');
    for (let i = 0; i < 20 && !$(S.path); i++) await sleep(150);
    if (sectionShown(range)) return true;
    await go('/sections');
    let btn = null;
    for (let i = 0; i < 30 && !btn; i++) {
      btn = $$('button, a').find((b) => isEnabled(b) && SECTION_BTN.test(norm(b.textContent)) && sectionIndexOf(b) === si);
      if (!btn) await sleep(200);
    }
    if (!btn) { report(T('log.sectionNotFound', { n: si + 1 }), 'warn'); return false; }
    btn.click();
    for (let i = 0; i < 30 && !(onLearnPage() && $(S.path)); i++) await sleep(200);
    await sleep(400);
    const ok = sectionShown(range);
    if (!ok) report(T('log.sectionNotLoaded', { n: si + 1, units: renderedUnits().join(',') }), 'warn');
    return ok;
  };

  // inicia o nó "active" (lição normal ainda não concluída) clicando no caminho
  const startActiveNode = async (wantId = null) => {
    await go('/learn');
    for (let i = 0; i < 20 && !$(S.path); i++) await sleep(300);
    // o baú não tem data-test (só aria-label "Abrir baú"): procura por todos os botões do caminho
    const levelOf = (n) => walkUp(fiberOf(n), (f) => f.memoizedProps?.level || undefined, 10) ||
      fiberOf(n)?.child?.memoizedProps?.level;
    const findActive = () => {
      const nodes = [...new Set([...$$('[data-test*="skill-path-level-"]'), ...$$(`${S.path} button`)])];
      for (const n of nodes) {
        const lv = levelOf(n);
        if (lv?.state !== 'active') continue;
        if (wantId && lv.id && lv.id !== wantId) continue;
        return { node: n, lv };
      }
      return null;
    };
    // Logo depois de uma sessão o caminho na tela pode estar desatualizado (o nó novo
    // ainda aparece travado). Espera; se não aparecer, remonta o caminho e tenta de novo.
    let hit = null;
    for (let attempt = 0; attempt < 3 && !hit; attempt++) {
      if (attempt) { await go('/practice-hub'); await sleep(900); await go('/learn'); }
      for (let i = 0; i < 20 && !(hit = findActive()); i++) await sleep(300);
    }
    if (!hit) return false;
    const { node, lv: lvActive } = hit;
    node.scrollIntoView({ block: 'center' });
    await wait(500);
    if (lvActive.type === 'chest') {
      // baú: abrir é só clicar (o próprio Duolingo marca como concluído e libera o próximo nó)
      clickEl(node) || node.click();
      await sleep(1500);
      pressNext();
      return 'chest';
    }
    if (node.tagName === 'BUTTON') node.click();
    else clickEl(node.firstElementChild) || node.firstElementChild?.click();
    let btn = null;
    for (let i = 0; i < 20 && !btn; i++) {
      await sleep(150);
      btn = $('[data-test^="skill-path-state-active"]') ||
        $$('a, button').find((b) => /^(começar|start|iniciar)/i.test(norm(b.textContent)));
    }
    if (!btn) return false;
    btn.click();
    return true;
  };

  // ───────────────────────── GRIND: deixar tudo dourado ─────────────────────────
  const LEGEND_TYPES = new Set(['skill', 'story', 'practice']);
  // Prática "Spaced Repetition": o site do Duolingo não aceita Titãs nela. O POST da
  // sessão sai sem skills e volta 400/503 até no clique manual; no curso de inglês
  // eram 0 douradas de 525 (2026-10-19). Fica fora da fila e é contada à parte.
  const isBlockedByDuolingo = (l) => l.type === 'practice' && /^spaced repetition/i.test(l.debugName || '');
  const isEligible = (l) => LEGEND_TYPES.has(l.type) && !isBlockedByDuolingo(l);
  const grindState = { skip: {}, attempts: {}, done: 0, startedAt: 0 };

  // Resumo que serve tanto para curso avançado quanto para curso zerado: "faltam"
  // conta tudo que ainda não está dourado entre os nós que aceitam Titãs (inclusive
  // os bloqueados/ainda não feitos), e "passos" estima lições normais + Titãs.
  const summarize = (levels) => {
    const by = (s) => levels.filter((l) => l.state === s).length;
    const eligible = levels.filter(isEligible);
    const eligibleDone = eligible.filter((l) => l.state === 'legendary').length;
    const notStarted = (l) => l.state === 'locked' || l.state === 'active';
    const steps =
      eligible.filter((l) => l.state === 'passed').length +
      eligible.filter(notStarted).length * 2 +
      levels.filter((l) => !isEligible(l) && notStarted(l)).length;
    return {
      total: levels.length,
      legendary: by('legendary'),
      passed: by('passed'),
      active: by('active'),
      locked: by('locked'),
      eligibleTotal: eligible.length,
      eligibleDone,
      remaining: eligible.length - eligibleDone,
      steps,
      todo: eligible.filter((l) => l.state === 'passed' && !grindState.skip[l.id]).length,
      blocked: levels.filter((l) => isBlockedByDuolingo(l)).length,
      skipped: Object.keys(grindState.skip).length,
    };
  };

  const progressPayload = (levels, course, target, msPerStep) => {
    const sum = summarize(levels);
    const per = msPerStep || 35e3;
    return {
      ...sum,
      courseId: course?.id || null,
      msPerNode: Math.round(per),
      etaMs: Math.round(per * sum.steps),
      current: target && { u: target.lv.unitIndex, li: target.lv.levelInUnit, type: target.lv.type, name: target.lv.debugName, mode: target.mode },
      skip: grindState.skip,
      at: Date.now(),
    };
  };

  const sectionRange = (levels, si) => {
    let lo = Infinity, hi = -Infinity;
    for (const l of levels) if (l.sectionIndex === si) { lo = Math.min(lo, l.unitIndex); hi = Math.max(hi, l.unitIndex); }
    return [lo, hi];
  };

  // Ordem (definida por André em 2026-10-19):
  //  1. nó recém-concluído numa lição normal → Titãs dele na sequência
  //  2. próximo nó ainda não feito (active) → lição normal
  //  3. sem lições pendentes → volta ao começo e faz Titãs em tudo que falta
  //  v0.8: falhou? tenta o MESMO nó de novo na hora (até o limite de tentativas), e
  //  nada fica para trás na seção: Titãs pendente antes do nó ativo vem antes da
  //  próxima lição nova (antes ficava um "buraco" até o fim do curso)
  const pickTarget = (levels, justPassedId, retry = null) => {
    const pending = (l) => l.state === 'passed' && isEligible(l) && !grindState.skip[l.id];
    if (retry && !grindState.skip[retry.id]) {
      const r = levels.find((l) => l.id === retry.id);
      if (r && retry.mode === 'legendary' && pending(r)) return { lv: r, mode: 'legendary' };
      if (r && retry.mode === 'normal' && r.state === 'active') return { lv: r, mode: 'normal' };
    }
    if (justPassedId) {
      const jp = levels.find((l) => l.id === justPassedId);
      if (jp && pending(jp)) return { lv: jp, mode: 'legendary' };
    }
    const active = levels.find((l) => l.state === 'active' && !grindState.skip[l.id]);
    if (active) {
      // tudo o que ficou para trás na seção atual (antes do nó ativo) vem primeiro
      const before = (l) => l.unitIndex < active.unitIndex ||
        (l.unitIndex === active.unitIndex && l.levelInUnit < active.levelInUnit);
      const behind = levels.find((l) => pending(l) && l.sectionIndex === active.sectionIndex &&
        (before(l) || grindState.attempts[l.id] != null));
      if (behind) return { lv: behind, mode: 'legendary' };
      return { lv: active, mode: 'normal' };
    }
    // primeiro a seção onde você está (a mais avançada já liberada), depois do começo
    const reached = levels.filter((l) => l.state !== 'locked');
    const curSection = reached.length ? Math.max(...reached.map((l) => l.sectionIndex)) : -1;
    const lv = levels.find((l) => l.sectionIndex === curSection && pending(l)) || levels.find(pending);
    return lv ? { lv, mode: 'legendary' } : null;
  };

  const RELOAD_EVERY_MS = 60 * 60e3;
  // travou ("o próximo nó não abriu"): recarrega e continua. Espera cresce se voltar a
  // travar sem progresso nenhum, para não ficar recarregando sem parar.
  const BLOCK_KEY = 'alp.blockedReloads';
  const BLOCK_WAIT_S = [20, 120, 300, 900, 1800];
  const blockedWait = () => {
    let n = 0;
    try { n = JSON.parse(localStorage.getItem(BLOCK_KEY) || '{}').n || 0; } catch { /* sem storage */ }
    try { localStorage.setItem(BLOCK_KEY, JSON.stringify({ n: n + 1, at: Date.now() })); } catch { /* idem */ }
    return BLOCK_WAIT_S[Math.min(n, BLOCK_WAIT_S.length - 1)];
  };

  const grind = async (token, opts = {}) => {
    // início manual = lista de pulos zerada (dá nova chance a nós que falharam antes);
    // retomada automática após reload = mantém a lista salva
    grindState.skip = opts.resume ? { ...(opts.skip || {}) } : {};
    grindState.attempts = {};
    let cachedLevels = null, cachedCourse = null;
    let justPassedId = null, retry = null;
    grindState.startedAt = Date.now();
    grindState.done = 0;
    report(T('log.grindStart'));
    while (!token.stop) {
      // v0.12.7: a cada 1 h de grind recarrega a página (entre nós, nunca no meio de lição)
      // e continua sozinho depois do reload
      if (Date.now() - grindState.startedAt > RELOAD_EVERY_MS) {
        report(T('log.hourlyReload'));
        emit('reloading', { fresh: false });
        await sleep(60000); // a ponte recarrega; se não recarregar, segue o grind
        grindState.startedAt = Date.now();
      }
      let levels = cachedLevels, course = cachedCourse;
      cachedLevels = null;
      if (!levels) try { ({ levels, course } = await fetchPath()); cachedCourse = course; }
      catch (e) { report(T('log.pathFail', { e: e.message }), 'error'); await sleep(15000); continue; }

      const sum = summarize(levels);
      const target = pickTarget(levels, justPassedId, retry);
      justPassedId = null; retry = null;
      const per = grindState.done ? (Date.now() - grindState.startedAt) / grindState.done : 35e3;
      emit('progress', { ...progressPayload(levels, course, target, per), doneThisRun: grindState.done });
      if (!target) {
        // só é "100%" se não sobrou nó em andamento; se o próximo nó não abre, avisa em vez de mentir
        if (levels.some((l) => l.state === 'active')) {
          report(T('log.blocked'), 'error');
          return 'blocked';
        }
        report(T('log.complete')); emit('grindDone', sum); return 'complete';
      }

      const { lv, mode } = target;
      let started = true;
      report(T('log.target', { mode: T(mode === 'normal' ? 'mode.lesson' : 'mode.legendary').toLowerCase(), u: lv.unitIndex + 1, n: lv.levelInUnit + 1, type: lv.type, name: lv.debugName }));
      if (mode === 'normal') {
        await ensureSection(lv.sectionIndex, sectionRange(levels, lv.sectionIndex));
        started = await startActiveNode(lv.id);
        if (!started) {
          const n = grindState.attempts[lv.id] = (grindState.attempts[lv.id] || 0) + 1;
          report(T('log.openFail', { n }), 'warn');
          if (n >= 3) grindState.skip[lv.id] = 'active-not-found';
          continue;
        }
      } else {
        const range = sectionRange(levels, lv.sectionIndex);
        if (!(await ensureSection(lv.sectionIndex, range)) && lv.type === 'practice') {
          // sem a seção carregada a prática não credita: nem tenta
          grindState.skip[lv.id] = 'section-not-loaded';
          continue;
        }
        await go(legendaryPath(lv));
      }
      const r = started === 'chest' ? 'chest' : await runSession(token);
      if (token.stop) break;
      if (r === 'reload') {
        emit('reloading', { fresh: false });
        await sleep(60000); // a ponte recarrega; se não recarregar, segue
        continue;
      }

      // volta ao caminho e confere se o nó mudou de estado
      if (sessionVisible() || !onLearnPage()) await go('/learn');
      await sleep(700);
      let after;
      try {
        const fresh = await fetchPath();
        cachedLevels = fresh.levels; // reaproveita na próxima volta
        after = fresh.levels.find((l) => l.id === lv.id);
      } catch { /* tenta na próxima volta */ }
      if (after && after.state === lv.state && (after.finishedSessions ?? 0) <= (lv.finishedSessions ?? 0)) {
        // o servidor às vezes demora a refletir: confere de novo antes de contar como falha
        await sleep(1500);
        try { const again = await fetchPath(); cachedLevels = again.levels; after = again.levels.find((l) => l.id === lv.id); } catch {}
      }
      // nó com várias lições (ex.: 1/4): o estado só muda na última — conta também
      // o avanço de finishedSessions como progresso (senão o grind pularia o nó)
      const advanced = after && (after.finishedSessions ?? 0) > (lv.finishedSessions ?? 0);
      const upgraded = after && (after.state !== lv.state || advanced);
      if (upgraded) {
        grindState.done++;
        try { localStorage.removeItem(BLOCK_KEY); } catch { /* sem storage */ }
        grindState.attempts[lv.id] = 0;
        if (mode === 'normal') justPassedId = lv.id; // emenda a Titãs do mesmo nó
      }
      else {
        if (String(r).startsWith('session-error')) {
          grindState.attempts[lv.id] = 1; // força o pulo abaixo
          report(T('log.refused', { status: r.replace('session-error-', '') }), 'warn');
        }
        const n = (grindState.attempts[lv.id] = (grindState.attempts[lv.id] || 0) + 1);
        report(T('log.notAdvanced', { r, n }), 'warn');
        if (n >= 2) { grindState.skip[lv.id] = r; report(T('log.skipNode'), 'warn'); }
        else retry = { id: lv.id, mode }; // tenta de novo já, antes de seguir o caminho
      }
      emit('grindStep', { id: lv.id, result: r, upgraded, skip: grindState.skip });
      await wait(cfg.humanize ? Math.max(1200, cfg.delay * 4) : 300); // pausa entre lições
    }
    return 'stopped';
  };

  // exposto para a ponte / testes
  const api_ = {
    cfg, getStatus, getChallenge, solveCurrent, pressNext, skipChallenge, runLesson, runStory, runSession,
    fetchPath, api, userId, grind, grindState, startActiveNode, go, ensureSection,
    unknownTypes: () => [...unknownTypes],
  };

  // ───────────────────────── comandos ─────────────────────────
  let current = null; // { stop:boolean, kind }
  // manual = o usuário mandou parar (só isso desliga o grind de vez); fim por conta
  // própria (lição avulsa, grind completo) manda manual=false
  const stopAll = (manual = true) => {
    const was = current?.kind || null;
    if (current) current.stop = true;
    current = null;
    emit('state', { running: null, was, manual });
  };

  const commands = {
    config: (d) => { Object.assign(cfg, d || {}); emit('config', { ...cfg }); },
    hydrate: (d) => emit('hydrate', d || {}), // dados salvos (progresso/log) para a HUD
    solve: () => solveCurrent(),
    solveNext: async () => {
      await solveCurrent();
      await wait(cfg.delay * 0.4);
      pressNext();
      await sleep(900);
      if (getStatus() === 'BLAMING' || findNext()) pressNext();
    },
    skip: () => (inStory() ? null : skipChallenge()),
    lesson: async () => {
      stopAll();
      const token = (current = { stop: false, kind: 'lesson' });
      emit('state', { running: 'lesson' });
      const r = await runSession(token);
      report(T('log.lessonResult', { r }));
      if (current === token) stopAll(false);
    },
    grind: async (opts) => {
      if (current?.kind === 'grind') { stopAll(); report(T('log.grindStopped')); return; } // alterna
      stopAll();
      const token = (current = { stop: false, kind: 'grind' });
      emit('state', { running: 'grind' });
      const r = await grind(token, opts || {});
      report(T('log.grindResult', { r }));
      if (r === 'blocked' && !token.stop && current === token) {
        // continua "rodando": espera, recarrega a página e retoma com a lista de pulos zerada
        const secs = blockedWait();
        report(T('log.blockedReload', { s: secs }), 'warn');
        for (let i = 0; i < secs && !token.stop; i++) await sleep(1000);
        if (!token.stop && current === token) { emit('reloading', { fresh: true }); return; }
      }
      if (current === token) stopAll(false);
    },
    stop: () => { stopAll(); report(T('log.stopped')); },
    // outra aba assumiu o grind: para aqui sem desligar o grind salvo
    yield: () => { if (current?.kind === 'grind') { stopAll(false); report(T('log.otherTab'), 'warn'); } },
    note: (k) => report(T('log.' + k), 'warn'),
    theme: (t) => emit('theme', t), // escolha feita no popup → HUD
    lang: (l) => window[Symbol.for('alp.i18n')]?.setLang?.(l), // escolha feita no popup
  };
  api_.commands = commands;

  document.addEventListener('alp:in', async (e) => {
    const { cmd, data } = e.detail || {};
    try { await commands[cmd]?.(data); }
    catch (err) { report(T('log.cmdFail', { cmd, e: err?.message || err }), 'error'); }
  });

  // ───────────────────────── hotkeys ─────────────────────────
  // window + capture: roda antes dos listeners de outras extensões no document
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    let cmd = null;
    if (e.ctrlKey && k === 'enter') cmd = 'solveNext';
    else if (e.altKey && k === 'enter') cmd = 'solve';
    else if (e.altKey && k === 's') cmd = 'skip';
    else if (e.altKey && k === 'l') cmd = 'lesson';
    else if (e.altKey && k === 'g') cmd = 'grind';
    else if (e.altKey && k === 'x') cmd = 'stop';
    if (!cmd) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    commands[cmd]();
  }, true);

  // acesso interno sem global enumerável
  // ───────────────────────── progresso ao vivo (fora do grind) ─────────────────────────
  // Relê o caminho ao abrir, ao voltar para o /learn (fim de lição, troca/reset de
  // curso) e a cada 60 s, para a HUD nunca mostrar números velhos.
  let lastRefresh = 0, refreshing = false;
  const refreshProgress = async (force = false) => {
    if (refreshing || current?.kind === 'grind') return;
    if (!force && Date.now() - lastRefresh < 8000) return;
    refreshing = true;
    try {
      const { levels, course } = await fetchPath();
      lastRefresh = Date.now();
      emit('progress', progressPayload(levels, course, pickTarget(levels, null), grindState.done ? (Date.now() - grindState.startedAt) / grindState.done : 0));
    } catch { /* sem login / rede: tenta depois */ }
    finally { refreshing = false; }
  };
  api_.refreshProgress = refreshProgress;
  commands.refresh = () => refreshProgress(true);
  (async () => {
    await sleep(1500);
    refreshProgress(true);
    let lastPath = location.pathname, lastTick = Date.now();
    for (;;) {
      await sleep(1000);
      const p = location.pathname;
      if (p !== lastPath) {
        lastPath = p;
        if (p.startsWith('/learn')) setTimeout(() => refreshProgress(true), 1200);
      }
      if (Date.now() - lastTick > 60000) { lastTick = Date.now(); if (!sessionVisible()) refreshProgress(); }
    }
  })();

  Object.defineProperty(window, Symbol.for('alp.api'), { value: api_ });
  emit('ready', {});
})();
