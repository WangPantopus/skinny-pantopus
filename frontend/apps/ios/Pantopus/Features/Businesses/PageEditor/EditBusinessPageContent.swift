//
//  EditBusinessPageContent.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Render-only models for the
//  business-profile editor. The view-model projects backend state onto
//  these so the editor view never touches DTOs directly.
//
//  Two top-level modes — `.published` (existing business mid-edit, dirty
//  bar) and `.setup` (newly claimed business, completion strip +
//  "Publish · N to go" CTA). Field-level dirtiness flows from the
//  per-field `EditBusinessPageField` (carries original + current so the
//  view can paint the orange `BizLabel` dot).
//

import Foundation

/// Top-level mode for the edit screen — drives which strip renders
/// under the top bar (identity vs completion) and which `StickySave`
/// variant the footer renders.
public enum EditBusinessPageMode: Sendable, Hashable {
    /// Established business with light edits in flight. `unsavedCount`
    /// is the badge in the sticky save bar's "N unsaved" pill.
    case published(unsavedCount: Int, lastPublishedLabel: String)
    /// Newly-claimed business in setup. `done`/`total` drive the
    /// progress meter, `remaining` is the "Publish · N to go" badge.
    case setup(done: Int, total: Int, remaining: Int, items: [EditBusinessPageSetupItem])
}

/// One pill in the completion strip — section name + done flag.
public struct EditBusinessPageSetupItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let done: Bool

    public init(id: String, label: String, done: Bool) {
        self.id = id
        self.label = label
        self.done = done
    }
}

/// One editable field. `current` is what the user has typed; `original`
/// is what was last saved server-side. `isDirty` drives the orange dot
/// on the field's `BizLabel`.
public struct EditBusinessPageField: Sendable, Hashable {
    public let original: String
    public let current: String
    public let placeholder: String

    public init(original: String, current: String, placeholder: String = "") {
        self.original = original
        self.current = current
        self.placeholder = placeholder
    }

    public var isDirty: Bool {
        original != current
    }
}

/// Banner + logo composite — empty drop targets or a filled hero
/// (`dirty == true` adds the amber "New" chip + rim).
public enum EditBusinessPageBannerState: Sendable, Hashable {
    case empty
    case filled(dirty: Bool, palette: BannerPalette)

    public enum BannerPalette: String, Sendable, Hashable {
        /// Roost-Café-style golden-hour storefront (only filled palette
        /// shipped in v1; future palettes can extend without touching
        /// the editor view).
        case cafeGoldenHour
    }
}

/// Logo state — empty drop target or filled with a colored disc + initial.
public enum EditBusinessPageLogoState: Sendable, Hashable {
    case empty
    case filled(initial: String, palette: LogoPalette)

    public enum LogoPalette: String, Sendable, Hashable {
        case sunrise
    }
}

/// One day in the hours card. Mirrors the design's three row variants:
/// open with times, closed (italic + Set hours link), or "Not set" in the
/// setup frame (purple chip on the right).
public struct EditBusinessPageHoursRow: Sendable, Hashable, Identifiable {
    public enum State: Sendable, Hashable {
        case open(openLabel: String, closeLabel: String)
        case closed
        case notSet
    }

    public let id: String
    public let dayLabel: String
    public let state: State
    public let isDirty: Bool

    public init(id: String, dayLabel: String, state: State, isDirty: Bool = false) {
        self.id = id
        self.dayLabel = dayLabel
        self.state = state
        self.isDirty = isDirty
    }
}

/// One chip in the services flow. `isFresh == true` paints the chip with
/// the amber "just-added" tone instead of the default identity violet.
public struct EditBusinessPageServiceChip: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let iconKey: String
    public let isFresh: Bool

    public init(id: String, label: String, iconKey: String, isFresh: Bool = false) {
        self.id = id
        self.label = label
        self.iconKey = iconKey
        self.isFresh = isFresh
    }
}

/// One photo tile in the gallery grid.
public struct EditBusinessPageGalleryTile: Sendable, Hashable, Identifiable {
    /// Six CSS-art palettes from the design — pin one of these per tile.
    public enum Palette: String, Sendable, Hashable {
        case croissant, coffee, interior, bread, latte, crowd
    }

    public let id: String
    public let palette: Palette
    public let isCover: Bool

    public init(id: String, palette: Palette, isCover: Bool = false) {
        self.id = id
        self.palette = palette
        self.isCover = isCover
    }
}

/// Gallery section state — list of filled tiles + add-tile state.
public struct EditBusinessPageGalleryState: Sendable, Hashable {
    public let tiles: [EditBusinessPageGalleryTile]
    public let totalSlots: Int
    /// `true` adds the amber "Uploaded" rim to the add-more tile to
    /// indicate the last tap dropped a fresh upload.
    public let freshAddTile: Bool
    public let hintLabel: String

    public init(
        tiles: [EditBusinessPageGalleryTile],
        totalSlots: Int = 20,
        freshAddTile: Bool = false,
        hintLabel: String
    ) {
        self.tiles = tiles
        self.totalSlots = totalSlots
        self.freshAddTile = freshAddTile
        self.hintLabel = hintLabel
    }

    /// Empty-gallery variant carries no tiles and renders the "Add
    /// cover photo" spanning hero tile instead of the grid.
    public var isEmpty: Bool {
        tiles.isEmpty
    }
}

