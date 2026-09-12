import Foundation

enum HomePostalMessages {
    static func headline(kind: PendingHomePostalCommand.Kind, outcome: HomePostalOutcome?) -> String {
        switch outcome?.state {
        case "completed": kind == .code ? "Address proof recorded" : "Mailing request recorded"
        case "cancelled": "Original request cancelled"
        case "rejected": "Review the recorded result"
        default: "Recover your original request"
        }
    }

    static func explanation(kind: PendingHomePostalCommand.Kind, outcome: HomePostalOutcome?) -> String {
        switch outcome?.state {
        case "completed":
            kind == .code ? "Check residency status for household review and access. This result does not change current permissions."
                : "Check current mailing status for delivery and any remaining steps. A saved request alone does not confirm mailing."
        case "cancelled": "This original request can no longer submit a new result. Review your details before starting another."
        case "rejected": restriction(outcome?.code ?? "")
        default: "Your details are saved securely. Check the result, retry the same request, or confirm cancellation before editing."
        }
    }

    static func delivery(_ state: String?) -> String {
        switch state {
        case "not_started": "Mailing has not started"
        case "accepted": "Mail provider accepted the postcard"
        case "unknown": "Mailing outcome is unknown"
        case "rejected": "Mail provider did not accept the postcard"
        default: "Mailing status is unavailable"
        }
    }

    static func restriction(_ code: String) -> String {
        switch code {
        case "POSTCARD_WRONG_CODE": "That code did not match. Review the recorded attempt before entering a corrected code."
        case "POSTCARD_ADDRESS_CHANGED": "The Home address changed. Confirm the street and apartment before requesting another postcard."
        case "POSTCARD_EXPIRED": "This postcard code expired. Confirm your mailing address before requesting another."
        case "POSTCARD_LOCKED": "This postcard has no code attempts remaining. Confirm your address before requesting another."
        case "POSTCARD_ACCESS_REVIEW_REQUIRED": "Household access needs review. A mail code cannot restore removed or expired access."
        case "POSTCARD_REVIEW_ALREADY_RECORDED": "Your verification is already recorded. Check residency status for current access."
        case "POSTCARD_HOME_UNAVAILABLE": "Mail verification is unavailable for this Home right now."
        case "POSTCARD_RESIDENCY_REQUEST_REQUIRED": "Submit your residency request before requesting a postcard."
        default: availability(code)
        }
    }

    private static func availability(_ code: String) -> String {
        switch code {
        case "POSTCARD_COUNTRY_UNAVAILABLE": "Mail verification is currently available for US addresses."
        case "POSTCARD_ADDRESS_LIMIT": "The request limit for this address has been reached. Try again later."
        case "POSTCARD_USER_LIMIT": "Your mail request limit has been reached. Try again later."
        case "POSTCARD_NOT_DISPATCHED": "Mailing has not started. Continue the original request first."
        case "OWNERSHIP_FLOW_REQUIRED": "Continue ownership verification for this Home."
        case "HOME_NOT_FOUND": "This Home is no longer available. Check your residency status."
        default: "Mail verification cannot continue right now. Refresh to check your current status before trying again."
        }
    }
}
