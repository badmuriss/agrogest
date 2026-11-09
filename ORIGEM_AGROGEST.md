# Origem da base e repositório da faculdade

Preparação local em 06/11/2026, conforme [atualização do usuário](ATUALIZACAO_IA_E_REPOSITORIO.md).

| Campo | Registro |
| --- | --- |
| Projeto e responsável de origem | AgroGest, repositório de `freitasbtw`; autor do commit utilizado: **Freitassync**, conforme metadata Git |
| URL de origem | [freitasbtw/agrogest](https://github.com/freitasbtw/agrogest) |
| Commit da base | [`7f0bb66d764eadc8f48be016280414d77a1d4799`](https://github.com/freitasbtw/agrogest/commit/7f0bb66d764eadc8f48be016280414d77a1d4799), 27/10/2026, 13:28:16 −03:00 |
| Destino independente | `/data/projects/hobby/gs-final-fiap`, Git já existente, branch `main` |
| Histórico próprio preservado | HEAD `e4a5e8671d9cd80bfe3992b0dc3b77ef759c316e`; não houve commit, merge, reset ou substituição de `.git` nesta preparação |
| Remote do destino | Nenhum. Nome, proprietário e visibilidade de eventual novo remoto ainda não definidos |
| Clone de proveniência | `/data/projects/hobby/gs-final-fiap-preparacao/agrogest-origem-20261106`, criado por `git clone --filter=blob:none --no-checkout --origin source-readonly` da URL pública de origem |
| Snapshot de preparação | `/data/projects/hobby/gs-final-fiap-preparacao/snapshot-7f0bb66` |
| Conteúdo importado | 418 arquivos de `agrogest-app/`, mais `AGENTS.md`, `package.json` e `.gitignore` da raiz: **421 arquivos** antes das adições desta adaptação |

O snapshot foi obtido por `git archive` do commit fixado, sem copiar `.git` para dentro do destino. README, relatórios, pesquisa e instruções do usuário já existentes foram preservados; o README e o plano foram depois revisados conforme solicitado. O aplicativo importado mantém os bytes da origem; não começou a migração Supabase→Cloudflare. O `.gitignore` da raiz recebeu proteção adicional para configuração privada, estado local e pesos de modelos.

O [manifesto de importação](<research_notes/Agrogest Cloudflare local/importacao-base-20261106.json>) registra caminho, tamanho e SHA-256 de cada arquivo importado. Seus hashes representam o snapshot original, anterior à extensão declarada do `.gitignore`. As futuras alterações da equipe devem ser identificáveis em relação a essa base.

A [verificação registrada](<research_notes/Agrogest Cloudflare local/verificacao-copia-20261106.json>) confirmou os 418 arquivos do app idênticos, metadata/histórico próprios e documentos anteriores preservados, sem Git aninhado ou remote no destino. O TAP dos 114 testes anteriores manteve seu hash; os testes não foram repetidos nesta preparação.

Esta é uma **cópia local independente por snapshot**, sem operação de fork e sem merge de históricos não relacionados. O histórico próprio do workspace permanece no destino; o histórico de commits da origem permanece no clone de proveniência, com a referência local `refs/archive/agrogest-base-gs-20261106`. O clone é parcial: blobs não utilizados podem depender de leitura pública futura; ele não é anunciado como backup completo e autossuficiente de todos os arquivos históricos.

O remote de leitura do clone tem push URL inválida e hook `pre-push` de bloqueio. O destino independente não tem o repositório do amigo como remote. Nenhum push, publicação, criação de repositório remoto ou alteração no upstream foi feito. Os arquivos importados estão disponíveis para revisão local, sem incluir os documentos preexistentes em um commit automático.

`old-agrogest/` não foi importado para a árvore de trabalho. Não confundir a ausência desse diretório no destino com remoção do histórico da origem. O app atual, seus assets, lockfiles, testes e migrations foram preservados; migrations não foram aplicadas nem serviços iniciados.

Atribuição e condições de publicação continuam necessárias. Não foi localizado arquivo LICENSE/LICENCE/COPYING na árvore auditada; esta preparação autorizada pelo usuário não inventa uma licença para a base nem apaga autoria. A licença de um modelo de IA também não licencia automaticamente o aplicativo.

O [plano vigente](PLANO_AGROGEST_CLOUDFLARE_LOCAL.md) rege a adaptação. A aplicação/Workers/D1/R2 continuam locais; inferência em Workers AI do usuário ou OpenRouter está autorizada por configuração do backend. O [exemplo de configuração](config/inference.env.example) não contém segredos e ainda não é consumido pelo aplicativo de origem.


## Adaptação acadêmica iniciada em 06/11/2026

Após a preparação acima, a [autorização de desenvolvimento](AUTORIZACAO_DESENVOLVIMENTO_GS.md) permitiu alterar a cópia própria. O [guia atual](agrogest-app/docs/CLOUDFLARE_LOCAL.md) registra Worker/D1/R2 locais, OCR real e verificações. Os hashes do manifesto continuam representando **a base importada**, não o código adaptado. O `.git` e os documentos históricos não foram apagados; não houve fork/push/remote novo ou alteração no repositório original.

O vínculo EAS (`owner`/`projectId`) foi retirado do `app.json` desta cópia independente para não operar no projeto do amigo. A metadata original permanece no manifesto/snapshot de proveniência. A amostra fiscal constante foi movida de `services/nf-extraction.ts` para `tests/fixtures/historical-nf-extraction.ts`, fora do runtime. Migrations Supabase e testes PGlite foram mantidos para regressão local, sem aplicar SQL remoto. Estado de execução e pesos baixados são ignorados pelo Git; os 114 testes iniciais mantêm seu TAP original.


## Repositório independente no GitHub · 09/11/2026

Por solicitação explícita do usuário para fazer commit/push e criar o destino no GitHub, foi criado **[badmuriss/agrogest](https://github.com/badmuriss/agrogest)**, com visibilidade **pública**, sem fork. O remote `origin` desta cópia aponta para `https://github.com/badmuriss/agrogest.git`, na branch `main`. O commit inicial próprio `e4a5e8671d9cd80bfe3992b0dc3b77ef759c316e` permanece no histórico; nenhum reset ou substituição de `.git` foi necessário.

Entram no versionamento código, testes, fixtures sintéticas, lockfiles, assets de origem, documentação, pesquisas e evidências compartilháveis. Credenciais, `.dev.vars` privados, bancos/arquivos de execução em `.local/`, dependências, builds e pesos baixados permanecem ignorados e preservados localmente. O amigo instala Tesseract 5, Node 24 e Python, executa o setup e usa a própria configuração. O repositório é público para consulta e clonagem pelo amigo e pela equipe da FIAP.

Esta publicação é somente do código. Não autoriza deploy da aplicação nem altera o repositório original `freitasbtw/agrogest`. Os registros de 06/11 acima continuam descrevendo a preparação/validação naquela data.
