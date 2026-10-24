// Midas — guia de instalação (COMO-INSTALAR.html). Funciona aberto direto do zip (file://)
// e de dentro da extensão (chrome-extension://, aí usa o idioma e a versão da extensão).
(() => {
  const LANGS = ['pt', 'en', 'es'];
  const TITLES = { pt: 'Midas · Como instalar', en: 'Midas · How to install', es: 'Midas · Cómo instalar' };
  const ext = typeof chrome !== 'undefined' && chrome.runtime?.id;
  const pick = (l) => (LANGS.includes(l) ? l : null);
  const set = (l) => {
    document.documentElement.lang = l === 'pt' ? 'pt-BR' : l;
    document.title = TITLES[l];
    for (const b of document.querySelectorAll('.flag')) b.classList.toggle('on', b.dataset.lang === l);
    try { localStorage.setItem('midas.guia.lang', l); } catch { /* ok */ }
  };
  let lang = null;
  try { lang = pick(localStorage.getItem('midas.guia.lang')); } catch { /* ok */ }
  lang = lang || pick((navigator.language || '').slice(0, 2).toLowerCase()) || 'en';
  set(lang);
  for (const b of document.querySelectorAll('.flag')) {
    b.addEventListener('click', () => {
      set(b.dataset.lang);
      if (ext) chrome.storage?.local.set({ alp_lang: b.dataset.lang }).catch(() => {});
    });
  }
  // versão: do manifest (dentro da extensão) ou a que o build carimbou no arquivo
  const ver = document.getElementById('ver');
  if (ext) {
    ver.textContent = '· v' + chrome.runtime.getManifest().version;
    chrome.storage?.local.get('alp_lang').then(({ alp_lang }) => { if (pick(alp_lang)) set(alp_lang); }).catch(() => {});
  } else if (ver.textContent.includes('{{')) ver.textContent = '';
})();
