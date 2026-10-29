# config

環境変数から型の付いた設定 record を読む．読む変数の名前は record の `Shape`（x/shape）から決め，値は x/dynamic の `Decode.from_dynamic_all` で読む．

```emela
import Std.Platform.{Platform}
import Config
import Config.DotEnv.{DotEnv}
import Redacted.{Redacted}

type AppConfig(port: Int, debug: Bool, database_url: Redacted[String], log_level: Option[String])

# impl AppConfig: Shaped と impl AppConfig: Decode は手で書く（test/config_test.emel）

with Platform {
  with DotEnv(path: ".env") {
    config: AppConfig = Config.load("APP_") # fails ConfigError
    serve(config)
  }
}
```

## 変数の名前

- `Std.Env` には `get(name)` しかなく，一覧が取れない．そこで record のフィールド名から読む名前を決める
- フィールド名を大文字にし，prefix を前に付ける．`database_url` は `APP_DATABASE_URL`．prefix は `""` でもよい
- `Config.variables(shape, prefix)` で読む名前の list が取れる

## 値の読み方

環境変数は文字列でしか届かないので，フィールドの型に合わせて `Dynamic` に直してから `Decode` に渡す．

| フィールドの型 | 受け付ける値 |
|---|---|
| `Int`，`Int64`，`Float` | JSON の数の書き方．前後の空白は無視する |
| `Bool` | `true` `1` `yes` `on`，`false` `0` `no` `off`（大文字小文字を問わない） |
| `String` | そのまま |
| `List[A]` | `,` で区切った各部分（前後の空白を除く）を `A` として読む |
| `Option[A]` | 未設定なら `None`，あれば `A` として読む |

- 空の値（`APP_LOG_LEVEL=`）は未設定と同じに扱う
- 未設定の `List` は空の list．それ以外の `Option` でないフィールドが未設定なら誤り
- 直せない値は文字列のまま `Decode` に渡し，`Decode` がそのフィールドの誤りとして返す
- record，enum，`Map` のフィールドは 1 つの変数から読めない．`Decode` が誤りを返す

## 誤り

`load` は誤りを全部集めて 1 つの `ConfigError(problems)` で返す．`Problem` は変数名と説明を持つ．

```
APP_PORT: expected number, found text; APP_DATABASE_URL: is not set
```

- 説明に変数の値は入れない．秘密値を `Redacted[String]`（x/redacted）で受けても，誤りのメッセージから値が漏れない
- 値を入れないのは秘密のフィールドに限らない．フィールドが秘密かどうかを Shape から判別する手段がなく，全フィールドで値を出さない方が単純で安全なため
- record でない型で `load` を呼ぶと panic する．環境の誤りでなく，プログラムの誤りなので

## 秘密値

`Redacted[String]` のフィールドは，`Shaped` では中の `String` として書き，`Decode` では読んだ文字列を `Redacted.make` で包む．`Redacted` は `Show` で `<redacted>` と出るので，設定 record をログに出しても値は出ない．

x/redacted にはまだ `Shaped` と `Decode` の impl がない．impl は型か trait を定義したモジュールにしか書けない（E0331）ので，入れるなら x/redacted が x/shape と x/dynamic に依存する形になる．今は record の impl で手で包む．

## .env

`DotEnv(path)` は `.env` を読んで `Env` を提供する handler．`with` に入るときに `FileSystem.read_text` で 1 回だけ読む．

- 外側の `Env` にある変数を優先し，`.env` はそこにない変数だけを埋める
- 外側の `Env` は外側の `with` から取る．同じ `with` に並べた `Env` は見えないので，`with Platform { with DotEnv(path: ".env") { ... } }` と入れ子にする
- ファイルがなければ空として扱う．本番で `.env` を置かずに同じプログラムを動かせる
- `DotEnv.parse(path, text)` で中身だけを読める

書き方：

- 1 行に `KEY=VALUE`．空行と `#` で始まる行は飛ばし，key の前の `export ` は捨てる
- 引用符のない値は前後の空白を除き，空白の後の `#` からはコメント
- `"..."` の中では `\n` `\r` `\t` `\"` `\\` を読む．`'...'` は書いたまま．閉じた引用符の後にはコメントだけを書ける．引用符の値は 1 行に収める
- 同じ key が 2 回あれば後の値．`${NAME}` は展開しない

読めない行は `DotEnvError(path, line, reason)` になる．行番号は出すが，行の中身は出さない（秘密値が入っていることがあるため）．

## .env.example

`Config.example(shape, prefix)` は，各変数に型と `description` の注記を書いた `.env.example` の中身を返す．`Option` の変数はコメントアウトしておく．

```
# Int: the port to listen on
APP_PORT=
# String (optional)
# APP_LOG_LEVEL=
```

## テスト

`TestEnv(vars)` は決まった変数だけを返す `Env`．

```emela
with TestEnv(vars: [("APP_PORT", "8080")]) { Config.load("APP_") }
```

## 文字列を型に合わせて直す処理を x/config に置く理由

quince もクエリ文字列とパスの値を Shape に合わせて `Dynamic` に直している（`quince/src/input.emel`）．共通にできるかを考えたが，x/config に置いた．

- x/dynamic には置けない．この処理は `Shape` を読むが，x/shape が x/dynamic に依存しているので，x/dynamic から x/shape を読むと依存が循環する
- Shape に依存しない部分（数と真偽値の読み方）だけを x/dynamic に出すと，10 行ほどの関数しか残らない
- 受け付ける書き方が違う．環境変数では `1` `yes` `on` も真にし，`List` は `,` 区切りで読む．quince は `true` と `false` だけを読み，`List` は同じ名前の繰り返しから作る
- 共通にする必要が出たら，置き場所は x/dynamic でなく，Shape を定義している x/shape になる

## 今後

- ネストした record．`DATABASE__HOST` のように区切りを決めて，フィールドの record を読む
- `Map` のフィールド（`APP_LABELS_*` のように prefix で集める）．今の `Env` は一覧を取れないので，`Env` 側の変更が要る
- x/redacted の `Shaped` と `Decode` の impl
- `.env` の複数行の値と変数の展開

## 依存して使う

```sh
emela pome add github:emela-lang/x/config
```
