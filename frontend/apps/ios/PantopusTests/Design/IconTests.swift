//
//  IconTests.swift
//  PantopusTests
//
//  Inventory + renderability checks for `PantopusIcon`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

final class IconTests: XCTestCase {
    /// Expected Lucide icon inventory, derived from the design JSX. Keep in
    /// lock-step with the enum — the test catches additions/removals.
    private let expectedInventory: [String] = [
        "home", "map", "inbox", "user", "bell", "menu", "shield-check", "x",
        "plus-circle", "camera", "scan-line", "plus-square", "sun",
        "chevron-right", "chevron-left", "megaphone", "shopping-bag", "hammer",
        "mailbox", "search", "user-plus", "file", "copy", "check",
        "more-horizontal", "arrow-left", "arrow-right", "send", "chevron-down", "chevron-up",
        "trash-2", "edit-2", "upload", "shield", "lock", "check-circle",
        "alert-circle", "circle", "info", "wifi-off", "heart", "thumbs-up", "star", "star-fill",
        "help-circle", "calendar", "calendar-check", "lightbulb", "eye", "share", "radio", "rss", "map-pin",
        "pencil", "briefcase", "gavel", "sliders-horizontal", "message-circle",
        "at-sign", "badge-check", "tag", "shield-alert", "check-check", "history",
        "receipt", "clock", "users", "dollar-sign",
        // A13.11 Professional profile — certifications, portfolio, skills, and drag handles.
        "ribbon", "palette", "play-circle", "grip-vertical", "grid-3x3", "square",
        "dog", "cat", "bird", "fish", "turtle", "paw-print",
        "sparkles", "timer", "repeat", "hourglass", "hand-coins", "package",
        // A12.10 Create Business — category tiles.
        "cpu", "truck",
        "compass", "filter",
        // T5.3.1 My bids — bid lifecycle chips + footer.
        "crown", "trending-down", "ban", "file-text",
        // A10.10 Wallet — trend indicator and withdraw CTA glyph.
        "trending-up", "arrow-down-to-line",
        // T5.3.2 My tasks — poster-side chips + footer.
        "plus", "rocket", "clipboard-list", "clock-plus", "circle-slash", "play", "pause",
        // T5.3.3 My posts — archive chip + empty-state compose icon.
        "archive", "message-square-plus",
        // T5.3.4 Listing offers — listing-context header icons.
        "bookmark",
        // T6.0a Bills — utility category iconography + banner/auto-pay markers.
        "zap", "flame", "droplet", "wifi", "building-2", "smartphone", "wallet", "hash",
        // T6.0b My tasks V2 — Magic Task archetype + task-format icons.
        "tv", "laptop", "monitor", "shuffle", "wand-sparkles", "arrow-up-right",
        // T6.4c Home calendar — event-type palette + banner illustration.
        "users-round", "gift", "party-popper", "graduation-cap", "calendar-days", "link",
        // T6.4a Access codes — reveal toggle + empty state.
        "eye-off", "key-round",
        // T6.4b Emergency info — per-category tiles, quick actions, and markers.
        "pin", "power", "phone-call", "phone", "navigation", "heart-pulse",
        "siren", "stethoscope", "cross", "flag", "user-round", "flask-conical",
        "flame-kindling", "printer", "alert-triangle",
        // T6.4b Documents — file-type tiles, category rows, and document actions.
        "image", "image-plus", "file-type", "file-spreadsheet", "file-signature", "landmark",
        "stamp", "id-card", "folder-lock", "upload-cloud", "calendar-clock", "download",
        // T6.3c Household tasks — chore-category iconography + banner glyph.
        "leaf", "list-checks", "utensils", "baby",
        // T6.3b Maintenance — task category iconography.
        "wrench", "fan", "cloud-rain", "refrigerator", "bug", "trees", "paint-roller", "bell-ring",
        // T6.5e Mailbox Vault — envelope state + folder palette + chrome.
        "mail", "mail-open", "folder-plus", "piggy-bank", "plane", "receipt-text", "paperclip", "arrow-down-up",
        // A18.1 Verify email sent — envelope-with-check halo glyph.
        "mail-check",
        // T6.6b Chat conversation refresh — header + composer.
        "video", "more-vertical", "hand", "smile", "arrow-up",
        // P1.3 Broadcast detail — sticky footer + analytics.
        "reply", "radio-tower",
        // P6.5 Public profile · Persona vs Local.
        "message-square", "globe",
        // P2.10 Document detail — sticky-footer action glyphs.
        "external-link", "refresh-cw",
        // A10.3 Today detail — weather and signal glyphs from today-frames.jsx.
        "sun-dim", "flower", "snowflake", "wind", "bus", "droplets",
        // A13.1 Add Guest — allowed-area chips.
        "door-open", "car", "warehouse",
        // A13.15 Disambiguate — quick actions + fallback rows.
        "user-check", "forward", "keyboard", "undo-2",
        // A15.3 AI Assistant — avatar/reply glyph.
        "bot",
        // A13.4 Transfer ownership — Face ID gate and ownership-diff controls.
        "scan-face", "arrow-right-left", "arrow-down",
        // A13.13 Manage train — Organize row glyphs.
        "bar-chart-3", "calendar-cog",
        // A17.9 Party — invite chrome glyphs.
        "quote", "cloud-sun", "shirt", "x-circle", "bell-off", "minus",
        "user-minus", "calendar-plus",
        // P5.2 / A14.6 Payments — inline-empty hero disc inside the Payment methods card.
        "credit-card",
        // B1.4 / A19 Legal — collapsible "Jump to section" TOC header.
        "list",
        // A17.11 Stamps — Elf rate gauge + Forever-postage validity badge.
        "gauge", "infinity",
        // A18.4 Waiting room — more-info halo glyph + Update-evidence action.
        "file-plus-2", "file-warning",
        // Place Intelligence — dashboard, detail, verify, and funnel glyphs.
        "activity", "badge-percent", "circle-dot", "cloud", "cloud-off",
        "factory", "file-search", "flower-2", "hard-hat", "layers",
        "layout-grid", "life-buoy", "locate-fixed", "map-pin-off", "maximize",
        "mic", "repeat-2", "square-pen", "sunrise", "sunset", "test-tube",
        "trash", "triangle-alert", "vote", "waves", "zap-off",
        // Calendarly (scheduling) — booking / event-type / availability /
        // payments / automations design suite glyphs.
        "store", "qr-code", "settings", "settings-2", "workflow", "moon",
        "calendar-sync", "calendar-off", "calendar-x", "calendar-check-2",
        "calendar-range", "search-x", "ticket", "ticket-check", "shield-plus",
        "user-x", "rotate-ccw", "rotate-cw", "package-open", "tent-tree",
        "share-2", "bell-plus", "percent", "scissors", "scale", "coffee",
        "bed-double", "house", "move", "ellipsis", "ellipsis-vertical",
        "circle-alert", "circle-check", "check-circle-2", "clock-alert",
        "pause-circle", "list-ordered", "loader-circle", "message-square-text",
        "layout-template", "panel-bottom", "square-mouse-pointer",
        "text-cursor-input", "hand-pointer", "wand-2",
        // Calendarly — second batch surfaced during per-screen parity sweep.
        "arrow-right-circle", "link-2-off", "calendar-search", "git-merge"
    ]

