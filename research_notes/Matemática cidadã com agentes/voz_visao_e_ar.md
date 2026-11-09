# Voz, visão computacional e AR no MVP

Consulta técnica estreita, 05/11/2026. Skill `read-docs` lida. Firecrawl MCP/developer index ausentes; fontes oficiais descobertas e lidas diretamente pelo Scrapinho MCP, com escopo próprio, uma tentativa e limites. Nenhuma conta criada, credencial aberta, API paga de aplicação chamada ou integração implementada. As páginas usadas foram lidas até `next_cursor: null`; respostas e proveniência estão em `fontes-voz/`. Latência, custo do produto e eficácia pedagógica não foram medidos.

## O que está confirmado nos documentos

- **Voz interativa no navegador:** o SDK React atual de ElevenAgents estabelece sessões de voz com WebRTC por padrão; disponibiliza áudio, transcrições, estado de fala/escuta e eventos de texto incremental. Não é apenas um gerador de arquivos de narração. `isSpeaking`/`isListening` e callbacks permitem sincronizar feedback visual simples. [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react), acesso 05/11/2026; snapshot `fontes-voz/eleven-react-page-v1/page.md`.
- **Interrupção:** por padrão o usuário pode interromper o agente, inclusive durante execução de ferramentas. Existem modos por ferramenta para manter ou suprimir interrupção durante execução ou turno completo. Isso é funcionalidade documentada, não garantia de latência em nossa aplicação. [Tool interruptions](https://elevenlabs.io/docs/eleven-agents/customization/tools/tool-configuration/tool-interruptions), acesso 05/11/2026; snapshot `fontes-voz/eleven-interrupt-page-v1/page.md`.
- **Contexto e chamadas da aplicação:** o SDK permite client tools que chamam funcionalidades/API da aplicação e devolvem um resultado ao agente. Para esperar e reagir ao resultado, a ferramenta precisa ser configurada para bloquear a conversa. `sendContextualUpdate(texto)` acrescenta contexto sem disparar resposta; `sendUserMessage(texto)` gera um turno do usuário. [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react); [Client-to-server events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events), acesso 05/11/2026; snapshots `fontes-voz/eleven-react-page-v1/page.md` e `fontes-voz/eleven-context-page-v1/page.md`.
- **Imagens já são suportadas em um caminho nativo:** a documentação atual de multimodal input permite anexar imagens/PDFs **em chat**, por widget, canais suportados ou API de upload de arquivo da conversa. A leitura depende do modelo escolhido suportar imagem/documento; o anexo é ignorado se o modelo não suporta o tipo. Isso não demonstra vídeo contínuo nem um detector matemático específico. Não afirmar que ElevenLabs só faz áudio ou que não aceita fotos. [Multimodal input](https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input), acesso 05/11/2026; snapshot `fontes-voz/eleven-multimodal-page-v1/page.md`.

## Arquitetura proposta, separada de comportamento já comprovado

Para ter controle da evidência e da avaliação: **câmera captura um marco → backend de visão extrai fatos da imagem → camada pedagógica confirma a leitura e escolhe a intervenção → agente conversa por voz e a interface destaca a evidência**.

Exemplo de implementação proposta: o aluno monta uma fração com peças; a aplicação captura a foto ao tocar em “pronto”; o backend devolve quantidade, agrupamento, região da imagem e incerteza; o aluno confirma a leitura; a política pedagógica escolhe uma pergunta curta. O resultado da visão entra na conversa por contextual update ou retorno de ferramenta. Não enviar uma conclusão inventada como se a câmera a tivesse observado.

É possível investigar o caminho nativo de anexos para evitar um pipeline separado, mas as páginas lidas não provam a integração exata de captura de câmera com a sessão de voz personalizada. Essa compatibilidade precisa de uma prova pequena antes da decisão. Não é necessário resolver isso para defender a arquitetura alternativa por backend e contexto textual documentado.

Começar com fotos por etapa, fala e animação 2D é escolha de engenharia. O backend mantém o estado pedagógico, a rubrica e os dados de desempenho; a voz apresenta o feedback. A qualidade da voz pode tornar a experiência mais agradável, mas ganho de aprendizagem exige avaliação independente. Continua necessário medir o que o aluno faz sozinho.

## AR/VR: decisão de escopo

A MDN descreve uma camada adicional para WebXR: verificar dispositivo e navegador, testar suporte ao modo pretendido (`inline`, `immersive-ar`, `immersive-vr`), iniciar/encerrar sessão e gerir entrada, animações e renderização 3D com WebGL. Isso fundamenta um sobrecusto técnico de XR; não é uma comparação medida de produtividade ou aprendizagem. [WebXR application life cycle](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Lifecycle), acesso 05/11/2026; snapshot `fontes-voz/mdn-webxr-page-v1/page.md`.

**Recomendação de engenharia para este MVP:** web com câmera, voz e feedback visual em 2D. Reservar AR para quando colocar um objeto 3D no ambiente resolver uma dificuldade espacial concreta que a representação simples não resolve. Deixar VR fora do MVP de duas semanas. Essa recomendação considera escopo e prazo, sem afirmar impossibilidade técnica ou benefício pedagógico de AR/VR.

Uma caixa colorida ou animação sobre a foto do caderno é overlay 2D; não precisa ser apresentada como AR. Para agrupamento, frações e equivalência com objetos reais, a câmera já pode capturar a evidência que interessa sem adicionar rastreamento espacial imersivo.

## Limites da consulta

- Documentação atual consultada, sem fixar versão do SDK e sem executar código. Não prometer tempo de resposta, orçamento mensal ou suporte em um aparelho específico.
- Não foi feito inventário exaustivo de vídeo/realtime multimodal. O suporte confirmado é de arquivos em chat, condicionado ao modelo; detalhes de voz com anexo precisam de prova própria.
- Nenhuma dessas fontes comprova que voz expressiva, personagem ou AR aumenta aprendizagem. São escolhas de interação; o efeito pedagógico continua hipótese.
- Custo/créditos de aquisição permanecem desconhecidos; manifestos preservam tentativas/bytes. SHA é informação do serviço, não hash de bytes brutos verificado localmente.
