# AgroGest — Identidade Visual e Diretrizes de Marca

> **Tipo:** referência visual. **Status:** tokens e assets implementados no novo app, com inventário legado separado; não substitui aprovação formal de marca.\
> **Registrado em:** 13/10/2026 às 21:51 (America/Sao_Paulo, UTC−03:00); organizado em 26/10/2026\
> **Fontes:** arquivos reais em `old-agrogest/`; revisão inicial de código e assets.\
> **Relacionados:** [Experiência do usuário](../EXPERIENCIA_USUARIO.md) · [Requisitos do produto](../REQUISITOS_PRODUTO.md)

## Direção vigente da versão acadêmica · 10/11/2026

Por decisão do usuário, **branco e laranja são a base do modo claro, que passa a ser o padrão também na atualização de quem já usava o app**. A revisão inicial preservava a seleção anterior e, por isso, podia continuar escura. A correção usa uma nova chave de aparência (`agrogest.theme.v2`): a chave antiga permanece armazenada, mas a versão atual começa no claro. O modo escuro e o automático continuam disponíveis em Preferências; escolhas feitas nesta versão persistem normalmente. A escolha busca atender produtores com diferentes níveis de familiaridade digital, incluindo meia-idade e pessoas mais velhas. Ganho de conversão não foi medido; comparar compreensão, legibilidade e conclusão de tarefas no piloto.

A cor de marca é o laranja `#FF6F1E`. **Atualização de 11/11/2026, por decisão do usuário:** ações, faixa do topo, destaques e aprovado usam esse mesmo laranja do logo nos dois temas, substituindo o `#A63D00` do claro e o `#FF8A4C` do escuro, considerados escuros/diferentes do logo. No claro, rótulo branco sobre `#FF6F1E` fica em cerca de 2,8:1, abaixo de AA; a troca foi aceita conscientemente e a verificação de `scripts/scenes.mjs` registra a exceção (mínimo 2,4:1 só em pares com a marca). Conferir legibilidade com pessoas mais velhas no piloto. Superfícies são brancas/cinzas suaves.

**Equilíbrio de cores (11/11/2026, após o usuário achar a tela laranja demais):** o laranja fica com a ação principal de cada tela (Entrar, Enviar, "+" de Registrar), a aba ativa, links e destaques pontuais. A faixa do topo (Início, Financeiro) passa a ser carvão `#1C1D21` também no claro. Botões de destaque secundário usam a variante `strong` (carvão no claro, branco no escuro, tokens `inverse`/`onInverse`), como a ação do cartão principal ("Registrar pesagem") e o atalho em destaque de "Pro dia a dia". O verde sai dos destaques e da aprovação visual; status continuam com texto e ícone, e perigo/alerta conservam sua semântica. Tokens exatos vivem em `src/theme.ts` e `src/global.css`, mantidos em conjunto.

**Marca por fundo (11/11/2026):** o símbolo, o nome e o logo acompanham o tema, sem caixa carvão por trás: no claro, versão carvão/laranja (`assets/branding/academic/*-ink.png`, a arte V2 com o verde trocado por `#1C1D21`); no escuro, a versão branca/laranja V2. O splash nativo segue a mesma regra (fundo `#F4F5F7` com `assets/images/academic/splash-icon-ink.png` no claro; `#111214` com a versão branca no escuro). `npm run brand:assets` gera as variantes carvão a partir dos originais, sem sobrescrevê-los.

O desenho original **branco/laranja** é reutilizado sem alterar seus pixels. Composições SVG sobre carvão continuam no ícone do app e no favicon; `npm run brand:assets` rasteriza apenas essas composições para ícone/favicon com o Sharp já fixado pelas dependências da API. Novos arquivos ficam em `assets/images/academic/`, `public/favicon.svg` e `assets/branding/v2/logo-apresentacao.svg`. Originais V1/V2, dimensões e autoria permanecem preservados; o novo ícone tem 1024×1024 e usa arte branca/laranja sobre carvão. O Android mantém o foreground original e passa a usar fundo carvão por configuração; nenhuma publicação/build de distribuição nativo foi feita.

