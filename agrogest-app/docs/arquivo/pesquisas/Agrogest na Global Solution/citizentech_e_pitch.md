# AgroGest como candidato à Global Solution

Avaliação em 06/11/2026 do repositório público no commit `7f0bb66d764eadc8f48be016280414d77a1d4799`. Inspeção estática por `git show HEAD:caminho`, sem checkout, instalação, execução, testes ou chamadas às APIs do aplicativo. Credenciais e dados pessoais não foram abertos; o repositório não foi alterado. A ideia de Libras permanece registrada: esta avaliação não a substitui.

## O AgroGest resolve um problema CitizenTech identificável?

### Takeaway

**Sim, o encaixe conceitual é forte.** Agricultura inteligente e desenvolvimento rural estão explicitamente no enunciado, incluindo pequenos produtores, informação, eficiência e geração de renda. O projeto não precisa atender governo nem ser uma startup inédita. Porém, a base atual ainda não demonstra os quatro tópicos técnicos obrigatórios: a importação visual com IA é simulação, não extração real.

### Cited Findings

- Os requisitos atribuem sua origem a entrevistas com um produtor de recria/engorda e descrevem controle em planilhas, registros esquecidos/incorretos/duplicados e dificuldade de apurar custo por lote e compromissos. Isso comprova o problema documentado pelo autor, não sua prevalência nem impacto resolvido. [REQUISITOS_PRODUTO.md:3–38](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/REQUISITOS_PRODUTO.md#L3).
- O modo Essencial tem resumo do rebanho, pesagem e atalhos operacionais em código; é uma adaptação para quem opera no campo, sem comprovar facilidade de uso real. [essential-home.tsx:14–38](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/components/home/essential-home.tsx#L14).
- Há fila persistente em SQLite, envio de comandos autenticados e tratamento de ACK/cache no cliente. Existência de código não demonstra implantação ou comportamento sob falhas em aparelhos. [cloud-sync.ts:32–46](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/cloud-sync.ts#L32); [67–130](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/cloud-sync.ts#L67).
- O cálculo do lote usa lançamentos aprovados, pesos e datas para indicadores como GMD e custo; distingue peso estimado em seu retorno. Isso sustenta análise de dados implementada, não melhoria da produtividade. [lot-metrics.ts:140–169](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L140); [230–251](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/domain/lot-metrics.ts#L230).
- A extração ignora o conteúdo do arquivo e retorna uma constante após espera; a tela passa somente o nome e bloqueia o fluxo em modo conectado. [nf-extraction.ts:48–50](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/services/nf-extraction.ts#L48); [nota-fiscal.tsx:100–102](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L100); [145](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/apps/mobile/src/app/novo/nota-fiscal.tsx#L145).

### Inferences

- Cidadão beneficiado candidato: produtor de pecuária de recria/engorda e quem registra a rotina — trabalhador rural ou familiar — com pouco tempo para transcrição e conexão irregular. O recorte de **pequeno produtor** é uma escolha de público a confirmar; tamanho e vulnerabilidade econômica não estão demonstrados no material inspecionado.
- Uma promessa de valor defensável é reduzir retrabalho e tornar o custo de um lote compreensível a partir de registros confiáveis. Não é necessário transformar o projeto em assistente genérico ou inventar visão computacional para pesar animais.
- Acesso offline, diferença de papéis e apresentação Essencial são bons diferenciais de adequação ao campo. Não são prova de acessibilidade, inclusão ou superioridade sobre outros aplicativos. A UX ainda lista validações de campo pendentes. [EXPERIENCIA_USUARIO.md:292–329](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/EXPERIENCIA_USUARIO.md#L292).

### Gaps

- O aplicativo documenta uma descoberta com produtor, mas não há nesta avaliação acesso aos registros da entrevista, teste com usuários ou economia observada. Não inventar número de fazendas, redução de custos ou renda adicional.
- Offline não significa que todos os recursos funcionem sem rede: a camada de satélite requer internet e a futura análise cloud da imagem também. O estado salvo localmente precisa ser distinguido de confirmado. [EXPERIENCIA_USUARIO.md:156–165](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/EXPERIENCIA_USUARIO.md#L156).
- Ler o projeto foi autorizado; reaproveitamento, contribuição e publicação ainda devem ser alinhados com o amigo. Não se localizou arquivo LICENSE/LICENCE/COPYING na árvore do commit. Não inferir uma licença a partir de o repositório ser público ou do campo npm `private`. A inspeção não determina condições jurídicas de uso.
- O enunciado fornecido não exige criação do zero nem estabelece proibição de reaproveitamento; também não substitui o cuidado com atribuição e contribuição real. Apresentar claramente o que já era do amigo e o que a equipe desenvolver, integrar e validar.

## Como atender à rubrica e qual demo única vale priorizar?

### Takeaway

A melhor demonstração proposta é **documento de compra de insumo → extração visual real → revisão → compra registrada uma vez → consumo atribuído ao lote → custo explicado**. É um fluxo futuro nas partes CV/IA, não uma demonstração pronta no commit. Ele conecta os quatro tópicos ao problema do cidadão e evita um passeio pelas muitas telas.

### Cited Findings

- A especificação fiscal se declara futura e propõe captura de imagem/PDF, extração, revisão, validação e aprovação; distingue compra de estoque de consumo e proíbe inferir condições ausentes. [IA_DOCUMENTOS_FISCAIS.md:3–15](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L3); [34–55](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/IA_DOCUMENTOS_FISCAIS.md#L34).
- O consumo de insumo, conforme regras documentadas, baixa estoque e apropria custo; a compra gera entrada e compromisso, sem lançar todo o valor imediatamente nos lotes. [REQUISITOS_PRODUTO.md:563–571](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/REQUISITOS_PRODUTO.md#L563).
- A UX propõe legibilidade, redução de movimento e suporte a leitor de tela, mas seus checklists não equivalem a auditoria de conformidade ou validação com trabalhadores. [EXPERIENCIA_USUARIO.md:14–23](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/EXPERIENCIA_USUARIO.md#L14); [292–309](https://github.com/freitasbtw/agrogest/blob/7f0bb66d764eadc8f48be016280414d77a1d4799/agrogest-app/docs/EXPERIENCIA_USUARIO.md#L292).

### Inferences

| Critério da GS | O que mostrar | O que ainda falta evidenciar |
| --- | --- | --- |
| Problema evidenciado — 3 pontos | Um produtor/operador, uma rotina concreta de transcrição e a consequência de um registro perdido ou duplicado | Relato verificável e um exemplo real anonimizado, sem tratar a documentação como pesquisa populacional |
| Público e adoção — 3 pontos | Quem captura, quem revisa e quem usa o resultado; recorte de propriedade/rotina e infraestrutura | Confirmar que o público escolhido consegue e deseja usar o fluxo; plano de piloto e apoio inicial |
| Impacto e valor — 3 pontos | Documento vira registro revisado; compra e consumo separados; custo explicável | Medir esforço total e erros antes/depois, incluindo a revisão humana |
| Diferencial — 3 pontos | Operação de campo com captura local, contexto, papéis, rastreabilidade e apresentação adequada | Comparação com o método atual do produtor; não alegar que concorrentes não têm esses recursos |
| Resultados, validação e sustentabilidade — 8 pontos | Baseline, teste do fluxo completo, indicadores, limitações, plano de implantação e manutenção | Resultados medidos ou, se ainda não houver, metas explicitamente prospectivas; custo por documento e por usuário ativo |

**Demo proposta, com fazenda/lote de demonstração já preparados:**

1. Mostrar a origem da informação: imagem/DANFE autorizado ou sintético identificado, com conteúdo legível. Enviar o conteúdo real, não somente nome de arquivo.
2. Extrair campos e apresentar a fonte para conferência; alterar um documento e mostrar que o resultado muda. Corrigir um campo ou deixar informação ausente como pendente. Uma animação de scanner não comprova visão computacional.
3. Registrar a compra sob a política efetiva da operação; mostrar estoque e compromisso gerados uma vez. Evitar exibir dados financeiros de terceiros.
4. Registrar um consumo parcial para o lote, mostrando o estado local e depois a confirmação/sincronização conforme o fluxo realmente implementado. Isso exige ensaio posterior; não afirmar que o arquivo da NF já persiste offline.
5. Abrir a composição do custo do lote e mostrar a ligação com o consumo. A compra não deve ser contabilizada como consumo integral, nem pagamento confundido com custo ou resultado.

**Tecnologias relacionadas ao fluxo:**

- Visão computacional: interpretar a imagem/layout do documento e obter informações visuais. XML ou CSV sozinho não demonstra esse requisito.
- IA: estruturar a interpretação e sugerir classificação entre destinos revisáveis; campos e somas são validados e a pessoa confere. Não é necessário incluir recomendação fiscal, financeira ou veterinária.
- Análise de dados: gerar indicadores a partir de registros confirmados e explicar sua base.
- Cloud: processamento real do arquivo e persistência/sincronização autorizada entre aparelho e backend. Migrations ou uma tela com a palavra Supabase não provam funcionamento remoto.

### Gaps

- Para tornar essa demo real, é preciso construir o caminho de arquivo/upload e extração, substituir o mock, integrar a revisão e ligar o fluxo conectado com referência persistente. Não é apenas fornecer uma chave de modelo.
- Se CV/IA continuarem simuladas, o AgroGest permanece uma base válida de produto rural, mas o pitch não demonstra a aplicação prática dos quatro tópicos obrigatórios.
- A demo deve usar o que estiver funcional na gravação. Se houver etapas planejadas, identificar como plano; dados sintéticos ou saída preparada precisam ser declarados.

## Qual mínimo medir e qual a decisão até 19/11?

### Takeaway

**Vale considerar a base se houver alinhamento com o amigo e capacidade de fechar um fluxo real CV/IA→revisão→registro→indicador.** Sem isso, a maturidade das outras telas não cobre a lacuna obrigatória. Não há necessidade de ampliar o ERP ou prometer IA zootécnica para torná-lo CitizenTech.

### Cited Findings

- A meta ONU **2.3** relaciona produtividade e renda dos pequenos produtores de alimentos a acesso a recursos, conhecimento, serviços e oportunidades. A meta **2.4** exige contribuição concreta para produção sustentável e práticas resilientes. [ONU — ODS 2](https://brasil.un.org/pt-br/sdgs/2), lido até EOF em 06/11/2026; snapshot em `evidencias-ods2/page.md`.

### Inferences

**Mínimo de validação proposto, sem fabricar resultados:**

- Identificar um produtor e uma pessoa que registre a rotina, quando forem pessoas distintas. Documentar o problema e o método atual, com autorização para usar relato/registro anonimizado.
- Comparar o tempo de registrar campos equivalentes pelo método atual e pelo fluxo assistido, incluindo captura, espera e correções. Usar documentos/tarefas comparáveis e registrar limitações de amostra e efeito de prática.
- Verificar campos extraídos contra gabarito: taxa de acerto por campo, ausências corretamente reconhecidas, correções, latência e custo por documento. Separar acerto da máquina do tempo poupado pelo cidadão.
- Ensaiar modo sem conexão, reabertura e posterior sincronização; conferir se nada some, duplica ou vira definitivo antes da validação. Esses são testes a fazer depois, não executados nesta inspeção.
- Conferir um cenário do início ao fim: quantidade em estoque, consumo, obrigação e custo não duplicados. Verificar entendimento de salvo localmente, pendente e confirmado.
- Registrar se a pessoa conclui a tarefa sem ajuda e se deseja continuar após o teste. Legibilidade no aparelho e contexto real importam mais que quantidade de telas.
- Para sustentabilidade, estimar custo de processamento, suporte e implantação com o piloto; assinatura acessível, parceria ou adoção por associação são hipóteses até validação. Não há mercado dimensionado nesta revisão.

**ODS:** 2.3 é candidato forte se o piloto realmente atender pequenos produtores e demonstrar acesso útil à informação/gestão. Não afirmar que o aplicativo dobra renda/produtividade. 2.4 e 13 só devem entrar com intervenção ambiental e indicador correspondentes; controle financeiro, GMD ou mapa de pasto isoladamente não demonstram benefício climático.

**Vídeo:** priorizar problema/público, uma demo curta do fluxo e os indicadores/validação, dando espaço proporcional aos 8 pontos de resultados. O pitch técnico deve ter até cinco minutos; publicar no YouTube como não listado e entregar o link em `.txt` ou `.zip` até 19/11, conforme o enunciado. O pitch opcional de três minutos não substitui o obrigatório.

### Gaps

- Nenhum teste, instalação, chamada ao backend/modelo ou coleta de dados do aplicativo foi realizada nesta tarefa; a avaliação não comprova produção, deploy, performance nativa ou integridade sob falhas.
- Licença, contribuição, autorização de uso e divisão de autoria precisam ser alinhadas para eventual aproveitamento. Não se modificou o projeto nem se autorizou automaticamente sua publicação.
- Fontes de comportamento são docs/código do commit; evidência de utilidade/impacto depende do piloto. O único acesso externo complementar foi a página oficial do ODS 2, preservada com recibo, hash informado pelo serviço e leitura completa. Nenhum hash de bytes brutos ou custo total em créditos foi medido.

