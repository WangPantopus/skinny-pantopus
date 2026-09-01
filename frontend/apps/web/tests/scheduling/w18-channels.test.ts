import {
  buildChannelViews,
  digitsOnly,
  isCompleteCode,
  isValidEmail,
  isValidPhone,
  pushPromptMode,
  pushResultMode,
  pushStatus,
  readPushPermission,
  statusWord,
} from "@/components/scheduling/polish/channelState";

describe("W18 · H15 channel state machine", () => {
  describe("pushStatus", () => {
    it("maps each browser permission to a channel status", () => {
      expect(pushStatus("granted")).toBe("on");
      expect(pushStatus("denied")).toBe("blocked");
      expect(pushStatus("default")).toBe("off");
      expect(pushStatus("unsupported")).toBe("unsupported");
    });
  });

  describe("pushPromptMode", () => {
    it("opens the right prompt frame for the push action", () => {
      expect(pushPromptMode("granted")).toBe("connected");
      expect(pushPromptMode("denied")).toBe("denied");
      expect(pushPromptMode("default")).toBe("push");
      expect(pushPromptMode("unsupported")).toBe("push");
    });
  });

  describe("pushResultMode", () => {
    it("routes to connected only when granted", () => {
      expect(pushResultMode("granted")).toBe("connected");
      expect(pushResultMode("denied")).toBe("denied");
      expect(pushResultMode("default")).toBe("denied");
    });
  });

  describe("statusWord", () => {
    it("always yields a text label (status is never color-alone)", () => {
      expect(statusWord("on")).toBe("On");
      expect(statusWord("off")).toBe("Not set up");
      expect(statusWord("blocked")).toBe("Blocked");
      expect(statusWord("soon")).toBe("Coming soon");
      expect(statusWord("unsupported")).toBe("Not supported");
    });
  });

  describe("buildChannelViews", () => {
    it("returns push / email / sms rows in order", () => {
      const ids = buildChannelViews("default").map((v) => v.id);
      expect(ids).toEqual(["push", "email", "sms"]);
    });

    it("reflects the live push permission on the push row", () => {
      const off = buildChannelViews("default")[0];
      expect(off.status).toBe("off");
      expect(off.actionLabel).toBe("Turn on");

      const on = buildChannelViews("granted")[0];
      expect(on.status).toBe("on");
      expect(on.actionLabel).toBe("Manage");

      const blocked = buildChannelViews("denied")[0];
      expect(blocked.status).toBe("blocked");
      expect(blocked.actionLabel).toBe("How to enable");

      const unsupported = buildChannelViews("unsupported")[0];
      expect(unsupported.status).toBe("unsupported");
      expect(unsupported.actionLabel).toBeNull();
    });

    it("email is the always-on baseline and uses the account email when known", () => {
      const generic = buildChannelViews("default")[1];
      expect(generic.status).toBe("on");
      expect(generic.detail).toMatch(/account email/i);

      const known = buildChannelViews("default", "maria@pantopus.co")[1];
      expect(known.detail).toContain("maria@pantopus.co");
    });

    it("sms is coming soon", () => {
      const sms = buildChannelViews("default")[2];
      expect(sms.status).toBe("soon");
      expect(sms.statusLabel).toBe("Coming soon");
    });
  });

  describe("verify-field validation", () => {
    it("validates email addresses", () => {
      expect(isValidEmail("maria@pantopus.co")).toBe(true);
      expect(isValidEmail("  maria@pantopus.co  ")).toBe(true);
      expect(isValidEmail("nope")).toBe(false);
      expect(isValidEmail("a@b")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });

    it("validates phone numbers by digit count", () => {
      expect(isValidPhone("555 123 4567")).toBe(true);
      expect(isValidPhone("+1 (555) 123-4567")).toBe(true);
      expect(isValidPhone("12345")).toBe(false);
      expect(digitsOnly("+1 (555) 123-4567")).toBe("15551234567");
    });

    it("checks one-time-code completeness", () => {
      expect(isCompleteCode("123456")).toBe(true);
      expect(isCompleteCode("12345")).toBe(false);
      expect(isCompleteCode("12345a")).toBe(false);
      expect(isCompleteCode("1234", 4)).toBe(true);
    });
  });

  describe("readPushPermission", () => {
    const original = (window as unknown as { Notification?: unknown })
      .Notification;
    afterEach(() => {
      (window as unknown as { Notification?: unknown }).Notification = original;
    });

    it("reads granted / denied / default from the Notification API", () => {
      (window as unknown as { Notification: unknown }).Notification = {
        permission: "granted",
      };
      expect(readPushPermission()).toBe("granted");
      (window as unknown as { Notification: unknown }).Notification = {
        permission: "denied",
      };
      expect(readPushPermission()).toBe("denied");
      (window as unknown as { Notification: unknown }).Notification = {
        permission: "default",
      };
      expect(readPushPermission()).toBe("default");
    });

    it("is unsupported-safe when the API is missing", () => {
      delete (window as unknown as { Notification?: unknown }).Notification;
      expect(readPushPermission()).toBe("unsupported");
    });
  });
});
