Skip to content
 Navigation Menu
Sign in
ProductsPlatformGitHubRepository hosting, code review, and collaboration
CopilotAI coding agent for tasks, projects, and automated work
Build & ShipActionsCI/CD and automation
Code QualityQuality analysis, fixes, and enforcement
CodespacesCloud development environments
SecureCode SecurityVulnerability detection and remediation
Secret ProtectionSecret scanning and leak prevention
All Features
DevelopersLearnDocumentation
Training
Certifications
BuildBuild with Copilot
Customize Copilot
Integrations
ExploreTrending repos
GitHub Sponsors
Developer articles
ChangelogChangelogYour source for the latest features, improvements, and fixes across GitHub products, all in one place.
BusinessesBy StageEnterprises
Team
Startups
Nonprofits
By IndustryHealthcare
Financial services
Manufacturing
Government
See all industries
Evaluate GitHubWhy GitHub
Customer Stories
Business insights
Trust Center
Add-onsGitHub Advanced SecurityEnterprise-grade code security
Copilot for businessEnterprise-grade AI features
Premium SupportEnterprise-grade 24/7 support
ResourcesLearn & ConnectDocumentation
Resource center
Blog
Events & webinars
Community Forum
Customer Stories
Integrations
SupportCustomer support
Training
GitHub Status
CompanyAbout
Partners
Changelog
GitHub UniverseGitHub UniverseThe event for developers, by developers — talks, workshops, and what’s next for GitHub.
Pricing
Search/
Sign in
Sign upAppearance settings
 You signed in with another tab or window. Reload to refresh your session.
 You signed out in another tab or window. Reload to refresh your session.
 You switched accounts on another tab or window. Reload to refresh your session.
Dismiss alert
 freitasbtw
agrogest
Repository navigation
Code
Issues
Pull requests
Actions
Projects
Security and quality
Insights
More items
agrogest
Public
NotificationsYou must be signed in to change notification settings
Fork0 (0)
Star1 (1)You must be signed in to star a repository
About
agro-gest.vercel.app/
Resources
Readme
Activity
Stars
1 star
Watchers
0 watching
Forks
0 forks
Report repository
main
BranchesTags
Go to file
CodeOpen more actions menu
Latest commit
History
176 Commits
176 Commits
Folders and files
NameNameLast commit message
Last commit date
.claude
.claude
.github/workflows
.github/workflows
agrogest-app
agrogest-app
old-agrogest
old-agrogest
.gitignore
.gitignore
AGENTS.md
AGENTS.md
CLAUDE.md
CLAUDE.md
README.md
README.md
package.json
package.json
View all files
Repository files navigation
README
More items
AgroGest
Gestão de fazendas, rebanho, pastos, estoque e financeiro, com trabalho offline e aprovação por operação.
O aplicativo atual usa React Native, Expo SDK 58, TypeScript e SQLite, com autenticação e
sincronização pelo Supabase quando configurado.
Começar
Use Node.js 24.10 ou mais recente da linha 24, npm e Git. Na raiz do repositório:
npm ci --prefix agrogest-app
npm ci --prefix agrogest-app/apps/mobile
npm start
Leia o QR com o Expo Go na mesma rede ou execute npm run web para abrir no navegador.
Para compartilhar fora da rede, inicie o Expo com --tunnel; o endereço só funciona enquanto a sessão estiver ativa.
Há dois modos de execução:
Modo
Configuração
Dados e acesso
Protótipo local
Sem as duas variáveis do Supabase
Conta fictícia e SQLite no aparelho; dados de exemplo opcionais
Conectado
.env.local em apps/mobile, conforme .env.example
Supabase Auth, SQLite por conta, fila persistente e validação no servidor
Para o modo conectado, siga a configuração do Supabase, incluindo
as migrations e as URLs de retorno de autenticação. A IA fiscal e os anexos ainda não estão integrados.
Verificar uma mudança
npm run check
npm run export:check
check executa tipos, lint e os testes locais de domínio, SQLite e PostgreSQL via PGlite.
export:check empacota web, Android e iOS; não gera APK/IPA. O workflow
Qualidade do AgroGest executa os mesmos comandos no modo local,
sem credenciais de produção. Testes hospedados e testes em aparelho são etapas separadas.
Para medir cálculos com resultados equivalentes antes/depois:
npm run benchmark:domain -- 62c6127
As condições e os resultados estão em Desempenho.
Organização
agrogest-app/
 apps/mobile/ Aplicativo Expo: telas, componentes, domínio, estado e SQLite
 docs/ Requisitos, decisões, integração e guias de manutenção
 supabase/ Migrations do backend atual
 tests/ Regressões locais, fixtures, smoke hospedado e benchmarks
old-agrogest/ Legado Next.js, preservado para consulta
O código novo fica em agrogest-app/. As dependências do app e dos testes têm instalações e lockfiles
próprios; a raiz oferece atalhos de comandos, sem introduzir outro gerenciador de pacotes.
Documentação
Organizada por tarefa e tipo de consulta; o índice também define como manter os documentos.
Índice dos documentos
Guia do aplicativo e fluxos disponíveis
Desenvolvimento, estrutura e validação
Requisitos do produto
Arquitetura e decisões
Histórico de revisões
Consultar o legado
O old-agrogest/ não recebe funcionalidades novas. Para executá-lo, siga seu
README e use a configuração de ambiente própria dele.
About
agro-gest.vercel.app/
Resources
Readme
Activity
Stars
1 star
Watchers
0 watching
Forks
0 forks
Report repository
Releases
Packages
Used by
Contributors
Languages
 Footer
 © 2026 GitHub, Inc.
 Footer navigation
 Terms
 Privacy
 Security
 Status
 Community
 Docs
 Contact
 Manage cookies
 Do not share my personal information
 You can’t perform that action at this time.

