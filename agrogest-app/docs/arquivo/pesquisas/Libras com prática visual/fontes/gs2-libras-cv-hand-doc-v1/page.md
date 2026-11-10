<br />

The MediaPipe Hand Landmarker task lets you detect the landmarks of the hands in an image.
You can use this task to locate key points of hands and render visual effects on
them. This task operates on image data with a machine learning (ML) model as
static data or a continuous stream and outputs hand landmarks in image
coordinates, hand landmarks in world coordinates, and handedness (left or right
hand) of multiple detected hands.


<iframe class="mp-demo-frame mp-demo-frame--studio" aria-label="Hand Landmarker interactive Web SDK demo" loading="lazy" data-src="https://developers.devsite.google/frame/edge/mediapipe/demos/embed/hand_landmarker.jshtml" allow="camera *; microphone *"></iframe>

[Open in Web Demos](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/hand_landmarker)[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/hand-landmarker.ts)

<br />

## Quickstart

Install the SDK for your platform,
[prepare input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision), choose a
running mode, and run inference.

### Web

npm`npm install @mediapipe/tasks-vision`[Web demo](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/hand_landmarker)·[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/hand-landmarker.ts)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_web)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```typescript
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "hand_landmarker.task", delegate: "GPU" },
  runningMode: "IMAGE",
  numHands: 2,
});

// Synchronous single-frame call (stateless across images)
const image = document.getElementById("image") as HTMLImageElement;
const result = handLandmarker.detect(image);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```typescript
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "hand_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numHands: 2,
});

// Synchronous across decoded frames with monotonic timestamps (never drops frames)
for (const { frame, timestampMs } of decodedVideoFrames) {
  const result = handLandmarker.detectForVideo(frame, timestampMs);
}
```

#### Livestream

`VIDEO + rAF`Live camera · latest frameWeb tasks run synchronously---pair `runningMode: "VIDEO"` with `requestAnimationFrame` so each paint inspects only the latest camera frame (skipping intermediate frames when busy).

```typescript
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
// On Web, live camera loops pair runningMode: "VIDEO" with requestAnimationFrame
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "hand_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numHands: 2,
});

const video = document.getElementById("webcam") as HTMLVideoElement;
video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
await video.play();
let lastVideoTime = -1;

function renderLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    console.log(result.landmarks, result.handedness);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();
```

### Android (Kotlin)

Gradle`implementation("com.google.mediapipe:tasks-vision:latest.release")`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/hand_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build()
val options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumHands(2)
    .build()

val handLandmarker = HandLandmarker.createFromOptions(context, options)

// Synchronous single-image call (no temporal tracking across calls)
val mpImage = BitmapImageBuilder(bitmap).build()
val result = handLandmarker.detect(mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build()
val options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumHands(2)
    .build()

val handLandmarker = HandLandmarker.createFromOptions(context, options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
val mpImage = BitmapImageBuilder(frameBitmap).build()
val result = handLandmarker.detectForVideo(mpImage, frameTimestampMs)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```kotlin
import android.os.SystemClock
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build()
val options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumHands(2)
    .setResultListener { result, _ -> val hands = result.landmarks() }
    .setErrorListener { error -> Log.e("MediaPipe", error.message.orEmpty()) }
    .build()

val handLandmarker = HandLandmarker.createFromOptions(context, options)

// Async: automatically drops incoming camera frames when busy so results stay current
handLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis())
```

### Android (Java)

Gradle`implementation 'com.google.mediapipe:tasks-vision:latest.release'`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/hand_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build();
HandLandmarker.HandLandmarkerOptions options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumHands(2)
    .build();

HandLandmarker handLandmarker = HandLandmarker.createFromOptions(context, options);

// Synchronous single-image call (no temporal tracking across calls)
MPImage mpImage = new BitmapImageBuilder(bitmap).build();
HandLandmarkerResult result = handLandmarker.detect(mpImage);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build();
HandLandmarker.HandLandmarkerOptions options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumHands(2)
    .build();

HandLandmarker handLandmarker = HandLandmarker.createFromOptions(context, options);

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
MPImage mpImage = new BitmapImageBuilder(frameBitmap).build();
HandLandmarkerResult result = handLandmarker.detectForVideo(mpImage, frameTimestampMs);
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```java
import android.os.SystemClock;
import android.util.Log;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("hand_landmarker.task")
    .build();
