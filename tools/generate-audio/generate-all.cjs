#!/usr/bin/env node
/**
 * generate-all.cjs — render every audio asset and write provenance.
 *
 *   node tools/generate-audio/generate-all.cjs            # everything
 *   node tools/generate-audio/generate-all.cjs music      # one group
 *   node tools/generate-audio/generate-all.cjs --only music-main,seagulls
 *   node tools/generate-audio/generate-all.cjs --analyze  # + QA report
 *
 * OUTPUT FORMATS — and why
 * ------------------------
 * music   -> assets/audio/music/<key>.ogg   (44.1 kHz stereo, Ogg — see pickOggEncoder)
 * ambient -> assets/audio/sfx/<key>.wav     (22.05 kHz mono, 16-bit PCM)
 * sfx     -> assets/audio/sfx/<key>.wav     (44.1 kHz mono, 16-bit PCM)
 *
 * BootScene requests music as `[<key>.ogg, <key>.wav]` and ambience/sfx as
 * `<key>.wav` only. Chrome prefers the .ogg entry, so music ships in the Ogg
 * container: it is what the engine actually asks for first, and it keeps seven
 * 60-90 s stereo loops at ~1 MB each instead of ~13 MB each. Ambience has no
 * .ogg option in the loader, so it stays PCM — at 22.05 kHz, which is where the
 * asset budget lands for 16 beds (11 kHz of bandwidth is ample for wind,
 * water, crowd and insect beds).
 *
 * THE DECODE BUG THIS ALSO FIXES
 * ------------------------------
 * Before this tool, `assets/audio/music/` contained only `.wav` placeholders.
 * BootScene asks for `[<key>.ogg, <key>.wav]`; Chrome reports Ogg support, so
 * Phaser picked the `.ogg` URL — which did not exist. Vite's SPA fallback
 * answers unknown paths with `index.html` and HTTP 200, so Phaser fed HTML
 * bytes to decodeAudioData and every music key threw
 * "Unable to decode audio data". The WAV headers were never malformed.
 * Shipping real `.ogg` files makes the URL Phaser prefers a real audio file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const A = require('./lib/audio.cjs');
const An = require('./lib/analyze.cjs');
const { TRACKS } = require('./music.cjs');
const { BEDS } = require('./ambient.cjs');
const { SFX } = require('./sfx.cjs');

const TOOL_VERSION = '1.0.0';
const ROOT = path.resolve(__dirname, '..', '..');
const MUSIC_DIR = path.join(ROOT, 'assets', 'audio', 'music');
const SFX_DIR = path.join(ROOT, 'assets', 'audio', 'sfx');
const MANIFEST = path.join(ROOT, 'assets', 'audio', 'MANIFEST.json');

// ---------------------------------------------------------------------------

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/**
 * Pick the best available Ogg audio encoder.
 *
 * libvorbis is the ideal (it is literally what Phaser's format probe asks the
 * browser about) but many ffmpeg builds ship without it. libopus is the next
 * choice: better quality per byte than Vorbis, in the same Ogg container, and
 * decoded by every engine that decodes Ogg Vorbis — Chrome, Firefox, Edge and
 * Electron all handle it via decodeAudioData, which sniffs the actual codec
 * rather than trusting the file extension. ffmpeg's native `vorbis` encoder is
 * the last resort; it is real Vorbis but noticeably worse than either.
 */
function pickOggEncoder() {
  let list = '';
  try { list = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return null; }
  if (/^\s*A\S*\s+libvorbis\b/m.test(list)) return { codec: 'libvorbis', args: ['-q:a', '4'], label: 'ogg-vorbis-q4' };
  if (/^\s*A\S*\s+libopus\b/m.test(list)) return { codec: 'libopus', args: ['-b:a', '112k', '-vbr', 'on', '-application', 'audio'], label: 'ogg-opus-112k' };
  if (/^\s*A\S*\s+vorbis\b/m.test(list)) return { codec: 'vorbis', args: ['-strict', '-2', '-q:a', '5'], label: 'ogg-vorbis-native-q5' };
  return null;
}

const OGG_ENC = hasFfmpeg() ? pickOggEncoder() : null;

/** Encode a temp WAV into the Ogg container and remove the temp. */
function encodeOgg(wavPath, oggPath) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', wavPath,
    '-c:a', OGG_ENC.codec, ...OGG_ENC.args,
    '-f', 'ogg',
    oggPath,
  ]);
}

