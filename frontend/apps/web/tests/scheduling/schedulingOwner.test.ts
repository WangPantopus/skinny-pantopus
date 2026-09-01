import {
  detectOwnerFromPath,
  ownerToParams,
} from "@/components/scheduling/schedulingOwner";

describe("detectOwnerFromPath (SchedulingOwner resolution — all 3 pillars)", () => {
  it("resolves the home pillar from /app/homes/:id", () => {
    expect(detectOwnerFromPath("/app/homes/home-123/calendar")).toEqual({
      ownerType: "home",
      homeId: "home-123",
    });
  });

  it("resolves the business pillar from /app/businesses/:id", () => {
    expect(detectOwnerFromPath("/app/businesses/biz-9/scheduling")).toEqual({
      ownerType: "business",
      ownerId: "biz-9",
    });
  });

  it("defaults to the personal pillar on scheduling routes", () => {
    expect(detectOwnerFromPath("/app/scheduling/bookings")).toEqual({
      ownerType: "user",
    });
  });

  it("ignores the homes index and creation routes", () => {
    expect(detectOwnerFromPath("/app/homes/find")).toEqual({
      ownerType: "user",
    });
    expect(detectOwnerFromPath("/app/businesses/new")).toEqual({
      ownerType: "user",
    });
  });

  it("defaults to personal when pathname is null", () => {
    expect(detectOwnerFromPath(null)).toEqual({ ownerType: "user" });
  });
});

describe("ownerToParams (wiring contract — all 3 pillars)", () => {
  it("sends nothing for personal", () => {
    expect(ownerToParams({ ownerType: "user" })).toEqual({});
    expect(ownerToParams(undefined)).toEqual({});
  });

  it("sends owner_type/owner_id for business", () => {
    expect(ownerToParams({ ownerType: "business", ownerId: "biz-9" })).toEqual({
      owner_type: "business",
      owner_id: "biz-9",
    });
  });

  it("mirrors owner_type/owner_id for home", () => {
    expect(ownerToParams({ ownerType: "home", homeId: "home-123" })).toEqual({
      owner_type: "home",
      owner_id: "home-123",
    });
  });

  it("omits params when the id is missing", () => {
    expect(ownerToParams({ ownerType: "business" })).toEqual({});
    expect(ownerToParams({ ownerType: "home" })).toEqual({});
  });
});
