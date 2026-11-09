<br />

The MediaPipe Pose Landmarker task lets you detect landmarks of human bodies in an image or
video. You can use this task to identify key body locations, analyze posture,
and categorize movements. This task uses machine learning (ML) models that
work with single images or video. The task outputs body pose landmarks in image
coordinates and in 3-dimensional world coordinates.


<iframe class="mp-demo-frame mp-demo-frame--studio" aria-label="Pose Landmarker interactive Web SDK demo" loading="lazy" data-src="https://developers.devsite.google/frame/edge/mediapipe/demos/embed/pose_landmarker.jshtml" allow="camera *; microphone *"></iframe>

[Open in Web Demos](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/pose_landmarker)[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/pose-landmarker.ts)

<br />

## Quickstart

Install the SDK for your platform,
[prepare input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision), choose a
running mode, and run inference.

### Web

npm`npm install @mediapipe/tasks-vision`[Web demo](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/pose_landmarker)·[Edit in StackBlitz](https://stackblitz.com/github/google-ai-edge/mediapipe-samples-web?file=src/tasks/pose-landmarker.ts)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_web)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```typescript
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "pose_landmarker_lite.task", delegate: "GPU" },
  runningMode: "IMAGE",
  numPoses: 1,
});

// Synchronous single-frame call (stateless across images)
const image = document.getElementById("image") as HTMLImageElement;
const result = poseLandmarker.detect(image);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```typescript
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "pose_landmarker_lite.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numPoses: 1,
});

// Synchronous across decoded frames with monotonic timestamps (never drops frames)
for (const { frame, timestampMs } of decodedVideoFrames) {
  const result = poseLandmarker.detectForVideo(frame, timestampMs);
}
```

#### Livestream

`VIDEO + rAF`Live camera · latest frameWeb tasks run synchronously---pair `runningMode: "VIDEO"` with `requestAnimationFrame` so each paint inspects only the latest camera frame (skipping intermediate frames when busy).

```typescript
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
// On Web, live camera loops pair runningMode: "VIDEO" with requestAnimationFrame
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "pose_landmarker_lite.task", delegate: "GPU" },
  runningMode: "VIDEO",
  numPoses: 1,
});

const video = document.getElementById("webcam") as HTMLVideoElement;
video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
await video.play();
let lastVideoTime = -1;

function renderLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    console.log(result.landmarks, result.worldLandmarks);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();
```

### Android (Kotlin)

Gradle`implementation("com.google.mediapipe:tasks-vision:latest.release")`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/pose_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build()
val options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumPoses(1)
    .build()

val poseLandmarker = PoseLandmarker.createFromOptions(context, options)

// Synchronous single-image call (no temporal tracking across calls)
val mpImage = BitmapImageBuilder(bitmap).build()
val result = poseLandmarker.detect(mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build()
val options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumPoses(1)
    .build()

val poseLandmarker = PoseLandmarker.createFromOptions(context, options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
val mpImage = BitmapImageBuilder(frameBitmap).build()
val result = poseLandmarker.detectForVideo(mpImage, frameTimestampMs)
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
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker

val baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build()
val options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumPoses(1)
    .setResultListener { result, _ -> val poses = result.landmarks() }
    .setErrorListener { error -> Log.e("MediaPipe", error.message.orEmpty()) }
    .build()

val poseLandmarker = PoseLandmarker.createFromOptions(context, options)

// Async: automatically drops incoming camera frames when busy so results stay current
poseLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis())
```

### Android (Java)

Gradle`implementation 'com.google.mediapipe:tasks-vision:latest.release'`[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/pose_landmarker/android)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_android)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build();
PoseLandmarker.PoseLandmarkerOptions options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.IMAGE)
    .setNumPoses(1)
    .build();

PoseLandmarker poseLandmarker = PoseLandmarker.createFromOptions(context, options);

// Synchronous single-image call (no temporal tracking across calls)
MPImage mpImage = new BitmapImageBuilder(bitmap).build();
PoseLandmarkerResult result = poseLandmarker.detect(mpImage);
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```java
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build();
PoseLandmarker.PoseLandmarkerOptions options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.VIDEO)
    .setNumPoses(1)
    .build();

PoseLandmarker poseLandmarker = PoseLandmarker.createFromOptions(context, options);

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
MPImage mpImage = new BitmapImageBuilder(frameBitmap).build();
PoseLandmarkerResult result = poseLandmarker.detectForVideo(mpImage, frameTimestampMs);
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
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;

BaseOptions baseOptions = BaseOptions.builder()
    .setModelAssetPath("pose_landmarker_lite.task")
    .build();
PoseLandmarker.PoseLandmarkerOptions options = PoseLandmarker.PoseLandmarkerOptions.builder()
    .setBaseOptions(baseOptions)
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumPoses(1)
    .setResultListener((result, inputImage) -> { var poses = result.landmarks(); })
    .setErrorListener(error -> Log.e("MediaPipe", String.valueOf(error.getMessage())))
    .build();

