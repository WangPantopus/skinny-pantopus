// swiftlint:disable file_length
//
//  GigDTOs.swift
//  Pantopus
//
//  Decoder shapes for the `/api/gigs` endpoints. Mirrors the GIG_LIST
//  projection from `backend/routes/gigs.js` — category, price, bid
//  counts, scheduling, geolocation hints, optional creator nesting.
//

import Foundation

/// One row from `GET /api/gigs` / `GET /api/gigs/nearby`.
public struct GigDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let description: String?
    public let price: Double?
    public let category: String?
    public let status: String?
    public let createdAt: String?
    public let deadline: String?
    public let isUrgent: Bool?
    public let tags: [String]?
    public let userId: String?
    public let acceptedBy: String?
    public let acceptedAt: String?
    /// Set when the poster confirms completion — gates the Block 3D tip
    /// affordance (the `/tip` route requires a completed + confirmed gig).
    public let ownerConfirmedAt: String?
    public let scheduledStart: String?
    public let paymentStatus: String?
    public let engagementMode: String?
    public let scheduleType: String?
    public let payType: String?
    public let taskArchetype: String?
    /// Explicit V2 ("Magic Task") discriminator. When `true` the detail
    /// renders the rich V2 surface (stat strip, Magic Task modules, bid
    /// tags); otherwise it falls back to the sparse V1 legacy layout.
    /// Backend may omit it on legacy gigs — treat `nil` as V1.
    public let isV2: Bool?
    public let pickupAddress: String?
    public let dropoffAddress: String?
    public let bidCount: Int?
    public let savedByUser: Bool?
    public let distanceMiles: Double?
    public let latitude: Double?
    public let longitude: Double?
    public let approxLocation: GigApproxLocation?
    /// True when the viewer may see exact coordinates (owner or assigned worker).
    public let locationUnlocked: Bool?
    /// Privacy-adjusted coordinates from `GET /api/gigs/:id`.
    public let location: GigCoordinate?
    public let exactCity: String?
    public let exactState: String?
    /// Owner-visible street address from `GET /api/gigs/:id` (stripped
    /// for non-owners by the backend's location-privacy pass). Feeds the
    /// A13.8 V1 composer's edit-mode location prefill.
    public let exactAddress: String?
    /// Uploaded photo URLs riding the gig row. Owner edit mode rehydrates
    /// the photo grid from these.
    public let attachments: [String]?
    /// Set when the assigned worker starts work (assigned → in_progress).
    public let startedAt: String?
    /// Pre-start acknowledgement from the worker — `starting_now` or
    /// `running_late`. Drives the "I'm on it" affordance (hidden once set).
    public let workerAckStatus: String?
    /// ETA in minutes riding a `running_late` worker-ack (1–480). Feeds
    /// the "Running ~X min late" badge on the active-task strip.
    public let workerAckEtaMinutes: Int?
    /// Timestamp of the poster's last "Remind worker" nudge. The backend
    /// enforces a 15-minute cooldown off this column
    /// (`backend/routes/gigs.js:5769`), so the detail screen mirrors the
    /// remaining window on the button.
    public let lastWorkerReminderAt: String?
    /// `flexible` / `standard` / `strict` — drives the composer's
    /// cancellation-policy picker in edit mode (`gigs.js:642`).
    public let cancellationPolicy: String?
    /// Hours, `Joi.number().positive()`. Composer edit prefill.
    public let estimatedDuration: Double?
    /// Errand / shopping line items (`Gig.items` jsonb). Composer edit prefill.
    public let items: [GigItemDTO]?
    /// Urgent-task flag's sibling — the backend gates the live
    /// fulfillment routes on `is_urgent || starts_asap` (`gigs.js:8703`).
    public let startsAsap: Bool?
    public let creator: GigCreator?

    enum CodingKeys: String, CodingKey {
        case id, title, description, price, category, status
        case createdAt = "created_at"
        case deadline
        case isUrgent = "is_urgent"
        case tags
        case userId = "user_id"
        case acceptedBy = "accepted_by"
        case acceptedAt = "accepted_at"
        case ownerConfirmedAt = "owner_confirmed_at"
        case scheduledStart = "scheduled_start"
        case paymentStatus = "payment_status"
        case engagementMode = "engagement_mode"
        case scheduleType = "schedule_type"
        case payType = "pay_type"
        case taskArchetype = "task_archetype"
        case isV2 = "is_v2"
        case pickupAddress = "pickup_address"
        case dropoffAddress = "dropoff_address"
        case bidCount = "bid_count"
        case savedByUser = "saved_by_user"
        case distanceMiles = "distance_miles"
        case latitude
        case longitude
        case approxLocation = "approx_location"
        case locationUnlocked
        case location
        case exactCity = "exact_city"
        case exactState = "exact_state"
        case exactAddress = "exact_address"
        case attachments
        case startedAt = "started_at"
        case workerAckStatus = "worker_ack_status"
        case workerAckEtaMinutes = "worker_ack_eta_minutes"
        case lastWorkerReminderAt = "last_worker_reminder_at"
        case cancellationPolicy = "cancellation_policy"
        case estimatedDuration = "estimated_duration"
        case items
        case startsAsap = "starts_asap"
        case creator
        case legacyCreator = "User"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        price = try c.decodeIfPresent(Double.self, forKey: .price)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        deadline = try c.decodeIfPresent(String.self, forKey: .deadline)
        isUrgent = try c.decodeIfPresent(Bool.self, forKey: .isUrgent)
        tags = try c.decodeIfPresent([String].self, forKey: .tags)
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        acceptedBy = try c.decodeIfPresent(String.self, forKey: .acceptedBy)
        acceptedAt = try c.decodeIfPresent(String.self, forKey: .acceptedAt)
        ownerConfirmedAt = try c.decodeIfPresent(String.self, forKey: .ownerConfirmedAt)
        scheduledStart = try c.decodeIfPresent(String.self, forKey: .scheduledStart)
        paymentStatus = try c.decodeIfPresent(String.self, forKey: .paymentStatus)
        engagementMode = try c.decodeIfPresent(String.self, forKey: .engagementMode)
        scheduleType = try c.decodeIfPresent(String.self, forKey: .scheduleType)
        payType = try c.decodeIfPresent(String.self, forKey: .payType)
        taskArchetype = try c.decodeIfPresent(String.self, forKey: .taskArchetype)
        isV2 = try c.decodeIfPresent(Bool.self, forKey: .isV2)
        pickupAddress = try c.decodeIfPresent(String.self, forKey: .pickupAddress)
        dropoffAddress = try c.decodeIfPresent(String.self, forKey: .dropoffAddress)
        bidCount = try c.decodeIfPresent(Int.self, forKey: .bidCount)
        savedByUser = try c.decodeIfPresent(Bool.self, forKey: .savedByUser)
        distanceMiles = try c.decodeIfPresent(Double.self, forKey: .distanceMiles)
        latitude = try c.decodeIfPresent(Double.self, forKey: .latitude)
        longitude = try c.decodeIfPresent(Double.self, forKey: .longitude)
        approxLocation = try c.decodeIfPresent(GigApproxLocation.self, forKey: .approxLocation)
        locationUnlocked = try c.decodeIfPresent(Bool.self, forKey: .locationUnlocked)
        location = try c.decodeIfPresent(GigCoordinate.self, forKey: .location)
        exactCity = try c.decodeIfPresent(String.self, forKey: .exactCity)
        exactState = try c.decodeIfPresent(String.self, forKey: .exactState)
        exactAddress = try c.decodeIfPresent(String.self, forKey: .exactAddress)
        // Lenient — legacy rows may carry non-string entries; drop rather
        // than fail the whole gig decode.
        attachments = try? c.decode([String].self, forKey: .attachments)
        startedAt = try c.decodeIfPresent(String.self, forKey: .startedAt)
        workerAckStatus = try c.decodeIfPresent(String.self, forKey: .workerAckStatus)
        workerAckEtaMinutes = try c.decodeIfPresent(Int.self, forKey: .workerAckEtaMinutes)
        lastWorkerReminderAt = try c.decodeIfPresent(String.self, forKey: .lastWorkerReminderAt)
        cancellationPolicy = try c.decodeIfPresent(String.self, forKey: .cancellationPolicy)
        estimatedDuration = try c.decodeIfPresent(Double.self, forKey: .estimatedDuration)
        // Legacy rows can carry a JSON string here — drop rather than fail
        // the whole gig decode.
        items = try? c.decode([GigItemDTO].self, forKey: .items)
        startsAsap = try c.decodeIfPresent(Bool.self, forKey: .startsAsap)
        creator = try c.decodeIfPresent(GigCreator.self, forKey: .creator)
            ?? c.decodeIfPresent(GigCreator.self, forKey: .legacyCreator)
    }

    public init(
        id: String,
        title: String,
        description: String?,
        price: Double?,
        category: String?,
        status: String?,
        createdAt: String?,
        deadline: String?,
        isUrgent: Bool?,
        tags: [String]?,
        userId: String?,
        acceptedBy: String?,
        acceptedAt: String?,
        ownerConfirmedAt: String?,
        scheduledStart: String?,
        paymentStatus: String?,
        engagementMode: String?,
        scheduleType: String?,
        payType: String?,
        taskArchetype: String?,
        isV2: Bool?,
        pickupAddress: String?,
        dropoffAddress: String?,
        bidCount: Int?,
        savedByUser: Bool?,
        distanceMiles: Double?,
        latitude: Double?,
        longitude: Double?,
        approxLocation: GigApproxLocation?,
        locationUnlocked: Bool?,
        location: GigCoordinate?,
        exactCity: String?,
        exactState: String?,
        creator: GigCreator?,
        exactAddress: String? = nil,
        attachments: [String]? = nil,
        startedAt: String? = nil,
        workerAckStatus: String? = nil,
        workerAckEtaMinutes: Int? = nil,
        lastWorkerReminderAt: String? = nil,
        cancellationPolicy: String? = nil,
        estimatedDuration: Double? = nil,
        items: [GigItemDTO]? = nil,
        startsAsap: Bool? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.price = price
        self.category = category
        self.status = status
        self.createdAt = createdAt
        self.deadline = deadline
        self.isUrgent = isUrgent
        self.tags = tags
        self.userId = userId
        self.acceptedBy = acceptedBy
        self.acceptedAt = acceptedAt
        self.ownerConfirmedAt = ownerConfirmedAt
        self.scheduledStart = scheduledStart
        self.paymentStatus = paymentStatus
        self.engagementMode = engagementMode
        self.scheduleType = scheduleType
        self.payType = payType
        self.taskArchetype = taskArchetype
        self.isV2 = isV2
        self.pickupAddress = pickupAddress
        self.dropoffAddress = dropoffAddress
        self.bidCount = bidCount
        self.savedByUser = savedByUser
        self.distanceMiles = distanceMiles
        self.latitude = latitude
        self.longitude = longitude
        self.approxLocation = approxLocation
        self.locationUnlocked = locationUnlocked
        self.location = location
        self.exactCity = exactCity
        self.exactState = exactState
        self.creator = creator
        self.exactAddress = exactAddress
        self.attachments = attachments
        self.startedAt = startedAt
        self.workerAckStatus = workerAckStatus
        self.workerAckEtaMinutes = workerAckEtaMinutes
        self.lastWorkerReminderAt = lastWorkerReminderAt
        self.cancellationPolicy = cancellationPolicy
        self.estimatedDuration = estimatedDuration
        self.items = items
        self.startsAsap = startsAsap
    }
}

