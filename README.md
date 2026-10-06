# TD-Grape

[繁體中文](README.zh-TW.md) | [日本語](README.ja.md)

A node-based GLSL TOP/MAT shader editor for TouchDesigner.

Edit node graphs, generate GLSL, preview results from TouchDesigner, and adjust parameters through a browser for image processing and material creation.

![TD-Grape node-based shader editor](https://github.com/user-attachments/assets/dd59025e-adc9-4db4-85d0-ceb6bf8c5b76)

![TD-Grape node-based shader editor](https://github.com/user-attachments/assets/ad814080-98b9-4a5b-b371-744ad936ae3f)

![TD-Grape node-based shader editor](https://github.com/user-attachments/assets/7b5188d3-dbc3-4b25-804b-1a5d128d5580)


## Project Status

Current version: **0.8.276**.

**Functional preview in development. Not yet Alpha.**

The current focus is to complete the functional preview, refine workflows, and validate existing features. A substantial architectural refactor is expected after this stage, clarifying the responsibilities of the editor, code generator, and host integration.

The scope and timing of the refactor have not been finalized. The interface and graph data format may still change. Version changes and upgrade notes will be published in [Releases](https://github.com/yeataro/TD-Grape/releases); detailed development status and design records are available through the [Documentation Index](docs/README.md).

Some features and cross-platform validation remain incomplete.

## Interface Languages

The interface supports **English, 繁體中文 (Traditional Chinese), 日本語 (Japanese), Français (French), and 한국어 (Korean)**. Use the language selector in the header or the **AA (language and interface size)** panel to switch languages. Your browser remembers the selection.

Node types, categories, and GLSL/TD technical names retain their original names. User-defined names and native TouchDesigner parameter labels are also preserved when switching languages. See [Interface Languages](docs/ui/LOCALIZATION.md) for details.

## Shader Preservation and Compatibility

TD-Grape generates static GLSL code. Once generated and applied, shaders can continue to run without the TD-Grape editor, even if the manager component is removed, provided the TD operators, textures, and parameter bindings needed to run them are retained.

This commitment applies only to verified TouchDesigner versions; upgrading between versions may require adjustments. Editing graphs and regenerating code still require TD-Grape.

## Installation and Launch

1. Install and open TouchDesigner.
2. Go to [Releases](https://github.com/yeataro/TD-Grape/releases) and download the `.tox` component from the release's **Assets**.
3. Drag the `.tox` into TouchDesigner's **Network Editor** to add the TD-Grape manager component.
4. Press **Tab** in the Network Editor to open the **OP Create Dialog**.

   ![TouchDesigner's Grape operator creation menu](https://github.com/user-attachments/assets/3d2a3727-2f6c-4634-851c-0871496b3618)

5. Under **Grape**, create a **Grape TOP** for texture/image processing or a **Grape MAT** for materials.
6. Select the newly created component and click **Open Editor** on its parameter page to open the browser editor.

   ![Opening the browser editor from a Grape component's parameters](https://github.com/user-attachments/assets/2a47ddcd-9e2f-407a-9d67-9403452cb62c)

## Development Documentation

The project also explores how to make node definitions easier to understand, maintain, and extend. Code, interface, specifications, and design discussions are kept together to inform future development.

- [Documentation Index](docs/README.md)
- [Development Guide](docs/development/DEVELOPMENT.md)
- [Testing Guide](docs/development/TESTING.md)

Historical proposals and discussions are retained for reference. They do not represent implemented features or confirmed delivery plans.

## Creation and Collaboration

- **Project initiation, requirements, design decisions, and review:** [@yeataro](https://github.com/yeataro)
- **Initial specification collaboration:** Fable 5.1
- **Code implementation and subsequent revisions:** OpenAI Codex (GPT-6 Astra), in collaboration with [@yeataro](https://github.com/yeataro).

These credits document the work contributed by the human author and AI tools.

## Third-Party Acknowledgments

This project uses [TDFam](https://github.com/dotsimulate/TDFam), developed by **Lyell Hintz ([dotsimulate](https://dotsimulate.com))**, **Dan Molnar ([Function Store](https://www.functionstore.xyz/link-in-bio))**, and other contributors. Thank you for providing this open-source foundation.

TDFam provides foundational capabilities for custom operator families in TouchDesigner and is licensed under **Apache-2.0**. See the accompanying [LICENSE](src/third_party/TDFam/LICENSE) and [NOTICE](src/third_party/TDFam/NOTICE) for details.
