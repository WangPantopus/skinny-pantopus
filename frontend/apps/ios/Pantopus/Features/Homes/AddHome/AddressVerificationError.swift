import Foundation

/// A refusal from address verification, mapped to something a person can act on.
///
/// UX-06 — neither native client had any address layer. Both wizards let the
/// user complete every step, then took the 422 from `POST /api/homes` and
/// rendered it through the generic networking path, so the user saw a string
/// like "Request failed" with no indication of what was wrong with their
/// address or what to do about it. The `code` the server sends was referenced
/// nowhere in either app (audit 2026-08-22).
///
/// Copy is kept deliberately close to the web wizard so the same refusal reads
/// the same on every platform.
enum AddressVerificationError: String, CaseIterable {
    case missingUnit = "ADDRESS_MISSING_UNIT"
    case notHome = "ADDRESS_NOT_HOME"
    case undeliverable = "ADDRESS_UNDELIVERABLE"
    case conflict = "ADDRESS_CONFLICT"
    case lowConfidence = "ADDRESS_LOW_CONFIDENCE"
    case ambiguous = "ADDRESS_AMBIGUOUS"
    case poBox = "ADDRESS_PO_BOX"
    case missingStreetNumber = "ADDRESS_MISSING_STREET_NUMBER"
    case unverifiedStreetNumber = "ADDRESS_UNVERIFIED_STREET_NUMBER"
    case stepUpRequired = "ADDRESS_STEP_UP_REQUIRED"
    case unavailable = "ADDRESS_VALIDATION_UNAVAILABLE"

    /// What went wrong, in the user's terms.
    var message: String {
        switch self {
        case .missingUnit:
            "This address needs a unit or apartment number."
        case .notHome:
            "This looks like a business or office address, not a home."
        case .undeliverable:
            "We couldn't verify that mail can be delivered to this address."
        case .conflict:
            "Someone already lives at this address on Pantopus."
        case .lowConfidence:
            "We couldn't verify this address with enough confidence."
        case .ambiguous:
            "This address matched more than one location."
        case .poBox:
            "A PO Box can't be used as a home address."
        case .missingStreetNumber:
            "This address is missing a street number."
        case .unverifiedStreetNumber:
            "We couldn't confirm that street number on this street."
        case .stepUpRequired:
            "This building has both homes and businesses, so we need to confirm you live here."
        case .unavailable:
            "Address verification is temporarily unavailable."
        }
    }

    /// What the user should do next. Never "try again" for something that
    /// retrying cannot fix.
    var recoverySuggestion: String {
        switch self {
        case .missingUnit:
            "Add your unit or apartment number, then try again."
        case .notHome, .poBox:
            "Please enter the street address where you live."
        case .undeliverable, .missingStreetNumber, .unverifiedStreetNumber:
            "Double-check the address and try again."
        case .conflict:
            "Ask someone in the household to add you, or file a claim for review."
        case .lowConfidence, .ambiguous:
            "Try adding more detail, like a unit number."
        case .stepUpRequired:
            "We'll send a code to this address to confirm."
        case .unavailable:
            "This one is on us — please try again in a few minutes."
        }
    }

    /// Which wizard step can actually fix this.
    var isFixableInAddressStep: Bool {
        switch self {
        case .conflict, .unavailable, .stepUpRequired: false
        default: true
        }
    }

    /// Whether retrying the identical input could ever succeed.
    var isRetryable: Bool {
        self == .unavailable
    }

    /// Extract an address refusal from an API error, if that is what it is.
    ///
    /// Server errors are inspected too: `ADDRESS_VALIDATION_UNAVAILABLE` — the
    /// one retryable case, the provider outage — arrives as HTTP 503, which the
    /// networking layer surfaces as `.server`, not `.clientError`. Matching
    /// only client errors made the outage code unreachable during the exact
    /// incident it exists for.
    static func from(_ error: any Error) -> AddressVerificationError? {
        let raw: String?
        switch error {
        case let APIError.clientError(_, message):
            raw = message
        case let APIError.server(_, body):
            raw = body
        default:
            return nil
        }
        guard let raw,
              let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = json["code"] as? String else {
            return nil
        }
        return AddressVerificationError(rawValue: code)
    }
}
