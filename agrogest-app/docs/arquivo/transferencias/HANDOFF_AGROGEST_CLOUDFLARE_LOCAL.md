# Handoff — AgroGest, Cloudflare e execução local

> **Ownership vigente · 06/11/2026:** desenvolvimento e testes agora autorizados em [AUTORIZACAO_DESENVOLVIMENTO_GS.md](AUTORIZACAO_DESENVOLVIMENTO_GS.md). A versão acadêmica implementa Worker/D1/R2/OCR locais; [guia atual](../../CLOUDFLARE_LOCAL.md) e [plano v3](../../gs/PLANO.md). A antiga fase de somente análise abaixo é histórica. Nenhum deploy/publicação foi autorizado nesta fase; inferência remota segue a exceção já corrigida.


Atualizado em 06/11/2026. Este arquivo é o contexto de partida para uma NOVA sessão Codex, sem importar o histórico longo da conversa anterior.

**Correção posterior do usuário:** ler [ATUALIZACAO_IA_E_REPOSITORIO.md](ATUALIZACAO_IA_E_REPOSITORIO.md). O aplicativo segue sem deploy, mas inferência remota em Workers AI/OpenRouter do usuário está autorizada. Preparar clone e repositório independente, sem fork ou alterações no upstream. Essa atualização prevalece sobre o primeiro plano.

## Pedido atual do usuário

O projeto escolhido é o AgroGest do amigo: https://github.com/freitasbtw/agrogest . O objetivo é melhorar essa base e adequá-la à Global Solution 2 da FIAP, ajudando também o autor original.

O usuário pediu uma nova sessão pelo Orca CLI para começar por análise geral e plano. A nova diretriz substitui a arquitetura de destino das avaliações anteriores:

- Migrar a solução de Supabase para Cloudflare, incluindo backend, SQL/D1, arquivos/R2 e hospedagem do frontend web, conforme a arquitetura que a auditoria justificar.
- Preservar e avaliar os cálculos, análise de dados, permissões, operação offline e sincronização existentes.
- Planejar IA e visão computacional reais. Preferir execução local quando adequada, avaliando Hugging Face; Workers AI e OpenRouter do usuário estão autorizados para inferência remota.
- Rodar a aplicação e as simulações Cloudflare LOCALMENTE nesta fase.
- NÃO fazer deploy, provisionar recursos ou executar migrações remotas.
- Não usar Supabase remoto nem publicar serviços do aplicativo nesta fase. Inferência remota autorizada em Workers AI/OpenRouter é a exceção explícita; não significa autorização para deploy do aplicativo.
- Primeiro entregar análise ponta a ponta contra o enunciado e um plano técnico priorizado. Não iniciar uma migração ampla antes de concluir esse diagnóstico e registrar as decisões.

Consultar documentação, clonar a base pública e preparar um repositório local independente é permitido. Não publicar nem modificar o repositório do amigo. A preparação do clone e a revisão do plano precedem a implementação ampla.

## Primeiro trabalho da sessão

1. Ler este handoff e `agrogest-app/docs/gs/REQUISITOS_GS.md`.
2. Ler `README.md` e `agrogest-app/docs/arquivo/estudos/Agrogest na Global Solution.md`, entendendo que relatam uma auditoria da base Supabase, não a nova arquitetura desejada.
3. Consultar as evidências em `agrogest-app/docs/arquivo/pesquisas/Agrogest na Global Solution/`, sobretudo `dados_e_cloud.md`, `visao_e_ia.md` e `citizentech_e_pitch.md`.
4. Inspecionar o código primário do AgroGest e suas instruções `AGENTS.md`, sem presumir que os relatórios anteriores cubram toda a migração.
5. Entregar um plano com matriz de aderência à GS, arquitetura local de destino, inventário de migração, riscos, prioridades e critérios de aceite.

Não reabrir a ideação de projetos antigos. Não pesquisar ou implementar alternativas descartadas. A direção é AgroGest.

## Workspace, origem e material disponível

- Workspace: `/data/projects/hobby/gs-final-fiap`.
- Neste workspace existem README, relatórios e pesquisa. O aplicativo do amigo ainda NÃO foi importado/adaptado aqui.
- Clone de auditoria disponível: `/tmp/gs-final-fiap-agrogest-20261106`.
- O clone foi criado com `--no-checkout --filter=blob:none`. Ler com `git show HEAD:caminho` e `git ls-tree`; não confundir uma árvore de trabalho vazia com ausência de código.
- Commit auditado: `7f0bb66d764eadc8f48be016280414d77a1d4799`, de 27/10/2026.
- Se o cache temporário desaparecer, obter novamente o repositório público e registrar o commit usado. Não sobrescrever os documentos deste workspace.
- Fonte de verdade do app atual: `agrogest-app/`.
- `old-agrogest/` é legado. Não misturar funcionalidades dele com as do aplicativo atual e não copiar código legado sem uma decisão explícita adequada ao pedido.
- Não alterar, publicar ou fazer push no repositório do amigo. Alinhar atribuição e contribuições; a leitura pública não foi tratada como licença de redistribuição.
- O usuário pediu clone e repositório de destino independente para a faculdade, sem fork. Preservar documentos/metadata Git deste workspace, evitar Git aninhado e registrar autor/commit de origem. Ver a atualização para a estratégia de preparação/importação.
- Preservar alterações locais existentes. Não usar reset/clean para preparar o trabalho. Não imprimir credenciais nem inspecionar dados privados sem necessidade. Credenciais de inferência autorizadas pelo usuário podem ser usadas pelos canais seguros de configuração, sem exposição no Git, frontend ou logs.