PoseLandmarker poseLandmarker = PoseLandmarker.createFromOptions(context, options);

// Async: automatically drops incoming camera frames when busy so results stay current
poseLandmarker.detectAsync(mpImage, SystemClock.uptimeMillis());
```

### iOS

SwiftPM`https://github.com/google-ai-edge/mediapipe → MediaPipeTasksVision`[Package.swift](https://developers.google.com/edge/mediapipe/solutions/setup_ios#package_swift)·[Sample code](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/pose_landmarker/ios)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_ios)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "pose_landmarker_lite", ofType: "task") else { return }

let options = PoseLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .image
options.numPoses = 1

let poseLandmarker = try PoseLandmarker(options: options)

// Synchronous single-image call (stateless across images)
let mpImage = try MPImage(uiImage: image)
let result = try poseLandmarker.detect(image: mpImage)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```swift
import Foundation
import MediaPipeTasksVision

guard let modelPath = Bundle.main.path(forResource: "pose_landmarker_lite", ofType: "task") else { return }

let options = PoseLandmarkerOptions()
options.baseOptions.modelAssetPath = modelPath
options.runningMode = .video
options.numPoses = 1

let poseLandmarker = try PoseLandmarker(options: options)

// Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
let mpImage = try MPImage(pixelBuffer: pixelBuffer)
let result = try poseLandmarker.detect(videoFrame: mpImage, timestampInMilliseconds: timestampMs)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```swift
import Foundation
import MediaPipeTasksVision

final class PoseLandmarkerStreamService: NSObject {
    private var poseLandmarker: PoseLandmarker?

    func setUp() throws {
        guard let modelPath = Bundle.main.path(
            forResource: "pose_landmarker_lite",
            ofType: "task"
        ) else { return }

        let options = PoseLandmarkerOptions()
        options.baseOptions.modelAssetPath = modelPath
        options.runningMode = .liveStream
        options.numPoses = 1
        options.poseLandmarkerLiveStreamDelegate = self

        poseLandmarker = try PoseLandmarker(options: options)
    }

    func detectAsync(mpImage: MPImage, timestampMs: Int) throws {
        // Async: automatically drops incoming camera frames when busy so results stay current
        try poseLandmarker?.detectAsync(image: mpImage, timestampInMilliseconds: timestampMs)
    }
}

extension PoseLandmarkerStreamService: PoseLandmarkerLiveStreamDelegate {
    func poseLandmarker(
        _ poseLandmarker: PoseLandmarker,
        didFinishDetection result: PoseLandmarkerResult?,
        timestampInMilliseconds: Int,
        error: (any Error)?
    ) {
        guard let result else { return }
        DispatchQueue.main.async {
            let poses = result.landmarks
        }
    }
}
```

### Python

pip`pip install mediapipe`[Sample code](https://colab.research.google.com/github/google-ai-edge/mediapipe-samples/blob/main/examples/pose_landmarker/python/%5BMediaPipe_Python_Tasks%5D_Pose_Landmarker.ipynb)·[Setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_python)

#### Image

`IMAGE`Stateless · single frameSynchronous call on independent still images. Resets temporal tracking state on every call.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="pose_landmarker_lite.task"),
    running_mode=VisionRunningMode.IMAGE,
    num_poses=1,
)

with PoseLandmarker.create_from_options(options) as landmarker:
    # Synchronous single-image call (stateless across images)
    mp_image = mp.Image.create_from_file("input.jpg")
    result = landmarker.detect(mp_image)
```

#### Video

`VIDEO`Every frame · no dropsSynchronous tracking across decoded video frames with monotonic timestamps. Processes every frame in order and never drops frames.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="pose_landmarker_lite.task"),
    running_mode=VisionRunningMode.VIDEO,
    num_poses=1,
)

with PoseLandmarker.create_from_options(options) as landmarker:
    # Synchronous: processes every frame in order with monotonic timestamps (no frame drops)
    for mp_image, timestamp_ms in decoded_video_frames:
        result = landmarker.detect_for_video(mp_image, timestamp_ms)
```

#### Livestream

`LIVE_STREAM`Async · drops frames when busyAsynchronous camera pipeline with a result callback. Automatically drops incoming frames when busy so results stay current with low latency.

```python
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

def on_result(result, output_image: mp.Image, timestamp_ms: int):
    print(f"Detected {len(result.pose_landmarks)} pose(s) at {timestamp_ms} ms")

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path="pose_landmarker_lite.task"),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_poses=1,
    result_callback=on_result,
)

