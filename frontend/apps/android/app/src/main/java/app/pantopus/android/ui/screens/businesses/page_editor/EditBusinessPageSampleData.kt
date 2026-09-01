@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor

/**
 * P4.2 — A13.10 Edit Business Page. Two render-only sample payloads
 * mirroring iOS's [EditBusinessPageSampleData] fixtures.
 */
object EditBusinessPageSampleData {
    /** Published business mid-edit — Roost Café, 3 unsaved tweaks. */
    val publishedRoostCafe: EditBusinessPageContent =
        EditBusinessPageContent(
            businessId = "biz-roost",
            mode =
                EditBusinessPageMode.Published(
                    unsavedCount = 3,
                    lastPublishedLabel = "Published · 6 days ago",
                ),
            banner = EditBusinessPageBannerState.Filled(dirty = true),
            logo = EditBusinessPageLogoState.Filled(initial = "R"),
            name = EditBusinessPageField(original = "Roost Café", current = "Roost Café"),
            tagline =
                EditBusinessPageField(
                    original = "Slow mornings, strong coffee, warm bread.",
                    current = "Slow mornings, strong coffee, warm bread.",
                ),
            category = EditBusinessPageField(original = "Café · Bakery", current = "Café · Bakery"),
            categoryRequired = false,
            price = EditBusinessPageField(original = "$$", current = "$$"),
            description =
                EditBusinessPageDescriptionState.Field(
                    field =
                        EditBusinessPageField(
                            original = ROOST_DESCRIPTION,
                            current = ROOST_DESCRIPTION,
                        ),
                    charLimit = 600,
                ),
            hours =
                EditBusinessPageHoursState.Rows(
                    rows =
                        listOf(
                            EditBusinessPageHoursRow(
                                id = "mon",
                                dayLabel = "Mon",
                                state = EditBusinessPageHoursRow.State.Open("7:00 AM", "3:00 PM"),
                                isDirty = true,
                            ),
                            EditBusinessPageHoursRow(
                                id = "tue",
                                dayLabel = "Tue",
                                state = EditBusinessPageHoursRow.State.Open("7:00 AM", "5:00 PM"),
                            ),
                            EditBusinessPageHoursRow(
                                id = "wed",
                                dayLabel = "Wed",
                                state = EditBusinessPageHoursRow.State.Open("7:00 AM", "5:00 PM"),
                            ),
                            EditBusinessPageHoursRow(
                                id = "thu",
                                dayLabel = "Thu",
                                state = EditBusinessPageHoursRow.State.Open("7:00 AM", "5:00 PM"),
                            ),
                            EditBusinessPageHoursRow(
                                id = "fri",
                                dayLabel = "Fri",
                                state = EditBusinessPageHoursRow.State.Open("7:00 AM", "9:00 PM"),
                            ),
                            EditBusinessPageHoursRow(
                                id = "sat",
                                dayLabel = "Sat",
                                state = EditBusinessPageHoursRow.State.Open("8:00 AM", "9:00 PM"),
                            ),
                            EditBusinessPageHoursRow(
                                id = "sun",
                                dayLabel = "Sun",
                                state = EditBusinessPageHoursRow.State.Open("8:00 AM", "2:00 PM"),
                            ),
                        ),
                    footerHint = "Holiday hours can be added per date — neighbors see a banner.",
                ),
            services =
                EditBusinessPageServicesState.Chips(
                    chips =
                        listOf(
                            EditBusinessPageServiceChip("1", "Dine-in", "utensils"),
                            EditBusinessPageServiceChip("2", "Takeaway", "shopping-bag"),
                            EditBusinessPageServiceChip("3", "Outdoor seating", "trees"),
                            EditBusinessPageServiceChip("4", "Free Wi-Fi", "wifi"),
                            EditBusinessPageServiceChip("5", "Dog-friendly", "paw-print"),
                            EditBusinessPageServiceChip("6", "Pre-order", "clock"),
                        ),
                ),
            gallery =
                EditBusinessPageGalleryState(
                    tiles =
                        listOf(
                            EditBusinessPageGalleryTile(
                                id = "g1",
                                palette = EditBusinessPageGalleryTile.Palette.Croissant,
                                isCover = true,
                            ),
                            EditBusinessPageGalleryTile(
                                id = "g2",
                                palette = EditBusinessPageGalleryTile.Palette.Interior,
                            ),
                            EditBusinessPageGalleryTile(
                                id = "g3",
                                palette = EditBusinessPageGalleryTile.Palette.Coffee,
                            ),
                            EditBusinessPageGalleryTile(
                                id = "g4",
                                palette = EditBusinessPageGalleryTile.Palette.Bread,
                            ),
                            EditBusinessPageGalleryTile(
                                id = "g5",
                                palette = EditBusinessPageGalleryTile.Palette.Latte,
                            ),
                        ),
                    freshAddTile = true,
                    hintLabel = "6 of 20 · drag to reorder",
                ),
            phone = EditBusinessPageField(original = "(415) 555-0146", current = "(415) 555-0146"),
            email = EditBusinessPageField(original = "hello@roostcafe.co", current = "hello@roostcafe.co"),
            website = EditBusinessPageField(original = "roostcafe.co", current = "roostcafe.co"),
            bookingLink =
                EditBusinessPageField(
                    original = "resy.com/roost-elm-park",
                    current = "resy.com/roost-elm-park",
                ),
            location =
                EditBusinessPageLocation(
                    address =
                        EditBusinessPageField(
                            original = "412 Elm St, Elm Park, NY 10013",
                            current = "412 Elm St, Elm Park, NY 10013",
                        ),
                    mapVerified = true,
                    hideExactAddress = false,
                ),
        )

