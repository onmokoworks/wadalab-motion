# wadalab-motion

入力した文字が、線を畳んだ状態から開いていく試打サイトです。和田研フォントの文字データを使い、ブラウザ上でSVGのパスを動かします。

## 起動

Node.jsを用意して、次のコマンドを実行します。

```sh
node server.mjs
```

[http://127.0.0.1:4184/](http://127.0.0.1:4184/)を開いて入力します。Windowsでは`START.cmd`からも起動できます。時計は`/clock`にあります。

## 構成

`web/`に画面とアニメーション、`engine/`に和田研の原典と変換処理、`source-audit/`に検証資料を置いています。実装の詳細は[実装記録](docs/implementation.md)を参照してください。

## ライセンス

和田研の原典と同梱フォントの利用条件は、[原典のライセンス](web/SOURCE-LICENSE.txt)と[フォントのライセンス](web/font/LICENSE.txt)を参照してください。
