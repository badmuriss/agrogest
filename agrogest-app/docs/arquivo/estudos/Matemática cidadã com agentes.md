# Matemática cidadã com agentes

**Recomendação: desenvolver o Porquê, um laboratório visual de matemática com conversa por voz**, começando por equivalência e comparação de frações. O estudante monta uma representação, explica o que fez, relaciona-a à escrita matemática e enfrenta outro problema sem assistência. A visão computacional observa a construção; a IA escolhe uma intervenção; os dados distinguem ajuda recebida de competência demonstrada; a nuvem preserva o percurso. A voz permite conversar durante a manipulação. O núcleo seria concreto → representação → símbolo, com apoio ajustado ao desempenho. Sua eficácia continua sendo uma hipótese a testar.

Pesquisa consultada em **05/11/2026**. Pergunta de decisão: qual projeto matemático beneficia diretamente cidadãos, tem interesse pessoal para você e aplica as quatro tecnologias exigidas de forma verificável? Critério: compreensão demonstrada em problema novo, com escopo demonstrável até 19/11. Falsificador: o usuário melhora apenas enquanto recebe ajuda, aprende a satisfazer o agente ou gasta tanto esforço corrigindo a leitura visual que perde o benefício. Risco da pesquisa: material; não houve experimento próprio nem revisão sistemática da literatura.

## Comece pela relação que o aluno precisa compreender

A dificuldade a investigar é concreta: alguém consegue executar uma conta conhecida, mas tem dificuldade em explicar a relação representada ou aplicá-la de outra maneira. Sua insatisfação com o ensino pode motivar essa pergunta; ela não demonstra que exista um único método brasileiro nem estabelece a causa das dificuldades nacionais.

