//
//  BusinessTeamEndpoints.swift
//  Pantopus
//
//  Endpoint builders for owner-side business team & roles management.
//  Spans `backend/routes/businessIam.js` (members / roles / permissions)
//  and `backend/routes/businessSeats.js` (pending seat invites). Both are
//  mounted at `/api/businesses`.
//

import Foundation

/// Endpoints for the Business Team screen (clone of the per-home Members
/// surface, pointed at the businessIam + businessSeats families).
public enum BusinessTeamEndpoints {
    /// `GET /api/businesses/:id/me` — the caller's access + permissions.
    /// Used to gate `team.view` / `team.manage` / `team.invite` actions.
    /// Route `backend/routes/businessIam.js:42`.
    public static func access(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/me")
    }

    /// `GET /api/businesses/:id/role-presets` — assignable role presets for
    /// the role-change picker. Route `backend/routes/businessIam.js:80`.
    public static func rolePresets(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/role-presets")
    }

    /// `GET /api/businesses/:id/members` — active team members with the
    /// joined user record. Grouped client-side by `role_base`. Route
    /// `backend/routes/businessIam.js:104`.
    public static func members(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/members")
    }

    /// `POST /api/businesses/:id/members/:userId/role` — change a member's
    /// role via a preset key. Route `backend/routes/businessIam.js:224`.
    public static func changeRole(
        businessId: String,
        userId: String,
        request: BusinessChangeRoleRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/members/\(userId)/role",
            body: request
        )
    }

    /// `GET /api/businesses/:id/members/:userId/permissions` — the member's
    /// effective permission set. Route `backend/routes/businessIam.js:493`.
    public static func memberPermissions(businessId: String, userId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/businesses/\(businessId)/members/\(userId)/permissions"
        )
    }

    /// `POST /api/businesses/:id/members/:userId/permissions` — toggle a
    /// single scoped permission. Route `backend/routes/businessIam.js:410`.
    public static func togglePermission(
        businessId: String,
        userId: String,
        request: BusinessTogglePermissionRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/members/\(userId)/permissions",
            body: request
        )
    }

    /// `DELETE /api/businesses/:id/members/:userId` — remove a member.
    /// Route `backend/routes/businessIam.js:525`.
    public static func removeMember(businessId: String, userId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/businesses/\(businessId)/members/\(userId)")
    }

    /// `GET /api/businesses/:id/seats` — all seats; the Team screen keeps
    /// only `invite_status == "pending"` rows. Route
    /// `backend/routes/businessSeats.js:425`.
    public static func seats(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/seats")
    }

    /// `POST /api/businesses/:id/seats/invite` — create a seat + invite.
    /// Route `backend/routes/businessSeats.js:495`.
    public static func inviteSeat(
        businessId: String,
        request: BusinessSeatInviteRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/seats/invite",
            body: request
        )
    }

    /// `DELETE /api/businesses/:id/seats/:seatId` — cancel a pending seat
    /// invite (soft-delete). Route `backend/routes/businessSeats.js:698`.
    public static func cancelSeat(businessId: String, seatId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/businesses/\(businessId)/seats/\(seatId)")
    }
}