/// Nested `{ latitude, longitude }` on gig detail responses.
public struct GigCoordinate: Decodable, Sendable, Hashable {
    public let latitude: Double?
    public let longitude: Double?
}

/// Privacy-safe coarse location surfaced on map / in-bounds responses.
public struct GigApproxLocation: Decodable, Sendable, Hashable {
    public let latitude: Double?
    public let longitude: Double?
    public let label: String?
}

/// Creator / poster identity on a gig. Detail responses use the identity
/// serializer (`creator.displayName`, `creator.handle`); list joins may
/// still nest the legacy `User` row (`name`, `username`).
public struct GigCreator: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let displayName: String?
    public let handle: String?
    public let profilePictureUrl: String?
    public let avatarUrl: String?
    public let verified: Bool?
    public let badges: [String]?

    enum CodingKeys: String, CodingKey {
        case id, username, name, displayName, handle, badges
        case profilePictureUrl = "profile_picture_url"
        case avatarUrl
        case verified
    }

    public init(
        id: String? = nil,
        username: String? = nil,
        name: String? = nil,
        displayName: String? = nil,
        handle: String? = nil,
        profilePictureUrl: String? = nil,
        avatarUrl: String? = nil,
        verified: Bool? = nil,
        badges: [String]? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.displayName = displayName
        self.handle = handle
        self.profilePictureUrl = profilePictureUrl
        self.avatarUrl = avatarUrl
        self.verified = verified
        self.badges = badges
    }

    /// Best-effort public name across identity-serializer and legacy User shapes.
    public var resolvedDisplayName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        if let name, !name.isEmpty { return name }
        if let handle, !handle.isEmpty { return handle }
        if let username, !username.isEmpty { return username }
        return "Neighbor"
    }

    public var resolvedHandle: String? {
        let value = handle ?? username
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    public var resolvedVerified: Bool {
        verified ?? badges?.contains("verified_resident") ?? false
    }

    public var resolvedAvatarURL: URL? {
        let raw = avatarUrl ?? profilePictureUrl
        guard let raw, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }
}

