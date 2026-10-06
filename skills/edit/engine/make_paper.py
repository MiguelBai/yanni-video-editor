import numpy as np, sys
from PIL import Image
W, H = 1300, 2300
S = 2
w, h = W // S, H // S
rng = np.random.default_rng(int(sys.argv[2]))
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
height = np.zeros((h, w), np.float32)
def smooth(gw, gh, amp):
    g = rng.normal(0, 1, (gh, gw)).astype(np.float32)
    g = (g - g.min()) / (g.max() - g.min()) * 255
    im = Image.fromarray(g.astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return (np.asarray(im, np.float32) / 255 - .5) * 2 * amp
X0, Y0 = xx.copy(), yy.copy()
xx = X0 + smooth(7, 12, 22) + smooth(30, 52, 5)
yy = Y0 + smooth(7, 12, 22) + smooth(30, 52, 5)
for n, amp in ((16, 1.0), (55, 0.45), (180, 0.16)):
    pts = rng.random((n, 2)).astype(np.float32) * [w * 1.1, h * 1.1] - [w * .05, h * .05]
    f1 = np.full((h, w), 1e12, np.float32); f2 = np.full((h, w), 1e12, np.float32)
    for px, py in pts:
        d = (xx - px) ** 2 + (yy - py) ** 2
        m = d < f1
        f2 = np.where(m, f1, np.minimum(f2, d)); f1 = np.where(m, d, f1)
    e = np.sqrt(f2) - np.sqrt(f1)            # 0 on creases
    cell = np.sqrt(w * h / n)
    height += amp * cell * np.tanh(e / (cell * 0.35)) * rng.choice([-1, 1]) # ridge or valley per octave
def box(a, r, axis):
    c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(2)], mode="edge"), axis=axis)
    n = a.shape[axis]
    return (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(0, n), axis=axis)) / (2 * r + 1)
for _ in range(3):
    height = box(box(height, 2, 0), 2, 1)
gy, gx = np.gradient(height)
nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
L = np.array([-0.5, -0.65, 0.57]); L /= np.linalg.norm(L)
shade = (-gx * L[0] - gy * L[1] + L[2]) * nz
shade = (shade - np.median(shade)) / (shade.std() + 1e-6)
shade = np.tanh(shade * 0.8)
base = 239 + shade * float(sys.argv[3] if len(sys.argv) > 3 else 9)
img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
a = np.asarray(img, np.float32) + rng.normal(0, 1.4, (H, W))
# soft vignette like a photographed sheet
vy, vx = np.mgrid[0:H, 0:W]; v = ((vx / W - .5) ** 2 + (vy / H - .5) ** 2)
a -= v * 18
rgb = np.stack([a, a, a + 2], -1)
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(sys.argv[1], quality=90)