## O que a auditoria anterior já comprovou

### Base de produto e análise de dados

Há implementação substancial em Expo/React Native, com operação local em SQLite, papéis/permissões, fazendas, lotes, despesas, estoque, aprovação e relatórios.

Foram rastreados cálculos determinísticos de ganho médio diário de peso, custos, fluxo de caixa e orçamento. Cálculo determinístico não deve ser anunciado como IA. Os relatórios dependem dos estados de aprovação do domínio; conferir o arquivo correto não substitui aprovar o lançamento.

O projeto documenta problemas de registro de campo e controle de custos. Pequeno produtor é um recorte candidato a validar, não um porte comprovado pelo código. O eixo de agricultura/desenvolvimento rural consta expressamente no enunciado.

### Supabase e sincronização existentes

O app atual tem Auth condicional, outbox SQLite, RPC de comandos, idempotência por operação, ACK/versões e leitura de workspace. Há migrations e regras de isolamento no repositório.

Isso foi verificado estaticamente; não executamos app, testes ou serviços, nem confirmamos o estado remoto atual. Sem configuração, parte da aplicação funciona apenas localmente.

A migração NÃO é trocar URL/SDK: inventariar Auth, RPCs PostgreSQL, SQL, RLS/autorização, convites, isolamento de fazendas/contas, outbox, confirmações e quaisquer dependências de storage. D1 não substitui automaticamente o serviço Auth ou a política RLS do Supabase.

### Visão computacional e IA atuais

No app atual, `agrogest-app/apps/mobile/src/services/nf-extraction.ts` contém um mock: `extractInvoice(_fileName)` ignora a entrada, aguarda e devolve `SAMPLE_EXTRACTION` constante. A tela fiscal envia só o nome do arquivo, não os pixels. Não há inferência visual real nesse fluxo.

`agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md` declara que extração real e anexos ainda não estão implementados.

O fluxo `kind: 'nota_fiscal'` está bloqueado no modo cloud atual. Não basta fornecer uma chave de modelo. O chat com OpenRouter encontrado no legado não comprova IA integrada ao app atual.

### Um recorte mínimo que já foi confirmado no código

É viável propor um novo importador que alimente DESPESA, preservando o bloqueio atual do módulo de NF:

`foto/recibo → OCR/modelo real → JSON validado → revisão humana → formulário de despesa → aprovação/sincronização → indicador de custos`.

A tela `agrogest-app/apps/mobile/src/app/novo/despesa.tsx`, linhas 145–195 no commit auditado, valida os campos e chama `app.saveEntry` com `kind: 'despesa'`.

`agrogest-app/apps/mobile/src/state/app-state.tsx`, linhas 1810–1818, bloqueia NF nesse ponto, mas permite o caminho existente de despesa. Na nova arquitetura, esse contrato precisa ser preservado ou migrado explicitamente.

O importador e o adaptador de preenchimento ainda NÃO existem. Categoria, fazenda e rateio precisam de escolha/confirmação pelo usuário. Começar com uma despesa simples, sem novos fluxos de estoque, recorrência ou parcelamento.

Não apresentar emissão/arquivamento fiscal, contabilidade ou diagnóstico veterinário como escopo desse importador.

## Arquitetura Cloudflare a analisar

O usuário quer unificar a solução em Cloudflare. Comparar o caminho de menor risco que preserve o aplicativo com as opções de frontend web; não decidir reescrever tudo por preferência de framework.

- Frontend: o produto atual é Expo/React Native e também tem código web. Explicar como hospedar/servir a versão web no destino Cloudflare e o que permanece cliente nativo. Não apagar o requisito offline ou abandonar mobile sem justificar a decisão.
- Backend: Workers/API local, com contratos explícitos de autenticação, autorização, validação e erros.
- Banco: D1 local, migrations/fixtures locais e integridade equivalente ao domínio atual. Mapear PostgreSQL/RPC para SQLite/API; preservar valores monetários, rateio, aprovação e idempotência.
- Arquivos: R2 local para documentos/anexos quando necessário, com relações e permissões definidas.
- Cálculos: avaliar módulos compartilhados e validação autoritativa, mantendo consistência entre operação offline e backend. Não duplicar regras divergentes ou perder indicadores existentes.
- Operação offline: preservar dados SQLite/outbox e planejar troca de transporte Supabase para API Worker.
- Auth: propor solução compatível com o destino e desenvolvimento local, sem substituir isolamento multiusuário por acesso global permissivo. Separar seed de desenvolvimento de autenticação definitiva.
- Jobs/filas/outros produtos: usar apenas se o fluxo demonstrar necessidade; não adicionar serviços por complexidade estética.

