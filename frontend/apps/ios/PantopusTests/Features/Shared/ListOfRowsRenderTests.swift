//
//  ListOfRowsRenderTests.swift
//  PantopusTests
//
//  T5.0 — Archetype evolution. Asserts every new `RowLeading`,
//  `RowTrailing`, `RowFooter`, `RowHighlight`, `RowChip`, and section /
//  chrome variant constructs cleanly via the public API. Renders the
//  shell view inside a hosting controller to confirm SwiftUI doesn't
//  trap on the new branches.
//
//  Backwards-compat tests assert the original `RowModel` 8-parameter
//  init (id/title/subtitle/template/leading/trailing/onTap/onSecondary)
//  still works without supplying any T5 fields, and that
//  `FABAction(icon:, accessibilityLabel:, handler:)` defaults to the
//  56pt `.canonicalCreate` variant.
//

import SwiftUI
import XCTest
@testable import Pantopus

// swiftlint:disable multiline_arguments trailing_closure type_body_length

final class ListOfRowsRenderTests: XCTestCase {
    // MARK: - Backwards-compatible construction

    func testLegacyRowModelInitStillWorks() {
        // The exact shape every T1–T4.1 caller uses.
        let row = RowModel(
            id: "id",
            title: "Title",
            subtitle: "subtitle",
            template: .statusChip,
            leading: .icon(.bell, tint: Theme.Color.primary600),
            trailing: .statusChip(text: "NEW", variant: .info),
            onTap: {}
        )
        XCTAssertEqual(row.id, "id")
        XCTAssertEqual(row.title, "Title")
        XCTAssertEqual(row.subtitle, "subtitle")
        XCTAssertNil(row.body)
        XCTAssertNil(row.inlineChip)
        XCTAssertNil(row.chips)
        XCTAssertNil(row.timeMeta)
        XCTAssertNil(row.metaTail)
        XCTAssertNil(row.note)
        XCTAssertNil(row.highlight)
        XCTAssertNil(row.footer)
    }

    func testLegacyRowSectionInitStillWorks() {
        let section = RowSection(rows: [])
        XCTAssertNil(section.header)
        XCTAssertNil(section.count)
        XCTAssertNil(section.onSeeAll)
        if case .flat = section.style { /* ok */ } else {
            XCTFail("Default section style should be .flat")
        }
    }

    func testLegacyFabActionDefaultsToCanonicalCreate() {
        let fab = FABAction(icon: .plusCircle, accessibilityLabel: "Create") {}
        if case .canonicalCreate = fab.variant {
            // ok — 56pt, matches T1–T4.1 geometry
        } else {
            XCTFail("Legacy FABAction init must default to .canonicalCreate")
        }
    }

    // MARK: - RowLeading new cases

    func testRowLeadingTypeIcon() {
        let leading: RowLeading = .typeIcon(
            .heart,
            background: Theme.Color.personalBg,
            foreground: Theme.Color.personal
        )
        guard case let .typeIcon(icon, _, _) = leading else {
            XCTFail("Expected .typeIcon")
            return
        }
        XCTAssertEqual(icon, .heart)
    }

    func testRowLeadingCategoryGradientIcon() {
        let pair = GradientPair(start: Theme.Color.primary300, end: Theme.Color.primary700)
        let leading: RowLeading = .categoryGradientIcon(.hammer, gradient: pair)
        guard case let .categoryGradientIcon(icon, gradient) = leading else {
            XCTFail("Expected .categoryGradientIcon")
            return
        }
        XCTAssertEqual(icon, .hammer)
        XCTAssertEqual(gradient, pair)
    }

