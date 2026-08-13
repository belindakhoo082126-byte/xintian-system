type TimestampedRecord = {
  id: number;
  createdAt?: string | Date | number | null;
  lastMessageAt?: string | Date | number | null;
};

function toSortableTime(value: TimestampedRecord["createdAt"] | TimestampedRecord["lastMessageAt"]) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * 将同一轮同步中可能重复返回的消息按ID合并，并以创建时间升序稳定展示。
 * 当时间相同或缺失时，以ID作为稳定次序，避免新消息在画面中跳动。
 */
export function dedupeAndSortMessages<T extends TimestampedRecord>(records: readonly T[] | undefined): T[] {
  const byId = new Map<number, T>();
  for (const record of records || []) {
    byId.set(record.id, record);
  }
  return Array.from(byId.values()).sort((left, right) =>
    toSortableTime(left.createdAt) - toSortableTime(right.createdAt) || left.id - right.id
  );
}

/**
 * 会话列表按最后消息时间倒序显示；重复会话仅保留最新同步的一笔资料。
 */
export function dedupeAndSortConversations<T extends TimestampedRecord>(records: readonly T[] | undefined): T[] {
  const byId = new Map<number, T>();
  for (const record of records || []) {
    byId.set(record.id, record);
  }
  return Array.from(byId.values()).sort((left, right) =>
    toSortableTime(right.lastMessageAt) - toSortableTime(left.lastMessageAt) || right.id - left.id
  );
}
