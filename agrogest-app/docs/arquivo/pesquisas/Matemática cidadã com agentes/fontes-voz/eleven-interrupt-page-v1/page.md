For AI agents: a documentation index is available at the root level at /llms.txt. Append /llms.txt to any URL for a page-level index, or .md for the markdown version of any page.
Search/
Connect
BlogHelp CenterAPI PricingSign upLoginLogout
English
OverviewElevenCreativeElevenAgentsElevenAPIReception.aiAPI referenceChangelogHelp Center
Skip to navigationOn this page
Overview
Interruption modes
Configuration
MCP servers
Best practices
Scroll to top
ConfigureToolsTool configuration
Tool interruptions
Copy page
Control whether users can interrupt the agent while a tool runs.
Overview
By default a user can interrupt the agent at any point, including while a tool is executing. For
some tools this is undesirable: a payment confirmation or a compliance disclaimer read out after a
lookup should be delivered in full.
The interruption_mode field controls this per tool. It is available on webhook tools, client
tools, system tools, and MCP servers.
Interruption modes
ValueDashboard labelBehaviorallowAllowThe user can interrupt the agent at any time. This is the default.disable_during_toolDisable during executionInterruptions are suppressed only while the tool runs. The agent response that follows can be interrupted.disable_during_tool_and_turnDisable during whole turnInterruptions are suppressed while the tool runs and for the agent response that follows it.
When several tools run in parallel, the strictest mode among them applies for that turn.
The boolean disable_interruptions field is deprecated. Use interruption_mode instead. The two
fields are kept in sync, so disable_interruptions: true is equivalent to interruption_mode: "disable_during_tool_and_turn" and existing integrations continue to work unchanged.
Configuration
Update via the dashboardUpdate via the CLIUpdate via the API
1Navigate to tool configuration
Select the tool you want to configure in the Tools tab.
2Set the interruption mode
Open Advanced settings and choose an option under Interruptions.
3Save your configuration
Click Save to apply the change.
MCP servers
An MCP server carries its own interruption_mode,
which applies to every tool it exposes. Individual tools can override it through the server’s
tool_config_overrides, where the value set on a tool takes precedence over the server default.
Best practices
Use disable_during_tool when the tool call itself must complete, such as a transfer or a keypad
sequence, but the user should be able to interrupt the response afterwards.
Use disable_during_tool_and_turn when the response that follows the tool must be heard in full,
such as a disclaimer or a confirmation read-back.
Leave the default allow in place elsewhere, since suppressing interruptions makes the
conversation feel less responsive.
Was this page helpful?YesNo
PreviousTool Call SoundsEditing tools safely
NextBuilt with
OverviewElevenCreativeElevenAgentsElevenAPIReception.aiAPI referenceChangelogHelp Center
Get started
Overview
Quickstart
Configure
Overview
Agent behavior
Voice & language
Knowledge base
ToolsClient tools
Webhook tools
Code tools
MCP tools
System tools
Tool configurationTool call sounds
Tool interruptions
Editing tools safely
Personalization
Authentication
Integrations
ElevenAgents Architect
Deploy
Overview
Environment variables
Web
Mobile
Games
Server
Telephony
WhatsApp
Batch calls
Monitor
Overview
Users
Testing
Experiments
Versioning
Merge proposals
Conversation analysis
Analytics
Spotlight
Real-time monitoring
OpenTelemetry traces
Alerts
Privacy
Cost optimization
CLI
Hosted MCP
Issues
Advanced
Events
Custom models
LLM cascading
Post-call webhooks
Resources
SDKs
UI components
Guides
Quickstarts
Chat Mode
Burst pricing
Call queueing
OpenAI Realtime API compatibility
ElevenLabs' docs agent
Scaling user interviews
Simulate Conversations
No-Code
Cookbooks
API reference
Legal
Overview
Quickstart
Overview
System prompt
Models
Realtime models
Workflows
Procedures
Free-form procedures
Structured procedures
Multimodal input
Conversation flow
Channel behavior
Guardrails
Voice & language
Multi-voice support
Pronunciation dictionary
Speed control
Expressive mode
Audio environment
Voice design
Language
Knowledge base
Manage documents
RAG
Tools
Client tools
Webhook tools
Code tools
MCP tools
MCP security
System tools
End call
Language detection
Agent transfer
Transfer to number
Skip turn
Play keypad touch tone
Voicemail detection
Update state
Flag issue for review
Tool call sounds
Tool interruptions
Editing tools safely
Personalization
Dynamic variables
Overrides
Twilio personalization
Authentication
Cal.com
Calendly
Cursor
Custom Channel
Exa
Freshdesk
Genesys
Google Calendar
Google Drive
HubSpot
Intercom
Jira
Parallel
Perplexity
Salesforce
ServiceNow
Slack
Tavily
Telegram
Twilio
Zendesk
ElevenAgents Architect
Starting a conversation
How ElevenAgents Architect works
What ElevenAgents Architect can change
Proposals and validation
Permissions, approvals, and drafts
Customizing ElevenAgents Architect
Claude, Cursor, and other AI assistants
Premium and Lite
Pricing and usage
Limitations and FAQ
Overview
Environment variables
Widget
SIP trunk
SIP reference
Native integration
Custom LLM integration
SMS conversations
Customising calls
Regional routing
Register calls
SMS OTP verification
Vonage
Telnyx
Plivo
Exotel
Bandwidth
Sinch
Vobiz
Amazon Connect
Genesys
Five9
Overview
Widget tab
Azure Communication Services
Graph calling bot
WhatsApp
Getting started
Outbound & templates
Interactive messages
Tools
Troubleshooting & FAQ
Batch calls
Overview
Users
Testing
Experiments
Versioning
Merge proposals
Conversation analysis
Success evaluation
Data collection
Analysis library
Sentiment analysis
Searching conversations
Analytics
Spotlight
Real-time insights
Topic discovery
Real-time monitoring
OpenTelemetry traces
Alerts
Privacy
Retention
Audio retention
Conversation history redaction (Enterprise)
Zero Retention Mode (Enterprise)
Cost optimization
CLI
Hosted MCP
Issues
Events
Server to client events
Client to server events
Custom models
Cloudflare
Groq Cloud
SambaNova Cloud
Together AI
LLM cascading
Post-call webhooks
Python
React
React Native
JavaScript
Kotlin
Swift
Unity
WebSockets
Next.JS
JavaScript
Chat Mode
Burst pricing
Call queueing
OpenAI Realtime API compatibility
ElevenLabs' docs agent
Scaling user interviews
Simulate Conversations
Ghost
Framer
Squarespace
Webflow
Wix
WordPress
Expo React Native
LiveAvatar
Raspberry Pi Voice Assistant
Upstash Redis
Agent WebSockets
List agent branches
Create agent branch
Get agent branch
Update agent branch
Preview merged configuration
Merge agent branch
Preview rebased configuration
Rebase a branch onto main
List Procedures
Create Procedure
Compile Procedures (legacy)
Get Procedure
Remove Procedure
Get Procedure Draft
Delete Procedure Draft
Update Procedure Draft
List Proposals
Create A Merge Proposal
Get A Merge Proposal
Update A Merge Proposal
Review A Merge Proposal
Comment On A Merge Proposal
Merge A Merge Proposal
Create deployment
List Agent Deployments
Create draft
Delete draft
Get agent version metadata
Post agent hold audio
Delete agent hold audio
Create agent
Get agent
List agents
Update agent
Delete agent
Duplicate agent
Get link
Simulate conversation
Stream simulate conversation
Calculate expected LLM usage
Get agent summaries
Run conversation analysis
Run conversation evaluation
List analysis items
Create analysis item
Get analysis item
Update analysis item
Delete analysis item
Update analysis item attachments
List analysis item versions
Copy analysis item
Get analysis item dependent agents
List realtime conversation groups
Create realtime conversation group
Get realtime conversation group
Update realtime conversation group
Delete realtime conversation group
Set realtime conversation group
Clear realtime conversation group
Text search
Smart search
Get agent conversation topics
List tags
Create tag
Get tag
Update tag
Delete tag
Add tag to conversation
Remove tag from conversation
List conversations
Get conversation details
Get conversation summary
Delete conversation
Get conversation audio
Get signed URL
Get conversation token
Create realtime client secret
Send conversation feedback
Upload conversation file
Delete conversation file
Get SIP messages for a conversation
Resolve conversation reference
List workspace tickets
Create conversation ticket
List tickets
Create manual ticket
List assignable users
Get ticket
Update ticket
Delete ticket
Add comment
Add turn comment
Merge tickets
List users
List tools
Get tool
Create tool
Update tool
Delete tool
Get dependent agents
Get tool executions
List knowledge base documents
Delete knowledge base document
Bulk delete knowledge base documents
Get knowledge base document
Update knowledge base document
Create knowledge base document from URL
Create knowledge base document from text
Create knowledge base document from file
Get document content
Get document chunk
Get source file URL
Refresh knowledge base document
Get RAG chunks for a document
Update document file
Create folder
Move document
Bulk move documents
Compute RAG index
Get RAG index
Get RAG index overview
Compute RAG index in batch
Delete RAG index
List crawl jobs
Create crawl job
Get crawl job
Cancel crawl job
Search knowledge base
Get dependent agents
Get dependent agents for multiple documents
Get knowledge base size
Get knowledge base summaries
List tests
Get test
Create test
Update test
Delete test
Get test summaries
Run tests on agent
Create folder
Get folder
Update folder
Delete folder
Bulk move tests to folder
Get test invocation
Update test invocation
Resubmit test invocation
Cancel Test Invocation
List test invocations
Import phone number
List phone numbers
Get phone number
Update phone number
Delete phone number
Get SIP messages for a phone number
List Phone Numbers Page
Get widget
Create widget avatar
Get settings
Update settings
Get secrets
Create secret
Get secret
Update secret
Delete secret
Get secret dependencies
Get dashboard settings
Update Convai Dashboard Settings
Outbound call via SIP trunk
Outbound call via twilio
Register call
Outbound call via Exotel
List WhatsApp accounts
Get WhatsApp account
Update WhatsApp account
Delete WhatsApp account
Outbound call via WhatsApp
Outbound message via WhatsApp
Submit batch calling job
List workspace batch calling jobs
Get batch call information
Export batch call results
Cancel batch calling job
Retry batch calling job
Delete batch calling job
List LLMs
Calculate expected LLM usage
Create MCP server
Delete MCP server
List MCP servers
Get MCP server
List MCP server tools
Update MCP server configuration
Update MCP server approval policy
Create MCP server tool approval
Delete MCP server tool approval
Create configuration override
Get configuration override
Update configuration override
Delete configuration override
Get live count
List environment variables
Create environment variable
Get environment variable
Update environment variable
Delete environment variable
List environments
Create environment
Delete environment
Speech Engine Upstream
HIPAA
TCPA
Disclosure requirement
English
Nederlands
Svenska
Italiano
한국어
Français
中文
Polski
Português
Español
हिन्दी
Deutsch
日本語

