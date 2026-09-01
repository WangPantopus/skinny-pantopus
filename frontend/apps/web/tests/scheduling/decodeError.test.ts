import {
  decodeError,
  fieldErrors,
  asSlotConflict,
} from "@/components/scheduling/decodeError";

describe("decodeError", () => {
  it("decodes a 409 slot conflict with alternatives", () => {
    const decoded = decodeError({
      statusCode: 409,
      data: {
        error: "SLOT_TAKEN",
        message: "That time was just taken.",
        alternatives: [{ start: "a", end: "b", startLocal: "a" }],
      },
    });
    expect(decoded.kind).toBe("conflict");
    const conflict = asSlotConflict(decoded);
    expect(conflict?.error).toBe("SLOT_TAKEN");
    expect(conflict?.alternatives).toHaveLength(1);
    if (decoded.kind === "conflict")
      expect(decoded.message).toBe("That time was just taken.");
  });

  it("decodes a 400 validation error and maps field errors", () => {
    const decoded = decodeError({
      statusCode: 400,
      data: {
        error: "Validation failed",
        details: [
          { field: "email", message: "Email is required" },
          { field: "name", message: "Name is required" },
        ],
      },
    });
    expect(decoded.kind).toBe("validation");
    if (decoded.kind === "validation")
      expect(decoded.message).toBe("Email is required");
    expect(fieldErrors(decoded)).toEqual({
      email: "Email is required",
      name: "Name is required",
    });
  });

  it("decodes a paused page state", () => {
    const decoded = decodeError({
      statusCode: 409,
      data: { error: "PAGE_PAUSED", message: "Paused." },
    });
    expect(decoded.kind).toBe("paused");
  });

  it("decodes an expired link (410)", () => {
    const decoded = decodeError({
      statusCode: 410,
      data: { message: "Gone." },
    });
    expect(decoded.kind).toBe("expired");
  });

  it("decodes a 501 connect as not_implemented", () => {
    const decoded = decodeError({
      statusCode: 501,
      data: {
        error: "NOT_AVAILABLE",
        message: "External calendar sync is coming soon.",
      },
    });
    expect(decoded.kind).toBe("not_implemented");
  });

  it("decodes a 404 not_found", () => {
    const decoded = decodeError({
      statusCode: 404,
      data: { error: "NOT_FOUND", message: "Nope." },
    });
    expect(decoded.kind).toBe("not_found");
  });

  it("falls back to a generic error with the code preserved", () => {
    const decoded = decodeError({
      data: { error: "INTERNAL", message: "Boom." },
    });
    expect(decoded.kind).toBe("error");
    if (decoded.kind === "error") {
      expect(decoded.code).toBe("INTERNAL");
      expect(decoded.message).toBe("Boom.");
    }
    expect(asSlotConflict(decoded)).toBeNull();
  });

  it("always yields a message even for an empty error", () => {
    const decoded = decodeError({});
    expect(typeof decoded.message).toBe("string");
    expect(decoded.message.length).toBeGreaterThan(0);
  });
});
