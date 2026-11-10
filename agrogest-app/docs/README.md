# Documentação do AgroGest

O aplicativo atual fica em `agrogest-app/`; `old-agrogest/` é legado independente.
A organização adapta [Diátaxis](https://diataxis.fr/): tutorial para começar, guias para
executar tarefas, referência para consultar regras e explicações para entender decisões.
Os documentos ficam no Git e são atualizados no mesmo conjunto de alterações do código
(docs as code). Não é necessário criar pastas ou arquivos para cada categoria.

## Versão acadêmica local · 10/11/2026

O guia vigente de setup, Auth, Worker/D1/R2, OCR em container Docker por CPU, IA visual local opcional, documentos e sincronização é [Cloudflare local](CLOUDFLARE_LOCAL.md). A integração Supabase de outubro é histórica; seus comandos remotos não se aplicam à versão da faculdade.

## Começar

O [README principal](../../README.md#rodar) conduz a primeira execução local.
O [README mobile](../apps/mobile/README.md) resume os modos e recursos disponíveis.

## Guias práticos

| Tarefa | Documento responsável |
| --- | --- |
| Instalar, executar, testar e entender a estrutura | [Desenvolvimento](DESENVOLVIMENTO.md) |
| Configurar Auth/backend, migrations e sincronização locais | [Cloudflare local](CLOUDFLARE_LOCAL.md) · [Supabase histórico](SUPABASE.md) |
| Regenerar os assets de marca V2 | [README dos assets](../apps/mobile/assets/branding/v2/README.md) |

## Referência

| Assunto | Documento responsável |
| --- | --- |
| Regras de negócio, RF/RN, aprovação, estoque e financeiro | [Requisitos do produto](REQUISITOS_PRODUTO.md) |
| Navegação, modos, estados e comportamento dos fluxos | [Experiência do usuário](EXPERIENCIA_USUARIO.md) |
| Marca, tokens, tipografia e geração de cenas | [Identidade visual](branding/IDENTIDADE_VISUAL.md) |
| Contrato planejado de extração fiscal e critérios de aceite | [IA para documentos fiscais](IA_DOCUMENTOS_FISCAIS.md) |

## Explicações e evidências

| Assunto | Documento responsável |
| --- | --- |
| Arquitetura implementada, motivos e alternativas futuras | [Arquitetura técnica](ARQUITETURA_TECNICA.md) |
| Método, reprodução e resultados datados de benchmarks | [Desempenho](PERFORMANCE.md) |
| Escopo, evidências e limites de revisões anteriores | [Histórico de revisões](HISTORICO_REVISOES.md) |
| Capturas históricas do redesenho | [Antes/depois visual](branding/antes-depois/README.md) |

## Global Solution e arquivo

| Consulta | Local |
| --- | --- |
| Tema, tecnologias e critérios da GS | [Requisitos da GS](gs/REQUISITOS_GS.md) |
| Implementação, decisões e próximos passos | [Plano](gs/PLANO.md) |
| Autoria da base e contribuições acadêmicas | [Origem e atribuição](arquivo/ORIGEM.md) |
| Handoffs e autorizações anteriores | [Transferências de contexto](arquivo/transferencias/) |
| Avaliações anteriores à implementação | [Estudos arquivados](arquivo/estudos/) |
| Fontes e evidências datadas | [Pesquisas e registros](arquivo/pesquisas/) |

O README da raiz apresenta a solução para os avaliadores. Os guias acima concentram operação e contratos; o arquivo preserva o histórico, incluindo estudos de alternativas descartadas, sem orientar novas funcionalidades. A raiz mantém apenas `README.md` e `AGENTS.md` como Markdown. A reorganização de 10/11 altera caminhos e links, preservando os dados e medições dos registros.

## Manter a documentação

**Uma informação, um lugar responsável.** Os demais documentos apontam para ele. README
é porta de entrada; não deve repetir o manual de produto nem o catálogo de comandos.

| Se a mudança altera… | Atualize… |
| --- | --- |
| Setup, scripts, dependências, estrutura ou testes | `DESENVOLVIMENTO.md`; README apenas se mudar a primeira execução |
| Regras, permissões ou escopo funcional | `REQUISITOS_PRODUTO.md`, preservando os IDs RF/RN |
| Rotas, telas, modos ou interação | `EXPERIENCIA_USUARIO.md` |
| Auth, RPC, sincronização, schema ou migrations | `CLOUDFLARE_LOCAL.md`; preservar `SUPABASE.md` como histórico; arquitetura apenas se mudar a decisão/estrutura |
| Cores, fontes, assets ou geração | `branding/IDENTIDADE_VISUAL.md`; README V2 para instruções dos arquivos |
| Extração fiscal planejada | `IA_DOCUMENTOS_FISCAIS.md` |
| Algoritmos e medições | `PERFORMANCE.md`, com base, ambiente, método e limites |
| Arquivos, nomes ou destinos de documentação | Este índice e todos os links afetados |

1. Antes de editar, leia as instruções do [AGENTS.md da raiz](../../AGENTS.md) e da área.
2. Mantenha o documento responsável junto da mudança. Se não houver impacto documental,
   explique brevemente na entrega; não faça alterações artificiais só para cumprir a regra.
3. Declare **implementado**, **planejado** ou **histórico**. Não misture requisito com prova de
   funcionamento. Atualize a data da seção afetada quando ela registrar uma conferência.
4. Use manifestos e código como evidência de versões e contratos; não invente outra versão
   manual para cada documento. Em divergência de regra, exponha a diferença em vez de mudar o produto.
5. Confira links, âncoras, caminhos, comandos e `git diff --check`. Mudanças apenas documentais
   dispensam builds/testes do aplicativo, salvo se incluírem scripts ou exemplos executáveis alterados.
6. Use o Git para alterações rotineiras. Só acrescente ao histórico uma revisão relevante
   com data, base, escopo e evidência; não crie `REVISAO_*.md` ou cópias por sessão.

Contagens de testes e alertas são fotografias datadas, não o estado atual garantido.
Migrations no Git não comprovam aplicação remota; exportação não é APK nem teste em aparelho.
