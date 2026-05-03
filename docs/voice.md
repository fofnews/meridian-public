# Meridian Broadcast — Voice Configuration

## Pinned voices

| Provider | Voice | ID / name | Character |
|----------|-------|-----------|-----------|
| ElevenLabs | George | `JBFqnCBsd6RMkjVDRZzb` | Deep, authoritative British male; reads as news-anchor |
| OpenAI TTS | onyx | `onyx` | Deep American male; closest OpenAI equivalent |

Both voices are used as defaults in `scripts/synthesize-narration.js` and can be overridden via env var:

```sh
ELEVENLABS_VOICE_ID=<id>  node scripts/synthesize-narration.js --edition=...
OPENAI_VOICE=echo         node scripts/synthesize-narration.js --edition=...
```

## Provider selection

`synthesize-narration.js` checks env vars in this order:

1. `ELEVENLABS_API_KEY` → ElevenLabs (preferred; higher quality, ~$0.30/1k chars)
2. `OPENAI_API_KEY` → OpenAI TTS (`tts-1-hd`, ~$0.03/1k chars)
3. Neither set + `--dry-run` → silence for all shots (for pipeline testing)

## ElevenLabs settings

```json
{
  "model_id": "eleven_multilingual_v2",
  "voice_settings": { "stability": 0.45, "similarity_boost": 0.75 }
}
```

- `stability 0.45` — slight variation keeps long-form narration from sounding robotic
- `similarity_boost 0.75` — keeps voice character consistent across shots

## Changing the voice

1. Browse voices at https://elevenlabs.io/voice-library or via the API
2. Update the `ELEVENLABS_VOICE_ID` default in `scripts/synthesize-narration.js`
3. Update this doc
4. Re-generate a test clip: `node scripts/synthesize-narration.js --edition=<edition> --dry-run`

## Audio spec

All per-shot WAVs and `full.wav` are 44.1 kHz, stereo, PCM 16-bit (`pcm_s16le`).
This matches the ffmpeg mux input expected by `scripts/finalize-clip.js` (item 18).