with PoseLandmarker.create_from_options(options) as landmarker:
    # Async: automatically drops incoming camera frames when busy so results stay current
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    landmarker.detect_async(mp_image, timestamp_ms)
```

On Web, you can use `DrawingUtils(ctx).drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS)` and `drawLandmarks(landmarks)` from `@mediapipe/tasks-vision` to render pose skeletons on an HTML `<canvas>`.

## Task details

This section describes the capabilities, inputs, outputs, and configuration
options of this task.

### Features

- **Input image processing** - Processing includes image rotation, resizing, normalization, and color space conversion.
- **Score threshold** - Filter results based on prediction scores.

Inputs The Pose Landmarker accepts an input of one of the following data types:

- Still images
- Decoded video frames
- Live video feed

See [Prepare vision input data](https://developers.google.com/edge/mediapipe/solutions/prepare_data#vision) for `MPImage`, `mp.Image`, and browser media examples.
Outputs The Pose Landmarker outputs the following results:

- Pose landmarks in normalized image coordinates
- Pose landmarks in world coordinates
- Optional: a segmentation mask for the pose.

### Configuration options

This task has the following configuration options:

### Web

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded video frames and live camera streams. | {`IMAGE`, `VIDEO`} | `IMAGE` |
| `numPoses` | The maximum number of poses detected by the Pose Landmarker. | Integer \> 0 | `1` |
| `minPoseDetectionConfidence` | The minimum confidence score for pose detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minPosePresenceConfidence` | The minimum confidence score for pose presence in pose landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for pose tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `outputSegmentationMasks` | Whether Pose Landmarker outputs a foreground segmentation mask for each detected pose (`shouldOutputSegmentationMasks` on iOS). | `Boolean` | `false` |

### Android

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numPoses` | The maximum number of poses detected by the Pose Landmarker. | Integer \> 0 | `1` |
| `minPoseDetectionConfidence` | The minimum confidence score for pose detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minPosePresenceConfidence` | The minimum confidence score for pose presence in pose landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for pose tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `outputSegmentationMasks` | Whether Pose Landmarker outputs a foreground segmentation mask for each detected pose (`shouldOutputSegmentationMasks` on iOS). | `Boolean` | `false` |
| `resultListener` | Asynchronous callback for `LIVE_STREAM` mode results. | `OutputHandler.ResultListener<PoseLandmarkerResult, MPImage>` | Not set |
| `errorListener` | Optional error listener for `LIVE_STREAM` mode. | `ErrorListener` | Not set |

