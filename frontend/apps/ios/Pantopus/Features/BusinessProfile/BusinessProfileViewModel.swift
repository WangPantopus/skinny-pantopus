//
//  BusinessProfileViewModel.swift
//  Pantopus
//
//  A10.6 — View-model for the single-scroll Business Profile. Loads
//  `GET /api/businesses/:businessId` (the authenticated detail) and,
//  best-effort, the `/public/:username` payload (hours + catalog), then
//  projects them onto the section models the view renders. The reviews
//  (`GET /api/users/id/:id`) and a named page load after the page shows,
//  each with its own loading and failure state.
//
//  B3.1 reshape: no more tabs. The projection now derives the stat strip
//  (rating / jobs / followers-or-"New"), category accents, an open/closed
//  status, the service-area card, a rating summary, and the Contact /
//  Book-or-Call dock — plus the newly-claimed flag that drives the
//  secondary frame's trust note + `EmptyBlock`s.
//
// swiftlint:disable file_length

import Foundation
import Logging
import Observation

/// C4 — state of the named custom page a `pantopus://b/:username/:slug`
/// link asked for. `.none` when the profile was opened without a slug.
public enum BusinessProfileNamedPageState: Sendable, Equatable {
    case none
    case loading(title: String)
    case loaded(title: String, description: String?, blocks: [BusinessPageBlock])
    case failed(title: String, message: String)
}

/// In-flight state for the Save action.
public enum BusinessProfileActionState: Sendable, Equatable {
    case idle
    case inFlight
    case saved
    case failed(message: String)
}

/// View-model for the Business Profile screen.
@MainActor
@Observable
public final class BusinessProfileViewModel {
    /// Render state.
    public private(set) var state: BusinessProfileState = .loading

    /// In-flight state for the "Save" affordance.
    public private(set) var saveState: BusinessProfileActionState = .idle

    /// Drives the kebab-overflow action sheet.
    public var showOverflow: Bool = false

    /// Transient toast surface.
    public var toastMessage: String?

    /// C4 — the named custom page, when the entry point carried a slug.
    public private(set) var namedPage: BusinessProfileNamedPageState = .none

    /// The business id. A `/b/:username` link opens with the username, which
    /// `loadDetail()` resolves to the id.
    private var businessId: String
    /// C4 — slug from `pantopus://b/:username/:slug` (RN's `?pageSlug=`).
    private let pageSlug: String?
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.BusinessProfile")
    private var isStartingInquiry = false

    /// The reads the page itself waits for. Reviews arrive apart from them.
    private struct PageReads {
        let detail: BusinessDetailResponse
        let publicResponse: BusinessPublicResponse?
        let hours: [BusinessHoursDTO]
    }

    private var page: PageReads?
    /// The reviews' last answer, when it came, and where their own read stands.
    private var reviews: PublicProfile?
    private var reviewsReadAt: Date?
    private var reviewsRead: BusinessReviewsRead = .loading
    private var reviewsGeneration = 0

    init(businessId: String, pageSlug: String? = nil, client: APIClient = .shared) {
        self.businessId = businessId
        self.pageSlug = pageSlug
        self.client = client
        if let pageSlug, !pageSlug.isEmpty {
            namedPage = .loading(title: pageSlug)
        }
    }

