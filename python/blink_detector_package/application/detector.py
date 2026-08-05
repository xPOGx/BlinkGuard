import json
import sys
import time

import cv2

from blink_detector_package.domain import (
    BLINK_DISPLAY_DURATION,
    BlinkDetectionState,
)
from blink_detector_package.domain.ear import calculate_ear_fast
from blink_detector_package.infrastructure.camera import OpenCVCamera
from blink_detector_package.infrastructure.models import load_models
from blink_detector_package.infrastructure.transport import NdjsonTransport
from blink_detector_package.infrastructure.vision import (
    PreallocatedBuffers,
    encode_frame,
    get_eye_landmarks_only,
)

NO_FACE_DATA = json.dumps(
    {
        "faceData": {
            "faceDetected": False,
            "ear": 0.0,
            "blink": False,
            "faceRect": {"x": 0, "y": 0, "width": 0, "height": 0},
            "eyeLandmarks": [],
        }
    }
)


class BlinkDetectorApplication:
    def __init__(self, transport=None):
        self.transport = transport or NdjsonTransport()
        self.camera = OpenCVCamera(self.transport)
        self.detection = BlinkDetectionState()
        self.send_video = False
        self.last_blink_display_time = 0.0

    def process_commands(self):
        while not self.transport.command_queue.empty():
            try:
                line = self.transport.command_queue.get_nowait()
                data = json.loads(line)
                self.transport.send(
                    {"debug": f"Processing command: {data}"}
                )

                if "target_fps" in data:
                    self.camera.update_target_fps(data["target_fps"])
                    self.transport.send(
                        {
                            "status": (
                                "Updated target FPS to "
                                f"{self.camera.target_fps}"
                            )
                        }
                    )
                elif "processing_resolution" in data:
                    self.camera.update_processing_resolution(
                        data["processing_resolution"]
                    )
                    self.transport.send(
                        {
                            "status": (
                                "Updated processing resolution to "
                                f"{self.camera.processing_resolution}"
                            )
                        }
                    )
                elif "request_video" in data:
                    self.send_video = True
                    self.transport.send(
                        {"status": "Video streaming enabled"}
                    )
                elif "start_camera" in data:
                    if self.camera.start(self.detection.reset):
                        self.transport.send(
                            {"status": "Camera started successfully"}
                        )
                    else:
                        self.transport.send(
                            {"error": "Failed to start camera"}
                        )
                elif "stop_camera" in data:
                    self.camera.stop()
                    self.send_video = False
                    self.transport.send({"status": "Camera stopped"})
            except json.JSONDecodeError as error:
                self.transport.send(
                    {"debug": f"JSON decode error: {str(error)}"}
                )
            except Exception as error:
                self.transport.send(
                    {"debug": f"Command processing error: {str(error)}"}
                )

    def run(self):
        self.transport.send(
            {"status": "Starting blink detector in standby mode..."}
        )
        detector, predictor, predictor_path = load_models()
        if detector is None or predictor is None:
            self.transport.send(
                {
                    "error": (
                        "Facial landmark model not found at: "
                        f"{predictor_path}"
                    )
                }
            )
            sys.exit(1)

        buffers = PreallocatedBuffers()
        self.transport.send(
            {
                "status": (
                    "Models loaded successfully, ready for camera activation"
                )
            }
        )
        self.transport.send(
            {
                "debug": (
                    "Advanced blink detection with dynamic baseline is active"
                )
            }
        )

        frame_count = 0
        last_face_detection_time = 0
        cached_face_data = None
        frame_interval = 1.0 / self.camera.target_fps
        last_frame_time = time.time()
        default_face_data = {
            "faceDetected": False,
            "ear": 0.0,
            "blink": False,
            "faceRect": {
                "x": 0,
                "y": 0,
                "width": 0,
                "height": 0,
            },
            "eyeLandmarks": [],
        }
        self.transport.start_input_thread()

        try:
            while True:
                self.process_commands()
                if (
                    not self.camera.active
                    or self.camera.capture is None
                ):
                    time.sleep(0.1)
                    continue

                current_time = time.time()
                if current_time - last_frame_time < frame_interval:
                    time.sleep(0.001)
                    continue
                last_frame_time = current_time

                ret, frame = self.camera.capture.read()
                if not ret:
                    self.transport.send({"error": "Failed to read frame"})
                    time.sleep(0.1)
                    continue

                current_shape = frame.shape[:2]
                target_shape = self.camera.processing_resolution[::-1]
                if current_shape != target_shape:
                    frame = cv2.resize(
                        frame,
                        self.camera.processing_resolution,
                    )
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = detector(gray, 0)
                last_face_detection_time = current_time
                face_data = default_face_data.copy()

                for face in faces:
                    left_eye, right_eye = get_eye_landmarks_only(
                        predictor,
                        gray,
                        face,
                        buffers,
                    )
                    left_ear = calculate_ear_fast(left_eye, buffers)
                    right_ear = calculate_ear_fast(right_eye, buffers)
                    avg_ear = (left_ear + right_ear) * 0.5
                    frame_width = frame.shape[1]
                    frame_height = frame.shape[0]
                    face_data["faceDetected"] = True
                    face_data["ear"] = float(avg_ear)
                    face_data["faceRect"] = {
                        "x": float(face.left() / frame_width),
                        "y": float(face.top() / frame_height),
                        "width": float(face.width() / frame_width),
                        "height": float(face.height() / frame_height),
                    }

                    buffers.concatenated_eyes[:6] = left_eye
                    buffers.concatenated_eyes[6:] = right_eye
                    for index in range(12):
                        buffers.normalized_landmarks[index]["x"] = float(
                            buffers.concatenated_eyes[index, 0] / frame_width
                        )
                        buffers.normalized_landmarks[index]["y"] = float(
                            buffers.concatenated_eyes[index, 1] / frame_height
                        )
                    face_data["eyeLandmarks"] = (
                        buffers.normalized_landmarks.copy()
                    )

                    blink_detected, blink_info = self.detection.detect(
                        avg_ear,
                        current_time,
                    )
                    if blink_detected and blink_info:
                        self.last_blink_display_time = current_time
                        face_data["blink"] = True
                        max_drop_ear = blink_info.get(
                            "max_drop_ear",
                            avg_ear,
                        )
                        self.transport.send(
                            {
                                "blink": True,
                                "ear": float(max_drop_ear),
                                "baseline": float(blink_info["baseline"]),
                                "drop_percentage": float(blink_info["drop"]),
                                "duration": float(blink_info["duration"]),
                                "time": float(current_time),
                            }
                        )
                        self.transport.send(
                            {
                                "debug": (
                                    "Blink detected! Max Drop EAR: "
                                    f"{max_drop_ear:.3f}, Baseline: "
                                    f"{blink_info['baseline']:.3f}, Drop: "
                                    f"{blink_info['drop']:.1%}, Duration: "
                                    f"{blink_info['duration']:.3f}s, "
                                    "Absolute Drop: "
                                    f"{blink_info['baseline'] - max_drop_ear:.3f}"
                                )
                            }
                        )
                    elif (
                        current_time - self.last_blink_display_time
                    ) < BLINK_DISPLAY_DURATION:
                        face_data["blink"] = True

                    if (
                        blink_info
                        and self.detection.current_baseline_ear > 0
                    ):
                        face_data["baseline"] = float(
                            self.detection.current_baseline_ear
                        )
                        face_data["blink_phase"] = blink_info.get(
                            "phase",
                            "monitoring",
                        )
                        if blink_info.get("phase") == "monitoring":
                            current_ear_drop_absolute = (
                                self.detection.current_baseline_ear - avg_ear
                            )
                            if current_ear_drop_absolute > 0:
                                face_data["ear_drop_absolute"] = float(
                                    current_ear_drop_absolute
                                )
                                face_data["ear_drop_percentage"] = float(
                                    current_ear_drop_absolute
                                    / self.detection.current_baseline_ear
                                )
                    elif self.detection.current_baseline_ear == 0:
                        face_data["blink_phase"] = "initializing"

                if face_data.get("faceDetected", False):
                    self.transport.send({"faceData": face_data})
                else:
                    self.transport.send_serialized(NO_FACE_DATA)

                if (
                    self.send_video
                    and face_data.get("faceDetected", False)
                ):
                    if self.camera.processing_resolution == (640, 480):
                        frame_base64 = encode_frame(frame)
                    else:
                        display_frame = cv2.resize(frame, (640, 480))
                        frame_base64 = encode_frame(display_frame)
                    self.transport.send(
                        {"videoStream": frame_base64}
                    )
                frame_count += 1
        except KeyboardInterrupt:
            self.transport.send(
                {"status": "Stopping blink detector..."}
            )
        finally:
            self.camera.stop()


def run():
    BlinkDetectorApplication().run()
