// このファイルは scripts/gen-ai-tools.mjs が作る。手で直さない（npm run gen:api で作り直す）
import type { GeneratedTool } from "./tool-request";

export const GENERATED_TOOLS: Record<"booking" | "analytics", GeneratedTool[]> = {
  "booking": [
    {
      "name": "search_locations",
      "description": "公開中の拠点を探す。q は拠点名・住所の部分一致（例：渋谷、梅田、川西）、prefecture は都道府県名（例：大阪府）。場所の条件が分かったら最初に使う。条件なしで呼ぶと全拠点が返る\n（GET /api/locations：拠点の検索）",
      "method": "GET",
      "path": "/api/locations",
      "pathParams": [],
      "queryParams": [
        "q",
        "prefecture"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "q": {
            "type": "string",
            "description": "拠点名・住所の部分一致"
          },
          "prefecture": {
            "type": "string"
          }
        },
        "required": [],
        "additionalProperties": false
      }
    },
    {
      "name": "get_location",
      "description": "拠点の詳細を見る。営業時間（open_hour〜close_hour、日本時間の時）と、スペース（会議室の定員 capacity・1時間の料金 hourly_price・種別 kind）が分かる。会議室は kind が meeting_room のもの\n（GET /api/locations/{id}：拠点の詳細）",
      "method": "GET",
      "path": "/api/locations/{id}",
      "pathParams": [
        "id"
      ],
      "queryParams": [],
      "inputSchema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          }
        },
        "required": [
          "id"
        ],
        "additionalProperties": false
      }
    },
    {
      "name": "get_availability",
      "description": "拠点の指定日（date は YYYY-MM-DD、日本時間）の予約済みの時間帯を見る。reserved に入っている時間帯と重なるスペース・時間は予約できない。予約は slot_minutes（30分）単位で、営業時間内に収める必要がある\n（GET /api/locations/{location_id}/spaces/availability：指定日の空き状況（予約済みの時間帯））",
      "method": "GET",
      "path": "/api/locations/{location_id}/spaces/availability",
      "pathParams": [
        "location_id"
      ],
      "queryParams": [
        "date"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "location_id": {
            "type": "integer"
          },
          "date": {
            "type": "string",
            "format": "date",
            "description": "省略時は今日"
          }
        },
        "required": [
          "location_id"
        ],
        "additionalProperties": false
      }
    },
    {
      "name": "list_plans",
      "description": "料金プランの一覧。プランごとの会議室の月の予約上限（monthly_hours_limit、時間。null は無制限）が分かる。上限について聞かれたときだけ使う\n（GET /api/plans：料金プラン一覧）",
      "method": "GET",
      "path": "/api/plans",
      "pathParams": [],
      "queryParams": [],
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": false
      }
    }
  ],
  "analytics": [
    {
      "name": "get_usage_stats",
      "description": "利用状況を集計する。期間（from〜to、日本時間の日付、両端を含む）の会議室などの予約とドロップイン利用の件数・時間・金額、会議室の稼働率（％）を、group_by（location=拠点、space=スペース、month=月、weekday=曜日、hour=時間帯）でまとめて返す。location_id で拠点を絞れる。rows が行ごと、totals が期間全体の合計。月額プランの料金は含まない（月の売上の合計は get_sales）\n（GET /api/admin/stats/usage：利用状況の集計（予約・ドロップインの件数・時間・金額と、会議室の稼働率））",
      "method": "GET",
      "path": "/api/admin/stats/usage",
      "pathParams": [],
      "queryParams": [
        "from",
        "to",
        "group_by",
        "location_id"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "format": "date",
            "description": "期間の始め（日本時間の日付 YYYY-MM-DD、この日を含む）"
          },
          "to": {
            "type": "string",
            "format": "date",
            "description": "期間の終わり（日本時間の日付 YYYY-MM-DD、この日を含む）。期間は366日以内"
          },
          "group_by": {
            "type": "string",
            "enum": [
              "location",
              "space",
              "month",
              "weekday",
              "hour"
            ],
            "default": "location",
            "description": "まとめ方。location=拠点、space=スペース（ドロップインは数えない）、month=月、weekday=曜日、hour=時間帯（予約は開始、ドロップインはチェックインの時刻。稼働率は出さない）"
          },
          "location_id": {
            "type": "integer",
            "description": "拠点で絞り込む"
          }
        },
        "required": [
          "from",
          "to"
        ],
        "additionalProperties": false
      }
    },
    {
      "name": "get_member_stats",
      "description": "月（YYYY-MM）の会員数を集計する。member_count は月末（今月なら今日）時点でプランを契約している人数、new_member_count はその月に登録した人数、active_member_count はその月に予約かドロップインをした人数、by_plan はプランごとの人数と月額プランの料金の合計\n（GET /api/admin/stats/members：会員数の集計（プランごとの人数・新しい会員・利用した会員。個人の情報は返さない））",
      "method": "GET",
      "path": "/api/admin/stats/members",
      "pathParams": [],
      "queryParams": [
        "month"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "month": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}$",
            "description": "対象の月（YYYY-MM）。省略すると今月"
          }
        },
        "required": [],
        "additionalProperties": false
      }
    },
    {
      "name": "get_sales",
      "description": "月（YYYY-MM）の売上を拠点別に返す。拠点ごとのドロップイン・予約の売上と、月額プランの料金（plan_amount、拠点に紐づかない）、それらを足した月の売上の合計（total）。「売上」と聞かれたら、月額プランを含むこちらの total を使う\n（GET /api/admin/sales：拠点別の月次売上）",
      "method": "GET",
      "path": "/api/admin/sales",
      "pathParams": [],
      "queryParams": [
        "month"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "month": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}$"
          }
        },
        "required": [],
        "additionalProperties": false
      }
    },
    {
      "name": "search_locations",
      "description": "拠点を探す。q は拠点名・住所の部分一致、prefecture は都道府県名。拠点で絞り込むときに、拠点の ID を知るために使う\n（GET /api/locations：拠点の検索）",
      "method": "GET",
      "path": "/api/locations",
      "pathParams": [],
      "queryParams": [
        "q",
        "prefecture"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "q": {
            "type": "string",
            "description": "拠点名・住所の部分一致"
          },
          "prefecture": {
            "type": "string"
          }
        },
        "required": [],
        "additionalProperties": false
      }
    }
  ]
};
