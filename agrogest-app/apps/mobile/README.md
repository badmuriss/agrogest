# AgroGest — frontend da versão acadêmica

Expo SDK 58/React Native, TypeScript e SQLite v15, preservando o domínio pecuário/financeiro da versão de outubro.

O backend vigente é **Worker/D1/R2 local** com cliente HTTP próprio; o SDK Supabase foi removido. Não há modo de IA simulada no aplicativo. Captura e OCR reais levam à revisão e à despesa existente, com aprovação e sincronização.

Na raiz: `npm run setup:local`, `npm run build:web`, `npm start`. Abra **http://127.0.0.1:8787/entrar**. O [guia local](../../docs/CLOUDFLARE_LOCAL.md) é a fonte de setup, contas, credenciais, testes e limites. Para editar com Metro, `npm run web` na raiz, mantendo OCR/API locais.

O alvo validado é web Chromium local. Exportações nativas são verificações de bundle, não teste em aparelho. RF-20 é parcial; PDF/XML e integração fiscal completa continuam no backlog. Documentos de outubro com Supabase descrevem a origem histórica.

Consulte [regras](../../docs/REQUISITOS_PRODUTO.md), [UX](../../docs/EXPERIENCIA_USUARIO.md), [arquitetura](../../docs/ARQUITETURA_TECNICA.md) e o [índice](../../docs/README.md).
