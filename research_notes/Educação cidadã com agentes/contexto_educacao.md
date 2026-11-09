# Educação cidadã a partir do contexto local

Inspeção local em 05/11/2026. Esta extensão segue a escolha atual do usuário: educação com métodos interessantes, benefício direto ao cidadão e projeto separado da Outis. Foram lidos READMEs, documentação técnica pertinente e trechos pequenos de código; nenhum dado de aluno, documento de cliente, credencial ou arquivo de notas pessoais foi aberto. Os conceitos abaixo são hipóteses de desenho. Evidência de eficácia deve vir dos estudos externos e de avaliação própria, não do interesse técnico.

## Quais projetos educacionais são realmente identificáveis?

### Takeaway

SkillMap é um antecedente educacional inequívoco. CS2 Coach oferece um antecedente relevante de feedback sobre desempenho observado; ukulele-binder apoia a prática musical, mas não demonstra método de ensino. UManager é um jogo, sem evidência local de proposta educacional.

### Cited Findings

| Projeto | O que a fonte demonstra | O que não demonstra | Fonte |
|---|---|---|---|
| **SkillMap 4.0** | GS2 FIAP 2025 sobre requalificação profissional; gera roadmaps com IA e recursos web, milestones, XP e chatbot | Ganho de aprendizagem, teste independente de competência ou acompanhamento cognitivo | [README](/data/projects/hobby/skillmap/README.md:1); [fluxo](/data/projects/hobby/skillmap/README.md:71) |
| **Progresso do SkillMap** | O aluno toca para alternar `completed`; backend aceita o booleano e grava o milestone | Que marcar a etapa corresponde a dominar a competência | [Interface](/data/projects/hobby/skillmap/src/screens/SkillDetailScreen.tsx:69); [backend](/data/projects/hobby/skillmap/backend/src/controllers/roadmap.controller.ts:478) |
| **CS2 Coach** | Parseia partidas, calcula métricas individuais e usa diagnóstico associado a guias e drills | Validação de ganho de habilidade ou sistema de visão: o estado vem do arquivo `.dem`, não de câmera | [README](/data/projects/hobby/cs2-coach/README.md:3) |
| **ukulele-binder / uketab** | Biblioteca pessoal de tablaturas, editor, diagramas e exportação A4; preserva digitações sem inventar forma ausente | Tutoria, avaliação de execução ou eficácia pedagógica | [README](/data/projects/hobby/ukulele-binder/README.md:3); [digitações](/data/projects/hobby/ukulele-binder/README.md:64) |
| **UManager** | Dados e competições de um jogo de futebol, com modpacks e carreira | Projeto educacional ou aptidão como fundamento pedagógico | [Documentação](/data/projects/hobby/uManager/docs/modpacks/README.md:1) |

### Inferences

- O avanço mais coerente em relação ao SkillMap seria trocar o progresso autodeclarado por evidência observável de uma competência: o aluno resolve, constrói ou explica algo sem ajuda. Isso é proposta nova; não é capacidade pedagógica já validada.
- O precedente pessoal mais interessante é o CS2 Coach: `execução observada → padrão de erro → prática específica → nova execução`. Esse desenho combina com a preferência por IA que faz trabalho concreto. Adaptá-lo à escola exige conteúdo e avaliação novos.
- O ukulele mostra interesse em ferramentas que respeitam a atividade fora da tela e permitem prática com material legível. Isso permite considerar papel e manipuláveis como parte do produto, sem presumir preferência por ensinar música.
- Não há base para afirmar que todos os projetos educacionais lembrados pelo usuário foram encontrados. A busca foi dirigida a materiais técnicos em `/data/projects/hobby`.

### Gaps

- O usuário pode ter projetos educacionais em outros lugares; não foram vasculhados documentos pessoais para descobri-los.
- Resultados de performance e eficácia declarados no README do SkillMap não foram auditados e não devem ser citados como evidência empírica.

## Que métodos da Outis podem apoiar aprendizagem verificável?

### Takeaway

Transferir verificação, estado e evidência é mais útil do que transferir o produto empresarial. O sistema deve distinguir uma ajuda dada pelo agente de uma habilidade demonstrada pelo aluno sem essa ajuda.

