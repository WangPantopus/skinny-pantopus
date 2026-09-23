#!/bin/bash
# cpev.sh <bundle-dir> <subdir> <capture-name>...  : copy iOS (shots/<name>.json → .txt, <name>-small.png) or Android (andshots/<name>.txt, <name>-small.png) captures into a bundle.
R=/private/tmp/pantopus-shared-ux-runtime
B="$1"; SUB="$2"; shift 2
mkdir -p "$B/$SUB"
for n in "$@"; do
  if [ -f "$R/shots/$n.json" ]; then python3 "$R/tree2txt.py" "$R/shots/$n.json" > "$B/$SUB/$n.txt"; fi
  if [ -f "$R/andshots/$n.txt" ]; then cp "$R/andshots/$n.txt" "$B/$SUB/$n.txt"; fi
  if [ -f "$R/shots/$n-small.png" ]; then cp "$R/shots/$n-small.png" "$B/$SUB/$n.png"; elif [ -f "$R/andshots/$n-small.png" ]; then cp "$R/andshots/$n-small.png" "$B/$SUB/$n.png"; fi
done
ls "$B/$SUB" | wc -l | sed "s#^#$SUB: #"
