# Métodos transferíveis e aderência pessoal

Pesquisa local em 05/11/2026. Escopo: documentação e pequenos trechos de código, sem executar aplicações, acessar credenciais, dados de clientes ou documentos privados. A atualização do usuário prevalece: o novo projeto deve beneficiar cidadãos diretamente, ser separado da Outis e não envolver pequenos negócios. A existência de um arquivo demonstra implementação ou documentação no checkout, não maturidade de produção.

## Quais capacidades existem e quais precisariam ser construídas?

### Takeaway

O melhor reaproveitamento é de método: transformar contexto incompleto em uma ação verificável, preservar a evidência, pedir confirmação nas incertezas e medir o resultado. Não há justificativa para reutilizar a marca, o modelo comercial ou a base de clientes da Outis.

### Cited Findings

| Capacidade observada | Evidência local | Transferência possível | Limite |
|---|---|---|---|
| Pesquisa com proveniência e distinção entre ausência e falha | A skill pede fonte primária, data, leitura completa e lacunas explícitas; buscas e páginas passam por Scrapinho. [Research](/data/projects/hobby/my-llm-kit/skills/research/SKILL.md:9) | Informação cidadã com origem, data e cobertura visíveis | Método existente; nova seleção de fontes e nova taxonomia necessárias |
| Coleta → classificação → ranking estruturado | `signal-detection` descreve saída JSON, taxonomia, atribuição por entidade e proibição de inventar sinais. [Skill](/data/projects/business/outis/outis-hermes-skills/skills/signal-detection/SKILL.md:42) | Separar uma comunicação cidadã em fatos, pendências, prazos e próximos passos | Os pesos comerciais atuais não se transferem; devem ser descartados |
| Coordenação entre plataforma e executores | Central é dona de calendário, revisões e publicação; Hermes executa o job e devolve o artefato. [README](/data/projects/business/outis/outis-hermes-skills/README.md:3) | Aplicação cidadã mantém estado e delega extração ou verificação de modo delimitado | Não é preciso implantar um sistema complexo de agentes para o MVP |
| Verificação semântica contra fatos e perguntas pendentes | Redatio documenta perguntas binárias ligadas a fatos/fontes, bloqueios, correção limitada e retorno ao usuário. [REDATIO.md](/data/projects/business/outis/outis-redatio/REDATIO.md:71) | Verificar se prazo, documento exigido e instrução estão apoiados no material e nas fontes | Resultados do benchmark local são pequenos e não demonstram precisão geral nem certeza jurídica |
| Métricas com unidade, cobertura e atualização | `query-metrics.ts` implementa razões calculadas sobre somas, nulo na divisão por zero, estado e atualização da fonte, comparações entre períodos e truncamento explícito. [Código](/data/projects/business/outis/outis-central/src/lib/mcp/query-metrics.ts:1); [retorno](/data/projects/business/outis/outis-central/src/lib/mcp/query-metrics.ts:501) | Medir conclusão de tarefa, tempo, erro de extração, cobertura e qualidade dos dados | Métricas de mídia e vendas não têm significado cidadão; é necessário definir indicadores novos |
| Isolamento por projeto e concessão temporária por job | O código descreve e tipa credenciais com escopo e expiração vinculada ao job. [Código](/data/projects/business/outis/outis-central/src/lib/mcp/credentials.ts:1) | Evitar mistura entre cidadãos e limitar o acesso do executor aos documentos necessários | Reuso de padrão; não exportar credenciais existentes nem supor que isso resolve todo o desenho de privacidade |
| Nuvem e aquisição assíncrona com artefatos | Scrapinho documenta Worker, Durable Object SQLite, Containers, Queue/R2, fontes e estado completo/parcial. [README](/data/projects/business/scrapinho/README.md:3); [completude](/data/projects/business/scrapinho/README.md:55) | Reutilizar experiência de infra e eventualmente o serviço autorizado para fontes públicas | A documentação aponta pendências de maturidade; não tratar capacidade como SLA ou custo já estabelecido |
| Evidência visual → alerta → revisão humana → métrica | Vigilante possui detector YOLO/OpenCV, persistência de alertas, fila de revisão e feedback; o serviço desfoca rostos nos artefatos de revisão. [README](/data/projects/hobby/vigilante-ai/README.md:39); [código](/data/projects/hobby/vigilante-ai/backend/app/services/alert_service.py:52) | Padrão de classificação visual com confirmação humana para ocorrências urbanas | O modelo treinado é de EPI e não pode ser usado como detector de buracos, barreiras ou enchentes |
| Rascunho revisável e verificação do artefato final | Rastro documenta sessões duráveis, inspeção de quadros, revisão e aplicação; preview e export compartilham compositor. [README](/data/projects/hobby/rastro/README.md:27) | Produzir o pitch e trazer ao produto a separação entre rascunho e ação confirmada | Edição/renderização não constitui a visão computacional da solução CitizenTech |

