# Instruções para trabalhar no AgroGest

## Escopo e fontes

- O aplicativo atual fica em `agrogest-app/`; código novo pertence a ele.
- `old-agrogest/` é legado de referência. Não editar nem copiar código dele sem pedido explícito.
- Leia o [índice da documentação](agrogest-app/docs/README.md) e os documentos da área antes
  de alterar comportamento. Siga também o `AGENTS.md` mais específico, quando houver.
- Manifestos, lockfiles, código e migrations comprovam a implementação. Se divergirem dos
  documentos, investigue e explicite a diferença; não altere uma regra de produto por suposição.

## Documentação faz parte da entrega

Sempre avalie o impacto documental de uma mudança e atualize o documento responsável no mesmo
conjunto de alterações. Use a [matriz de manutenção](agrogest-app/docs/README.md#manter-a-documentação).

- Mudou regra/permissão: requisitos. Mudou navegação/fluxo: UX. Mudou setup/comando/estrutura:
  desenvolvimento. Mudou contrato/schema/Auth/sync: Supabase. Mudou decisão técnica: arquitetura.
  Mudou marca/asset: identidade visual. Mediu desempenho: performance.
- Mantenha uma informação em um único lugar e use links nos demais; READMEs são entradas curtas.
- Identifique implementado, planejado e histórico. Preserve IDs RF/RN e registre substituição
  de decisões; não deixe regras antigas e novas se contradizendo como se ambas fossem vigentes.
- Não crie um relatório `REVISAO_*.md` por tarefa. Use Git para mudanças rotineiras e o histórico
  consolidado apenas para evidências relevantes com data, base, escopo e limites.
- Ao mover/remover documentação, atualize índice, referências e âncoras. Confira caminhos e
  comandos a partir do diretório indicado. Não edite medições antigas para parecerem atuais.
- Antes de encerrar, informe quais documentos foram atualizados; se não houver impacto, explique
  brevemente por quê. Não faça edições artificiais em documentação sem relação com a mudança.

## Validação e preservação

- Mudanças de código: execute as verificações aplicáveis de `DESENVOLVIMENTO.md`; tipos e lint
  são obrigatórios para alterações mobile. Instale dependências mobile com `npx expo install`.
- Mudanças somente em Markdown: revise conteúdo, links, caminhos e `git diff --check`;
  testes, lint e exportação do app são dispensados quando não há código ou exemplo executável alterado.
- Preserve dados SQLite, outbox, isolamento de contas, regras financeiras e aprovações.
- Migrations do app novo nunca devem ser aplicadas no legado/Noude. Informe a migration e o
  ambiente necessário; uma migration no Git não prova aplicação remota.
- Separe resultado local, teste hospedado, publicação e teste em aparelho real. Não trate
  exportação como APK/IPA ou benchmark sintético como prova de fluidez nativa.
- Não publique, faça merge ou altere dados/infraestrutura remota sem autorização da tarefa.