    /// Entry and every return: the view's `.task` runs again each time the page shows. Only the first load shows the
    /// skeleton. Back on a loaded page, it stays where it was scrolled while every read runs again, so an edit or a
    /// reply saved meanwhile shows; a failed refresh keeps the page.
    public func load() async {
        if page == nil { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// The Reviews section's retry; the rest of the page stays as it is.
    public func retryReviews() async {
        await readReviews()
    }

    /// Save/follow this business through the backend.
    public func save() async {
        guard saveState != .inFlight, saveState != .saved else { return }
        saveState = .inFlight
        do {
            let response = try await client.request(
                BusinessesEndpoints.follow(businessId: businessId),
                as: BusinessFollowResponse.self
            )
            saveState = .saved
            toastMessage = response.following ? "Saved" : "Updated"
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            saveState = .failed(message: message)
            toastMessage = message
        } catch {
            saveState = .failed(message: "Something went wrong. Try again.")
            toastMessage = "Something went wrong. Try again."
        }
    }

    /// Opens (or resumes) an inquiry chat via
    /// `POST /api/businesses/:id/inbox/start` and returns a conversation
    /// destination for the host to push. Mirrors RN/web
    /// `startBusinessInquiry`.
    public func resolveChatDestination() async -> InboxConversationDestination? {
        guard case let .loaded(content) = state else { return nil }
        guard !isStartingInquiry else { return nil }
        isStartingInquiry = true
        defer { isStartingInquiry = false }
        let name = content.header.displayName
        let handle = content.header.handle
        let subject: String = {
            if let handle, !handle.isEmpty {
                return "Inquiry for @\(handle.trimmingCharacters(in: CharacterSet(charactersIn: "@")))"
            }
            return "Inquiry for \(name)"
        }()
        do {
            let response: StartBusinessInquiryResponse = try await client.request(
                BusinessesEndpoints.startInquiry(businessId: businessId, subject: subject)
            )
            return InboxConversationDestination(
                mode: .room(id: response.roomId),
                displayName: name,
                initials: Self.initials(from: name),
                identityKind: "business",
                verified: content.header.isVerified
            )
        } catch let error as APIError {
            toastMessage = friendlyMessage(for: error)
            return nil
        } catch {
            toastMessage = "Couldn't open chat. Try again."
            return nil
        }
    }

    /// The page shows once its own reads answer. The reviews and a named page then load on their own, so a slow
    /// or failed read touches only its section. Returns once both have settled.
    private func fetch() async {
        guard await readPage(), !Task.isCancelled else { return }
        async let reviewsSettled: Void = readReviews()
        await loadNamedPage(username: page?.detail.business.username)
        await reviewsSettled
    }

    /// The page's own reads: the detail, the public page and the hours. The first answer shows the page and a later
    /// one replaces it in place. A failed refresh keeps the page on screen; only a business that is gone (not
    /// found) replaces it, as on Android. Returns whether there is a page. The owner dashboard shows once this
    /// answers and reads the reviews on its own.
    @discardableResult
    func readPage() async -> Bool {
        do {
            let detail = try await loadDetail()
            let publicResponse = await loadPublic(username: detail.business.username)
            let hours = try await loadHours(from: detail, publicResponse: publicResponse)
            // Reads cut short when the page went away can pass for an unpublished page; keep what was there.
            try Task.checkCancellation()
            page = PageReads(detail: detail, publicResponse: publicResponse, hours: hours)
            publish()
            return true
        } catch {
            if case .notFound? = error as? APIError {
                logger.info("Business not found: \(businessId)")
                page = nil
                state = .notFound
                return false
            }
            guard page == nil else {
                logger.debug("Business page refresh failed, keeping the page: \(error)")
                return true
            }
            if let apiError = error as? APIError {
                logger.warning("Business detail load failed: \(apiError)")
                state = .error(message: friendlyMessage(for: apiError))
            } else {
                logger.warning("Business detail load failed: \(error)")
                state = .error(message: "Something went wrong")
            }
            return false
        }
    }

    /// `/b/:username` links (a business's shared public page) carry the
    /// username, but the detail read takes the id. When the id isn't found and
    /// isn't a UUID, the read-only public page resolves the username; an
    /// unknown or unpublished username stays not found.
    private func loadDetail() async throws -> BusinessDetailResponse {
        do {
            return try await client.request(
                BusinessesEndpoints.business(businessId: businessId),
                as: BusinessDetailResponse.self
            )
        } catch APIError.notFound where UUID(uuidString: businessId) == nil {
            let publicPage = try? await client.request(
                BusinessesEndpoints.publicBusiness(username: businessId),
                as: BusinessPublicResponse.self
            )
            guard let id = publicPage?.businessId, !id.isEmpty else { throw APIError.notFound }
            businessId = id
            return try await client.request(
                BusinessesEndpoints.business(businessId: id),
                as: BusinessDetailResponse.self
            )
        }
    }

    /// The hours and catalog. Not found means the page isn't published (or no longer is). Any other failure keeps
    /// the public page a refresh already has, so its hours and services don't empty out.
    private func loadPublic(username: String?) async -> BusinessPublicResponse? {
        guard let username, !username.isEmpty else { return nil }
        do {
            return try await client.request(
                BusinessesEndpoints.publicBusiness(username: username),
                as: BusinessPublicResponse.self
            )
        } catch APIError.notFound {
            return nil
        } catch {
            logger.debug("Public business fetch failed: \(error)")
            return page?.publicResponse
        }
    }

    /// Draft businesses have no public payload. Read their saved hours through
    /// the existing authorized endpoint instead of presenting them as unset.
    private func loadHours(
        from detail: BusinessDetailResponse,
        publicResponse: BusinessPublicResponse?
    ) async throws -> [BusinessHoursDTO] {
        if let publicResponse { return publicResponse.hours }
        guard detail.access?.isOwner == true || detail.access?.permissions?.contains("hours.view") == true,
              let location = detail.profile?.primaryLocation
              ?? detail.locations.first(where: { $0.isPrimary == true })
              ?? detail.locations.first else { return [] }
        let response: BusinessLocationHoursResponse = try await client.request(
            BusinessesEndpoints.locationHours(businessId: businessId, locationId: location.id)
        )
        return response.hours
    }

    /// C4 — resolves `GET /api/b/:username/:slug` so the named custom page
    /// opens with its published blocks. Mirrors RN `business/[username].tsx`'s
    /// `fetchPublicPage`, including the two failure copies.
    private func loadNamedPage(username: String?) async {
        guard let pageSlug, !pageSlug.isEmpty else {
            namedPage = .none
            return
        }
        // A named page on screen isn't read again on return: each read records a profile view.
        if case .loaded = namedPage { return }
        // `pantopus://b/:username/:slug` routes the *username* through as the
        // id, so it is the right fallback when the detail read has no handle.
        let handle = (username?.isEmpty == false ? username : nil) ?? businessId
        guard !handle.isEmpty else {
            namedPage = .failed(
                title: pageSlug,
                message: "This business page does not exist or is not published."
            )
            return
        }
        namedPage = .loading(title: pageSlug)
        do {
            let response: PublicBusinessPageResponse = try await client.request(
                BusinessPagesEndpoints.publicPage(username: handle, slug: pageSlug)
            )
            guard let page = response.currentPage else {
                namedPage = .failed(
                    title: pageSlug,
                    message: "This business page has no published content yet."
                )
                return
            }
            let blocks = (page.blocks ?? []).enumerated().map { index, dto in
                BusinessPageBlock(dto: dto, index: index)
            }
            namedPage = .loaded(
                title: page.title ?? pageSlug,
                description: page.description,
                blocks: blocks
            )
        } catch {
            logger.debug("Named business page fetch failed: \(error)")
            guard !Task.isCancelled else { return }
            namedPage = .failed(
                title: pageSlug,
                message: "This business page does not exist or is not published."
            )
        }
    }

    /// `GET /api/users/id/:id`, on its own so a slow or failed read touches only the Reviews section. Rows already
    /// on screen stay during the read; only a section with no answer yet shows its loading state.
    func readReviews() async {
        reviewsGeneration &+= 1
        let generation = reviewsGeneration
        reviewsRead = reviews == nil && reviewsRead != .loaded ? .loading : .loaded
        publish()
        do {
            let profile = try await client.request(PublicProfileEndpoints.profile(id: businessId), as: PublicProfile.self)
            guard generation == reviewsGeneration else { return }
            reviews = profile
            reviewsReadAt = Date()
            reviewsRead = .loaded
        } catch {
            // A newer read owns the section, or the page went away mid-read and reads again when it's back.
            guard generation == reviewsGeneration, !Task.isCancelled else { return }
            logger.debug("Business reviews read failed: \(error)")
            reviewsRead = reviewsAfterFailure(error)
        }
        publish()
    }

    private func reviewsAfterFailure(_ error: any Error) -> BusinessReviewsRead {
        let apiError = error as? APIError
        switch apiError {
        case .notFound?, .forbidden?:
            // A retry can't change a refusal (a draft's own page, a private or blocked profile): nothing public to show.
            reviews = nil
            return .loaded
        default:
            if reviews != nil, let reviewsReadAt { return .refreshFailed(shownAt: reviewsReadAt) }
            return .failed(message: apiError.map { friendlyMessage(for: $0) } ?? "Something went wrong. Try again.")
        }
    }

    /// Shows the page with the reviews as they stand. Until the page's own reads answer, there is no page to show.
    private func publish() {
        guard let page else { return }
        state = .loaded(build(
            from: page.detail,
            publicResponse: page.publicResponse,
            hours: page.hours,
            reviewsResponse: reviews,
            reviewsRead: reviewsRead
        ))
    }

    private func friendlyMessage(for error: APIError) -> String {
        switch error {
        case .notFound: "We couldn't find this business."
        case .forbidden: "This business profile is private."
        case .transport: "Check your connection and try again."
        default: "Something went wrong. Try again."
        }
    }

    /// Two-letter initials derived from a display name. Falls back to
    /// `··` when the input has no alphanumeric content.
    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let joined = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return joined.isEmpty ? "··" : joined
    }
}

// MARK: - Projection

extension BusinessProfileViewModel {
    private func build(
        from detail: BusinessDetailResponse,
        publicResponse: BusinessPublicResponse?,
        hours: [BusinessHoursDTO],
        reviewsResponse: PublicProfile?,
        reviewsRead: BusinessReviewsRead
    ) -> BusinessProfileContent {
        let business = detail.business
        let profile = detail.profile
        let primaryLocation = profile?.primaryLocation
            ?? detail.locations.first { $0.isPrimary == true }
            ?? detail.locations.first

        var calendar = Calendar.current
        if let identifier = primaryLocation?.timezone, let timeZone = TimeZone(identifier: identifier) {
            calendar.timeZone = timeZone
        }
        let now = Date()
        let weekday = calendar.component(.weekday, from: now) - 1

        // A business is "newly claimed" when it has no track record yet —
        // no reviews and no completed jobs. (`foundingBadge` is an
        // early-adopter badge, not an activity signal, so it doesn't count.)
        let reviewCount = business.reviewCount ?? reviewsResponse?.reviewCount ?? 0
        let jobs = business.gigsCompleted ?? reviewsResponse?.gigsCompleted ?? 0
        let isNewlyClaimed = reviewCount == 0 && jobs == 0

        let resolvedDisplayName: String = {
            if let name = business.name, !name.isEmpty { return name }
            if let username = business.username { return "@\(username)" }
            return "Business"
        }()

        let header = BusinessProfileHeader(
            displayName: resolvedDisplayName,
            handle: business.username,
            locality: localityString(business: business, location: primaryLocation),
            // The business's own identity tier, as on My businesses and the owner
            // header. `business.verified` is the account row's flag, not the
            // business's verification, so it never earns the mark on its own.
            isVerified: BusinessCardModel.isVerified(tier: profile?.identityVerificationTier),
            logoIcon: nil,
            logoImageURL: business.profilePictureURL.flatMap(URL.init(string:)),
            bannerImageURL: business.coverPhotoURL.flatMap(URL.init(string:))
        )

        let scopedHours = scopedHours(
            from: hours,
            primaryLocationId: primaryLocation?.id
        )
        let status = computeOpenState(scopedHours, now: now, calendar: calendar)
        let hours = buildHours(from: scopedHours, weekday: weekday)

        let about: String? = {
            if let description = profile?.description, !description.isEmpty { return description }
            if let bio = business.bio, !bio.isEmpty { return bio }
            if let tagline = business.tagline, !tagline.isEmpty { return tagline }
            return nil
        }()
        let serviceArea = buildServiceArea(location: primaryLocation, profile: profile)
        let pendingSavePlace = savedPlace(
            business: business,
            label: resolvedDisplayName,
            location: primaryLocation,
            serviceArea: serviceArea,
            viewerIsOwner: detail.access?.isOwner ?? false
        )

        return BusinessProfileContent(
            businessId: business.id,
            header: header,
            stats: buildStats(business: business, reviewsResponse: reviewsResponse, isNewlyClaimed: isNewlyClaimed),
            categories: buildCategories(profile?.categories ?? []),
            about: about,
            aboutChips: buildAboutChips(profile: profile),
            status: status,
            hours: hours,
            serviceArea: serviceArea,
            services: (publicResponse?.catalog ?? []).map(buildService),
            gallery: [],
            reviewSummary: buildReviewSummary(business: business, reviewsResponse: reviewsResponse),
            reviews: (reviewsResponse?.reviews ?? []).map(buildReview),
            reviewsRead: reviewsRead,
            dock: buildDock(status: status, phoneNumber: profile?.publicPhone ?? primaryLocation?.phone),
            savedPlace: pendingSavePlace,
            isNewlyClaimed: isNewlyClaimed,
            phoneNumber: profile?.publicPhone ?? primaryLocation?.phone,
            websiteURL: normalizedWebsite(profile?.website),
            viewerIsOwner: detail.access?.isOwner ?? false,
            hasPublicPage: publicResponse != nil
        )
    }