/// Bidder thumbnail surfaced on the My tasks V2 row's bidder stack.
/// Initials + tone are derived server-side (gigs.js) so iOS / Android /
/// web all render identical avatars without each platform reinventing
/// the derivation.
public struct TopBidderDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let initials: String
    public let color: String
}

/// Paging envelope emitted by the **spatial** branch of `GET /api/gigs`
/// (`backend/routes/gigs.js:2388`). The keys are already camelCase on the
/// wire. The non-spatial branch omits this object entirely and returns an
/// exact `total` row count instead (`backend/routes/gigs.js:2588`).
public struct GigsListPagination: Decodable, Sendable, Hashable {
    public let limit: Int?
    public let offset: Int?
    public let hasMore: Bool?

    public init(limit: Int? = nil, offset: Int? = nil, hasMore: Bool? = nil) {
        self.limit = limit
        self.offset = offset
        self.hasMore = hasMore
    }
}

/// Top-level envelope from `/api/gigs`.
public struct GigsListResponse: Decodable, Sendable {
    public let gigs: [GigDTO]
    public let total: Int?
    public let radiusMeters: Int?
    /// Present only on the spatial branch — see `GigsListPagination`.
    public let pagination: GigsListPagination?

    enum CodingKeys: String, CodingKey {
        case gigs
        case total
        case radiusMeters
        case pagination
    }

