# Libras com prática visual: visão e viabilidade

Consulta de 05/11/2026 para uma plataforma de aprendizagem de Libras. Escopo: demonstrar prática visual útil até 19/11/2026, sem alegar tradução geral, certificação ou correção linguística já resolvida. Nenhum produto foi implementado, dependência instalada ou base de vídeos baixada. Skill de pesquisa e workflow de documentação primária seguidos; índices acadêmicos/Firecrawl indisponíveis. Documentação: Scrapinho MCP, escopo `gs-final-fiap-citizentech-20261105`, IDs `gs2-libras-cv-*`, uma tentativa e limites; quatro fontes completas lidas até EOF e preservadas em `fontes/`. Literatura/metadados: host web com fontes primárias e limites explicitados abaixo.

**Atualização do usuário nesta sessão:** ainda não há professor, intérprete ou pessoa surda para cocriar/validar. Portanto, o MVP imediato é de captura, visualização e comparação observável, com estados de revisão explícitos. Os 3–5 critérios de prática linguisticamente validados são uma etapa posterior condicionada a obter essa colaboração, e não algo disponível hoje.

## O que landmarks conseguem observar e o que permanece linguístico?

### Takeaway

É viável obter uma representação visual de mãos/corpo/face no navegador e demonstrar critérios pequenos, explícitos e validados. Essa representação não determina sozinha qual sinal foi feito, se o sinal está linguisticamente correto ou se o aluno aprendeu. O gargalo principal é a rubrica e a validação com pessoas que dominam Libras, especialmente erros reais de iniciantes e variantes aceitáveis.

### Cited Findings

| Recurso confirmado | Observação produzida | O que não entrega por si | Fonte primária, acesso em 05/11/2026 |
|---|---|---|---|
| MediaPipe **Hand Landmarker** | 21 pontos por mão, coordenadas de imagem e estimadas em espaço 3D, classificação esquerda/direita; modos imagem/vídeo e múltiplas mãos configuráveis | Identidade e correção de um sinal, gramática, contato efetivo entre dedos ou explicação de erro | [Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js); `fontes/gs2-libras-cv-hand-doc-v1/page.md` |
| MediaPipe **Pose Landmarker** | 33 pontos corporais, coordenadas e indicadores de visibilidade/presença | Configuração detalhada da mão ou interpretação dos parâmetros linguísticos | [Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js); `fontes/gs2-libras-cv-pose-doc-v1/page.md` |
| MediaPipe **Face Landmarker** | 478 pontos faciais e, opcionalmente, 52 coeficientes de expressão e matrizes de pose | Validar marcadores não manuais de Libras ou inferir compreensão, emoção ou domínio do aluno | [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js); `fontes/gs2-libras-cv-face-doc-v1/page.md` |
| MediaPipe **Gesture Recognizer** padrão | Classifica sete gestos comuns mais estado desconhecido; inclui `ILoveYou`, que a própria documentação identifica como ASL | Dicionário de Libras, reconhecimento geral de sinais dinâmicos ou avaliação pedagógica | [Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer); `fontes/gs2-libras-cv-gesture-doc-v1/page.md` |