    // MARK: Stats

    private func buildStats(
        business: BusinessUserDetailDTO,
        reviewsResponse: PublicProfile?,
        isNewlyClaimed: Bool
    ) -> [BusinessStatCell] {
        let rating = business.averageRating ?? reviewsResponse?.averageRating
        let reviewCount = business.reviewCount ?? reviewsResponse?.reviewCount ?? 0
        let jobs = business.gigsCompleted ?? reviewsResponse?.gigsCompleted ?? 0
        let followers = business.followersCount ?? reviewsResponse?.followersCount ?? 0

        let ratingCell = if let rating, reviewCount > 0 {
            BusinessStatCell(
                id: "rating",
                value: String(format: "%.1f", rating),
                label: "\(reviewCount) reviews",
                leadingStar: true,
                tint: .star
            )
        } else {
            BusinessStatCell(
                id: "rating",
                value: "—",
                label: "No reviews yet",
                leadingStar: true,
                tint: .muted
            )
        }

        let jobsCell = BusinessStatCell(id: "jobs", value: "\(jobs)", label: "Jobs done")

        let thirdCell: BusinessStatCell = isNewlyClaimed
            ? BusinessStatCell(id: "new", value: "New", label: "On Pantopus", tint: .business)
            : BusinessStatCell(id: "followers", value: formatStat(followers), label: "Followers")

        return [ratingCell, jobsCell, thirdCell]
    }

