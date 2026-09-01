//
//  VerifyLandlordSteps.swift
//  Pantopus
//
//  Step descriptor + form state for the A12.5 / A12.6 verify-landlord
//  wizard. The wizard renders a "1 of 3" / "2 of 3" counter on its first
//  two steps and then fires `.openPostcardVerification` so the host can
//  push the standalone A12.7 sibling screen (which carries its own
//  chrome — not wizard chrome).
//

import Foundation

/// Steps the verify-landlord wizard owns. The third leg of the flow
/// (A12.7 Postcard verification) lives outside this state machine; the
/// wizard advertises "1 of 3" / "2 of 3" purely so the user understands
/// where they are in the broader flow.
public enum VerifyLandlordStep: String, CaseIterable, Sendable {
    case start
    case details
    /// Terminal confirmation rendered after
    /// `POST /api/v1/tenant/request-approval` resolved — the landlord
    /// now has the request and can approve or deny it.
    case sent
}

/// Which Start variant the wizard renders. The fast-track path is
/// surfaced when 2+ other tenants in the building have already verified
/// the same landlord; we skip the email confirmation in that case.
public enum VerifyLandlordVariant: String, Sendable {
    case canonical
    case fastTrack = "fast_track"
}

/// Submit-time state machine — shared shape between iOS + Android.
public enum VerifyLandlordSubmitState: Sendable, Equatable {
    case idle
    case submitting
    case submitted
    case error(message: String)
}

/// Outcome of the tenant approval submit. Every field is copied out of
/// the backend's answer — nothing here is synthesised client-side.
public struct VerifyLandlordApprovalResult: Sendable, Equatable {
    public enum Kind: Sendable, Equatable {
        /// 201 — a fresh pending `HomeLease` was created.
        case submitted
        /// 409 — "You already have a pending request for this home".
        case alreadyPending
        /// 409 — "You already have an active lease at this home".
        case alreadyActive
    }

    public let kind: Kind
    /// `HomeLease.created_at` from the 201 body (nil on the 409 paths —
    /// the conflict response carries no lease).
    public let submittedAt: String?
    /// `HomeLease.start_at` — the move-in date the tenant asked for.
    public let requestedStartAt: String?
    /// `HomeLease.metadata.message` echoed back.
    public let message: String?
    /// The server's own sentence, surfaced verbatim on the 409 paths.
    public let serverMessage: String?

    public init(
        kind: Kind,
        submittedAt: String? = nil,
        requestedStartAt: String? = nil,
        message: String? = nil,
        serverMessage: String? = nil
    ) {
        self.kind = kind
        self.submittedAt = submittedAt
        self.requestedStartAt = requestedStartAt
        self.message = message
        self.serverMessage = serverMessage
    }

    public var headline: String {
        switch kind {
        case .submitted: "Request sent"
        case .alreadyPending: "Waiting for approval"
        case .alreadyActive: "You're already a verified tenant"
        }
    }

    public var body: String {
        switch kind {
        case .submitted:
            "Your request has been sent to the landlord. They'll review and approve your tenancy."
        case .alreadyPending:
            serverMessage ?? "You already have a pending request for this home."
        case .alreadyActive:
            serverMessage ?? "You already have an active lease at this home."
        }
    }
}

/// Detected attributes from a lease upload, used to drive the
/// done / warn DLeaseUpload variants and the unit-mismatch validation.
public struct VerifyLandlordLeaseFile: Sendable, Equatable {
    public let filename: String
    public let sizeLabel: String
    public let pageCount: Int
    public let detectedOwner: String?
    public let detectedUnit: String?

    public init(
        filename: String,
        sizeLabel: String,
        pageCount: Int,
        detectedOwner: String?,
        detectedUnit: String?
    ) {
        self.filename = filename
        self.sizeLabel = sizeLabel
        self.pageCount = pageCount
        self.detectedOwner = detectedOwner
        self.detectedUnit = detectedUnit
    }
}

