# Supabase — referência histórica da origem

> **Versão acadêmica, 06/11/2026:** Supabase foi substituído pelo [Worker/D1/R2 locais](CLOUDFLARE_LOCAL.md). SDK removido; não executar a configuração/provisionamento remoto descritos abaixo. As migrations e testes PGlite são preservados como referência da origem. O texto seguinte registra a integração até outubro, sem afirmar execução remota nesta adaptação.

Esta integração pertence ao aplicativo em `apps/mobile`. O projeto e as tabelas do legado não são reutilizados.

## Estado implementado (conferência local: 26/10/2026)

- Cliente Supabase com chave publicável, cadastro/login por senha e sessão persistente. No Android/iOS, a sessão usa SecureStore com gravação por gerações; no navegador, localStorage da origem.
- Confirmação de e-mail e recuperação por link PKCE, com rotas `/auth/callback` e `/recuperar-senha`.
- Operações, vínculos, fazendas, lotes, convites por e-mail da conta e lançamentos no PostgreSQL.
- Pesagens, despesas com parcelas/rateio, mortalidade e vendas passam por comandos autenticados, idempotentes e auditados. Aprovações e saldo são validados no servidor.
- SQLite separado por ID de conta, fila persistente e sincronização ao recuperar conexão, voltar ao aplicativo, solicitar manualmente ou após 30 segundos em primeiro plano.
- Dados confirmados são substituídos atomicamente no cache; alterações pendentes não são sobrescritas. O schema SQLite atual é v14; migrations locais preservam os dados e a fila.
- Importação de documentos/IA e anexos ainda não fazem parte da integração. A simulação fiscal fica disponível somente no protótipo local.

**Provisionamento remoto e testes hospedados precisam de evidência datada no histórico abaixo.** A presença da migração no repositório não prova sua aplicação.

## Configurar

1. Criar um projeto Supabase dedicado ao novo AgroGest, na organização escolhida pelo usuário.
2. Em um projeto vazio, aplicar **todas** as migrations de `supabase/migrations/` em ordem de versão, começando por `20261018222440_agrogest_foundation.sql`. Só a fundação não inclui os comandos de pastos, estoque e financeiro usados pelo app atual. Em projeto existente, conferir o histórico remoto e aplicar somente as pendentes. Não aplicar no banco do legado ou no Noude.
3. Copiar `apps/mobile/.env.example` para `.env.local` e preencher a URL e a chave **publicável**. Nunca usar chave secreta/service role no aplicativo.
4. Configurar o Auth com senha mínima de 8 caracteres e confirmação de e-mail habilitada. Adicionar as URLs de retorno do aplicativo à lista autorizada. A função `authRedirect()` usa `Linking.createURL('/auth/callback')` para respeitar Expo Go, build próprio e web.
5. Para build próprio, autorizar `agrogest://auth/callback` e `agrogest:///auth/callback`. Para web local, autorizar `http://localhost:8081/auth/callback` e `http://127.0.0.1:8081/auth/callback`. Em Expo Go, autorizar o endereço `exp://…/--/auth/callback` da sessão atual; links mudam quando o servidor/túnel muda. Evitar curingas amplos na distribuição final.
6. Configurar SMTP próprio antes de abrir cadastro para produtores externos; o envio padrão do Supabase tem restrições de destinatários e frequência. Validar confirmação e recuperação no aparelho que iniciou o fluxo PKCE.
7. Reiniciar o Expo depois de mudar as variáveis de ambiente.

Sem as duas variáveis, o app continua explicitamente no protótipo local, com banco `agrogest-prototipo.db`. Dados antigos do protótipo não são enviados automaticamente: é necessário definir e revisar uma migração de dados separada.

## Autoridade e privacidade

O schema `private` não está exposto pela Data API. Suas tabelas têm RLS e não concedem acesso direto a `anon`/`authenticated`. Os RPCs públicos são `SECURITY INVOKER`; chamam implementações privadas `SECURITY DEFINER` que verificam a identidade confirmada e os vínculos atuais. O privilégio adicional existe apenas para executar os comandos transacionais e produzir a projeção autorizada.

- Somente sócios criam lotes, editam fazendas, convidam/cancelam convites e registram vendas.
- O destinatário aceita um convite usando a conta com o mesmo e-mail confirmado. O app não dispara mensagens externas de convite; o destinatário encontra o convite em Atividade › Convites após entrar e sincronizar. A gestão de membros fica em Pessoas.
- Funcionários recebem quantidades de venda para manter o saldo correto, mas valores, comprador e notas financeiras da venda são omitidos. Custos de compra e aluguel simbólico são zerados na projeção. Despesas de terceiros são omitidas; o funcionário pode consultar a despesa que ele próprio registrou.
- Ninguém aprova o próprio lançamento. Financeiro exige outro sócio. Vínculos são consultados no banco, não em metadados editáveis do JWT.
- A decisão atual do produto é mantida: sem outra pessoa elegível, o **servidor** efetiva o registro após validar o saldo. A documentação anterior exigia segunda aprovação mesmo para o produtor sozinho; esta exceção está explicitada no RF-16.
- Reenvio usa o mesmo UUID de comando e payload congelado. Reutilizar o UUID com dados diferentes falha. Revisões conhecidas não são atualizadas silenciosamente para contornar conflitos.
- Aprovação e reserva de cabeças bloqueiam a operação até o fim da transação. Um lançamento aprovado não aceita edição ou descarte pelo comando de rascunho.
- Notas fiscais simuladas não podem virar dados financeiros na nuvem.

