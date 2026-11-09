# Problema brasileiro para matemática cidadã

## Qual necessidade brasileira está sustentada por fonte primária?

### Takeaway
A evidência verificada nesta rodada sustenta investigar dificuldades de usar leitura e práticas matemáticas com autonomia entre brasileiros com escolaridade limitada. Ela não estabelece que exista um único método de ensino brasileiro, qual seria a causa das dificuldades ou que nossa proposta tenha demanda comprovada.

### Cited Findings
- O [panorama Inaf](https://alfabetismofuncional.org.br/alfabetismo-no-brasil), edição **2024**, informa que aproximadamente **oito em cada dez pessoas que cursaram somente os anos iniciais do Ensino Fundamental** permanecem na categoria de analfabetismo funcional. Entre as pessoas que cursaram os anos finais, a proporção informada é **43%**. A página enquadra os resultados em habilidades de leitura, escrita, uso de informação e práticas matemáticas. Fonte primária aberta e lida integralmente em 05/11/2026.
- O corpo dessa página não informa faixa etária ou tamanho amostral; metodologia e relatório não foram abertos. Portanto, esses atributos permanecem não verificados nesta coleta.
- Evidência integral preservada: [snapshot Inaf](/data/projects/hobby/gs-final-fiap/research_notes/Outis%20para%20tecnologia%20cidadã/fontes-acesso/inaf-page/page.md), acompanhado de source-pages.json e record.json no mesmo diretório. Aquisição completa, 6.853 caracteres, fetched_at 2026-11-05T19:59:59.397Z; SHA é somente o reportado pelo serviço, sem verificação de raw HTTP.

### Inferences
- Formulação defensável: **“Queremos ajudar pessoas que precisam recuperar fundamentos de matemática a entender e aplicar o raciocínio com autonomia, começando por um conteúdo e contexto delimitados.”**
- Público candidato mais diretamente alinhado a esta evidência: jovens/adultos com lacunas de fundamentos, inclusive quem retomou estudos. A seleção do público não está concluída.
- Se o público escolhido forem alunos atualmente matriculados no ensino básico, será necessária evidência desse grupo; a estatística acima não descreve diretamente crianças ou alunos atuais.
- A motivação pessoal do usuário pode ser sua experiência com o ensino; no pitch, separar essa motivação da afirmação científica de causa.

### Gaps
- **Não dizer “80% das crianças brasileiras não sabem matemática”.** O denominador é um grupo de escolaridade, e a medida é alfabetismo funcional, não uma prova isolada de matemática.
- Não tratar analfabetismo funcional como incapacidade absoluta nem como diagnóstico individual.
- Não há evidência nesta coleta de que memorização, abstração, formação docente ou um suposto método único causem os resultados nacionais.
- Nenhuma fonte leu ou mediu a necessidade dos futuros usuários do produto. Entrevistas e tarefas diagnósticas continuam necessárias.

## O que foi verificado sobre PISA e por que não usamos seus números?

### Takeaway
Nenhum número PISA passou o critério de leitura da fonte primária nesta rodada. **Não foi confirmado que 2022 seja a edição mais recente disponível em 05/11/2026**, e não se deve apresentá-la como tal.

### Cited Findings
- Não há conclusão factual PISA aceita: resultados de busca foram usados somente para descoberta e preservados como pistas.
- A tentativa de leitura da publicação OECD retornou forbidden / target_forbidden, sem source_id e sem texto. Esse evento está preservado em fontes-brasil/pisa-2025-volume1/record.json.

### Inferences
- As buscas encontraram uma nota oficial Brasil/PISA2022 e candidatos oficiais de resultados/lançamento PISA2025. Isso impede assumir automaticamente que PISA2022 seja o último, mas NÃO confirma por si só publicação, datas ou estatísticas.
- A decisão desta rodada é usar o Inaf já lido para a justificativa inicial e manter PISA como pendência, respeitando o limite da coleta.

### Gaps
- Candidatos **não lidos e não aceitos como evidência de número/data**:
  - [OECD, nota Brasil/PISA2022](https://www.oecd.org/en/publications/pisa-2022-results-volume-i-and-ii-country-notes_ed6fbcc5-en/brazil_61690648-en.html).
  - [OECD, publicação candidata PISA2025 VolumeI](https://www.oecd.org/en/publications/pisa-2025-results-volume-i_73451bc5-en.html).
  - [OECD, página do programa PISA](https://www.oecd.org/en/about/programmes/pisa.html).
- O percentual de 27% no nível2 de matemática surgiu em snippet da nota2022; não foi adotado como fato verificado.
- Não foi lida a amostra brasileira, a população coberta, o período de aplicação ou o contexto de níveis da avaliação.
- Não foram feitos novos pedidos ao alvo após o bloqueio; não se usou hostweb, navegador ou proxy para reabrir a publicação bloqueada. IBGE não foi revisitado.

## Que consequência isso traz para o projeto e a validação?

### Takeaway
A hipótese promissora é ensinar e medir raciocínio matemático independente, observando a tentativa. A demonstração precisa separar o que a IA resolve do que o estudante aprende.

### Cited Findings
- No RCT de matemática de Bastani et al., a assistência aumentou o desempenho de prática, mas a versão sem guardrails piorou a prova independente; a versão com guardrails mitigou o prejuízo sem mostrar ganho positivo nessa prova. É estudo na Turquia, não evidência do Brasil. [Manuscrito público dos autores](https://hamsabastani.github.io/education_llm.pdf), §§2–3.
- Em Liu et al., v6/COLM2026, a replicação maior com adultos dos EUA encontrou menor acerto sem IA depois de assistência; a diferença agregada de abandono não foi significativa. Não mede retenção por meses. [Texto primário](https://arxiv.org/html/2604.04721v6), §3.2.
- Detalhes de amostra, controle, valores e limites estão em [papers_tutoria_e_limites.md](/data/projects/hobby/gs-final-fiap/research_notes/Educação%20cidadã%20com%20agentes/papers_tutoria_e_limites.md). Esses resultados não demonstram eficácia de nossa plataforma.

### Inferences
- Ciclo de produto candidato: tentativa no papel ou com objetos → leitura visual confirmada → identificação de erro específico → intervenção curta → nova tentativa → tarefa equivalente sem ajuda → transferência/retorno depois de 48–72h.
- Registrar separadamente erro de leitura da imagem, diagnóstico matemático, pista oferecida e desempenho humano. O modelo acertar não significa o estudante aprender.
- Escolher primeiro uma habilidade, por exemplo equivalência de frações e proporções, vinculada a situações concretas, em vez de prometer todo o currículo.
- Indicador central: acerto e explicação numa tarefa nova sem IA. Retenção, transferência e ajuda necessária complementam o painel; XP e checklists não comprovam competência.
- Sem amostra e controle adequados, o estudo do protótipo será um piloto exploratório. Não afirmar correção do sistema de ensino brasileiro ou melhora populacional.
- A conexão CitizenTech deve explicitar o cidadão beneficiado, suas barreiras de acesso a apoio de qualidade e como consegue usar o produto.

### Gaps
- Conteúdo, faixa etária, contexto social e parceiro educacional ainda precisam ser escolhidos e validados.
- Não há baseline ou resultados do protótipo.
- Não há evidência causal de que uma técnica única escolhida resolverá a dificuldade nacional.