### Cited Findings

| Método existente | Adaptação educacional proposta | Limite |
|---|---|---|
| Fonte, data, cobertura e evidência legível da research stack | Conteúdo e justificativas de intervenção ligados a currículo e estudos abertos, com condições de aplicação | Uma citação não demonstra eficácia da intervenção específica. [Skill](/data/projects/hobby/my-llm-kit/skills/research/SKILL.md:9) |
| Verificação semântica contra fatos e retorno com perguntas pendentes | Conferir se o feedback se refere ao trabalho real do aluno; quando a imagem não for legível, perguntar em vez de completar | JEV/LLM não equivale a um avaliador pedagógico calibrado. O método deve ser reavaliado no domínio. [Redatio](/data/projects/business/outis/outis-redatio/REDATIO.md:71) |
| Jobs delimitados e artefatos revisáveis | Separar leitura visual, hipótese de erro, seleção de intervenção e avaliação final; registrar os limites de cada etapa | Não exige muitos agentes nem reaproveitamento integral da Central. [Hermes](/data/projects/business/outis/outis-hermes-skills/README.md:3) |
| Métricas com atualização, unidade e cobertura | Medir tentativa independente, erro por competência, tipo e quantidade de ajuda; a seleção da próxima tarefa usa esse histórico | Sessões, tempo de tela, XP e satisfação não substituem medida de aprendizagem. [Código](/data/projects/business/outis/outis-central/src/lib/mcp/query-metrics.ts:1) |
| Evidência visual e revisão humana do Vigilante | Preservar recorte do papel/objeto que sustenta a hipótese; professor pode aceitar ou corrigir a leitura | O YOLO de EPI não serve para escrita, frações ou experimentos; os modelos e dados seriam novos. [README](/data/projects/hobby/vigilante-ai/README.md:39) |

### Inferences

- Contrato sugerido por tentativa: `atividade`, `estado visual observado`, `trecho ou região de evidência`, `hipótese de erro`, `incerteza`, `ajuda oferecida`, `resposta do aluno`, `resultado sem assistência`.
- Separar observação de interpretação: "o desenho tem sete partes e duas estão marcadas" é diferente de "o aluno não compreende equivalência". Uma única produção só sustenta uma hipótese, a ser confrontada com outra tarefa.
- O aluno não deve receber um selo de domínio porque a conversa foi boa ou porque o agente disse que aprendeu. Domínio precisa de uma tarefa nova resolvida pelo próprio aluno.
- A análise de dados deve influenciar a intervenção e a revisão posterior; um dashboard ao final seria insuficiente para caracterizar esse método.

### Gaps

- Os repositórios não contêm, nos materiais examinados, um tutor escolar multimodal validado, rubricas pedagógicas prontas ou modelos para os cenários propostos.
- Efeito de feedback, prática de recuperação, aprendizagem por ensinar e exemplos incorretos precisa ser sustentado por estudos adequados e por suas condições, não por analogia com QA de software.

## Quais três conceitos trazem uma mudança real de método?

### Takeaway

Favorito para a GS: um agente aprendiz que o aluno precisa ensinar com evidência visual e que revela erros conceituais controlados. Ele oferece uma cena demonstrável e coloca o aluno em atividade; precisa de um recorte pequeno, comparação com sistemas existentes e avaliação sem assistência. A alternativa mais aplicável à rotina escolar é acompanhar o processo no caderno, com dificuldade técnica maior.

### Cited Findings

- O SkillMap já ocupa o espaço de trilha personalizada, material web e chatbot, portanto repetir esse pacote acrescentaria pouco em relação ao histórico local. [README](/data/projects/hobby/skillmap/README.md:28)
- O CS2 Coach mostra um desenho já explorado pelo usuário no qual o dado sobre o desempenho antecede o diagnóstico e o exercício. [README](/data/projects/hobby/cs2-coach/README.md:9)
- Os métodos de evidência, controle de versão e revisão citados acima fornecem precedentes de engenharia; não fornecem prova de eficácia educacional.

### Inferences

