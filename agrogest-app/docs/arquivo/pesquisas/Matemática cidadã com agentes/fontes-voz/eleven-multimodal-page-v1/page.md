For AI agents: a documentation index is available at the root level at /llms.txt. Append /llms.txt to any URL for a page-level index, or .md for the markdown version of any page.
Search/
Connect
BlogHelp CenterAPI PricingSign upLoginLogout
English
OverviewElevenCreativeElevenAgentsElevenAPIReception.aiAPI referenceChangelogHelp Center
Skip to navigationOn this page
Overview
File input
Configuration
DTMF input
Configuration
Scroll to top
ConfigureAgent behavior
Multimodal input
Copy page
Configure file attachments and keypad input for your agent.
Overview
Multimodal input settings control extra ways users can send information to the agent beyond speech. They live in the agent’s Advanced tab, under Multimodal input.
File input
Let users attach images and PDFs in chat
DTMF input
Collect keypad digits from callers during phone conversations
File input
File input lets users send images and PDFs to the agent in chat. The agent can read those files when the selected model supports image and/or document input.
Attachments are ignored if the model does not support the file type, even when file input is
enabled.
Configuration
FieldTypeDefaultDescriptionenabledbooleantrueWhen true, users may attach images or PDFs if the model supports that input type.max_files_in_memoryinteger10How many recently uploaded files are held in memory at once. Range: 1 to 10. When the limit is reached, older files are replaced with a brief summary.max_files_per_conversationinteger10Total files a user can upload in one conversation. Uploads are billed per file. Use -1 for no limit. Must be -1 or greater than or equal to max_files_in_memory.
Users can attach files in the widget, supported chat channels such as Slack, or the upload conversation file API.
Update via the dashboardUpdate via the CLIUpdate via the API
1Open Multimodal input
Open your agent in the dashboard, confirm the selected model supports image and/or PDF input, then go to the Advanced tab.
2Enable file attachments
Under Multimodal input, turn on Allow file attachments.
3Set file limits
Optionally set Files kept in memory and Max files per conversation.
4Save your changes
Save the agent. Users can then attach images and PDFs in chat.
DTMF input
DTMF input lets callers enter digits on their phone keypad during a call. Use it to collect phone numbers, menu choices, and other numeric input without relying on speech recognition.
This is the inverse of the play keypad touch tone system tool, which sends tones from the agent.
Only out-of-band DTMF from
Twilio, SIP
trunking (Telephony), or
Genesys is supported. In-band
tones in the audio stream are ignored. The web widget and chat channels cannot send DTMF.
Each keypad press is buffered until the sequence is complete. Completing a sequence creates one user turn.
The caller presses a key. The first digit interrupts the agent if it is speaking.
Further digits append to the same buffer.
The sequence completes when the caller presses # (if hash termination is enabled) or when no further digits arrive before the timeout.
The agent receives the collected digits as a user turn and responds.
# is a terminator when hash termination is enabled; it is not included in the collected string. A # pressed with an empty buffer is ignored. The buffer accepts 0-9, *, #, and A-D, up to 50 characters.
Configuration
conversation_config.conversation.dtmf_input_settings is null when DTMF input is disabled. When enabled, the defaults are:
FieldTypeDefaultDescriptiondtmf_input_timeoutfloat2.0Seconds to wait after the last keypress before completing the sequence. Range: 0.5 to 10.0.hash_terminatorbooleantrueIf true, # immediately completes the sequence and is not included in the collected digits.redact_inputbooleanfalseIf true, keypad entries are replaced with <REDACTED> in the stored transcript, conversation log, and analysis.
Redaction applies to the keypad turn in stored conversation data. It does not hide digits from the agent during the live call, and it does not rewrite digits the agent speaks back or sends to a tool. That is separate from conversation history redaction.
Update via the dashboardUpdate via the CLIUpdate via the API
1Open Multimodal input
Open your agent in the dashboard and go to the Advanced tab.
2Enable DTMF input
Under Multimodal input, turn on Enable DTMF input.
3Configure timeout and redaction
Optionally set DTMF input timeout, Use # to complete DTMF input, and Redact DTMF input.
4Save your changes
Save the agent, then place a phone call and enter digits on the keypad.
Update the agent’s system prompt so it knows when to ask for keypad input. For example:
If you need the caller's phone number, ask them to type it on their keypad. Wait for the DTMF
input before continuing.
Was this page helpful?YesNo
PreviousStructured proceduresConversation flow
NextBuilt with
OverviewElevenCreativeElevenAgentsElevenAPIReception.aiAPI referenceChangelogHelp Center
Get started
Overview
Quickstart
Configure
Overview
Agent behaviorSystem prompt
Models
Realtime models
Workflows
Procedures
Multimodal input
Conversation flow
Channel behavior
Guardrails
Voice & language
Knowledge base
Tools
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