/// Address + map state. The address travels as its component parts —
/// `address` is the street line that maps 1:1 onto the backend
/// `BusinessLocation.address` column, with `city` / `state` / `zip` in
/// their own columns — so a save never folds the locality back into the
/// street line. `error` is non-nil when the address fails validation
/// (e.g. missing ZIP in the setup frame).
public struct EditBusinessPageLocation: Sendable, Hashable {
    /// Street line only — never the concatenated display address.
    public let address: EditBusinessPageField
    public let city: EditBusinessPageField
    public let state: EditBusinessPageField
    public let zip: EditBusinessPageField
    public let error: String?
    public let mapVerified: Bool
    public let pinDirty: Bool
    public let hideExactAddress: Bool

    public init(
        address: EditBusinessPageField,
        city: EditBusinessPageField = EditBusinessPageField(original: "", current: ""),
        state: EditBusinessPageField = EditBusinessPageField(original: "", current: ""),
        zip: EditBusinessPageField = EditBusinessPageField(original: "", current: ""),
        error: String? = nil,
        mapVerified: Bool,
        pinDirty: Bool = false,
        hideExactAddress: Bool
    ) {
        self.address = address
        self.city = city
        self.state = state
        self.zip = zip
        self.error = error
        self.mapVerified = mapVerified
        self.pinDirty = pinDirty
        self.hideExactAddress = hideExactAddress
    }

    /// `City, ST ZIP` — display-only projection of the locality parts.
    /// Never written back to the server.
    public var localityLabel: String {
        var label = [city.current, state.current]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let zipValue = zip.current.trimmingCharacters(in: .whitespaces)
        if !zipValue.isEmpty {
            label = label.isEmpty ? zipValue : "\(label) \(zipValue)"
        }
        return label
    }

    /// True when any address component carries an unsaved edit.
    public var hasAddressEdits: Bool {
        address.isDirty || city.isDirty || state.isDirty || zip.isDirty
    }
}

/// Empty-section prompt block (used in the setup frame for Description
/// + Services). Replaces the field UI with a one-line nudge + CTA chip.
public struct EditBusinessPagePrompt: Sendable, Hashable {
    public let iconKey: String
    public let title: String
    public let subtitle: String
    public let ctaLabel: String

    public init(iconKey: String, title: String, subtitle: String, ctaLabel: String) {
        self.iconKey = iconKey
        self.title = title
        self.subtitle = subtitle
        self.ctaLabel = ctaLabel
    }
}

/// One of the two body-section variants — fields or prompt block.
public enum EditBusinessPageDescriptionState: Sendable, Hashable {
    case field(EditBusinessPageField, charLimit: Int)
    case prompt(EditBusinessPagePrompt)
}

public enum EditBusinessPageServicesState: Sendable, Hashable {
    case chips(chips: [EditBusinessPageServiceChip])
    case prompt(EditBusinessPagePrompt)
}

public enum EditBusinessPageHoursState: Sendable, Hashable {
    case rows(rows: [EditBusinessPageHoursRow], footerHint: String?)
    /// Setup frame: 7 "Not set" rows + two quick-apply buttons under the card.
    case quickApply(rows: [EditBusinessPageHoursRow])
}

/// Top-level payload emitted by `EditBusinessPageViewModel`. The view
/// reads only from this — no DTO touches the view layer.
public struct EditBusinessPageContent: Sendable, Hashable {
    public let businessId: String
    public let mode: EditBusinessPageMode

    // Banner / logo
    public let banner: EditBusinessPageBannerState
    public let logo: EditBusinessPageLogoState

    // Name & tagline
    public let name: EditBusinessPageField
    public let tagline: EditBusinessPageField
    public let category: EditBusinessPageField
    public let categoryRequired: Bool
    public let price: EditBusinessPageField

    /// Description
    public let description: EditBusinessPageDescriptionState

    /// Hours
    public let hours: EditBusinessPageHoursState

    /// Services
    public let services: EditBusinessPageServicesState

    /// Gallery
    public let gallery: EditBusinessPageGalleryState

    // Contact (booking is optional → published includes it, setup omits)
    public let phone: EditBusinessPageField
    public let email: EditBusinessPageField
    public let website: EditBusinessPageField
    public let bookingLink: EditBusinessPageField?

    /// Location
    public let location: EditBusinessPageLocation

    public init(
        businessId: String,
        mode: EditBusinessPageMode,
        banner: EditBusinessPageBannerState,
        logo: EditBusinessPageLogoState,
        name: EditBusinessPageField,
        tagline: EditBusinessPageField,
        category: EditBusinessPageField,
        categoryRequired: Bool,
        price: EditBusinessPageField,
        description: EditBusinessPageDescriptionState,
        hours: EditBusinessPageHoursState,
        services: EditBusinessPageServicesState,
        gallery: EditBusinessPageGalleryState,
        phone: EditBusinessPageField,
        email: EditBusinessPageField,
        website: EditBusinessPageField,
        bookingLink: EditBusinessPageField?,
        location: EditBusinessPageLocation
    ) {
        self.businessId = businessId
        self.mode = mode
        self.banner = banner
        self.logo = logo
        self.name = name
        self.tagline = tagline
        self.category = category
        self.categoryRequired = categoryRequired
        self.price = price
        self.description = description
        self.hours = hours
        self.services = services
        self.gallery = gallery
        self.phone = phone
        self.email = email
        self.website = website
        self.bookingLink = bookingLink
        self.location = location
    }
}

/// Top-level render state.
public enum EditBusinessPageState: Sendable, Equatable {
    case loading
    case loaded(EditBusinessPageContent)
    case empty
    case error(message: String)
}
