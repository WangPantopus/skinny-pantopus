//
//  PostcardVerificationViewModel.swift
//  Pantopus
//
//  A12.7 — sibling status screen for the verify-landlord flow. Shows the
//  postcard's delivery timeline as informational chrome and owns the
//  user's 6-char code input. The submit state machine is the same
//  contract shared with the wizard VM: idle → submitting → submitted /
//  error.
//
//  Code entry is NEVER gated on the delivery stage: the backend has no
//  delivery-tracking surface (see `PostcardDTOs.swift`), so a stage-based
//  lock would make `POST /api/homes/:id/verify-postcard` unreachable for
//  every real home. RN behaves the same way — the code field is live at
//  all times and the request step carries an explicit
//  "I already have a code" escape hatch
//  (`src/app/homes/[id]/verify-postcard.tsx:146-152`).
//

import Foundation
import Observation

/// Lifecycle state of the physical postcard.
public enum PostcardDeliveryStage: Sendable, Equatable {
    case mailed
    case inTransit
    case delivered
}

/// Full payload describing the postcard verification surface.
public struct PostcardVerificationContent: Sendable, Equatable {
    public let recipientName: String
    public let street: String
    public let cityZip: String
    public let trackingNumber: String
    public let mailedOn: String
    public let inTransitOn: String?
    public let deliveredOn: String?
    public let resendAvailableOn: String

    public init(
        recipientName: String,
        street: String,
        cityZip: String,
        trackingNumber: String,
        mailedOn: String,
        inTransitOn: String?,
        deliveredOn: String?,
        resendAvailableOn: String
    ) {
        self.recipientName = recipientName
        self.street = street
        self.cityZip = cityZip
        self.trackingNumber = trackingNumber
        self.mailedOn = mailedOn
        self.inTransitOn = inTransitOn
        self.deliveredOn = deliveredOn
        self.resendAvailableOn = resendAvailableOn
    }
}

/// Deterministic seed for the delivery-timeline chrome. The backend
/// exposes no USPS tracking surface, so the timeline is presentation
/// only — it never gates the code field or the Verify CTA.
public enum PostcardVerificationSampleData {
    public static let deliveredContent = PostcardVerificationContent(
        recipientName: "Mira Patel",
        street: "412 Elm St, Apt 3B",
        cityZip: "San Francisco, CA 94114",
        trackingNumber: "#9405 5036 …8421",
        mailedOn: "Oct 9",
        inTransitOn: "Oct 11",
        deliveredOn: "Oct 12",
        resendAvailableOn: "Oct 15"
    )

    public static let inTransitContent = PostcardVerificationContent(
        recipientName: "Mira Patel",
        street: "412 Elm St, Apt 3B",
        cityZip: "San Francisco, CA 94114",
        trackingNumber: "#9405 5036 …8421",
        mailedOn: "Oct 9",
        inTransitOn: "Oct 11",
        deliveredOn: nil,
        resendAvailableOn: "Oct 15"
    )

    public static func content(for stage: PostcardDeliveryStage) -> PostcardVerificationContent {
        stage == .delivered ? deliveredContent : inTransitContent
    }
}

/// Transient banner surfaced under the code field — request/resend
/// results and expiry hints.
public struct PostcardNotice: Sendable, Equatable {
    public let text: String
    public let isError: Bool

    public init(text: String, isError: Bool) {
        self.text = text
        self.isError = isError
    }
}

/// Outbound events the host nav stack acts on.
public enum PostcardVerificationOutboundEvent: Sendable, Equatable {
    case dismiss
    /// Verify pressed and the code matched — caller should pop the
    /// screen and route to the verified-home success surface. The
    /// homeId is forwarded so callers can refresh that home's
    /// verification status.
    case verified(homeId: String)
}

/// View model for A12.7. Holds the (informational) delivery stage, the
/// 6-char code the user is typing, and a `submitState` machine identical
/// in shape to the wizard's `VerifyLandlordSubmitState`.
@Observable
@MainActor
final class PostcardVerificationViewModel {
    /// Length of the code printed on the postcard. The backend accepts
    /// 6–8 alphanumerics (`verifyPostcardSchema`,
    /// `backend/routes/homeOwnership.js:2544`); the mailer prints 6.
    static let codeLength = 6

    // MARK: - Published state

