# AgroGest V2: assets finalizados

Referência: `reference-logo.png`, cópia do logo principal legado escolhido pelo usuário.

São seis assets de marca em `assets/branding/v2/` e sete assets de plataforma em `assets/images/v2/`. Os arquivos V1 permanecem intactos. O app utiliza os arquivos V2 no cabeçalho, splash animado, configuração de abertura nativa e ícones.

Os prompts e os caminhos dos resultados originais constam em `imagegen-prompts.json`. O símbolo claro inicial foi gerado com o pedido de remover somente o nome e o fundo branco da referência, preservando o boi verde #0C502F e as curvas laranja #FF6F1E.

## Finalização autorizada em 14/10/2026

O ImageGen integrado do ChatGPT gerou inicialmente as 13 variantes. A transparência das gerações apresentou ruído, especialmente nas formas brancas. Esses resultados foram preservados nas subpastas `imagegen-drafts/`, para comparação.

Com autorização explícita do usuário, os arquivos finais foram exportados por `scripts/brand_v2.py` a partir da referência original, preservando o desenho do boi e a tipografia. O script recupera a transparência removendo o branco composto sobre o verde #0C502F e o laranja #FF6F1E; na variante escura, troca apenas o verde por branco.

Para regenerar, dentro de `apps/mobile`, execute `python scripts/brand_v2.py` (requer Pillow). O script é independente da pasta legada e utiliza a cópia local `reference-logo.png`.

Os ícones do app e Android têm 1024x1024; o favicon tem 48x48. O foreground e a máscara monocromática ficam dentro dos 52% centrais da tela para manter margens de segurança. `dimensions.json` define as proporções usadas pelos componentes e `preview-v2.jpg` mostra o conjunto completo.

## Comparação V1/V2 no protótipo

Em **Mais › Preferências › Ferramentas do protótipo › Marca do aplicativo**, o seletor V1/V2 troca logo, símbolo, nome e prévia do ícone. No modo conectado, esse grupo se chama **Aparência e dados locais**. A escolha é persistida localmente em `agrogest.brand-version`, independente da preferência de tema. V2 é o padrão quando não há escolha salva. **Ver tela de abertura** reproduz o splash animado da versão selecionada. As duas versões acompanham os temas claro e escuro.

O ícone instalado e o splash nativo permanecem definidos pelo build em `app.json` (V2). A preferência no aplicativo afeta o cabeçalho e a abertura animada após o splash nativo.

A referência original é um raster de 299x274: os arquivos maiores são exportações ampliadas, não novos vetores. As cores e os recortes são determinísticos. A prancha foi inspecionada, mas a configuração nativa deve ser validada em um novo build de distribuição.


Diretrizes visuais e tokens atuais: [Identidade visual](../../../../../docs/branding/IDENTIDADE_VISUAL.md).

## Composições acadêmicas em 10/11/2026

A variante branca/laranja existente é a referência ativa. O novo `logo-apresentacao.svg` apenas compõe essa arte original sobre carvão, sem redesenhar o símbolo ou modificar seus pixels. `npm run brand:assets`, na raiz, regenera essa composição, o favicon SVG e os ícones em `assets/images/academic/`; usa o Sharp presente no lockfile da API para rasterizar o SVG. Desde 11/11/2026 o mesmo comando também gera a versão para fundo claro em `assets/branding/academic/` (`logo-ink.png`, `mark-ink.png`, `wordmark-ink.png`) e `assets/images/academic/splash-icon-ink.png`: a arte V2 com o verde trocado por carvão `#1C1D21`, mesmas dimensões e laranja. Os arquivos V1/V2 originais e esta prancha histórica não são sobrescritos. As [diretrizes vigentes](../../../../../docs/branding/IDENTIDADE_VISUAL.md#direção-vigente-da-versão-acadêmica--10112026) distinguem a paleta nova das decisões de outubro.