### Inferences

- O padrão mais promissor para o projeto é `imagem recebida → fatos estruturados → confirmação → ação útil → acompanhamento → métrica`. Essa sequência adapta os métodos observados; ainda não existe como produto cidadão nos trechos examinados.
- Reutilizar módulos pequenos pode ser possível, mas portar Redatio ou Central inteiros acrescentaria acoplamento e domínio desnecessário. A recomendação inicial é reutilizar contratos e desenho, implementando o recorte com código próprio.
- Não foi encontrado OCR de comunicações oficiais validado para esse caso. Extração visual seria componente novo, com conjunto de avaliação próprio.

### Gaps

- Não foi feita auditoria integral do código nem verificação operacional. A inspeção não estabelece cobertura de testes, desempenho atual, custo ou prontidão dos componentes.
- Nenhuma fonte local estabelece que a necessidade cidadã proposta tem demanda. Isso precisa da pesquisa externa e de entrevistas.

## Que interesses podem ser inferidos sem inventar memória?

### Takeaway

Os projetos sugerem interesse em ferramentas de IA que executam trabalho, preservam estado e entregam artefatos revisáveis. A preferência explícita atual é decisiva: usar esse modo de construir para um problema novo de cidadãos, sem transformar a GS em extensão comercial da Outis.

### Cited Findings

- Rastro se define como editor local nativo para agentes, com MCP e inspeção exata do resultado. Isso é evidência de trabalho em ferramentas operacionais para agentes. [README](/data/projects/hobby/rastro/README.md:3)
- Vigilante envolve streaming, detecção, revisão humana, dados de feedback e análise de falhas. O README distingue resultados de split contaminado de desempenho real e apresenta limitações. [README](/data/projects/hobby/vigilante-ai/README.md:39)
- O repositório de conteúdo pessoal mantém textos e roteiros em estados explícitos e diferencia arquivo existente de material aprovado ou publicado. [README](/data/projects/hobby/conteudo-murilo/README.md:1)
- O projeto anterior da Global Solution já tratou de enchentes, com Flutter, Firebase, meteorologia e propostas de sensores/alertas. O README contém inconsistências e itens futuros, portanto não comprova modelo preditivo validado. [README](/data/projects/hobby/gs-alerta-enchentes/README.md:20)
- Atualização textual recebida do coordenador, atribuída à resposta atual do usuário: Outis é projeto separado; excluir pequenos negócios e priorizar cidadão direto. Fonte: mensagem da sessão de 05/11/2026, sem URL pública.

### Inferences

- Uma ferramenta com transformação visível de uma entrada difícil em resultado verificável parece mais aderente do que um aplicativo de cadastro com dashboard decorativo. É inferência sobre o trabalho observado, não afirmação sobre preferências pessoais desconhecidas.
- A GS pode explorar um domínio novo e ainda preservar prazer técnico: extração multimodal, estado, contratos, verificações e avaliação pequena mas honesta.
- Repetir alerta de enchentes teria afinidade histórica, porém acrescentaria menos novidade pessoal e aumentaria exigência de validação de segurança.

### Gaps

- Não há evidência para afirmar interesse específico por acessibilidade urbana, burocracia, consumo de água ou outra causa. A seleção final deve ser apresentada como hipótese convidando reação, não como algo que já sabemos sobre o usuário.

## Quais ideias respeitam a separação e geram uma demonstração útil?

### Takeaway

Favoreço um assistente que converte uma comunicação visual de um serviço específico em uma tarefa acompanhável; a alternativa mais visual é uma ferramenta para registrar e acompanhar barreiras urbanas. Uma terceira hipótese, consumo doméstico a partir de contas, integra visão e análise de dados de forma especialmente clara e merece checagem de demanda e concorrência.

### Cited Findings

- O padrão de pergunta pendente e fidelidade a fatos do Redatio oferece um precedente metodológico para evitar completar prazos ou exigências por suposição. [REDATIO.md](/data/projects/business/outis/outis-redatio/REDATIO.md:73)
- O padrão de alertas revisáveis e feedback do Vigilante oferece precedente de processo para ocorrências visuais; os próprios resultados disponíveis desaconselham prometer generalização de um detector sem validação do domínio. [README](/data/projects/hobby/vigilante-ai/README.md:39)
- As comparações entre períodos e a atualização explícita no módulo de métricas são precedentes para analisar histórico do próprio cidadão sem preencher ausência de dado com zero. [Código](/data/projects/business/outis/outis-central/src/lib/mcp/query-metrics.ts:484)

