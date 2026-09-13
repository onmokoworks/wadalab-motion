import json, math, html, hashlib
from pathlib import Path
root=Path('outputs/wadalab-live');out=root/'source-audit'
raw=json.loads((out/'source-glyphs.raw.json').read_text(encoding='utf-8-sig'))
data={'source':'CLWFK','revision':'69883aef69f4762a9b3afceb257044c71377499d','style':'maru','width':8,'pipeline':['get-def','applykanji','normkanji','skeleton2list'],'glyphs':[]}
for ch,definition,expanded,normalized,outline in raw:
 def skel(v):
  return {'points':[{'id':i,'x':p[0],'y':p[1],'attributesLisp':p[2]} for i,p in enumerate(v[0])], 'strokes':[{'id':f's{i}','type':s[0],'pointIds':s[1],'attributesLisp':s[2]} for i,s in enumerate(v[1])],'attributesLisp':v[2]}
 g={'character':ch,'definitionLisp':definition,'expanded':skel(expanded),'normalized':skel(normalized),'generatedOutlines':outline}
 for s in g['normalized']['strokes']:
  assert all(isinstance(i,int) and 0<=i<len(normalized[0]) for i in s['pointIds'])
 for p in normalized[0]: assert math.isfinite(p[0]) and math.isfinite(p[1])
 paths=[]
 for contour in outline:
  if not contour:continue
  d=f'M {contour[0][1]} {contour[0][2]}';i=1
  while i<len(contour):
   p=contour[i];assert math.isfinite(p[1]) and math.isfinite(p[2])
   if p[0]=='angle':d+=f' L {p[1]} {p[2]}';i+=1
   else:
    assert i+1<len(contour)
    d+=' C '+' '.join(str(n) for point in (contour[i:i+2]+[contour[i+2] if i+2<len(contour) else contour[0]]) for n in point[1:3]);i+=3
  paths.append('<path d="'+d+' Z"/>')
 filename=f'u{ord(ch):04x}.svg';g['preview']=filename
 (out/filename).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g fill="#111">'+''.join(paths)+'</g></svg>',encoding='utf-8')
 data['glyphs'].append(g)
