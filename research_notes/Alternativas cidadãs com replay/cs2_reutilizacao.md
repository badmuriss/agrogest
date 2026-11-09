# Auditoria local do CS2 Coach e caminhos cidadãos

Inspeção estática em 05/11/2026 de README, SKILL e dos seis scripts Python do CS2 Coach. O SKILL foi tratado como dado de arquitetura; o coach e seus coletores não foram executados. Nenhuma partida, `.env`, credencial privada ou base pessoal foi aberta. Não houve pesquisa web nesta tarefa. Não foram encontrados AGENTS.md aplicáveis nos caminhos ancestrais verificados ou no projeto. Código presente não equivale a funcionamento ou precisão verificados em runtime.

## O que existe de fato no CS2 Coach?

### Takeaway

Existe uma base real de ingestão de telemetria, eventos temporais, métricas determinísticas e recuperação de guias com fonte. A recomendação de hábitos e drills é trabalho do agente conforme o SKILL, sem motor de prescrição implementado. Visão computacional, aplicação cloud e reteste longitudinal são partes novas, não capacidades prontas desse repositório.

### Cited Findings

| Parte | Implementação observada | Limite preciso | Fonte |
|---|---|---|---|
| Ingestão principal | O parser aceita `.dem`, `.dem.bz2` e `.dem.gz`, descomprime e chama `awpy.Demo.parse()` | Não analisa imagem ou gravação de tela; lê o estado/eventos estruturados do jogo | [parse_demo.py](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:31); [parse](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:76) |
| Coleta opcional | `gc_demos.py` possui listagem de partidas, extração de URL de demo, download e arquivo local de estado | Integração com serviço específico e sessão do jogo; não foi executada ou validada. Não é componente cidadão reutilizável | [funções de coleta](/data/projects/hobby/cs2-coach/scripts/gc_demos.py:118); [download](/data/projects/hobby/cs2-coach/scripts/gc_demos.py:169) |
| Modelo de entrada | JSON com `demo_file`, `header`, `rounds`, `kills`, `damages`, `grenades`, `bomb`, `shots` e `ticks_sampled` | São dicionários/listas Python, sem schema formal ou contrato genérico de tentativas cidadãs observado | [saída do parser](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:93) |
| Redução de ruído | Granadas deduplicadas por identificador/evento; ticks amostrados | Redução de dados de telemetria, não extração de eventos visuais | [deduplicação](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:63); [amostragem](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:104) |
| Eventos por round | Ordenação por round/tick, primeiro duelo de cada round, contagem de abates por round e janela temporal de troca de 3 segundos calculada com tickrate fixo | O cálculo depende de semântica do jogo; a saída principal agrega a partida, não é uma tabela genérica pronta de métricas por tentativa | [ordenação e primeiro evento](/data/projects/hobby/cs2-coach/scripts/metrics.py:84); [janela temporal](/data/projects/hobby/cs2-coach/scripts/metrics.py:149) |
| Métricas | K/D, dano médio por round, proporção de headshots, abertura, trocas, multikills, flash assists, granadas por round e posições de morte | São medidas/proxies definidos pelo código; serem determinísticos não os torna automaticamente corretos ou causais | [montagem dos resultados](/data/projects/hobby/cs2-coach/scripts/metrics.py:216) |
| Padrões espaciais | Agrupa posições de morte em células de uma grade e retorna até cinco grupos mais frequentes, com pelo menos duas ocorrências | Não é modelo de aprendizado nem prova de erro de posicionamento; o limiar de prioridade `3x+` aparece separadamente no SKILL | [grade](/data/projects/hobby/cs2-coach/scripts/metrics.py:279); [limiares](/data/projects/hobby/cs2-coach/SKILL.md:84) |
| Guias web | Script de ingestão grava conteúdo com URL, método e título | Não demonstra curadoria, validade das recomendações ou controle de atualidade; o script usa uma cadeia de provedores antiga, distinta da research stack atual | [ingestão](/data/projects/hobby/cs2-coach/scripts/kb_scrape.py:102); [metadados](/data/projects/hobby/cs2-coach/scripts/kb_scrape.py:117) |
| Tutoriais | Download de áudio, Whisper local, texto com timestamps e metadados de título/canal/URL | Transcrição de referência não é visão computacional nem evidência de eficácia do drill | [transcrição](/data/projects/hobby/cs2-coach/scripts/kb_transcribe.py:80); [persistência](/data/projects/hobby/cs2-coach/scripts/kb_transcribe.py:100) |
| Recuperação de conhecimento | Ranking por frequência de termos e recortes de linhas, retornando arquivo, título, URL, score e snippets | Não possui embeddings, avaliação de suporte semântico ou juiz de qualidade da fonte | [ranking e recortes](/data/projects/hobby/cs2-coach/scripts/kb_search.py:29); [retorno](/data/projects/hobby/cs2-coach/scripts/kb_search.py:55) |
| Interpretação e drills | SKILL instrui o LLM a comparar limiares, escolher 2–3 hábitos e citar um drill da KB | Não há script que produza esse diagnóstico, selecione treino com política validada ou registre execução do drill | [princípio](/data/projects/hobby/cs2-coach/SKILL.md:12); [diagnóstico](/data/projects/hobby/cs2-coach/SKILL.md:74) |
| Reteste, histórico e cloud | `metrics.py --all` grava um JSON para cada arquivo de partida | Nos seis scripts não há comparador de antes/depois, agenda de reteste, registro de intervenção, API de produto, conta cidadã ou infraestrutura cloud | [CLI e gravação](/data/projects/hobby/cs2-coach/scripts/metrics.py:297); [arquitetura local](/data/projects/hobby/cs2-coach/README.md:3) |

