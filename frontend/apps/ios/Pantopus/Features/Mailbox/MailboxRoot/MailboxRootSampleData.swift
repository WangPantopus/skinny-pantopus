//
//  MailboxRootSampleData.swift
//  Pantopus
//
//  B.1 — deterministic sample mail for the Mailbox root, keyed by
//  (drawer, tab). Backend has been removed from the repo, so the
//  view-model projects these into the render states; previews and tests
//  stay stable.
//
//  Me/Incoming mirrors the JSX `ME_INCOMING` set and Biz/Counter mirrors
//  `BIZ_COUNTER`. Every Earn combo is intentionally empty so the Earn
//  empty-state frame renders.
//

import Foundation

// swiftlint:disable multiline_arguments function_parameter_count

/// One sample row: a `MailItem` plus the sender-trust the V1 list DTO
/// can't carry on the wire (so the trust chip can vary per the design).
public struct MailboxSampleItem: Sendable, Hashable {
    public let item: MailItem
    public let trust: MailTrust

    public init(item: MailItem, trust: MailTrust) {
        self.item = item
        self.trust = trust
    }
}

/// A titled group of sample rows (e.g. "Today", "Due this week").
public struct MailboxSampleSection: Sendable, Hashable, Identifiable {
    public let id: String
    public let header: String
    public let items: [MailboxSampleItem]

    public init(id: String, header: String, items: [MailboxSampleItem]) {
        self.id = id
        self.header = header
        self.items = items
    }
}

public enum MailboxRootSampleData {
    /// Sections for a (drawer, tab) window. Empty array → the screen shows
    /// the per-combo empty state.
    public static func sections(_ drawer: MailboxDrawer, _ tab: MailboxTab) -> [MailboxSampleSection] {
        switch (drawer, tab) {
        case (.me, .incoming): meIncoming
        case (.me, .counter): meCounter
        case (.me, .vault): meVault
        case (.home, .incoming): homeIncoming
        case (.home, .counter): homeCounter
        case (.home, .vault): []
        case (.business, .incoming): businessIncoming
        case (.business, .counter): businessCounter
        case (.business, .vault): businessVault
        case (.earn, _): []
        }
    }

    // MARK: - Me

    private static let meIncoming: [MailboxSampleSection] = [
        MailboxSampleSection(id: "today", header: "Today", items: [
            mail(
                id: "me-in-1", category: .package,
                title: "Echo Pop arriving today by 8pm",
                preview: "Tracking 9405 5123 8746 0291 0042 18. Driver will leave it at the front porch and capture a photo.",
                sender: "Amazon Logistics", minutesAgo: 12, viewed: false, trust: .verified
            ),
            mail(
                id: "me-in-2", category: .certified,
                title: "Notice of public hearing — 412 Elm St",
                preview: "Re zoning variance ZA-2026-0188. Hearing scheduled June 3 at 6 PM. Written comment accepted through May 30.",
                sender: "City of Oakland · Planning", minutesAgo: 60, viewed: false, trust: .verified
            )
        ]),
        MailboxSampleSection(id: "yesterday", header: "Yesterday", items: [
            mail(
                id: "me-in-3", category: .coupon,
                title: "20% off your next dozen croissants",
                preview: "Show this at checkout. Valid through Sun May 17. Sender is address-verified but not identity-verified.",
                sender: "4th & Market Bakery", minutesAgo: 60 * 24, viewed: true, trust: .partial
            ),
            mail(
                id: "me-in-4", category: .community,
                title: "Saturday playground cleanup — 9 to 11am",
                preview: "Coffee and donuts at the gazebo. Bring gloves if you have them. RSVP by Friday so we can order enough food.",
                sender: "Elm Park HOA", minutesAgo: 60 * 26, viewed: false, trust: .verified
            ),
            mail(
                id: "me-in-5", category: .booklet,
                title: "June primary voter guide — 28 pages",
                preview: "Candidate questionnaires, ballot measure breakdowns, and a polling place lookup.",
                sender: "League of Women Voters", minutesAgo: 60 * 48, viewed: true, trust: .verified
            )
        ])
    ]

    private static let meCounter: [MailboxSampleSection] = [
        MailboxSampleSection(id: "awaiting", header: "Awaiting your response", items: [
            mail(
                id: "me-co-1", category: .bill,
                title: "Water bill — $58.20 due May 28",
                preview: "Autopay is off for this account. Pay before the due date to avoid a late fee.",
                sender: "EBMUD", minutesAgo: 120, viewed: false, trust: .verified
            ),
            mail(
                id: "me-co-2", category: .membership,
                title: "Renew your library card",
                preview: "Your card expires May 31. Renew online in two minutes to keep your holds active.",
                sender: "Oakland Public Library", minutesAgo: 60 * 30, viewed: false, trust: .verified
            )
        ])
    ]

    private static let meVault: [MailboxSampleSection] = [
        MailboxSampleSection(id: "saved", header: "Saved", items: [
            mail(
                id: "me-va-1", category: .certified,
                title: "Lease — 412 Elm St (signed)",
                preview: "Fully executed copy of your 12-month residential lease. Stored for your records.",
                sender: "Cornerstone Realty", minutesAgo: 60 * 24 * 9, viewed: true, trust: .verified
            ),
            mail(
                id: "me-va-2", category: .statement,
                title: "2025 tax summary",
                preview: "Year-end summary of the income documents connected to your account.",
                sender: "Pantopus", minutesAgo: 60 * 24 * 14, viewed: true, trust: .chain
            )
        ])
    ]

    // MARK: - Home