    /// Whether another page exists after the one just decoded.
    ///
    /// Preference order matches what the backend actually sends:
    /// 1. the spatial branch's explicit `pagination.hasMore`,
    /// 2. the non-spatial branch's exact `total` (`{ count: 'exact' }`),
    /// 3. the "did we get a full page" heuristic as a last resort.
    public func hasMorePages(offset: Int, limit: Int) -> Bool {
        if let flag = pagination?.hasMore { return flag }
        if let total { return offset + gigs.count < total }
        return gigs.count >= limit
    }
}

/// Save / unsave envelope from `POST /api/gigs/:id/save`.
public struct GigSaveResponse: Decodable, Sendable {
    public let message: String?
    public let saved: Bool?
}

/// Envelope from `GET /api/gigs/in-bounds`. Carries a backend hint for
/// where to recenter when the current viewport is empty.
public struct GigsInBoundsResponse: Decodable, Sendable {
    public let gigs: [GigDTO]
    public let nearestActivityCenter: NearestActivityCenter?

    enum CodingKeys: String, CodingKey {
        case gigs
        case nearestActivityCenter = "nearest_activity_center"
    }
}

/// Envelope from `GET /api/gigs/:id`.
public struct GigDetailResponse: Decodable, Sendable {
    public let gig: GigDTO
}

/// One bid on a gig.
public struct GigBidDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let bidAmount: Double?
    public let amount: Double?
    public let status: String?
    public let message: String?
    public let createdAt: String?
    /// Poster's counter-offer amount — set while `status == countered`
    /// (and kept after the bidder responds; `counterStatus` tells which).
    public let counterAmount: Double?
    /// `pending` / `accepted` / `declined` for the counter round-trip.
    public let counterStatus: String?
    public let bidder: GigCreator?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case bidAmount = "bid_amount"
        case amount
        case status
        case message
        case createdAt = "created_at"
        case counterAmount = "counter_amount"
        case counterStatus = "counter_status"
        case bidder
        case legacyBidder = "User"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        bidAmount = try c.decodeIfPresent(Double.self, forKey: .bidAmount)
        amount = try c.decodeIfPresent(Double.self, forKey: .amount)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        message = try c.decodeIfPresent(String.self, forKey: .message)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        counterAmount = try c.decodeIfPresent(Double.self, forKey: .counterAmount)
        counterStatus = try c.decodeIfPresent(String.self, forKey: .counterStatus)
        bidder = try c.decodeIfPresent(GigCreator.self, forKey: .bidder)
            ?? c.decodeIfPresent(GigCreator.self, forKey: .legacyBidder)
    }

    public init(
        id: String,
        userId: String?,
        bidAmount: Double?,
        amount: Double?,
        status: String?,
        message: String?,
        createdAt: String?,
        bidder: GigCreator?,
        counterAmount: Double? = nil,
        counterStatus: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.bidAmount = bidAmount
        self.amount = amount
        self.status = status
        self.message = message
        self.createdAt = createdAt
        self.bidder = bidder
        self.counterAmount = counterAmount
        self.counterStatus = counterStatus
    }
}

/// Envelope from `GET /api/gigs/:gigId/bids`.
public struct GigBidsResponse: Decodable, Sendable {
    public let bids: [GigBidDTO]
}

/// Envelope from `GET /api/gigs/:gigId/chat-room` — get-or-create the
/// gig-scoped chat room (pre-bid questions, owner/worker thread).
public struct GigChatRoomResponse: Decodable, Sendable {
    public let roomId: String
    public let topicId: String?
    public let gigOwnerId: String?
}

