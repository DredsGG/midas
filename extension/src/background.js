// Midas — service worker: só o badge do ícone.
// Atualização: manual. A IA grava a versão nova em autolingo-plus\instalada\ e André clica
// no ↻ do card em chrome://extensions (decisão dele em 2026-10-20, vale para todas as extensões).
const paint = async () => {
  const { alp_running } = await chrome.storage.local.get('alp_running');
  const text = alp_running === 'grind' ? 'AUTO' : alp_running === 'lesson' ? 'ON' : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: alp_running === 'grind' ? '#e0a800' : '#58cc02' });
};
chrome.storage.onChanged.addListener((changes) => { if (changes.alp_running) paint(); });
chrome.runtime.onStartup.addListener(paint);
chrome.runtime.onInstalled.addListener(async (d) => {
  paint();
  // Depois do ↻ (reason "update"), as abas do Duolingo abertas ainda rodam os scripts da versão
  // antiga, já sem conexão com a extensão. Recarregar a aba põe a versão nova; o Auto Grind
  // retoma sozinho (alp_grind.active fica salvo).
  if (d.reason !== 'update') return;
  const tabs = await chrome.tabs.query({ url: 'https://www.duolingo.com/*' });
  for (const t of tabs) chrome.tabs.reload(t.id);
});
