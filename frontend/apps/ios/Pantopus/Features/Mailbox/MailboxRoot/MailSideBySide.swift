//
//  MailSideBySide.swift
//  Pantopus
//
//  Mail on the open iPhone Duo held sideways (founder, 2026-11-04, "Build
//  both as drawn": canvas "Mail on the open iPhone Duo"). The Mailbox fills
//  the left half and the piece you open fills the right half, the two
//  meeting at the hinge, so nothing sits on the fold when the Duo is held
//  like a book. The right half waits until a piece is picked: nothing opens
//  by itself, so nothing is marked read until it's tapped. Both halves show
//  the Mail tab's one route stack (`HubTabRoot`), its first screen on the
//  right (a search takes the Mailbox's place instead), so folding, unfolding
//  and turning keep what is open; the screens' models are kept across the
//  switch (`MailScreenModels`). Closed, upright, half folded upright, at the
//  largest text sizes and on phones, Mail is one column, as before.
//

import SwiftUI

/// Where the Mail tab's two halves meet: at the Duo's hinge, while it runs down the tab with a phone's column on each
/// side of it. Nil keeps one column.
struct MailSideBySideLayout: Equatable {
    /// The narrowest column each side of the hinge holds: about a small phone's.
    static let minimumSide: CGFloat = 360

    /// The left half's width, from the tab's leading edge to the middle of the hinge.
    let leadingWidth: CGFloat
    /// Half the hinge's width: each half keeps this clear beside it, so nothing sits on the fold.
    let hingeMargin: CGFloat

    init?(proxy: GeometryProxy, isRegular: Bool, isAccessibilitySize: Bool) {
        // Like Messages: the largest text sizes keep the one roomy column.
        guard isRegular, !isAccessibilitySize, let hinge = Self.verticalHinge(proxy) else { return nil }
        guard hinge.minX >= Self.minimumSide, proxy.size.width - hinge.maxX >= Self.minimumSide else { return nil }
        leadingWidth = hinge.midX
        hingeMargin = hinge.width / 2
    }

    /// The left half's column, fixed: the split view would otherwise narrow a column it laid out before a turn.
    var columnWidth: SideBySideColumnWidth {
        SideBySideColumnWidth(min: leadingWidth, ideal: leadingWidth, max: leadingWidth)
    }

    /// The Duo's hinge where it runs down the view (held sideways), in the view's coordinates. Lying flat it is an
    /// inactive division region, so inactive ones count.
    private static func verticalHinge(_ proxy: GeometryProxy) -> CGRect? {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            return proxy.reservedRegions(kind: .division, options: .includeInactive)
                .first { $0.frame.height > $0.frame.width }?
                .frame
        }
        #endif
        return nil
    }
}

private struct OpenMailPieceIdKey: EnvironmentKey {
    static var defaultValue: String? {
        nil
    }
}

private struct MailPieceShowsBackKey: EnvironmentKey {
    static var defaultValue: Bool {
        true
    }
}

private struct MailBookletLayOpenKey: EnvironmentKey {
    static var defaultValue: MailBookletLayOpen? {
        nil
    }
}

private struct MailPieceBackKey: EnvironmentKey {
    static var defaultValue: MailPieceBack? {
        nil
    }
}

extension EnvironmentValues {
    /// The piece open beside the Mailbox, outlined in its list; nil while the Mailbox stands alone.
    var openMailPieceId: String? {
        get { self[OpenMailPieceIdKey.self] }
        set { self[OpenMailPieceIdKey.self] = newValue }
    }

    /// Whether a piece's page shows Back. Not where it's the page beside the Mailbox: the list is the way back.
    var mailPieceShowsBack: Bool {
        get { self[MailPieceShowsBackKey.self] }
        set { self[MailPieceShowsBackKey.self] = newValue }
    }

    /// Lays the booklet beside the Mailbox open as two pages, the Mailbox stepping aside; nil anywhere else.
    var mailBookletLayOpen: MailBookletLayOpen? {
        get { self[MailBookletLayOpenKey.self] }
        set { self[MailBookletLayOpenKey.self] = newValue }
    }

    /// What a piece's Back does instead of closing it: a laid-open booklet's puts the Mailbox back beside it.
    var mailPieceBack: MailPieceBack? {
        get { self[MailPieceBackKey.self] }
        set { self[MailPieceBackKey.self] = newValue }
    }
}

/// The booklet's "Lay it open as two pages", from the Mail tab that knows the halves.
struct MailBookletLayOpen {
    let layOpen: @MainActor @Sendable () -> Void
}

/// A piece's Back where it doesn't close the piece.
struct MailPieceBack {
    let back: @MainActor @Sendable () -> Void
}

extension MailTopBarConfig {
    /// Without Back where the piece is the page beside the Mailbox (`mailPieceShowsBack`).
    func showingBack(_ showsBack: Bool) -> MailTopBarConfig {
        guard !showsBack else { return self }
        return MailTopBarConfig(
            eyebrow: eyebrow,
            trust: trust,
            onBack: nil,
            trailingAction: trailingAction,
            overflowItems: overflowItems
        )
    }
}

