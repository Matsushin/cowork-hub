// このファイルは scripts/gen-ai-tools.mjs が作る。手で直さない（npm run gen:api で作り直す）
import type { GeneratedTool } from "./tool-request";

export const GENERATED_TOOLS: Record<"booking", GeneratedTool[]> = {
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
  ]
};
