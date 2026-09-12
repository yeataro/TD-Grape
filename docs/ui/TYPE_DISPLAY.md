# Input conversions and output identity

Node header type badges now describe actual output types. Length with vec4 input reports float in its header. Graph Function calls retain their function marker and typed output ports.

A connected input with a conversion shows float → vec4 (or the relevant dimension), with source and destination type colors. The wire keeps its source color and the socket its required type. Parameter explains scalar splats. Unconnected inputs show their required types. Unsupported existing conversions are marked invalid.

Two floats into a locked vec4 Multiply remain legal and return vec4. This batch changes presentation, not stored types, edges, compiler rules or downstream behavior. New Math Auto is now implemented; see MATH_AUTO.md for opt-in metadata, explicit locks and connection validation.

Validation: nine browser checks cover mixed/dual scalar inputs, unchanged graph data, actual Length output, disconnected and invalid inputs, both languages and wire alignment at three zoom levels. The real compiler emits both expected vec4(float) conversions in the displayed example.

Static-only live deployment protects current Shader graphs/revisions/GLSL and the runtime port. Do not restore test fixtures into live shaders.
