"""Render the code-owned geometric Arena monogram at native launcher sizes.
Run with Python + Pillow when changing assets/branding/icon.svg geometry.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
image = Image.new('RGB', (1024, 1024), '#0c1219')
draw = ImageDraw.Draw(image)
draw.ellipse((126, 126, 898, 898), outline='#263729', width=12)
draw.polygon([(250,752),(445,272),(579,272),(774,752),(630,752),(588,640),(436,640),(394,752)], fill='#c7f464')
draw.polygon([(474,532),(512,422),(550,532)], fill='#0c1219')
draw.line([(386,810),(638,810)], fill='#c7f464', width=12)
for density, size in {'mdpi':48, 'hdpi':72, 'xhdpi':96, 'xxhdpi':144, 'xxxhdpi':192}.items():
    image.resize((size,size), Image.Resampling.LANCZOS).save(root / f'android/app/src/main/res/mipmap-{density}/ic_launcher.png')
icons = root / 'ios/Runner/Assets.xcassets/AppIcon.appiconset'
for item in json.loads((icons / 'Contents.json').read_text())['images']:
    if 'filename' in item:
        size = round(float(item['size'].split('x')[0]) * float(item['scale'].rstrip('x')))
        image.resize((size,size), Image.Resampling.LANCZOS).save(icons / item['filename'])
print('Android/iOS Arena monogram icons generated.')
