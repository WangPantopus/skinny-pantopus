package app.pantopus.android.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/**
 * Inventory + resolution checks for [PantopusIcon].
 */
class IconTest {
    /** Authoritative Lucide inventory, sourced from the design archetype JSX. */
    private val expectedLucideInventory =
        setOf(
            "home",
            "map",
            "inbox",
            "user",
            "bell",
            "menu",
            "shield-check",
            "x",
            "plus-circle",
            "camera",
            "scan-line",
            "plus-square",
            "sun",
            "chevron-right",
            "chevron-left",
            "megaphone",
            "shopping-bag",
            "hammer",
            "mailbox",
            "search",
            "user-plus",
            "file",
            "copy",
            "check",
            "more-horizontal",
            "arrow-left",
            "arrow-right",
            "send",
            "chevron-down",
            "chevron-up",
            "trash-2",
            "edit-2",
            "upload",
            "shield",
            "lock",
            "check-circle",
            "alert-circle",
            "circle",
            "info",
            "wifi-off",
            "heart",
            "thumbs-up",
            "star",
            "help-circle",
            "calendar",
            "calendar-check",
            "lightbulb",
            "eye",
            "share",
            "radio",
            "rss",
            "map-pin",
            "pencil",
            "briefcase",
            "gavel",
            "sliders-horizontal",
            "message-circle",
            "at-sign",
            "badge-check",
            "tag",
            "shield-alert",
            "check-check",
            "bookmark",
            "history",
            "receipt",
            "clock",
            "users",
            "dollar-sign",
            // A13.11 — Professional profile.
            "ribbon",
            "palette",
            "play-circle",
            "grip-vertical",
            "grid-3x3",
            "square",
            "dog",
            "cat",
            "bird",
            "fish",
            "turtle",
            "paw-print",
            "sparkles",
            "timer",
            "repeat",
            "hourglass",
            "hand-coins",
            "package",
            // A12.10 — Create Business category tiles.
            "cpu",
            "truck",
            "compass",
            "filter",
            // T5.3.1 — My bids
            "crown",
            "trending-down",
            "ban",
            "file-text",
            // A10.10 — Wallet.
            "trending-up",
            "arrow-down-to-line",
            // T5.3.2 — My tasks
            "plus",
            "rocket",
            "clipboard-list",
            "clock-plus",
            "circle-slash",
            "play",
            "pause",
            // T5.3.3 — My posts
            "archive",
            "message-square-plus",
            // T6.0a — Bills
            "zap",
            "flame",
            "droplet",
            "wifi",
            "building-2",
            "smartphone",
            "wallet",
            "hash",
            // T6.0b — My tasks V2 Magic Task archetype + task-format icons.
            "tv",
            "laptop",
            "monitor",
            "shuffle",
            "wand-sparkles",
            "arrow-up-right",
            // T6.4c — Home calendar event types.
            "wrench",
            "users-round",
            "gift",
            "party-popper",
            "graduation-cap",
            "calendar-days",
            "link",
            // T6.4a — Access codes
            "eye-off",
            "key-round",
            // T6.4b — Emergency info
            "pin",
            "power",
            "phone-call",
            "phone",
            "navigation",
            "heart-pulse",
            "siren",
            "stethoscope",
            "cross",
            "flag",
            "user-round",
            "flask-conical",
            "flame-kindling",
            "printer",
            "alert-triangle",
            // T6.4b — Documents
            "image",
            "file-type",
            "file-spreadsheet",
            "file-signature",
            "landmark",
            "stamp",
            "id-card",
            "folder-lock",
            "upload-cloud",
            "calendar-clock",
            "download",
            // T6.3c — Household tasks chore categories.
            "leaf",
            "list-checks",
            "utensils",
            "baby",
            // T6.3b — Maintenance category glyphs.
            "fan",
            "cloud-rain",
            "refrigerator",
            "bug",
            "trees",
            "paint-roller",
            "bell-ring",
            // A.1 — Today detail weather, transit, and signal glyphs.
            "sun-dim",
            "flower",
            "snowflake",
            "wind",
            "bus",
            "droplets",
            // T6.5e — Mailbox Vault envelope/folder palette.
            "mail",
            "mail-open",
            // A18.1 — Verify email sent envelope-with-check halo glyph.
            "mail-check",
            "folder-plus",
            "piggy-bank",
            "plane",
            "receipt-text",
            "paperclip",
            "arrow-down-up",
            // T6.6b — Chat conversation refresh (header + composer)
            "video",
            "more-vertical",
            "hand",
            "smile",
            "arrow-up",
            // P1.3 — Broadcast detail sub-route
            "reply",
            "radio-tower",
            // P6.5 — Public profile · Persona vs Local
            "message-square",
            "globe",
            // P2.10 — Document detail sticky-footer action glyphs.
            "external-link",
            "refresh-cw",
            // A13.1 — Add Guest allowed-area chips.
            "door-open",
            "car",
            "warehouse",
            // A15.3 — AI Assistant avatar/reply glyph.
            "bot",
            // A13.4 — Transfer ownership (biometric face, bidirectional
            // CTA arrow, "after" caret).
            "scan-face",
            "arrow-right-left",
            "arrow-down",
            // A13.13 — Manage train Organize row glyphs.
            "bar-chart-3",
            "calendar-cog",
            // A13.15 — Disambiguate quick actions + fallback rows.
            "user-check",
            "forward",
            "keyboard",
            "undo-2",
            // A17.9 — Party invite detail glyphs.
            "quote",
            "cloud-sun",
            "shirt",
            "x-circle",
            "bell-off",
            "minus",
            "user-minus",
            "calendar-check",
            "calendar-plus",
            // P5.2 / A14.6 Payments — inline-empty hero disc inside the Payment methods card.
            "credit-card",
            // B1.4 / A19 Legal — collapsible "Jump to section" TOC header.
            "list",
            // A17.11 Stamps — Elf rate gauge + Forever-postage validity badge.
            "gauge",
            "infinity",
            // A18.4 Waiting room — more-info halo glyph + Update-evidence action.
            "file-plus-2",
            "file-warning",
            // Place dashboard/detail/verify — Place Intelligence (W3) glyphs.
            "cloud",
            "cloud-off",
            "sunrise",
            "sunset",
            "file-search",
            "flower-2",
            "trash",
            "zap-off",
            "waves",
            "activity",
            "test-tube",
            "factory",
            "badge-percent",
            "vote",
            "life-buoy",
            "hard-hat",
            "triangle-alert",
            // Gigs Tasks map — fit-to-pins control + zero-results empty state.
            "maximize",
            "map-pin-off",
            // Magic Task wizard — voice-note describe card + One-time engagement tile.
            "mic",
            "circle-dot",
            // Calendarly scheduling — terminal/conflict/waitlist glyphs and the
            // setup/payments cluster (percent / statement-descriptor type),
            // plus the shared-primitive additions (scale / list-ordered /
            // package-open / user-x / workflow) and the Calendarly brand marks
            // (calendarly / qr-code / ticket / concentric ring).
            "calendar-x",
            "search-x",
            "pause-circle",
            "bell-plus",
            "percent",
            "type",
            "calendarly",
            "qr-code",
            "ticket",
            "scale",
            "list-ordered",
            "package-open",
            "user-x",
            "concentric",
            // H2 Workflows List empty-state hero — branching-node automation graph.
            "workflow",
            // G8 packages-list row/empty/payouts-gate icon (Lucide `layers`).
            // G10 EligibleRow tick icon (Lucide `ticket-check`).
            "layers",
            "ticket-check",
            // F15 — "Ask to manage" pill icon (shield with plus).
            "shield-plus",
            // F8 — Quiet-hours DisclosureRow icon (crescent moon).
            "moon",
            // A1 Scheduling Hub manage-row glyphs + B8 Connected calendars.
            // Design: scheduling-hub-frames.jsx / connected-calendars-frames.jsx.
            "calendar-sync",
            "layout-grid",
            "settings",
            // A1 identity switcher Business pill + A5 summary card owner glyph.
            "store",
            // F1 Home calendar filtered-empty state (no events match the filters).
            "calendar-search",
            // B1 event-type list reorder-mode hint bar (event-types-frames.jsx FRAME 6).
            "move",
            // B9 date overrides — range link + blocked-day rows (date-overrides-frames.jsx).
            "calendar-range",
            "calendar-off",
            // G2 collective setup explainer note (collective-frames.jsx EXPLAIN).
            "git-merge",
        )

    @Test
    fun inventory_matches_design_spec() {
        val actual = PantopusIcon.entries.map { it.lucideName }.toSet()
        assertEquals("PantopusIcon drifted from the Lucide inventory.", expectedLucideInventory, actual)
    }

    @Test
    fun every_icon_has_a_non_null_source() {
        for (icon in PantopusIcon.entries) {
            assertNotNull(
                "No icon source resolved for $icon",
                icon.source(),
            )
        }
    }

    @Test
    fun valueOfRaw_round_trips() {
        for (icon in PantopusIcon.entries) {
            assertEquals(icon, PantopusIcon.valueOfRaw(icon.lucideName))
        }
        assertEquals(null, PantopusIcon.valueOfRaw("definitely-not-an-icon"))
    }

    @Test
    fun no_duplicate_raw_names() {
        val raws = PantopusIcon.entries.map { it.lucideName }
        assertEquals(raws.size, raws.toSet().size)
    }
}
