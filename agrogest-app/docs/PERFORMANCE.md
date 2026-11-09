# Desempenho

Medições registradas: fluidez web (25/10/2026) e duas comparações do domínio
(22/10/2026, bases `62c6127` e `698aa64`). São evidências históricas, com condições e limites
próprios; não representam um benchmark atual de todo o aplicativo.

## Fluidez da interface (25/10/2026)

Medição no protótipo web (`agrogest-mobile-web-prototipo`, modo de desenvolvimento, dados de exemplo,
tela de 375×812, painel do navegador visível), com o mesmo roteiro no código anterior (`842cbf5` mais
o medidor) e no novo. São três repetições de cada lado, sempre depois de recarregar a página, e a
tabela mostra a mediana. É um ambiente de desenvolvimento web: os números servem para comparar as
duas versões entre si, não para dizer quanto tempo leva num Android.
As capturas de antes e depois das telas principais estão em
[capturas/fluidez-2026-10-25](capturas/fluidez-2026-10-25/). As `usos-*` mostram as cenas novas onde
o app as usa, nos dois temas: cabeçalho de formulário (fazenda nova, nota fiscal, convite), estado
vazio (Início sem fazenda, rebanho sem lote), conclusão do wizard (enviado e aguardando envio),
leitura da nota e convite criado. Com "Reduzir animações" ligado, todos esses usos (cabeçalhos de
fazenda, convite, nota fiscal, pesagem, venda e mortalidade; rebanho vazio; leitura da nota;
convite criado; wizard enviado e aguardando envio, que normalmente repete) foram abertos e contados:
nenhum player montado e um pôster SVG em cada (`usos-aguardando-reduzir-animacoes.jpg`).

Nesta máquina não há emulador Android nem aparelho conectado (sem Android SDK nem `adb`). Por isso
os itens abaixo continuam pendentes de verdade, não só "a confirmar".

### Como medir

`src/state/perf-probe.tsx` só existe no desenvolvimento web: no app instalado o `PerfBoundary`
devolve os filhos direto e `countAppRead` não faz nada. Ele expõe `globalThis.__agrogestPerf` com:

- `useApp`: quantos componentes renderizaram lendo o estado do app;
- `commits` e `renderMs`: commits do React e a soma do `actualDuration` (Profiler);
- `firstScreenMs`: o primeiro commit das abas.

O roteiro chama `reset()`, executa a ação, espera 1,2 s e lê os contadores. Um `PerformanceObserver`
soma as tarefas longas (mais de 50 ms) do período. A sequência é: 1ª visita a Rebanho, Financeiro e
Mais; voltar ao Início; revisitar Rebanho e Início; esconder e mostrar valores; abrir e fechar a folha
do Registrar.

| Ação | Antes (render · commits · tarefa longa) | Depois (render · commits · tarefa longa) |
| --- | ---: | ---: |
| Primeira tela (desde o início da página) | 648 ms | 649 ms |
| 1ª visita ao Financeiro | 167 ms · 60 · **64 ms** | 172 ms · 80 · **0 ms** (54 ms em 1 de 3) |
| 1ª visita ao Rebanho | 87 ms · 64 · 0 ms (52 ms em 1 de 3) | 89 ms · 66 · 0 ms |
| 1ª visita ao Mais | 76 ms · 28 · 0 ms | 78 ms · 28 · 0 ms |
| Revisitar uma aba | 34–38 ms · 28 | 35–37 ms · 28 |
| Esconder valores (olho) | 71 ms · 6 · **51 leitores** | **45 ms · 4 · 11 leitores** |
| Mostrar valores | 67 ms · 6 · 51 leitores | **45 ms · 4 · 11 leitores** |
| Abrir a folha do Registrar | 13 ms · 6 | 12 ms · 6 |
| Sincronizar (toque em "Sincronizar", nada novo; 5 toques) | 14 ms · 4 · 54 leitores | **6 ms · 6 · 15 leitores** |

"Leitores" são componentes que renderizaram lendo `useApp`.

O que mudou:

- **Preferências sem reler o banco.** Antes, cada `setSetting` (olho dos valores, modo do Início,
  reduzir animações, atividade vista, avisos) gravava e relia o banco inteiro: 16 consultas de
  `loadSnapshot` e o recálculo de todas as projeções de `selectWorkspace` (lotes, parcelas,
  ocorrências, linha do tempo). Agora a gravação vai para uma camada local
  (`settingsPatch` em `app-state.tsx`) e o workspace só é refeito quando muda uma preferência que ele
  lê (pessoa, fazenda do contexto, avisos). Uma leitura nova do banco descarta só o que ela já
  contém (`keepWritesAfter`), então gravações diretas não são sobrescritas. No olho, os commits caem
  de 6 para 4. No aparelho, o ganho maior deve ser não fazer as 16 consultas ao SQLite a cada toque,
  e isso o web não mede.
- **Sincronização fora do valor do contexto.** `syncing`, a mensagem de erro, a fila de envio e a
  transição de contexto saíram do `useApp` para um store (`src/state/sync-status.tsx`, lido com
  `useSyncExternalStore` em `useSyncStatus()`). O provedor grava nele sem renderizar a si mesmo, e
  só o sino, a barra de sincronização, o aviso de fila e as telas que mostram a fila renderizam
  quando "sincronizando" liga e desliga. As ações que precisam do valor atual (descartar a fila,
  gerenciar acessos) leem `status.get()` na hora do toque. A hora da última sincronização também
  vive ali.
- **Releitura sem novidade não renderiza.** `reload()` passa por `shareSnapshot`
  (`src/state/share-snapshot.ts`, com teste em `tests/share-snapshot.test.mjs`): cada tabela igual à
  anterior mantém a referência e, se nada mudou, a leitura inteira é a anterior. O React então não
  renderiza o provedor. A única diferença ignorada é `lastSyncAt`, que já está no store da
  sincronização. Por sincronização: de 54 para 15 leitores (os 15 são os componentes que mostram a
  sincronização) e de 14 para 6 ms.
- **Preferências de interface num contexto próprio.** Modo do Início, valores escondidos, reduzir
  animações e atividade vista saíram do `useApp` para `usePreferences()` (`src/state/preferences.tsx`).
  O `PreferencesProvider` fica dentro do `AppStateProvider`. Quando só uma preferência muda, ele
  renderiza sozinho e o React reaproveita o resto da árvore (o `children` é o mesmo). O
  `AppStateProvider` não passa pelo React Compiler (os consumidores passam), então cada
  renderização dele criava um valor novo e acordava todos os leitores. No olho dos valores, os
  leitores de `useApp` caíram de 51 para 11 (só as telas que leem as duas coisas), e a renderização
  caiu 37%. O cartão-herói e o sino nem leem mais o `useApp`.
- **1ª visita sem travar o toque.** Financeiro, Atividade e Rebanho mostram o esqueleto no mesmo
  quadro do toque e montam a tela no quadro seguinte (`FirstVisit`). O trabalho total continua o
  mesmo, mas deixa de ser um bloco único: a tarefa longa do Financeiro (63–69 ms nas três medições
  de antes) sumiu em duas das três de depois. A aba ativa e o esqueleto respondem na hora.
- **Cenas Lottie mais leves no carregamento.** Os pôsteres ficam um arquivo por cena e só carregam
  quando a cena aparece. Antes era um JSON de 40 KB importado com o app. Cada cena tem menos de
  15 KB (mediana de 11,8 KB, a maior com 14,1 KB); o gerador (`node scripts/scenes.mjs`) falha se alguma passar do limite.

O que não mudou e por quê:

- **Dados novos do banco.** Quando os dados mudam de fato, os leitores de `useApp` renderizam de
  novo, como devem: é o conteúdo que eles mostram. A comparação de `shareSnapshot` percorre os dados
  lidos; com milhares de lançamentos ela tem custo próprio, a medir no aparelho.
- **Listas.** Atividade e Rebanho já usam `SectionList` virtualizada (`initialNumToRender` 12,
  `windowSize` 9), e o Financeiro pagina o extrato de 30 em 30. Com os dados de exemplo, nenhuma lista
  apareceu como gargalo, então não trocamos para FlashList sem evidência.
- **Primeira tela.** Igual nas duas versões (dentro da variação). Nenhuma mudança mirava a abertura.
- **Folha de baixo (testada).** Abrir e fechar a folha do Registrar três vezes, contando os quadros
  com `requestAnimationFrame` por 700 ms: 44–47 quadros, com no máximo 17 ms entre dois quadros
  (22 ms só na primeira abertura, um quadro perdido). Isso é 60 qps. A folha já usa
  `@gorhom/bottom-sheet` com Reanimated e respeita "Reduzir animações"; não precisou mudar.