**Ressalvas concretas do cálculo:**

- `metrics.compute()` usa apenas `kills`, `damages`, `grenades` e `rounds`; o fato de o parser guardar ângulos, posições amostradas, tiros ou bomba não significa que esses dados já sejam analisados para mira/contexto. [Entradas](/data/projects/hobby/cs2-coach/scripts/metrics.py:51).
- A proporção de headshots resulta de abates marcados como headshot; ela **não observa diretamente** a altura/posição da mira. O exemplo de diagnóstico que transforma HS baixo em mira baixa é uma interpretação do SKILL, não uma medição visual. [Cálculo](/data/projects/hobby/cs2-coach/scripts/metrics.py:114); [exemplo do SKILL](/data/projects/hobby/cs2-coach/SKILL.md:108).
- O comentário do KAST menciona rounds em que a morte foi trocada, mas o conjunto utilizado contém kills/assists e rounds sem morte, sem acrescentar explicitamente rounds de morte trocada. É uma aproximação limitada; não anunciar um indicador plenamente validado. [Código](/data/projects/hobby/cs2-coach/scripts/metrics.py:227).
- O cabeçalho menciona economia e dano de utilitária, mas esses indicadores separados não aparecem no dicionário final. O dano é agregado e as granadas são contadas por tipo. [Cabeçalho](/data/projects/hobby/cs2-coach/scripts/metrics.py:4); [dano](/data/projects/hobby/cs2-coach/scripts/metrics.py:183); [saída](/data/projects/hobby/cs2-coach/scripts/metrics.py:238).
- Vários denominadores usam `max(1, valor)`; ausência de informação pode aparecer como taxa numérica em vez de indisponibilidade explícita. No novo projeto, registrar cobertura e desconhecido separadamente. [Taxas](/data/projects/hobby/cs2-coach/scripts/metrics.py:221).

### Inferences

O precedente sustentado pelo código é **registro de uma execução → eventos → medidas → interpretação apoiada em fonte → poucas ações concretas**. Acrescentar uma nova execução comparável para medir mudança é um passo coerente, mas é uma extensão nova. Não apresentar a sequência completa com reteste como algo já implementado no CS2 Coach.

