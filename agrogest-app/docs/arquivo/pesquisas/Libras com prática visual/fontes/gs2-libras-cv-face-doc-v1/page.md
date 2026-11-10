<br />

The MediaPipe Face Landmarker task lets you detect face landmarks and facial expressions in
images and videos. You can use this task to identify human facial expressions,
apply facial filters and effects, and create virtual avatars. This task uses
machine learning (ML) models that can work with single images or a continuous
stream of images. The task outputs 3-dimensional face landmarks, blendshape
scores (coefficients representing facial expression) to infer detailed facial
surfaces in real time, and transformation matrices to perform the
transformations required for effects rendering.


<iframe class="mp-demo-frame mp-demo-frame--studio" aria-label="Face Landmarker interactive Web SDK demo" loading="lazy" data-src="https://developers.devsite.google/frame/edge/mediapipe/demos/embed/face_landmarker.jshtml" allow="camera *; microphone *"></iframe>

[Open in Web Demos](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/face_landmarker)[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/face-landmarker.ts)

<br />

## Quickstart

Install the SDK for your platform,
[prepare input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision), choose a
running mode, and run inference.

### Web

npm`npm install @mediapipe/tasks-vision`[Web demo](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/face_landmarker)·[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/face-landmarker.ts)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_web)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```typescript
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "face_landmarker.task", delegate: "GPU" },
  runningMode: "IMAGE",
  numFaces: 1,
  outputFaceBlendshapes: true,
});

// Synchronous single-frame call (stateless across images)
const image = document.getElementById("image") as HTMLImageElement;
const result = faceLandmarker.detect(image);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```typescript
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "face_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: true,
});

// Synchronous across decoded frames with monotonic timestamps (never drops frames)
for (const { frame, timestampMs } of decodedVideoFrames) {
  const result = faceLandmarker.detectForVideo(frame, timestampMs);
}
```

#### Livestream

`VIDEO + rAF`Live camera · latest frameWeb tasks run synchronously---pair `runningMode: "VIDEO"` with `requestAnimationFrame` so each paint inspects only the latest camera frame (skipping intermediate frames when busy).

```typescript
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
// On Web, live camera loops pair runningMode: "VIDEO" with requestAnimationFrame
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "face_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: true,
});

const video = document.getElementById("webcam") as HTMLVideoElement;
video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
await video.play();
let lastVideoTime = -1;

function renderLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = faceLandmarker.detectForVideo(video, performance.now());
    console.log(result.faceLandmarks, result.faceBlendshapes);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();
```

### Android (Kotlin)

Gradle`implementation("com.google.mediapipe:tasks-vision:latest.release")`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/face_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build()
val options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .build()

val faceLandmarker = FaceLandmarker.createFromOptions(context, options)

// Synchronous single-image call (no temporal tracking across calls)
val mpImage = BitmapImageBuilder(bitmap).build()
val result = faceLandmarker.detect(mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build()
val options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .build()

val faceLandmarker = FaceLandmarker.createFromOptions(context, options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
val mpImage = BitmapImageBuilder(frameBitmap).build()
val result = faceLandmarker.detectForVideo(mpImage, frameTimestampMs)
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
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build()
val options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .setResultListener { result, _ -> val faces = result.faceLandmarks() }
    .setErrorListener { error -> Log.e("MediaPipe", error.message.orEmpty()) }
    .build()

val faceLandmarker = FaceLandmarker.createFromOptions(context, options)

// Async: automatically drops incoming camera frames when busy so results stay current
faceLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis())
```

### Android (Java)

Gradle`implementation 'com.google.mediapipe:tasks-vision:latest.release'`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/face_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build();
FaceLandmarker.FaceLandmarkerOptions options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .build();

FaceLandmarker faceLandmarker = FaceLandmarker.createFromOptions(context, options);

// Synchronous single-image call (no temporal tracking across calls)
MPImage mpImage = new BitmapImageBuilder(bitmap).build();
FaceLandmarkerResult result = faceLandmarker.detect(mpImage);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker;
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build();
FaceLandmarker.FaceLandmarkerOptions options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .build();

FaceLandmarker faceLandmarker = FaceLandmarker.createFromOptions(context, options);

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
MPImage mpImage = new BitmapImageBuilder(frameBitmap).build();
FaceLandmarkerResult result = faceLandmarker.detectForVideo(mpImage, frameTimestampMs);
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
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("face_landmarker.task")
    .build();
