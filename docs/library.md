# 文字データとモーションAPI

## 読み込み

ローカルのリポジトリを`npm install /path/to/wadalab-motion`で依存関係に追加できます。Node.js 20以降での例です。ブラウザでは同じ4つのJSONを`fetch`で読み込み、`createMotionLibrary`へ渡します。

```js
import {readFile} from 'node:fs/promises';
import {createMotionLibrary} from 'wadalab-motion';

const resources = {
  program: 'wadalab-motion/data/program.json',
  glyphs: 'wadalab-motion/data/glyphs.json',
  ascii: 'wadalab-motion/data/ascii.json',
  alpha: 'wadalab-motion/data/alpha.json',
};
const data = Object.fromEntries(await Promise.all(
  Object.entries(resources).map(async ([key, resource]) => [
    key, JSON.parse(await readFile(new URL(import.meta.resolve(resource)), 'utf8')),
  ]),
));
const motion = createMotionLibrary(data);
const frame = motion.sample('し', 0.5);
```

ライブラリは通信・描画・時刻管理を行いません。`sample`には1文字と有限の進行率を渡します。0より小さい値は0、1より大きい値は1に丸めます。1が完成形で、値を逆順に渡すと消える動きになります。試打サイトの0.75倍速や文字間の開始間隔は、呼び出し側の時間管理です。

`has(character)`で収録を確認できます。未収録文字の`sample`は`null`を返し、代わりのフォントには置き換えません。空白と改行、文字列の配置も呼び出し側で扱います。`characters()`は保存されている文字キーを返します。全角英数字など、`has`が認識する変換先の別名をすべて列挙するものではありません。

## 返り値

返り値はJSONとして保存できます。座標の基準は400、Xは右方向、Yは下方向です。`advance`は同じ座標系での文字送り幅です。文字の原点・ベースライン調整は描画側で行います。

通常は`kind: 'paths'`と`strokes`が返ります。

| 画のkind | データ | 描画方法 |
| --- | --- | --- |
| `line` | `id`, `width`, `points: [{x,y}, ...]` | 一定幅の線。端と接続は丸く描く |
| `dot` | `id`, `center: {x,y}`, `radiusX`, `radiusY` | 不透明な塗りつぶし楕円。半径が0なら描かない |

開始時に重なった点だけになる線は描きません。線の途中で透明度を変更する処理はありません。点は幅を保ち、下端から縦方向へ開きます。

中心線の処理がない字形は`kind: 'outline'`になり、SVG輪郭文字列の`contours`と、0〜1の`reveal`が返ります。この場合は輪郭トリム用の情報です。全文字が中心線で展開するAPIではありません。

## データの出典

| APIのデータ名 | 保存先 | 内容 |
| --- | --- | --- |
| `program` | `web/source-program.json` | CLWFKのマクロ展開済み生成処理 |
| `glyphs` | `web/source-glyphs.json` | CLWFKの文字骨格。Lispのリスト・記号を表すJSON |
| `ascii` | `web/font/ascii-outlines.json` | 同梱TTFから取り出した半角英数字・記号の輪郭命令と送り幅 |
| `alpha` | `web/font/alpha-centerlines.json` | 半角英数字・記号の中心線、線幅、送り幅、点の情報 |

これは共通形式に統一した骨格JSONではありません。公開APIは、異なる原典データを読み込み、現行C5の結果を同じ返り値で取り出す入口です。フォント全体の収録範囲と、このAPIが扱える範囲は一致しません。

## Unityへの移植

Unityでは上の座標を用途に合わせてスケールし、Y方向を反転させます。`line`は線幅・丸い接続を維持するメッシュ、`dot`は楕円、`outline`は輪郭を扱う描画処理が必要です。

進行率ごとのJSONを書き出して読むことはできますが、それはフレームの再生です。Unity上でパスを計算して動かすには、`source-engine.js`、`source-vm.js`、`source-fast.js`、`structure.js`、`fold-core.js`、`alpha-motion.js`の計算処理をC#などへ移植する必要があります。C#版の現行ランタイムはまだありません。`unity/`は旧方式のサンプルです。

## ライセンス

新しく作成したAPIとモーションコードはMITです。CLWFK由来の生成処理・骨格には原典の条件、TTF由来の輪郭・中心線にはフォントの条件が適用されます。データを別環境へ配布するときも、出典と利用条件を一緒に確認してください。`web/SOURCE-LICENSE.txt`、`web/SOURCE-NOTICE.txt`、`engine/clwfk/`の各ヘッダー、`web/font/LICENSE.txt`に原文を保存しています。
