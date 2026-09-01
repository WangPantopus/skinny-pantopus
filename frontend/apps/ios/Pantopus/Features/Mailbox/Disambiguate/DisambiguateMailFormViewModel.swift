//
//  DisambiguateMailFormViewModel.swift
//  Pantopus
//
//  A13.15 Disambiguate — reshaped recipient picker. The user has scanned a
//  piece of physical mail; an OCR pass returned a name that matches several
//  residents at the address. This screen pairs the scanned envelope (with an
//  `EnvelopeOcrBox` overlay) with a ranked candidate list so the recipient
//  can be resolved in one tap.
//
//  Two frames share one scaffold, driven by the OCR read `confidence`:
//    • clean   (≥ clarityThreshold) — solid sky OCR box · good `OcrStrip` ·
//        a strong match pre-selected · quick-action chips · Confirm enabled.
//    • unclear (< clarityThreshold) — dashed amber OCR box + water-stain ·
//        warn `OcrStrip` · candidates shown as inert "best guesses" · a
//        fallback card (re-scan / type / return / junk) · Confirm disabled.
//
//  Resolution still POSTs `/api/mailbox/v2/resolve`
//  (`backend/routes/mailboxV2.js:555`, `resolveRoutingSchema`): the backend
//  resolves into one of three drawers (`personal | home | business`), so each
//  candidate carries the `drawer` it routes to. The candidate ranking itself
//  is sample data — there is no candidates endpoint yet (real OCR ranking is
//  out of scope; confidence values are hardcoded).
//

import Foundation
import Observation

/// Role of a candidate within the household. Drives the role chip tint and
/// the avatar identity gradient.
public enum CandidateRole: String, Sendable, Equatable {
    case owner
    case resident
    case guest

    /// Role-chip label.
    public var title: String {
        switch self {
        case .owner: "Owner"
        case .resident: "Resident"
        case .guest: "Guest"
        }
    }
}

/// Whether a candidate currently receives mail at this address — the candidate
/// "grant line".
public enum MailGrant: Sendable, Equatable {
    case receivesMail
    case noMailAccess

    public var label: String {
        switch self {
        case .receivesMail: "Receives mail"
        case .noMailAccess: "No mail access"
        }
    }
}

/// Match-strength tier derived from a candidate's OCR-vs-record score. Drives
/// the `MatchBadge` palette + word.
public enum MailMatchTier: Sendable, Equatable {
    case strong
    case partial
    case weak

    /// Tier from a 0...1 match score. ≥ 0.7 strong, ≥ 0.35 partial, else weak.
    public static func from(score: Double) -> MailMatchTier {
        switch score {
        case 0.7...: .strong
        case 0.35..<0.7: .partial
        default: .weak
        }
    }

    /// Leading word in the badge (`Strong match` / `Partial` / `Weak`).
    public var word: String {
        switch self {
        case .strong: "Strong match"
        case .partial: "Partial"
        case .weak: "Weak"
        }
    }
}

/// A possible recipient surfaced for the scanned mail. Sample data — there is
/// no candidates endpoint, so `matchScore` is hardcoded per frame.
public struct MailCandidate: Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let role: CandidateRole
    public let grant: MailGrant
    /// OCR-vs-record match score in `0...1`.
    public let matchScore: Double
    /// Tiny status line under the role chip (e.g. "Owner since 2019 · Apt 3B").
    public let presence: String?
    /// Whether the candidate is a verified household member (avatar check badge).
    public let verified: Bool
    /// Backend drawer this candidate resolves into (`personal | home | business`).
    public let drawer: String

    public init(
        id: String,
        name: String,
        role: CandidateRole,
        grant: MailGrant,
        matchScore: Double,
        presence: String? = nil,
        verified: Bool = false,
        drawer: String
    ) {
        self.id = id
        self.name = name
        self.role = role
        self.grant = grant
        self.matchScore = matchScore
        self.presence = presence
        self.verified = verified
        self.drawer = drawer
    }

    /// Two-letter initials derived from the display name.
    public var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    /// Whole-percent match score for the badge / label.
    public var matchPercent: Int {
        Int((matchScore * 100).rounded())
    }

    public var tier: MailMatchTier {
        .from(score: matchScore)
    }
}

/// What the user picked as the routing target.
public enum MailRoutingSelection: Sendable, Equatable {
    /// One of the listed candidates, by id.
    case candidate(String)
    /// The "This is me" quick action — routes to the personal drawer.
    case me
}

