import type { FinanceDashboard } from "@/services/api/finance";

/** A small `GET /finance/dashboard` response: money as decimal strings, as the backend sends it. */
export function makeDashboard(overrides: Partial<FinanceDashboard> = {}): FinanceDashboard {
  return {
    asOf: "2026-11-15",
    months: 6,
    period: { period: "2026-11", status: "OPEN" },
    cohort: { charges: "512500.00", allocated: "441000.00", open: "71500.00", rate: "86.0" },
    billed: [{ period: "2026-10", amount: "500000.00" }, { period: "2026-11", amount: "512500.00" }],
    collected: [{ period: "2026-10", amount: "450000.00" }, { period: "2026-11", amount: "441000.00" }],
    receiptsByMethod: [
      { method: "CASH", gross: "148000.00", reversed: "0.00", net: "148000.00" },
      { method: "BANK_TRANSFER", gross: "171000.00", reversed: "-5000.00", net: "166000.00" },
      { method: "INSTAPAY", gross: "96000.00", reversed: "0.00", net: "96000.00" },
      { method: "CHEQUE", gross: "26000.00", reversed: "0.00", net: "26000.00" },
    ],
    outstanding: "1284000.00",
    credit: { netCreditFlats: 3, netCreditTotal: "4500.00", creditTotal: "6000.00" },
    aging: { current: "412000.00", d31_60: "301000.00", d61_90: "228000.00", over90: "343000.00" },
    owingFlats: 137,
    totalFlats: 400,
    fundBalance: "3420000.00",
    deposits: { billed: "0.00", collected: "25000.00" },
    unapplied: {
      count: 2,
      total: "6250.00",
      oldest: [
        { paymentId: "p1", flatId: "f1", flatLabel: "A2-3-1", method: "BANK_TRANSFER", receivedAt: "2026-11-13", unallocated: "3750.00", ageDays: 2 },
        { paymentId: "p2", flatId: "f2", flatLabel: "B1-6-3", method: "INSTAPAY", receivedAt: "2026-11-12", unallocated: "2500.00", ageDays: 3 },
      ],
    },
    pendingCheques: { count: 0, total: "0.00" },
    checks: { previewBillingRuns: 0, previewImportBatches: 0, operatingChargesInMonth: 400 },
    byBuilding: [
      { building: "C1", totalFlats: 60, owingFlats: 26, outstanding: "254000.00", floors: [{ floor: "1", totalFlats: 10, owingFlats: 5, outstanding: "12000.00" }] },
      { building: "A1", totalFlats: 52, owingFlats: 18, outstanding: "168000.00", floors: [] },
    ],
    topOwing: [
      { flatId: "f9", label: "A1-3-5", ownerName: "Mona", ownerDeleted: false, balance: "18750.00", daysPastDue: 214 },
      { flatId: "f10", label: "C1-2-3", ownerName: null, ownerDeleted: true, balance: "16250.00", daysPastDue: 0 },
    ],
    series: [
      { period: "2026-10", date: "2026-10-31", outstanding: "1244000.00", owingFlats: 132, fundBalance: "3350000.00" },
      { period: "2026-11", date: "2026-11-15", outstanding: "1284000.00", owingFlats: 137, fundBalance: "3420000.00" },
    ],
    previous: {
      asOf: "2026-10-15",
      cohort: { charges: "500000.00", allocated: "400000.00", open: "100000.00", rate: "80.0" },
      collected: "300000.00",
      outstanding: "1244000.00",
      owingFlats: 132,
      fundBalance: "3350000.00",
    },
    deltas: { collected: "47.0", outstanding: "3.2", owingFlats: "3.8", fundBalance: null, rate: "6.0" },
    ...overrides,
  };
}
