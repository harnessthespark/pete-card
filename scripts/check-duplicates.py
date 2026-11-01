"""Fails if two photos in frontend/public/advent look like the same picture (resized or re-saved copies included).
Run:  python3 scripts/check-duplicates.py     (needs Pillow)"""
import glob, itertools, sys
from PIL import Image
def hashes(path):
    im = Image.open(path).convert('L').resize((24, 24)); return list(im.getdata())
files = sorted(glob.glob('frontend/public/advent/*.jpg'))
h = {f: hashes(f) for f in files}
bad = [(round(sum(abs(x - y) for x, y in zip(h[a], h[b])) / 576, 1), a, b) for a, b in itertools.combinations(files, 2)]
bad = [b for b in bad if b[0] < 8]
for d, a, b in sorted(bad): print(f'DUPLICATE (difference {d}): {a}  =  {b}')
print(f'{len(files)} photos checked,', 'no duplicates' if not bad else f'{len(bad)} duplicate pair(s)')
sys.exit(1 if bad else 0)
