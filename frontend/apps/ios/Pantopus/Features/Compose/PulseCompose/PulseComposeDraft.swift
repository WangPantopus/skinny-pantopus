//
//  PulseComposeDraft.swift
//  Pantopus
//
//  A Pantopus AI post card's fields, for the Pulse composer to start from:
//  the type, headline and text, and the event, deal, Lost & Found and
//  Heads Up fields the card carries when they apply (contract
//  `docs/product/ai-assistant-phase1-contract-2026-10-20.md` section 8).
//

import Foundation

public struct PulseComposeDraft: Hashable, Sendable {
    /// The post type (`event`, `deal`, `lost_found`, `alert`, …).
    public let postType: String?
    public let title: String?
    public let body: String
    /// ISO 8601 (or a bare `yyyy-MM-dd`).
    public let eventDate: String?
    public let eventEndDate: String?
    public let eventVenue: String?
    /// ISO 8601 (or a bare `yyyy-MM-dd`).
    public let dealExpiresAt: String?
    /// `lost` or `found`.
    public let lostFoundType: String?
    /// A Heads Up's kind (`hazard`, `other`).
    public let safetyAlertKind: String?

    public init(
        postType: String? = nil,
        title: String? = nil,
        body: String,
        eventDate: String? = nil,
        eventEndDate: String? = nil,
        eventVenue: String? = nil,
        dealExpiresAt: String? = nil,
        lostFoundType: String? = nil,
        safetyAlertKind: String? = nil
    ) {
        self.postType = postType
        self.title = title
        self.body = body
        self.eventDate = eventDate
        self.eventEndDate = eventEndDate
        self.eventVenue = eventVenue
        self.dealExpiresAt = dealExpiresAt
        self.lostFoundType = lostFoundType
        self.safetyAlertKind = safetyAlertKind
    }

    /// The purpose its post type names, so a deal opens the Deal form and a
    /// Heads Up the Heads Up form rather than the first form of their kind.
    public var purpose: PulseComposePurpose? {
        PulseComposePurpose.allCases.first { $0.postType == postType }
    }

    /// A date the card gave, as a moment: ISO 8601 with or without
    /// fractional seconds, or a bare day (taken at 9 AM on the device, as
    /// the composer takes a typed day).
    static func date(from raw: String?) -> Date? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw) { return date }
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .iso8601)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: raw).map { $0.addingTimeInterval(9 * 3600) }
    }
}
