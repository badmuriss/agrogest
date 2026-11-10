# Desenvolvimento e manutenção

Tipo: guia prático. Atualização acadêmica: **10/11/2026**.

## Execução vigente da faculdade

Na raiz, execute `npm run setup:local`, `npm run build:web` e `npm start`; abra **http://127.0.0.1:8787/entrar**. Node 24, npm e Docker local com Compose v2+ e containers Linux são os pré-requisitos. Python/Tesseract/modelo português ficam no container OCR e executam por CPU. A [IA visual opcional](CLOUDFLARE_LOCAL.md#ia-visual-local-opcional) tem setup separado; neste ambiente, o backend usa o modelo local com GPU. O [guia Cloudflare local](CLOUDFLARE_LOCAL.md) é responsável por contas, três lockfiles, scripts, migrations D1 locais, OCR, estado persistente, configuração privada e comandos completos de validação.

Tipos e lint mobile são obrigatórios. `npm run check` reúne tipos/lint, suíte herdada, integração API e testes OCR em container. Para alterações no frontend, execute também `npm run build:web` e `npm run export:check`. O banco/arquivos de desenvolvimento não saem do computador. Não usar EAS, túnel, deploy ou Supabase remoto nesta fase.

Novos diretórios: `agrogest-app/apps/api/` (Worker e migrations), `agrogest-app/services/extraction/` (OCR), `scripts/` na raiz (build/execução locais). O app mobile permanece em `apps/mobile/`, com SQLite v15 e novo cliente HTTP; o SDK Supabase foi removido. Ao recompilar o SPA, reinicie o Worker.

## Revisão em outra máquina · 09/11/2026

