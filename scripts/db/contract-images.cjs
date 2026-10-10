// Public, digest-pinned images for disposable local/CI query contracts.
// Registry throttling must not silently change the database or skip a contract.
const { execFileSync } = require('node:child_process');

const postgresDigest = 'sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24';
const postgrestDigest = 'sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1';
const images = {
  postgres: [
    `public.ecr.aws/docker/library/postgres:17-alpine@${postgresDigest}`,
    `docker.io/library/postgres:17-alpine@${postgresDigest}`,
  ],
  postgrest: [
    `ghcr.io/supabase/postgrest:v14.10@${postgrestDigest}`,
    `postgrest/postgrest:v14.10@${postgrestDigest}`,
  ],
};

function ensureContractImage(kind) {
  const candidates = images[kind];
  if (!candidates) throw new Error(`Unknown contract image: ${kind}`);
  // Reuse either verified reference before making any registry requests.
  for (const image of candidates) {
    try {
      execFileSync('docker', ['image', 'inspect', image], { stdio: 'ignore', timeout: 10_000 });
      return image;
    } catch { /* try the other registry's local reference */ }
  }
  for (const image of candidates) {
    try {
      execFileSync('docker', ['pull', image], { stdio: 'pipe', timeout: 60_000 });
      return image;
    } catch {
      // Print only our public image reference, never Docker's credential-helper output.
      console.warn(`Contract image unavailable from ${image}; trying the next registry.`);
    }
  }
  throw new Error(`Cannot obtain the pinned ${kind} contract image from either registry`);
}

module.exports = { ensureContractImage };
