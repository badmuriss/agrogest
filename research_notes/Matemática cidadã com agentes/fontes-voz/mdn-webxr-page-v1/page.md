Skip to main content
 Skip to search
 MDN
 HTML
 HTML: Markup language
 HTML reference
 Elements
 Global attributes
 Attributes
 See all…
 HTML guides
 Responsive images
 HTML cheatsheet
 Date & time formats
 See all…
 Markup languages
 SVG
 MathML
 XML
 CSS
 CSS: Styling language
 CSS reference
 Properties
 Selectors
 At-rules
 Values
 See all…
 CSS guides
 Box model
 Animations
 Flexbox
 Colors
 See all…
 Layout cookbook
 Column layouts
 Centering an element
 Card component
 See all…
 JavaScriptJS
 JavaScript: Scripting language
 JS reference
 Standard built-in objects
 Expressions & operators
 Statements & declarations
 Functions
 See all…
 JS guides
 Control flow & error handling
 Loops and iteration
 Working with objects
 Using classes
 See all…
 Web APIs
 Web APIs: Programming interfaces
 Web API reference
 File system API
 Fetch API
 Geolocation API
 HTML DOM API
 Push API
 Service worker API
 See all…
 Web API guides
 Using the Web animation API
 Using the Fetch API
 Working with the History API
 Using the Web speech API
 Using web workers
 All
 All web technology
 Technologies
 Accessibility
 HTTP
 URI
 Web extensions
 WebAssembly
 WebDriver
 See all…
 Topics
 Media
 Performance
 Privacy
 Security
 Progressive web apps
 Learn
 Learn web development
 Frontend developer course
 Getting started modules
 Core modules
 MDN Curriculum
 Check out the video course from Scrimba, our partner
 Learn HTML
 Structuring content with HTML module
 Learn CSS
 CSS styling basics module
 CSS layout module
 Learn JavaScript
 Dynamic scripting with JavaScript module
 Tools
 Discover our tools
 Playground
 HTTP Observatory
 Border-image generator
 Border-radius generator
 Box-shadow generator
 Color format converter
 Color mixer
 Shape generator
 About
 Get to know MDN better
 About MDN
 Advertise with us
 Community
 MDN on GitHub
 Blog
 Web
 Web APIs
 WebXR Device API
 WebXR application life cycle
 WebXR application life cycle
 In this guide, we'll get a birds-eye view of what's involved in creating and driving a WebXR application, without diving down to the code level in detail. This serves as preparation for the next few articles in these WebXR guides, which cover starting up and shutting down a WebXR session, geometry, simulating cameras, spatial tracking, and more.
 In this article
 Life cycle outline
 Life cycle outline
 Most applications using WebXR will follow a similar overall design pattern:
Check to see if the user's device and browser are both capable of presenting the XR experience you want to provide.
Make sure the WebXR API is available; if navigator.xr is undefined, you can assume the user's browser and/or device doesn't support WebXR. If it's not supported, disable any user interface used to activate XR features and abort any attempts to enter XR mode.
Call navigator.xr.isSessionSupported(), specifying the WebXR experience mode you want to provide: inline, immersive-vr, or immersive-ar, in order to determine whether or not the type of session you wish to provide is available.
If the session type you want to use is available, provide the appropriate interface to the user to allow them to activate it.
When the user requests the activation of WebXR functionality by engaging with the user interface enabled above, request an XRSession using the desired mode. This is done by calling navigator.xr.requestSession(), again specifying the string indicating the mode you want to enable: inline, immersive-vr, or immersive-ar.
If the promise returned by requestSession() resolves, use the new XRSession to manage the WebXR session for the duration of the WebXR experience. This will involve managing inputs, animations, and rendering.
Call the XRSession method requestAnimationFrame() to schedule the first frame render for the XR device.
If your scene is complex, you should consider creating a Worker—or using one that you've previously created for this purpose—to perform the computations needed for each frame to be rendered. This will reduce the chance that the rendering process will noticeably stall the app.
Each requestAnimationFrame() callback should use the information provided about the objects located in the 3D world to render the frame using WebGL.
Each time the callback is invoked, it should call requestAnimationFrame() again in order to let the browser know that the callback needs to be run again when it's time to render the next frame.
When the time comes (such as when the user exits your app or navigates away from your site), end the XR session; otherwise, continue the loop until the user chooses to exit XR mode.
To end the XR session yourself, call XRSession.end().
Include a handler for the XRSession event end event to be informed when the session is ending, regardless of whether your code, the user, or the browser initiated the termination of the session.
 Help improve MDN
 Learn how to contribute 
 This page was last modified on Jun 23, 2025 by MDN contributors.
 View this page on GitHub • Report a problem with this content
 WebXR Device API
GuidesFundamentals of WebXR
WebXR application life cycle
Starting up and shutting down a WebXR session
Geometry and reference spaces in WebXR
Spaces and reference spaces: Spatial tracking in WebXR
Rendering and the WebXR frame animation callback
Viewpoints and viewers: Simulating cameras in WebXR
A perspective retrospective for WebXR developers
Lighting a WebXR setting
Using bounded reference spaces
Movement, orientation, and motion: A WebXR example
Inputs and input sources
Targeting and hit detection
WebXR performance guide
WebXR permissions and security
InterfacesXRAnchor
XRBoundedReferenceSpace
XRCPUDepthInformation
XRDepthInformation
XRFrame
XRInputSource
XRInputSourceArray
XRInputSourceEvent
XRInputSourcesChangeEvent
XRPose
XRReferenceSpace
XRReferenceSpaceEvent
XRRenderState
XRRigidTransform
XRSession
XRSessionEvent
XRSpace
XRSystem
XRView
XRViewerPose
XRViewport
XRWebGLBinding
XRWebGLDepthInformation
XRWebGLLayer
PropertiesNavigator.xr
MethodsWebGLRenderingContext.makeXRCompatible()
EventsXRSystem: devicechange
XRSession: end
XRSession: inputsourceschange
XRReferenceSpace: reset
XRSession: select
XRSession: selectend
XRSession: selectstart
XRSession: visibilitychange
 MDN
 Your blueprint for a better internet.
 MDN
 About
 Blog
 Mozilla careers
 Advertise with us
 MDN Plus
 Product help
 Contribute
 MDN Community
 Community resources
 Writing guidelines
 MDN Discord
 MDN on GitHub
 Developers
 Web technologies
 Learn web development
 Guides
 Tutorials
 Glossary
 Hacks blog
 Mozilla
 Website Privacy Notice
 Telemetry Settings
 Legal
 Community Participation Guidelines
 Portions of this content are ©1998–2026 by individual mozilla.org contributors. Content available under a Creative Commons license.

