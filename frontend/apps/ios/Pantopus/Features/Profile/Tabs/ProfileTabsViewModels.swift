//
//  ProfileTabsViewModels.swift
//  Pantopus
//
//  Three view-models behind the public-profile tabs RN ships and native
//  did not: Portfolio, Gigs and (gig) Reviews.
//
//    Portfolio  GET    /api/files/portfolio[/:userId]  (files.js:489/:526)
//               POST   /api/files/portfolio            (files.js:362)
//               DELETE /api/files/:id                  (files.js:853)
//    Gigs       GET    /api/gigs?user_id=…&limit=20    (gigs.js:2089)
//    Reviews    GET    /api/reviews/user/:userId       (reviews.js:149)
//
//  Each mirrors the RN component it replaces —
//  `src/components/profile/PortfolioTab.tsx`, `GigsTab.tsx`,
//  `ReviewsTab.tsx` — and ships the four render states the project
//  requires. Mirrored on Android by `ProfileTabsViewModels.kt`.
//

// swiftlint:disable file_length function_parameter_count

import Foundation
import Logging
import Observation

// MARK: - Portfolio

/// Display bucket for a portfolio item, derived from the row's
/// `file_type`. Mirrors RN's `fileTypeToPortfolioType`
/// (`src/components/profile/PortfolioTab.tsx:75-83`).
public enum PortfolioItemKind: String, Sendable, Hashable, CaseIterable, Identifiable {
    case photo
    case video
    case article
    case certificate
    case other

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .photo: "Photo"
        case .video: "Video"
        case .article: "Article"
        case .certificate: "Certificate"
        case .other: "Other"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .photo: .camera
        case .video: .video
        case .article: .fileText
        case .certificate: .ribbon
        case .other: .moreHorizontal
        }
    }

    static func from(fileType: String?) -> PortfolioItemKind {
        switch fileType ?? "" {
        case "portfolio_image": .photo
        case "portfolio_video": .video
        case "portfolio_document", "resume": .article
        case "certification": .certificate
        default: .other
        }
    }
}

/// One projected portfolio card.
public struct PortfolioItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let imageURL: URL?
    /// Full-size asset opened by the viewer; falls back to `imageURL`.
    public let fullURL: URL?
    public let kind: PortfolioItemKind

    public init(
        id: String,
        title: String,
        subtitle: String?,
        imageURL: URL?,
        fullURL: URL?,
        kind: PortfolioItemKind
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.imageURL = imageURL
        self.fullURL = fullURL
        self.kind = kind
    }
}

/// Render state for the Portfolio tab.
public enum ProfilePortfolioState: Sendable, Equatable {
    case loading
    case empty
    case loaded([PortfolioItem])
    case error(message: String)
}

/// Loads (and, on your own profile, mutates) the portfolio grid.
@MainActor
@Observable
public final class ProfilePortfolioViewModel {
    public private(set) var state: ProfilePortfolioState = .loading
    /// `nil` = "All". Drives the media-type filter chips.
    public var activeFilter: PortfolioItemKind?
    /// True while a delete or upload is in flight.
    public private(set) var isMutating: Bool = false
    /// Item queued for the destructive confirm.
    public var pendingDelete: PortfolioItem?
    /// Item opened in the full-screen viewer.
    public var viewerItem: PortfolioItem?
    /// Drives the "Add portfolio item" sheet on your own profile.
    public var showAddSheet: Bool = false
    public var toastMessage: String?

    private var allItems: [PortfolioItem] = []
    private let userId: String
    private let isOwnProfile: Bool
    private let client: APIClient
    private let uploader: MultipartUploader
    private let logger = Logger(label: "app.pantopus.ios.ProfilePortfolio")

    init(
        userId: String,
        isOwnProfile: Bool,
        client: APIClient = .shared,
        uploader: MultipartUploader = .shared
    ) {
        self.userId = userId
        self.isOwnProfile = isOwnProfile
        self.client = client
        self.uploader = uploader
    }

    /// Visible items after the media-type filter.
    public var filteredItems: [PortfolioItem] {
        guard let activeFilter else { return allItems }
        return allItems.filter { $0.kind == activeFilter }
    }

    /// Filter chips actually worth showing — RN only renders the strip
    /// when more than one type is present
    /// (`PortfolioTab.tsx:235`).
    public var availableFilters: [PortfolioItemKind] {
        PortfolioItemKind.allCases.filter { kind in allItems.contains { $0.kind == kind } }
    }

