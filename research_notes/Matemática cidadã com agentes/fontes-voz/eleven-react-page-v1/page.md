For AI agents: a documentation index is available at the root level at /llms.txt. Append /llms.txt to any URL for a page-level index, or .md for the markdown version of any page.
Search/
Connect
BlogHelp CenterAPI PricingSign upLoginLogout
English
OverviewElevenCreativeElevenAgentsElevenAPIReception.aiAPI referenceChangelogHelp Center
Skip to navigationOn this page
Installation
Usage
ConversationProvider
Provider props
Controlled mute state
useConversation
Initialize conversation
Options
Callbacks Overview
Client Tools
Conversation overrides
Text only
Controlled State
Data residency
Methods
startSession
endSession
setVolume
sendUserMessage
sendContextualUpdate
sendFeedback
sendUserActivity
changeInputDevice
changeOutputDevice
getId
getInputVolume / getOutputVolume
getInputByteFrequencyData / getOutputByteFrequencyData
sendMCPToolApprovalResult
Return values
Granular Hooks
useConversationControls
useConversationStatus
useConversationInput
useConversationMode
useConversationFeedback
useRawConversation
useConversationClientTool
Scroll to top
ResourcesSDKs
React SDK
Copy page
ElevenAgents SDK: deploy customized, interactive voice agents in minutes.
Refer to the ElevenAgents overview for an explanation of how
ElevenAgents works.
Installation
Install the package in your project through package manager.
npm install @elevenlabs/react
# or
yarn add @elevenlabs/react
# or
pnpm install @elevenlabs/react
Upgrading from an earlier version? Run npx skills add elevenlabs/packages to install the
elevenlabs:sdk-migration skill for your AI coding agent, which automates import changes,
ConversationProvider wrapping, and API updates.
@elevenlabs/react re-exports everything from @elevenlabs/client, so you don’t need to install
both packages.
Usage
Here is a minimal working example that connects to an agent and lets the user start and end a voice conversation:
import {
 ConversationProvider,
 useConversationControls,
 useConversationStatus,
} from "@elevenlabs/react";
function App() {
 return (
 <ConversationProvider>
 <Agent />
 </ConversationProvider>
 );
}
function Agent() {
 const { startSession, endSession } = useConversationControls();
 const { status } = useConversationStatus();
 if (status === "connected") {
 return <button onClick={endSession}>End</button>;
 }
 return (
 <button onClick={() => startSession({ agentId: "agent_7101k5zvyjhmfg983brhmhkd98n6" })}>
 Start
 </button>
 );
}
The sections below explain each part in detail.
ConversationProvider
All conversation hooks must be used within a ConversationProvider. Wrap your app (or the relevant subtree) with this provider.
import { ConversationProvider } from "@elevenlabs/react";
function App() {
 return (
 <ConversationProvider>
 <YourComponents />
 </ConversationProvider>
 );
}
Provider props
The provider accepts the same options as useConversation — including callbacks, client tools, overrides, and server location — so you can configure them at the provider level rather than in each hook consumer.
<ConversationProvider
 onConnect={() => console.log("Connected")}
 onDisconnect={() => console.log("Disconnected")}
 onError={(error) => console.error("Error:", error)}
 clientTools={{
 displayMessage: (parameters: { text: string }) => {
 alert(parameters.text);
 return "Message displayed";
 },
 }}
 serverLocation="eu-residency"
>
 <YourComponents />
</ConversationProvider>
Controlled mute state
The provider supports isMuted and onMutedChange props for controlled mute state management, allowing you to persist mute state externally (e.g. across sessions).
const [muted, setMuted] = useState(false);
<ConversationProvider isMuted={muted} onMutedChange={setMuted}>
 <YourComponents />