### 1. Aprendiz — o aluno ensina a IA

**Proposta:** em um recorte de matemática escolar, o aluno é responsável por ensinar um agente que apresenta uma concepção errada explícita e controlada. Exemplo matemático ilustrativo: o agente acredita que `1/8 > 1/4` porque oito é maior que quatro. O estudante precisa montar uma representação e explicar por que aquela regra falha.

**Visão indispensável:** o aluno usa tiras de fração, cartões, recortes ou um desenho no papel. A câmera lê quantidade, agrupamento e relação espacial entre as partes; o agente reage à demonstração produzida. Uma versão apenas textual pode explorar a mesma família pedagógica, mas não constitui a implementação aqui proposta. No MVP, usar um tapete impresso com marcas de referência e peças reconhecíveis, reduzindo ambiguidade de geometria e iluminação.

**Mecânica:** preteste sem ajuda → erro do agente → representação física pelo aluno → pergunta do agente sobre a evidência → correção da regra → desafio de transferência com material/valores diferentes e agente silencioso. A concepção errada deve ser estado de um roteiro pedagógico, não uma alucinação livre. O agente só declara que entendeu quando o trabalho sustenta a mudança; isso não atribui domínio ao aluno.

**Dados e cloud:** registrar quais evidências o aluno apresentou, qual regra foi corrigida, quanta ajuda foi dada e quais itens novos resolveu sozinho. A nuvem mantém estado do agente e evidências privadas entre sessões; análise do histórico seleciona a próxima concepção a testar.

**Medida:** acerto e qualidade da explicação em itens inéditos sem o agente, mais retenção alguns dias depois. Uma rubrica de professor e respostas matemáticas verificáveis fundamentam o gabarito; o mesmo LLM que intervém não deve ser a única fonte da nota. Controle possível: mesma atividade e tempo com feedback convencional. Piloto pequeno estima viabilidade e sinais, não eficácia populacional.

**MVP até 19/11:** um conceito, duas concepções erradas, três tipos de representação visuais delimitados, um fluxo de diálogo e conjunto curto de itens paralelos. Não prometer formação geral nem treinamento de modelo próprio.

**Potencial CitizenTech:** apoiar estudantes com menor acesso a feedback individual, num polo, ONG ou escola com um dispositivo compartilhado. Essa necessidade precisa de evidência externa e validação local. ODS 4 é candidato; a meta deve ser selecionada com fonte oficial.

### 2. Rastro do raciocínio — acompanhar o caderno

**Proposta:** observar como uma resolução muda entre etapas e oferecer uma intervenção curta no primeiro ponto em que o procedimento deixa de corresponder ao problema. O aluno trabalha no próprio papel, não num chat de perguntas e respostas.

**Visão indispensável:** duas ou três capturas consentidas do caderno extraem expressões, rasuras, desenhos e correspondência espacial entre passos. O sistema precisa alinhar versões e localizar a evidência da divergência; não basta receber a expressão final digitada. Sem webcam contínua, rosto ou inferência de emoção/atenção.

**Mecânica:** tentativa inicial sem ajuda → hipótese de erro ligada a uma região da folha → pergunta ou contraexemplo curto → nova tentativa com menos ajuda → problema diferente sem assistência. Se a escrita for ambígua, confirmar o símbolo. Não atribuir uma concepção cognitiva a partir de um único erro.

**Dados e cloud:** grafo simples de tentativas e intervenções; análise diferencia erro de leitura, erro de procedimento e erro persistente. O histórico decide o nível de pista, enquanto a nuvem guarda versões e a revisão do professor.

**Medida:** primeiro erro identificado corretamente contra revisão humana, precisão da extração, resolução independente posterior e transferência. O tempo poupado ao professor é métrica secundária, distinta de aprendizagem.

**MVP até 19/11:** frações com 2–3 linhas por resolução, captura manual, exemplos escritos legíveis e uma família restrita de erros. Manuscrito livre irrestrito e leitura de todo o caderno elevariam muito o risco.

**Diferencial a validar:** o processo e a avaliação sem ajuda. Scanner que dá resposta e solução passo a passo precisa ser comparado com Photomath e alternativas atuais; não apresentar a leitura da folha em si como novidade.

