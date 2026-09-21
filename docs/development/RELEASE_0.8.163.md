# v0.8.163 — Development Preview

This is a development preview of TD-Grape, a GLSL MAT/TOP node editor for TouchDesigner. It has not reached Alpha.

Development on the current architecture has stopped. This release preserves the existing work for exploration and reference. See the [repository README](https://github.com/yeataro/TD-Grape#readme) for the background and future direction.

## Installation

1. Install and open TouchDesigner.
2. Download the `.tox` file from **Assets** below.
3. Drag the `.tox` into TouchDesigner's **Network Editor** to add the TD-Grape manager component.
4. Press **Tab** in the Network Editor to open the **OP Create Dialog**.
5. Under **Grape → Shaders**, create a **Grape TOP** for texture/image processing or a **Grape MAT** for materials, then place it in the network.
6. Select the newly created operator. On its **Grape TOP** or **Grape MAT** parameter page, click **Open Editor** to open the browser editor.

## Validation and Known Limitations

Windows is the primary development and testing environment. macOS and Safari have not been fully validated on actual hardware.

Known issues and unfinished features are documented in the [README](https://github.com/yeataro/TD-Grape#known-limitations-and-unfinished-features).

## Credits

Implementation and revisions by OpenAI Codex (GPT-6 Astra), in collaboration with [@yeataro](https://github.com/yeataro). Initial specification collaboration: Fable 5.1.

Includes [TDFam](https://github.com/dotsimulate/TDFam) by dotsimulate, Function Store, and other contributors. See the repository for [full credits and third-party license notices](https://github.com/yeataro/TD-Grape#third-party-acknowledgments).
