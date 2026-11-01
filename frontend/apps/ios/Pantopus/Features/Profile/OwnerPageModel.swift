//
//  OwnerPageModel.swift
//  Pantopus
//
//  What your own profile shows besides what neighbors see (the 11-01 redesign,
//  `Own.dc.html`): the name and photo neighbors see and your account name
//  (`GET /api/local-profiles/me`), your month (`GET /api/users/me/monthly-receipt`),
//  how many neighbors joined from your invites (`GET /api/users/me/invite-progress`,
//  `/invite-code`), how many connections you have (`GET /api/relationships`),
//  and the tips only you see. Each read is optional: a failed one leaves its
//  line out.
//

import Foundation
import Logging
import Observation

/// A tip only the owner sees, until it's done or dismissed.
public enum ProfileOwnerTip: String, CaseIterable, Sendable, Hashable, Identifiable {
    case addPhoto
    case writeTagline
    case addSkills

    public var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .addPhoto: "Add a photo"
        case .writeTagline: "Write a tagline"
        case .addSkills: "Add what you help with"
        }
    }

    var detail: String {
        switch self {
        case .addPhoto: "Your initials show until you do. Only you see this tip."
        case .writeTagline: "One line about you, in bold under your name. Only you see this tip."
        case .addSkills: "Neighbors look for help nearby. Only you see this tip."
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .addPhoto: .camera
        case .writeTagline: .pencil
        case .addSkills: .hand
        }
    }
}

/// Your own profile's extras.
@MainActor
@Observable
public final class OwnerPageModel {
    /// The name, handle and photo neighbors see, and your account's name.
    public private(set) var localProfile: OwnLocalProfileResponse?
    public private(set) var monthlyReceipt: MonthlyReceiptDTO?
    public private(set) var inviteProgress: InviteProgressDTO?
    public private(set) var inviteCode: String?
    public private(set) var connectionCount: Int?
    /// Tips dismissed on this device.
    public private(set) var dismissedTips: Set<ProfileOwnerTip> = []

    private let userId: String
    private let client: APIClient
    private let store: ScreenStore
    private let defaults: UserDefaults
    private let logger = Logger(label: "app.pantopus.ios.OwnerPage")

    init(userId: String, client: APIClient = .shared, defaults: UserDefaults = .standard) {
        self.userId = userId
        self.client = client
        store = ScreenStore.store(for: client)
        self.defaults = defaults
        let saved = defaults.stringArray(forKey: Self.tipsKey(userId)) ?? []
        dismissedTips = Set(saved.compactMap(ProfileOwnerTip.init(rawValue:)))
    }

    /// Reads everything at once; a failed read keeps what was shown.
    public func load(force: Bool = false) async {
        let period = Self.receiptPeriod(now: Date())
        let lp: Task<OwnLocalProfileResponse?, Never> = start { try await self.you(LocalProfileEndpoints.me, force: force) }
        let receipt: Task<MonthlyReceiptDTO?, Never> = start {
            try await self.you(ProfileInsightsEndpoints.monthlyReceipt(year: period.year, month: period.month), force: force)
        }
        let progress: Task<InviteProgressDTO?, Never> = start {
            try await self.you(ProfileInsightsEndpoints.inviteProgress(), force: force)
        }
        let code: Task<InviteCodeDTO?, Never> = start { try await self.you(ProfileInsightsEndpoints.inviteCode(), force: force) }
        let connections: Task<RelationshipsListResponse?, Never> = start {
            try await self.client.request(RelationshipsEndpoints.list(status: "accepted"), as: RelationshipsListResponse.self)
        }
        localProfile = await lp.value ?? localProfile
        monthlyReceipt = await receipt.value ?? monthlyReceipt
        inviteProgress = await progress.value ?? inviteProgress
        inviteCode = await code.value?.inviteCode ?? inviteCode
        connectionCount = await connections.value.map(\.relationships.count) ?? connectionCount
    }

    /// The month the receipt covers: the previous calendar month, 1-based
    /// (RN `fetchReceipt`, `(tabs)/profile.tsx:102`).
    static func receiptPeriod(now: Date, calendar: Calendar = .current) -> (year: Int, month: Int) {
        let components = calendar.dateComponents([.year, .month], from: now)
        var year = components.year ?? 1970
        var month = (components.month ?? 1) - 1
        if month == 0 {
            month = 12
            year -= 1
        }
        return (year, month)
    }

