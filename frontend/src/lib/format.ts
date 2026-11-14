// サーバー（UTC）でもブラウザでも日本時間で表示する
const TZ = "Asia/Tokyo";

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: TZ });

// 日本時間の今日（YYYY-MM-DD）
export const todayInTokyo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());

export const isValidDate = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export const spaceKindLabel = {
  seat: "フリー席",
  meeting_room: "会議室",
} as const;

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m > 0 ? `${m}分` : ""}` : `${m}分`;
};

export const formatHours = (open: number, close: number) => `${open}:00〜${close}:00`;

// 月（YYYY-MM）の扱い
export const isValidMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const currentMonthInTokyo = () => todayInTokyo().slice(0, 7);
export const shiftMonth = (month: string, diff: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + diff, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const formatMonth = (month: string) => {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
};
