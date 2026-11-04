// Midas — v0.19.8: sem o "Atualizar o site? As alterações podem não ser salvas" no meio do grind.
// Roda antes do Duolingo (document_start, MAIN) para que este seja o primeiro ouvinte de "beforeunload"
// da janela: com o grind ligado, corta os ouvintes do site e a recarga (atualização do Midas, vigia,
// espera de bloqueio) acontece sem diálogo. Antes o diálogo ficava aberto e o grind parava até alguém
// clicar. Fora do grind (lição manual, grind parado) o aviso do Duolingo continua normal.
(() => {
  const k = Symbol.for('alp.noUnloadPrompt');
  if (window[Symbol.for('alp.unloadGuard')]) return;
  window[Symbol.for('alp.unloadGuard')] = true;
  window.addEventListener('beforeunload', (e) => {
    let quiet = false;
    try { quiet = !!window[k]?.(); } catch { /* sem o main.js: deixa o site decidir */ }
    if (quiet) e.stopImmediatePropagation();
  }, true);
})();
