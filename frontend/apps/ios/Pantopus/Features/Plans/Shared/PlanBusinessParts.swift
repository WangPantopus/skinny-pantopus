//
//  PlanBusinessParts.swift
//  Pantopus
//
//  Plans with businesses, board P1 "The business marks": the only parts a
//  business's plan adds to Plans. The business shape (a rounded square where
//  a person is a circle), the business badge (a solid violet square with a
//  ring, on a kind tile and a pin), "Verified business" (the shield of
//  "Verified address" in the business color), the price chip ("Free" in step
//  2) and the label chip (what the business calls its plan, in the kind's
//  colors). Board P3's filter and fold live here too.
//
//  Words, test ids and spoken labels match Android's (the founder agreed one
//  set, November 12). Everything here shows only when the server sends a
//  business's plan.
//

import SwiftUI

// MARK: - P1 parts

/// The business badge: a solid violet square with a ring and the store
/// glyph. The playdate tile is violet too; the two stay apart by shape (the
/// kind is a soft tile, the badge a solid square with a ring).
struct PlanBusinessBadge: View {
    var size: CGFloat = 16

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(Theme.Color.businessSolid)
            .frame(width: size, height: size)
            .overlay(Icon(.store, size: size * 0.62, strokeWidth: 2.4, color: Theme.Color.appTextInverse))
            .padding(2)
            .background(RoundedRectangle(cornerRadius: size * 0.28 + 2, style: .continuous).fill(Theme.Color.appSurface))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("a business")
            .accessibilityIdentifier("planBusinessBadge")
    }
}

/// The kind tile of a row, with the business badge on its corner for a business's plan.
struct PlanKindTile: View {
    let kind: PlanKind
    var isBusiness = false
    var size: CGFloat = 44

    var body: some View {
        PlanTile(kind: kind, size: size, glyph: size / 2)
            .overlay(alignment: .bottomTrailing) {
                if isBusiness {
                    PlanBusinessBadge(size: size * 0.36).offset(x: 5, y: 5)
                }
            }
    }
}

/// The business shape: its picture, or the store glyph in the business color,
/// in a rounded square. Decorative: the name beside it is read.
struct PlanBusinessShape: View {
    var url: String?
    var size: CGFloat = 40

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        ZStack {
            shape.fill(Theme.Color.businessBg)
            Icon(.store, size: size * 0.5, color: Theme.Color.business)
            if let url, let link = URL(string: url) {
                CachedAsyncImage(url: link) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .clipShape(shape)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .accessibilityIdentifier("planBusinessShape")
    }
}

/// "Verified business": the shield of "Verified address", in the business color.
struct PlanVerifiedBusinessLabel: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 14, color: Theme.Color.business)
            Text("Verified business")
                .planFont(.label)
                .foregroundStyle(Theme.Color.business)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("planVerifiedBusiness")
    }
}

/// The price chip. In step 2 every business's plan is free: "Free" in plain
/// weight (a price, from step 3, is bold).
struct PlanPriceChip: View {
    var body: some View {
        Text("Free")
            .planFont(.footnote)
            .foregroundStyle(Theme.Color.appTextStrong)
            .padding(.horizontal, 10)
            .frame(minHeight: 26)
            .background(Capsule().fill(Theme.Color.appSurfaceSunken))
            .accessibilityLabel("Free")
            .accessibilityIdentifier("planPriceChip")
    }
}

/// What the business calls its plan ("Clinic"), on the kind's tint with its
/// swatch, where a neighbor's plan shows its kind ("Pickup game").
struct PlanBusinessLabelTag: View {
    let kind: PlanKind
    let text: String

    var body: some View {
        HStack(spacing: 7) {
            PlanSwatch(kind: kind)
            Text(text)
                .planFont(.label)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.leading, Spacing.s1)
        .padding(.trailing, Spacing.s3)
        .frame(minHeight: 30)
        .background(Capsule().fill(kind.tint))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityIdentifier("planBusinessLabel")
    }
}

/// The "Hosted by" card's row: the business shape, its name, "Verified
/// business", and how many plans it has hosted. The proof line ("118 came ·
/// 9 in 10 said it went well") is step 3.
struct PlanBusinessHostRow: View {
    let business: PlanBusinessDTO
    var showsChevron = false

