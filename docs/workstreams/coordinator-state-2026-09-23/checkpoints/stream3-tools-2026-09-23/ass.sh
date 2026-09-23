#!/bin/zsh
# ass.sh <name> [wait]: emulator-5554 screenshot to $R/<name>.png plus a 1/3-scale copy $R/<name>-s.png
R=/private/tmp/pantopus-stream3-20260923-r1
sleep ${2:-1}
$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554 exec-out screencap -p > $R/$1.png
python3 -c "
from PIL import Image
im=Image.open('$R/$1.png'); w,h=im.size; im.resize((w//3,h//3)).save('$R/$1-s.png'); print(w,h)"
echo $R/$1-s.png