## Offline e recuperação

Os números locais são provisórios enquanto houver fila. O aplicativo mostra a quantidade pendente e erros de envio. Uma falha preserva a fila e impede a substituição dos dados locais por uma resposta anterior.

Em **Mais → Sincronização**, é possível repetir o envio ou, após confirmação explícita na tela e consulta bem-sucedida ao servidor, descartar a fila local e recuperar os registros confirmados. Uma resposta perdida não duplica registros e não remove o que o servidor já aceitou.

O primeiro login e a recuperação de senha exigem conexão. O cache não fornece autoridade para confirmar operações sem o servidor. A revogação de acesso não apaga instantaneamente dados de um aparelho desconectado. A sessão nativa é protegida pelo sistema; o banco SQLite ainda não tem criptografia própria. Criptografia de cache e política de expiração/revogação offline continuam pendentes de validação em builds próprios.

## Verificar

```sh
cd agrogest-app
npm ci
npm run test:database
cd apps/mobile
npm ci
npm run typecheck
npm run lint
npx expo export --platform all
```

Os testes usam PostgreSQL real em WASM (PGlite) com um schema Auth de teste e SQLite do Node 24. Eles verificam isolamento, autorização, idempotência, aprovações, rateio, saldo e preservação da migração local. Não substituem GoTrue, e-mails, concorrência de conexões independentes e testes em aparelhos físicos.

No projeto hospedado, conferir histórico de migrações, objetos/grants, RLS, advisors e comportamento com duas contas autenticadas. Testar duas sessões simultâneas, perda de resposta, reconexão, troca de conta, reinício do aparelho, convite, revogação e tentativa de acessar operação alheia.

## Histórico de provisionamento e contratos

Os registros abaixo descrevem aplicações e validações nas datas indicadas. Não houve
consulta ao projeto remoto nesta revisão documental de 26/10/2026; sua configuração atual
não foi revalidada. Contagens e resultados não devem ser tratados como checks recém-executados.

### Gestão de pessoas: 21/10/2026

A migração `20261021100516_people_management.sql` foi aplicada no projeto novo `aomkvgosqgfuhzllnmic`. O convite exige somente o e-mail e o cargo; o nome vem da conta, sem busca pública de usuários. Para quem ainda não tem conta, o convite aparece pelo e-mail e passa a usar o nome quando a conta existir. Payloads antigos com nome continuam aceitos, mas esse nome não substitui o da conta. Convites duplicados e para membros atuais são recusados.

Sócios podem abrir uma pessoa em Pessoas, alternar entre sócio e funcionário ou remover o vínculo com a operação. `update_member` e `remove_member` exigem `previous: { role, sharePct }`, são serializados pela operação, idempotentes e auditados. Não permitem alterar o próprio acesso nem o do criador da operação. A remoção preserva Auth, perfil, demais operações e histórico; rebaixar para funcionário apaga a participação percentual. A gestão de acessos é online, sem fila pendente nem alteração otimista. O servidor usa os vínculos atuais; aparelhos desconectados só atualizam o cache ao sincronizar. Se um comando pendente for recusado por perda de acesso, a projeção autorizada da operação substitui seu cache, preservando a fila para resolução e as outras operações.

SQLite v13 adiciona `operations.owner_id`, preservando os dados e a fila existentes. O servidor projeta `ownerId` para proteger o criador também na interface. Validação: 118 testes passaram, incluindo convites sem nome, nome atualizado da conta, proteção do criador e do próprio acesso, promoção/rebaixamento, conflito de edição, revogação e preservação da fila na atualização de permissões. Teste hospedado com papel `authenticated` validou rebaixamento, ocultação financeira, remoção em uma operação sem afetar a outra e convite por e-mail com nome da conta; tudo foi desfeito por rollback. Vínculos reais e dados dos lotes preservados; advisors sem novos avisos de segurança.

### Validação da entrega: 18/10/2026

