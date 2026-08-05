import os
import sys

import dlib


def get_predictor_path():
    if getattr(sys, "frozen", False):
        base_path = sys._MEIPASS
        return os.path.join(
            base_path,
            "assets",
            "models",
            "shape_predictor_68_face_landmarks.dat",
        )

    app_root = os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
    )
    return os.path.join(
        app_root,
        "electron",
        "assets",
        "models",
        "shape_predictor_68_face_landmarks.dat",
    )


def load_models():
    detector = dlib.get_frontal_face_detector()
    predictor_path = get_predictor_path()
    if not os.path.exists(predictor_path):
        return detector, None, predictor_path

    predictor = dlib.shape_predictor(predictor_path)
    return detector, predictor, predictor_path
