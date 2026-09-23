//
//  ListingDetailViewModel.swift
//  Pantopus
//
//  Fetches `GET /api/listings/:id`, projects into `ContentDetailContent`
//  for the shared `ContentDetailShell`, and exposes `messageSeller` /
//  `makeOffer` actions for the sticky dock.
//

import Foundation
import Observation

@Observable
@MainActor
public final class ListingDetailViewModel {
    public private(set) var state: ContentDetailState = .loading
    public private(set) var rawListing: ListingDTO?

    private let listingId: String
    private let api: APIClient
    private let currentUserId: @MainActor () -> String?

    init(
        listingId: String,
        api: APIClient = .shared,
        currentUserId: @escaping @MainActor () -> String? = ListingDetailViewModel.currentSignedInUserId
    ) {
        self.listingId = listingId
        self.api = api
        self.currentUserId = currentUserId
    }

    /// True when the loaded listing is owned by the currently signed-in
    /// user. Drives the dock's "Make offer" → "View offers" swap on the
    /// seller's own listing.
    public var isOwnedByMe: Bool {
        guard let ownerId = rawListing?.userId, !ownerId.isEmpty,
              let me = currentUserId(), !me.isEmpty
        else { return false }
        return ownerId == me
    }

    @MainActor
    private static func currentSignedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }

    public func load() async {
        state = .loading
        do {
            let detail: ListingDetailResponse = try await api.request(ListingsEndpoints.detail(id: listingId))
            rawListing = detail.listing
            let viewerId = currentUserId()
            state = .loaded(Self.project(detail.listing, viewerUserId: viewerId))
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load listing."
            state = .error(message: message)
        }
    }

    /// The buyer's offer → `POST /api/listings/:id/offers`, the route whose offers the seller sees
    /// under "View offers". Returns `nil` on success, or the reason it wasn't sent (e.g. an offer
    /// is already pending) for the sheet to show.
    public func makeOffer(amount: Double?, message: String?) async -> String? {
        do {
            let _: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.create(
                    listingId: listingId,
                    body: CreateListingOfferBody(amount: amount, message: message)
                )
            )
            return nil
        } catch {
            return (error as? LocalizedError)?.errorDescription ?? "Couldn't send your offer. Please try again."
        }
    }

    /// An amount as the buyer typed it: `25.50` or, in a comma-decimal locale, `25,50`.
    static func parseOfferAmount(_ text: String, locale: Locale = .current) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "$", with: "")
        guard !trimmed.isEmpty else { return nil }
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        if let number = formatter.number(from: trimmed) { return number.doubleValue }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
    }

    // MARK: - Projection

    static func project(_ listing: ListingDTO, viewerUserId: String? = nil) -> ContentDetailContent {
        let isViewerOwner: Bool = {
            guard let owner = listing.userId, !owner.isEmpty,
                  let viewer = viewerUserId, !viewer.isEmpty
            else { return false }
            return owner == viewer
        }()
        let sold = isSold(listing)
        // An accepted offer or trade holds the listing for that buyer until the handoff.
        let onHold = !sold && listing.status == "pending_pickup"
        return ContentDetailContent(
            kind: .listing,
            cover: cover(for: listing, sold: sold),
            statusPill: sold
                ? ContentDetailPill(label: "Sold", icon: .alertCircle, tone: .error)
                : onHold ? ContentDetailPill(label: "Pickup pending", icon: .clock, tone: .warning) : nil,
            hero: ContentDetailHero(
                title: listing.title ?? "Listing",
                categoryChip: nil,
                meta: nil,
                priceLine: priceLine(for: listing),
                priceCaption: listing.layer == "rentals" ? "per week" : nil,
                priceStrikethrough: sold,
                inlinePills: inlinePills(for: listing)
            ),
            statStrip: [],
            counterparty: counterparty(for: listing),
            modules: modules(for: listing, sold: sold),
            trustCapsules: [],
            dock: dock(isViewerOwner: isViewerOwner, sold: sold, onHold: onHold)
        )
    }

    private static func isSold(_ listing: ListingDTO) -> Bool {
        (listing.soldAt != nil) || listing.status == "sold"
    }

    /// Condition · pickup · distance pill row rendered directly under the
    /// price (replaces the old bottom trust-capsule row for listings).
    private static func inlinePills(for listing: ListingDTO) -> [ContentDetailPill] {
        var pills: [ContentDetailPill] = []
        if let condition = conditionLabel(listing.condition) {
            pills.append(ContentDetailPill(label: condition, icon: .sparkles, tone: .success))
        }
        if listing.layer == "rentals" {
            pills.append(ContentDetailPill(label: "Rental", icon: .calendar, tone: .business))
        } else if listing.isFree ?? false {
            pills.append(ContentDetailPill(label: "Free", icon: .heart, tone: .success))
        } else {
            pills.append(ContentDetailPill(label: "Pickup", icon: .hand, tone: .neutral))
        }
        if let distance = distanceLabel(listing.distanceMeters) {
            pills.append(ContentDetailPill(label: distance, icon: nil, tone: .neutral))
        }
        return pills
    }

    private static func priceLine(for listing: ListingDTO) -> String {
        if listing.isFree ?? false { return "Free" }
        guard let price = listing.price else { return "—" }
        return price.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(price))"
            : String(format: "$%.2f", price)
    }

    private static func cover(for listing: ListingDTO, sold: Bool) -> ContentDetailCover {
        ContentDetailCover(
            imageUrl: (listing.firstImage ?? listing.mediaUrls?.first).flatMap(URL.init(string:)),
            gradient: ListingGradient.from(id: listing.id),
            placeholderIcon: placeholderIcon(category: listing.category, layer: listing.layer),
            pageCount: max(listing.mediaUrls?.count ?? 1, 1),
            activePage: 0,
            sold: sold,
            glassActions: [.share, .bookmark]
        )
    }

    /// The real seller (name, photo, verification) from the listing's creator identity.
    private static func counterparty(for listing: ListingDTO) -> ContentDetailCounterparty {
        let seller = listing.creator
        let name = seller?.resolvedDisplayName ?? "Seller"
        return ContentDetailCounterparty(
            displayName: name,
            initials: GigDetailViewModel.initialsFromName(name),
            avatarUrl: seller?.resolvedAvatarURL,
            identityKind: "personal",
            verified: seller?.resolvedVerified ?? false,
            rating: nil,
            trailing: listing.locationName,
            showsMessageButton: true
        )
    }

    private static func modules(for listing: ListingDTO, sold: Bool) -> [ContentDetailModule] {
        var modules: [ContentDetailModule] = []
        if let body = listing.description, !body.isEmpty {
            modules.append(.description(ContentDetailDescription(
                title: "Description",
                icon: nil,
                body: body
            )))
        }
        var detailRows: [ContentDetailDetailsGrid.Row] = []
        if let condition = conditionLabel(listing.condition) {
            detailRows.append(ContentDetailDetailsGrid.Row(key: "Condition", value: condition))
        }
        if let where_ = listing.locationName, !where_.isEmpty {
            detailRows.append(ContentDetailDetailsGrid.Row(key: "Location", value: where_))
        }
        if !detailRows.isEmpty {
            modules.append(.detailsGrid(ContentDetailDetailsGrid(title: "Details", icon: .info, rows: detailRows)))
        }
        if sold {
            modules.append(.callout(ContentDetailCallout(
                identifier: "alert-similar",
                style: .banner,
                tone: .neutral,
                icon: .bell,
                iconTone: .primary,
                title: "Alert me when similar appears",
                subtitle: listing.title,
                trailingActionLabel: "Set"
            )))
        }
        return modules
    }

    private static func dock(isViewerOwner: Bool, sold: Bool, onHold: Bool) -> ContentDetailDock {
        if sold {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Seller", icon: .shoppingBag),
                primary: ContentDetailDockButton(label: "Find similar", icon: .search)
            )
        }
        // A held listing takes no new offers (the server refuses them); its seller still reaches the offers.
        if onHold, !isViewerOwner {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Pickup pending", icon: .clock, enabled: false)
            )
        }
        return ContentDetailDock(
            secondary: ContentDetailDockButton(label: "Message", icon: .send),
            primary: ContentDetailDockButton(label: isViewerOwner ? "View offers" : "Make offer", icon: nil)
        )
    }

    private static func placeholderIcon(category: String?, layer: String?) -> PantopusIcon {
        if layer == "vehicles" { return .send }
        if layer == "rentals" { return .calendar }
        switch category ?? "" {
        case "furniture": return .home
        case "electronics": return .lightbulb
        case "clothing": return .shoppingBag
        case "tools": return .hammer
        case "books_media": return .file
        case "free_stuff": return .heart
        default: return .shoppingBag
        }
    }

    private static func conditionLabel(_ condition: String?) -> String? {
        guard let condition else { return nil }
        switch condition {
        case "new": return "New"
        case "like_new": return "Like new"
        case "good": return "Good"
        case "fair": return "Fair"
        case "for_parts": return "For parts"
        default: return condition.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private static func distanceLabel(_ meters: Double?) -> String? {
        guard let meters else { return nil }
        let miles = meters / 1609.344
        if miles < 0.1 { return "< 0.1 mi" }
        if miles < 10 { return String(format: "%.1f mi", miles) }
        return "\(Int(miles)) mi"
    }
}
