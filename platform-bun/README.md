# platform-bun

Bun で動かす Emela のアプリのための handler．Bun の組み込み機能だけを使い，npm の package には依存しない．`Std.Platform` はそのまま Bun で動くので，この Pome は足りない handler だけを持つ．

```emela
import Std.Platform.{Platform}
import Bun.Sqlite.{BunSqlite, BunSqliteTransaction}

@entry(Http.serve)
pub fn app(request: Request) -> Response {
  with Platform, BunSqlite(path: "app.db"), BunSqliteTransaction { route(request) }
}
```

## 動かす

```sh
EMELA_NODE=bun emela run      # src/main.emel の sample（SQLite にメモを置く）
EMELA_NODE=bun emela test
```

`EMELA_NODE` で emela が使う host を Bun にする．Node で走らせると `bun:sqlite` が読めずに落ちる．

## handler

| handler | effect | 中身 |
|---|---|---|
| `BunSqlite(path)` | `Sql`（x/sql） | `bun:sqlite`．`with` ごとに接続を開き，終わるときに閉じる．`:memory:` は `with` ごとに新しい空の database |
| `BunSqliteTransaction` | `Transaction`（x/sql） | 前に並べた `BunSqlite` に `begin`，`commit`，`rollback` を流す |

- 接続は `with` ごとに別になる．HTTP サービスでは request ごとに別の接続になるので，ある request の transaction に，別の request の文が混ざらない
- `bun:sqlite` の呼び出しはその場で終わり，suspend しない．他の接続が transaction を開いている間の書き込みは，待たずに `SqlError`（`database is locked`）になる．読み込みは通り，commit される前の値が見える．transaction は短くし，中で他のものを待たない
- 整数は桁を失わずに返る（`safeIntegers`）．2^53 を超える整数を引数に渡すと桁を失う
- BLOB はまだ扱えない．BLOB を含む行は `SqlError` になる

## 依存して使う

```sh
emela pome add github:emela-lang/x/platform-bun
emela pome add github:emela-lang/x/sql
```

```toml
[external]
allow = ["github.com/emela-lang/x/platform-bun"]
```
