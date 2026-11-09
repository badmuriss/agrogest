# Acesso do cidadão a informação e serviços

## Qual problema é sustentado por evidências e quais alternativas já existem?

### Takeaway
Há evidência primária de barreiras de leitura e uso de informação, mas ainda não foi demonstrada a dor específica no atendimento escolhido. Um sistema de encaminhamento por fotografia de problemas urbanos já tem concorrência oficial direta em São Paulo; seria fraco apresentar isso como diferencial.

### Cited Findings
- O panorama Inaf 2024 informa que, entre pessoas que cursaram apenas os anos iniciais do Ensino Fundamental, aproximadamente oito em dez permanecem em condição de analfabetismo funcional. Entre quem cursou os anos finais, a proporção é 43%. Esses percentuais NÃO descrevem toda a população brasileira e NÃO medem a capacidade de concluir um procedimento municipal. Fonte primária dos realizadores, aberta e lida integralmente em 05/11/2026: [Inaf, panorama de alfabetismo](https://alfabetismofuncional.org.br/alfabetismo-no-brasil). Evidência local: fontes-acesso/inaf-page/page.md.
- A Prefeitura de São Paulo anunciou em 16/05/2025 a Solicitação Inteligente do SP156: o cidadão envia uma fotografia e o sistema sugere o serviço correspondente mediante reconhecimento de imagem. No anúncio, seis serviços estavam mapeados, incluindo tapa-buraco e reparos em viadutos. Trata-se da situação relatada naquele anúncio, não de auditoria do aplicativo em novembro de 2026. Fonte oficial aberta e lida integralmente em 05/11/2026: [SMIT, SP156 e inteligência artificial](https://prefeitura.sp.gov.br/web/inovacao/w/sp156-utiliza-intelig%C3%AAncia-artificial-para-facilitar-o-atendimento-aos-cidad%C3%A3os). Evidência local: fontes-acesso/sp156-page/page.md.
- O ODS 10 inclui a meta 10.2, sobre ampliar a inclusão de pessoas com diferentes idades, deficiências e condições econômicas, e a 10.3, sobre oportunidades e resultados mais iguais. Fonte oficial ONU aberta e lida integralmente em 05/11/2026: [ONU Brasil, ODS 10](https://brasil.un.org/pt-br/sdgs/10). Evidência local: fontes-acesso/ods10-page/page.md.

### Inferences
- O problema promissor é a distância entre receber uma informação e conseguir executar o próximo passo. Um fluxo com uma pergunta de cada vez, áudio, checklist e confirmação pode ajudar um segmento com dificuldade de leitura. Isso é hipótese de produto, não impacto já comprovado.
- A estatística Inaf justifica investigar acessibilidade cognitiva e linguagem simples. Ela não autoriza afirmar que todas essas pessoas precisam do produto nem calcular mercado multiplicando percentuais por população.
- Deve-se comparar o fluxo com portal oficial e com um assistente genérico que aceita fotografia. O diferencial candidato é estado de tarefa, evidência de cada requisito, tratamento de incerteza e acompanhamento, e não resumir uma carta.
- A busca por assistentes públicos encontrou GurIA (RS), CeLesTe (MTE) e outros candidatos oficiais. Suas páginas não foram abertas nesta coleta; são pistas competitivas, não comparação funcional concluída. Registros em fontes-acesso/gov-assistente-search/search.json.

### Gaps
- Não há entrevistas com cidadãos, CRAS, Descomplica ou outro posto de atendimento. Não há dado verificado de viagens perdidas, taxa de documentação incompleta ou faltas por dificuldade de leitura.
- A página do IBGE descoberta retornou forbidden / target_forbidden; os números do snippet não foram usados como fatos.
- Após esse bloqueio, a coleta foi encerrada sem novo transporte ou fallback. Duas aquisições já despachadas no mesmo lote (ONU e busca de assistentes) foram apenas lidas. Não houve tentativas de contorno.
- Não foi verificada a versão atual do aplicativo SP156 nem a experiência integral de protocolos.
- Nenhum recurso de IA existente em portais oficiais deve ser chamado de inexistente por falta de leitura nesta rodada.

## Qual projeto concreto vale investigar e como atende aos quatro requisitos?

### Takeaway
Favorito provisório: **Passo Cidadão**, um preparador e acompanhante de uma tarefa pública, a partir de um aviso fotografado e documentos conferidos pelo cidadão. Recorte inicial candidato: preparar o atendimento de atualização do CadÚnico na cidade de São Paulo. O serviço foi localizado em busca oficial, mas o manual ainda precisa ser lido e a escolha depende de entrevistas; não vender o recorte como já validado.

### Cited Findings
- O SP156 oferece um concorrente direto para simples foto de ocorrência urbana seguida de escolha de serviço, conforme [anúncio oficial da Solicitação Inteligente de 16/05/2025](https://prefeitura.sp.gov.br/web/inovacao/w/sp156-utiliza-intelig%C3%AAncia-artificial-para-facilitar-o-atendimento-aos-cidad%C3%A3os). Isso rebaixa a alternativa de um aplicativo genérico para classificar buracos ou lixo.
- A evidência Inaf de barreiras ao uso autônomo de informação reforça a justificativa para investigar instruções em linguagem simples com confirmação: [panorama Inaf 2024](https://alfabetismofuncional.org.br/alfabetismo-no-brasil). A inferência de utilidade exige avaliação com usuários.

### Inferences
**Proposta A: Passo Cidadão — favorita provisória.**

- Cidadão alvo: adulto com smartphone ou apoio de familiar/atendente, que recebeu um aviso de atendimento e precisa entender o que fazer e preparar os documentos. Não alegar resolver exclusão de quem não dispõe de conectividade ou dispositivo.
- Unidade de escopo: um procedimento e uma cidade. Primeiro candidato: preparação para atualização do CadÚnico em São Paulo, sem decidir elegibilidade a benefício, interpretar direito individual ou substituir atendimento oficial.
- Jornada: fotografar aviso → sistema pede outra imagem se ilegível → extrai campos e aponta suas posições na foto → cidadão confirma nome do procedimento, local e data → compara com uma ficha oficial versionada → faz apenas as perguntas necessárias → monta checklist do que reunir → registra estado e lembrete → abre canal oficial de agendamento → usuário retorna e confirma resultado.
- Visão computacional: localizar o documento, corrigir perspectiva, medir cortes/desfoque e executar OCR com caixas de texto ligadas à imagem. Detectar e mostrar qual campo está ilegível. Classificar tipo de documento e presença de campos, sem afirmar autenticidade ou validade jurídica. Isso torna a entrada por fotografia demonstrável.
- IA: interpretar o aviso e intenção; selecionar a ficha do procedimento; formular pergunta curta sobre uma lacuna; converter requisitos comprovados em instruções acessíveis. Exigir referência para cada requisito e recusar prazo, documentação ou regra não sustentados. Uma regra declarada pelo usuário não vira fato oficial.
- Análise de dados: calcular onde usuários abandonam o fluxo, quais documentos geram mais pendências, quantas recapturas ocorrem e tempo até um checklist correto. Em conjunto de teste, comparar completude e tempo com a consulta ao portal oficial. Nunca inferir vulnerabilidade econômica a partir de foto.
- Cloud: upload temporário privado, tarefa assíncrona de processamento, base de fichas e snapshots oficiais com data, estado do checklist e lembretes. Retenção mínima e exclusão de imagem após processamento/expiração; não manter identidade completa só para alimentar dashboard.
- Artefato tangível: checklist de requisitos verificados, pendências marcadas como confirmadas ou incertas, fonte e data de atualização, próximo passo e canal oficial. Um .ics pode demonstrar lembrete sem depender de WhatsApp pago.
- Diferença candidata frente a um chatbot: checklist persiste; cada item aponta um requisito oficial e a evidência correspondente; o sistema expõe leitura incerta e pede confirmação; pode continuar após o atendimento. É diferencial de implementação e UX a demonstrar, sem alegar exclusividade comercial.
- Sustentação candidata: piloto gratuito e supervisado com organização comunitária, universidade ou unidade de atendimento; se validado, convênio/contratação para manutenção de fichas e atendimento assistido. Não assumir contrato ou acesso a infraestrutura pública já existente.
- Maior risco: manter requisitos corretos e atualizados e não produzir instrução confiante errada. Segundo risco: coletar documentos sensíveis sem necessidade. É melhor usar dados fictícios e um procedimento com regras claras no protótipo.
- Critério de abandono: se entrevistas mostrarem que a dificuldade é falta de vaga/funcionário, e a informação já é entendida, o produto não resolve a dor principal.

**Proposta B: Protocolo Vivo — alternativa mais visual, menos recomendada.**

- Recorte: morador que já registrou um problema de zeladoria e não sabe interpretar a devolutiva ou documentar recorrência. Apoia o acompanhamento pelo canal oficial, em vez de prometer executar serviço urbano.
- Jornada: foto antes → ligação manual ao protocolo real → leitura da devolutiva → nova foto do mesmo local → painel de evidências e histórico para o cidadão decidir próximo contato.
- Visão computacional: correspondência aproximada do local/ângulo e identificação de mudança visível. Deveria recusar fotos incompatíveis. Não declarar que um serviço foi concluído apenas por comparação visual.
- IA: resumir a devolutiva e preparar descrição factual de acompanhamento; dados: tempos entre etapas, reincidência e cobertura das evidências; cloud: histórico privado, fila de processamento e fonte original.
- Objeção principal: o produto pode só replicar status e anexos de plataformas existentes. A fase útil exige integração, acesso ao histórico ou trabalho manual que pode tirar conveniência. Comparação antes/depois é sensível a câmera, luz e enquadramento.
- Demo em 14 dias é possível com histórico sintético e fotos próprias, mas isso valida apenas a tecnologia e não a capacidade de melhorar o serviço da prefeitura.
- Eu descartaria esse caminho se o único diferencial que sobreviver for detectar buraco pela foto.

### Gaps
- Fonte do serviço **a abrir e verificar antes de escrever qualquer checklist real**: [SP156, informações sobre CadÚnico](https://sp156.prefeitura.sp.gov.br/portal/servicos/informacao?conteudo=2674). Foi localizada em busca, não aberta. Registro: fontes-acesso/cadunico-search/search.json.
- Outros links oficiais localizados, não lidos: [agendamento CadÚnico São Paulo](https://agendacadunico.prefeitura.sp.gov.br/forms/BemVindo.aspx), [Descomplica SP](https://descomplicasp.prefeitura.sp.gov.br/), [GurIA](https://rs.gov.br/guria), [CeLesTe](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2025/outubro/celeste-mte-apresenta-assistente-virtual-para-facilitar-acesso-a-informacoes-trabalhistas).
- Não foi verificado se essas plataformas já têm checklist persistente, análise documental ou acompanhamento equivalente. Não alegar que não têm.
- Não existe OCR ou benchmark implementado neste projeto. Toda arquitetura acima é proposta.
- O nome Passo Cidadão é de trabalho, sem busca de marca ou domínio.

## Como produzir uma demonstração e avaliar impacto até 19 de novembro?

### Takeaway
A nota de resultados pode ser sustentada por um plano de validação honesto, métricas operacionais e uma pequena comparação de tarefas, sem inventar reduções de tempo ou benefícios. O alvo é comprovar que pessoas conseguem identificar o próximo passo e documentos necessários com menos erros, respeitando a autonomia e a privacidade.

### Cited Findings
- A meta 10.2 do ODS 10 dá uma ligação direta para o recorte de inclusão no acesso a serviços: [ONU Brasil](https://brasil.un.org/pt-br/sdgs/10), consultada em 05/11/2026. A relação projeto→meta é interpretação nossa; nenhuma certificação ODS é sugerida.

### Inferences
- Validação do problema (05–07/11): ouvir 5 cidadãos que fizeram recentemente o mesmo procedimento e 1–2 atendentes ou pessoas que os apoiam, com consentimento e sem registrar dados pessoais. Pedir que expliquem o aviso e o que fariam em seguida. Escolher o procedimento pela dificuldade observada, não só pela disponibilidade da API.
- Protótipo (08–11/11): PWA simples com uma ficha oficial revisada manualmente, upload de documentos fictícios, OCR e campos confirmáveis, perguntas de lacuna, checklist persistente e link oficial. Demonstrar falha segura com foto cortada.
- Avaliação técnica (12–14/11): corpus pequeno e rotulado, por exemplo 30 imagens sintéticas com versões nítidas, escuras, inclinadas e incompletas. Medir acerto por campo, erro de data/local, recusa de imagem e ausência de requisitos inventados. É benchmark de laboratório, não taxa de acerto no Brasil.
- Avaliação com usuários: teste de tarefa comparando portal oficial com protótipo, com ordem alternada e caso equivalente, amostra viável (por exemplo 8–12 voluntários). Reportar mediana do tempo e contagem de tarefas corretas; amostra pequena não permite generalizar ganho populacional. Idealmente incluir o público alvo real e registrar quando isso não foi possível.
- Indicadores centrais: (1) porcentagem de checklists corretos segundo revisão humana com fonte oficial; (2) erros críticos de requisito/prazo/local; (3) tempo até identificar próximo passo correto; (4) conclusão sem ajuda; (5) fricções por etapa e fotos refeitas; (6) quantidade de regras exibidas com fonte e revisão atual.
- Critério de aceitação proposto, ainda não medido: nenhum prazo inventado no corpus demonstrado; toda regra acompanhada da fonte; campos incertos jamais marcados como confirmados; melhora observada no teste exploratório sem esconder casos de piora. Não inventar meta percentual antes do baseline.
- Impacto de prazo maior: comparecimento com documentação preparada e redução de retornos por pendência. Essas métricas exigem acompanhamento e parceria; não podem ser declaradas com uma demo.
- Sustentabilidade técnica: cada ficha tem responsável, data de revisão e prazo de rechecagem; ficha sem revisão aciona aviso e canal humano. Escalar primeiro para poucos procedimentos no mesmo município, depois novas cidades, preservando diferenças locais.
- Vídeo técnico: mostrar um aviso fictício e uma foto ruim, campo incerto marcado, fonte oficial consultada, checklist e continuidade do estado. Reservar tempo para o protocolo de validação e resultados realmente medidos, pois resultados valem 8 dos 20 pontos.
- Entrega: consolidar roteiro em 15–16/11, gravar e revisar em 17–18/11, publicar não listado e conferir link no arquivo .txt antes do limite de 19/11. Não depender de integração externa nova nos últimos dias.

### Gaps
- Não há resultados medidos, público recrutado, parceiros confirmados, custos de cloud ou preços de modelo verificados.
- Regras e documentos do serviço devem passar por leitura e revisão antes de teste com cidadãos.
- Acesso sem smartphone e sem conectividade exigiria canal assistido; isso não foi resolvido nesta proposta.
- Riscos de privacidade foram identificados, mas não houve auditoria jurídica, de segurança ou de conformidade. Proposta de pesquisa não equivale a implantação.