### 3. Laboratório de bolso — aprender investigando objetos reais

**Proposta:** missões práticas com material barato em que o estudante prevê, monta, mede e revisa uma explicação. Recorte ilustrativo seguro e simples: comparar resistência de pontes de papel com diferentes dobraduras, mesmo vão e pequenas peças como carga.

**Visão indispensável:** a câmera registra a montagem, a posição dos apoios e a carga/contagem de peças visíveis numa bancada com referência de escala. A evidência vem do experimento real; não é uma foto decorativa que abre uma videoaula. No MVP, excluir peças sobrepostas e confirmar a contagem antes de usá-la como medida.

**Mecânica:** previsão antes de agir → experimento documentado → escolha da variável a mudar → segundo teste → comparação das evidências → nova montagem investigada sem dicas. O agente pergunta sobre controle de variáveis e sustentação da conclusão, sem resolver a missão.

**Dados e cloud:** séries de testes, variável manipulada, resultado e alterações no plano; análise verifica comparabilidade e propõe o próximo teste. Nuvem permite retomar e professor revisar as evidências.

**Medida:** conseguir propor um teste que isole a variável e justificar uma conclusão com novos dados, numa tarefa sem ajuda. Resistência maior da ponte é resultado de engenharia, não prova automática de aprendizagem científica.

**MVP até 19/11:** uma missão, um cenário de captura, 3–5 estados reconhecíveis e apoio de professor para rubrica. A promessa de substituir laboratório escolar inteiro seria excessiva.

**Diferencial a validar:** aprendizagem por investigação e feedback sobre evidência física. A comparação deve incluir laboratórios de ciência com câmera e tutores multimodais atuais, sem afirmar ineditismo.

### Opção adicional fora de disciplinas: Ensaio cidadão

**Proposta:** praticar decisões digitais do cotidiano ensinando um agente inexperiente a questionar mensagens, anúncios e telas. O agente apresenta uma justificativa errada, por exemplo confiar numa comunicação só porque traz um logo. O aluno precisa localizar as pistas visuais, explicar por que a evidência é insuficiente e escolher como verificar por um canal independente. Os cenários são simulados; a plataforma não se propõe a certificar mensagens reais como seguras.

**Visão indispensável:** a entrada é a imagem da mensagem ou do aviso, com layout, remetente, domínio, QR ou hierarquia visual. CV/OCR localiza essas pistas e conecta a explicação do aluno a regiões da imagem. Decodificar um QR revela um conteúdo, não sua legitimidade; a identidade do remetente também não é comprovada pela aparência. A atividade exige interpretação da peça visual completa em vez de perguntas genéricas num chat.

**Agência do estudante:** ensinar o agente a suspender a conclusão; investigar contradição; pedir evidência relevante; escolher uma ação de verificação. Depois, receber uma peça visual inédita e decidir sem ajuda do agente. Não há clique em pagamento, envio de documentos ou interação com serviços reais durante a simulação.

**Dados e cloud:** acompanhar quais pistas o aluno considera, quais justificativas usa e que tipo de erro reaparece. Análise seleciona cenários seguintes; nuvem mantém histórico de competência e permite uso em biblioteca, escola, ONG ou dispositivo compartilhado.

**Medida:** taxa de decisão correta e qualidade da justificativa em casos novos, medindo também falsos positivos contra mensagens legítimas. Repetir após intervalo. Evitar ensinar apenas a reconhecer o mesmo template. Participação e confiança declarada não provam resistência a golpes.

**MVP:** seis peças simuladas de duas famílias, três regras verificáveis e um agente com dois erros controlados. Esse recorte amplia a aderência a CitizenTech e à educação de jovens/adultos, mas sua prioridade depende da resposta do usuário. **A base de eficácia e o diferencial perante programas existentes são lacunas**, sem abrir aqui um novo ramo de literatura.

Se a escolha do usuário for programação em editor, reconhecer o conflito: dados estruturados do código e dos testes são mais adequados do que visão computacional. Fotografar código apenas para cumprir o requisito seria uma adaptação fraca; preferir um domínio no qual a informação visual seja parte real da tarefa.

