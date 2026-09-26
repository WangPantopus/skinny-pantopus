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
    /// Whether the viewer has saved this listing (`userHasSaved`); drives
    /// the cover's bookmark chip.
    public private(set) var isSaved = false
    private var isSaveInFlight = false

    private let listingId: String
    private let api: APIClient
    private let currentUserId: @MainActor () -> String?
    private let checkout: CheckoutCoordinator
    private var acceptedOffer: ListingOfferDTO?
    /// The viewer's own open (pending or countered) offer; the dock then
    /// shows it in place of "Make offer".
    public private(set) var myOffer: ListingOfferDTO?
    private var checkoutReadFailed = false
    private var isCheckingOut = false

    init(
        listingId: String,
        api: APIClient = .shared,
        currentUserId: @escaping @MainActor () -> String? = ListingDetailViewModel.currentSignedInUserId,
        checkout: CheckoutCoordinator = CheckoutCoordinator()
    ) {
        self.listingId = listingId
        self.api = api
        self.currentUserId = currentUserId
        self.checkout = checkout
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
            isSaved = detail.listing.userHasSaved ?? false
            acceptedOffer = nil
            myOffer = nil
            checkoutReadFailed = false
            if !isOwnedByMe, !isSold, let viewerId = currentUserId() {
                do {
                    let response: ListingOffersResponse = try await api.request(ListingOffersEndpoints.list(listingId: listingId))
                    acceptedOffer = response.offers.first {
                        $0.status == "accepted" && ($0.buyerId ?? $0.buyer?.id) == viewerId
                    }
                    // The server allows one open offer per buyer; a new one is refused while it stands.
                    myOffer = response.offers.first {
                        ["pending", "countered"].contains($0.status ?? "") && ($0.buyerId ?? $0.buyer?.id) == viewerId
                    }
                    if let acceptedOffer {
                        checkout.reconcileListingConfirmation(userId: viewerId, listingId: listingId, offer: acceptedOffer)
                    }
                } catch {
                    checkoutReadFailed = true
                }
            }
            rebuild()
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
            let response: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.create(
                    listingId: listingId,
                    body: CreateListingOfferBody(amount: amount, message: message)
                )
            )
            // The dock shows the sent offer at once ("Your offer $X").
            myOffer = response.offer
            rebuild()
            return nil
        } catch {
            return (error as? LocalizedError)?.errorDescription ?? "Couldn't send your offer. Please try again."
        }
    }

    /// True when the loaded listing is sold; its dock then offers "Find
    /// similar" instead of an offer.
    public var isSold: Bool {
        rawListing.map(Self.isSold) ?? false
    }

    /// The listing's public web page, the link the cover's share chip
    /// sends (as the gig detail's share does).
    public var shareURL: URL {
        URL(string: "https://pantopus.com/listing/\(listingId)") ?? AppEnvironment.current.apiBaseURL
    }

    /// The cover's bookmark chip. `POST /api/listings/:id/save` toggles the
    /// save and answers the new state: the chip flips at once and settles
    /// on that answer, or flips back and returns `false` so the view can
    /// say so.
    @discardableResult
    public func toggleSave() async -> Bool {
        guard !isSaveInFlight, rawListing != nil else { return true }
        isSaveInFlight = true
        defer { isSaveInFlight = false }
        let target = !isSaved
        isSaved = target
        do {
            let response: ListingSaveResponse = try await api.request(ListingsEndpoints.save(id: listingId))
            isSaved = response.saved ?? target
            return true
        } catch {
            isSaved = !target
            return false
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

    static func project(
        _ listing: ListingDTO,
        viewerUserId: String? = nil,
        checkoutButton: ContentDetailDockButton? = nil,
        myOffer: ListingOfferDTO? = nil
    ) -> ContentDetailContent {
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
            counterparty: counterparty(for: listing, isViewerOwner: isViewerOwner),
            modules: modules(for: listing),
            trustCapsules: [],
            dock: dock(isViewerOwner: isViewerOwner, sold: sold, onHold: onHold, checkoutButton: checkoutButton, myOffer: myOffer)
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
        return usd(price)
    }

    /// "$20" or "$20.50", as the price line shows amounts.
    static func usd(_ amount: Double) -> String {
        amount.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(amount))"
            : String(format: "$%.2f", amount)
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

    /// The real seller (name, photo, verification) from the listing's creator
    /// identity. The seller viewing their own listing has no one to message here.
    private static func counterparty(for listing: ListingDTO, isViewerOwner: Bool) -> ContentDetailCounterparty {
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
            showsMessageButton: !isViewerOwner
        )
    }

    private static func modules(for listing: ListingDTO) -> [ContentDetailModule] {
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
        return modules
    }

    private static func dock(
        isViewerOwner: Bool,
        sold: Bool,
        onHold: Bool,
        checkoutButton: ContentDetailDockButton?,
        myOffer: ListingOfferDTO?
    ) -> ContentDetailDock {
        if sold {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Seller", icon: .shoppingBag),
                primary: ContentDetailDockButton(label: "Find similar", icon: .search)
            )
        }
        if !isViewerOwner, let checkoutButton {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: checkoutButton
            )
        }
        // A held listing takes no new offers (the server refuses them); its seller still reaches the offers.
        if onHold, !isViewerOwner {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Message", icon: .send),
                primary: ContentDetailDockButton(label: "Pickup pending", icon: .clock, enabled: false)
            )
        }
        // The buyer's open offer replaces "Make offer": "Your offer $20" (free-listing interest has no amount).
        let primaryLabel: String = if isViewerOwner {
            "View offers"
        } else if let amount = myOffer?.amount, amount > 0 {
            "Your offer \(usd(amount))"
        } else if myOffer != nil {
            "Your offer"
        } else {
            "Make offer"
        }
        return ContentDetailDock(
            secondary: ContentDetailDockButton(label: "Message", icon: .send),
            primary: ContentDetailDockButton(label: primaryLabel, icon: nil)
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

extension ListingDetailViewModel {
    public var hasCheckoutAction: Bool {
        !isSold && !isOwnedByMe && (acceptedOffer != nil || checkoutReadFailed || isAwaitingConfirmation)
    }

    private var isAwaitingConfirmation: Bool {
        checkout.isListingConfirmationPending(userId: currentUserId(), listingId: listingId)
    }

    private var checkoutButton: ContentDetailDockButton? {
        if isCheckingOut { return .init(label: "Checking payment…", icon: .clock, enabled: false) }
        if isAwaitingConfirmation { return .init(label: "Check payment status", icon: .clock) }
        if checkoutReadFailed { return .init(label: "Check payment", icon: .clock) }
        guard let offer = acceptedOffer else { return nil }
        guard let summary = offer.checkout else { return .init(label: "Check payment", icon: .clock) }
        if summary.canContinue, ["ready", "retry", "pending"].contains(summary.state) {
            return .init(label: summary.state == "retry" ? "Retry checkout" : "Continue checkout", icon: nil)
        }
        let label: String
        switch summary.state {
        case "authorized": label = "Payment authorized"
        case "processing": label = "Payment processing"
        case "paid": label = "Payment received"
        case "refund_pending": label = "Refund processing"
        case "partially_refunded": label = "Partially refunded"
        case "refunded": label = "Payment refunded"
        case "disputed": label = "Payment disputed"
        case "not_payable": label = "Pickup pending"
        default: return .init(label: "Check payment", icon: .clock)
        }
        return .init(label: label, icon: .clock, enabled: false)
    }

    private func rebuild() {
        guard let listing = rawListing else { return }
        state = .loaded(Self.project(listing, viewerUserId: currentUserId(), checkoutButton: checkoutButton, myOffer: myOffer))
    }

    public enum CheckoutFeedback {
        case awaitingConfirmation
        case error(String)
    }

    public func continueCheckout() async -> CheckoutFeedback? {
        guard !isCheckingOut else { return nil }
        guard let offer = acceptedOffer, let summary = offer.checkout,
              summary.canContinue, ["ready", "retry", "pending"].contains(summary.state), !checkoutReadFailed,
              !isAwaitingConfirmation else {
            await load()
            if checkoutReadFailed || acceptedOffer?.checkout == nil || acceptedOffer?.checkout?.state == "unavailable" {
                return .error("Payment status is unavailable. Please try again.")
            }
            return isAwaitingConfirmation ? .awaitingConfirmation : nil
        }
        let checkoutUserId = currentUserId()
        isCheckingOut = true
        rebuild()
        defer {
            isCheckingOut = false
            if case .error = state {} else { rebuild() }
        }
        let outcome = await checkout.pay(CheckoutRequest(listingId: listingId, offerId: offer.id))
        switch outcome {
        case .paid:
            // The sheet result is not durable payment proof. Keep its submission
            // across screen re-entry until an authoritative status resolves it.
            if let checkoutUserId {
                checkout.markListingConfirmationPending(userId: checkoutUserId, listingId: listingId, offerId: offer.id)
            }
            await load()
            return isAwaitingConfirmation ? .awaitingConfirmation : nil
        case .canceled: return nil
        case let .declined(message), let .failed(message): return .error(message)
        }
    }
}

// MARK: - The buyer's open offer

public extension ListingDetailViewModel {
    /// The buyer withdraws their open offer → `POST /api/listings/:id/offers/:offerId/withdraw`,
    /// as on web; the dock returns to "Make offer". Returns `nil` on success, or the reason for
    /// the sheet to show.
    func withdrawOffer() async -> String? {
        guard let offer = myOffer else { return nil }
        do {
            let _: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.withdraw(listingId: listingId, offerId: offer.id)
            )
            myOffer = nil
            rebuild()
            return nil
        } catch {
            return (error as? LocalizedError)?.errorDescription ?? "Couldn't withdraw your offer. Please try again."
        }
    }

    /// The buyer accepts the seller's counter → `POST /api/listings/:id/offers/:offerId/accept`,
    /// as web's "Accept". The listing is then held for them, so the detail reloads and the dock
    /// offers the accepted offer's checkout. Returns `nil` on success, or the reason for the
    /// sheet to show.
    func acceptCounter() async -> String? {
        guard let offer = myOffer, offer.status == "countered" else { return nil }
        do {
            let _: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.accept(listingId: listingId, offerId: offer.id)
            )
        } catch {
            return (error as? LocalizedError)?.errorDescription ?? "Couldn't accept the counter-offer. Please try again."
        }
        await load()
        return nil
    }
}