As diretrizes verdes de outubro abaixo são **históricas e substituídas para a versão acadêmica**. Os slides da GS seguem a mesma paleta vigente e as capturas usadas neles devem corresponder ao app atualizado.

**Pitch da GS (11/11/2026, substitui a direção de 10/11):** o logo completo V2 branco/laranja (`logo-dark-v2.png`) aparece grande apenas sobre carvão, na capa e no fechamento; os slides brancos não levam selo reduzido da marca. Não há molduras de celular: as capturas reais aparecem como recortes ampliados da região relevante, sem distorção, com cantos de 28 px e rótulo "tela real do app". O recibo sintético GS-004 é o fio condutor da narrativa, com marcações laranja que ligam os campos do papel aos da revisão. Tipografia exclusiva da apresentação: Bricolage Grotesque (títulos e números) e Inter (texto, como no app), ambas OFL e embutidas no PDF; o app continua só com Inter. Por pedido do usuário, não há fonte monoespaçada, rodapé com nome/número do slide, rótulos em caixa-alta nem elementos encostados nas bordas: todo conteúdo fica a pelo menos 150 px das laterais e 100 px da base do palco 1920×1080. Cores: carvão `#1C1D21`, branco, laranja `#FF6F1E` para grafismos, `#A63D00` para texto laranja sobre branco e `#FF8A4C` sobre carvão.

## 1. Objetivo

Preservar a identidade visual já existente do **AgroGest** como referência para o aplicativo móvel React Native + Expo e para o futuro painel administrativo, **sem assumir que as decisões do software legado definem a arquitetura ou os requisitos do novo produto**.

Para manter a interface atual, comece pela seção 7.1. Paleta e tipografia legadas abaixo
são contexto histórico e não substituem `src/theme.ts`.

Este documento separa:
- **Confirmado no legado:** assets e tokens realmente utilizados no código existente.
- **Aplicado no novo app:** tokens, tipografia e assets conferíveis no código; propostas adicionais ficam identificadas.

## 2. Inventário confirmado dos arquivos da marca

| Ativo | Local no repositório | Evidência |
| --- | --- | --- |
| Logo principal, PNG | [`old-agrogest/public/agrogest-logo.png`](../../../old-agrogest/public/agrogest-logo.png) | Referenciado no componente `BrandMark` com a variante `default`. |
| Logo de cabeçalho, PNG | [`old-agrogest/public/agrogest-header-logo.png`](../../../old-agrogest/public/agrogest-header-logo.png) | Referenciado no componente `BrandMark` com a variante `header`. |
| Componente que exibe as marcas | [`old-agrogest/src/components/brand-mark.tsx`](../../../old-agrogest/src/components/brand-mark.tsx) | Seleciona arquivo por variante e ajusta apresentação em fundo claro/escuro. |
| Tokens de cores e temas | [`old-agrogest/src/app/globals.css`](../../../old-agrogest/src/app/globals.css) | Declara tokens CSS, gráficos, bordas, fundo e variantes para tema escuro. |
| Tipografia / metadados | [`old-agrogest/src/app/layout.tsx`](../../../old-agrogest/src/app/layout.tsx) | Usa `Geist` e `Geist_Mono` via Next Fonts e define título/descrição da aplicação. |
| Ícone de navegador / Apple | `old-agrogest/public/favicon.ico`, `icon.svg`, `apple-icon.png` | Caminhos referenciados no `layout.tsx`. Existência física destes três arquivos **não validada nesta revisão**. |

**Manual de marca em PDF:** não foi localizado nas buscas realizadas anteriormente e os caminhos usuais testados em `old-agrogest/` não o continham. Portanto, **não tratar um PDF como arquivo oficialmente disponível** até sua localização ou produção.

**Preservação:** os originais continuam intactos em `old-agrogest/` como fonte histórica. **Protótipo mobile (14/10/2026):** a pedido do responsável, `apps/mobile/assets/branding/` passou a ter variantes derivadas do logo horizontal: a original (branco + laranja, para fundo escuro), uma clara com o branco trocado pelo verde da marca (mesmas cores do logo empilhado), e a vaca e o nome separados, para o splash animado. O ícone do app é a vaca sobre o verde `#0C502F`. Tudo é gerado por `apps/mobile/scripts/brand.py` e ainda **não substitui uma versão vetorial aprovada**.

