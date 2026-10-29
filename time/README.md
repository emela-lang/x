# time

暦の日付，時刻，UTC からのオフセットと，それを RFC 3339 と ISO 8601 の文字列に読み書きする関数．時間軸上の一点は Std の `Instant`，時間の長さは Std の `Duration` をそのまま使う．

```emela
import Std.Clock.{Clock}
import Time
import Time.Date.{Date}
import Time.Offset

fn stamp() -> String use { Clock } {
  jst = Offset.from_hours(9).or(Offset.utc())
  Time.now(jst).to_string() # "2026-10-29T09:00:00.000+09:00"
}

fn due(s: String) -> Date fails ParseError {
  Date.parse(s).add_months(1) # "2026-01-31" なら 2026-02-28
}
```

| モジュール | 型 | 表すもの |
|---|---|---|
| `Time.Date` | `Date`，`Weekday` | どのタイムゾーンでも同じ日（誕生日，祝日，期限日）．時間軸上の点ではない |
| `Time.TimeOfDay` | `TimeOfDay` | 00:00:00.000 から 23:59:59.999 までの時計の時刻 |
| `Time.DateTime` | `DateTime(date, time)` | タイムゾーンのない日付と時刻．どこかの壁時計が示す値 |
| `Time.Offset` | `Offset` | UTC からの固定の差（`+09:00`，`Z`） |
| `Time.OffsetDateTime` | `OffsetDateTime(local, offset)` | RFC 3339 の日時．`Instant` と損失なく相互に変換できる |
| `Time` | | `now`，`today`，`parse_instant`，`days`，`parse_duration`，`duration_to_string` |

## 仕組み

- 時間軸上の点は `Std.Instant`，長さは `Std.Duration` で，このパッケージは自前の Instant と Duration を作らない．Clock の `now` が返すのも，x/uuid の `timestamp` が返すのも `Std.Instant` なので，変換を挟まずにここの関数へ渡せる．Unix ミリ秒との相互変換は `Instant.from_unix_milliseconds` と `Instant.to_unix_milliseconds` が持っている（仕様 15.4 の「同じ変換を2つの型に置かない」に従う）
- 現在時刻は Std の Clock から取る．`Time.now(offset)` と `Time.today(offset)` は `use { Clock }` で，新しい effect は増やさない．テストでは TestClock に時刻を渡して固定する（`test/time_test.emel`）
- 精度はミリ秒で，閏秒は数えない．Instant がそう決まっているため．`23:59:60` はパースで失敗する．小数秒の 4 桁目以降は切り捨てる
- 暦は先発グレゴリオ暦で，`Instant.to_string` と同じ数え方をする．年 0 は紀元前 1 年．0 から 9999 の外の年は符号と 6 桁で書く（`+010000-01-01`，`-000001-12-31`）
- `to_string` はミリ秒を常に 3 桁書く（`09:05:00.000`）．どの値も同じ幅になり，文字列のまま並べても時刻の順になる．UTC の `OffsetDateTime.to_string` は `Instant.to_string` と同じ文字列を返す
- `parse` が受け付ける形は書き出す形より広い．秒の省略（`09:05`），小数秒の桁数（1 桁以上），日付と時刻の区切りの `t` と空白，`Z` の小文字．`+0900` のようにコロンのない基本形式は受け付けない．`-00:00`（RFC 3339 で「オフセット不明」）は UTC として読む
- 形の誤りと存在しない日（`2026-02-30`）は，どちらも Prelude の `ParseError` で失敗する．`input` は常に入力全体．`from_calendar` や `from_hms` のように数から作る関数は，範囲の外なら `None` を返す
- `DateTime` と `OffsetDateTime` は record なので，`DateTime(date:, time:)` で直接作れる．どの組み合わせも正しい値になるので opaque にしていない
- `OffsetDateTime` の Eq は日時とオフセットの両方で比べる．`09:00+09:00` と `00:00Z` は同じ時点だが等しくない．同じ時点かは `to_instant` どうしを比べる．Ord は時点で比べ，同じ時点なら現地時刻で比べるので，Eq と食い違わない
- `add_months` は月末に寄せる．`2026-01-31` の 1 か月後は `2026-02-28`
- `Time.duration_to_string` は時，分，秒だけで書く（`PT36H`）．Duration は正確な長さで，1 日がいつも 24 時間とは限らず，1 か月の長さも決まらないため．`Time.parse_duration` は `D` を 24 時間として読み，年，月，週（`P1Y`，`P1M`，`P1W`）は失敗する
- Instant と Duration の文字列化と読み込みを，それぞれの型のモジュールでなく `Time` に置いている．仕様 15.4 では `to_string` と `parse` は型のモジュールに置くが，Std のモジュールにはここから関数を足せない．std に取り込むときに `Instant.parse`，`Duration.parse` へ移す

## タイムゾーン

UTC と固定オフセットだけを持ち，IANA の tz データベース（`Asia/Tokyo`，`America/New_York`）は入れていない．

- tz データは年に数回更新される．Pome に埋め込むと，規則が変わるたびに版を上げ，使う側も上げ直さないと古い規則で計算し続ける
- データは数百 KB ある．x/time は純粋な Emela で，JS，C，WASM のどれでも同じ値を返す．ホストの tz（JS の `Intl`，OS の `/usr/share/zoneinfo`）を読むと，Cloudflare Workers や wasmtime のように読めない環境で動かないか，環境で結果が変わる
- ホストの tz を読むなら effect になる．その形は Clock と同じく std の platform 層で決めることなので，ここで先に作らない

入れるときは `ZonedDateTime(local, zone)` を足し，`Offset` はそのまま残す．それまでは atlas の「日時は instant か暦日かで保存形式を分ける」の通り，tz は IANA 名でデータとして持ち，変換はオフセットを確定できる場所（表示層や，tz を扱えるホストの関数）の 1 か所で行う．

## x/uuid と組み合わせる

version 7 の UUID は先頭 48 ビットに Unix ミリ秒を持つ．x/uuid は Clock の `Instant` から作り，`timestamp(u)` で `Some(Instant)` を返すので，ここの関数とは Instant でつながる．

```emela
import Time
import Time.Offset
import Time.OffsetDateTime

# UUID が作られた時刻を RFC 3339 で
Uuid.timestamp(u).map(fn(t) { OffsetDateTime.from_instant(t, Offset.utc()).to_string() })

# RFC 3339 の文字列を Unix ミリ秒に
Time.parse_instant("2025-10-29T00:00:00.123Z").to_unix_milliseconds() # 1761696000123
```
