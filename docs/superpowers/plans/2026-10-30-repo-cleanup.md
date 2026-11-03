# Repo cleanup: ship the map fixes, rebuild the redesign branch, fix Phase 0's outlet lists

Read this whole file before running anything. Propose your plan, then do the steps in order. Ask Dan before every commit and every push.

## What went wrong (so you don't repeat it)

The pipeline publishes data to this repo every 15 minutes (`gitCommitAndPush` in the pipeline's `server/index.js`). It builds each commit on top of `origin/main` with a temporary index, pushes it, then runs `git update-ref refs/heads/main <new commit>`. Two side effects in this folder:

1. Any commit made on `main` here and not yet pushed is thrown away at the next sync. That happened to `5ab958473` (map fixes) at 7:00 AM and to `5edf230f6` at 1:15 PM on Oct 30.
2. Git's real index is never updated, so `git status` here shows old reports and articles as staged additions and deletions. Any `git commit` on any branch in this folder picks them up. That is how `5edf230f6` ("chore: ignore .worktrees directory") came to delete the Oct 26-30 reports and articles and re-add the pruned Sept 26-29 ones.

The pipeline handoff (`my-news-analyzer-pipeline/docs/superpowers/plans/2026-10-30-separate-publish-clone.md`) landed at 8:53 PM Oct 30, so the pipeline no longer touches this folder. Its index is still wrong until Step 5, so these rules apply until then:
- Never commit on `main` in this folder. Work in a worktree under `.worktrees/` on a branch made from a freshly fetched `origin/main`.
- Before every commit, run `git diff --cached --name-only` and stop if it lists anything under `reports/`, `articles/`, `topics/` or `timelines/`.
- Never run `git reset --hard`, `git checkout .`, `git clean` or `git stash` in this folder. Its working files hold the only uncommitted copy of the map fixes and the pipeline's live data.
- Push between sync times, not at :00, :15, :30 or :45. If a push to `main` is rejected as non-fast-forward, fetch, rebase onto the new `origin/main` and retry.

## Step 1: keep a safety copy

- `git branch backup/redesign-desktop-2026-10-30 redesign-desktop` (points at `4fb044547`, which has both bad commits).
- `git branch backup/map-fixes-2026-10-30 5ab958473` (the original map-fix commit; it's still in the reflog).

## Step 2: ship the map fixes to `main`

1. `git fetch origin`. Create a worktree `.worktrees/map-fixes` on a new branch `map-fixes` from `origin/main`.
2. In that worktree, take only the code files from the original fix: `git checkout 5ab958473 -- src/App.jsx src/components/MapHero.jsx src/components/StoryCard.jsx TODO.md`. Then add `.worktrees/` to `.gitignore`.
   - Check this matches the code in `5edf230f6` for those three `src` files (`git diff 5edf230f6 -- src/`). If it differs, show Dan the difference before going on.
3. `git diff --cached --name-only origin/main` must list only those four files and `.gitignore`.
4. `npm run build`, then `npm run dev` and re-check the Task 1-4 verifications from `docs/superpowers/plans/2026-10-29-map-and-story-behavior.md`:
   - pick a second location, scroll past 400px, and the map doesn't move
   - a single-outlet story inside a group moves the map
   - `scrollIntoView` lands below the map
   - with Hide Map set, a reload loads no map
5. Commit ("fix: stable map behavior before redesign migration", same message body as `5ab958473`). Ask Dan, then `git push origin map-fixes:main`.
6. After Vercel deploys, check the live site the same way and report.

## Step 3: rebuild `redesign-desktop` clean

1. `git fetch origin`. Create a new branch `redesign-desktop-clean` from the updated `origin/main` (which now has the map fixes) in a worktree `.worktrees/redesign-desktop-clean`.
2. `git cherry-pick 4fb044547` (Phase 0). It touches only code files; if it conflicts, resolve in favor of the Phase 0 change and show Dan.
3. `git diff --name-only origin/main...HEAD` must not list anything under `reports/`, `articles/`, `topics/` or `timelines/`.
4. Remove the old worktree (`git worktree remove .worktrees/redesign-desktop`), rename the old branch to `old/redesign-desktop`, and rename the new one to `redesign-desktop`. Keep the backup branches from Step 1 until Dan says to delete them.
5. Ask Dan whether to push `redesign-desktop` to GitHub now. Recommended, so the branch can't be lost; pushing a branch doesn't deploy to production.

## Step 4: fix Phase 0's outlet lists

In `src/shared/source-leans.js`, `LEFT_OUTLETS`, `CENTER_OUTLETS` and `RIGHT_OUTLETS` are fixed to today's leans. A past edition must group outlets by its own leans: on Oct 28, Newsweek is left and AP News and Al Jazeera are center.

- Replace the three constants with `outletsByLean(leans)`, returning `{ left, center, right }` from the map passed in. Keep a stable display order: the order of keys in the map, which is feed order for both the legacy map and the pipeline's stamped map.
- Add `outletCount(leans)` (the number of outlets in the map) for the "of N outlets" total.
- `SourceBadge`: an outlet missing from the map (`lean` null) gets a neutral color, not the center color. Add a `TODO(Phase 1)` comment to remove the hex fallbacks once the color tokens exist.
- Check, in the dev console or a small test:
  - `outletsByLean(leansFor(<2026-10-28-morning report>))` puts Newsweek in left, and AP News and Al Jazeera in center.
  - `outletsByLean(leansFor(<2026-10-30-evening report>))` puts Newsweek in center and AP News in left. Tonight's evening report is the first one stamped with `sourceLeans` (`leansVersion` 2026-10-30).
- Commit on `redesign-desktop` as "fix(phase-0): outlet groups follow each report's lean map".

## Step 5: catch this folder up

Status as of Oct 31: the index here is already clean. A reset at 9:52 PM Oct 30 cleared it, and also discarded the uncommitted working copies of the map-fix files. That's fine, because the code is in commit `5ab958473` (Step 1 gives it a branch) and in `5edf230f6`. The `.gitignore` change was discarded too; Step 2 re-adds it. Local `main` is behind `origin/main` and the pipeline no longer moves it.

1. Keep the `CLAUDE.md` change (the note about `git pull` and the sync clone). Commit it on its own from a worktree branch, not on `main` here, and push it with Dan's OK.
2. After Step 2's push has reached `origin/main`, run `git pull --ff-only` on `main` here.
3. `git status` should then show nothing modified except untracked plan and spec files under `docs/`. If anything else shows up, list it for Dan and change nothing.

## Report back

For each step: the commands run, the resulting commit ids, and the checks' results. Then stop. Phase 1 starts only after Dan reviews.