    func testInventoryMatches() {
        let actual = PantopusIcon.allCases.map(\.rawValue)
        XCTAssertEqual(
            Set(actual),
            Set(expectedInventory),
            "PantopusIcon inventory drifted from the design-spec list."
        )
        XCTAssertEqual(
            actual.count,
            expectedInventory.count,
            "PantopusIcon case count mismatch."
        )
    }

    func testInventoryHasNoDuplicates() {
        let raws = PantopusIcon.allCases.map(\.rawValue)
        XCTAssertEqual(Set(raws).count, raws.count, "PantopusIcon rawValues must be unique.")
    }

    func testEverySymbolResolvesToAValidSFSymbol() {
        // SF Symbols available on iOS 17+. If a mapping names a symbol that
        // doesn't exist, UIImage(systemName:) returns nil.
        for icon in PantopusIcon.allCases {
            XCTAssertNotNil(
                UIImage(systemName: icon.sfSymbolName),
                "No SF Symbol resolves for \(icon.rawValue) → \(icon.sfSymbolName)"
            )
        }
    }

    @MainActor
    func testEveryIconRendersWithoutCrashing() {
        for icon in PantopusIcon.allCases {
            let host = UIHostingController(rootView: Icon(icon))
            host.loadViewIfNeeded()
            XCTAssertNotNil(host.view, "Icon \(icon.rawValue) failed to build a view tree")
        }
    }
}