### iOS

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `runningMode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires asynchronous listener/delegate). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `numPoses` | The maximum number of poses detected by the Pose Landmarker. | Integer \> 0 | `1` |
| `minPoseDetectionConfidence` | The minimum confidence score for pose detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `minPosePresenceConfidence` | The minimum confidence score for pose presence in pose landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for pose tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `shouldOutputSegmentationMasks` | Whether Pose Landmarker outputs a foreground segmentation mask for each detected pose (`shouldOutputSegmentationMasks` on iOS). | `Boolean` | `false` |
| `poseLandmarkerLiveStreamDelegate` | Asynchronous delegate for `LIVE_STREAM` mode results (invoked on a serial background queue). | `PoseLandmarkerLiveStreamDelegate` | Not set |

### Python

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|
| `running_mode` | Sets the running mode for the task: `IMAGE`: Single image inputs. `VIDEO`: Decoded frames of a video. `LIVE_STREAM`: Livestream of camera input data (requires `result_callback`). | {`IMAGE`, `VIDEO`, `LIVE_STREAM`} | `IMAGE` |
| `num_poses` | The maximum number of poses detected by the Pose Landmarker. | Integer \> 0 | `1` |
| `min_pose_detection_confidence` | The minimum confidence score for pose detection to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `min_pose_presence_confidence` | The minimum confidence score for pose presence in pose landmark detection. | Float `[0.0, 1.0]` | `0.5` |
| `min_tracking_confidence` | The minimum confidence score for pose tracking to be considered successful. | Float `[0.0, 1.0]` | `0.5` |
| `output_segmentation_masks` | Whether Pose Landmarker outputs a foreground segmentation mask for each detected pose (`shouldOutputSegmentationMasks` on iOS). | `Boolean` | `False` |
| `result_callback` | Asynchronous callback function for `LIVE_STREAM` mode results. | `Callable` | Not set |

### Task output

Each `PoseLandmarkerResult` returns normalized image landmarks, 3D world landmarks, and optional segmentation masks for each detected person:

| Field | Type / Coordinate Space | Description |
|---|---|---|
| `landmarks` | `NormalizedLandmark[][]` (`x, y` in `[0.0, 1.0]`) | 33 3D keypoints per pose (`pose_landmarks` in Python). `x` and `y` are normalized by image width and height; `z` is depth relative to the **midpoint of the hips** . Includes `visibility` and `presence` probabilities in `[0.0, 1.0]`. |
| `worldLandmarks` | `Landmark[][]` (meters) | 33 3D keypoints per pose in real-world **meters** with the **midpoint of the hips** as the origin (`pose_world_landmarks` in Python), plus `visibility` and `presence` in `[0.0, 1.0]`. |
| `segmentationMasks` | `MPMask[]` (`Float32` in `[0.0, 1.0]`) | Optional per-pixel person confidence mask when `outputSegmentationMasks` is enabled (`segmentation_masks` in Python). |

#### Example `PoseLandmarkerResult` payload

The following example shows the output for a single detected person (`pose[0]`):

    {
      landmarks: [
        [
          { x: 0.6389, y: 0.6712, z: 0.1300, visibility: 0.9999, presence: 0.9999 },  // #0 nose (normalized [0.0, 1.0])
          { x: 0.6346, y: 0.5364, z: -0.0698, visibility: 0.9999, presence: 0.9999 }, // #1 left_eye_inner
          // ... 33 normalized landmarks per detected pose (#0..#32)
        ]
      ],
      worldLandmarks: [
        [
          { x: 0.0675, y: 0.0311, z: 0.0552, visibility: 0.9999, presence: 0.9999 },  // #0 nose (3D meters from hip center)
          { x: 0.0632, y: -0.0038, z: 0.0209, visibility: 0.9999, presence: 0.9999 }, // #1 left_eye_inner
          // ... 33 world landmarks per detected pose (#0..#32)
        ]
      ]
    }

## Models

![Pose Landmarker pipeline overview](https://developers.google.com/static/edge/mediapipe/images/solutions/diagrams/pose_landmarker.svg)

The Pose Landmarker uses a series of models to predict pose landmarks. The first
model detects the presence of human bodies within an image frame, and the second
model locates landmarks on the bodies.

The following models are packaged together into a downloadable model bundle:

- **Pose detection model**: detects the presence of bodies with a few key pose landmarks.
- **Pose landmarker model**: adds a complete mapping of the pose. The model outputs an estimate of 33 3-dimensional pose landmarks.

This bundle uses a convolutional neural network
similar to [MobileNetV2](https://arxiv.org/pdf/1801.04381.pdf) and is optimized
for on-device, real-time fitness applications. This variant of the
[BlazePose](https://arxiv.org/pdf/2006.10204.pdf) model uses
[GHUM](https://openaccess.thecvf.com/content_CVPR_2020/papers/Xu_GHUM__GHUML_Generative_3D_Human_Shape_and_Articulated_Pose_CVPR_2020_paper.pdf),
a 3D human shape modeling pipeline, to estimate the full 3D body pose of an
individual in images or videos.

| Model bundle | Input shape | Data type | Model Cards | Versions |
|---|---|---|---|---|
| [Pose Landmarker (lite)](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task) | Pose detector: 224 x 224 x 3 Pose landmarker: 256 x 256 x 3 | float 16 | [info](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) | [Latest](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task) |
| [Pose Landmarker (full)](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task) | Pose detector: 224 x 224 x 3 Pose landmarker: 256 x 256 x 3 | float 16 | [info](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) | [Latest](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task) |
| [Pose Landmarker (heavy)](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task) | Pose detector: 224 x 224 x 3 Pose landmarker: 256 x 256 x 3 | float 16 | [info](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) | [Latest](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task) |

### Pose landmarker model

The pose landmarker model tracks 33 body landmark locations, representing the
approximate location of the following body parts:
![33 3D pose landmarks diagram](https://developers.google.com/static/edge/mediapipe/images/solutions/diagrams/pose_landmarks.svg)

| ID | Landmark | ID | Landmark |
|---|---|---|---|
| `0` | `nose` | `17` | `left_pinky` |
| `1` | `left_eye_inner` | `18` | `right_pinky` |
| `2` | `left_eye` | `19` | `left_index` |
| `3` | `left_eye_outer` | `20` | `right_index` |
| `4` | `right_eye_inner` | `21` | `left_thumb` |
| `5` | `right_eye` | `22` | `right_thumb` |
| `6` | `right_eye_outer` | `23` | `left_hip` |
| `7` | `left_ear` | `24` | `right_hip` |
| `8` | `right_ear` | `25` | `left_knee` |
| `9` | `mouth_left` | `26` | `right_knee` |
| `10` | `mouth_right` | `27` | `left_ankle` |
| `11` | `left_shoulder` | `28` | `right_ankle` |
| `12` | `right_shoulder` | `29` | `left_heel` |
| `13` | `left_elbow` | `30` | `right_heel` |
| `14` | `right_elbow` | `31` | `left_foot_index` |
| `15` | `left_wrist` | `32` | `right_foot_index` |
| `16` | `right_wrist` |   |   |

The model output contains both normalized coordinates (`Landmarks`) and world
coordinates (`WorldLandmarks`) for each landmark.

