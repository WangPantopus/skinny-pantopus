// Render Claude Design bundle exports (docs/design/exports/<board>/html/*.html) to one PNG per artboard.
// No dependencies: drives headless Chrome over the DevTools protocol. Usage: node render.mjs <pagesDir> <pages.json> <outRoot> [board...]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const [,, PAGES, INDEX, OUT, ...ONLY] = process.argv
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const prof = join(OUT, '.chrome-profile'); mkdirSync(prof, { recursive: true })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
let ver
for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { await sleep(200) } }
const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tgt.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const waiters = []
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else if (m.method) waiters.forEach(w => w(m)) })
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
const idx = JSON.parse(readFileSync(INDEX, 'utf8'))
const slug = (s) => s.replace(/^0\d[a-d]\s*·\s*/, '').replace(/\s*·\s*/g, '__').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
const report = []
for (const [board, rows] of Object.entries(idx)) {
  if (ONLY.length && !ONLY.includes(board)) continue
  const dir = join(OUT, board, 'png'); mkdirSync(dir, { recursive: true })
  for (const [i, key, title, labels] of rows) {
    const name = `${String(i).padStart(2, '0')}-${slug(labels[0] || title)}.png`
    const file = join(dir, name)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    const loaded = new Promise(r => { const w = (m) => { if (m.method === 'Page.loadEventFired') { waiters.splice(waiters.indexOf(w), 1); r() } }; waiters.push(w) })
    await send('Page.navigate', { url: 'file://' + join(PAGES, board, key + '.html') })
    await Promise.race([loaded, sleep(20000)])
    let ok = false
    for (let t = 0; t < 60; t++) { ok = await evalJs(`!document.getElementById('__bundler_loading') && !document.getElementById('__bundler_placeholder') && document.body.innerText.length > 20`); if (ok) break; await sleep(250) }
    await evalJs('document.fonts ? document.fonts.ready.then(()=>true) : true'); await sleep(600)
    const dims = await evalJs(`(()=>{const d=document.documentElement,b=document.body;return {w:Math.max(d.scrollWidth,b.scrollWidth),h:Math.max(d.scrollHeight,b.scrollHeight)}})()`)
    const w = Math.min(Math.max(1440, dims.w), 6000), h = Math.min(Math.max(400, dims.h), 16000)
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(h, 4000), deviceScaleFactor: 1, mobile: false }); await sleep(300)
    const dims2 = await evalJs(`(()=>{const d=document.documentElement,b=document.body;return {w:Math.max(d.scrollWidth,b.scrollWidth),h:Math.max(d.scrollHeight,b.scrollHeight)}})()`)
    const W = Math.min(Math.max(w, dims2.w), 6000), H = Math.min(Math.max(400, dims2.h), 16000)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
    report.push({ board, i, title, label: labels[0] || null, file, w: W, h: H, rendered: ok })
    process.stdout.write(`${board} ${i} ${ok ? 'ok' : 'TIMEOUT'} ${W}x${H} ${name}\n`)
  }
}
writeFileSync(join(OUT, 'render-report.json'), JSON.stringify(report, null, 1))
ws.close(); chrome.kill()
