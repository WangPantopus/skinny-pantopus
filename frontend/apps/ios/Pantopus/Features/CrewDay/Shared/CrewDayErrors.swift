//
//  CrewDayErrors.swift
//  Pantopus
//
//  What failed and what to do, in Crew Day's words (build kit 01-spec.md
//  "Copy"). The server's codes (02-contract.md §4) pick the sentence; its
//  own sentence is used for anything else it explains.
//

import Foundation

enum CrewDayErrors {
    /// The sentence for a failed Crew Day call.
    static func sentence(for error: any Error) -> String {
        guard let apiError = error as? APIError else { return "Something went wrong. Try again." }
        switch apiError {
        case let .clientError(_, body):
            if let code = code(in: body), let sentence = sentences[code] { return sentence }
            return apiError.errorDescription ?? "Something went wrong. Try again."
        case .forbidden:
            return "Crew Day isn't available to you right now."
        case .notFound:
            return "This Crew Day isn't available."
        case .transport:
            return "Can't reach Pantopus. Check your connection and try again."
        default:
            return apiError.errorDescription ?? "Something went wrong. Try again."
        }
    }

    /// The server's machine `code` from an error body.
    static func code(for error: any Error) -> String? {
        guard case let .clientError(_, body) = error as? APIError else { return nil }
        return code(in: body)
    }

    static func code(in body: String?) -> String? {
        guard let body, let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return json["code"] as? String
    }

    /// The copy for each refusal the apps show as it is.
    private static let sentences: [String: String] = [
        "DAY_FULL": "This Crew Day filled up while you were booking.",
        "BOOKING_CLOSED": "Booking has closed for this Crew Day.",
        "DAY_NOT_OPEN": "This Crew Day isn't taking bookings.",
        "OUT_OF_AREA": "This address is outside the Crew Day.",
        "ALREADY_BOOKED": "You already have a booking on this Crew Day.",
        "PAYMENT_METHOD_INVALID": "Your card couldn't be saved. Try another card.",
        "OWN_CREW": "This is your own Crew Day.",
        "ASK_THE_CREW": "It's less than 48 hours to go. Ask the crew to cancel.",
        "BUSINESS_NOT_READY": "Your business isn't ready for Crew Day yet. Finish the steps above.",
        "NOT_FOUND": "This Crew Day isn't available.",
        "CREW_DAY_UNAVAILABLE": "Crew Day isn't available to you right now."
    ]
}