- **Teclado (testado na web, falta o aparelho).** Com a tela reduzida a 375×420, como se o teclado
  ocupasse metade, focar campos do meio e do fim de *Novo lote* e de *Convidar pessoa* deixa o campo
  inteiro visível acima do botão do rodapé (captura `teclado-campo-visivel.jpg`). No aparelho, o
  `FormViewport` usa `KeyboardAwareScrollView` e `KeyboardStickyView` do
  `react-native-keyboard-controller`, com o rodapé descontado. Esse caminho nativo não roda no
  preview web.

### Falta validar em aparelho real

- Android intermediário com release build: tempo de abertura, 1ª visita ao Financeiro, olho dos
  valores e quadros perdidos (Perf Monitor ou `adb shell dumpsys gfxinfo`).
- Teclado do sistema sobre os formulários (o caminho nativo do `FormViewport`).
- Lottie nativo (`lottie-react-native`): as cenas usam só formas, traços, aparar caminho e
  transformações, mas não foram vistas tocando no Android/iOS, só no player web (dotLottie).
- Transição lateral `ios_from_right` no Android, voltar arrastando da tela inteira no iPhone e as
  folhas de baixo com o teclado aberto.
- Base grande (milhares de lançamentos) para confirmar que as listas virtualizadas bastam e que a
  comparação de `shareSnapshot` na releitura continua barata.

## Desempenho do domínio

Registro da revisão de 22/10/2026. As medições abaixo são sintéticas, locais e executadas no
Node.js 24.10.0, Windows x64. Elas ajudam a comparar os algoritmos com a mesma entrada;
não medem FPS, inicialização, rede ou tempo de resposta em um aparelho Android/iOS.

### Melhorias desta revisão

- **Rateio de consumo:** `stock.ts` calcula cabeça-dia pelos intervalos entre vendas e
  mortalidades aprovadas. Antes, reconstruía o resumo completo do lote para cada dia do
  período. O rateio também agrupa o histórico por lote uma vez, em vez de procurar cada lote
  no conjunto inteiro repetidamente. Pesagens históricas usam a última ocorrência aprovada.
- **Caixa, DRE e exportação:** `finance.ts` fornece `indexInstallments`, usado por `reports.ts`
  e `export.ts` para consultar a origem de cada baixa. A DRE agrupa também as parcelas por
  renegociação, evitando uma busca completa para cada contrato renegociado.
- **Conciliação de extrato:** `bank-import.ts` agrupa parcelas pela direção e pelo valor em
  aberto antes de calcular as distâncias entre datas. Apenas as parcelas do grupo podem ser
  candidatas para cada linha do extrato.

Os índices pertencem à chamada atual e não guardam dados entre snapshots. Não há alteração
de valores persistidos, plano de compra, custo médio do estoque, centavos distribuídos ou
histórico financeiro.

### Reprodução

Na raiz `agrogest-app`, com Node.js 24.10 ou superior:

```powershell
npm run benchmark:domain -- 62c6127
```

O argumento identifica a versão anterior a esta revisão:
`62c6127b244a2dfd62addcd8c1d8cb0b8905119b`. O script lê seus módulos com `git show` em
um diretório temporário, carrega a versão do checkout e exige igualdade profunda dos
resultados de cada cenário antes de medir. Não troca a branch nem modifica dados do app.
São três aquecimentos e nove amostras por função; a tabela usa a mediana.

Sem argumento, o benchmark continua usando `698aa64`, preservando a comparação da revisão
anterior descrita em [PERFORMANCE.md](PERFORMANCE.md). Os números daquela
comparação não devem ser atribuídos integralmente às mudanças desta revisão.

| Cenário alterado nesta revisão | Entrada | Antes | Depois | Redução |
| --- | --- | ---: | ---: | ---: |
| Rateio de consumo por peso em 92 dias | 200 lotes, 860 lançamentos | 634,835 ms | 0,984 ms | 99,8% |
| Linhas do fluxo de caixa | 2.000 baixas, 4.000 parcelas | 27,006 ms | 3,292 ms | 87,8% |
| Pacote para o contador | 2.000 baixas, 4.000 parcelas | 276,896 ms | 29,252 ms | 89,4% |
| Sugestões para extrato bancário | 1.000 linhas, 4.000 parcelas | 66,182 ms | 4,988 ms | 92,5% |

