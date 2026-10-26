// Midas — HUD dentro do Duolingo (mundo MAIN).
// Usa as variáveis de cor do próprio site (--color-snow, --color-eel, --color-bee…),
// então acompanha o tema claro/escuro sozinha. Shadow DOM: o CSS do Duolingo não
// vaza para dentro e o nosso não vaza para fora.
(() => {
  'use strict';
  const FLAG = Symbol.for('alp.hud.loaded');
  if (window[FLAG]) return;
  Object.defineProperty(window, FLAG, { value: true });

  const API = () => window[Symbol.for('alp.api')];
  const LS_KEY = 'alp.hud';
  const loadUi = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
  const saveUi = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...loadUi(), ...o })); } catch { /* ok */ } };

  const state = {
    running: null,
    progress: null,
    logs: [],
    unknown: new Set(),
    ui: { open: true, logOpen: false, x: null, y: null, ...loadUi() },
    upd: {}, updStatus: null, // alp_update (do service worker) + estado do último clique
  };

  const fmtDur = (ms) => {
    if (!ms || !isFinite(ms)) return '–';
    const h = Math.floor(ms / 3.6e6), m = Math.round((ms % 3.6e6) / 6e4);
    if (h >= 48) return `${Math.round(h / 24)} d`;
    return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
  };
  // v0.9: textos no idioma do navegador (src/i18n.js)
  const I18N = window[Symbol.for('alp.i18n')] || { t: (k) => k, locale: 'pt-BR' };
  const T = I18N.t;
  const nf = (n) => (typeof n === 'number' ? n.toLocaleString(I18N.locale) : '–');
  const typeName = (ty) => { const k = 'type.' + ty; const v = T(k); return v === k ? ty : v; };
  // Presets de velocidade (v0.8). Rage = padrão. Legit = recomendado para parecer gente.
  const PRESETS = {
    rage: { delay: 0, humanize: false, label: 'Rage' },
    legit: { delay: 2500, humanize: true, label: 'Legit' },
    manual: { label: 'Manual' },
  };
  const presetOf = (c) => c?.preset || (c && c.delay === 0 && !c.humanize ? 'rage' : c && c.delay === 2500 && c.humanize ? 'legit' : 'manual');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CROWN = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11l6 5 6-9 6 9 6-5-2.5 13h-19z" fill="rgb(var(--color-bee,255,199,0))"/><path d="M6.5 24h19v3h-19z" fill="rgb(var(--color-bee,255,199,0))" opacity=".75"/><circle cx="16" cy="6" r="2" fill="rgb(var(--color-bee,255,199,0))"/><circle cx="3.5" cy="10" r="1.8" fill="rgb(var(--color-bee,255,199,0))"/><circle cx="28.5" cy="10" r="1.8" fill="rgb(var(--color-bee,255,199,0))"/></svg>`;

  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 7h-4.5v6h-5v-6H5z"/><rect x="5" y="18" width="14" height="3" rx="1.5"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 0 1 7.4 5H17v2h6V5h-2v2.3A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 8a8 8 0 0 1-15.4 3H7v-2H1v6h2v-2.3A10 10 0 0 0 22 12z"/></svg>';

  const ICON_BUG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.4 7 2.9l1.1-1.1 1.8 1.8a5 5 0 0 1 4.2 0l1.8-1.8L17 2.9l-1.5 1.5A5 5 0 0 1 17 8H7a5 5 0 0 1 1.5-3.6zM6 10h12v4a6 6 0 0 1-12 0zm-4 1h3v2H2zm17 0h3v2h-3zM2 17l3-1 .6 1.9-3 1zm19.4 1.9-3-1L19 16l3 1zM11 11h2v8h-2z"/></svg>';

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .wrap {
    --snow: rgb(var(--color-snow, 19,31,36));
    --polar: rgb(var(--color-polar, 32,47,54));
    --swan: rgb(var(--color-swan, 55,70,79));
    --hare: rgb(var(--color-hare, 82,101,109));
    --eel: rgb(var(--color-eel, 241,247,251));
    --wolf: rgb(var(--color-wolf, 220,230,236));
    --macaw: rgb(var(--color-macaw, 73,192,248));
    --owl: rgb(var(--color-owl, 147,211,51));
    --bee: rgb(var(--color-bee, 255,199,0));
    --cardinal: #ff4b4b;
    position: fixed; z-index: 2147483000;
    font-family: duolingo-sans, "din-round", "Nunito", system-ui, sans-serif;
    color: var(--eel); font-size: 14px; line-height: 1.35;
    -webkit-font-smoothing: antialiased;
  }
  /* tema escolhido no botão sol/lua (v0.11.3); sem escolha, segue o tema do próprio Duolingo */
  .wrap[data-theme="dark"] {
    --snow: rgb(19,31,36); --polar: rgb(32,47,54); --swan: rgb(55,70,79); --hare: rgb(82,101,109);
    --eel: rgb(241,247,251); --wolf: rgb(220,230,236); --macaw: rgb(73,192,248); --owl: rgb(147,211,51); --bee: rgb(255,199,0);
  }
  /* claro (v0.11.4): contraste revisto — texto pequeno ≥ 4,5:1 sobre branco (WCAG AA) */
  .wrap[data-theme="light"] {
    --snow: rgb(255,255,255); --polar: rgb(244,244,244); --swan: rgb(220,220,220); --hare: rgb(107,107,107);
    --eel: rgb(47,47,47); --wolf: rgb(75,75,75); --macaw: rgb(11,120,179); --owl: rgb(88,167,0); --bee: rgb(255,200,0);
    --gold-text: #9a6700;
  }
  .wrap[data-theme="light"] .credit b { background-image: linear-gradient(90deg, #a86c00 0%, #c46a00 35%, #e09a00 50%, #c46a00 65%, #a86c00 100%); }
  .wrap[data-theme="light"] .now b, .wrap[data-theme="light"] .num, .wrap[data-theme="light"] pre .lv-warn { color: var(--gold-text); }
  .wrap[data-theme="light"] pre .lv-error { color: #c62828; }
  .wrap[data-theme="light"] .switch span::before { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
  .wrap[data-theme="light"] .panel { box-shadow: 0 10px 30px rgba(0,0,0,.14); }
  .wrap[data-theme="light"] .btn.ghost { box-shadow: 0 3px 0 var(--swan); }
  .wrap[data-theme="light"] .tip { box-shadow: 0 8px 24px rgba(0,0,0,.14); }

  /* interruptor de tema: trilho com sol e lua, bolinha desliza (v0.11.4) */
  .tswitch { position: relative; width: 50px; height: 28px; flex: none; padding: 0; cursor: pointer; border-radius: 99px;
    border: 2px solid var(--swan); background: rgb(11,20,24); transition: background .25s, border-color .25s; }
  .tswitch .ic { position: absolute; top: 50%; width: 13px; height: 13px; transform: translateY(-50%); pointer-events: none; }
  .tswitch .ic.sun { left: 6px; fill: #ffb800; stroke: #ffb800; opacity: .55; }
  .tswitch .ic.moon { right: 6px; fill: #c9d6ff; opacity: .55; }
  .tswitch .knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%;
    display: grid; place-items: center; background: #37464f; box-shadow: 0 1px 3px rgba(0,0,0,.4);
    transform: translateX(22px); transition: transform .25s cubic-bezier(.3,1.4,.5,1), background .25s; }
  .tswitch .knob svg { width: 12px; height: 12px; }
  .tswitch .knob .moon { fill: var(--bee); }
  .tswitch .knob .sun { display: none; fill: #ff9600; stroke: #ff9600; }
  .tswitch[aria-checked="false"] { background: #d7effc; border-color: #b8def5; }
  .tswitch[aria-checked="false"] .knob { transform: none; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  .tswitch[aria-checked="false"] .knob .moon { display: none; }
  .tswitch[aria-checked="false"] .knob .sun { display: block; }
  .tswitch[aria-checked="false"] .ic.moon { fill: #6f86b3; opacity: .85; }
  .wrap[data-theme="light"] { color-scheme: light; } .wrap[data-theme="dark"] { color-scheme: dark; }
  .tswitch:hover { border-color: var(--bee); }
  .tswitch:focus-visible { outline: 2px solid var(--macaw); outline-offset: 2px; }
  button { font: inherit; color: inherit; }

  /* botão flutuante (recolhido) */
  .fab {
    width: 56px; height: 56px; border-radius: 16px; cursor: pointer;
    background: var(--snow); border: 2px solid var(--swan); border-bottom-width: 5px;
    display: grid; place-items: center; position: relative;
    transition: transform .1s;
  }
  .fab:active { transform: translateY(2px); border-bottom-width: 3px; }
  .fab svg { width: 30px; height: 30px; }
  .fab .dot { position: absolute; top: 6px; right: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--hare); }
  .fab.on .dot { background: var(--bee); box-shadow: 0 0 0 0 var(--bee); animation: pulse 1.6s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,199,0,.6); } 100% { box-shadow: 0 0 0 10px rgba(255,199,0,0); } }

  /* painel */
  .panel {
    width: 380px; min-width: 300px; min-height: 220px; max-width: calc(100vw - 16px); max-height: calc(100vh - 40px);
    overflow: auto; resize: both;
    background: var(--snow); border: 2px solid var(--swan); border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    scrollbar-width: thin; scrollbar-color: var(--swan) transparent;
  }
  .head {
    display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px 14px;
    border-bottom: 2px solid var(--swan); cursor: grab; user-select: none;
    position: sticky; top: 0; background: var(--snow); z-index: 1;
  }
  .head:active { cursor: grabbing; }
  .head svg { width: 26px; height: 26px; flex: none; }
  .title { font-weight: 800; font-size: 16px; letter-spacing: .01em; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* seletor de idioma: bandeirinhas discretas; a ativa ganha contorno dourado */
  .tblock { flex: 1; min-width: 0; display: grid; gap: 5px; }
  .langs { display: flex; gap: 6px; }
  .flag { width: 20px; height: 14px; padding: 0; border: 0; border-radius: 4px; overflow: hidden; cursor: pointer; background: none;
    opacity: .45; filter: saturate(.6); box-shadow: 0 0 0 1.5px var(--swan); transition: opacity .15s, filter .15s, box-shadow .15s, transform .1s; }
  .flag svg { width: 100%; height: 100%; display: block; }
  .flag:hover, .flag:focus-visible { opacity: .85; filter: none; outline: none; }
  .flag:active { transform: translateY(1px); }
  .flag.on { opacity: 1; filter: none; box-shadow: 0 0 0 2px var(--bee); }
  .chip { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
    padding: 3px 8px; border-radius: 99px; background: var(--polar); color: var(--wolf); border: 2px solid var(--swan); }
  .chip.grind { background: var(--bee); color: #4b3800; border-color: var(--bee); }
  .chip.lesson { background: var(--owl); color: #1b3a00; border-color: var(--owl); }
  .icon-btn { width: 30px; height: 30px; border-radius: 10px; border: 2px solid var(--swan); background: transparent;
    display: grid; place-items: center; cursor: pointer; color: var(--wolf); }
  .icon-btn:hover { background: var(--polar); }

  .body { padding: 12px; display: grid; gap: 12px; }
  .card { border: 2px solid var(--swan); border-radius: 16px; padding: 12px; }
  h3 { margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--hare); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

  /* botões 3D no estilo Duolingo */
  .btn { border: 0; border-radius: 14px; padding: 11px 14px; font-weight: 800; font-size: 13px;
    text-transform: uppercase; letter-spacing: .06em; cursor: pointer; position: relative; top: 0;
    transition: filter .1s; }
  .btn:hover { filter: brightness(1.06); }
  .btn:active { top: 3px; }
  .btn:disabled { opacity: .6; cursor: default; filter: none; }
  .btn.gold { background: var(--bee); color: #4b3800; box-shadow: 0 4px 0 #cc9f00; }
  .btn.gold:active { box-shadow: 0 1px 0 #cc9f00; }
  .btn.red { background: var(--cardinal); color: #fff; box-shadow: 0 4px 0 #c33c3c; }
  .btn.red:active { box-shadow: 0 1px 0 #c33c3c; }
  .btn.ghost { background: transparent; color: var(--macaw); border: 2px solid var(--swan); box-shadow: 0 3px 0 var(--swan);
    padding: 9px 10px; font-size: 12px; }
  .btn.ghost:active { box-shadow: 0 0 0 var(--swan); }
  .btns { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 10px; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
  .seg button { border: 2px solid var(--swan); border-bottom-width: 4px; background: transparent; border-radius: 12px;
    padding: 7px 4px; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--wolf); cursor: pointer; }
  .seg button:hover { background: var(--polar); }
  .seg button.on { background: var(--bee); border-color: #cc9f00; color: #4b3800; }
  .seg button[data-p="legit"].on { background: var(--owl); border-color: #58a700; color: #1b3a00; }
  .seg button[data-p="manual"].on { background: var(--macaw); border-color: #1899d6; color: #04304a; }
  .hint { margin: 8px 0 0; font-size: 11px; color: var(--hare); }
  .sub { font-size: 11px; color: var(--hare); font-weight: 700; margin-top: 2px; }
  .copy { border: 2px solid var(--swan); border-bottom-width: 3px; background: transparent; color: var(--macaw); border-radius: 10px;
    padding: 3px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; margin-left: auto; margin-right: 8px; }
  .copy:hover { background: var(--polar); }
  .btns .wide { grid-column: span 2; }

  .bar { height: 16px; background: var(--swan); border-radius: 99px; overflow: hidden; margin: 12px 0 10px; }
  .bar i { display: block; height: 100%; width: 0; background: var(--bee); border-radius: 99px; transition: width .5s;
    background-image: linear-gradient(rgba(255,255,255,.25), rgba(255,255,255,.25)); background-size: 100% 4px;
    background-repeat: no-repeat; background-position: 0 4px; background-color: var(--bee); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; }
  .stats b { display: block; font-size: 18px; font-weight: 800; color: var(--eel); font-variant-numeric: tabular-nums; }
  .stats span { font-size: 11px; color: var(--hare); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .now { margin: 10px 0 0; font-size: 12px; color: var(--wolf); min-height: 16px; }
  .now b { color: var(--bee); }
  .note { margin: 8px 0 0; font-size: 11px; color: var(--hare); }

  label.set { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font-weight: 700; }
  input[type=range] { flex: 1; min-width: 100px; accent-color: var(--bee); }
  .num { font-variant-numeric: tabular-nums; color: var(--bee); font-weight: 800; min-width: 54px; text-align: right; }
  .switch { position: relative; width: 44px; height: 26px; flex: none; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch span { position: absolute; inset: 0; background: var(--swan); border-radius: 99px; cursor: pointer; transition: .2s; }
  .switch span::before { content: ""; position: absolute; width: 20px; height: 20px; left: 3px; top: 3px; border-radius: 50%; background: var(--eel); transition: .2s; }
  .switch input:checked + span { background: var(--owl); }
  .switch input:checked + span::before { transform: translateX(18px); }

  details summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
  details summary::-webkit-details-marker { display: none; }
  details summary::after { content: "▾"; color: var(--hare); }
  details[open] summary::after { content: "▴"; }
  pre { margin: 10px 0 0; max-height: 260px; overflow: auto; white-space: pre-wrap; font: 11px/1.45 ui-monospace, Consolas, monospace; color: var(--wolf); }
  /* "lv-": a classe "info" do log colidia com o botão "i" de ajuda (v0.9.0) */
  pre .lv-warn { color: var(--bee); } pre .lv-error { color: var(--cardinal); }
  .unk { margin-top: 8px; font-size: 11px; color: var(--hare); }
  /* "i" de ajuda, discreto, no estilo Duolingo; o balão abre no hover/foco/toque */
  .info { width: 18px; height: 18px; flex: none; display: inline-grid; place-items: center; padding: 0; margin-left: 6px;
    border-radius: 50%; border: 2px solid var(--swan); background: transparent; color: var(--hare);
    font: 800 11px/1 duolingo-sans, sans-serif; cursor: help; vertical-align: middle; transition: color .15s, border-color .15s; }
  .info:hover, .info:focus-visible, .info.on { color: var(--macaw); border-color: var(--macaw); outline: none; }
  .ttl { display: inline-flex; align-items: center; }
  .tip { position: fixed; z-index: 2147483001; max-width: 260px; padding: 10px 12px; border-radius: 14px;
    background: var(--polar); color: var(--eel); border: 2px solid var(--swan); border-bottom-width: 4px;
    font: 600 12px/1.45 duolingo-sans, "din-round", "Nunito", system-ui, sans-serif; text-transform: none; letter-spacing: 0;
    box-shadow: 0 8px 24px rgba(0,0,0,.3); pointer-events: none; opacity: 0; transform: translateY(4px); transition: opacity .12s, transform .12s; }
  .tip.show { opacity: 1; transform: none; }
  .tip::after { content: ""; position: absolute; left: var(--ax, 50%); width: 12px; height: 12px; background: var(--polar);
    border: 2px solid var(--swan); transform: translateX(-50%) rotate(45deg); }
  .tip.below::after { top: -8px; border-right: 0; border-bottom: 0; }
  .tip.above::after { bottom: -9px; border-left: 0; border-top: 0; border-bottom-width: 4px; border-right-width: 4px; }
  .keys { padding: 0 12px 12px; font-size: 11px; color: var(--hare); display: flex; flex-wrap: wrap; gap: 4px 10px; }
  .keys span { white-space: nowrap; }
  /* assinatura (v0.11): discreta, com brilho dourado só no nome */
  .credit { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0 12px 12px; padding-top: 10px;
    border-top: 2px dashed var(--swan); font-size: 11px; font-weight: 700; color: var(--hare); letter-spacing: .04em; }
  /* estrela do tamanho da altura das maiúsculas e subida 0,5 px: o centro "visual" de uma
     estrela de 5 pontas fica abaixo do centro da caixa (pedido do André, v0.11.2) */
  .credit svg { width: 9px; height: 9px; fill: var(--bee); flex: none; display: block; transform: translateY(-0.5px); }
  .credit .by { text-transform: lowercase; }
  .credit b { font-weight: 800; font-size: 12px; letter-spacing: .06em;
    background: linear-gradient(90deg, #ffc800 0%, #ff9600 35%, #fff2b3 50%, #ff9600 65%, #ffc800 100%);
    background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: alp-shine 5s linear infinite; }
  .credit a.gh { text-decoration: none; border-radius: 6px; padding: 1px 3px; margin: -1px -3px; transition: background .15s; }
  .credit a.gh:hover, .credit a.gh:focus-visible { background: rgba(255,200,0,.12); outline: none; }
  .credit .ver { font-variant-numeric: tabular-nums; opacity: .8; }
  @keyframes alp-shine { from { background-position: 100% 0; } to { background-position: -120% 0; } }
  @media (prefers-reduced-motion: reduce) { .credit b { animation: none; } }
  .stale { margin: 12px 12px 0; padding: 10px 12px; border-radius: 14px; border: 2px solid var(--bee);
    background: rgba(255,200,0,.10); font-size: 12px; font-weight: 700; display: flex; gap: 10px; align-items: center; }
  .stale span { flex: 1; }
  .stale button { border: 0; border-radius: 10px; padding: 6px 10px; font-weight: 800; font-size: 11px; text-transform: uppercase;
    letter-spacing: .05em; background: var(--bee); color: #4b3800; box-shadow: 0 3px 0 #cc9f00; cursor: pointer; }
  /* atualização (v0.13.0): cartão dourado com o que mudou + linha "procurar atualização" */
  .upd, .updok { margin: 12px 12px 0; border-radius: 16px; border: 2px solid var(--bee); border-bottom-width: 4px;
    background: linear-gradient(180deg, rgba(255,200,0,.14), rgba(255,200,0,.04)); padding: 12px; animation: alp-pop .35s cubic-bezier(.3,1.4,.5,1); }
  @keyframes alp-pop { from { transform: translateY(-6px) scale(.98); opacity: 0; } to { transform: none; opacity: 1; } }
  .upd-h { display: flex; gap: 10px; align-items: center; }
  .upd-ic { width: 34px; height: 34px; flex: none; border-radius: 12px; background: var(--bee); display: grid; place-items: center; box-shadow: 0 3px 0 #cc9f00; }
  .upd-ic svg { width: 20px; height: 20px; fill: #4b3800; }
  .upd-h b { display: block; font-size: 14px; font-weight: 800; }
  .upd-v { font-size: 12px; font-weight: 800; color: var(--hare); font-variant-numeric: tabular-nums; }
  .upd-v i { font-style: normal; color: var(--bee); }
  .wrap[data-theme="light"] .upd-v i { color: var(--gold-text); }
  .upd-notes { margin: 10px 0 0; padding: 0 0 0 18px; font-size: 12px; color: var(--wolf); display: grid; gap: 3px; max-height: 120px; overflow: auto; }
  .upd-msg { margin: 10px 0 0; font-size: 12px; font-weight: 700; color: var(--eel); }
  .upd-btns { display: flex; gap: 8px; margin-top: 12px; }
  .upd-guide { margin-top: 8px; padding: 0; border: 0; background: none; color: var(--macaw); font-weight: 800; font-size: 12px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
  .upd-btns .btn { flex: 1; padding: 9px 10px; }
  .updok { display: flex; gap: 10px; align-items: center; border-color: var(--owl); background: rgba(147,211,51,.10); font-size: 12px; font-weight: 800; }
  .updok span { flex: 1; }
  .updok button { border: 0; background: transparent; color: var(--hare); cursor: pointer; font-weight: 800; }
  .updrow { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0 12px 10px; }
  .updbtn { display: inline-flex; align-items: center; gap: 6px; border: 2px solid var(--swan); border-bottom-width: 3px; border-radius: 99px;
    background: transparent; color: var(--macaw); padding: 4px 11px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; }
  .updbtn:hover { background: var(--polar); }
  .updbtn:active { border-bottom-width: 2px; transform: translateY(1px); }
  .updbtn svg { width: 12px; height: 12px; fill: currentColor; }
  .updbtn.spin svg { animation: alp-spin .8s linear infinite; }
  @keyframes alp-spin { to { transform: rotate(360deg); } }
  .upd-st { font-size: 11px; font-weight: 700; color: var(--hare); }
  .upd-st.new { color: var(--bee); cursor: pointer; text-decoration: underline dotted; }
  .wrap[data-theme="light"] .upd-st.new { color: var(--gold-text); }
  .fab.upd .dot { background: var(--macaw); }
  /* relatar bug (v0.14.0) */
  .bug { margin: 12px 12px 0; border-radius: 16px; border: 2px solid var(--macaw); border-bottom-width: 4px;
    background: linear-gradient(180deg, rgba(28,176,246,.12), rgba(28,176,246,.03)); padding: 12px; animation: alp-pop .35s cubic-bezier(.3,1.4,.5,1); }
  .bug-h { display: flex; gap: 10px; align-items: center; }
  .bug-h b { flex: 1; font-size: 14px; font-weight: 800; }
  .bug-ic { width: 34px; height: 34px; flex: none; border-radius: 12px; background: var(--macaw); display: grid; place-items: center; box-shadow: 0 3px 0 #1899d6; }
  .bug-ic svg { width: 20px; height: 20px; fill: #04304a; }
  .bug-x { border: 0; background: transparent; color: var(--hare); cursor: pointer; font-weight: 800; font-size: 14px; }
  .bug textarea { width: 100%; margin-top: 10px; min-height: 70px; resize: vertical; border-radius: 12px; border: 2px solid var(--swan);
    background: var(--polar); color: var(--eel); padding: 8px 10px; font: 600 13px/1.4 duolingo-sans, "din-round", "Nunito", system-ui, sans-serif; }
  .bug textarea:focus { outline: none; border-color: var(--macaw); }
  .bug details { margin-top: 8px; }
  .bug summary { font-size: 12px; font-weight: 800; color: var(--macaw); }
  .bug summary::after { color: var(--macaw); }
  .bug pre { max-height: 150px; margin-top: 6px; padding: 8px; border-radius: 10px; background: var(--polar); }
  .bug-note { margin: 8px 0 0; font-size: 11px; color: var(--hare); font-weight: 700; }
  .bug .btn.blue { background: var(--macaw); color: #04304a; box-shadow: 0 4px 0 #1899d6; }
  .bug .btn.blue:active { box-shadow: 0 1px 0 #1899d6; }
  .updbtn.bugbtn { color: var(--macaw); }
  .keys kbd { font: 700 10px duolingo-sans, sans-serif; border: 2px solid var(--swan); border-bottom-width: 3px; border-radius: 6px; padding: 0 4px; color: var(--wolf); }
  `;

  // texto traduzível: marcado para ser trocado na hora quando o idioma muda (bandeiras)
  const tx = (k) => `<span data-i18n="${k}">${esc(T(k))}</span>`;
  // Bandeiras (v0.11.2): Brasil, EUA e Espanha em SVG — emoji de bandeira não aparece no Windows
  const FLAGS = {
    pt: { name: 'Português', svg: '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#009c3b"/><path d="M10 1.6 18.4 7 10 12.4 1.6 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.3" fill="#002776"/><path d="M6.9 6.2q3.3-.9 6.2.9" stroke="#fff" stroke-width=".7" fill="none"/></svg>' },
    en: { name: 'English', svg: '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#fff"/><path d="M0 0h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.16h20v1.07H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.16h20V14H0z" fill="#b22234"/><rect width="9" height="7.54" fill="#3c3b6e"/><g fill="#fff"><circle cx="1.6" cy="1.4" r=".45"/><circle cx="3.6" cy="1.4" r=".45"/><circle cx="5.6" cy="1.4" r=".45"/><circle cx="7.6" cy="1.4" r=".45"/><circle cx="2.6" cy="2.9" r=".45"/><circle cx="4.6" cy="2.9" r=".45"/><circle cx="6.6" cy="2.9" r=".45"/><circle cx="1.6" cy="4.4" r=".45"/><circle cx="3.6" cy="4.4" r=".45"/><circle cx="5.6" cy="4.4" r=".45"/><circle cx="7.6" cy="4.4" r=".45"/><circle cx="2.6" cy="5.9" r=".45"/><circle cx="4.6" cy="5.9" r=".45"/><circle cx="6.6" cy="5.9" r=".45"/></g></svg>' },
    es: { name: 'Español', svg: '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#aa151b"/><rect y="3.5" width="20" height="7" fill="#f1bf00"/></svg>' },
  };
  const LANG_BTNS = () => `<div class="langs" role="group" aria-label="Idioma / Language">${Object.entries(FLAGS)
    .map(([k, f]) => `<button class="flag" type="button" data-lang="${k}" title="${f.name}" aria-label="${f.name}">${f.svg}</button>`).join('')}</div>`;
  const info = (k) => `<button class="info" type="button" data-help="${k}" aria-label="${esc(T('help.label'))}" data-i18n-aria="help.label">i</button>`;
  const HTML = () => `
  <div class="wrap">
    <div class="fab" title="${esc(T('fab.title'))}" data-i18n-title="fab.title">${CROWN}<span class="dot"></span></div>
    <section class="panel" hidden>
      <div class="head">${CROWN}<div class="tblock"><div class="title">Midas</div>${LANG_BTNS()}</div><span class="chip">${tx('chip.stopped')}</span>
        <button class="tswitch" data-a="theme" type="button" role="switch" aria-checked="true">${THEME_SWITCH}</button>
        <button class="icon-btn" data-a="close" title="${esc(T('close.title'))}" data-i18n-title="close.title">✕</button></div>
      <div class="stale" hidden><span data-i18n="stale.msg">${esc(T('stale.msg'))}</span><button type="button" data-a="reload" data-i18n="stale.btn">${esc(T('stale.btn'))}</button></div>
      <div class="updok" hidden><span></span><button type="button" data-a="updSeen" aria-label="OK">✕</button></div>
      <div class="upd" hidden>
        <div class="upd-h"><span class="upd-ic">${ICON_UP}</span><div><b>${tx('upd.title')}</b><div class="upd-v"></div></div></div>
        <ul class="upd-notes"></ul>
        <p class="upd-msg" hidden></p>
        <button class="upd-guide" type="button" data-a="updGuide">${tx('upd.guide')}</button>
        <div class="upd-btns"><button class="btn gold" data-a="updApply">${tx('upd.now')}</button><button class="btn ghost" data-a="updLater">${tx('upd.later')}</button></div>
      </div>
      <div class="bug" hidden>
        <div class="bug-h"><span class="bug-ic">${ICON_BUG}</span><b>${tx('bug.title')}</b><button class="bug-x" type="button" data-a="bugClose" aria-label="✕">✕</button></div>
        <textarea data-s="bugWhat" rows="3" placeholder="${esc(T('bug.ph'))}" data-i18n-ph="bug.ph"></textarea>
        <details><summary>${tx('bug.diag')}</summary><pre data-s="bugDiag"></pre></details>
        <p class="bug-note">${tx('bug.note')}</p>
        <div class="upd-btns"><button class="btn blue" data-a="bugGh">${tx('bug.open')}</button><button class="btn ghost" data-a="bugCopy">${tx('bug.copy')}</button></div>
      </div>
      <div class="body">
        <div class="card">
          <div class="row"><div><h3 class="ttl">${tx('grind.title')}${info('help.grind')}</h3><div class="sub">${tx('grind.sub')}</div></div><button class="btn gold" data-a="grind">${tx('btn.start')}</button></div>
          <div class="bar"><i></i></div>
          <div class="stats">
            <div><b data-s="leg">–</b><span>${tx('stat.legendary')}</span></div>
            <div><b data-s="todo">–</b><span>${tx('stat.left')}</span></div>
            <div><b data-s="eta">–</b><span class="ttl">${tx('stat.eta')}${info('help.stats')}</span></div>
          </div>
          <p class="now"></p>
          <p class="note" hidden></p>
        </div>
        <div class="card">
          <h3 class="ttl">${tx('lesson.title')}${info('help.lesson')}</h3>
          <div class="btns">
            <button class="btn ghost" data-a="solveNext">${tx('act.solveNext')}</button>
            <button class="btn ghost" data-a="solve">${tx('act.solve')}</button>
            <button class="btn ghost" data-a="lesson">${tx('act.lesson')}</button>
            <button class="btn ghost" data-a="skip">${tx('act.skip')}</button>
          </div>
        </div>
        <div class="card">
          <h3 class="ttl">${tx('speed.title')}${info('help.speed')}</h3>
          <div class="seg"><button data-p="rage">Rage</button><button data-p="legit">Legit</button><button data-p="manual">Manual</button></div>
          <p class="hint" data-s="hint"></p>
          <label class="set"><span class="ttl">${tx('set.delay')}${info('help.delay')}</span><input type="range" min="0" max="5000" step="50" data-c="delay"><span class="num" data-s="delay"></span></label>
          <label class="set"><span class="ttl">${tx('set.humanize')}${info('help.humanize')}</span><span class="switch"><input type="checkbox" data-c="humanize"><span></span></span></label>
        </div>
        <details class="card" data-a="log"><summary><h3 class="ttl">${tx('log.title')}${info('help.log')}</h3><button class="copy" data-a="copy" title="${esc(T('log.copyTitle'))}" data-i18n-title="log.copyTitle">${tx('log.copy')}</button></summary><pre></pre><div class="unk"></div></details>
      </div>
      <div class="keys"><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ${tx('key.solve')}</span><span><kbd>Alt</kbd>+<kbd>G</kbd> ${tx('key.grind')}</span><span><kbd>Alt</kbd>+<kbd>X</kbd> ${tx('key.stop')}</span><span><kbd>Alt</kbd>+<kbd>H</kbd> ${tx('key.hud')}</span></div>
      <div class="updrow"><button class="updbtn" type="button" data-a="updCheck">${ICON_REFRESH}${tx('upd.check')}</button>${info('help.update')}<span class="upd-st"></span><button class="updbtn bugbtn" type="button" data-a="bugOpen">${ICON_BUG}${tx('bug.btn')}</button>${info('help.bug')}</div>
      <div class="credit"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0l1.9 5.6L16 6.1l-4.9 3.6L12.9 16 8 12.4 3.1 16l1.8-6.3L0 6.1l6.1-.5z"/></svg><span class="by">${tx('credit.by')}</span><a class="gh" href="https://github.com/DredsGG" target="_blank" rel="noopener noreferrer" title="github.com/DredsGG"><b>Dreds</b></a><span class="ver" data-s="ver"></span></div>
    </section>
    <div class="tip" role="tooltip" hidden></div>
  </div>`;

  let host, $;
  const build = () => {
    host = document.createElement('div');
    host.setAttribute('data-alp', '');
    const sr = host.attachShadow({ mode: 'closed' });
    sr.innerHTML = `<style>${CSS}</style>${HTML()}`;
    $ = (s) => sr.querySelector(s);
    document.documentElement.appendChild(host);

    // posição (arrastável, lembrada)
    const wrap = $('.wrap');
    const place = () => {
      const { x, y } = state.ui;
      if (x == null || y == null) { wrap.style.right = '20px'; wrap.style.bottom = '20px'; wrap.style.left = wrap.style.top = ''; return; }
      const w = wrap.offsetWidth || 56, h = wrap.offsetHeight || 56;
      wrap.style.left = Math.min(Math.max(8, x), innerWidth - w - 8) + 'px';
      wrap.style.top = Math.min(Math.max(8, y), innerHeight - h - 8) + 'px';
      wrap.style.right = wrap.style.bottom = '';
    };
    const drag = (handle) => {
      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const r = wrap.getBoundingClientRect();
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        let moved = false;
        const mv = (ev) => {
          moved = true;
          state.ui.x = ev.clientX - dx; state.ui.y = ev.clientY - dy;
          place();
        };
        const up = () => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          if (moved) saveUi({ x: state.ui.x, y: state.ui.y });
          handle.__moved = moved;
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    };
    drag($('.head'));
    drag($('.fab'));

    // balão de ajuda: um só, posicionado junto do "i" (cabe na tela, vira para cima se faltar espaço)
    const tip = $('.tip');
    let tipFor = null;
    const showTip = (btn) => {
      tipFor = btn;
      tip.textContent = T(btn.dataset.help);
      tip.hidden = false;
      const r = btn.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), innerWidth - tw - 8);
      const below = r.bottom + 10 + th < innerHeight - 8;
      tip.style.left = left + 'px';
      tip.style.top = (below ? r.bottom + 10 : r.top - th - 10) + 'px';
      tip.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px');
      tip.className = 'tip show ' + (below ? 'below' : 'above');
      btn.classList.add('on');
    };
    const hideTip = () => { tip.className = 'tip'; tip.hidden = true; tipFor?.classList.remove('on'); tipFor = null; };
    for (const b of wrap.querySelectorAll('.info')) {
      b.addEventListener('pointerenter', () => showTip(b));
      b.addEventListener('pointerleave', hideTip);
      b.addEventListener('focus', () => showTip(b));
      b.addEventListener('blur', hideTip);
      // toque/clique: alterna (e não abre/fecha o <details> do log nem dispara o label)
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showTip(b); });
    }
    $('.panel').addEventListener('scroll', hideTip, { passive: true });

    // idioma: as bandeiras trocam na hora (e a ponte guarda a escolha para o popup e as próximas páginas)
    for (const f of wrap.querySelectorAll('.flag')) {
      f.addEventListener('click', () => {
        if (I18N.setLang?.(f.dataset.lang)) {
          document.dispatchEvent(new CustomEvent('alp:out', { detail: { type: 'saveLang', data: f.dataset.lang } }));
        }
      });
    }
    I18N.onChange?.(() => { hideTip(); applyTexts(); });

    // tamanho: redimensionável pelo canto, lembrado entre páginas
    const panel = $('.panel');
    if (state.ui.w) panel.style.width = state.ui.w + 'px';
    if (state.ui.h) panel.style.height = state.ui.h + 'px';
    let sizeT = 0;
    new ResizeObserver(() => {
      if (panel.hidden || !panel.style.width && !panel.style.height && !panel.__userResized) return;
      clearTimeout(sizeT);
      sizeT = setTimeout(() => { saveUi({ w: panel.offsetWidth, h: panel.offsetHeight }); place(); }, 300);
    }).observe(panel);
    // o redimensionamento nativo grava width/height inline; marca como ajuste do usuário
    panel.addEventListener('pointerdown', (e) => {
      const r = panel.getBoundingClientRect();
      if (e.clientX > r.right - 20 && e.clientY > r.bottom - 20) {
        panel.__userResized = true;
        // ancorado no canto inferior direito o painel cresceria "para trás": fixa no topo/esquerda
        if (state.ui.x == null) {
          const wr = wrap.getBoundingClientRect();
          state.ui.x = wr.left; state.ui.y = wr.top; saveUi({ x: wr.left, y: wr.top }); place();
        }
      }
    });
    addEventListener('resize', place);

    const setOpen = (open) => {
      state.ui.open = open;
      saveUi({ open });
      $('.panel').hidden = !open;
      $('.fab').hidden = open;
      requestAnimationFrame(place);
    };
    $('.fab').addEventListener('click', () => { if (!$('.fab').__moved) setOpen(true); $('.fab').__moved = false; });
    $('[data-a="close"]').addEventListener('click', () => setOpen(false));
    $('[data-a="reload"]').addEventListener('click', () => location.reload());
    const toBridge = (type, data) => document.dispatchEvent(new CustomEvent('alp:out', { detail: { type, data } }));
    $('[data-a="updCheck"]').addEventListener('click', () => { state.updStatus = 'checking'; render(); toBridge('updCheck'); });
    $('[data-a="updApply"]').addEventListener('click', () => { state.updStatus = 'applying'; render(); toBridge('updApply'); });
    $('[data-a="updLater"]').addEventListener('click', () => { state.upd.dismissed = state.upd.latest; state.updStatus = null; render(); toBridge('updDismiss', state.upd.latest); });
    // relatar bug: monta o relatório, abre o GitHub já preenchido ou copia
    const bugCard = $('.bug'), bugWhat = $('[data-s="bugWhat"]');
    const fillDiag = () => { $('[data-s="bugDiag"]').textContent = bugReport('').diag; };
    $('[data-a="bugOpen"]').addEventListener('click', () => { bugCard.hidden = !bugCard.hidden; if (!bugCard.hidden) { fillDiag(); bugWhat.focus(); $('.panel').scrollTop = 0; } });
    $('[data-a="bugClose"]').addEventListener('click', () => { bugCard.hidden = true; });
    // as teclas digitadas no campo não podem virar atalho do Midas/Duolingo
    bugWhat.addEventListener('keydown', (e) => e.stopPropagation());
    $('[data-a="bugGh"]').addEventListener('click', () => { window.open(bugUrl(bugWhat.value), '_blank', 'noopener'); });
    $('[data-a="bugCopy"]').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const r = bugReport(bugWhat.value, 200);
      const text = `Midas — bug report\n\n${r.what || '-'}\n\n${r.diag}`;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch {} ta.remove();
      }
      b.textContent = T(ok ? 'bug.copied' : 'log.failed'); setTimeout(() => (b.textContent = T('bug.copy')), 1600);
    });
    $('[data-a="updGuide"]').addEventListener('click', () => toBridge('openGuide', '#atualizar'));
    $('[data-a="updSeen"]').addEventListener('click', () => { state.upd.justUpdated = null; render(); toBridge('updDismiss', state.upd.dismissed ?? null); });
    $('.upd-st').addEventListener('click', () => { if (!state.upd.available) return; state.upd.dismissed = null; render(); toBridge('updDismiss', null); });
    $('[data-a="theme"]').addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      document.dispatchEvent(new CustomEvent('alp:out', { detail: { type: 'saveTheme', data: next } }));
    });
    addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); e.stopImmediatePropagation(); setOpen(!state.ui.open); }
    }, true);

    // ações
    $('[data-a="grind"]').addEventListener('click', () => {
      const c = API()?.commands;
      if (!c) return;
      if (state.running === 'grind') c.stop(); else c.grind({});
    });
    for (const a of ['solveNext', 'solve', 'lesson', 'skip']) {
      $(`[data-a="${a}"]`).addEventListener('click', () => API()?.commands?.[a]?.());
    }
    $('[data-a="copy"]').addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation(); // não abre/fecha o <details>
      const b = e.currentTarget; // currentTarget vira null depois do await
      const text = state.logs.map((l) => `${new Date(l.t).toLocaleTimeString(I18N.locale)} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${l.msg}`).join('\n');
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch {} ta.remove();
      }
      b.textContent = T(ok ? 'log.copied' : 'log.failed'); setTimeout(() => (b.textContent = T('log.copy')), 1500);
    });
    const det = $('details[data-a="log"]');
    det.open = !!state.ui.logOpen;
    det.addEventListener('toggle', () => saveUi({ logOpen: det.open }));

    // ajustes → núcleo + storage (via ponte)
    const delay = $('[data-c="delay"]'), human = $('[data-c="humanize"]');
    const pushCfg = (preset = 'manual') => {
      const cfg = { delay: +delay.value, humanize: human.checked, preset };
      API()?.commands?.config?.(cfg);
      document.dispatchEvent(new CustomEvent('alp:out', { detail: { type: 'saveConfig', data: cfg } }));
    };
    delay.addEventListener('input', () => { $('[data-s="delay"]').textContent = `${delay.value} ms`; });
    delay.addEventListener('change', () => pushCfg('manual'));
    human.addEventListener('change', () => pushCfg('manual'));
    for (const b of [...panel.querySelectorAll('.seg button')]) {
      b.addEventListener('click', () => {
        const p = PRESETS[b.dataset.p];
        if (p.delay != null) { delay.value = p.delay; human.checked = p.humanize; }
        pushCfg(b.dataset.p);
        render();
      });
    }

    setOpen(state.ui.open);
    render();
  };

  // ───────── tema claro/escuro ─────────
  const ICON_MOON = '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a.6.6 0 0 0-.8-.7A9.5 9.5 0 1 0 21.2 15.4a.6.6 0 0 0-.7-.8z"/></svg>';
  const ICON_SUN = '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.8"/><g stroke-width="2.4" stroke-linecap="round"><path d="M12 1.6v2.8M12 19.6v2.8M1.6 12h2.8M19.6 12h2.8M4.6 4.6l2 2M17.4 17.4l2 2M4.6 19.4l2-2M17.4 6.6l2-2"/></g></svg>';
  // trilho: sol à esquerda e lua à direita (apagados); a bolinha mostra o modo atual
  const THEME_SWITCH = ICON_SUN.replace('class="sun"', 'class="ic sun"') + ICON_MOON.replace('class="moon"', 'class="ic moon"') +
    `<span class="knob">${ICON_SUN}${ICON_MOON}</span>`;
  // sem escolha: o tema do próprio Duolingo (pela cor de fundo do site)
  const siteTheme = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-snow').split(',').map(Number);
    if (v.length < 3 || v.some(isNaN)) return 'dark';
    return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2] > 128 ? 'light' : 'dark';
  };
  const effectiveTheme = () => state.ui.theme || siteTheme();
  const paintTheme = () => {
    if (!$) return;
    $('.wrap').dataset.theme = effectiveTheme(); // sem escolha: o tema atual do site
    const btn = $('[data-a="theme"]');
    const dark = effectiveTheme() === 'dark';
    btn.setAttribute('aria-checked', String(dark)); // ligado = escuro
    btn.title = T(dark ? 'theme.toLight' : 'theme.toDark');
    btn.setAttribute('aria-label', btn.title);
  };
  const setTheme = (t) => {
    if (t !== 'dark' && t !== 'light') return;
    state.ui.theme = t; saveUi({ theme: t }); paintTheme();
  };

  // reaplica os textos fixos no idioma atual (os dinâmicos saem do render)
  const applyTexts = () => {
    if (!$) return;
    const root = $('.wrap');
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = T(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = T(el.dataset.i18nTitle);
    for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', T(el.dataset.i18nAria));
    for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = T(el.dataset.i18nPh);
    const copy = $('[data-a="copy"]'); if (copy) copy.textContent = T('log.copy');
    render();
  };

  const render = () => {
    if (!$) return;
    const r = state.running;
    const chip = $('.chip');
    chip.textContent = T(r === 'grind' ? 'chip.running' : r === 'lesson' ? 'chip.lesson' : 'chip.stopped');
    chip.className = 'chip ' + (r || '');
    $('.fab').classList.toggle('on', !!r);
    const g = $('[data-a="grind"]');
    g.textContent = T(r === 'grind' ? 'btn.stop' : 'btn.start');
    g.className = 'btn ' + (r === 'grind' ? 'red' : 'gold');

    const p = state.progress;
    if (p) {
      // v0.7: números do curso inteiro (vale também para curso zerado)
      const total = p.eligibleTotal ?? ((p.legendary || 0) + (p.todo || 0) + (p.active || 0) + (p.locked || 0));
      const done = p.eligibleDone ?? (p.legendary || 0);
      const left = p.remaining ?? Math.max(0, total - done);
      $('.bar i').style.width = total ? `${(100 * done) / total}%` : '0';
      $('[data-s="leg"]').textContent = nf(done);
      $('[data-s="todo"]').textContent = nf(left);
      $('[data-s="eta"]').textContent = fmtDur(p.etaMs);
      const note = $('.note');
      const bits = [];
      if (p.blocked) bits.push(T('note.blocked', { n: nf(p.blocked) }));
      if (p.skipped) bits.push(T('note.skipped', { n: nf(p.skipped) }));
      note.textContent = bits.join(' · ');
      note.hidden = !bits.length;
      const c = p.current;
      $('.now').innerHTML = c
        ? `${r === 'grind' ? '' : esc(T('now.next')) + ' '}<b>${esc(T(c.mode === 'normal' ? 'mode.lesson' : 'mode.legendary'))}</b> · ${esc(T('now.where', { u: c.u + 1, n: c.li + 1 }))} · ${esc(typeName(c.type))} · ${esc(c.name || '')}`
        : esc(T(r === 'grind' ? 'now.reading' : 'now.none'));
    }
    const cfg = API()?.cfg;
    if (cfg) {
      const d = $('[data-c="delay"]'), h = $('[data-c="humanize"]');
      if (document.activeElement !== host) { d.value = cfg.delay; h.checked = !!cfg.humanize; }
      $('[data-s="delay"]').textContent = `${d.value} ms`;
      const pr = presetOf(cfg);
      for (const b of $('.panel').querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.p === pr);
      $('[data-s="hint"]').textContent = T('preset.' + pr);
    }
    // v0.14.4: o <pre> do relatório de bug (v0.14.0) vinha antes e "$('pre')" pegava ele — o log sumia
    const pre = $('details[data-a="log"] pre');
    pre.innerHTML = state.logs.slice(-200).map((l) =>
      `<span class="lv-${l.level}">${new Date(l.t).toLocaleTimeString(I18N.locale)} ${esc(l.msg)}</span>`).join('\n') || esc(T('log.empty'));
    pre.scrollTop = pre.scrollHeight;
    paintTheme();
    $('.stale').hidden = !state.stale;
    for (const f of $('.wrap').querySelectorAll('.flag')) f.classList.toggle('on', f.dataset.lang === I18N.lang);
    $('[data-s="ver"]').textContent = state.version ? '· v' + state.version : '';
    $('.unk').textContent = state.unknown.size ? T('unk', { list: [...state.unknown].join(', ') }) : '';
    renderUpd();
  };

  // ───────── relatório de bug (v0.14.0) ─────────
  // Só o que ajuda a corrigir: versão, navegador, onde o grind estava e o fim do log.
  // Nada da conta (sem usuário, e-mail, token ou cookie).
  const GH_NEW = 'https://github.com/DredsGG/midas/issues/new';
  const bugReport = (what, maxLog = 80) => {
    const ua = navigator.userAgent;
    const chrome = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?';
    const os = /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '?';
    const p = state.progress, c = p?.current, cfg = API()?.cfg || {};
    let ch = '-', st = '-';
    try { st = API()?.getStatus?.() || '-'; ch = API()?.getChallenge?.()?.ch?.type || '-'; } catch { /* ok */ }
    const meta = [
      `Midas: v${state.version || '?'} (${state.upd?.installType || '?'})`,
      `Browser: Chrome ${chrome} · ${os} · UI ${I18N.lang} · ${navigator.language}`,
      `Grind: ${state.running || 'stopped'} · ${cfg.preset || '?'} ${cfg.delay ?? '?'} ms${cfg.humanize ? ' · humanized' : ''}`,
      c ? `Now: unit ${c.u + 1}, node ${c.li + 1} · ${c.type} · ${c.name || ''} · ${c.mode}` : '',
      p ? `Path: ${p.eligibleDone ?? '?'}/${p.eligibleTotal ?? '?'} legendary · skipped ${p.skipped || 0}` : '',
      `Page: ${location.pathname} · status ${st} · challenge ${ch}`,
      state.unknown.size ? `New types: ${[...state.unknown].join(', ')}` : '',
    ].filter(Boolean).join('\n');
    const log = state.logs.slice(-maxLog).map((l) =>
      `${new Date(l.t).toLocaleTimeString('pt-BR')} ${l.level === 'info' ? '' : l.level.toUpperCase() + ' '}${l.msg}`);
    return { what: String(what || '').trim(), meta, log, diag: `${meta}\n\nLog:\n${log.join('\n')}` };
  };
  // relato pré-preenchido no GitHub; o log é cortado do começo até o endereço caber
  const bugUrl = (what) => {
    const r = bugReport(what);
    const title = '[Bug] ' + (r.what.split('\n')[0].slice(0, 70) || `v${state.version || '?'} ${state.progress?.current?.type || ''}`.trim());
    const make = (log, cut) => `${GH_NEW}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(
      `### ${T('bug.whatHead')}\n\n${r.what || '-'}\n\n### Diagnostics\n\n\`\`\`text\n${r.meta}\n\nLog${cut ? ' (' + T('bug.trimmed') + ')' : ''}:\n${log.join('\n')}\n\`\`\`\n`)}`;
    let log = r.log, url = make(log, false);
    while (url.length > 7500 && log.length > 5) { log = log.slice(Math.ceil(log.length / 5)); url = make(log, true); }
    return url;
  };

  // notas do Release (markdown simples) → até 6 itens curtos
  const noteItems = (md) => String(md || '').replace(/^\s*###\s*Install[\s\S]*?\n\s*\n\s*\n/i, '').split(/\r?\n/).map((l) => l.replace(/^\s*(#+|[-*+]|\d+\.)\s*/, '').replace(/[*_`]/g, '').trim())
    .filter((l) => l && !/^install\b/i.test(l) && !/^(download|open `chrome)/i.test(l))
    .flatMap((l) => (l.length > 160 ? l.split(/(?<=[.!?])\s+/) : [l])).filter(Boolean).slice(0, 6);
  const renderUpd = () => {
    const u = state.upd || {}, st = state.updStatus;
    const stat = typeof st === 'string' ? st : st?.status;
    const show = !!u.available && u.dismissed !== u.latest;
    $('.upd').hidden = !show;
    $('.fab').classList.toggle('upd', !!u.available);
    if (show) {
      $('.upd-v').innerHTML = `v${esc(u.current || state.version || '?')} → <i>v${esc(u.latest)}</i>`;
      const items = noteItems(u.notes);
      $('.upd-notes').innerHTML = items.map((x) => `<li>${esc(x)}</li>`).join('');
      $('.upd-notes').hidden = !items.length;
      const msg = $('.upd-msg');
      const m = stat === 'downloaded' ? T('upd.howUnpacked', { v: u.latest })
        : stat === 'applying' ? T('upd.applying')
        : st?.mode === 'store' && stat ? T('upd.storeWait')
        : stat === 'error' ? T('upd.error') : '';
      msg.textContent = m; msg.hidden = !m;
      $('[data-a="updApply"]').disabled = stat === 'applying';
    }
    const ju = u.justUpdated;
    const okBox = $('.updok');
    okBox.hidden = !(ju && Date.now() - ju.at < 30 * 60e3);
    if (!okBox.hidden) okBox.querySelector('span').textContent = T('upd.done', { from: ju.from || '?', to: ju.to });
    const b = $('[data-a="updCheck"]');
    b.classList.toggle('spin', stat === 'checking');
    const s = $('.upd-st');
    s.className = 'upd-st';
    if (stat === 'checking') s.textContent = T('upd.checking');
    else if (u.available) { s.textContent = T('upd.avail', { v: u.latest }); s.classList.add('new'); }
    else if (stat === 'error' || (stat === 'none' && u.error)) s.textContent = T('upd.error');
    else if (stat === 'none') s.textContent = T('upd.none');
    else s.textContent = '';
  };

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  document.addEventListener('alp:out', (e) => {
    const { type, data } = e.detail || {};
    switch (type) {
      case 'state': state.running = data?.running ?? null; break;
      case 'progress': state.progress = data; break;
      case 'log': state.logs.push(data); if (state.logs.length > 500) state.logs.shift(); break;
      case 'unknownType': state.unknown.add(data.type); break;
      case 'hydrate':
        if (data?.version) state.version = data.version;
        if (data?.progress && !state.progress) state.progress = data.progress;
        if (Array.isArray(data?.log) && !state.logs.length) state.logs = data.log.slice(-500);
        for (const k of Object.keys(data?.unknown || {})) state.unknown.add(k);
        break;
      case 'config': break; // render relê API().cfg
      case 'theme': setTheme(data); return;
      case 'stale': state.stale = true; break;
      case 'update': state.upd = { ...(data || {}) }; break;
      case 'updResult': state.updStatus = data || null; break;
      default: return;
    }
    schedule();
  });

  const start = () => (document.body ? build() : addEventListener('DOMContentLoaded', build, { once: true }));
  start();
})();