/// Per-slot validation messages surfaced in the A12.6 error frame
/// (per-field chips) and aggregated into the top error-summary banner.
public struct VerifyLandlordValidationErrors: Sendable, Equatable {
    public var ownerName: String?
    public var contactName: String?
    public var email: String?
    public var lease: String?
    public var pmName: String?
    public var pmEmail: String?
    /// A12.6 "Your tenancy" — the move-in date only errors when it's
    /// present but not `YYYY-MM-DD` (the field itself is optional).
    public var moveInDate: String?

    public init(
        ownerName: String? = nil,
        contactName: String? = nil,
        email: String? = nil,
        lease: String? = nil,
        pmName: String? = nil,
        pmEmail: String? = nil,
        moveInDate: String? = nil
    ) {
        self.ownerName = ownerName
        self.contactName = contactName
        self.email = email
        self.lease = lease
        self.pmName = pmName
        self.pmEmail = pmEmail
        self.moveInDate = moveInDate
    }

    /// Used by the error-summary banner ("Fix N things to submit").
    public var count: Int {
        [ownerName, contactName, email, lease, pmName, pmEmail, moveInDate].compactMap { $0 }.count
    }

    /// Compact dot-separated list rendered as the banner sub-label
    /// ("Email format · Lease unit mismatch").
    public var compactSummary: String {
        var parts: [String] = []
        if email != nil { parts.append("Email format") }
        if lease != nil { parts.append("Lease unit mismatch") }
        if ownerName != nil { parts.append("Owner name") }
        if contactName != nil { parts.append("Contact name") }
        if pmName != nil { parts.append("PM name") }
        if pmEmail != nil { parts.append("PM email") }
        if moveInDate != nil { parts.append("Move-in date") }
        return parts.joined(separator: " · ")
    }

    public var isEmpty: Bool {
        [ownerName, contactName, email, lease, pmName, pmEmail, moveInDate].compactMap { $0 }.isEmpty
    }
}

/// The full A12.6 form state. Held inside the wizard VM and projected
/// into per-field views on the Details step.
public struct VerifyLandlordForm: Sendable, Equatable {
    public var ownerName: String
    public var contactName: String
    public var email: String
    public var phone: String
    public var lease: VerifyLandlordLeaseFile?
    public var pmEnabled: Bool
    public var pmName: String
    public var pmEmail: String
    public var pmPhone: String
    /// A12.6 "Your tenancy" — `YYYY-MM-DD`, sent as `start_at` on
    /// `POST /api/v1/tenant/request-approval`.
    public var moveInDate: String
    /// Free-text note forwarded to the landlord as the request
    /// `message` (capped at 1000 chars server-side).
    public var messageToLandlord: String

    /// The registered unit on the home record — drives the lease unit
    /// mismatch validation when the OCR'd unit doesn't agree.
    public var registeredUnit: String

    public init(
        ownerName: String = "",
        contactName: String = "",
        email: String = "",
        phone: String = "",
        lease: VerifyLandlordLeaseFile? = nil,
        pmEnabled: Bool = false,
        pmName: String = "",
        pmEmail: String = "",
        pmPhone: String = "",
        moveInDate: String = "",
        messageToLandlord: String = "",
        registeredUnit: String = ""
    ) {
        self.ownerName = ownerName
        self.contactName = contactName
        self.email = email
        self.phone = phone
        self.lease = lease
        self.pmEnabled = pmEnabled
        self.pmName = pmName
        self.pmEmail = pmEmail
        self.pmPhone = pmPhone
        self.moveInDate = moveInDate
        self.messageToLandlord = messageToLandlord
        self.registeredUnit = registeredUnit
    }

    /// Maximum length the backend accepts for the request message
    /// (`tenantRequestSchema`, `backend/routes/landlordTenant.js:64`).
    public static let messageMaxLength = 1000

