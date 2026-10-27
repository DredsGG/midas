// Midas — novidades por versão (português). Atualizar a cada versão: frases curtas, do ponto de vista de quem usa.
// Aparece uma vez, no quadro "Novidades da vX.Y.Z", na primeira abertura depois da atualização.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.pt = {
    '0.16.2': [
      'A recarga por caminho desatualizado só acontece quando a aba mostra outro nó como ativo; com a aba em segundo plano o Midas abre a lição direto, sem perder tempo.',
    ],
    '0.16.1': [
      'Se o caminho na aba fica desatualizado (por exemplo, outra aba avançou o curso), o Midas recarrega a página em vez de ficar indo e voltando entre Praticar e Aprender.',
    ],
    '0.16.0': [
      'Aviso de versão nova, novidades e tutorial agora aparecem sozinhos no meio da página do Duolingo, sem abrir o painel.',
      'O aviso de versão nova mostra o que mudou no seu idioma e volta a cada abertura até você atualizar; o X esconde até a próxima versão.',
      'Os quadros não escurecem nem travam o site, não roubam o foco e esperam você sair de uma lição feita à mão.',
    ],
    '0.15.0': [
      'Agora o Midas funciona também no Edge, Brave, Opera GX e Firefox, além do Chrome.',
      'Tutorial de primeiro uso: dá para abrir de novo quando quiser pelo botão "?".',
      'Este quadro aparece uma vez depois de cada atualização, contando o que mudou.',
      'No Firefox, o Midas avisa se a permissão para o duolingo.com foi tirada e ajuda a liberar de novo.',
    ],
  };
})(globalThis);
