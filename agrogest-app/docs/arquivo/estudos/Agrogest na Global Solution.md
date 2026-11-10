# Agrogest na Global Solution

**O AgroGest é uma base viável para a GS, desde que seja concluído e testado um fluxo real de importação assistida de despesa.** Agricultura inteligente e desenvolvimento rural estão expressamente no enunciado, e o código oferece registros, indicadores e sincronização substanciais. Hoje, porém, o caminho auditado não comprova os quatro requisitos: a extração visual/IA é simulada. A entrega mínima recomendada é foto de recibo/DANFE → extração real no backend → revisão → preenchimento da despesa existente → aprovação/sincronização → indicador de custos. Isso aproveita a base do amigo sem ampliar o escopo para emissão fiscal, estoque ou um ERP novo. AgroGest passa a ser a direção ativa deste trabalho; pesquisas anteriores ficam preservadas como histórico.

Avaliação estática em **06/11/2026**, do repositório [freitasbtw/agrogest](https://github.com/freitasbtw/agrogest), commit [`7f0bb66d764eadc8f48be016280414d77a1d4799`](https://github.com/freitasbtw/agrogest/commit/7f0bb66d764eadc8f48be016280414d77a1d4799). O escopo é `agrogest-app`; integrações do legado não contam como recursos da versão atual. Não executamos app, testes, build ou serviços, nem alteramos o repositório do autor.

## O cidadão é quem registra e decide na rotina rural

Os requisitos do autor atribuem sua origem a entrevistas com produtor de recria/engorda e descrevem uso de planilhas, registros esquecidos, incorretos ou duplicados e dificuldade de apurar custos e compromissos. É uma necessidade documentada pelo projeto, sem evidência nesta auditoria de prevalência ou impacto resolvido. ([Requisitos do produto](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/REQUISITOS_PRODUTO.md#L3))

O público candidato é produtor rural e quem registra a rotina, como trabalhador ou familiar. **Pequeno produtor** é um recorte a validar, sem inferir porte ou vulnerabilidade pelo aplicativo. A proposta CitizenTech é reduzir retrabalho e melhorar a informação disponível para essas pessoas. O diferencial a demonstrar é adequação à rotina, revisão e continuidade do registro; não há comparação suficiente para alegar exclusividade.

## Dados e cloud têm implementação; extração ainda é mock

| Requisito | Estado no commit auditado | Evidência e limite |
|---|---|---|
| **Análise de dados** | Cálculos determinísticos implementados, ligados aos registros | GMD considera variação de peso por dia; orçamento soma despesas aprovadas e calcula realizado menos orçado. Isso é análise, sem ser IA. [GMD](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L230), [orçamento](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/reports.ts#L798) |
| **Cloud** | Cliente e contratos implementados; operação remota atual não verificada | Há Auth condicional, SQLite/outbox, RPC, ACK/versões e atualização do workspace. Configuração, migrations aplicadas e comportamento real precisam de teste. [Cliente](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/supabase.ts#L6), [sincronização](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/cloud-sync.ts#L67) |
| **Visão computacional** | Ausente no processamento fiscal lido | A tela envia só `file.name`; câmera/seletor não demonstram processamento de pixels. [Chamada](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L142) |
| **Inteligência artificial** | Inferência ausente nesse fluxo | `extractInvoice(_fileName)` ignora a entrada, espera 1,8 segundo e retorna `SAMPLE_EXTRACTION`. Os valores/confianças exibidos são preparados. [Serviço](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L48) |

A documentação declara extração real e anexos como futuros. Além disso, **NF está bloqueada no modo cloud**, tanto na tela quanto em `saveEntry`. Portanto, não basta configurar uma API, nem podemos dizer que a NF extraída já sincroniza. A existência das migrations e de relatos de testes na documentação também não significa que os reproduzimos. ([Estado da integração](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L3), [bloqueio na tela](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L100), [guard de persistência](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810))

## Uma importação para despesa fecha o escopo necessário

O caminho mais viável preserva o bloqueio de NF. A tela de despesa já valida valor, descrição, categoria e fazenda, montando `kind: 'despesa'` para `app.saveEntry`. Esse tipo segue o caminho conectado existente. **O adaptador que preenche o formulário a partir da extração ainda precisa ser implementado.** ([Formulário e dispatch](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/despesa.tsx#L145), [persistência cloud](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/state/app-state.tsx#L1810))

Escolher um documento de despesa operacional compatível com esse caminho, por exemplo recibo de serviço, sem mercadoria para estoque. O novo backend recebe os pixels, executa OCR/modelo multimodal e devolve JSON validado com sugestões de valor, data, descrição e fornecedor/documento, quando presentes. Campo ausente ou ilegível permanece pendente. Um mesmo modelo pode realizar leitura visual e interpretação; não é necessário treinar uma rede ou adicionar YOLO.

O usuário revisa, corrige e escolhe categoria, fazenda e rateio. Essas associações não são fatos garantidos pela imagem. O adaptador passa os valores às validações existentes; o lançamento segue a política de aprovação e sincronização. O indicador escolhido pode ser **orçamento versus realizado por categoria**, que só considera entradas aprovadas: a conferência dos campos não substitui a aprovação do domínio. ([Filtro e cálculo](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/reports.ts#L798))

Essa entrega exclui habilitação do módulo NF, estoque, parcelamento e recorrência novos. Não promete emissão/arquivamento fiscal nem orientação contábil ou veterinária. A credencial de inferência fica no servidor; fornecedor, custo e disponibilidade ainda serão escolhidos/verificados. O código oferece registro local, mas a inferência remota exige rede: não anunciar IA offline.

## A demo precisa provar o percurso inteiro

No vídeo, apresentar o problema de transcrição e um usuário concreto; mostrar dois documentos de teste distintos, com resultados diferentes; revisar um campo e deixar outro incerto; preencher/gravar a despesa, atingir estado aprovado e mostrar confirmação remota. Por fim, abrir o indicador e conferir o efeito esperado. Um caso de falha deve aparecer como falha, sem retorno silencioso à amostra pronta.

| Medida proposta | Como validar |
|---|---|
| Tempo manual versus assistido | Mesmo conjunto de campos, incluindo captura, espera e correções; tarefas comparáveis |
| Acerto por campo e revisão | Gabarito, ausências reconhecidas, correções e erros críticos; sem confundir confiança do modelo com precisão |
| Persistência sem duplicação | Interromper/reabrir/reconectar em ambiente de teste; conferir um registro confirmado após reenvio do mesmo comando e leitura remota |
| Efeito no indicador | Valor aprovado e categoria correta alteram o realizado uma única vez; conferir a conta manualmente |

Essas medidas ainda não existem. Um piloto curto pode estimar esforço e confiabilidade, sem provar aumento de renda ou produtividade. Reservar espaço relevante no pitch aos resultados e à validação, que valem **8 dos 20 pontos**; as demais dimensões valem três cada. O vídeo técnico tem até cinco minutos; link do YouTube não listado em `.txt` ou `.zip`, até **19/11/2026**.

Há **13 dias** desde esta avaliação. Proposta: 6–8/11 para alinhar colaboração e preparar o caminho técnico; 9–12/11 para extrator/adaptador; 13–16/11 para testar sincronização, aprovação, indicador e uso; 17/11 para gravar e 18/11 para revisar/publicar, preservando margem. É planejamento, não prazo de execução garantido. Custos de inferência, suporte e adoção serão estimados após o piloto.

ODS **2.3** é candidato forte se o recorte atender pequenos produtores e demonstrar acesso útil à gestão; não significa que o app dobrará renda. Metas ambientais e ODS 13 exigiriam intervenção e indicador próprios. ([ONU, ODS 2](https://brasil.un.org/pt-br/sdgs/2))

A base pertence ao projeto do amigo; colaboração, contribuições e atribuição devem ser alinhadas com o autor, sem inferir licença por ser público. O enunciado fornecido não estabelece proibição de reaproveitar código. **Adotar AgroGest é viável se concluirmos e testarmos esse importador; apresentá-lo hoje como IA visual existente seria incorreto.** A base não foi importada/adaptada neste workspace. As fontes e os limites estão preservados em `agrogest-app/docs/arquivo/pesquisas/Agrogest na Global Solution/`; relatórios anteriores permanecem históricos.
