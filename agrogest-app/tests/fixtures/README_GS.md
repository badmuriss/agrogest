# Imagens usadas na validação acadêmica

`comprovante-gs-001.png` e `comprovante-gs-002.png` são **recibos sintéticos de teste**, compostos localmente com ImageMagick e fonte DejaVu Sans. Não são comprovantes fiscais verdadeiros nem dados de produtores. O OCR recebe os pixels e precisa reconhecer valores diferentes; não há associação entre nome do arquivo e resposta esperada no aplicativo.

GS-001: R$ 1.250,40, Cooperativa Campo Verde, sal mineral, 06/11/2026.
GS-002: R$ 89,90, Oficina Rural, troca de filtro de trator, 05/11/2026.

As expectativas ficam nos testes, nunca na implementação de extração. Dois recibos legíveis não representam benchmark de campo. `historical-nf-extraction.ts` preserva a antiga amostra constante da origem, somente como registro histórico; não é importada pelo aplicativo.