HandLandmarker.HandLandmarkerOptions options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumHands(2)
    .setResultListener((result, inputImage) -> { var hands = result.landmarks(); })
    .setErrorListener(error -> Log.e("MediaPipe", String.valueOf(error.getMessage())))
    .build();

HandLandmarker handLandmarker = HandLandmarker.createFromOptions(context, options);

// Async: automatically drops incoming camera frames when busy so results stay current
handLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis());
```

### iOS

SwiftPM`https://github.com/google-ai-edge/mediapipe → MediaPipeTasksVision`[Package.swift](https://developers.google.com/edge/mediapipe/solutions/setup_ios#package_swift)·[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/hand_landmarker/ios)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_ios)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task") else { return }

let options = HandLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .image
options.numHands = 2

let handLandmarker = try HandLandmarker(options: options)

// Synchronous single-image call (stateless across images)
let mpImage = try MPImage(uiImage: image)
let result = try handLandmarker.detect(image: mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task") else { return }

let options = HandLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .video
options.numHands = 2

let handLandmarker = try HandLandmarker(options: options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
let mpImage = try MPImage(pixelBuffer: pixelBuffer)
let result = try handLandmarker.detect(videoFrame: mpImage, timestampInMilliseconds: timestampMs)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```swift
import Foundation
import MediaPipeTasksVision

final class HandLandmarkerStreamService: NSObject {
    private var handLandmarker: HandLandmarker?

    func setUp() throws {
        guard let modelPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task") else { return }

        let options = HandLandmarkerOptions()
        options.baseOptions.modelAssetPath = modelPath
        options.runningMode = .liveStream
        options.numHands = 2
        options.handLandmarkerLiveStreamDelegate = self

        handLandmarker = try HandLandmarker(options: options)
    }

    func detectAsync(mpImage: MPImage, timestampMs: Int) throws {
        // Async: automatically drops incoming camera frames when busy so results stay current
        try handLandmarker?.detectAsync(image: mpImage, timestampInMilliseconds: timestampMs)
    }
}

extension HandLandmarkerStreamService: HandLandmarkerLiveStreamDelegate {
    func handLandmarker(
        _ handLandmarker: HandLandmarker,
        didFinishDetection result: HandLandmarkerResult?,
        timestampInMilliseconds: Int,
        error: (any Error)?
    ) {
        guard let result else { return }
        DispatchQueue.main.async {
            let hands = result.landmarks
        }
    }
}
```

### Python

pip`pip install mediapipe`[Sample code](https://colab.research.google.com/github/google-ai-edge/mediapipe-samples/blob/main/examples/hand_landmarker/python/hand_landmarker.ipynb)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_python)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="hand_landmarker.task"),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2,
)

with HandLandmarker.create_from_options(options) as landmarker:
    # Synchronous single-image call (stateless across images)
    mp_image = mp.Image.create_from_file("input.jpg")
    result = landmarker.detect(mp_image)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="hand_landmarker.task"),
    running_mode=VisionRunningMode.VIDEO,
    num_hands=2,
)

with HandLandmarker.create_from_options(options) as landmarker:
    # Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
    for mp_image, timestamp_ms in decoded_video_frames:
        result = landmarker.detect_for_video(mp_image, timestamp_ms)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

def on_result(result, output_image: mp.Image, timestamp_ms: int):
    print(f"Detected {len(result.hand_landmarks)} hand(s) at {timestamp_ms} ms")

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="hand_landmarker.task"),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_hands=2,
    result_callback=on_result,
)

