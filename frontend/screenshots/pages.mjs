// PRのキャプチャ（.github/workflows/pr-screenshots.yml）で撮るページの一覧
//   dir  … src/app の中のページのディレクトリ。変わったファイルからどのページを撮るかを決めるのに使う
//   path … 開くURL。CIは空のDBに seed を入れるので、ID は seed の作成順（拠点1＝川西駅前、ユーザー2＝一般会員）
//   role … guest（ログインしない）／ member（一般会員）／ admin（管理者）
// ページを増やしたら、ここにも追加する
export const PAGES = [
  { name: "top", dir: "", path: "/", role: "guest" },
  { name: "login", dir: "login", path: "/login", role: "guest" },
  { name: "signup", dir: "signup", path: "/signup", role: "guest" },
  { name: "locations", dir: "locations", path: "/locations", role: "member" },
  { name: "location", dir: "locations/[id]", path: "/locations/1", role: "member" },
  { name: "reserve", dir: "locations/[id]/reserve", path: "/locations/1/reserve", role: "member" },
  { name: "checkin", dir: "checkin", path: "/checkin?location=1", role: "member" },
  { name: "assistant", dir: "assistant", path: "/assistant", role: "member" },
  { name: "reservations", dir: "reservations", path: "/reservations", role: "member" },
  { name: "visits", dir: "visits", path: "/visits", role: "member" },
  { name: "billing", dir: "billing", path: "/billing", role: "member" },
  { name: "profile", dir: "profile", path: "/profile", role: "member" },
  { name: "admin-locations", dir: "admin/locations", path: "/admin/locations", role: "admin" },
  { name: "admin-qr", dir: "admin/locations/[id]/qr", path: "/admin/locations/1/qr", role: "admin" },
  { name: "admin-reservations", dir: "admin/reservations", path: "/admin/reservations", role: "admin" },
  { name: "admin-assistant", dir: "admin/assistant", path: "/admin/assistant", role: "admin" },
  { name: "admin-sales", dir: "admin/sales", path: "/admin/sales", role: "admin" },
  { name: "admin-spaces", dir: "admin/spaces", path: "/admin/spaces", role: "admin" },
  { name: "admin-users", dir: "admin/users", path: "/admin/users", role: "admin" },
  { name: "admin-user", dir: "admin/users/[id]", path: "/admin/users/2", role: "admin" },
];
