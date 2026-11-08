import type { HistoryBatch } from "@wirecat/cli-core/cli"

/** How far the phone says its own history sync has got, carried beside a batch without changing its shape. */
export interface PhoneSync {
  kind: string
  progress: number
}

const PHONE_SYNC = Symbol("wa.phoneSync")
type Tagged = HistoryBatch & { [PHONE_SYNC]?: PhoneSync }

export const tagPhoneSync = (batch: HistoryBatch, sync: PhoneSync | undefined): HistoryBatch => {
  if (sync) (batch as Tagged)[PHONE_SYNC] = sync
  return batch
}

/**
 * The phone's last chunk of the link-time sync: a bootstrap, recent or full push at 100 %. An on-demand answer or a
 * name list says nothing about the link-time sync, so it never counts.
 */
export const phoneSyncDone = (batch: HistoryBatch): boolean => {
  const sync = (batch as Tagged)[PHONE_SYNC]
  return sync !== undefined && ["bootstrap", "recent", "full"].includes(sync.kind) && sync.progress >= 100
}
