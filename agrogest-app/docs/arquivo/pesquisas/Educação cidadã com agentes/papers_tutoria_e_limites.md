# Tutoria com IA e aprendizagem independente

## O que os ensaios realmente mostram?

### Takeaway
A evidência não sustenta nem “IA ensina sempre melhor” nem “IA destrói a aprendizagem”. O desenho do auxílio e o desfecho importam: acertar com ajuda, acertar logo depois sem ajuda e reter/transferir dias ou meses depois são medidas diferentes. Oportunidade: observar o trabalho do aluno, intervir no erro específico e testar o que ele consegue fazer sozinho.

### Cited Findings
Consulta em 05/11/2026. Quatro estudos com passagens de métodos/resultados/limites lidas; um estudo adicional com suporte institucional primário, mas corpo final inacessível nesta rodada.

| Estudo e versão verificada | População, desenho e duração | Resultado útil | Limite que muda a interpretação |
|---|---|---|---|
| Bastani et al., PNAS 2025, *Generative AI without guardrails can harm learning*; PDF público dos autores | Quase mil alunos do ensino médio de uma escola na Turquia, turmas de 9º–11º anos; três braços: GPT Base, GPT Tutor com soluções/erros típicos preparados por professores e controle sem IA; quatro sessões de 90 min em 2023–24 | Prática assistida: +48% e +127% relativos ao controle. Prova sem recursos: GPT Base −17% relativo (−0,054 em escala 0–1); GPT Tutor foi estatisticamente indistinguível do controle | Guardrails eliminaram a maior parte do prejuízo, mas NÃO demonstraram ganho positivo na prova independente; sem retenção longitudinal. Não são pontos percentuais. [PDF autores](https://hamsabastani.github.io/education_llm.pdf), pp. 3–10, §§2–3; [DOI](https://doi.org/10.1073/pnas.2422633122). |
| Liu et al., COLM 2026, *AI Assistance Reduces Persistence and Hurts Independent Performance*; arXiv v6 de 13/10/2026 | Três RCTs online com adultos dos EUA/Prolific; 1.222 recrutados (354/667/201), 1.060 analisados após exclusões (307/585/168); frações e compreensão textual; 10–15 min, IA removida na etapa final | Replicação maior: acerto sem IA 0,71 contra 0,77, p=.019, d=−0,20. Abandono 0,10 contra 0,07, p=.239: diferença agregada NÃO significativa. Nos experimentos 1/3 houve piora de acerto e abandono | Não é estudo escolar ou de retenção longa. A associação entre pedir respostas prontas e pior resultado vem de subgrupos por autorrelato; não isola causalmente essa estratégia. [Texto v6](https://arxiv.org/html/2604.04721v6), §§2–4; [COLM](https://proceedings.colm.cc/paper_files/paper/2026/hash/c2166d01fe4bcd694aba89f608737678-Abstract-Conference.html). |
| Wang et al., *Tutor CoPilot: A Human-AI Approach for Scaling Real-Time Expertise*, iniciado em 2024, arXiv v3 de 10/10/2026 | 900 tutores inicialmente randomizados; 783 efetivamente atenderam; análise de 1.013 alunos de nove escolas de um distrito dos EUA; IA auxilia o TUTOR humano; sete semanas, 27/03–17/05/2024 | +4 p.p. de aprovação em teste de saída da sessão; média controle 0,617. Até +9 p.p. com tutores inicialmente de menor avaliação | Alunos podiam trocar de tutor tratado/controle; desenho não identifica efeito causal anual no MAP. A extrapolação 0,024 DP no apêndice é cálculo hipotético, não resultado medido. Não usar contagem antiga de 1.800 alunos. [Texto v3](https://arxiv.org/html/2410.03017v3), Methods, Table1, AppendixB. |
| Northcutt et al., *StudentBench: AI and human tutoring yield equivalent GRE learning gains*, preprint v2 de 30/09/2026 | 2.383 adultos, 2.469 sessões, sobretudo 18–24 anos, inglês, recrutamento pago; pré-teste, uma hora de tutor IA/humano ou vídeos educacionais não relacionados ao GRE, pós-teste com outras questões | IA agrupada: +6,15 p.p. frente ao controle. IA−humano −0,58 p.p., IC90% [−2,18;1,03]; equivalência segundo margem ±0,25 DP, p=.015 | Resultado imediato, sem retenção por meses, sem braço de prática GRE individual; equivalência não comprovada no verbal isolado e sensível à especificação. Financiado pela Handshake AI. [Texto v2](https://arxiv.org/html/2609.28470v2), §§2–3/9 e AppendixB.2–B.3. |
| Kestin et al., *AI tutoring outperforms in-class active learning*, Scientific Reports 2025, DOI verificado; leitura limitada ao relato institucional de 2024 | 194 universitários em física introdutória de Harvard; duas aulas em semanas consecutivas, crossover tutor IA em casa vs aula ativa presencial, estudo no outono de 2023 | Relato dos pesquisadores informa ganhos imediatos aproximadamente dobrados; pré/pós-teste e tutor com conteúdo e suporte pedagógico preparados | Não usar esse relato como prova de retenção longa, população brasileira ou substituição de professor. Corpo final retornou redirecionamento inacessível; preprint ResearchSquare 403. Efeito padronizado final não auditado aqui. [Harvard](https://news.harvard.edu/gazette/story/2024/09/professor-tailored-ai-tutor-to-physics-course-engagement-doubled/), parágrafos de desenho/resultado; [DOI final](https://doi.org/10.1038/s41598-025-97652-6). |

### Inferences
- O contraste mais útil para o pitch está entre **desempenho assistido** e **competência demonstrada sem IA**. É razoável projetar a IA para levar o aluno à segunda medida; ainda precisamos comprovar que nossa intervenção faz isso.
- Um tutor com mais agentes ou modelo mais recente não herda os resultados desses estudos. Eles testaram conteúdos, pessoas, intervenções e controles específicos.
- Há evidência favorável a auxílio estruturado e a capacitar tutores humanos. Não há, neste conjunto, demonstração de que uma nova plataforma multimodal brasileira produza retenção duradoura.
- O resultado “equivalente” do StudentBench depende de uma margem estatística explícita e de uma comparação específica; não significa que quaisquer IAs e professores tenham desempenho idêntico em todos os conteúdos.

### Gaps
- Não foi feita revisão sistemática, meta-análise ou busca exaustiva até 2026. Não foram auditados dados ou reproduzidos modelos estatísticos.
- Não há demonstração causal destas implementações em brasileiros, ensino em português, alunos sem conectividade ou currículo BNCC.
- Não confundir versão arXiv, publicação em evento/periódico e dados coletados: um paper de 2026 pode testar intervenção de 2024.
- O estudo nigeriano do Banco Mundial foi localizado, mas não entrou no núcleo comparativo: seu corpo e amostra não foram completamente verificados nesta rodada. Pista primária: https://reproducibility.worldbank.org/index.php/catalog/419 .

## Qual método de produto isso sugere e como diferenciá-lo?

### Takeaway
Hipótese de conceito: **um treinador de raciocínio que observa a tentativa e retira o apoio progressivamente**, cujo sucesso é uma nova tarefa resolvida sem assistência. Caderno, desenhos ou manipulativos tornam a visão computacional parte da observação do raciocínio, em vez de mero atalho para entregar respostas.

### Cited Findings
- As intervenções e limitações que motivam a hipótese estão nas cinco referências acima. Nenhum dos estudos avaliou o produto aqui proposto.

### Inferences
- Ciclo proposto: desafio curto → tentativa observável do aluno → fotografia do rascunho/desenho → aluno confirma transcrição → diagnóstico do primeiro desvio verificável → menor pista útil → nova tentativa → problema equivalente sem IA → retorno após 48–72 horas.
- A confirmação da transcrição é parte necessária do fluxo: erro de OCR não deve virar diagnóstico de deficiência de aprendizagem.
- **Visão computacional:** segmentar a folha e etapas, ler notação/desenhos ou contar/relacionar manipulativos em cenário delimitado; apontar trecho visual correspondente a cada diagnóstico. Evitar prometer ler qualquer caligrafia ou inferir estado mental pela webcam.
- **IA:** escolher pergunta ou pista condicionada ao erro e conteúdo validado, sem substituir a tentativa; gerar explicações e problemas apenas com verificadores e revisão adequados ao recorte.
- **Análise de dados:** registrar competência alvo, evidência observada, tipo de erro, número/nível de pistas e acerto independente; separar suspeita, confirmação e domínio ainda não testado. Clique, XP e exercício concluído não comprovam aprendizagem.
- **Cloud:** guardar estado e histórico de intervenções, processar imagens em fila, versionar conteúdo e rubricas, agendar reavaliação. Minimizar conservação de imagem e identificadores, sobretudo se o público incluir menores.
- Diferenciação possível: atuação sobre o processo visível, apoio progressivamente menor e transferência avaliada. “Tutor que conversa”, “trilha personalizada” e “envie foto para resolver” são insuficientes como tese de inovação.
- O formato de aluno ensinar um agente que erra pode encaixar neste ciclo; sua eficácia específica deve vir do outro eixo de pesquisa sobre aprender ensinando. Não está comprovada pelos RCTs desta nota.

### Gaps
- O usuário ainda precisa escolher público, disciplina e situação real. Frações, matemática aplicada a compras e medidas ou letramento digital de adultos são recortes candidatos, não decisões tomadas.
- Modelos de competência e diagnósticos a partir de rascunhos precisam de avaliação própria e possibilidade de revisão humana.
- Não usar taxa de resposta correta do modelo como medida da aprendizagem do estudante.

## Como validar a hipótese sem confundir uma boa demo com educação eficaz?

### Takeaway
Uma demo funcional pode provar observação, intervenção e continuidade. A eficácia educacional exige um protocolo separado com tarefas equivalentes, avaliação sem ajuda e um pequeno retorno posterior.

### Cited Findings
- O núcleo comparativo mostra explicitamente por que os três tempos de avaliação devem ser separados. Os resultados externos permanecem limitados às populações e intervenções estudadas.

### Inferences
- Construir um pequeno corpus de tentativas com erros conhecidos, imagens ilegíveis e respostas corretas. Revisão humana separa erro de visão, erro de diagnóstico e pista pedagogicamente inadequada.
- Avaliar pré-teste → intervenção → pós-teste equivalente sem IA → transferência com apresentação/contexto diferente → reavaliação após 48–72h. Mesmo esse atraso curto não comprova retenção por meses.
- Se viável, comparar contra material equivalente com pistas estáticas ou tutor genérico, alternando ordem e reportando diferenças iniciais. Sem amostra e desenho adequados, resultados são piloto exploratório.
- Medidas: acerto independente, erro crítico de diagnóstico, retenção curta, transferência, quantidade de ajuda requerida, tempo e abandono. Relatar também casos de piora.
- Não manter aluno em frustração indefinidamente para maximizar esforço. Definir limites de dificuldade e opção de ajuda humana; escolher um conteúdo em que as respostas possam ser verificadas.
- CitizenTech: a tese social pode ser acesso a apoio pedagógico de qualidade para público com poucas alternativas. Público, acessibilidade e canal de uso devem ser validados antes de alegar redução de desigualdade.
- ODS4 e metas de habilidades, alfabetização/numeramento ou igualdade de acesso podem encaixar conforme o público; esta nota não verificou o texto oficial das metas e não faz atribuição definitiva.

### Gaps
- Não existem métricas do nosso sistema, participantes recrutados ou efeito demonstrado.
- Não foram verificados orçamento, custo de modelo, qualidade de OCR em português ou disponibilidade de um parceiro educacional.
- Não prometer aumento de nota, retenção ou queda de evasão apenas porque outro estudo encontrou um efeito.