As docs de mão dizem que esquerda/direita correspondem à pessoa filmada e que espelhar a imagem de entrada inverte os rótulos. Também diferenciam a origem das coordenadas 3D da mão, centrada nela, da origem de pose corporal nos quadris. Portanto, não combinar os dois espaços como se constituíssem uma medição global calibrada. Vídeo requer sequência e timestamps; receber resultados por frame não produz automaticamente um modelo da sequência linguística. [Mão](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js); [corpo](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

### Inferences

- **Três problemas distintos:** reconhecer a classe pretendida; avaliar aspectos da execução; produzir feedback que ajuda a aprender. Mesmo acurácia alta no primeiro não valida os outros dois.
- Para um sinal dinâmico, uma foto não comprova trajetória, direção, repetição ou coordenação entre as mãos. Registrar um clipe com início/fim ou janela temporal orientada.
- Quando a rubrica envolver duas mãos, configurar e verificar ambas; não interpretar mão não detectada como erro do aluno. Oclusão, desfoque e corte devem produzir nova captura ou abstenção.
- Usar a pose corporal como referência para critérios relativos em imagem, com limitações de perspectiva explícitas; evitar distância 3D mão–corpo calculada sobre origens incompatíveis.
- Espelhamento para o aluno se ver é decisão de apresentação. Manter clara a diferença entre imagem de inferência e imagem exibida; não transformar automaticamente execução canhota em erro. Referências e rubricas devem registrar variante/região e mão dominante quando relevantes.
- Uma distância entre sequências, similaridade com referência ou confiança de classificação não deve aparecer como “92% de Libras correto”. Sem calibração com julgamentos humanos, esse número não representa porcentagem de correção.
- Face pode integrar a captura desde cedo para manter a evidência, mas a demo não precisa atribuir nota automática à expressão. Uma execução pode atender ao critério manual examinado e ainda depender de revisão linguística.

### Gaps

- Não há teste deste projeto em dispositivos, iluminação, idades ou perfis motores. As docs demonstram APIs, não desempenho da aplicação.
- Não foi verificada equivalência linguística entre uma forma geométrica e um sinal escolhido. Nenhuma lista final de 3–5 sinais deve ser fixada sem orientação especializada.

## Que bases e pesquisas realmente de Libras são adequadas?

### Takeaway

Existem dados e trabalhos de Libras, mas não foi encontrado nesta coleta um conjunto pronto de feedback pedagógico validado para nossos iniciantes. Algumas bases recentes são restritas; dados sintéticos de mãos são acessíveis como metadados, porém não resolvem sinais completos nem generalização para pessoas reais. Essas limitações não impedem uma demo de medição pequena e honesta.

### Cited Findings

| Fonte e status verificado | O que foi disponibilizado/testado | Adequação e licença/acesso nesta leitura |
|---|---|---|
| **LSWH100**, artigo publicado em *Data in Brief*, 2024, DOI `10.1016/j.dib.2024.110780` | Dataset sintético de configurações de mão usadas em Libras, produzido no Blender, com 100 classes e anotações de mão. Não é estudo de aprendizagem ou avaliação de erros de alunos | Bom recurso para estudar representação manual; não demonstra sinais dinâmicos, duas mãos, corpo/face ou generalização humana. O **artigo** informa CC BY-NC; a licença do **dataset** não ficou legível no registro consultado, portanto não inferir que é a mesma. [Artigo](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357844/); [metadados do dataset](https://zenodo.org/records/10635628), acesso 05/11/2026 |
| **Libras-UFPel Corpus**, publicado nos anais de PROPOR 2026/ACL, abril de 2026 | Recurso paralelo audiovisual com sinais/frases e camadas de anotação, incluindo marcadores não manuais | Sustenta que anotação linguística vai além de mão. A página consultada descreve o corpus, não valida corretor de iniciantes nem eficácia pedagógica; licença de reutilização do corpus não foi confirmada. [Publicação](https://aclanthology.org/2026.propor-1.112/), acesso 05/11/2026 |
| **Captar-Libras**, página institucional dos autores, 2026 | Libras no domínio médico, múltiplas vistas, anotações temporais e recomendação de separar sinalizadores entre treino/validação/teste | Acesso credenciado e condicionado a termos; não baixar ou depender de liberação no prazo. O site atribui o trabalho a NeurIPS 2026, mas o link de paper retornou à própria página: publicação/versão integral não foi confirmada independentemente. Não chamar automaticamente de artigo já revisado/publicado nem de preprint lido. [Projeto](https://verlab.github.io/captar-libras/), acesso 05/11/2026 |
| **Apoema-Libras560/84**, registro de dataset, maio de 2026 | Vídeos RGB/depth, sete sinalizadores e partições separadas por pessoa; no conjunto maior, teste com uma pessoa | Restrito para pesquisa acadêmica não comercial, com acordo e solicitação por orientador. Não fornece validação de feedback ou aprendizagem; teste com uma pessoa limita diversidade. Não é base imediatamente liberada ao aluno. [Registro e termos](https://zenodo.org/records/20421823), acesso 05/11/2026 |
| **A Gait Energy Image-Based System for Brazilian Sign Language Recognition**, código/documentação dos autores; a citação identifica artigo em *IEEE TCAS-I*, 2021, DOI `10.1109/TCSI.2021.3091001` | Método de representação de movimento e classificação de sinais em três datasets de Libras; o README explica extração corporal, redução de dimensionalidade e classificação | Evidência de investigação de **reconhecimento**, sem demonstração de correção de iniciante ou aprendizagem. O README/citação foi lido; artigo integral e figuras de resultados não foram auditados, portanto não reproduzir acurácias. Licença MIT indicada no repositório não cobre automaticamente os datasets citados. [Repositório dos autores](https://github.com/wesleylp/libras), acesso 05/11/2026 |

### Inferences

- Para feedback corretivo, exemplos de sinais corretos não bastam: são necessários rótulos de aspectos, variantes aceitáveis, incertezas e erros reais, idealmente julgados por educadores surdos. Uma classificação “classe X” não explica qual parâmetro precisa mudar.
- A avaliação deve manter a mesma pessoa, suas sessões e seus frames numa única partição; um frame quase igual de alguém já visto no treino não demonstra generalização. Se houver poucos participantes, reservar pessoas para avaliação externa e descrever o teste como piloto restrito.
- O baseline possível para a demo é medição de características explicitamente rubricadas, sem treinar do zero uma rede ampla. Usar vídeo de referência próprio/autorizado e exemplares consentidos é um caminho de planejamento; nenhuma gravação foi solicitada ou coletada nesta pesquisa.
- Distância temporal, DTW ou protótipo de landmarks podem ajudar a alinhar sequências, mas não devem ser convertidos diretamente em nota linguística. Também podem tolerar um erro essencial ou penalizar uma variante legítima.

### Gaps

- **MINDS-Libras:** o registro Zenodo tentado não ficou acessível pela ferramenta; não houve nova tentativa por outro transporte. Licença, partição e disponibilidade não foram adotadas como confirmadas nesta nota.
- Após uma leitura inicial bem-sucedida do artigo LSWH100, uma consulta de trecho em PMC retornou reCAPTCHA; a coleta naquele alvo foi interrompida. O registro público Zenodo foi lido, mas o campo de licença veio vazio; a API de metadados não ficou acessível. Nenhuma licença foi inferida dessas falhas.
- O permalink HTML de um paper de classificação cruzada da CVF retornou 403 e não foi contornado via PDF ou outro transporte. Seus resultados não são usados aqui.
- Não foi feita busca exaustiva de datasets ou literatura. Não afirmar que não existe trabalho de avaliação pedagógica de Libras no mundo.

## Qual demo é executável até 19/11 e como demonstrar os quatro requisitos?

### Takeaway

Recomendação imediata: **captura guiada, visibilidade de mãos/corpo, traçado da execução, comparação visual descritiva e progresso com estado de revisão**. Em seguida, buscar validação para 3–5 sinais/aspectos, referência autorizada e feedback pedagógico aprovado. A ausência atual de especialista não bloqueia ideação, UX ou medição visual; impede apresentar essas medidas como correção linguística ou prova de aprendizagem.

### Cited Findings

- As APIs de navegador confirmam que se pode processar imagem/vídeo e obter pontos de mãos, corpo e face; elas não fornecem uma nota de Libras. [Mãos](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js); [corpo](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js); [face](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js).
- O corpus UFPel inclui camadas de marcadores não manuais, e o Captar registra corpo, mãos e face com alinhamento temporal. Isso fundamenta preservar essas dimensões quando o sinal as exige, sem dizer que o app já as avalia. [UFPel](https://aclanthology.org/2026.propor-1.112/); [Captar](https://verlab.github.io/captar-libras/).

### Inferences

**Fluxo imediato da demo:** entrar na atividade proposta → enquadrar mãos/tronco/face → gravar uma tentativa curta → receber orientação de captura, como parte fora do quadro ou mão não rastreada → visualizar trajetória/pontos e repetir → guardar tentativa como praticada, sem selo de sinal correto. A tela de referência e a comparação entre execuções podem ser prototipadas com conteúdo cuja autorização seja registrada, sem pressupor que exista hoje um catálogo licenciado e validado.

**Fluxo futuro com colaboração:** referência aprovada com replay/velocidade controlada → captura conforme critério → observação validada → intervenção curta → nova prática → teste independente e revisão humana. Não apresentar esse fluxo futuro como funcionalidade pedagógica já comprovada.

**Arquitetura proposta:**

1. **Navegador:** câmera com consentimento, vídeo de referência, landmarks e feedback visual. Processamento local de landmarks é uma opção para reduzir envio de vídeo; o comportamento em aparelhos reais precisa de teste. Guardar versão de modelo/rubrica e timestamps; manter um contrato claro de espelhamento.
2. **Gating:** verificar presença/visibilidade, duração suficiente, mão necessária e integridade da tentativa. Se faltar evidência, apresentar “não consegui avaliar este aspecto” e orientar nova captura; não registrar automaticamente como execução errada.
3. **Critério de prática:** comparar apenas o aspecto validado — por exemplo, uma relação de posição, configuração manual restrita ou direção de trajetória que o especialista considere observável e pedagogicamente apropriada. Mostrar a região/trecho usado e a explicação aprovada. Nunca marcar o sinal completo como correto por cumprir um único aspecto.
4. **IA:** o modelo neural de percepção já produz a estimativa visual. Se houver uma segunda camada de IA, ela pode selecionar/explicar intervenções de um catálogo aprovado usando o histórico confirmado; não deve inventar sinal, variante ou justificativa linguística. Não é obrigatório adicionar LLM para parecer mais inteligente.
5. **Dados:** medir cobertura visual, eventos de prática, aspecto validado/pendente, correções humanas, ajuda utilizada e resultado posterior. Esses dados alimentam a escolha da próxima prática. Evitar XP como substituto de competência ou um percentual de correção sem validação.
6. **Cloud:** API e banco para lições/rubricas versionadas, referências autorizadas, sessões de prática, fila de revisão e plano de revisões entre dispositivos. Vídeo pessoal só é enviado quando necessário e autorizado; definir retenção e exclusão. Landmarks associados a uma pessoa continuam dados a proteger, sem promessa automática de anonimato.

**Escopo em três níveis:**

| Nível | Entrega defensável | Estado da promessa |
|---|---|---|
| Demo técnica e produto imediata | Captura real; landmarks; gating de visibilidade; trajetória/comparação descritiva; repetição e progresso cloud com revisão pendente | Implementável como recorte técnico sem parceiro atual; não valida a execução de Libras |
| Pequeno conjunto validado | 3–5 aspectos/sinais, referências autorizadas e orientações aprovadas | Etapa condicionada a conseguir colaboração especializada e testar os critérios; não é premissa atual |
| Piloto de feedback | Rótulos de especialistas sobre erros/casos corretos e pessoas não vistas; estimativa de falsas correções e casos recusados | Precisa dados consentidos e validação, sem percentual geral antecipado |
| Correção linguística ampla | Sinais/frases livres, duas mãos, movimentos, contato, expressões/gramática, variantes regionais e diversidade de usuários | Pesquisa e desenvolvimento mais longos; não faz parte da promessa da demo |

**Avaliação técnica necessária:** comparar cada observação/feedback com julgamento humano, registrar falsas correções e abstenções, além de perda de tracking. Separar problema de câmera de problema de execução. Incluir exemplos aceitáveis diferentes do vídeo de referência. Pessoas de teste não devem ser usadas para ajustar o critério e depois continuar sendo chamadas de teste.

**Avaliação da aprendizagem:** tentativa inicial sem ajuda; prática; tarefa/produção posterior sem dica ou vídeo simultâneo; avaliação cega por educador surdo; repetição após alguns dias. Se possível, comparação com prática pelo vídeo sem o feedback automático. Reconhecimento do modelo, satisfação e conclusão de lição não demonstram retenção ou comunicação funcional. Piloto pequeno serve para viabilidade e sinais de efeito, sem alegação causal/populacional.

**Acessibilidade funcional:** nenhuma informação indispensável apenas em áudio; controles de vídeo por teclado; contraste e texto legível; mensagem de erro que não dependa só de cor; repetição e ajuste de velocidade; alternativa de revisão humana quando perfil motor/câmera impedir o critério automático. A acessibilidade deve ser experimentada com o público, sem selo de conformidade por suposição.

**Decisão no início do desenvolvimento:** se não houver rubrica e referências autorizadas para correção, a versão honesta demonstra captura, prática guiada, qualidade visual e revisão humana. Não fabricar um corretor linguístico com landmarks genéricos para preencher o pitch.

### Gaps

- Nenhuma estimativa de preço, FPS, latência ou acurácia foi feita. Ainda faltam escolha de modelos/versões, recursos de backend e teste em aparelho alvo.
- Nenhum educador, sinal, variante ou parceiro foi contratado/contatado. Esses são insumos para concretizar a demo, não autorização inferida para enviar mensagens.
- Os arquivos em `fontes/web-academico-*.json` preservam retornos do host web; cobertura limitada de metadados/README/abstract não é artigo integral lido. Os quatro documentos MediaPipe foram preservados completos via MCP.
- Créditos/custo monetário da aquisição são desconhecidos; manifestos conservam tentativas e bytes. Hashes de serviço não foram comparados com bytes brutos exportados.
