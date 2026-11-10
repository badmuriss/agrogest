# AgroGest — Levantamento de Requisitos do Produto

## Situação da cópia acadêmica · 10/11/2026

As regras RF/RN abaixo foram preservadas na migração para backend Worker/D1/R2 **local**. RF-16 continua exigindo outra pessoa elegível, inclusive outro sócio para financeiro; mantém a exceção já vigente para produtor sozinho. Não houve mudança para autoaprovação por IA.

RF-20 está **parcialmente implementado**: imagem real de comprovante → OCR/IA visual local → revisão → despesa com original anexado → aprovação/sync → indicador. PDF/XML, extração fiscal completa e validação em corpus real continuam pendentes. RF-18/offline mantém SQLite/outbox por conta e agora captura/resultado/revisão persistentes em v15. Auth local usa senha verificada em contas sintéticas; cadastro/recuperação/e-mail de produção não são atendidos nesta entrega. Mapas remotos desativados preservam geometrias existentes. A preparação de nuvem usa identidades próprias administradas e impede contas/senha públicas de demonstração fora do ambiente local; não substitui cadastro/recuperação e antiabuso de produção. Cloudflare Workers AI é o único provedor hospedado suportado, ainda sem ensaio real. Trocar inferência preserva dados; trocar backend isola sessão/SQLite/outbox e exige concluir ou preservar a fila no ambiente de origem.

O [guia atual](CLOUDFLARE_LOCAL.md) e o [histórico datado](HISTORICO_REVISOES.md) discriminam implementação e verificações. As menções a Supabase hospedado e medições de outubro no restante são histórico da origem, não execução remota desta versão.


> **Tipo:** referência de produto. **Status:** regras vigentes e escopo futuro identificado; requisito descrito não comprova implementação.\
> **Atualizado em:** 26/10/2026 (America/Sao_Paulo, UTC−03:00)\
> **Origem:** entrevistas com produtor de recria e engorda bovina, com foco atual em fêmeas.\
> **Objetivo:** manter regras de negócio e decisões de produto em uma única referência.

## Como interpretar o escopo

**Implementado:** modos local/conectado, fazendas e lotes, documentos de compra como números
opcionais, pastos/manejo, estoque, financeiro e relatórios, convites, aprovação e sincronização
por comandos. As regras operacionais detalhadas de estoque e financeiro estão na seção final.

**Planejado ou a validar:** extração fiscal real e anexos (RF-20), painel administrativo
separado, cargos além de sócio/funcionário e políticas societárias avançadas. Atualmente cada
fazenda criada pela interface tem sua própria operação; o modelo mais amplo não implica
uma interface pronta para todas as combinações. Cenários e checklists expressam objetivos
quando não houver indicação de implementação. Validação em aparelho e publicação exigem
evidências próprias.

## 1. Visão do produto

O AgroGest é um aplicativo de **gestão operacional, zootécnica, econômica, financeira, documental e societária da pecuária**, projetado para uso no campo, **offline-first** e com sincronização quando houver conexão.

### Problema identificado

O produtor usa planilhas para registrar compras de animais e insumos, despesas, pesagens, pagamentos, recebimentos, documentos, tributos e resultados. Registros podem ser esquecidos, registrados incorretamente ou duplicados. Também existe dificuldade para acompanhar o custo real de cada lote, os compromissos financeiros futuros e a rentabilidade de diferentes operações e sociedades.

### Princípios orientadores

1. **Registrar uma vez, refletir em vários controles:** uma operação gera os efeitos necessários em estoque, rebanho, custos, financeiro e relatórios, sem duplicar o fato.
2. **Lote como unidade econômica fundamental:** preservar o custo por origem de compra até a venda, mesmo depois de transferências e misturas.
3. **Operação e propriedade são coisas diferentes:** uma fazenda pode abrigar mais de uma operação, com sócios distintos; uma operação pode utilizar várias fazendas.
4. **Competência/ocorrência diferente de caixa:** registrar o fato econômico e seus pagamentos/recebimentos em datas distintas.
5. **Resultado real e ajustado:** calcular ambos, com e sem custo de oportunidade da pastagem própria.
6. **Aprovação conforme elegibilidade:** com outro aprovador habilitado, lançamentos exigem segunda aprovação; sem ele, o servidor pode efetivar após validação. Baixas e movimentações financeiras têm política própria. Ver RF-16.
7. **Offline verdadeiro:** consulta e captura no dispositivo sem internet, sincronização posterior com integridade e trilha de auditoria.
8. **Precisão identificada:** diferenciar medida efetiva, estimativa visual e apropriação proporcional; nunca apresentar estimativas como rastreabilidade individual comprovada.

## 2. Glossário e modelo conceitual

| Termo | Definição |
| --- | --- |
| **Fazenda / propriedade** | Local físico da criação: propriedade, áreas, pastos, instalações e estoques locais. |
| **Operação pecuária** | Unidade econômica/societária que compra, mantém e vende animais e apura seus próprios resultados. |
| **Pessoa** | Pessoa física ou jurídica cadastrada: sócio, funcionário, fornecedor, frigorífico, prestador, consultor etc. |
| **Usuário** | Pessoa autenticada, com um ou mais vínculos, cargos e permissões. |
| **Vínculo societário** | Participação de um sócio em uma operação, com percentual e vigência. |
| **Lote de origem / compra** | Grupo adquirido de determinado fornecedor em uma compra; preserva histórico e custos de aquisição. |
| **Lote de manejo** | Grupo físico de animais reunidos num pasto/área, podendo conter várias origens. |
| **Animal individual** | Animal com identificação própria, quando disponível, associado à sua origem e histórico. |
| **Lançamento** | Registro de fato de negócio sujeito a aprovação; pode ter efeitos em múltiplos módulos. |
| **Apropriação** | Alocação econômica de um custo a operação, propriedade, lote ou animal; não equivale a pagamento. |
| **Rateio** | Critério usado para dividir um custo compartilhado sem duplicá-lo. |
| **Resultado real** | Resultado gerencial da produção com receitas e custos reais atribuídos, sem aluguel fictício. |
| **Resultado ajustado** | Resultado real subtraído do custo de oportunidade imputado da pastagem. |
| **Romaneio** | Documento de abate com pesos/classificação e/ou totais de carcaça apurados pelo frigorífico. |

**Relacionamentos esperados:**
- Uma operação tem um ou vários sócios; um sócio pode participar de várias operações, em percentuais diferentes.
- Uma operação utiliza uma ou várias propriedades; uma propriedade pode atender várias operações **como exceção suportada**, mas **a prática atual do produtor é manter normalmente uma sociedade/operação fixa por fazenda**.
- Uma compra gera lote(s) de origem vinculados a uma operação; um lote de manejo pode conter origens diferentes.
- Toda movimentação de rebanho e apropriação preserva operação, lote de origem, propriedade, período e autoria, quando pertinentes.
- Uma despesa pode atingir múltiplas fazendas, operações e lotes; seus rateios devem somar o valor apropriado, sem multiplicar o financeiro.
- O percentual societário pode mudar; históricos devem ser preservados por vigência.

> **Decisão de modelagem:** cadastro da propriedade, cadastro da operação econômica, cadastro societário e identidade do usuário são entidades separadas. Não presumir que proprietário da terra seja proprietário de todos os animais.

## 3. Requisitos funcionais

### RF-01 — Fazendas, áreas e locais