with HandLandmarker.create_from_options(options) as landmarker:
    # Async: automatically drops incoming camera frames when busy so results stay current
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    landmarker.detect_async(mp_image, timestamp_ms)
```

On Web, you can use `DrawingUtils(ctx).drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS)` and `drawLandmarks(landmarks)` from `@mediapipe/tasks-vision` to render hand skeletons on an HTML `<canvas>`.

## Task details

This section describes the capabilities, inputs, outputs, and configuration
options of this task.

### Features

- **Input image processing** - Processing includes image rotation, resizing, normalization, and color space conversion.
- **Score threshold** - Filter results based on prediction scores.

Inputs The Hand Landmarker accepts an input of one of the following data types:

- Still images
- Decoded video frames
- Live video feed

See [Prepare vision input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision) for `MPImage`, `mp.Image`, and browser media examples.
Outputs The Hand Landmarker outputs the following results:

- Handedness of detected hands
- Landmarks of detected hands in image coordinates
- Landmarks of detected hands in world coordinates

> [!NOTE]
> **Note:** Left and Right handedness correspond to the subject's hands, not the viewer. Passing a horizontally mirrored image will invert these outputs.

### Configuration options

This task has the following configuration options:

### Web

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded video frames and live camera streams. | {`IMAGE`, `VIDEO`} | `IMAGE` |
| `numHands` | The maximum number of hands detected by the Hand Landmarker. | Integer \> 0 | `1` |
| `minHandDetectionConfidence` | The minimum confidence score for palm detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minHandPresenceConfidence` | The minimum confidence score for hand presence in the hand landmark model. In `VIDEO` and `LIVE_STREAM` modes, a score lower than this threshold re-triggers palm detection; otherwise, lightweight hand tracking locates the hands across frames. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum bounding-box IoU threshold between consecutive frames for hand tracking to be considered successful in `VIDEO` and `LIVE_STREAM` modes. | Float `[0.0, 1.0]` | `0.5` |

### Android

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numHands` | The maximum number of hands detected by the Hand Landmarker. | Integer \> 0 | `1` |
| `minHandDetectionConfidence` | The minimum confidence score for palm detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minHandPresenceConfidence` | The minimum confidence score for hand presence in the hand landmark model. In `VIDEO` and `LIVE_STREAM` modes, a score lower than this threshold re-triggers palm detection; otherwise, lightweight hand tracking locates the hands across frames. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum bounding-box IoU threshold between consecutive frames for hand tracking to be considered successful in `VIDEO` and `LIVE_STREAM` modes. | Float `[0.0, 1.0]` | `0.5` |
| `resultListener` | Asynchronous callback for `LIVE_STREAM` mode results. | `OutputHandler.ResultListener<HandLandmarkerResult, MPImage>` | Not set |
| `errorListener` | Optional error listener for `LIVE_STREAM` mode. | `ErrorListener` | Not set |

### iOS

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numHands` | The maximum number of hands detected by the Hand Landmarker. | Integer \> 0 | `1` |
| `minHandDetectionConfidence` | The minimum confidence score for palm detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minHandPresenceConfidence` | The minimum confidence score for hand presence in the hand landmark model. In `VIDEO` and `LIVE_STREAM` modes, a score lower than this threshold re-triggers palm detection; otherwise, lightweight hand tracking locates the hands across frames. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum bounding-box IoU threshold between consecutive frames for hand tracking to be considered successful in `VIDEO` and `LIVE_STREAM` modes. | Float `[0.0, 1.0]` | `0.5` |
| `handLandmarkerLiveStreamDelegate` | Asynchronous delegate for `LIVE_STREAM` mode results (invoked on a serial background queue). | `HandLandmarkerLiveStreamDelegate` | Not set |

### Python

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `running_mode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires `result_callback`). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `num_hands` | The maximum number of hands detected by the Hand Landmarker. | Integer \> 0 | `1` |
| `min_hand_detection_confidence` | The minimum confidence score for palm detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `min_hand_presence_confidence` | The minimum confidence score for hand presence in the hand landmark model. In `VIDEO` and `LIVE_STREAM` modes, a score lower than this threshold re-triggers palm detection; otherwise, lightweight hand tracking locates the hands across frames. | Float `[0.0, 1.0]` | `0.5` |
| `min_tracking_confidence` | The minimum bounding-box IoU threshold between consecutive frames for hand tracking to be considered successful in `VIDEO` and `LIVE_STREAM` modes. | Float `[0.0, 1.0]` | `0.5` |
| `result_callback` | Asynchronous callback function for `LIVE_STREAM` mode results. | `Callable` | Not set |

### Task output

Each `HandLandmarkerResult` contains three parallel arrays, where index `i` across each array corresponds to the `i`-th detected hand:

| Field | Type / Coordinate Space | Description |
|---|---|---|
| `handedness` | `Category[][]` (`score` in `[0.0, 1.0]`) | `Left` or `Right` classification for each detected hand (`handednesses` on Web). *Note: Handedness corresponds to the subject's hands, not the viewer; passing a horizontally mirrored image inverts these labels.* |
| `landmarks` | `NormalizedLandmark[][]` (`x, y` in `[0.0, 1.0]`) | 21 3D keypoints per hand. `x` and `y` are normalized by image width and height. `z` represents landmark depth with the **wrist (`#0`) as the origin** (`hand_landmarks` in Python). |
| `worldLandmarks` | `Landmark[][]` (meters) | 21 3D keypoints per hand in real-world **meters** , with the origin at the hand's geometric center (`hand_world_landmarks` in Python). |

