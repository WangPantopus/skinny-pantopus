#!/bin/zsh
# Runs the badge query itself (homeDashboardService.unreadMailQuery, from the checkout the backend runs) for each
# actor and letter, bypassing only the dashboard's mailbox.view gate. Prints 1/0 per letter; no secrets printed.
RT=/private/tmp/pantopus-stream2-r06-runtime
SRC=$(cat $RT/backend.src)
set -a; source /private/tmp/pantopus-workstream-home/.stream2-verification/native/supabase.env; set +a
cd $SRC/backend && env SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
  SUPABASE_JWT_SECRET=$JWT_SECRET JWT_SECRET=$JWT_SECRET LOG_LEVEL=error node -e '
const fs = require("fs");
const Module = require("module"); const path = require("path");
const file = path.resolve("services/homeDashboardService.js");
const src = fs.readFileSync(file, "utf8") + "\nmodule.exports.__unreadMailQuery = unreadMailQuery;\n";
const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(src, file);
const unreadMailQuery = m.exports.__unreadMailQuery;
const L = Object.fromEntries(fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map(l => l.split("=")));
const KEYS = ["y_shared", "y_v1_noattn", "y_attn_members", "y_attn_only", "y_attn_admins", "y_private"];
const ACTORS = { owner: "3d61b2c3-d767-458a-82ff-a63c5c85da99", viewer: "20bd1f37-7f90-49a4-8445-47eb5acb395d", editor: "de50270f-222e-405f-bc30-9ecc7801c245" };
(async () => {
  console.log("# badge rule (unreadMailQuery) per letter; order: " + KEYS.join(" "));
  for (const [who, id] of Object.entries(ACTORS)) {
    const cells = [];
    for (const k of KEYS) {
      const { count, error } = await unreadMailQuery("f0e51100-0000-4000-8000-000000000200", id, new Date().toISOString()).eq("id", L[k]);
      cells.push(error ? "E" : String(count));
    }
    console.log(who.padEnd(8) + " " + cells.join(" "));
  }
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
' $RT/work/y-fixture-ids.txt 2>&1 | grep -v "^\s*$" | grep -vi "warn\|info\|injected env"
