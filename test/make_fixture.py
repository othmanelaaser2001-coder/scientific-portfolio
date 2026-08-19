"""
Builds a synthetic camera feed for end-to-end testing.

It renders a long leather-like strap with punched holes and stitching, then
sweeps a 640x480 window along it — the motion a hand makes during a real scan,
including slow drift perpendicular to the sweep — and writes the result as a
Y4M file that Chromium can play back as a fake camera.
"""
import sys
import numpy as np

W, H = 640, 480
FRAMES = 150
STEP = 14.0          # pixels of travel per frame
FAST_STEP = 200.0    # a deliberately rushed sweep, for the low-quality path
STRAP_LEN = 3400

rng = np.random.default_rng(7)


def build_strap() -> np.ndarray:
    """Returns an RGB uint8 panorama of a strap on a work surface."""
    img = np.zeros((H + 220, STRAP_LEN, 3), np.float32)

    # Work surface: mid grey with coarse noise, so the background has texture
    # but far less contrast than the object.
    surface = 118 + rng.normal(0, 7, (H + 220, STRAP_LEN, 1))
    img[:] = surface

    top, bottom = 150, 150 + 190
    yy = np.arange(top, bottom)[:, None]
    xx = np.arange(STRAP_LEN)[None, :]

    # Leather: warm base, grain, and a soft highlight down the middle.
    grain = (
        18 * np.sin(xx / 6.5) * np.cos(yy / 4.5)
        + 12 * np.sin((xx + yy) / 3.1)
        + rng.normal(0, 9, (bottom - top, STRAP_LEN))
    )
    centre = (yy - (top + bottom) / 2) / ((bottom - top) / 2)
    highlight = 26 * np.exp(-(centre ** 2) * 2.4)
    base = np.stack(
        [92 + grain + highlight, 58 + grain * 0.8 + highlight * 0.8, 38 + grain * 0.6 + highlight * 0.6],
        axis=-1,
    )
    img[top:bottom, :, :] = base

    # Stitching lines along both edges.
    for edge in (top + 16, bottom - 17):
        for x in range(20, STRAP_LEN - 20, 26):
            img[edge - 2 : edge + 3, x : x + 13] = np.array([226, 214, 190], np.float32)

    # Punched holes at a regular pitch, the feature a user would measure.
    hole_y = (top + bottom) // 2
    for x in range(260, STRAP_LEN - 200, 320):
        ys, xs = np.ogrid[-22:23, -22:23]
        mask = xs ** 2 + ys ** 2 <= 17 ** 2
        patch = img[hole_y - 22 : hole_y + 23, x - 22 : x + 23]
        patch[mask] = np.array([26, 20, 18], np.float32)
        ring = (xs ** 2 + ys ** 2 > 17 ** 2) & (xs ** 2 + ys ** 2 <= 21 ** 2)
        patch[ring] = np.array([64, 44, 34], np.float32)

    # Slow lighting falloff along the strap, to exercise exposure compensation.
    gradient = np.linspace(1.12, 0.9, STRAP_LEN)[None, :, None]
    img *= gradient
    return np.clip(img, 0, 255).astype(np.uint8)


def rgb_to_i420(frame: np.ndarray) -> bytes:
    r = frame[:, :, 0].astype(np.float32)
    g = frame[:, :, 1].astype(np.float32)
    b = frame[:, :, 2].astype(np.float32)
    y = 0.257 * r + 0.504 * g + 0.098 * b + 16
    u = -0.148 * r - 0.291 * g + 0.439 * b + 128
    v = 0.439 * r - 0.368 * g - 0.071 * b + 128
    y = np.clip(y, 0, 255).astype(np.uint8)
    u = np.clip(u[::2, ::2], 0, 255).astype(np.uint8)
    v = np.clip(v[::2, ::2], 0, 255).astype(np.uint8)
    return y.tobytes() + u.tobytes() + v.tobytes()


def main(path: str, vertical: bool = False, fast: bool = False) -> None:
    strap = build_strap()
    # A top-to-bottom scan is the same sweep with the world turned a quarter turn.
    frame_w, frame_h = (H, W) if vertical else (W, H)
    step = FAST_STEP if fast else STEP
    with open(path, 'wb') as out:
        out.write(f'YUV4MPEG2 W{frame_w} H{frame_h} F15:1 Ip A1:1 C420mpeg2\n'.encode())
        for i in range(FRAMES):
            x = int(60 + i * step) % max(1, STRAP_LEN - W - 80)
            # Gentle hand drift perpendicular to the sweep.
            y = int(110 + 9 * np.sin(i / 11.0))
            window = strap[y : y + H, x : x + W]
            if window.shape[0] != H or window.shape[1] != W:
                break
            if vertical:
                window = np.rot90(window, k=1).copy()
            out.write(b'FRAME\n')
            out.write(rgb_to_i420(window))
    print(f'wrote {path}')


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'test/fixtures/strap.y4m'
    main(target, vertical='--vertical' in sys.argv, fast='--fast' in sys.argv)
