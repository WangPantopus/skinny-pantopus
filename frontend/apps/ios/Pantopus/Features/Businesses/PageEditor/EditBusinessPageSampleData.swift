//
//  EditBusinessPageSampleData.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Two render-only sample payloads
//  matching the design's two frames:
//    - `published` → Roost Café, 3 unsaved tweaks, dirty bar
//    - `setup`     → Patch & Paw, 3 of 7 sections, completion strip,
//                    "Publish · 4 to go" bar.
//
//  Used by previews + snapshot tests; the live API will project
//  `BusinessDetailResponse` onto the same content shape when the
//  backend endpoints land.
//

import Foundation

public enum EditBusinessPageSampleData {
    /// Published business mid-edit: Mon hours trimmed (amber row +
    /// dot), a new gallery shot uploaded (amber tile), banner swapped
    /// (amber rim + "New" chip). Sticky bar is the dirty Discard/Save
    /// pair.
    public static let publishedRoostCafe = EditBusinessPageContent(
        businessId: "biz-roost",
        mode: .published(unsavedCount: 3, lastPublishedLabel: "Published · 6 days ago"),
        banner: .filled(dirty: true, palette: .cafeGoldenHour),
        logo: .filled(initial: "R", palette: .sunrise),
        name: .init(original: "Roost Café", current: "Roost Café"),
        tagline: .init(
            original: "Slow mornings, strong coffee, warm bread.",
            current: "Slow mornings, strong coffee, warm bread."
        ),
        category: .init(original: "Café · Bakery", current: "Café · Bakery"),
        categoryRequired: false,
        price: .init(original: "$$", current: "$$"),
        description: .field(
            .init(
                original: roostDescription,
                current: roostDescription
            ),
            charLimit: 600
        ),
        hours: .rows(
            rows: [
                .init(id: "mon", dayLabel: "Mon", state: .open(openLabel: "7:00 AM", closeLabel: "3:00 PM"), isDirty: true),
                .init(id: "tue", dayLabel: "Tue", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
                .init(id: "wed", dayLabel: "Wed", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
                .init(id: "thu", dayLabel: "Thu", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
                .init(id: "fri", dayLabel: "Fri", state: .open(openLabel: "7:00 AM", closeLabel: "9:00 PM")),
                .init(id: "sat", dayLabel: "Sat", state: .open(openLabel: "8:00 AM", closeLabel: "9:00 PM")),
                .init(id: "sun", dayLabel: "Sun", state: .open(openLabel: "8:00 AM", closeLabel: "2:00 PM"))
            ],
            footerHint: "Holiday hours can be added per date — neighbors see a banner."
        ),
        services: .chips(chips: [
            .init(id: "1", label: "Dine-in", iconKey: "utensils"),
            .init(id: "2", label: "Takeaway", iconKey: "shopping-bag"),
            .init(id: "3", label: "Outdoor seating", iconKey: "trees"),
            .init(id: "4", label: "Free Wi-Fi", iconKey: "wifi"),
            .init(id: "5", label: "Dog-friendly", iconKey: "paw-print"),
            .init(id: "6", label: "Pre-order", iconKey: "clock")
        ]),
        gallery: .init(
            tiles: [
                .init(id: "g1", palette: .croissant, isCover: true),
                .init(id: "g2", palette: .interior),
                .init(id: "g3", palette: .coffee),
                .init(id: "g4", palette: .bread),
                .init(id: "g5", palette: .latte)
            ],
            totalSlots: 20,
            freshAddTile: true,
            hintLabel: "6 of 20 · drag to reorder"
        ),
        phone: .init(original: "(415) 555-0146", current: "(415) 555-0146"),
        email: .init(original: "hello@roostcafe.co", current: "hello@roostcafe.co"),
        website: .init(original: "roostcafe.co", current: "roostcafe.co"),
        bookingLink: .init(
            original: "resy.com/roost-elm-park",
            current: "resy.com/roost-elm-park"
        ),
        location: .init(
            address: .init(
                original: "412 Elm St, Elm Park, NY 10013",
                current: "412 Elm St, Elm Park, NY 10013"
            ),
            mapVerified: true,
            hideExactAddress: false
        )
    )

    private static let roostDescription = """
    A corner café tucked under the old elms on 4th. Family-run since 2011. \
    House-baked sourdough, single-origin pour-over, and a back patio that's \
    the best-kept secret on the block. Dogs and laptops welcome before noon.
    """

    /// Newly claimed business: empty banner / logo, blank description,
    /// hours unset, services empty, address fails ZIP validation.
    /// Sticky bar shows Save draft + Publish · 4 to go (locked).
    public static let setupPatchAndPaw = EditBusinessPageContent(
        businessId: "biz-patch-paw",
        mode: .setup(
            done: 3,
            total: 7,
            remaining: 4,
            items: [
                .init(id: "name", label: "Name", done: true),
                .init(id: "contact", label: "Contact", done: true),
                .init(id: "location", label: "Location", done: true),
                .init(id: "banner", label: "Banner", done: false),
                .init(id: "desc", label: "Description", done: false),
                .init(id: "hours", label: "Hours", done: false),
                .init(id: "services", label: "Services", done: false)
            ]
        ),
        banner: .empty,
        logo: .empty,
        name: .init(original: "Patch & Paw Grooming", current: "Patch & Paw Grooming"),
        tagline: .init(
            original: "",
            current: "",
            placeholder: "One short line, no punctuation"
        ),
        category: .init(
            original: "",
            current: "",
            placeholder: "Pick a category"
        ),
        categoryRequired: true,
        price: .init(original: "", current: "", placeholder: "$ — $$$$"),
        description: .prompt(.init(
            iconKey: "fileText",
            title: "Tell neighbors what you do",
            subtitle: "A short paragraph helps your page rank in local search.",
            ctaLabel: "Write"
        )),
        hours: .quickApply(rows: [
            .init(id: "mon", dayLabel: "Mon", state: .notSet),
            .init(id: "tue", dayLabel: "Tue", state: .notSet),
            .init(id: "wed", dayLabel: "Wed", state: .notSet),
            .init(id: "thu", dayLabel: "Thu", state: .notSet),
            .init(id: "fri", dayLabel: "Fri", state: .notSet),
            .init(id: "sat", dayLabel: "Sat", state: .notSet),
            .init(id: "sun", dayLabel: "Sun", state: .notSet)
        ]),
        services: .prompt(.init(
            iconKey: "sparkles",
            title: "Add at least one service",
            subtitle: "Required to appear in category search results.",
            ctaLabel: "Add"
        )),
        gallery: .init(
            tiles: [],
            totalSlots: 20,
            freshAddTile: false,
            hintLabel: "0 of 20 · cover photo first"
        ),
        phone: .init(original: "(415) 555-0212", current: "(415) 555-0212"),
        email: .init(original: "lena@patchandpaw.co", current: "lena@patchandpaw.co"),
        website: .init(
            original: "",
            current: "",
            placeholder: "example.com"
        ),
        bookingLink: nil,
        location: .init(
            address: .init(
                original: "218 4th Ave, Elm Park, NY",
                current: "218 4th Ave, Elm Park, NY"
            ),
            error: "ZIP code missing — needed to verify",
            mapVerified: false,
            pinDirty: true,
            hideExactAddress: false
        )
    )
}
