// Render the pages verify_export.py decoded, one PNG per artboard, clipped to the artboard's own frame size
// and named by its manifest name. Usage: node render-frames.mjs <pages.json> <outDir> [scale=1]
// Same headless-Chrome-over-CDP approach as render.mjs; bundle pages unpack themselves, so wait for that.
// Each frame also gets a layout audit (in render-report.json, and printed when it finds something):
//   brokenDates  a date such as "Fri 28 Aug" split across two lines
//   cutOff       text hidden by a clipping container too small for its content (the device frame itself is skipped)
//   escaping     text running outside its own button or link
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
const [,, INDEX, OUT, SCALE = '1'] = process.argv
const scale = Number(SCALE)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9335
const AUDIT = `(() => {
  const out = { brokenDates: [], cutOff: [], escaping: [] }
  const DATE = /\\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\b/g
  const shown = (el) => { const s = getComputedStyle(el), b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 2 && b.height > 2 }
  const texts = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), a = []; for (let n; (n = w.nextNode());) if (n.nodeValue.trim()) a.push(n); return a }
  const rects = (n) => { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].filter(x => x.width > 0) }
  for (const n of texts(document.body)) {
    if (!n.parentElement || !shown(n.parentElement)) continue
    DATE.lastIndex = 0
    for (let m; (m = DATE.exec(n.nodeValue));) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length)
      if (new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size > 1) out.brokenDates.push(m[0])
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if (!/hidden|clip/.test(s.overflowX + s.overflowY) || !shown(el)) continue
    const b = el.getBoundingClientRect()
    if (b.width >= innerWidth * 0.95 && b.height >= innerHeight * 0.95) continue
    if (el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2) continue
    const cut = texts(el).find(n => rects(n).some(x => x.bottom > b.bottom + 1 || x.right > b.right + 1 || x.top < b.top - 1 || x.left < b.left - 1))
    if (cut) out.cutOff.push(cut.nodeValue.trim().slice(0, 50))
  }
  for (const el of document.querySelectorAll('button, a, [role=button]')) {
    if (!shown(el)) continue
    const b = el.getBoundingClientRect(), r = document.createRange(); r.selectNodeContents(el)
    const t = r.getBoundingClientRect()
    if (t.width && (t.right > b.right + 1 || t.left < b.left - 1)) out.escaping.push((el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40))
  }
  return out
})()`
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const prof = join(OUT, '.chrome-profile'); mkdirSync(prof, { recursive: true })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${prof}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { await sleep(200) } }
const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tgt.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const waiters = []
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else if (m.method) waiters.forEach(w => w(m)) })
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
const pagesDir = dirname(resolve(INDEX))
const items = JSON.parse(readFileSync(INDEX, 'utf8'))
const slug = (s) => s.replace(/\s*·\s*/g, '__').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
mkdirSync(OUT, { recursive: true })
const report = []
for (const it of items) {
  const png = `${String(it.i).padStart(2, '0')}-${slug(it.name)}.png`
  await send('Emulation.setDeviceMetricsOverride', { width: it.w || 1440, height: it.h || 900, deviceScaleFactor: scale, mobile: false })
  const loaded = new Promise(r => { const w = (m) => { if (m.method === 'Page.loadEventFired') { waiters.splice(waiters.indexOf(w), 1); r() } }; waiters.push(w) })
  await send('Page.navigate', { url: 'file://' + encodeURI(join(pagesDir, it.file)) })
  await Promise.race([loaded, sleep(20000)])
  let ok = false
  for (let t = 0; t < 80 && !ok; t++) { ok = await evalJs(`!document.getElementById('__bundler_loading') && !document.getElementById('__bundler_placeholder') && document.body.innerText.length > 20`); if (!ok) await sleep(250) }
  await evalJs('document.fonts ? document.fonts.ready.then(()=>true) : true'); await sleep(400)
  const audit = await evalJs(AUDIT)
  let W = it.w, H = it.h
  if (!W || !H) { const d = await evalJs(`(()=>{const d=document.documentElement,b=document.body;return {w:Math.max(d.scrollWidth,b.scrollWidth),h:Math.max(d.scrollHeight,b.scrollHeight)}})()`); W = Math.min(d.w, 6000); H = Math.min(d.h, 16000) }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
  if (shot.result?.data) writeFileSync(join(OUT, png), Buffer.from(shot.result.data, 'base64'))
  report.push({ i: it.i, name: it.name, title: it.title, png, w: W, h: H, scale, rendered: ok, audit })
  const found = Object.entries(audit || {}).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(' | ')}`)
  process.stdout.write(`${it.i} ${ok ? 'ok' : 'TIMEOUT'} ${W}x${H}@${scale} ${png}${found.length ? '\n     ' + found.join('\n     ') : ''}\n`)
}
writeFileSync(join(OUT, 'render-report.json'), JSON.stringify(report, null, 1))
ws.close(); chrome.kill()
