import { useMemo, type ReactNode } from 'react';
import type { Editor as EditorSession } from './editor';
import { useEditorFields, useEditorSlice } from './editor_slice';
import type { AddChoice } from './add_entries';
import type { Corner, Side } from './layout_tree';
import { AddNodePanel } from './AddNodePanel';
import { SourcesPanel } from './SourcesPanel';
import { GlslPanel, glslMenu } from './GlslPanel';
import { GraphJsonView, graphJsonMenu } from './GraphJsonView';
import type { MenuItem } from './DropdownMenu';
import { AppearancePanel } from './AppearancePanel';
import { ParamsPanel } from './ParamsPanel';
import { tr, say, type Message } from './text';

// Every panel of the editor, one row each: its name, where it goes by default, what it shows. The layout
// (layout.tsx) only arranges these ids; a new panel is one new row here. Table order is the default tab order;
// `first` is the tab shown first. Defaults as the legacy editor: Sources | Add Node | GLSL on the left, Add Node
// shown; the Parameter panel on the right (Refactor.76), shown first there.
// 編輯器的所有面板，一列一個：名字、預設放哪、顯示什麼。版面（layout.tsx）只排這些代號；新面板＝這裡多一列。
// 表的順序＝預設分頁順序；first＝一開始顯示的分頁。預設照舊產品：左邊 Sources｜Add Node｜GLSL、顯示 Add Node；
// 參數面板在右邊（R.76），右側一開始顯示它。
/** What a panel's content is made from: the graph being edited (Q47 4). No state: each content reads its own slice of it, so a publish
 * re-renders only the panels whose values changed (Refactor.106). 面板內容的來源：正在編輯的圖。不帶狀態：每個內容讀自己的切片，發布時只有
 * 值變了的面板重繪（R.106）。 */
export type PanelInput = { session: EditorSession | null; choices: readonly AddChoice[]; add(choice: AddChoice): void };
// Each panel's own slice of the state (Refactor.106; editor_slice.ts). 每個面板自己的狀態切片（R.106；editor_slice.ts）。
const SOURCE_FIELDS = ['declarations', 'version'] as const;
const GLSL_FIELDS = ['glsl', 'compiled', 'glslVariables', 'glslDeclarations', 'stuck'] as const;
function Sources({ session }: { session: EditorSession }) {
  const { declarations, version } = useEditorFields(session, SOURCE_FIELDS)!;
  // The reference counts are this panel's own derivation (Refactor.107, Z2): asked of the session for each version of the graph it
  // shows, never worked out while the panel is away. 引用數是這個面板自己的推導（R.107，Z2）：它顯示的每一版圖問 session 一次，面板不在
  // 時不算。
  const references = useMemo(() => session.references(), [session, version]);
  return <SourcesPanel declarations={declarations} references={references} />;
}
function Glsl({ session }: { session: EditorSession }) {
  return <GlslPanel {...useEditorFields(session, GLSL_FIELDS)!} />;
}
function GraphJson({ session }: { session: EditorSession }) {
  return <GraphJsonView session={session} version={useEditorSlice(session, state => state.version)} />;
}
/** `menu`: the panel's own menu, on its tab's corner while shown (Refactor.83). menu：面板自己的選單，顯示時在分頁右上角（R.83）。 */
/** `corner`: it floats only in that corner, which no other panel may take (Refactor.84, human 2026-10-11: the Parameter panel
 * keeps the top right). corner：只浮在那一角、別的面板不能用（R.84，人類 10-11：參數面板佔右上角）。 */
/** `frame: 'own'`: floating, it draws its own frame and head (Refactor.85: the Parameter panel is a node card). frame：浮動時自己畫外殼與頭
 * （R.85：參數面板是一張節點卡）。 */
export type PanelRow = { title: Message; side: Side; first?: true; corner?: Corner; frame?: 'own'; content(input: PanelInput): ReactNode; menu?(): readonly MenuItem[] };

export const PANELS = {
  sources: { title: tr('sources.title', 'Shared Sources'), side: 'left', content: ({ session }) => session
    ? <Sources session={session} />
    : <p className="hint">{say(tr('sources.noGraph', 'Open a Grape OP to see its shared sources.'))}</p> },
  addNode: { title: tr('addNode.title', 'Add Node'), side: 'left', first: true, content: ({ session, choices, add }) => session
    ? <AddNodePanel choices={choices} onAdd={add} />
    : <p className="hint">{say(tr('addNode.noGraph', 'Open a Grape OP to add nodes.'))}</p> },
  // The GLSL panel links lines and names to nodes, so it needs the graph being edited (Refactor.63.3: without one it broke the page).
  // GLSL 面板把行與名字連到節點，需要正在編輯的圖（63.3：沒有圖時曾讓整頁壞掉）。
  glsl: { title: tr('glsl.title', 'GLSL'), side: 'left', content: ({ session }) => session
    ? <Glsl session={session} />
    : <p className="hint">{say(tr('glsl.noGraph', 'Open a Grape OP to see its GLSL.'))}</p>, menu: glslMenu },
  // The graph document as JSON, read only (Refactor.102). 圖文件的 JSON，唯讀（R.102）。
  graphJsonView: { title: tr('graphJson.title', 'Graph JSON'), side: 'right', content: ({ session }) => session
    ? <GraphJson session={session} />
    : <p className="hint">{say(tr('graphJson.noGraph', 'Open a Grape OP to see its graph as JSON.'))}</p>, menu: graphJsonMenu },
  // The Parameter panel (Refactor.76): the current node. 參數面板（R.76）：目前的節點。
  params: { title: tr('params.title', 'Parameters'), side: 'right', first: true, corner: 'top-right', frame: 'own', content: ({ session }) => session
    ? <ParamsPanel />
    : <p className="hint">{say(tr('params.noGraph', 'Open a Grape OP to edit its nodes.'))}</p> },
  // Appearance (Refactor.58.2): opened from the appearance menu; on the right until floating panels exist.
  // 外觀：從外觀選單打開；浮動面板做好之前放右邊。
  appearance: { title: tr('appearance.panel', 'Appearance'), side: 'right', content: () => <AppearancePanel /> },
} satisfies Record<string, PanelRow>;
export type PanelId = keyof typeof PANELS;