### Conjunto V2 aplicado no novo app

V2 usa a referência local do logo principal e preserva V1. Arquivos, procedência, limitações
do raster, geração com Pillow e comportamento do seletor estão no
[README dos assets V2](../../apps/mobile/assets/branding/v2/README.md).

## 3. Paleta encontrada no projeto legado

| Papel | Referência | Valor hexadecimal | Status |
| --- | --- | --- | --- |
| Verde principal | `--primary` (tema claro; comentário no CSS) | **`#0C502F`** | Confirmado como cor de identidade |
| Laranja de destaque | `--accent` (tema claro; comentário no CSS) | **`#FF6F1E`** | Confirmado como cor de identidade |
| Verde vivo | `--success` (tema claro; comentário no CSS) | **`#00BF63`** | Confirmado como cor de identidade |
| Fundo base | `--background` (tema claro) | Branco | Confirmado como token atual |
| Fundo escuro | `--background` (tema escuro) | Definido em OKLCH | Confirmado como token atual; não estabelecer HEX sem conversão/validação |

> Os hexadecimais acima constam explicitamente dos comentários do CSS legado; a cor efetiva é implementada em **OKLCH**, de modo que estes códigos são **referências de identidade**, e não uma conversão exata de cada pixel/token CSS.

### Orientação proposta de uso

- **Verde escuro:** títulos principais, navegação ativa, botões primários e elementos institucionais, sempre com contraste testado.
- **Laranja:** ações de destaque e realces seletivos, sem excesso e sem competir com alertas de erro.
- **Verde vivo:** crescimento ou sucesso quando fizer sentido, sempre acompanhado de texto/ícone para não depender apenas de cor.
- **Estados semânticos próprios:** erro, alerta, pendente, sucesso, offline e conflito devem ter tokens separados dos tokens de marca; não confundir **pendência de aprovação** com **sucesso**.
- **Gráficos:** distinguir séries por rótulos, padrão e legenda além de cor; verificar contraste em fundo claro e escuro.
- Evitar usar a paleta da marca como única codificação de `peso estimado`, `resultado ajustado` e `sincronização pendente`.

## 4. Tipografia encontrada

**Confirmado no legado:** `Geist` para interface e `Geist Mono` para usos monoespaçados, definidos em `old-agrogest/src/app/layout.tsx`.

**Novo app:** Inter já implementada, carregada localmente; famílias e escala na seção 7.1.
A proposta inicial de Geist foi substituída. Fontes devem manter licenças e legibilidade no
Android/iOS, escalabilidade e algarismos tabulares quando apropriado.

## 5. Assinatura textual encontrada

Metadados do aplicativo legado:
- **Nome:** AgroGest.
- **Título de página:** `AgroGest | Gestão que faz o campo avançar`.
- **Descrição:** `Gestão agropecuária prática e confiável para organizar dados do campo e transformar a rotina rural em decisões estratégicas.`

**Status:** textos atualmente presentes no código legado; **não foram ratificados como slogan obrigatório** do novo aplicativo.

## 6. Aplicação dos logotipos — recomendações (a validar)

- Preservar proporções originais e áreas de transparência; **não distorcer, esticar, rotacionar ou recortar a marca**.
- Usar a logo de cabeçalho em áreas horizontais, após validar contraste e legibilidade do PNG no tema correspondente.
- Usar logo principal onde a proporção se adaptar, sem pressupor que ela funcione automaticamente como ícone quadrado de aplicativo.
- Não assumir que um PNG branco/escuro é universal: testar sobre fundos claros, escuros e superfícies coloridas.
- Evitar sombras, gradientes, contornos e recolorações sem versão aprovada.
- Definir futuramente uma **área de respiro** e **tamanhos mínimos** a partir das proporções da arte aprovada, não de valores arbitrários.
- Solicitar ou reconstruir a partir de fonte autorizada uma **versão vetorial escalável**, se for necessária para distribuição em múltiplas densidades.
- Criar arte **específica para ícone Android/iOS**, splash e notificações; aprovar variantes antes de distribuição.
- Conferir licenças/direitos de uso das artes antes de disponibilizar a marca comercialmente a terceiros.

