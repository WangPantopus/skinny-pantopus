# Immutable historical migrations

These files are preserved byte-for-byte from the former timestamped stream.
They cannot install a fresh database and contain overlapping version prefixes.
They are historical evidence and selected regression fixtures, not runnable
migration history. Their original hashes remain in migration-policy.json.
Do not edit, delete, rename or replay them against hosted databases.

The canonical stream is ../migrations. Existing projects require a reviewed
forward upgrade and ledger adoption before that stream may be enabled.
