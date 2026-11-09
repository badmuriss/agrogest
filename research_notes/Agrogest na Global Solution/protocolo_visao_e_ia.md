# Protocolo da auditoria estática

Data: 06/11/2026.
Questão: a extração de documentos fiscais do AgroGest atual comprova CV e IA aplicadas, ou somente preparação/simulação?
Critério: código primário do caminho foto→inferência→revisão→registro; não nomes da UI ou intenção documental.
Falsificador do veredito de ausência: integração atual no mesmo commit que efetivamente consuma imagem e invoque modelo, ou backend privado demonstrável que o código atual realmente chame.
Risco: material, análise técnica para projeto acadêmico. Sem aconselhamento fiscal individual.

Fonte: repositório público https://github.com/freitasbtw/agrogest, commit fixo 7f0bb66d764eadc8f48be016280414d77a1d4799. Clone disponibilizado pelo coordenador em /tmp/gs-final-fiap-agrogest-20261106, sem checkout. HEAD conferido antes da leitura.

Método: git show HEAD:path com numeração de linhas; git grep com padrões delimitados; git ls-tree para existência/escopo de paths. Lidos AGENTS raiz/mobile, índice e documentação fiscal, serviço e tela de NF, importador CSV e trechos de tipos/estado/workflow. Legado consultado apenas em linhas da rota ai-chat para impedir atribuição indevida ao app atual. Links pinned no relatório permitem reproduzir os localizadores.

Buscas negativas foram limitadas a agrogest-app/apps/mobile/src, agrogest-app/supabase e manifesto mobile para: functions.invoke, fetch, chat/completions, OpenRouter, OCR, multimodal e alguns SDKs comuns; não se afirma prova matemática de ausência em todo artefato externo.

Restrições respeitadas: nenhum checkout/reset, dependência instalada, código/teste do projeto executado, chamada de API/modelo, serviço hospedado, dado de usuário ou arquivo de ambiente/segredo lido. Não houve mutação no repo auditado. Sem pesquisa web nova ou chamadas pagas.

Limites: análise estática não prova implantação, configuração privada, precisão ou funcionamento em aparelho. Documento expressa planos; código define o comportamento observado nesta base. Migrations não comprovam execução remota.

Resultado: CV e IA ausentes no fluxo fiscal atual; captura e revisão locais parcialmente prontas; backend e integração visual a construir/demonstrar.

