//
//  GigsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/gigs.js` — list (with category +
//  sort + radius), nearby, in-bounds map mode, save/unsave, detail, and
//  the Phase 5 lifecycle routes (counter / reject / start / no-show /
//  report / cancellation preview).
//

// swiftlint:disable cyclomatic_complexity file_length

import Foundation

/// Endpoints under `/api/gigs/*`.
public enum GigsEndpoints {
    /// `GET /api/gigs` — paginated list with filter + sort. The backend
    /// excludes the caller's own gigs by default. Besides category +
    /// sort it models price bounds (`minPrice`/`maxPrice`), a single
    /// `schedule_type`, `pay_type` (e.g. "offers"), and a `deadline`
    /// window ("today" | "tomorrow" | "this_week"). Route
    /// `backend/routes/gigs.js:2083`.
    public static func list(
        category: String? = nil,
        sort: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        radiusMiles: Double? = nil,
        includeRemote: Bool? = nil,
        minPrice: Double? = nil,
        maxPrice: Double? = nil,
        payType: String? = nil,
        scheduleType: String? = nil,
        deadline: String? = nil,
        maxDistanceMeters: Int? = nil,
        taskArchetype: String? = nil,
        search: String? = nil,
        limit: Int = 20,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = [
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let category, category != "all" { query["category"] = category }
        if let sort { query["sort"] = sort }
        if let latitude { query["latitude"] = String(latitude) }
        if let longitude { query["longitude"] = String(longitude) }
        if let radiusMiles { query["radiusMiles"] = String(radiusMiles) }
        if let includeRemote { query["includeRemote"] = includeRemote ? "true" : "false" }
        if let minPrice { query["minPrice"] = String(minPrice) }
        if let maxPrice { query["maxPrice"] = String(maxPrice) }
        if let payType { query["pay_type"] = payType }
        if let scheduleType { query["schedule_type"] = scheduleType }
        if let deadline { query["deadline"] = deadline }
        if let maxDistanceMeters { query["max_distance"] = String(maxDistanceMeters) }
        if let taskArchetype { query["task_archetype"] = taskArchetype }
        if let search, !search.isEmpty { query["search"] = search }
        return Endpoint(method: .get, path: "/api/gigs", query: query)
    }

    /// `GET /api/gigs/browse` — sectioned browse feed (best matches /
    /// urgent / clusters / high paying / new today / quick jobs) around
    /// `lat`/`lng`. `radius` is **meters** to match the backend
    /// signature. Route `backend/routes/gigs.js:3190`.
    public static func browse(lat: Double, lng: Double, radiusMeters: Int) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/browse",
            query: [
                "lat": String(lat),
                "lng": String(lng),
                "radius": String(radiusMeters)
            ]
        )
    }

    /// `GET /api/gigs/price-benchmark` — low/median/high price benchmark
    /// for a category, optionally geo-scoped. Route
    /// `backend/routes/gigs.js:2985`.
    public static func priceBenchmark(
        category: String,
        lat: Double? = nil,
        lng: Double? = nil
    ) -> Endpoint {
        var query: [String: String] = ["category": category]
        if let lat { query["lat"] = String(lat) }
        if let lng { query["lng"] = String(lng) }
        return Endpoint(method: .get, path: "/api/gigs/price-benchmark", query: query)
    }

    /// `POST /api/gigs/:gigId/dismiss` — "Not interested": hides the gig
    /// from the caller's feed + records an affinity signal. Route
    /// `backend/routes/gigs.js:8523`.
    public static func dismissGig(gigId: String, reason: String? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/dismiss",
            body: DismissGigBody(reason: reason)
        )
    }

    /// `DELETE /api/gigs/:gigId/dismiss` — undo a dismissal. Route
    /// `backend/routes/gigs.js:8572`.
    public static func undoDismissGig(gigId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/gigs/\(gigId)/dismiss")
    }

    /// `GET /api/gigs/hidden-categories` — the caller's hidden category
    /// list. Route `backend/routes/gigs.js:3437`.
    public static func hiddenCategories() -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/hidden-categories")
    }

    /// `POST /api/gigs/hidden-categories` — hide every gig in a category
    /// from the caller's feed. Route `backend/routes/gigs.js:3461`.
    public static func hideCategory(_ category: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/hidden-categories",
            body: HideCategoryBody(category: category)
        )
    }

    /// `DELETE /api/gigs/hidden-categories/:category` — unhide a
    /// category. Route `backend/routes/gigs.js:3495`.
    public static func unhideCategory(_ category: String) -> Endpoint {
        let escaped = category.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? category
        return Endpoint(method: .delete, path: "/api/gigs/hidden-categories/\(escaped)")
    }

    /// `POST /api/gigs/magic-draft` — parse plain-English describe text
    /// into a structured draft (title / category / budget / schedule +
    /// per-field confidence and an optional clarifying question). Route
    /// `backend/routes/magicTask.js:335`.
    public static func magicDraft(body: MagicDraftRequestBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/magic-draft", body: body)
    }

    /// `POST /api/gigs/magic-post` — create a gig from a (magic or
    /// classic) draft with a 10-second undo window. The gig is inserted
    /// immediately but hidden from search/feed until the window lapses.
    /// Route `backend/routes/magicTask.js:397`.
    public static func magicPost(body: MagicPostBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/magic-post", body: body)
    }

    /// `POST /api/gigs/:gigId/undo` — undo a freshly magic-posted gig
    /// (within the 10-second undo window; deletes it entirely). Route
    /// `backend/routes/magicTask.js:682`.
    public static func undoGig(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/undo")
    }

    /// `GET /api/gigs/templates/library` — static smart-template chips
    /// for the Magic describe step's inspiration row. Route
    /// `backend/routes/magicTask.js:326`.
    public static func templatesLibrary() -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/templates/library")
    }

    /// `GET /api/gigs/nearby` — radius search around `latitude/longitude`.
    /// `radius` is **meters** to match the backend signature.
    public static func nearby(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int = 5000,
        status: String = "open",
        limit: Int = 20
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/nearby",
            query: [
                "latitude": String(latitude),
                "longitude": String(longitude),
                "radius": String(radiusMeters),
                "status": status,
                "limit": String(limit)
            ]
        )
    }

    /// `GET /api/gigs/in-bounds` — map-viewport pins for T2.4 Map+List
    /// and the A11.1 Tasks map. Response also carries
    /// `nearest_activity_center` (only when the viewport has zero gigs)
    /// for the empty-state "Jump to activity" recenter.
    /// Route backend/routes/gigs.js:2603
    public static func inBounds(
        minLat: Double,
        minLon: Double,
        maxLat: Double,
        maxLon: Double,
        category: String? = nil,
        includeRemote: Bool? = nil,
        status: String = "open"
    ) -> Endpoint {
        var query: [String: String] = [
            "min_lat": String(minLat),
            "min_lon": String(minLon),
            "max_lat": String(maxLat),
            "max_lon": String(maxLon),
            "status": status
        ]
        if let category, category != "all" { query["category"] = category }
        if let includeRemote { query["includeRemote"] = includeRemote ? "true" : "false" }
        return Endpoint(method: .get, path: "/api/gigs/in-bounds", query: query)
    }

    /// `GET /api/gigs/:id` — single-gig detail wrapper.
    public static func detail(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(id)")
    }

    /// `GET /api/gigs/:gigId/bids` — list bids on a gig. Owner-only —
    /// other callers get 403 and the detail view hides the section.
    public static func bids(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/bids")
    }

    /// `GET /api/gigs/:gigId/chat-room` — get-or-create the gig chat
    /// room. Pre-bid users are added as participants (message-limited).
    public static func chatRoom(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/chat-room")
    }

    /// `GET /api/gigs/:gigId/questions` — structured Q&A thread (public).
    public static func questions(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/questions")
    }

    /// `POST /api/gigs/:gigId/questions` — ask a question (auth).
    public static func askQuestion(gigId: String, body: AskGigQuestionBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/questions", body: body)
    }

    /// `POST /api/gigs/:gigId/questions/:questionId/answer` — poster answers.
    public static func answerQuestion(
        gigId: String,
        questionId: String,
        body: AnswerGigQuestionBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/questions/\(questionId)/answer",
            body: body
        )
    }

    /// `POST /api/gigs/:gigId/bids` — place a bid.
    public static func placeBid(gigId: String, body: PlaceBidBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids", body: body)
    }

    /// `PUT /api/gigs/:gigId/bids/:bidId` — update a placed bid. Backend
    /// only allows updates while the bid is `pending` or `countered`.
    /// Route `backend/routes/gigs.js:3971`.
    public static func updateBid(gigId: String, bidId: String, body: PlaceBidBody) -> Endpoint {
        Endpoint(method: .put, path: "/api/gigs/\(gigId)/bids/\(bidId)", body: body)
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/accept` — poster accepts a bid.
    /// Paid gigs return PaymentSheet params and require `finalizeAcceptBid`
    /// after the sheet completes.
    public static func acceptBid(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/accept")
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/finalize-accept` — completes a
    /// paid bid acceptance after PaymentSheet authorizes the charge.
    public static func finalizeAcceptBid(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/finalize-accept")
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/abort-accept` — restores a
    /// pending-payment bid when the sheet is canceled or declined.
    public static func abortAcceptBid(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/abort-accept")
    }

    /// `DELETE /api/gigs/:gigId/bids/:bidId` — withdraw a placed bid.
    /// Body carries a structured `WithdrawBidReason`. Backend records
    /// `withdrawal_reason` + `withdrawn_at` and returns a
    /// `rebid_available_at` timestamp (5 min cooldown). Route
    /// `backend/routes/gigs.js:5245`.
    public static func withdrawBid(gigId: String, bidId: String, reason: WithdrawBidReason?) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/gigs/\(gigId)/bids/\(bidId)",
            body: WithdrawBidBody(reason: reason)
        )
    }

    /// `POST /api/gigs/:gigId/mark-completed` — worker marks an
    /// assigned gig as done. Body accepts an optional `note` plus an
    /// optional array of proof-photo `photos` URLs (uploaded first via
    /// `POST /api/files/upload`); the backend stores them as
    /// `completion_photos`. Route `backend/routes/gigs.js:6092`.
    public static func markCompleted(gigId: String, note: String? = nil, photos: [String]? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/mark-completed",
            body: MarkCompletedBody(note: note, photos: photos)
        )
    }

    /// `POST /api/gigs/:id/save` — bookmark.
    public static func save(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(id)/save")
    }

    /// `DELETE /api/gigs/:id/save` — un-bookmark.
    public static func unsave(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/gigs/\(id)/save")
    }

    /// `GET /api/gigs/my-gigs` — list the caller's posted gigs with
    /// inlined bid count, top bid amount, top-3 bidder thumbnails, and
    /// boost timestamps. Route `backend/routes/gigs.js:1169`.
    public static func myGigs(limit: Int = 100, status: String? = nil) -> Endpoint {
        var query: [String: String] = ["limit": String(limit)]
        if let status, !status.isEmpty { query["status"] = status }
        return Endpoint(method: .get, path: "/api/gigs/my-gigs", query: query)
    }

    /// `POST /api/gigs/:gigId/boost` — poster promotes their gig in the
    /// feed for 24h. Route `backend/routes/gigs.js`.
    public static func boostGig(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/boost")
    }

    /// `POST /api/gigs/:gigId/complete` — poster confirms completion.
    /// Alias of `/confirm-completion`. Route
    /// `backend/routes/gigs.js:6170`. Distinct from `markCompleted(...)`
    /// which is the worker-only `/mark-completed` route.
    public static func completeGigAsPoster(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/complete")
    }

    /// `POST /api/gigs/:gigId/cancel` — poster cancels the gig. Body
    /// carries a structured `CancelGigReason`. Route
    /// `backend/routes/gigs.js:6233`.
    public static func cancelGig(gigId: String, reason: CancelGigReason?) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/gigs/\(gigId)/cancel",
            body: CancelGigBody(reason: reason)
        )
    }

    /// `POST /api/gigs` — create a new gig. Route
    /// `backend/routes/gigs.js:841`. The full schema accepts ~40 fields;
    /// the Post-a-Task wizard sends the eight required ones plus a
    /// handful of optional Magic Task tags (`schedule_type`, `pay_type`,
    /// `task_format`).
    public static func create(_ body: CreateGigBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs", body: body)
    }

    /// `PATCH /api/gigs/:id` — owner-only edit of an `open` gig (the
    /// backend 403s non-owners and 400s any non-open status). Accepts
    /// the same field names as create; unknown fields are stripped
    /// server-side (`stripUnknown`). Route `backend/routes/gigs.js:3587`.
    public static func update(id: String, body: UpdateGigBody) -> Endpoint {
        Endpoint(method: .patch, path: "/api/gigs/\(id)", body: body)
    }

    // MARK: - Phase 5 — lifecycle

    /// `POST /api/gigs/:gigId/bids/:bidId/reject` — poster rejects a
    /// bid; the bidder is notified and the bid flips to `rejected`.
    /// Returns `{message}`. Route `backend/routes/gigs.js:5028`.
    public static func rejectBid(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/reject")
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/counter` — poster counters a
    /// pending bid with `{amount, message?}`. The bid becomes
    /// `countered` and carries `counter_amount`; returns `{bid}`.
    /// Route `backend/routes/gigs.js:5099`.
    public static func counterBid(gigId: String, bidId: String, body: CounterBidBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/counter", body: body)
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/counter/accept` — bidder
    /// accepts the poster's counter: `bid_amount` becomes the counter
    /// amount and the bid reverts to `pending`. Returns `{bid}`.
    /// Route `backend/routes/gigs.js:5187`.
    public static func acceptCounter(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/counter/accept")
    }

    /// `POST /api/gigs/:gigId/bids/:bidId/counter/decline` — bidder
    /// declines the counter; the original pending bid stands. Returns
    /// `{bid}`. Route `backend/routes/gigs.js:5263`.
    public static func declineCounter(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/counter/decline")
    }

    /// `POST /api/gigs/:gigId/instant-accept` — helper claims an
    /// `instant_accept` open gig (viewer ≠ owner). Atomic open→assigned
    /// transition; paid gigs may ride PaymentSheet params for the
    /// *poster* (`requiresPaymentSetup`). Route
    /// `backend/routes/gigsV2.js:64`.
    public static func instantAccept(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/instant-accept")
    }

    /// `POST /api/gigs/:gigId/worker-ack` — assigned worker
    /// acknowledges before start: `status` is `starting_now` or
    /// `running_late` (+ optional `eta_minutes` 1–480, `note`). Only
    /// while the gig is `assigned` and not yet started. Route
    /// `backend/routes/gigs.js:5840`.
    public static func workerAck(gigId: String, body: WorkerAckBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/worker-ack", body: body)
    }

    /// `POST /api/gigs/:gigId/start` — the **assigned worker** starts
    /// work (assigned → in_progress). Paid gigs are payment-guarded
    /// server-side. Route `backend/routes/gigs.js:5503`.
    public static func startGig(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/start")
    }

    /// `GET /api/gigs/:gigId/no-show-check` — should the viewer see a
    /// "Report no-show" affordance? Returns `{can_report, reason, ...}`
    /// timing info for poster or worker on assigned/in_progress gigs.
    /// Route `backend/routes/gigs.js:7722`.
    public static func noShowCheck(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/no-show-check")
    }

    /// `POST /api/gigs/:gigId/report-no-show` — report the other party
    /// as a no-show. Body `{description?, evidence_urls?}`; cancels the
    /// gig (zone 3) and penalizes the no-show party. Route
    /// `backend/routes/gigs.js:7574`.
    public static func reportNoShow(gigId: String, body: ReportNoShowBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/report-no-show", body: body)
    }

    /// `POST /api/gigs/:gigId/report` — flag a gig for moderation.
    /// Body `{reason, details?≤1000}` with the backend reason enum;
    /// repeat reports return `already_reported: true`. Route
    /// `backend/routes/gigs.js:3112`.
    public static func reportGig(gigId: String, body: ReportGigBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/report", body: body)
    }

    /// `GET /api/gigs/:gigId/cancellation-preview` — zone / fee / grace
    /// info shown before cancelling (poster or worker). Route
    /// `backend/routes/gigs.js:6356`.
    public static func cancellationPreview(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/cancellation-preview")
    }

    /// `POST /api/gigs/:gigId/reschedule` — poster moves an `assigned`
    /// gig to a new future `scheduled_start` instead of cancelling (the
    /// preview's `can_reschedule` path; zone <= 1). Resets the worker's
    /// on-my-way ack, notifies them (`gig_rescheduled`), and fires the
    /// `gig:rescheduled` room event. Returns `{message, gig}`. Route
    /// `backend/routes/gigs.js:6405`.
    public static func reschedule(gigId: String, body: RescheduleGigBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/reschedule", body: body)
    }

    // MARK: - Phase 5b — payment + change orders

    /// `GET /api/gigs/:gigId/payment` — `{payment, stateInfo}` for the
    /// poster or worker (403 otherwise; both fields `null` when no
    /// payment is linked). Amounts are cents. Route
    /// `backend/routes/gigs.js:8440`.
    public static func payment(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/payment")
    }

    /// `GET /api/gigs/:gigId/change-orders` — `{change_orders: [...]}`
    /// newest-first, poster or worker only. Route
    /// `backend/routes/gigs.js:6640`.
    public static func changeOrders(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/change-orders")
    }

    /// `POST /api/gigs/:gigId/change-orders` — either party proposes a
    /// change on an assigned / in-progress gig (max 5 pending). Route
    /// `backend/routes/gigs.js:6691`.
    public static func createChangeOrder(gigId: String, body: CreateChangeOrderBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/change-orders", body: body)
    }

    /// `POST .../change-orders/:orderId/approve` — the counterparty
    /// approves; price deltas apply to the gig. Route
    /// `backend/routes/gigs.js:6828`.
    public static func approveChangeOrder(gigId: String, orderId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/change-orders/\(orderId)/approve")
    }

    /// `POST .../change-orders/:orderId/reject` — the counterparty
    /// declines (optional `{reason}` body omitted here). Route
    /// `backend/routes/gigs.js:6913`.
    public static func rejectChangeOrder(gigId: String, orderId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/change-orders/\(orderId)/reject")
    }

    /// `POST .../change-orders/:orderId/withdraw` — the proposer pulls
    /// their own pending request. Route `backend/routes/gigs.js:6994`.
    public static func withdrawChangeOrder(gigId: String, orderId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/change-orders/\(orderId)/withdraw")
    }
}

/// Body for `POST /api/gigs/:gigId/dismiss`. Reason is optional
/// free-text the backend truncates at 500 chars.
public struct DismissGigBody: Encodable, Sendable {
    public let reason: String?

    public init(reason: String?) {
        self.reason = reason
    }
}

/// Body for `POST /api/gigs/hidden-categories`.
public struct HideCategoryBody: Encodable, Sendable {
    public let category: String

    public init(category: String) {
        self.category = category
    }
}

/// Reasons the backend whitelists for `DELETE /api/gigs/:gigId/bids/:bidId`.
/// Anything else falls through as `null` on the server side.
public enum WithdrawBidReason: String, Sendable, CaseIterable {
    case scheduleConflict = "schedule_conflict"
    case underpriced
    case mistake
    case other

    /// User-facing label rendered in the withdraw sheet.
    public var label: String {
        switch self {
        case .scheduleConflict: "Schedule conflict"
        case .underpriced: "Underpriced my bid"
        case .mistake: "Made a mistake"
        case .other: "Other reason"
        }
    }
}

/// Body for `DELETE /api/gigs/:gigId/bids/:bidId`. Reason is optional —
/// the backend whitelist accepts a small set of values.
public struct WithdrawBidBody: Encodable, Sendable {
    public let reason: String?

    public init(reason: WithdrawBidReason?) {
        self.reason = reason?.rawValue
    }
}

/// Body for `POST /api/gigs/:gigId/mark-completed`. The backend shape
/// accepts `note`, `photos` (proof-of-delivery URLs), and `checklist`.
/// The Delivery Proof sheet sends `note` + `photos`; `checklist` is
/// omitted (encoded only when non-nil).
public struct MarkCompletedBody: Encodable, Sendable {
    public let note: String?
    public let photos: [String]?

    public init(note: String? = nil, photos: [String]? = nil) {
        self.note = note
        self.photos = photos
    }
}

/// Body for `POST /api/gigs/:gigId/bids/:bidId/counter`. The backend
/// requires a positive `amount`; `message` is optional.
public struct CounterBidBody: Encodable, Sendable {
    public let amount: Double
    public let message: String?

    public init(amount: Double, message: String? = nil) {
        self.amount = amount
        self.message = message
    }
}

/// Body for `POST /api/gigs/:gigId/worker-ack`.
public struct WorkerAckBody: Encodable, Sendable {
    public let status: String
    public let etaMinutes: Int?
    public let note: String?

    public init(status: String = "starting_now", etaMinutes: Int? = nil, note: String? = nil) {
        self.status = status
        self.etaMinutes = etaMinutes
        self.note = note
    }

    enum CodingKeys: String, CodingKey {
        case status, note
        case etaMinutes = "eta_minutes"
    }
}

/// Body for `POST /api/gigs/:gigId/report-no-show`.
public struct ReportNoShowBody: Encodable, Sendable {
    public let description: String?
    public let evidenceUrls: [String]?

    public init(description: String? = nil, evidenceUrls: [String]? = nil) {
        self.description = description
        self.evidenceUrls = evidenceUrls
    }

    enum CodingKeys: String, CodingKey {
        case description
        case evidenceUrls = "evidence_urls"
    }
}

/// Change-order types the backend whitelists for
/// `POST /api/gigs/:gigId/change-orders` (gigs.js:6691).
public enum GigChangeOrderType: String, Sendable, CaseIterable {
    case priceIncrease = "price_increase"
    case priceDecrease = "price_decrease"
    case scopeAddition = "scope_addition"
    case scopeReduction = "scope_reduction"
    case timelineExtension = "timeline_extension"
    case other

    /// User-facing label rendered in the propose-a-change sheet + rows.
    public var label: String {
        switch self {
        case .priceIncrease: "Price increase"
        case .priceDecrease: "Price decrease"
        case .scopeAddition: "Scope addition"
        case .scopeReduction: "Scope reduction"
        case .timelineExtension: "More time"
        case .other: "Other change"
        }
    }
}

/// Body for `POST /api/gigs/:gigId/change-orders`. `amountChange` is
/// signed **dollars** (backend rounds to cents); `timeChangeMinutes`
/// is a whole-minute delta. Description must be ≥ 5 chars.
public struct CreateChangeOrderBody: Encodable, Sendable {
    public let type: String
    public let description: String
    public let amountChange: Double?
    public let timeChangeMinutes: Int?

    public init(
        type: GigChangeOrderType,
        description: String,
        amountChange: Double? = nil,
        timeChangeMinutes: Int? = nil
    ) {
        self.type = type.rawValue
        self.description = description
        self.amountChange = amountChange
        self.timeChangeMinutes = timeChangeMinutes
    }

    enum CodingKeys: String, CodingKey {
        case type, description
        case amountChange = "amount_change"
        case timeChangeMinutes = "time_change_minutes"
    }
}

/// Reasons the backend's `reportGigSchema` whitelists for
/// `POST /api/gigs/:gigId/report`.
public enum GigReportReason: String, Sendable, CaseIterable {
    case spam
    case harassment
    case inappropriate
    case misinformation
    case safety
    case other

    /// User-facing label rendered in the report sheet.
    public var label: String {
        switch self {
        case .spam: "Spam or scam"
        case .harassment: "Harassment"
        case .inappropriate: "Inappropriate content"
        case .misinformation: "Misinformation"
        case .safety: "Safety concern"
        case .other: "Something else"
        }
    }
}

/// Body for `POST /api/gigs/:gigId/report`. Details cap at 1000 chars
/// server-side.
public struct ReportGigBody: Encodable, Sendable {
    public let reason: String
    public let details: String?

    public init(reason: GigReportReason, details: String? = nil) {
        self.reason = reason.rawValue
        self.details = details
    }
}

/// Body for `POST /api/gigs/:gigId/bids`. The backend reads
/// `bid_amount` or `amount` — we send the canonical key.
public struct PlaceBidBody: Encodable, Sendable {
    public let bidAmount: Double
    public let message: String?
    public let proposedTime: String?

    public init(bidAmount: Double, message: String? = nil, proposedTime: String? = nil) {
        self.bidAmount = bidAmount
        self.message = message
        self.proposedTime = proposedTime
    }

    enum CodingKeys: String, CodingKey {
        case bidAmount = "bid_amount"
        case message
        case proposedTime = "proposed_time"
    }
}