    private func formatStat(_ value: Int) -> String {
        if value >= 1000 {
            let truncated = Double(value) / 1000
            return String(format: "%.1fK", truncated).replacingOccurrences(of: ".0K", with: "K")
        }
        return "\(value)"
    }

    // MARK: Categories

    private func buildCategories(_ categories: [String]) -> [BusinessCategoryChip] {
        categories.prefix(4).enumerated().map { index, name in
            BusinessCategoryChip(
                id: name,
                // Businesses created before the wizard saved names carry its old slugs ("home_services").
                label: BusinessCategory.label(forLegacySlug: name) ?? name,
                icon: categoryIcon(name),
                accent: index == 0 ? categoryAccent(name) : .neutral
            )
        }
    }

    private func matches(_ name: String, _ keywords: [String]) -> Bool {
        let lower = name.lowercased()
        return keywords.contains { lower.contains($0) }
    }

    private func categoryIcon(_ name: String) -> PantopusIcon {
        let mapping: [(keywords: [String], icon: PantopusIcon)] = [
            (["clean"], .sparkles),
            (["handy", "repair", "fix"], .wrench),
            (["dog"], .dog),
            (["pet", "cat"], .pawPrint),
            (["move"], .package),
            (["eco", "green"], .leaf),
            (["home", "apartment", "house"], .home)
        ]
        for entry in mapping where matches(name, entry.keywords) {
            return entry.icon
        }
        return .tag
    }

