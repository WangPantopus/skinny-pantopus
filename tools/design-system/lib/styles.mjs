// components/bundle.css: the Tailwind utilities the bundled components and
// previews use, compiled by the web app's Tailwind CLI with the adapted
// config in lib/tailwind.config.cjs.

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TOOL, webRequire, write } from './repo.mjs';

const CONFIG = join(TOOL, 'lib/tailwind.config.cjs');
const INPUT = join(TOOL, 'src/bundle.input.css');

export function buildStyles({ content, buildDir, outFile }) {
  const list = join(buildDir, 'tailwind-content.json');
  write(list, JSON.stringify(content, null, 2));
  mkdirSync(dirname(outFile), { recursive: true });
  try {
    execFileSync(process.execPath, [webRequire.resolve('tailwindcss/lib/cli.js'), '--config', CONFIG, '--input', INPUT, '--output', outFile], {
      env: { ...process.env, DESIGN_SYSTEM_TAILWIND_CONTENT: list },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(`Tailwind failed:\n${error.stderr?.toString() ?? error.message}`);
  }
}
