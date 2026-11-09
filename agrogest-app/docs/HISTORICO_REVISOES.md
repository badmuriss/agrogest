# Histórico de revisões

## 09/11/2026 — OCR empacotado e validado em container local

Base desta alteração: commit próprio `06eb04f42319419ef7bacb3616f69b63ff5d5be7`, mantendo a atribuição da origem abaixo. O padrão de execução passa do processo Python instalado no host para Docker local, sem mudar o contrato Worker → OCR. A imagem contém Python **3.14.10**, Tesseract **5.3.0-2**, modelo português com SHA-256 e licença Apache-2.0. Executa por CPU, sem dispositivo GPU, como UID/GID 10001, com raiz somente leitura e temporários efêmeros. Nenhum deploy/provisionamento ou inferência remota foi executado; o repositório próprio público foi autorizado em etapa anterior.

**Validação atual:** `npm run check` terminou com exit 0: **233 testes** (216 domínio/SQLite/PGlite, 11 integração API com OCR no container, 1 guarda de daemon Docker local e 5 Python dentro de container sem rede), tipos mobile/API e lint mobile. `ocr:build` construiu a imagem no daemon local; os testes de integração usam porta dinâmica e D1/R2 temporários. Modelo ausente/inválido impede saúde positiva; contextos Docker remotos são recusados antes de construir/executar. O Compose publica somente `127.0.0.1:8091`, sem montar bancos, workspace ou segredos. Durante o diagnóstico, a rede Docker `internal` não publicou a porta neste daemon; a versão validada usa bridge e loopback, sem alegar firewall de saída.

**Navegador:** Chromium executou imagem sintética nova → extração real no container → revisão → despesa → aprovação de Bruno → indicador. O OCR retornou R$ 237,60, Cooperativa Horizonte, data 09/11/2026 e descrição; o parser capturou `TESTE` do cabeçalho como número, corrigido na revisão para `GS-CONTAINER-003`. Isso evidencia a necessidade de revisão, não acurácia fiscal comprovada. A despesa pendente preservou o custo em **R$ 11.340,30**; aprovada, passou a **R$ 11.577,90**, sem duplicar os dois lançamentos anteriores. Bruno abriu a imagem original protegida; seu hash coincide com o arquivo enviado.

**Reinicialização:** SIGINT encerrou Worker e container, liberando as portas. Novo `npm start` preservou os três lançamentos, aprovação, custo e bytes no R2. O navegador reabriu a sessão/lote de Bruno sem erro de página. Reenviar os mesmos bytes devolveu o mesmo documento. A captura de rede do navegador registrou **142 requisições, zero HTTP externo**; o escopo não inclui downloads de preparação nem tráfego interno Worker → OCR. Não houve nova exportação web/Android/iOS nesta alteração de serviço/scripts; os builds de 06/11 permanecem históricos. Os testes de offline/outbox e permissões herdados foram reexecutados; o roteiro manual completo de desconexão de 06/11 não foi repetido.

