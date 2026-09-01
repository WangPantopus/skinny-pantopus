//
//  SupportTrainActionsEndpoints.swift
//  Pantopus
//
//  S1 — the *write* half of the Support Trains surface: helper
//  reservations (reserve / cancel / deliver / confirm), the organizer's
//  address share, and the organizer management actions (lifecycle,
//  co-organizers, slots, nudges, gift fund).
//
//  Every route below was read out of `backend/routes/supportTrains.js`
//  and composed against the mount in `backend/app.js:404`
//  (`app.use('/api/activities/support-trains', supportTrainRoutes)`).
//  The read-side helpers live in `SupportTrainsEndpoints.swift`.
//

import Foundation

/// Base path for every Support Train route. The Express router is
/// mounted at `/api/activities/support-trains` (`backend/app.js:404`) —
/// there is no `/api/support-trains` alias anywhere in the backend.
public enum SupportTrainsAPI {
    public static let base = "/api/activities/support-trains"

    public static func path(_ supportTrainId: String, _ suffix: String = "") -> String {
        suffix.isEmpty ? "\(base)/\(supportTrainId)" : "\(base)/\(supportTrainId)\(suffix)"
    }
}

public enum SupportTrainActionsEndpoints {
    // MARK: - Helper reservations

    /// Reserve one open slot as a helper.
    ///
    /// Route: `backend/routes/supportTrains.js:2252` —
    /// `POST /:id/slots/:slotId/reserve`. Body validated by
    /// `reserveSchema` (l.2237): `contribution_mode` is required and must
    /// be one of `cook` / `takeout` / `groceries`, and the matching
    /// `enable_*` flag must be on. Responds `201` with the reservation row.
    public static func reserve(
        supportTrainId: String,
        slotId: String,
        body: ReserveSlotBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/slots/\(slotId)/reserve"),
            body: body
        )
    }

    /// Cancel a reservation. Allowed for the helper who owns it (send
    /// `helper_reason`) or a primary / co-organizer (send
    /// `organizer_reason`).
    ///
    /// Route: `backend/routes/supportTrains.js:2959` —
    /// `POST /:id/reservations/:reservationId/cancel`.
    public static func cancelReservation(
        supportTrainId: String,
        reservationId: String,
        body: CancelReservationBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/reservations/\(reservationId)/cancel"),
            body: body
        )
    }

    /// Share the exact delivery address with one helper (or email it to a
    /// guest signup). **Organizer-only** — the handler 403s for anyone
    /// else, so gate the affordance on `viewer_support_train_role`.
    ///
    /// Route: `backend/routes/supportTrains.js:2757` —
    /// `POST /:id/reservations/:reservationId/reveal-address`.
    public static func revealAddress(
        supportTrainId: String,
        reservationId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/reservations/\(reservationId)/reveal-address")
        )
    }

    /// Mark a reservation delivered. Helper (own reservation) or an
    /// organizer (guest signups). Only valid from `reserved`.
    ///
    /// Route: `backend/routes/supportTrains.js:3133` —
    /// `POST /:id/reservations/:reservationId/deliver`.
    public static func markDelivered(
        supportTrainId: String,
        reservationId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/reservations/\(reservationId)/deliver")
        )
    }

    /// Confirm a delivery. Recipient or organizer only; valid from
    /// `delivered`.
    ///
    /// Route: `backend/routes/supportTrains.js:3214` —
    /// `POST /:id/reservations/:reservationId/confirm`.
    public static func confirmDelivery(
        supportTrainId: String,
        reservationId: String
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/reservations/\(reservationId)/confirm")
        )
    }

    // MARK: - Lifecycle (organizer)

    /// Pause a published / active train. Primary or co-organizer.
    ///
    /// Route: `backend/routes/supportTrains.js:1440` — `POST /:id/pause`.
    public static func pause(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/pause"))
    }

    /// Resume a paused train. Primary or co-organizer.
    ///
    /// Route: `backend/routes/supportTrains.js:1473` — `POST /:id/resume`.
    public static func resume(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/resume"))
    }

    /// Send a published train back to draft. **Primary only** and only
    /// while there are no active reservations (409 otherwise).
    ///
    /// Route: `backend/routes/supportTrains.js:1387` — `POST /:id/unpublish`.
    public static func unpublish(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/unpublish"))
    }

    /// Archive a completed train. **Primary only**, `completed` → `archived`.
    ///
    /// Route: `backend/routes/supportTrains.js:1540` — `POST /:id/archive`.
    public static func archive(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/archive"))
    }

    /// Permanently delete the train (deletes the parent Activity).
    /// **Primary only**; 409s when helpers have committed or gift-fund
    /// contributions exist.
    ///
    /// Route: `backend/routes/supportTrains.js:3886` — `DELETE /:id`.
    public static func deleteTrain(supportTrainId: String) -> Endpoint {
        Endpoint(method: .delete, path: SupportTrainsAPI.path(supportTrainId))
    }

    // MARK: - Co-organizers

    /// List organizers (any viewer).
    ///
    /// Route: `backend/routes/supportTrains.js:1128` — `GET /:id/organizers`.
    public static func organizers(supportTrainId: String) -> Endpoint {
        Endpoint(method: .get, path: SupportTrainsAPI.path(supportTrainId, "/organizers"))
    }

    /// Add a co-organizer / recipient delegate. **Primary only.**
    ///
    /// Route: `backend/routes/supportTrains.js:1050` — `POST /:id/organizers`.
    public static func addOrganizer(
        supportTrainId: String,
        body: AddSupportTrainOrganizerBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/organizers"),
            body: body
        )
    }

    /// Remove a co-organizer. **Primary only**; the primary organizer
    /// themselves cannot be removed (409). Responds `204`.
    ///
    /// Route: `backend/routes/supportTrains.js:1091` —
    /// `DELETE /:id/organizers/:userId`.
    public static func removeOrganizer(
        supportTrainId: String,
        userId: String
    ) -> Endpoint {
        Endpoint(
            method: .delete,
            path: SupportTrainsAPI.path(supportTrainId, "/organizers/\(userId)")
        )
    }

    // MARK: - Slots

    /// Patch one slot — label / mode / date / times / capacity, or
    /// `status: "canceled"` to drop the date. Primary or co-organizer;
    /// 409 `SLOT_HAS_RESERVATIONS` when the slot is already taken.
    ///
    /// Route: `backend/routes/supportTrains.js:971` —
    /// `PATCH /:id/slots/:slotId`.
    public static func updateSlot(
        supportTrainId: String,
        slotId: String,
        body: UpdateSupportTrainSlotBody
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: SupportTrainsAPI.path(supportTrainId, "/slots/\(slotId)"),
            body: body
        )
    }

    // MARK: - Nudges

    /// Ask the AI drafter for an open-slots reminder. Primary or
    /// co-organizer. Responds `{ "message": "…" }`.
    ///
    /// Route: `backend/routes/supportTrains.js:2139` —
    /// `POST /:id/nudges/draft`.
    public static func draftNudge(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/nudges/draft"))
    }

    /// Post the reminder into the train's campaign chat. Primary or
    /// co-organizer; 422 `NO_CHAT_THREAD` before publish.
    ///
    /// Route: `backend/routes/supportTrains.js:2196` —
    /// `POST /:id/nudges/send`.
    public static func sendNudge(
        supportTrainId: String,
        body: SupportTrainNudgeBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/nudges/send"),
            body: body
        )
    }

    // MARK: - Gift fund

    /// Fund summary (any viewer). Returns `enabled:false` totals when no
    /// fund row exists yet.
    ///
    /// Route: `backend/routes/supportTrains.js:1938` — `GET /:id/fund`.
    public static func fund(supportTrainId: String) -> Endpoint {
        Endpoint(method: .get, path: SupportTrainsAPI.path(supportTrainId, "/fund"))
    }

    /// Enable (or re-enable / re-goal) the gift fund. Primary or
    /// co-organizer. `goal_amount` is in **cents**.
    ///
    /// Route: `backend/routes/supportTrains.js:1691` —
    /// `POST /:id/fund/enable`.
    public static func enableFund(
        supportTrainId: String,
        body: EnableSupportTrainFundBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: SupportTrainsAPI.path(supportTrainId, "/fund/enable"),
            body: body
        )
    }

    /// Disable the gift fund. **Primary only.**
    ///
    /// Route: `backend/routes/supportTrains.js:1754` —
    /// `POST /:id/fund/disable`.
    public static func disableFund(supportTrainId: String) -> Endpoint {
        Endpoint(method: .post, path: SupportTrainsAPI.path(supportTrainId, "/fund/disable"))
    }
}
