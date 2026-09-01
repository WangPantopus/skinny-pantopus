import { marked } from 'marked';
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];

// Slug ids for headings + collect TOC (h2 only)
const toc = [];
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const renderer = new marked.Renderer();
renderer.heading = function (text, depth) {
  const id = slug(text);
  if (depth === 2) toc.push({ id, text: text.replace(/\s*\(.*$/, '').replace(/ — .*$/, '') });
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};
renderer.table = function (header, body) {
  return `<div class="scroll"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
};
renderer.code = function (text, lang) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cls = lang ? ` class="lang-${lang}"` : ' class="diagram"';
  return `<div class="scroll"><pre${cls}><code>${esc}</code></pre></div>\n`;
};
marked.use({ renderer, gfm: true, breaks: false });

let body = marked.parse(src);
// Strip the first H1 (we render our own masthead)
body = body.replace(/^<h1[^>]*>.*?<\/h1>\n/, '');
body = body.replace(/<p><strong>Date:<\/strong>[\s\S]*?<\/p>\n/, '');

const tocHtml = `<nav class="toc" aria-label="Contents"><div class="toc-label">Contents</div><ol>${toc.map(t => `<li><a href="#${t.id}">${t.text}</a></li>`).join('')}</ol></nav>`;

const css = `
:root{
  --bg:#F5F7F5; --surface:#FFFFFF; --surface-2:#EDF1EF; --line:#D5DDDA; --line-strong:#B9C5C0;
  --ink:#172129; --ink-2:#3E4C55; --muted:#66757D;
  --accent:#0E7C86; --accent-ink:#0B5F67; --accent-soft:#DDEFF0;
  --brass:#9A6B12; --brass-soft:#F5EAD1;
  --code-bg:#EEF2F0; --code-ink:#1F2A30; --diagram-bg:#F0F4F2;
  --th-bg:#E7EEEC;
  --shadow: 0 1px 0 rgba(23,33,41,.04), 0 8px 24px -16px rgba(23,33,41,.25);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#0F1518; --surface:#141C20; --surface-2:#1A2428; --line:#26333A; --line-strong:#34454D;
    --ink:#E4EBE9; --ink-2:#B9C6C2; --muted:#87969D;
    --accent:#45BFC8; --accent-ink:#7ED4DA; --accent-soft:#12343A;
    --brass:#D9A441; --brass-soft:#2E2510;
    --code-bg:#121A1E; --code-ink:#D8E1DE; --diagram-bg:#101719;
    --th-bg:#1C272C;
    --shadow: 0 1px 0 rgba(0,0,0,.3), 0 8px 24px -16px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"]{
  --bg:#0F1518; --surface:#141C20; --surface-2:#1A2428; --line:#26333A; --line-strong:#34454D;
  --ink:#E4EBE9; --ink-2:#B9C6C2; --muted:#87969D;
  --accent:#45BFC8; --accent-ink:#7ED4DA; --accent-soft:#12343A;
  --brass:#D9A441; --brass-soft:#2E2510;
  --code-bg:#121A1E; --code-ink:#D8E1DE; --diagram-bg:#101719;
  --th-bg:#1C272C;
  --shadow: 0 1px 0 rgba(0,0,0,.3), 0 8px 24px -16px rgba(0,0,0,.6);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Avenir Next","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
  font-size:16px;line-height:1.6;}
.page{max-width:60rem;margin:0 auto;padding:2.5rem 1.25rem 6rem}
.masthead{border-bottom:1px solid var(--line);padding-bottom:1.5rem;margin-bottom:2rem}
.eyebrow{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-ink);font-weight:600}
h1.title{font-family:Charter,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:600;
  font-size:clamp(1.9rem,4vw,2.75rem);line-height:1.15;margin:.35rem 0 .75rem;text-wrap:balance;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;color:var(--muted);font-size:.9rem}
.meta b{color:var(--ink-2);font-weight:600}
.pill{display:inline-block;padding:.1rem .55rem;border-radius:999px;background:var(--brass-soft);color:var(--brass);font-size:.75rem;font-weight:600;letter-spacing:.04em;vertical-align:middle}
.toc{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem 1.25rem;margin:0 0 2.5rem;box-shadow:var(--shadow)}
.toc-label{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:.35rem}
.toc ol{margin:0;padding-left:0;list-style:none;columns:2;column-gap:2rem}
@media (max-width:640px){.toc ol{columns:1}}
.toc li{break-inside:avoid;margin:.15rem 0;font-size:.92rem}
.toc a{color:var(--ink-2);text-decoration:none}
.toc a:hover,.toc a:focus-visible{color:var(--accent-ink);text-decoration:underline}
h2{font-family:Charter,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:600;font-size:1.6rem;line-height:1.25;
  margin:3rem 0 1rem;padding-top:1.25rem;border-top:1px solid var(--line);text-wrap:balance;letter-spacing:-.005em}
h3{font-size:1.1rem;font-weight:700;margin:2rem 0 .6rem;color:var(--ink);text-wrap:balance}
h4{font-size:.95rem;font-weight:700;margin:1.5rem 0 .5rem}
p,li{max-width:70ch}
p{margin:.75rem 0}
ul,ol{padding-left:1.4rem}
li{margin:.3rem 0}
li>p{margin:.25rem 0}
strong{font-weight:650}
em{color:var(--ink-2)}
a{color:var(--accent-ink);text-underline-offset:.15em}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
hr{border:0;border-top:1px solid var(--line);margin:2.5rem 0}
code{font-family:"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-size:.86em;background:var(--code-bg);color:var(--code-ink);
  padding:.08em .35em;border-radius:4px}
.scroll{overflow-x:auto;max-width:100%;margin:1rem 0}
pre{margin:0;background:var(--code-bg);color:var(--code-ink);border:1px solid var(--line);border-radius:8px;padding:1rem 1.1rem;
  font-family:"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-size:.8rem;line-height:1.5;min-width:max-content}
pre code{background:none;padding:0;font-size:inherit;color:inherit}
pre.diagram{background:var(--diagram-bg);color:var(--ink);letter-spacing:0}
table{border-collapse:collapse;width:100%;min-width:40rem;font-size:.9rem;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}
th,td{padding:.6rem .8rem;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
th{background:var(--th-bg);font-weight:650;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--ink-2)}
tr:last-child td{border-bottom:0}
td code,th code{white-space:nowrap}
td{font-variant-numeric:tabular-nums}
blockquote{margin:1rem 0;padding:.6rem 1rem;border-left:3px solid var(--brass);background:var(--brass-soft);color:var(--ink);border-radius:0 6px 6px 0}
.tldr{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:8px;padding:.25rem 1.25rem .5rem;margin:1rem 0 1.5rem;box-shadow:var(--shadow)}
.tldr h2{border-top:0;margin-top:1rem;padding-top:0}
.foot{margin-top:4rem;padding-top:1.25rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
@media (prefers-reduced-motion:no-preference){a{transition:color .12s ease}}
`;

// Wrap the TL;DR section (from its h2 up to the first <hr>) in a callout card
body = body.replace(/(<h2 id="0-tl-dr[^"]*">[\s\S]*?)(<hr>)/, '<section class="tldr">$1</section>$2');

const html = `<title>Pantopus Persistent Login</title>
<style>${css}</style>
<div class="page">
  <header class="masthead">
    <div class="eyebrow">Design · Identity &amp; Sessions</div>
    <h1 class="title">Persistent Login &amp; Trusted Devices for Pantopus</h1>
    <div class="meta"><span><b>Date</b> 2026-08-18</span><span><b>Status</b> <span class="pill">Proposed · design only</span></span><span><b>Scope</b> native iOS · native Android · Express/Supabase backend · web where it must stay consistent</span></div>
  </header>
  ${tocHtml}
  <main>${body}</main>
  <footer class="foot">Source of truth: <code>docs/persistent-login/persistent-login-design-2026-08-18.md</code>. Evidence, alternatives and verification status: <code>docs/persistent-login/WORKFLOW-RESULTS.md</code>. Progress log: <code>docs/persistent-login/WORKLOG.md</code>.</footer>
</div>`;
fs.writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes; toc entries:', toc.length);