> **Implementado em 19/10/2026 (issue #43):** pastos por fazenda com nome único, área útil, capim, observações e situação ativo/inativo; seleção ou cadastro no próprio formulário do lote; mudança de pasto como movimentação auditável. Ver RF-04, RF-06 e [SUPABASE.md](SUPABASE.md).

- Cadastrar múltiplas fazendas, informações básicas, localização e áreas/pastos de manejo.
- Vincular uma ou mais operações a uma fazenda, conforme vigência e condições de utilização.
- **Padrão operacional confirmado em 14/10/2026:** normalmente **uma sociedade/operação por fazenda**, com a operação padrão sugerida/preenchida automaticamente nos lançamentos, sempre visível para conferência.
- Preservar a possibilidade de **múltiplas operações numa mesma fazenda** como caso excepcional/futuro, sem impor essa complexidade na experiência cotidiana.
- Localizar lotes/animais e estoques por fazenda/pasto.
- Registrar transferências entre pastos, fazendas e operações, preservando o histórico físico, econômico e documental.
- Apresentar visões **por fazenda**, **por operação** e **consolidadas**, conforme permissão.
- Identificar custo de manutenção e outras despesas da propriedade, com critérios de rateio.

### RF-02 — Pessoas, sociedades e vínculos

- Cadastrar pessoas físicas/jurídicas: sócios, fornecedores, produtores vendedores, frigoríficos, funcionários, diaristas, prestadores, contadores e consultores.
- Criar operações pecuárias com sócios e percentuais de participação próprios, independentes do cadastro de fazendas.
- Registrar participação, início/fim da vigência, cargo e histórico de alterações; tratar eventual diferença entre participação econômica e poder de aprovação.
- Permitir a mesma pessoa como sócia de uma operação e consultora/funcionária de outra.
- Manter relatórios de participação em resultados, **sem confundir resultado atribuível com distribuição efetiva de lucro**.
- Prever registro distinto de aportes, retiradas e distribuição de resultados, sem classificá-los como receitas/despesas operacionais.

### RF-03 — Compras de animais / lotes de origem

Registrar:
- operação compradora, fazenda de destino, fornecedor, data da aquisição, categoria (com foco inicial em fêmeas), quantidade de cabeças;
- peso médio na entrada e método de obtenção do peso;
- valor total da compra, preço médio por cabeça (e outras unidades quando aplicáveis);
- comissão, frete e outros custos acessórios de aquisição;
- documentos, condições de pagamento, parcelas e observações.

Regras:
- Criar lote de origem com código único e custo de entrada identificável.
- Não confundir preço dos animais com comissão/frete: todos compõem a análise gerencial do investimento inicial, em categorias separadas.
- Diferenciar data de aquisição, vencimentos e efetiva saída de caixa.
- Preservar a origem mesmo se o lote for dividido ou mesclado no manejo.

### RF-04 — Rebanho e movimentações

> **Mudança de pasto implementada em 19/10/2026:** movimentação total ou parcial entre pastos da mesma fazenda, sem alterar o lote de origem, seus custos ou histórico. A ocupação por pasto e lote é reconstruída dos lançamentos aprovados e validada no servidor (saldo, datas retroativas, concorrência). Transferência entre fazendas continua uma operação separada, agora com escolha do pasto de chegada.

- Manter saldo de cabeças por operação, origem, lote de manejo, fazenda e pasto.
- Registrar formação, divisão, mistura e transferência de lotes.
- Registrar vendas totais ou parciais, perdas/mortalidade e outras intercorrências.
- Em venda parcial/conjunta, indicar a origem dos animais baixados por:
  1. **seleção individual** dos animais identificados;
  2. **apropriação manual** de quantidades por origem;
  3. **apropriação proporcional** ao saldo de cabeças de cada origem.
- Manter sinalização de que a origem foi **rastreada** ou **apropriada/estimada**.
- Não permitir quantidade negativa nem baixa superior ao saldo confirmado; conflitos offline exigem revisão.
- Manter saldo e custo dos remanescentes após uma venda parcial.

### RF-05 — Identificação individual opcional (escopo planejado)

- Operar integralmente por lote **sem exigir brinco ou identificação interna**.
- Permitir cadastro individual opcional: brinco/código, marca, origem, fazenda, lote de manejo, pesos, intervenções e histórico.
- Permitir modelo misto: identificados e não identificados na mesma operação.
- Permitir individualização posterior de animais já controlados coletivamente, atribuindo informações/custos disponíveis sem inventar histórico individual.
- A marca do fornecedor pode auxiliar a identificação, mas **não constitui rastreabilidade individual garantida**.

### RF-06 — Pesagens e evolução zootécnica

Suportar simultaneamente:
1. **Pesagem física na balança**, geralmente registrando o peso médio do lote.
2. **Estimativa visual** do peso médio por experiência do produtor.
3. **Somente peso de entrada e saída**, sem medições intermediárias.
4. **Pesagem individual**, quando houver identificação.

Campos: data, fazenda, operação, lote(s), quantidade efetivamente pesada/avaliada, peso total ou médio, unidade (peso vivo ou carcaça), método (medido/estimado), usuário, observações/anexos.

Indicadores quando os dados permitirem:
- ganho de peso total e por cabeça;
- ganho médio diário (GMD);
- evolução por período;
- custo por kg de ganho e por arroba pertinente ao contexto;
- comparação com receita e margem por lote.

**GMD por pasto (19/10/2026):** só intervalos entre duas pesagens do mesmo grupo, no mesmo pasto e sem mudança de pasto ou de composição entre elas; o relatório mostra base de cálculo, método medido/estimado e "Dados insuficientes" quando não há base. A comparação por capim é descritiva, não causal.

**Cuidado:** diferenciar peso vivo e peso de carcaça; uma amostra ou lote com composição alterada não representa automaticamente o peso médio de todos os animais históricos. Indicadores baseados em estimativa deverão ser identificados como estimados.

### RF-07 — Insumos, estoque e consumo

- Cadastrar produtos como sal, sal mineral, proteinado, medicamentos e outros insumos.
- Registrar compras, quantidades, unidades, fornecedores, preços, fazenda/almoxarifado, documentos e vencimentos.
- Controlar saldo por local, entradas, consumo, ajustes e transferências.
- Registrar aplicação/consumo para lote(s), operação(ões) e período(s), com rateio.
- **Separar compra de estoque do consumo apropriado aos animais:** compra não implica que o estoque foi consumido no mesmo mês.
- Permitir histórico de preço e consumo por insumo.

### RF-08 — Despesas, receitas e categorias operacionais

- Registrar despesas com diaristas, funcionários, mão de obra, fornecedores, fretes, comissão, medicamentos, alimentação, manutenção de cercas, pastagem, hidráulica/água, máquinas, combustíveis, energia e outras categorias configuráveis.
- Registrar receita de venda de animais e outras receitas da operação quando aplicáveis.
- Classificar lançamento por natureza, data de ocorrência, operação, fazenda, centro de custo e documentação.
- Vincular despesas compartilhadas a vários lotes, fazendas ou operações.
- Distinguir despesa direta, custo compartilhado, investimento/ativo, aquisição de estoque e movimentação meramente financeira, conforme regras de classificação gerencial a validar.
- Evitar que transferências financeiras, aportes e ajustes gerem receitas/custos de produção artificiais.

### RF-09 — Rateio e custeio por lote

O custo pode ser apropriado integralmente a um lote ou rateado entre vários, com seleção do critério:
- **Por cabeça:** padrão preferido pelo produtor.
- **Por peso vivo total:** quantidade de cabeças × peso médio aplicável.
- **Manual:** percentual ou valor editável, com justificativa quando cabível.

Regras:
- Registrar base, pesos, quantidades, data/período, critério, autor e aprovador do rateio.
- Utilizar composição/saldo de animais na data ou no período da apropriação, sem aplicar retroativamente quantidades atuais a meses passados.
- Para períodos extensos, prever cálculo por cabeça-dia/peso-dia ou média do período, conforme tipo de custo.
- Um lançamento financeiro gera **uma obrigação**, ainda que distribua custos a muitos lotes/operações.
- A soma dos valores apropriados deve fechar exatamente com a parcela custeável, considerando arredondamento.
- Após venda parcial, preservar custo histórico dos vendidos e dos animais remanescentes.
- Custos compartilhados entre operações com sócios distintos exigem aprovação conforme todas as operações afetadas.
- Método gerencial inicial sugerido para animais não individualizados: **custo médio por cabeça dentro de cada origem**; validar com o produtor antes da implementação final.

**Exemplo:** origem A = 40 cabeças × 220 kg = 8.800 kg; origem B = 40 cabeças × 190 kg = 7.600 kg. Despesa de R$ 10.000:
- Por cabeça: R$ 5.000 para A e R$ 5.000 para B.
- Por peso: 8.800/16.400 para A (R$ 5.365,85) e 7.600/16.400 para B (R$ 4.634,15).
- Valores ilustram o método, não um custo real registrado.

### RF-10 — Financeiro: competência, compromissos e caixa

Para cada fato econômico financeiro, distinguir:
- **data da ocorrência/competência gerencial** (quando o evento pertence ao resultado ou a uma obrigação);
- **data(s) de vencimento** de parcelas;
- **data(s) e valor(es) efetivamente pagos ou recebidos**.

Recursos:
- Contas a pagar e receber, parcelamento, baixas totais/parciais, histórico de pagamentos e recebimentos.
- Fluxo de caixa realizado e projetado por conta, fazenda e operação.
- Projeção de saldo com compromissos futuros.
- Conciliação/controle bancário como evolução a avaliar.
- Em compras de insumos, apropriação ao resultado pode ocorrer no consumo, não necessariamente na compra ou no pagamento.
- Em compras de animais, distinguir investimento/custo do rebanho do desembolso financeiro.
- Relatórios devem explicitar premissas de apuração gerencial; não presumir equivalência automática com escrituração contábil/fiscal.

**Exemplo:** compra de R$ 12.000 em 13/10, pagável em três parcelas de R$ 4.000 nos meses seguintes: a compra/obrigação ocorre em outubro; o caixa reflete cada pagamento; a apropriação de insumo aos lotes depende do consumo.

### RF-11 — Comercialização / frigoríficos / abate

Modelo principal confirmado: **venda para frigorífico por arroba de carcaça, com preço negociado na data de abate/negociação**.

Registrar:
- frigorífico, operação vendedora, fazenda de saída, origens/lotes envolvidos;
- data de negociação, embarque, abate e faturamento;
- número de animais, peso vivo quando disponível;
- preço efetivamente negociado em R$/arroba de **carcaça**;
- romaneio (dados individuais e/ou consolidados), peso de carcaça efetivo, classificação, descontos e bonificações;
- comissão, frete de venda, tributos aplicáveis, outras deduções e valor a receber;
- nota, documentos de trânsito aplicáveis, comprovantes, parcelas e recebimentos.

Cálculo gerencial básico:
- arrobas de carcaça = peso de carcaça em kg ÷ 15;
- receita bruta = arrobas de carcaça × preço negociado por arroba;
- receita líquida/resultado: deduzir itens pertinentes de venda e custos corretamente atribuídos.

**Não substituir preço negociado por cotação presumida do mercado.** Preço de mercado pode servir como referência, mas a transação usa o preço acordado e os dados do romaneio.

Permitir:
- venda total de um lote;
- venda parcial;
- venda conjunta com animais de diferentes origens;
- venda após misturas e transferências;
- atualização de saldos físicos, estoque econômico e resultado por origem/operação.

### RF-12 — Resultados e indicadores

Oferecer visões:
- **Por lote de origem:** receita, custo de compra, frete, comissão, despesas apropriadas, mortalidade, ganho de peso, saldo remanescente e rentabilidade.
- **Por lote de manejo:** animais presentes, evolução de peso, consumo e custos do grupo, com transparência quanto às origens.
- **Por fazenda:** rebanho físico, estoques, despesas da propriedade, custos apropriados e desempenho do uso da área.
- **Por operação pecuária:** resultado econômico, caixa, obrigações, vendas, custos e investimentos.
- **Por sócio:** participação econômica teórica e movimentações societárias efetivas, separadas.
- **Consolidado:** operações autorizadas, eliminando duplicações em rateios e transferências internas.

Apresentar indicadores: cabeças, pesos médios, GMD quando calculável, custo por cabeça, custo de engorda por kg ganho, receita por arroba de carcaça, margem, resultado real e ajustado, contas a pagar/receber e projeção de caixa.

### RF-13 — Aluguel simbólico / custo de oportunidade da pastagem

**Requisito confirmado:** mesmo na fazenda própria, o produtor imputa aluguel de pastagem por **R$/cabeça/mês** para comparar produzir gado vs. alugar a área a terceiros.

- Parametrizar tarifa por propriedade (e, futuramente, área/operação), com datas de vigência.
- Apropriar aos animais por tempo efetivo de permanência; sugerido cálculo proporcional por **cabeça-dia**, respeitando as mudanças no rebanho e transferências.
- Gerar **resultado real** (sem aluguel simbólico) e **resultado gerencial ajustado** (com o custo imputado), lado a lado.
- Aluguel simbólico **não gera** saída no caixa, conta a pagar, fornecedor fictício ou obrigação tributária por si só.
- Diferenciar eventual aluguel de pastagem **efetivamente pago** e impedir dupla contagem ao aplicar custo de oportunidade.
- Preservar tarifa e regra vigentes para períodos já apurados; alterações retroativas exigem ação explícita e auditoria.

**Exemplo:** 40 cabeças × R$ 50/cabeça/mês × 6 meses = R$ 12.000 de custo simbólico, se a quantidade permanecer constante. Resultado real de R$ 48.500 → resultado ajustado de R$ 36.500 (somente exemplo).

### RF-14 — Documentos, fiscal e conformidade

- Anexar notas fiscais, comprovantes, GTAs, romaneios, contratos, registros de compra/venda e documentos de fornecedores/prestadores.
- Associar arquivos a operações, fazendas, lotes, animais, despesas, pagamentos e vendas.
- Permitir consulta e organização por período, tipo e contraparte.
- Disponibilizar exportações para contador, controle de receita e preparação de imposto de renda/obrigações pertinentes.
- **Pendente de validação com contador e especialistas:** regras fiscais, documentos exigidos, dados pessoais e eventuais integrações com sistemas oficiais. Não assumir emissão fiscal automática no primeiro momento.

### RF-15 — Acesso, cargos e permissões

Perfis iniciais configuráveis: **sócio**, **sócio administrador**, **gerente/administrador de fazenda**, **funcionário**, **financeiro**, **consultor**, **contador** e **consulta**.

- Cargo é descrição do vínculo; **permissão efetiva** deve ser configurada separadamente.
- Restringir acesso por operação e fazenda, inclusive escopo de documentos, custos, dados societários e financeiros.
- Mesmo usuário pode possuir papéis diferentes por operação/propriedade.
- Permissões por ação: consultar, criar, submeter, corrigir, aprovar, rejeitar, estornar, exportar, gerenciar usuários e parâmetros.
- Sócio de uma operação não recebe automaticamente acesso irrestrito a outra.
- Toda aprovação valida que o usuário é habilitado **na operação impactada**.

### RF-16 — Política de aprovação

**Regra vigente:** um lançamento exige segunda aprovação quando existe outra pessoa elegível
na operação. O autor nunca aprova o próprio lançamento. Convites pendentes não tornam alguém
aprovador. Sem outra pessoa elegível, o registro pode ser efetivado pelo servidor após validar
permissões, saldo e consistência; no modo local, o domínio simula essa validação.

- Despesa, venda, nota fiscal, receita e ajuste de estoque exigem **outro sócio** quando houver
  aprovador elegível. Consumo, pesagem, mortalidade e transferências operacionais seguem a
  elegibilidade de membros da operação.
- **Baixas e movimentações financeiras** são registradas pelo sócio que as realizou, sem segunda
  aprovação, com auditoria e estorno; a baixa depende de obrigação confirmada e saldo em aberto.
- Rascunho, aguardando envio, pendente de aprovação, aprovado, rejeitado e conflito são estados
  distintos. Uma intenção offline não confirma efeitos no servidor.
- Efeitos derivados (parcelas, rateios e estoque) seguem a aprovação da origem. Correções e
  estornos preservam o histórico. Aprovação cruzada entre operações é política a detalhar.

Referências: `../apps/mobile/src/domain/approval.ts` e [contratos do backend](SUPABASE.md).
**Decisão anterior, substituída:** o levantamento inicial exigia segunda pessoa até para o
produtor sozinho. A exceção já estava implementada e documentada desde 18/10/2026; esta revisão
apenas elimina a contradição textual, sem alterar o aplicativo.

### RF-17 — Mobile offline-first e sincronização

> **Implementação inicial de 18/10/2026:** a integração em código usa outbox SQLite, comandos idempotentes e snapshot autorizado pelo servidor. PowerSync permanece candidato à comparação; validação remota, concorrência real e aparelhos físicos precisam de evidência própria. Ver [SUPABASE.md](SUPABASE.md).

**Requisito confirmado:** app móvel utilizável sem internet, com sincronização posterior, múltiplos usuários e dispositivos.

Offline:
- consultar dados autorizados já sincronizados;
- cadastrar operações, fazendas/lotes disponíveis localmente, pesagens, estimativas, custos, consumo, despesas, vendas, mortalidade e documentos;
- registrar rascunhos e submissões pendentes;
- visualizar resultados locais como **provisórios** se houver dados não sincronizados/não aprovados;
- registrar decisões de aprovação offline apenas como pendentes de validação central, jamais como efetivação definitiva.

Ao recuperar conexão:
- envio automático de operações/documentos pendentes e recepção das mudanças;
- IDs únicos e operações idempotentes (reenvio não duplica efeitos);
- validação de permissões atuais, autoria distinta, integridade, saldo físico e financeiro;
- conflitos resolvidos sem sobrescrita silenciosa (ex.: dois celulares vendendo mais animais do que o saldo);
- confirmação de status e histórico por operação/dispositivo;
- indicador de conexão, última sincronização, pendências, falhas e itens que exigem intervenção;
- reprocessamento confiável e tratamento de anexos de grande tamanho.

Segurança e riscos:
- armazenar dados locais de forma protegida; autenticação e sessões adaptadas ao ambiente offline;
- tratar perda/roubo de dispositivo, revogação de acesso, sincronizações interrompidas e dados sensíveis já em cache;
- uma revogação realizada no servidor não consegue apagar instantaneamente dados de aparelho desconectado: mitigar por políticas de cache, criptografia e revalidação na sincronização;
- o registro salvo somente no celular **pode se perder antes de sincronizar**, logo oferecer avisos e backups adequados.

**Arquitetura atual:** SQLite por conta, fila própria e comandos RPC transacionais no Supabase. Alternativas e evolução estão em [ARQUITETURA_TECNICA.md](ARQUITETURA_TECNICA.md).

### RF-18 — Auditoria e relatórios exportáveis

- Trilha de auditoria de quem criou, editou, submeteu, aprovou/rejeitou, estornou e sincronizou.
- Registrar tempo da ocorrência, tempo da captura e tempo de confirmação no servidor, quando distintos.
- Não apagar silenciosamente movimentações aprovadas; utilizar estorno/correção rastreável.
- Exportar relatórios gerenciais, financeiros, societários, de lotes e documentação em formatos adequados (a definir).
- Disponibilizar filtros por fazenda, operação, sócio, lote, fornecedor, frigorífico e período.

### RF-19 — UX adaptativa por perfil, experiência e contexto

**Implementado:** modos Essencial, Gerencial e Analítico, tema claro/escuro, navegação por
permissão e preferências por usuário. Modo de apresentação nunca concede acesso financeiro,
dispensa regras de aprovação ou altera resultados calculados (RN-16).

Mostrar unidade, método de peso, operação/fazenda e diferença entre salvo localmente e
confirmado. Preservar acessibilidade, redução de movimento e legibilidade no campo.
Navegação, estados, onboarding, componentes e critérios de UX são mantidos em
[EXPERIENCIA_USUARIO.md](EXPERIENCIA_USUARIO.md), sem repetir aqui o catálogo de telas.

### RF-20 — Leitura de notas fiscais por IA

**Necessidade confirmada; integração real ainda não implementada.** O protótipo local devolve
uma nota fictícia; esse resultado não pode criar dados fiscais simulados na nuvem.

A entrega planejada deve aceitar PDF/foto (XML como fonte determinística opcional), extrair
campos sem inventar dados, apresentar rascunho para revisão humana e aplicar a política RF-16.
Compra de insumos e consumo são fatos distintos. Reenvio/reprocessamento não duplica efeitos.
A captura offline, anexos privados, validações, OpenRouter como gateway inicialmente escolhido,
modelo e critérios de aceite estão em [IA_DOCUMENTOS_FISCAIS.md](IA_DOCUMENTOS_FISCAIS.md).

## 4. Regras críticas de consistência

| Código | Invariante |
| --- | --- |
| RN-01 | Nenhum lançamento pode ser aprovado pelo próprio criador. |
| RN-02 | Quando houver aprovador elegível, lançamentos financeiros exigem **outro sócio autorizado**. Exceções e baixas seguem RF-16. |
| RN-03 | Nenhum evento offline cria saldo definitivo no servidor até validação/sincronização/aprovação. |
| RN-04 | Um pagamento não altera retroativamente a data da ocorrência econômica; caixa e competência são eixos distintos. |
| RN-05 | Um custo rateado mantém valor total constante, sem duplicar contas financeiras. |
| RN-06 | Transferência física de animais entre fazendas não é automaticamente venda. |
| RN-07 | Mistura/divisão física não apaga a origem econômica nem o histórico de custos. |
| RN-08 | Vendas parciais consomem somente as quantidades/custos correspondentes, preservando remanescentes. |
| RN-09 | Identificação/atribuição estimada deve continuar sinalizada como estimativa. |
| RN-10 | Aluguel simbólico modifica somente resultado gerencial ajustado, nunca contas a pagar/caixa real. |
| RN-11 | Preço realizado da venda é o negociado com o frigorífico, com base no romaneio do abate. |
| RN-12 | Não permitir quantidade negativa consolidada de animais nem saldos de estoque inconsistentes sem ajuste autorizado. |
| RN-13 | Resultados consolidados não duplicam custos de transferências e rateios internos. |
| RN-14 | Mudança de sócios/percentuais tem vigência e não reescreve automaticamente períodos históricos. |
| RN-15 | Cargos e permissões são avaliados por escopo de operação/propriedade e versão da política vigente. |
| RN-16 | O modo Essencial/Gerencial/Analítico modifica a apresentação, **não** a autorização, necessidade de aprovação, precisão, integridade ou o resultado econômico. |
| RN-17 | Dados extraídos por IA originam **rascunho para conferência**, nunca lançamentos financeiros/pecuários já efetivados; aplicar RF-16 após revisão humana. |
| RN-18 | Documento armazenado/reenviado ou reprocessado não pode duplicar contas, estoque ou custos; campos ausentes continuam pendentes. |

## 5. Exemplos de processos ponta a ponta

### Cenário A — Compra parcelada e rateio de proteinado

1. Comprar 40 animais da origem A a 220 kg médios, vinculados à operação X e Fazenda 1.
2. Registrar valores de compra, comissão, frete, documento e compromissos parcelados.
3. Um usuário submete; **outro aprovador habilitado** valida; o sistema efetiva compra, custos e obrigações uma única vez.
4. Comprar 40 animais da origem B a 190 kg médios.
5. Registrar compra de proteinado e entrada no estoque, com pagamentos em datas futuras.
6. Registrar **consumo efetivo** de R$ 10.000, distribuído por cabeça: R$ 5.000 para cada origem (ou por peso, a critério).
7. Mostrar apropriação econômica aos lotes e saídas financeiras somente quando pagas.
8. Guardar autoria e aprovação de cada lançamento e as premissas dos rateios.

### Cenário B — Mistura, perda e venda parcial

1. Reunir origens A e B num lote de manejo de 80 cabeças.
2. Registrar pesagem física ou estimativa visual de peso médio, com método identificado.
3. Registrar mortalidade, se ocorrer, com impacto em saldo e custos.
4. Vender 30 cabeças ao frigorífico; apontar quais origens saíram por seleção individual ou alocação estimada manual/proporcional.
5. Informar arrobas de carcaça efetivas do romaneio e preço negociado.
6. Deduzir custos de aquisição e engorda atribuídos aos vendidos, frete/comissão de venda e outras deduções pertinentes.
7. Apurar resultado dos vendidos e preservar saldo físico/econômico dos remanescentes.

### Cenário C — Duas sociedades na mesma propriedade

1. Fazenda 1 é utilizada pelas operações X (sócios A/B) e Y (sócios A/C).
2. Funcionário lança manutenção de cerca e propõe rateio entre X e Y.
3. O lançamento entra como pendente; aprovadores autorizados de cada operação atingida validam suas parcelas conforme regra a detalhar.
4. O servidor gera uma única obrigação financeira e apropriações segregadas por operação/lote.
5. Relatórios por sócio e operação exibem suas respectivas parcelas sem dupla contagem.

### Cenário D — Aluguel simbólico

1. Propriedade própria: configurar tarifa hipotética de R$ 50/cabeça/mês.
2. Calcular permanência dos animais por período, levando em conta entradas, saídas e transferências.
3. Resultado do lote: R$ 48.500 real; R$ 36.500 com R$ 12.000 de custo imputado (exemplo).
4. Mostrar as duas visões; **não gerar pagamento nem conta a pagar**.

### Cenário E — Dois dispositivos offline

1. Celular A registra venda de 20 animais de um lote com saldo sincronizado de 30.
2. Celular B, offline, registra venda de 15 dos mesmos 30.
3. Os dispositivos se conectam; o servidor recebe propostas de movimentação.
4. A sincronização detecta que o saldo não comporta ambas as baixas, impede consolidação inconsistente e encaminha conflito à revisão.
5. A efetivação exige aprovação por segunda pessoa, independentemente do dispositivo.

## 6. Requisitos não funcionais

- **Usabilidade no campo:** entradas rápidas, telas legíveis, navegação simples, poucos passos, formulários com validação e valores-padrão conscientes.
- **Resiliência:** sem perda silenciosa de operações, reenvio seguro e retomada de sincronizações interrompidas.
- **Consistência:** transações atômicas no servidor para rebanho, financeiro e custos decorrentes da mesma aprovação.
- **Segurança:** autenticação, autorização por escopo, trilhas de auditoria, criptografia adequada em trânsito/repouso e proteção de dados nos aparelhos.
- **Desempenho:** operações essenciais sem depender de rede; sincronização incremental para conexões rurais instáveis.
- **Evolução:** suportar expansão para identificação individual, importação de romaneios/planilhas e integrações fiscais sem remodelagem completa.
- **Observabilidade:** registrar erros de sincronização, conflitos e divergências para suporte e correção.
- **Governança de dados:** política de retenção, backups, recuperação, exportação e segregação entre operações e sócios.

## 7. Proposta inicial de MVP e sequência de entregas

Direção de produto da descoberta; não é uma lista atual de pendências. Compare com o estado
implementado no início do documento e com as decisões datadas abaixo.

Esta seção é **sugestão de implementação**, não mudança nos requisitos confirmados.

### Núcleo obrigatório do produto inicial

> **Prioridade atualizada:** a importação de notas fiscais por IA (PDF/foto) é uma **funcionalidade central**, a incluir no primeiro ciclo funcional. Dependências de conexão e qualidade do OCR devem ser testadas.

1. Cadastro de operações, sócios, participações, fazendas, usuários, cargos e permissões.
2. Captura offline, fila de sincronização, autenticação e controle de conflitos.
3. Fluxo obrigatório de aprovação por segunda pessoa, com segundo sócio em despesas.
4. Compras de animais, lotes de origem e manejo, movimentações, mortalidade e identificação individual opcional.
5. Pesagem física e estimada; vendas totais/parciais por arroba de carcaça.
6. Despesas, compromissos parcelados, pagamentos/recebimentos, consumo de insumos e rateios.
7. Resultado por lote, operação e fazenda, com comparação real vs. aluguel simbólico.
8. Relatórios básicos e anexos/documentos associados.
9. **Importação de nota fiscal por foto/PDF e IA**, com extração, conferência humana, rascunho de lançamento, deduplicação e segundo aprovador.

### Evoluções candidatas

- Importação de outros documentos (romaneios, planilhas e PDFs não fiscais), além do núcleo de notas fiscais do MVP.
- Integrações com serviços fiscais, financeiros, emissão de documentos e rotinas do contador, após validação das obrigações e APIs.
- Leitura de identificação animal por equipamentos, integração com balanças e captura automatizada.
- Análises comparativas avançadas, alertas, previsão de caixa e desempenho.
- Interface web administrativa, se a demanda justificar.

## 8. Critérios mínimos de aceite

- [ ] Dois sócios da mesma operação conseguem acessar e ver somente operações autorizadas.
- [ ] Funcionário cadastra despesa offline; após sincronização, outro sócio aprova; valor e rateio aparecem exatamente uma vez.
- [ ] Sócio não consegue aprovar seu próprio lançamento.
- [ ] Atribuição de despesa a dois lotes fecha exatamente o total da despesa, sem duplicar o pagamento.
- [ ] Uma compra parcelada mostra ocorrência, vencimentos e baixas em datas distintas.
- [ ] Lote de origem permanece rastreável ao ser misturado, dividido, transferido e vendido parcialmente.
- [ ] Venda por arroba de carcaça calcula receita por peso efetivo do romaneio e preço negociado.
- [ ] Peso visualmente estimado permanece marcado como estimado em gráficos/indicadores.
- [ ] Lote pode operar apenas por cabeças ou combinar animais identificados individualmente.
- [ ] Venda e mortalidade reduzem o saldo e afetam apenas custos/animais aplicáveis.
- [ ] Fazendas e operações têm estruturas societárias distintas e não expõem informações entre si sem permissão.
- [ ] Aluguel simbólico reduz somente o resultado ajustado e não afeta o caixa.
- [ ] Dois dispositivos offline não conseguem consolidar venda superior ao saldo por efeito de corrida de sincronização.
- [ ] Um lançamento já aprovado só é corrigido por procedimento auditável e nova aprovação.
- [ ] Modo Essencial permite registrar operações de campo offline com fluxo guiado; modos Gerencial/Analítico oferecem indicadores e rastreio dos cálculos.
- [ ] Alternar modo não eleva permissões, não dispensa aprovação e não modifica resultados.
- [ ] Uma nota fiscal por PDF ou imagem pode ser anexada offline; após reconexão, IA extrai os campos disponíveis, usuário confere e submete para aprovação de outra pessoa.
- [ ] Reenvio/reprocessamento do documento não cria despesa, conta, estoque ou custo duplicado.
- [ ] Estados de medição/estimativa, aprovação, sincronização e resultado real/ajustado são distinguíveis em todos os modos.

## 9. Questões em aberto para próxima entrevista

Estas decisões **ainda não foram confirmadas** pelo produtor:

1. **Mesma fazenda, várias sociedades — parcialmente respondida em 14/10/2026:** o produtor informou que **normalmente a sociedade é fixa por fazenda**. Pendente esclarecer se existem exceções atuais e, quando ocorrerem, como separar insumos, animais e custos de pastagem compartilhados.
2. **Aprovações cruzadas:** quando uma despesa afeta duas operações com quadros societários distintos, basta um sócio aprovador por operação? E quando o autor é sócio de ambas?
3. **Fluxo financeiro:** quem efetua pagamentos e como tratar autorização bancária distinta da aprovação do lançamento?
4. **Composição dos custos indiretos:** mão de obra fixa, combustível, manutenção geral, impostos da propriedade e administração são rateados a todos os lotes ou mantidos em despesa geral?
5. **Método de custeio em venda parcial:** confirmar custo médio por cabeça por origem e tratamento das diferenças de peso dos vendidos.
6. **Custos em mortalidade:** tratamento gerencial da perda e redistribuição ou não de custos anteriores.
7. **Pesagens amostrais:** como documentar tamanho da amostra e se ela representa o lote inteiro.
8. **Romaneios recebidos:** arquivos e layout de cada frigorífico; informações por animal ou apenas totais.
9. **Calendário da competência:** periodicidade das apurações, fechamento mensal e política de reabertura de períodos.
10. **Aluguel simbólico:** tarifas por fazenda/pasto, convenção de dias no mês, vigência e incidência quando existe aluguel efetivo.
11. **Tributação/documentos:** PF/PJ, regimes adotados, notas, GTA, obrigações rurais e exportações necessárias para contador; validar com profissional especializado.
12. **Matriz de permissões:** quais cargos podem aprovar operações não financeiras, quem administra sócios e como aprovar mudanças no quadro societário.
13. **Conectividade real:** dispositivos Android/iPhone, quantidade de usuários simultâneos, tempo máximo sem internet e volume de anexos.
14. **Rateio de despesas pagas por um sócio em benefício da operação:** distinguir adiantamento, reembolso e custo da operação.
15. **Participação e remuneração:** sociedade por operação, por lote ou por período; condições de distribuição de lucros e aportes.
16. **Notas fiscais e IA:** tipos de notas predominantes, exemplos reais autorizados, disponibilidade de XML, condições de pagamento, qualidade esperada, custos e provedor de extração.

## 10. Referência de escopo e andamento

O estado implementado e o planejamento estão resumidos em **Como interpretar o escopo**, no
início deste documento. A política atual de aprovação está no RF-16, que substitui a regra
original de segunda pessoa obrigatória mesmo para produtor sozinho.

Continuam sujeitos à validação de produto os pontos da seção 9. Modos e navegação já existem;
PowerSync e API dedicada são alternativas futuras, não dependências da entrega atual.
Esta referência não comprova conformidade contábil, fiscal ou sanitária.

## 11. Histórico de requisitos e versionamento

O Git registra o histórico técnico de commits; este quadro registra **decisões do produto**, com data e hora em **America/Sao_Paulo (horário de Brasília)**, ID de requisito, mudança e status.

- **Confirmado:** necessidade ou regra relatada diretamente pelo produtor/solicitante.
- **Proposto:** solução desenhada pela equipe, sujeita a validação.
- **Pendente:** assunto levantado, mas ainda sem decisão.
- O horário é o momento do **registro documental**; não inventar horários retroativos para entrevistas anteriores.
- Para alterações futuras, manter o ID estável (ex.: RF-19), registrar revisão na tabela e atualizar a data do cabeçalho.

| Data e hora (Brasília) | Requisito/escopo | Alteração | Status |
| --- | --- | --- | --- |
| 23/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-19; UX/UI | Navegação reorganizada em hubs: Pendências deixa de ser aba (vira o filtro "Para você" da Atividade), Financeiro ganha aba para sócios, Rebanho junta lotes, pastos e mapa, e o "+" abre uma folha de baixo. Detalhes em EXPERIENCIA_USUARIO.md, seção 3 | **Implementado** |
| 22/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-10; RF-08; RF-18; RN-04/RN-05; issue #46 (fases 2 e 3) | Financeiro completo: transferência entre contas, aporte, retirada e distribuição de lucro de sócio com conta corrente por sócio; despesa paga por sócio com dinheiro próprio como reembolso a pagar ou aporte (questão 14); adiantamento de cliente compensado no recebimento; cartão de crédito com fatura como conta a pagar; financiamentos com liberação fora do resultado, amortização fora do custo e juros como despesa financeira; renegociação, divisão, agrupamento e cancelamento de parcelas com motivo e desfazer; despesas recorrentes previstas; outras receitas com aprovação de outro sócio; fluxo de caixa realizado e projetado com alerta de saldo negativo; DRE gerencial por competência com a ponte para o caixa; contas por idade; gastos por categoria, fornecedor e centro de custo; orçamento; exportação em PDF, CSV e planilha para o contador; conciliação por extrato OFX/CSV; importação da planilha; antecedência dos avisos configurável. Padrões provisórios: movimentação registrada por quem fez sem segunda aprovação; distribuição pela participação cadastrada; custo dos vendidos pela média de compra por cabeça. Questões ainda abertas: 3 (segunda aprovação da baixa), 9 (fechamento mensal), 15 (regra de distribuição), retenções Funrural/Senar, cargo financeiro/contador e formato definitivo da planilha | **Necessidade confirmada / implementada; migração aplicada no Supabase em 22/10/2026** |
| 20/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-03; RF-10; issue #46 | Pedido do produtor: a compra do lote (cerca de R$ 230 mil) precisa aparecer no financeiro. A compra (animais, comissão e frete) passa a ter o pagamento informado no cadastro do lote: já pago (baixa na conta), à vista ou parcelado; vira conta a pagar na categoria Compra de animais (investimento), não entra nos custos do mês e sai do caixa em cada pagamento. Lotes já cadastrados não viram conta automaticamente: o sócio informa o pagamento pela tela do lote | **Confirmado pelo produtor / implementado; migração não aplicada no Supabase** |
| 20/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-10; RF-08; RN-04/RN-05/RN-10; issue #46 (fase 1) | Pedido do produtor: substituir a planilha de contas a pagar, controlar vencimentos com aviso. Implementados contas a pagar e a receber derivadas das parcelas dos lançamentos aprovados (despesas antigas incluídas), baixa total/parcial/múltipla com juros, multa, desconto e comprovante, estorno auditável, contas financeiras com saldo e extrato, plano de contas com natureza, fornecedores e clientes, recebimento a prazo na venda, vencimentos em Pendências e no início Gerencial e avisos locais 3 dias antes e no dia. Padrões provisórios: baixa por quem pagou sem segunda aprovação (só sobre conta aprovada), contas da operação, aviso para todos os sócios (questões abertas 3 e 14). Fases 2 e 3 (sócios, caixa projetado, DRE, financiamentos, conciliação) pendentes | **Necessidade confirmada / fase 1 implementada; migração não aplicada no Supabase** |
| 20/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-07; RF-09; RN-12; issue #45 | Pedido do produtor: a compra de sal/proteinado entra no estoque e gera as parcelas; o consumo do dia a dia baixa o estoque e apropria o custo aos lotes. Implementados insumos com unidade e conversão, compra para o estoque sem custo nos lotes, consumo rateado pela composição na data ou cabeça-dia, ajuste com motivo (outro sócio aprova), transferência entre fazendas da operação, saldo validado no servidor (conflito acima do saldo) e tela com duração e estoque mínimo. Padrões provisórios: custo médio ponderado, estoque por fazenda, perda fora do custo dos lotes | **Necessidade confirmada / implementada; migração não aplicada no Supabase** |
| 19/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-01; RF-04; issue #43 | Pedido do produtor: desenhar os pastos no satélite (opcional, dentro da área da fazenda) e excluir pasto cadastrado por engano. Pasto com histórico continua só inativável, para preservar ocupação e GMD | **Implementado e aplicado no Supabase do novo AgroGest** |
| 19/10/2026 (America/Sao_Paulo, UTC−03:00) | RF-01; RF-04; RF-06; issue #43 | Demanda do produtor: cadastrar pastos com área e capim, registrar movimentações e comparar o GMD por pastagem. Implementados pastos por fazenda, mudança de pasto auditável (total ou parcial) e relatório de ocupação e GMD por pasto e capim | **Necessidade confirmada / implementação entregue e aplicada no Supabase do novo AgroGest** |
| 14/10/2026 às 07:32 (America/Sao_Paulo, UTC−03:00) | RF-20; RN-17/RN-18; IA fiscal | Inclusão de leitura e extração de nota fiscal PDF/foto com IA, preenchimento assistido, revisão humana, proteção offline e aprovação obrigatória; documentação técnica dedicada | **Necessidade confirmada / implementação proposta** |
| 14/10/2026 às 07:28 (America/Sao_Paulo, UTC−03:00) | ADR-001; arquitetura mobile/offline-first | Formalizada direção React Native + Expo + TypeScript, SQLite, PostgreSQL/Supabase, Supabase Auth e API TypeScript; PowerSync pendente de POC; Next.js para futuro painel web | **Stack-base definida / sincronização em avaliação** |
| 14/10/2026 às 06:44 (registro; resposta recebida às 04:33, horário de Brasília) | RF-01; modelo fazenda ↔ operação; questão aberta 1 | Produtor confirma que **normalmente cada fazenda trabalha com uma sociedade fixa**. Cadastro e UX terão operação padrão por fazenda, preservando suporte estrutural a exceções. | **Prática confirmada**; exceções **pendentes** |
| 13/10/2026 (horário original não registrado) | RF-01 a RF-18; RN-01 a RN-15 | Consolidação inicial das entrevistas sobre pecuária, operações, sociedades, custos, financeiro, aprovações e offline-first | Requisitos confirmados e propostas distinguidos por seção |
| 13/10/2026 às 21:44 (America/Sao_Paulo, UTC−03:00) | RF-19; RN-16; UX/UI | Registrada exigência de experiência intuitiva para perfis diversos e criada proposta de três modos, navegação e animações leves em documento dedicado | Necessidade **confirmada**; solução **proposta** |

### Documentos relacionados

- [EXPERIENCIA_USUARIO.md](EXPERIENCIA_USUARIO.md) — arquitetura de informação, modos de interface, fluxos, wireframes textuais e critérios de UX.
- [ARQUITETURA_TECNICA.md](ARQUITETURA_TECNICA.md) — ADR-001, stack tecnológica, operação offline, sincronização, segurança, POC e implementação.
- [IA_DOCUMENTOS_FISCAIS.md](IA_DOCUMENTOS_FISCAIS.md) — upload PDF/foto, extração, revisão, aprovação, deduplicação, privacidade e critérios de aceite.


## Regras implementadas de estoque e financeiro

Consolidadas do antigo guia mobile em 26/10/2026. Complementam RF-07 a RF-16; os contratos
SQL ficam em [Supabase](SUPABASE.md).


**Estoque.** Em *Mais › Fazenda › Estoque de insumos*, o sócio cadastra o insumo (sal, sal mineral, proteinado, ração,
medicamento) com a unidade em que o saldo é controlado (ex.: saco) e as conversões da compra (ex.: 1 t = 40 sacos).
A compra é uma *Despesa* com destino **Compra para o estoque**: os itens entram no estoque da fazenda e as parcelas
viram contas a pagar, mas **nenhum custo vai para os lotes**. No dia a dia, *Registrar › Consumo de insumo* (qualquer
pessoa da operação, inclusive funcionário) baixa o estoque e leva o custo aos lotes, rateado pela composição na data
do consumo ou pela cabeça-dia de um período (ex.: 5 sacos na semana). Ajuste de inventário (contagem, perda) exige
outro sócio; transferência entre fazendas da mesma operação sai pelo custo médio e chega quando aprovada. A tela de
estoque mostra saldo, duração prevista pelo consumo dos últimos 30 dias e alerta de estoque mínimo (também em
*Atividade › Para você*). Funcionário vê quantidades, nunca valores.

**Financeiro (só sócios).** Na aba *Financeiro*: contas a pagar e a receber das fazendas do contexto, com
situação (em aberto, vence hoje, vencida, paga em parte, paga), filtros por período, fornecedor e categoria, e
seleção de várias parcelas para uma baixa só. A baixa registra conta, data, forma, juros, multa, desconto e o
número do comprovante; o estorno pede motivo e não apaga nada. Contas financeiras com saldo inicial e extrato,
plano de contas (padrão + categorias da operação, com natureza) e fornecedores e clientes (em *Cadastros*, com sócios e
recorrentes), sugeridos ao digitar o
nome na despesa e na venda. A venda ganhou o recebimento à vista ou a prazo. Parcelas vencidas e as que vencem em
até 3 dias aparecem em *Atividade › Para você* e no início Gerencial; o aparelho agenda avisos locais 3 dias antes e no dia
(`expo-notifications`; na web não há aviso, e push remoto fica para depois).

**Compra do lote no financeiro.** Ao cadastrar um lote com valor de compra, o próximo passo é *Pagamento da
compra*: para os animais, a comissão e o frete (cada um pode ir para uma pessoa diferente), informar se já foi pago
(com a conta e a data, vira baixa), à vista numa data ou parcelado. As parcelas viram contas a pagar na categoria
*Compra de animais* (natureza investimento). A compra **não entra nos custos do mês**: o valor já está no custo do lote
e vira custo do resultado quando os animais são vendidos; no caixa, sai em cada pagamento. **Lotes antigos não viram
conta sozinhos** (senão apareceriam como vencidos): a tela do lote mostra *Informar como a compra foi paga*. Depois
de uma parcela paga, valores e parcelas da compra ficam travados (estorne a baixa para mudar); mudar o valor sem
pagamentos descarta o plano, que é informado de novo. Transferência entre fazendas não gera conta.

Como funciona por dentro:

- **Contas a pagar e a receber não são copiadas**: são as parcelas dos lançamentos aprovados (despesa, nota
  revisada, venda), com ID `lançamento:índice` (`obligations` em `../apps/mobile/src/domain/finance.ts`). Despesas antigas com
  parcelas já aparecem em aberto, sem migração de dados. Lançamento pendente ainda não é conta.
- **Saldo e custo do estoque também são derivados**: `stockLedger` (`../apps/mobile/src/domain/stock.ts`) reconstrói cada
  insumo por fazenda em ordem de ocorrência, igual a `private.stock_replay` no servidor. O custo do consumo
  (`derivedCents`/`derivedAllocations`) é calculado a cada leitura por `costEntries` e nunca é gravado.
- **Resultado ≠ caixa**: a baixa muda o saldo da conta, nunca o custo; a compra para o estoque não entra nos custos
  do mês nem dos lotes; o consumo entra. Aluguel simbólico continua fora do caixa.

**Padrões adotados enquanto as questões abertas não são decididas** (cada um isolado para trocar fácil):

| Padrão | Onde trocar |
| --- | --- |
| Custo médio ponderado por insumo e fazenda | `outflowValue` em `../apps/mobile/src/domain/stock.ts` e `private.stock_replay` |
| Estoque controlado por fazenda (não por depósito) | chave `farmId` de `stockLedger` |
| Perda de estoque fora do custo dos lotes | `LOSS_TO_LOTS` em `../apps/mobile/src/domain/stock.ts` |
| Baixa por quem pagou, sem segunda aprovação, só sobre conta aprovada | `paymentConflict` e `register_payment` |
| Padrão de aviso: 3 dias antes e no dia, às 8 h; antecedência configurável | `ALERT_DAYS` e `ALERT_HOUR` em `../apps/mobile/src/domain/finance.ts` |
| Contas financeiras pertencem à operação | `FinancialAccount.operationId` |
| Comprovante como texto (nº de autenticação/ID do Pix) | o envio de arquivos ainda não existe |

**Gestão financeira (fases 2 e 3).** No Financeiro, além das contas a pagar e a receber:

- **Movimentar:** transferência entre contas, aporte, retirada e distribuição de lucro de sócio, liberação de
  financiamento e adiantamento de cliente. Mudam saldos, nunca o resultado.
- **Cartão de crédito:** conta do tipo cartão, com dia de fechamento e vencimento. Pagar com o cartão põe a compra na
  fatura; a fatura aparece em A pagar e nos avisos e se paga com uma transferência para o cartão.
- **Baixa por um sócio:** "Um sócio pagou" registra a despesa paga com dinheiro próprio como reembolso a pagar a ele
  ou como aporte. No recebimento, "Compensar adiantamento" quita a venda com o adiantamento do frigorífico.
- **Renegociar ou cancelar** uma ou várias parcelas (mudar vencimento ou valor, dividir, agrupar), com motivo,
  histórico e desfazer.
- **Sócios:** conta corrente de cada sócio (aportes, retiradas, distribuições, reembolsos) e sugestão de distribuição
  do resultado pela participação.
- **Financiamentos:** contrato com cronograma sugerido (SAC com carência), liberação e parcelas a pagar.
- **Despesas recorrentes:** previstas todo mês no fluxo e nos avisos; lançar o mês preenche a despesa.
- **Outra receita** (couro, arrendamento, serviços), em Registrar: vira conta a receber, sujeita à política do RF-16.
- **Relatórios** (uma tela com as abas Fluxo, Orçamento e Resultados): **fluxo de caixa** realizado e projetado por dia,
  semana ou mês, com alerta de saldo negativo; **resultados** com DRE
  gerencial (competência) e a ponte do resultado para o caixa, contas por idade e gastos por categoria, fornecedor e
  centro de custo comparados ao período anterior; **orçamento** por categoria e mês; **exportação** em PDF, CSV e o
  pacote do contador (planilha do Excel com uma aba por relatório).
- **Conciliação bancária** por extrato OFX ou CSV (sugere a parcela de mesmo valor e vencimento próximo; o ID da linha
  vira o comprovante e não duplica) e **importação da planilha** atual (parcelas em aberto como saldo de abertura e
  saldos iniciais das contas), com modelo para baixar.
- **Avisos:** a antecedência (no dia, 1, 3, 5, 7 ou 15 dias) e o lembrete diário das vencidas ficam em Preferências.
- No modo **Analítico**, custo por arroba produzida e por cabeça/mês com os custos reais apropriados aos lotes.

Mais padrões provisórios, isolados para trocar fácil:

| Padrão | Onde trocar |
| --- | --- |
| Movimentação e baixa registradas por quem fez, sem segunda aprovação (auditáveis e estornáveis) | `register_movement`/`register_payment` e `movementErrors` |
| DRE com custo de aquisição dos vendidos pela média de compra por cabeça; custos de produção no mês da despesa | `buildDre` em `../apps/mobile/src/domain/reports.ts` |
| Distribuição sugerida pela participação de Pessoas (sem participação, partes iguais) | `distributeByShare` em `../apps/mobile/src/domain/treasury.ts` |
| Cronograma de financiamento sugerido em SAC | `sacSchedule` em `../apps/mobile/src/domain/treasury.ts` |
| Saldo projetado: vencidas contam hoje | `projectedFlow` em `../apps/mobile/src/domain/reports.ts` |

Ainda não: anexar o arquivo do comprovante (o número segue como texto), push pelo servidor (os avisos são locais),
cargo de leitura para contador e o fechamento mensal (questões em aberto). Hoje cada fazenda criada pelo app tem a
própria operação, então a transferência de estoque entre fazendas só aparece quando uma operação tiver mais de uma
fazenda.

## Centros de custo e finalidades (issue #48)

Implementado em 27/10/2026 no aplicativo atual. Complementa as regras financeiras existentes:

- Categoria responde **com o que** se gastou; centro/finalidade responde **onde** foi aplicado.
  Cada despesa ou nota tem um centro opcional, independente de fazenda, lote e rateio.
  Não há divisão do lançamento entre centros nem hierarquia adicional de subcategorias.
- Sócios cadastram, renomeiam e inativam centros e agrupamentos da operação. Um agrupamento
  contém centros em um único nível e não recebe lançamentos diretamente. O vínculo do centro
  ao agrupamento e seu tipo são imutáveis; outra estrutura exige novo cadastro, evitando
  deslocar silenciosamente despesas antigas. Renomear atualiza o rótulo nas consultas.
- Inativar um centro ou seu agrupamento impede novos usos, inclusive em despesas originadas
  de recorrências. As referências antigas continuam consultáveis; os campos opcionais ausentes
  são apresentados como **Sem centro de custo**. Não se apagam centros usados.
- Despesas manuais, compras para estoque, notas fiscais e modelos de recorrência admitem a
  finalidade. A importação real de NF continua planejada conforme o contrato fiscal vigente;
  adicionar classificação não habilita extração ou envio real de NF.
- Sócio pode reclassificar uma despesa/nota aprovada com motivo obrigatório. A auditoria mantém
  autor, momento, centro anterior e novo. Essa ação não reabre aprovação nem altera valor,
  data de ocorrência, parcelas, rateio, estoque, baixas ou versão financeira do lançamento.
- Relatórios combinam período, fazenda, categoria e centro/agrupamento. Oferecem categoria,
  centro individual, agrupamento, categoria × centro, fornecedor e apropriação por lote,
  comparação com intervalo anterior de igual duração e detalhamento dos lançamentos.
  A denominação antiga de lote/Geral como centro de custo passa a ser **apropriação por lote**.
- Competência usa o valor integral pela ocorrência da compra/serviço aprovado. Pagamentos
  (caixa) usa apenas as baixas válidas no período, inclusive parciais e parceladas, com juros,
  multa e desconto distribuídos proporcionalmente em centavos. Preserva a origem nas
  renegociações. Pagamentos por sócio contam na quitação ao fornecedor; reembolsos não repetem a despesa.
  Compras no cartão entram em caixa somente na quitação da fatura, proporcionalmente às
  parcelas pagas, preservando a parcela de saldo inicial e obrigações sem despesa.
  Esta visão de gastos pagos é distinta do fluxo de contas bancárias existente.
- Centro e agrupamento são alternativas de agregação: o consolidado não soma pai e filhos.
  Os totais de categoria, finalidade e lote também não se somam entre si. No exemplo da issue:
  Roda d’água R$ 650, Reforma de pastagens R$ 400 e Mão de obra R$ 700, sobre R$ 1.050 únicos.
- Dados e ações gerenciais são exclusivos de sócios vinculados à operação, também no modo
  local. IDs de outra operação são recusados; edição concorrente exige a revisão anterior.

Contrato e aplicação do banco: [Supabase](SUPABASE.md#centros-de-custo-issue-48).