    private(set) var stage: PostcardDeliveryStage
    private(set) var content: PostcardVerificationContent
    var codeInput: String = ""
    private(set) var submitState: VerifyLandlordSubmitState = .idle
    /// Attempts left before the backend expires the code — parsed from
    /// the 400 body's `attempts_remaining` (route line 2611-2614).
    private(set) var attemptsRemaining: Int?
    /// Set when the backend told us the code is gone (410 expired, 429
    /// locked out, 404 none pending). Drives the "Request a new code"
    /// affordance.
    private(set) var needsNewCode = false
    /// True once the user says they're holding the card (or the timeline
    /// says it landed) — flips the screen to the code-entry frame.
    private(set) var hasCodeInHand: Bool
    /// Expiry date returned by `request-postcard`, formatted for display.
    private(set) var codeExpiresOn: String?
    private(set) var notice: PostcardNotice?
    private(set) var isRequestingCode = false
    var pendingEvent: PostcardVerificationOutboundEvent?

    // MARK: - Init

    private let homeId: String
    private let submitDelayNanos: UInt64
    private let api: APIClient
    /// Offline/preview/test seam. When non-nil, `verify()` checks the
    /// typed code against this value locally instead of calling the
    /// backend — used by previews and unit/snapshot tests. Production
    /// passes `nil`, so the code is validated by
    /// `POST /api/homes/:id/verify-postcard`.
    private let expectedCode: String?

    init(
        homeId: String,
        stage: PostcardDeliveryStage = .inTransit,
        content: PostcardVerificationContent? = nil,
        expectedCode: String? = nil,
        api: APIClient = .shared,
        submitDelayNanos: UInt64 = 800_000_000
    ) {
        self.stage = stage
        self.content = content ?? PostcardVerificationSampleData.content(for: stage)
        hasCodeInHand = stage == .delivered
        self.homeId = homeId
        self.expectedCode = expectedCode
        self.api = api
        self.submitDelayNanos = submitDelayNanos
    }

    // MARK: - Derived state

    /// The code field only ever locks while a submit is in flight — the
    /// delivery stage never gates it (see the file header).
    var isCodeInputUnlocked: Bool {
        !isSubmitting
    }

    var isSubmitting: Bool {
        if case .submitting = submitState { return true }
        return false
    }

    /// Whether the screen renders the "enter your code" frame rather
    /// than the waiting-for-delivery / request-a-code frame.
    ///
    /// `needsNewCode` wins: once the backend says the pending code is
    /// gone (404 / 410 expired / 429 too many attempts) RN drops the
    /// user back on the request step
    /// (`src/app/homes/[id]/verify-postcard.tsx:79-82`), so typing into
    /// a dead code field is never the foreground affordance.
    var showsCodeEntryFrame: Bool {
        !needsNewCode && (hasCodeInHand || stage == .delivered)
    }

    /// Whether the primary CTA fires. Mirrors RN: a full-length code is
    /// the only requirement.
    var primaryCTAEnabled: Bool {
        codeInput.count == Self.codeLength && !isSubmitting
    }

    var primaryCTALabel: String {
        isSubmitting ? "Verifying…" : "Verify code"
    }

    /// Shown under the field when the backend starts counting down.
    var attemptsRemainingLabel: String? {
        guard let attemptsRemaining, attemptsRemaining <= 3 else { return nil }
        return attemptsRemaining == 1
            ? "1 attempt remaining"
            : "\(attemptsRemaining) attempts remaining"
    }

    var codeExpiryLabel: String? {
        codeExpiresOn.map { "Code expires \($0)" }
    }

    // MARK: - Mutations

    func updateCode(_ raw: String) {
        codeInput = String(raw.uppercased().prefix(Self.codeLength))
    }

    /// RN's "I already have a code" escape hatch — flips the screen to
    /// the code-entry frame without waiting on the delivery timeline.
    func markHasCode() {
        hasCodeInHand = true
        // RN's request step routes straight to `enter` — the user says
        // they're holding a card, so stop insisting on a new one.
        needsNewCode = false
        notice = nil
    }

    /// Request (or re-request) the mailed code via
    /// `POST /api/homes/:id/request-postcard`. The offline/test seam
    /// (`expectedCode != nil`) just clears the input.
    func requestNewCode() {
        codeInput = ""
        attemptsRemaining = nil
        guard expectedCode == nil else {
            needsNewCode = false
            return
        }
        guard !isRequestingCode else { return }
        isRequestingCode = true
        Task { await performRequestCode() }
    }

    /// Legacy entry point kept for the "Resend" affordance.
    func resendPostcard() {
        requestNewCode()
    }

