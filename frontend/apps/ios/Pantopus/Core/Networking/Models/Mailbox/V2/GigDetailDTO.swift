//
//  GigDetailDTO.swift
//  Pantopus
//
//  Gig-shaped sub-payload decoded from `mail.object_payload` when
//  `mail_type == "gig"` — the A17.6 "bid on your gig" mail body. Like the
//  other V2 category payloads the shape is untyped on the wire (stored as
//  JSON), so every nested field is optional and `decode(from:)` returns nil
//  when the bare-minimum set (bidder name + bid amount + post title) is
//  absent. The body then falls back to the placeholder layout.
//

import Foundation

/// One incoming bid on a gig the recipient posted, plus the gig summary,
/// the competing bids, and the post-acceptance next-steps timeline.
public struct GigDetailDTO: Sendable, Hashable {
    public let gigId: String?
    public let bidId: String?
    /// True once the recipient has accepted this bid. Drives the secondary
    /// state: the three-way action row is swapped for the next-steps
    /// timeline + an "Open thread" CTA.
    public let isAccepted: Bool
    public let bidder: Bidder
    public let bid: Bid
    public let post: Post
    public let otherBids: [OtherBid]
    public let nextSteps: [NextStep]

    public init(
        gigId: String? = nil,
        bidId: String? = nil,
        isAccepted: Bool,
        bidder: Bidder,
        bid: Bid,
        post: Post,
        otherBids: [OtherBid],
        nextSteps: [NextStep]
    ) {
        self.gigId = gigId
        self.bidId = bidId
        self.isAccepted = isAccepted
        self.bidder = bidder
        self.bid = bid
        self.post = post
        self.otherBids = otherBids
        self.nextSteps = nextSteps
    }

    /// Returns a copy flagged accepted — used by the view-model to
    /// optimistically flip into the secondary state when the recipient
    /// taps Accept.
    public func accepted() -> GigDetailDTO {
        GigDetailDTO(
            gigId: gigId,
            bidId: bidId,
            isAccepted: true,
            bidder: bidder,
            bid: bid,
            post: post,
            otherBids: otherBids,
            nextSteps: nextSteps
        )
    }

    // MARK: - Nested shapes

    /// The neighbor who placed the bid.
    public struct Bidder: Sendable, Hashable {
        public let initials: String
        public let name: String
        public let handle: String
        public let blurb: String
        public let rating: Double
        public let jobs: Int
        public let responseTime: String
        /// Identity-pillar chip label (e.g. "Personal").
        public let identityLabel: String
        public let isVerified: Bool
        public let badges: [String]

        public init(
            initials: String,
            name: String,
            handle: String,
            blurb: String,
            rating: Double,
            jobs: Int,
            responseTime: String,
            identityLabel: String,
            isVerified: Bool,
            badges: [String]
        ) {
            self.initials = initials
            self.name = name
            self.handle = handle
            self.blurb = blurb
            self.rating = rating
            self.jobs = jobs
            self.responseTime = responseTime
            self.identityLabel = identityLabel
            self.isVerified = isVerified
            self.badges = badges
        }
    }

    /// The bid itself: amount + timing + the bidder's note.
    public struct Bid: Sendable, Hashable {
        public let amount: Int
        public let unit: String
        public let eta: String
        public let expires: String
        public let message: [String]

        public init(amount: Int, unit: String, eta: String, expires: String, message: [String]) {
            self.amount = amount
            self.unit = unit
            self.eta = eta
            self.expires = expires
            self.message = message
        }
    }

    /// Summary of the gig being bid on — tappable, opens the gig thread.
    public struct Post: Sendable, Hashable {
        public let title: String
        public let categoryLabel: String
        public let posted: String
        public let expires: String
        public let budget: String
        public let schedule: String
        public let location: String
        public let details: String
        public let bidCount: Int

        public init(
            title: String,
            categoryLabel: String,
            posted: String,
            expires: String,
            budget: String,
            schedule: String,
            location: String,
            details: String,
            bidCount: Int
        ) {
            self.title = title
            self.categoryLabel = categoryLabel
            self.posted = posted
            self.expires = expires
            self.budget = budget
            self.schedule = schedule
            self.location = location
            self.details = details
            self.bidCount = bidCount
        }
    }

    /// A competing bid surfaced in the comparison strip.
    public struct OtherBid: Sendable, Hashable, Identifiable {
        public let id: String
        public let who: String
        public let initials: String
        public let amount: Int
        public let rating: Double
        public let jobs: Int
        public let whenText: String
        /// "cheapest" / "top-rated" flag, or nil.
        public let flag: String?

        public init(
            id: String,
            who: String,
            initials: String,
            amount: Int,
            rating: Double,
            jobs: Int,
            whenText: String,
            flag: String?
        ) {
            self.id = id
            self.who = who
            self.initials = initials
            self.amount = amount
            self.rating = rating
            self.jobs = jobs
            self.whenText = whenText
            self.flag = flag
        }
    }