#### Example `HandLandmarkerResult` payload

The following example shows the output for a single detected left hand (`hand[0]`):

    {
      handedness: [
        [{ index: 1, score: 0.9840, categoryName: "Left" }]
      ],
      landmarks: [
        [
          { x: 0.6389, y: 0.6712, z: -0.00000034 }, // #0 WRIST (normalized [0.0, 1.0])
          { x: 0.6346, y: 0.5364, z: -0.06984 },    // #1 THUMB_CMC
          // ... 21 normalized landmarks per detected hand (#0..#20)
        ]
      ],
      worldLandmarks: [
        [
          { x: 0.0675, y: 0.0311, z: 0.0552 },      // #0 WRIST (3D meters from hand center)
          { x: 0.0632, y: -0.0038, z: 0.0209 },     // #1 THUMB_CMC
          // ... 21 world landmarks per detected hand (#0..#20)
        ]
      ]
    }

## Models

![Hand Landmarker pipeline overview](https://developers.google.com/static/edge/mediapipe/images/solutions/diagrams/hand_landmarker.svg)

The Hand Landmarker uses a model bundle with two packaged models: a palm detection
model and a hand landmarks detection model. You need a model bundle that
contains both these models to run this task.

| Model name | Input shape | Quantization type | Model Card | Versions |
|---|---|---|---|---|
| [HandLandmarker (full)](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task) | 192 x 192, 224 x 224 | float 16 | [info](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf) | [Latest](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task) |

The hand landmark model bundle detects the keypoint localization of 21
hand-knuckle coordinates within the detected hand regions. The model was trained
on approximately 30K real-world images, as well as several rendered synthetic
hand models imposed over various backgrounds.
![21 3D hand landmarks index map](https://developers.google.com/static/edge/mediapipe/images/solutions/diagrams/hand_landmarks.svg)

| ID | Landmark | ID | Landmark |
|---|---|---|---|
| `0` | `WRIST` | `11` | `MIDDLE_FINGER_DIP` |
| `1` | `THUMB_CMC` | `12` | `MIDDLE_FINGER_TIP` |
| `2` | `THUMB_MCP` | `13` | `RING_FINGER_MCP` |
| `3` | `THUMB_IP` | `14` | `RING_FINGER_PIP` |
| `4` | `THUMB_TIP` | `15` | `RING_FINGER_DIP` |
| `5` | `INDEX_FINGER_MCP` | `16` | `RING_FINGER_TIP` |
| `6` | `INDEX_FINGER_PIP` | `17` | `PINKY_MCP` |
| `7` | `INDEX_FINGER_DIP` | `18` | `PINKY_PIP` |
| `8` | `INDEX_FINGER_TIP` | `19` | `PINKY_DIP` |
| `9` | `MIDDLE_FINGER_MCP` | `20` | `PINKY_TIP` |
| `10` | `MIDDLE_FINGER_PIP` |   |   |

The hand landmarker model bundle contains a palm detection model and a hand
landmarks detection model. The palm detection model locates hands within the
input image, and the hand landmarks detection model identifies specific hand
landmarks on the cropped hand image defined by the palm detection model.

Since running the palm detection model is time consuming, when in video or
livestream running mode, Hand Landmarker uses the bounding box defined by the hand
landmarks model in one frame to localize the region of hands for subsequent
frames. Hand Landmarker only re-triggers the palm detection model if the hand
landmarks model no longer identifies the presence of hands or fails to track the
hands within the frame. This reduces the number of times Hand Landmarker triggers
the palm detection model.

## Task benchmarks

Here are the task benchmarks for the whole pipeline based on the preceding
pre-trained models. The latency result is the average latency on Pixel 6 using
CPU / GPU.

| Model name | Device | CPU latency | GPU latency |
|---|---|---|---|
| HandLandmarker (full) | Pixel 6 | 17.12ms | 12.27ms |