### Inferences

As quatro opções abaixo são hipóteses de produto, não resultados de mercado. Não há vínculo de marca, integração com clientes da Outis ou monetização de pequenos negócios.

| Ideia provisória | Recorte e benefício direto | Quatro requisitos em funcionamento | Demonstração até 19/11 e limites |
|---|---|---|---|
| **Entendi, e agora?** | Pessoa com dificuldade digital recebe carta, aviso ou formulário de um serviço e precisa entender o que fazer. Escolher um único procedimento e território após pesquisa, com 2–3 tipos de comunicação | CV/OCR lê layout, campos e datas da foto; IA estrutura pendências e pede esclarecimento; análise de dados mede tempo, erro e conclusão; cloud mantém checklist, evidências e acompanhamento privado | Foto → campos destacados → confirmação de prazo e documentos → checklist com fonte oficial → estado da tarefa. Valor além de resumir foto: progresso persistente, verificação por procedimento e retorno para pendências. Não submeter requerimento nem decidir direito automaticamente |
| **Calçada viva** | Cidadão registra uma barreira no caminho e transforma relato em evidência utilizável e acompanhável | CV propõe categoria e região visual da barreira; IA organiza relato e consulta procedimento público; análise de dados agrupa recorrência e tempo de solução; cloud mantém registro e histórico | 10–20 fotos consentidas/públicas, 2 classes, confirmação humana, mapa simples e dossiê exportável. Não prometer rota segura nem diagnóstico de acessibilidade por foto. Detector novo ou modelo multimodal, não o YOLO de EPI |
| **Conta clara** | Morador quer compreender aumento de consumo de água/energia e perceber anomalia em seu próprio histórico | CV lê valores, leituras e períodos em imagens de faturas; IA explica campos e formula perguntas; análise compara consumo por dia/período, detecta desvio e separa tarifa de volume; cloud guarda histórico privado | 6–12 contas sintéticas ou consentidas de um fornecedor → revisão dos campos → gráfico → motivo possível e checklist oficial. Não concluir vazamento, fraude ou cobrança ilegal pela conta. Evitar cálculo tarifário normativo no MVP; análise depende de contas comparáveis |
| **Prazo certo** | Pessoa perde oportunidade pública por não conseguir transformar edital/aviso visual em requisitos e ações | CV extrai cartaz/edital; IA confronta requisitos com respostas confirmadas; dados medem abandono, pendências e prazos; cloud mantém oportunidades e lembretes | Um tipo de oportunidade pública em um território, 3 anúncios reais verificados, checklist e acompanhamento. Precisa provar diferencial sobre calendário e chatbot e confirmar atualização das fontes; não prometer elegibilidade nem cobertura completa |

**Favorito condicional:** `Entendi, e agora?`, se a pesquisa encontrar um procedimento no qual instruções fragmentadas e pendências tenham dor recorrente. O nome não deve preceder o recorte. Se só houver um resumo genérico de foto, abandonar essa versão: enviar foto ao ChatGPT já cobre grande parte do fluxo.

**Alternativa visual:** `Calçada viva`, caso exista um grupo de cidadãos disposto a validar a categoria e um caminho real para usar a evidência. O valor precisa estar em registro confiável, acompanhamento e utilidade ao cidadão, porque classificar e abrir chamado por si só tende a ser pouco diferencial.

**Alternativa de análise mais forte:** `Conta clara`, se fontes e entrevistas sustentarem a lacuna. Há encaixe direto entre extração visual e comparação de consumo. A existência de alternativas de concessionárias e apps deve ser pesquisada antes de escolher.

**Mínimo de avaliação para qualquer recorte:** conjunto pequeno com gabarito humano, separação entre extração correta e tarefa concluída, erro por campo/categoria, quantidade de casos nos quais o sistema pede confirmação e mediana de tempo para a tarefa comparada ao procedimento manual. Não apresentar metas de piloto como resultados obtidos. Não é necessário treinar uma rede nova para demonstrar aplicação prática de visão computacional, mas é necessário mostrar o processamento da imagem e avaliar seu resultado.

### Gaps

- Evidências externas, alternativas existentes, fonte oficial de ODS/metas e acesso ao público precisam vir das outras frentes. Estas notas não estabelecem demanda, TAM ou exclusividade.
- Esforço sugerido é avaliação qualitativa: o MVP de qualquer opção cabe como demonstração restrita em duas semanas se houver apenas um fluxo, uma fonte e uma modalidade de entrada; piloto real e expansão continuam hipóteses.
- Ainda faltam decisão de escopo, acesso consentido às entradas e definição de métricas de aceitação. Não prometer plataforma completa, integrações oficiais ou redução percentual sem ensaio.
