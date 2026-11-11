# Histórico de revisões

## 11/11/2026 — laranja do logo, marca por fundo, login centralizado e exclusão de pendentes

Base própria `0d3770b`. Por pedido do usuário: (1) ações, faixa do topo, destaques e aprovado passam a usar o laranja do logo `#FF6F1E` nos dois temas, no lugar de `#A63D00`/`#FF8A4C`; rótulo branco sobre esse laranja fica abaixo de AA (≈2,8:1), exceção aceita e registrada em `scripts/scenes.mjs`; (2) símbolo, nome e logo deixam de usar caixa carvão e trocam de versão pelo fundo, carvão/laranja no claro e branco/laranja no escuro, também no splash nativo; (3) Entrar e Criar conta ficam centralizados na altura da tela; (4) o autor pode excluir o próprio lançamento `aguardando_aprovacao` (servidor e app), liberando o vínculo do comprovante, sem afetar custo, estoque ou contas; aprovado continua recusado (409) e outro sócio recebe 403. A fila offline (`aguardando_envio`) não ganhou exclusão, para não travar a sincronização. [Requisitos](REQUISITOS_PRODUTO.md), [UX](EXPERIENCIA_USUARIO.md), [Cloudflare local](CLOUDFLARE_LOCAL.md) e [identidade](branding/IDENTIDADE_VISUAL.md) atualizados.

**Mapa:** satélite (Esri), Leaflet (unpkg) e busca de lugares (Photon/Nominatim) religados a pedido do usuário; voltam a depender de internet e desses serviços externos. A faixa do topo passou a carvão e ganhou a variante de botão `strong` para equilibrar o laranja.

**Verificação:** 216 testes de domínio e 23 da API passaram (incluindo o novo cenário de exclusão por autor, recusa a outro sócio e a aprovado); tipos mobile/API e lint sem erros; gerador de cenas sem mudança nas animações. Sem migration nova, deploy ou teste em aparelho.

## 11/11/2026 — pitch da GS refeito com nova direção de arte

Base própria `a544c82`, branch `badmuriss/agrogest-pitch-claude`. A pedido do usuário, a apresentação foi redesenhada do zero; o aplicativo, seus dados, tema padrão e regras não foram alterados. A narrativa passou a acompanhar um único recibo sintético (GS-004) da foto ao custo do lote, em dez slides e 4min46s de fala. Molduras de celular foram substituídas por recortes ampliados das capturas reais; o recibo GS-004 volta à capa, agora como arquivo de teste real identificado como sintético, substituindo a decisão de 10/11 de removê-lo. O selo pequeno da marca saiu dos slides brancos; o logo V2 aparece grande sobre carvão. O problema passou a citar o levantamento de requisitos com um produtor de recria e engorda; a nuvem aparece separada entre executado localmente e preparado, sem afirmar publicação.

**Verificação:** no Chromium headless local, os dez slides foram capturados em 1920×1080 e inspecionados, sem erro de página/console nem requisição externa; navegação por teclado, falas, cronômetro, âncora e ajuste a 390 px de largura conferidos. PDF exportado do mesmo HTML (dez páginas 16:9, fontes embutidas) e rasterizado para inspeção de todas as páginas. Testes do aplicativo não foram reexecutados (mudança restrita à apresentação); 251 testes continuam sendo o registro de 10/11 e os 114 iniciais o de 06/11. Não houve deploy, publicação nem inferência remota pelo agente.

**Ajuste no mesmo dia, após revisão do usuário:** removidos rodapé (nome e número do slide), rótulos de seção, trilha da jornada, barra de progresso e toda fonte monoespaçada (IBM Plex Mono e seus arquivos); legendas passaram a Inter. Margem segura de 150 px nas laterais e ao menos 100 px na base; o painel do slide de público virou cartão interno. A pedido do usuário, `cloud.executed` passou a `true`: a equipe informou a publicação na Cloudflare em 11/11/2026, sem conferência de URL ou leitura hospedada pelo agente. Os dez slides foram recapturados no Chromium (sem erros nem requisições externas) e o PDF reexportado e rasterizado página a página; só Bricolage Grotesque e Inter ficaram embutidas.

**Redução de arquivos, a pedido do usuário:** a pasta do pitch passou a conter só `agrogest-pitch.pdf`; HTML, roteiro, conteúdo editável, fontes, gerador e o script `pitch:build` foram removidos (recuperáveis no commit `0c3ccf5`). O slide final ficou só com marca, lema e fontes de dados.

