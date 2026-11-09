# Cotidiano cidadão com imagem e evidências

Escopo revisto em 05/11/2026 por orientação explícita do usuário: Outis é um projeto separado; não propor pequenos negócios, renda de empreendedores, marketing ou uma extensão comercial da Outis. Pode-se reaproveitar método de pesquisa, revisão humana e acompanhamento de tarefas. Não alegar transferência de código ainda não inspecionado. O nome deste arquivo foi mantido para compatibilidade com a delegação inicial.

## Qual problema cotidiano tem evidência suficiente nesta coleta?

### Takeaway

O desperdício doméstico tem suporte primário aberto e lido, mas a pesquisa brasileira encontrada é histórica. A acessibilidade urbana é uma hipótese relevante para investigar com cidadãos, porém a principal página estatística e a página do concorrente foram bloqueadas; os snippets não bastam para fundamentar números nem diferenciais.

### Cited Findings

- A Embrapa publicou em 28/01/2019 uma notícia sobre pesquisa de desperdício de alimentos em famílias, conduzida em parceria com a FGV-EAESP. A notícia relata correlação negativa estatisticamente significativa entre propensão ao desperdício e duas atitudes: consciência socioambiental e percepção do impacto no orçamento familiar. Isso não demonstra que um aplicativo reduza desperdício nem permite generalizar uma estimativa atual em 2026. [Embrapa](https://www.embrapa.br/busca-de-noticias/-/noticia/40838625/embrapa-disponibiliza-dados-expandidos-de-pesquisa-sobre-desperdicio-de-alimentos-em-familias), acesso em 05/11/2026. Fonte completa: `fontes-renda/gs2-renda-embrapa-page-01/page.md`.
- O MAPA distingue perdas na produção, armazenamento, embalagem e transporte de desperdício nas etapas de varejo e consumo. A página inclui o consumidor entre os públicos das ações de enfrentamento e associa o problema a tecnologia e mudança comportamental. Os números globais apresentados nela referem-se a 2019 e não foram adotados como retrato de 2026. [MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sustentabilidade/perdas-e-desperdicio-de-alimentos), acesso em 05/11/2026. Fonte completa: `fontes-renda/gs2-renda-mapa-page-01/page.md`.

### Inferences

- Oportunidade doméstica: transformar a chegada da compra em inventário revisável e pequenas ações de planejamento é uma hipótese coerente com a importância atribuída à consciência de desperdício. Não há evidência coletada de que essa intervenção específica seja desejada ou eficaz.
- Oportunidade urbana: reduzir incerteza sobre barreiras num percurso cotidiano pode gerar autonomia, mas isso exige ouvir pessoas que usam cadeira de rodas ou têm mobilidade reduzida, compreender o que já usam e medir a confiabilidade das observações. Uma fotografia isolada não prova acessibilidade de um trajeto.

### Gaps

- Nenhuma entrevista com público-alvo foi realizada. Não há amostra local nem estimativa de adoção.
- A notícia da Embrapa apresenta um link para uma estimativa anual de desperdício, sem detalhar ali amostra e método. Não usar esse número como estatística brasileira atual nem como resultado próprio.
- A busca localizou a página IBGE Educa `https://educa.ibge.gov.br/jovens/materias-especiais/22746-censo-2022-revela-que-88-5-dos-moradores-moravam-em-vias-pavimentadas.html`, mas sua leitura retornou `forbidden / target_forbidden`; nenhum número do snippet foi aceito.
- A busca identificou a página oficial `https://wheelmap.org/en`, mas sua leitura também retornou `forbidden / target_forbidden`. Funcionalidades, cobertura e atualidade não foram verificadas em página aberta.

## Quais duas propostas distintas cabem na GS até 19/11?

### Takeaway

As duas ideias abaixo são hipóteses de produto, não tecnologias já implementadas. Despensa Viva é mais fácil de validar em um experimento doméstico pequeno. PassaAqui tem narrativa CitizenTech e papel visual mais fortes, mas depende de atualização comunitária, revisão especializada e extremo cuidado com promessas de circulação.

### Cited Findings

- A classificação de desperdício no consumo sustenta o recorte doméstico, em vez de um marketplace para comércios. [MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sustentabilidade/perdas-e-desperdicio-de-alimentos), acesso em 05/11/2026.
- A pesquisa histórica associa percepção do impacto doméstico e menor propensão ao desperdício; não é prova causal da solução proposta. [Embrapa](https://www.embrapa.br/busca-de-noticias/-/noticia/40838625/embrapa-disponibiliza-dados-expandidos-de-pesquisa-sobre-desperdicio-de-alimentos-em-familias), acesso em 05/11/2026.

### Inferences

**PassaAqui — evidências sobre barreiras num percurso curto.**

- Cidadão: pessoa com mobilidade reduzida que precisa percorrer o entorno de uma faculdade, posto de saúde ou ponto de ônibus. Começar por um único perfil e um único território; necessidades de usuários de cadeira de rodas, idosos e pessoas cegas não são intercambiáveis.
- Cena de uso: antes de sair, consultar fotos recentes de poucos segmentos conhecidos; ver um bloqueio observado e o que está sem observação; contribuir com nova foto e corrigir uma classificação.
- Visão computacional: propor marcações de obstáculos visíveis como degrau, buraco ou passagem bloqueada; associar cada sugestão à imagem e permitir resultado inconclusivo. Não medir largura, inclinação ou conformidade normativa por foto monocular.
- IA: reconciliar observações contraditórias, formular perguntas para confirmação e resumir o que se sabe e o que falta observar. Não inventar travessias, acessibilidade ou rota segura.
- Análise de dados: idade das observações, cobertura dos segmentos, taxa de divergência entre revisores e incidência de tipos de obstáculo. Priorizar o que precisa ser observado novamente, não classificar um bairro como seguro.
- Cloud: guardar observações com data, local, consentimento e revisão; sincronizar contribuições; permitir exclusão e expiração da informação. Fotos podem conter rostos, placas e localização pessoal; usar recortes, minimização e revisão antes de qualquer publicação.
- Demo proposta: um percurso curto com seis segmentos, um conjunto pequeno de fotos próprias autorizadas e dois momentos de observação. Mostrar imagem -> sugestão visual -> confirmação -> atualização do segmento -> painel de cobertura. O número de imagens é uma decisão de escopo, não um dado de pesquisa.
- Diferencial a testar: fluxo de evidência datada e revisão de mudanças em segmentos, em vez de apenas um pino com classificação de local. Não afirmar que concorrentes não fazem isso: a comparação competitiva está incompleta.
- Métricas de validação: precisão e cobertura por classe num conjunto separado do usado para configurar a demo; fração de casos inconclusivos; tempo para registrar; divergência de revisores; observações vencidas; capacidade de usuários entenderem os limites. Uma pequena amostra não estabelece segurança de circulação nem generalização urbana.
- Implementação/sustentabilidade: piloto com centro de acessibilidade ou instituição que já tenha pessoas responsáveis por validar e atualizar percursos. Patrocínio institucional é hipótese; nenhuma parceria, disposição a pagar ou integração pública foi validada.
- ODS propostos: 10 e 11, conforme o enunciado; vincular metas específicas apenas após consultar a redação oficial.
- Contra-argumento decisivo: o sistema pode informar barreiras, mas não remove obstáculos. Se não houver responsável por atualizar as observações, a informação pode ficar mais perigosa à medida que envelhece. Mapa nacional e navegação autônoma devem ficar fora do MVP.

**Despensa Viva — inventário doméstico a partir da compra, com revisão e ações de planejamento.**

- Cidadão: quem divide uma casa e faz compras, mas perde a visão do que já tem. Pode começar com a própria residência do aluno e depois poucas famílias que consintam em participar.
- Cena de uso: fotografar nota e etiqueta; confirmar item, quantidade e data realmente lidos; registrar consumo ou descarte; receber lista de compras compatível com estoque confirmado e lembretes de planejamento.
- Visão computacional: localizar e ler campos na nota e etiqueta, mantendo o recorte visual associado a cada valor; detectar baixa legibilidade e abster-se. A nota em geral não fornece validade: produto e data precisam ser associados com confirmação do usuário.
- IA: resolver nomes abreviados e duplicados em notas, fazer perguntas sobre campos ambíguos e sugerir uma ação de organização baseada em registros confirmados. Não julgar qualidade, deterioração ou segurança de alimento pela aparência. Não inferir validade a partir do tipo de produto.
- Análise de dados: itens registrados versus consumidos e descartados; massa de descarte somente se efetivamente pesada; compras repetidas já existentes no estoque; completude do diário. Não converter unidades em quilos nem ausência de registro em consumo presumido.
- Cloud: inventário compartilhado por residência, histórico, fila de revisão e lembretes. Notas podem conter CPF, endereço e dados de pagamento; permitir recorte/remoção e evitar guardar o comprovante integral sem necessidade.
- Demo proposta: fotografia real de uma nota com alguns itens e de duas etiquetas; revisão dos campos; atualização de um estoque compartilhado; registro de consumo e descarte; lista de compras e gráfico de dados de teste claramente identificados. Não montar gráficos fictícios como resultados do piloto.
- Diferencial a testar: qualidade do fluxo de revisão e esforço reduzido para uma família real, inclusive por áudio ou interface simples. OCR e lembretes por si só não sustentam novidade.
- Validação até 19/11: teste controlado de extração numa amostra de imagens, seguido de experimento doméstico curto. Medir erro por campo, tempo para corrigir, adesão ao registro e uso da lista; estabelecer um período de referência antes de afirmar redução de desperdício. Duas semanas permitem testar usabilidade e execução técnica; dificilmente um impacto causal robusto.
- Sustentabilidade: custo por residência ativa e por imagem; possibilidade de adoção por projetos de educação ambiental é hipótese. Não há operador ou financiador estabelecido nesta coleta.
- ODS propostos: consumo responsável e recursos; verificar a meta oficial 12.3 e explicar ao professor que a lista de ODS do enunciado é apresentada como especialmente relevantes, sem supor exclusividade.
- Contra-argumento decisivo: manter o inventário atualizado pode custar mais esforço do que o benefício percebido. Se o teste não mostrar uso continuado com poucos registros, os quatro tópicos técnicos estarão presentes sem uma solução útil.

### Gaps

- Não se definiu qual problema interessa pessoalmente ao usuário. As propostas não devem ser apresentadas como escolha definitiva antes dessa avaliação.
- Não foram escolhidos modelos, bibliotecas, preços ou provedores. Nenhuma promessa de custo ou desempenho foi validada.
- PassaAqui exige revisão com pessoas com deficiência e competência em acessibilidade antes de um piloto que influencie deslocamentos. Despensa Viva deve permanecer no planejamento e registro; não oferecer avaliação sanitária.
- Todo alvo numérico de desempenho ou impacto precisa ser apresentado como meta a testar, nunca resultado obtido.

## O que a concorrência e a coleta incompleta mudam na decisão?

### Takeaway

Não há base para alegar ineditismo. A descoberta já aponta soluções diretamente próximas das duas propostas, mas as respectivas páginas não foram abertas com sucesso nesta rodada. A recomendação é escolher pelo acesso a usuários e capacidade de testar uma hipótese específica, não por colocar IA num fluxo existente.

### Cited Findings

- O único conteúdo concorrencial disponível é a busca estruturada do provedor, preservada com posição e proveniência; ele não é uma página de produto verificada. Os destinos encontrados incluem [Wheelmap](https://wheelmap.org/en), [NoWaste](https://www.nowasteapp.com/home/) e [NoWaste.ai](https://nowaste.ai/). Os dois últimos não foram admitidos para leitura depois da detecção do bloqueio. Usá-los apenas como destinos de investigação, sem afirmar funcionalidades ou cobertura.

### Inferences

- Se for obrigatório avançar já entre estas duas ideias, **minha favorita provisória é Despensa Viva para um experimento pequeno e verificável**, porque é possível obter imagens próprias, conferir todos os campos e medir esforço sem depender de prefeitura, sensores ou comunidade grande. Seu maior risco é banalidade e abandono do inventário.
- **PassaAqui é a alternativa com melhor narrativa social e demonstração visual**, desde que restrita a observações revisáveis e cobertura local, sem prometer acessibilidade garantida. Seu maior risco é manutenção e confiança, não treinar um detector.
- Reaproveitamento metodológico da Outis: aquisição com proveniência, extração estruturada, revisão humana, estados explícitos de tarefa, histórico de correções e avaliação por métricas. Este é um mapeamento proposto; a existência de cada componente na Outis deve vir das notas do pesquisador de contexto.
- Pergunta de escolha que separa as ideias: o aluno tem acesso a uma pessoa que vive a barreira urbana e deseja cocriar, ou prefere observar e medir uma rotina doméstica por alguns dias? Interesse e acesso real a usuários valem mais do que a complexidade aparente.

### Gaps

- Provider trail: Scrapinho MCP autenticado; quatro buscas DDG concluídas e lidas integralmente com snapshots estruturados; páginas MAPA e Embrapa concluídas e lidas até `next_cursor=null`; páginas IBGE Educa e Wheelmap recusadas com `target_forbidden`, sem retry e sem transporte alternativo. Uma admissão já programada da Embrapa ocorreu na mesma chamada de orquestração que revelou os bloqueios; depois disso, nenhuma nova aquisição foi admitida. As aquisições existentes foram apenas recuperadas.
- Oito aquisições com uma tentativa cada; os recibos completos, hashes informados pelo serviço, datas e uso em bytes estão em `fontes-renda/*/record.json`. Custos em moeda/créditos não foram informados; não se pode declarar total zero. Nenhum HTML bruto foi exportado e nenhum hash de bytes brutos foi verificado.
- Council review não realizado por este coletor, que não recebeu autorização para delegar. A análise é ideação; não valida segurança alimentar, segurança de deslocamento ou conformidade de acessibilidade.
- Não há teste, código, resultado de campo, integração em produção, parceria ou dado de redução de desperdício produzido nesta tarefa.
