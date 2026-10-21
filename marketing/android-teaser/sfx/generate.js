// Generates every cue in cues.json with the ElevenLabs text-to-sound-effects API.
// usage: ELEVENLABS_API_KEY=... node generate.js [--only name1,name2]
// Writes sfx/<name>.mp3. Existing files are skipped unless --force is given.
const fs = require('fs'); const path = require('path');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set'); process.exit(1); }
const { cues } = JSON.parse(fs.readFileSync(path.join(__dirname, 'cues.json'), 'utf8'));
const onlyIdx = process.argv.indexOf('--only'); const only = onlyIdx > -1 ? new Set(process.argv[onlyIdx + 1].split(',')) : null;
const force = process.argv.includes('--force');
(async () => {
  for (const c of cues) {
    if (only && !only.has(c.name)) continue;
    const out = path.join(__dirname, `${c.name}.mp3`);
    if (fs.existsSync(out) && !force) { console.log(`skip ${c.name} (exists)`); continue; }
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: c.prompt, duration_seconds: c.duration, prompt_influence: c.prompt_influence }),
    });
    if (!res.ok) { console.error(`${c.name}: HTTP ${res.status} ${await res.text()}`); process.exitCode = 1; continue; }
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`ok   ${c.name} (${c.duration}s)`);
  }
})();