### Gaps

- Todos os três conceitos precisam de comparação competitiva e estudos externos. Aprender ensinando agentes já é uma família de pesquisa; não reivindicar sua invenção.
- Público, acesso ao local de piloto e conteúdo curricular ainda não estão definidos. Escolher frações é hipótese de escopo, não diagnóstico de maior prioridade no Brasil.
- A comparação pré/pós no mesmo grupo não isola causalidade. Separar melhoria observada, viabilidade técnica e hipótese de eficácia.
- Modelo legado diferente não implica que uma versão moderna irá funcionar: visão, política de intervenção e rubrica exigem avaliação própria.

## O que já existe nas alternativas verificadas?

### Takeaway

Aprender ensinando uma IA com conhecimentos limitados e concepções erradas já foi materializado no TeachYou. Ler problemas por câmera e explicar os passos também já é oferta do Photomath. A oportunidade proposta deve ser descrita como combinação e validação para um público e tarefa específicos, sem alegação de invenção do método.

### Cited Findings

- **TeachYou / AlgoBo, KIXLAB, KAIST/Stanford:** a página dos próprios autores descreve aprendizagem de algoritmos pelo ensino de um agente, estado de conhecimento editável, concepções erradas prescritas, perguntas de aprofundamento e feedback sobre a forma de ensinar. O estudo resumido ali envolve 40 iniciantes; o efeito reportado refere-se à densidade de conhecimento nas conversas. Não é correto convertê-lo em ganho de nota, retenção ou demonstração de eficácia no Brasil. O site pede parceiros para investigação longitudinal. [Projeto oficial](https://teachyou.kixlab.org/), acessado em 05/11/2026; snapshot `evidencias-competidores/eec1b8d1-031c-48c6-bdf9-6fb30a5717f6/page.md`.
- **Photomath:** a página oficial apresenta captura de problema por câmera, solução para o problema e explicação passo a passo, incluindo possibilidade de métodos diferentes. O produto se posiciona como apoio à compreensão; seria incorreto descrevê-lo como somente resposta sem explicação. [Página oficial](https://photomath.com/), acessada em 05/11/2026; snapshot `evidencias-competidores/02f4d6e7-9e49-4d50-a26a-8f2506ea4085/page.md`.
- **Khanmigo:** a página oficial de estudantes se posiciona como tutoria guiada por perguntas, sem entregar diretamente a resposta, integrada ao conteúdo da Khan Academy. Também apresenta revisão de código e interação por voz. Isso comprova que guiar sem resolver e oferecer voz já são posicionamentos existentes; não demonstra que o produto cumpra essas promessas em toda situação. [Página oficial para estudantes](https://www.khanmigo.ai/learners), acessada em 05/11/2026; snapshot `evidencias-competidores/d8aec514-8299-40d6-9aba-8949c7e20d4c/page.md`.

### Inferences

| Conceito proposto | Sobreposição já verificada | Hipótese que ainda poderia merecer produto e teste |
|---|---|---|
| Aprendiz | Estado de conhecimento, erros controlados, perguntas e aluno ensinando já são centrais ao TeachYou | Ensinar através de manipuláveis físicos e desenhos observados pela câmera; tarefa cidadã/público local; verificação da aprendizagem do humano em tarefa nova sem o agente |
| Rastro do raciocínio | Captura e explicação de matemática já são centrais ao Photomath | Acompanhar versões do raciocínio, localizar divergência sustentada por evidência e testar retirada da ajuda; verificar antes se alternativas atuais já cobrem isso |
| Tutor de qualquer matéria que pergunta e usa voz | Khanmigo já descreve essa oferta | Esse posicionamento sozinho seria insuficiente como diferencial; necessário especificar tarefa observável, procedimento e avaliação |
| Laboratório de bolso | Não foi feita varredura de laboratórios com câmera | Feedback apoiado em experimento físico e competência de planejar/investigar, em vez de apenas acertar uma pergunta; hipótese ainda sem comparação suficiente |
| Ensaio cidadão | Não foi feita revisão de programas de educação digital ou treino contra manipulação | Aprender a criticar justificativas de um agente usando evidência visual e avaliação de transferência; hipótese ainda sem comparação suficiente |

O diferencial não deve ser "o modelo moderno consegue olhar uma imagem e conversar": modelos gerais já podem oferecer parte dessa interação. O produto precisa tornar o método consistente, delimitar a tarefa, preservar os estados certos e medir o que o cidadão consegue fazer sozinho.

**Recomendação após a comparação:** apresentar o mecanismo como prática física observável seguida de demonstração de autonomia humana, e não como invenção de um aluno ensinando um bot. Um recorte promissor para reagir ao usuário é um laboratório de numeramento cotidiano para jovens/adultos: montar quantidades equivalentes com peças ou embalagens, contestar a justificativa de um agente e depois resolver um caso novo sozinho. É hipótese de produto específica, ainda sem validação de demanda ou eficácia. O agente aprendiz é uma opção de interação dentro desse procedimento, não o diferencial inteiro.

### Gaps

- Esta comparação de páginas oficiais não é auditoria completa de todos os recursos, nem comparação de eficácia. A ausência de recurso numa homepage não prova que o produto não o ofereça.
- A pesquisa dos estudos e da implantação mais recente de TeachYou é feita pelas outras frentes; não duplicada aqui.
- A primeira busca de Khanmigo falhou com `serp_unusable_results`; outra formulação teve êxito. Nenhum erro foi convertido em ausência de produto. Não houve falha de autenticação, CAPTCHA ou bloqueio nessa sequência.
- Metering: foram observados tentativas e bytes nos manifestos; créditos monetários, preço e custo total permanecem desconhecidos. Hashes são os informados pelo serviço; bytes brutos não foram exportados ou verificados localmente.

## Como escolher as metas dos ODS sem forçar o enquadramento?

### Takeaway

ODS 4 deve ser o vínculo principal. A meta depende da competência e do público escolhidos; o projeto contribui para um objetivo, não demonstra cumprir uma meta global por realizar um piloto.

### Cited Findings

- A **meta 4.1** trata da conclusão de educação básica de qualidade com resultados relevantes de aprendizagem; o indicador 4.1.1 inclui proficiência mínima em leitura e matemática. As **metas 4.4, 4.5 e 4.6** tratam, respectivamente, de competências relevantes de jovens/adultos para trabalho, acesso educacional equitativo para grupos vulneráveis e alfabetização/numeramento de jovens/adultos. [ODS 4 oficial](https://sdgs.un.org/goals/goal4), acessado em 05/11/2026; texto normalizado completo de 46.746 caracteres lido até EOF e salvo em `evidencias-competidores/625b9dcc-1282-4da8-9cb0-7adae52566a2/page.md`.
- A **meta 10.2** trata de inclusão social, econômica e política independente de características pessoais ou condição econômica. [ODS 10 oficial](https://sdgs.un.org/goals/goal10), acessado em 05/11/2026; texto normalizado completo de 43.386 caracteres lido até EOF e salvo em `evidencias-competidores/80c478f4-58b4-4829-bc9a-31b0d5ad9b0e/page.md`.

### Inferences

- Frações para estudantes da educação básica: priorizar **4.1**; incluir **4.5** se o desenho e o piloto efetivamente enfrentarem uma barreira de acesso.
- Numeramento aplicado a jovens/adultos: priorizar **4.6**. A escolha dessa meta não equivale a afirmar que toda dificuldade de frações é analfabetismo funcional.
- Habilidade digital para participação e trabalho: **4.4** é possível se a competência e a relação com formação/trabalho forem explícitas; não selecionar a meta só porque o produto é digital.
- **10.2** é vínculo complementar quando houver público e mecanismo de inclusão concretos. Resultado em teste curto de competência não mede o indicador macro de renda do ODS.

### Gaps

- Sem público/competência definidos, ainda não é possível fixar as duas metas mais fortes ou uma métrica de equidade relevante.
- Nenhum dado agregado global foi usado para estimar o mercado brasileiro ou a demanda pelo produto.
