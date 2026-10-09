import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { tr, say, type Message } from './text';
import { colorHex } from './ValueFields';
import { useSession } from './contexts';
import { Icon } from './icons';
import type { InputInfo } from './editor';

// The plain ones are drawn here from their values, the same as the constant TOPs in Samples
// (install_grape_templates.py); they are the images' content, not a look. 純色的照數值直接畫，數值同 Samples 裡的
// Constant TOP；這是圖的內容，不是外觀。
const plainTextures: Record<string, readonly number[]> = { white: [1, 1, 1], black: [0, 0, 0], normal: [.5, .5, 1] };
export const textureNames: Record<string, Message> = {
  none: tr('texture.none', 'Transparent'), grape: tr('texture.grape', 'Grape'),
  banana: tr('texture.banana', 'Banana'), jellybeans: tr('texture.jellybeans', 'Jellybeans'),
  white: tr('texture.white', 'White'), black: tr('texture.black', 'Black'), normal: tr('texture.normal', 'Flat normal'),
};

/** A picture's hint, from one answer of TD (inputs): where it is in TD's network, then size and format (human 2026-10-10;
 * one source since R.61.6, so path and size never come from different moments). 圖片提示，來自 TD 的同一次回答：
 * 在 TD 網路裡的位置、尺寸與格式（R.61.6 起只有一個來源，路徑和尺寸不會來自不同時間）。 */
const imageHint = (info: InputInfo | null | undefined) => info ? [info.path, say(tr('sources.imageInfo', '{width} × {height}, {format}',
  { width: info.width, height: info.height, format: info.format }))].filter(Boolean).join('\n') : undefined;
type Shot = 'loading' | 'failed' | { src: string; time: Date };
/** What a texture input gives the shader, open on its card (Refactor.58, 60; human 2026-10-10): with a TOP wired in from
 * outside, a snapshot of its In TOP — what the shader actually receives — marked with a camera and the source, pressed for
 * a new one (only this one, Refactor.61.1), all retaken when TD says a Grape OP was rewired; the old one stays until the
 * new one is ready, so nothing blinks (human: no waiting animation needed). With nothing wired, its default image.
 * Snapshots, never a live stream (texture-input-actual.md 8: encoders are scarce and TD must not slow down).
 * 貼圖輸入給 Shader 的圖：外面接了 TOP 時，拍它的 In TOP（Shader 實際收到的），用相機與來源標明、按一下重拍、TD 說重新接線時
 * 自動重拍（全部）；按一下只重拍這一張（R.61.1）；新圖準備好之前舊圖留著，不閃（人類：不需要等待動畫）。沒接時顯示預設圖。
 * 只用快照，不用即時串流（編碼器有限、不能拖慢 TD）。 */
