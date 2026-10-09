import type { ReactNode } from 'react';
import type { Editor as EditorSession, EditorState } from './editor';
import type { AddChoice } from './add_entries';
import type { Side } from './layout';
import { AddNodePanel } from './AddNodePanel';
import { SourcesPanel } from './SourcesPanel';
import { GlslPanel } from './GlslPanel';
import { AppearancePanel } from './AppearancePanel';
import { tr, say, type Message } from './text';

// Every panel of the editor, one row each: its name, where it goes by default, what it shows. The layout
// (layout.tsx) only arranges these ids; a new panel is one new row here. Table order is the default tab order;
// `first` is the tab shown first. Defaults as the legacy editor: Sources | Add Node | GLSL on the left, Add Node
// shown; the right zone stays empty until the Parameter panel exists.
// 編輯器的所有面板，一列一個：名字、預設放哪、顯示什麼。版面（layout.tsx）只排這些代號；新面板＝這裡多一列。
// 表的順序＝預設分頁順序；first＝一開始顯示的分頁。預設照舊產品：左邊 Sources｜Add Node｜GLSL、顯示 Add Node；
// 右邊等參數面板做了才有。
/** What a panel's content is made from: the graph being edited (Q47 4). 面板內容的來源：正在編輯的圖。 */
export type PanelInput = { session: EditorSession | null; state: EditorState; choices: readonly AddChoice[]; add(choice: AddChoice): void };
type PanelRow = { title: Message; side: Side; first?: true; content(input: PanelInput): ReactNode };

export const PANELS = {
  sources: { title: tr('sources.title', 'Shared Sources'), side: 'left', content: ({ session, state }) => session
    ? <SourcesPanel declarations={state.declarations} references={state.references} />
    : <p className="hint">{say(tr('sources.noGraph', 'Open a Grape OP to see its shared sources.'))}</p> },
  addNode: { title: tr('addNode.title', 'Add Node'), side: 'left', first: true, content: ({ session, choices, add }) => session
    ? <AddNodePanel choices={choices} onAdd={add} />
    : <p className="hint">{say(tr('addNode.noGraph', 'Open a Grape OP to add nodes.'))}</p> },
  glsl: { title: tr('glsl.title', 'GLSL'), side: 'left', content: ({ state }) => <GlslPanel glsl={state.glsl} /> },
  // Appearance (Refactor.58.2): opened from the appearance menu; on the right until floating panels exist.
  // 外觀：從外觀選單打開；浮動面板做好之前放右邊。
  appearance: { title: tr('appearance.panel', 'Appearance'), side: 'right', content: () => <AppearancePanel /> },
} satisfies Record<string, PanelRow>;
export type PanelId = keyof typeof PANELS;
