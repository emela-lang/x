# rule

`Rule` は，値の条件と，それを外に向けて説明する注記を 1 つの値にまとめる．作る関数と Shape が同じ list を読むので，確かめていることと JSON Schema に書かれることがずれない．

```emela
import Std.Shape
import Std.Shape.{Shaped, Named}
import Rule
import Rule.{Rule}

const QUANTITY: List[Rule[Int]] = [Rule.at_least(1), Rule.at_most(99)]

pub opaque type Quantity(value: Int)

pub error InvalidQuantity(given: Int, reason: String)

pub fn from_int(n: Int) -> Quantity fails InvalidQuantity {
  Quantity(value: Rule.check_or(n, QUANTITY, |rule| {
    InvalidQuantity(given: n, reason: Rule.message(rule))
  }))
}

impl Quantity: Shaped {
  fn shape_in(proxy, visiting) { Named(name: "Quantity", shape: Shape.Int |> Rule.annotate(QUANTITY)) }
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

`x/shape` の `Shape.Rule` から分けた（v0.4 まで）．`import Shape.Rule` と `import Shape.Rule.{...}` は `import Rule` と `import Rule.{...}` に書き換える．`Shape`，`Shaped` と注記の関数は `Std.Shape` にある．
