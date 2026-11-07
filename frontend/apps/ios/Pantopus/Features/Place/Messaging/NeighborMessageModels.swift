//
//  NeighborMessageModels.swift
//  Pantopus
//
//  Small value types shared by the neighbor-messaging screens (W2.6) plus
//  the template-icon map. The trust-and-safety model lives in the contract
//  (`NeighborMessageDTOs`): template-only, anonymous both ways, blockable.
//

import SwiftUI

/// An address on your block — never a name. Nil until one is chosen on the
/// composer's Choose a home card.
public struct ComposeRecipient: Hashable, Sendable {
    /// Display address, e.g. "1425 SE Oak St".
    public let address: String
    public let city: String?
    public let state: String?
    public let zipcode: String?

    public init(address: String, city: String?, state: String?, zipcode: String?) {
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
    }

    /// Caption under the address, e.g. "Camas, WA".
    public var relativeLabel: String {
        [city, state].compactMap { $0 }.joined(separator: ", ")
    }
}

/// The recipient-side manage toggles. Each is one-way and never notifies
/// the sender.
struct NeighborManageFlags: Equatable {
    var notHelpful = false
    var blocked = false
    var reported = false
}

/// Map the server's lucide icon name to a Pantopus glyph. The catalog is
/// server-driven, so unknown names degrade to a neutral note glyph and the
/// UI never breaks on a new template. (`volume-2`/`door-open` have no exact
/// Pantopus glyph — substituted with the nearest in-set match.)
func neighborTemplateIcon(_ name: String) -> PantopusIcon {
    switch name {
    case "volume-2": .bell
    case "package": .package
    case "car": .car
    case "dog": .dog
    case "door-open": .doorOpen
    default: .messageSquare
    }
}

/// Coarse "x ago" label for a message timestamp. Mirrors the web
/// `relativeTime` — minute/hour/day granularity, falls back to "just now"
/// for unparseable or future stamps. Parses ISO-8601 with an offset.
func neighborRelativeTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let then = formatter.date(from: iso)
        ?? ISO8601DateFormatter().date(from: iso)
    guard let then else { return "just now" }
    let mins = max(0, Int((Date().timeIntervalSince(then) / 60).rounded()))
    if mins < 1 { return "just now" }
    if mins < 60 { return "\(mins)m ago" }
    let hrs = Int((Double(mins) / 60).rounded())
    if hrs < 24 { return "\(hrs)h ago" }
    let days = Int((Double(hrs) / 24).rounded())
    return "\(days)d ago"
}

/// A tappable Place-dashboard entry row (icon tile · title/subtitle ·
/// chevron) — the verified-neighbor messaging affordances.
struct PlaceMessagesActionRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            PlaceActionRowLabel(icon: icon, title: title, subtitle: subtitle)
                .placeCard()
        }
        .buttonStyle(.plain)
    }
}

/// The inside of a Place entry row: icon tile · title/subtitle · chevron.
struct PlaceActionRowLabel: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            PlaceIconTile(icon: icon, tone: .home, size: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                // Two lines: on a phone-width row one line cut "Send a private
                // heads-up to a home on your block." off at "on y…".
                Text(subtitle)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            PlaceChevron()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

/// A left-aligned wrapping row layout — the quick-reply chips flow onto new
/// lines as they fill the width.
struct PlaceFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// A calm inline error banner (error-tinted) for an in-place failure that
/// doesn't warrant a full-screen `ErrorState` — e.g. a failed send/reply.
struct NeighborErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.error)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Theme.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
            )
    }
}

// MARK: - Choosing an address on your block

struct ChooseNeighborCard: View {
    @Bindable var viewModel: NeighborMessageComposeViewModel
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose a home")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(
                "Enter the house number and street of any home on your block. If a verified household "
                    + "lives there, they'll get your note. We won't tell you either way."
            )
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.appTextMuted)
            .fixedSize(horizontal: false, vertical: true)
            TextField("House number and street", text: $viewModel.recipientQuery)
                .textContentType(.fullStreetAddress)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($searchFocused)
                .onSubmit(useTypedAddress)
                .padding(12)
                .typesInFieldOnTap($searchFocused)
                .background(Theme.Color.appBg)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .accessibilityIdentifier("neighbor.recipientQuery")
                .onChange(of: viewModel.recipientQuery) { _, text in viewModel.addressSuggestions.textChanged(text) }
            AddressSuggestionList(
                suggestions: viewModel.addressSuggestions,
                identifier: "neighbor.addressSuggestion"
            ) { suggestion in
                searchFocused = false
                Task { await viewModel.chooseSuggestion(suggestion) }
            }
            Button(viewModel.addressCheckState == .checking ? "Checking…" : "Use this address", action: useTypedAddress)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .disabled(!viewModel.canUseTypedAddress)
                .accessibilityIdentifier("neighbor.useAddress")
            if case let .refused(message) = viewModel.addressCheckState {
                NeighborErrorBanner(message: message)
            }
        }
        .padding(16)
        .placeCard()
    }

    private func useTypedAddress() {
        searchFocused = false
        Task { await viewModel.useTypedAddress() }
    }
}
