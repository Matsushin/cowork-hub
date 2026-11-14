export type Plan = {
  id: number;
  name: string;
  kind: "drop_in" | "monthly";
  price: number;
  monthly_hours_limit: number | null;
  description: string | null;
};

export type User = {
  id: number;
  name: string;
  email_address: string;
  role: "member" | "admin";
  plan: Plan | null;
  created_at: string;
};

export type Location = {
  id: number;
  name: string;
  prefecture: string;
  address: string;
  description: string | null;
  open_hour: number;
  close_hour: number;
  hourly_price: number;
  daily_max_price: number;
  active: boolean;
  current_visitors?: number;
};

export type LocationDetail = Location & { spaces: Space[] };

export type Space = {
  id: number;
  name: string;
  kind: "seat" | "meeting_room";
  capacity: number;
  hourly_price: number;
  active: boolean;
  location_id: number;
  location?: Pick<Location, "id" | "name">;
};

export type Reservation = {
  id: number;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "canceled";
  amount: number;
  space: Space;
  cancelable: boolean;
  user?: Pick<User, "id" | "name" | "email_address">;
};

export type Availability = {
  date: string;
  open_hour: number;
  close_hour: number;
  slot_minutes: number;
  reserved: {
    space_id: number;
    starts_at: string;
    ends_at: string;
    mine: boolean;
  }[];
};

export type Visit = {
  id: number;
  checked_in_at: string;
  checked_out_at: string | null;
  amount: number | null;
  /** 利用中のみ。今チェックアウトした場合の料金 */
  estimated_amount?: number;
  duration_minutes: number;
  location: Pick<Location, "id" | "name">;
};

export type Bill = {
  month: string;
  plan: Plan | null;
  plan_fee: number;
  visits: Visit[];
  visits_total: number;
  reservations: Reservation[];
  reservations_total: number;
  total: number;
};

export type Sales = {
  month: string;
  locations: {
    location: Pick<Location, "id" | "name" | "prefecture">;
    visit_count: number;
    visit_amount: number;
    reservation_amount: number;
    total: number;
  }[];
  plan_amount: number;
  total: number;
};