## 10/11/2026 — tema claro na atualização e refinamento do pitch

Base própria `797438f`. A revisão visual anterior só adotava o claro na ausência de tema salvo. Após o usuário relatar que seu navegador continuava escuro, a aparência passa a usar `agrogest.theme.v2`: a chave anterior fica preservada, mas deixa de selecionar o tema. A versão atual inicia no claro, inclusive com tema antigo escuro e sistema escuro; novas escolhas de Claro, Escuro ou Automático continuam persistentes. Preferências apresenta Claro primeiro e explica o padrão. Não há limpeza de sessão, SQLite ou outbox.

O pitch passou a usar o símbolo V1 preservado com nome composto em Inter, sem a pequena placa que reduzia a leitura do logo. Todas as molduras usam a mesma proporção 9:19,5, imagens contidas sem corte e legendas externas; foram removidos o recibo ilustrativo da capa, sua rotação e elementos decorativos. Títulos e rodapés foram simplificados, mantendo fontes, identificação do cenário sintético e metas de piloto. O CSS editável foi separado em `scripts/pitch.css`, mas continua incorporado ao HTML final. PDF reexportado em nove páginas 16:9.

**Verificação desta correção:** tipos, lint, build web e exportações web/Android/iOS passaram. No Chromium local, reproduzido o escuro com chave antiga; o build corrigido abriu claro com a mesma chave e o sistema escuro. A opção Escuro foi acionada pela interface e persistiu após recarregar; o retorno a Claro também persistiu. Os nove slides HTML foram capturados e inspecionados, com imagens carregadas e nenhum recurso HTTP externo; as proporções das três molduras foram conferidas no DOM. PDF rasterizado para conferência das nove páginas. Os 251 testes da revisão anterior não foram reexecutados para esta mudança de aparência e apresentação. Não houve deploy nem inferência remota.

## 10/11/2026 — marca laranja, modo claro e material do pitch GS2

Base própria `e871622`. A direção visual do usuário passa a ser branco/laranja com cinzas suaves, modo claro padrão sem preferência salva e modo escuro opcional. Escolhas existentes de tema são preservadas. Originais V1/V2 não foram modificados; composições SVG e ícones sobre carvão reutilizam a arte branca/laranja. Campos, ações, aprovação visual, exportação e tokens CSS acompanham a nova paleta. A data web selecionada aparece em DD/MM/AAAA em repouso, mantendo ISO e calendário/edição nativos. O Switch web recebeu cor de thumb ativa explícita para não herdar o verde do componente.

**Verificação:** `npm run check` passou com **251 testes** (216 domínio/SQLite/PGlite, 22 API/contratos, 1 guarda Docker, 7 OCR Python, 5 setup/isolamento), tipos mobile/API e lint. Build web, exportações web/Android/iOS e dry-run Cloudflare passaram. Na conferência Chromium, uma preferência vazia escolheu claro mesmo com esquema escuro do navegador; o escuro selecionado persistiu após recarregar, e foi possível voltar ao claro. Conferidos 16 pares de tokens com contraste calculado de pelo menos 4,5:1; isso não é certificação completa de acessibilidade. Custo do lote e quatro despesas aprovadas preservados; nenhuma despesa criada para trocar a identidade. Não houve nova medição de conversão, desempenho nativo ou impacto com produtores.

**Deploy e IA:** o modelo Cloudflare permanece Llama 4 Scout. A franquia de Neurons foi conferida na documentação oficial; isso não representa saldo consultado de uma conta. O guia passou a incluir login, seleção de conta, configuração mínima `cloud:account`, criação de D1/R2 pelo responsável, migrations sem a carga pública e deploy de staging. O helper novo só escreve configuração local e tem teste antes da existência dos recursos. Nenhum desses comandos remotos foi executado pelo agente; nenhuma inferência hospedada foi inventada.

