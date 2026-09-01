//
//  BusinessProfileViewModel.swift
//  Pantopus
//
//  A10.6 — View-model for the single-scroll Business Profile. Loads
//  `GET /api/businesses/:businessId` (the authenticated detail) and,
//  best-effort, the `/public/:username` payload (hours + catalog) + the
//  public-profile endpoint (rating + reviews), then projects them onto
//  the section models the view renders.
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

    private let businessId: String
    /// C4 — slug from `pantopus://b/:username/:slug` (RN's `?pageSlug=`).
    private let pageSlug: String?
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.BusinessProfile")
    private var isStartingInquiry = false

    init(businessId: String, pageSlug: String? = nil, client: APIClient = .shared) {
        self.businessId = businessId
        self.pageSlug = pageSlug
        self.client = client
        if let pageSlug, !pageSlug.isEmpty {
            namedPage = .loading(title: pageSlug)
        }
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
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

    private func fetch() async {
        do {
            let detail = try await client.request(
                BusinessesEndpoints.business(businessId: businessId),
                as: BusinessDetailResponse.self
            )
            let publicResponse = await loadPublic(username: detail.business.username)
            let reviewsResponse = await loadReviewsAndStats()
            await loadNamedPage(username: detail.business.username)
            let content = build(
                from: detail,
                publicResponse: publicResponse,
                reviewsResponse: reviewsResponse
            )
            state = .loaded(content)
        } catch let error as APIError {
            switch error {
            case .notFound:
                logger.info("Business not found: \(self.businessId)")
                state = .notFound
            default:
                logger.warning("Business detail load failed: \(error)")
                state = .error(message: friendlyMessage(for: error))
            }
        } catch {
            logger.warning("Business detail load failed: \(error)")
            state = .error(message: "Something went wrong")
        }
    }

    private func loadPublic(username: String?) async -> BusinessPublicResponse? {
        guard let username, !username.isEmpty else { return nil }
        do {
            return try await client.request(
                BusinessesEndpoints.publicBusiness(username: username),
                as: BusinessPublicResponse.self
            )
        } catch {
            logger.debug("Public business fetch skipped (unpublished or error): \(error)")
            return nil
        }
    }

    /// C4 — resolves `GET /api/b/:username/:slug` so the named custom page
    /// opens with its published blocks. Mirrors RN `business/[username].tsx`'s
    /// `fetchPublicPage`, including the two failure copies.
    private func loadNamedPage(username: String?) async {
        guard let pageSlug, !pageSlug.isEmpty else {
            namedPage = .none
            return
        }
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
            namedPage = .failed(
                title: pageSlug,
                message: "This business page does not exist or is not published."
            )
        }
    }

    private func loadReviewsAndStats() async -> PublicProfile? {
        do {
            return try await client.request(
                PublicProfileEndpoints.profile(id: businessId),
                as: PublicProfile.self
            )
        } catch {
            logger.debug("Public-profile fallback skipped for business: \(error)")
            return nil
        }
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
        reviewsResponse: PublicProfile?
    ) -> BusinessProfileContent {
        let business = detail.business
        let profile = detail.profile
        let primaryLocation = profile?.primaryLocation
            ?? detail.locations.first { $0.isPrimary == true }
            ?? detail.locations.first

        let calendar = Calendar.current
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
            isVerified: business.verified ?? (profile?.verificationStatus.map { $0 != "unverified" } ?? false),
            logoIcon: nil
        )

        let scopedHours = scopedHours(
            from: publicResponse?.hours ?? [],
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
            dock: buildDock(status: status, isNewlyClaimed: isNewlyClaimed),
            savedPlace: pendingSavePlace,
            isNewlyClaimed: isNewlyClaimed,
            phoneNumber: profile?.publicPhone ?? primaryLocation?.phone,
            websiteURL: normalizedWebsite(profile?.website),
            viewerIsOwner: detail.access?.isOwner ?? false
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
                label: name,
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

    private func buildHours(from rows: [BusinessHoursDTO], weekday: Int) -> [BusinessHoursRow] {
        rows.sorted { $0.dayOfWeek < $1.dayOfWeek }.map { row in
            let dayIndex = max(0, min(6, row.dayOfWeek))
            let isClosed = row.isClosed == true
            let time = if isClosed {
                "Closed"
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

        if let today = byDay[weekday]?.first, let state = todayOpenState(today, minutesNow: minutesNow) {
            return state
        }
        if let next = nextOpening(byDay: byDay, weekday: weekday) {
            return next
        }
        return BusinessOpenState(isOpen: false, statusLabel: "Closed", statusDetail: "Hours vary", chipLabel: "Closed")
    }

    private func todayOpenState(_ today: BusinessHoursDTO, minutesNow: Int) -> BusinessOpenState? {
        guard today.isClosed != true,
              let openM = minutes(today.openTime),
              let closeM = minutes(today.closeTime) else { return nil }
        if minutesNow >= openM, minutesNow < closeM {
            return BusinessOpenState(
                isOpen: true,
                statusLabel: "Open now",
                statusDetail: "Closes \(formatTime(today.closeTime ?? ""))",
                chipLabel: "Open now"
            )
        }
        if minutesNow < openM {
            return BusinessOpenState(
                isOpen: false,
                statusLabel: "Closed now",
                statusDetail: "Opens today at \(formatTime(today.openTime ?? ""))",
                chipLabel: "Closed · opens \(formatTime(today.openTime ?? ""))"
            )
        }
        return nil
    }

    private func nextOpening(byDay: [Int: [BusinessHoursDTO]], weekday: Int) -> BusinessOpenState? {
        for offset in 1...7 {
            let day = (weekday + offset) % 7
            guard let row = byDay[day]?.first, row.isClosed != true,
                  let open = row.openTime, minutes(open) != nil else { continue }
            let whenLabel = offset == 1 ? "tomorrow" : fullDayName(day)
            return BusinessOpenState(
                isOpen: false,
                statusLabel: "Closed now",
                statusDetail: "Opens \(whenLabel) at \(formatTime(open))",
                chipLabel: "Closed · opens \(formatTime(open))"
            )
        }
        return nil
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
        let suffix = hour >= 12 ? "PM" : "AM"
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
        let title = cityState.isEmpty ? (location.address ?? "Service area") : cityState
        let detail = (location.address?.isEmpty == false && !cityState.isEmpty) ? location.address : nil
        return BusinessServiceArea(
            title: title,
            detail: detail,
            serviceArea: serviceAreaText,
            latitude: location.location?.lat,
            longitude: location.location?.lng
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
            body: raw.content ?? "",
            timestamp: relativeTimestamp(raw.createdAt),
            verified: false
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

    private func buildDock(status: BusinessOpenState?, isNewlyClaimed: Bool) -> BusinessActionDock {
        let isClosed = status?.isOpen == false
        let secondary: BusinessActionDock.Secondary = (isNewlyClaimed || isClosed) ? .call : .book
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

    private func normalizedWebsite(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        if let url = URL(string: raw), url.scheme != nil {
            return url
        }
        return URL(string: "https://\(raw)")
    }
}
