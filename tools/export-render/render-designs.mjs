// Render a flat list of standalone design HTML files to PNG. Usage: node render-designs.mjs <index.json> <outDir>
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
const [,, INDEX, OUT] = process.argv
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9334
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
const items = JSON.parse(readFileSync(INDEX, 'utf8'))
const report = []
for (const it of items) {
  const file = join(OUT, it.png); mkdirSync(dirname(file), { recursive: true })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  const loaded = new Promise(r => { const w = (m) => { if (m.method === 'Page.loadEventFired') { waiters.splice(waiters.indexOf(w), 1); r() } }; waiters.push(w) })
  await send('Page.navigate', { url: 'file://' + encodeURI(it.src) })
  await Promise.race([loaded, sleep(15000)])
  await evalJs('window.lucide && window.lucide.createIcons && window.lucide.createIcons(), true').catch(() => {})
  await sleep(500)
  const d = await evalJs(`(()=>{const d=document.documentElement,b=document.body;return {w:Math.max(d.scrollWidth,b.scrollWidth),h:Math.max(d.scrollHeight,b.scrollHeight)}})()`) || { w: 1440, h: 900 }
  const W = Math.min(Math.max(1440, d.w), 4000), H = Math.min(Math.max(400, d.h), 16000)
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: Math.min(H, 4000), deviceScaleFactor: 1, mobile: false }); await sleep(200)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
  if (shot.result?.data) { writeFileSync(file, Buffer.from(shot.result.data, 'base64')); report.push({ ...it, w: W, h: H }) }
  process.stdout.write(`${report.length}/${items.length} ${it.png}\n`)
}
writeFileSync(join(OUT, 'render-report.json'), JSON.stringify(report, null, 1))
ws.close(); chrome.kill()
