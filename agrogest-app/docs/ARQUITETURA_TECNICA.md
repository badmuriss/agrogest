# Arquitetura técnica

## Arquitetura acadêmica vigente · 10/11/2026

Expo/React Native e domínio financeiro/pecuário foram preservados. O frontend usa HTTP para Worker local, com D1/R2 emulados e OCR Tesseract em container Docker local por CPU, publicado apenas em loopback. O container substitui a instalação nativa como padrão de desenvolvimento, mantendo `POST /extract`; Python e modelo com checksum/licença são incluídos na imagem. O [ciclo do container](CLOUDFLARE_LOCAL.md#ciclo-do-container-ocr) concentra recursos, rede e comandos. O [contrato implementado](CLOUDFLARE_LOCAL.md#contrato-e-armazenamento) detalha projeção por cargo, batch atômico com revisão/sessão, idempotência, documentos, SQLite v15 e outbox. `supabase.ts` é fachada compatível; o SDK deixou de ser dependência.

O provedor `local-vision` acrescenta leitura direta da imagem por Qwen3-VL-2B em servidor local autenticado, com API compatível e campos JSON. É uma alternativa explícita ao Tesseract; não há cadeia obrigatória OCR → LLM nem fallback remoto oculto. A revisão escolhe o provedor configurado no backend, guarda a proveniência e valida centavos/datas. Cache inclui versão do pipeline/modelo para não perpetuar uma extração defeituosa. Runtime, chaves e pesos ficam fora do frontend/Git; [setup e contratos](CLOUDFLARE_LOCAL.md#ia-visual-local-opcional).

O destino cloud preparado usa Workers AI e dispensa container de OCR próprio ou GPU administrada pelo projeto; o Tesseract e Qwen continuam opções do backend local. Um Worker hospedado não acessa o `127.0.0.1` do computador do desenvolvedor. A imagem Docker permanece desenvolvimento local, sem configuração/prova de Cloudflare Containers hospedado. Configuração, retenção, concorrência e custos do ambiente cloud ainda precisam de validação real.

Wrangler e assets exportados locais mantêm Metro/Expo existentes e evitam introduzir outro bundler nesta migração. Inferência Workers AI pode sair pelo backend conforme configuração privada; aplicação/DB/storage continuam locais. A configuração de desenvolvimento permanece isolada e só aceita loopback. Uma configuração privada separada prepara staging/produção com HTTPS, frontend na própria origem, D1/R2 próprios e binding AI. O transporte REST permite separar conta de inferência e hospedagem; binding usa a conta de hospedagem. Contas de demonstração são excluídas do pacote cloud e recusadas pelo Auth hospedado; o bootstrap privado é para contas administradas de um piloto, sem cadastro/recuperação operacional. Sessões/SQLite/outbox são distintos por backend e conta, preservando os nomes locais existentes. A [revisão vigente do plano](gs/PLANO.md) distingue realizado, desvios e pendências.

## Arquitetura anterior preservada

As descrições Supabase/PostgreSQL abaixo registram o projeto de outubro. Os cálculos e regras de domínio continuam referência; o backend e a configuração vigentes estão acima.


Tipo: explicação. Estado conferido no código em 26/10/2026. Escopo: `agrogest-app/`.
A decisão inicial ADR-001 escolheu React Native/Expo e operação offline; a implementação
adotou fila própria e RPCs PostgreSQL, substituindo a proposta de API TypeScript separada.

## Implementação atual

| Camada | Implementação e responsabilidade |
| --- | --- |
| Aplicativo | Expo SDK 58, React Native 0.88, React 19.3 e TypeScript; versões exatas no manifesto/lockfile mobile |
| Navegação e apresentação | Expo Router, componentes nativos/web, Inter, Lottie e Reanimated |
| Domínio | `apps/mobile/src/domain/`: cálculos puros, centavos inteiros, datas locais e política de aprovação |
| Estado | Providers e seletores em `src/state/`; preferências e status de sincronização têm consumidores próprios |
| Persistência | SQLite por conta; migrations aditivas, snapshot e outbox persistente |
| Identidade | Supabase Auth; sessão nativa em SecureStore e web em localStorage |
| Backend | PostgreSQL/Supabase, comandos RPC idempotentes e projeção autorizada do workspace |
| Organização | npm, duas instalações e lockfiles independentes; atalhos na raiz |
| Verificação | Tipos/lint, testes Node/SQLite/PGlite e exportação multiplataforma no workflow de qualidade |

A árvore e os comandos ficam em [Desenvolvimento](DESENVOLVIMENTO.md). Os contratos, setup e
registros de validação hospedada ficam em [Supabase](SUPABASE.md). Os arquivos do legado são
referência histórica e não participam da execução do app novo.

## Dados e autoridade

```text
Tela → ação → SQLite / outbox por conta
                    ↓ conexão e sessão válidas
             RPC autenticado no Supabase
                    ↓
     identidade + vínculos + versão + saldo + idempotência
                    ↓
       transação PostgreSQL + auditoria + aprovação
                    ↓
          workspace autorizado → cache SQLite
```

O PostgreSQL confirmado é a fonte de verdade; o SQLite é a fonte de trabalho offline.
O estado local fica provisório enquanto há comandos ou decisões pendentes. O backend
revalida as permissões vigentes; a projeção local não concede autoridade.

- Reenvio mantém UUID e payload; reutilizar UUID com outros dados falha.
- Snapshot confirmado substitui o cache atomicamente sem apagar a fila pendente.
- Resposta antiga não pode atualizar uma nova conta ou descartar sua fila.
- Saldo, origem econômica e histórico não são sobrescritos por “última gravação vence”.
- Aprovação segue [RF-16](REQUISITOS_PRODUTO.md#rf-16--política-de-aprovação): autoria distinta
  quando há aprovador elegível; ausência de aprovador permite efetivação validada no servidor.
  Baixas e movimentações têm a política específica documentada no mesmo requisito.

## Limites de domínio

Operação societária e fazenda física são conceitos distintos. Hoje a interface cria uma
operação por fazenda; cenários societários mais amplos descritos nos requisitos não significam
que todos estejam disponíveis na interface.

Lotes preservam origem e custo de compra. Ocupação por pasto deriva da entrada e dos
lançamentos aprovados, no domínio e no replay do servidor. Transferência física não é venda.
Peso medido e estimado permanecem identificados.

Estoque usa replay por insumo/fazenda; compra é entrada, consumo é apropriação de custo.
Contas a pagar/receber derivam das parcelas das origens confirmadas. Baixa muda caixa, não a
competência do custo. Rateio conserva centavos e não multiplica obrigações. Aluguel simbólico
altera o resultado ajustado e não gera caixa. Regras e padrões provisórios completos estão em
[Requisitos](REQUISITOS_PRODUTO.md#regras-implementadas-de-estoque-e-financeiro).

## Segurança e recuperação

As tabelas privadas não são acessadas diretamente pelo cliente. RPCs públicos invoker chamam
implementações privadas com privilégios controlados e validação de identidade/vínculos.
O workspace omite dados financeiros não autorizados, inclusive após rebaixamento/revogação.
Nunca usar metadados editáveis ou uma chave secreta no cliente como autorização.

Sessões e bancos são isolados por conta. SQLite ainda não tem criptografia própria;
revogar acesso no servidor não apaga imediatamente um aparelho desconectado. Expiração,
criptografia do cache e validação física continuam exigindo trabalho específico.
A recuperação de falha de abertura do SQLite oferece retry preservando dados e URL;
SQLite web/OPFS precisa de validação separada da execução nativa.

## Alternativas e evolução (não implementadas)

| Proposta | Decisão / condição para retomar |
| --- | --- |
| PowerSync | Alternativa à fila própria atual; exige POC de permissões, conflitos, recuperação, compatibilidade nativa e custo antes de adoção |
| API TypeScript dedicada | Não existe hoje; só separar dos RPCs se uma necessidade concreta justificar operação e manutenção adicionais |
| pnpm workspaces e pacotes compartilhados | Proposta inicial não adotada; extrair pacotes quando houver consumidores reais, mantendo o domínio independente de React |
| Painel Next.js | Futuro painel administrativo; o legado não é a implementação desse painel |
| Storage e extração fiscal | Anexos e IA real ainda não integrados; OpenRouter foi escolhido como gateway inicial, com modelo e qualidade a validar |
| Notificações push | Avisos atuais são locais; push remoto é evolução separada |

O contrato de captura, processamento, privacidade e revisão fiscal pertence a
[IA para documentos fiscais](IA_DOCUMENTOS_FISCAIS.md). IA gera dados para revisão e nunca
substitui validações de negócio ou política de aprovação.

React Native/Expo foi escolhido pelo uso em campo, recursos nativos e compartilhamento entre
Android/iOS. Flutter e Kotlin/Swift foram alternativas da decisão inicial; não há benchmark
que declare uma dessas stacks a mais rápida para este produto.

## Critérios de evolução

Preservar origem econômica, centavos, saldo, autoria, auditoria e isolamento em qualquer
mudança. Cobrir reenvio, perda de resposta, troca de conta, revogação e recuperação de fila.
Mudanças em armazenamento precisam preservar dados e comandos pendentes nas migrations.

Antes de adicionar infraestrutura ou trocar listas/sincronizador, medir o problema no fluxo
real. [Desempenho](PERFORMANCE.md) registra condições, bases e limites das medições existentes.
Exportação e testes locais não comprovam publicação, e-mail, concorrência hospedada ou
fluidez em Android/iOS físico. Evidências datadas ficam no [histórico](HISTORICO_REVISOES.md).

## Dimensão gerencial independente (issue #48, 27/10/2026)

Decisão implementada: um centro opcional por despesa/nota e por modelo de recorrência,
independente do rateio financeiro por lote. Agrupamentos têm um nível e vínculo imutável.
As [regras do produto](REQUISITOS_PRODUTO.md#centros-de-custo-e-finalidades-issue-48) descrevem
competência, gastos pagos e inativação; não se alteram as projeções de saldo e estoque.

`domain/cost-centers.ts` valida cadastros/referências. `domain/reports.ts` produz fatos por
ocorrência ou item efetivamente baixado e usa `splitCents` para distribuir ajustes sem perder
centavos. Renegociações conservam a origem gerencial. No cartão, as transferências de
quitação da fatura determinam a data/valor de caixa, com rateio acumulado em centavos entre
as compras originais; saldo inicial não é convertido em nova despesa. A agregação escolhe uma dimensão,
portanto não adiciona o agrupamento como outro fato financeiro.

Reclassificações históricas são documentos separados do lançamento aprovado. Isso preserva
sua versão, aprovação, ocorrência, payload financeiro e baixas. Centros e classificações usam
`finance_docs` no SQLite v14, sem recriar tabelas/dados/outbox, e novas coleções no workspace.
A outbox serializa comandos idempotentes `save_cost_center` e `classify_cost`. Revisões
numéricas detectam edição concorrente sem depender dos horários do aparelho e do servidor.
O snapshot autorizado remove essas coleções quando o vínculo financeiro é perdido.

O backend mantém as tabelas no schema privado, com RLS e sem grants diretos. O despachante
RPC revalida vínculo, revisão e referências da operação antes de gravar, e mantém auditoria.
[Contrato e migration](SUPABASE.md#centros-de-custo-issue-48).
