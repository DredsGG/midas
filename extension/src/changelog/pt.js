// Midas — novidades por versão (português). Atualizar a cada versão: frases curtas, do ponto de vista de quem usa.
// Aparece uma vez, no quadro "Novidades da vX.Y.Z", na primeira abertura depois da atualização.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.pt = {
    '0.19.17': [
      "Exercícios de completar digitando (\"Complete a tradução\" e o de ouvir e completar): o Midas espera o Duolingo preparar a resposta antes de digitar. Digitar cedo demais fazia o Duolingo descartar todo texto daquele exercício; se isso já tiver acontecido, o Midas reconstrói a resposta.",
    ],
    '0.19.16': [
      "Quando uma lição de Titãs é abandonada num exercício de digitar, o log também mostra o diagnóstico curto do exercício (como já mostrava nas lições com \"Pular\"), sem a resposta.",
    ],
    '0.19.15': [
      "Exercícios de completar a tradução digitando: quando o campo não fica com o texto, o Midas tenta outros jeitos de digitar (inclusive como o navegador digita de verdade) antes de pular o exercício, e o log diz qual jeito funcionou.",
    ],
    '0.19.14': [
      "O \"Próximo\" no painel e no popup mostra a seção e a unidade como o Duolingo mostra (\"seção 4, unidade 49\").",
      "Com duas abas do Duolingo abertas, nenhuma linha do log se perde, e uma aba aberta depois não toma mais o grind da aba de trás.",
      "O Midas não clica mais em botões de outra extensão (como o painel do Duolingo PRO) e não fica preso numa leitura do Duolingo que não responde: desiste em 30 s e tenta de novo.",
      "\"Copiar\" do log não leva mais o número da conta.",
    ],
    '0.19.13': [
      "Exercícios de completar a tradução digitando (\"Complete a tradução\"): o Midas acha o campo da lacuna também nos formatos novos (campo sem tipo, campo editável).",
    ],
    '0.19.12': [
      "Quando uma lição ou história não abre, o log diz qual tela estava aberta (endereço, se a aba estava escondida e os elementos da tela, sem as palavras da resposta). Ajuda a achar sozinho o que mudou no Duolingo.",
    ],
    '0.19.11': [
      "Quando a página mostra um nó ativo diferente do que o caminho lido pelo Midas aponta, o grind abre o da página. Antes ele tentava o outro pelo endereço direto, o Duolingo dava erro 500 e o grind ficava horas em \"travado, esperando, recarregando\".",
      "Trocar de curso zera os nós pulados e o contador de travado do curso anterior.",
      "Se o grind travar 3 vezes seguidas sem avançar, o log e o painel dizem qual nó não abre e por quê.",
    ],
    '0.19.10': [
      'Trocar o preset de velocidade (Rage, Legit ou Manual) no popup ou no painel de outra aba agora vale na hora para a aba que roda o grind. Antes ela podia seguir no preset antigo por até 1 hora, até a próxima recarga.',
      'O Parar do popup agora para o grind mesmo quando outra aba do Duolingo está na frente.',
      'Configuração antiga, sem preset salvo, mostra no painel e no popup o preset que está valendo de verdade.',
      'O quadro "Nova versão" não pisca mais a cada 5 s enquanto está aberto.',
    ],
    '0.19.9': [
      'Quando o Duolingo cai (erro do servidor) ou a internet some, o Midas espera e confere de novo com intervalo crescente, em vez de recarregar a página em série, pular nó ou abandonar a lição; quando o site volta, ele retoma sozinho.',
      'A queda não entra na estimativa de tempo como ritmo ruim.',
    ],
    '0.19.8': [
      'Quando o Midas recarrega a página no meio de uma lição (atualização, vigia), o aviso "Atualizar o site?" não aparece mais e o grind não fica parado esperando clique.',
    ],
    '0.19.7': [
      'Exercícios de completar a frase digitando que vinham sem a palavra da lacuna agora são respondidos. Antes eram pulados, e nos Titãs a lição inteira era abandonada.',
    ],
    '0.19.6': [
      'Exercícios de digitar (como "Complete a tradução") não travam mais quando o exercício anterior ainda está saindo da tela.',
    ],
    '0.19.5': [
      'Novo botão Apoiar ♥ no rodapé, opcional: Pix (Brasil) ou GitHub Sponsors (outros países). Não muda nada no Midas.',
    ],
    '0.19.2': [
      'Exercícios de completar a frase digitando (ex.: "Complete a tradução") não travam mais a lição quando outra extensão do Duolingo está aberta junto.',
    ],
    '0.19.1': [
      'Depois de uma atualização, o grind volta na hora. Antes, a aba podia ficar até 4 min parada achando que outra aba ainda estava rodando.',
    ],
    '0.19.0': [
      'Se a aba do grind fechar, o navegador reiniciar ou o grind travar, o Midas volta a rodar sozinho em até 10 min, numa aba em segundo plano.',
      'Cada reinício fica no log com data, hora e motivo.',
      'Nova chave "Reiniciar sozinho se parar" (ligada de fábrica) no painel e no popup. Para parar de vez, use Parar.',
    ],
    '0.18.1': [
      'Apertar Iniciar duas vezes seguidas (ou no popup e na janela) não para mais o grind logo depois de começar.',
    ],
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
