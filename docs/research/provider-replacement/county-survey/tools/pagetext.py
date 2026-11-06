# Print visible text and links (optionally filtered) from a saved HTML file. Usage: pagetext.py FILE [link-regex] [maxchars]
import sys, re, html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.t = []; self.links = []; self.skip = 0; self.href = None
    def handle_starttag(self, tag, a):
        if tag in ("script", "style", "noscript"): self.skip += 1
        if tag == "a":
            self.href = dict(a).get("href")
        if tag in ("p", "br", "li", "tr", "h1", "h2", "h3", "h4", "div"): self.t.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.skip: self.skip -= 1
        if tag == "a": self.href = None
    def handle_data(self, d):
        if self.skip: return
        self.t.append(d)
        if self.href and d.strip(): self.links.append((d.strip()[:80], self.href))
raw = open(sys.argv[1], "rb").read().decode("utf-8", "replace")
p = P(); p.feed(raw)
txt = re.sub(r"[ \t\r\f\v]+", " ", "".join(p.t)); txt = re.sub(r"\n\s*\n+", "\n", txt)
mx = int(sys.argv[3]) if len(sys.argv) > 3 else 4000
print(txt[:mx])
if len(sys.argv) > 2 and sys.argv[2]:
    rx = re.compile(sys.argv[2], re.I)
    print("--- links matching", sys.argv[2])
    for t, h in p.links:
        if rx.search(t) or rx.search(h or ""): print("  %s -> %s" % (t, h))