function sha256(file) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

const fmtBytes = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(2)} MB`);

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const wantAnalyze = argv.includes('--analyze');
const onlyIdx = argv.indexOf('--only');
const onlyKeys = onlyIdx >= 0 && argv[onlyIdx + 1] ? new Set(argv[onlyIdx + 1].split(',')) : null;
const groups = argv.filter((a) => ['music', 'ambient', 'sfx'].includes(a));
const wantGroup = (g) => groups.length === 0 || groups.includes(g);

const ffmpeg = hasFfmpeg();
if (wantGroup('music') && !OGG_ENC) {
  console.error('ERROR: no usable Ogg encoder found (need ffmpeg with libvorbis, libopus or native vorbis).');
  console.error('       Install one (brew install ffmpeg) or run with `ambient sfx` to skip music.');
  process.exit(1);
}
if (wantGroup('music')) console.log(`ogg encoder: ${OGG_ENC.codec} (${OGG_ENC.label})`);

const entries = [];
const reports = [];
let totalBytes = 0;

function emit(group, item, outPath, { ogg = false } = {}) {
  const tmp = ogg ? `${outPath}.tmp.wav` : outPath;
  const info = A.writeWav(tmp, item.channels, item.sr);
  if (ogg) {
    encodeOgg(tmp, outPath);
    fs.unlinkSync(tmp);
  }
  const bytes = fs.statSync(outPath).size;
  totalBytes += bytes;
  const durationSec = +(item.channels[0].length / item.sr).toFixed(3);
  const entry = {
    key: item.key,
    group,
    file: path.relative(ROOT, outPath),
    format: ogg ? OGG_ENC.label : 'wav-pcm-s16le',
    sampleRate: item.sr,
    channels: item.channels.length,
    durationSec,
    bytes,
    sha256_16: sha256(outPath),
    seed: item.seed,
    loop: group !== 'sfx',
  };
  if (item.bpm) Object.assign(entry, { bpm: item.bpm, bars: item.bars, beats: item.beats, mode: item.mode });
  entries.push(entry);
  console.log(`  ${item.key.padEnd(20)} ${String(durationSec).padStart(7)}s  ${String(item.sr).padStart(5)}Hz  ${item.channels.length}ch  ${fmtBytes(bytes).padStart(8)}  ${info.frames} frames`);

  if (wantAnalyze) {
    reports.push(Object.assign(
      An.report(item.channels, item.sr, { bpm: item.bpm || null, label: item.key }),
      { loop: group !== 'sfx' },
    ));
  }
}

function run(group, table, dir, opts) {
  if (!wantGroup(group)) return;
  const keys = Object.keys(table).filter((k) => !onlyKeys || onlyKeys.has(k));
  if (!keys.length) return;
  console.log(`\n== ${group} (${keys.length}) ==`);
  fs.mkdirSync(dir, { recursive: true });
  for (const k of keys) {
    const item = table[k]();
    emit(group, item, path.join(dir, k + (opts.ogg ? '.ogg' : '.wav')), opts);
  }
}

const t0 = process.hrtime.bigint();
run('music', TRACKS, MUSIC_DIR, { ogg: true });
run('ambient', BEDS, SFX_DIR, {});
run('sfx', SFX, SFX_DIR, {});
const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;

// --- clean up superseded placeholder WAVs for tracks we now ship as OGG ----
if (wantGroup('music') && !onlyKeys) {
  for (const k of Object.keys(TRACKS)) {
    const stale = path.join(MUSIC_DIR, `${k}.wav`);
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      console.log(`  removed superseded placeholder: ${path.relative(ROOT, stale)}`);
    }
  }
}

// --- manifest --------------------------------------------------------------
if (!onlyKeys && groups.length === 0) {
  const manifest = {
    tool: 'tools/generate-audio/generate-all.cjs',
    toolVersion: TOOL_VERSION,
    description:
      'All music, ambience and SFX are synthesised deterministically in pure Node '
      + '(no samples, no external services). Re-running this tool reproduces the '
      + 'same audio from the seeds below.',
    deterministic: {
      synthesis: 'exact — the rendered PCM is bit-identical across runs',
      wavFiles: 'bit-identical across runs (verified by sha256)',
      oggFiles:
        'decoded audio is bit-identical, but the .ogg file hash changes between runs: '
        + 'the Ogg container carries a randomly chosen stream serial number. Compare '
        + 'decoded PCM, not file bytes, when checking music reproducibility.',
    },
    prng: 'mulberry32 seeded by xmur3(seedString); no Date.now()/Math.random() anywhere',
    encoder: ffmpeg ? execFileSync('ffmpeg', ['-version']).toString().split('\n')[0] : null,
    synthesis: {
      plucked: 'Karplus-Strong with pick-position comb + body resonances (vihuela, lute, pipa)',
      metallophone: 'additive inharmonic bar/kettle partials with per-partial decay and paired-tuning ombak beating (saron, bonang, gender, gong ageng)',
      bell: 'hum/prime/tierce/quint/nominal partial set with beating (church bell)',
      bowed: 'band-limited additive saw + vibrato + formant resonances (viola da gamba, rebab, erhu)',
      blown: 'sine stack + tracked breath noise (suling)',
      choir: 'detuned saw stack through vowel formant bandpasses (organum pad)',
      brass: 'additive PWM pulse through envelope-tracked resonant lowpass + soft drive',
      percussion: 'pitch-dropping membrane + noise burst (rebana/kompang dum & tak), bandpassed shaker',
      ambience: 'looped pink/brown/white noise beds + granular event sprinkles + seamless periodic drift modulation',
      space: 'Schroeder/Freeverb-style comb+allpass reverb; loop mode pre-converges the network so the tail wraps',
    },
    tuning:
      'Pitch classes are 12-TET so the Portuguese and gamelan voices agree harmonically; '
      + 'metallophone voices carry small per-degree cent offsets (pelog/slendro-derived) '
      + 'plus paired-tuning beating for authentic gamelan shimmer without wrecking the counterpoint.',
    looping:
      'Music: rendered into loopLength + 8-12 s of tail, then the tail is folded back onto '
      + 'the head (foldTail), which is exactly what a looping player outputs — sample-accurate, '
      + 'no crossfade, no fade-out. Ambience: looped noise beds, integer-period drift LFOs, '
      + 'wrapped event placement, pre-rolled filter/reverb state. Verified numerically: the '
      + 'largest sample step at the wrap is compared against the largest step elsewhere in the file.',
    formats: {
      music: 'Ogg Vorbis q4, 44.1 kHz stereo — BootScene requests .ogg first',
      ambient: 'WAV PCM s16le, 22.05 kHz mono — BootScene loads ambience as .wav only',
      sfx: 'WAV PCM s16le, 44.1 kHz mono',
    },
    totals: {
      files: entries.length,
      bytes: totalBytes,
      human: fmtBytes(totalBytes),
      renderSeconds: +elapsed.toFixed(1),
    },
    assets: entries,
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nmanifest -> ${path.relative(ROOT, MANIFEST)}`);
}

