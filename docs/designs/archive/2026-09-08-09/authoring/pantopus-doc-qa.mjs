import fs from 'node:fs';
import { chromium } from '/Users/yingpengwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base = 'file:///Users/yingpengwang/skinny-pantopus/docs/';
const mode = process.argv[2] || 'reader';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1360,height:980},colorScheme:'light'});
const errors=[];page.on('pageerror', e=>errors.push(e.message));
await page.route(/^https?:/, route=>route.abort());
const checks=[];
function assert(condition,label){checks.push({label,pass:!!condition});if(!condition)throw new Error(label);}
async function overflow(label){const result=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,dialog:[...document.querySelectorAll('dialog[open]')].map(x=>({w:x.clientWidth,scroll:x.scrollWidth}))}));assert(result.scroll<=result.w+1,label+' document fits');for(const x of result.dialog)assert(x.scroll<=x.w+1,label+' dialog fits');}

try {
 if(mode==='reader'){
   await page.goto(base+'pantopus-nationwide-product-design-2026-09-08.html');
   assert(await page.locator('h1').count()===1,'reader one title');
   assert(await page.locator('h2').count()>=17,'reader sections present');
   assert(!await page.locator('body').innerText().then(t=>t.includes('TECHNICAL_APPENDIX')||t.includes('JOURNEYS_APPENDIX')),'appendices integrated');
   const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));assert(missing.length===0,'reader local anchors resolve');
   await overflow('reader desktop');await page.screenshot({path:'/private/tmp/pantopus-reader-desktop.png'});
   await page.locator('#theme').click();assert(await page.locator('html').getAttribute('data-theme')==='dark','reader theme toggles');await page.screenshot({path:'/private/tmp/pantopus-reader-dark.png'});
   await page.setViewportSize({width:360,height:800});await overflow('reader mobile');await page.screenshot({path:'/private/tmp/pantopus-reader-mobile.png'});
   await page.locator('.mobile-contents summary').click();await page.locator('.mobile-contents a').filter({hasText:'7. Utility'}).click();assert(await page.evaluate(()=>location.hash)==='#7-utility-and-discovery-feature-specifications','reader mobile contents navigate');
   await page.emulateMedia({media:'print'});await overflow('reader print');
 } else {
   await page.goto(base+'designs/pantopus-nationwide-experience-2026-09-08.html');
   await overflow('concept desktop');await page.screenshot({path:'/private/tmp/pantopus-concept-desktop.png',fullPage:true});
   for(const destination of ['nearby','following','inbox','home']){await page.locator('[data-action="navigate"][data-value="'+destination+'"]').click();await overflow('destination '+destination);}
   await page.locator('[data-action="open-opportunity"]').first().click();assert(await page.locator('#detail-dialog').innerText().then(t=>t.includes('eligibility is unconfirmed')&&t.includes('availability is unknown')),'opportunity eligibility and availability separated');
   await page.locator('[data-action="save-opportunity"]').click();assert(await page.locator('[data-action="save-opportunity"]').innerText().then(t=>t.includes('Saved')),'opportunity saved');
   await page.locator('[data-action="official-options"]').click();assert(await page.locator('#detail-dialog').innerText().then(t=>t.toLowerCase().includes('simulated handoff')),'provider handoff explicitly simulated');await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="open-bill"]').first().click();assert(await page.locator('.amount').innerText()==='$180.00','bill actual total');await page.locator('[data-action="bill-mode"][data-value="previous-rate"]').click();assert(await page.locator('.amount').innerText()==='$164.40','bill prior-rate total');await page.screenshot({path:'/private/tmp/pantopus-concept-bill.png'});await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="open-event"]').first().click();assert(await page.locator('.time-box').first().innerText().then(t=>t.includes('6:00')),'event baseline stays 6');await page.locator('[data-action="keep-event"]').click();await page.locator('[data-action="open-event"]').first().click();assert(await page.locator('.time-box').first().innerText().then(t=>t.includes('6:00')),'decline preserves event');await page.locator('[data-action="accept-event"]').click();assert(await page.locator('.time-box').first().innerText().then(t=>t.includes('7:00')),'accept updates event');await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="open-intake"]').first().click();await page.locator('#intake-text').fill('Keep this private design-test note.');await page.locator('#intake-form button[type="submit"]').click();assert(await page.locator('#detail-dialog').innerText().then(t=>t.includes('Only you')),'private save review');await page.locator('[data-action="confirm-note"]').click();await page.locator('#detail-dialog [data-action="open-saved"]').click();assert(await page.locator('#detail-dialog').innerText().then(t=>t.includes('Keep this private design-test note.')),'saved note retrieved');await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="density"][data-value="rural"]').click();await page.locator('[data-action="open-saved"]').first().click();assert(await page.locator('#detail-dialog').innerText().then(t=>t.includes('Keep this private design-test note.')),'area change preserves private records');await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="navigate"][data-value="inbox"]').click();assert(!await page.locator('#notification-setting').isChecked(),'notifications initially off');assert(await page.locator('#product-content').innerText().then(t=>t.includes('Night-sky walk')),'change reachable with notifications off');
   await page.locator('[data-action="theme"][data-value="dark"]').click();await page.screenshot({path:'/private/tmp/pantopus-concept-dark.png',fullPage:true});
   await page.locator('[data-action="reset"]').click();await page.setViewportSize({width:390,height:844});await overflow('concept 390');await page.screenshot({path:'/private/tmp/pantopus-concept-mobile.png',fullPage:true});
   await page.setViewportSize({width:360,height:800});await overflow('concept 360');await page.locator('[data-action="open-bill"]').first().click();await overflow('bill mobile');await page.screenshot({path:'/private/tmp/pantopus-concept-bill-mobile.png'});await page.locator('[data-action="close"]').first().click();
   await page.locator('[data-action="open-event"]').first().click();await overflow('event mobile');await page.screenshot({path:'/private/tmp/pantopus-concept-event-mobile.png'});await page.locator('[data-action="close"]').first().click();
   await page.emulateMedia({reducedMotion:'reduce'});assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),'reduced-motion environment');
   assert(await page.locator('.screen').evaluate(el=>getComputedStyle(el).animationName==='none'),'screen animation disabled for reduced motion');
   await page.setViewportSize({width:320,height:700});await overflow('concept 320');await page.setViewportSize({width:360,height:800});
   await page.locator('[data-action="open-intake"]').first().focus();await page.keyboard.press('Enter');assert(await page.locator('#detail-dialog').evaluate(el=>el.contains(document.activeElement)),'keyboard enters dialog');
   await page.locator('#intake-text').fill('Keyboard review check');await page.locator('#intake-form button[type="submit"]').focus();await page.keyboard.press('Enter');assert(await page.locator('#detail-dialog').evaluate(el=>el.contains(document.activeElement)),'dialog review retains focus');
   await page.keyboard.press('Escape');assert(!await page.locator('#detail-dialog').evaluate(el=>el.open),'Escape closes dialog');assert(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')==='open-intake'),'dialog returns focus to invoker');
   await page.locator('[data-action="theme"][data-value="dark"]').click();await page.locator('[data-action="open-opportunity"]').first().click();await overflow('opportunity mobile dark');await page.screenshot({path:'/private/tmp/pantopus-concept-opportunity-dark-mobile.png'});
 }
 assert(errors.length===0,'no browser script errors');
} catch(e) {checks.push({label:'failure',pass:false,error:e.message});}
await browser.close();
const report={mode,checks,errors};fs.writeFileSync('/private/tmp/pantopus-'+mode+'-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(checks.some(x=>!x.pass)||errors.length)process.exit(1);