    public func count(of kind: PortfolioItemKind) -> Int {
        allItems.filter { $0.kind == kind }.count
    }

    public var totalCount: Int {
        allItems.count
    }

    public var canEdit: Bool {
        isOwnProfile
    }

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        // Your own profile reads the authenticated route so private
        // documents come back too; someone else's reads the public one.
        let endpoint = isOwnProfile
            ? ProfileTabsEndpoints.myPortfolio()
            : ProfileTabsEndpoints.portfolio(userId: userId)
        do {
            let response = try await client.request(endpoint, as: PortfolioListResponse.self)
            allItems = response.files.map(Self.project)
            state = allItems.isEmpty ? .empty : .loaded(allItems)
        } catch let error as APIError {
            logger.warning("Portfolio load failed: \(error)")
            state = .error(message: Self.friendlyMessage(for: error))
        } catch {
            logger.warning("Portfolio load failed: \(error)")
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    /// `DELETE /api/files/:id` behind the confirm. Awaited, not
    /// optimistic — a 403 must leave the grid untouched.
    public func confirmDelete() async {
        guard let item = pendingDelete, !isMutating else { return }
        pendingDelete = nil
        isMutating = true
        defer { isMutating = false }
        do {
            _ = try await client.request(
                ProfileTabsEndpoints.deleteFile(id: item.id),
                as: FileDeleteResponse.self
            )
            toastMessage = "Portfolio item deleted"
            await fetch()
        } catch let error as APIError {
            logger.warning("Portfolio delete failed: \(error)")
            toastMessage = error.errorDescription ?? "Couldn't delete that item."
        } catch {
            toastMessage = "Couldn't delete that item."
        }
    }

    /// `POST /api/files/portfolio`. `data == nil` means the picker handed
    /// back an item we couldn't read — that's a real error, not a no-op.
    public func upload(
        data: Data?,
        filename: String,
        mimeType: String,
        title: String,
        description: String,
        category: PortfolioItemKind
    ) async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            toastMessage = "Please enter a title for your portfolio item."
            return
        }
        guard let data, !data.isEmpty else {
            toastMessage = "Couldn't read that file. Check Photos access and try again."
            return
        }
        isMutating = true
        defer { isMutating = false }
        do {
            _ = try await uploader.uploadPortfolio(
                file: MultipartFile(
                    fieldName: "file",
                    filename: filename,
                    mimeType: mimeType,
                    data: data
                ),
                title: trimmedTitle,
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                category: category.rawValue
            )
            showAddSheet = false
            toastMessage = "Portfolio item added"
            await fetch()
        } catch let error as APIError {
            logger.warning("Portfolio upload failed: \(error)")
            toastMessage = error.errorDescription ?? "Could not upload portfolio item."
        } catch {
            toastMessage = "Could not upload portfolio item."
        }
    }

    /// Mirrors RN's `normalizeFileRecord`
    /// (`src/components/profile/PortfolioTab.tsx:59-73`) — metadata title
    /// wins, then the original filename; the medium thumbnail is
    /// preferred for the grid and the raw file URL for the viewer.
    static func project(_ file: PortfolioFileDTO) -> PortfolioItem {
        let meta = file.metadata
        let thumbs = meta?.thumbnails ?? [:]
        let thumb = thumbs["medium"] ?? thumbs["small"] ?? thumbs["large"] ?? file.fileURL
        let title = meta?.title?.isEmpty == false
            ? (meta?.title ?? "")
            : (file.originalFilename ?? file.filename ?? "Untitled")
        return PortfolioItem(
            id: file.id,
            title: title.isEmpty ? "Untitled" : title,
            subtitle: meta?.description?.isEmpty == false ? meta?.description : nil,
            imageURL: thumb.flatMap(URL.init(string:)),
            fullURL: (file.fileURL ?? thumb).flatMap(URL.init(string:)),
            kind: PortfolioItemKind.from(fileType: file.fileType)
        )
    }

    static func friendlyMessage(for error: APIError) -> String {
        switch error {
        case .notFound: "We couldn't find that portfolio."
        case .forbidden: "This portfolio is private."
        case .transport: "Check your connection and try again."
        default: "Something went wrong. Try again."
        }
    }
}

// MARK: - Gigs

