// Midas — tutorial de primeiro uso, quadro "Novidades da vX.Y.Z" (v0.15.0, regra 12) e quadro
// "Nova versão vX.Y.Z" (v0.16.0, regra 14: aparecem sozinhos no meio da página, sem abrir o painel).
// Usado pela HUD (mundo MAIN, dentro do shadow DOM) e pelo popup. Não guarda nada sozinho:
// quem chama diz o que já foi visto (alp_seen no storage.local) e recebe onClose para salvar.
// Os quadros não travam a automação: são só uma camada por cima do painel; fecham no X ou no Esc.
(() => {
  'use strict';
  const KEY = Symbol.for('alp.onboard');
  if (globalThis[KEY]) return;

  const STEPS = 5;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // cores vêm de quem chama (--ob-*), assim o quadro fica no visual da HUD ou do popup
  const CSS = `
  .ob-back { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    padding: 14px; background: rgba(0,0,0,.55); border-radius: inherit; }
  .ob-back.fixed { position: fixed; }
  /* v0.16.0: no meio da página do Duolingo, sem escurecer nem bloquear o site (só o quadro recebe clique) */
  .ob-back.page { position: absolute; background: transparent; pointer-events: none; padding: 16px; }
  /* v0.16.4: centralizado na largura, mas na parte de baixo da tela. No caminho o Duolingo põe o
     próximo nó bem no meio; o quadro no meio cobria justamente o nó que a pessoa ia clicar. */
  .ob-back.page { align-items: flex-end; padding-bottom: max(24px, 7vh); }
  .ob-back.page .ob-card { max-height: 36vh; }
  /* v0.17.0: versão URGENTE: no meio da tela, sem X, com a borda dourada (o grind fica pausado) */
  .ob-back.page.locked { align-items: center; padding-bottom: 16px; }
  .ob-back.page.locked .ob-card { max-height: 70vh; border-color: var(--ob-gold, #ffc800); }
  .ob-urgent { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: var(--ob-gold, #ffc800); } /* topo do quadro abaixo do meio da tela, onde fica o nó */
  .ob-back.page .ob-card { pointer-events: auto; max-width: 380px; box-shadow: 0 16px 48px rgba(0,0,0,.38); }
  .ob-ver { font-size: 12px; font-weight: 800; color: var(--ob-muted, #8fa3ad); font-variant-numeric: tabular-nums; }
  .ob-ver i { font-style: normal; color: var(--ob-gold, #ffc800); }
  .ob-msg { margin: 10px 0 0; font-size: 12.5px; line-height: 1.45; font-weight: 700; color: var(--ob-text, #f1f7fb); }
  .ob-card { width: 100%; max-width: 360px; max-height: 100%; overflow: auto; background: var(--ob-card, #1b2b33);
    color: var(--ob-text, #f1f7fb); border: 2px solid var(--ob-line, #37464f); border-bottom-width: 4px;
    border-radius: 16px; padding: 14px 16px 12px; box-shadow: 0 12px 32px rgba(0,0,0,.35);
    font: inherit; animation: ob-in .16s ease-out; }
  @keyframes ob-in { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
  .ob-h { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
  .ob-h .ob-t { flex: 1; min-width: 0; }
  .ob-h b { display: block; font-size: 16px; line-height: 1.25; color: var(--ob-gold, #ffc800); }
  .ob-h small { display: block; margin-top: 2px; font-size: 12px; color: var(--ob-muted, #8fa3ad); }
  .ob-x { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 2px solid var(--ob-line, #37464f);
    background: transparent; color: var(--ob-text, #f1f7fb); font: 700 13px/1 system-ui, sans-serif; cursor: pointer; }
  .ob-step h4 { margin: 4px 0 6px; font-size: 15px; }
  .ob-step p, .ob-news li { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--ob-text, #f1f7fb); }
  .ob-news { margin: 2px 0 0; padding-left: 18px; }
  .ob-news li + li { margin-top: 6px; }
  .ob-dots { display: flex; gap: 6px; justify-content: center; margin: 12px 0 10px; }
  .ob-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--ob-line, #37464f); }
  .ob-dots i.on { background: var(--ob-gold, #ffc800); }
  .ob-f { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
  .ob-f .ob-sp { flex: 1; }
  .ob-btn { border: 2px solid var(--ob-line, #37464f); border-bottom-width: 4px; border-radius: 12px; padding: 7px 14px;
    background: transparent; color: var(--ob-text, #f1f7fb); font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .ob-btn.gold { background: var(--ob-gold, #ffc800); border-color: var(--ob-gold-dark, #e5a800); color: var(--ob-gold-ink, #3d2f00); }
  .ob-btn.link { border: 0; padding: 7px 4px; color: var(--ob-muted, #8fa3ad); font-weight: 600; }
  .ob-btn:focus-visible, .ob-x:focus-visible { outline: 2px solid var(--ob-gold, #ffc800); outline-offset: 2px; }
  `;

  let cur = null; // { el, key, onClose, kind, step, opts }

  const injectCss = (styleRoot) => {
    const host = styleRoot.head || styleRoot;
    if (host.querySelector?.('style[data-ob]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-ob', '');
    st.textContent = CSS;
    host.appendChild(st);
  };

  const render = () => {
    if (!cur) return;
    const { T, version, items } = cur.opts;
    const x = `<button class="ob-x" type="button" data-ob="x" aria-label="✕">✕</button>`;
    if (cur.kind === 'update') {
      const { from, latest, msg, busy, locked } = cur.opts;
      cur.el.innerHTML = `<div class="ob-card" role="dialog" aria-label="${esc(T('upd.newTitle', { v: latest }))}">
        <div class="ob-h"><div class="ob-t"><b>${esc(T('upd.newTitle', { v: latest }))}</b><small class="ob-ver">v${esc(from || '?')} → <i>v${esc(latest)}</i></small></div>${locked ? '' : x}</div>
        ${locked ? `<p class="ob-urgent">${esc(T('upd.urgent'))}</p>` : ''}
        ${(items || []).length ? `<ul class="ob-news">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${msg ? `<p class="ob-msg">${esc(msg)}</p>` : ''}
        <div class="ob-f"><button class="ob-btn link" type="button" data-ob="guide">${esc(T('upd.guide'))}</button><span class="ob-sp"></span>
          <button class="ob-btn gold" type="button" data-ob="apply"${busy ? ' disabled' : ''}>${esc(T('upd.now'))}</button></div>
      </div>`;
    } else if (cur.kind === 'news') {
      cur.el.innerHTML = `<div class="ob-card" role="dialog" aria-label="${esc(T('news.title', { v: version }))}">
        <div class="ob-h"><div class="ob-t"><b>${esc(T('news.title', { v: version }))}</b></div>${x}</div>
        <ul class="ob-news">${(items || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        <div class="ob-f"><span class="ob-sp"></span><button class="ob-btn gold" type="button" data-ob="ok">${esc(T('news.ok'))}</button></div>
      </div>`;
    } else {
      const n = cur.step;
      cur.el.innerHTML = `<div class="ob-card" role="dialog" aria-label="${esc(T('tut.title'))}">
        <div class="ob-h"><div class="ob-t"><b>${esc(T('tut.title'))}</b><small>${esc(T('tut.step', { n, t: STEPS }))}</small></div>${x}</div>
        <div class="ob-step"><h4>${esc(T(`tut.s${n}.h`))}</h4><p>${esc(T(`tut.s${n}.b`))}</p></div>
        <div class="ob-dots">${Array.from({ length: STEPS }, (_, i) => `<i class="${i + 1 === n ? 'on' : ''}"></i>`).join('')}</div>
        <div class="ob-f">
          ${n < STEPS ? `<button class="ob-btn link" type="button" data-ob="skip">${esc(T('tut.skip'))}</button>` : ''}
          <span class="ob-sp"></span>
          ${n > 1 ? `<button class="ob-btn" type="button" data-ob="back">${esc(T('tut.back'))}</button>` : ''}
          ${n < STEPS
            ? `<button class="ob-btn gold" type="button" data-ob="next">${esc(T('tut.next'))}</button>`
            : `<button class="ob-btn gold" type="button" data-ob="ok">${esc(T('tut.ok'))}</button>`}
        </div>
      </div>`;
    }
    // no meio da página o foco não é roubado (a pessoa pode estar digitando numa lição)
    if (!cur.opts.page) cur.el.querySelector('.ob-btn.gold')?.focus({ preventScroll: true });
  };

  const close = () => {
    if (!cur) return;
    const c = cur;
    cur = null;
    c.el.remove();
    removeEventListener('keydown', c.key, true);
    try { c.opts.onClose?.(c.kind); } catch { /* ok */ }
  };

  // opts: { kind: 'tutorial'|'news'|'update', mountIn, styleRoot, fixed, page, T, version, items, onClose,
  //         from, latest, msg, busy, onApply, onGuide }
  const open = (opts) => {
    if (cur) { const prev = cur; cur = null; prev.el.remove(); removeEventListener('keydown', prev.key, true); }
    injectCss(opts.styleRoot || document);
    const el = document.createElement('div');
    el.className = 'ob-back' + (opts.fixed ? ' fixed' : '') + (opts.page ? ' page' : '') + (opts.locked ? ' locked' : '');
    // só o Esc de verdade (do teclado) fecha; o Midas não manda teclas, mas por garantia
    // v0.19.5: com o quadro "Apoiar ♥" aberto por cima, o Esc fecha só ele (antes fechava os dois)
    const key = (e) => { if (e.key === 'Escape' && globalThis[Symbol.for('alp.support')]?.isOpen) return;
      if (e.key === 'Escape' && e.isTrusted !== false && !cur?.opts?.locked) { e.preventDefault(); e.stopPropagation(); close(); } };
    el.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-ob]')?.getAttribute('data-ob');
      if (e.target === el) return; // clique fora do quadro não fecha (só X, Esc, Pular ou Entendi)
      if (!a || !cur) return;
      e.stopPropagation();
      if ((a === 'x' || a === 'skip' || a === 'ok') && !cur.opts.locked) close();
      else if (a === 'apply') cur.opts.onApply?.();
      else if (a === 'guide') cur.opts.onGuide?.();
      else if (a === 'next') { cur.step = Math.min(STEPS, cur.step + 1); render(); }
      else if (a === 'back') { cur.step = Math.max(1, cur.step - 1); render(); }
    });
    cur = { el, key, kind: opts.kind, step: 1, opts };
    opts.mountIn.appendChild(el);
    addEventListener('keydown', key, true);
    render();
  };

  // o que mostrar ao abrir: instalação nova → só o tutorial; versão nova → novidades (uma vez)
  const decide = (seen, version) => {
    if (!seen || !seen.tutorial) return 'tutorial';
    if (version && seen.news !== version) return 'news';
    return null;
  };
  const cmpVer = (a, b) => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  };
  // v0.16.0: quem pulou versões (ex.: 0.14.4 → 0.16.0) vê as novidades de todas, da mais nova para a mais velha
  const itemsFor = (version, lang, since) => {
    const all = globalThis[Symbol.for('alp.changelog')] || {};
    const book = all[lang] || all.en || all.pt || {};
    const vs = Object.keys(book).filter((v) => cmpVer(v, version) <= 0 && (since ? cmpVer(v, since) > 0 : v === version))
      .sort((a, b) => cmpVer(b, a));
    const out = vs.flatMap((v) => book[v] || []).slice(0, 8);
    return out.length ? out : null;
  };
  // o que gravar em alp_seen quando o quadro fecha
  const seenAfter = (kind, version, seen) => (kind === 'tutorial'
    ? { ...(seen || {}), tutorial: true, news: version }
    : { ...(seen || {}), tutorial: true, news: version });

  const api = Object.freeze({
    open, close, decide, itemsFor, seenAfter, cmpVer, STEPS,
    get isOpen() { return !!cur; },
    get kind() { return cur?.kind || null; },
    get locked() { return !!cur?.opts?.locked; },
    // troca dados do quadro aberto (ex.: mensagem depois do Atualizar) e redesenha
    set: (patch) => { if (cur) { cur.opts = { ...cur.opts, ...patch }; render(); } },
    refresh: render, // troca de idioma com o quadro aberto
  });
  Object.defineProperty(globalThis, KEY, { value: api });
})();
