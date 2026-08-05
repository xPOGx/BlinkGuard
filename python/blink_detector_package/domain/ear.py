import numpy as np


def calculate_ear_fast(eye_points, buffers):
    buffers.ear_diffs[0] = eye_points[1] - eye_points[5]
    buffers.ear_diffs[1] = eye_points[2] - eye_points[4]
    buffers.ear_diffs[2] = eye_points[0] - eye_points[3]

    np.sum(
        buffers.ear_diffs**2,
        axis=1,
        out=buffers.ear_distances,
    )
    np.sqrt(buffers.ear_distances, out=buffers.ear_distances)
    return float(
        (buffers.ear_distances[0] + buffers.ear_distances[1])
        / (2.0 * buffers.ear_distances[2] + 1e-6)
    )
