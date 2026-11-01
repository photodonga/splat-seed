# Shrinks oversized game PNGs so the phone page loads faster.
# The app never shows these larger than ~40 CSS px; 160 px covers a 3x iPhone screen.
# Run after tools/vendor-game-art.mjs (which re-downloads full-size originals).
# Usage: python3 tools/shrink-game-art.py   (needs Pillow)
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'game'
MAX_SIDE = 160
TARGETS = [*sorted((ROOT / 'capsules').glob('*.png')),
           ROOT / 'images/food/IconShopFood.png',
           ROOT / 'images/food/IconShopFoodL.png',
           ROOT / 'images/food/IconShopParty_00.png']

for path in TARGETS:
    with Image.open(path) as im:
        im.load()
        if max(im.size) <= MAX_SIDE:
            print('skip', path.relative_to(ROOT), im.size)
            continue
        before = path.stat().st_size
        im = im.convert('RGBA')
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(path, 'PNG', optimize=True)
        print('shrunk', path.relative_to(ROOT), im.size, f'{before//1024}KB -> {path.stat().st_size//1024}KB')
