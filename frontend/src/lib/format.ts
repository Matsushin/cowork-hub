// サーバー（UTC）でもブラウザでも日本時間で表示する
const TZ = "Asia/Tokyo";

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: TZ });

// 日本時間の今日（YYYY-MM-DD）
export const todayInTokyo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());

export const isValidDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export const spaceKindLabel = { seat: "フリー席", meeting_room: "会議室" } as const;