Evidências: [execução dos checks](<../../research_notes/Agrogest Cloudflare local/check-container-20261109.txt>), [registro de validação e recursos](<../../research_notes/Agrogest Cloudflare local/validacao-container-20261109.json>), [estado anterior à aprovação](<../../research_notes/Agrogest Cloudflare local/container-before-approval-20261109.json>), [rede sem headers/tokens](<../../research_notes/Agrogest Cloudflare local/rede-container-20261109.json>), [imagem sintética](<../../research_notes/Agrogest Cloudflare local/comprovante-container-20261109.png>), [revisão](<../../research_notes/Agrogest Cloudflare local/ocr-container-revisao-20261109.png>), [original no R2](<../../research_notes/Agrogest Cloudflare local/container-original-r2-20261109.png>) e [indicador após reabertura](<../../research_notes/Agrogest Cloudflare local/container-indicador-20261109.png>). Comandos e limites ficam no [guia operacional](CLOUDFLARE_LOCAL.md#ciclo-do-container-ocr). A imagem ainda não foi testada em ARM64, Windows/macOS ou hospedagem; não foi enviada a registry. Os limites de corpus, Auth, cloud e dispositivos da revisão anterior continuam vigentes.

## 06/11/2026 — versão acadêmica local implementada e executada

Base atribuída a freitasbtw/Freitassync, commit `7f0bb66d764eadc8f48be016280414d77a1d4799`. Alterações feitas somente na cópia própria, conforme autorização de desenvolvimento. Sem fork, push, deploy, provisionamento ou migração remota. [Origem](../../ORIGEM_AGROGEST.md), [plano v3](../../PLANO_AGROGEST_CLOUDFLARE_LOCAL.md) e [guia operacional](CLOUDFLARE_LOCAL.md).

**Resultado:** imagem real de arquivo → Tesseract português → revisão/correção → despesa anexada no R2 local → aprovação de outro sócio/sync → indicador do domínio. Os recibos são imagens sintéticas de teste, não documentos fiscais reais. GS-001 leu R$ 1.250,40; GS-002 leu R$ 89,90. Bruno abriu o original e aprovou a despesa de Ana. O custo passou de R$ 10.000,00 para R$ 11.250,40 e, após a segunda aprovação, R$ 11.340,30 (R$ 1.134,03 por cabeça, 10 animais).

| Verificação executada | Resultado e alcance |
| --- | --- |
| `npm run check` | **231 testes aprovados**: 216 de domínio/SQLite/PGlite e serviços herdados/adaptados, 10 de integração Worker/D1/R2 e 5 Python de OCR; tipos mobile/API e lint mobile sem erro/aviso. Exit 0 |
| Integração D1/R2 | OCR real, custo só após aprovação, autor/funcionário bloqueados, isolamento, replay, corrida de aprovação, pagamento concorrente, estorno, classificação sem reescrever despesa, recorrência/orçamento/importação, financiamento/renegociação, transferência com custo, descarte de rascunho documental e revogação/demissão |
| Persistência e navegador | Capturas/revisões reabertas; envio offline preservado e sincronizado; aprovação offline reaberta como intenção pendente, sem efetivação antecipada; reconexão confirmou uma vez; repetição da imagem ofereceu lançamento existente |
| Shell offline | Reabertura completa sem rede passou no Chromium com SQLite e `crossOriginIsolated=true`. Um defeito de cache/versão/headers encontrado durante QA foi corrigido. Bloqueio OPFS transitório recebe repetição limitada sem apagar dados |
| Rede da validação final | Sessão independente do navegador registrou somente HTTP em loopback, incluindo o WASM da animação local. O download padrão herdado da biblioteca para jsDelivr apareceu durante diagnóstico e foi substituído por asset local com licença MIT; não é declarado zero tráfego externo em toda a investigação |
| Builds | `npm run build:web` passou com shell offline; `npm run export:check` exportou web, Android e iOS. Sem APK/IPA, assinatura ou teste em aparelho |
| Estado local | Três migrations D1 aplicadas apenas localmente; reinicializações preservaram D1/R2 e SQLite. Segredos/estado/pesos ignorados. Nenhum remote novo/Git aninhado; HEAD próprio e TAP original preservados |

Os **114 testes da primeira análise** continuam no [TAP original](<../../research_notes/Agrogest Cloudflare local/baseline-local-20261106.tap>), SHA-256 `3da4b0e25e5b3029cade1b8dda159e714fa3a0ecd9692b55d0926e1fca885368`. Eles são registro anterior; os 231 acima são a execução atual ampliada, incluindo PGlite local. Não somar 114 aos 231 para inflar a contagem.

Evidências e hashes: [registro de validação](<../../research_notes/Agrogest Cloudflare local/validacao-implementacao-20261106.json>), [log final](<../../research_notes/Agrogest Cloudflare local/check-final-20261106.txt>), [rede final](<../../research_notes/Agrogest Cloudflare local/rede-navegador-final-20261106.json>) e [alterações comparadas à base](<../../research_notes/Agrogest Cloudflare local/alteracoes-base-20261106.json>). Capturas: [OCR/revisão](<../../research_notes/Agrogest Cloudflare local/ocr-revisao-web-20261106.png>), [indicador após primeira aprovação](<../../research_notes/Agrogest Cloudflare local/indicador-aprovado-web-20261106.png>), [reabertura offline](<../../research_notes/Agrogest Cloudflare local/reabertura-offline-web-20261106.png>), [intenção de aprovação reaberta offline](<../../research_notes/Agrogest Cloudflare local/aprovacao-offline-reaberta-web-20261106.png>) e [indicador final](<../../research_notes/Agrogest Cloudflare local/indicador-final-web-20261106.png>).

**Limites:** não houve inferência Workers AI/OpenRouter porque não havia credenciais configuradas; os adaptadores remotos continuam sem teste real de conta/modelo. Emulação local não comprova a tecnologia cloud para a GS. RF-20 atende imagens/comprovantes para despesa, não PDF/XML/NF-e completa. Auth usa contas locais sintéticas com senha conferida; cadastro/recovery/e-mail de produção pendentes. Dois recibos legíveis não medem qualidade em campo. Web Chromium foi validado; usar uma aba por conta/origem por causa do pool OPFS do Expo. As descrições hospedadas e medições antigas abaixo permanecem históricas.

---


Registro de evidências por revisão. Contagens de testes, alertas, versões e estados de publicação
valem para a data e o escopo de cada registro; não descrevem automaticamente o estado atual.
Para trabalhar no projeto, use o [índice dos guias atuais](README.md).

## Revisão geral do projeto: 22–23/10/2026

Base da revisão: `62c6127`. Escopo: aplicativo atual em `agrogest-app/`, suas integrações,
testes, estrutura e documentação. O legado e os anexos locais existentes foram preservados.

### Problemas tratados

| Área | Evidência encontrada | Resultado |
| --- | --- | --- |
| Rateio de consumo | Reconstrução do histórico de cada lote para cada dia do período | Integração por eventos e índice de lançamentos por lote |
| Caixa, DRE e exportação | Busca repetida das parcelas para cada item de baixa/renegociação | Índices locais de parcelas, sem mudar sua ordem ou os valores |
| Conciliação bancária | Cada linha do extrato percorria todas as parcelas | Candidatas agrupadas por direção e valor em aberto |
| Histórico e atividade | Cópia do grupo inteiro para acrescentar cada registro | Agrupamento linear com arrays locais |
| Listas | Histórico/rebanho montavam todas as linhas; atividade cortava a coleção em 60 | `SectionListScreen` compartilhada, com virtualização e acesso a todos os registros |
| Sincronização | Eventos de rede recriavam assinaturas e chamadas simultâneas repetiam reloads | Ciclo estável, sincronização compartilhada e pausa em segundo plano |
| Sessão | Refresh de token podia reler SQLite sem mudança de identidade | Carga inicial depende dos dados da identidade, não do objeto da sessão |
| Outbox | Contagem carregava e interpretava todos os payloads | `COUNT(*)` para badges e verificações de fila vazia |
| Avisos locais | Agendamento lento podia recriar avisos da conta após o logout | Reconciliação de notificações serializada |
| Protótipo | Sincronização acrescentava espera artificial de 1,2 s | Execução assim que o trabalho local termina |
| Toque e acessibilidade | Radios sem estado checked, alvos pequenos e callbacks não encaminhados | Estado acessível correto, alvos compartilhados de 44 pt e callbacks preservados |
| Telas estreitas | Título do rebanho e código dos lotes cortados em 320 px | Cabeçalho responsivo e aviso de pesagem abaixo do código |
| Abertura do banco | Bloqueio OPFS podia derrubar a raiz e deixar tela em branco | Mensagem de recuperação e retry preservando banco e URL; falha de migração fecha a conexão |
| Código morto | Cinco arquivos de Box/Icon não tinham importadores, incluindo variantes web | Removidas 3.198 linhas geradas sem referências |
| Dependências | Três pacotes sem importação, configuração ou dependentes no lockfile | Removidos `@legendapp/motion`, `expo-device` e `expo-web-browser` |
| Compatibilidade | `expo install --check` apontava seis patches do SDK | Pacotes alinhados ao Expo SDK 57 pelo instalador do Expo |
| Manutenção | Testes listados manualmente e comandos dispersos | Atalhos na raiz, descoberta de `*.test.mjs` e workflow de qualidade |
| Documentação | README tratava Auth como futuro e onboarding como dependente de pesagem | Modos local/conectado e orientação inicial corrigidos; guia de desenvolvimento e índice adicionados |

Os componentes removidos já não faziam parte das telas. Sua remoção reduz manutenção;
não se atribui a ela redução no tamanho do bundle. Dependências de infraestrutura, peers
e integrações indiretas do Router/Gluestack continuam presentes quando necessárias.

### Estrutura e clean code

As responsabilidades existentes foram mantidas: rotas em `app`, regras puras em `domain`,
persistência em `db`, integrações em `services` e coordenação em `state`. A revisão extraiu
o ciclo de sincronização para um serviço testável e o layout de listas para a camada de UI.
Não houve movimentação em massa de pastas ou adoção de outro framework/gerenciador.

`noUnusedLocals` e `noUnusedParameters` foram habilitados após confirmar que o projeto passa
nessas verificações. Os testes executam os fontes TypeScript atuais, com adaptação restrita
ao runner; configs CommonJS do Expo e Metro permanecem compatíveis.

### Desempenho

O [benchmark reproduzível](PERFORMANCE.md) exige igualdade profunda entre saídas anteriores e
atuais antes de medir. Nesta revisão, os cenários novos reduziram trabalho de CPU em rateio,
caixa, conciliação e exportação. Por exemplo, o rateio de 200 lotes por 92 dias passou de
634,835 ms para 0,984 ms na medição registrada. A repetição na revisão final mediu
628,156 ms e 0,934 ms, respectivamente.

Esses valores são sintéticos e locais, no Node 24.10. Não medem FPS, tempo total de tela,
rede, consumo de bateria ou desempenho do Hermes em um aparelho físico. A virtualização
evita montar a coleção inteira; sua configuração não estabelece por si só um FPS garantido.

### Verificação

O workflow `.github/workflows/quality.yml` (workflow da origem, não incluído nesta cópia) executa tipos,
lint, testes locais e exportação de todas as plataformas. Sua execução no GitHub depende da
publicação das alterações; a validação desta revisão foi local.

- `npm run check`: **177 testes passaram**, além de tipos e lint sem erros.
- `npm run export:check`: passou para web, Android e iOS, incluindo bundles Hermes.
- `npx expo install --check`: compatibilidade dos pacotes do SDK.
- `npx expo-doctor`: **21/21 verificações passaram**.
- `npm run benchmark:domain -- 62c6127`: igualdade das saídas e medições registradas.
- Revisões independentes dos diffs de domínio, UI e sincronização; no domínio, diagnóstico
  adicional de equivalência com 5.456 asserts em 300 cenários determinísticos.

Na última rodada no Windows, o processo Node encerrou com `0xC0000005` após compilar as três
plataformas, antes de concluir a gravação dos assets. A repetição serializada com
`npm --prefix agrogest-app/apps/mobile run export:check -- --max-workers 2` concluiu com
código 0, `metadata.json`, HTML, assets e bundles das três plataformas. As rodadas anteriores
também haviam concluído sem o limite. O limite reduz concorrência de build; não muda o app.

O QA web usa um export no modo local, servido com COOP/COEP para SQLite WebAssembly,
em contexto isolado do navegador e com dados fictícios. Cobriu cadastro, início vazio,
carga dos exemplos, rebanho por lote/pasto, atividade por pessoa e rolagem até o último
registro filtrado, troca de fazenda de 107 para 30 cabeças, financeiro e DRE. A troca para
funcionário removeu o acesso financeiro da interface e preservou os registros autorizados.
Emulação: 320×740 no tema claro e 390×844 no escuro, com redução de movimento.

Foi reproduzido um bloqueio real abrindo duas abas da mesma origem. A nova tela de recuperação
apareceu sem ficar sob o splash. Após fechar a primeira aba e tocar em **Tentar novamente**,
o Histórico abriu com a mesma fazenda e os registros anteriores. Também foi validado o retry
de um bloqueio após navegação completa na mesma aba. O código do lote e o título do rebanho
ficaram legíveis em 320 px, sem rolagem horizontal da página.

No export final, a árvore acessível e o DOM confirmaram `aria-checked` nos radios,
`aria-selected` nas abas e `aria-pressed` nos filtros, incluindo a atualização ao selecionar
Pesagem no Histórico. As propriedades ARIA de seleção são suportadas pelo
[React Native 0.86](https://reactnative.dev/docs/0.86/accessibility) e pelo adaptador web
instalado; `accessibilityState` sozinho não chegava ao DOM.

### Limites e dependências externas

`npm audit --omit=dev` continua apontando **17 alertas no grafo de dependências (14 altos e
3 moderados)**. Os avisos se propagam de `braces`, `node-forge` e `decode-uri-component`
para Metro/CLI, React Native e Expo Router. Isso não representa 17 falhas independentes do
código do AgroGest. Os dois primeiros ainda tinham a versão publicada mais recente dentro
da faixa afetada na consulta; a correção sugerida para o Router migra para SDK 58, e o
`audit fix --force` propõe também downgrades incompatíveis do Expo/React Native.
Essas mudanças não foram aplicadas como correção automática. O inventário foi conferido
antes e depois da atualização compatível do SDK; não é uma declaração de ausência de risco.

O console web também pode avisar sobre foco retido em telas ocultas pelo navegador de rotas
(`aria-hidden`). Foi observado ao navegar entre telas; não impediu os fluxos testados.
A política de foco por navegação merece validação específica com leitor de tela.

As [APIs SQLite web do Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#web-setup)
estão em alpha. O QA reproduziu bloqueio do arquivo OPFS em carregamentos completos da mesma
origem; um reload liberou o arquivo e preservou os dados. Esse comportamento motivou a
recuperação visível de abertura do banco, em vez de uma tela em branco. Não se altera nem
apaga o banco para contornar um bloqueio do navegador.

Esta revisão não alterou schema SQLite, migrations SQL, dados reais ou infraestrutura remota.
**Nenhuma migration precisa ser aplicada por causa destas mudanças.** A execução nativa,
os avisos do sistema e a fluidez em aparelho Android/iOS continuam exigindo teste físico.

## Revisão das alterações para publicação em 25/10/2026

Escopo: alterações locais de interface, despesas, notificações, mapas, cálculo estimado de preço de equilíbrio e ajuda no aplicativo mobile, comparadas com `origin/main`. Revisão estática e testes locais; não constitui auditoria de produção nem teste em aparelho físico.

### Resultado

Nenhum bloqueio de segurança identificado no diff revisado. O fluxo existente de autorização, projeção de dados e aprovação permanece em uso. Não há alteração de schema, migrações, RLS, autenticação ou dependências neste conjunto.

- Os mapas usam as fazendas do contexto autorizado (`scopedFarms`).
- As notificações partem dos registros visíveis e restringem rascunhos e recusados ao autor; aprovações continuam consultando `blockReason`.
- A preferência de ocultação é armazenada por usuário. Ela cobre os cartões principais do Início e do Financeiro; listas, indicadores e relatórios continuam visíveis. O texto de ajuda foi corrigido para explicitar esse limite.
- O contato de suporte usa domínio fixo `https://wa.me/`, número normalizado para dígitos e texto fixo codificado. Não envia dados de conta, fazenda ou lançamentos automaticamente.
- A busca por padrões de credenciais nas linhas adicionadas e nos arquivos novos não encontrou correspondências. Apenas `.env.example` integra o conjunto; `.env.local` permanece fora do versionamento.
- O botão de rascunho de despesa passou a respeitar as regras reais do salvamento. Falhas de persistência agora liberam o formulário e mostram uma mensagem genérica, sem expor detalhes internos.

### Dependências: ressalva preexistente

`npm audit --json` apontou **7 ocorrências: 5 altas e 2 moderadas, nenhuma crítica**. O manifesto e o lockfile mobile são idênticos aos de `origin/main`, portanto esses alertas não foram introduzidos pelas alterações publicadas.

As ocorrências se concentram na cadeia de ferramentas: `expo` → `@expo/cli` → `@expo/code-signing-certificates`, `node-forge` e `zod`; e `@expo/ngrok` → `uuid`. A contagem inclui pacotes afetados pela mesma dependência transitiva, não sete falhas independentes. Não foi demonstrada exploração no aplicativo instalado.

Referências reportadas pelo registry:

- [node-forge: verificação RSA](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Zod: consumo de memória](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [uuid: limites do buffer](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

A correção exige uma atualização compatível e validada dessas ferramentas. O próprio audit sugere downgrade incompatível do Expo para parte das ocorrências; não foi aplicado `npm audit fix --force`. A pendência permanece aberta.

### Evidência local

- 194 testes passaram, incluindo isolamento entre contas, leitura sem autenticação, permissões de funcionário, revogação de acesso, aprovações e integridade financeira.
- Typecheck e lint passaram após os ajustes finais.
- Typecheck adicional sem `expo-env.d.ts` e tipos gerados em `.expo` passou. A declaração versionada `src/styles.d.ts` corrige o erro TS2882 de importação do CSS que já quebrava o CI da main no run `40237152881`.
- Exportação de web, Android e iOS validada localmente; repetida após os ajustes finais antes da publicação.
- A auditoria das dependências dos testes (`agrogest-app`) não apontou vulnerabilidades.
- Nenhuma migração precisa ser aplicada para estas alterações.

## Revisão local de segurança e qualidade: 26/10/2026

Escopo: alterações pendentes do app `apps/mobile` sobre `842cbf5`, incluindo arquivos novos.
Revisão estática e testes locais; não é uma auditoria do Supabase em produção nem um teste
de invasão. Não houve commit, publicação, alteração remota ou migração de banco nesta revisão.

### Segurança

- Nenhum novo desvio de autenticação ou autorização foi identificado no escopo revisado.
  O callback mantém a verificação da sessão antes de liberar o aplicativo. A mudança local
  nessa tela substitui a indicação de carregamento.
- O SQLite e os provedores continuam separados pela identidade da conta (`databaseName` e
  `DatabaseBoundary` com chave por conta). Os pedidos conectados mantêm a conferência de
  identidade em `cloudToken`; a seleção do workspace mantém o filtro de vínculos e o
  financeiro restrito ao sócio.
- Dois testes adicionais exercitam `shareSnapshot` junto com `selectWorkspace`: perda do
  cargo de sócio remove o financeiro, e remoção do vínculo remove fazendas, registros e
  atividade, mesmo reaproveitando referências de tabelas que não mudaram.
- A busca por padrões de chaves privadas, tokens GitHub/AWS, segredos Supabase e JWT de
  `service_role` em 67 arquivos de texto alterados/novos não encontrou ocorrências. Essa
  busca por padrões não prova ausência de todo tipo de segredo. A chave configurada em
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` foi conferida sem exibir seu valor: é pública.
- Os JSON das animações e pôsteres locais não apresentaram URLs externas, scripts,
  `foreignObject` ou `onload`. A instrumentação de desempenho contém apenas contadores e
  permanece limitada ao desenvolvimento web.
- Não há alteração de serviços, esquema, migrações ou políticas de banco neste conjunto.

### Dependências: pendência anterior confirmada

`npm audit --json` retorna 7 ocorrências: 5 altas e 2 moderadas, sem críticas. A contagem
inclui os pacotes afetados por dependências transitivas, não sete falhas independentes.

| Origem | Caminho instalado | Aviso |
| --- | --- | --- |
| `node-forge@1.4.0` | Expo CLI e assinatura de certificados | [Verificação RSA](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| `zod@3.25.76` | Expo CLI e ferramentas de lint | [Consumo de memória na validação de coleções](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| `uuid@3.4.0` | `@expo/ngrok@4.1.3` | [Limites do buffer em v3/v5/v6](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

Esses caminhos são de ferramentas de desenvolvimento/empacotamento. A revisão não demonstrou
exploração pelo aplicativo instalado; isso não elimina a exposição das ferramentas. Pacotes
e lockfiles ficaram intactos. A correção automática sugerida pelo npm inclui retornar ao
Expo 44, incompatível com a base SDK 58, portanto não foi aplicada.

### Limpeza aplicada

- Removidos `SkeletonText` nativo e web, seus tipos e os estilos exclusivos: não tinham
  consumidores; as linhas de carregamento reais usam `BoneLines`.
- Removidos `PREFERENCE_SETTING` e a reexportação de `ContextTransition` em `app-state`:
  não tinham consumidores. O tipo continua no módulo de sincronização que o utiliza.
- `perfProbe`, `onProfilerRender` e `VOLATILE_SETTINGS` passaram a ser internos aos seus
  módulos; não havia importadores externos.
- Agrupadas três duplas de atualizações do store de sincronização: cada alteração conjunta
  emite uma notificação, sem mudar as verificações de acesso ou os dados persistidos.
- Corrigidos indentação dos provedores, comentário do gerador que apontava para o antigo
  `posters.json` e quebras de linha Markdown com espaços finais.
- Nenhuma referência aos geradores antigos ou ao arquivo agregado de pôsteres permanece
  nos fontes, scripts e documentação revisados. As capturas e o medidor foram preservados
  porque documentam e permitem reproduzir a revisão de desempenho.

### Validação

- `npm test`: 201 testes aprovados, zero falhas.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: aprovado.
- `npm run lint`: aprovado.
- `git diff --check`: aprovado.
- `npx expo export --platform all --max-workers 2 --output-dir .expo/qa/security-clean-code-20261026`:
  aprovado para web, Android e iOS. Confirma empacotamento, não execução em aparelho real.
- Estrutura das 11 animações e dos 11 pôsteres: aprovada; cada animação abaixo de 15 KiB.
- Metro existente: `/status` retorna `packager-status:running`.

Permanecem fora desta verificação: comportamento em aparelho real, regras remotas atuais e
exploração dinâmica dos avisos de dependências. As mudanças não comprovam ausência de falhas
em todo o produto.