    /// Used by the debug / preview tooling and the snapshot tests to
    /// flip between the in-transit and delivered frames without
    /// waiting on the simulated USPS clock.
    func setStage(_ next: PostcardDeliveryStage) {
        stage = next
        content = PostcardVerificationSampleData.content(for: next)
        if next == .delivered { hasCodeInHand = true }
    }

    func verifyTapped() {
        guard primaryCTAEnabled else { return }
        Task { await verify() }
    }

    func dismissTapped() {
        pendingEvent = .dismiss
    }

    func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Request

    private func performRequestCode() async {
        defer { isRequestingCode = false }
        do {
            let response = try await api.request(
                HomesEndpoints.requestPostcard(homeId: homeId),
                as: RequestPostcardResponse.self
            )
            needsNewCode = false
            // RN's `handleRequestCode` drops the user on the enter-code
            // step once the mailer accepts the request
            // (`verify-postcard.tsx:45`).
            hasCodeInHand = true
            submitState = .idle
            codeExpiresOn = Self.formatExpiry(response.postcard.expiresAt)
            notice = PostcardNotice(text: response.message, isError: false)
        } catch {
            guard let apiError = error as? APIError else {
                notice = PostcardNotice(text: "Couldn't request a code. Try again.", isError: true)
                return
            }
            let message = Self.serverMessage(from: apiError)
            if let message, message.localizedCaseInsensitiveContains("already have a pending") {
                // RN: an existing pending code drops the user straight
                // into the enter-code step.
                hasCodeInHand = true
                needsNewCode = false
                notice = PostcardNotice(
                    text: "A verification code has already been requested for this address. Enter it below.",
                    isError: false
                )
                return
            }
            notice = PostcardNotice(
                text: message ?? apiError.errorDescription ?? "Couldn't request a code. Try again.",
                isError: true
            )
        }
    }

    // MARK: - Submit

    private func verify() async {
        submitState = .submitting
        notice = nil
        if let expectedCode {
            // Offline/test seam — compare locally, no network.
            try? await Task.sleep(nanoseconds: submitDelayNanos)
            if codeInput == expectedCode {
                submitState = .submitted
                pendingEvent = .verified(homeId: homeId)
            } else {
                submitState = .error(message: "That code didn't match. Double-check the postcard.")
                codeInput = ""
            }
            return
        }
        do {
            _ = try await api.request(
                HomesEndpoints.verifyPostcard(
                    homeId: homeId,
                    request: VerifyPostcardRequest(code: codeInput)
                ),
                as: VerifyPostcardResponse.self
            )
            submitState = .submitted
            attemptsRemaining = nil
            needsNewCode = false
            pendingEvent = .verified(homeId: homeId)
        } catch {
            applyVerifyFailure(error)
        }
    }

    /// Map the handler's documented failure shapes
    /// (`backend/routes/homeOwnership.js:2548-2615`):
    ///   404 → no pending code, 410 → expired, 429 → too many attempts,
    ///   400 → invalid code + `attempts_remaining`.
    private func applyVerifyFailure(_ error: any Error) {
        guard let apiError = error as? APIError else {
            submitState = .error(message: "Couldn't verify that code. Try again.")
            return
        }
        switch apiError {
        case .transport:
            submitState = .error(message: "You're offline. Try again when you're back online.")
        case .notFound:
            needsNewCode = true
            codeInput = ""
            submitState = .error(
                message: "No pending verification code found. Request a new one."
            )
        case let .clientError(status, body):
            let message = APIError.friendlyClientMessage(body)
            if status == 410 || status == 429 {
                needsNewCode = true
                attemptsRemaining = 0
                codeInput = ""
                submitState = .error(
                    message: message ?? "That code has expired. Request a new one."
                )
                return
            }
            attemptsRemaining = Self.attemptsRemaining(in: body)
            codeInput = ""
            submitState = .error(
                message: message ?? "That code didn't match. Double-check the postcard."
            )
        default:
            codeInput = ""
            submitState = .error(
                message: apiError.errorDescription ?? "Couldn't verify that code. Try again."
            )
        }
    }

    // MARK: - Body parsing

    private static func serverMessage(from error: APIError) -> String? {
        if case let .clientError(_, body) = error {
            return APIError.friendlyClientMessage(body)
        }
        return nil
    }

    private static func attemptsRemaining(in body: String?) -> Int? {
        guard let body, let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json["attempts_remaining"] as? Int
    }

    private static func formatExpiry(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}