## 7. Diretrizes visuais do aplicativo móvel — proposta

A marca deve transmitir confiabilidade, clareza operacional e domínio gerencial, evitando complexidade desnecessária.

### Interface e componentes

1. Três modos de experiência propostos: **Essencial, Gerencial e Analítico**, com identidade visual consistente entre eles.
2. Componentes recorrentes: seletor de fazenda/operação, cartões de lotes, ações rápidas, formulários guiados, aprovações, números financeiros e indicadores de sincronização.
3. Hierarquia visual forte para **quantidade de cabeças, kg, @ carcaça, R$ e status**.
4. Estados distinguíveis por texto e ícone: **registrado localmente**, **aguardando sincronização**, **aguardando aprovação**, **aprovado**, **rejeitado**.
5. Mostrar explicitamente resultados **reais** e **ajustados por aluguel simbólico**, sem ambiguidade.
6. Diferenciar **peso medido** de **peso estimado**.
7. Manter uso offline sem dependência de fontes, logos, ilustrações ou animações carregados sob demanda pela internet.
8. Privilegiar boa legibilidade em ambientes externos e aparelhos intermediários.
9. Oferecer tema claro/escuro após validar contraste, performance e coerência dos tokens.

### Movimento e ilustrações

- Usar **microinterações, Lottie/Rive ou animações nativas** apenas quando aumentarem compreensão ou fornecerem feedback útil.
- Evitar GIFs pesados ou animações repetitivas nos fluxos essenciais.
- Animação de sucesso só depois da confirmação do estado correto: **salvo localmente não significa aprovado**.
- Respeitar redução de movimento e manter alternativa textual acessível.

## 7.1 Sistema visual aplicado no app móvel (23/10/2026)

Decisões do redesenho aplicadas no protótipo em `apps/mobile`. Os tokens vivem em `src/theme.ts` e são espelhados em `src/global.css` (para Gluestack/NativeWind). Esta seção registra o que foi decidido; não substitui a aprovação formal de marca (seção 9).

- **Tipografia:** Inter, via `@expo-google-fonts/inter`, carregada em `src/app/_layout.tsx` (a splash espera pelas fontes). Escala curta: **display** 34 (números grandes, peso extrabold, algarismos tabulares), **título** 20, **corpo** 16, **legenda** 13. Substitui a proposta de Geist, que não tinha pacote pronto para React Native neste projeto. Vale também para os componentes Gluestack (`Text` e `Heading`): a família é escolhida pela classe de peso (`gluestackFont` em `src/theme.ts`), sem depender de peso sintético.
- **Cor:** base neutra (fundo cinza muito claro e cartão branco no claro; carvão no escuro). **Uma cor de marca** para ação e destaque: verde `#0C502F` no claro e `#5FD28B` no escuro. Verde, vermelho e amarelo ficam reservados a sucesso, perigo e alerta, e só onde há significado. O laranja da marca não é usado como cor de ação nem de selo. Contraste mínimo de 4,5:1 em todo texto (legendas de apoio chegam a 7:1 no claro).
- **Faixa do topo (hero):** cor `hero` (verde escuro no claro; verde muito escuro no escuro) com conteúdo claro. Usada no Início e no Financeiro; no Financeiro, os indicadores são cartões translúcidos sobre a faixa (a cor dela aparece por trás, como o cinza sobre o preto no PicPay) e as fazendas viram pílulas, com a escolhida em branco. O Mais é claro, como o menu do PicPay. O tema escuro tem fundo, cartão e borda em degraus distintos.
- **Borda fina em vez de sombra (revisto em 23/10/2026):** cartões, listas e blocos de atalho são planos, com um fio de borda nos dois temas, como no PicPay. A sombra do Android (`elevation`) era recortada em retângulo quando a tela ou o bloco entrava com fade, e os cantos arredondados ganhavam manchas cinzas (efeito de "papel amassado"). O cinza do tema claro ficou neutro e frio (fundo `#F4F5F7`, borda `#E2E5EA`), sem o tom esverdeado que lembrava papel envelhecido.
- **Barra de status:** nas telas com faixa escura (Início e Financeiro), a área do relógio fica sempre na cor da faixa com ícones claros; nas demais, os ícones seguem o tema. Quem decide é a tela que ganha o foco.
- **Forma e grade:** espaçamento em grade de 8 (com meio passo de 4 em componentes pequenos); cantos de 16 (blocos de atalho), 20 e 24 (cartões e listas).
- **Ícones:** Lucide de traço fino (1,6 em repouso, 2 na aba ativa) no menu inferior e nos atalhos.
- **Componentes:** `HeroCard` (um número grande com uma ação), `QuickActions` (bloco arredondado só com o ícone e o rótulo embaixo, em até 2 linhas; um bloco principal com fundo da marca), `AccessGrid` ("Acesso rápido": blocos grandes em duas colunas, ícone no alto e rótulo embaixo) e `TitledSection` (título de bloco em 20 pt).
- **Menu inferior:** contêiner com cantos de cima arredondados e sombra para cima; a aba ativa ganha uma pílula suave da marca atrás do ícone.
- **Selos:** no máximo um por linha de lista. O contador do menu usa o verde da marca, sem laranja.