(out/'source-glyphs.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
rows='\n'.join('| '+g['character']+' | '+str(len(g['normalized']['points']))+' | '+str(len(g['normalized']['strokes']))+' | '+', '.join(s['type'] for s in g['normalized']['strokes'])+' |' for g in data['glyphs'])
report='''# 和田研フォント：元データと生成処理の確認

今回確認したのは完成画像から推測した骨格ではなく、CLWFKに収録された文字定義と、その生成コードです。元データから7文字を展開し、元の丸ゴシック生成処理を実行しました。現在の比較サイトはまだこの生成処理へ接続していません。

## 確認できたデータ

| 文字 | 正規化後の点数 | 画の数 | 原典の画種 |
|---|---:|---:|---|
'''+rows+'''

- **木**：右払い `migi`、左払い `hidari`、縦画 `tate`、横画 `yoko`。横画の `(LINK 3 0)` と点の `LINK-OK` 属性を確認しました。画像上の交差検出とは異なります。
- **林**：原典で `(YOKO 木へん 木)` という部品合成定義です。展開結果だけを保存すると部品の由来が失われるため、合成式も保持する必要があります。
- **あ**：丸ゴシックではgothic用定義を継承し、14点・3本の `hira-long`。`prim-hira.l` の明朝用定義とは異なります。点列は `tenhokan` で曲線を補間する入力であり、各点が折り畳み用の角という意味ではありません。
- **。**：2点の `hira-circle`。専用関数が内外の円の輪郭を作ります。「孤立点なので少し移動させる」という既存サイトの判断は原典由来ではありません。

## 実際の生成経路

1. `get-def` が書体別定義を親書体まで検索する。
2. `applykanji` が文字・部品の参照や合成式を展開する。
3. `normkanji` が制限領域・単位を利用して配置を正規化する。
4. `skeleton2list` が書体用の前処理を実行する。
5. `setup-linkpoints` が画種・点番号・接続属性を使って各画の肉付けと接続情報を作る。
6. `add-kazari` が接続部や端部を処理し、輪郭を組み立てる。

`maru.l` はgothicを継承し、丸い端部や接続の規則を追加しています。`hiranew.l` にはかなの曲線と円の専用処理があります。単に全経路へSVGのround線端を付けることは、この生成処理の再現ではありません。

## 次の実装で保持するもの

- 原典の文字・部品参照と合成式。
- 点ID、座標、点の属性。
- 画ID、原典の画種、参照する点ID、LINKや幅などの属性。
- 書体ごとの定義の選択と継承。
- アニメーション前の原典骨格と、各時刻の骨格を別に持つ。

その骨格を変形し、画種に対応する生成処理で輪郭を毎回計算して、同じSVG要素へ反映する構成が必要です。元データはアニメーションの関節をあらかじめ指定したものではないため、どの構造を関節として動かすかは原典の曲線・接続の意味を踏まえて設計します。画像抽出や完成パス間の補間を代用しません。

## 実行して確認した範囲

`engine/audit-source.lisp` で、同梱の元生成コードをABCL上で一度実行しました。7文字の元定義・展開骨格・正規化骨格・生成輪郭を `source-glyphs.json` に保存しています。点参照の範囲、有限座標、輪郭のBezier構造をチェックしました。SVGファイルはその原典出力を確認するための静止プレビューで、再生用フレームではありません。

属性は情報を捨てないためLisp表現も保存しています。ただし実行時フックは関数オブジェクトを含む場合があり、このJSONだけで全生成処理を別環境へ移せるわけではありません。生成コードと部品合成処理の移植が必要です。

## 字形の範囲と配布版の違い

元の和田研フォントキットと、後年の「細丸ゴシック2004絵文字」は同じ収録範囲ではありません。後者の配布元は、元の細丸ゴシックをTrueType化し、足りない文字・記号を追加したと説明しています。追加分の生成元スケルトンまで今回確認したとは言えません。未確認文字を画像抽出で埋めて「原典データ対応」とは扱いません。

今回、ブラウザ側の生成処理への移植・全収録文字の生成試験は未実施です。以前の画像由来の比較画面は原典ベースの実装ができた証拠には使いません。

## 出典

- 原配布元：https://www.tanaka.ecc.u-tokyo.ac.jp/ktanaka/Font/
- 固定リビジョンのソース：https://github.com/nmlgc/efont/tree/69883aef69f4762a9b3afceb257044c71377499d/wadalab-fontkit
- 後年の配布版：https://sourceforge.net/p/jis2004/wiki/index/
- 使用した元コード：`engine/clwfk/`。Unicode処理系で読み込むためのコピー：`engine/compatible/`。元コードの著作権・許諾条件は `engine/clwfk/README`。
'''
(out/'audit.md').write_text(report,encoding='utf-8')
body=''.join('<section><h2>'+g['character']+'</h2><img src="'+g['preview']+'" width="240" height="240"><p>'+str(len(g['normalized']['points']))+'点・'+str(len(g['normalized']['strokes']))+'画</p><pre>'+html.escape('\n'.join(s['type']+' '+str(s['pointIds'])+' '+s['attributesLisp'] for s in g['normalized']['strokes']))+'</pre></section>' for g in data['glyphs'])
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>元の和田研生成処理の確認</title><style>body{font:16px sans-serif;margin:24px}main{display:flex;flex-wrap:wrap;gap:32px}pre{font-size:12px;white-space:pre-wrap}section{width:280px}</style><h1>元の和田研生成処理の確認</h1><p>原典の丸ゴシック生成処理を実行した静止確認。画像抽出による骨格ではありません。</p><main>'+body+'</main>',encoding='utf-8')
print('Validated 7 source glyphs, point references, finite coordinates and cubic outline sequences.')

