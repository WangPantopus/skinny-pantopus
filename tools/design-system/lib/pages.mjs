// The authored half of the system: the brand book, component guidelines and
// previews, the cover, the Logos note, and the packed React runtime.
//
// Placeholders in content/*.md: {{source}} (branch and commit), {{date}},
// and {{hex:<token>}} (a color token's Light value).

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { LIBRARIES } from '../config.mjs';
import { CATALOGUE, PRELUDE } from '../content/previews.mjs';
import { TOOL, read, write } from './repo.mjs';

const CONTENT = join(TOOL, 'content');

export const catalogueNames = () => CATALOGUE.map((c) => c.name);

function previewHtml(c) {
  if (/<\/script/i.test(c.code)) throw new Error(`${c.name} preview contains </script`);
  return `<!-- @dsCard group="${c.group}" height=${c.height} -->
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${c.name} — preview</title></head>
<body>
<div id="root" class="p-4"></div>
<script>
${PRELUDE}
${c.code}
</script>
</body>
</html>
`;
}

export function writeContent({ projectDir, info, color }) {
  const warnings = [];
  const fill = (text) =>
    text.replace(/\{\{(\w+)(?::([\w-]+))?\}\}/g, (match, key, arg) => {
      if (key === 'source') return `branch \`${info.branch}\` at \`${info.commit}\`${info.dirty ? ' plus uncommitted changes' : ''}`;
      if (key === 'date') return info.dateLabel;
      if (key === 'hex') return color(arg, 'light');
      throw new Error(`Unknown placeholder ${match}`);
    });

  write(join(projectDir, 'README.md'), fill(read(join(CONTENT, 'README.md'))));
  write(join(projectDir, 'assets/Logos/README.md'), fill(read(join(CONTENT, 'logos.md'))));
  const cover = join(projectDir, 'components/Cover/preview.html');
  write(cover, read(join(CONTENT, 'cover.html')));

  const docsDir = join(CONTENT, 'components');
  const names = new Set();
  const previews = [];
  for (const c of CATALOGUE) {
    if (names.has(c.name)) throw new Error(`${c.name} appears twice in content/previews.mjs`);
    names.add(c.name);
    const doc = join(docsDir, `${c.name}.md`);
    if (!existsSync(doc)) throw new Error(`content/components/${c.name}.md is missing`);
    write(join(projectDir, 'components', c.name, 'README.md'), `# ${c.name}\n\n${read(doc)}`);
    const file = join(projectDir, 'components', c.name, 'preview.html');
    write(file, previewHtml(c));
    previews.push(file);
  }
  for (const f of readdirSync(docsDir)) {
    if (!names.has(basename(f, '.md'))) warnings.push(`content/components/${f} has no entry in content/previews.mjs`);
  }

  mkdirSync(join(projectDir, 'components/lib'), { recursive: true });
  for (const lib of LIBRARIES) copyFileSync(join(TOOL, 'vendor', basename(lib.file)), join(projectDir, lib.file));

  return { previews, cover, warnings };
}
