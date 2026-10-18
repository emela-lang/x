# platform-cloudflare

Emela（0.20）のアプリを Cloudflare Workers で動かす試作．JS ターゲットの出力をそのまま Worker にする．

```emela
import Cloudflare.Worker.{Incoming, Outgoing}
import Std.Http.{Request, Response}

pub fn fetch(incoming: Incoming) -> Outgoing {
  Worker.serve(incoming, handle)
}

fn handle(req: Request) -> Response use { Console, Kv } { ... }
```

## 動かす

```sh
npx wrangler dev      # build.command で worker/build.sh が走る
npx wrangler deploy   # wrangler.toml の KV の id を本物に替えてから
```

`emela` は main から作ったもの（0.20.1 以降）を PATH に置く．

## 仕組み

- Workers はリクエストごとに `fetch` を呼ぶ．Emela 側もリクエスト1件を始めから終わりまで走らせ，accept のループは持たない
- エントリモジュールの pub fn はエクスポートされる（中断する関数は generator になり，ランタイムの `$start` も出る）．`worker/entry.mjs` がそれを `$start` で駆動し，JS の `Response` に直す
- `Worker.serve` は `with WorkerPlatform { ... }` の中で `Fiber.attempt` を使ってアプリを呼ぶ．error と defect はログに書いて 500 にする．`Std.Http.Method` にないメソッドは 405
- `WorkerPlatform` は `Std.Platform` から SystemFileSystem と SystemEnv（`process.env`）を抜き，WorkerEnv（`[vars]` とシークレット）と WorkerKv を足した layer
- バインディングは `import { env } from "cloudflare:workers"` で読む．リクエストの引数で `env` を回さずに済む

## 構成

| パス | 中身 |
|---|---|
| `src/cloudflare/worker.emel` | `Cloudflare.Worker`．`serve`，Request と Response の変換，WorkerEnv，WorkerPlatform |
| `src/cloudflare/kv.emel` | `Cloudflare.Kv`．`Kv` エフェクトと WorkerKv |
| `src/main.emel` | サンプル（KV で訪問を数える） |
| `worker/entry.mjs` | Worker の `export default { fetch }` |
| `worker/build.sh` | `emela build` のあと，出力の `file://` を剥がす |

## 回避していること（コンパイラ側の課題）

- 出力は外部関数のファイルを `file:///...` の絶対 URL で import する（spec 12.1）．esbuild は解決できないので `build.sh` で `file://` を剥がしている．同梱の std と同じく出力先へコピーして相対で import すれば要らなくなる
- パッケージの配布が未決（18.1 #14）なので，`src/cloudflare/` を自分のプロジェクトに写して使う
- ハンドラは引数を取れない（8.4）ので，WorkerKv のバインディング名は `KV` に固定している
- KV の失敗は defect になる（error にしていない）