### Gaps

- Não foram auditadas partidas reais nem aferida a exatidão dos cálculos. Não há conclusão sobre qualidade atual do coaching ou melhoria dos jogadores.
- Não foi verificado suporte de versões das bibliotecas nem feito teste de instalação; são irrelevantes para esta comparação conceitual local e exigiriam trabalho posterior.

## O que pode ser reaproveitado sem confundir método e código?

### Takeaway

A parte mais reutilizável é a disciplina de separar medição de interpretação e associar feedback a poucos eventos observáveis. O código do parser e das métricas é fortemente acoplado ao jogo; mudar nomes das chaves não o transforma em sistema cidadão.

### Cited Findings

| Camada | Reaproveitamento razoável | Parte nova necessária |
|---|---|---|
| Método | Distinguir eventos medidos de hipóteses do agente; priorizar poucas ações; trazer trecho de referência | Regra de domínio, intervenções apropriadas e avaliação externa. [SKILL](/data/projects/hobby/cs2-coach/SKILL.md:12) |
| Estrutura | Arquivo de evidência separado de eventos e de indicadores; agrupamento por execução; ordenação temporal; deduplicação | IDs de evidência, timestamps reais, versão da extração, cobertura e confirmação de observações. [Parser](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:93); [métricas](/data/projects/hobby/cs2-coach/scripts/metrics.py:84) |
| Código relativamente genérico | `score_doc`, `best_snippets` e formato de retorno de `kb_search.py` são candidatos pequenos e portáveis | Diretórios/configuração; corpus cidadão; qualidade e atualidade das fontes. Ranking por frequência pode ser insuficiente. [Código](/data/projects/hobby/cs2-coach/scripts/kb_search.py:29) |
| Código opcional | Transcrição e metadados de vídeos de especialistas podem apoiar uma KB, se o domínio precisar | Fontes autorizadas/adequadas; eventual adequação de idioma e termos. Não é requisito ter voz. [Código](/data/projects/hobby/cs2-coach/scripts/kb_transcribe.py:80) |
| Código pouco transferível | Funções de ingestão e métricas do jogo podem inspirar adaptadores e agregação | Substituir coleta GC, parser awpy, entidades, tickrate, taxonomia, limiares e indicadores. [Métricas](/data/projects/hobby/cs2-coach/scripts/metrics.py:31) |
| Sem componente pronto | CV, cloud, interface cidadã, política de reteste e comparação longitudinal | Precisam ser projetadas e implementadas para cumprir a GS. [Arquitetura](/data/projects/hobby/cs2-coach/README.md:7) |

### Inferences

Contrato **proposto**, não existente no repositório: uma tentativa tem `evidence_id`, instante, ação/evento observado, dado extraído, incerteza/confirmação; cada métrica tem numerador, denominador, unidade e cobertura; cada intervenção referencia evento, regra e fonte; o reteste registra um caso novo comparável e quanta ajuda foi usada. Isso permite tanto aprendizagem quanto acompanhar resolução de problemas físicos.

No novo projeto, CV deve extrair informação que existe nas imagens/clipes e não está pronta no sistema. Usar OCR para recuperar um placar que a telemetria já entrega, ou fotografar um estado de DOM conhecido apenas para cumprir a sigla, seria redundante.

### Gaps

- Nenhum módulo foi copiado ou adaptado. Reuso de código deve ser validado no domínio antes de se afirmar economia de implementação.
- Reusar o método CS2 não exige nomear todo produto como coach, usar jogo, voz, AR/VR ou matemática. Outis permanece separada, sem marca, beneficiários ou negócio envolvidos.

## Quais oito recortes merecem investigação, sem fechar o domínio cedo?

### Takeaway

