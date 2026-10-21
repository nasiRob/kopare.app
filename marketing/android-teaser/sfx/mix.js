// Lays the generated cues onto the silent teaser and writes the final MP4 with audio.
// usage: node mix.js [input.mp4] [output.mp4]
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const { cues } = JSON.parse(fs.readFileSync(path.join(__dirname, 'cues.json'), 'utf8'));
const input = process.argv[2] || path.join(__dirname, '..', 'kopare-android-teaser-1080x1920.mp4');
const output = process.argv[3] || path.join(__dirname, '..', 'kopare-android-teaser-1080x1920-sfx.mp4');
const dir = process.env.SFX_DIR || __dirname;
const args = ['-y', '-loglevel', 'error', '-i', input];
const filters = [], labels = [];
let n = 1;
for (const c of cues) {
  const f = path.join(dir, `${c.name}.mp3`);
  if (!fs.existsSync(f)) { console.warn(`missing ${c.name}.mp3, skipping`); continue; }
  for (const at of c.at) {
    args.push('-i', f);
    const ms = Math.round(at * 1000);
    filters.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${c.gain_db}dB,adelay=${ms}|${ms}[a${n}]`);
    labels.push(`[a${n}]`); n++;
  }
}
if (!labels.length) { console.error('no cue audio found; run generate.js first'); process.exit(1); }
filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false,aformat=sample_rates=48000[mix]`);
args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', output);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log(`wrote ${output} with ${labels.length} cue placements`);