    private static let homeIncoming: [MailboxSampleSection] = [
        MailboxSampleSection(id: "today", header: "Today", items: [
            mail(
                id: "home-in-1", category: .community,
                title: "Building water shutoff Thursday 9am–12pm",
                preview: "Maintenance will flush the risers. Store water ahead of time.",
                sender: "Maple Court HOA", minutesAgo: 90, viewed: false, trust: .verified
            ),
            mail(
                id: "home-in-2", category: .package,
                title: "Dishwasher part out for delivery",
                preview: "Replacement rack arriving today. Signature not required.",
                sender: "PartSelect", minutesAgo: 150, viewed: false, trust: .verified
            )
        ]),
        MailboxSampleSection(id: "earlier", header: "Earlier", items: [
            mail(
                id: "home-in-3", category: .notice,
                title: "Annual fire inspection scheduled",
                preview: "The inspector will need access to all units June 10. Reply to confirm.",
                sender: "City Fire Marshal", minutesAgo: 60 * 40, viewed: true, trust: .verified
            )
        ])
    ]

    private static let homeCounter: [MailboxSampleSection] = [
        MailboxSampleSection(id: "due", header: "Due soon", items: [
            mail(
                id: "home-co-1", category: .bill,
                title: "HOA dues — $310 due June 1",
                preview: "Quarterly dues for Maple Court. Pay online or by check.",
                sender: "Maple Court HOA", minutesAgo: 200, viewed: false, trust: .verified
            )
        ])
    ]

    // MARK: - Business

    private static let businessIncoming: [MailboxSampleSection] = [
        MailboxSampleSection(id: "today", header: "Today", items: [
            mail(
                id: "biz-in-1", category: .delivery,
                title: "Linen order delivered to back entrance",
                preview: "24 tablecloths and 96 napkins signed for by staff.",
                sender: "Riverside Linen Supply", minutesAgo: 100, viewed: false, trust: .verified
            ),
            mail(
                id: "biz-in-2", category: .subscription,
                title: "POS software renews June 15",
                preview: "Your annual plan renews automatically. Review your seat count before then.",
                sender: "SquareUp", minutesAgo: 60 * 33, viewed: true, trust: .partial
            )
        ])
    ]

    private static let businessCounter: [MailboxSampleSection] = [
        MailboxSampleSection(id: "due", header: "Due this week", items: [
            mail(
                id: "biz-co-1", category: .tax,
                title: "Q1 2026 sales tax filing due May 17",
                preview: "Estimated liability $1,840.12 based on connected POS. File on time to avoid the 10% penalty.",
                sender: "CA Dept of Tax & Fee Admin", minutesAgo: 60 * 48, viewed: false, trust: .verified
            ),
            mail(
                id: "biz-co-2", category: .statement,
                title: "Statement of Information (SI-100) renewal",
                preview: "Annual filing to keep Pantopus Bakery Co LLC in good standing. $25 filing fee.",
                sender: "CA Secretary of State", minutesAgo: 60 * 120, viewed: false, trust: .verified
            )
        ]),
        MailboxSampleSection(id: "awaiting", header: "Awaiting your response", items: [
            mail(
                id: "biz-co-3", category: .legal,
                title: "Lease addendum — 1248 Oak Ave, suite 2",
                preview: "Mariah Chen requests your signature on Rider 3. Two signature fields and one initial.",
                sender: "Cornerstone Realty · via DocuSign", minutesAgo: 180, viewed: false, trust: .verified
            ),
            mail(
                id: "biz-co-4", category: .bill,
                title: "Invoice 4821 — $642.50 net 30",
                preview: "Auto-pay is disabled for this vendor. Confirm before May 28 to keep your 2% on-time discount.",
                sender: "Riverside Linen Supply", minutesAgo: 300, viewed: false, trust: .verified
            ),
            mail(
                id: "biz-co-5", category: .subscription,
                title: "Service migration — install window required",
                preview: "Your line transitions from copper to fiber on June 4. Pick a 2-hour install window.",
                sender: "Verizon Business", minutesAgo: 60 * 24, viewed: true, trust: .partial
            )
        ])
    ]

    private static let businessVault: [MailboxSampleSection] = [
        MailboxSampleSection(id: "saved", header: "Saved", items: [
            mail(
                id: "biz-va-1", category: .statement,
                title: "2025 profit & loss",
                preview: "Year-end P&L exported from your connected accounts.",
                sender: "Pantopus", minutesAgo: 60 * 24 * 15, viewed: true, trust: .chain
            )
        ])
    ]

    // MARK: - Builders

    /// Build a sample row from primitive fields. `MailItem` has no
    /// memberwise initializer (custom `Decodable`), so we round-trip a
    /// small JSON object. The literals are static and always valid; the
    /// `preconditionFailure` is unreachable and keeps the helper
    /// force-try / force-unwrap free.
    private static func mail(
        id: String,
        category: MailItemCategory,
        title: String,
        preview: String,
        sender: String,
        minutesAgo: Int,
        viewed: Bool,
        trust: MailTrust
    ) -> MailboxSampleItem {
        let json = """
        {
          "id": "\(id)",
          "type": "\(category.rawValue)",
          "mail_type": "\(category.rawValue)",
          "display_title": "\(title)",
          "preview_text": "\(preview)",
          "sender_business_name": "\(sender)",
          "viewed": \(viewed),
          "archived": false,
          "starred": false,
          "tags": [],
          "priority": "normal",
          "created_at": "\(iso(minutesAgo: minutesAgo))"
        }
        """
        guard let item = try? JSONDecoder().decode(MailItem.self, from: Data(json.utf8)) else {
            preconditionFailure("MailboxRootSampleData: invalid sample JSON for \(id)")
        }
        return MailboxSampleItem(item: item, trust: trust)
    }

    private static func iso(minutesAgo: Int) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date().addingTimeInterval(-Double(minutesAgo) * 60))
    }
}
