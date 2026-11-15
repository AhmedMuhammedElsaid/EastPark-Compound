/**
 * Chart inputs mirror `GET /v1/finance/dashboard` (backend `FinanceDashboardDto`): money is a 2-dp decimal
 * STRING (may be negative), a percentage a 1-dp string, months `YYYY-MM`. Strings are parsed for geometry only.
 */
export type DashMoney = string;

export type DashMonthAmount = { period: string; amount: DashMoney };

export type DashMethod = { method: "CASH" | "BANK_TRANSFER" | "INSTAPAY" | "CHEQUE"; gross: DashMoney; reversed: DashMoney; net: DashMoney };

export type DashAging = { current: DashMoney; d31_60: DashMoney; d61_90: DashMoney; over90: DashMoney };

export type DashFloor = { floor: string; totalFlats: number; owingFlats: number; outstanding: DashMoney };

export type DashBuilding = { building: string; totalFlats: number; owingFlats: number; outstanding: DashMoney; floors: DashFloor[] };