O Inaf inclui autonomia em práticas matemáticas no seu panorama de alfabetismo. Na edição de 2024, informa analfabetismo funcional em 43% das pessoas que cursaram os anos finais do Ensino Fundamental. Esse recorte é por escolaridade; não representa 43% dos alunos atualmente matriculados nem uma prova isolada de matemática. A página capturada não traz idade e tamanho amostral, e esses atributos não foram verificados. É contexto para investigar uma necessidade, sem transformar o percentual em mercado ou demanda pelo produto. ([Inaf](https://alfabetismofuncional.org.br/alfabetismo-no-brasil))

**Primeiro público candidato:** adultos que retomam os estudos e precisam recuperar fundamentos de matemática, por exemplo em uma turma de EJA ou ação de extensão. A escolha precisa de acesso real a participantes e de conversa com um educador. Se esse acesso não existir, escolher outro público explicitamente e adaptar a justificativa. A proposta deve respeitar adultos, com situações e linguagem adequadas.

“Matemática útil para a vida” pode significar comparar preço por unidade, ajustar quantidades numa receita, interpretar proporções ou entender um gráfico. Esses contextos permitem testar aplicação; o projeto também pode trabalhar compreensão matemática por interesse intelectual. No primeiro módulo, eu limitaria tudo a **equivalência de frações**, deixando proporções e gráficos para expansão.

O SkillMap já explorou trilhas, recursos, gamificação e chatbot. O CS2 Coach oferece um precedente pessoal: execução observada orienta diagnóstico e prática. Essa é uma inferência de afinidade, sem evidência de eficácia educacional. ([SkillMap](/data/projects/hobby/skillmap/README.md:1), [CS2 Coach](/data/projects/hobby/cs2-coach/README.md:3))

## A literatura orienta o desenho e delimita as promessas

**Explorar antes de receber instrução tem apoio para compreensão e transferência.** Sinha e Kapur reuniram 53 estudos, com 166 comparações, em uma meta-análise publicada em 2021. Resolver antes da instrução apresentou vantagem agregada em conhecimento conceitual/transferência, g = 0,36, IC95% [0,20; 0,51]; a vantagem não apareceu para conhecimento procedural. A revisão inclui experimentos e quase-experimentos, com busca até 2019, sem LLM. É o fundamento mais forte encontrado para esse desfecho, embora anterior ao recorte recente. Productive failure exige atividades de geração e consolidação bem desenhadas; pedir uma tentativa ou deixar o aluno errar não basta para usar esse nome. ([Sinha e Kapur](https://journals.sagepub.com/doi/10.3102/00346543211019105))

**Concreto → representação → abstrato oferece um núcleo coerente para a câmera.** A revisão de Ebner e colegas, publicada online em 2024 e em fascículo de 2025, reúne 30 estudos experimentais de caso único, com 116 participantes. Os resultados são favoráveis à aquisição de habilidades, mas há concentração em operações básicas e em poucos grupos de pesquisa. As intervenções também incluem instrução explícita e prática guiada. Não foi estabelecida nesta leitura uma síntese separada de transferência. Portanto, a revisão apoia investigar esse desenho; não demonstra que objetos, câmera e IA juntos funcionem para EJA brasileira. ([Ebner et al.](https://journals.sagepub.com/doi/10.1177/09388982241292299))

**Aprendizagem por domínio requer apoio, tempo e critérios claros.** A EEF classifica como baixa a segurança da sua síntese, cuja revisão disponível é de 2021. Também distingue esse princípio de programas chamados Mathematics Mastery. No ensaio primário desse programa, com 90 escolas randomizadas, a análise após um ano encontrou efeito pequeno e inconclusivo isoladamente: g = 0,10, IC95% [−0,01; 0,21]. O tratamento incluía currículo, recursos e formação docente; não isolava CPA. Não há base aqui para vender um “método de Singapura comprovado” ou adotar um limiar universal de domínio. ([EEF, síntese](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/mastery-learning), [avaliação primária](https://d2tic4wvo1iusb.cloudfront.net/documents/projects/EEF_Project_Report_MathematicsMasteryPrimary.pdf?v=1630926115))

Os estudos recentes de IA tornam essencial medir a retirada da ajuda. Nos experimentos de Liu e colegas, publicados no COLM 2026, participantes de tarefas curtas tiveram pior desempenho posterior sem IA; o efeito sobre abandono variou entre experimentos. Isso não demonstra que qualquer tutoria prejudique a aprendizagem. O preprint StudentBench, de setembro de 2026, encontrou ganhos imediatos com tutoria por IA e equivalência agregada à tutoria humana segundo uma margem estatística definida. O controle não fazia prática autônoma de GRE, e não houve avaliação longa de retenção. São intervenções e comparações diferentes, úteis para definir quais resultados precisamos observar. ([Liu et al., versão 6](https://arxiv.org/html/2604.04721v6), [StudentBench, versão 2](https://arxiv.org/html/2609.28470v2))

A engenharia também tem precedentes: StratL, de 2025, separa a estratégia pedagógica em um grafo de intenções e a geração de linguagem. Seu estudo com 17 estudantes mediu aderência à estratégia e interação, sem demonstrar aprendizagem independente. Essa separação é útil para implementação: um estado explícito controla a etapa, enquanto o modelo formula perguntas dentro dela. ([StratL](https://aclanthology.org/2025.findings-acl.1348.pdf))

**Escolha para o MVP:** o laboratório entre representações será o núcleo de interação. Progressão por critérios será uma política a calibrar. Productive failure será uma alternativa de desenho a avaliar com professor; ensinar um agente ficará como atividade opcional. A evidência de cada componente não valida a combinação inteira.

## O Porquê conecta uma construção visível a uma explicação

Uma sessão começa com uma tarefa falada: representar três quartos usando oito peças iguais. O estudante monta seis de oito tampinhas em uma região de uma folha de apoio e registra uma foto. O sistema destaca as peças reconhecidas na imagem e pergunta em voz: “Reconheci oito peças, com seis selecionadas. Confere?”. O estudante confirma ou corrige; imagem incompleta pede nova captura.

Em seguida, ele desenha a mesma relação e associa `6/8` a `3/4`. Uma pergunta falada pode explorar como agrupar as oito peças em quatro grupos iguais e por que três desses grupos representam seis peças. O estudante responde em voz e mostra uma nova montagem quando necessário; uma lousa 2D liga os agrupamentos reconhecidos ao desenho e à expressão. Se a justificativa for insuficiente, o sistema oferece outra representação ou uma explicação revisada. A observação de uma montagem correta não autoriza concluir que o conceito foi compreendido.

No encerramento, o estudante recebe outra apresentação da relação, com a assistência indisponível. Uma avaliação posterior usa um novo problema. Frações de uma coleção e de uma área precisam de tarefas explicitamente desenhadas para conectar as representações; o produto não deve presumir que essa passagem aconteça automaticamente.

| Requisito da GS | Função prática proposta | Evidência demonstrável |
|---|---|---|
| Visão computacional | Localizar a folha, reconhecer peças ou regiões marcadas e sua organização num cenário delimitado | Imagem anotada, leitura confirmável e comportamento com foto ruim |
| Inteligência artificial | Selecionar uma pergunta ou apoio entre atividades revisadas, confrontando a explicação com uma rubrica | Intervenção vinculada à produção observada, com opção de inconclusivo |
| Análise de dados | Acompanhar critérios, erros observados, ajuda e desempenho independente; orientar a próxima atividade | Histórico que distingue suspeita, confirmação e avaliação ainda pendente |
| Cloud | Persistir sessões, conteúdo e rubricas versionados; coordenar processamento e reavaliação | Retomada em outra sessão e trilha entre imagem, intervenção e resultado |

Para a primeira demo, usar uma folha plana com regiões conhecidas e materiais simples. Leitura irrestrita de qualquer caderno exige outra validação. Cálculos de equivalência podem ser verificados deterministicamente; a avaliação da explicação precisa de rubrica e revisão, sem depender exclusivamente do modelo que conduziu a conversa.

**Câmera e voz seriam a primeira interface a construir.** O aluno toca em “pronto” para registrar a montagem; a aplicação processa a foto, pede confirmação e usa a explicação falada para escolher a próxima pergunta. A cadeia proposta separa captura de áudio, transcrição, leitura visual, decisão pedagógica e síntese de fala. O estado da atividade precisa ligar a fala à fotografia correta.

O SDK React do ElevenLabs oferece sessões de voz, ferramentas executadas pelo aplicativo e atualização textual de contexto. Isso permite propor um backend de visão que devolve fatos confirmados à conversa; a integração precisa de teste próprio, e atualizar contexto não dispara fala por si só. A documentação também prevê imagens e PDFs em chat, nos canais e modelos compatíveis. Essa capacidade não comprova leitura de vídeo contínuo nem o funcionamento de anexos numa sessão de voz específica. ([ElevenLabs React](https://elevenlabs.io/docs/eleven-agents/libraries/react), [entrada multimodal](https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input))

Anotações sobre a foto e lousa 2D podem tornar a explicação visível; isso é uma sobreposição 2D. Minha avaliação de engenharia é deixar **AR para uma atividade com necessidade espacial real, como geometria 3D**, e VR para expansão posterior. O ciclo WebXR inclui checagem de dispositivo e navegador, sessão, entradas e renderização, além do trabalho pedagógico. Até 19/11, esses requisitos competem com o teste do núcleo. Voz, animação e imersão são interfaces; seu efeito sobre interesse e aprendizagem precisa ser medido. Manter texto e controles de pausa como alternativas à fala. ([MDN, ciclo WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Lifecycle))

A comparação competitiva limita a tese de novidade. Photomath já captura problemas e explica passos; Khanmigo se apresenta como tutor que guia sem entregar diretamente respostas; TeachYou já permite ensinar um agente com concepções erradas prescritas. Essas são funções documentadas pelos próprios produtos, sem auditoria independente de sua execução. A hipótese de diferenciação do Porquê está no fluxo completo de prática física observável, correspondência entre representações e avaliação da autonomia. Não foi demonstrado que essa combinação seja inédita. ([Photomath](https://photomath.com/), [Khanmigo](https://www.khanmigo.ai/learners), [TeachYou](https://teachyou.kixlab.org/))

Duas alternativas: **Oficina de tentativas** reuniria abordagens próprias antes da instrução e consolidaria o conceito; tem melhor apoio específico para transferência na coleta, mas exige elaboração pedagógica cuidadosa. **Caderno em evolução** acompanharia versões de uma resolução, intervindo no primeiro desvio verificável; oferece maior dificuldade de leitura e alinhamento. Eu começaria pelo laboratório delimitado, pela clareza visual e pelo escopo técnico.

Da Outis, vale transferir métodos: evidência rastreável, estados explícitos, confirmação de incerteza, revisão semântica e métricas com cobertura. Conteúdo matemático, rubricas e reconhecimento visual são trabalho novo. Não há necessidade de compartilhar marca, clientes ou operação. O aluno pode recortar nomes da foto; o sistema deve reter o mínimo necessário e oferecer confirmação manual, texto e áudio como alternativas. Essas são funções de projeto ainda a implementar, não características já testadas.

## A avaliação precisa distinguir ferramenta confiável de aluno autônomo

O primeiro teste é técnico: construir um conjunto de imagens próprias, com gabarito, incluindo montagens corretas, erros conhecidos e capturas difíceis. Conferir contagem, agrupamento, recusa adequada e se o feedback corresponde à imagem. Separar erro de visão, erro matemático e intervenção inadequada evita atribuir ao aluno uma falha do sistema.

O segundo teste é um piloto com poucos participantes do público escolhido: observar compreensão, correções de imagem, ajuda e abandono; aplicar tarefa inicial, outra nova sem IA e uma posterior. Testar com colegas universitários mantém a adequação a EJA em aberto.

| Indicador | O que informa | Limite da interpretação |
|---|---|---|
| Extração correta e leituras incertas | Confiabilidade da observação visual | Não mede aprendizagem |
| Justificativa por critério de rubrica | Relação explicitada entre representações | Exige gabarito e revisão pedagógica |
| Problema novo sem auxílio | Desempenho independente e transferência próxima | Alterar só números pode medir repetição |
| Nova avaliação após alguns dias | Retenção de curto prazo | Não comprova efeito semestral |
| Ajuda, tempo e abandono | Custo da interação para o estudante | Devem acompanhar acerto, sem virar substitutos dele |

**Hipótese falsificável:** com conteúdo, tempo e feedback semelhantes, a oficina visual melhora a justificativa e aplicação em outra representação sem auxílio, comparada a uma sequência convencional dos mesmos exemplos. Uma comparação futura deve considerar nível inicial, tarefas equivalentes e correção sem identificação da condição. Mesmo assim, ela testa o pacote; não identifica isoladamente o efeito da câmera ou da IA.

Até a entrega, o piloto terá função de testar viabilidade e localizar falhas. Metas iniciais escolhidas são processuais: nenhuma leitura incerta apresentada como confirmada, feedback ligado a evidência e registro separado do teste independente. Percentuais de melhoria e metas quantitativas devem ser definidos após um baseline. **Não há resultado próprio medido, participante recrutado ou parceria confirmada nesta pesquisa.**

## Reserve os últimos dias para demonstrar e entregar

Em **6–7/11**, escolher público, ouvir participantes e revisar uma atividade com educador. Em **8–9/11**, construir o fluxo, testar imagens e iniciar piloto se houver condições. Em **10–15/11**, corrigir problemas e concluir testes imediatos. Retorno em **16/11** permite sete dias para quem iniciou em 9/11; declarar o intervalo realmente observado. Em **17/11**, gravar; em **18/11**, revisar, publicar no YouTube como não listado e conferir o link. Entregar o `.txt` ou `.zip` na FIAP ON até **19/11**. O calendário é proposto; esforço e custo não foram medidos.

Para o vídeo de até cinco minutos, reservar aproximadamente 35 segundos ao problema, 20 ao público, 95 à demonstração e ao valor, 35 ao diferencial, 85 aos indicadores e validação e 25 aos ODS e continuidade. Isso deixa margem de cinco segundos. Resultados e impacto valem oito dos vinte pontos: mostrar o que foi testado, seus limites e o próximo experimento tem mais valor que ocupar esse tempo com uma lista de modelos. Se não houver usuários, apresentar a demo técnica e o protocolo como tais.

A adoção candidata é uma parceria com EJA, escola ou extensão universitária, usando dispositivo próprio ou compartilhado e acompanhamento inicial. A sustentabilidade pode vir de manutenção financiada pela instituição, preservando acesso gratuito ao estudante. Essas hipóteses exigem validar interesse, operação e custo por sessão; não há contrato ou integração pública presumidos.

Para numeramento de jovens e adultos, **ODS 4.6** é o vínculo principal. A meta 4.5 cabe se o projeto trabalhar uma barreira concreta de acesso e avaliar quem consegue usar a ferramenta. ODS 10.2 é complementar para inclusão. O piloto pode medir acesso e competência no seu público; não mede cumprimento das metas globais nem redução de desigualdade de renda. ([ONU, ODS 4](https://sdgs.un.org/goals/goal4), [ONU, ODS 10](https://sdgs.un.org/goals/goal10))

A decisão seguinte é verificar uma atividade com pessoas reais antes de ampliar currículo ou interface. Se elas compreenderem melhor a relação matemática e conseguirem demonstrá-la em outra situação, haverá um motivo para continuar. Se o valor ficar restrito à conversa ou à aparência da demonstração, o desenho pedagógico precisa mudar antes da expansão.

## Registro compacto das evidências e limites

Todas as fontes abaixo foram consultadas em **05/11/2026**. As afirmações numéricas usadas no texto foram confrontadas com passagens dos artefatos primários coletados. A coluna de alcance distingue apoio ao fato observado de generalização ao produto.

| Fonte e afirmação aceita | Localizador preservado | Alcance |
|---|---|---|
| Inaf: recorte por escolaridade | `agrogest-app/docs/arquivo/pesquisas/Outis para tecnologia cidadã/fontes-acesso/inaf-page/page.md`, “Alfabetismo e escolaridade” | Contexto aceito; idade/amostra não verificadas |
| Sinha e Kapur: comparação de ordens de instrução | `agrogest-app/docs/arquivo/pesquisas/Educação cidadã com agentes/fontes-metodos/edu-full-2.json`, Results/Pooled Effect Size Estimates | Síntese aceita; aplicação com IA não testada |
| Ebner et al.: CRA em casos únicos | `agrogest-app/docs/arquivo/pesquisas/Matemática cidadã com agentes/evidencias-metodos/math-discovery-1.json`, Methods/Discussion | Evidência limitada por desenho e população |
| EEF: distinções e segurança da síntese | `evidencias-metodos/math-evidence-3.json`, página Mastery learning; paths relativos à pasta de matemática | Síntese consultada, atualização de 2021 |
| Mathematics Mastery: avaliação do pacote | `evidencias-metodos/math-details-5.json`, relatório, pp. 17/21/22 | Resultado aceito; componente não isolado |
| Liu/StudentBench: desfechos imediatos | `agrogest-app/docs/arquivo/pesquisas/Educação cidadã com agentes/fontes-tutoria/latest-read.json`, versões 6/2 | Resultados aceitos no contexto; retenção longa não medida |
| StratL: estratégia explícita | `agrogest-app/docs/arquivo/pesquisas/Educação cidadã com agentes/fontes-metodos/edu-methods-3.json`, §§4–5 | Precedente de engenharia, sem teste independente de aprendizagem |
| Produtos: funcionalidades anunciadas | `agrogest-app/docs/arquivo/pesquisas/Educação cidadã com agentes/evidencias-competidores/`, páginas dos três produtos | Fonte própria; comparação não exaustiva |
| ONU: metas selecionadas | Mesma pasta, snapshots `625b9dcc-1282-4da8-9cb0-7adae52566a2` e `80c478f4-58b4-4829-bc9a-31b0d5ad9b0e` | Texto oficial aceito; contribuição do produto é proposta |
| ElevenLabs/WebXR: capacidades documentadas | `agrogest-app/docs/arquivo/pesquisas/Matemática cidadã com agentes/fontes-voz/`, snapshots React, multimodal e MDN | Contratos consultados; integração e ganho pedagógico não testados |

A rota pública usou Scrapinho MCP; a rota acadêmica usou a ferramenta web do host após ausência verificada do índice Firecrawl e do Scholar configurado. Houve páginas bloqueadas, sem contorno. PISA não entrou na fundamentação: sua fonte não pôde ser lida e nenhum resultado de snippet foi aceito, inclusive a identificação da edição mais recente. Alguns artigos recentes de frações/visualização ficaram fora pela mesma limitação. Não há cobertura exaustiva, auditoria de dados originais ou demonstração de que esta seja a abordagem mais eficaz disponível.

Os arquivos preservam texto normalizado, respostas e localizadores; não são exportações integrais dos bytes de todos os artigos, e não houve verificação de hash bruto. Custo total em créditos permanece desconhecido. Artefatos e notas registram as tentativas e seus limites. Nenhuma plataforma, modelo, integração ou aprendizagem de usuário foi implementada ou validada por esta pesquisa.
