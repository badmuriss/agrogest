# Fase atual — desenvolvimento e validação autorizados

06/11/2026. Instrução mais recente do usuário: encaminhar à sessão nova e **começar o desenvolvimento**, depois executar o projeto, verificar se está bom e condizente com a Global Solution, corrigir e preparar uma entrega demonstrável.

Esta autorização substitui a antiga limitação de permanecer apenas em análise/plano. Usar o plano existente para implementar, sem produzir outro ciclo de planejamento antes de começar.

## Restrições que continuam valendo

- Trabalhar na cópia/repositório independente da faculdade, mantendo origem e contribuição documentadas. Não alterar ou publicar no repositório original do amigo; não fazer fork.
- Migrar a base ativa de Supabase para a arquitetura Cloudflare definida: Workers, D1, R2 e frontend adequado, preservando os cálculos, permissões e comportamento útil.
- Aplicativo e infraestrutura de desenvolvimento locais, **sem deploy/provisionamento remoto do app ou dos dados** nesta etapa.
- Inferência remota em Workers AI ou OpenRouter do usuário está autorizada. Modelos locais/Hugging Face são opção quando adequados, sem obrigação de execução local de IA/CV.
- Segredos só na configuração segura do backend, fora do frontend, Git e logs. A configuração deve permitir que o amigo assuma depois com suas credenciais.
- Não apresentar mocks, amostras constantes ou similaridade visual como processamento real.

## Prioridade de implementação

Entregar primeiro um fluxo útil de ponta a ponta: **imagem real → extração real → revisão dos campos → despesa → aprovação/sincronização → indicador calculado**. Usar os contratos e critérios do plano, em fatias pequenas, preservando comportamento e isolamento entre usuários/fazendas.

Não parar em scaffold, telas ou documentação. Executar a aplicação e as verificações apropriadas, corrigir falhas e exercitar o fluxo no navegador ou ambiente alvo. Conferir estados de erro, repetição/reconexão, duplicação, aprovação e efeito nos valores. Seguir os AGENTS e as skills aplicáveis.

Se uma credencial de inferência não estiver disponível, continuar as partes independentes, explicitar a dependência e o que falta para o teste real; não substituir por uma resposta simulada e anunciar como concluído.

## Entrega ao usuário na sessão nova

Informar o que foi implementado, como rodar, quais testes e fluxos realmente passaram, limites ainda existentes e aderência aos quatro requisitos da GS. Separar infraestrutura emulada localmente de inferência ou serviços efetivamente executados na nuvem. Manter foco no prazo e no projeto demonstrável.
