import Foundation

enum HomePostalMessages {
    static func headline(kind: PendingHomePostalCommand.Kind, outcome: HomePostalOutcome?) -> String {
        switch outcome?.state {
        case "completed": kind == .code ? "Code accepted" : "Postcard requested"
        case "cancelled": "Attempt discarded"
        case "rejected": "Couldn't finish this"
        default: "Check your last attempt"
        }
    }

    static func explanation(kind: PendingHomePostalCommand.Kind, outcome: HomePostalOutcome?) -> String {
        switch outcome?.state {
        case "completed":
            kind == .code ? "Your code was accepted. Residency status shows your access and anything still waiting on the household."
                : "We'll mail it to this address. When it arrives, enter the code here."
        case "cancelled": "Nothing changed. This attempt was discarded before it took effect."
        case "rejected": restriction(outcome?.code ?? "")
        default: "We couldn't confirm whether this went through. Check again, or try again."
        }
    }

    static func postcardStatus(_ raw: String?) -> String {
        switch raw {
        case "pending": "Waiting for your code"
        case "verified": "Verified"
        case "expired": "Code expired"
        case "cancelled": "No longer active"
        case "locked": "No tries left"
        default: "Status unavailable"
        }
    }

    /// Once a postcard is verified, expired or replaced, how it travelled no longer matters.
    static func postcardEnded(_ status: String?) -> Bool {
        ["verified", "expired", "cancelled"].contains(status ?? "")
    }

    static func postcardHeadline(_ status: String?, delivery state: String?, attemptsRemaining: Int? = nil) -> String {
        switch status {
        case "verified": "Address verified by mail"
        // A code also expires when its tries are used up.
        case "expired": attemptsRemaining == 0 ? "No tries left for this postcard" : "Postcard code expired"
        case "cancelled": "Postcard no longer active"
        default: delivery(state)
        }
    }

    static func triesLeft(_ count: Int) -> String {
        count == 1 ? "1 try left" : "\(count) tries left"
    }

    static func delivery(_ state: String?) -> String {
        switch state {
        case "not_started": "Your postcard hasn't been sent yet"
        case "accepted": "Your postcard is on its way"
        case "unknown": "We couldn't confirm your postcard was sent"
        case "rejected": "The mail service couldn't send your postcard"
        default: "Postcard status unavailable"
        }
    }

    static func restriction(_ code: String) -> String {
        switch code {
        case "POSTCARD_WRONG_CODE": "That code didn't match this postcard. Check it and try again."
        case "POSTCARD_ADDRESS_CHANGED": "This address doesn't match the one saved for this Home. Check the street, apartment and ZIP."
        case "POSTCARD_EXPIRED": "This postcard's code has expired. Request a new postcard."
        case "POSTCARD_LOCKED": "No tries left for this postcard. Request a new one."
        case "POSTCARD_ACCESS_REVIEW_REQUIRED":
            "A mail code can't restore access that was removed or has ended. Ask someone in the household to invite you again."
        case "POSTCARD_REVIEW_ALREADY_RECORDED": "You're already verified. Residency status shows your access."
        case "POSTCARD_HOME_UNAVAILABLE": "Mail verification is unavailable for this Home right now."
        case "POSTCARD_RESIDENCY_REQUEST_REQUIRED": "Submit your residency request before requesting a postcard."
        default: availability(code)
        }
    }

    private static func availability(_ code: String) -> String {
        switch code {
        case "POSTCARD_COUNTRY_UNAVAILABLE": "Mail verification is currently available for US addresses."
        case "POSTCARD_ADDRESS_LIMIT": "Too many postcards have been requested for this address. Try again later."
        case "POSTCARD_USER_LIMIT": "You've asked for too many postcards in the last hour. Try again later."
        case "POSTCARD_NOT_DISPATCHED": "Your postcard hasn't been sent yet. Send it first."
        case "OWNERSHIP_FLOW_REQUIRED": "Continue ownership verification for this Home."
        case "HOME_NOT_FOUND": "This Home is no longer available. Check your residency status."
        default: "This couldn't be completed. Check your status and try again."
        }
    }
}
