//
//  ReceivedReviewsViewModel.swift
//  Pantopus
//
//  BLOCK 2D — Marketplace transaction reviews. Drives the "received reviews"
//  section on a profile from `GET /api/transaction-reviews/user/:userId`
//  (route `backend/routes/transactionReviews.js:168`). The endpoint returns
//  the overall average + total; the star histogram and the per-criterion
//  breakdown (communication / accuracy / punctuality) are aggregated here
//  from the individual rows.
//

import Foundation
import Observation

/// Average + count for one optional sub-rating criterion.
public struct CriterionAverage: Sendable, Equatable {
    public let average: Double
    public let count: Int
}

/// One projected review row.
public struct ReceivedReviewRow: Sendable, Equatable, Identifiable {
    public let id: String
    public let reviewerName: String
    public let initials: String
    public let avatarURL: URL?
    public let rating: Int
    public let comment: String?
    public let contextLabel: String
    public let roleLabel: String?
    public let timestamp: String
}

/// Aggregated summary backing the loaded state.
public struct ReceivedReviewsSummary: Sendable, Equatable {
    public let average: Double
    public let total: Int
    /// Five fractions in `0...1`, ordered 5★→1★, for `RatingDistribution`.
    public let distribution: [Double]
    public let communication: CriterionAverage?
    public let accuracy: CriterionAverage?
    public let punctuality: CriterionAverage?
    public let rows: [ReceivedReviewRow]
}

@Observable
@MainActor
public final class ReceivedReviewsViewModel {
    public enum State: Sendable {
        case loading
        case empty
        case loaded(ReceivedReviewsSummary)
        case error(message: String)
    }

    public private(set) var state: State = .loading

    private let userId: String
    private let api: APIClient
    private let now: @Sendable () -> Date
    private var loadedOnce = false

    init(
        userId: String,
        api: APIClient = .shared,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.userId = userId
        self.api = api
        self.now = now
    }

    public func load() async {
        if !loadedOnce { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: TransactionReviewsResponse = try await api.request(
                TransactionReviewsEndpoints.userReviews(userId: userId)
            )
            loadedOnce = true
            if response.reviews.isEmpty {
                state = .empty
            } else {
                state = .loaded(Self.summarize(response, now: now()))
            }
        } catch {
            if !loadedOnce {
                state = .error(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load reviews."
                )
            }
        }
    }

    // MARK: - Pure aggregation (test surface)

    public static func summarize(
        _ response: TransactionReviewsResponse,
        now: Date
    ) -> ReceivedReviewsSummary {
        let reviews = response.reviews
        let total = reviews.count

        var buckets = [Int](repeating: 0, count: 5) // index 0 == 5★ … index 4 == 1★
        for review in reviews {
            let clamped = min(max(review.rating, 1), 5)
            buckets[5 - clamped] += 1
        }
        let distribution = buckets.map { total > 0 ? Double($0) / Double(total) : 0 }

        return ReceivedReviewsSummary(
            average: response.averageRating,
            total: response.total > 0 ? response.total : total,
            distribution: distribution,
            communication: criterionAverage(reviews.compactMap(\.communicationRating)),
            accuracy: criterionAverage(reviews.compactMap(\.accuracyRating)),
            punctuality: criterionAverage(reviews.compactMap(\.punctualityRating)),
            rows: reviews.map { row(for: $0, now: now) }
        )
    }

    static func criterionAverage(_ values: [Int]) -> CriterionAverage? {
        guard !values.isEmpty else { return nil }
        let sum = values.reduce(0, +)
        let average = (Double(sum) / Double(values.count) * 100).rounded() / 100
        return CriterionAverage(average: average, count: values.count)
    }

    static func row(for dto: TransactionReviewDTO, now: Date) -> ReceivedReviewRow {
        let name = displayName(for: dto.reviewer)
        let context = TransactionReviewContext.fromRaw(dto.context)
        return ReceivedReviewRow(
            id: dto.id,
            reviewerName: name,
            initials: initials(from: name),
            avatarURL: dto.reviewer?.profilePictureUrl.flatMap(URL.init(string:)),
            rating: min(max(dto.rating, 0), 5),
            comment: dto.comment?.isEmpty == false ? dto.comment : nil,
            contextLabel: context?.shortLabel ?? "Transaction",
            roleLabel: roleLabel(isBuyer: dto.isBuyer),
            timestamp: relativeTime(dto.createdAt, now: now)
        )
    }

    static func displayName(for reviewer: TransactionReviewerDTO?) -> String {
        if let first = reviewer?.firstName, !first.isEmpty {
            if let last = reviewer?.lastName, !last.isEmpty {
                return "\(first) \(last)"
            }
            return first
        }
        if let username = reviewer?.username, !username.isEmpty { return username }
        return "Neighbor"
    }

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init)
        let joined = letters.joined().uppercased()
        return joined.isEmpty ? "?" : joined
    }

    static func roleLabel(isBuyer: Bool?) -> String? {
        switch isBuyer {
        case true: "From buyer"
        case false: "From seller"
        default: nil
        }
    }

    static func relativeTime(_ raw: String?, now: Date) -> String {
        guard let date = parseDate(raw) else { return "" }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        let days = Int(interval / 86400)
        if days == 1 { return "yesterday" }
        if days < 7 { return "\(days)d ago" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601NoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }
}
