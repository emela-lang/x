# json

emela 0.28 から std の `Std.Json` に移った．新しく使わない．

- `import Json` は `import Std.Json` に書き換える．`Std.Json` は `Std.Dynamic` の値を読み書きするので，x/dynamic も合わせて `Std.Dynamic` に移す
- 公開済みの tag を使っているコードのために，このディレクトリは残している
