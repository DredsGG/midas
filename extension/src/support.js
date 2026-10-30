// Midas — quadro "Apoiar ♥" (v0.19.5, regra 16 do hub). Doação opcional: nunca abre sozinho, não
// trava nada e não muda recurso de ninguém. Usado pela HUD (mundo MAIN, dentro do shadow DOM) e pelo
// popup. Sem rede, sem rastreio: o código Pix (BR Code estático) e o QR são gerados aqui mesmo.
// Dados fixos de 02-projetos/extensoes/apoio.md do vault (não inventar outros).
(() => {
  'use strict';
  const KEY = Symbol.for('alp.support');
  if (globalThis[KEY]) return;

  const PIX = Object.freeze({ key: 'fa525dad-afca-4683-845d-eee7225a53e3', name: 'Andre Miller Fleck', city: 'Sao Paulo' });
  const SPONSORS = 'https://github.com/sponsors/DredsGG';
  // o Windows não desenha bandeiras em emoji (🇧🇷 vira "BR"): a bandeira é um SVG simples
  const FLAG_BR = '<svg class="sp-flag" viewBox="0 0 20 14" width="30" height="21"><rect width="20" height="14" rx="2" fill="#009c3b"/><path d="M10 1.6 18.4 7 10 12.4 1.6 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.2" fill="#002776"/></svg>';
  const AMOUNTS = [5, 10, 25];
  const MIN = 1, MAX = 10000;

  // ── BR Code (Pix estático): TLV + CRC16-CCITT-FALSE (poly 0x1021, início 0xFFFF) ──
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const crc16 = (s) => {
    let c = 0xffff;
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
    }
    return c.toString(16).toUpperCase().padStart(4, '0');
  };
  // amount: número em reais (ou null = valor livre, a pessoa digita no banco)
  const brCode = (amount) => {
    let s = tlv('00', '01')
      + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', PIX.key))
      + tlv('52', '0000') + tlv('53', '986')
      + (amount != null ? tlv('54', Number(amount).toFixed(2)) : '')
      + tlv('58', 'BR') + tlv('59', PIX.name) + tlv('60', PIX.city)
      + tlv('62', tlv('05', '***'))
      + '6304';
    return s + crc16(s);
  };
  // "12,50" / "12.50" / "R$ 1.234,56" → número; '' → null (livre); fora de 1..10.000 ou lixo → NaN
  const parseAmount = (txt) => {
    let t = String(txt ?? '').replace(/R\$|\s/gi, '');
    if (!t) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    const n = Math.round(parseFloat(t) * 100) / 100;
    return n >= MIN && n <= MAX ? n : NaN;
  };

  // ── QR (biblioteca local qrcode-generator, correção M) → SVG com fundo e borda brancos ──
  const qrSvg = (data, alt) => {
    const qr = globalThis[Symbol.for('alp.qr')];
    if (!qr) return '';
    const q = qr(0, 'M');
    q.addData(data, 'Byte');
    q.make();
    const n = q.getModuleCount(), m = 4, size = n + m * 2;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
    return `<svg class="sp-qrsvg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(alt)}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><title>${esc(alt)}</title><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brl = (n, locale) => {
    try { return new Intl.NumberFormat(locale || 'pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
    catch { return 'R$ ' + n; }
  };

  // cores vêm de quem chama (--ob-*), as mesmas do quadro de novidades/tutorial
  const CSS = `
  .sp-back { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
    padding: 14px; background: rgba(0,0,0,.45); pointer-events: auto; }
  .sp-back.fixed { position: fixed; }
  .sp-card { width: 100%; max-width: 372px; max-height: calc(100% - 8px); overflow: auto; background: var(--ob-card, #1b2b33);
    color: var(--ob-text, #f1f7fb); border: 2px solid var(--ob-line, #37464f); border-bottom-width: 4px; border-radius: 16px;
    padding: 14px 16px 14px; box-shadow: 0 16px 48px rgba(0,0,0,.38); font: inherit; animation: sp-in .16s ease-out; }
  @keyframes sp-in { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
  .sp-h { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
  .sp-h b { flex: 1; min-width: 0; font-size: 16px; line-height: 1.25; color: var(--ob-gold, #ffc800); }
  .sp-h b i { font-style: normal; color: #ff4b6e; }
  .sp-x { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 2px solid var(--ob-line, #37464f);
    background: transparent; color: var(--ob-text, #f1f7fb); font: 700 13px/1 system-ui, sans-serif; cursor: pointer; }
  .sp-q { margin: 0 0 10px; font-size: 14px; font-weight: 800; }
  .sp-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sp-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px 12px 11px; text-align: left;
    border: 2px solid var(--ob-line, #37464f); border-bottom-width: 4px; border-radius: 14px; background: transparent;
    color: var(--ob-text, #f1f7fb); font: inherit; cursor: pointer; min-height: 104px; }
  .sp-opt .sp-fl { font-size: 26px; line-height: 1; }
  .sp-flag { display: block; width: 30px; height: 21px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(255,255,255,.15); margin: 2px 0 3px; }
  .sp-opt b { font-size: 14px; }
  .sp-opt small { font-size: 12px; line-height: 1.35; color: var(--ob-muted, #8fa3ad); font-weight: 600; }
  .sp-opt.hl { border-color: var(--ob-gold-dark, #e5a800); background: color-mix(in srgb, var(--ob-gold, #ffc800) 12%, transparent); }
  .sp-opt:hover { border-color: var(--ob-gold, #ffc800); }
  .sp-note { margin: 12px 0 0; font-size: 12px; line-height: 1.4; color: var(--ob-muted, #8fa3ad); text-align: center; }
  .sp-amts { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .sp-amt { flex: 1 1 auto; border: 2px solid var(--ob-line, #37464f); border-bottom-width: 3px; border-radius: 10px; padding: 6px 8px;
    background: transparent; color: var(--ob-text, #f1f7fb); font: inherit; font-weight: 800; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .sp-amt.on { background: var(--ob-gold, #ffc800); border-color: var(--ob-gold-dark, #e5a800); color: var(--ob-gold-ink, #3d2f00); }
  .sp-other { display: flex; align-items: center; gap: 6px; margin: -2px 0 10px; }
  .sp-other span { font-weight: 800; font-size: 13px; }
  .sp-other input { flex: 1; min-width: 0; border: 2px solid var(--ob-line, #37464f); border-radius: 10px; padding: 6px 8px; font: inherit;
    font-size: 14px; background: transparent; color: var(--ob-text, #f1f7fb); }
  .sp-other input:focus { outline: none; border-color: var(--ob-gold, #ffc800); }
  .sp-err { margin: -4px 0 8px; font-size: 12px; font-weight: 700; color: #ff6b6b; }
  .sp-qr { display: grid; place-items: center; margin: 0 auto 6px; width: 212px; max-width: 100%; padding: 0; background: #fff;
    border-radius: 12px; border: 6px solid #fff; box-sizing: border-box; }
  .sp-qrsvg { display: block; width: 100%; height: auto; }
  .sp-val { text-align: center; margin: 0 0 10px; font-size: 13px; font-weight: 800; }
  .sp-row { display: flex; gap: 8px; align-items: center; }
  .sp-btn { border: 2px solid var(--ob-line, #37464f); border-bottom-width: 4px; border-radius: 12px; padding: 8px 14px;
    background: transparent; color: var(--ob-text, #f1f7fb); font: inherit; font-weight: 800; font-size: 13px; cursor: pointer; }
  .sp-btn.gold { background: var(--ob-gold, #ffc800); border-color: var(--ob-gold-dark, #e5a800); color: var(--ob-gold-ink, #3d2f00); }
  .sp-btn.wide { width: 100%; }
  .sp-btn.link { border: 0; padding: 6px 2px; color: var(--ob-muted, #8fa3ad); font-weight: 700; }
  .sp-key { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 8px; border-radius: 10px;
    border: 1px dashed var(--ob-line, #37464f); font-size: 11.5px; }
  .sp-key code { flex: 1; min-width: 0; overflow-wrap: anywhere; font: 600 11.5px/1.3 ui-monospace, Consolas, monospace; }
  .sp-key .sp-btn { padding: 3px 9px; border-bottom-width: 3px; font-size: 11.5px; }
  .sp-ok { min-height: 16px; margin: 6px 0 0; text-align: center; font-size: 12px; font-weight: 800; color: #58cc02; }
  .sp-how { margin: 8px 0 0; font-size: 12px; line-height: 1.45; color: var(--ob-muted, #8fa3ad); }
  .sp-p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.45; }
  .sp-f { display: flex; align-items: center; margin-top: 10px; }
  .sp-btn:focus-visible, .sp-x:focus-visible, .sp-opt:focus-visible, .sp-amt:focus-visible { outline: 2px solid var(--ob-gold, #ffc800); outline-offset: 2px; }
  `;

  let cur = null; // { el, opts, step, amount, other, err, ok }

  const injectCss = (styleRoot) => {
    const host = styleRoot.head || styleRoot;
    if (host.querySelector?.('style[data-sp]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-sp', '');
    st.textContent = CSS;
    host.appendChild(st);
  };

  const code = () => brCode(cur.amount === 'other' ? (Number.isFinite(cur.other) ? cur.other : null) : cur.amount);
  const isFree = () => cur.amount === 'other' && !Number.isFinite(cur.other);
  const amountLabel = () => {
    const { T, locale } = cur.opts;
    const v = cur.amount === 'other' ? (Number.isFinite(cur.other) ? cur.other : null) : cur.amount;
    return v == null ? T('sup.free') : brl(v, locale);
  };

  const render = () => {
    if (!cur) return;
    const { T, project, lang } = cur.opts;
    const head = `<div class="sp-h"><b>${esc(T('sup.title'))} <i>♥</i></b><button class="sp-x" type="button" data-sp="x" aria-label="${esc(T('sup.close'))}">✕</button></div>`;
    let body;
    if (cur.step === 'br') {
      const amts = AMOUNTS.map((v) => `<button class="sp-amt${cur.amount === v ? ' on' : ''}" type="button" data-sp="amt" data-v="${v}" aria-pressed="${cur.amount === v}">${esc(brl(v, cur.opts.locale))}</button>`).join('');
      const other = cur.amount === 'other';
      const label = amountLabel();
      body = `<p class="sp-q">${esc(T('sup.br.title'))}</p>
        <div class="sp-amts">${amts}<button class="sp-amt${other ? ' on' : ''}" type="button" data-sp="amt" data-v="other" aria-pressed="${other}">${esc(T('sup.other'))}</button></div>
        ${other ? `<label class="sp-other"><span>R$</span><input type="text" inputmode="decimal" data-sp="otherIn" placeholder="${esc(T('sup.otherPh'))}" aria-label="${esc(T('sup.otherAria'))}" value="${esc(cur.otherTxt || '')}"></label>` : ''}
        ${cur.err ? `<p class="sp-err" role="alert">${esc(T('sup.err'))}</p>` : ''}
        <div class="sp-qr">${qrSvg(code(), isFree() ? T('sup.qrAltFree') : T('sup.qrAlt', { v: label }))}</div>
        <p class="sp-val">${esc(label)}</p>
        <button class="sp-btn gold wide" type="button" data-sp="copyCode">${esc(T('sup.copyCode'))}</button>
        <div class="sp-key"><span>${esc(T('sup.key'))}</span><code>${esc(PIX.key)}</code><button class="sp-btn" type="button" data-sp="copyKey">${esc(T('sup.copy'))}</button></div>
        <p class="sp-ok" aria-live="polite">${cur.ok ? esc(T('sup.copied')) : ''}</p>
        <p class="sp-how">${esc(T('sup.how', { name: PIX.name }))}</p>
        <div class="sp-f"><button class="sp-btn link" type="button" data-sp="back">← ${esc(T('sup.back'))}</button></div>`;
    } else if (cur.step === 'world') {
      body = `<p class="sp-q">${esc(T('sup.world.title'))}</p>
        <p class="sp-p">${esc(T('sup.world.text'))}</p>
        <button class="sp-btn gold wide" type="button" data-sp="sponsors">${esc(T('sup.world.btn'))} ↗</button>
        <div class="sp-f"><button class="sp-btn link" type="button" data-sp="back">← ${esc(T('sup.back'))}</button></div>`;
    } else {
      const brFirst = lang === 'pt';
      body = `<p class="sp-q">${esc(T('sup.where'))}</p>
        <div class="sp-opts">
          <button class="sp-opt${brFirst ? ' hl' : ''}" type="button" data-sp="br"><span class="sp-fl" aria-hidden="true">${FLAG_BR}</span><b>${esc(T('sup.br'))}</b><small>${esc(T('sup.br.sub'))}</small></button>
          <button class="sp-opt${brFirst ? '' : ' hl'}" type="button" data-sp="world"><span class="sp-fl" aria-hidden="true">🌎</span><b>${esc(T('sup.world'))}</b><small>${esc(T('sup.world.sub'))}</small></button>
        </div>
        <p class="sp-note">${esc(T('sup.note', { p: project || 'Midas' }))}</p>`;
    }
    const active = cur.el.getRootNode().activeElement;
    const focusSel = active?.getAttribute?.('data-sp');
    const focusV = active?.getAttribute?.('data-v');
    cur.el.innerHTML = `<div class="sp-card" role="dialog" aria-modal="true" aria-label="${esc(T('sup.title'))}">${head}${body}</div>`;
    // foco: mantém no mesmo controle depois de redesenhar; senão vai para o primeiro botão útil
    const again = focusSel && cur.el.querySelector(`[data-sp="${focusSel}"]${focusV ? `[data-v="${focusV}"]` : ''}`);
    const first = ['.sp-opt.hl', '.sp-amt.on', '.sp-btn.gold', '.sp-x'].map((q) => cur.el.querySelector(q)).find(Boolean);
    (again || first)?.focus({ preventScroll: true });
    if (focusSel === 'otherIn' && again) { const n = again.value.length; again.setSelectionRange?.(n, n); }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* sem permissão ou sem foco: alternativa */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  };

  const close = () => {
    if (!cur) return;
    const c = cur;
    cur = null;
    c.el.remove();
    removeEventListener('keydown', c.key, true);
    try { c.opts.returnFocus?.focus?.({ preventScroll: true }); } catch { /* ok */ }
  };

  const go = (step) => {
    cur.step = step; cur.ok = false; cur.err = false;
    try { cur.opts.onChoice?.(step === 'br' || step === 'world' ? step : null); } catch { /* ok */ }
    render();
  };

  // opts: { mountIn, styleRoot, fixed, T, lang, locale, project, last ('br'|'world'|null), onChoice(step), openUrl(url), returnFocus }
  const open = (opts) => {
    if (cur) close();
    injectCss(opts.styleRoot || document);
    const el = document.createElement('div');
    el.className = 'sp-back' + (opts.fixed ? ' fixed' : '');
    const key = (e) => {
      if (!cur) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        // foco preso no quadro enquanto ele estiver aberto
        const f = [...cur.el.querySelectorAll('button, input')].filter((x) => !x.disabled);
        if (!f.length) return;
        const a = cur.el.getRootNode().activeElement;
        const i = f.indexOf(a);
        e.preventDefault(); e.stopPropagation();
        const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
        f[n].focus();
      }
    };
    el.addEventListener('keydown', (e) => e.stopPropagation()); // atalhos do Midas/Duolingo não disparam com o quadro aberto
    el.addEventListener('click', async (e) => {
      if (!cur) return;
      if (e.target === el) { close(); return; } // clique fora do quadro fecha
      const b = e.target.closest?.('[data-sp]');
      const a = b?.getAttribute('data-sp');
      if (!a || a === 'otherIn') return;
      e.stopPropagation();
      if (a === 'x') close();
      else if (a === 'br' || a === 'world') go(a);
      else if (a === 'back') go(null);
      else if (a === 'amt') {
        const v = b.getAttribute('data-v');
        cur.amount = v === 'other' ? 'other' : Number(v);
        cur.ok = false; cur.err = false;
        render();
        if (v === 'other') cur.el.querySelector('[data-sp="otherIn"]')?.focus();
      } else if (a === 'copyCode' || a === 'copyKey') {
        if (cur.amount === 'other' && cur.err) return;
        cur.ok = await copy(a === 'copyKey' ? PIX.key : code());
        render();
        clearTimeout(cur.okT);
        cur.okT = setTimeout(() => { if (cur?.ok) { cur.ok = false; render(); } }, 2500);
      } else if (a === 'sponsors') {
        try { cur.opts.openUrl ? cur.opts.openUrl(SPONSORS) : window.open(SPONSORS, '_blank', 'noopener,noreferrer'); } catch { /* ok */ }
      }
    });
    el.addEventListener('input', (e) => {
      if (!cur || e.target.getAttribute?.('data-sp') !== 'otherIn') return;
      cur.otherTxt = e.target.value;
      const n = parseAmount(cur.otherTxt);
      cur.err = Number.isNaN(n);
      cur.other = cur.err ? null : n;
      cur.ok = false;
      render();
    });
    cur = { el, key, opts, step: opts.last === 'br' || opts.last === 'world' ? opts.last : null, amount: 10, other: null, otherTxt: '', err: false, ok: false };
    opts.mountIn.appendChild(el);
    addEventListener('keydown', key, true);
    render();
  };

  const api = Object.freeze({
    open, close, brCode, crc16, parseAmount, qrSvg, PIX, SPONSORS,
    get isOpen() { return !!cur; },
    get step() { return cur ? cur.step : null; },
    refresh: (patch) => { if (cur) { if (patch) cur.opts = { ...cur.opts, ...patch }; render(); } }, // troca de idioma com o quadro aberto
  });
  Object.defineProperty(globalThis, KEY, { value: api });
})();