    /// Lifecycle state of a next-step row in the accepted timeline.
    public enum StepState: String, Sendable, Hashable {
        case active, pending, upcoming
    }

    /// One row of the post-acceptance next-steps timeline.
    public struct NextStep: Sendable, Hashable, Identifiable {
        public let id: String
        public let label: String
        public let whenText: String
        public let state: StepState

        public init(id: String, label: String, whenText: String, state: StepState) {
            self.id = id
            self.label = label
            self.whenText = whenText
            self.state = state
        }
    }

    // MARK: - Decode

    /// Best-effort decode from a JSON envelope. Returns nil unless the
    /// bidder name, bid amount, and post title are all present.
    public static func decode(from value: JSONValue?) -> GigDetailDTO? {
        guard let dict = value?.dictValue,
              let bidderDict = dict["bidder"]?.dictValue,
              let bidDict = dict["bid"]?.dictValue,
              let postDict = dict["post"]?.dictValue else { return nil }

        guard let name = bidderDict["name"]?.stringValue, !name.isEmpty,
              let amount = bidDict["amount"]?.numberValue,
              let title = postDict["title"]?.stringValue, !title.isEmpty else { return nil }

        let bidder = Bidder(
            initials: bidderDict["initials"]?.stringValue ?? Self.initials(from: name),
            name: name,
            handle: bidderDict["handle"]?.stringValue ?? "",
            blurb: bidderDict["blurb"]?.stringValue ?? "",
            rating: bidderDict["rating"]?.numberValue ?? 0,
            jobs: Int(bidderDict["jobs"]?.numberValue ?? 0),
            responseTime: bidderDict["response_time"]?.stringValue ?? "—",
            identityLabel: bidderDict["identity"]?.stringValue ?? "Personal",
            isVerified: bidderDict["verified"]?.boolValue ?? false,
            badges: (bidderDict["badges"]?.arrayValue ?? []).compactMap(\.stringValue)
        )

        let bid = Bid(
            amount: Int(amount),
            unit: bidDict["unit"]?.stringValue ?? "flat",
            eta: bidDict["eta"]?.stringValue ?? "—",
            expires: bidDict["expires"]?.stringValue ?? "",
            message: (bidDict["message"]?.arrayValue ?? []).compactMap(\.stringValue)
        )

        let post = Post(
            title: title,
            categoryLabel: postDict["category"]?.stringValue ?? "Gig",
            posted: postDict["posted"]?.stringValue ?? "",
            expires: postDict["expires"]?.stringValue ?? "",
            budget: postDict["budget"]?.stringValue ?? "",
            schedule: postDict["schedule"]?.stringValue ?? "",
            location: postDict["where"]?.stringValue ?? "",
            details: postDict["details"]?.stringValue ?? "",
            bidCount: Int(postDict["bid_count"]?.numberValue ?? 0)
        )

        let otherBids: [OtherBid] = (dict["other_bids"]?.arrayValue ?? []).enumerated().compactMap { index, raw in
            guard let bidDict = raw.dictValue,
                  let who = bidDict["who"]?.stringValue,
                  let amount = bidDict["amount"]?.numberValue else { return nil }
            return OtherBid(
                id: bidDict["id"]?.stringValue ?? "other-\(index)",
                who: who,
                initials: bidDict["initials"]?.stringValue ?? Self.initials(from: who),
                amount: Int(amount),
                rating: bidDict["rating"]?.numberValue ?? 0,
                jobs: Int(bidDict["jobs"]?.numberValue ?? 0),
                whenText: bidDict["when"]?.stringValue ?? "",
                flag: bidDict["flag"]?.stringValue
            )
        }

        let nextSteps: [NextStep] = (dict["next_steps"]?.arrayValue ?? []).enumerated().compactMap { index, raw in
            guard let stepDict = raw.dictValue,
                  let label = stepDict["label"]?.stringValue else { return nil }
            return NextStep(
                id: stepDict["id"]?.stringValue ?? "step-\(index)",
                label: label,
                whenText: stepDict["when"]?.stringValue ?? "",
                state: StepState(rawValue: stepDict["state"]?.stringValue ?? "upcoming") ?? .upcoming
            )
        }

        return GigDetailDTO(
            gigId: Self.stringCandidate(in: dict, keys: ["gig_id", "gigId", "gig"])
                ?? Self.stringCandidate(in: postDict, keys: ["id", "gig_id", "gigId"]),
            bidId: Self.stringCandidate(in: dict, keys: ["bid_id", "bidId", "bid_offer_id"])
                ?? Self.stringCandidate(in: bidDict, keys: ["id", "bid_id", "bidId"]),
            isAccepted: dict["is_accepted"]?.boolValue ?? false,
            bidder: bidder,
            bid: bid,
            post: post,
            otherBids: otherBids,
            nextSteps: nextSteps
        )
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    private static func stringCandidate(in dict: [String: JSONValue], keys: [String]) -> String? {
        for key in keys {
            guard let value = dict[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else { continue }
            return value
        }
        return nil
    }
}