// MARK: - Structured Q&A

/// User summary nested on a gig question row.
public struct GigQuestionUser: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let firstName: String?
    public let lastName: String?
    public let name: String?
    public let profilePictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureUrl = "profile_picture_url"
    }
}

/// One row from `GET /api/gigs/:gigId/questions`.
public struct GigQuestionDTO: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let gigId: String
    public let question: String
    public let answer: String?
    public let questionAttachments: [String]?
    public let answerAttachments: [String]?
    public let answeredAt: String?
    public let isPinned: Bool?
    public let upvoteCount: Int?
    public let status: String
    public let createdAt: String?
    public let updatedAt: String?
    public let asker: GigQuestionUser?
    public let answerer: GigQuestionUser?
    public let answererDisplayName: String?

    enum CodingKeys: String, CodingKey {
        case id, question, answer, status, asker, answerer
        case gigId = "gig_id"
        case questionAttachments = "question_attachments"
        case answerAttachments = "answer_attachments"
        case answeredAt = "answered_at"
        case isPinned = "is_pinned"
        case upvoteCount = "upvote_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case answererDisplayName = "answerer_display_name"
    }

    public var isAnswered: Bool {
        status == "answered"
    }
}

/// Envelope from `GET /api/gigs/:gigId/questions`.
public struct GigQuestionsResponse: Decodable, Sendable {
    public let questions: [GigQuestionDTO]
}

/// Envelope from ask/answer/pin mutations.
public struct GigQuestionMutationResponse: Decodable, Sendable {
    public let question: GigQuestionDTO
}

/// Body for `POST /api/gigs/:gigId/questions`.
public struct AskGigQuestionBody: Encodable, Sendable {
    public let question: String
    public let attachments: [String]?

    public init(question: String, attachments: [String]? = nil) {
        self.question = question
        self.attachments = attachments
    }
}

/// Body for `POST /api/gigs/:gigId/questions/:questionId/answer`.
public struct AnswerGigQuestionBody: Encodable, Sendable {
    public let answer: String
    public let attachments: [String]?

    public init(answer: String, attachments: [String]? = nil) {
        self.answer = answer
        self.attachments = attachments
    }
}

/// Envelope from `POST /api/gigs/:gigId/bids`.
public struct PlaceBidResponse: Decodable, Sendable {
    public let bid: GigBidDTO?
    public let message: String?
}

/// Response from `POST /api/gigs/:gigId/bids/:bidId/accept`.
/// Paid gigs return PaymentSheet params and stay in `pending_payment` until
/// `finalize-accept` succeeds; free gigs may return an already accepted bid.
public struct GigBidAcceptResponse: Decodable, Sendable, Hashable {
    public let bid: GigBidDTO?
    public let message: String?
    public let requiresPaymentSetup: Bool?
    public let isSetupIntent: Bool?
    public let payment: PaymentPayload?
    public let publishableKey: String?
    public let clientSecret: String?
    public let paymentId: String?
    public let setupIntentId: String?
    public let paymentIntentId: String?
    public let ephemeralKey: String?
    public let customer: String?
    public let customerId: String?

    public var sheetParams: PaymentIntentSheetParams {
        PaymentIntentSheetParams(
            clientSecret: clientSecret ?? payment?.clientSecret,
            paymentIntentId: paymentIntentId ?? payment?.paymentIntentId,
            customer: customer ?? customerId,
            ephemeralKey: ephemeralKey,
            publishableKey: publishableKey,
            isSetupIntent: isSetupIntent
        )
    }

    public struct PaymentPayload: Decodable, Sendable, Hashable {
        public let clientSecret: String?
        public let paymentId: String?
        public let setupIntentId: String?
        public let paymentIntentId: String?
    }
}

/// Body for `POST /api/gigs`. Mirrors the subset of `createGigSchema`
/// the Post-a-Task wizard surfaces (`backend/routes/gigs.js:425`). All
/// optional fields are omitted from the encoded JSON when nil.
public struct CreateGigBody: Encodable, Sendable, Equatable {
    public let title: String
    public let description: String
    public let category: String?
    public let price: Double
    public let payType: String?
    public let scheduleType: String?
    public let scheduledStart: String?
    public let taskFormat: String?
    public let attachments: [String]?
    public let deadline: String?
    public let cancellationPolicy: String?
    public let isUrgent: Bool?
    public let tags: [String]?
    /// Hours (`Joi.number().positive()`, `gigs.js:433`).
    public let estimatedDuration: Double?
    /// Errand / shopping line items (`gigs.js:487`).
    public let items: [GigItemDTO]?
    public let location: CreateGigLocation