    private func categoryAccent(_ name: String) -> BusinessCategoryAccent {
        if matches(name, ["clean"]) { return .cleaning }
        if matches(name, ["handy", "repair", "fix"]) { return .handyman }
        if matches(name, ["pet", "dog", "cat"]) { return .pet }
        return .business
    }

    // MARK: About chips

    private func buildAboutChips(profile: BusinessProfileDetailDTO?) -> [BusinessAboutChip] {
        var chips: [BusinessAboutChip] = []
        if let employees = profile?.employeeCount, !employees.isEmpty {
            chips.append(BusinessAboutChip(id: "team", label: "\(employees) team members", icon: .users))
        }
        if let year = profile?.foundedYear {
            chips.append(BusinessAboutChip(id: "since", label: "Since \(year)", icon: .calendarCheck))
        }
        return chips
    }

    // MARK: Hours + open/closed

    private func scopedHours(
        from rows: [BusinessHoursDTO],
        primaryLocationId: String?
    ) -> [BusinessHoursDTO] {
        guard let primaryLocationId else { return rows }
        let scoped = rows.filter { $0.locationId == primaryLocationId }
        return scoped.isEmpty ? rows : scoped
    }

    /// By day, then by opening time: the hours reads order by day only.
    private func buildHours(from rows: [BusinessHoursDTO], weekday: Int) -> [BusinessHoursRow] {
        rows.sorted { ($0.dayOfWeek, minutes($0.openTime) ?? -1) < ($1.dayOfWeek, minutes($1.openTime) ?? -1) }.map { row in
            let dayIndex = max(0, min(6, row.dayOfWeek))
            let isClosed = row.isClosed == true
            let time = if isClosed {
                "Closed"
            } else if isAllDay(row) {
                "Open 24 hours"
            } else if let open = row.openTime, let close = row.closeTime {
                "\(formatTime(open)) – \(formatTime(close))"
            } else {
                "—"
            }
            return BusinessHoursRow(
                id: row.id,
                dayLabel: fullDayName(dayIndex),
                timeLabel: time,
                isClosed: isClosed,
                isToday: dayIndex == weekday
            )
        }
    }