    // MARK: - Names

    /// "Your account name, Rowan Park-Lee, stays private." Only when the name
    /// neighbors see is a different one.
    public var privateAccountNameLine: String? {
        guard let lp = localProfile else { return nil }
        let account = lp.account.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let shown = lp.profile.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !account.isEmpty, account.caseInsensitiveCompare(shown) != .orderedSame else { return nil }
        return "Your account name, \(account), stays private."
    }

    // MARK: - Your month

    /// "Your October" and what happened in it ("2 neighbors helped · 3 posts"),
    /// or nil when nothing did.
    public var monthLine: (title: String, detail: String)? {
        guard let receipt = monthlyReceipt else { return nil }
        var parts: [String] = []
        let helped = receipt.community.neighborsHelped
        if helped > 0 { parts.append("\(helped) \(helped == 1 ? "neighbor" : "neighbors") helped") }
        let posts = receipt.community.postsCreated
        if posts > 0 { parts.append("\(posts) \(posts == 1 ? "post" : "posts")") }
        let connections = receipt.community.connectionsMade
        if connections > 0 { parts.append("\(connections) new \(connections == 1 ? "connection" : "connections")") }
        let reviews = receipt.reputation.reviewsReceived
        if reviews > 0 { parts.append("\(reviews) \(reviews == 1 ? "review" : "reviews")") }
        guard !parts.isEmpty else { return nil }
        let month = DateFormatter().monthSymbols[max(0, min(11, receipt.period.month - 1))]
        return ("Your \(month)", parts.joined(separator: " · "))
    }

    /// What Share sends for your month (the receipt's own share text).
    public var monthShareMessage: String? {
        monthlyReceipt.map(MonthlyReceiptCard.shareMessage)
    }

    /// The invite link to share; nil until the invite code is read.
    public var inviteShareMessage: String? {
        guard let code = inviteCode, !code.isEmpty else { return nil }
        return "Join me on Pantopus! Use my invite code to get started: https://pantopus.com/join/\(code)"
    }

    /// "2 joined", or nil before anyone has.
    public var inviteJoinedLabel: String? {
        guard let joined = inviteProgress?.totalConverted, joined > 0 else { return nil }
        return "\(joined) joined"
    }

    // MARK: - Tips

    /// Up to two tips that still apply and weren't dismissed on this device.
    func tips(for profile: PublicProfile) -> [ProfileOwnerTip] {
        let applies: [ProfileOwnerTip] = ProfileOwnerTip.allCases.filter { tip in
            switch tip {
            case .addPhoto:
                localProfile.map { $0.profile.avatarUrl == nil }
                    ?? ((profile.profilePictureURL ?? profile.avatarURL) == nil)
            case .writeTagline: (profile.tagline ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            case .addSkills: profile.skills.isEmpty
            }
        }
        return Array(applies.filter { !dismissedTips.contains($0) }.prefix(2))
    }

    /// Hides a tip on this device.
    public func dismiss(_ tip: ProfileOwnerTip) {
        dismissedTips.insert(tip)
        defaults.set(dismissedTips.map(\.rawValue).sorted(), forKey: Self.tipsKey(userId))
    }

    private static func tipsKey(_ userId: String) -> String {
        "profile.ownerTips.dismissed.\(userId)"
    }

    // MARK: - Reads

    private func you<Value: Decodable & Sendable>(_ endpoint: Endpoint, force: Bool) async throws -> Value {
        try await store.load(endpoint, as: Value.self, kind: .you, topics: [ScreenTopic.profileMe], force: force).value
    }

    /// Reads run side by side as tasks awaited through `.value`, as on the Me
    /// screen (`async let` crashed the iOS 18 test host).
    private func start<T: Sendable>(_ operation: @escaping @Sendable () async throws -> T) -> Task<T?, Never> {
        Task {
            do {
                return try await operation()
            } catch {
                self.logger.warning("Owner page read failed: \(error)")
                return nil
            }
        }
    }
}
