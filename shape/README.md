# shape

型の形（フィールド，variant，中の型）を，値なしで取り出す．`Dynamic` が 1 つの値の中身なのに対して，`Shape` はその型のすべての値を説明する．JSON Schema，OpenAPI，ルーターの照合を，値が届く前に組み立てられる．

```emela
import Shape.{Shape, Shaped, Field, Record}

type MemberPath(team_id: String, member_id: String)

impl MemberPath: Shaped {
  fn shape_in(proxy, visiting) {
    Shape.visit("MemberPath", visiting, fn(visiting) {
      team: Option[String] = None
      member: Option[String] = None
      Record(
        name: "MemberPath",
        fields: [
          Field(name: "team_id", shape: Shaped.shape_in(team, visiting)),
          Field(name: "member_id", shape: Shaped.shape_in(member, visiting)),
        ],
      )
    })
  }
}

fn show_member(path: MemberPath) -> String { path.member_id }

Shape.field_names(Shape.of_parameter(show_member)) # ["team_id", "member_id"]
```

## 仕組み

- `Shaped.shape(proxy: Option[Self])` の `proxy` は型を運ぶだけ．trait の関数は引数の型から impl を選び，呼び出しで型引数を書く構文がないので，`p: Option[User] = None` を渡す．`of_value` と `of_parameter` はこれを隠す
- `Bool`，`Int`，`Int64`，`Float`，`String`，`Dynamic`，`List`，`Option`，`Map` の impl はここにある
- 自分の型の impl は今は手で書く．compiler が導出できるのは Eq，Ord，Show だけなので，`derive Shaped` は std に入るときの proposal で足す
- impl は `shape_in(proxy, visiting)` を書く．`visiting` は今読んでいる途中の record と enum の名前で，record と enum の impl は `Shape.visit(name, visiting, ...)` で包む．すでに読んでいる途中の型は `Ref(name)` になるので，自分を含む型（`Tree`）も互いに参照する型（`Team` と `Member`）も止まる．`Shaped.shape(proxy)` は `visiting` を空にして呼ぶ
- 型パラメータを持つ型の名前には型引数を入れる．`Shape.generic_name("Page", [Shaped.shape(item)])` は `"Page[Member]"`．`Page[Member]` と `Page[Team]` が別の名前になるので，JSON Schema の `$defs` でもぶつからない
- 作る関数で中身を確かめている opaque type は，`Named(name: "Quantity", shape: ...)` で名前と中身の形を出す．JSON Schema では `$defs` に 1 回だけ定義される
- 確かめられる条件（範囲，長さ，個数）は `Shape.Rule` で書く（下）．確かめられない注記は関数で付ける：`description`，`pattern`，`format`．それ以外のキーは `annotate` で付け，読む側は知らないキーをそのまま通す
- variant の名前は `Dynamic` の variant（`Bool`，`Text` など）と重ならないようにしてある．両方を 1 つのモジュールに import できる
- パッケージを `shaped` にしなかったのは，モジュール `Shaped` と trait `Shaped` が `.` の左でぶつかる（E0218）ため

## Rule

`Shape.Rule` は，値の条件と，それを外に向けて説明する注記を 1 つの値にまとめる．作る関数と Shape が同じ list を読むので，確かめていることと JSON Schema に書かれることがずれない．

```emela
import Shape.{Shaped, Named, IntShape}
import Shape.Rule.{Rule}

const QUANTITY: List[Rule[Int]] = [Rule.at_least(1), Rule.at_most(99)]

pub opaque type Quantity(value: Int)

pub error InvalidQuantity(given: Int, reason: String)

pub fn from_int(n: Int) -> Quantity fails InvalidQuantity {
  Quantity(value: Rule.check_or(n, QUANTITY, fn(rule) {
    InvalidQuantity(given: n, reason: Rule.message(rule))
  }))
}

impl Quantity: Shaped {
  fn shape_in(proxy, visiting) { Named(name: "Quantity", shape: IntShape |> Rule.annotate(QUANTITY)) }
}
```

- 条件：`at_least`，`at_most`（Int），`min_length`，`max_length`（String，code point で数える．JSON Schema の数え方と同じ），`min_items`，`max_items`（List），`custom`
- `custom(message, holds)` は自分の条件．注記は付かないので，外に伝えるなら `description` を書く．`holds` は純粋な関数に限る
- `Rule` は opaque．条件と注記を別々に組み立てられないようにするため
- 破ったときの扱いは呼ぶ側が選ぶ

| 関数 | 調べる範囲 | 失敗の形 |
|---|---|---|
| `broken(value, rules)` | 全部 | 失敗しない．破った Rule の list を返す |
| `check(value, rules)` | 最初の 1 つ | `Broken(message)` |
| `check_all(value, rules)` | 全部 | `AllBroken(messages)` |
| `check_or(value, rules, to_error)` | 最初の 1 つ | `to_error(rule)` の error |
| `check_all_or(value, rules, to_error)` | 全部 | `to_error(rules)` の error |

- 正規表現がないので，`pattern` と `format` は Rule にできない．説明だけの注記として残る

## JSON Schema

`Shape.JsonSchema.document(shape)` は，その型に x/dynamic の `Decode` が受け付ける JSON の schema（draft 2020-12）を `Dynamic` で返す．x/json の `Json.to_string` でそのまま書き出せる．

```emela
import Shape.JsonSchema

Json.to_string(JsonSchema.document(Shape.of_parameter(show_member)))
# {"$defs":{"MemberPath":{...}},"$ref":"#/$defs/MemberPath","$schema":"https://json-schema.org/draft/2020-12/schema"}
```

- record と enum は名前で `$defs` に入れ，`$ref` で指す．`Ref` もそこに解決される
- `Option` のフィールドは `required` に入れない．x/dynamic の `field` が欠けたキーを null として読むため
- enum は `"tag"` に variant 名，`"value"` に中身（名前付きは object，位置は長さの決まった array，中身なしは置かない）
- 注記は schema のキーワードになる（`min_length` は `minLength`，`min_items` は `minItems`）．x/shape の語彙にないキーはそのまま書く
- `$defs` の名前（`Page[Member]`）は，`$ref` の中では JSON Pointer として `~` と `/` をエスケープし，URI の fragment に置けない文字を percent-encode する（`#/$defs/Page%5BMember%5D`）
- `Encode` が書き出すものは schema を満たす．例外は NaN と ±Infinity の Float で，null として書かれる
