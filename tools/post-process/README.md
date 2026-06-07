# Broadcast Finishing — DaVinci Resolve Post-Process

Optional step that applies a cinematic-broadcast color grade to the raw Remotion master before per-platform encode.

## Why

Remotion's raw output is clean but flat. This step adds:
- A broadcast-neutral LUT (slight warm grade, raised blacks)
- A subtle vignette (Fusion node)
- Film grain matched to Remotion's FilmGrain overlay
- A mild final sharpen

The graded clip goes to `out/raw/<edition>-graded.mp4`. From there `finalize-clip.js --post=resolve` uses it as the master for all platform encodes.

## Install

1. Download **DaVinci Resolve** (free version is sufficient): https://www.blackmagicdesign.com/products/davinciresolve/
2. Install and launch Resolve at least once so it creates its support directories.

## One-time template setup

The template file `project-template.drp` needs to be created manually the first time:

1. Open DaVinci Resolve.
2. Create a new project — name it `Meridian-Template`.
3. Create a timeline with a single dummy clip (any MP4).
4. **Color page → LUT panel**: Apply a broadcast-neutral LUT to Node 1. Good free options:
   - "Kodak 2383" from the built-in LUT library
   - Or download "Meridian" custom LUT if available from the project assets
5. Add Node 2 → Fusion effect → add a Vignette tool (set Size 0.8, Softness 0.8, Strength 0.25)
6. Add Node 3 → Fusion effect → add a Film Grain tool (Grain Size 0.4, Strength 0.15) to complement the existing Remotion FilmGrain overlay
7. Add Node 4 → Sharpen (Amount 0.3)
8. **File → Export Project Archive** → save as `tools/post-process/project-template.drp`

> Note: `project-template.drp` is a binary file — commit it to git after creation.

## Per-edition usage

```bash
# Step 1 — produce the raw Remotion master (stages 1–3 of produce-clip.js)
node scripts/produce-clip.js --edition=2026-06-06-evening --platforms=youtube

# Step 2 — open Resolve and run the finishing script
python tools/post-process/resolve-import.py --edition=2026-06-06-evening

# Step 3 — finalize from the graded master
node scripts/finalize-clip.js --edition=2026-06-06-evening --post=resolve
```

Or run everything via produce-clip.js and only add `--post=resolve` in step 3 after Resolve is done.

## Requirements

- DaVinci Resolve must be **open and running** when you run `resolve-import.py`.
- The DaVinciResolveScript Python module ships with Resolve:
  ```
  C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules
  ```
  Add this to your PYTHONPATH if the script can't find it:
  ```powershell
  $env:PYTHONPATH = "C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules"
  python tools/post-process/resolve-import.py --edition=2026-06-06-evening
  ```

## Automating in the cron pipeline

Phase 2 (deferred): once the manual workflow is validated, `produce-clip.js` can be extended to call `resolve-import.py` via `child_process.execFileSync` between Stage 3 and Stage 4. Resolve can run headless on Windows via its built-in scripting host.
