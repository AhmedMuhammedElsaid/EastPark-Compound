import type { ResidentLead } from "@/services/api/admin";
import { inviteResultStatus, leadActions, leadErrorKey, leadMatches, leadUnitLabel } from "./resident-leads";

const lead: ResidentLead = {
  id: "lead-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "01000400163",
  building: "F2",
  floor: "11",
  flatNumber: "4",
  status: "INVITED",
  createdAt: "2026-10-06T10:00:00.000Z",
};

function httpError(status: number, code?: string) {
  return { response: { status, data: { code } } };
}

describe("leadActions", () => {
  it("invites new emails and offers reject while active", () => {
    expect(leadActions("PENDING")).toEqual({ invite: "send", reject: true });
    expect(leadActions("INVITED")).toEqual({ invite: "resend", reject: true });
    expect(leadActions("REJECTED")).toEqual({ invite: "reinvite", reject: false });
    expect(leadActions("CONVERTED")).toEqual({ invite: null, reject: false });
  });

  it("adds the flat to an existing account instead of inviting", () => {
    expect(leadActions("PENDING", true)).toEqual({ invite: "attach", reject: true });
    expect(leadActions("INVITED", true)).toEqual({ invite: "attach", reject: true });
    expect(leadActions("REJECTED", true)).toEqual({ invite: "attach", reject: false });
    expect(leadActions("CONVERTED", true)).toEqual({ invite: null, reject: false });
  });
});

describe("leadMatches", () => {
  it("matches name, email, unit and phone digits (Arabic-Indic too)", () => {
    expect(leadMatches(lead, "jane")).toBe(true);
    expect(leadMatches(lead, "F2 · 11 · 4")).toBe(true);
    expect(leadMatches(lead, "٠٤٠٠")).toBe(true);
    expect(leadMatches(lead, "nobody")).toBe(false);
    expect(leadMatches(lead, "  ")).toBe(true);
  });
});

describe("leadUnitLabel / inviteResultStatus", () => {
  it("formats the unit and reads the invite result", () => {
    expect(leadUnitLabel(lead)).toBe("F2 · 11 · 4");
    expect(inviteResultStatus("residentLead.success.alreadyRegistered")).toBe("CONVERTED");
    expect(inviteResultStatus("residentLead.success.invited")).toBe("INVITED");
  });
});

describe("leadErrorKey", () => {
  it("maps conflicts by action and backend code", () => {
    expect(leadErrorKey("invite", httpError(409, "unit.error.alreadyOwned"))).toBe("admin_leads.error_unit_owned");
    expect(leadErrorKey("invite", httpError(409, "residentLead.error.unitReserved"))).toBe("admin_leads.error_unit_reserved");
    expect(leadErrorKey("invite", httpError(409, "user.error.accountDeleted"))).toBe("admin.invite_account_deleted");
    expect(leadErrorKey("reject", httpError(409))).toBe("admin_leads.error_already_registered");
  });

  it("maps other statuses and transport failures", () => {
    expect(leadErrorKey("invite", httpError(404))).toBe("admin_leads.error_not_found");
    expect(leadErrorKey("invite", httpError(429))).toBe("errors.rate_limited");
    expect(leadErrorKey("reject", httpError(403))).toBe("errors.forbidden");
    expect(leadErrorKey("invite", httpError(500))).toBe("common.error");
    expect(leadErrorKey("invite", new Error("timeout"))).toBe("errors.unreachable");
  });
});
