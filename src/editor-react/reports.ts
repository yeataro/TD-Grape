import type { Message } from './text';

// Reports (design-interview Q35): what happened and how serious, said by the sender; where it
// came from and when, filled in here. The log is events for people: it only grows (oldest dropped
// past the limit) and no program decides anything from it — current state lives elsewhere (a
// node's error is state; "it failed at 10:02" is an event). A Log panel will read it later.
// 回報：送件人只說發生什麼、多嚴重；來源與時間由這裡填。紀錄是給人看的事件，只增不減，
// 程式不准依它判斷——目前狀態在別處。之後的 Log 面板讀它。
export type Level = 'error' | 'warning' | 'info';
export type Report = Readonly<{ level: Level; message: Message | string; source: string; time: number }>;

export class ReportLog {
  private items: Report[] = [];
  private listeners = new Set<() => void>();
  constructor(private readonly limit = 500) {}
  add(level: Level, message: Message | string, source: string) {
    this.items = [...this.items.slice(-(this.limit - 1)), Object.freeze({ level, message, source, time: Date.now() })];
    this.listeners.forEach(listener => listener());
  }
  entries = (): readonly Report[] => this.items;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  // A reporter with its source already attached (Q35: each layer gets one, no global function).
  // 已貼好來源的回報函式；每一層各拿一個，不做全域函式。
  reporter = (source: string) => (level: Level, message: Message | string) => this.add(level, message, source);
}
