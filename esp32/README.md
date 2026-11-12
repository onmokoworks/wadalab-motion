# ESP32 で再生する

wadalab-motion の文字の動きを、ESP32 につないだ液晶で再生するための Arduino ライブラリです。動きの計算はパソコンで済ませておき、ESP32 は書き出した線と点を描くだけにします。ESP32-C3 と丸液晶 GC9A01 で、1 画面に 35 文字ほどを約 21fps で動かせます。

## 使い方

1. 使う文字の動きを書き出します。リポジトリのいちばん上で、次のように実行します（Node.js 20 以降）。

   ```sh
   node esp32/gen_frames.mjs "使う文字をぜんぶ" 出力先/wadalab_frames.h 40
   ```

   最後の数は、進行率 0〜1 を何段に分けるかです。多いほどなめらかで、データが大きくなります。1 文字・40 段で 3〜4KB ほどです。

2. `esp32/WadalabMotion` を Arduino のライブラリのフォルダ（`~/Documents/Arduino/libraries/`）へコピーするか、`arduino-cli compile --library esp32/WadalabMotion` で指定します。

3. スケッチで読み込み、1 文字ずつ描きます。

   ```cpp
   #include <WadalabMotion.h>
   #include "wadalab_frames.h"

   wadalab::Style style;                 // 大きさ・線幅・点の表示
   style.size = 40;
   int g = wadalab::find(WADALAB_FONT, "あ");
   wadalab::drawGlyph(canvas, WADALAB_FONT, g, progress, x, y, angle, color, style);
   ```

   `progress` は 0 が始まり、1 が完成です。`angle` は回す角度（ラジアン、時計回り）です。描画先は `fillTriangle` と `fillCircle` を持つもの（LovyanGFX の `LGFX_Sprite`、Adafruit_GFX の `GFXcanvas16` など）です。

## Style

| 項目 | 初期値 | 内容 |
| --- | --- | --- |
| `size` | 40 | 文字の大きさ（px） |
| `lineScale` | 1.0 | 線幅の倍率。1 で和田研の幅のまま |
| `minHalfWidth` | 0.8 | 線の半分の幅の下限（px）。小さく描いても消えないように |
| `showPoints` | false | 長さのない線を点として描くか。`true` にすると、線が生まれる前と消えたあとの点が見えます。`false` は JavaScript 版と同じく描きません |

## 例

`examples/RingText` は、丸液晶 GC9A01 に文字列を 3 重の輪に並べて回し、各文字を波に合わせて展開・畳みします。点は出しません（`showPoints = false`）。液晶の設定とピンは `display.h` にあります。LovyanGFX が必要です。

## 速さについて

- 太線は、三角形 2 枚の四角形と、つなぎ目の丸で描きます。LovyanGFX のなめらかな太線（`drawWideLine`）は浮動小数点の計算が多く、浮動小数点の回路がない ESP32-C3 では 4fps まで落ちました。この方式では縁がなめらかにならない代わりに、20〜30fps 出ます。
- 画面 1 枚ぶんのスプライトに描いてから送ります。GC9A01 では SPI を 80MHz にしています。乱れるときは 40MHz に下げます。

## 違い

- `kind: 'outline'`（中心線がなく輪郭だけの文字）は書き出しません。`gen_frames.mjs` が「入れなかった文字」として表示します。例外として「ー」だけは、真ん中から左右へ伸びる 1 本の線として書き出します。
- 座標は 400 単位を 0〜255 にまるめています。小さい液晶では見分けがつきません。

## ライセンス

このフォルダのコードは MIT です。書き出した `wadalab_frames.h` は和田研の原典に由来するデータなので、`web/SOURCE-LICENSE.txt` と `web/SOURCE-NOTICE.txt` の条件に従います。
