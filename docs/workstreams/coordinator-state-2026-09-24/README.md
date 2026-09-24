# Paused coordinator state — September24

Read `../HANDOFF-2026-09-24-PAUSED.md` first. This directory is committed safe metadata, not a runtime or credential store.

- `LIVE-SNAPSHOT.json`: timestamped GitHub/Git state, not an instruction to merge.
- `checkpoints/stream1-stop.md`, `stream2-stop.md`, `stream3-stop.md`, `shared-ux-stop.md`: each final work boundary and resume instructions.
- `tools/`: latest coordinator shell helpers. Only if `/private/tmp/pantopus-tools` is missing, restore the four same-named helpers and restore `merge-queue-run.sh` to `merge-queue/run.sh`. Create empty queue/log/watch state as needed; do not restore a historical queued PR. Never start an automatic merge runner until a new exact reviewed head is registered. Start a Monitor only on explicit task resumption after checking no watcher remains.
- `batch8-preflight-historical.json` is retained evidence for the now-merged batch, not an active queue specification.

The complete older rules/inventory/scratchpad remain in `../coordinator-state-2026-09-23/`. Private runtime/artifact backups remain under the non-Git `.pantopus-recovery/paused-runtimes/` store described in the handoff. No worktree was removed or founder runtime modified.

The legacy acquire helpers contain polling loops. The current no-automatic-waiter rule supersedes that behavior: check availability and use explicit immediate acquisition/handoffs; never leave a pending acquisition process.