## 8. Assets e geração

- `apps/mobile/assets/branding/` e `assets/images/`: marca e recursos de plataforma V1/V2.
  Os scripts `brand.py` e `brand_v2.py` ficam em `apps/mobile/scripts/`; V2 usa sua referência
  local e não depende da pasta legada. Veja o README V2 para executar.
- `apps/mobile/assets/animations/`: cenas Lottie; `posters/`: quadro estático por cena em JSON
  com SVG. Dentro de `apps/mobile`, após `npm ci`, execute `node scripts/scenes.mjs`.
  O gerador usa desenhos Lucide e fontes Inter dos pacotes instalados, valida contraste
  e limita cada cena a 15 KiB. Não exige uma instalação separada de ferramentas de animação.
- O app usa player nativo e player web com fallback estático. Miniaturas e movimento reduzido
  não montam o player. A validação em aparelho permanece separada do QA web.
- [Capturas históricas](antes-depois/README.md) e [medições](../PERFORMANCE.md) preservam
  as condições de validação. Os originais legados continuam apenas como referência histórica.

## 9. Itens pendentes para virar manual oficial

- [ ] Validar com os responsáveis se o logotipo legado deve permanecer sem alteração.
- [ ] Inspecionar/validar visualmente os dois PNGs e encontrar o arquivo de criação/vetorização, se existir.
- [ ] Definir versões primária, secundária, monocromática e negativa, se necessárias.
- [ ] Formalizar cores e especificação exata para web/mobile (incluindo equivalentes sRGB/OKLCH).
- [ ] Formalizar aprovação de Inter e validar licenças/legibilidade em aparelhos; a implementação já usa Inter.
- [ ] Aprovar área de proteção, redução mínima e usos incorretos.
- [ ] Aprovar ícone e splash específicos para Android/iOS.
- [ ] Formalizar aprovação do sistema de ícones, cenas e componentes implementados na seção 7.1.
- [ ] Validar acessibilidade/contraste com telas reais.
- [ ] Após aprovação, gerar **PDF versionado do manual**, derivado desta fonte documental, sem substituir o Markdown.
- [ ] Registrar responsáveis por aprovar alterações de identidade visual.

## 10. Histórico de alterações

| Data e hora (Brasília) | Versão | Alteração | Status |
| --- | --- | --- | --- |
| 13/10/2026 às 21:51 (America/Sao_Paulo, UTC−03:00) | 0.1.0 | Inventário da identidade visual do AgroGest legado e proposta de aplicação na nova experiência mobile | **Legado confirmado / Diretrizes propostas** |
| 23/10/2026 | 0.2.0 | Sistema visual aplicado no app móvel (seção 7.1): Inter, tokens claro/escuro com uma cor de marca, faixa do topo, elevação em vez de borda, Lucide no menu | **Aplicado no protótipo / pendente de aprovação formal** |

> O timestamp representa o registro desta documentação; datas/horários históricos de criação dos logos não foram inferidos.
