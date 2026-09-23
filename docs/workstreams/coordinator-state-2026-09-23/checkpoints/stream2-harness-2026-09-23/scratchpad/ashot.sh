#!/bin/zsh
# ashot.sh <name> : adb screenshot of emulator-5556 (60 s cap), full-size in work/android, 1/3 preview in scratchpad.
N=$1; F=/private/tmp/pantopus-stream2-r06-runtime/work/android/$N.png
perl -e 'alarm 60; exec @ARGV' /Users/yingpengwang/Library/Android/sdk/platform-tools/adb -s emulator-5556 exec-out screencap -p > $F
python3 -c "
from PIL import Image
im=Image.open('$F'); w,h=im.size
im.resize((w//3,h//3)).save('/private/tmp/claude-501/-Users-yingpengwang-estimate-rescue-skinny-pantopus-pantopus-stream-2-home-3ef380/92cc4526-97b8-4557-9ce8-edb8d94d4d5a/scratchpad/stream2/$N-small.png')"
