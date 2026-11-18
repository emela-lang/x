# dynamic

emela 0.28 から std の `Std.Dynamic` に移った．新しく使わない．

- `import Dynamic.{...}` は `import Std.Dynamic.{...}` に，`import Dynamic.Number` は `import Std.Dynamic.Number` に書き換える
- `Encode`，`Decode`，`ObjectKey` は derive で作れる
- 公開済みの tag を使っているコードのために，このディレクトリは残している
