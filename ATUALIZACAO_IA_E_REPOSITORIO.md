# Atualização do usuário — IA, contas e repositório independente

06/11/2026. Esta instrução corrige o primeiro handoff e o primeiro plano. Em caso de conflito, esta atualização prevalece.

## O que permanece local e o que pode ser remoto

- O aplicativo, Workers/D1/R2 de desenvolvimento e dados de teste continuam sem deploy/provisionamento remoto nesta fase.
- A proibição de deploy do aplicativo NÃO é uma proibição de inferência remota.
- O usuário autorizou utilizar Workers AI na sua conta e, como alternativa, OpenRouter com suas credenciais.
- Visão/OCR local é uma preferência se houver solução adequada, não um bloqueio obrigatório. Avaliar modelos disponíveis pelo Hugging Face para execução local, com licença, hardware, qualidade e instalação considerados.
- Hugging Face não significa automaticamente inferência local: distinguir download/execução de modelo de serviços hospedados. Os provedores remotos explicitamente autorizados agora são Workers AI e OpenRouter.
- Workers AI continua sendo execução remota. Isso é permitido para a IA nesta atualização, mesmo que o aplicativo não seja publicado.
- Não voltar a usar mocks como se fossem extração real, nem exigir um modelo local inadequado apenas para cumprir a restrição antiga.

É permitido consultar documentação, baixar a base pública e preparar o clone independente. Continuar pela análise e revisão do plano antes de uma implementação ampla.

## Separação de contas e manutenção futura

O projeto original é do amigo, que deverá continuar mantendo a solução. A versão para a faculdade deve ser independente, sem poluir a base dele. O usuário pode financiar a inferência temporariamente.

Recomendação de arquitetura a avaliar no plano:

1. Desenvolver o aplicativo localmente, chamando o provedor de IA autorizado pelo backend.
2. Manter credenciais do usuário em configuração local ignorada pelo Git, nunca no frontend, nas capturas ou no código compartilhado.
3. Criar uma interface de provedor de extração para trocar entre local, Workers AI e OpenRouter por ambiente.
4. Preparar a entrega com configurações de exemplo sem segredos e documentação para o amigo usar a própria conta/chave depois.
5. Separar conta de hospedagem/dados da conta temporária de inferência. Evitar IDs e credenciais pessoais fixos no domínio do app.

O usuário cogitou hospedagem temporária na própria conta, mas não definiu essa escolha. Como a fase atual é análise/plano, não publicar o aplicativo agora. Comparar hospedagem futura na conta do amigo e eventual ambiente temporário; uma decisão posterior pode autorizar o deploy concreto.

Não procurar/imprimir segredos. Se as credenciais autorizadas não estiverem configuradas, registrar a dependência e os nomes de configuração necessários; a análise pode continuar. Testes de inferência, quando apropriados, devem ser pequenos e com documentos de teste, usando apenas os provedores autorizados.

## Clone e repositório de destino

Pedido explícito: fazer `git clone` da base e preparar OUTRO repositório independente para a faculdade. Não usar a operação de fork nem alterar o repositório original do amigo.

- O workspace `/data/projects/hobby/gs-final-fiap` já tem Git e documentos que devem ser preservados.
- Preparar uma cópia isolada da base, sem sobrescrever esse workspace ou os arquivos existentes.
- Não criar um Git aninhado acidental dentro do repositório de destino. Pode-se clonar em área de preparação e planejar/importar o snapshot necessário para o repositório próprio, preservando sua metadata Git.
- Não usar o remote do amigo como destino de push; não executar push, merge, force-push ou publicação na base original.
- Registrar origem, autor e commit utilizado. Independência do repositório não significa apagar atribuição nem reescrever o aplicativo inteiro.
- Não apagar histórico ou dados existentes para obter uma base independente. Se for necessário escolher entre histórico próprio e preservação do histórico de origem, explicitar a decisão e preservar a proveniência.
- Criar/publicar um novo repositório remoto exige definir destino/nome/visibilidade. Nesta fase, a preparação local não deve depender dessa publicação.

## Trabalho imediato da nova sessão

Leia esta atualização, confira o plano já entregue e revise `PLANO_AGROGEST_CLOUDFLARE_LOCAL.md` e README para remover a regra antiga de inferência obrigatoriamente local.

Incluir no plano:

1. Preparação da cópia/repositório independente e fronteiras em relação ao upstream.
2. Comparação focada de OCR/visão/modelo local pelo Hugging Face versus Workers AI versus OpenRouter, usando documentação e model cards atuais, sem presumir capacidade ou preço.
3. Estratégia de contas, credenciais e passagem da manutenção para o amigo.
4. Fluxo real de imagem → extração → revisão → despesa → indicador, mantendo a migração Cloudflare e os critérios da GS.
5. Distinção entre infraestrutura local/emulada e inferência que efetivamente acontecer na nuvem. Não anunciar chamadas ou testes ainda não executados.

Não iniciar deploy. Não reabrir alternativas de projeto descartadas. A direção permanece AgroGest.
