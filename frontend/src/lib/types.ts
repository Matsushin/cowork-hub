// APIのレスポンスの型
// backend の OpenAPI（swagger/v1/openapi.yaml）から生成した型（api-schema.ts）に名前を付けて使う。
// APIを変えたら backend で `bin/rails rswag:specs:swaggerize`、frontend で `npm run gen:api` を実行する
import type { components } from "./api-schema";

type Schemas = components["schemas"];

export type Plan = Schemas["Plan"];
export type User = Schemas["User"];
export type UserDetail = Schemas["UserDetail"];
export type SessionResponse = Schemas["SessionResponse"];
export type Location = Schemas["Location"];
export type LocationDetail = Schemas["LocationDetail"];
export type Space = Schemas["Space"];
export type Reservation = Schemas["Reservation"];
export type Availability = Schemas["Availability"];
export type Visit = Schemas["Visit"];
export type Bill = Schemas["Bill"];
export type Sales = Schemas["Sales"];
export type CheckinCode = Schemas["CheckinCode"];
export type AiRequest = Schemas["AiRequest"];