    public init(
        title: String,
        description: String,
        category: String?,
        price: Double,
        payType: String?,
        scheduleType: String?,
        scheduledStart: String?,
        taskFormat: String?,
        attachments: [String]?,
        deadline: String? = nil,
        cancellationPolicy: String? = nil,
        isUrgent: Bool? = nil,
        tags: [String]? = nil,
        estimatedDuration: Double? = nil,
        items: [GigItemDTO]? = nil,
        location: CreateGigLocation
    ) {
        self.title = title
        self.description = description
        self.category = category
        self.price = price
        self.payType = payType
        self.scheduleType = scheduleType
        self.scheduledStart = scheduledStart
        self.taskFormat = taskFormat
        self.attachments = attachments
        self.deadline = deadline
        self.cancellationPolicy = cancellationPolicy
        self.isUrgent = isUrgent
        self.tags = tags
        self.estimatedDuration = estimatedDuration
        self.items = items
        self.location = location
    }

    enum CodingKeys: String, CodingKey {
        case title, description, category, price
        case payType = "pay_type"
        case scheduleType = "schedule_type"
        case scheduledStart = "scheduled_start"
        case taskFormat = "task_format"
        case attachments
        case deadline
        case cancellationPolicy = "cancellation_policy"
        case isUrgent = "is_urgent"
        case tags
        case estimatedDuration = "estimated_duration"
        case items
        case location
    }
}

/// Body for `PATCH /api/gigs/:id` (`updateGigSchema`,
/// `backend/routes/gigs.js:641`). Same field names as create; every
/// field is optional (the backend requires at least one). Note the
/// update schema strips `scheduled_start` today (`stripUnknown`) — we
/// still send it for create-parity so it persists if the backend adds
/// it to the schema. `location` should only ride when real coordinates
/// are known, otherwise the PATCH would overwrite the stored point.
public struct UpdateGigBody: Encodable, Sendable, Equatable {
    public let title: String?
    public let description: String?
    public let category: String?
    public let price: Double?
    public let payType: String?
    public let scheduleType: String?
    public let scheduledStart: String?
    public let attachments: [String]?
    /// ISO-8601. `Joi.date().iso().min('now')` — the schema has no
    /// `allow(null)`, so an unset deadline is *omitted*, never cleared.
    public let deadline: String?
    public let cancellationPolicy: String?
    public let isUrgent: Bool?
    public let tags: [String]?
    /// Hours. `Joi.number().positive()` — same "omit, never clear" rule
    /// as `deadline`.
    public let estimatedDuration: Double?
    public let items: [GigItemDTO]?
    public let location: CreateGigLocation?

    public init(
        title: String?,
        description: String?,
        category: String?,
        price: Double?,
        payType: String?,
        scheduleType: String?,
        scheduledStart: String?,
        attachments: [String]?,
        deadline: String? = nil,
        cancellationPolicy: String? = nil,
        isUrgent: Bool? = nil,
        tags: [String]? = nil,
        estimatedDuration: Double? = nil,
        items: [GigItemDTO]? = nil,
        location: CreateGigLocation?
    ) {
        self.title = title
        self.description = description
        self.category = category
        self.price = price
        self.payType = payType
        self.scheduleType = scheduleType
        self.scheduledStart = scheduledStart
        self.attachments = attachments
        self.deadline = deadline
        self.cancellationPolicy = cancellationPolicy
        self.isUrgent = isUrgent
        self.tags = tags
        self.estimatedDuration = estimatedDuration
        self.items = items
        self.location = location
    }

    enum CodingKeys: String, CodingKey {
        case title, description, category, price
        case payType = "pay_type"
        case scheduleType = "schedule_type"
        case scheduledStart = "scheduled_start"
        case attachments
        case deadline
        case cancellationPolicy = "cancellation_policy"
        case isUrgent = "is_urgent"
        case tags
        case estimatedDuration = "estimated_duration"
        case items
        case location
    }
}

/// Nested `location` object the backend requires
/// (`backend/routes/gigs.js:521`).
public struct CreateGigLocation: Encodable, Sendable, Equatable {
    public let mode: String
    public let latitude: Double
    public let longitude: Double
    public let address: String
    public let city: String?
    public let state: String?
    public let zip: String?
    public let homeId: String?

    public init(
        mode: String,
        latitude: Double,
        longitude: Double,
        address: String,
        city: String? = nil,
        state: String? = nil,
        zip: String? = nil,
        homeId: String? = nil
    ) {
        self.mode = mode
        self.latitude = latitude
        self.longitude = longitude
        self.address = address
        self.city = city
        self.state = state
        self.zip = zip
        self.homeId = homeId
    }
}

