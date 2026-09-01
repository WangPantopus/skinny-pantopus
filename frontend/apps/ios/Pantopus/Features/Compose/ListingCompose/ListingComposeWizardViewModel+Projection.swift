//
//  ListingComposeWizardViewModel+Projection.swift
//  Pantopus
//
//  Server DTO to listing-compose form projection helpers.
//

import Foundation

extension ListingComposeWizardViewModel {
    /// Pure projection from a server `ListingDTO` to the wizard's
    /// `ListingComposeFormState`. Used both by `loadExistingIfNeeded`
    /// and by unit tests asserting prefill correctness.
    static func project(
        from listing: ListingDTO,
        jumpToStep: ListingComposeStep? = nil
    ) -> ListingComposeFormState {
        let category = mapCategory(listing: listing)
        let condition = listing.condition.flatMap(ListingComposeCondition.init(rawValue:))
        let priceKind = mapPriceKind(listing: listing, category: category)
        let priceAmount: String = {
            guard let price = listing.price, !(listing.isFree ?? false) else { return "" }
            if price.truncatingRemainder(dividingBy: 1) == 0 {
                return String(Int(price))
            }
            return String(format: "%.2f", price)
        }()
        let locationKind: ListingComposeLocationKind? = {
            guard let name = listing.locationName, !name.isEmpty else {
                return .savedAddress
            }
            return .meetPoint
        }()
        let locationLabel: String = {
            if locationKind == .meetPoint { return listing.locationName ?? "" }
            return ""
        }()
        // Photos: hydrate the grid from `mediaUrls` so the user sees
        // the existing images before they pick replacements.
        let photos = (listing.mediaUrls ?? []).map { url in
            ListingComposePhoto(token: url)
        }
        let initialStep = jumpToStep ?? .review
        return ListingComposeFormState(
            step: initialStep.rawValue,
            entryMode: .manual,
            photos: photos,
            title: listing.title ?? "",
            category: category,
            condition: condition,
            bodyText: listing.description ?? "",
            priceKind: priceKind,
            priceAmount: priceAmount,
            fulfillment: .pickup,
            locationKind: locationKind,
            locationLabel: locationLabel,
            // Preserve the listing's real product category so a PATCH
            // round-trips it instead of degrading to `other`.
            backendCategory: listing.category
        )
    }

    private static func mapCategory(listing: ListingDTO) -> ListingComposeCategory? {
        // `listing_type` is the most precise — it differentiates Wanted,
        // Free, and rentals from a plain `goods` listing. Fall back to
        // `layer` for older rows.
        switch listing.listingType {
        case "wanted_request": return .wanted
        case "free_item": return .free
        case "rent_item": return .rentals
        case "sell_item":
            if listing.layer == "vehicles" { return .vehicles }
            return .goods
        default: break
        }
        switch listing.layer {
        case "vehicles": return .vehicles
        case "rentals": return .rentals
        case "goods":
            if listing.isFree == true { return .free }
            return .goods
        default: return nil
        }
    }

    private static func mapPriceKind(
        listing: ListingDTO,
        category: ListingComposeCategory?
    ) -> ListingComposePriceKind? {
        if listing.isFree == true || category == .free { return .free }
        if listing.price != nil { return .fixed }
        return nil
    }
}
