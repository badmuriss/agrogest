# AgroGest para a Global Solution

A versão acadêmica já executa **imagem → OCR real em português → revisão → despesa → aprovação por outro sócio → indicador calculado**, usando frontend Expo web, Worker, D1 e R2 **locais**. Desenvolvimento autorizado em [AUTORIZACAO_DESENVOLVIMENTO_GS.md](AUTORIZACAO_DESENVOLVIMENTO_GS.md). O código está no [repositório público da entrega FIAP](https://github.com/badmuriss/agrogest), sem fork. Aplicação e dados continuam locais, sem deploy/provisionamento remoto.

## Rodar

Node 24.10+ da linha 24, npm e Docker local com Compose v2+ e containers Linux. Python, Tesseract e modelo português ficam na imagem; não precisam ser instalados na máquina. Na raiz:

```sh
npm run setup:local
npm run build:web
npm start
```

Abra **http://127.0.0.1:8787/entrar**. Ana: `ana@agrogest.local`; Bruno: `bruno@agrogest.local`; senha pública de demonstração local: `AgroGest2026!`. Há também `campo@agrogest.local` (funcionária) e `isolado@agrogest.local` (outra operação). Dados são sintéticos; cadastro/recuperação por e-mail não estão implementados nesta versão.

O [guia de execução e contratos locais](agrogest-app/docs/CLOUDFLARE_LOCAL.md) explica instalação, dados persistentes, contas, roteiro, inferência, testes e limites. Não apague `.local/` nem os dados do navegador ao reiniciar.

## Demonstrar

Entre como Ana, abra **Despesa → Importar imagem de comprovante**, escolha uma imagem e confira os campos lidos. Dois recibos sintéticos em `agrogest-app/tests/fixtures/` permitem reproduzir a extração com valores diferentes. A revisão leva ao formulário de despesa existente, com categoria e rateio confirmados pela pessoa. O documento original fica anexado e protegido por conta/operação.

Bruno aprova a despesa de Ana; ela não pode aprovar o próprio registro. Depois do GS-001 (R$ 1.250,40), o lote inicial passa de R$ 10.000,00 para **R$ 11.250,40**, ou **R$ 1.125,04/cabeça**. Pendências não entram nesse custo. Capturas/revisões ficam no SQLite por conta; envios sem rede ficam na outbox e são validados ao reconectar. Hash documental e ID de comando impedem efeitos duplicados.

## Inferência e GS

O OCR usa **Tesseract 5 + modelo neural português em container local, por CPU**, com bytes da imagem, texto/caixas/confiança e revisão. `npm start` inicia o container e o backend local. Não exige GPU. O modelo é incluído na construção da imagem; a inferência não baixa pesos. A amostra constante do protótipo foi retirada do código usado pelo aplicativo e preservada apenas como referência histórica em testes.

Workers AI do usuário e OpenRouter estão autorizados como alternativas, chamados pelo **backend local**, sem publicar o app. Seus adaptadores existem, mas **não houve inferência remota nesta sessão por falta de credenciais configuradas**. Use o [exemplo privado do backend](agrogest-app/apps/api/.dev.vars.example); chaves nunca pertencem ao frontend, Git ou logs. O amigo usará suas próprias contas/configurações. A comparação local/Hugging Face versus provedores remotos, licenças e recursos foi preservada no [plano atualizado](PLANO_AGROGEST_CLOUDFLARE_LOCAL.md).

Há IA/CV reais locais e indicadores de dados. **Emulação não comprova uso real de cloud**, que ainda precisa ser evidenciado para a GS por uma inferência remota validada ou outra etapa autorizada. RF-20 é parcial: imagens/comprovantes estão integrados; PDF/XML, extração fiscal completa, manuscritos e validação com corpus de campo continuam pendentes. Android/iOS foram exportados para verificação, sem teste em aparelho ou geração de APK/IPA.

## Verificação

```sh
npm test
npm run test:api
npm run test:ocr
npm run typecheck
npm run lint
npm run build:web
npm run export:check
```

Os **114 testes da análise inicial** permanecem com seu [TAP original](<research_notes/Agrogest Cloudflare local/baseline-local-20261106.tap>). Em **09/11/2026**, **233 testes passaram**, com tipos/lint e fluxo no navegador usando OCR em Docker. Os 231 testes e exports web/Android/iOS de **06/11** continuam como evidência anterior, separados da execução atual no [histórico consolidado](agrogest-app/docs/HISTORICO_REVISOES.md).

## Origem e entrega

A base é [freitasbtw/agrogest](https://github.com/freitasbtw/agrogest), commit [`7f0bb66d764eadc8f48be016280414d77a1d4799`](https://github.com/freitasbtw/agrogest/commit/7f0bb66d764eadc8f48be016280414d77a1d4799), autor **Freitassync**. A cópia por `git clone` e importação isolada preservaram autoria, documentos e metadata Git próprios, sem Git aninhado. O remote `origin` aponta para `badmuriss/agrogest`, público e independente. [Proveniência e manifesto](ORIGEM_AGROGEST.md). Não foi inventada licença para a base. O repositório público pode ser consultado e clonado pelo amigo e pela equipe da FIAP. O repositório do amigo não foi alterado.

A entrega da GS segue os [requisitos fornecidos](GLOBAL_SOLUTION_2_REQUISITOS.md): vídeo técnico de até cinco minutos, YouTube não listado e link em `.txt`/`.zip` até **19/11/2026**. O código está público no repositório próprio; não houve publicação de vídeo, deploy do aplicativo nem medição de impacto em produtores. O [parecer anterior](<reports/Agrogest na Global Solution.md>) e a análise do plano continuam identificados como históricos.
