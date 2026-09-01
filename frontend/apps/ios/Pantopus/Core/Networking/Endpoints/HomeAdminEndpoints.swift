//
//  HomeAdminEndpoints.swift
//  Pantopus
//
//  Owner / admin-only home administration routes: deleting a home,
//  changing a member's role, and reviewing household-access requests
//  raised by the claim flow's "ask a verified owner" path.
//
//  Kept out of `HomesEndpoints.swift` (already 600+ lines and shared by
//  a dozen features) so this surface owns its own file.
//

import Foundation

/// Endpoint builders for the home-administration routes in
/// `backend/routes/home.js` + `backend/routes/homeIam.js`.
public enum HomeAdminEndpoints {
    // MARK: - Delete home

    /// `DELETE /api/homes/:id` — route `backend/routes/home.js:3191`.
    ///
    /// Primary-owner only (`canUserDeleteHomeRecord`); other members get
    /// `403 DELETE_HOME_NOT_PRIMARY` and should leave the home instead.
    /// The `my-homes` payload pre-computes the same predicate as
    /// `can_delete_home`, so the UI gates on that flag.
    /// Responds `{ message }`.
    public static func deleteHome(homeId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)")
    }

    // MARK: - Viewer access

    /// `GET /api/homes/:id/me` — route `backend/routes/homeIam.js:51`.
    ///
    /// The viewer's own access record for this home: `is_owner`,
    /// `role_base`, and the five `can_manage_*` navigation booleans plus
    /// the raw `permissions[]` list. Drives whether the Members screen
    /// shows the manage affordances (role change, Requests tab).
    public static func myAccess(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/me")
    }

    // MARK: - Audit log

    /// `GET /api/homes/:id/audit-log` — route `backend/routes/homeIam.js:602`.
    ///
    /// Who did what to the household, newest first. Requires
    /// `members.manage` (403 otherwise), joins the actor `User` row, and
    /// responds `{ entries }`. `limit` / `offset` default to 50 / 0
    /// server-side; we send them explicitly so the page size is stable.
    public static func auditLog(
        homeId: String,
        limit: Int = 50,
        offset: Int = 0
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/audit-log",
            query: ["limit": "\(limit)", "offset": "\(offset)"]
        )
    }

    // MARK: - Member role

    /// `POST /api/homes/:id/members/:userId/role` — route
    /// `backend/routes/homeIam.js:212`.
    ///
    /// Body accepts `preset_key` **or** `role_base`; we send `role_base`
    /// picked from the backend's `ROLE_RANK` vocabulary
    /// (`backend/utils/homePermissions.js:31` — guest / restricted_member
    /// / member / manager / admin / owner). Requires `members.manage` and
    /// enforces rank: a non-owner can only assign roles strictly below
    /// their own, and only an owner may promote to owner.
    public static func changeMemberRole(
        homeId: String,
        userId: String,
        request: ChangeMemberRoleRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/members/\(userId)/role",
            body: request
        )
    }

    // MARK: - Household access requests

    /// `GET /api/homes/:id/household-access-requests` — route
    /// `backend/routes/home.js:2671`.
    ///
    /// Requests raised by people who used the claim flow's "ask a
    /// verified owner" path. `status` defaults to `pending` server-side;
    /// pass `all` to include resolved rows. Responds `{ requests }` with
    /// each row's `requester` User joined in.
    public static func householdAccessRequests(
        homeId: String,
        status: String = "pending"
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/household-access-requests",
            query: ["status": status]
        )
    }

    /// `POST /api/homes/:id/household-access-requests/:requestId/approve`
    /// — route `backend/routes/home.js:2714`.
    ///
    /// Approving does **not** add the person directly: it mints a
    /// personal `HomeInvite` and notifies them, so the response copy is
    /// "Invitation sent". Empty JSON body.
    public static func approveHouseholdAccessRequest(
        homeId: String,
        requestId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/household-access-requests/\(requestId)/approve",
            body: EmptyBody()
        )
    }

    /// `POST /api/homes/:id/household-access-requests/:requestId/reject`
    /// — route `backend/routes/home.js:2831`. Empty JSON body.
    public static func rejectHouseholdAccessRequest(
        homeId: String,
        requestId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/household-access-requests/\(requestId)/reject",
            body: EmptyBody()
        )
    }

    /// `{}` — the approve / reject routes read no fields but Express
    /// still expects a JSON body on POST.
    private struct EmptyBody: Encodable {}
}