- Projeto [agrogest-app](https://supabase.com/dashboard/project/aomkvgosqgfuhzllnmic), referência `aomkvgosqgfuhzllnmic`, criado na Freitassync's Org, região São Paulo (`sa-east-1`), plano Free e cotação de US$ 0/mês. Não realizar upgrade ou ativar recursos pagos. O projeto antigo `Agrogest` (`ypnvvmbvaykmkbknrlip`) foi pausado com autorização do usuário para liberar a cota; seus dados não foram migrados.
- Migrações `20261018222440_agrogest_foundation` e `20261018222557_operation_owner_index` aplicadas no projeto novo e conferidas no histórico remoto. RLS habilitado nas nove tabelas privadas; os dois RPCs públicos são invoker. Índice de proprietário adicionado após advisor de performance.
- Configuração Auth aplicada: confirmação de e-mail, senha mínima de 8 caracteres, troca segura e redirects explícitos. `.env.local` configurado localmente com URL/chave publicável e ignorado pelo Git. Tipos públicos gerados do projeto hospedado.
- 13 testes locais passaram, além de lint, TypeScript e exportação Expo para Android, iOS e web.
- `tests/hosted-smoke.mjs` passou com quatro contas descartáveis: login real, recusa anônima, isolamento, convite por destinatário, ocultação financeira para funcionário, repetição simultânea do mesmo UUID, reserva concorrente de cabeças, autor separado do aprovador e recusa de revisão obsoleta.
- No navegador, login, leitura do workspace, criação pela fila e persistência após recarga foram conferidos. A fazenda criada pela interface também foi consultada diretamente no banco remoto. Contas e registros de teste foram removidos ao final.
- Advisor de segurança: aviso de proteção contra senhas vazadas desativada. Esse recurso exige Pro, conforme a [documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); o projeto permanece no Free. Avisos informativos de índices ainda sem uso são esperados no banco recém-criado.
- Pendente: SMTP próprio e validação de confirmação/recuperação por e-mail com destinatários externos; fluxo offline completo, troca de conta, SecureStore e callbacks em aparelho físico. Exportar bundles não comprova esses fluxos nativos.

O teste hospedado é manual e exige `SUPABASE_TEST_PROJECT_REF` e CLI autenticada. Ele cria contas e dados descartáveis, guarda as credenciais apenas em `.expo/qa/hosted-fixture.json` (ignorado) e impede sobrescrever uma fixture existente. Após o teste, remover exclusivamente os registros das operações da fixture e quaisquer operações criadas manualmente por essas contas, respeitando as FKs, e executar `node tests/hosted-smoke.mjs --delete-auth-fixture` para remover os usuários Auth e a fixture local. Não executar em projetos com dados de clientes.

## Números de documentos da compra: 18/10/2026

O lote aceita `gtaNumbers` e `invoiceNumbers`, listas opcionais de números em texto. O cadastro e a edição permitem adicionar/remover números, ignoram campos vazios, removem repetições exatas e preservam zeros à esquerda, séries e separadores. Os números aparecem no resumo do lote. Esta funcionalidade não envolve envio de arquivos nem emissão ou validação fiscal dos documentos.

SQLite v4 adiciona as duas listas como JSON, com valor inicial vazio, em uma transação que preserva os lotes e a fila pendente das versões v2/v3. O Supabase já persistia o payload completo do lote; a migração `20261018232902_lot_purchase_documents.sql`, aplicada no projeto novo `aomkvgosqgfuhzllnmic`, adiciona validação das listas opcionais (até 100 documentos por tipo, 100 caracteres por número). Lotes e clientes anteriores continuam aceitos sem esses campos. Os tipos públicos dos RPCs continuam JSON.

Os 14 testes locais verificam migração, persistência com e sem documentos e leitura posterior. O teste hospedado também confirmou duas GTAs e duas notas no retorno autenticado do workspace; as fixtures foram removidas sem alterar os dados do usuário.

## Edição do lote: 19/10/2026

Sócios corrigem os dados de raiz do lote depois do cadastro pelo comando `update_lot`: código, categoria, data e peso de entrada, cabeças compradas, pasto, origem, custos de entrada, GTAs e notas fiscais. Fazenda e operação não mudam, porque pesagens, vendas e rateios pertencem a elas.

A migração `20261019002750_update_lot.sql`, aplicada no projeto novo `aomkvgosqgfuhzllnmic`, renomeia a implementação anterior para `private.command_base` e cria um `private.command` que trata apenas `update_lot` e delega os demais comandos sem mudança. O comando é idempotente e auditado como os outros, bloqueia a operação e exige o estado anterior (`previous`) igual ao do servidor; se o lote mudou em outro aparelho, a edição é recusada. O servidor recusa reduzir as cabeças abaixo das vendidas, mortas ou aguardando aprovação e mover a entrada para depois do primeiro lançamento do lote. O código continua único por operação. O app aplica as mesmas regras offline (`src/domain/lot-edit.ts`), contando também os lançamentos ainda não enviados.

Os testes locais cobrem permissão de funcionário, conflito de versão, saldo de cabeças, data, código duplicado, documentos inválidos, repetição do comando e projeção sem custos para funcionário.

## Mapa da fazenda: 19/10/2026

A migração `20261019012509_farm_map.sql`, aplicada no projeto novo `aomkvgosqgfuhzllnmic`, adiciona `private.farms.boundary` (anel GeoJSON fechado de `[lng, lat]`, 3 a 500 vértices, validado por `private.valid_ring`) e a posição do lote em `lots.data.location` (validada por `private.valid_position`). `private.workspace()` passa a devolver `boundary` em cada fazenda, para todos os membros: não é dado financeiro. A implementação anterior fica em `private.workspace_base`.

`private.command` (o mesmo despachante do `update_lot`) ganha:

- `update_farm_boundary` `{ id, operationId, boundary | null, previous }`: só sócio; `previous` precisa ser igual ao contorno atual (ou `null`), senão a edição é recusada por conflito.
- `place_lot` `{ id, operationId, location | null }`: qualquer membro da operação; `null` tira o pino. `update_lot` preserva a posição.

A área em hectares é calculada no app (`src/domain/geo.ts`, fórmula geodésica do Turf) e não é guardada. O servidor valida forma e coordenadas; cruzamento de linhas é barrado no app. SQLite v5 adiciona `farms.boundary` e `lots.location` como JSON, preservando lotes e fila das versões anteriores.

Imagens: Esri World Imagery. Sem chave, o protótipo usa o endpoint público; para uso comercial, criar conta grátis no ArcGIS Location Platform e definir `EXPO_PUBLIC_ARCGIS_API_KEY` (o app passa a usar `ibasemaps-api.arcgis.com` com token). Atribuição exibida no mapa: Esri, Maxar, Earthstar Geographics.



## Pastos, movimentações de manejo e GMD por pasto: 19/10/2026

Issue #43. Com autorização do usuário, as migrações `20261019181210_pastures_manejo` e `20261019181253_pastures_farm_index` foram **aplicadas no projeto novo `aomkvgosqgfuhzllnmic` em 19/10/2026** e conferidas no histórico remoto (os arquivos usam as versões registradas lá). A conversão ligou os 2 lotes existentes a 2 pastos convertidos, com IDs iguais ao cálculo do app; RLS está habilitado em `private.pastures` e não há grant direto para `authenticated`. Advisor de segurança: só o aviso já conhecido de proteção de senhas vazadas (exige Pro). Advisor de performance apontou a FK `(farm_id, operation_id)` sem índice, corrigida pela segunda migração; os demais avisos são de índices ainda sem uso. Nunca aplicar no legado/Noude.

### Modelo

- `private.pastures`: pasto da fazenda (`farm_id`, `operation_id`), nome normalizado único por fazenda (`name_key`, gerado por `private.pasture_key`), área útil em ha (`area_ha`, positiva; nula só nos convertidos), capim (`forage`), observações, `active` e `legacy`. Não há exclusão: inativar preserva o histórico. Todos os membros da operação veem os pastos (não é dado financeiro).
- O lote ganha `data.pastureId`, o pasto de **entrada**. `managementGroup` continua gravado com o nome do pasto, para clientes antigos e para não perder o texto original.
- Mudança de pasto é o lançamento `kind = 'manejo'` (`lotId`, `fromPastureId`, `toPastureId`, `heads`, `notes`). Usa o fluxo atual: comando idempotente `save_entry`, aprovação por outra pessoa (operacional: qualquer membro elegível; autor nunca aprova), efetivação direta só sem aprovador elegível, histórico e auditoria. Não é compra, venda nem transferência entre fazendas: o lote econômico, custos e histórico continuam os mesmos.
- Pesagem, mortalidade e venda aceitam `payload.pastureId` opcional: o grupo do lote a que o registro se refere quando o lote está dividido.

### Conversão do texto antigo

Cada `managementGroup` distinto por fazenda vira um pasto `legacy` com ID `md5(fazenda:nome normalizado)`, sem área e sem capim (não são inferidos). A conversão é idempotente e o app calcula o mesmo ID no SQLite (`legacyPastureId`), de modo que o cache local e o servidor concordam antes da primeira sincronização. `create_lot` e `transfer_lot` vindos de clientes antigos, sem `pastureId`, recebem o pasto convertido do texto. `update_lot` passa a comparar `pastureId` em `previous`: um cliente antigo é recusado ("mudou em outro aparelho") em vez de apagar a referência.

### Saldo por pasto

`private.lot_pasture_replay` reconstrói os grupos do lote a partir da entrada e dos lançamentos aprovados (e, ao salvar, dos que aguardam aprovação), em ordem de ocorrência e captura. `private.entry_status` usa essa reconstrução para `manejo`, `mortalidade`, `venda` e `pesagem`: movimentação acima do saldo do pasto, baixa acima do grupo informado, data anterior à entrada do lote ou lançamento retroativo que contradiga registros posteriores viram **conflito**, com o motivo específico em `conflictReason`. Tudo ocorre sob o bloqueio da operação, então duas pessoas não reservam as mesmas cabeças. `update_lot` é recusado se a nova entrada (cabeças, data ou pasto) contradisser as movimentações. Baixas antigas sem pasto informado saem dos maiores grupos, como no app.

Validações adicionais: pastos da movimentação na mesma fazenda e operação, origem ≠ destino, destino ativo, data não futura (America/Sao_Paulo). `create_pasture` e `update_pasture` exigem sócio; `update_pasture` exige `previous` igual ao servidor e recusa inativar pasto com animais confirmados ou chegadas pendentes.

### Projeção

`private.workspace()` (a anterior fica em `private.workspace_before_pastures`) devolve `pastures` e passa a enviar a funcionários as movimentações de toda a operação, para a ocupação que eles veem ser a mesma dos sócios. `private.command` (anterior em `private.command_before_pastures`) trata os comandos de pasto e acrescenta o pasto estruturado a `create_lot`, `update_lot` e `transfer_lot`.

### App e cache

SQLite v8 cria `pastures`, adiciona `lots.pasture_id` e converte os nomes antigos na mesma transação, preservando lotes e fila. O GMD por pasto é calculado no app (`src/domain/pasture.ts`): só intervalos entre duas pesagens do mesmo grupo, no mesmo pasto e sem mudança de pasto ou de composição (entrada, saída, morte, venda) entre elas. Mover o grupo inteiro no dia da pesagem preserva o peso como abertura do novo pasto. Peso de entrada herdado de transferência entre fazendas não serve de base. Estimativas visuais e amostras parciais são sinalizadas; sem base válida, a tela mostra "Dados insuficientes".

### Verificação local

`npm run test:database` (48 testes) cobre cadastro e unicidade de pastos, conversão SQLite v7 → v8 e no servidor, lotes de clientes antigos, movimentações total e parcial, saldo e custo do lote preservados, autor ≠ aprovador, repetição do mesmo comando, duas reservas concorrentes, data futura/anterior à entrada, pasto inativo ou de outra fazenda, edição do lote contra movimentações, inativação de pasto ocupado, transferência para pasto da fazenda de destino e GMD com e sem base suficiente. `tests/hosted-smoke.mjs` ganhou o cenário de duas contas, em conexões independentes, movendo as mesmas cabeças entre pastos (uma reserva, outra vira conflito), aprovação e repetição; ao limpar a fixture, remover também as linhas de `private.pastures` das operações dela. Pendente: aplicação no projeto hospedado (exige autorização), execução desse teste hospedado e teste com contas reais em aparelhos físicos.

### Correção: réplica após transferência e venda mascarada (19/10/2026)

A migração `20261019220418_pastures_replay_fixes.sql` alinha o servidor ao app em dois pontos. (1) `private.lot_pasture_replay` passa a esvaziar os pastos do lote transferido para outra fazenda, como `lotPastureTimeline`; antes, os pastos de origem ficavam ocupados para sempre e não podiam ser inativados. A implementação anterior fica em `private.lot_pasture_replay_before_transfer`. (2) `private.workspace()` devolve `payload.pastureId` na venda mascarada que funcionários recebem (o pasto não é dado financeiro); sem ele, o app do funcionário distribuía a saída entre os maiores grupos e a ocupação divergia da do servidor. Os lançamentos voltam a sair ordenados por criação, também depois das movimentações acrescentadas para funcionários. Testes: `npm run test:database` (50). **Aplicada no projeto novo `aomkvgosqgfuhzllnmic` em 19/10/2026**, conferida no histórico remoto (o arquivo usa a versão registrada lá); advisors sem avisos novos. Nunca aplicar no legado/Noude.

### Contorno opcional do pasto no mapa (19/10/2026)

A migração `20261019220436_pasture_boundary.sql` adiciona `private.pastures.boundary` (anel GeoJSON validado por `private.valid_ring`, como o da fazenda) e o comando `update_pasture_boundary` (`{ id, operationId, boundary | null, previous }`). Só sócio desenha; o contorno anterior precisa coincidir com o do servidor (senão "mudou em outro aparelho"); `null` apaga. É um comando separado de `update_pasture`, para o cadastro e o desenho não se sobrescreverem. `pasture_json` devolve `boundary` para todos os membros (não é financeiro). A implementação anterior do despachante fica em `private.command_before_pasture_boundary`. No app: SQLite v9 (`pastures.boundary`), desenho em Mais › Fazendas › mapa › "Desenhar pastos" ou no detalhe do pasto, com a fazenda tracejada de referência e aviso se o pasto sair dela; os pastos aparecem no mapa coloridos pelo estado (ocupado/descanso) com nome e cabeças. O desenho não altera a área útil cadastrada. Testes: `npm run test:database` (53). **Aplicada no projeto novo `aomkvgosqgfuhzllnmic` em 19/10/2026**, conferida no histórico remoto (o arquivo usa a versão registrada lá); advisors sem avisos novos. Nunca aplicar no legado/Noude.

### Exclusão de pasto nunca usado (19/10/2026)

A migração `20261019220451_delete_pasture.sql` adiciona o comando `delete_pasture` (`{ id, operationId }`): só sócio, sob o bloqueio da operação, e só se `private.pasture_in_use` for falso, ou seja, nenhum lote tem `pastureId` igual e nenhum lançamento (`manejo` de origem/destino; `pesagem`, `mortalidade`, `venda` com `pastureId`), de qualquer situação, cita o pasto. Com histórico, o servidor recusa e orienta a inativar. O app aplica a mesma regra offline (`pastureInUse` em `src/domain/pasture.ts`), contando também rascunhos e lançamentos ainda não enviados. Testes: `npm run test:database` (55) e `tests/pasture.test.mjs`. **Aplicada no projeto novo `aomkvgosqgfuhzllnmic` em 19/10/2026**, conferida no histórico remoto (o arquivo usa a versão registrada lá); advisors sem avisos novos. Nunca aplicar no legado/Noude.

### Atividade da fazenda (19/10/2026)

A migração `20261019235702_activity_log.sql` projeta a trilha `private.audit_events` (que todo comando já grava) em `workspace().activity`: as 300 ações mais recentes das operações do usuário, cada uma com `actorId`, `actorName`, `kind`, `at`, `farmId` e um `subject` resumido (`private.activity_item`), sem valores em dinheiro. O nome de um pasto excluído vem do último comando que o cadastrou ou editou (`private.pasture_trace`, com índice em `commands(kind, payload->>'id')`). Sócio vê tudo; funcionário vê só o que é de campo (pastos, mapa, lote cadastrado/posicionado, entrada na operação, e pesagem, morte e mudança de pasto), filtro em `private.activity_visible`. No app: SQLite v10 (`activity`), ícone de histórico ao lado do sino com ponto para ações novas de outras pessoas e a tela Atividade, agrupada por dia e seguindo a fazenda do contexto. No protótipo local, a atividade é montada do histórico dos lançamentos e dos cadastros de pasto. Testes: `npm run test:database` (60). **Aplicada no projeto novo `aomkvgosqgfuhzllnmic` em 19/10/2026**, conferida no histórico remoto (o arquivo usa a versão registrada lá): as 28 ações já registradas viram atividade, todas com o nome de quem fez e nenhuma com valor em dinheiro; advisors sem avisos novos. Nunca aplicar no legado/Noude.

### Financeiro base (issue #46, fase 1): 20/10/2026

A migração `20261021093550_finance_base.sql` cria `private.financial_accounts`, `private.categories`, `private.counterparties` e `private.payments`, com RLS (categorias para todos os membros; contas, contatos e baixas só para sócios) e sem grant direto para `authenticated`. **Contas a pagar e a receber não têm tabela**: são as parcelas dos lançamentos aprovados (despesa, nota revisada e venda), identificadas por lançamento + índice (`private.installment_cents`). Venda sem parcelas recebe o líquido (bruto pela arroba − deduções) na data da venda; despesas antigas com parcelas viram contas em aberto sem migração de dados.

Comandos novos no despachante (`private.command_before_finance` guarda o anterior), todos só de sócio, idempotentes e auditados:

- `create_account` / `update_account` (`previous` igual ao servidor; o saldo inicial, que pode ser negativo, não pode começar depois de uma baixa efetivada).
- `create_category` (natureza do plano; não repete o nome de uma categoria padrão) e `save_counterparty` (fornecedor/cliente, com CPF/CNPJ e chave Pix).
- `register_payment` `{ id, operationId, direction, accountId, paidAt, items: [{ entryId, index, cents }], interestCents, fineCents, discountCents, method, proof, notes }`: sob o bloqueio da operação, compara cada item com o valor em aberto (`private.settled_cents`, só baixas efetivadas). Obrigação não aprovada, valor acima do aberto, direção errada, conta inativa ou data anterior ao saldo inicial **não travam a fila**: a baixa é gravada com situação `conflito` e o motivo. Data futura e dados malformados são recusados.
- `reverse_payment`: baixa efetivada vira `estornado` (motivo obrigatório); em conflito vira `descartado`. Nada é apagado.

- `set_lot_payment_plan` `{ id, operationId, plan | null, previous }`: como a compra do lote é paga. `plan.parts` tem animais, comissão e frete (cada parte com vendedor/prestador e parcelas que fecham o valor dela, `private.validate_purchase_plan`) e fica em `lots.data.purchasePlan`. As parcelas viram contas a pagar (`private.lot_installment_cents`, ordem fixa animais → comissão → frete) e a baixa usa o ID do lote no lugar do lançamento. Lote sem plano (os antigos) não é conta. Com pagamento efetivado, o plano não muda e `update_lot` recusa mudar os valores da compra; sem pagamento, mudar os valores descarta o plano. `create_lot` não aceita plano (vem por este comando). Funcionário recebe o lote sem o plano.

`validate_entry` (anterior em `private.validate_entry_before_finance`) aceita `categoryId` (padrão de `private.default_categories()`, a mesma lista de `DEFAULT_CATEGORIES` no app, conferida por teste, ou categoria da operação) e `counterpartyId` da operação; parcelas da venda precisam fechar o valor líquido. `workspace()` (anterior em `private.workspace_before_finance`) devolve `financialAccounts`, `counterparties` e `payments` só para sócios e `categories` para todos. A venda mascarada do funcionário continua sem parcelas nem valores. A atividade mostra "registrou um pagamento · 2 parcelas", sem valores, só para sócios.

Em 21/10/2026, o app passou a mostrar **Compras sem pagamento informado** no início (Essencial, Gerencial e Analítico), no Financeiro, em Pendências e no sino (desde 23/10/2026, Pendências é o filtro *Para você* da Atividade, aberto pelo sino). O atalho abre o pagamento do lote de compra original, inclusive encerrado ou transferido; o contexto da fazenda de destino também inclui a origem acessível ao sócio, sem duplicar a compra. O sino considera todas as fazendas; as demais telas seguem a fazenda selecionada. Somente sócios da operação da compra recebem o aviso. Compras com valor zero, lotes recebidos por transferência e compras que já têm plano não geram outro lembrete. O valor informado ainda não é saldo devedor: o aviso pede confirmar se já foi pago ou será pago e desaparece ao salvar o plano. Nenhuma nova migração é necessária para esse aviso.

### Gestão financeira (issue #46, fases 2 e 3): 22/10/2026

A migração `20261022110210_finance_management.sql` completa o financeiro. Como na fase 1, **contas a pagar e a receber não ganham tabela**: cada origem gera as suas parcelas e `private.obligation_info(op, origem, índice, direção)` devolve o devido de qualquer uma (lançamento aprovado, compra do lote, financiamento, renegociação, conta importada ou reembolso a sócio). As baixas continuam em `private.payments`.

- **Cartão de crédito:** `financial_accounts.kind = 'cartao'`, com `closing_day` e `due_day` (1 a 28, obrigatórios só no cartão). Pagar com o cartão é uma baixa na conta-cartão; a fatura (compras do ciclo − pagamentos) é derivada no app e se paga com uma transferência para o cartão com `invoiceMonth`. A competência da despesa fica na data da compra.
- **Baixa sem conta:** `payments.account_id` passa a aceitar nulo, com exatamente uma origem (`num_nonnulls(account_id, partner_id, advance_id) = 1`): conta da operação, **sócio que pagou com dinheiro próprio** (`partner_mode` reembolso ou aporte) ou **compensação de adiantamento de cliente** (`advance_id`, só recebimento, até o saldo do adiantamento). Reembolso vira conta a pagar ao sócio (`pagamento:0`, valor total da baixa); o estorno da baixa original é recusado depois que o reembolso foi pago.
- **`private.movements`:** transferência entre contas, aporte, retirada, distribuição de lucro, liberação de financiamento e adiantamento de cliente. Mudam saldos, nunca o resultado. Conta inativa, data antes da abertura, sócio que não é mais sócio e liberação acima do contrato viram **conflito** (não travam a fila). Estorno com motivo; adiantamento já compensado não é estornado.
- **`private.financings`:** contrato (banco, linha, taxa, carência, garantias) e cronograma de principal + juros; a amortização tem de somar o valor contratado. As parcelas são contas a pagar; os juros entram no resultado financeiro.
- **`private.renegotiations`:** mudar vencimento ou valor, dividir, agrupar ou cancelar (sem parcelas novas). O servidor congela em `items[].settledCents` o que cada original já tinha quitado; a original passa a dever só isso e as parcelas novas (`renegociação:índice`) levam o resto. Parcela já quitada ou já renegociada vira conflito. Desfazer (`undo_renegotiation`) exige motivo e só vale antes de pagar ou renegociar de novo as parcelas novas; estornar baixa de parcela renegociada é recusado.
- **`private.recurrences`:** modelo da despesa recorrente (dia 1 a 28, mês inicial e final). Cada mês só vira conta a pagar quando alguém lança a despesa (`payload.recurrence = { id, month }`), que passa pela aprovação normal; um mês só tem uma despesa não recusada.
- **`private.budgets`:** um valor por operação, categoria e mês (`set_budget`, upsert).
- **`private.titles`:** contas a pagar e a receber trazidas da planilha (`import_titles`, até 500 por comando). São saldo de abertura: viram parcelas, mas não custo nem receita. `unique (operation_id, import_key)` impede duplicar ao importar de novo.
- **Lançamento `receita`** (couro, arrendamento, serviços): categoria de natureza receita operacional ou outra receita, parcelas fechando o valor. Só sócio registra e só outro sócio aprova (sem outro sócio, entra direto); funcionário não recebe receitas no workspace.

Comandos novos, todos só de sócio, idempotentes e auditados: `register_movement`, `reverse_movement`, `save_financing`, `renegotiate`, `undo_renegotiation`, `save_recurrence`, `set_budget`, `import_titles`; `create_account`, `update_account`, `register_payment` e `reverse_payment` foram reescritos nesta camada (as anteriores ficam em `private.command_before_management`). Apps da fase 1 continuam editando contas: sem `closingDay` no `previous`, a comparação ignora os dias do cartão. `workspace()` devolve `movements`, `financings`, `renegotiations`, `recurrences`, `budgets` e `titles` só para sócios; a atividade mostra o tipo da movimentação, o nome do sócio e quantas parcelas, nunca valores, e não aparece para funcionários.

No app: SQLite v14 (colunas do cartão e da origem da baixa, e `finance_docs` com os documentos em JSON), relatórios derivados em `src/domain/reports.ts` (fluxo realizado e projetado, DRE por competência com a ponte para o caixa, idade, gastos, orçamento), `src/domain/treasury.ts` (movimentações, sócios, financiamentos, renegociação, recorrências), conciliação OFX/CSV (`bank-import.ts`) e planilha (`sheet-import.ts`), exportação em PDF (`expo-print`), planilha XML do Excel e CSV (`export.ts`, `expo-sharing`/`expo-file-system`).

Testes: `npm run test:database` (158), com `tests/finance-management.test.mjs` (critérios de aceite da issue no domínio) e `tests/finance-management-database.test.mjs` (24 casos no PostgreSQL: cartão, movimentações, reembolso, adiantamento, financiamento, renegociação, receita, recorrência, orçamento, importação, atividade e projeção do funcionário). **Aplicada no projeto remoto `aomkvgosqgfuhzllnmic` em 22/10/2026**, com autorização do usuário; o arquivo usa a versão registrada lá (`20261022110210`). Conferidos depois da aplicação: histórico de migrações, RLS ligado e nenhum grant direto para `anon`/`authenticated` nas tabelas novas, conta e lote existentes preservados e `obligation_info` respondendo. Advisors sem avisos novos de segurança (segue só o de proteção contra senhas vazadas). Login e telas em aparelho físico ainda não foram testados com esta versão. Nunca aplicar no legado/Noude.

### Estoque de insumos (issue #45): 20/10/2026

A migração `20261021093555_stock.sql` cria `private.supplies` (todos os membros veem; só sócio cadastra com `create_supply`/`update_supply`, `previous` igual e unidade de controle fixa depois de usada) e os lançamentos `consumo`, `ajuste_estoque` e `transferencia_estoque`. A compra para o estoque é uma despesa com `destination = 'estoque'` e `stockItems` (insumo ativo, quantidade com até 3 casas, soma dos itens = valor) e **sem rateio nos lotes**.

`private.stock_replay(op, insumo, skip, candidato, reserva)` reconstrói saldo e valor por fazenda em ordem de ocorrência e captura, como `stockLedger` no app (um teste compara os dois com os mesmos lançamentos). Custo médio ponderado: a saída leva a fração do valor igual à fração da quantidade. Ao salvar, saídas pendentes reservam saldo e entradas pendentes não contam; ao aprovar, só o confirmado. Saída acima do saldo em qualquer data (inclusive retroativa) vira **conflito** com o motivo ("Em 10/10/2026, o estoque de Sal mineral em Boa Vista tinha 175 sacos; o lançamento pede 300 sacos."). `entry_status` e `validate_entry` são camadas novas (`*_before_stock`); o consumo não tem valor gravado e exige lotes da fazenda, base positiva (manual somando 100%) e período de até 92 dias; a transferência exige outra fazenda da mesma operação e chega ao destino só quando aprovada. Ajuste de estoque exige outro **sócio** para aprovar (o despachante recusa o funcionário em `decide_entry`); sem outro sócio, entra direto. Consumo e transferência são operacionais.

Para o funcionário, `workspace()` (anterior em `private.workspace_before_stock`) devolve os insumos e as movimentações de estoque da operação, e as compras para o estoque **mascaradas** (insumo e quantidade, sem valor, fornecedor nem parcelas), para que o saldo calculado no app dele seja igual ao do servidor. A atividade mostra insumo e quantidade, nunca valores; o funcionário vê consumo, ajuste, transferência e o cadastro de insumos, mas não a compra.

Hoje cada fazenda criada pelo app tem a própria operação; a transferência entre fazendas fica disponível quando uma operação tiver mais de uma fazenda (o modelo e os testes já cobrem esse caso).

Testes: `npm run test:database` (113) com `tests/finance.test.mjs`, `tests/stock.test.mjs`, `tests/finance-database.test.mjs` e `tests/stock-database.test.mjs`, além da migração SQLite v10 → v11 em `tests/database.test.mjs`. **As duas migrações foram aplicadas no projeto remoto `aomkvgosqgfuhzllnmic` em 21/10/2026**, com autorização do usuário. Os arquivos usam as versões registradas pelo Supabase: `20261021093550` (financeiro) e `20261021093555` (estoque). Os 113 testes passaram; histórico, RLS e ausência de grants diretos conferidos. Teste SQL remoto com papel `authenticated` e identidade de sócio validou workspace, criação de conta, plano de compra do lote original já transferido e baixa efetivada, dentro de transação integralmente desfeita. Conferência posterior preservou os dois lotes e seus dados; nenhum plano ou pagamento real foi criado. Advisors sem novos avisos de segurança (permanece o aviso anterior de proteção contra senhas vazadas desabilitada); índices ainda sem uso aparecem como informação. Login e interface em aparelho físico não foram testados nesta aplicação. Nunca aplicar no legado/Noude.

## Centros de custo (issue #48)

Migration do aplicativo atual: `20261027155902_cost_centers.sql`. Ambiente de destino:
**AgroGest `aomkvgosqgfuhzllnmic`**, nunca legado/Noude. A aplicação remota exige autorização;
o arquivo no Git e testes locais não comprovam implantação remota.

Implementa `private.cost_centers` e `private.cost_classifications`, com RLS ativo, índice
único de nome por operação e sem acesso direto para `anon`/`authenticated`. Mantém o contrato
público das duas RPCs e envolve as funções privadas anteriores, com `search_path` vazio e
execução das camadas antigas revogada. Novos comandos:

- `save_cost_center`: `id`, `operationId`, `name`, `parentId`, `isGroup`, `active`, `previous`.
  Revalida sócio, agrupamento ativo da mesma operação, nome e revisão anterior. Tipo e vínculo
  ao grupo ficam fixos. A resposta tem revisão numérica `version`, criada/incrementada no servidor.
- `classify_cost`: `id` do lançamento, `operationId`, `costCenterId` ou null, `reason`, `previous`.
  Sócio da operação, despesa/nota aprovada, centro ativo válido e revisão anterior são obrigatórios.
  O documento separado guarda `version`, centro atual e `history` com `at`, `by`, `from`, `to`,
  `reason`; autor e momento vêm do servidor. Não altera `private.entries` nem pagamentos.
- `save_entry` valida `payload.costCenterId` em despesa/nota quando presente; `save_recurrence`
  valida e preserva `costCenterId`, inclusive na atualização e leitura do modelo.

`agrogest_workspace` acrescenta `costCenters` e `costClassifications` somente para operações
em que a conta é sócia. No SQLite, as coleções usam `finance_docs` existente (v14), chegam
pelo snapshot e são limpas na revogação/demotion junto aos demais dados financeiros.
A fila existente mantém atomicidade, ordem e replay pelo ID de comando, inclusive offline.
Revisões numéricas permitem encadear edições offline sem comparar timestamps de máquinas diferentes.

Validação local: `tests/cost-centers.test.mjs` (agregação, caixa, histórico e acesso),
`tests/cost-centers-database.test.mjs` (migrations executadas em PostgreSQL/PGlite, permissões,
replay, concorrência, auditoria e recorrências) e `tests/sync-services.test.mjs` (SQLite,
fila com falha/retry, roundtrip de snapshot e remoção do acesso). Não substitui login,
sincronização hospedada ou teste em aparelho físico.

Aplicada com autorização no projeto `agrogest-app` em 27/10/2026, na versão remota
`20261027155902` (o arquivo foi alinhado ao registro do servidor). Conferidos histórico,
RLS e ausência de grants diretos. Teste remoto sob papel `authenticated` validou cadastro,
classificação, replay idempotente, auditoria e leitura do workspace em transação integralmente
desfeita. Hashes das linhas financeiras/pagamentos permaneceram iguais; as fixtures não
persistiram. As contagens existentes de uma despesa, dois pagamentos e duas operações foram
preservadas. Advisors sem novos WARN/ERROR: permanece o aviso anterior de proteção contra
senhas vazadas desabilitada; há duas informações de RLS sem policy nas tabelas privadas,
intencionalmente sem grants e acessadas apenas pelas RPCs que revalidam o vínculo.
Isso comprova o contrato SQL hospedado, sem substituir teste de login/UI em aparelho físico.

Reconferência para encerramento da issue #48 em 27/10/2026: as 18 versões de migrations
do repositório constam no histórico remoto de `aomkvgosqgfuhzllnmic`, inclusive
`20261027155902`. Consultas somente de leitura confirmaram as duas tabelas com RLS ativo,
sem permissão de leitura direta para `anon`/`authenticated`, e os comandos/projeção de
centros de custo nas funções privadas atuais. Nenhuma migration foi reaplicada nem houve
alteração de dados nesta reconferência; ela não repete o teste autenticado registrado acima.