    var body: some View {
        HStack(spacing: Spacing.s3) {
            PlanBusinessShape(url: business.avatarUrl, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(business.name)
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if business.verified { PlanVerifiedBusinessLabel() }
                Text(Self.facts(business))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsChevron {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Self.spoken(business))
    }

    /// "Hosted 14 plans", or "New to hosting".
    static func facts(_ business: PlanBusinessDTO) -> String {
        let hosted = business.plansHosted
        return hosted > 0 ? "Hosted \(hosted) plan\(hosted == 1 ? "" : "s")" : "New to hosting"
    }

    /// "Hosted by Lacamas Pickleball Club. Verified business. Hosted 14 plans."
    static func spoken(_ business: PlanBusinessDTO) -> String {
        var parts = ["Hosted by \(business.name)"]
        if business.verified { parts.append("Verified business") }
        parts.append(facts(business))
        return parts.joined(separator: ". ") + "."
    }
}

// MARK: - P3: the filter

/// All · Neighbors · Businesses, under the list's title once a business has
/// a plan in the area (`has_business_plans`). It filters the pins too, and
/// the app remembers the choice.
enum PlansHostFilter: String, CaseIterable, Hashable {
    case all, neighbors, businesses

    var title: String {
        switch self {
        case .all: "All"
        case .neighbors: "Neighbors"
        case .businesses: "Businesses"
        }
    }

    var testId: String {
        switch self {
        case .all: "plansHostFilterAll"
        case .neighbors: "plansHostFilterNeighbors"
        case .businesses: "plansHostFilterBusinesses"
        }
    }

    /// Whether a plan hosted by a business (or not) passes.
    func admits(isBusiness: Bool) -> Bool {
        switch self {
        case .all: true
        case .neighbors: !isBusiness
        case .businesses: isBusiness
        }
    }
}

struct PlansHostFilterBar: View {
    let selection: PlansHostFilter
    let onSelect: (PlansHostFilter) -> Void

    var body: some View {
        PlanSegmented(
            options: PlansHostFilter.allCases.map { ($0, $0.title) },
            selection: Binding(get: { selection }, set: { onSelect($0) }),
            label: "Who's hosting",
            identifiers: PlansHostFilter.allCases.map(\.testId)
        )
        .accessibilityIdentifier("plansHostFilter")
    }
}

// MARK: - P3: the fold

/// A venue's later plans, under its soonest row: "3 more times this week at
/// this place". Opened, each is a short line that opens its plan, then "Show less".
struct PlanFoldView: View {
    let planId: String
    let moreTimes: PlanMoreTimesDTO
    let window: PlansWindow
    let isOpen: Bool
    let onToggle: () -> Void
    let onOpen: (PlanMoreTimeDTO) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isOpen {
                ForEach(moreTimes.items) { item in
                    line(item)
                }
            }
            Button(action: onToggle) {
                HStack(spacing: 6) {
                    Icon(isOpen ? .chevronUp : .chevronDown, size: 14, strokeWidth: 2.4, color: Theme.Color.primaryInk)
                    Text(isOpen ? "Show less" : Self.closedText(count: moreTimes.count, window: window))
                        .planFont(.smallStrong)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(minHeight: 36, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.leading, 44 + Spacing.s3)
            .accessibilityIdentifier("planFold.\(planId)")
        }
    }

    private func line(_ item: PlanMoreTimeDTO) -> some View {
        Button { onOpen(item) } label: {
            VStack(spacing: 0) {
                Divider().overlay(Theme.Color.appBorder)
                HStack(spacing: Spacing.s3) {
                    (Text(item.labelText ?? item.title).fontWeight(.semibold) + Text(when(item).map { " · \($0)" } ?? ""))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    PlanPriceChip()
                }
                .frame(minHeight: 44)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, 44 + Spacing.s3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([item.labelText ?? item.title, when(item), "Free"].compactMap { $0 }.joined(separator: ", "))
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("planFoldItem.\(item.id)")
    }

    /// "Sun 2:00 PM", "Tomorrow 9:00 AM".
    private func when(_ item: PlanMoreTimeDTO) -> String? {
        PlanFormat.rowWhen(
            state: .upcoming,
            start: item.startsAtDate,
            end: nil,
            calendar: PlanFormat.calendar(for: item.timezone)
        )
    }

    /// "3 more times this week at this place", "1 more time today at this place".
    static func closedText(count: Int, window: PlansWindow) -> String {
        let span = switch window {
        case .now, .today: "today"
        case .week: "this week"
        case .weekend: "this weekend"
        }
        return "\(count) more time\(count == 1 ? "" : "s") \(span) at this place"
    }
}

// MARK: - Names in sentences

extension PlanCardLines {
    /// How a sentence names the host: a neighbor by first name ("Sam"), a
    /// business by its whole name ("Lacamas Pickleball Club"), never its first word.
    static func hostName(_ card: PlanCardDTO) -> String {
        card.business != nil ? card.host.displayName : firstName(card.host.displayName)
    }
}

// MARK: - The tag over a title

/// The tag over a plan's title: what a business calls its plan ("Clinic")
/// with "Free" beside it, or the kind ("Pickup game") for a neighbor's.
struct PlanCardTag: View {
    let card: PlanCardDTO

    var body: some View {
        if card.isBusiness {
            HStack(spacing: Spacing.s2) {
                if let text = card.labelText, !text.isEmpty {
                    PlanBusinessLabelTag(kind: card.kind, text: text)
                } else {
                    PlanTypeTag(kind: card.kind)
                }
                PlanPriceChip()
            }
        } else {
            PlanTypeTag(kind: card.kind)
        }
    }
}

/// The host card on a plan before you're in: a neighbor (their profile), or
/// "Hosted by" the business (its page, board G3).
struct PlanHostCard: View {
    let card: PlanCardDTO
    let onOpenHost: (String) -> Void

    var body: some View {
        if let business = card.business {
            Button {
                DeepLinkRouter.shared.handle(path: "/business/\(business.userId)")
            } label: {
                PlanCardBox(padding: 14) {
                    PlanBusinessHostRow(business: business, showsChevron: true)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the business's page")
            .accessibilityIdentifier("planBusinessHost")
        } else {
            Button {
                if let id = card.host.userId { onOpenHost(id) }
            } label: {
                PlanCardBox(padding: 14) {
                    PlanHostRow(host: card.host, kind: card.kind, showsChevron: card.host.userId != nil)
                }
            }
            .buttonStyle(.plain)
            .disabled(card.host.userId == nil)
            .accessibilityHint("Opens their profile")
        }
    }
}

extension PlanCardLines {
    /// What a business's place reads as: its name, or the business's own.
    static func businessPlaceName(_ card: PlanCardDTO) -> String {
        card.businessPlace?.name ?? card.host.displayName
    }

    /// A business's plan: "Lacamas Pickleball Club · about 1 mi" (board G3).
    static func businessWhere(_ card: PlanCardDTO) -> String {
        [businessPlaceName(card), PlanFormat.distance(card.distanceBand)].compactMap { $0 }.joined(separator: " · ")
    }
}

// MARK: - The filter's empty state, and the address over the map

/// Businesses chosen and none have a plan here: "No businesses have plans
/// here this week." with "Show all plans" (the design's states table).
struct PlansBusinessesEmpty: View {
    let window: PlansWindow
    let onShowAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("No businesses have plans here \(Self.span(window)).")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Show all plans", action: onShowAll)
                .planButton(.secondary, size: .small)
                .fixedSize()
                .accessibilityIdentifier("plansHostFilterShowAll")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansHostFilterEmpty")
    }

    static func span(_ window: PlansWindow) -> String {
        switch window {
        case .now: "right now"
        case .today: "today"
        case .week: "this week"
        case .weekend: "this weekend"
        }
    }
}

/// A business's street address on a glass pill over the plan's map (board
/// G3), where a neighbor's plan says "Exact place shared when you're in".
struct PlanPlaceAddressChip: View {
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Icon(.mapPin, size: 14, color: Theme.Color.appTextStrong)
            Text(text)
                .planFont(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(Capsule().fill(.regularMaterial))
        .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("planBusinessAddress")
    }
}

/// The pill over a plan's map: a business's street address (its place is
/// public, board G3), or, before you're in a neighbor's plan, "Exact place
/// shared when you're in" (J1/J2; J5/J6 carry no chip).
struct PlanHeaderChip: View {
    let card: PlanCardDTO
    let place: PlanPlaceDTO?
    let mode: PlanScreenMode

    var body: some View {
        if card.isBusiness, mode != .closed, let address = card.businessPlace?.address ?? place?.address, !address.isEmpty {
            PlanPlaceAddressChip(text: address)
        } else if place == nil, mode == .browsing {
            PlanScopeChip(text: card.kind == .playdate
                ? "Exact place and time shared when you're in"
                : "Exact place shared when you're in")
        }
    }
}