FaceLandmarker.FaceLandmarkerOptions options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumFaces(1)
    .setOutputFaceBlendshapes(true)
    .setResultListener((result, inputImage) -> { var faces = result.faceLandmarks(); })
    .setErrorListener(error -> Log.e("MediaPipe", String.valueOf(error.getMessage())))
    .build();

FaceLandmarker faceLandmarker = FaceLandmarker.createFromOptions(context, options);

// Async: automatically drops incoming camera frames when busy so results stay current
faceLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis());
```

### iOS

SwiftPM`https://github.com/google-ai-edge/mediapipe → MediaPipeTasksVision`[Package.swift](https://developers.google.com/edge/mediapipe/solutions/setup_ios#package_swift)·[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/face_landmarker/ios)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_ios)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task") else { return }

let options = FaceLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .image
options.numFaces = 1
options.outputFaceBlendshapes = true

let faceLandmarker = try FaceLandmarker(options: options)

// Synchronous single-image call (stateless across images)
let mpImage = try MPImage(uiImage: image)
let result = try faceLandmarker.detect(image: mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task") else { return }

let options = FaceLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .video
options.numFaces = 1
options.outputFaceBlendshapes = true

let faceLandmarker = try FaceLandmarker(options: options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
let mpImage = try MPImage(pixelBuffer: pixelBuffer)
let result = try faceLandmarker.detect(videoFrame: mpImage, timestampInMilliseconds: timestampMs)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```swift
import Foundation
import MediaPipeTasksVision

final class FaceLandmarkerStreamService: NSObject {
    private var faceLandmarker: FaceLandmarker?

    func setUp() throws {
        guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task") else { return }

        let options = FaceLandmarkerOptions()
        options.baseOptions.modelAssetPath = modelPath
        options.runningMode = .liveStream
        options.numFaces = 1
        options.outputFaceBlendshapes = true
        options.faceLandmarkerLiveStreamDelegate = self

        faceLandmarker = try FaceLandmarker(options: options)
    }

    func detectAsync(mpImage: MPImage, timestampMs: Int) throws {
        // Async: automatically drops incoming camera frames when busy so results stay current
        try faceLandmarker?.detectAsync(image: mpImage, timestampInMilliseconds: timestampMs)
    }
}

extension FaceLandmarkerStreamService: FaceLandmarkerLiveStreamDelegate {
    func faceLandmarker(
        _ faceLandmarker: FaceLandmarker,
        didFinishDetection result: FaceLandmarkerResult?,
        timestampInMilliseconds: Int,
        error: (any Error)?
    ) {
        guard let result else { return }
        DispatchQueue.main.async {
            let faces = result.faceLandmarks
        }
    }
}
```

### Python

pip`pip install mediapipe`[Sample code](https://colab.research.google.com/github/google-ai-edge/mediapipe-samples/blob/main/examples/face_landmarker/python/%5BMediaPipe_Python_Tasks%5D_Face_Landmarker.ipynb)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_python)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="face_landmarker.task"),
    running_mode=VisionRunningMode.IMAGE,
    num_faces=1,
    output_face_blendshapes=True,
)

with FaceLandmarker.create_from_options(options) as landmarker:
    # Synchronous single-image call (stateless across images)
    mp_image = mp.Image.create_from_file("input.jpg")
    result = landmarker.detect(mp_image)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="face_landmarker.task"),
    running_mode=VisionRunningMode.VIDEO,
    num_faces=1,
    output_face_blendshapes=True,
)

with FaceLandmarker.create_from_options(options) as landmarker:
    # Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
    for mp_image, timestamp_ms in decoded_video_frames:
        result = landmarker.detect_for_video(mp_image, timestamp_ms)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

def on_result(result, output_image: mp.Image, timestamp_ms: int):
    print(f"Detected {len(result.face_landmarks)} face(s) at {timestamp_ms} ms")

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="face_landmarker.task"),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_faces=1,
    output_face_blendshapes=True,
    result_callback=on_result,
)

