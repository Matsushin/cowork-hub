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

export type Space = {
  id: number;
  name: string;
  kind: "seat" | "meeting_room";
  capacity: number;
  active: boolean;
};

export type Reservation = {
  id: number;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "canceled";
  space: Space;
  cancelable: boolean;
  user?: Pick<User, "id" | "name" | "email_address">;
};

export type Availability = {
  date: string;
  open_hour: number;
  close_hour: number;
  slot_minutes: number;
  reserved: { space_id: number; starts_at: string; ends_at: string; mine: boolean }[];
};
