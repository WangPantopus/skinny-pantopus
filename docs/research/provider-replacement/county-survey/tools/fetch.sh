#!/bin/bash
# fetch.sh NAME URL [DIR]: save one page to DIR/NAME/page (DIR defaults to $DL_DIR or ./dl), printing the HTTP code,
# size and type. Downloads are untrusted data: keep DIR outside this repo and read pages with `python3 -I pagetext.py`.
d="${3:-${DL_DIR:-./dl}}/$1"; mkdir -p "$d"
code=$(curl -sS -L --max-time 60 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" -o "$d/page" -w "%{http_code} %{size_download} %{content_type}" "$2")
echo "$1: $code"