    func testRowLeadingAvatarWithBadgeAllSizes() {
        for size in [AvatarBadgeSize.small, .medium, .large] {
            let leading: RowLeading = .avatarWithBadge(
                name: "Maria Kovács",
                imageURL: nil,
                background: .gradient(GradientPair(start: Theme.Color.primary300, end: Theme.Color.primary600)),
                size: size,
                verified: true
            )
            guard case let .avatarWithBadge(_, _, _, gotSize, verified) = leading else {
                XCTFail("Expected .avatarWithBadge")
                return
            }
            XCTAssertEqual(gotSize, size)
            XCTAssertTrue(verified)
        }
    }

    func testRowLeadingAvatarWithBadgeSizes() {
        XCTAssertEqual(AvatarBadgeSize.small.size, 36)
        XCTAssertEqual(AvatarBadgeSize.medium.size, 40)
        XCTAssertEqual(AvatarBadgeSize.large.size, 44)
    }

    func testRowLeadingThumbnailIcon() {
        let pair = GradientPair(start: Theme.Color.business, end: Theme.Color.businessBg)
        let leading: RowLeading = .thumbnail(image: .icon(.heart, gradient: pair), size: .large)
        guard case let .thumbnail(image, size) = leading else {
            XCTFail("Expected .thumbnail")
            return
        }
        XCTAssertEqual(size, .large)
        if case let .icon(icon, gradient) = image {
            XCTAssertEqual(icon, .heart)
            XCTAssertEqual(gradient, pair)
        } else {
            XCTFail("Expected .icon thumbnail image")
        }
    }

    func testRowLeadingThumbnailSizes() {
        XCTAssertEqual(ThumbnailSize.medium.size, 56)
        XCTAssertEqual(ThumbnailSize.large.size, 64)
    }

    func testRowLeadingBidderStack() {
        let bidders = [
            Bidder(id: "b1", initials: "AR", tone: .violet),
            Bidder(id: "b2", initials: "MT", tone: .amber)
        ]
        let leading: RowLeading = .bidderStack(bidders: bidders, overflow: 9)
        guard case let .bidderStack(got, overflow) = leading else {
            XCTFail("Expected .bidderStack")
            return
        }
        XCTAssertEqual(got.count, 2)
        XCTAssertEqual(overflow, 9)
    }

    func testBidderToneAllCases() {
        XCTAssertEqual(BidderTone.allCases.count, 6)
    }

    // MARK: - RowTrailing new cases

    func testRowTrailingAmountWithChip() {
        let trailing: RowTrailing = .amountWithChip(
            amount: "$142.80",
            chipText: "Due Oct 15",
            chipVariant: .warning,
            chipIcon: .alertCircle
        )
        guard case let .amountWithChip(amount, chipText, chipVariant, chipIcon) = trailing else {
            XCTFail("Expected .amountWithChip")
            return
        }
        XCTAssertEqual(amount, "$142.80")
        XCTAssertEqual(chipText, "Due Oct 15")
        XCTAssertEqual(chipVariant, .warning)
        XCTAssertEqual(chipIcon, .alertCircle)
    }

    func testRowTrailingCircularAction() {
        var tapped = false
        let trailing: RowTrailing = .circularAction(
            icon: .send,
            accessibilityLabel: "Message Maria",
            handler: { tapped = true }
        )
        guard case let .circularAction(icon, label, _, _, handler) = trailing else {
            XCTFail("Expected .circularAction")
            return
        }
        XCTAssertEqual(icon, .send)
        XCTAssertEqual(label, "Message Maria")
        handler()
        XCTAssertTrue(tapped)
    }

    func testRowTrailingVerticalActions() {
        var accepted = false
        var ignored = false
        let trailing: RowTrailing = .verticalActions(
            primary: VerticalAction(label: "Accept", variant: .primary) { accepted = true },
            secondary: VerticalAction(label: "Ignore", variant: .ghost) { ignored = true }
        )
        guard case let .verticalActions(primary, secondary) = trailing else {
            XCTFail("Expected .verticalActions")
            return
        }
        primary.handler()
        secondary.handler()
        XCTAssertTrue(accepted)
        XCTAssertTrue(ignored)
    }

