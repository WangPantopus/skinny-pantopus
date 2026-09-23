## What this is

A combined merge of 36 reviewed PRs. Each PR's head commit merges unchanged, in queue order, so what lands is exactly what was reviewed. CI runs once on the combination instead of once per PR after each branch update.

- **Why:** about 30 native PRs were waiting. Each native CI run takes about 35 minutes, and runners are saturated, so merging them one at a time would take most of a day.
- **What GitHub does:** when this merges, GitHub marks each included PR as merged, because its head commit is now in master.
- **If an agent pushed after this was built:** that PR stays open with only the new commits and merges later.

## Included (in merge order)

| PR | Head |
|---|---|
| #319 | `1771fb8f4` |
| #343 | `aaca939f5` |
| #345 | `a8860e3da` |
| #344 | `a506da106` |
| #347 | `fc1954ba6` |
| #292 | `358f798d4` |
| #337 | `22ecc2236` |
| #340 | `18c69bb31` |
| #341 | `998619b2e` |
| #314 | `fc4ff508c` |
| #221 | `8ada89ab1` |
| #236 | `24e202d87` |
| #219 | `67e380ca1` |
| #214 | `21dd1947a` |
| #215 | `6f6c8e64a` |
| #224 | `c9e64a141` |
| #199 | `de0392b4c` |
| #208 | `41ca4f243` |
| #251 | `1fa08d0f4` |
| #252 | `4bd6cd48c` |
| #279 | `9c01aad86` |
| #262 | `277668625` |
| #264 | `777e673e9` |
| #287 | `e4c9c17d3` |
| #266 | `6c3345833` |
| #285 | `cc47abf7c` |
| #286 | `787e58a3e` |
| #301 | `b569c592e` |
| #303 | `4e7819c86` |
| #305 | `e488cccee` |
| #306 | `9530d3e5a` |
| #302 | `87d58a5b7` |
| #313 | `f8293ddc6` |
| #307 | `614d6fa6f` |
| #335 | `8342dbc30` |
| #336 | `6e2824182` |

## Left out

- #257: it conflicts with #292 and #279 in `HubTabRoot.swift` (all three change notification routing). Stream 2 rebases it after this merges.

## Checks before pushing

- Every merge is a clean `git merge-tree`.
- No new duplicate function definitions in the 16 files that several PRs touch; the repeats are overloads already on master.
- No PR here touches migrations, workflows, lockfiles or Gradle/Podfile configuration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
