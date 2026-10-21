# Kopare — "Now on Android" teaser (TikTok, 1080×1920)

Deliverables
- `kopare-android-teaser-1080x1920.mp4` — 12 s, 60 fps, H.264 / yuv420p, silent. Upload as-is to TikTok (9:16) and add a trending sound.
- `kopare-android-teaser-cover.png` — suggested cover frame (end card).

Source
- `teaser.html` — the whole animation as a deterministic canvas render (`render(t)` for any time in seconds). Open it in a browser to preview live.
- `render.js` — steps the animation frame by frame in headless Chromium (Playwright) and writes PNGs.
- `fonts/` — Figtree + Newsreader (the kopare.app brand fonts) so renders don't depend on the network.

Re-render
```
node render.js /tmp/frames 60
ffmpeg -framerate 60 -i /tmp/frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 19 -preset slow -g 60 -movflags +faststart kopare-android-teaser-1080x1920.mp4
```
Quick keyframe check: `node render.js /tmp/preview 60 --preview 1.1,2.5,4.5,7,9.5,11`.

Notes
- The Android robot head is drawn, not the official asset. Google licenses the robot under CC BY 3.0; if you keep it, credit "The Android robot is reproduced or modified from work created and shared by Google" in the caption or profile, or swap in the official artwork.
- "Get it on Google Play" is plain text in a brand-coloured pill on purpose; Google's badge guidelines don't allow redrawn copies of the official badge. Overlay the official badge PNG if you want that look.

Sound effects (ElevenLabs)
- `sfx/cues.json` — the sound design cue sheet: 15 cues timed to the animation (riser, ignition boom, bounces, heart pop and heartbeat, letter ticks, sheen, three text slams, calm pad, wipe, confetti, typing pops, logo sting, plus a quiet ambient bed), each with its text-to-sound-effects prompt, duration, gain and placement times.
- `sfx/generate.js` — calls the ElevenLabs text-to-sound-effects API for each cue and writes `sfx/<name>.mp3`. Needs `ELEVENLABS_API_KEY` in the environment and network access to `api.elevenlabs.io`.
- `sfx/mix.js` — lays the cues onto the silent MP4 with ffmpeg and writes `kopare-android-teaser-1080x1920-sfx.mp4`.

```
cd marketing/android-teaser/sfx
ELEVENLABS_API_KEY=... node generate.js      # ~15 short generations
node mix.js                                   # writes ../kopare-android-teaser-1080x1920-sfx.mp4
```
Tweak a cue's prompt, gain or timing in `cues.json`, regenerate just that cue with `node generate.js --only slam --force`, and re-run `mix.js`.
