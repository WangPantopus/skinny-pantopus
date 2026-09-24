// --check: render every preview headless in every theme, the way the
// design-system page frames it (tokens.css, bundle.css, React 18, the bundle,
// then data-theme on <html>), and type-check index.d.ts strictly.
//
// Chromium comes from the web app's @playwright/test through the local Chrome
// channel, so no browser download is needed.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARIES } from '../config.mjs';
import { WEB, read, webRequire, write } from './repo.mjs';

const WIDTH = 720;
const COVER_WIDTH = 960;
const PER_SHEET = 8;

async function launch() {
  const { chromium } = webRequire('@playwright/test');
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      throw new Error(`No browser for --check: install Google Chrome, or run \`npx playwright install chromium\` in frontend/apps/web.\n${error.message}`);
    }
  }
}

export async function renderCheck({ projectDir, tokensCss, rendersDir, themes }) {
  const head = [
    `<style>${tokensCss}</style>`,
    `<style>${read(join(projectDir, 'components/bundle.css'))}</style>`,
    ...LIBRARIES.map((lib) => `<script>${read(join(projectDir, lib.file))}</script>`),
    `<script>${read(join(projectDir, 'components/bundle.js'))}</script>`,
  ].join('');

  const names = readdirSync(join(projectDir, 'components'))
    .filter((d) => existsSync(join(projectDir, 'components', d, 'preview.html')))
    .sort((a, b) => (a === 'Cover' ? -1 : b === 'Cover' ? 1 : a.localeCompare(b)));

  const browser = await launch();
  const results = [];
  try {
    for (const name of names) {
      const source = read(join(projectDir, 'components', name, 'preview.html'));
      const height = Number(/@dsCard[^>]*height=(\d+)/.exec(source)?.[1] ?? 120);
      for (const theme of themes) {
        const page = await browser.newPage({ viewport: { width: name === 'Cover' ? COVER_WIDTH : WIDTH, height: Math.max(height, 56) } });
        const errors = [];
        page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.setContent(
          source
            .replace(/^<!--[^\n]*-->\n/, '')
            .replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`)
            .replace('<head>', `<head>${head}`),
          { waitUntil: 'load' },
        );
        await page.waitForTimeout(400);
        const state = await page.evaluate(() => ({
          children: (document.getElementById('root') ?? document.body).childElementCount,
          scrollHeight: document.documentElement.scrollHeight,
        }));
        const file = join(rendersDir, `${name}.${theme}.png`);
        write(file, await page.screenshot({ fullPage: true }));
        results.push({ name, theme, height, ...state, errors, file });
        await page.close();
      }
    }

    // Contact sheets: a few cards per image so they stay readable.
    for (const theme of themes) {
      const shots = results.filter((r) => r.theme === theme);
      for (let i = 0; i * PER_SHEET < shots.length; i++) {
        const figures = shots
          .slice(i * PER_SHEET, (i + 1) * PER_SHEET)
          .map((r) => `<figure style="margin:0;background:#bbb"><figcaption style="font:12px system-ui;padding:2px 4px">${r.name} · ${theme}</figcaption><img style="display:block;width:${WIDTH}px" src="data:image/png;base64,${readFileSync(r.file).toString('base64')}"></figure>`)
          .join('');
        const page = await browser.newPage({ viewport: { width: WIDTH * 2 + 24, height: 600 } });
        await page.setContent(`<body style="margin:0;background:#777"><div style="display:grid;grid-template-columns:${WIDTH}px ${WIDTH}px;gap:8px;padding:8px;align-items:start">${figures}</div></body>`);
        write(join(rendersDir, `_sheet.${theme}.${String(i + 1).padStart(2, '0')}.png`), await page.screenshot({ fullPage: true }));
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const problems = [];
  for (const r of results) {
    if (r.name !== 'Cover' && r.children === 0) problems.push(`${r.name} [${r.theme}] rendered nothing`);
    if (r.errors.length) problems.push(`${r.name} [${r.theme}] ${r.errors.slice(0, 2).join(' | ')}`);
    if (r.scrollHeight > r.height) problems.push(`${r.name} [${r.theme}] content is ${r.scrollHeight}px, card height is ${r.height}px (raise it in content/previews.mjs)`);
  }
  write(join(rendersDir, '_report.json'), JSON.stringify(results.map(({ file, ...r }) => r), null, 2));
  return { rendered: results.length, problems };
}

export function typeCheck({ dtsFile, buildDir }) {
  const nodeModules = join(WEB, 'node_modules');
  const tsconfig = join(buildDir, 'tsconfig.types.json');
  write(
    tsconfig,
    JSON.stringify(
      {
        compilerOptions: {
          noEmit: true,
          strict: true,
          skipLibCheck: false,
          jsx: 'react-jsx',
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'es2022',
          lib: ['dom', 'es2022'],
          types: [],
          baseUrl: WEB,
          typeRoots: [join(nodeModules, '@types')],
          paths: { react: [join(nodeModules, '@types/react')], 'lucide-react': [join(nodeModules, 'lucide-react')] },
        },
        files: [dtsFile],
      },
      null,
      2,
    ),
  );
  try {
    execFileSync(process.execPath, [webRequire.resolve('typescript/lib/tsc.js'), '-p', tsconfig], { stdio: ['ignore', 'pipe', 'pipe'] });
    return [];
  } catch (error) {
    return [`index.d.ts does not type-check:\n${error.stdout?.toString() ?? error.message}`];
  }
}