O código está no repositório público independente [badmuriss/agrogest](https://github.com/badmuriss/agrogest). Para revisar ou executar a entrega, clone e entre na pasta:

```sh
git clone https://github.com/badmuriss/agrogest.git
cd agrogest
```

Inicie o daemon Docker local e use os três comandos de execução vigente acima. O setup constrói a imagem com modelo português verificado; o OCR executa no computador do backend em `127.0.0.1:8091`, iniciado junto com `npm start`. Consulte o [ciclo do container](CLOUDFLARE_LOCAL.md#ciclo-do-container-ocr) para parada, recursos e alternativa nativa. Banco/arquivos de execução e segredos não são compartilhados pelo Git; a primeira execução cria os dados sintéticos das migrations locais, sem apagar os existentes. As evidências de 06/11 e 09/11 ficam separadas no histórico.

## Procedimentos de outubro preservados como histórico

Os comandos e modos Supabase/túnel abaixo descrevem a origem até 26/10/2026. Não são o procedimento vigente desta cópia nem autorização para executar serviços remotos.

## Ambiente

Use Node.js 24.10+ da linha 24 e npm. A suíte usa `node:test`, TypeScript nativo do Node,
`node:sqlite` e PostgreSQL via PGlite; não exige Docker nem um banco remoto.
Os lockfiles são independentes e devem ser respeitados com `npm ci`:

```sh
# Na raiz do repositório
npm ci --prefix agrogest-app
npm ci --prefix agrogest-app/apps/mobile
npm start
```

`npm run web` abre a variante web. No celular, use Expo Go compatível com SDK 58 ou um build próprio.
No Windows, permita acesso do Node às redes privadas quando necessário para conectar o celular.
O túnel (`npx expo start --tunnel`, em `apps/mobile`) muda por sessão e só funciona enquanto
o servidor estiver ativo. Mudanças de módulos nativos exigem recompilar builds próprios. Instale dependências do app com
`npx expo install <pacote>` dentro de `apps/mobile`, conforme seu `AGENTS.md`.

Copie `apps/mobile/.env.example` para `.env.local` somente para configurar a conexão real.
As duas variáveis públicas do Supabase habilitam o modo conectado. Para testes locais sem conexão,
abra outro terminal PowerShell e execute:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_PUBLIC_SUPABASE_URL = ''
$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ''
npm start
```

Essas variáveis valem para esse terminal. Nunca inclua chaves secretas/service role no cliente.
O procedimento do backend está em [SUPABASE.md](SUPABASE.md).

## Estrutura atual

```text
apps/mobile/src/
  app/                Rotas e telas do Expo Router; _layout define navegadores
  components/
    ui/               Layout, listas, campos, controles, texto, movimento e teclado
    gluestack/        Primitivos da biblioteca visual e adaptações por plataforma
    home/             Visões Essencial, Gerencial e Analítica
    farm-map/         Mapa, busca e integração nativa/web
  domain/             Regras e projeções puras, sem React nem Expo
  db/                 Schema SQLite, migrations locais, repositório e dados de exemplo
  services/           Auth, sincronização, mapas, exportação e avisos locais
  state/              Providers, preferências, ações e seletores do workspace
  theme.ts            Tokens e seleção de paleta
tests/
  fixtures/           Cenários determinísticos compartilhados
  *.test.mjs          Regressões de domínio, persistência e serviços
  hosted-smoke.mjs    Validação hospedada separada, com escrita de fixtures
  benchmark-domain.mjs Comparações sintéticas de CPU com fontes anteriores do Git
supabase/migrations/  Histórico SQL do backend atual, aplicado em ordem
```

A árvore acima combina caminhos de `apps/mobile/src/` com os diretórios `tests/` e `supabase/`
da raiz de `agrogest-app/`. Não há pnpm workspace, PowerSync ou API TypeScript separada na implementação
atual. Essas alternativas continuam registradas no ADR; a entrega usa comandos RPC e fila própria.

## Responsabilidades

- **Tela:** trata entrada, estados de carregamento/erro e navegação. Listas grandes usam os layouts
  virtualizados compartilhados; evite colocar uma lista virtualizada dentro de uma ScrollView.
- **Domínio:** recebe dados e devolve resultados. Use centavos inteiros, datas locais `aaaa-mm-dd`,
  índices locais à leitura e ordenação explícita quando o histórico importa. Não altere os argumentos.
- **Estado:** coordena ações e persistência. `workspace-selectors.ts` calcula a projeção autorizada;
  mudanças transitórias de rede não devem reconstruir regras de negócio sem necessidade.
  Preferências de interface (modo, valores escondidos, reduzir animações, atividade vista) ficam em
  `usePreferences()` (`preferences.tsx`), fora do `useApp`: trocar uma delas não renderiza o app
  inteiro. Sincronização, fila de envio e transição de contexto ficam em `useSyncStatus()`
  (`sync-status.tsx`), um store que o provedor atualiza sem renderizar o app. Outras preferências gravam com `setSetting` sem reler o banco; o workspace só é refeito
  quando muda uma chave que ele lê.
- **Repositório:** lê/grava SQLite. Preserve dados e outbox nas migrations locais e use transação
  para substituições de snapshot. O SQLite conectado pertence a uma conta específica.
- **Serviço:** integra uma capacidade externa. Libere listeners/timers, trate cancelamento e mantenha
  comandos idempotentes. Respostas antigas não podem atualizar a conta nova nem apagar sua fila.
- **Backend:** revalida identidade, vínculo, versão e saldo. Uma projeção local nunca substitui a
  autorização transacional do servidor.

Mantenha componentes de domínio próximos de suas telas e compartilhe somente comportamento
que já se repete. Extraia regras puras antes de criar um novo provider, pacote ou dependência.
Arquivos `.web.ts(x)` são adaptações deliberadas; ausência de importação explícita da variante
web não significa código morto.

## Verificações

Execute na raiz:

| Comando | O que comprova |
| --- | --- |
| `npm run check` | Tipos, lint e todas as regressões locais `tests/*.test.mjs` |
| `npm test` | Regras de negócio, SQLite, serviços e migrations SQL em PGlite |
| `npm run export:check` | Empacotamento web, Android e iOS, incluindo Hermes |
| `npm run benchmark:domain -- 62c6127` | Igualdade das saídas e tempo de CPU das rotinas comparadas |

`npm run test:database` em `agrogest-app/` é um alias para a suíte completa. O runner descobre
novos `*.test.mjs` automaticamente. `resolve-ts.mjs` só adapta alias, extensões e o formato ESM
dos fontes TypeScript; configs do Expo, Metro e ESLint continuam com seu formato original.

Dentro de `apps/mobile`, `npx expo install --check` confere a compatibilidade do SDK e
`npx expo-doctor` examina configuração e bibliotecas. O workflow `quality.yml` instala pelos
lockfiles, executa `check` e exporta todas as plataformas sem credenciais.

Teste manualmente os fluxos alterados com dados vazios e de exemplo, nas larguras de 320 e 390 px,
com tema claro/escuro e redução de movimento. Confira filtros, rolagem até o último item,
troca de fazenda, recarregamento e acesso de sócio/funcionário conforme o escopo.

Para sincronização, os testes locais cobrem o ciclo e as regras; a integração hospedada exige
contas e fixtures próprias. `hosted-smoke.mjs` escreve no projeto selecionado e não integra o
`npm test`. Execute-o somente no ambiente correto e com autorização para os dados envolvidos.
Exportar não gera instaladores nem mede fluidez, teclado ou notificações em aparelho físico.


## Entregar uma mudança

Atualize o documento responsável pelo comportamento alterado conforme a
[matriz de manutenção](README.md#manter-a-documentação). Corrija links relativos e comandos
no diretório indicado; versões vêm dos manifestos, contratos vêm do código/migrations.
Registre os checks realmente executados e seus limites na entrega. Uma revisão só de
Markdown exige verificar links, caminhos e `git diff --check`; não exige exportar o app.
Resultados antigos continuam datados e não devem ser reescritos como validações atuais.