    /// Pure, testable open/closed projection. `now` + `calendar` are
    /// injected so tests can pin a weekday + time.
    func computeOpenState(
        _ rows: [BusinessHoursDTO],
        now: Date,
        calendar: Calendar
    ) -> BusinessOpenState? {
        guard !rows.isEmpty else { return nil }
        let weekday = calendar.component(.weekday, from: now) - 1
        let minutesNow = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
        let byDay = Dictionary(grouping: rows) { max(0, min(6, $0.dayOfWeek)) }
        let today = byDay[weekday] ?? []

        if today.contains(where: { isAllDay($0) }) {
            return BusinessOpenState(isOpen: true, statusLabel: "Open now", statusDetail: "Open 24 hours", chipLabel: "Open now")
        }
        // Overnight hours belong to the day the business opened, even when
        // the following day's own schedule is closed.
        let intervals = openIntervals(byDay[(weekday + 6) % 7] ?? [], dayOffset: -1) + openIntervals(today, dayOffset: 0)
        if let close = closingTime(of: intervals, at: minutesNow) {
            return BusinessOpenState(
                isOpen: true,
                statusLabel: "Open now",
                statusDetail: "Closes \(formatTime(close))",
                chipLabel: "Open now"
            )
        }
        if let next = intervals.filter({ $0.start > minutesNow }).min(by: { $0.start < $1.start }) {
            return closedState(opening: "today", at: next.openTime)
        }
        if let next = nextOpening(byDay: byDay, weekday: weekday) {
            return next
        }
        return BusinessOpenState(isOpen: false, statusLabel: "Closed", statusDetail: "Hours vary", chipLabel: "Closed")
    }

    /// One saved interval, in minutes from today's midnight: yesterday's start
    /// below zero, and an overnight interval ends past 24 hours.
    private struct OpenInterval {
        let start: Int
        let end: Int
        let openTime: String
        let closeTime: String
    }