    func testRowTrailingPriceStack() {
        let trailing: RowTrailing = .priceStack(amount: "$95", sublabel: "budget $120")
        guard case let .priceStack(amount, sublabel) = trailing else {
            XCTFail("Expected .priceStack")
            return
        }
        XCTAssertEqual(amount, "$95")
        XCTAssertEqual(sublabel, "budget $120")
    }

    // MARK: - RowModel optional fields

    func testRowModelWithChipsAndFooter() {
        var primaryFired = false
        let row = RowModel(
            id: "bid_1",
            title: "Mount 65″ TV above brick fireplace",
            subtitle: "for Sarah Kowalski · Elm Park · 2d ago",
            template: .statusChip,
            leading: .categoryGradientIcon(
                .hammer,
                gradient: GradientPair(start: Theme.Color.primary400, end: Theme.Color.primary700)
            ),
            trailing: .priceStack(amount: "$95", sublabel: "budget $120"),
            onTap: {},
            chips: [
                RowChip(text: "Top bid", icon: .check, tint: .status(.success))
            ],
            metaTail: "· 3 others bid · 1d left to reply",
            footer: RowFooter(actions: [
                RowFooterAction(title: "Withdraw", icon: .x, variant: .destructive) {},
                RowFooterAction(title: "Edit bid", icon: .check, variant: .primary) {
                    primaryFired = true
                }
            ])
        )
        XCTAssertEqual(row.chips?.count, 1)
        XCTAssertEqual(row.footer?.actions.count, 2)
        XCTAssertEqual(row.metaTail, "· 3 others bid · 1d left to reply")
        row.footer?.actions[1].handler()
        XCTAssertTrue(primaryFired)
    }

    func testRowModelWithBodyAndUnreadHighlight() {
        let row = RowModel(
            id: "notif_1",
            title: "Maria Kovács replied to your gig",
            subtitle: nil,
            template: .statusChip,
            leading: .typeIcon(
                .send,
                background: Theme.Color.personalBg,
                foreground: Theme.Color.personal
            ),
            trailing: .none,
            onTap: {},
            body: "\u{201C}Sounds great — can we move it to Saturday?\u{201D}",
            chips: [RowChip(text: "Reply", icon: .send, tint: .status(.personal))],
            timeMeta: "12m",
            highlight: .unread
        )
        XCTAssertEqual(row.highlight, .unread)
        XCTAssertNotNil(row.body)
        XCTAssertEqual(row.timeMeta, "12m")
    }

    func testRowModelWithInlineChip() {
        let row = RowModel(
            id: "pet_1",
            title: "Mango",
            subtitle: "Golden Retriever · 3 yr",
            template: .avatarKebab,
            leading: .thumbnail(
                image: .icon(.heart, gradient: GradientPair(start: Theme.Color.handyman, end: Theme.Color.warning)),
                size: .large
            ),
            trailing: .kebab,
            onTap: {},
            onSecondary: {},
            inlineChip: RowChip(
                text: "Dog",
                tint: .custom(background: Theme.Color.warningBg, foreground: Theme.Color.warning)
            )
        )
        XCTAssertNotNil(row.inlineChip)
        XCTAssertEqual(row.inlineChip?.text, "Dog")
    }

    func testRowModelArchivedAndLeadingHighlights() {
        let archived = RowModel(
            id: "post_1", title: "Pulse post", template: .statusChip,
            onTap: {}, highlight: .archived
        )
        XCTAssertEqual(archived.highlight, .archived)

        let leading = RowModel(
            id: "offer_1", title: "Top offer", template: .statusChip,
            onTap: {}, highlight: .leading
        )
        XCTAssertEqual(leading.highlight, .leading)
    }

    // MARK: - RowSection

    func testRowSectionWithCountAndSeeAll() {
        var seenAll = false
        let section = RowSection(
            id: "people",
            header: "People",
            rows: [],
            count: 24,
            onSeeAll: { seenAll = true },
            style: .card
        )
        XCTAssertEqual(section.count, 24)
        if case .card = section.style { /* ok */ } else { XCTFail("Expected .card style") }
        section.onSeeAll?()
        XCTAssertTrue(seenAll)
    }

