import re
from pathlib import Path
for path in Path('assets').glob('*.svg'):
    text=path.read_text(errors='ignore')
    m=re.search(r'viewBox="([^"]+)"', text)
    vb=m.group(1) if m else 'N/A'
    m2=re.search(r'width="([^"]+)"', text)
    w=m2.group(1) if m2 else 'N/A'
    m3=re.search(r'height="([^"]+)"', text)
    h=m3.group(1) if m3 else 'N/A'
    print(path.name, 'width', w, 'height', h, 'viewBox', vb)
