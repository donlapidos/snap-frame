from pathlib import Path
from PIL import Image
for name in Path('assets').glob('*.png'):
    with Image.open(name) as im:
        print(name.name, im.size)
