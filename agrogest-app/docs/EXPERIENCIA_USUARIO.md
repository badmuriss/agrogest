# AgroGest — Experiência do Usuário, Navegação e Telas

## Fluxo acadêmico implementado · 10/11/2026

**Despesa → Escolher comprovante** abre diretamente o seletor de imagem. A captura é salva no SQLite antes da navegação/rede; `/novo/importar-despesa?id=<id-local>&analisar=1` abre a revisão e inicia a leitura. A rota também permite escolher outra foto ou reabrir uma captura. O botão web aciona um input persistente oculto, sem tela intermediária de escolha.

A revisão prioriza **valor, descrição e data**, com uma prévia compacta e **Trocar foto**. Imagem ampliada, fornecedor, número e opção de refazer a leitura ficam em **Ver imagem e detalhes**; o texto bruto, quando existir, tem sua própria expansão. Não há dump de tabela TSV nem lista repetida de avisos no fluxo principal. Campo obrigatório não identificado fica sinalizado e bloqueia a confirmação até preenchimento; dados opcionais não são inventados.

**Confirmar e preparar despesa** retorna a `/novo/despesa?importacao=<id-local>`, sem colocar texto/documento na URL. Categoria, fazenda, parcelas e rateio seguem conferência humana. Na preparação, os detalhes começam recolhidos, com o resumo de pagamento/rateio acessível no botão correspondente. Durante uma nova leitura, os campos ficam indisponíveis para evitar sobrescrever uma edição iniciada antes da resposta. A rota `/novo/nota-fiscal` encaminha para esse fluxo, sem resposta fiscal constante.

A revisão e os bytes ficam no SQLite da conta e podem ser reabertos. Sem serviço disponível, captura permanece para análise posterior. Depois da extração, envio offline é intenção pendente, nunca aprovação; a política RF-16 é mantida. O lançamento tem acesso a `/documento/[id]` para conferir o original antes de aprovar. Documento já vinculado abre a despesa existente; duplicação também é recusada no servidor.

