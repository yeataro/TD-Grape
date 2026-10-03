# TD-Grape

[English](README.md) | [繁體中文](README.zh-TW.md)

TouchDesigner の GLSL TOP／MAT 向けノードベースのシェーダーエディターです。

ブラウザー上でノードグラフの編集、GLSL の生成、TouchDesigner の実行結果のプレビュー、パラメーターの調整ができ、画像処理やマテリアル制作に利用できます。

![TD-Grape のノードベースのシェーダー編集画面](https://github.com/user-attachments/assets/95fcf86b-d066-4cdf-8b25-ea2c9e91bf74)

## プロジェクトの状況

現在のバージョン：**0.8.274**。

**機能プレビュー版を開発中です。まだ Alpha 段階ではありません。**

現在は機能プレビュー版の完成、操作フローの整理、既存機能の検証を優先しています。この段階の完了後、エディター、コード生成器、ホスト連携の役割分担を整理するため、大規模なアーキテクチャーのリファクタリングを想定しています。

リファクタリングの範囲と時期は未定です。操作画面やグラフのデータ形式は今後変更される可能性があります。各バージョンの変更点とアップグレード時の注意事項は [Releases](https://github.com/yeataro/TD-Grape/releases) に掲載します。詳しい開発状況や設計記録は[ドキュメント一覧](docs/README.md)から参照できます。

一部の機能や、複数プラットフォームでの動作検証はまだ完了していません。

## インターフェースの言語

現在、**English（英語）、繁體中文（繁体字中国語）、日本語、Français（フランス語）、한국어（韓国語）** の5言語に対応しています。ヘッダー、または **AA（言語と表示サイズ）** パネルの言語メニューで切り替えられます。選択した言語はブラウザーに保存されます。

ノードの種類、カテゴリー、GLSL／TD の技術名称は原文のまま表示します。ユーザーが付けた名前や TouchDesigner のネイティブパラメーターのラベルも、言語切り替えによって変更されません。詳しくは[インターフェースの言語について](docs/ui/LOCALIZATION.md)を参照してください。

## 生成したシェーダーの継続利用と互換性

TD-Grape は静的な GLSL コードを生成します。生成・適用済みのシェーダーは、実行に必要な TD のオペレーター、テクスチャー、パラメーターバインディングを保持していれば、TD-Grape エディターを使わなくなっても、管理コンポーネントを削除しても動作し続けます。

この保証は、動作確認済みの TouchDesigner バージョンに限られます。バージョンを変更する際には調整が必要になる場合があります。グラフの編集やコードの再生成には、引き続き TD-Grape が必要です。

## インストールと起動

1. TouchDesigner をインストールして起動します。
2. [Releases](https://github.com/yeataro/TD-Grape/releases) を開き、対象バージョンの **Assets** から `.tox` コンポーネントをダウンロードします。
3. `.tox` を TouchDesigner の **Network Editor（ノードを配置する画面）** にドラッグして、TD-Grape の管理コンポーネントを追加します。
4. Network Editor で **Tab** キーを押し、**OP Create Dialog** を開きます。

   ![TouchDesigner の Grape コンポーネント作成メニュー](https://github.com/user-attachments/assets/b837b4f6-215b-4fee-a301-e3b730b77243)

5. **Grape** カテゴリーから、テクスチャー・画像処理用の **Grape TOP**、またはマテリアル用の **Grape MAT** を作成します。
6. 作成したコンポーネントを選択し、パラメーターページの **Open Editor** をクリックして、ブラウザーの編集画面を開きます。

   ![Grape コンポーネントのパラメーターページからブラウザーエディターを起動](https://github.com/user-attachments/assets/2a47ddcd-9e2f-407a-9d67-9403452cb62c)

## 開発ドキュメント

このプロジェクトでは、ノード定義をより理解・保守・拡張しやすくする方法も検討しています。今後の開発に役立てるため、コード、インターフェース、仕様、設計上の議論をまとめて残しています。

- [ドキュメント一覧](docs/README.md)
- [開発ガイド](docs/development/DEVELOPMENT.md)
- [テストガイド](docs/development/TESTING.md)

過去の提案や議論は参考資料として保存しています。実装済みの機能や、確定した提供計画を示すものではありません。

## 制作・協力

- **プロジェクトの立ち上げ、要件、設計判断、レビュー：** [@yeataro](https://github.com/yeataro)
- **初期仕様書の共同作成：** Fable 5.1
- **実装およびその後の改訂：** [@yeataro](https://github.com/yeataro) と OpenAI Codex（GPT-6 Astra）による共同作業。

このクレジットは、人間の作者と AI ツールがそれぞれ担当した作業を記録したものです。

## サードパーティーへの謝辞

本プロジェクトは、**Lyell Hintz（[dotsimulate](https://dotsimulate.com)）**、**Dan Molnar（[Function Store](https://www.functionstore.xyz/link-in-bio)）** およびその他の貢献者が開発した [TDFam](https://github.com/dotsimulate/TDFam) を使用しています。オープンソースの基盤を提供してくださった皆さまに感謝します。

TDFam は TouchDesigner のカスタム operator family を実現するための基盤機能を提供しており、**Apache-2.0** ライセンスで公開されています。詳細は同梱の [LICENSE](src/third_party/TDFam/LICENSE) と [NOTICE](src/third_party/TDFam/NOTICE) を参照してください。