/// Envelope from `POST /api/gigs`. The backend wraps the freshly
/// created gig under `gig`.
public struct CreateGigResponse: Decodable, Sendable {
    public let gig: GigDTO
    public let message: String?
}

// MARK: - Phase 5 — lifecycle DTOs

/// Response from `POST /api/gigs/:gigId/instant-accept`
/// (`backend/routes/gigsV2.js:64`). On success the gig is already
/// `assigned`; for paid gigs the *poster* still has to authorize
/// payment, so the helper just refreshes the detail.
public struct GigInstantAcceptResponse: Decodable, Sendable {
    public let message: String?
    public let gig: GigDTO?
    public let paymentRequired: Bool?
    public let requiresPaymentSetup: Bool?
    public let isSetupIntent: Bool?
    public let payment: GigBidAcceptResponse.PaymentPayload?
}

/// Response from `POST /api/gigs/:gigId/worker-ack`.
public struct WorkerAckResponse: Decodable, Sendable {
    public let success: Bool?
    public let workerAckStatus: String?
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case success, message
        case workerAckStatus = "worker_ack_status"
    }
}

/// Response from `GET /api/gigs/:gigId/no-show-check`. Only
/// `can_report` gates the UI; the rest is timing context.
public struct NoShowCheckResponse: Decodable, Sendable {
    public let canReport: Bool?
    public let reason: String?
    public let minutesOverdue: Int?

    enum CodingKeys: String, CodingKey {
        case reason
        case canReport = "can_report"
        case minutesOverdue = "minutes_overdue"
    }
}

/// Response from `GET /api/gigs/:gigId/cancellation-preview` — the
/// `computeCancellationInfo` shape plus policy metadata
/// (`backend/routes/gigs.js:6356`).
public struct GigCancellationPreview: Decodable, Sendable {
    public let zone: Int?
    public let zoneLabel: String?
    public let fee: Double?
    public let feePct: Double?
    public let inGrace: Bool?
    public let policy: String?
    public let policyLabel: String?
    public let policyDescription: String?
    public let canReschedule: Bool?

    enum CodingKeys: String, CodingKey {
        case zone, fee, policy
        case zoneLabel = "zone_label"
        case feePct = "fee_pct"
        case inGrace = "in_grace"
        case policyLabel = "policy_label"
        case policyDescription = "policy_description"
        case canReschedule = "can_reschedule"
    }
}

/// Body for `POST /api/gigs/:gigId/reschedule` — ISO future start +
/// optional note relayed to the worker (`backend/routes/gigs.js:6405`).
public struct RescheduleGigBody: Encodable, Sendable {
    public let scheduledStart: String
    public let note: String?

    enum CodingKeys: String, CodingKey {
        case note
        case scheduledStart = "scheduled_start"
    }

    public init(scheduledStart: String, note: String?) {
        self.scheduledStart = scheduledStart
        self.note = note
    }
}

/// Response from `POST /api/gigs/:gigId/reschedule` — `{message, gig}`.
public struct GigRescheduleResponse: Decodable, Sendable {
    public let message: String?
    public let gig: GigDTO?
}

/// Response from `POST /api/gigs/:gigId/report`.
public struct GigReportResponse: Decodable, Sendable {
    public let message: String?
    public let alreadyReported: Bool?

    enum CodingKeys: String, CodingKey {
        case message
        case alreadyReported = "already_reported"
    }
}

// MARK: - Phase 5b — payment + change orders

/// Envelope from `GET /api/gigs/:gigId/payment`
/// (`backend/routes/gigs.js:8440`). Both fields are `null` when the gig
/// has no linked payment — the card silent-hides.
public struct GigPaymentResponse: Decodable, Sendable {
    public let payment: GigPaymentDTO?
    public let stateInfo: GigPaymentStateInfo?
}