Acesso usa contas configuradas pelo responsável; o perfil local continua oferecendo as identidades sintéticas do guia. O texto de entrada e as falhas de conexão também servem à futura hospedagem. Cadastro e recuperação por e-mail indicam indisponibilidade. Mapas/busca remotos estão desativados nesta fase. [Roteiro e limitações atuais](CLOUDFLARE_LOCAL.md#roteiro-demonstrável). O restante descreve a base de UX preservada, com trechos Supabase e leitura fiscal completa históricos/planejados.


> **Tipo:** referência de experiência e navegação. **Status:** navegação e fluxos atuais nas seções 3 e 4; seção 5 distingue tecnologias implementadas de orientações de uso. Propostas e aceite ficam identificados.\
> **Atualizado em:** 26/10/2026 (America/Sao_Paulo, UTC−03:00)\
> **Criado em:** 13/10/2026 às 21:44 (America/Sao_Paulo, UTC−03:00)\
> **Relacionados:** [Requisitos do produto](REQUISITOS_PRODUTO.md) — RF-19 e regras de negócio já confirmadas · [Identidade visual e diretrizes de marca](branding/IDENTIDADE_VISUAL.md) · [Leitura de notas fiscais por IA](IA_DOCUMENTOS_FISCAIS.md).

## 1. Objetivo

Oferecer um produto que seja **fácil para quem opera e profundo para quem gere**. O mesmo sistema atende ao funcionário no pasto, ao sócio que confere aprovações, ao administrador e ao produtor analítico que deseja compreender lotes, arrobas, caixa, custos e rentabilidade.

A complexidade de apresentação **não pode eliminar controles, distorcer números ou mudar permissões**. Todos os modos aplicam a mesma [política de aprovação RF-16](REQUISITOS_PRODUTO.md#rf-16--política-de-aprovação).

### Princípios de design

1. **Progressive disclosure:** mostrar o mínimo suficiente para concluir uma tarefa; oferecer "Ver detalhes" sem esconder informações obrigatórias.
2. **Prioridade por contexto:** a fazenda e a operação atual aparecem em todas as telas críticas; evitar lançar na sociedade errada.
3. **Ação primeiro no campo:** cadastrar com poucos toques, offline, com botões legíveis e confirmação do estado de envio.
4. **Análise sem perder profundidade:** dashboards, indicadores, tendências, filtros, tabelas e critérios dos rateios para o usuário analítico.
5. **Uma verdade, visões diferentes:** modos de interface não criam resultados distintos; apenas mudam apresentação, densidade e atalhos.
6. **Clareza da confiança dos dados:** indicar medido vs. estimado, real vs. ajustado, confirmado vs. provisório e atualizado vs. pendente de sincronização.
7. **Animações com propósito:** explicar processos e confirmar ações, nunca substituir textos importantes nem atrasar a operação.
8. **Acessibilidade:** textos claros, alvos de toque adequados, contraste, uso sem gestos ocultos, suporte a leitor de tela e redução de movimento.

## 2. Conceitos independentes: cargo, acesso, experiência

| Conceito | Controla | Exemplo |
| --- | --- | --- |
| **Cargo/vínculo** | Papel da pessoa numa operação | Sócio, funcionário, gerente, consultor |
| **Permissões** | Ações e dados autorizados por operação/fazenda | Pode lançar pesagem; não pode consultar bancos |
| **Modo de experiência** | Densidade e forma de apresentação | Essencial, Gerencial ou Analítico |
| **Preferências pessoais** | Personalização por usuário | Home, atalhos, filtros, animações reduzidas |

**Regra:** selecionar "Analítico" não concede acesso a finanças. Selecionar "Essencial" não dispensa os campos legais, financeiros ou de auditoria obrigatórios.

### Modos implementados e direção de evolução

| Modo | Enfoque | Componentes típicos |
| --- | --- | --- |
| **Essencial** | Registrar, conferir e concluir tarefas sem distração | Atalhos grandes, textos diretos, formulários guiados, indicadores sintéticos |
| **Gerencial** | Gerir a operação e acompanhar resultados | KPIs, gráficos, comparação por fazenda/lote, pendências, caixa |
| **Analítico** | Auditar, investigar e cruzar dados | Tabelas densas, filtros avançados, detalhamento de rateios, séries históricas, exportações |

- No primeiro acesso, **sugerir** modo a partir das tarefas do usuário, mas permitir escolha e troca posterior sem recriar conta.
- Salvar a preferência **por usuário**, podendo personalizar por dispositivo caso seja útil.
- Permitir alternar **Simples / Detalhado** em relatórios específicos sem trocar o modo global.
- O modo deve adaptar **ordem de módulos e densidade**, não manter três sistemas paralelos.
- Usuários com acesso financeiro limitado verão atalhos diferentes, independentemente do modo.
- Incluir opção explícita **"Reduzir animações"**, respeitando preferências de acessibilidade do sistema operacional quando possível.

## 3. Arquitetura de navegação

> **Revisada em 23/10/2026 (versão 0.6.0).** A navegação tinha crescido por adição de telas: a aba Pendências ficava quase sempre vazia e repetia o "Precisa de você" do Início e o sino; o Financeiro, módulo mais usado por sócios, ficava escondido em "Mais"; e Histórico, Atividade, Recentes, Notificações e Pendências mostravam a mesma linha do tempo com recortes diferentes. A organização abaixo agrupa as telas em **hubs** (como o Financeiro já fazia), sem remover nenhuma função.

### Menu inferior (quatro áreas + ação central), por permissão

| Perfil | Menu |
| --- | --- |
| **Gerencial / produtor (com acesso financeiro)** | Início · Rebanho · **(+)** · Financeiro · Mais |
| **Essencial / campo (sem acesso financeiro)** | Início · Rebanho · **(+)** · Atividade · Mais |

| Entrada | Conteúdo |
| --- | --- |
| **Início** | Home contextual por modo, bloco **"Precisa de você"** com contadores e atalhos frequentes |
| **Rebanho** | Hub com abas no topo: **Lotes · Pastos · Mapa** |
| **Registrar (+)** | Abre uma **folha de baixo** (bottom sheet) com as ações de registro, sem sair da tela atual |
| **Financeiro** | Hub dos sócios: indicadores, contas a pagar/receber, extrato, **Relatórios** e **Cadastros** |
| **Atividade** | Linha do tempo única com filtros **Tudo · Para você · Convites** |
| **Mais** | Menu no formato do PicPay: a conta, uma **busca** e o **Acesso rápido** em blocos (Fazendas, Pessoas, Estoque, Pastos, Mapa e, para sócios, Atividade, Relatórios e Cadastros); depois Preferências, Sincronização e Sair |

- O menu exibe **somente o que o usuário pode acessar**. A aba Financeiro aparece para quem é sócio de alguma operação visível; quem não tem acesso financeiro (funcionário, campo) tem a aba Atividade no lugar. O modo de experiência não muda o menu, só o Início.
- Quem tem a aba Financeiro alcança a Atividade pelo **sino** do topo, presente em todas as telas do menu; quem tem a aba Atividade a vê com o contador do que pede ação.
- **Pendências deixa de ser aba.** O Início mantém o "Precisa de você"; o sino mostra o contador e abre a Atividade já no filtro **Para você** (em **Convites**, se o único pendente for convite; sem nada pendente, em **Tudo**). O ponto no sino marca ações novas de outras pessoas.
- **Convites** reúne os convites recebidos (aceitar ou recusar ali) e os enviados nas fazendas do contexto que aguardam aceite.
- **Tudo** alterna entre **Equipe** (quem fez o quê, por dia e pessoa) e **Registros** (o antigo Histórico: tudo o que foi lançado, por mês e tipo).
- Telas do menu abertas por link quando não estão no menu do perfil mostram **voltar** no topo.

### Hubs

| Hub | Reúne | Observação |
| --- | --- | --- |
| **Rebanho** | Lotes (por lote ou por pasto), Pastos (ocupação, descanso, relatório e GMD) e Mapa das fazendas | Pasto é onde o rebanho está; a mudança de pasto já mistura os dois |
| **Financeiro** | Hub atual; **Relatórios** junta Fluxo de caixa · Orçamento · Resultados (DRE, idade e gastos) em abas; **Cadastros** junta Fornecedores e clientes, Plano de contas, Sócios e Despesas recorrentes | Contas, financiamentos, conciliação e importação seguem na grade de gestão |
| **Atividade** | Atividade e Histórico (**Tudo**: Equipe ou Registros), Pendências e Notificações (**Para você**) e convites (**Convites**) | Uma linha do tempo, três filtros |
| **Fazenda** (em Mais) | Fazendas e mapas, Pessoas e equipe e Estoque de insumos | Recursos da operação num só lugar |

Preferências passa a abrigar as **ferramentas do protótipo** (ou "Aparência e dados locais", no modo conectado) e os **dados de exemplo**.

### Endereços antigos

Links, notificações e deep links antigos continuam funcionando e levam ao novo lugar: `/pendencias` e `/notificacoes` → Atividade · Para você; `/historico` → Atividade · Tudo · Registros; `/pastos` → Rebanho · Pastos; `/fazendas` → Fazenda; `/financeiro/fluxo` e `/financeiro/orcamento` → Relatórios na aba correspondente.

### Seletor de contexto persistente

No topo das telas críticas:
- **Operação:** ex.: "Parceria Recria 2026".
- **Fazenda:** ex.: "Fazenda Santa Rita" ou "Todas" em relatórios.
- **Estado da conexão:** Online, Offline, Sincronizando ou Conflito.
- **Pendências:** contador no sino (e na aba Atividade, quando ela está no menu).

**Atenção:** uma fazenda pode abrigar duas operações com diferentes sócios; a navegação e cada formulário devem mostrar explicitamente **qual operação** é a responsável pelo lançamento.

### Árvore de navegação

```text
AgroGest
├── Início
│   ├── Minha operação / Minha fazenda (seletor)
│   ├── Precisa de você (aprovações, conflitos, rascunhos, fila)
│   ├── Indicadores resumidos ou analíticos (por modo)
│   └── Recentes → Atividade · Tudo · Registros
├── Rebanho
│   ├── Lotes (por lote ou por pasto)
│   │   └── Detalhe: histórico, custo, pesos, vendas, saldo, transferência, pagamento
│   ├── Pastos
│   │   ├── Detalhe: ocupação, histórico, peso
│   │   └── Relatório de pastos e GMD
│   └── Mapa
│       └── Mapa da fazenda: contorno, pastos e lotes
├── Registrar (+) — folha de baixo
│   ├── Importar nota fiscal (IA: foto/PDF)
│   ├── Pesagem / estimativa · Despesa · Compra para o estoque
│   ├── Mudança de pasto · Consumo de insumo · Mortalidade
│   └── Novo lote · Venda · Outra receita
├── Financeiro (aba para sócios)
│   ├── Indicadores, contas a pagar/receber, extrato e baixas
│   ├── Relatórios: Fluxo de caixa · Orçamento · Resultados (DRE, idade, gastos)
│   ├── Cadastros: Fornecedores e clientes · Plano de contas · Sócios · Recorrentes
│   └── Contas e saldos · Financiamentos · Conciliação · Importar
├── Atividade (aba para quem não tem acesso financeiro; para todos, pelo sino)
│   ├── Tudo
│   │   ├── Equipe: quem fez o quê, por dia e por pessoa
│   │   └── Registros: tudo o que foi lançado, por mês e por tipo
│   ├── Para você: aprovar, conflitos, recusados, rascunhos, fila, contas vencidas e a vencer,
│   │   baixas em conflito, estoque baixo e compras sem pagamento
│   └── Convites: recebidos (aceitar/recusar) e enviados aguardando aceite
└── Mais
    ├── Busca no menu
    ├── Acesso rápido: Fazendas · Pessoas · Estoque · Pastos · Mapa · (sócios) Atividade · Relatórios · Cadastros
    ├── Preferências: modo, tema, avisos, acessibilidade, ferramentas do protótipo, dados de exemplo
    ├── Sincronização (modo conectado)
    └── Sair
```

## 4. Comportamento atual dos fluxos

Os wireframes da descoberta inicial foram substituídos pela referência da implementação.
Propostas fiscais continuam na [especificação de IA](IA_DOCUMENTOS_FISCAIS.md); alterações de
regra pertencem a [Requisitos](REQUISITOS_PRODUTO.md).


- **Primeiros passos:** criar fazenda e cadastrar o primeiro lote concluem a orientação inicial. Uma nova pesagem não é exigida: o lote já guarda seu peso de entrada. O convite de pessoas é opcional.
- **Documentos da compra:** o cadastro aceita várias GTAs e várias notas fiscais, todas opcionais, como números em texto; o resumo do lote mostra o que foi informado. Lotes antigos continuam funcionando sem documentos.
- **Edição do lote:** sócios corrigem os dados de raiz do lote (código, categoria, entrada, cabeças, pasto, origem, custos e documentos) pelo lápis no topo do lote ou em *Dados da compra*. A fazenda não muda; cabeças não ficam abaixo das já vendidas/mortas e a entrada não passa do primeiro lançamento.
- **Categorias do lote:** grade com machos em cima e fêmeas embaixo; o desenho (boi ou vaca do Fluent Emoji Flat, Microsoft, licença MIT) cresce de bezerro a adulto. O mesmo ícone aparece na lista de lotes e no topo do lote.
- **Tela do lote:** cabeçalho com cabeças, peso médio e ganho diário; abas só aparecem quando têm conteúdo (Peso após a primeira pesagem, Vendas após a primeira venda). Sem pesagem, o resumo não mostra GMD; sem venda, mostra o investimento em vez do resultado.
- **Início por visão:** o *Registrar (+)* concentra os lançamentos (sem atalhos duplicados na home). *Essencial*: precisa de você, rebanho hoje (cabeças, peso e ganho médios), mapa, lotes com aviso de pesagem atrasada (30+ dias) e recentes, sem dinheiro. *Gerencial*: resultado real (ou o investido, antes da primeira venda), rebanho, o mês (vendas e custos, com o mês anterior), custos por mês e mapa. *Analítico*: indicadores (GMD, peso, custo/cabeça, resultado, preço médio da @), comparação de lotes em barras e rateios recentes, sem tabela com rolagem lateral.
- **Mapa da fazenda:** em *Rebanho › Mapa*, *Mais › Fazenda* (toque na fazenda) ou no card da home. Satélite World Imagery da Esri no Leaflet (MIT), dentro de um WebView no celular e de um iframe na web. O sócio toca nos cantos da fazenda, fecha no primeiro ponto e vê hectares e perímetro; pontos arrastáveis, desfazer e limpar; área que se cruza é recusada. Qualquer pessoa da operação posiciona os lotes, que viram pinos de boi/vaca com o resumo do lote. A barra de busca no topo acha município, distrito ou lugar (dados do OpenStreetMap pelo Photon, com o Nominatim de reserva; só ao confirmar, no máximo uma busca por segundo; no Android o app se identifica, senão o Nominatim responde 403) e também aceita coordenadas como `-19,86 -47,44`; o mapa enquadra o lugar e deixa um marcador laranja. *Minha localização* usa o GPS só quando tocado; sem área, o mapa começa na cidade da fazenda (busca no OpenStreetMap/Nominatim). O satélite precisa de internet; área e pinos ficam salvos offline. Para produção, criar uma chave grátis do ArcGIS Location Platform em `EXPO_PUBLIC_ARCGIS_API_KEY`.
- **Uma ação principal por tela** e textos de botão que dizem o resultado ("Criar fazenda", "Registrar").
- **Estados vazios que ensinam e levam ao próximo passo** (Nielsen Norman Group), com a opção de explorar com dados
  de exemplo, em vez de tutorial em carrossel, que não melhora o desempenho e torna a tarefa mais difícil de perceber.
- **Listas em vez de cartões** para o que se compara ou percorre (lotes, lançamentos); cartões só para conteúdo livre.
- **Para você como caixa de entrada:** cada grupo só aparece quando tem itens; o que já foi resolvido fica em *Tudo › Registros*.
- **Conexão só quando importa:** online é o normal e não aparece; sem internet é neutro (não é erro) e diz que dá
  para continuar trabalhando.
- **Uso no campo:** contraste alto nos textos secundários, alvos de toque de 40 a 52 pt e textos de apoio de 14 pt.
- **Formulários:** rótulo sempre visível, "(opcional)" no rótulo, validação ao sair do campo, senha com botão de
  mostrar em vez de digitar duas vezes, teclado certo para e-mail e números.
- **Teclado:** `react-native-keyboard-controller` mantém o campo em foco acima do teclado e do rodapé,
  acompanha mudanças em campos de várias linhas e permite fechar o teclado por botão ou ao rolar.
  A compatibilidade nativa deve ser conferida na versão do SDK usada; builds próprios precisam incluir o módulo.
- **Datas:** `@react-native-community/datetimepicker` abre o calendário do Android e o seletor em português
  no iOS, com confirmação e cancelamento. Na web, usa o calendário do navegador. Hoje/Ontem continuam
  disponíveis; datas são armazenadas como `aaaa-mm-dd` local, sem conversão para UTC.
- **Tema escuro:** as cenas usam as cores do tema (cartões escuros, verde claro da marca); campos, seleções e
  botões desabilitados usam cores próprias com contraste.
- **Troca de fazenda:** salva só a seleção e reutiliza os dados carregados, mantendo a aba atual. Não há
  espera artificial nem tela de carregamento para mudar esse filtro; o cabeçalho faz uma transição de 160 ms.

- **O que é só do protótipo fica fora do caminho**, em *Ferramentas do protótipo*.


## 5. Microinterações, ilustrações e movimento

### Aplicar onde há ganho real

| Situação | Tratamento sugerido | Observação |
| --- | --- | --- |
| Primeiro uso | Tutorial contextual curto / ilustrações estáticas | Pulável; sem bloquear trabalho |
| Importar nota fiscal por IA | Câmera/PDF, análise quando online, formulário pré-preenchido e conferência com original | Não transformar extração em aprovação automática |
| Sem lotes cadastrados | Ilustração + botão "Cadastrar primeiro lote" | Explica próximo passo |
| Pesagem registrada localmente | Feedback visual discreto + texto "Salvo no aparelho" | Não equivale a aprovação |
| Lançamento enviado | Transição curta e status "Aguardando aprovação" | Não sugerir efetivação |
| Sincronização | Ícone de estado + contagem de pendências | Não bloquear a navegação |
| Conflito de saldos | Alerta visual e ação de revisão | Sem animação celebratória |
| Relatórios | Transições moderadas e gráficos responsivos | Priorizar leitura e desempenho |

### Tecnologia visual atual

Lottie local ilustra cenas; Reanimated conduz microinterações. Rive é apenas alternativa,
sem integração atual. Conteúdo essencial funciona sem animação e sem downloads de assets.
Movimento reduzido usa pôsteres estáticos; cenas pausam fora da tela e em segundo plano.
Geração e assets são documentados em [Identidade visual](branding/IDENTIDADE_VISUAL.md).

### Implementado no app (25/10/2026)

- **Cenas Lottie refeitas do zero, no lugar das ilustrações desenhadas à mão.** Cada cena é o próprio
  app em miniatura, como nas boas-vindas: cartão com borda fina, ícone do Lucide em quadrado suave,
  linhas de texto em esqueleto, chips e um número em destaque com os contornos da Inter.
  - Fazenda: mapa com os pastos se desenhando e o alfinete.
  - Rebanho: lotes entrando um a um e o total de cabeças.
  - Venda: venda, custos e a barra que mostra o lucro.
  - Despesa: valor e parcelas.
  - Pesagem: peso médio, curva e ganho.
  - Nota fiscal: leitura e os campos conferidos, com o selo da IA.
  - Equipe: pessoas e o convite enviado.
  - Mortalidade: saldo de 40 para 39, em tom neutro e sem celebração.
  - Estados: sucesso, aguardando envio e leitura da nota.
- **Movimento das cenas.** Entradas escalonadas com desaceleração (curvas de easing, não lineares),
  de 1,5 a 2,5 s a 60 fps, terminando num quadro que se entende sozinho. Só "aguardando envio" e
  "lendo a nota" repetem, porque são esperas reais.
- **Cores e acessibilidade das cenas.** As cores vêm dos tokens do tema (claro e escuro), com
  contraste conferido pelo gerador: números a 4,5:1 e ícones a 3:1. Miniaturas e "Reduzir animações"
  usam o quadro final em SVG, sem montar o player.
- **Fluidez.**
  - Preferências (olho dos valores, modo, reduzir animações) mudam sem reler o banco e sem
    renderizar o app inteiro: 11 componentes em vez de 51 no olho dos valores.
  - Ligar e desligar "sincronizando" atualiza só o sino, a barra e os avisos de fila, não o app todo,
    e uma sincronização sem novidade não renderiza nada além deles.
  - Na primeira visita, Financeiro, Atividade e Rebanho mostram um esqueleto no toque e montam no
    quadro seguinte.
  - A troca de conta ou fazenda e a confirmação do link mostram esqueleto no lugar do spinner.
  - Telas novas entram pela lateral, iguais no Android e no iPhone; no iPhone dá para voltar
    arrastando de qualquer ponto. Formulários em modal sobem de baixo.
  - Os toques que não tinham resposta visual passaram a ter: olho dos valores, mostrar senha,
    fechar teclado, fechar folha, opções de alternância, mapa do pasto e "Ver todas" das categorias.
  - Medições em [PERFORMANCE.md](PERFORMANCE.md).

## 6. Sistema de componentes de interface

**Componentes reutilizáveis prioritários:**
- Seletor de operação e fazenda.
- Card de lote/cabeças, card de receita/resultado e card de aprovação.
- Indicador de conexão e fila de sincronização.
- Campo numérico monetário, quantidade de cabeças, kg e arrobas com unidades explícitas.
- Seletor de rateio com simulação antes da confirmação.
- Etiquetas de origem do dado (**medido**, **estimado**, **apropriado manualmente**).
- Etiquetas de estado (**provisório**, **aguardando aprovação**, **consolidado**).
- Gráficos de peso, custos, caixa e rentabilidade com acesso aos dados subjacentes.
- Formulário em etapas, prévia de impacto financeiro e confirmação de ação.
- Estados vazios, erros recuperáveis, conflito e histórico auditável.

**Diretrizes de linguagem:**
- "Registrar pesagem" em vez de "Criar apontamento zootécnico".
- "Despesas para aprovar" em vez de depender somente do termo "workflow".
- "Resultado com aluguel de pastagem" acompanhado de explicação breve sobre custo de oportunidade.
- Não chamar peso visualmente estimado de "peso aferido".
- Em listas, sempre evidenciar unidade: **kg vivo**, **kg carcaça** ou **@ carcaça**.

## 7. UX por papel sem sobrepor segurança

| Papel / atividade | Home sugerida | Ações em destaque |
| --- | --- | --- |
| Funcionário de campo | Essencial | Pesagem, consumo, intercorrências, despesas |
| Gerente de fazenda | Essencial ou Gerencial | Lotes, transferências, rebanho, lançamentos pendentes |
| Sócio / produtor analítico | Gerencial | Resultado real/ajustado, fluxo de caixa, aprovações, lotes |
| Financeiro | Gerencial | Contas, parcelas, documentos, despesas aguardando aprovação |
| Consultor | Gerencial ou Analítico | Indicadores autorizados, histórico e análise |
| Contador | Analítico ou web futura | Documentos e relatórios fiscal-financeiros autorizados |

O usuário escolhe/ajusta a experiência, mas **somente vê o que sua permissão libera**.

## 8. Onboarding e personalização

A sequência conceitual abaixo orienta evolução; o comportamento implementado está descrito
logo depois. Não há confirmação de que cada etapa conceitual já exista no app.

1. Autenticar e sincronizar os escopos permitidos.
2. Escolher ou confirmar a **operação e fazenda** de referência.
3. Perguntar "Como prefere utilizar o AgroGest?" com explicação curta dos três modos e opção de mudar depois.
4. Sugerir atalhos com base nas ações autorizadas (não com base em esterótipos sobre idade/cargo).
5. Demonstrar **um lançamento** e **o que significa aprovação pendente**.
6. Explicar o indicador offline, o que fica somente no celular e quando passa a estar consolidado.
7. Permitir pular tutorial e reabri-lo em Ajuda.

**Implementado em 25/10/2026 (0.8.0):**

- **Boas-vindas com proposta de valor:** quatro cenas que passam sozinhas, cada uma com o próprio app em miniatura no lugar de ilustração: rebanho com o peso subindo, registros sem sinal sendo enviados quando a internet volta, resultado do lote e aprovação da equipe. Os valores são de exemplo. Com "Reduzir animações" as cenas ficam paradas no estado final e o carrossel não passa sozinho. "Criar conta" e "Já tenho conta" ficam sempre visíveis no rodapé.
- **Primeiro acesso (`/comecar`):** conta sem fazenda e sem modo escolhido passa por duas telas antes do Início. A primeira pergunta o que a pessoa mais vai fazer (registrar o dia a dia, acompanhar custos e resultado, analisar e comparar), pela tarefa e não pelo cargo, e sugere o modo correspondente. A segunda mostra o que aparece primeiro no Início desse modo e os próximos passos (ou o convite, quando houver). Dá para pular e trocar depois em Mais › Preferências. Não pergunta nada que o app não use.
- Referências: apps de consumo que mais faturam (Cal AI e Duolingo, via Noctral) e de gestão pecuária (Aegro, Herdwatch, CattleMax, JetBov). Ficaram para depois: demonstração com dados de exemplo na versão com conta, confirmação de e-mail por código em vez de link e importação do rebanho por planilha.

## 9. Critérios de aceite de UX e testes

Checklist de aceite; itens sem marcação não são uma auditoria atual do código ou de produção.

- [ ] Um usuário Essencial cadastra pesagem/estimativa e submete em sequência guiada sem abrir tela analítica.
- [ ] Um sócio Gerencial visualiza resultado real e com aluguel simbólico sem confundi-los.
- [ ] Um usuário Analítico consulta critério e origem de um rateio e abre o histórico do lançamento.
- [ ] Trocar de modo **não** altera permissões, dados, aprovação obrigatória ou valor de resultados.
- [ ] No fluxo de despesa, informação de operação/fazenda e impacto de custo fica explícita antes do envio.
- [ ] Offline: o usuário diferencia registro salvo localmente, aguardando envio e aprovado.
- [ ] Aprovação exibe impacto e impede autoaprovação e aprovação financeira por não sócio.
- [ ] Uma estimativa de peso é identificável em cards, gráficos, detalhes e relatórios.
- [ ] A importação PDF/foto por IA pré-preenche um rascunho; o usuário identifica campos ausentes, confere o original e submete conforme RF-16.
- [ ] Em modo offline, a captura fica pendente e a interface não promete análise imediata sem conexão.
- [ ] As telas principais funcionam sem exigir animação, conexão ou recursos remotos.
- [ ] Animações respeitam movimento reduzido e não prejudicam interação em Android intermediário.
- [ ] Textos, botões e indicadores são legíveis em condições de uso no campo.
- [ ] Protótipo é validado com, no mínimo, um usuário gerencial e um operacional antes do fechamento do design.

## 10. Prioridades da descoberta inicial (referência histórica)

1. **Registrar pesagem offline**: seleção de operação/fazenda/lote → peso medido ou estimado → revisão → salvo localmente → enviado → aprovação.
2. **Registrar despesa parcelada com rateio**: dados → parcelas → lotes/cabeças → revisão → aprovação por outro sócio.
3. **Aprovar lançamentos**: seleção de escopo → ver impacto → autor ≠ aprovador → decisão → sincronização.
4. **Consultar lote e resultado**: origem → peso → custos → venda parcial → resultado real/ajustado.
5. **Trocar modo**: Essencial ↔ Gerencial ↔ Analítico, mantendo contexto de operação/fazenda e permissões.
6. **Importar nota fiscal com IA**: foto/PDF → aguardar conexão quando offline → pré-preencher → corrigir → classificar/ratear → salvar rascunho → aprovar.

## 11. Decisões a validar

- Os nomes **Essencial, Gerencial e Analítico** estão implementados; validar a compreensão com usuários em campo.
- ~~Se "Financeiro" e "Resultados" devem aparecer em abas próprias para perfis gerenciais~~. **Resolvido em 23/10/2026:** Financeiro é aba para sócios, e os relatórios ficam dentro dele (seção 3).
- Validar com usuários reais se o filtro **Para você** da Atividade substitui bem a antiga aba Pendências.
- Padrões de gráficos e paleta acessível.
- Quais tarefas de campo exigem cinco etapas e quais permitem formulário único.
- Validar cenas Lottie e microinterações Reanimated em aparelhos reais e definir orçamento de performance.
- Suporte a tablet, orientação horizontal e modos de alto contraste.
- Validação de usabilidade real com funcionários, familiares, sócios e consultores.

## 12. Histórico de alterações

| Data e hora (Brasília) | Versão | Alteração | Situação |
| --- | --- | --- | --- |
| 25/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.10.0 | Seção 5: cenas Lottie refeitas do zero como o app em miniatura (gerador `scripts/scenes.mjs`, ícones Lucide, números em Inter, cores do tema com contraste conferido, pôster SVG por cena) e fluidez (preferências sem reler o banco, esqueleto na primeira visita das abas pesadas e no lugar dos spinners, transição lateral igual nos dois sistemas, retorno ao toque onde faltava). Sem mudança de regra, permissão ou texto | **Implementado** (falta validar em aparelho) |
| 25/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.9.1 | Melhorias de esforço baixo da mesma análise. **Rebanho:** selo "Sem pesar há N dias", sem o "Por lote/Por pasto" (a ocupação por pasto fica na aba Pastos), "Novo lote" escrito no lugar do "+", aba Pastos seguindo a fazenda do topo (sem repetir o seletor) e aba Mapa com um cartão de mapa por fazenda (prévia no satélite ou convite para desenhar). **Financeiro:** pílulas sem o "Fazenda" do começo e rolando só o necessário, primeiro cartão sem conta cadastrada mostrando "A pagar · 30d" e o já vencido (com "Cadastrar"), fornecedor numa linha própria nas contas. **Atividade:** um filtro só em "Tudo" (Mostrar: Equipe ou Registros; Pessoa ou Tipo), dias como "13 de out", aprovações e conflitos no topo de "Para você". **Mais:** "Ajuda e suporte" com dúvidas comuns, rever o primeiro acesso e WhatsApp quando `EXPO_PUBLIC_SUPPORT_WHATSAPP` estiver configurado; "Fazendas" só em destaque antes da primeira fazenda | **Implementado** |
| 25/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.9.0 | Primeiras melhorias da análise tela a tela (comparação com PicPay, Nubank, Organizze, Aegro, Herdwatch e JetBov). **Início:** fazenda com o nome inteiro abaixo da linha do avatar, cartão principal com período, olho para esconder valores dos cartões principais do Início e do Financeiro (listas, indicadores e relatórios continuam visíveis) e toque para o detalhe, "Pro dia a dia" nos modos Gerencial e Analítico, "Precisa de você" com os mesmos itens do sino (inclui compras sem pagamento, recusados e rascunhos) e sem os blocos que repetiam o Financeiro. **Ficha do lote:** atalhos (Pesagem, Mudar de pasto, Venda, Mortalidade) no lugar das linhas de navegação, pasto como link, curva de peso no Resumo e "Para empatar" (R$/@ estimado com 50% de rendimento de carcaça). **Despesa:** uma tela só (valor grande, descrição, categorias com ícone ordenadas pelo uso, data) com fazenda, fornecedor, pagamento, rateio e estoque em "Mais detalhes" e o impacto antes de registrar. **Navegação:** tela aberta por link ou notificação ganha o voltar para o Início | **Implementado** |
| 25/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.8.0 | Onboarding (seção 8): boas-vindas com quatro cenas animadas do próprio app como proposta de valor, primeiro acesso que pergunta o que a pessoa mais vai fazer e sugere o modo do Início, com prévia e próximos passos. Sem conta, a primeira tela volta a ser a de boas-vindas (o expo-router 58 mandava para Entrar) | **Implementado** |
| 23/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.7.1 | Financeiro, menu inferior e Mais inspirados no PicPay: faixa escura no topo do Financeiro com as fazendas em pílulas (trocar de fazenda sem sair da tela) e indicadores em cartões translúcidos (nome e atalho em texto no alto, número com o olho, detalhe no pé); "Pro dia a dia" com o ícone no bloco e o rótulo embaixo; títulos de bloco maiores ("Pro dia a dia", "Suas contas", "Acesso rápido"); gestão em blocos grandes de duas colunas; menu inferior com cantos arredondados e pílula na aba ativa; Mais com busca e Acesso rápido. Sem mudança de domínio ou sincronização | **Implementado** |
| 23/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.7.0 | Repaginação visual conforme [IDENTIDADE_VISUAL.md](branding/IDENTIDADE_VISUAL.md) (seção 7.1): fonte Inter, tokens claro/escuro com uma cor de marca, faixa escura no Início e em Mais, cartão-herói com uma ação, atalhos quadrados em "Pro dia a dia", menu com ícones de traço fino e contador discreto, listas com no máximo um selo por linha, e a folha do "+" com o essencial e "Ver mais". Sem mudança de domínio, navegação ou sincronização | **Implementado** (Início, Financeiro, Rebanho, Atividade, folha do "+" e Mais) |
| 23/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.6.0 | Navegação reorganizada em hubs: menu inferior por permissão (Financeiro para sócios, Atividade para quem não tem acesso financeiro), "+" como folha de baixo, Rebanho com Lotes · Pastos · Mapa, Atividade (Tudo · Para você · Convites) unindo Atividade, Pendências, Notificações e Histórico, Financeiro com Relatórios em abas e Cadastros, Fazenda em Mais e ferramentas do protótipo em Preferências. Endereços antigos redirecionam | **Implementado** |
| 19/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.5.0 | Ícone de histórico ao lado do sino (com ponto para ações novas de outras pessoas) e tela Atividade: avatar com a inicial, frase curta ("João registrou uma mudança de pasto"), detalhe e hora, agrupada por dia, com filtro por pessoa e seguindo a fazenda do contexto | **Implementado** |
| 19/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.4.0 | Pastos com hierarquia visual: número principal em destaque, estado do pasto (ocupado/em descanso) como única cor da linha e filtros do relatório recolhidos. Desenho opcional do pasto no mapa, dentro da fazenda (pontos presos à borda e às cercas vizinhas), exclusão de pasto nunca usado e "Pessoas" seguindo a fazenda do contexto | **Implementado** |
| 19/10/2026 (America/Sao_Paulo, UTC−03:00) | 0.3.0 | Mais › Pastos e manejo (lista, detalhe e relatório com filtros), seletor de pasto com cadastro no próprio formulário do lote e da transferência, assistente "Mudança de pasto" e escolha do grupo quando o lote está em mais de um pasto. GMD sempre com base de cálculo e "Dados insuficientes" | **Implementado** |
| 14/10/2026 às 07:32 (America/Sao_Paulo, UTC−03:00) | 0.2.0 | Nova tela de importação de notas fiscais por IA, estados offline, pré-preenchimento e revisão antes de aprovação | **Necessidade confirmada / UX proposta** |
| 13/10/2026 às 21:51 (America/Sao_Paulo, UTC−03:00) | 0.1.1 | Adicionada referência à documentação de identidade visual legada e proposta para o app | **Referência confirmada / aplicação proposta** |
| 13/10/2026 às 21:44 (America/Sao_Paulo, UTC−03:00) | 0.1.0 | Proposta inicial de modos de experiência, arquitetura de navegação, wireframes, animações e critérios de UX, com base no levantamento com o produtor | **Proposto** |

> **Nota sobre auditoria:** timestamps deste documento registram o momento em que a decisão foi documentada. A história exata de edições também fica no Git. Não inventar horário para requisitos discutidos antes do início deste registro estruturado.

## Centros de custo: fluxo implementado em 27/10/2026

Em **Financeiro > Cadastros > Centros de custo** (`/financeiro/centros`), o sócio cria
agrupamentos (ex.: Hidráulica) e centros (ex.: Roda d’água). Tocar um item permite renomear
ou inativar; o agrupamento fica fixo, conforme as [regras do produto](REQUISITOS_PRODUTO.md#centros-de-custo-e-finalidades-issue-48).
O cadastro respeita a operação da fazenda e permite escolhê-la quando o contexto inclui várias.

Despesa, revisão de nota e recorrência apresentam **Centro de custo / finalidade**, com
**Sem centro de custo** como opção e atalho ao cadastro. Trocar a fazenda para outra operação
limpa a seleção. Modelos recorrentes preenchem a finalidade da despesa gerada; se estiver
inativa, é preciso escolher outra ou remover a classificação antes de registrar.

Em **Financeiro > Relatórios > Resultados > Gastos**, escolha Competência ou Pagamentos
(caixa), abra os filtros de datas, categoria e centro/agrupamento e mantenha a fazenda no
contexto do relatório. Consulte centros individuais, agrupamentos ou Categoria × centro;
**Apropriação por lote** mantém a dimensão anterior. A lista detalha os mesmos lançamentos,
abre suas fichas e exporta os dados filtrados em CSV. O detalhamento mostra até 30 linhas
por página; totais e CSV usam todos os registros filtrados. Os valores anteriores usam o mesmo
filtro e o intervalo imediatamente anterior de igual duração.

Na ficha de uma despesa/nota aprovada, **Classificação gerencial** permite corrigir a finalidade
com motivo e consultar a trilha de autor, momento, anterior e novo. A confirmação é
**Salvar classificação**, sem recriar a despesa ou registrar outro pagamento. Funcionários
não recebem cadastro/classificações nem a ação gerencial.
