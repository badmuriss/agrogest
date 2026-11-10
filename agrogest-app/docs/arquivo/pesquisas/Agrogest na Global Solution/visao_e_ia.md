# Visão computacional e IA no AgroGest

## Os requisitos estão implementados no aplicativo atual?

### Takeaway
**No commit auditado, visão computacional e inferência de IA NÃO estão implementadas no fluxo fiscal do aplicativo atual.** Existe um protótipo local com captura, dados simulados, revisão e regras de lançamento. Não é apenas um cliente de extração externa esperando configuração: o cliente de NF sequer envia o documento e não há endpoint de extração consumido no caminho lido.

Base: commit `7f0bb66d764eadc8f48be016280414d77a1d4799`, leitura em 06/11/2026. Escopo exclusivo: NF, IA/CV e dependências imediatas. Não conclui nada sobre todos os recursos ou versões futuras do produto.

### Cited Findings

| Item | Veredito estático | Evidência primária |
|---|---|---|
| Captura/seleção de arquivo | Construída como interface local: câmera produz URI; seletor aceita PDF/imagem | [nota-fiscal.tsx:119](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L119) e [nota-fiscal.tsx:133](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L133) |
| Processamento de pixels / OCR / VLM da NF | **Ausente no fluxo lido**: o analisador recebe apenas o nome, sem URI/bytes | [nota-fiscal.tsx:142](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L142) |
| Inferência de IA da NF | **Ausente; mock explícito**: `extractInvoice(_fileName)` espera 1.800ms e retorna a constante `SAMPLE_EXTRACTION` | [nf-extraction.ts:48](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L48) |
| Dados estruturados, confiança e evidência exibidos | Contrato e fixture preparados, não resultado de modelo. A constante preenche fornecedor, itens, total, níveis de confiança e textos de evidência | [nf-extraction.ts:9](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L9), [nf-extraction.ts:33](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L33), [types.ts:580](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/types.ts#L580) |
| NF no modo cloud | Bloqueada na tela e também na gravação do estado | [nota-fiscal.tsx:100](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L100), [app-state.tsx:1810](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810) |
| Integração/modelo escolhidos | Documento é explicitamente referência futura; propõe OpenRouter no backend, mas modelo e estratégia continuam em validação | [IA_DOCUMENTOS_FISCAIS.md:3](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L3), [IA_DOCUMENTOS_FISCAIS.md:74](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L74) |
| Backend/endpoint fiscal versionado | Não encontrado nas buscas limitadas a código atual, Supabase e manifesto mobile. A árvore Supabase lida contém configuração/migrations, sem função fiscal; o serviço acima não faz chamada HTTP | [ponto de integração ainda simulado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L4) e [índice chama contrato de planejado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/README.md#L29) |
| Revisão humana | Interface real do protótipo, com campos editáveis e validações, porém recebendo a fixture | [pendências antes de submeter](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L270), [gravação da revisão](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L280), [campos de conferência](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L323) |

### Inferences
- Para o vídeo atual, seria honesto dizer **“protótipo do fluxo de leitura, com inferência a integrar”**. Seria incorreto apresentar a animação de scan, os badges “IA” ou o resultado fixo como uma nota realmente lida.
- Ausência de visão/IA aqui não invalida o restante do sistema. Contudo, são duas lacunas materiais diante do enunciado que exige aplicação prática dos quatro tópicos.
- Não se deve somar Cloud de outras funções ao mock local e afirmar que o fluxo fiscal completo está integrado.

### Gaps
- Não foram lidos arquivos de ambiente ou segredos. Não se conhece configuração privada, eventual backend fora deste repositório ou execução hospedada.
- “Não encontrado” limita-se ao commit e ao caminho auditados; não afirma inexistência de serviço privado mantido separadamente.
- Não houve build, instalação, teste, chamada de modelo, acesso a dados ou alteração de código. O veredito é leitura estática, não resultado em aparelho.

## Qual é o fluxo real de foto até revisão e registro?

### Takeaway
A captura é real, mas o conteúdo do arquivo é descartado na análise. O protótipo salva o nome/tipo do arquivo e campos provenientes da fixture, podendo receber edições humanas; não salva um vínculo binário persistente da nota nesse payload.

### Cited Findings
1. **Foto/arquivo:** a tela guarda `name`, `kind` e `uri` no estado React. A URI permite prévia da imagem, mas o processamento não a recebe. [PickedFile](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L34), [captura](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L119), [prévia](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L211).
2. **Análise:** `analyze()` chama `extractInvoice(file.name)`; o serviço não usa esse nome e devolve sempre o mesmo objeto. Portanto duas imagens diferentes percorrem o mesmo retorno estático pela leitura do código. [chamada](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L142), [retorno fixo](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L48).
3. **Parcelas e classificação:** `suggestedInstallments` usa regex sobre a condição de pagamento e cálculo determinístico. O destino inicial é `estoque`, e a UI o rotula como sugestão de IA, mas não há classificação por modelo nessa escolha inicial. [parcelas determinísticas](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L54), [destino padrão](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L87), [texto de sugestão](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L430).
4. **Conferência:** a tela calcula soma de itens, exige checagem de vencimentos, fazenda, mapeamento de estoque/rateio e confirmação de possível duplicidade. Fornecedor, número, total e emissão são editáveis; itens são apresentados em cartões e vinculados aos insumos. [cálculos e pendências](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L248), [campos editáveis](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L328), [itens exibidos](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L373), [vínculo de estoque](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L448).
5. **Registro:** `saveReview` chama `app.saveEntry` com nome/tipo, extração e edições. O tipo `NotaFiscalPayload` não contém URI, bytes, chave de storage ou ID de documento. Assim, o nome da nota não é prova de que seu arquivo está preservado como anexo. [saveReview](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L280), [NotaFiscalPayload](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/types.ts#L596).
6. **Persistência local:** `saveEntry` constrói o lançamento e seu histórico; fora do modo cloud pode passá-lo ao fluxo local e chama `repo.saveEntry`. Em cloud, NF é expressamente recusada antes da gravação do comando. Isso permite persistir os dados simulados/editados localmente, não comprova extração de documento ou persistência remota de NF. [construção do lançamento](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1719), [bloqueio e gravação local](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810).
7. **Guardar para ler depois:** esse caminho também salva apenas metadados e extração nula. Na sincronização do protótipo, `runSync` injeta `SAMPLE_EXTRACTION`; `syncAll` adiciona o evento `ia_extraiu`, embora a origem seja o callback simulado. Não é reprocessamento do arquivo capturado. [saveForLater](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L154), [runSync](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L583), [sincronização simulada](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/workflow.ts#L190).
8. **CSV é outro recurso:** o importador lê texto e faz parsing determinístico de separadores, colunas, valores e datas. É útil, mas não constitui visão computacional nem comprova inferência de IA. [seleção e parsing](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/financeiro/importar.tsx#L40), [parseSheet](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/sheet-import.ts#L54).

**Legado, separado:** existe uma rota `ai-chat` em `old-agrogest`, com uma chamada HTTP a chat completions do OpenRouter. Isso é evidência de código de integração **legado**, não de execução configurada, processamento de pixels ou integração com o mobile atual. Não foi auditada a conversa inteira nem sua configuração privada. O AGENTS da raiz distingue os aplicativos. [import do legado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/old-agrogest/src/app/api/ai-chat/route.ts#L10), [fetch legado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/old-agrogest/src/app/api/ai-chat/route.ts#L79), [limite entre atual e legado](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/AGENTS.md#L5).

### Inferences
- Os níveis “alta/baixa/ausente” da tela não são confiança estimada por modelo nesta implementação: são valores da fixture.
- As regras de negócio e a edição humana são trabalho existente aproveitável. A etapa que deveria produzir dados variáveis a partir do documento ainda precisa ser construída.
- Uma demo que use somente a nota de exemplo pode demonstrar UX, sem distinguir o mock de uma integração visual real.

### Gaps
- Não foi auditada toda a política RF-16 ou todos os efeitos financeiros/estoque após aprovação; isso pertence à avaliação de backend/regras.
- Não foram medidos acurácia, latência, custo, correções, qualidade da captura ou comportamento offline real.
- Não foi demonstrado XML fiscal no caminho atual. Mesmo um parser XML futuro, isoladamente, não supre o processamento visual exigido.

## Qual adição mínima tornaria CV e IA demonstráveis até 19/11?

### Takeaway
A adição mínima útil é uma prova integrada para **uma foto legível de nota de compra de insumo**: arquivo real → backend com OCR/VLM efetivo → dados estruturados → revisão humana → referência ao documento e registro na mesma operação. Não exige YOLO ou treinar modelo do zero.

### Cited Findings
- Esse recorte já está alinhado à especificação futura, que separa foto/imagem, parsing XML e interpretação multimodal, exige revisão e propõe integração pelo backend. [entradas](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L21), [integração](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L74), [pipeline proposto](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L88).
- A UI e o contrato existentes oferecem um ponto de ligação, mas a função atual recebe só um nome e o modo cloud está bloqueado. [assinatura atual](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L48), [bloqueio cloud](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L100), [retorno tipado atual](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/types.ts#L580).

### Inferences
**Trabalho mínimo necessário, como proposta e não implementação realizada:**
1. Encaminhar URI/bytes ou referência autorizada do documento, e não só seu nome, a um endpoint autenticado de backend.
2. Implementar inferência visual real, com OCR/modelo multimodal que leia os pixels da foto. Guardar segredo do fornecedor no backend; selecionar um modelo compatível, sem presumir que a escolha documental anterior já está operacional.
3. Validar resposta estruturada e coerência básica (campos presentes, valores, itens e total), com campos ausentes/incertos pendentes de revisão. Não preencher vencimentos ou dados inexistentes por plausibilidade.
4. Usar IA identificavelmente na interpretação/classificação dos campos ou sugestão gerencial apoiada no documento; o mesmo modelo multimodal pode realizar leitura visual e interpretação. Não é obrigatório ter um modelo distinto para cada nome do enunciado.
5. Conectar o retorno à conferência existente, removendo o uso da fixture do caminho demonstrado. Tratar falha/tempo de espera como falha explícita, sem cair silenciosamente em uma nota de exemplo.
6. Persistir referência autorizada ao arquivo e ao resultado/revisão. Ligar a NF ao caminho cloud escolhido com as validações pertinentes, em vez de simplesmente apagar os dois bloqueios atuais.
7. Manter a decisão humana e as regras financeiras. Para uma demo restrita, limitar-se a um tipo de compra e não alegar suportar todos os documentos/layouts.

**O que filmar para provar a aplicação prática:**
- Escolher duas fotos diferentes de notas fictícias ou devidamente autorizadas, com campos legíveis e distintos. O retorno deve refletir os pixels, não apenas trocar pelo nome.
- Mostrar fornecedor/número/data/itens/total extraídos e revisar um campo. Não precisa exibir CPF/endereço reais.
- Demonstrar uma entrada ilegível ou um campo ausente sendo marcado para conferência, sem invenção.
- Confirmar o registro e reencontrá-lo ligado à fonte. Mostrar claramente o ambiente e o que foi persistido; uma resposta JSON isolada não prova o fluxo inteiro.
- Preservar evidência mínima de execução: entrada de teste, resultado, modelo/método e horário, sem logs sensíveis. Métricas devem ser medidas, não estimadas como precisão garantida.
- Se a integração não ficar pronta, apresentar a funcionalidade como planejada/simulada. Isso é honesto, mas mantém o risco de pontuação nos requisitos práticos.

**Requisito visual legítimo:** OCR/VLM sobre foto/DANFE é um uso tangível de visão computacional para reduzir transcrição. Diagnóstico animal, sensores ou reconhecimento de doenças não são necessários e não foram encontrados no escopo auditado.

### Gaps
- Não foi estabelecido prazo de implementação garantido, fornecedor final, orçamento, autorização para envio de documentos ou disponibilidade de backend privado.
- Esta análise não substitui execução controlada e revisão da integração antes de gravar o pitch.
- Nenhum serviço foi chamado e nenhum arquivo do repositório do amigo foi modificado.

