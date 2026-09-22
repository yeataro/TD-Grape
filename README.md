# TD-Grape
A GLSL TOP/MAT node editor for TouchDesigner. 

[繁體中文](README.zh-TW.md)

**Version: 0.8.163 · Development preview · Not yet Alpha**


<img width="3842" height="2160" alt="sc2" src="https://github.com/user-attachments/assets/95fcf86b-d066-4cdf-8b25-ea2c9e91bf74" />

This repository preserves an exploration of building a node-based shader editor, including its code, interface, specifications, and design discussions.

Development along the original architecture has stopped. The existing work is retained for preview and reference. It can also be viewed as an exploratory draft for the next open-source project, documenting what was completed, the problems encountered, and the direction to be reconsidered next.

> This version still has unfinished features and gaps in validation. See [Known Limitations and Unfinished Features](#known-limitations-and-unfinished-features).

## Installation and Launch

1. Install and open TouchDesigner.
2. Go to this repository's [Releases](https://github.com/yeataro/TD-Grape/releases) and download the `.tox` component from the release's **Assets**.
3. Drag the `.tox` into TouchDesigner's **Network Editor** to add the TD-Grape manager component.
4. Press **Tab** in the Network Editor to open the **OP Create Dialog**.
   
<img width="1422" height="1148" alt="TF" src="https://github.com/user-attachments/assets/b837b4f6-215b-4fee-a301-e3b730b77243" />

5. Under **Grape → Shaders**, create a **Grape TOP** for texture/image processing or a **Grape MAT** for materials, then place it in the network.
6. Select the newly created operator. On its **Grape TOP** or **Grape MAT** parameter page, click **Open Editor** to open the browser editor.
   
<img width="1629" height="915" alt="ED" src="https://github.com/user-attachments/assets/2a47ddcd-9e2f-407a-9d67-9403452cb62c" />


## Why Make This Repository Public?

The repository is being made public so that anyone interested can explore the work so far, understand how the project reached this point, and see why its direction is changing.

This is not a stable release or an endorsement of every existing design decision. The code, interface, and discussion records are preserved together as a preview and a record of this stage.

## Why Stop Building on the Original Architecture?

The original goal was for humans to describe node types, behavior, and code generation primarily by maintaining a node definition table. The editor and code generator would consume those definitions within clearly defined responsibilities.

During implementation by Codex, the architecture substantially departed from the boundaries set by the original specification. Some node behavior and decision logic became scattered across the code generator and frontend instead of being fully represented in node definitions. Features were gradually completed, but maintaining or extending nodes still required humans to understand and modify code in multiple places.

This did not achieve the project's most important goal:

**Make node definitions understandable, maintainable, and extensible by humans.**

This version will therefore no longer serve as the architectural foundation for further development. The next step is to clarify the responsibilities of node definitions, the code generator, the editor, and host integration, validate a minimal structure, and then expand gradually.

## The Next Project

The next open-source project is tentatively called **GrapeL (name not final)**. Neither its name nor its concrete structure has been finalized.

The new starting point will center on human-maintainable node definitions and the tools used to edit them. Before building a minimal implementation, it will establish how data describes nodes and how each part uses that data.

Other areas of functionality may eventually develop within the same project. For now, the focus remains on clarifying the basic structure and responsibility boundaries.

## Creation and Collaboration

- **Project initiation, requirements, design decisions, and review:** [@yeataro](https://github.com/yeataro)
- **Initial specification collaboration:** Fable 5.1
- **Code implementation and subsequent revisions:** OpenAI Codex (GPT-6 Astra), in collaboration with [@yeataro](https://github.com/yeataro).

These credits document the work contributed by the human author and AI tools, while also acknowledging that the implementation departed from the intended architecture.

## Third-Party Acknowledgments

This project uses [TDFam](https://github.com/dotsimulate/TDFam), developed by **Lyell Hintz ([dotsimulate](https://dotsimulate.com))**, **Dan Molnar ([Function Store](https://www.functionstore.xyz/link-in-bio))**, and other contributors. Thank you for providing this open-source foundation.

TDFam provides foundational capabilities for custom operator families in TouchDesigner and is licensed under **Apache-2.0**. See the accompanying [LICENSE](src/third_party/TDFam/LICENSE) and [NOTICE](src/third_party/TDFam/NOTICE) for details.

## Stages and Revision History

| Stage / Version | Description |
| --- | --- |
| Initial specification | Established the architectural goal of node definitions driving behavior, with clearly separated responsibilities. |
| Implementation and feature revisions | Codex and @yeataro collaborated to progressively implement and review features. |
| 0.8.163 | The currently preserved development version; not yet Alpha. |
| 2026-09-22 | Revisited architectural goals and responsibility boundaries, and planned the starting point for the next project. |

For a more detailed version history, see [Development Status](docs/development/STATUS.md). Development plans in existing documents are retained as historical records, not as a roadmap that is still committed to delivery.

## Development and Testing

To inspect or modify the source code, see:

- [Development Guide](docs/development/DEVELOPMENT.md)
- [Testing Guide](docs/development/TESTING.md)
- [Documentation Index](docs/README.md)

## Known Limitations and Unfinished Features

The following is based on the records for `0.8.163`. It describes the limitations and unfinished scope of this version. It is neither a repair schedule nor a direct commitment to features in the next project.

### Preview and Save Risk

When applying a shader to a MAT, preview capture is temporarily locked. If a `.toe` is saved during this period, it remains unverified whether that transient state is saved with it and whether normal operation resumes after reopening.

This risk has not been ruled out. Passing the earlier preview crash regression does not mean this save scenario has been validated.

### Platform Validation Coverage

- **Windows:** The primary development and testing environment.
- **macOS / Safari:** Validation on actual hardware is incomplete, including startup, keyboard shortcuts, browser behavior, and TouchDesigner integration. Simulating a platform in a browser does not replace testing on actual hardware.
- **iOS / iPadOS:** Some touch and connection interactions have been tested, but the virtual keyboard, focus, page zoom, and value ladder interactions have not been fully validated.

### Reported Interface Issues

- Starting a right-button marquee selection on the canvas and releasing over a slider may accidentally open the value preset menu.
- The Array Parameter length field does not yet handle Esc cancellation and loss of focus consistently with node numeric inputs.
- In light mode, some source cards, Expression fields, and note areas still have dark backgrounds or insufficient contrast. A complete visual review is pending.

### Reports Awaiting Diagnosis or Further Validation

- Occasional pauses and delays when resizing the preview have not yet been fully measured or diagnosed.
- There have been reports of the HTTP status indicating that TD is unresponsive while Uniform / WebSocket functionality remains available. Reproduction conditions and status classification still need clarification.
- MAT scenarios involving missing attributes, different geometry, and combinations with instancing require further validation.

### Unfinished Features and Cleanup

- **Built-in node coverage:** Nodes and overloads for GLSL and TD native functions are not yet complete.
- **MAT sources and attributes:** Complete workflows for data across stages, instancing, and non-2D textures are still incomplete. Reading existing TD data does not imply the ability to configure and manage that data.
- **Help:** The shared Built-in Source help does not yet fully provide basic explanations and links to official documentation sections for the currently selected source.
- **Node insertion:** Inserting a node into an existing connection with compatibility checks on both sides has not been implemented.
- **Group auto-layout:** Nodes and connections are currently arranged first, then Groups are wrapped around them. Group boundaries are not yet included as layout constraints.
- **Custom parameters:** Related functionality exists, but the workflow and previously planned restructuring are incomplete.
- **Naming and search interface:** Renaming Inputs to Sources / 來源 and reorganizing the placement of the TD name / common name switch are unfinished. The current switch can be mistaken for a search option.
- **TD Pane:** An editor embedded in a TD Pane has not been provided. The editor currently runs in an external browser.

For the detailed inventory, see the [TODO Audit](docs/discussions/TODO_AUDIT_2026-09-21.md) and [Alpha Scope Record](docs/discussions/ALPHA_SCOPE_2026-09-21.md).