    private func openIntervals(_ rows: [BusinessHoursDTO], dayOffset: Int) -> [OpenInterval] {
        let day = 24 * 60
        return rows.compactMap { row in
            guard row.isClosed != true,
                  let openTime = row.openTime, let open = minutes(openTime),
                  let closeTime = row.closeTime, let close = minutes(closeTime) else { return nil }
            return OpenInterval(
                start: open + dayOffset * day,
                end: (close < open ? close + day : close) + dayOffset * day,
                openTime: openTime,
                closeTime: closeTime
            )
        }
    }

    /// When the business next closes, or nil when no interval covers `minute`.
    /// Intervals that overlap or touch count as one: 9–2 and 12–5 close at 5.
    private func closingTime(of intervals: [OpenInterval], at minute: Int) -> String? {
        let covering = intervals.filter { $0.start <= minute && minute < $0.end }
        guard var last = covering.max(by: { $0.end < $1.end }) else { return nil }
        for interval in intervals.sorted(by: { $0.start < $1.start })
            where interval.start <= last.end && interval.end > last.end {
            last = interval
        }
        return last.closeTime
    }

    private func closedState(opening whenLabel: String, at time: String) -> BusinessOpenState {
        BusinessOpenState(
            isOpen: false,
            statusLabel: "Closed now",
            statusDetail: "Opens \(whenLabel) at \(formatTime(time))",
            chipLabel: "Closed · opens \(formatTime(time))"
        )
    }

    private func nextOpening(byDay: [Int: [BusinessHoursDTO]], weekday: Int) -> BusinessOpenState? {
        for offset in 1...7 {
            let day = (weekday + offset) % 7
            guard let open = earliestOpening(byDay[day] ?? []) else { continue }
            return closedState(opening: offset == 1 ? "tomorrow" : fullDayName(day), at: open)
        }
        return nil
    }

    private func earliestOpening(_ rows: [BusinessHoursDTO]) -> String? {
        let openings = rows.compactMap { row -> (minute: Int, time: String)? in
            guard row.isClosed != true, let time = row.openTime, let minute = minutes(time) else { return nil }
            return (minute, time)
        }
        return openings.min { $0.minute < $1.minute }?.time
    }

    /// 00:00–23:59, or a `24:00` close: the editor's "Open 24 hours".
    private func isAllDay(_ row: BusinessHoursDTO) -> Bool {
        row.isClosed != true && minutes(row.openTime) == 0 && (minutes(row.closeTime) ?? 0) >= 23 * 60 + 59
    }

    private func minutes(_ raw: String?) -> Int? {
        guard let raw else { return nil }
        let parts = raw.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }
        return hour * 60 + minute
    }