A massa do rateio contém uma mortalidade e uma venda por lote, além de pesagens e despesas.
O extrato usa valores variados para avaliar a seleção por valor; quando muitas parcelas têm
o mesmo valor e direção, o grupo de candidatas cresce e o ganho tende a ser menor.
As demais linhas da saída medem funções que já estavam otimizadas no baseline, ou o uso
de APIs existentes. Oscilações nelas não comprovam ganho ou regressão desta revisão.

### Regras verificadas

O rateio é comparado à reconstrução cronológica independente de `summarizeLot` em várias
datas, incluindo compra tardia, venda, mortalidade, transferência, lançamento futuro,
pendência, conflito e empate de data/hora entre pesagens. Casos explícitos cobrem os dois
extremos inclusivos do período, ano bissexto, intervalo invertido e saída no dia da transferência.

Os testes financeiros verificam índice de parcela, primeira referência em caso de duplicata,
filtro por fazenda, parcela ausente, extras da baixa, referência na exportação, direção do
extrato, valor exato, limite de dez dias, ordem estável de empates e situação do comprovante.
As entradas são comparadas antes/depois para detectar mutação.

Validação focada: **52 testes passaram** com o comando abaixo:

```powershell
node --import ./tests/resolve-ts.mjs --test tests/finance.test.mjs tests/finance-management.test.mjs tests/stock.test.mjs tests/lot-transfer.test.mjs tests/workspace.test.mjs
```

Para a validação completa do projeto, use também os comandos de lint, typecheck, suíte geral
e exportação web documentados no README. A revisão geral e a evidência de interface estão em
[HISTORICO_REVISOES.md](HISTORICO_REVISOES.md).

### Limites e próximos sinais

Esta revisão tratou os pontos de varredura repetida em estoque, rateio, caixa, DRE,
conciliação e exportação. Não é uma prova de ausência de gargalos em todos os módulos,
nem um perfil de memória ou de execução do Hermes. Não se removeu função de domínio
apenas por não aparecer no benchmark: validações e fluxos ocasionais continuam necessários.

Antes de ampliar caches ou mudar a estratégia de carregamento, medir em um aparelho com
um histórico representativo: abrir Rebanho e Financeiro, editar o período de consumo,
importar um extrato e gerar a exportação. Registrar tamanho da base e duração observada
permite distinguir custo de cálculo, renderização e sincronização.


## Otimização interna: 22/10/2026

Base de comparação: commit `698aa64`. Escopo: app novo em `apps/mobile`; legado apenas como referência.

### Revisão e decisões

A varredura de 202 arquivos TypeScript/TSX procurou blocos repetidos, buscas dentro de laços,
reconstruções de históricos, cálculos no estado global, mutações de coleções e efeitos.
A revisão concentrou as mudanças nas projeções consumidas por home, rebanho, estoque e financeiro.

| Área | Mudança | Motivo |
| --- | --- | --- |
| Estado global | Extração de `selectWorkspace` para um módulo puro e testável | Separar leitura/cálculo de comandos, persistência e sincronização |
| Projeções | `useMemo` depende de snapshot, identidade da sessão e dia | Evitar reconstrução das projeções em atualizações transitórias do provedor |
| Lotes | Índice de lançamentos por lote e resumo calculado sob demanda por leitura | Compartilhar o mesmo cálculo entre home, detalhe e relatórios |
| Estoque | Agrupamento dos lançamentos por insumo antes dos replays | Evitar percorrer o histórico inteiro para cada insumo |
| Parcelas | Índice de pagamentos por parcela; contagem por componente da compra | Evitar filtros aninhados, preservando ordem, centavos, estornos e histórico |
| Datas | Uma implementação de `shiftMonth` em `domain/dates.ts` | Remover duplicação; a exportação existente de `treasury.ts` continua disponível |
| Números | Reutilização de `Intl.NumberFormat` por precisão | Evitar instanciar um formatador para cada número renderizado |

Os índices dos lotes pertencem a uma única leitura e não são globais. Alterar dados, perfil,
fazenda ou dia refaz as projeções correspondentes. Nenhum índice pode substituir a validação
de comandos ou permissões. O React Compiler já está habilitado no app; os números abaixo medem
as funções de domínio, não o ganho do `useMemo` no provedor.