/// One gig row on the profile's Gigs tab.
public struct ProfileGigRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let summary: String?
    public let price: String
    public let category: String?
    public let status: String

    public init(id: String, title: String, summary: String?, price: String, category: String?, status: String) {
        self.id = id
        self.title = title
        self.summary = summary
        self.price = price
        self.category = category
        self.status = status
    }

    /// RN tints the badge green only for `open`
    /// (`src/components/profile/GigsTab.tsx:72`).
    public var isOpen: Bool {
        status.caseInsensitiveCompare("open") == .orderedSame
    }
}

/// Render state for the Gigs tab.
public enum ProfileGigsState: Sendable, Equatable {
    case loading
    case empty
    case loaded([ProfileGigRow])
    case error(message: String)
}

/// Loads the gigs a profile owner has posted.
@MainActor
@Observable
public final class ProfileGigsViewModel {
    public private(set) var state: ProfileGigsState = .loading

    private let userId: String
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.ProfileGigs")

    init(userId: String, client: APIClient = .shared) {
        self.userId = userId
        self.client = client
    }

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response = try await client.request(
                ProfileTabsEndpoints.userGigs(userId: userId, limit: 20),
                as: GigsListResponse.self
            )
            let rows = response.gigs.map(Self.project)
            state = rows.isEmpty ? .empty : .loaded(rows)
        } catch let error as APIError {
            logger.warning("Profile gigs load failed: \(error)")
            state = .error(message: ProfilePortfolioViewModel.friendlyMessage(for: error))
        } catch {
            logger.warning("Profile gigs load failed: \(error)")
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    static func project(_ gig: GigDTO) -> ProfileGigRow {
        ProfileGigRow(
            id: gig.id,
            title: gig.title,
            summary: gig.description?.isEmpty == false ? gig.description : nil,
            price: formatPrice(gig.price),
            category: gig.category?.isEmpty == false ? gig.category : nil,
            status: (gig.status?.isEmpty == false ? gig.status : nil) ?? "unknown"
        )
    }

    /// RN renders `$${gig.price || gig.budget_min || 0}`
    /// (`GigsTab.tsx:61`); the native list DTO carries only `price`, so a
    /// missing price renders `$0` rather than inventing a range.
    static func formatPrice(_ price: Double?) -> String {
        let value = price ?? 0
        if value == value.rounded() {
            return "$\(Int(value))"
        }
        return String(format: "$%.2f", value)
    }
}

// MARK: - Gig reviews

/// Role filter over reviews received. Backed by the server's
/// `received_as` discriminator.
public enum ProfileReviewFilter: String, Sendable, Hashable, CaseIterable, Identifiable {
    case all
    case worker
    case poster

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .all: "All"
        case .worker: "As Worker"
        case .poster: "As Poster"
        }
    }
}

/// One projected gig review.
public struct ProfileGigReview: Sendable, Hashable, Identifiable {
    public let id: String
    public let reviewerId: String?
    public let reviewerName: String
    public let reviewerHandle: String?
    public let reviewerAvatarURL: URL?
    public let rating: Int
    public let comment: String?
    public let mediaURLs: [URL]
    public let dateLabel: String?
    /// "Review as worker" / "Review as gig poster" — RN's `roleLabel`
    /// (`ReviewsTab.tsx:129-131`). `nil` for `unknown`.
    public let roleLabel: String?
    public let receivedAs: ProfileReviewFilter?

    public init(
        id: String,
        reviewerId: String?,
        reviewerName: String,
        reviewerHandle: String?,
        reviewerAvatarURL: URL?,
        rating: Int,
        comment: String?,
        mediaURLs: [URL],
        dateLabel: String?,
        roleLabel: String?,
        receivedAs: ProfileReviewFilter?
    ) {
        self.id = id
        self.reviewerId = reviewerId
        self.reviewerName = reviewerName
        self.reviewerHandle = reviewerHandle
        self.reviewerAvatarURL = reviewerAvatarURL
        self.rating = max(0, min(5, rating))
        self.comment = comment
        self.mediaURLs = mediaURLs
        self.dateLabel = dateLabel
        self.roleLabel = roleLabel
        self.receivedAs = receivedAs
    }
}