    /** Setup mode — Patch & Paw, 3 of 7 sections complete. */
    val setupPatchAndPaw: EditBusinessPageContent =
        EditBusinessPageContent(
            businessId = "biz-patch-paw",
            mode =
                EditBusinessPageMode.Setup(
                    done = 3,
                    total = 7,
                    remaining = 4,
                    items =
                        listOf(
                            EditBusinessPageSetupItem("name", "Name", done = true),
                            EditBusinessPageSetupItem("contact", "Contact", done = true),
                            EditBusinessPageSetupItem("location", "Location", done = true),
                            EditBusinessPageSetupItem("banner", "Banner", done = false),
                            EditBusinessPageSetupItem("desc", "Description", done = false),
                            EditBusinessPageSetupItem("hours", "Hours", done = false),
                            EditBusinessPageSetupItem("services", "Services", done = false),
                        ),
                ),
            banner = EditBusinessPageBannerState.Empty,
            logo = EditBusinessPageLogoState.Empty,
            name = EditBusinessPageField(original = "Patch & Paw Grooming", current = "Patch & Paw Grooming"),
            tagline =
                EditBusinessPageField(
                    original = "",
                    current = "",
                    placeholder = "One short line, no punctuation",
                ),
            category =
                EditBusinessPageField(
                    original = "",
                    current = "",
                    placeholder = "Pick a category",
                ),
            categoryRequired = true,
            price = EditBusinessPageField(original = "", current = "", placeholder = "$ — $$$$"),
            description =
                EditBusinessPageDescriptionState.Prompt(
                    EditBusinessPagePrompt(
                        iconKey = "fileText",
                        title = "Tell neighbors what you do",
                        subtitle = "A short paragraph helps your page rank in local search.",
                        ctaLabel = "Write",
                    ),
                ),
            hours =
                EditBusinessPageHoursState.QuickApply(
                    rows =
                        listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").map { day ->
                            EditBusinessPageHoursRow(
                                id = "d-$day",
                                dayLabel = day,
                                state = EditBusinessPageHoursRow.State.NotSet,
                            )
                        },
                ),
            services =
                EditBusinessPageServicesState.Prompt(
                    EditBusinessPagePrompt(
                        iconKey = "sparkles",
                        title = "Add at least one service",
                        subtitle = "Required to appear in category search results.",
                        ctaLabel = "Add",
                    ),
                ),
            gallery =
                EditBusinessPageGalleryState(
                    tiles = emptyList(),
                    freshAddTile = false,
                    hintLabel = "0 of 20 · cover photo first",
                ),
            phone = EditBusinessPageField(original = "(415) 555-0212", current = "(415) 555-0212"),
            email = EditBusinessPageField(original = "lena@patchandpaw.co", current = "lena@patchandpaw.co"),
            website =
                EditBusinessPageField(
                    original = "",
                    current = "",
                    placeholder = "example.com",
                ),
            bookingLink = null,
            location =
                EditBusinessPageLocation(
                    address =
                        EditBusinessPageField(
                            original = "218 4th Ave, Elm Park, NY",
                            current = "218 4th Ave, Elm Park, NY",
                        ),
                    error = "ZIP code missing — needed to verify",
                    mapVerified = false,
                    pinDirty = true,
                    hideExactAddress = false,
                ),
        )

    private const val ROOST_DESCRIPTION: String =
        "A corner café tucked under the old elms on 4th. Family-run since 2011. " +
            "House-baked sourdough, single-origin pour-over, and a back patio that's " +
            "the best-kept secret on the block. Dogs and laptops welcome before noon."
}