/// The `Payment` row riding the gig payment envelope. All amounts are
/// **cents**; `tipAmount` is the server-aggregated net of successful
/// tips. Sensitive Stripe ids are stripped for the worker server-side.
public struct GigPaymentDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let paymentStatus: String?
    public let paymentType: String?
    public let amountTotal: Double?
    public let amountSubtotal: Double?
    public let amountPlatformFee: Double?
    public let amountProcessingFee: Double?
    public let amountToPayee: Double?
    public let tipAmount: Double?
    public let refundedAmount: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case paymentStatus = "payment_status"
        case paymentType = "payment_type"
        case amountTotal = "amount_total"
        case amountSubtotal = "amount_subtotal"
        case amountPlatformFee = "amount_platform_fee"
        case amountProcessingFee = "amount_processing_fee"
        case amountToPayee = "amount_to_payee"
        case tipAmount = "tip_amount"
        case refundedAmount = "refunded_amount"
    }

    public init(
        id: String? = nil,
        paymentStatus: String? = nil,
        paymentType: String? = nil,
        amountTotal: Double? = nil,
        amountSubtotal: Double? = nil,
        amountPlatformFee: Double? = nil,
        amountProcessingFee: Double? = nil,
        amountToPayee: Double? = nil,
        tipAmount: Double? = nil,
        refundedAmount: Double? = nil
    ) {
        self.id = id
        self.paymentStatus = paymentStatus
        self.paymentType = paymentType
        self.amountTotal = amountTotal
        self.amountSubtotal = amountSubtotal
        self.amountPlatformFee = amountPlatformFee
        self.amountProcessingFee = amountProcessingFee
        self.amountToPayee = amountToPayee
        self.tipAmount = tipAmount
        self.refundedAmount = refundedAmount
    }
}

/// `getPaymentStateInfo(...)` projection — display label / tone /
/// description for the payment status chip
/// (`backend/stripe/paymentStateMachine.js:189`). Keys are camelCase
/// already, no CodingKeys needed.
public struct GigPaymentStateInfo: Decodable, Sendable, Hashable {
    public let label: String?
    public let color: String?
    public let description: String?

    public init(label: String? = nil, color: String? = nil, description: String? = nil) {
        self.label = label
        self.color = color
        self.description = description
    }
}

/// One row from `GET /api/gigs/:gigId/change-orders`
/// (`backend/routes/gigs.js:6640`). `amountChange` is **dollars**
/// (applied to `gig.price` on approval); `status` is
/// pending / approved / rejected / withdrawn.
public struct GigChangeOrderDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let gigId: String?
    public let requestedBy: String?
    public let type: String?
    public let description: String?
    public let amountChange: Double?
    public let timeChangeMinutes: Int?
    public let status: String?
    public let reviewedBy: String?
    public let reviewedAt: String?
    public let rejectionReason: String?
    public let createdAt: String?
    public let requester: GigCreator?
    public let reviewer: GigCreator?

    enum CodingKeys: String, CodingKey {
        case id, type, description, status, requester, reviewer
        case gigId = "gig_id"
        case requestedBy = "requested_by"
        case amountChange = "amount_change"
        case timeChangeMinutes = "time_change_minutes"
        case reviewedBy = "reviewed_by"
        case reviewedAt = "reviewed_at"
        case rejectionReason = "rejection_reason"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        gigId: String? = nil,
        requestedBy: String? = nil,
        type: String? = nil,
        description: String? = nil,
        amountChange: Double? = nil,
        timeChangeMinutes: Int? = nil,
        status: String? = nil,
        reviewedBy: String? = nil,
        reviewedAt: String? = nil,
        rejectionReason: String? = nil,
        createdAt: String? = nil,
        requester: GigCreator? = nil,
        reviewer: GigCreator? = nil
    ) {
        self.id = id
        self.gigId = gigId
        self.requestedBy = requestedBy
        self.type = type
        self.description = description
        self.amountChange = amountChange
        self.timeChangeMinutes = timeChangeMinutes
        self.status = status
        self.reviewedBy = reviewedBy
        self.reviewedAt = reviewedAt
        self.rejectionReason = rejectionReason
        self.createdAt = createdAt
        self.requester = requester
        self.reviewer = reviewer
    }
}

/// Envelope from `GET /api/gigs/:gigId/change-orders`.
public struct GigChangeOrdersResponse: Decodable, Sendable {
    public let changeOrders: [GigChangeOrderDTO]

    enum CodingKeys: String, CodingKey {
        case changeOrders = "change_orders"
    }
}

/// Envelope from the change-order create / approve / reject / withdraw
/// mutations — `{change_order}`.
public struct GigChangeOrderMutationResponse: Decodable, Sendable {
    public let changeOrder: GigChangeOrderDTO?

    enum CodingKeys: String, CodingKey {
        case changeOrder = "change_order"
    }
}

/// Room event payload for `gig:<eventType>` socket frames emitted by
/// `emitGigUpdate` (`backend/routes/gigs.js:413`). Socket DTOs omit
/// explicit CodingKeys — `SocketClient` applies `convertFromSnakeCase`.
public struct GigRoomEvent: Decodable, Sendable {
    public let gigId: String?
    public let eventType: String?

    public init(gigId: String?, eventType: String?) {
        self.gigId = gigId
        self.eventType = eventType
    }
}