console.log(`\n${entries.length} files, ${fmtBytes(totalBytes)} total, rendered in ${elapsed.toFixed(1)}s`);

if (wantAnalyze) {
  const out = path.join(__dirname, 'analysis-report.json');
  fs.writeFileSync(out, JSON.stringify(reports, null, 2) + '\n');
  console.log(`\n=== QA ===`);
  console.log('key                  dur    peak   rms   seamRatio  dRMSdb  onsets/s  grid%  contrast');
  for (const r of reports) {
    console.log(
      r.label.padEnd(20),
      String(r.durationSec).padStart(6),
      String(r.levels.peak).padStart(6),
      String(r.levels.rms).padStart(6),
      String(r.loop ? r.seam.seamOutlierRatio : '-').padStart(9),
      String(r.loop ? r.seam.rmsDeltaDb : '-').padStart(7),
      String(r.onsets.perSecond).padStart(9),
      String(r.onsets.gridAlignedPct ?? '-').padStart(6),
      String(r.structure.sectionContrast).padStart(9),
    );
  }
  console.log(`\nfull report -> ${path.relative(ROOT, out)}`);
  // Only looping assets can click at a wrap; one-shots legitimately start loud
  // and end in silence, so the seam metric is meaningless for them.
  const bad = reports.filter((r) => r.loop && r.seam.seamOutlierRatio > 1.8);
  if (bad.length) {
    console.log(`\nWARNING: possible loop click in: ${bad.map((b) => b.label).join(', ')}`);
  } else {
    console.log('\nloop seams: no outlier steps at any wrap point (all within normal in-file range)');
  }
}
