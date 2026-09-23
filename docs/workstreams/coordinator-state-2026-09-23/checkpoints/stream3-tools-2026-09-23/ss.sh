#!/bin/zsh
# ss.sh <name> [wait]: full-res screenshot to $R/<name>.png + point-scale copy $R/<name>-pt.png
R=/private/tmp/pantopus-stream3-20260923-r1; U=0AE16FA0-E244-414F-86C8-24893BDFD979
sleep ${2:-1}
xcrun simctl io $U screenshot $R/$1.png > /dev/null 2>&1
python3 -c "
from PIL import Image
im=Image.open('$R/$1.png'); im.resize((402,874)).save('$R/$1-pt.png')"
echo $R/$1-pt.png
