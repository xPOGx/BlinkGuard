import sys
import time

import cv2

TARGET_FPS = 10
PROCESSING_RESOLUTION = (320, 240)


class OpenCVCamera:
    def __init__(self, transport):
        self.transport = transport
        self.capture = None
        self.active = False
        self.target_fps = TARGET_FPS
        self.processing_resolution = PROCESSING_RESOLUTION

    def find_available(self):
        self.transport.send({"debug": "Starting camera detection..."})

        if sys.platform == "win32":
            backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        elif sys.platform == "darwin":
            backends = [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
        else:
            backends = [cv2.CAP_V4L2, cv2.CAP_ANY]

        for backend in backends:
            self.transport.send(
                {"debug": f"Testing backend: {backend}"}
            )
            for camera_index in range(5):
                self.transport.send(
                    {
                        "debug": (
                            f"Trying camera index {camera_index} "
                            f"with backend {backend}"
                        )
                    }
                )
                try:
                    capture = cv2.VideoCapture(camera_index, backend)
                    if capture.isOpened():
                        ret, test_frame = capture.read()
                        capture.release()
                        if ret and test_frame is not None:
                            self.transport.send(
                                {
                                    "debug": (
                                        f"Success! Camera {camera_index} "
                                        f"working with backend {backend}"
                                    )
                                }
                            )
                            self.transport.send(
                                {
                                    "status": (
                                        "Found working camera at index "
                                        f"{camera_index}"
                                    )
                                }
                            )
                            return camera_index, backend

                        self.transport.send(
                            {
                                "debug": (
                                    f"Camera {camera_index} opened but "
                                    "cannot read frames"
                                )
                            }
                        )
                    else:
                        self.transport.send(
                            {
                                "debug": (
                                    f"Failed to open camera {camera_index} "
                                    f"with backend {backend}"
                                )
                            }
                        )
                except Exception as error:
                    self.transport.send(
                        {
                            "debug": (
                                f"Exception testing camera {camera_index} "
                                f"with backend {backend}: {str(error)}"
                            )
                        }
                    )

        self.transport.send(
            {"debug": "No working camera found after trying all options"}
        )
        return None, None

    def start(self, reset_detection):
        self.transport.send({"debug": "start_camera() called"})
        if self.active:
            self.transport.send({"debug": "Camera already active"})
            return True

        max_retries = 10
        retry_delay = 2
        for attempt in range(max_retries):
            self.transport.send(
                {
                    "debug": (
                        f"Camera start attempt {attempt + 1}/{max_retries}"
                    )
                }
            )
            camera_index, backend = self.find_available()
            if camera_index is None:
                self.transport.send(
                    {
                        "debug": (
                            "No working camera found on attempt "
                            f"{attempt + 1}"
                        )
                    }
                )
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue

                self.transport.send(
                    {"error": "No working camera found after all attempts"}
                )
                return False

            try:
                self.capture = cv2.VideoCapture(camera_index, backend)
                ret, test_frame = self.capture.read()
                if not ret or test_frame is None:
                    self.transport.send(
                        {
                            "debug": (
                                "Camera opened but cannot read frames on "
                                f"attempt {attempt + 1}"
                            )
                        }
                    )
                    self.capture.release()
                    self.capture = None
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue

                    self.transport.send(
                        {
                            "error": (
                                "Camera opened but cannot read frames after "
                                "all attempts"
                            )
                        }
                    )
                    return False

                self.capture.set(
                    cv2.CAP_PROP_FRAME_WIDTH,
                    self.processing_resolution[0],
                )
                self.capture.set(
                    cv2.CAP_PROP_FRAME_HEIGHT,
                    self.processing_resolution[1],
                )
                self.capture.set(cv2.CAP_PROP_FPS, self.target_fps)
                actual_width = self.capture.get(cv2.CAP_PROP_FRAME_WIDTH)
                actual_height = self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
                actual_fps = self.capture.get(cv2.CAP_PROP_FPS)
                self.transport.send(
                    {
                        "debug": (
                            "Camera resolution set to: "
                            f"{actual_width}x{actual_height}, FPS: {actual_fps}"
                        )
                    }
                )
                self.active = True
                self.transport.send(
                    {"status": "Camera opened successfully"}
                )
                reset_detection()
                return True
            except Exception as error:
                self.transport.send(
                    {
                        "debug": (
                            "Exception starting camera on attempt "
                            f"{attempt + 1}: {str(error)}"
                        )
                    }
                )
                if self.capture is not None:
                    self.capture.release()
                    self.capture = None
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue

                self.transport.send(
                    {
                        "error": (
                            "Failed to start camera after all attempts: "
                            f"{str(error)}"
                        )
                    }
                )
                return False

        return False

    def stop(self):
        self.transport.send({"debug": "stop_camera() called"})
        if self.capture is not None:
            self.capture.release()
            self.capture = None
        self.active = False
        self.transport.send({"status": "Camera released"})

    def update_target_fps(self, target_fps):
        self.target_fps = int(target_fps)
        if self.active and self.capture is not None:
            self.capture.set(cv2.CAP_PROP_FPS, self.target_fps)

    def update_processing_resolution(self, processing_resolution):
        self.processing_resolution = tuple(processing_resolution)
