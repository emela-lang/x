# platform-cloudflare

Emela のアプリを Cloudflare Workers で動かす試作．JS ターゲットの出力をそのまま Worker にする．

```emela
import Cloudflare.Platform.{CloudflarePlatform}
import Std.Http
import Std.Http.Request.{Request}
import Std.Http.Response.{Response}

@entry(Http.serve)
pub fn app(request: Request) -> Response {
  with CloudflarePlatform { route(request) }
}

fn route(request: Request) -> Response use { Console, Env, Kv } { ... }
```

## 動かす

```sh
npx wrangler d1 migrations apply DB --local   # sample の notes の table を作る
npx wrangler dev      # build.command で worker/build.sh が走る
npx wrangler deploy   # wrangler.toml の KV と D1 の id を本物に替えてから
```

`emela` は 0.25.0 以降を PATH に置く（`@entry(Http.serve)` が 0.25.0 から）．

## 仕組み

- HTTP サービスの入口は std の `Http.serve`（emela の仕様 `[lib.http-service]`）．`@entry(Http.serve)` を付けた fn は，JS では `main.mjs` の default export の `fetch` になり，`wrangler.toml` の `main` はそれを直に指す
- Workers はリクエストごとに `fetch` を呼び，Emela 側もリクエスト1件を始めから終わりまで走らせる．405，400，500 の応答，送れない Response の判定，error と defect のログは `Http.serve` がやる
- この Pome が持つのは Cloudflare 固有の handler と layer だけ．アプリは `@entry` の fn の中で `with CloudflarePlatform { ... }` を開く
- `CloudflarePlatform` は `Std.Platform` から SystemFileSystem と SystemEnv（`process.env`）を抜き，CloudflareEnv（`[vars]` とシークレット），`CloudflareKv(binding: "KV")`，`CloudflareD1(binding: "DB")` を足した layer．別の名前の KV や D1 を使うときは layer の後ろに並べる（`with CloudflarePlatform, CloudflareKv(binding: "SESSIONS") { ... }`）
- `Kv` effect は x/kv に，`Sql` effect は x/sql にある．アプリと usecase はそれらだけに依存し，テストでは `TestKv`，`TestSql` を使う．Cloudflare を知るのは `@entry` の fn だけになる
- D1 には途中に処理を挟む transaction がないので，`CloudflareD1` は x/sql の `Transaction` を実装しない．`Sql.transaction` を使う関数と組み合わせると compile error になる．まとめて効かせたい文は `batch` で流す
- バインディングは `import { env } from "cloudflare:workers"` で読む．`fetch` の引数の `env` は Emela に届かないが，これで足りる

## 依存して使う

Pome `github.com/emela-lang/x/platform-cloudflare`（ルート名 `Cloudflare`）．JS 専用で，`@external` を使うので，アプリの `Pome.toml` で許す．

```sh
emela pome add github:emela-lang/x/platform-cloudflare
emela pome add github:emela-lang/x/kv    # `Kv` を import するアプリと usecase に
emela pome add github:emela-lang/x/sql   # `Sql` を import するアプリと usecase に
```

```toml
[external]
allow = ["github.com/emela-lang/x/platform-cloudflare"]
```

`worker/build.sh` と `wrangler.toml` はアプリ側に写して使う．

## 構成

| パス | 中身 |
|---|---|
| `src/platform.emel` | `Cloudflare.Platform`．CloudflareEnv と CloudflarePlatform |
| `src/workers_kv.emel` | `Cloudflare.WorkersKv`．x/kv の `Kv` を Workers KV で実装する CloudflareKv |
| `src/d1_database.emel` | `Cloudflare.D1Database`．x/sql の `Sql` を D1 で実装する CloudflareD1 |
| `migrations/` | sample の D1 の table |
| `src/main.emel` | サンプル（KV で訪問を数え，D1 にメモを置く）．依存されたときは使われない |
| `worker/build.sh` | `emela build`（外部関数のファイルは出力先に写され，相対パスで import される） |

## 回避していること（コンパイラ側の課題）

- KV の失敗は defect になる（error にしていない）．D1 の失敗は `SqlError` になる
- D1 との間は JSON の文字列でやり取りする．数は JavaScript の number を通るので，2^53 を超える整数は桁を失う