export function TexturePreview({ id, texture }: { id: string; texture: string }) {
  const session = useSession(), plain = plainTextures[texture];
  const inputs = useSyncExternalStore(session.inputsSubscribe, session.inputsSnapshot);
  const taken = useSyncExternalStore(session.inputsSubscribe, session.inputsTake);
  const source = inputs?.[id]?.source ?? null;
  const [failed, setFailed] = useState(false), [shot, setShot] = useState<Shot>('loading');
  // This card's own request for a new snapshot. 這張自己要求重拍。
  const [retake, setRetake] = useState(0);
  useEffect(() => setFailed(false), [texture]);
  // A wired input's snapshot: again when the inputs are asked anew (rewired, reconnected) or this card asks. The shown
  // image stays until the next one arrives, then its object URL is given back.
  // 接了東西的輸入拍快照：重新問過輸入（重新接線、重新連上）或這張要求時重拍。新圖到之前舊圖留著，到了才釋放舊的。
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!source) return;
    let live = true;
    fetch(session.host.inputUrl(id), { headers: { 'X-Sgrape-Token': session.host.token }, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return 'failed' as const;
        const src = URL.createObjectURL(await response.blob());
        // Decoded before it is shown, so the swap is instant. 先解碼好再換上，換的那一刻不空白。
        const probe = new Image(); probe.src = src; await probe.decode().catch(() => undefined);
        return { src, time: new Date() } as Shot;
      }, () => 'failed' as const)
      .then(next => {
        if (!live) { if (typeof next === 'object') URL.revokeObjectURL(next.src); return; }
        if (shown.current) URL.revokeObjectURL(shown.current);
        shown.current = typeof next === 'object' ? next.src : null;
        setShot(next);
      });
    return () => { live = false; };
  }, [source, taken, retake, id, session]);
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current); }, []);
  // The window is 16:9; the image fits inside with its own ratio, as TD's TOP viewer (human 2026-10-09): wider than
  // the window fills its width, otherwise its height. Plain colours and transparent are square.
  // 預覽窗 16:9；圖照自己的比例 fit 進去，同 TD 的 TOP viewer（人類）：比窗寬就撐滿寬，否則撐滿高。純色與透明是正方形。
  const [ratio, setRatio] = useState(0);
  // Reset only for a different default image: a new snapshot keeps the old ratio until it has loaded, so it never
  // blinks (R.61.1). 只在換預設圖時重設；新快照沿用舊比例直到讀完，不閃。
  useEffect(() => setRatio(0), [texture]);
  // Sized in percent of the window, not by the grid, which treats a percent height as auto (Refactor.58 fix: a 4:3
  // image ran past the window). 用窗的百分比定大小，不靠 grid（grid 把百分比高度當自動，4:3 的圖曾超出窗）。
  const frame = (r: number, content: ReactNode, style?: CSSProperties, className = 'texture-frame checker', title?: string) => {
    const [width, height] = r > 16 / 9 ? [100, 16 / 9 / r * 100] : [r / (16 / 9) * 100, 100];
    return <div className={className} title={title} style={{ width: width + '%', height: height + '%', ...style }}>{content}</div>;
  };
  const image = (src: string, onError?: () => void) => <img src={src} alt="" draggable={false} onError={onError}
    onLoad={event => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 1)} />;
  // Hidden until the image says its size, so the frame never jumps. 圖說出尺寸前先藏著，圖框不會跳。
  const picture = (src: string, onError?: () => void, title?: string) =>
    frame(ratio || 16 / 9, image(src, onError), ratio ? undefined : { visibility: 'hidden' }, undefined, title);
  const unavailable = <span>{say(tr('sources.noPreview', 'No preview'))}</span>;
  // Labels over the image (human 2026-10-10): bottom right, dark see-through. 圖上的標籤：右下角、深色半透明。
  const label = (content: ReactNode) => <figcaption className="image-label-slot">{content}</figcaption>;
  if (source) {
    return <figure className="texture-preview">
      {/* Two hints (human 2026-10-10): the picture tells what the image is (where it is in TD's network, then size and
          format, as TD's info); the label tells about the snapshot. 兩個提示（人類）：圖片說圖是什麼（在 TD 網路裡的位置，
          再來是尺寸、格式，同 TD 的資訊）；標籤說快照的事。 */}
      {typeof shot === 'object' && picture(shot.src, undefined, imageHint(inputs?.[id]?.info))}
      {shot === 'failed' && unavailable}
      {typeof shot === 'object' && label(<button type="button" className="image-label nodrag"
        // This one again, and its size asked anew without retaking the others (61.6). 重拍這一張，並重問尺寸、不重拍別張。
        onClick={() => { setRetake(n => n + 1); void session.refreshInputs(false); }}
        // When it was taken and how to take another; in brackets, why a Sequential movie stands still while unseen.
        // 何時拍的、怎麼重拍；括號裡說明 Sequential 的影片沒人看時停住。
        title={[say(tr('sources.snapshotTaken', 'Snapshot taken at {time}, not live. Click for a new one.', {
            time: shot.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })),
          say(tr('sources.snapshotCook', '(TD only cooks what is in use: a movie set to Sequential does not play on while nothing views it.)'))]
          .join('\n')}>
        <Icon name="camera" />{say(tr('sources.snapshot', 'Snapshot'))}</button>)}
    </figure>;
  }
  // The default image tells the same (human 2026-10-10): what the In TOP receives, as TD says (R.61.5) — only once TD
  // gives the default chosen here; before it has it (not applied yet, or another editor changed it) there is no hint
  // rather than a wrong one (61.6). 預設圖也一樣（人類）：In TOP 收到的，照 TD 說的——只在 TD 給的就是這裡選的那張時才顯示；
  // TD 還沒照做（還沒送到、或別的編輯器改了）時不顯示，不給錯的。
  const info = inputs?.[id]?.info;
  const defaultHint = info?.default === texture ? imageHint(info) : undefined;
  const defaultLabel = label(<span className="image-label">{say(tr('sources.defaultLabel', 'Default: {name}',
    { name: say(textureNames[texture] ?? tr('texture.other', '{name}', { name: texture })) }))}</span>);
  if (texture === 'none') return <figure className="texture-preview">{frame(1, null, undefined, undefined, defaultHint)}{defaultLabel}</figure>;
  if (plain) return <figure className="texture-preview">{frame(1, null, { background: colorHex(plain) }, 'texture-frame', defaultHint)}{defaultLabel}</figure>;
  return <figure className="texture-preview">
    {failed ? unavailable : picture(session.host.textureUrl(texture), () => setFailed(true), defaultHint)}{!failed && defaultLabel}</figure>;
}
