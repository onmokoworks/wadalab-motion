# wadalab-motion

和田研フォントの文字データと、文字の線を展開するモーションのライブラリです。Unityなど、ブラウザ以外の環境へ持ち込んで使うことを目指しています。試打サイトは動きを確認するサンプルです。

[試打サイトを開く](https://onmk.work/workspace/wadalab-motion/)

## ライブラリとして使う

JavaScriptのAPIに文字と進行率を渡すと、その時点のパス座標や点の形が返ります。DOMや描画処理には依存しません。データの読み込み、時間の進行、描画は呼び出し側で行います。

```js
import {createMotionLibrary} from 'wadalab-motion';

const motion = createMotionLibrary({program, glyphs, ascii, alpha});
const frame = motion.sample('あ', 0.5);
```

4つのJSONを読み込み、解析したオブジェクトを渡します。進行率は0が開始、1が完成です。未収録の文字には`null`を返します。[読み込み例と返り値](docs/library.md)を参照してください。npmレジストリには公開していません。

現在のモーション処理はJavaScriptです。Unityで同じ動きを再現するには、計算処理のC#移植も必要です。`unity/`の旧サンプルは、現在のC5モーションに対応していません。

## サンプルの起動

Node.jsを用意して、次のコマンドを実行します。

```sh
node server.mjs
```

[http://127.0.0.1:4184/](http://127.0.0.1:4184/)を開いて入力します。Windowsでは`START.cmd`からも起動できます。時計は`/clock`にあります。

## 構成

`web/motion-library.js`が外部向けAPIです。`web/`に文字データ・計算処理とブラウザサンプル、`engine/`に和田研の原典と変換処理、`source-audit/`に検証資料を置いています。

検証は`npm test`で実行します。`README-history.md`と`README-clwfk.md`は過去の実装の記録です。[実装記録](docs/implementation.md)にも過去の方式についての説明が含まれます。

## ライセンス

本プロジェクトで新たに作成したサイト・アニメーションのコードは[MITライセンス](LICENSE)で公開しています。

和田研の原典、それを移植したコードと文字データ、同梱フォントには、それぞれの利用条件が適用されます。[原典のライセンス](web/SOURCE-LICENSE.txt)、[移植部分の出典](web/SOURCE-NOTICE.txt)、[フォントのライセンス](web/font/LICENSE.txt)を参照してください。