**GS:** conferência dos cinco critérios e quatro tecnologias no [plano](gs/PLANO.md#conferência-da-entrega-e-pitch-técnico). Criados nove slides em HTML offline, PDF 16:9 e roteiro (substituídos em 11/11), com 547 palavras e tempo-alvo de 4min40s. Capturas são do app atualizado com GS-004 sintético; HTML testado por `file://`, sem recursos HTTP externos. Nove páginas PDF foram rasterizadas e inspecionadas. Não foi produzido/publicado vídeo nem enviado link à FIAP. A estrutura cobre a rubrica; evidência direta do público, execução cloud pelo responsável, gravação e entrega do URL continuam ações necessárias antes da avaliação. Não há garantia de nota atribuída.


## 10/11/2026 — perfis locais e preparação de hospedagem Cloudflare

Base própria `aedb9641e00ba5d692d71365bd8e339eecf70bcc`. OpenRouter foi removido do runtime/configuração atuais por instrução do usuário; sua pesquisa/autorização anterior permanece histórica. Setup e início selecionam apenas o serviço necessário: Tesseract CPU, Qwen3-VL-2B local ou Workers AI REST. Diagnóstico não mostra segredos nem chama modelo. A configuração futura separa staging/produção, D1/R2 e contas de inferência/hospedagem, usa HTTPS e impede identidades/senha públicas de demonstração. O pacote omite `0002_local_demo.sql`; bootstrap privado gera hashes, sem aplicar SQL. O procedimento completo está no [guia de ambientes](CLOUDFLARE_LOCAL.md#preparar-a-futura-hospedagem-cloudflare).

**Verificação:** `npm run check` concluiu com **250 testes** (216 domínio/SQLite/PGlite, 22 API/contratos de inferência, 1 guarda Docker, 7 OCR Python, 4 configuração/isolamento), tipos mobile/API e lint. `cloud:check` exportou web e empacotou Worker/Assets/D1/R2/AI por `deploy --dry-run`, com IDs sintéticos e sem credenciais de conta; geração de tipos passou. Exportações web/Android/iOS passaram, sem teste em aparelho. Os 240 testes da revisão anterior e os 114 iniciais mantêm suas datas, conteúdo e limites.

**Primeira execução:** clone de teste isolado, sem dependências, segredos ou estado herdados, instalou pelos três lockfiles em modo Workers AI sem preparar Docker/GPU. Chromium abriu, autenticou e reabriu a conta; a imagem sintética ficou salva após recarregar quando faltou a credencial, com erro de configuração explícito. O teste revelou o limite de 64 bytes de caminho do VFS web instalado: novos bancos passaram a usar nome curto derivado por SHA-256 de backend/conta; o backend local padrão conserva os nomes existentes. A correção foi verificada no navegador e na suíte de isolamento, incluindo caminho/journal para origem/ID longos.

**Preservação e IA local:** instância original reiniciada em `local-vision`, sem inferência remota; GS-004 foi reprocessado de verdade por Qwen e retornou R$ 42,50 e 10/11/2026. A revisão reconheceu o documento já vinculado e ofereceu abrir a despesa existente. O lote reaberto manteve quatro despesas aprovadas e **R$ 11.620,40** de custo, sem nova despesa. Sem erros de página/JavaScript na conferência local final. Não se repetiu manualmente toda a aprovação/offline de 06–10/11; suas regressões automatizadas foram reexecutadas.

**Limites:** Workers AI tem testes REST/binding com respostas simuladas, sem inferência real por falta de conta/token. Nenhum app, D1/R2, migration ou modelo foi publicado/provisionado remotamente. Auth/recuperação/antiabuso de produção, restauração e transferência dos dados locais existentes para nuvem continuam pendentes. Não foram testados Windows/macOS, aparelho nativo ou nuvem efetivamente hospedada. [Evidência estruturada](<arquivo/pesquisas/Agrogest Cloudflare local/validacao-ambientes-20261110.json>) e [checks consolidados](<arquivo/pesquisas/Agrogest Cloudflare local/checks-ambientes-20261110.txt>).


## 10/11/2026 — IA visual local, revisão de comprovantes e apresentação da GS

Base própria `a6359228db5be73e45f327523d49295adac89a65`. O parser TSV do Tesseract passou a tratar aspas como texto literal, corrigindo o vazamento de linhas técnicas para o resultado. Datas conflitantes permanecem vazias; totais de tributos são ignorados. O cache agora considera versão do pipeline/modelo e permite reprocessar explicitamente, sem reescrever uma despesa aprovada.

**IA executada:** Qwen3-VL-2B-Instruct quantizado Q4_K_M, projetor Q8 e llama.cpp b12246/CUDA 12.8, com arquivos/revisão/hashes fixados. O modelo recebe a imagem e retorna os campos em uma chamada local, autenticada pelo backend. Na RTX 4070 SUPER de 12 GiB, o processo alocou cerca de 3 GiB; quatro chamadas diretas com servidor aquecido ficaram entre 539 e 770 ms, sem representar SLA ou acurácia em campo. A foto fornecida pelo usuário retornou R$ 47,00, data 21/09/2018 e descrição do item; fornecedor ficou nulo por cabeçalho cortado. Essa foto e seus registros detalhados não foram versionados. Não houve inferência hospedada.

**Interface:** escolher o comprovante no formulário abre o seletor diretamente; um clique no botão gerou um clique no input persistente. A captura precede upload/navegação. A revisão mostra valor, descrição e data primeiro, deixando imagem ampliada, fornecedor, número e nova leitura em detalhes; o texto bruto tem expansão própria. Campos ficam indisponíveis durante nova leitura. Correção manual sobreviveu à reabertura. A preparação da despesa mantém o resumo de pagamento/rateio e detalhes recolhidos.

**Jornada real no Chromium:** GS-004 é uma imagem sintética nova, não uma nota fiscal autêntica. A IA leu R$ 42,50, Agro Rural e mineral para bovinos. Ana revisou/enviou; enquanto aguardava Bruno, o custo confirmado permaneceu em R$ 11.577,90. Bruno abriu o original protegido e aprovou; o custo passou a **R$ 11.620,40**, com quatro lançamentos, delta único de R$ 42,50. O hash R2 corresponde ao arquivo e reenviar os mesmos bytes retorna o mesmo documento. A pendência e os dados do servidor sobreviveram à reinicialização do host; o roteiro manual completo de desconexão de 06/11 não foi repetido.

**Verificação:** `npm run check` passou com **240 testes**: 216 domínio/SQLite/PGlite, 16 API (incluindo contratos simulados da interface do modelo e integração D1/R2 com OCR real), uma guarda de daemon local e sete Python no container. Tipos mobile/API e lint passaram. O teste real do modelo está separado dos testes de contrato. Build web e exports web/Android/iOS passaram; não houve APK/IPA ou teste em aparelho. Sem erros de página na sessão de navegador validada.

**Documentação:** README refeito com marca existente, proposta CitizenTech, público, fluxo e limites da GS. A raiz conserva apenas README e AGENTS como Markdown. Foram agrupados 319 arquivos em `gs/` e `arquivo/`, com índice e links atualizados; 217 arquivos movidos que não são Markdown mantêm bytes idênticos. Os 114 testes e hashes anteriores continuam preservados. Não há mudança de domínio ou licença.

Evidências: [check atual](<arquivo/pesquisas/Agrogest Cloudflare local/check-final-20261110.txt>), [registro da validação](<arquivo/pesquisas/Agrogest Cloudflare local/validacao-20261110.json>), [revisão simplificada](imagens/revisao-comprovante.png), [indicador aprovado](imagens/indicador-aprovado.png) e [recibo sintético GS-004](../tests/fixtures/comprovante-gs-004.png). Comandos, seleção de provedor, credenciais e limites estão no [guia operacional](CLOUDFLARE_LOCAL.md#ia-visual-local-opcional). Logs de sistema, segredos e pesos ficam fora do Git.


## 09/11/2026 — OCR empacotado e validado em container local

Base desta alteração: commit próprio `06eb04f42319419ef7bacb3616f69b63ff5d5be7`. O padrão de execução passa do processo Python instalado no host para Docker local, sem mudar o contrato Worker → OCR. A imagem contém Python **3.14.10**, Tesseract **5.3.0-2**, modelo português com SHA-256 e licença Apache-2.0. Executa por CPU, sem dispositivo GPU, como UID/GID 10001, com raiz somente leitura e temporários efêmeros. Nenhum deploy/provisionamento ou inferência remota foi executado; o repositório próprio público foi autorizado em etapa anterior.

**Validação atual:** `npm run check` terminou com exit 0: **233 testes** (216 domínio/SQLite/PGlite, 11 integração API com OCR no container, 1 guarda de daemon Docker local e 5 Python dentro de container sem rede), tipos mobile/API e lint mobile. `ocr:build` construiu a imagem no daemon local; os testes de integração usam porta dinâmica e D1/R2 temporários. Modelo ausente/inválido impede saúde positiva; contextos Docker remotos são recusados antes de construir/executar. O Compose publica somente `127.0.0.1:8091`, sem montar bancos, workspace ou segredos. Durante o diagnóstico, a rede Docker `internal` não publicou a porta neste daemon; a versão validada usa bridge e loopback, sem alegar firewall de saída.

**Navegador:** Chromium executou imagem sintética nova → extração real no container → revisão → despesa → aprovação de Bruno → indicador. O OCR retornou R$ 237,60, Cooperativa Horizonte, data 09/11/2026 e descrição; o parser capturou `TESTE` do cabeçalho como número, corrigido na revisão para `GS-CONTAINER-003`. Isso evidencia a necessidade de revisão, não acurácia fiscal comprovada. A despesa pendente preservou o custo em **R$ 11.340,30**; aprovada, passou a **R$ 11.577,90**, sem duplicar os dois lançamentos anteriores. Bruno abriu a imagem original protegida; seu hash coincide com o arquivo enviado.

**Reinicialização:** SIGINT encerrou Worker e container, liberando as portas. Novo `npm start` preservou os três lançamentos, aprovação, custo e bytes no R2. O navegador reabriu a sessão/lote de Bruno sem erro de página. Reenviar os mesmos bytes devolveu o mesmo documento. A captura de rede do navegador registrou **142 requisições, zero HTTP externo**; o escopo não inclui downloads de preparação nem tráfego interno Worker → OCR. Não houve nova exportação web/Android/iOS nesta alteração de serviço/scripts; os builds de 06/11 permanecem históricos. Os testes de offline/outbox e permissões herdados foram reexecutados; o roteiro manual completo de desconexão de 06/11 não foi repetido.

Evidências: [execução dos checks](<arquivo/pesquisas/Agrogest Cloudflare local/check-container-20261109.txt>), [registro de validação e recursos](<arquivo/pesquisas/Agrogest Cloudflare local/validacao-container-20261109.json>), [estado anterior à aprovação](<arquivo/pesquisas/Agrogest Cloudflare local/container-before-approval-20261109.json>), [rede sem headers/tokens](<arquivo/pesquisas/Agrogest Cloudflare local/rede-container-20261109.json>), [imagem sintética](<arquivo/pesquisas/Agrogest Cloudflare local/comprovante-container-20261109.png>), [revisão](<arquivo/pesquisas/Agrogest Cloudflare local/ocr-container-revisao-20261109.png>), [original no R2](<arquivo/pesquisas/Agrogest Cloudflare local/container-original-r2-20261109.png>) e [indicador após reabertura](<arquivo/pesquisas/Agrogest Cloudflare local/container-indicador-20261109.png>). Comandos e limites ficam no [guia operacional](CLOUDFLARE_LOCAL.md#ciclo-do-container-ocr). A imagem ainda não foi testada em ARM64, Windows/macOS ou hospedagem; não foi enviada a registry. Os limites de corpus, Auth, cloud e dispositivos da revisão anterior continuam vigentes.

## 06/11/2026 — versão acadêmica local implementada e executada

Adaptação a Cloudflare local sobre a versão de outubro. Sem deploy, provisionamento ou migração remota. [Plano v3](gs/PLANO.md) e [guia operacional](CLOUDFLARE_LOCAL.md).

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

Os **114 testes da primeira análise** continuam no [TAP original](<arquivo/pesquisas/Agrogest Cloudflare local/baseline-local-20261106.tap>), SHA-256 `3da4b0e25e5b3029cade1b8dda159e714fa3a0ecd9692b55d0926e1fca885368`. Eles são registro anterior; os 231 acima são a execução atual ampliada, incluindo PGlite local. Não somar 114 aos 231 para inflar a contagem.

Evidências e hashes: [registro de validação](<arquivo/pesquisas/Agrogest Cloudflare local/validacao-implementacao-20261106.json>), [log final](<arquivo/pesquisas/Agrogest Cloudflare local/check-final-20261106.txt>), [rede final](<arquivo/pesquisas/Agrogest Cloudflare local/rede-navegador-final-20261106.json>). Capturas: [OCR/revisão](<arquivo/pesquisas/Agrogest Cloudflare local/ocr-revisao-web-20261106.png>), [indicador após primeira aprovação](<arquivo/pesquisas/Agrogest Cloudflare local/indicador-aprovado-web-20261106.png>), [reabertura offline](<arquivo/pesquisas/Agrogest Cloudflare local/reabertura-offline-web-20261106.png>), [intenção de aprovação reaberta offline](<arquivo/pesquisas/Agrogest Cloudflare local/aprovacao-offline-reaberta-web-20261106.png>) e [indicador final](<arquivo/pesquisas/Agrogest Cloudflare local/indicador-final-web-20261106.png>).

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

O workflow `.github/workflows/quality.yml` (workflow da versão de outubro, não incluído nesta versão) executa tipos,
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
