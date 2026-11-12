// wadalab-motion の ESP32 用の再生部分。
// 文字ごと・進行率ごとの線の形は、パソコンで gen_frames.mjs が書き出す（wadalab_frames.h）。この部分は線と点を描くだけ。
// 描画先は fillTriangle と fillCircle を持つもの（LovyanGFX の LGFX・LGFX_Sprite、Adafruit_GFX の GFXcanvas16 など）。
//
// 太線は「三角形 2 枚の四角形＋つなぎ目の丸」で描く。なめらかな太線（LovyanGFX の drawWideLine）は浮動小数点の計算が多く、
// 浮動小数点の回路がない ESP32-C3 では 1 画面に 30 文字ほどで 4fps まで落ちた（この方式で 20〜30fps）。
#pragma once
#include <stdint.h>
#include <string.h>
#include <math.h>

namespace wadalab {

struct Stroke { uint8_t kind; uint16_t p0; uint8_t n; uint8_t w4; };   // kind 0 = 線、1 = 点。w4 = 線幅（点は半径）× 4（0〜255 の座標で）
struct Frame { uint16_t s0; uint8_t n; };
struct Glyph { const char* ch; uint16_t f0; };
// 書き出したデータ一式（wadalab_frames.h が WADALAB_FONT として作る）
struct Font {
  const uint8_t (*pts)[2];      // 点の座標（和田研の 400 単位を 0〜255 にしたもの、x は右・y は下）
  const Stroke* strokes;
  const Frame* frames;
  const Glyph* glyphs;
  int nglyphs;
  int steps;                    // 進行率 0〜1 を何等分したか（1 文字のフレーム数は steps + 1）
};

struct Style {
  float size = 40;              // 文字の大きさ（px、400 単位の 1 文字ぶん）
  float lineScale = 1.0f;       // 線幅の倍率（1 = 和田研の幅のまま）
  float minHalfWidth = 0.8f;    // 線の半分の幅の下限（px）。小さく描いても消えないように
  bool showPoints = false;      // 長さのない線（始まる前・消えたあとの 1 点に縮んだ線）を点として描くか。
                                // false のとき、JavaScript 版と同じく描かない。true にすると、線が生まれて消える点が見える
};

// 文字（UTF-8 の 1 文字）から、データの中の番号を引く。ないときは -1
inline int find(const Font& f, const char* utf8) {
  uint8_t c = (uint8_t)utf8[0];
  int k = c < 0x80 ? 1 : c < 0xE0 ? 2 : c < 0xF0 ? 3 : 4;
  for (int i = 0; i < f.nglyphs; i++)
    if (strncmp(f.glyphs[i].ch, utf8, k) == 0 && f.glyphs[i].ch[k] == 0) return i;
  return -1;
}
// UTF-8 の文字列を、文字の番号の並びにする（ないものは飛ばす）。戻り値は並べた数
inline int parse(const Font& f, const char* text, int* out, int maxN) {
  int n = 0;
  for (int i = 0; text[i] && n < maxN;) {
    uint8_t c = (uint8_t)text[i];
    int k = c < 0x80 ? 1 : c < 0xE0 ? 2 : c < 0xF0 ? 3 : 4;
    int g = find(f, text + i);
    if (g >= 0) out[n++] = g;
    i += k;
  }
  return n;
}

// 1 文字を描く。progress：0 = 始まり、1 = 完成（逆にたどると消える動き）。(cx, cy) = 文字の中心、angle = 回す角度（ラジアン、時計回り）
template <class GFX, class Color>
void drawGlyph(GFX& g, const Font& f, int glyph, float progress, float cx, float cy, float angle, Color color, const Style& st = Style()) {
  if (glyph < 0 || glyph >= f.nglyphs) return;
  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;
  int step = (int)(progress * f.steps + 0.5f);
  const Frame& fr = f.frames[f.glyphs[glyph].f0 + step];
  float s = st.size / 255.0f, ca = cosf(angle), sa = sinf(angle);
  auto tx = [&](const uint8_t* q, float& x, float& y) {
    float lx = (q[0] - 127.5f) * s, ly = (q[1] - 127.5f) * s;     // 文字の中心を原点に
    x = cx + lx * ca - ly * sa;
    y = cy + lx * sa + ly * ca;
  };
  for (int k = 0; k < fr.n; k++) {
    const Stroke& sk = f.strokes[fr.s0 + k];
    if (sk.kind == 1) {                                           // 点（濁点など）
      float x, y; tx(f.pts[sk.p0], x, y);
      float r = sk.w4 / 4.0f * s;
      g.fillCircle((int)x, (int)y, (int)(r < 1 ? 1 : r + 0.5f), color);
      continue;
    }
    float r = sk.w4 / 4.0f * s * 0.5f * st.lineScale;
    if (r < st.minHalfWidth) r = st.minHalfWidth;
    int ir = (int)(r + 0.5f);
    if (sk.n == 1) {                                              // 長さのない線
      if (st.showPoints) { float x, y; tx(f.pts[sk.p0], x, y); g.fillCircle((int)x, (int)y, ir, color); }
      continue;
    }
    float x0, y0; tx(f.pts[sk.p0], x0, y0);
    g.fillCircle((int)x0, (int)y0, ir, color);                    // 端は丸く
    for (int i = 1; i < sk.n; i++) {
      float x1, y1; tx(f.pts[sk.p0 + i], x1, y1);
      float dx = x1 - x0, dy = y1 - y0, len = sqrtf(dx * dx + dy * dy);
      if (len > 0.5f) {
        float ox = -dy / len * r, oy = dx / len * r;
        int ax = (int)(x0 + ox), ay = (int)(y0 + oy), bx = (int)(x0 - ox), by = (int)(y0 - oy);
        int cx2 = (int)(x1 + ox), cy2 = (int)(y1 + oy), dx2 = (int)(x1 - ox), dy2 = (int)(y1 - oy);
        g.fillTriangle(ax, ay, bx, by, cx2, cy2, color);
        g.fillTriangle(bx, by, dx2, dy2, cx2, cy2, color);
        if (ir >= 2 || i == sk.n - 1) g.fillCircle((int)x1, (int)y1, ir, color);   // つなぎ目と終わりの端
      }
      x0 = x1; y0 = y1;
    }
  }
}

}  // namespace wadalab
