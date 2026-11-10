# Research finding

## Protocol

- Question: Que projeto CitizenTech independente da Outis pode reduzir a distância entre uma comunicação oficial e a execução de uma tarefa pública pelo cidadão?
- Decision criterion: benefício direto ao cidadão, escopo de um serviço e território, uso verificável dos quatro requisitos técnicos, diferencial honesto e demo possível até 19/11/2026.
- Falsifier: cidadãos entendem os requisitos mas o bloqueio é oferta de vagas/atendimento; alternativa oficial já executa fluxo equivalente; IA produz requisito crítico sem fonte.
- Risk: material
- Credits used: 0
- Metering note: o número 0 representa somente cobranças explícitas conhecidas. Não foi fornecida unidade de crédito/preço nos recibos; custo total desconhecido. Uso em attempts/bytes preservado nos records. Nenhuma afirmação de gratuidade.

## Provider trail

| Intent | Provider | Tool or endpoint | Outcome | Credits | Fallback reason |
|---|---|---|---|---|---|
| Descoberta web pt-BR/BR | Scrapinho / DuckDuckGo explícito | search.web via MCP | 5 buscas completas até EOF | unknown | None |
| Fontes primárias | Scrapinho | fetch.page via MCP | INAF, SMIT e ONU completas; IBGE forbidden/target_forbidden | unknown | Não houve fallback nem contorno |
| Fontes adicionais | None | None | Coleta encerrada após bloqueio IBGE; terminaram apenas jobs já admitidos no lote | 0 known | Regra da research stack |

## Claim ledger

| Claim | Source | Accessed | Snapshot | Primary | Direct | Current | Independent | Verdict |
|---|---|---|---|---|---|---|---|---|
| Inaf apresenta barreiras de alfabetismo por escolaridade em 2024 | https://alfabetismofuncional.org.br/alfabetismo-no-brasil | 2026-11-05 | fontes-acesso/inaf-page/page.md | yes | yes | partial | unknown | accepted |
| SP156 anunciou sugestão de serviço a partir de imagem em 16/05/2025 | https://prefeitura.sp.gov.br/web/inovacao/w/sp156-utiliza-intelig%C3%AAncia-artificial-para-facilitar-o-atendimento-aos-cidad%C3%A3os | 2026-11-05 | fontes-acesso/sp156-page/page.md | yes | yes | partial | unknown | accepted |
| Meta ODS 10.2 trata de inclusão | https://brasil.un.org/pt-br/sdgs/10 | 2026-11-05 | fontes-acesso/ods10-page/page.md | yes | yes | yes | yes | accepted |
| Procedimento CadÚnico SP pode ser recorte útil | https://sp156.prefeitura.sp.gov.br/portal/servicos/informacao?conteudo=2674 | 2026-11-05 | fontes-acesso/cadunico-search/search.json | yes | partial | unknown | unknown | limited |
| Assistentes públicos podem concorrer com proposta genérica | https://rs.gov.br/guria | 2026-11-05 | fontes-acesso/gov-assistente-search/search.json | yes | partial | unknown | unknown | limited |
| Estatísticas encontradas no snippet IBGE | https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/44033-pela-primeira-vez-mais-da-metade-da-populacao-acessa-a-internet-pela-tv | 2026-11-05 | fontes-acesso/ibge-page/record.json | yes | no | unknown | unknown | rejected |

## Findings

Ver acesso_cidadao.md. Arquiteturas, nomes de projeto, cronograma e validação são propostas, não fatos externos.

## Disagreements

Nenhum conflito de fontes primárias foi identificado. Não houve comparação funcional dos assistentes públicos; inexistência de evidência não comprova ausência de funcionalidade.

## Open questions

- Entrevistas e serviço final; documentação oficial completa; comparação com alternativa genérica e oficial; recrutamento; métricas baseline.

## Council review

- Status: not run
- Reason: ideação com evidência primária, sem aconselhamento individual ou conclusão de alto risco; limitações explícitas.
- Accepted findings: None.
- Rejected findings: None.

## Sources consulted

- https://alfabetismofuncional.org.br/alfabetismo-no-brasil, accessed 2026-11-05.
- https://prefeitura.sp.gov.br/web/inovacao/w/sp156-utiliza-intelig%C3%AAncia-artificial-para-facilitar-o-atendimento-aos-cidad%C3%A3os, accessed 2026-11-05.
- https://brasil.un.org/pt-br/sdgs/10, accessed 2026-11-05.

## Trial by fire

- Primary-source claims: 3 fontes primárias lidas até EOF.
- Secondary-only claims: nenhuma conclusão factual fundamentada apenas em fonte secundária.
- Volatile claims: requisitos de CadÚnico e recursos atuais dos assistentes permanecem não verificados.
- Raw evidence limit: MCP contém texto normalizado; não houve exportação de bytes HTTP nem verificação SHA-256 raw. Hash de conteúdo é somente o reportado pelo serviço.