As skills `cloudflare`, `wrangler` e documentação oficial atual orientam API/configuração. Verificar versões/CLI do projeto antes de sugerir comandos. O projeto auditado não tem configuração Cloudflare atual: a escolha de ferramentas precisa de justificativa. Não instalar toolchains ou baixar modelos pesados durante o diagnóstico sem necessidade e escopo definidos.

## Restrição local e fatos confirmados na documentação

Documentação oficial consultada em 06/11/2026:

- https://developers.cloudflare.com/workers/local-development/
- https://developers.cloudflare.com/workers/local-development/bindings-per-env/
- https://developers.cloudflare.com/workers/local-development/local-data/

Workers, assets, D1 e R2 têm desenvolvimento/simulação local. Workers AI não tem simulação local: o modelo executa remotamente mesmo quando o Worker está local.

Consequências nesta fase:

- Não usar `wrangler dev --remote` nem bindings de dados/arquivos remotos nesta fase. Chamadas de inferência a Workers AI/OpenRouter do usuário estão autorizadas e devem ser isoladas dos recursos do aplicativo; preferir backend local com configuração de provedor explícita.
- Não criar/aplicar D1/R2/Workers remotos; usar somente estado e migrations locais quando chegar a implementação.
- Não executar exportações/migrações de dados de produção nem remover infraestrutura Supabase existente.
- IA/CV: avaliar OCR e modelos locais, inclusive Hugging Face, considerando CPU/GPU, licença e qualidade. Local é preferência, não requisito absoluto. Comparar com Workers AI/OpenRouter autorizados. Distinguir OCR, interpretação e validação do domínio.
- Definir interface de provedor e configuração por ambiente para permitir inferência temporariamente na conta do usuário e posterior passagem para as credenciais do amigo, sem segredos no frontend ou no Git.
- Não converter falha de inferência em dados fixos. Se o provedor configurado não estiver disponível, informar isso e permitir o registro manual apropriado, sem troca silenciosa para outro provedor.
- Distinguir emulação local de Workers/D1/R2 de inferência efetivamente executada na nuvem, se utilizada. Relatar cada componente com precisão na matriz da GS. A publicação do aplicativo será decisão futura, fora do escopo imediato.

## Entregáveis da análise inicial

Criar um plano durável, por exemplo `agrogest-app/docs/gs/PLANO.md`, e atualizar README com decisões confirmadas. Não iniciar implementação ampla ainda.

O plano deve conter:

1. Matriz dos quatro requisitos e dos cinco critérios do pitch, com status atual, lacuna, alteração proposta, evidência e teste de aceite.
2. Inventário do app atual: funcionalidades úteis, dependências Supabase, cálculos, modelo de dados, permissões, sincronização e mocks.
3. Arquitetura de destino, mapa PostgreSQL/Supabase → Workers/D1/R2/local auth e estratégia de frontend, sem regressões silenciosas.
4. Fluxo vertical de importação visual real de uma despesa, comparação de inferência local/Hugging Face e Workers AI/OpenRouter, credenciais e manutenção futura pelo amigo. Não precisa inventar mais módulos de IA para preencher requisito.
5. Backlog priorizado por risco/valor/dependências: fundação local, migração de contratos e dados, preservação dos cálculos, importador, integração, validação e demonstração.
6. Plano de testes com fixtures: cálculos/centavos/rateio/aprovação, isolamento entre contas/fazendas, repetição sem duplicar, reconexão/reabertura, falha de OCR, revisão e efeito no indicador.
7. Critérios para comprovar execução local do aplicativo/dados, restringir o egresso aos provedores de IA autorizados e distinguir teste local, simulação e cloud real.
8. Indicadores de impacto e estratégia de validação: tempo manual versus assistido incluindo correções, acerto por campo, falhas e duplicações, compreensão dos resultados. Sem inventar percentuais de economia, produtividade ou acurácia.
9. Escopo de demonstração até 19/11/2026, riscos de prazo, decisões pendentes e como cada escolha afeta a rubrica.

## Conduta do handoff

Esta é uma transferência de trabalho para a nova sessão. A sessão anterior encerra após entregar o prompt. Não é necessário coordenador, DAG de tarefas ou monitoramento da conversa anterior.

Começar a análise agora, com atualizações curtas ao usuário. Usar fatos do código e documentação primária; explicitar o que não foi executado ou verificado. Não pedir confirmação genérica para iniciar a análise já solicitada.