</ConversationProvider>;
useConversation
A convenience React hook that combines all granular hooks into a single return value. Requires a ConversationProvider ancestor.
For better render performance, consider using the granular hooks instead.
useConversation triggers a re-render on any state change, while the granular hooks only
re-render when their specific slice of state changes.
Initialize conversation
import { useConversation } from "@elevenlabs/react";
function MyComponent() {
 const conversation = useConversation();
 // ...
}
Note that ElevenAgents requires microphone access for voice conversations. Consider explaining and allowing access in your app’s UI before the conversation starts.
// call after explaining to the user why the microphone access is needed
await navigator.mediaDevices.getUserMedia({ audio: true });
Options
The hook can be optionally initialized with options. These can also be passed at the ConversationProvider level.
const conversation = useConversation({
 /* options object */
});
Options include:
clientTools - object definition for client tools that can be invoked by agent. See below for details.
overrides - object definition for conversation settings overrides. See below for details.
textOnly - whether the conversation should run in text-only mode. See below for details.
serverLocation - specify the server location ("us", "eu-residency", "in-residency", "global"). Defaults to "us".
Callbacks Overview
onConnect - handler called when the conversation connection is established.
onDisconnect - handler called when the conversation connection is ended.
onMessage - handler called when a new message is received. These can be tentative or final transcriptions of user voice, replies produced by LLM, or debug message when a debug option is enabled.
onError - handler called when a error is encountered.
onAudio - handler called when audio data is received.
onModeChange - handler called when the conversation mode changes (speaking/listening).
onStatusChange - handler called when the connection status changes.
onCanSendFeedbackChange - handler called when the ability to send feedback changes.
onDebug - handler called when debug information is available.
onUnhandledClientToolCall - handler called when an unhandled client tool call is encountered.
onVadScore - handler called when voice activity detection score changes.
onAudioAlignment - handler called when audio alignment data is received, providing character-level timing information for agent speech.
onAgentChatResponsePart - handler called with the agent’s response text as it is generated, as start, delta and stop events. Always sent in text-only mode; for voice conversations, enable agent_chat_response_part in the agent’s client_events configuration.
Client Tools
Client tools are a way to enable agent to invoke client-side functionality. This can be used to trigger actions in the client, such as opening a modal or doing an API call on behalf of the user.
Client tools definition is an object of functions, and needs to be identical with your configuration within the ElevenLabs UI, where you can name and describe different tools, as well as set up the parameters passed by the agent.
const conversation = useConversation({
 clientTools: {
 displayMessage: (parameters: { text: string }) => {
 alert(parameters.text);
 return "Message displayed";
 },
 },
});
If the function returns a value, it is passed back to the agent as a response.
The tool must be explicitly set to block the conversation in the ElevenLabs UI for the agent to await and react to the response. Otherwise, the agent assumes success and continues the conversation.
For a more React-idiomatic approach to registering client tools, see
useConversationClientTool.
Conversation overrides
You may choose to override various settings of the conversation and set them dynamically based other user interactions.
We support overriding various settings. These settings are optional and can be used to customize the conversation experience.
The following settings are available:
const conversation = useConversation({
 overrides: {
 agent: {
 prompt: {
 prompt: "My custom prompt",
 },
 firstMessage: "My custom first message",
 language: "en",
 },
 tts: {
 voiceId: "custom voice id",
 },
 conversation: {
 textOnly: true,
 },
 },
});
Text only
If your agent is configured to run in text-only mode, i.e. it does not send or receive audio messages, you can use this flag to use a lighter version of the conversation. In that case, the user will not be asked for microphone permissions and no audio context will be created.
const conversation = useConversation({
 textOnly: true,
});
Controlled State
You can control certain aspects of the conversation state directly through the hook options:
const [micMuted, setMicMuted] = useState(false);
const conversation = useConversation({
 micMuted,
 // ... other options
});
// Update controlled state
setMicMuted(true); // This will automatically mute the microphone
Data residency
You can specify which ElevenLabs server region to connect to. For more information see the data residency guide.
const conversation = useConversation({
 serverLocation: "eu-residency", // or "us", "in-residency", "global"
});
Methods
startSession
The startSession method establishes the connection and starts using the microphone to communicate with the ElevenLabs Agents agent. The method accepts an options object, with signedUrl, conversationToken, or agentId being required.
The Agent ID can be acquired through ElevenLabs UI.
We also recommended passing in your own end user IDs to map conversations to your users.
The connection type is automatically inferred based on the conversation mode. Voice conversations
use WebRTC and text-only conversations use WebSocket by default. You can still explicitly specify
connectionType if needed.
const conversation = useConversation();
// For public agents, pass in the agent ID
const conversationId = await conversation.startSession({
 agentId: "agent_7101k5zvyjhmfg983brhmhkd98n6",
 userId: "user_9302xkm82nds93", // optional field
});
For public agents (i.e. agents that don’t have authentication enabled), only the agentId is required.
If the conversation requires authorization, use the REST API to generate signed links for a WebSocket connection or a conversation token for a WebRTC connection.
startSession returns a promise resolving a conversationId. The value is a globally unique conversation ID you can use to identify separate conversations.
WebSocket connectionWebRTC connection
// Node.js server
app.get("/signed-url", yourAuthMiddleware, async (req, res) => {
 const response = await fetch(
 `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.AGENT_ID}`,
 {
 headers: {
 // Requesting a signed url requires your ElevenLabs API key
 // Do NOT expose your API key to the client!
 "xi-api-key": process.env.ELEVENLABS_API_KEY,
 },
 }
 );
 if (!response.ok) {
 return res.status(500).send("Failed to get signed URL");
 }
 const body = await response.json();
 res.send(body.signed_url);
});
// Client
const response = await fetch("/signed-url", yourAuthHeaders);
const signedUrl = await response.text();
await conversation.startSession({
 signedUrl,
});
endSession
A method to manually end the conversation. The method will disconnect and end the conversation.
await conversation.endSession();
setVolume
Sets the output volume of the conversation. Accepts an object with a volume field between 0 and 1.
await conversation.setVolume({ volume: 0.5 });
sendUserMessage
Sends a text message to the agent.
Can be used to let the user type in the message instead of using the microphone. Unlike sendContextualUpdate, this will be treated as a user message and will prompt the agent to take its turn in the conversation.
const { sendUserMessage, sendUserActivity } = useConversation();
const [value, setValue] = useState("");
return (
 <>
 <input
 value={value}
 onChange={e => {
 setValue(e.target.value);
 sendUserActivity();
 }}
 />
 <button
 onClick={() => {
 sendUserMessage(value);
 setValue("");
 }}
 >
 SEND
 </button>
 </>
);
sendContextualUpdate
Sends contextual information to the agent that won’t trigger a response.
const { sendContextualUpdate } = useConversation();
sendContextualUpdate(
 "User navigated to another page. Consider it for next response, but don't react to this contextual update."
);
sendFeedback
Provide feedback on the conversation quality. This helps improve the agent’s performance.
const { sendFeedback } = useConversation();
sendFeedback(true); // positive feedback
sendFeedback(false); // negative feedback
sendUserActivity
Notifies the agent about user activity to prevent interruptions. Useful for when the user is actively using the app and the agent should pause speaking, i.e. when the user is typing in a chat.
The agent will pause speaking for ~2 seconds after receiving this signal.
const { sendUserActivity } = useConversation();
// Call this when user is typing to prevent interruption
sendUserActivity();
changeInputDevice
Switch the audio input device during an active voice conversation. This method is only available for voice conversations.
// Change to a specific input device
conversation.changeInputDevice({
 sampleRate: 16000,
 format: "pcm",
 preferHeadphonesForIosDevices: true,
 inputDeviceId: "a1b2c3d4e5f6", // Optional: specific device ID
});
changeOutputDevice
Switch the audio output device during an active voice conversation. This method is only available for voice conversations.
// Change to a specific output device
conversation.changeOutputDevice({
 sampleRate: 16000,
 format: "pcm",
 outputDeviceId: "a1b2c3d4e5f6", // Optional: specific device ID
});
Device switching only works for voice conversations. If no specific deviceId is provided, the
browser will use its default device selection. You can enumerate available devices using the
MediaDevices.enumerateDevices()
API.
getId
Returns the current conversation ID.
const { getId } = useConversation();
const conversationId = getId();
console.log(conversationId); // e.g., "conv_9001k1zph3fkeh5s8xg9z90swaqa"
getInputVolume / getOutputVolume
Methods that return the current input/output volume levels (0-1 scale).
const { getInputVolume, getOutputVolume } = useConversation();
const inputLevel = getInputVolume();
const outputLevel = getOutputVolume();
getInputByteFrequencyData / getOutputByteFrequencyData
Methods that return Uint8Arrays containing the current input/output frequency data. See AnalyserNode.getByteFrequencyData for more information.
const { getInputByteFrequencyData, getOutputByteFrequencyData } = useConversation();
const inputFrequencyData = getInputByteFrequencyData();
const outputFrequencyData = getOutputByteFrequencyData();
These methods are only available for voice conversations. In WebRTC mode the audio is hardcoded to
use pcm_48000, meaning any visualization using the returned data might show different patterns
to WebSocket connections.
sendMCPToolApprovalResult
Sends approval result for MCP (Model Context Protocol) tool calls.
const { sendMCPToolApprovalResult } = useConversation();
// Approve a tool call
sendMCPToolApprovalResult("tc_8k2m4n6p8r0t", true);
// Reject a tool call
sendMCPToolApprovalResult("tc_8k2m4n6p8r0t", false);
Return values
In addition to the methods above, useConversation returns the following reactive state:
status - the current connection status ("disconnected", "connecting", "connected").
isSpeaking - whether the agent is currently speaking.
isListening - whether the agent is currently listening.
mode - the current conversation mode ("speaking" or "listening").
isMuted - whether the microphone is currently muted.
setMuted - function to mute/unmute the microphone.
canSendFeedback - whether feedback can be submitted for the current conversation.
message - the latest message from the conversation.
const { status, isSpeaking, isListening, isMuted, setMuted, canSendFeedback } = useConversation();
return (
 <div>
 <p>Status: {status}</p>
 <p>Agent is {isSpeaking ? 'speaking' : 'listening'}</p>
 <button onClick={() => setMuted(!isMuted)}>
 {isMuted ? 'Unmute' : 'Mute'}
 </button>
 </div>
);
Granular Hooks
For better render performance, use these hooks instead of useConversation. Each hook subscribes to only its specific slice of state, so components only re-render when the data they consume changes.
All granular hooks require a ConversationProvider ancestor.
useConversationControls
Returns action methods for controlling the conversation. This hook does not cause re-renders since it only provides stable function references.
import { useConversationControls } from "@elevenlabs/react";
function Controls() {
 const {
 startSession,
 endSession,
 sendUserMessage,
 sendContextualUpdate,
 sendUserActivity,
 setVolume,
 changeInputDevice,
 changeOutputDevice,
 sendMCPToolApprovalResult,
 getId,
 getInputVolume,
 getOutputVolume,
 getInputByteFrequencyData,
 getOutputByteFrequencyData,
 } = useConversationControls();
 return (
 <button onClick={() => startSession({ agentId: "agent_7101k5zvyjhmfg983brhmhkd98n6" })}>
 Start
 </button>
 );
}
useConversationStatus
Returns the current connection status and optional status message.
import { useConversationStatus } from "@elevenlabs/react";
function StatusIndicator() {
 const { status, message } = useConversationStatus();
 return <p>Status: {status}</p>; // "disconnected" | "connecting" | "connected"
}
useConversationInput
Returns mute state and a setter for toggling the microphone.
import { useConversationInput } from "@elevenlabs/react";
function MuteToggle() {
 const { isMuted, setMuted } = useConversationInput();
 return <button onClick={() => setMuted(!isMuted)}>{isMuted ? "Unmute" : "Mute"}</button>;
}
useConversationMode
Returns speaking/listening state for the agent.
import { useConversationMode } from "@elevenlabs/react";
function ModeIndicator() {
 const { mode, isSpeaking, isListening } = useConversationMode();
 return <p>Agent is {isSpeaking ? "speaking" : "listening"}</p>;
}
useConversationFeedback
Returns feedback availability and a method to submit feedback.
import { useConversationFeedback } from "@elevenlabs/react";
function FeedbackButtons() {
 const { canSendFeedback, sendFeedback } = useConversationFeedback();
 if (!canSendFeedback) return null;
 return (
 <div>
 <button onClick={() => sendFeedback(true)}>Like</button>
 <button onClick={() => sendFeedback(false)}>Dislike</button>
 </div>
 );
}
useRawConversation
Returns the raw conversation instance. This is an escape hatch for advanced use cases where you need direct access to the underlying VoiceConversation or TextConversation object.
import { useRawConversation } from "@elevenlabs/react";
function Advanced() {
 const conversation = useRawConversation();
 // Access the raw conversation instance directly
}
useConversationClientTool
A hook for dynamically registering client tools from React components. Tools are automatically unregistered when the component unmounts.
This is useful when a tool’s handler needs access to component state or props that aren’t available at the provider level.
import { useConversationClientTool } from "@elevenlabs/react";
import { useState } from "react";
function MapComponent() {
 const [location, setLocation] = useState({ lat: 0, lng: 0 });
 useConversationClientTool("getLocation", () => {
 return `${location.lat},${location.lng}`;
 });
 useConversationClientTool("setLocation", (params: { lat: number; lng: number }) => {
 setLocation(params);
 return "Location updated";
 });
 return <Map center={location} />;
}
The hook always uses the latest closure value of the handler, so you don’t need to worry about stale state.
Was this page helpful?YesNo
PreviousPython SDKReact Native SDK
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
SDKsPython
React
React Native
JavaScript
Kotlin
Swift
Unity
WebSockets
CLI
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

