import sys, glob
from PIL import Image
prefix, names = sys.argv[1], sys.argv[2].split(',')
scale = float(sys.argv[3]) if len(sys.argv) > 3 else .5
ims = [Image.open(f'../shots/{prefix}-{n}.jpg') for n in names]
w, h = ims[0].size
tw, th = int(w * scale), int(h * scale)
sheet = Image.new('RGB', ((tw + 10) * len(ims) - 10, th), (0, 0, 0))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (i * (tw + 10), 0))
sheet.save(f'../shots/sheet-{prefix}.jpg', quality=88)
print(sheet.size)