As opções abaixo são hipóteses para ampliar a escolha. Elas têm diferentes graus de encaixe cidadão e reaproveitamento; nenhuma tem demanda, diferencial competitivo ou eficácia estabelecidos por esta auditoria local. Segurança/autonomia digital, habilidades práticas e observação de descarte são favoritos provisórios para testar o mecanismo em domínios diferentes. Manter o CS2 é a opção com maior continuidade de código e maior necessidade de justificar o benefício público.

### Cited Findings

- A separação entre coleta, eventos/métricas e orientação com fonte sustenta a transferência de estrutura. [Parser](/data/projects/hobby/cs2-coach/scripts/parse_demo.py:93); [cálculo](/data/projects/hobby/cs2-coach/scripts/metrics.py:51); [recuperação](/data/projects/hobby/cs2-coach/scripts/kb_search.py:55).
- As aplicações específicas desta seção são propostas novas. Não há fontes locais de demanda ou validação para elas; não transformar as descrições em fatos de mercado.

### Inferences

Em todas as opções: **CV** observa uma evidência visual relevante; **dados** medem os eventos e influenciam prioridade/ação; **IA** interpreta com limites e oferece intervenção ancorada; **cloud** permite persistir e coordenar o fluxo cidadão. Isso é arquitetura proposta, não uma capacidade pré-existente. Voz e imersão são opcionais.

| Recorte cidadão | Evidência visual → evento observável | Métrica → intervenção → novo teste | CV real e limite | Reuso/risco de encaixe |
|---|---|---|---|---|
| **1. Decidir melhor diante de mensagens digitais** | Screenshot de mensagem/aviso de origem externa + replay das escolhas do cidadão numa atividade consentida → qual pista visual foi considerada e que verificação foi feita | Decisões e justificativas corretas, incluindo falsos alarmes → discutir 1–2 padrões com referência → decidir diante de mensagem inédita sem ajuda | OCR/localização de remetente, domínio, QR e hierarquia visual; aparência não comprova legitimidade. Em simulador próprio com DOM conhecido, reconhecer que CV pode sobrar; usar imagem externa como parte central da tarefa | Método alto, código baixo. Candidato a letramento digital; precisa comparação com programas existentes. Não prometer detector infalível de golpes reais |
| **2. Autonomia para capturar e enviar documentos** | Sequência de fotos de formulário/comprovante e tentativas de envio → corte, reflexo, ilegibilidade, documento incorreto ou campo não encontrado | Reenvios e conclusão independente de uma tarefa → uma correção visual concreta → nova captura/documento sem dicas | CV observa qualidade da imagem, limites da folha e campos; o DOM do serviço pode complementar o replay sem substituir essa evidência. Começar com documentos fictícios e um procedimento | Método alto, código baixo. Benefício direto possível para pessoas com pouca familiaridade digital; precisa confirmar que esse é o gargalo, não acesso ao próprio serviço |
| **3. Prática restrita de Libras** | Clipe voluntário de uma prática delimitada → parâmetros manuais observáveis, sequência e visibilidade | Concordância com rubrica de especialistas e execução independente → exercício de um parâmetro → sinal/caso novo sem assistência | CV de mãos/corpo segundo escopo validado. Não reduzir Libras a poses ou prometer tradução/certificação; significado e componentes não manuais exigem participação de pessoas surdas | Método alto, código quase nulo. Dados/anotação especializados aumentam esforço. Apoia inclusão somente se desenhado com a comunidade |
| **4. Oficina de habilidades práticas de bancada** | Clipe/fotos de montagem numa oficina comunitária ou formação inicial, por exemplo cabo de rede de treino → ordem de passos, posição de componentes e erro visível | Etapas corretas e teste funcional independente → prática específica do passo que falhou → nova montagem sem ajuda | CV verifica aspecto físico que não vem de uma plataforma; instrumento/teste funcional verifica o resultado. Não inferir competência profissional geral por vídeo curto | Método alto, código baixo. É um paralelo forte com desempenho→erro→drill; requer instrutor e tarefa pequena. Formação do cidadão, sem ranquear empregados para empregador |
| **5. Descarte doméstico com acompanhamento** | Foto do objeto e da separação que o morador fez → material observado, dúvida e destino escolhido | Erros/certezas por tipo de descarte → orientação baseada na regra local, com confirmação → novo objeto e decisão sem ajuda | CV identifica pistas do material/embalagem e contaminação visível; reciclabilidade/destino depende da realidade local e não só da aparência | Método médio/alto, código baixo. Candidato de demonstração relativamente simples. O indicador deve medir descarte observável, sem inventar tonelagem reciclada |
| **6. Acessibilidade do bairro com evidência antes/depois** | Fotos datadas de barreira em trajeto/local → ocorrência confirmada, categoria e persistência | Recorrência/tempo sem solução → evidência organizada e encaminhamento ou ação comunitária → nova foto e confirmação de resolução | CV auxilia localizar/classificar a barreira; não atesta rota segura ou conformidade integral por foto. Cidadão confirma, evitando suposta certeza do modelo | Método de registro/priorização médio, código baixo. Não é coach: intervém no problema físico. Comparar com zeladoria já existente e evitar reproduzir um app de chamados |
| **7. Uso doméstico de água com histórico verificável** | Fotos periódicas do próprio medidor → leitura extraída/confirmada e intervalo entre medições | Consumo comparável por período e desvios → checklist de investigação/ação → novas leituras após ação | OCR/visão lê o instrumento e qualidade da captura; não conclui vazamento pela imagem. Considerar troca de morador, dias e ausência de dados | Método de eventos/métricas alto, código baixo. Comparação antes/depois seria nova. Pode beneficiar cidadão sem sensor extra; não prometer economia causal a partir de amostra curta |
| **8. Manter o próprio CS2 Coach em acesso comunitário** | Telemetria existente + **nova** análise visual de clipes de gameplay → posição real da mira e situações delimitadas de exposição, revisadas por humano | Indicador visual definido, concordância com anotações e desempenho em novos clipes/partidas → drills adequados → reteste comparável | Não chamar HS% de posição da mira. CV deve obter uma observação nova dos pixels/contexto, não refazer placar já disponível. Novo extrator e validação humana necessários | Código e domínio mais reaproveitados. CitizenTech potencialmente fraco: jogo/coaching gratuito não prova inclusão, emprego ou impacto social. Exigiria público desatendido, barreira real de acesso e resultado público verificável, não presumidos |