with FaceLandmarker.create_from_options(options) as landmarker:
    # Async: automatically drops incoming camera frames when busy so results stay current
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    landmarker.detect_async(mp_image, timestamp_ms)
```

On Web, you can use `DrawingUtils(ctx).drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION)` (along with `FACE_LANDMARKS_RIGHT_EYE`, `FACE_LANDMARKS_LEFT_EYE`, and `FACE_LANDMARKS_FACE_OVAL`) from `@mediapipe/tasks-vision` to render facial mesh overlays on an HTML `<canvas>`.

## Task details

This section describes the capabilities, inputs, outputs, and configuration
options of this task.

### Features

- **Input image processing** - Processing includes image rotation, resizing, normalization, and color space conversion.
- **Score threshold** - Filter results based on prediction scores.

Inputs The Face Landmarker accepts an input of one of the following data types:

- Still images
- Decoded video frames
- Live video feed

See [Prepare vision input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision) for `MPImage`, `mp.Image`, and browser media examples.
Outputs The Face Landmarker outputs the following results:

- 3D facial surface landmarks (478 points) for each detected face
- 52 facial blendshape scores and 3D facial transformation matrices

### Configuration options

This task has the following configuration options:

### Web

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded video frames and live camera streams. | {`IMAGE`, `VIDEO`} | `IMAGE` |
| `numFaces` | The maximum number of faces detected by the `FaceLandmarker`. Temporal smoothing is applied when `numFaces` is set to `1`. | Integer \> 0 | `1` |
| `minFaceDetectionConfidence` | The minimum confidence score for face detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minFacePresenceConfidence` | The minimum confidence score for face presence in landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for face tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `outputFaceBlendshapes` | Whether Face Landmarker outputs 52 face blendshape scores for driving 3D facial expressions. **Note:** `*Left` and `*Right` blendshapes correspond to the subject's face, not the viewer. Passing a horizontally mirrored image inverts these outputs. | `Boolean` | `false` |
| `outputFacialTransformationMatrixes` | Whether `FaceLandmarker` outputs the 4x4 facial transformation matrix from canonical face coordinates to the detected face. | `Boolean` | `false` |

### Android

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numFaces` | The maximum number of faces detected by the `FaceLandmarker`. Temporal smoothing is applied when `numFaces` is set to `1`. | Integer \> 0 | `1` |
| `minFaceDetectionConfidence` | The minimum confidence score for face detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minFacePresenceConfidence` | The minimum confidence score for face presence in landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for face tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `outputFaceBlendshapes` | Whether Face Landmarker outputs 52 face blendshape scores for driving 3D facial expressions. **Note:** `*Left` and `*Right` blendshapes correspond to the subject's face, not the viewer. Passing a horizontally mirrored image inverts these outputs. | `Boolean` | `false` |
| `outputFacialTransformationMatrixes` | Whether `FaceLandmarker` outputs the 4x4 facial transformation matrix from canonical face coordinates to the detected face. | `Boolean` | `false` |
| `resultListener` | Asynchronous callback for `LIVE_STREAM` mode results. | `OutputHandler.ResultListener<FaceLandmarkerResult, MPImage>` | Not set |
| `errorListener` | Optional error listener for `LIVE_STREAM` mode. | `ErrorListener` | Not set |

### iOS

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numFaces` | The maximum number of faces detected by the `FaceLandmarker`. Temporal smoothing is applied when `numFaces` is set to `1`. | Integer \> 0 | `1` |
| `minFaceDetectionConfidence` | The minimum confidence score for face detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minFacePresenceConfidence` | The minimum confidence score for face presence in landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for face tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `outputFaceBlendshapes` | Whether Face Landmarker outputs 52 face blendshape scores for driving 3D facial expressions. **Note:** `*Left` and `*Right` blendshapes correspond to the subject's face, not the viewer. Passing a horizontally mirrored image inverts these outputs. | `Boolean` | `false` |
| `outputFacialTransformationMatrixes` | Whether `FaceLandmarker` outputs the 4x4 facial transformation matrix from canonical face coordinates to the detected face. | `Boolean` | `false` |
| `faceLandmarkerLiveStreamDelegate` | Asynchronous delegate for `LIVE_STREAM` mode results (invoked on a serial background queue). | `FaceLandmarkerLiveStreamDelegate` | Not set |