    /// Pure validation projection — same logic on iOS + Android. Surfaces
    /// the three contracts from the audit:
    ///   1. Email must be RFC-shaped (`x@y.z`).
    ///   2. The lease's detected unit must match `registeredUnit` when
    ///      OCR was able to read one.
    ///   3. When the PM toggle is on, PM name + PM email are both
    ///      required (PM phone stays optional).
    public func validate() -> VerifyLandlordValidationErrors {
        var errors = VerifyLandlordValidationErrors()
        if ownerName.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.ownerName = "Required"
        }
        if contactName.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.contactName = "Required"
        }
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        if trimmedEmail.isEmpty {
            errors.email = "Required"
        } else if !Self.looksLikeEmail(trimmedEmail) {
            errors.email = "Missing top-level domain"
        }
        if let lease {
            if let detected = lease.detectedUnit,
               !registeredUnit.isEmpty,
               detected.caseInsensitiveCompare(registeredUnit) != .orderedSame {
                errors.lease = "Unit mismatch"
            }
        } else {
            errors.lease = "Required"
        }
        if pmEnabled {
            if pmName.trimmingCharacters(in: .whitespaces).isEmpty {
                errors.pmName = "Required"
            }
            let trimmedPmEmail = pmEmail.trimmingCharacters(in: .whitespaces)
            if trimmedPmEmail.isEmpty {
                errors.pmEmail = "Required"
            } else if !Self.looksLikeEmail(trimmedPmEmail) {
                errors.pmEmail = "Missing top-level domain"
            }
        }
        let trimmedMoveIn = moveInDate.trimmingCharacters(in: .whitespaces)
        if !trimmedMoveIn.isEmpty, !Self.looksLikeISODate(trimmedMoveIn) {
            errors.moveInDate = "Use YYYY-MM-DD"
        }
        return errors
    }

    /// `YYYY-MM-DD` as an ISO calendar date. Sent to the backend as
    /// `start_at` after being widened to a full ISO-8601 timestamp.
    static func looksLikeISODate(_ candidate: String) -> Bool {
        let parts = candidate.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              year >= 1900, (1...12).contains(month), (1...31).contains(day) else {
            return false
        }
        return true
    }

    /// Widen `YYYY-MM-DD` into the ISO-8601 timestamp Joi's
    /// `.isoDate()` expects. Returns nil when the field is blank.
    public var startAtISO: String? {
        let trimmed = moveInDate.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, Self.looksLikeISODate(trimmed) else { return nil }
        return "\(trimmed)T00:00:00.000Z"
    }

    /// The message forwarded to the landlord. The tenant's own note
    /// leads; the landlord / PM details they filled in are appended so
    /// the wizard no longer throws them away (the backend has no
    /// structured column for them — `tenantRequestSchema` accepts
    /// `message` only).
    public var composedMessage: String? {
        var lines: [String] = []
        let note = messageToLandlord.trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { lines.append(note) }

        let landlordParts = [ownerName, contactName, email, phone]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if !landlordParts.isEmpty {
            lines.append("Landlord: " + landlordParts.joined(separator: " · "))
        }

        if pmEnabled {
            let pmParts = [pmName, pmEmail, pmPhone]
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            if !pmParts.isEmpty {
                lines.append("Property manager: " + pmParts.joined(separator: " · "))
            }
        }
        if let lease {
            lines.append("Lease on file: \(lease.filename)")
        }

        guard !lines.isEmpty else { return nil }
        let joined = lines.joined(separator: "\n")
        guard joined.count > Self.messageMaxLength else { return joined }
        return String(joined.prefix(Self.messageMaxLength))
    }

    /// Lightweight client-side check — catches the missing-TLD case
    /// from the design ("mira@elmstholdings"). Server-side still runs
    /// the authoritative validation.
    static func looksLikeEmail(_ candidate: String) -> Bool {
        guard let at = candidate.firstIndex(of: "@") else { return false }
        let local = candidate[..<at]
        let domain = candidate[candidate.index(after: at)...]
        guard !local.isEmpty, domain.contains(".") else { return false }
        // Rule out a trailing dot or leading dot in the domain
        // ("mira@elmstholdings.") and require at least one char after
        // the final dot so the TLD case from the audit fails closed.
        let parts = domain.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count >= 2, let tld = parts.last, !tld.isEmpty else { return false }
        return true
    }
}

/// Outbound events the wizard view needs the host nav stack to act on.
public enum VerifyLandlordOutboundEvent: Sendable, Equatable {
    case dismiss
    /// Submit succeeded — pop the wizard and push the standalone A12.7
    /// Postcard verification screen so the user can track delivery.
    case openPostcardVerification(homeId: String)
}