/// Server-computed summary header (average · total · per-star bars).
public struct ProfileReviewSummary: Sendable, Hashable {
    public let average: Double
    public let total: Int
    public let workerCount: Int
    public let posterCount: Int
    /// Star → count over the page we loaded, matching RN's histogram
    /// (`ReviewsTab.tsx:56-69`).
    public let distribution: [Int: Int]

    public init(average: Double, total: Int, workerCount: Int, posterCount: Int, distribution: [Int: Int]) {
        self.average = average
        self.total = total
        self.workerCount = workerCount
        self.posterCount = posterCount
        self.distribution = distribution
    }
}

/// Render state for the Reviews tab.
public enum ProfileGigReviewsState: Sendable, Equatable {
    case loading
    case empty
    case loaded(summary: ProfileReviewSummary, reviews: [ProfileGigReview])
    case error(message: String)
}

/// Loads gig reviews received by a profile.
@MainActor
@Observable
public final class ProfileGigReviewsViewModel {
    public private(set) var state: ProfileGigReviewsState = .loading
    public var activeFilter: ProfileReviewFilter = .all
    /// Media opened in the full-screen viewer.
    public var viewerURL: URL?

    private var allReviews: [ProfileGigReview] = []
    private let userId: String
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.ProfileGigReviews")

    init(userId: String, client: APIClient = .shared) {
        self.userId = userId
        self.client = client
    }

    /// Count badge on the tab strip — the server's `total`, not the page
    /// size (RN reads `res.total`, `src/app/user/[id].tsx:155`).
    public private(set) var totalCount: Int = 0

    public var filteredReviews: [ProfileGigReview] {
        guard activeFilter != .all else { return allReviews }
        return allReviews.filter { $0.receivedAs == activeFilter }
    }

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response = try await client.request(
                ProfileTabsEndpoints.userReviews(userId: userId, limit: 50),
                as: GigReviewsResponse.self
            )
            allReviews = response.reviews.map(Self.project)
            totalCount = response.total ?? allReviews.count
            let summary = ProfileReviewSummary(
                average: response.averageRating ?? 0,
                total: totalCount,
                workerCount: response.counts?.worker ?? 0,
                posterCount: response.counts?.poster ?? 0,
                distribution: Self.distribution(of: allReviews)
            )
            state = allReviews.isEmpty && summary.total == 0
                ? .empty
                : .loaded(summary: summary, reviews: allReviews)
        } catch let error as APIError {
            logger.warning("Profile reviews load failed: \(error)")
            state = .error(message: ProfilePortfolioViewModel.friendlyMessage(for: error))
        } catch {
            logger.warning("Profile reviews load failed: \(error)")
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    static func distribution(of reviews: [ProfileGigReview]) -> [Int: Int] {
        var counts: [Int: Int] = [:]
        for star in 1...5 {
            counts[star] = reviews.filter { $0.rating == star }.count
        }
        return counts
    }

    static func project(_ review: GigReviewDTO) -> ProfileGigReview {
        let received: ProfileReviewFilter? = switch review.receivedAs ?? "" {
        case "worker": .worker
        case "poster": .poster
        default: nil
        }
        let roleLabel: String? = switch received {
        case .worker: "Review as worker"
        case .poster: "Review as gig poster"
        default: nil
        }
        let name = review.reviewer?.name
            ?? review.reviewerName
            ?? review.reviewer?.firstName
            ?? review.reviewer?.username
        let avatar = review.reviewer?.profilePictureURL ?? review.reviewerAvatar
        return ProfileGigReview(
            id: review.id,
            reviewerId: review.reviewer?.id ?? review.reviewerID,
            reviewerName: (name?.isEmpty == false ? name : nil) ?? "Anonymous",
            reviewerHandle: review.reviewer?.username ?? review.reviewerUsername,
            reviewerAvatarURL: avatar.flatMap(URL.init(string:)),
            rating: review.rating,
            comment: review.comment?.isEmpty == false ? review.comment : nil,
            mediaURLs: (review.mediaURLs ?? []).compactMap(URL.init(string:)),
            dateLabel: Self.dateLabel(review.createdAt),
            roleLabel: roleLabel,
            receivedAs: received
        )
    }

    /// RN renders `toLocaleDateString(undefined, { month: 'long', day:
    /// 'numeric', year: 'numeric' })` (`ReviewsTab.tsx:127`).
    static func dateLabel(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return nil }
        let display = DateFormatter()
        display.dateStyle = .long
        display.timeStyle = .none
        return display.string(from: date)
    }
}