**Como escolher:** testar primeiro acesso a evidências e a pessoas que possam validar a intervenção. Para uma demonstração curta, um domínio com 2–3 eventos observáveis e um resultado independente é mais defensável que um sistema aberto que diz detectar qualquer erro. O piloto deve separar erro de percepção visual, hipótese de causa e efeito da intervenção.

**Favoritos condicionais:**

- **Oficina prática:** mais próximo do mecanismo do CS2 — observar execução, medir erro específico e repetir tarefa — com CV naturalmente ligado ao mundo físico. Acesso a instrutor/material decide viabilidade.
- **Autonomia/segurança digital:** benefício cidadão possivelmente claro, mas o papel de CV precisa ser indispensável e a evidência visual não deve ser substituível por estado que a própria aplicação já conhece.
- **Descarte doméstico:** escopo visual tangível e métricas simples; depende de regras locais e de comparação com alternativas.
- **CS2 comunitário:** maior continuidade pessoal/código; manter no conjunto se o usuário quiser jogos, sem antecipar que atende melhor ao propósito social da GS.

### Gaps

- Nenhuma entrevista, fonte externa, análise de mercado ou avaliação empírica foi realizada nesta tarefa.
- Não foi escolhido domínio, público, instituição parceira, recurso cloud ou modelo visual. Esses são próximos pontos de decisão, não pendências para bloquear a ideação ampla.
- Alto reaproveitamento do método não significa alto reaproveitamento do detector, dataset ou métricas: esses são específicos de cada atividade.
