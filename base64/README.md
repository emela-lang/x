# base64

`Std.Bytes` の `Bytes` と RFC 4648 の Base64 の文字列を相互に変換する．標準のアルファベット（§4，`+` と `/`）と，URL とファイル名に使えるアルファベット（§5，`-` と `_`）を持つ．

```emela
import Std.Bytes.{Bytes}
import Base64
import Base64.{Base64Error}

Base64.encode(Bytes.encode_utf8("hi?"))     # "aGk/"
Base64.encode_url(Bytes.encode_utf8("hi?")) # "aGk_"

fn read(s: String) -> Bytes fails Base64Error {
  Base64.decode(s)
}
```

| 関数 | アルファベット | padding |
|---|---|---|
| `encode(b: Bytes) -> String` | 標準 | 付ける |
| `decode(s: String) -> Bytes fails Base64Error` | 標準 | 要る |
| `encode_url(b: Bytes) -> String` | URL | 付けない |
| `decode_url(s: String) -> Bytes fails Base64Error` | URL | あってもなくてもよい．あるなら 4 文字の倍数まで埋まっていること |

## 仕組み

- decode は厳格に読む．1 つの Bytes を表す文字列が 1 つに決まるようにするため．次のものは `Base64Error` で失敗する
  - 空白と改行（MIME のように 76 文字で折り返したものも読まない）
  - アルファベットの外の文字．標準の `decode` は `-` と `_` を，`decode_url` は `+` と `/` を読まない
  - padding の位置と数の誤り（`Zg=`，`Z===`，padding の後に続く文字）
  - 最後の文字の使われないビットが 0 でないもの（`Zh==`，RFC 4648 §3.5）
- `Base64Error(message, offset)` の `offset` は入力の先頭からのコードポイントの数で，x/json の `SyntaxError` と同じ形にしている
- 純粋な Emela で書いていて，host に依存しない．どの target でも同じ結果になる
