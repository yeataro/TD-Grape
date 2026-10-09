import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { tr, say, type Message } from './text';
import { colorHex } from './ValueFields';
import { useSession } from './contexts';
import { Icon } from './icons';

// The plain ones are drawn here from their values, the same as the constant TOPs in Samples
// (install_grape_templates.py); they are the images' content, not a look. 純色的照數值直接畫，數值同 Samples 裡的
// Constant TOP；這是圖的內容，不是外觀。
const plainTextures: Record<string, readonly number[]> = { white: [1, 1, 1], black: [0, 0, 0], normal: [.5, .5, 1] };
export const textureNames: Record<string, Message> = {
  none: tr('texture.none', 'Transparent (as TD with nothing connected)'), grape: tr('texture.grape', 'Grape'),
  banana: tr('texture.banana', 'Banana'), jellybeans: tr('texture.jellybeans', 'Jellybeans'),
  white: tr('texture.white', 'White'), black: tr('texture.black', 'Black'), normal: tr('texture.normal', 'Flat normal'),
};
const shortNames: Record<string, Message> = { none: tr('texture.noneShort', 'Transparent') };

type Shot = 'loading' | 'failed' | { src: string; time: Date };
/** What a texture input gives the shader, open on its card (Refactor.58, 60; human 2026-10-10): with a TOP wired in from
 * outside, a snapshot of its In TOP — what the shader actually receives — marked with a camera and the source, pressed for
 * a new one, retaken when TD says it was rewired; with nothing wired, its default image. Snapshots, never a live stream
 * (texture-input-actual.md 8: encoders are scarce and TD must not slow down).
 * 貼圖輸入給 Shader 的圖：外面接了 TOP 時，拍它的 In TOP（Shader 實際收到的），用相機與來源標明、按一下重拍、TD 說重新接線時
 * 自動重拍；沒接時顯示預設圖。只用快照，不用即時串流（編碼器有限、不能拖慢 TD）。 */
export function TexturePreview({ id, texture }: { id: string; texture: string }) {
  const session = useSession(), plain = plainTextures[texture];
  const inputs = useSyncExternalStore(session.inputsSubscribe, session.inputsSnapshot);
  const taken = useSyncExternalStore(session.inputsSubscribe, session.inputsTake);
  const source = inputs?.[id] ?? null;
  const [failed, setFailed] = useState(false), [shot, setShot] = useState<Shot>('loading'), retaking = useRef(false);
  useEffect(() => setFailed(false), [texture]);
  // A wired input's snapshot, again whenever the inputs are asked anew; the old image stays until the new one arrives.
  // 接了東西的輸入拍快照；每次重新問過輸入就重拍，新圖到之前舊圖留著。
  useEffect(() => {
    if (!source) return;
    let live = true, url = '';
    if (!retaking.current) setShot('loading');
    retaking.current = false;
    fetch(session.host.inputUrl(id), { headers: { 'X-Sgrape-Token': session.host.token }, cache: 'no-store' })
      .then(async response => response.ok ? { src: url = URL.createObjectURL(await response.blob()), time: new Date() } as Shot : 'failed' as const,
        () => 'failed' as const)
      .then(next => { if (live) setShot(next); else if (url) URL.revokeObjectURL(url); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [source, taken, id, session]);
  // The window is 16:9; the image fits inside with its own ratio, as TD's TOP viewer (human 2026-10-09): wider than
  // the window fills its width, otherwise its height. Plain colours and transparent are square.
  // 預覽窗 16:9；圖照自己的比例 fit 進去，同 TD 的 TOP viewer（人類）：比窗寬就撐滿寬，否則撐滿高。純色與透明是正方形。
  const [ratio, setRatio] = useState(0);
  useEffect(() => setRatio(0), [texture, source, shot]);
  // Sized in percent of the window, not by the grid, which treats a percent height as auto (Refactor.58 fix: a 4:3
  // image ran past the window). 用窗的百分比定大小，不靠 grid（grid 把百分比高度當自動，4:3 的圖曾超出窗）。
  const frame = (r: number, content: ReactNode, style?: CSSProperties, className = 'texture-frame checker') => {
    const [width, height] = r > 16 / 9 ? [100, 16 / 9 / r * 100] : [r / (16 / 9) * 100, 100];
    return <div className={className} style={{ width: width + '%', height: height + '%', ...style }}>{content}</div>;
  };
  const image = (src: string, onError?: () => void) => <img src={src} alt="" draggable={false} onError={onError}
    onLoad={event => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 1)} />;
  // Hidden until the image says its size, so the frame never jumps. 圖說出尺寸前先藏著，圖框不會跳。
  const picture = (src: string, onError?: () => void) => frame(ratio || 16 / 9, image(src, onError), ratio ? undefined : { visibility: 'hidden' });
  const unavailable = <span>{say(tr('sources.noPreview', 'No preview'))}</span>;
  // Labels over the image (human 2026-10-10): bottom right, dark see-through. 圖上的標籤：右下角、深色半透明。
  const label = (content: ReactNode) => <figcaption className="image-label-slot">{content}</figcaption>;
  if (source) {
    const name = source.split('/').pop() || source;
    return <figure className="texture-preview">
      {typeof shot === 'object' && picture(shot.src)}
      {shot === 'failed' && unavailable}
      {typeof shot === 'object' && label(<button type="button" className="image-label nodrag"
        onClick={() => { retaking.current = true; void session.refreshInputs(); }}
        title={say(tr('sources.inputSnapshotHint', '{path}\nSnapshot taken at {time}, not live. Click for a new one.', { path: source,
          time: shot.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }))}>
        <Icon name="camera" />{say(tr('sources.inputSnapshot', 'Input: {name}', { name }))}</button>)}
    </figure>;
  }
  const defaultLabel = label(<span className="image-label">{say(tr('sources.defaultLabel', 'Default: {name}',
    { name: say(shortNames[texture] ?? textureNames[texture] ?? tr('texture.other', '{name}', { name: texture })) }))}</span>);
  if (texture === 'none') return <figure className="texture-preview">{frame(1, null)}{defaultLabel}</figure>;
  if (plain) return <figure className="texture-preview">{frame(1, null, { background: colorHex(plain) }, 'texture-frame')}{defaultLabel}</figure>;
  return <figure className="texture-preview">
    {failed ? unavailable : picture(session.host.textureUrl(texture), () => setFailed(true))}{!failed && defaultLabel}</figure>;
}