extension View {
    /// Outlines a piece while it's open beside the Mailbox. Drawn around the piece itself, not the line under it.
    func mailOpenOutline(id: String) -> some View {
        modifier(MailOpenOutline(id: id))
    }

    /// Tells VoiceOver a piece's row is the one open beside the Mailbox. On the row's own accessibility element.
    func mailOpenSelection(id: String) -> some View {
        modifier(MailOpenSelection(id: id))
    }
}

private struct MailOpenOutline: ViewModifier {
    @Environment(\.openMailPieceId) private var openId
    let id: String

    func body(content: Content) -> some View {
        content.overlay {
            if openId == id {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.primary600, lineWidth: 2.5)
                    .padding(-3)
                    .background {
                        RoundedRectangle(cornerRadius: Radii.md + 4, style: .continuous)
                            .strokeBorder(Theme.Color.primary600.opacity(0.14), lineWidth: 4)
                            .padding(-7)
                    }
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }
}

private struct MailOpenSelection: ViewModifier {
    @Environment(\.openMailPieceId) private var openId
    let id: String

    func body(content: Content) -> some View {
        content.accessibilityAddTraits(openId == id ? .isSelected : [])
    }
}

/// Each layout of the Mail tab (one column, two halves) draws its own Mailbox: a new one opens at the piece open
/// beside it, or where the last one was scrolled to. Only the open Duo changes layouts, and it runs iOS 27.
struct MailboxPlaceKeeper: ViewModifier {
    let model: MailboxRootViewModel
    let openPieceId: String?
    let proxy: ScrollViewProxy

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.modifier(MailboxScrollPlace(model: model, openPieceId: openPieceId, proxy: proxy))
        } else {
            content
        }
    }
}

@available(iOS 18.0, *)
private struct MailboxScrollPlace: ViewModifier {
    let model: MailboxRootViewModel
    let openPieceId: String?
    let proxy: ScrollViewProxy

    func body(content: Content) -> some View {
        content.modifier(KeptScrollOffset(
            offset: model.keptScrollOffset,
            onChange: { model.keptScrollOffset = $0 },
            place: {
                guard let openPieceId else { return false }
                proxy.scrollTo(openPieceId, anchor: .center)
                return true
            }
        ))
    }
}

/// A piece's page draws again when the Mail tab's layout changes (folding, turning the open Duo): it opens where the
/// last one was scrolled to. Its only scroll view is the page's own.
struct MailPageScrollPlace: ViewModifier {
    let offset: CGFloat
    let onChange: (CGFloat) -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.modifier(KeptScrollOffset(offset: offset, onChange: onChange))
        } else {
            content
        }
    }
}

/// Keeps the scroll offset of the scroll view within, outside it, and scrolls a new one there (or wherever `place`
/// puts it).
@available(iOS 18.0, *)
private struct KeptScrollOffset: ViewModifier {
    let offset: CGFloat
    let onChange: (CGFloat) -> Void
    var place: () -> Bool = { false }
    @State private var position = ScrollPosition(edge: .top)
    @State private var placed = false

    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top
            } action: { _, offset in
                if placed { onChange(offset) }
            }
            .task {
                guard !placed else { return }
                if !place(), offset > 0 { position.scrollTo(y: offset) }
                placed = true
            }
    }
}

/// The right half before a piece is picked. It never opens one by itself: opening a piece marks it read. With no
/// mail yet, the Mailbox beside it says so.
struct MailPiecePlaceholder: View {
    let mailbox: MailboxRootViewModel