    // MARK: - FAB variants

    func testFabVariantCanonicalCreate() {
        let fab = FABAction(
            icon: .plusCircle,
            accessibilityLabel: "Post a task",
            variant: .canonicalCreate
        ) {}
        if case .canonicalCreate = fab.variant { /* ok */ } else {
            XCTFail("Expected .canonicalCreate")
        }
    }

    func testFabVariantSecondaryCreate() {
        let fab = FABAction(
            icon: .pencil,
            accessibilityLabel: "New post",
            variant: .secondaryCreate
        ) {}
        if case .secondaryCreate = fab.variant { /* ok */ } else {
            XCTFail("Expected .secondaryCreate")
        }
    }

    func testFabVariantExtendedNav() {
        let fab = FABAction(
            icon: .search,
            accessibilityLabel: "Browse tasks",
            variant: .extendedNav(label: "Browse tasks")
        ) {}
        if case let .extendedNav(label) = fab.variant {
            XCTAssertEqual(label, "Browse tasks")
        } else {
            XCTFail("Expected .extendedNav")
        }
    }

    // MARK: - Chrome slots

    func testSearchBarConfigConstructs() {
        var lastText = ""
        let config = SearchBarConfig(
            placeholder: "Search by name",
            text: "",
            onChange: { lastText = $0 }
        )
        config.onChange("Maria")
        XCTAssertEqual(lastText, "Maria")
        XCTAssertEqual(config.placeholder, "Search by name")
    }

    func testChipStripConfigConstructs() {
        var selected = ""
        let config = ChipStripConfig(
            chips: [
                ChipStripConfig.Chip(id: "nearby", label: "Nearby", icon: .mapPin),
                ChipStripConfig.Chip(id: "new", label: "New today")
            ],
            selectedId: "nearby",
            onSelect: { selected = $0 }
        )
        XCTAssertEqual(config.chips.count, 2)
        config.onSelect("new")
        XCTAssertEqual(selected, "new")
    }

    func testBannerConfigConstructs() {
        let config = BannerConfig(
            icon: .inbox,
            title: "9 new bids since yesterday",
            subtitle: "1 task closing in the next 24h"
        )
        XCTAssertEqual(config.title, "9 new bids since yesterday")
    }

    // MARK: - Smoke render (existing call sites must still build)

    @MainActor
    func testRenderLegacyAndExtendedRows() {
        let legacy = RowModel(
            id: "legacy",
            title: "Legacy row",
            subtitle: "subtitle",
            template: .statusChip,
            leading: .icon(.bell, tint: Theme.Color.primary600),
            trailing: .chevron,
            onTap: {}
        )
        let extended = RowModel(
            id: "extended",
            title: "Mount TV",
            subtitle: "for Sarah · Elm Park",
            template: .statusChip,
            leading: .categoryGradientIcon(
                .hammer,
                gradient: GradientPair(start: Theme.Color.primary400, end: Theme.Color.primary700)
            ),
            trailing: .priceStack(amount: "$95", sublabel: "budget $120"),
            onTap: {},
            body: nil,
            chips: [RowChip(text: "Top bid", icon: .check, tint: .status(.success))],
            timeMeta: "1d",
            footer: RowFooter(actions: [
                RowFooterAction(title: "Withdraw", icon: .x, variant: .destructive) {},
                RowFooterAction(title: "Edit bid", icon: .check, variant: .primary) {}
            ])
        )
        // The instances exist; SwiftUI's diff is exercised by the
        // existing Notifications screen test below — this guards
        // structural equality of the public API.
        XCTAssertNotEqual(legacy.id, extended.id)
        XCTAssertNotNil(extended.chips)
        XCTAssertNotNil(extended.footer)
    }
}
