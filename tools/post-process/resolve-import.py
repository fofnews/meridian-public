#!/usr/bin/env python3
"""
DaVinci Resolve finishing pass for Meridian broadcast masters.

Imports the raw Remotion render into the project template, applies the LUT +
vignette + grain Fusion node, and renders to out/raw/<edition>-graded.mp4.

Prerequisites:
  - DaVinci Resolve (free or Studio) is installed and running.
  - The DaVinciResolveScript module is on PYTHONPATH:
      Windows: C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\Developer\\Scripting\\Modules
  - A project template has been prepared (see README.md):
      tools/post-process/project-template.drp

Usage:
  python tools/post-process/resolve-import.py --edition=2026-04-30-evening

Output:
  out/raw/<edition>-graded.mp4

After the graded master is produced, finalize with:
  node scripts/finalize-clip.js --edition=2026-04-30-evening --post=resolve
"""

import sys
import os
import argparse
from pathlib import Path

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description='DaVinci Resolve finishing pass')
parser.add_argument('--edition', required=True, help='Edition slug, e.g. 2026-04-30-evening')
args = parser.parse_args()
edition = args.edition

ROOT = Path(__file__).parent.parent.parent
raw_path    = ROOT / 'out' / 'raw' / f'{edition}.mp4'
output_path = ROOT / 'out' / 'raw' / f'{edition}-graded.mp4'

if not raw_path.exists():
    print(f'Error: raw master not found: {raw_path}', file=sys.stderr)
    print('Run produce-clip.js (stages 1-3) first.', file=sys.stderr)
    sys.exit(1)

# ── Connect to Resolve ────────────────────────────────────────────────────────

# DaVinciResolveScript is bundled with Resolve; add its path if not already set.
SCRIPT_MODULE_PATH = (
    r'C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules'
)
if SCRIPT_MODULE_PATH not in sys.path:
    sys.path.append(SCRIPT_MODULE_PATH)

try:
    import DaVinciResolveScript as dvr
except ImportError:
    print('Error: DaVinciResolveScript module not found.', file=sys.stderr)
    print(f'Expected at: {SCRIPT_MODULE_PATH}', file=sys.stderr)
    print('Make sure DaVinci Resolve is installed and the module path is on PYTHONPATH.', file=sys.stderr)
    sys.exit(1)

resolve = dvr.scriptapp('Resolve')
if resolve is None:
    print('Error: Could not connect to DaVinci Resolve.', file=sys.stderr)
    print('Make sure DaVinci Resolve is open and running.', file=sys.stderr)
    sys.exit(1)

project_manager = resolve.GetProjectManager()
if project_manager is None:
    print('Error: Could not get ProjectManager from Resolve.', file=sys.stderr)
    sys.exit(1)

# ── Load project template ─────────────────────────────────────────────────────

template_path = Path(__file__).parent / 'project-template.drp'
if not template_path.exists():
    print(f'Error: project template not found: {template_path}', file=sys.stderr)
    print('See tools/post-process/README.md to set up the template.', file=sys.stderr)
    sys.exit(1)

# Import the template as a new project named after the edition.
project_name = f'Meridian-{edition}'
project = project_manager.ImportProject(str(template_path), project_name)
if project is None:
    # Template already imported as this name — open it.
    project = project_manager.LoadProject(project_name)
if project is None:
    print(f'Error: Could not import or load project "{project_name}".', file=sys.stderr)
    sys.exit(1)

# ── Import raw master into Media Pool ─────────────────────────────────────────

media_pool   = project.GetMediaPool()
root_folder  = media_pool.GetRootFolder()
media_storage = resolve.GetMediaStorage()

clips = media_storage.AddItemListToMediaPool([str(raw_path)])
if not clips:
    print(f'Error: Could not import media: {raw_path}', file=sys.stderr)
    sys.exit(1)
source_clip = clips[0]

# Replace the first clip in the first timeline with the new source.
timeline = project.GetCurrentTimeline()
if timeline is None:
    timelines = [project.GetTimelineByIndex(i + 1) for i in range(project.GetTimelineCount())]
    timeline  = timelines[0] if timelines else None

if timeline is None:
    print('Error: No timeline found in project template.', file=sys.stderr)
    sys.exit(1)

video_track_items = timeline.GetItemListInTrack('video', 1)
if video_track_items:
    first_item = video_track_items[0]
    first_item.AddTake(source_clip)
    first_item.SelectTakeByIndex(first_item.GetTakesCount())
    first_item.FinalizeTake()

# ── Set render output path ────────────────────────────────────────────────────

output_path.parent.mkdir(parents=True, exist_ok=True)
project.SetRenderSettings({
    'SelectAllFrames': True,
    'TargetDir':       str(output_path.parent),
    'CustomName':      output_path.stem,
    'VideoFormat':     'mp4',
    'VideoCodec':      'H.264',
})

# ── Render ────────────────────────────────────────────────────────────────────

project.ClearRenderQueue()
project.AddRenderJob()

print(f'Rendering {edition} → {output_path}')
project.StartRendering()

while project.IsRenderingInProgress():
    import time
    time.sleep(2)
    status = project.GetRenderJobStatus(1)
    pct = status.get('CompletionPercentage', 0)
    print(f'  {pct:.0f}%', end='\r', flush=True)

print()

if output_path.exists():
    print(f'Done. Graded master: {output_path}')
    print(f'Next step: node scripts/finalize-clip.js --edition={edition} --post=resolve')
else:
    print('Warning: Render completed but output file not found.', file=sys.stderr)
    print(f'Check Resolve render queue for errors. Expected: {output_path}', file=sys.stderr)
    sys.exit(1)
