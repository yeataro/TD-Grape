import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { tr, say, type Message } from './text';
import { colorHex } from './ValueFields';
import { useSession } from './contexts';
import { Icon } from './icons';

// The plain ones are drawn here from their values, the same as the constant TOPs in Samples
// (install_grape_templates.py); they are the images' content, not a look. 純色的照數值直接畫，數值同 Samples 裡的
// Constant TOP；這是圖的內容，不是外觀。
const plainTextures: Record<string, readonly number[]> = { white: [1, 1, 1], black: [0, 0, 0], normal: [.5, .5, 1] };

type Shot = 'loading' | 'none' | 'failed' | { src: string; time: Date };
/** What a default image looks like, open on its card (Refactor.58; human 2026-10-09). The images come from TD once
 * and are shared by every Grape OP. The TOP chosen on Samples is a snapshot taken when the card opens, and says so;
 * with none chosen the input is transparent, so a checkerboard says that (human).
 * 預設圖的樣子（打開卡片時）。圖片從 TD 拿一次、所有 Grape OP 共用。Samples 上選的 TOP 是打開卡片那一刻的快照，並標明；
 * 沒選時輸入是透明的，用棋盤格表示（人類）。 */
export function TexturePreview({ texture }: { texture: string }) {
  const session = useSession(), custom = texture === 'custom', plain = plainTextures[texture];
  const [failed, setFailed] = useState(false), [shot, setShot] = useState<Shot>('loading');
  // Pressing the snapshot label takes a new one (human 2026-10-10); the old image stays until the new one arrives.
  // 按快照標籤就重拍一張（人類）；新的到之前舊圖留著。
  const [take, setTake] = useState(0), retaking = useRef(false);
  useEffect(() => setFailed(false), [texture]);
  // Asked, not just shown, so "none chosen" and "no TD" read differently. 用問的，才分得出「沒選」和「TD 不在」。
  useEffect(() => {
    if (!custom) return;
    let live = true, url = '';
    if (!retaking.current) setShot('loading');
    retaking.current = false;
    fetch(session.host.textureUrl(texture), { headers: { 'X-Sgrape-Token': session.host.token }, cache: 'no-store' })
      .then(async response => response.ok ? { src: url = URL.createObjectURL(await response.blob()), time: new Date() } as Shot
        : response.status === 404 ? 'none' as const : 'failed' as const, () => 'failed' as const)
      .then(next => { if (live) setShot(next); else if (url) URL.revokeObjectURL(url); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [custom, texture, session, take]);
  // The window is 16:9; the image fits inside with its own ratio, as TD's TOP viewer (human 2026-10-09): wider than
  // the window fills its width, otherwise its height. Plain colours and "none chosen" are square.
  // 預覽窗 16:9；圖照自己的比例 fit 進去，同 TD 的 TOP viewer（人類）：比窗寬就撐滿寬，否則撐滿高。純色與「沒選」是正方形。
  const [ratio, setRatio] = useState(0);
  useEffect(() => setRatio(0), [texture, shot]);
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
  const note = (text: Message, hint?: Message, centred = false) =>
    <figcaption className={'badge' + (centred ? ' centred' : '')} title={hint ? say(hint) : undefined}>{say(text)}</figcaption>;
  const unavailable = <span>{say(tr('sources.noPreview', 'No preview'))}</span>;
  if (plain) return <figure className="texture-preview">{frame(1, null, { background: colorHex(plain) }, 'texture-frame')}</figure>;
  if (custom) return <figure className="texture-preview">
    {typeof shot === 'object' && picture(shot.src)}
    {shot === 'none' && frame(1, null)}
    {shot === 'failed' && unavailable}
    {/* Nothing to cover, so in the middle (human 2026-10-09). 沒有圖可擋，放正中央（人類）。 */}
    {shot === 'none' && note(tr('sources.noChosenTop', 'No TOP chosen · the input is transparent'), undefined, true)}
    {/* A snapshot says so with a camera, at the bottom right on a dark label that reads on any image; pressing it takes a
        new one (human 2026-10-10). 快照用相機標明，放右下角、深色標籤在任何圖上都看得清；按一下重拍（人類）。 */}
    {typeof shot === 'object' && <figcaption className="image-label-slot">
      <button type="button" className="image-label nodrag" onClick={() => { retaking.current = true; setTake(n => n + 1); }}
        title={say(tr('sources.snapshotHint', 'Snapshot taken at {time}, not live. Click for a new one.',
          { time: shot.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }))}>
        <Icon name="camera" />{say(tr('sources.snapshot', 'Snapshot'))}</button></figcaption>}
  </figure>;
  return <figure className="texture-preview">{failed ? unavailable : picture(session.host.textureUrl(texture), () => setFailed(true))}</figure>;
}
