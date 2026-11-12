// 例：丸液晶で、文字列を丸の縁に沿って 3 重の輪に並べて回し、各文字の線を波に合わせて展開・畳みする。
// 文字のデータ（wadalab_frames.h）は、リポジトリのいちばん上で次のように作る：
//   node esp32/gen_frames.mjs "テストぐるぐる和田研フォントモーションライブラリ" esp32/WadalabMotion/examples/RingText/wadalab_frames.h
// 必要なライブラリ：LovyanGFX。ESP32-C3 で約 21fps。
#include "display.h"
#include <WadalabMotion.h>
#include "wadalab_frames.h"

LGFX lcd;
LGFX_Sprite canvas(&lcd);            // 画面 1 枚ぶんを裏で描いてから一度に送る（ちらつかない）

// 輪：外から順に（文字列、半径、文字の大きさ、くり返す回数、回る速さ 度/秒：− は逆回り）
struct Ring { const char* text; float r, size; int repeat; float spin; };
const Ring RINGS[] = {
  {"テストぐるぐる", 90, 38, 2, 14},
  {"和田研フォントモーションライブラリ", 60, 22, 1, -20},
  {"テストぐるぐる", 34, 19, 1, 28},
};
const int NRINGS = sizeof(RINGS) / sizeof(RINGS[0]);
const float WAVE = 0.22f;            // 展開の波が輪を回る速さ（周/秒）
const float SOFT = 0.7f;             // 展開と畳みが切り替わる幅（小さいほど、すばやく出入りする）

int glyphs[NRINGS][64], counts[NRINGS];
wadalab::Style style;

float ease(float u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); }

void setup() {
  lcd.init(); lcd.fillScreen(TFT_BLACK);
  canvas.setColorDepth(16); canvas.createSprite(240, 240);
  style.lineScale = 0.85f;
  style.showPoints = true;           // 線が生まれて消える点を見せる（false で JavaScript 版と同じく見せない）
  for (int k = 0; k < NRINGS; k++) {
    int one[64]; int n = wadalab::parse(WADALAB_FONT, RINGS[k].text, one, 64);
    counts[k] = 0;
    for (int r = 0; r < RINGS[k].repeat; r++) for (int i = 0; i < n && counts[k] < 64; i++) glyphs[k][counts[k]++] = one[i];
  }
}

void loop() {
  float t = millis() / 1000.0f;
  canvas.fillScreen(TFT_BLACK);
  for (int k = 0; k < NRINGS; k++) {
    const Ring& R = RINGS[k];
    style.size = R.size;
    int n = counts[k];
    for (int i = 0; i < n; i++) {
      float a = t * R.spin * DEG_TO_RAD + i * 2 * PI / n;      // 輪の上の位置（0 = 右、時計回り）
      float x = 120 + cosf(a) * R.r, y = 120 + sinf(a) * R.r;
      // 展開の波：輪を回る山にいる文字ほど展開している（0 = 畳まれた線、1 = 完成した字）。輪ごとに波を少しずらす
      float w = 0.5f + 0.5f * cosf(2 * PI * (t * WAVE + k * 0.17f) - (float)i / n * 2 * PI);
      float p = ease((w - (1 - SOFT) / 2) / SOFT);
      wadalab::drawGlyph(canvas, WADALAB_FONT, glyphs[k][i], p, x, y, a + PI / 2, (uint16_t)TFT_WHITE, style);   // 文字の上が輪の外を向く
    }
  }
  canvas.pushSprite(0, 0);
}
