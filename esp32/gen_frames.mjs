// ESP32 で再生するために、使う文字の動き（文字ごと・進行率ごとの線の形）を書き出して wadalab_frames.h を作る。
// 動きの計算はこのパソコン側で済ませ、ESP32 は線と点を描くだけにする（WadalabMotion.h）。
// 使い方：node esp32/gen_frames.mjs "使う文字をぜんぶ" [出力先=wadalab_frames.h] [段数=40]
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createMotionLibrary} from '../web/motion-library.js';

const [text, out = 'wadalab_frames.h', stepsArg = '40'] = process.argv.slice(2);
if (!text) { console.error('使い方：node esp32/gen_frames.mjs "使う文字" [出力先] [段数]'); process.exit(1); }
const STEPS = Number(stepsArg);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = async p => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const m = createMotionLibrary({program: await j('web/source-program.json'), glyphs: await j('web/source-glyphs.json'),
  ascii: await j('web/font/ascii-outlines.json'), alpha: await j('web/font/alpha-centerlines.json')});

const chars = [...new Set([...text])].filter(c => c.trim());
const q = v => Math.max(0, Math.min(255, Math.round(v * 255 / 400)));   // 400 単位 → 0〜255
const pts = [], strokes = [], frames = [], glyphs = [], skipped = [];
for (const c of chars) {
  if (!m.has(c)) { skipped.push(c); continue; }
  const f0 = frames.length;
  let ok = true;
  for (let s = 0; s <= STEPS && ok; s++) {
    let f = m.sample(c, s / STEPS);
    // 「ー」は輪郭だけで中心線がない。真ん中から左右へ伸びる 1 本の線として作る
    if (f && f.kind === 'outline' && c === 'ー') {
      const half = 140 * f.reveal;
      f = {kind: 'paths', strokes: f.reveal > 0 ? [{kind: 'line', width: 16, points: [{x: 200 - half, y: 200}, {x: 200 + half, y: 200}]}] : []};
    }
    if (!f || f.kind !== 'paths') { ok = false; break; }
    const s0 = strokes.length;
    for (const st of f.strokes) {
      if (st.kind === 'line') {
        const p0 = pts.length;
        let last = null;
        for (const p of st.points) {
          const k = [q(p.x), q(p.y)];
          if (last && last[0] === k[0] && last[1] === k[1]) continue;   // 同じ点は 1 つにまとめる（長さのない線は 1 点になる）
          pts.push(k); last = k;
        }
        strokes.push([0, p0, pts.length - p0, Math.round(st.width * 255 / 400 * 4)]);
      } else if (st.kind === 'dot' && st.radiusX > 0) {
        const p0 = pts.length;
        pts.push([q(st.center.x), q(st.center.y)]);
        strokes.push([1, p0, 1, Math.round(Math.max(st.radiusX, st.radiusY) * 255 / 400 * 4)]);
      }
    }
    frames.push([s0, strokes.length - s0]);
  }
  if (!ok) { frames.length = f0; skipped.push(c); continue; }   // 中心線のない文字（輪郭だけの文字）は入れない
  glyphs.push([c, f0]);
}
if (pts.length > 65535 || strokes.length > 65535) throw new Error('文字が多すぎます（点か線が 65535 を超えました）');

const cstr = c => '"' + c.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
let h = `// esp32/gen_frames.mjs で作る。手で直さない。文字：${glyphs.map(g => g[0]).join('')}、段数 ${STEPS}
// 和田研フォント由来のデータの利用条件は、wadalab-motion の web/SOURCE-LICENSE.txt と web/SOURCE-NOTICE.txt を参照
#pragma once
#include <WadalabMotion.h>
`;
h += `static const uint8_t WADALAB_PTS[][2] = {${pts.map(p => `{${p[0]},${p[1]}}`).join(',')}};\n`;
h += `static const wadalab::Stroke WADALAB_STROKES[] = {${strokes.map(s => `{${s.join(',')}}`).join(',')}};\n`;
h += `static const wadalab::Frame WADALAB_FRAMES[] = {${frames.map(f => `{${f[0]},${f[1]}}`).join(',')}};\n`;
h += `static const wadalab::Glyph WADALAB_GLYPHS[] = {${glyphs.map(g => `{${cstr(g[0])},${g[1]}}`).join(',')}};\n`;
h += `static const wadalab::Font WADALAB_FONT = {WADALAB_PTS, WADALAB_STROKES, WADALAB_FRAMES, WADALAB_GLYPHS, ${glyphs.length}, ${STEPS}};\n`;
await writeFile(out, h);
console.log(`${glyphs.length} 文字、点 ${pts.length}、線 ${strokes.length}、約 ${Math.round((pts.length * 2 + strokes.length * 6 + frames.length * 4) / 1024)} KB → ${out}`);
if (skipped.length) console.log(`入れなかった文字（未収録か、輪郭だけの文字）：${skipped.join('')}`);