### Python

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `running_mode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires `result_callback`). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `num_faces` | The maximum number of faces detected by the `FaceLandmarker`. Temporal smoothing is applied when `numFaces` is set to `1`. | Integer \> 0 | `1` |
| `min_face_detection_confidence` | The minimum confidence score for face detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `min_face_presence_confidence` | The minimum confidence score for face presence in landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `min_tracking_confidence` | The minimum confidence score for face tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `output_face_blendshapes` | Whether Face Landmarker outputs 52 face blendshape scores for driving 3D facial expressions. **Note:** `*Left` and `*Right` blendshapes correspond to the subject's face, not the viewer. Passing a horizontally mirrored image inverts these outputs. | `Boolean` | `False` |
| `output_facial_transformation_matrixes` | Whether `FaceLandmarker` outputs the 4x4 facial transformation matrix from canonical face coordinates to the detected face. | `Boolean` | `False` |
| `result_callback` | Asynchronous callback function for `LIVE_STREAM` mode results. | `Callable` | Not set |

### Task output

Each `FaceLandmarkerResult` returns 3D facial mesh landmarks, optional expression blendshape coefficients, and optional 4x4 transformation matrices for each detected face:

| Field | Type / Coordinate Space | Description |
|---|---|---|
| `faceLandmarks` | `NormalizedLandmark[][]` (`x, y` in `[0.0, 1.0]`) | 478 3D facial landmarks per face normalized by image width and height, with `z` depth scaled like `x` relative to the center of the head (`face_landmarks` in Python). |
| `faceBlendshapes` | `Classifications[]` (`score` in `[0.0, 1.0]`) | 52 facial expression coefficients (`browDownLeft`, `jawOpen`, `eyeBlinkRight`, etc.) when `outputFaceBlendshapes` is enabled (`face_blendshapes` in Python). *Note: `*Left` and `*Right` correspond to the subject's face; mirroring the input image inverts them.* |
| `facialTransformationMatrixes` | `Matrix[]` (`4×4` float matrix) | Optional 3D canonical-to-observed face pose transformation matrix when `outputFacialTransformationMatrixes` is enabled (`facial_transformation_matrixes` in Python). |

#### Example `FaceLandmarkerResult` payload

The following example shows the output for a single detected face with blendshapes and the 4x4 pose matrix enabled:

    {
      faceLandmarks: [
        [
          { x: 0.5971, y: 0.4854, z: -0.0384 }, // #0 upper lip center (normalized [0.0, 1.0])
          { x: 0.3303, y: 0.2929, z: -0.0949 }, // #1 nose tip
          // ... 478 normalized 3D landmarks per detected face (#0..#477)
        ]
      ],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: "browDownLeft", score: 0.8297 },
            { categoryName: "browDownRight", score: 0.8097 },
            { categoryName: "browInnerUp", score: 0.0004 },
            // ... 52 blendshape coefficients in [0.0, 1.0]
          ]
        }
      ],
      facialTransformationMatrixes: [
        [
          [0.9992, -0.0123, 0.0391, -0.3708],
          [0.0166,  0.9935, -0.1128, 22.7720],
          [-0.0375, 0.1133,  0.9928, -65.1204],
          [0.0,     0.0,     0.0,     1.0]
        ]
      ]
    }

## Models

![Face Landmarker pipeline overview](https://developers.google.com/static/edge/mediapipe/images/solutions/diagrams/face_landmarker.svg)

The Face Landmarker uses a series of models to predict face landmarks.
The first model detects faces, a second model locates landmarks on the detected
faces, and a third model uses those landmarks to identify facial features and
expressions.

The following models are packaged together into a downloadable model bundle:

- **Face detection model**: detects the presence of faces with a few key facial landmarks.
- **Face landmark model**: adds a complete 3D mapping of the face. The model outputs an estimate of 478 3-dimensional face landmarks.
- **Blendshape prediction model**: receives output from the face landmark model and predicts 52 blendshape scores representing facial expressions.

> [!NOTE]
> **Note:** `*Left` and `*Right` blendshapes correspond to the subject's face, not the viewer. Passing a horizontally mirrored image will invert these outputs.

The face detection model is the
[BlazeFace short-range](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector#models)
model, a lightweight and accurate face detector optimized for mobile GPU
inference. For more information, see the
[Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector) task.

The image below shows a complete mapping of facial landmarks from the model
bundle output.
![478 3D Face Landmarker keypoints](https://developers.google.com/static/edge/mediapipe/images/solutions/face_landmarker_keypoints.png)

478 3D facial mesh landmarks

For a more detailed view of the face landmarks, see the
[full-size image](https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png).

| Model bundle | Input shape | Data type | Model Cards | Versions |
|---|---|---|---|---|
| [FaceLandmarker](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task) | FaceDetector: 192 x 192 FaceLandmarker-V2: 256 x 256 Blendshape: 1 x 146 x 2 | float 16 | [FaceDetector](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf) [FaceLandmarker-V2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf) [Blendshape](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) | [Latest](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task) |

