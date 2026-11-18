# json-schema

`JsonSchema.document(shape)` は，その型に `Std.Dynamic` の `Decode` が受け付ける JSON の schema（draft 2020-12）を `Dynamic` で返す．`Std.Json` の `Json.to_string` でそのまま書き出せる．

```emela
import Std.Json
import Std.Shape
import JsonSchema

Json.to_string(JsonSchema.document(Shape.of_parameter(show_member)))
# {"$defs":{"MemberPath":{...}},"$ref":"#/$defs/MemberPath","$schema":"https://json-schema.org/draft/2020-12/schema"}
```

- record と enum は名前で `$defs` に入れ，`$ref` で指す．`Ref` もそこに解決される
- `Option` のフィールドは `required` に入れない．`Std.Dynamic` の `Decode.from_absent` が欠けたキーを `None` として読むため
- enum は `"tag"` に variant 名，`"value"` に中身（名前付きは object，位置は長さの決まった array，中身なしは置かない）
- 注記は schema のキーワードになる（`min_length` は `minLength`，`min_items` は `minItems`）．`Std.Shape` の語彙にないキーはそのまま書く
- `$defs` の名前（`Page[Member]`）は，`$ref` の中では JSON Pointer として `~` と `/` をエスケープし，URI の fragment に置けない文字を percent-encode する（`#/$defs/Page%5BMember%5D`）
- `Bytes` は base64 の文字列（`Std.Json` が Binary をそう書く）．`Bytes` の `Decode` は Binary しか読まないので，parse した JSON からは読み戻せない
- `Encode` が書き出すものは schema を満たす．例外は NaN と ±Infinity の Float で，null として書かれる

`x/shape` の `Shape.JsonSchema` から分けた（v0.4 まで）．`import Shape.JsonSchema` は `import JsonSchema` に書き換える．v0.4 から `Std.Shape.Shape` に `Bytes` が増え，base64 の文字列にした．
