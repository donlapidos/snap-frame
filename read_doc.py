import zipfile, xml.etree.ElementTree as ET
path='Product Description.docx'
with zipfile.ZipFile(path) as z:
    data=z.read('word/document.xml')
ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
root=ET.fromstring(data)
texts=[t.text for t in root.iter('{%s}t'%ns) if t.text]
print('\n'.join(texts))
