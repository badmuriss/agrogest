# Três alternativas para autonomia digital

## Que problema e alternativas existentes foram efetivamente verificados?

### Takeaway
As três propostas são projetos independentes da Outis e usam o CS2 Coach como base de análise de um episódio, seleção de poucos erros e treino da próxima tentativa. Nenhuma eficácia, prevenção de fraude ou empregabilidade está demonstrada. Minha preferência para um piloto cidadão é autonomia em uma tarefa digital delimitada; para testar resultado objetivo mais facilmente, a oficina com arquivos fictícios é forte.

### Cited Findings
- A tabela [TIC Domicílios 2024, I1A](https://cetic.br/pt/tics/domicilios/2024/individuos/I1A/expandido/) do Cetic/NIC.br foi lida integralmente. Registra atividades digitais por grupo entre usuários de Internet, incluindo anexar arquivos, movimentar pastas e usar fórmulas. Por exemplo, o item de anexar documento/imagem/vídeo registra 34% no total e 13% no grupo de 60 anos ou mais. **São atividades pesquisadas, não teste de capacidade**: não se pode converter o complemento em pessoas que “não sabem”. A página não apresenta janela temporal nem N amostral. A utilidade aqui é localizar tarefas a investigar, não estimar demanda.
- A página própria [Northstar Features](https://www.digitalliteracyassessment.org/features), lida integralmente, já descreve avaliações interativas, relato das áreas que precisam de melhoria, prática dirigida ao resultado, currículo e recursos para e-mail, arquivos, documentos, planilhas, busca de emprego e uso cotidiano. Isso elimina “avaliar habilidades e sugerir uma trilha” como diferencial suficiente. A página comercial não demonstra eficácia.
- Roy et al., [ShieldUp!, manuscrito primário de 2025](https://arxiv.org/html/2503.12341v1), §4: RCT relatado com 3.000 participantes na Índia; jogo de aproximadamente 15 minutos versus conscientização de cerca de 10 minutos e jogo-controle de cerca de 8 minutos. O texto relata melhora na identificação de cenários de golpe e acompanhamento em 21 dias; também descreve aumento temporário de suspeita sobre ofertas legítimas. Não foi demonstrada redução de perdas financeiras reais. O texto consultado não oferece estimativa numérica completa do efeito nas passagens de resultados; diferenças de tempo, versões do teste e informações incompletas de atrito amostral limitam a leitura. Preprint/case study, sem transformar o relato dos autores em comprovação independente.
- Rozema e Davis, [Anti-Phishing Training (Still) Does Not Work, v3 de 13/10/2025](https://arxiv.org/html/2506.19899v3), §§3–4: estudo em uma empresa dos EUA, com 12.511 participantes que completaram o protocolo entre dezembro/2024 e abril/2025. Comparou palestra, palestra com exercícios e controle; não encontrou efeitos principais significativos sobre cliques (p=.450) ou denúncias (p=.417). Há controle menor, possíveis erros de telemetria e limites de generalização fora da organização. Isso não refuta todo treino possível; impede prometer que nosso jogo necessariamente evitará golpes reais.

### Inferences
- Necessidade candidata: tornar pessoas capazes de concluir tarefas digitais por conta própria e reconhecer limites/necessidade de ajuda. Precisa de entrevistas e observação de tarefas reais, não apenas demografia.
- No recorte de idosos, idade não é diagnóstico de incapacidade. Recrutar pessoas que declarem dificuldade na tarefa ou queiram praticá-la.
- O erro observado pode decorrer de linguagem da interface ou acessibilidade, não de deficiência do usuário. O sistema precisa registrar barreiras da interface e não culpar o cidadão.
- Os estudos de segurança digital medem coisas distintas: reconhecer cenários em teste e agir diante de uma mensagem no trabalho. Não tratar os resultados como uma contradição universal nem transferi-los automaticamente ao Brasil.
- O recorte antimanipulação deve incluir exemplos legítimos no teste. “Desconfiar de tudo” não é o resultado desejado.

### Gaps
- Não há entrevistas, parceiros, demanda local validada ou dados da nossa plataforma.
- Bad News foi localizado, mas a página capturada forneceu apenas shell/cookies; não fiz comparação funcional a partir disso. Learn My Way retornou render_required e texto vazio; não foi aceita como fonte de funcionalidades. Não reexecutei para ampliar coleta.
- Não auditei Copilot Vision/Be My Eyes. Não afirmar que a proposta é a primeira IA a ver telas ou ensinar habilidades.
- INAF e ONU de rodadas anteriores permanecem disponíveis; nenhum novo percentual dessas fontes é necessário para escolher entre as ideias.

## Como funcionam as três propostas e qual usa melhor o CS2 Coach?

### Takeaway
O produto é **tentativa → eventos verificáveis → poucos padrões de erro → intervenção → nova tarefa sem ajuda**. O componente de visão precisa interpretar pixels e mudanças visuais; simplesmente guardar vídeo não atende ao requisito. O reteste é uma extensão nova e não capacidade pronta do CS2 Coach.

### Cited Findings
- A auditoria local do agente contexto_outis confirmou o método existente do CS2 Coach: arquivo .dem → eventos temporais por round → métricas determinísticas/proxies → busca por palavras-chave em base de conhecimento → LLM seleciona 2–3 hábitos e exercícios apoiados em referência. Não há CV, cloud nem reteste longitudinal prontos. O contexto local completo foi entregue separadamente ao coordenador.
- A concorrência Northstar já cobre avaliação por tarefas e recomendações por lacuna: [funcionalidades oficiais](https://www.digitalliteracyassessment.org/features). As propostas abaixo são hipóteses de extensão por replay visual, recorte brasileiro e transferência avaliada.

### Inferences

| Aspecto | 1. Treino contra golpes e manipulação | 2. Autonomia em serviços digitais | 3. Oficina de competência digital para trabalho |
|---|---|---|---|
| Nome de trabalho | **Pausa no Replay** | **Passo Próprio** | **Oficina em Replay** |
| Beneficiário e dor | Cidadão que deseja praticar decisões diante de mensagens persuasivas, sem dinheiro ou contas reais | Pessoa que depende de ajuda para anexar documentos, localizar arquivos e concluir um atendimento digital | Jovem/adulto que precisa executar tarefas digitais concretas para estudo, trabalho ou comunidade, mesmo tendo feito cursos |
| Exemplo claro | Em uma caixa de mensagens fictícia, uma suposta entrega pede ação urgente. O aluno escolhe abrir detalhes, verificar o contexto, pedir apoio ou continuar. Depois revê o ponto decisivo e enfrenta outra história com aparência diferente | Em um atendimento fictício, a pessoa precisa escolher um documento de teste, anexá-lo no campo correto e localizar o protocolo gerado. Depois repete a tarefa em outra interface, sem instruções passo a passo | Em uma planilha com inscrições fictícias, a pessoa deve corrigir um registro, ordenar dados e calcular um total. Entrega arquivo correto, revê uma decisão e executa a mesma habilidade com outros dados |
| Jornada | Episódio curto → decisão registrada → replay com trechos da tela → explicação da estratégia → novo episódio não visto | Tentativa em janela/conta de treino → replay localiza onde o fluxo divergiu → microtreino de uma habilidade → outra tarefa equivalente | Tarefa em editor/planilha não instrumentado → gravação da janela de treino e artefato final → replay de etapa errada → exercício específico → outro arquivo sem ajuda |
| CV real | OCR/localização do remetente, domínio exibido, textos e controles em screenshots fictícios com layouts variados; reconhecer estados visíveis na sequência. Não inferir verdade de uma mensagem real nem que a pessoa “olhou” algum lugar | Reconhecer telas, controles, seletor de arquivos, campo de upload, aviso de erro e confirmação a partir dos frames. Ligar eventos a evidências visuais e à tarefa; recusar estado ambíguo | Reconhecer janela, célula selecionada, barra de fórmulas, ordenação e alterações visíveis. Vincular o momento ao problema do arquivo; não confundir imagem final com validação dos dados |
| Dados | Perfil de estratégia por tipo de erro, decisões observadas, acerto em casos inéditos e distinção entre legítimo/manipulativo | Dependência de ajuda, etapa de abandono, erros de fluxo e conclusão independente em outra interface | Correção objetiva do arquivo, classes de erro, ajuda necessária e sucesso com novos dados |
| IA | Selecionar uma explicação/pista sobre a estratégia e montar outro cenário a partir de modelos revisados | Converter o erro observado numa intervenção curta e visual, em linguagem acessível, selecionada de uma base revisada | Relacionar o erro verificável a uma habilidade e prescrever 1–2 exercícios; revisão do resultado e das evidências |
| Cloud | Sessão e frames fictícios privados, fila de extração, base versionada de cenários, histórico e agendamento de reteste | Processamento e histórico consentidos, armazenamento temporário só da janela de treino, base de tarefas e painel individual | Jobs de extração, arquivos e rubricas versionados, histórico do aprendiz e painel agregado para oficina educacional |
| O que vem do método CS2 | Episódio como round; eventos como decisões; revisão de uma sequência; 2–3 hábitos e exercícios a partir de evidência | Fluxo como round; estado visual e sequência de passos como eventos; padrões recorrentes e treino da próxima tentativa | Execução como partida; métricas do produto final e processo; hipótese de erro apoiada em trecho; exercício para a próxima execução |
| Demo até 19/11 | Três histórias fictícias e dois layouts; replayer com caixas de evidência; um cenário novo sem auxílio. Sem conectar contas bancárias ou canais externos | Uma tarefa com documentos fictícios, dois layouts e três erros previstos; replay com timestamps e sucesso no reteste. Conta de treino sem credenciais de terceiros | Um editor/planilha, uma família de tarefas, um erro de fórmula/ordenação; upload de gravação e arquivo fictícios; verificador do arquivo e reteste |
| Métrica principal | Decisão correta em cenário novo sem ajuda, incluindo falsos alarmes e justificativa. Não “fraudes evitadas” | Conclusão correta de tarefa nova sem ajuda; barreiras por etapa e ajuda necessária. Não simples tempo de tela | Arquivo correto com dados inéditos e explicação de uma escolha; transferência entre tarefas. Não “chance de contratação” |
| Diferencial candidato | Feedback sobre sequência de decisões e treino personalizado. Um simples quiz/jogo de inoculação já tem precedentes como ShieldUp! | Revisão de tentativa em interface realista não integrada e competência sem auxílio; ensinar a pessoa, além de fazer por ela | Ligar a etapa visível ao erro objetivo do artefato e ao próximo exercício. Avaliação/trilha por habilidade já existe em Northstar |
| Maior objeção | CV pode ser decorativa se o simulador já conhece por DOM toda decisão e tela; efeitos de treinamento podem não transferir. Risco de confiança indevida ou desconfiança excessiva | Se apenas um simulador próprio é usado, eventos diretos podem bastar. Variação entre versões das interfaces e acessibilidade pode tornar a visão frágil | Verificador de arquivo pode ser suficiente para dizer o que está errado; CV só agrega se explicar o processo em programa não instrumentado. Mercado de cursos/avaliações já é estabelecido |

**Como evitar CV decorativa.** O objeto observado deve ser uma captura de tela/screenshot de um ambiente de treino não integrado, ou uma mensagem fictícia recebida como imagem, sem estado semântico fornecido pelo motor. A CV identifica elementos e estados e extrai eventos com timestamp, região da imagem e confiança. Telemetria de cliques pode complementar, mas não substituir essa interpretação. O anotador humano fornece o gabarito de avaliação. Não criar uma necessidade artificial de CV se logs diretos já resolvem todo o problema; nesse caso, a ideia perde força perante o enunciado.

**Método versus código.**
- Reutilizáveis como método: contrato de eventos, análise por episódio, métricas explícitas, referência recuperada de KB, seleção de poucos hábitos/drills e relatório com evidência.
- Candidatos a adaptação de código, sujeitos à auditoria local: interface do relatório, busca na KB e montagem de contexto para recomendação, quando suficientemente desacoplados de CS2.
- Novos: extrator de telas e OCR, taxonomia de tarefas, rubricas, base de conteúdo, validação de arquivo, serviço cloud, consentimento e reteste.
- Sem reaproveitamento direto: parser .dem, regras específicas de round, KAST ou proxy de headshot. Não traduzir mecanicamente métricas de jogo para “habilidade” humana.

**Escolha relativa.** Passo Próprio oferece o benefício cidadão mais direto e o recorte de privacidade mais simples se inteiramente sintético. Oficina em Replay permite validar um artefato objetivamente e tem conexão clara com o ciclo CS2; pode servir melhor se o usuário gostar de analisar execução de software. Pausa no Replay é visual e atrativa para pitch, mas exige maior cuidado com eficácia e transferência e possui precedentes metodológicos próximos.

### Gaps
- Nomes provisórios, sem busca de marca.
- Não há OCR, extração visual ou cloud implementados neste projeto; não apresentar como recurso herdado.
- A observação não permite inferir emoção, atenção, honestidade, talento, cultura, deficiência ou empregabilidade. Nenhuma proposta usa webcam, rosto ou voz.
- A versão de demonstração usa somente dados, documentos e contas fictícios. Não monitora computador, mensagens ou credenciais reais.
- A CV precisa de uma avaliação separada da aprendizagem: erro de extração não deve virar falha atribuída ao cidadão.

## Como validar o piloto e demonstrar os quatro requisitos?

### Takeaway
Cada alternativa deve provar primeiro que reconstrói corretamente um episódio e depois que a pessoa realiza outra tarefa sem assistência. Uma boa revisão do vídeo não demonstra impacto social.

### Cited Findings
- Os limites dos estudos ShieldUp! e Rozema/Davis acima justificam manter medidas de identificação, comportamento em simulação e efeito real separados. Nenhum deles avaliou nosso sistema.
- Northstar explicita uma oferta existente de prática guiada por avaliação; a tese de diferencial precisa demonstrar algo além disso. [Northstar](https://www.digitalliteracyassessment.org/features).

### Inferences
- **Diagnóstico da necessidade:** observar 5–8 pessoas do público escolhido numa tarefa e ouvir seus motivos e barreiras; registrar se o problema é conteúdo, interface, acesso a equipamento ou medo de errar.
- **Avaliação do extrator:** corpus pequeno com eventos anotados manualmente; incluir mudanças de layout, zoom e telas ambíguas. Medir quais estados/eventos são reconhecidos e quantos erros críticos ocorrem.
- **Avaliação da intervenção:** tarefa A sem ajuda → replay e microtreino → tarefa B equivalente com aparência ou dados novos → retorno após 48–72h. Alternar tarefas/order quando viável; comparar com uma instrução estática ou prática normal.
- **Medidas:** conclusão correta independente, erro crítico, ajuda necessária, transferência e abandono. Tempo pode ser secundário; apressar o usuário não equivale a autonomia.
- **Segurança educacional:** no simulador de golpes, gabaritos e narrativas revisados, sem links ativos maliciosos, sem solicitar segredos e sem qualquer promessa sobre mensagens/transações reais.
- **Demonstração dos requisitos:** mostrar pixels → evento com evidência (CV); evento → padrão calculado no histórico (dados); padrão → intervenção apoiada em referência (IA); processamento/estado persistente entre sessões (cloud).
- **Sustentação candidata:** universidade, biblioteca, telecentro ou organização comunitária como local de piloto e apoiador da manutenção; não presumir convênio confirmado. Expandir uma família de tarefas por vez.
- ODS10.2 pode se relacionar à inclusão; ODS4.4 ou4.6 dependem do público/habilidade. A ligação é proposta, não certificação nem resultado já produzido.

### Gaps
- Nenhum resultado medido, percentual de eficácia, garantia de emprego, prevenção de fraude ou parceria confirmada.
- Não foi feito levantamento exaustivo de concorrentes nem validação econômica.
- A triagem do público e a acessibilidade precisam existir fora da narrativa do pitch; uma pessoa sem dispositivo/conectividade continuará precisando de canal assistido.