    var body: some View {
        VStack(spacing: 14) {
            Icon(.mail, size: 30, strokeWidth: 1.8, color: Theme.Color.primaryInk)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            if let title {
                Text(title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
            }
            Text(line)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailPiecePlaceholder")
    }

    /// No mail at all yet: nothing on the left to pick.
    private var isEmpty: Bool {
        guard !mailbox.showsSent, mailbox.currentTab == .incoming, case .empty = mailbox.state else { return false }
        return true
    }

    private var title: String? {
        if isEmpty { return nil }
        return mailbox.showsSent ? "Pick something you sent" : "Pick a piece of mail"
    }

    private var line: String {
        if isEmpty { return "When mail comes, it opens here." }
        return mailbox.showsSent ? "Choose one on the left to see it here." : "Choose one on the left to open it here."
    }
}

/// The Mail tab's two halves: the Mailbox (or mail search, in its place) on the left, the route stack's screens on
/// the right.
struct MailSplitView<Mailbox: View, Placeholder: View, Destination: View>: View {
    @Binding var path: RouteStack<HubRoute>
    let layout: MailSideBySideLayout
    @ViewBuilder let mailbox: () -> Mailbox
    @ViewBuilder let placeholder: () -> Placeholder
    @ViewBuilder let destination: (HubRoute) -> Destination
    /// Lays the booklet open beside the Mailbox as two pages.
    let onLayOpen: @MainActor @Sendable (String) -> Void

    var body: some View {
        SideBySideSplit(leadingWidth: layout.columnWidth) {
            leadingColumn
                .environment(\.openMailPieceId, path.openMailPieceId)
                .safeAreaPadding(.trailing, layout.hingeMargin)
        } detail: {
            RouteColumn(path: $path, skipping: path.searchingMail ? 1 : 0) { first in
                Group {
                    if let first {
                        destination(first)
                            .readableColumn()
                            .environment(\.mailPieceShowsBack, false)
                            .environment(\.mailBookletLayOpen, first.mailId.map { id in
                                MailBookletLayOpen { onLayOpen(id) }
                            })
                    } else {
                        placeholder()
                    }
                }
                .safeAreaPadding(.leading, layout.hingeMargin)
            } destination: { route in
                destination(route)
                    .safeAreaPadding(.leading, layout.hingeMargin)
            }
        }
    }

    /// Search covers the Mailbox instead of replacing it, so the Mailbox keeps its place for when search closes.
    private var leadingColumn: some View {
        ZStack {
            mailbox()
                .opacity(path.searchingMail ? 0 : 1)
                .allowsHitTesting(!path.searchingMail)
                .accessibilityHidden(path.searchingMail)
            if path.searchingMail {
                destination(.mailboxSearch)
            }
        }
    }
}

extension HubRoute {
    /// The piece a Mail screen shows: a letter's page, the welcome porch, a ceremonial letter, a card you sent.
    var mailId: String? {
        switch self {
        case let .mailItemDetail(mailId), let .ceremonialMailOpen(mailId): mailId
        case let .mailWelcome(mail): mail.id
        case let .mailSentCard(id): id
        default: nil
        }
    }

    /// Whether the Mailbox beside these screens reads again, as on coming back to it: what it opened beside it
    /// closed, or a screen other than a piece (the card flow, Hold my mail) gave way. Beside the open piece the
    /// Mailbox never goes off screen, so it can't read again when it's next shown. A piece giving way to another
    /// doesn't count: what changes on a piece reaches the list as it happens.
    static func mailboxReadsAgain(from old: [HubRoute], to new: [HubRoute]) -> Bool {
        guard let was = besideMailbox(old), was != besideMailbox(new) else { return false }
        return besideMailbox(new) == nil || was.mailId == nil
    }

    /// The first screen right of the Mailbox: a search in its place skipped.
    private static func besideMailbox(_ routes: [HubRoute]) -> HubRoute? {
        routes.first == .mailboxSearch ? routes.dropFirst().first : routes.first
    }
}

extension RouteStack where Route == HubRoute {
    /// A mail search in the Mailbox's place (beside the open piece) or on top of the stack.
    var searchingMail: Bool {
        routes.first == .mailboxSearch
    }

    /// The piece open beside the Mailbox: the first screen right of it.
    var openMailPieceId: String? {
        routes.dropFirst(searchingMail ? 1 : 0).first?.mailId
    }

    /// A screen the Mailbox opens: on top of the stack, or beside the Mailbox in the place of what was open there, a
    /// search in the Mailbox's place kept.
    mutating func openBesideMailbox(_ route: HubRoute, sideBySide: Bool) {
        guard sideBySide else {
            append(route)
            return
        }
        replace(with: (searchingMail ? [.mailboxSearch] : []) + [route])
    }

    /// Mail search: on top of the stack, or in the Mailbox's place, what's open beside it kept.
    mutating func openMailSearch(sideBySide: Bool) {
        guard sideBySide else {
            append(.mailboxSearch)
            return
        }
        guard !searchingMail else { return }
        replace(with: [.mailboxSearch] + routes)
    }

    /// Search's Cancel: off the top of the stack, or back to the Mailbox, what's open beside it kept.
    mutating func closeMailSearch(sideBySide: Bool) {
        guard sideBySide else {
            removeLast()
            return
        }
        replace(with: Array(routes.drop { $0 == .mailboxSearch }))
    }
}

/// Keeps a Mail screen's model while its route is on the stack, so the same screen shows after the tab switches
/// between one column and two (folding, unfolding, turning the open Duo): an open letter's page and its booklet
/// page, a search's words, a card being written, a hold being set.
@MainActor
final class MailScreenModels {
    private var models: [HubRoute: AnyObject] = [:]

    func model<Model: AnyObject>(for route: HubRoute, make: () -> Model) -> Model {
        if let model = models[route] as? Model { return model }
        let model = make()
        models[route] = model
        return model
    }

    /// Lets go of the screens no longer on the stack.
    func retain(_ routes: [HubRoute]) {
        let onStack = Set(routes)
        models = models.filter { onStack.contains($0.key) }
    }

    /// Whether this model's screen is still on the stack.
    func holds(_ model: AnyObject) -> Bool {
        models.values.contains { $0 === model }
    }
}