    private func formatTime(_ raw: String) -> String {
        let parts = raw.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return raw }
        let suffix = (12..<24).contains(hour) ? "PM" : "AM"
        let normalisedHour = hour % 12 == 0 ? 12 : hour % 12
        if minute == 0 {
            return "\(normalisedHour) \(suffix)"
        }
        return String(format: "%d:%02d %@", normalisedHour, minute, suffix)
    }

    private func fullDayName(_ index: Int) -> String {
        let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return names[max(0, min(6, index))]
    }

    // MARK: Service area

    private func buildServiceArea(
        location: BusinessLocationDTO?,
        profile: BusinessProfileDetailDTO?
    ) -> BusinessServiceArea? {
        let serviceAreaText = profile?.serviceArea?.displayText
        guard let location else {
            guard let serviceAreaText else { return nil }
            return BusinessServiceArea(
                title: "Service area",
                detail: nil,
                serviceArea: serviceAreaText,
                latitude: nil,
                longitude: nil
            )
        }
        let cityState = [location.city, location.state]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: ", ")
        let street = location.streetLine
        let title = cityState.isEmpty ? (street ?? "Service area") : cityState
        let detail = cityState.isEmpty ? nil : street
        return BusinessServiceArea(
            title: title,
            detail: detail,
            serviceArea: serviceAreaText,
            latitude: location.location?.lat,
            longitude: location.location?.lng,
            isApproximate: location.isApproximateHome
        )
    }

    private func savedPlace(
        business: BusinessUserDetailDTO,
        label: String,
        location: BusinessLocationDTO?,
        serviceArea: BusinessServiceArea?,
        viewerIsOwner: Bool
    ) -> PendingSavePlace? {
        guard !viewerIsOwner,
              let latitude = serviceArea?.latitude,
              let longitude = serviceArea?.longitude else { return nil }
        return PendingSavePlace(
            label: label,
            latitude: latitude,
            longitude: longitude,
            city: location?.city ?? business.city,
            state: location?.state ?? business.state,
            sourceId: business.id
        )
    }

    // MARK: Services

    private func buildService(_ item: BusinessCatalogItemDTO) -> BusinessServiceRow {
        BusinessServiceRow(
            id: item.id,
            name: item.name,
            detail: item.description,
            priceLabel: priceLabel(for: item),
            unit: nil,
            icon: .tag
        )
    }

    private func priceLabel(for item: BusinessCatalogItemDTO) -> String {
        let currency = item.currency?.uppercased() ?? "USD"
        let symbol = currency == "USD" ? "$" : ""
        let formatDollars: (Int) -> String = { cents in
            let value = Double(cents) / 100
            if value == value.rounded() {
                return String(format: "%@%.0f", symbol, value)
            }
            return String(format: "%@%.2f", symbol, value)
        }
        switch (item.priceCents, item.priceMaxCents) {
        case let (min?, max?) where max > min:
            return "\(formatDollars(min)) – \(formatDollars(max))"
        case let (price?, _):
            let unitSuffix = item.priceUnit.map { "/\($0)" } ?? ""
            return "\(formatDollars(price))\(unitSuffix)"
        default:
            return item.kind == "donation" ? "Suggested" : "Contact"
        }
    }

    // MARK: Reviews

    private func buildReviewSummary(
        business: BusinessUserDetailDTO,
        reviewsResponse: PublicProfile?
    ) -> BusinessReviewSummary? {
        let reviewTotal = business.reviewCount ?? reviewsResponse?.reviewCount ?? 0
        guard reviewTotal > 0 else { return nil }
        let average = business.averageRating ?? reviewsResponse?.averageRating ?? 0
        return BusinessReviewSummary(average: average, count: reviewTotal, distribution: [])
    }

    private func buildReview(_ raw: PublicProfileReview) -> BusinessReviewCard {
        BusinessReviewCard(
            id: raw.id ?? UUID().uuidString,
            reviewerName: raw.reviewerName ?? "Anonymous",
            reviewerAvatarURL: raw.reviewerAvatar.flatMap(URL.init(string:)),
            rating: raw.rating,
            body: raw.comment ?? raw.content ?? "",
            timestamp: relativeTimestamp(raw.createdAt),
            verified: false,
            ownerReply: raw.ownerResponse.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        )
    }

    private func relativeTimestamp(_ iso: String?) -> String {
        guard let iso else { return "" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "Just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default:
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
    }

    // MARK: Dock

    private func buildDock(status: BusinessOpenState?, phoneNumber: String?) -> BusinessActionDock {
        let isClosed = status?.isOpen == false
        // "Book" needs the business's booking page, which the payload doesn't
        // carry yet, so it isn't offered. "Call" only when there is a number.
        let secondary: BusinessActionDock.Secondary? = (phoneNumber?.isEmpty ?? true) ? nil : .call
        let note = isClosed ? "Closed now — messages answered when they reopen" : nil
        return BusinessActionDock(secondary: secondary, note: note)
    }

    // MARK: Misc

    private func localityString(
        business: BusinessUserDetailDTO,
        location: BusinessLocationDTO?
    ) -> String? {
        if let city = location?.city, let state = location?.state, !city.isEmpty, !state.isEmpty {
            return "\(city), \(state)"
        }
        if let city = business.city, let state = business.state, !city.isEmpty, !state.isEmpty {
            return "\(city), \(state)"
        }
        return business.city ?? business.state
    }

    /// A bare domain gets https; any other scheme (`tel:`, `javascript:`,
    /// `pantopus://`) isn't a website.
    private func normalizedWebsite(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        if URL(string: raw)?.scheme != nil {
            return ExternalLink.webURL(raw)
        }
        return ExternalLink.webURL("https://\(raw)")
    }
}