/// A fallback path offered in the unclear frame when no candidate is confident.
public enum FallbackAction: String, CaseIterable, Identifiable, Sendable {
    case rescan
    case typeName
    case returnToSender
    case markAsJunk

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .rescan: "Re-scan envelope"
        case .typeName: "Type recipient name"
        case .returnToSender: "Return to sender"
        case .markAsJunk: "Mark as junk"
        }
    }

    public var subtitle: String {
        switch self {
        case .rescan: "Hold under brighter light. Most-used fix."
        case .typeName: "Skip OCR, enter the name yourself."
        case .returnToSender: "Mark as undeliverable — sender notified."
        case .markAsJunk: "Skip routing. Sender added to junk filter."
        }
    }

    /// Destructive rows render with an error-tinted icon tile.
    public var isDestructive: Bool {
        self == .markAsJunk
    }
}

/// Render state for the Disambiguate form.
public enum DisambiguateMailFormState: Sendable, Equatable {
    case editing
    case error(String)
}

/// ViewModel backing `DisambiguateMailFormView`.
@Observable
@MainActor
final class DisambiguateMailFormViewModel {
    /// Below this OCR read confidence the scan is treated as unclear.
    static let clarityThreshold = 0.6

    private(set) var state: DisambiguateMailFormState = .editing

    /// Detected recipient text rendered in the `OcrStrip` (single line, e.g.
    /// "Maria K. · 412 Elm St"). Wired in by the screen from the mail item.
    var ocrRecipient: String

    /// OCR read confidence (`0...1`). Drives the envelope tone, the `OcrStrip`
    /// tone, auto-pick, and whether Confirm is enabled.
    var confidence: Double

    /// Scanned-envelope image URL (nil → fall through to the artwork placeholder).
    var envelopeImageURL: URL?

    /// Ranked candidates (sample data).
    private(set) var candidates: [MailCandidate]

    /// Current routing selection (nil → nothing picked).
    private(set) var selection: MailRoutingSelection?

    /// Last fallback the user tapped in the unclear frame (out-of-scope wiring
    /// — surfaced as a toast for now). Kept for testability.
    private(set) var lastFallback: FallbackAction?

    /// Busy flag for the sticky CTA.
    private(set) var isSubmitting: Bool = false

    var toast: ToastMessage?
    /// Set true after a successful resolve so the screen can pop.
    private(set) var shouldDismiss: Bool = false

    private let mailId: String
    private let api: APIClient
    private let isOnlineProvider: @MainActor () -> Bool

    init(
        mailId: String,
        ocrRecipient: String = "",
        confidence: Double = 0.0,
        envelopeImageURL: URL? = nil,
        candidates: [MailCandidate]? = nil,
        api: APIClient = .shared,
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.mailId = mailId
        self.ocrRecipient = ocrRecipient
        self.confidence = confidence
        self.envelopeImageURL = envelopeImageURL
        self.api = api
        self.isOnlineProvider = isOnlineProvider
        let isClear = confidence >= Self.clarityThreshold
        self.candidates = candidates ?? Self.sampleCandidates(clear: isClear)
        // Clean scans auto-pick the single strong match so Confirm is live.
        if isClear, let strong = self.candidates.first(where: { $0.tier == .strong }) {
            selection = .candidate(strong.id)
        }
    }

    // MARK: - Derived presentation

    /// Envelope + OCR-box + strip tone.
    var ocrTone: EnvelopeOcrTone {
        confidence >= Self.clarityThreshold ? .clean : .unclear
    }

    /// True when the scan is too unclear to confirm a candidate directly.
    var isUnclear: Bool {
        ocrTone == .unclear
    }

    /// Whole-percent OCR read confidence.
    var confidencePercent: Int {
        Int((confidence * 100).rounded())
    }

    /// Detected text shown on the envelope name line + `OcrStrip`.
    var detectedText: String {
        if !ocrRecipient.isEmpty { return ocrRecipient }
        return isUnclear ? "M___ K___ · 4__ Elm St" : "Maria K. · 412 Elm St"
    }

    /// Sub-line under the detected text in the `OcrStrip`.
    var ocrSubtext: String {
        isUnclear
            ? "Smudge on the name line. Try a brighter re-scan for a sharper read."
            : "Address matches this household."
    }

