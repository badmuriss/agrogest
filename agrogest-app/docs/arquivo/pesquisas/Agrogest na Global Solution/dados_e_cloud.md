# AgroGest na Global Solution — análise de dados e cloud

Auditoria estática em 06/11/2026. Repositório público: [freitasbtw/agrogest](https://github.com/freitasbtw/agrogest). Commit fixo: `7f0bb66d764eadc8f48be016280414d77a1d4799` (27/10/2026). Apenas app atual `agrogest-app/`; legado excluído.

Foram lidos arquivos por `git show`, sem checkout, instalação, execução do app, scripts, testes ou build. Nenhum serviço remoto, conta, credencial ou arquivo `.env` foi acessado. O repositório do amigo não foi alterado. As instruções do pesquisador, a skill de pesquisa do usuário e os AGENTS aplicáveis foram observados.

## 1. Há análise de dados implementada ou apenas gráficos?

**Takeaway.** Há cálculos de domínio reais ligados aos registros do SQLite e às telas. Isso sustenta o requisito de análise de dados como implementação visível no código. Não prova exatidão zootécnica em campo, ganho de renda ou uso em produção.

**Cited findings.**

| Exemplo | Entrada → cálculo → saída | Limite |
|---|---|---|
| Ganho médio diário (GMD) e rebanho | Formulário salva lote, método, peso médio, cabeças e data; o resumidor considera lançamentos aprovados, monta a série de pesos e calcula variação de peso por dia; a home analítica exibe GMD, peso médio e marca estimativas. | Sem base temporal válida, o resultado é nulo. Peso estimado é informado manualmente: não é medição por imagem. |
| Fluxo de caixa realizado/projetado | `financeBook` entrega contas, pagamentos, movimentos, parcelas, faturas e recorrências reais; o domínio agrupa entradas/saídas por período e projeta vencimentos; a tela mostra os saldos e alerta para o primeiro período negativo. | Projeção determinística de obrigações/agendamentos; não é previsão por IA. |
| Orçamento versus realizado | Orçamentos e despesas/notas aprovadas são filtrados por mês/escopo; `budgetReport` soma realizado e calcula `varianceCents = actualCents - budgetCents`; a tela apresenta totais e estouros. | Depende de classificação, aprovação e completude dos lançamentos. |

Fontes do exemplo GMD: [entrada manual e persistência solicitada](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/pesagem.tsx#L67-L82), [filtragem e base do resumo](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L129-L170), [cálculo de GMD](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L230-L245), [saída na home analítica](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/home/analytic-home.tsx#L65-L107).

Fontes do fluxo de caixa: [montagem do livro financeiro](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L713-L738), [cálculo realizado e projeção](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/reports.ts#L307-L373), [domínio conectado à tela](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/finance-reports/cash-flow.tsx#L29-L44), [alerta e apresentação](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/finance-reports/cash-flow.tsx#L81-L110).

Fontes do orçamento: [cálculo](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/reports.ts#L798-L821) e [uso na tela](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/finance-reports/budget.tsx#L18-L38).

Os registros são persistidos por SQL, não apenas mantidos na renderização ([repo.saveEntry](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/db/repo.ts#L338-L365)). Há dados de exemplo opcionais; o carregamento é explicitamente bloqueado quando cloud está habilitada ([guard do modo local](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1852-L1862)). Portanto, gráfico com números não deve ser descrito automaticamente como mockup nem como evidência de dados reais de campo: a origem precisa ser indicada na demo.

**Inferences.** A base analítica é aproveitável para um pitch com indicadores de rotina e decisão do produtor. Os indicadores apresentados acima não demonstram causalmente produtividade ou renda maior.

**Gaps.** Não reproduzimos os cálculos em execução nem validamos os pressupostos com produtor. O próprio domínio registra hipóteses de custo a validar ([comentários e regras de resumo](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L129-L142)).

## 2. Cloud está implementada ou só há um SDK instalado?

**Takeaway.** Existe integração substancial no código: Auth, fila persistente, envio de comandos autenticados, confirmação/versionamento e atualização do cache. O estado remoto atual e a configuração utilizável não foram verificados.

**Cited findings.**

- A ativação depende de `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. O cliente é condicional, persiste sessão e verifica se o token corresponde à conta esperada ([supabase.ts](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/supabase.ts#L6-L46)). Há chamadas de cadastro/login; o caminho local declara login fictício ([auth na camada de estado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1011-L1046)).
- A fila `cloud_outbox` tem tabela SQLite; o serviço lê comandos em ordem e grava UUID, tipo, payload, data e erro ([schema](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/db/schema.ts#L291-L297), [operações da fila](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/cloud-sync.ts#L32-L46)).
- No modo conectado, salvar um lançamento passa por `persistCloud('save_entry', ...)` com versão esperada e escrita local ([entrada no fluxo conectado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810-L1818)). A sincronização chama a RPC `agrogest_command` com o mesmo UUID, trata erro persistido, aplica ACK/versão e remove o comando confirmado; depois, sem fila pendente, busca `agrogest_workspace` e substitui o snapshot local ([protocolo cliente](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/cloud-sync.ts#L67-L130)).
- Reconexão, retorno ao primeiro plano e intervalo periódico acionam o fluxo de sync ([lifecycle](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/sync-lifecycle.ts#L4-L34)).
- Há migrações PostgreSQL versionadas com tabelas privadas, RLS, políticas e revogação de acesso direto ([foundation](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/supabase/migrations/20261018222440_agrogest_foundation.sql#L109-L129)). O backend registra/reutiliza resultados por comando e valida reuso de UUID ([deduplicação](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/supabase/migrations/20261018222440_agrogest_foundation.sql#L265-L280)); a RPC pública é concedida a autenticados ([wrapper](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/supabase/migrations/20261018222440_agrogest_foundation.sql#L384-L396)). A migração posterior de centros de custo também mantém tabelas privadas/RLS e estende comando/workspace ([migração mais recente](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/supabase/migrations/20261027155902_cost_centers.sql#L1-L14)).

**Inferences.** É uma arquitetura implementada de SQLite local com sincronização por comandos para Supabase, e não apenas dependência instalada. A presença das migrações permite inspecionar o contrato de servidor; não certifica a configuração ou segurança do serviço atualmente publicado.

**Gaps.** Não verificamos migrations aplicadas, projeto acessível, políticas vigentes, contas, SMTP, callbacks ou comportamento em aparelho físico. A documentação registra testes hospedados em outubro, explicitamente históricos, e distingue-os de validação física: [limites e registro de 18/10](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/SUPABASE.md#L63-L90) e [histórico de versões em 27/10](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/SUPABASE.md#L267-L272). Isso é evidência documental, não teste reproduzido nesta auditoria.

## 3. Classificação para a rubrica e mínimo demonstrável

| Item | Classificação neste recorte |
|---|---|
| Análise de dados | **Implementada estaticamente:** cálculos e telas conectados aos registros. Execução e qualidade dos dados não verificadas. |
| Cloud | **Implementada estaticamente; configuração/operação atual não verificadas:** Auth + outbox + RPC + snapshot + migrations. Sem variáveis, o caminho é local. |
| Extração fiscal por IA/anexos | **Planejada/não integrada no fluxo conectado auditado:** o próprio `saveEntry` rejeita `nota_fiscal` em cloud e orienta despesa manual ([guard](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810-L1817)). Não é classificação de todos os outros arquivos de IA/CV; essa frente foi auditada separadamente. |
| Storage, extração, painel adicional e push remoto | **Futuros segundo a arquitetura:** não usar como entrega atual ([atual versus planejado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/ARQUITETURA_TECNICA.md#L80-L93)). |

**Demo mínima proposta, não executada.** Em ambiente de teste autorizado, criar lote com base de peso e uma pesagem posterior; mostrar GMD antes/depois com contas conferíveis. Registrar um lançamento com conectividade desligada, mostrar pendência preservada, reconectar, mostrar ACK e recarregar os dados em outra sessão autorizada para comprovar persistência remota. Identificar dados demonstrativos. Não basta mostrar um gráfico local ou o nome Supabase.

Esse fluxo deve usar pesagem/despesa ou outro lançamento já permitido, **não leitura de nota fiscal**: o caminho conectado bloqueia explicitamente esse tipo. Um fluxo foto real → extração de nota → confirmação humana → Supabase exigirá integrar e validar o fluxo de negócio e de persistência, além de conectar um modelo. Os contratos de outbox/RPC existentes para outros lançamentos não provam que notas extraídas já sincronizam.

Para reduzir escopo até 19/11, basta um único fluxo de ponta a ponta, incluindo aprovação se exigida pelo domínio: os indicadores usam lançamentos aprovados. Não é necessário demonstrar todos os relatórios. O requisito de CV/IA precisa de aplicação real própria, examinada na nota da outra frente; a análise e a cloud existentes não tornam sozinhas o projeto completo para GS.

O modo Essencial já oferece uma home sem financeiro/gráficos, com rebanho e atalhos de campo ([código](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/home/essential-home.tsx#L14-L38)). É uma decisão concreta de interface, sem comprovação de acessibilidade ou adoção rural.

## 4. Checagem final: importação assistida para despesa, sem habilitar NF

**Veredito.** O contrato existente permite uma nova integração foto → backend OCR/VLM → JSON sugerido → revisão humana → **despesa** → outbox/RPC → relatório. Isso é uma proposta de implementação, não funcionalidade já entregue. Não exige representar o lançamento como `nota_fiscal` nem alterar seu bloqueio.

A tela de despesa valida valor positivo, descrição, categoria válida e fazenda, além de rateio ou itens. O dispatch atual chama `app.saveEntry` com `kind: 'despesa'`; dados gerais `operationId`, `farmId`, `title`, `amountCents`, `occurredAt`; e payload com categoria/ID, centro de custo, descrição, fornecedor, contraparte, documento, parcelas, critério e rateios. Há padrão de parcela única; estoque é opcional e acrescenta regras. [Validação e dispatch completos](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/despesa.tsx#L145-L195).

No modo conectado, o guard rejeita especificamente `nota_fiscal`; uma despesa segue `persistCloud('save_entry', ...)` com escrita local e versão esperada. [Ramo cloud existente](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810-L1818).

**Ressalvas.** Hoje a tela inicializa por lançamento existente/recorrência e não possui entrada de rascunho OCR. Será preciso um adaptador de formulário e revisão explícita, aproveitando as validações existentes. Valor, descrição, data e fornecedor/documento podem ser sugestões extraídas; categoria, fazenda, centro de custo e rateio exigem associação ao cadastro e confirmação, não podem ser tratados como fatos garantidos pela imagem. O primeiro escopo pode excluir estoque, parcelamento e recorrência. O lançamento precisa alcançar o estado aprovado para entrar nos indicadores auditados. Não foram implementados nem testados o extrator, o adaptador ou o fluxo remoto, e não se deve prometer emissão fiscal, verificação tributária ou arquivamento de NF.

## Proveniência

A página GitHub já adquirida pela coordenação foi lida em `full` até EOF (`complete=true`, `next_cursor=null`, 5.469 caracteres) e preservada em [fontes-github/page.md](fontes-github/page.md), [source-pages.json](fontes-github/source-pages.json) e [record.json](fontes-github/record.json). Ela é um snapshot da página raiz não fixado no commit; as referências de código acima são a evidência principal e estão fixadas no commit auditado.

