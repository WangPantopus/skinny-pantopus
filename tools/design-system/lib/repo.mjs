// Repo paths, the web app's installed toolchain, and small file helpers
// shared by every build step. Nothing here installs anything: TypeScript,
// Tailwind, lucide-react and Playwright all come from frontend/apps/web.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = resolve(TOOL, '..', '..');
export const WEB = join(REPO, 'frontend/apps/web');
export const WEB_SRC = join(WEB, 'src');
export const PACKAGES = join(REPO, 'frontend/packages');
export const IOS_DESIGN = join(REPO, 'frontend/apps/ios/Pantopus/Core/Design');
export const IOS_COLORSETS = join(REPO, 'frontend/apps/ios/Pantopus/Resources/Assets.xcassets/Colors');
export const ANDROID_THEME = join(REPO, 'frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme');

/** `require` rooted at the web app, so the build borrows its toolchain. */
export const webRequire = createRequire(join(WEB, 'package.json'));

/** Directory of an installed package the web app depends on. */
export function packageDir(name) {
  return dirname(webRequire.resolve(`${name}/package.json`));
}

export const read = (file) => readFileSync(file, 'utf8');

export function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export const repoPath = (file) => relative(REPO, file);

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function git(...args) {
  try {
    return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** Where this build comes from: branch, short commit, author, repo slug, date. */
export function sourceInfo(now = new Date()) {
  const remote = git('remote', 'get-url', 'origin');
  const slug = /[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(remote)?.[1] ?? '';
  const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  return {
    branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    commit: git('rev-parse', '--short=9', 'HEAD') || 'unknown',
    dirty,
    author: git('config', 'user.name') || 'Claude',
    repo: slug,
    date: now.toISOString().slice(0, 10),
    // "Sept 16, 2026" reads as prose in the brand book.
    dateLabel: `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}
