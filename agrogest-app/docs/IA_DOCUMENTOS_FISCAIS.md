# AgroGest — IA para Leitura e Lançamento de Notas Fiscais

> **Atualização acadêmica · 10/11/2026:** extração real de imagens/comprovantes para despesa, revisão e anexo D1/R2 **implementados localmente**. OCR Tesseract português fixado em container CPU e opção de IA visual Qwen3-VL-2B local, que lê a imagem e devolve campos em uma etapa, com validação e revisão. O modo GPU é opcional; não é requisito do caminho CPU. Cloudflare Workers AI tem adaptador REST para backend local e binding para futura hospedagem, sem teste de inferência remota por falta de credencial. OpenRouter foi removido por decisão do usuário; a decisão de gateway de outubro está substituída. A amostra constante foi retirada do runtime. [Contrato/execução e limites](CLOUDFLARE_LOCAL.md#inferência-e-credenciais-transferíveis).
>
> **Tipo do restante deste documento:** referência da integração fiscal completa ainda futura. PDF/XML, itens estruturados, classificação fiscal e validação ampla de qualidade permanecem propostas; não confundir com o importador mínimo de despesas.
> **Conferência documental:** 26/10/2026. Necessidade confirmada; contratos abaixo são propostas.\
> **Prioridade:** alta — funcionalidade central do produto, não apenas evolução opcional.\
> **Registrado em:** 14/10/2026 às 07:32 (America/Sao_Paulo, UTC−03:00)\
> **Relacionado:** [Requisitos](REQUISITOS_PRODUTO.md) (RF-20) · [Arquitetura](ARQUITETURA_TECNICA.md) · [Experiência do usuário](EXPERIENCIA_USUARIO.md).

## 1. Problema e objetivo

O produtor recebe documentos fiscais e os transcreve manualmente para planilhas ou controles, podendo esquecer informações, digitar valores incorretos e deixar de registrar custos e vencimentos.

O aplicativo deverá receber **PDFs ou imagens/fotos** de notas, extrair os campos relevantes com IA, sugerir classificação e preenchimento de um **lançamento estruturado**, permitir conferência/correção do usuário e salvar o documento associado à operação. A efetivação segue a [política RF-16](REQUISITOS_PRODUTO.md#rf-16--política-de-aprovação), inclusive a elegibilidade e a exceção para produtor sozinho; IA nunca substitui revisão humana ou validação do servidor.

**Regra central: captura + extração + revisão humana + política RF-16 + efetivação validada.** A IA nunca aprova por conta própria.

## 2. Documentos e fontes de dados

### Entradas confirmadas e complementares

| Formato | Situação | Tratamento proposto |
| --- | --- | --- |
| Foto da câmera (JPG/HEIC ou conversão adequada) | **Obrigatório** | Capturar, corrigir rotação, qualidade e legibilidade, analisar com visão computacional |
| Imagem (JPEG/PNG, outros compatíveis após normalização) | **Obrigatório** | Processar visualmente e preservar a imagem original |
| PDF de nota fiscal ou DANFE | **Obrigatório** | Ler camada de texto quando existir e examinar visualmente páginas/quadros necessários |
| XML de NF-e | **Recomendado, opcional** | Fazer parsing determinístico dos campos fiscais como fonte preferencial quando arquivo válido for fornecido |
| NFC-e, NFS-e, recibos e documentos de produtor rural | **Extensão a mapear** | Identificar subtipo e adaptar esquema sem presumir campos inexistentes |
| Várias páginas / múltiplos documentos | **A testar** | Detectar anexos, páginas e comprovantes e evitar misturar notas diferentes |

O **DANFE é um documento auxiliar, representação gráfica da NF-e**; quando houver XML autorizado fornecido ao sistema, ele será usado prioritariamente para campos fiscais. A imagem/PDF continuará sendo aceita, mas a IA não pode afirmar ter verificado autorização, integridade ou autenticidade fiscal sem consulta/validação correspondente.

**Não pressupor obtenção automática de XML a partir da chave de acesso**: isso pode depender de acesso autorizado, integrações e regras específicas dos órgãos fiscais.

## 3. Fluxo funcional esperado

1. Usuário escolhe **Registrar → Importar nota fiscal** ou acessa a função por dentro de uma despesa/compra.
2. Seleciona **foto, arquivo de imagem, PDF** (ou XML quando disponível); captura arquivo e metadados essenciais.
3. Offline: armazena o arquivo localmente de forma protegida, registra uma tarefa com ID único e mostra **"Aguardando conexão para analisar"**. Não prometer inferência em IA cloud sem rede.
4. Online: envia arquivo para armazenamento privado temporário/autorizado e cria tarefa de processamento idempotente.
5. Pipeline detecta tipo, extrai informações, normaliza o retorno estruturado e executa validações de negócio.
6. Mostra **prévia preenchida** ao lado da nota, sinalizando campos faltantes, inconsistentes e incertezas de interpretação.
7. Usuário seleciona/ajusta operação e fazenda, finalidade econômica, fornecedor, produtos, consumo/estoque, despesas, vencimentos, critérios de rateio e lotes.
8. Usuário **confirma e submete** o lançamento, com referência permanente ao arquivo original e à versão extraída.
9. Quando exigido pelo RF-16, outro aprovador habilitado analisa documento e efeitos; pode aprovar/rejeitar.
10. Só depois da validação e, quando exigida, aprovação no servidor são efetivados os impactos em **estoque, custos, contas a pagar/receber e relatórios**. Caso se trate de documento somente comprobatório, anexa-se sem inventar movimentação contábil.
11. Correções e reprocessamentos são auditáveis e não sobrescrevem silenciosamente informações aprovadas.

### Exemplo de uso: nota de proteinado

- O usuário fotografa a NF de compra de proteinado de R$ 12.000.
- A IA identifica fornecedor, documento, data, itens, quantidades, unidade, valor e informações financeiras explicitamente presentes.
- A IA sugere **"Compra de insumo → entrada em estoque"**, e **não** consumo imediato dos R$ 12.000 nos lotes.
- Se houver pagamento em três parcelas, registra **as parcelas comprovadas**; se a nota não trouxer condições de pagamento, solicita preenchimento.
- O consumo posterior será apropriado aos lotes, por cabeça/peso/manual, em evento separado.
- O lançamento da compra segue RF-16; a conta a pagar fica registrada **uma única vez**, independentemente dos lotes envolvidos.

## 4. Campos de extração prioritários

| Grupo | Campos / observações |
| --- | --- |
| Identificação | tipo de documento, chave de acesso da NF-e (se presente), número, série, data/hora de emissão |
| Partes | emitente, destinatário, nome/razão social, CPF/CNPJ conforme pertinente, estabelecimento |
| Itens | descrição, código do produto quando presente, quantidade, unidade, preço unitário, desconto, valor total |
| Tributação | totais de tributos, CFOP/NCM e demais códigos **quando legíveis/presentes**, sem determinar tratamento fiscal automaticamente |
| Valores | valor de produtos, frete, desconto, outras despesas, valor total, tributos destacados conforme documento |
| Pagamento | forma, vencimentos e valores das parcelas **somente se constarem no documento** |
| Origem | identificação do arquivo, páginas/trechos que sustentam cada extração, tipo e método usado |
| Destino gerencial | tipo de lançamento, fornecedor existente/novo, empresa/operação, fazenda, categoria, lote(s), centro de custo e critério de rateio — **sugestões**, nunca fatos fiscais inferidos |

**Ausência de dados:** usar valor nulo/pendente e solicitar conferência. Não preencher campos com valores plausíveis inventados.

**Notas de gado x insumos:** uma NF de compra de animais pode originar lote de compra e obrigação financeira; uma NF de insumo pode originar estoque; uma NF de serviço pode gerar despesa; não aplicar a mesma contabilização a todos os tipos.

## Decisão de integração vigente · 10/11/2026

**Cloudflare Workers AI é o único provedor hospedado suportado.** O backend local chama a API REST; um Worker futuramente hospedado pode usar `env.AI.run` na conta de hospedagem ou REST com uma conta de inferência separada. O contrato visual configurado é **Llama 4 Scout** (`@cf/meta/llama-4-scout-17b-16e-instruct`), com imagem inline e schema JSON. Os contratos têm testes simulados; qualidade, latência e faturamento aguardam credencial e ensaio real. Isso não é prova de inferência em cloud executada.

As opções locais continuam explícitas: Tesseract português em container CPU ou **Qwen3-VL-2B-Instruct Q4_K_M** em llama.cpp. A IA visual local já lê imagem → campos diretamente, sem OCR intermediário obrigatório. Campos desconhecidos ficam nulos; o backend valida datas/centavos/limites. Revisão humana e aprovação do domínio continuam obrigatórias. Não há fallback automático entre provedores nem postagem de documentos pelo frontend ao modelo.

**Decisão substituída:** o gateway proposto em 14/10 era OpenRouter; a seleção, adaptador e variáveis foram retirados da configuração vigente em 10/11 por instrução do usuário. O registro de outubro na tabela de versões permanece histórico. A licença/revisão dos modelos locais, setup, controles de rede, contas e segredos ficam no [guia responsável](CLOUDFLARE_LOCAL.md#inferência-e-credenciais-transferíveis).

**Próxima avaliação:** comparar baseline CPU, modelo visual local e Workers AI com fotos reais anonimizadas e gabarito por campo. Medir erro de valor/data/documento, revisões, latência completa e custo observado; não concluir superioridade geral usando poucos recibos sintéticos. PDF digital/XML devem aproveitar parsing determinístico quando forem implementados. O restante deste documento descreve a ampliação futura de RF-20; não é catálogo de funções já entregues.

## 5. Estratégia de extração (desacoplada do fornecedor)

Pipeline sugerido:

```text
Captura PDF/imagem/XML
       ↓
Validação de arquivo, limite, antivírus e armazenamento privado
       ↓
Detectar tipo e qualidade
       ├── XML válido → parser determinístico + validação de esquema aplicável
       ├── PDF com texto → extração de texto + análise visual dos quadros
       └── Foto/PDF escaneado → modelo multimodal (OCR/visão)
       ↓
Normalizar em schema tipado versionado (Zod/JSON Schema)
       ↓
Validação determinística de chave, datas, somas, unidades e documento
       ↓
Detecção de documento já importado / correspondência de fornecedor
       ↓
Sugestão de categoria, estoque x despesa x compra de animais
       ↓
Tela de conferência + ajuste de campos/lotes/parcelas
       ↓
Submissão / segundo aprovador / efetivação transacional
```

### IA multimodal

- Selecionar um provedor com suporte a **imagens e PDFs** e saída estruturada baseada em esquema; provedor/modelo específicos ainda serão avaliados por preço, qualidade, latência e política de dados.
- Evitar lógica de negócio crítica baseada exclusivamente no texto da resposta do modelo: resposta estrutural **não garante correção semântica**.
- Separar **extração factual** de **sugestão gerencial** (classificação, fornecedor, categoria, associação de fazenda e lote).
- Guardar **modelo, versão do esquema, horário, arquivo de origem, resultado e edições humanas** para rastreabilidade, com controle de acesso e política de retenção.
- Campos incertos exigem revisão; disponibilizar indicação visual e trecho/página de origem quando a tecnologia permitir. Qualquer indicador de confiança é auxiliar, não certificação da validade fiscal.
- Não executar ordens contidas no documento como instruções para o agente; documentos são entrada não confiável.

### Validações

- Quando houver chave de acesso de 44 dígitos: validar formato/dígito verificador, conforme especificação aplicável, sem equiparar isso à autenticação perante o fisco.
- Validar somatório de itens e coerência com totais, descontos, fretes e tributos conforme os componentes da nota.
- Conferir datas, números, quantidades, unidades, valores e campos monetários com decimal preciso.
- Detectar possível duplicidade por **cliente/operação + tipo + chave de acesso** quando aplicável; sem chave, usar combinação de emitente, série/número/data/valor/hash, sinalizando candidatos.
- Duplicidade é uma **advertência ou bloqueio condicionado à natureza da operação**; não eliminar automaticamente lançamentos legítimos (ex.: documentos compartilhados por operações ou reaproveitados como anexo).
- Verificar fornecedor contra cadastros existentes; nunca mesclar entidades por nome semelhante sem validação.
- Preservar arquivo original e cópia normalizada se houver rotação, compressão ou melhoramento.

## 6. Persistência proposta (conceitual)

Entidades:
- `documentos`: ID, tenant, fazenda/operação conforme vínculo, tipo, arquivo original, hash, metadados, status de armazenamento.
- `tarefas_extracao`: ID, documento, estado, tentativas, versão de schema e modelo, timestamps, erros e custo técnico do processamento.
- `resultados_extracao`: campos estruturados com referências ao conteúdo de origem, inconsistências, histórico de versão.
- `rascunhos_lancamento`: dados sugeridos, revisões humanas, autoria, referência ao documento e vínculo com pedido de aprovação.
- `vinculos_documentais`: relação do documento com compra/estoque/despesa/obrigação/animal/lote sem duplicar o documento.
- `historico_processamento`: quem iniciou, aprovou, rejeitou e reprocessou; diffs de correções.

**Política:** extração não é lançamento final, rascunho não é aprovação, aprovação não é autorização fiscal automática. Separar dados brutos, interpretação e efeitos financeiros.

## 7. Offline e sincronização

- **Captura e armazenamento local funcionam offline**, incluindo foto e arquivos escolhidos antes ou durante perda de rede.
- **Extração por IA em nuvem necessita conexão**; processamento no próprio dispositivo pode ser estudado futuramente, mas não é premissa do MVP.
- Mostrar etapas explícitas: `arquivo_salvo_localmente`, `aguardando_envio`, `enviando`, `analisando`, `revisao_necessaria`, `submetido`, `aguardando_aprovacao`, `aprovado`, `falha` / `conflito`.
- Manter metadados e binário do arquivo na outbox local até confirmação; lidar com reenvio parcial, perda de sessão, retomada e reconexão.
- A transferência do arquivo e o envio do comando devem ser **idempotentes** e relacionados pelo mesmo identificador de operação/documento.
- Em offline prolongado, permitir **lançamento manual** independente da leitura por IA, com opção de anexar nota e vincular depois.
- Aplicar isolamento e expurgo local conforme conta, dispositivo e políticas de segurança.

## 8. Privacidade, segurança e compliance

- Dados fiscais podem conter CPF/CNPJ, endereços, valores e dados de terceiros: tratar sob LGPD e mínimo acesso necessário.
- Não enviar documentos a provedores de IA sem transparência e política aprovada sobre tratamento e retenção; avaliar contratos e localização de processamento.
- Bucket privado, autorização por tenant/operação/fazenda, URLs temporárias para arquivos e encriptação apropriada.
- Aplicar antivírus/validação MIME, limite de páginas/tamanho e defesa contra PDFs malformados e conteúdo hostil.
- **Não armazenar PDFs/imagens integrais nem dados fiscais sensíveis em logs de aplicação**.
- Nunca disponibilizar segredo/chave do provedor de IA no aplicativo: integração por backend.
- Auditabilidade das alterações da IA e do humano; usuário deve poder acessar o arquivo-fonte na conferência.
- Regras e integrações fiscais exigem validação com contador/especialistas; IA não substitui documento fiscal oficial nem consulta de autenticidade.

## 9. UX proposta

Captura, espera offline, análise, revisão dos campos e confirmação devem manter documento e
incertezas visíveis, permitir correção manual e não sugerir aprovação por IA. A aplicação das
regras de navegação, acessibilidade e estados pertence a [Experiência do usuário](EXPERIENCIA_USUARIO.md).

## 10. Testes e critérios de aceite

- [ ] Receber **foto legível, imagem e PDF** de NF realistas.
- [ ] Offline: foto permanece no aparelho e será processada quando voltar a conexão.
- [ ] XML válido, se enviado, é interpretado de forma determinística e não reprocessado cegamente por IA.
- [ ] Extrair emitente, número, série, data, produtos/quantidades e total quando presentes.
- [ ] Exibir campo ausente como pendente; não inventar vencimento ou rateio.
- [ ] Uma nota com compra de sal gera proposta de entrada em estoque e não apropriação integral automática como consumo.
- [ ] Nota de animal gera proposta de compra vinculada ao lote correto após conferência.
- [ ] Usuário confere e edita todos os campos relevantes antes da submissão.
- [ ] O arquivo original pode ser consultado junto ao rascunho e à operação aprovada.
- [ ] Envio repetido, reconexões e reprocessamento não duplicam conta a pagar, custo ou estoque.
- [ ] Despesa extraída não afeta saldo financeiro consolidado antes de aprovação por **outro sócio**.
- [ ] Se a nota já existir, alertar e orientar vinculação/correção, sem duplicar automaticamente.
- [ ] Acesso aos arquivos, extrações e rascunhos respeita operação/fazenda e permissões.
- [ ] Falhas de OCR/IA possuem recuperação e sempre oferecem preenchimento manual.
- [ ] Registrar métricas de precisão por campo, taxa de correção, custo por documento, tempo de processamento e taxa de duplicatas em um conjunto de teste com documentos anonimizados/autorizados.

## 11. Prioridade e entregas

**MVP prioritário:** captura PDF/foto offline; upload após reconexão; extração básica de NF-e/DANFE de insumos; revisão humana; rascunho de compra/despesa; segundo aprovador; documento anexado; deduplicação.

**Evolução:** XML oficial quando fornecido; múltiplos layouts/NFS-e; classificação sofisticada por item; sugestão de rateio por lote baseada em histórico; consulta autorizada de documentos; integração com contador e rotinas fiscais.

> XML pode ser implementado já no MVP se a amostra de documentos indicar ganho relevante de confiabilidade. A prioridade por tipo documental deve ser validada com notas reais.

## 12. Pontos em aberto

1. Tipos e volumes reais de notas: compras de animais, insumos, serviços, frete, manutenção, NFS-e e recibos.
2. Exemplos autorizados de PDFs, fotos e XML; variação de fornecedores e qualidade de imagem.
3. As notas normalmente trazem condições de pagamento ou as parcelas são combinadas fora do documento?
4. Quem importa notas e quem deve conferir os campos antes da aprovação pelo sócio?
5. Emissão fiscal/consulta de autenticidade é desejada ou apenas organização e lançamento?
6. Qual provedor de IA, restrições de dados, orçamento mensal, expectativa de taxa de acerto e latência?
7. Escopo de consulta/correção de documentos por sócio, funcionário e contador.
8. Regras para documentos já lançados manualmente ou duplicados entre operações.
9. Critérios de aprovação de anexos que **não** criam evento financeiro/operacional (somente documento).

## 13. Fontes técnicas de referência

- [Portal NF-e — Perguntas frequentes sobre DANFE](https://www.nfe.fazenda.gov.br/portal/principal.aspx): o DANFE é uma representação auxiliar da NF-e.
- [OpenAI — File Inputs](https://developers.openai.com/api/docs/guides/file-inputs): exemplo de suporte de API multimodal a PDFs.
- [OpenAI — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): retorno estruturado, ainda sujeito a validação semântica.
- [OpenAI — Images and Vision](https://developers.openai.com/api/docs/guides/images-vision): processamento de imagens em modelos multimodais.

Estas referências **não definem fornecedor obrigatório**, nem garantem precisão em documentos reais. A integração deverá ser avaliada com conjunto de teste.

## 14. Histórico de mudanças

| Data e hora (Brasília) | Versão | Mudança | Situação |
| --- | --- | --- | --- |
| 14/10/2026 às 07:46 (America/Sao_Paulo, UTC−03:00) | 0.2.0 | OpenRouter definido como gateway inicial de modelos multimodais; OCR/texto/XML mantidos como estratégias complementares em validação | **Gateway definido / método aferido por POC** |

| 14/10/2026 às 07:32 (America/Sao_Paulo, UTC−03:00) | 0.1.0 | Registrada extração por IA de notas fiscais PDF/foto como funcionalidade central; criado fluxo offline → análise → conferência → segunda aprovação → lançamento | **Necessidade confirmada / implementação proposta** |
