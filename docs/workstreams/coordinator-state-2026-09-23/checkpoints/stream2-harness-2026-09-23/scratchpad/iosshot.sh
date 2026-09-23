#!/bin/zsh
# iosshot.sh <name> : simctl screenshot of the Stream 2 simulator, saved full-size in work/native and a 1/3 preview in scratchpad.
N=$1; F=/private/tmp/pantopus-stream2-r06-runtime/work/native/$N.png
xcrun simctl io 6F914A30-8585-4B05-9E05-94441675F10A screenshot $F >/dev/null 2>&1
python3 -c "
from PIL import Image
im=Image.open('$F'); w,h=im.size
im.resize((w//3,h//3)).save('/private/tmp/claude-501/-Users-yingpengwang-estimate-rescue-skinny-pantopus-pantopus-stream-2-home-3ef380/92cc4526-97b8-4557-9ce8-edb8d94d4d5a/scratchpad/stream2/$N-small.png')"
echo /private/tmp/claude-501/-Users-yingpengwang-estimate-rescue-skinny-pantopus-pantopus-stream-2-home-3ef380/92cc4526-97b8-4557-9ce8-edb8d94d4d5a/scratchpad/stream2/$N-small.png
