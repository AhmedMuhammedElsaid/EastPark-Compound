import {
  acceptInvitationErrorKey,
  getErrorCode,
  getErrorStatus,
  isAccountDeletedError,
  isInvalidInvitationError,
  isNoResponseError,
  loginErrorKey,
  pickErrorKey,
  sendInvitationErrorKey,
} from "@/lib/api-error";
import ar from "@/translations/ar.json";
import en from "@/translations/en.json";

describe("api-error", () => {
  it("treats errors without a response as network/timeouts", () => {
    expect(isNoResponseError({ code: "ECONNABORTED" })).toBe(true);
    expect(isNoResponseError(null)).toBe(true);
    expect(isNoResponseError({ response: { status: 500 } })).toBe(false);
    expect(getErrorStatus({ response: { status: 409 } })).toBe(409);
  });

  it("picks keys by status with network and fallback entries", () => {
    const map = { 409: "a", network: "n" };
    expect(pickErrorKey({ response: { status: 409 } }, map, "f")).toBe("a");
    expect(pickErrorKey({ response: { status: 418 } }, map, "f")).toBe("f");
    expect(pickErrorKey({}, map, "f")).toBe("n");
    expect(pickErrorKey({}, {}, "f")).toBe("f");
  });
});

describe("login error mapping", () => {
  it("says the credentials are wrong only for a 401", () => {
    expect(loginErrorKey({ response: { status: 401 } })).toBe("auth.errors.login_failed");
    expect(loginErrorKey({ response: { status: 500 } })).toBe("errors.server");
    expect(loginErrorKey({ response: { status: 502 } })).toBe("errors.server");
    expect(loginErrorKey({ response: { status: 503 } })).toBe("errors.server");
    expect(loginErrorKey({ response: { status: 400 } })).toBe("auth.errors.invalid_email");
    expect(loginErrorKey({ response: { status: 429 } })).toBe("errors.rate_limited");
    expect(loginErrorKey({ code: "ECONNABORTED" })).toBe("auth.errors.server_unreachable");
    expect(loginErrorKey({ response: { status: 404 } })).toBe("errors.unknown");
  });
});

describe("deleted-account 409 mapping", () => {
  const deleted = { response: { status: 409, data: { statusCode: 409, code: "user.error.accountDeleted", message: "user.error.accountDeleted" } } };
  const legacyDeleted = { response: { status: 409, data: { message: "user.error.accountDeleted" } } };
  const wrongPassword = { response: { status: 409, data: { message: "An account with this email already exists — enter its current password" } } };

  it("reads the stable code, or a raw key in message, never prose", () => {
    expect(getErrorCode(deleted)).toBe("user.error.accountDeleted");
    expect(getErrorCode(legacyDeleted)).toBe("user.error.accountDeleted");
    expect(getErrorCode(wrongPassword)).toBeUndefined();
    expect(getErrorCode({})).toBeUndefined();
    expect(isAccountDeletedError(deleted)).toBe(true);
    expect(isAccountDeletedError({ response: { status: 400, data: { code: "user.error.accountDeleted" } } })).toBe(false);
  });

  it("accept-invitation: deleted account never gets the current-password hint", () => {
    expect(acceptInvitationErrorKey(deleted)).toBe("auth.errors.invitation_account_deleted");
    expect(acceptInvitationErrorKey(legacyDeleted)).toBe("auth.errors.invitation_account_deleted");
    expect(acceptInvitationErrorKey(wrongPassword)).toBe("auth.errors.invitation_existing_account");
    expect(acceptInvitationErrorKey({ response: { status: 500 } })).toBe("errors.server");
    expect(acceptInvitationErrorKey({})).toBe("errors.unreachable");
  });

  it("accept-invitation: a flat owned by another account is not a password problem", () => {
    const unitOwned = { response: { status: 409, data: { statusCode: 409, code: "unit.error.alreadyOwned", message: "This flat already belongs to another account" } } };
    expect(acceptInvitationErrorKey(unitOwned)).toBe("auth.errors.invitation_unit_owned");
    expect(acceptInvitationErrorKey({ response: { status: 409, data: { code: "order.error.other" } } })).toBe("common.error");
  });

  it("accept-invitation: used, expired or unknown invitations need a new invitation", () => {
    const used = { response: { status: 400, data: { statusCode: 400, message: "Invitation already used" } } };
    const expired = { response: { status: 400, data: { statusCode: 400, message: "Invitation expired", error: "BadRequestException: Invitation expired (stack)" } } };
    const unknown = { response: { status: 404, data: { statusCode: 404, message: "Invitation not found" } } };
    const validation = { response: { status: 400, data: { statusCode: 400, message: "Bad Request", error: ["password must match"] } } };
    for (const err of [used, expired, unknown]) {
      expect(isInvalidInvitationError(err)).toBe(true);
      expect(acceptInvitationErrorKey(err)).toBe("auth.invitation_invalid");
    }
    expect(isInvalidInvitationError(validation)).toBe(false);
    expect(acceptInvitationErrorKey(validation)).toBe("auth.errors.password_requirements");
    expect(acceptInvitationErrorKey({ response: { status: 429 } })).toBe("errors.rate_limited");
    expect(isInvalidInvitationError({ response: { status: 409 } })).toBe(false);
  });

  it("admin invitations: deleted account, forbidden, fallback", () => {
    expect(sendInvitationErrorKey(deleted)).toBe("admin.invite_account_deleted");
    expect(sendInvitationErrorKey({ response: { status: 403 } })).toBe("admin.invite_forbidden");
    expect(sendInvitationErrorKey({ response: { status: 409 } })).toBe("common.error");
  });

  it("has en and ar copy for the new keys", () => {
    for (const json of [en, ar]) {
      expect(json.admin.invite_account_deleted).toEqual(expect.any(String));
      expect(json.auth.errors.invitation_account_deleted).toEqual(expect.any(String));
      expect(json.auth.errors.invitation_unit_owned).toEqual(expect.any(String));
    }
  });
});