    /// OCR-box pill label (e.g. "name · 97%").
    var ocrBoxLabel: String {
        "name · \(confidencePercent)%"
    }

    /// Overline above the candidate list — differs by frame.
    var candidatesOverline: String {
        isUnclear ? "Best guesses · none confident" : "Who is this for?"
    }

    /// Computed "primary action enabled" — drives the sticky Confirm CTA.
    /// Unclear scans always disable Confirm (the fallback card is the path
    /// forward); clean scans enable once something is selected.
    var canConfirm: Bool {
        guard !isUnclear, !isSubmitting else { return false }
        return selection != nil
    }

    /// Hint shown above the disabled Confirm CTA in the unclear frame.
    var confirmHint: String? {
        isUnclear ? "Pick a recipient — or choose a fallback above." : nil
    }

    /// True once the user has touched the form. Drives the discard-confirm.
    var isDirty: Bool {
        selection != nil || lastFallback != nil
    }

    /// True for `id` when it is the current candidate selection.
    func isSelected(_ id: String) -> Bool {
        selection == .candidate(id)
    }

    // MARK: - Intents

    /// Pick a candidate row (clean frame only — unclear rows are inert).
    func selectCandidate(_ id: String) {
        guard !isUnclear else { return }
        selection = .candidate(id)
    }

    /// "This is me" quick action — routes to the personal drawer.
    func selectThisIsMe() {
        guard !isUnclear else { return }
        selection = .me
    }

    /// "Route to…" quick action — clears the auto-pick so the user chooses a
    /// recipient (or a different address) themselves.
    func routeToOther() {
        guard !isUnclear else { return }
        selection = nil
    }

    /// Choose one of the unclear-frame fallback paths. Real wiring (re-scan
    /// camera, manual entry, return / junk endpoints) is out of scope, so this
    /// records the choice and surfaces a confirming toast.
    func selectFallback(_ action: FallbackAction) {
        lastFallback = action
        toast = ToastMessage(text: "\(action.title) — coming up.", kind: .success)
    }

    @discardableResult
    func submit() async -> Bool {
        guard let drawer = resolvedDrawer else {
            toast = ToastMessage(text: "Pick a recipient first.", kind: .error)
            return false
        }
        if !isOnlineProvider() {
            toast = ToastMessage(
                text: "You're offline. Try again when you're back online.",
                kind: .error
            )
            return false
        }
        isSubmitting = true
        defer { isSubmitting = false }
        let request = ResolveRoutingRequest(
            mailId: mailId,
            drawer: drawer,
            addAlias: nil,
            aliasString: nil
        )
        do {
            let response: ResolveRoutingResponse = try await api.request(
                MailboxV2Endpoints.resolve(request)
            )
            toast = ToastMessage(text: "Recipient confirmed.", kind: .success)
            _ = response.drawer
            // Hold the success toast on screen briefly before dismissing.
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            shouldDismiss = true
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't route this mail.",
                kind: .error
            )
            return false
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }

    /// The backend drawer for the current selection, or nil when nothing is
    /// picked / the scan is unclear.
    private var resolvedDrawer: String? {
        guard !isUnclear else { return nil }
        switch selection {
        case .me:
            return "personal"
        case let .candidate(id):
            return candidates.first { $0.id == id }?.drawer
        case nil:
            return nil
        }
    }

    // MARK: - Sample data

    /// Hardcoded candidate ranking. The clean set has one strong match; the
    /// unclear set degrades every score so nothing is confident.
    static func sampleCandidates(clear: Bool) -> [MailCandidate] {
        [
            MailCandidate(
                id: "maria",
                name: "Maria Kovács",
                role: .owner,
                grant: .receivesMail,
                matchScore: clear ? 0.97 : 0.41,
                presence: "Owner since 2019 · Apt 3B",
                verified: true,
                drawer: "home"
            ),
            MailCandidate(
                id: "marcus",
                name: "Marcus Khan",
                role: .resident,
                grant: .receivesMail,
                matchScore: clear ? 0.22 : 0.38,
                presence: "Moved in Jan · Apt 3B",
                verified: true,
                drawer: "home"
            ),
            MailCandidate(
                id: "mika",
                name: "Mika Kim",
                role: .guest,
                grant: .noMailAccess,
                matchScore: clear ? 0.18 : 0.19,
                presence: "Visiting until Sun",
                verified: false,
                drawer: "home"
            )
        ]
    }
}
