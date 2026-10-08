// Generated from src/library/common_sources.json by tools/build_core.cjs; edit the JSON, not this file.
/** Common identities (Q61): what almost every shader host provides. Definitions point here with
 * `common`; graphs never store it. 共同身分：由 JSON 產生，請改 JSON。 */
export interface CommonSource { readonly id: string; readonly type: string; readonly meaning: string }
export const commonSources: readonly CommonSource[] = Object.freeze([
  {
    "id": "absTime",
    "type": "float",
    "meaning": "Seconds since the host started running; keeps going."
  },
  {
    "id": "deltaTime",
    "type": "float",
    "meaning": "Seconds from the previous frame to this one."
  },
  {
    "id": "absFrame",
    "type": "float",
    "meaning": "Frames since the host started running."
  },
  {
    "id": "uv",
    "type": "vec2",
    "meaning": "Normalized coordinates of this pixel, 0 to 1."
  },
  {
    "id": "fragCoord",
    "type": "vec4",
    "meaning": "Pixel coordinates of this pixel."
  },
  {
    "id": "resolution",
    "type": "vec2",
    "meaning": "Width and height of the output in pixels."
  }
].map(entry => Object.freeze(entry)));
