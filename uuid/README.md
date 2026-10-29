# uuid

UUID（RFC 9562）を作り，文字列との間で読み書きする．作れるのは version 4（乱数）と version 7（時刻 + 乱数）．

```emela
import Uuid.{Uuid}

fn new_id() -> String use { Clock, Random } {
  Uuid.v7().to_string()
}

Uuid.parse("0190a5c8-5f3e-7b2d-9c4a-1e2f3a4b5c6d") # fails ParseError if not a UUID
```

## 仕組み

- 乱数は std の `Random`，時刻は std の `Clock` から取る．この Pome は effect を持たない．`x/sql` や `x/kv` が effect を持つのは，database や store がサービスの側にあって handler をそちらに置くため．乱数と時刻は std に effect と handler（`SystemRandom`，`SystemClock`，`TestClock`）が揃っている
- `v4()` は `use { Random }`，`v7()` は `use { Clock, Random }`．テストでは `TestClock` と，決まった値を返す `Random` の handler を渡すと UUID が決まる（`test/uuid_test.emel` の `FixedRandom`）
- `Uuid` は 16 バイトを `Bytes` で持つ opaque type．`Eq` と `Ord` はバイトを符号なしで先頭から比べるので，`v7` で作った UUID は作った時刻の順に並ぶ．同じミリ秒の中では順序は乱数で決まる（RFC 9562 の単調性のカウンタは持たない）
- `parse` が読むのは 8-4-4-4-12 桁をハイフンでつないだ形だけ．大文字も読む．波カッコ，`urn:uuid:`，ハイフンなしの 32 桁，前後の空白は `ParseError` になる．version と variant は確かめず，そのまま読む
- `to_string` と `Show` は小文字で書く
- `version(u)` は version の 4 ビット，`timestamp(u)` は version 7 のときだけ作った時刻を `Some(Instant)` で返す
- `to_bytes` と `from_bytes` で 16 バイトとの間を行き来する．`from_bytes` は長さが 16 でなければ `None`

## 必要な emela

`Std.Bytes` を使うので emela 0.26.0 以降．