DRY foi aplicado às regras de calendário, ao filtro financeiro e ao compartilhamento de cálculos.
KISS foi aplicado com funções puras, mapas locais e manutenção das APIs atuais.
YAGNI orientou a manter o mecanismo atual de estado e persistência, sem novas bibliotecas,
framework de seletores ou abstração genérica para todos os formulários.

Os estados semelhantes de formulários continuam locais, pois validações e fluxos são distintos.
Os adaptadores de mapa nativo/web e os componentes gerados da biblioteca visual continuam
separados. Não houve remoção especulativa de dependências, alteração em Auth/RPCs, esquema,
migrations, fila offline ou regras de aprovação. Nenhuma migration precisa ser aplicada.

### Medição reproduzível

Em `agrogest-app/`:

```sh
npm run benchmark:domain -- 698aa64
```

O comando lê os fontes antigos com Git em um diretório temporário, executa a mesma fixture nas
duas versões e exige igualdade profunda dos resultados antes de medir. Usa 3 aquecimentos e a
mediana de 9 execuções por cenário. A fixture tem 200 lotes, 30 insumos, 460 lançamentos e
200 pagamentos. A comparação de lotes inclui o custo de construir o índice e fazer três leituras
de todos os resumos na mesma leitura dos dados.

Medição final nesta máquina:

| Rotina | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Parcelas e histórico de pagamentos | 6,284 ms | 0,765 ms | 87,8% |
| Custos de consumo do estoque | 1,357 ms | 0,237 ms | 82,5% |
| Posições do estoque | 2,372 ms | 0,225 ms | 90,5% |
| Resumos dos lotes, três leituras | 14,919 ms | 1,238 ms | 91,7% |
| Formatação de mil números | 49,428 ms | 1,321 ms | 97,3% |

Os valores variam por máquina e carga. São medições sintéticas de CPU no Node 24, sem rede,
SQLite, renderização ou aparelho físico. Não representam redução percentual no tempo total do app.

### Evidências de preservação

- `npm run test:database`: **164 testes passaram**, incluindo as 6 novas regressões das projeções,
  índices, cálculos, estornos e formatação. A suíte existente cobre comandos, aprovação,
  isolamento, migrações SQLite, transferências, estoque e financeiro usando bancos locais de teste.
- `npm run typecheck` e `npm run lint` em `apps/mobile`: passaram sem erros ou avisos de lint.
- `npx expo export --platform all --output-dir .expo/qa/optimization-final`: passou para
  **web, Android e iOS**, incluindo bundles Hermes nativos. Exportação feita com
  `EXPO_NO_DOTENV=1` e as duas variáveis públicas do Supabase vazias, para usar somente
  o protótipo local. Isso verifica empacotamento; não gera APK/IPA nem substitui teste em aparelho.
- Comparação temporária com o bloco original de projeções de `698aa64`: resultados iguais em
  **60 combinações** de fazenda, pessoa, modo local/nuvem e dia; também conferidos os callbacks
  de resumo, nome de pasto e sócios.
- Verificação pela AST TypeScript: os trechos JSX e o `StyleSheet` do provedor permanecem iguais,
  normalizando apenas CRLF/LF. Nenhuma tela, componente visual, CSS, tema, rota ou asset foi editado.
- Protótipo web local: cadastro fictício, carga dos dados de exemplo, financeiro, DRE, rebanho,
  troca de fazenda (107 para 30 cabeças) e troca de sócio para funcionário. O financeiro deixa
  de aparecer para o funcionário, enquanto o rebanho continua acessível.
- Captura local da validação: `apps/mobile/.expo/qa/optimization-rebanho.jpg` (artefato ignorado pelo Git).

No desenvolvimento web surgem avisos de propriedades React Native repassadas ao DOM
(`numberOfLines`, `accessibilityRole`, `accessibilityLabel`) por componentes visuais que não
foram alterados. Não ocorreu falha de navegação nesses cenários. Corrigir esses componentes
exigiria uma revisão separada de compatibilidade web da camada visual.

Não houve publicação ou teste de desempenho em Android/iOS físico, nem alteração de dados remotos.

A fronteira de memoização segue a [referência de `useMemo` do React](https://react.dev/reference/react/useMemo):
dependências explícitas e cache usado apenas como otimização, sem depender dele para correção.
