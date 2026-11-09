# Métodos pedagógicos para agentes e evidência visual

Consulta em 05/11/2026. Pergunta: qual mecanismo de aprendizagem permitiria um projeto CitizenTech educacional distinto de trilhas, XP e tutor que responde fotos, com um protótipo testável até 19/11? Critério: participação cognitiva observável e competência demonstrada numa tarefa nova sem auxílio. Falsificador: o agente aumenta interação e sensação de aprender, mas não melhora a execução independente ou aumenta erros e dependência. Risco material. Isto é uma pesquisa focada, não revisão sistemática.

## Que evidência sustenta os mecanismos e quais são seus limites?

### Takeaway

Há evidência pedagógica mais madura para resolver antes da instrução e precedentes técnicos úteis para controlar agentes. Os estudos recentes de agentes ensináveis aqui inspecionados não demonstram de modo robusto retenção e transferência independente para o público brasileiro. Nenhum deles valida a combinação proposta com fotos de caderno.

### Cited Findings

- **Sinha e Kapur, 2021, publicado, Review of Educational Research.** Meta-análise de 53 estudos e 166 comparações entre resolver problemas antes da instrução e a ordem inversa. Para conhecimento conceitual/transferência, Hedges g=0,36, IC95% [0,20;0,51]; para conhecimento procedural, g=−0,03, IC95% [−0,20;0,15]. Abrange experimentos e quase-experimentos, sobretudo matemática/física, alunos do ensino básico e universitários; não é estudo com LLM. A busca original vai até 2019. Serve como fundamento anterior, não evidência de que um novo agente funcionará. [Artigo completo](https://journals.sagepub.com/doi/10.3102/00346543211019105), seções Method, Results e Discussion.
- **Jin, Lee, Shin e Kim, 2024, publicado, CHI: TeachYou/AlgoBo.** Corpo do manuscrito de autores lido. No estudo principal, 40 participantes com conhecimentos básicos de Python foram randomizados entre agente com estado de conhecimento e a versão com perguntas de elaboração e apoio metacognitivo. A densidade de mensagens de construção de conhecimento passou de 3,5% para 8,4% (p=0,03; d=0,71). Os autores explicitam que não fizeram comparação pré/pós de aprendizagem: diálogo e autorrelato são medidas indiretas. Sem retenção ou transferência testadas. Contribuição técnica: estado simulado de conhecimento, ciclo de reflexão/resposta e gestão da interação. [Manuscrito CHI2024](https://arxiv.org/html/2309.14534v3), seções 5, 6.3, 6.4 e 8; DOI 10.1145/3613904.3642349.
- **Ma, Shen, Koedinger e Wu, HypoCompass, manuscrito arXiv v3 de 2024.** Aprendiz pratica formular e testar hipóteses sobre erros em código; agentes simulam alunos e tarefas adjacentes são delegadas. Estudo pré/pós com 19 estudantes universitários de quatro instituições dos EUA, sem controle paralelo no experimento principal. Os autores relatam melhora imediata de 11,7% no escore (p=0,033) e redução de 13,6% no tempo (p=0,003). Os testes usam bugs diferentes, mas a intervenção reutiliza enunciados conhecidos. Não há retenção tardia no procedimento consultado. Não converter a melhora em efeito causal; a condição de não uso externo de IA no pós-teste não foi claramente estabelecida nesta leitura. [Corpo v3](https://arxiv.org/html/2310.05292v3), seções 3, 4 e 6. O registro aponta v5 posterior, não lida; não se assume equivalência entre versões.
- **Puech, Macina, Chatain, Sachan e Kapur, 2025, publicado, Findings ACL: StratL.** Grafo explícito de intenções orienta o comportamento pedagógico, separado da geração de linguagem. Estudo com 17 alunos do 9º ano de uma escola de Singapura, alocados aleatoriamente a versão de tutor e exercício; 15 minutos de interação. Mediu fidelidade à estratégia, diversidade de tentativas e percepção, sem pós-teste independente de aprendizagem. No problema de invenção, 2,6 representações/métodos por sessão com StratL versus dificuldade do baseline de elicitar múltiplas tentativas (p=0,05). Não interpretar fidelidade como eficácia educacional. [Artigo completo](https://aclanthology.org/2025.findings-acl.1348.pdf), seções 4.4, 4.6 e 5.2; DOI 10.18653/v1/2025.findings-acl.1348.
- **Wang et al., 2026, L@S, Explique/Algorithm Apprentice: precedente recente com leitura limitada.** Registro institucional informa 546 alunos, 11 semanas e 3.809 diálogos. O próprio resumo reconhece que a comparação com leitura tem forte diferença de tempo na tarefa. O PDF retornou 429 e não foi repetido; só metadados/resumo foram lidos. Portanto, nenhum detalhe adicional de método ou efeito é aceito aqui. [Registro EPFL](https://infoscience.epfl.ch/entities/publication/6897cea7-3c3b-4e4b-b084-a76c533c9d05), DOI 10.1145/3774398.3811623.

### Inferences

- A literatura já inclui aprender ensinando LLM e implantação em curso real; não alegar invenção dessa ideia.
- A inovação de produto possível está num recorte de público, conteúdo, interação física e avaliação verificável. Eficácia da combinação continua em aberto.
- É útil separar três avaliações: extração correta do registro visual; aderência do agente à estratégia; aprendizagem independente do humano. Sucesso nas duas primeiras não implica a terceira.

### Gaps

- Contraponto adicional: Chen et al., arXiv2024, N41, apresenta resultados mistos, incluindo ausência de diferença significativa em correção do código. O manuscrito consultado não declara randomização; não o chamar RCT. [Corpo](https://arxiv.org/html/2412.15226v1), seções 3.1 e 4.2. Uma publicação BJET2026 foi descoberta, mas não aberta.
- O estudo musical Chat Melody, workshop CHI2025, termina com N28 e quatro desistências no controle; descreve uso do agente na atividade de análise que compõe o pós-teste. Não é evidência limpa de execução independente. [Corpo](https://arxiv.org/html/2504.00636v1), seção 4.1.
- Não foi encontrada nesta coleta uma comparação causal forte que isole ensinar um agente versus autoexplicar com igual tempo/feedback e meça retenção sem IA. Ausência nesta busca não prova ausência na literatura.

## Quais dois mecanismos podem originar um produto diferente de um tutor com foto?

### Takeaway

Recomendação: escolher **ensinar e refutar um colega virtual com erro controlado** como núcleo do primeiro protótipo. **Explorar primeiro e consolidar depois** é uma alternativa coerente e de base pedagógica mais madura, mas não deve ser empilhada no MVP como se acrescentar métodos garantisse resultado.

### Cited Findings

- TeachYou fornece precedente de conhecimento simulado e perguntas de elaboração; HypoCompass fornece precedente de prática de uma subcompetência claramente definida. [TeachYou](https://arxiv.org/html/2309.14534v3); [HypoCompass](https://arxiv.org/html/2310.05292v3).
- StratL demonstra como representar intenção pedagógica num grafo explícito; a meta-análise de Sinha e Kapur sustenta a importância da ordem entre exploração e instrução em condições específicas. [StratL](https://aclanthology.org/2025.findings-acl.1348.pdf); [Meta-análise](https://journals.sagepub.com/doi/10.3102/00346543211019105).

### Inferences

**Mecanismo A — oficina de explicação, refutação e contraexemplo.**

- O aluno recebe uma situação concreta e um colega virtual que comete um erro conceitual específico, definido e revisado de antemão. Sua missão é demonstrar por que a ideia falha e construir uma explicação que passe por exemplos diferentes. Não basta fornecer a resposta correta.
- Exemplo de escopo: relação entre comprimento e área. O colega virtual diz que dobrar os dois lados de um retângulo dobra sua área. O aluno monta ou desenha exemplos com quadrados de papel, fotografa, conta, argumenta e generaliza. É uma proposta de atividade, não um currículo validado nesta pesquisa.
- A câmera observa desenho, arranjo e marcas. A extração mostra ao aluno o que foi reconhecido e pede correção. O sistema não lê pensamento nem determina uma concepção errada a partir de uma única foto. Na primeira versão, uma pequena família de atividades com imagens simples é mais crível que qualquer matéria de qualquer caderno.
- O agente tem estado de conhecimento explícito e só muda a concepção simulada quando a explicação satisfaz critérios revisados, incluindo um contraexemplo. Um verificador separado consulta rubrica, exemplos e cálculos; incerteza leva a revisão. Não confiar ao próprio personagem a decisão única de que aprendeu.
- O produto é uma oficina de treino com evidências e avaliação, utilizável em uma aula ou centro comunitário. A interface pode ser mínima. Uma animação ou conversa fluente não é a contribuição pedagógica central.
- Reaproveitamento metodológico da Outis: estado e responsabilidades separados, registro de evidência, revisão, correção e avaliação. Isso não exige compartilhar marca, clientes ou operação com Outis.
- Principal risco: o aluno aprende a satisfazer o agente sem compreender, ou a falha simulada é artificial e distrai. Medir explicação e resposta numa tarefa nova fora da conversa.

**Mecanismo B — oficina de tentativas e comparação antes da instrução.**

- O aluno enfrenta um problema deliberadamente desenhado para admitir representações e soluções diferentes, registra a tentativa no papel e explora uma segunda abordagem. Só depois compara limitações e recebe consolidação correta construída sobre suas tentativas.
- A visão computacional organiza registros observáveis da tentativa e suas revisões; IA faz perguntas para tornar a hipótese explícita. Análise de dados acompanha formas de representação, erros observados e sucesso independente. Cloud mantém sequência e versões para aluno/professor.
- Diferencial possível: valorizar e reaproveitar a tentativa própria na instrução posterior, em vez de classificar a foto como certa/errada e entregar uma solução. Continua sendo hipótese de produto.
- Risco: problemas ou sequência mal desenhados viram frustração e prática de erro. Productive failure não é sinônimo de errar, de reter a resposta por um tempo ou de o chatbot errar. Precisa de geração e consolidação; mediação especializada é parte do desenho.
- Esta opção tem mais apoio pedagógico geral e menos evidência direta para automatizar a sequência com LLM. Requer colaboração de professor para conteúdo e comparações.

### Gaps

- **Combinação A+B:** é plausível se a tentativa inicial revela uma representação própria, ensinar o agente exige refutação/explicação distinta e a consolidação resolve as lacunas. Também pode ser redundante, demorada e aumentar carga cognitiva. Nenhum paper lido testa a combinação com foto de caderno.
- Uma tentativa inicial curta pode ser só diagnóstico, sem chamar a intervenção de productive failure. Para o MVP, manter A como mecanismo e usar o diagnóstico para selecionar o erro e a atividade.
- O público de maior impacto ainda precisa ser escolhido com acesso a usuários reais: EJA, reforço escolar ou formação de professores são hipóteses diferentes. Estudos universitários de programação não se transferem automaticamente a adultos de EJA, crianças ou matemática básica.

## Como tornar a hipótese falsificável até 19/11?

### Takeaway

A demonstração mais honesta mostra um ciclo completo e um teste novo sem agente. Em duas semanas dá para testar execução técnica, usabilidade e recolher um sinal inicial de aprendizagem; uma amostra pequena não sustenta eficácia populacional.

### Cited Findings

- A falta de testes diretos em TeachYou e o foco de StratL em proxies mostram por que participação, fidelidade e satisfação precisam ser separados de ganho de aprendizagem. [TeachYou, seção 8](https://arxiv.org/html/2309.14534v3); [StratL, seção 4.4](https://aclanthology.org/2025.findings-acl.1348.pdf).

### Inferences

- Hipótese proposta: com tempo, conteúdo e feedback comparáveis, explicar e refutar um erro específico do colega virtual produz melhor justificativa e aplicação a um caso novo sem assistência que uma atividade de autoexplicação dos mesmos exemplos. Retenção posterior é um segundo desfecho, não consequência presumida.
- Comparação viável: dois pequenos grupos ou ordem contrabalanceada entre dois conceitos comparáveis. Um usa o colega virtual; outro recebe as mesmas tarefas/rubrica e escreve uma explicação sem o personagem. Registrar nível inicial e tempo real. Não misturar várias diferenças de instrução e depois atribuir o efeito ao agente.
- Avaliação: tarefa inicial; treino; problema diferente sem IA imediatamente; novo problema alguns dias depois, sem IA. Corrigir por rubrica, idealmente sem o avaliador saber a condição. Para alegar transferência, alterar a representação ou contexto, não apenas os números.
- Critérios observáveis: identificar a afirmação errada, produzir contraexemplo, explicar a relação correta e aplicá-la a novo problema. Contabilizar respostas inconclusivas, ajuda necessária, abandono e mudanças de erro, além do escore.
- Proposta de demonstração de 60–90 segundos: erro do personagem -> montagem/desenho -> foto e correção da extração -> explicação do aluno -> teste do personagem em outro caso -> tarefa nova do aluno com o agente indisponível. O histórico liga evidência visual, ação pedagógica e avaliação.
- Quatro requisitos práticos: visão extrai a representação observada; IA mantém a interação e verifica argumentação contra rubrica; análise de dados mede erros por critério e desempenho sem ajuda; cloud persiste versões e resultados. São funcionalidades propostas, não implementadas.
- Plano curto: selecionar um conceito e criar rubrica no início; obter rapidamente fotos e testar o núcleo; pilotar cedo o suficiente para repetir uma avaliação depois de alguns dias; reservar tempo para o vídeo. Se não houver participantes, apresentar o protocolo e uma demo técnica, identificando explicitamente a ausência de validação de aprendizagem.
- Abandonar ou mudar o desenho se o fluxo exige muita correção de imagem, o agente aceita justificativas erradas, os usuários só tentam adivinhar a resposta esperada, ou a melhora aparece apenas enquanto recebem ajuda.

### Gaps

- Índice acadêmico Firecrawl MCP/CLI e ScrapingDog Scholar estavam ausentes, verificados pelo coordenador. Foi usada a rota acadêmica `tools.web__run` com páginas de periódicos, autores e repositórios oficiais. Isso não é fallback para IBGE/Wheelmap recusados na pesquisa anterior; não foram reabertos.
- Respostas de leitura e localizadores: `fontes-metodos/edu-find-1.json`, `edu-full-2.json`, `edu-methods-3.json` e `source-locators.json`. São extratos da ferramenta e notas, não exportações de bytes completos dos artigos. Nenhuma verificação de hash bruto foi alegada.
- O DOI da ACM retornou 403; não foi repetido. O manuscrito público dos autores no arXiv foi descoberto por busca acadêmica. EPFL PDF retornou 429, sem retry. A tentativa inicial de localizar StratL por ID de ACL abriu por engano um artigo de outro tema; foi excluído e o título correto foi encontrado por busca. Não há suporte extraído dessa página errada.
- Custos de créditos não foram informados pela ferramenta, portanto não há total medido. Nenhum usuário foi entrevistado ou testado por este pesquisador; não existe resultado experimental próprio.
- Não foi realizada revisão independente deste parecer pelo coletor. A escolha de conteúdo e qualquer ensaio com alunos precisam de revisão pedagógica e consentimento apropriado; isso é requisito de qualidade da proposta, não alegação de validação já feita.
