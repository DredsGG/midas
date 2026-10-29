// Midas — novidades por versão (português). Atualizar a cada versão: frases curtas, do ponto de vista de quem usa.
// Aparece uma vez, no quadro "Novidades da vX.Y.Z", na primeira abertura depois da atualização.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.pt = {
    '0.18.0': [
      'Curso novo: o Midas responde sozinho às perguntas de boas-vindas do Duolingo (nível mais baixo, começar do zero) e segue direto para o grind.',
    ],
    '0.17.3': [
      'A estimativa é medida sem parar no ritmo real da última 1 h 30, desce a cada segundo com o grind rodando e mostra o ritmo (passos por hora).',
    ],
    '0.17.1': [
      'A estimativa de tempo agora usa o ritmo real das últimas 3 horas (com recargas e falas travadas) e não pula mais de uma leitura para outra.',
    ],
    '0.17.0': [
      'Com o Duolingo aberto, o Midas procura versão nova sozinho: ao abrir, a cada 30 min e quando você volta para a aba.',
      'O aviso de versão nova aparece na hora, sem recarregar; o X só adia por 1 hora (ou até abrir o navegador de novo).',
      'Versão marcada como URGENTE: o aviso não fecha e o Midas fica pausado até você atualizar.',
    ],
    '0.16.4': [
      'Os quadros de novidades, versão nova e tutorial ficam centralizados na parte de baixo da tela, sem cobrir o próximo nó do caminho.',
    ],
    '0.16.3': [
      'A janela do Midas não fica mais cortada nem trava o redimensionamento quando o Duolingo responde com erro: o log quebra linhas longas.',
      'Erros do servidor do Duolingo aparecem no log com o endereço curto, sem o número da sua conta (e ele também não vai mais no Relatar bug).',
    ],
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
