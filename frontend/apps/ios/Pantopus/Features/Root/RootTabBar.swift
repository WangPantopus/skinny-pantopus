//
//  RootTabBar.swift
//  Pantopus
//
//  The bar over `RootTabContainer` while the Mailbox is on: Place · Today ·
//  Nearby · Plans · Mail · Messages (drawing "Six-tab bar", Mail tab design
//  2026-10-27). The same icons, labels and `tab.<id>` ids as the system bar;
//  Mail's red badge counts unopened mail and Messages' counts chats. The
//  labels keep their size at every text size, as the system bar's do, and at
//  the accessibility sizes a long press shows the large content viewer.
//
//  It looks like the system bar it stands in for (founder, 2026-10-30): on
//  iOS 26 and later the floating Liquid Glass capsule, with the selected tab
//  on a pill that slides to the tab tapped; before iOS 26 the flat bar.
//  Scrolling down a page slides it away, so there's more room to read, and
//  scrolling up brings it back (`RootTabBarScrollWatcher`).
//

import SwiftUI

/// The selected tab was tapped again: its stack goes back to its root.
struct RootTabReselection: Equatable {
    let tab: RootTab
    let id = UUID()
}

/// The room the bar takes at the bottom of the screen, which the tabs'
/// screens keep clear (`RootTabContainer`).
struct RootTabBarSpace: Equatable {
    /// Height above the bottom safe area (the flat bar).
    var aboveSafeArea: CGFloat = 0
    /// Height from the screen's bottom edge (the floating bar, which reaches
    /// into the Home indicator's area as the system's does).
    var fromBottomEdge: CGFloat = 0

    /// A screen hides the bar.
    static let none = RootTabBarSpace()

    /// What the tabs' screens add to a bottom safe area of `safeAreaBottom`.
    func inset(safeAreaBottom: CGFloat) -> CGFloat {
        max(aboveSafeArea, fromBottomEdge - safeAreaBottom, 0)
    }
}

struct RootTabBar: View {
    /// The flat bar's height above the bottom safe area.
    static let height: CGFloat = 50
    /// The floating bar's capsule, and its distance from the screen's sides
    /// and bottom: the system bar's, measured on an iPhone 17 Pro and an
    /// iPhone SE.
    static let capsuleHeight: CGFloat = 62
    static let edgeInset: CGFloat = 21
    /// How far the bar slides down when it steps aside: past the screen's edge.
    static let awayDistance: CGFloat = 120

    /// The room this bar takes.
    static var space: RootTabBarSpace {
        isFloating
            ? RootTabBarSpace(fromBottomEdge: capsuleHeight + edgeInset)
            : RootTabBarSpace(aboveSafeArea: height)
    }

    /// The floating glass bar: iOS 26 and later, in an app built with their SDK.
    static var isFloating: Bool {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) { return true }
        #endif
        return false
    }

    let tabs: [RootTab]
    let selected: RootTab
    let badges: [RootTab: Int]
    let onSelect: @MainActor (RootTab) -> Void

    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.accessibilitySwitchControlEnabled) private var switchControlEnabled

    var body: some View {
        bar
            // VoiceOver reads each tab as "tab, 5 of 6", as on the system bar.
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(.isTabBar)
            .accessibilityIdentifier("rootTabBar")
            // Stepped aside: below the screen's edge, or faded out with Reduce
            // Motion, as the Pulse header goes.
            .offset(y: isAway && !reduceMotion ? Self.awayDistance : 0)
            .opacity(isAway && reduceMotion ? 0 : 1)
            .allowsHitTesting(!isAway)
            .accessibilityHidden(isAway)
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .snappy(duration: 0.3), value: isAway)
    }

    /// Scrolled out of the way; never while VoiceOver or Switch Control is
    /// on, where the bar is how people move between tabs.
    private var isAway: Bool {
        (rootTabs?.barScrolledAway ?? false) && !voiceOverEnabled && !switchControlEnabled
    }

    @ViewBuilder
    private var bar: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            floatingBar
        } else {
            flatBar
        }
        #else
        flatBar
        #endif
    }

    #if compiler(>=6.2)
    /// The system bar of iOS 26 and later: a glass capsule floating above
    /// the screen's bottom edge, the page showing through it.
    @available(iOS 26.0, *)
    private var floatingBar: some View {
        RootTabFloatingRow(tabs: tabs, selected: selected, badges: badges, onSelect: onSelect)
            .frame(height: Self.capsuleHeight)
            .glassEffect(.regular.interactive(), in: Capsule())
            .padding(.horizontal, Self.edgeInset)
            .padding(.bottom, Self.edgeInset)
            // Measured from the screen's edge, as the system bar is, so it
            // sits the same on a phone with a Home button.
            .ignoresSafeArea(edges: .bottom)
    }
    #endif

    /// The system bar before iOS 26: flat, across the bottom.
    private var flatBar: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            ForEach(tabs, id: \.self) { tab in
                RootTabBarItem(tab: tab, isSelected: tab == selected, badge: badges[tab] ?? 0) {
                    onSelect(tab)
                }
            }
        }
        .padding(.horizontal, 2)
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
        .frame(height: Self.height, alignment: .top)
        .background(Theme.Color.appSurface.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
    }
}

/// Where the floating bar's tabs sit across its `width`, as on the system
/// bar: the first and last tabs' pills reach the capsule's ends (`inset` in)
/// and the tabs between are evenly spaced. Each tab answers touches halfway
/// to its neighbors, so every point of the capsule belongs to one.
struct RootTabFloatingLayout {
    let count: Int
    let width: CGFloat
    let inset: CGFloat

    /// The selected tab's pill: each tab's share of the capsule plus 14
    /// points, as the system's 85-point pill over five tabs' 70, at most 85.
    var pillWidth: CGFloat {
        min((width - 2 * inset) / CGFloat(max(count, 1)) + 14, 85)
    }

    /// The middle of the tab at `index`.
    func center(of index: Int) -> CGFloat {
        guard count > 1 else { return width / 2 }
        let first = inset + pillWidth / 2
        let last = width - inset - pillWidth / 2
        return first + (last - first) * CGFloat(index) / CGFloat(count - 1)
    }

    /// The stretch of the capsule the tab at `index` answers to (empty, never
    /// reversed, while the bar is laid out at no width).
    func span(of index: Int) -> ClosedRange<CGFloat> {
        let lower = index == 0 ? 0 : (center(of: index - 1) + center(of: index)) / 2
        let upper = index == count - 1 ? width : (center(of: index) + center(of: index + 1)) / 2
        return lower...max(lower, upper)
    }
}

/// The floating bar's tabs over the pill that marks the selected one.
private struct RootTabFloatingRow: View {
    /// The pill's distance from the capsule's edge.
    static let pillInset: CGFloat = 4

    let tabs: [RootTab]
    let selected: RootTab
    let badges: [RootTab: Int]
    let onSelect: @MainActor (RootTab) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let layout = RootTabFloatingLayout(count: tabs.count, width: proxy.size.width, inset: Self.pillInset)
            ZStack(alignment: .leading) {
                if let index = tabs.firstIndex(of: selected) {
                    Capsule()
                        .fill(Theme.Color.appText.opacity(0.08))
                        .frame(width: layout.pillWidth, height: max(proxy.size.height - 2 * Self.pillInset, 0))
                        .offset(x: layout.center(of: index) - layout.pillWidth / 2)
                        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.78), value: index)
                }
                HStack(spacing: Spacing.s0) {
                    ForEach(Array(tabs.enumerated()), id: \.element) { index, tab in
                        let span = layout.span(of: index)
                        RootTabBarItem(
                            tab: tab,
                            isSelected: tab == selected,
                            badge: badges[tab] ?? 0,
                            style: .floating(offset: layout.center(of: index) - (span.lowerBound + span.upperBound) / 2)
                        ) {
                            onSelect(tab)
                        }
                        .frame(width: span.upperBound - span.lowerBound)
                    }
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}

private struct RootTabBarItem: View {
    enum Style: Equatable {
        /// Outlined icon over an 11-point name, grey until selected.
        case flat
        /// Filled icon over a 10-point name in the text color, the selected
        /// one in the tint; the icon and name sit `offset` from the middle
        /// of the stretch the tab answers to.
        case floating(offset: CGFloat)
    }

    let tab: RootTab
    let isSelected: Bool
    let badge: Int
    var style: Style = .flat
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                switch style {
                case .flat:
                    flatLabel
                case let .floating(offset):
                    floatingLabel
                        .offset(x: offset)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("tab.\(tab.id)")
        .accessibilityShowsLargeContentViewer {
            Icon(tab.icon, size: 24)
            Text(tab.label)
        }
    }

    private var flatLabel: some View {
        VStack(spacing: 3) {
            Icon(tab.icon, size: 24, strokeWidth: isSelected ? 2.25 : 1.75, color: flatTint)
                .overlay(alignment: .topLeading) {
                    if badge > 0 {
                        RootTabBadge(count: badge, ring: true)
                            .offset(x: 16, y: -5)
                    }
                }
            Text(tab.label)
                .font(.system(size: 11, weight: isSelected ? .semibold : .medium))
                .foregroundStyle(flatTint)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .top)
    }

    private var floatingLabel: some View {
        // Icon and name on the system bar's lines (the extra point at the top
        // lowers them half a point in the capsule).
        VStack(spacing: 3.5) {
            Icon(tab.icon, size: 23, color: floatingTint)
                .symbolVariant(.fill)
                .overlay(alignment: .topLeading) {
                    if badge > 0 {
                        RootTabBadge(count: badge, ring: false)
                            .offset(x: 15, y: -5)
                    }
                }
            Text(tab.label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(floatingTint)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.top, 1)
    }

    private var flatTint: Color {
        isSelected ? Theme.Color.primaryInk : Theme.Color.appTextSecondary
    }

    /// The system bar's colors: the app's tint for the selected tab.
    private var floatingTint: Color {
        isSelected ? Theme.Color.primaryTint : Theme.Color.appText
    }

    /// "Mail, 3 unopened", "Messages, 2 unread", or the tab's name.
    private var accessibilityLabel: String {
        guard badge > 0 else { return tab.label }
        return tab == .mail ? "\(tab.label), \(badge) unopened" : "\(tab.label), \(badge) unread"
    }
}

private struct RootTabBadge: View {
    let count: Int
    /// The flat bar's ring in the bar's color; the glass bar's badges have none.
    let ring: Bool

    var body: some View {
        Text(count > 99 ? "99+" : "\(count)")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .lineLimit(1)
            .padding(.horizontal, 5)
            .frame(minWidth: 18, minHeight: 18)
            .background(Capsule().fill(Theme.Color.errorSolid))
            .overlay {
                if ring { Capsule().strokeBorder(Theme.Color.appSurface, lineWidth: 2) }
            }
            .fixedSize()
            .accessibilityHidden(true)
    }
}

extension View {
    /// Hides the bottom bar while this screen shows: the system tab bar, and
    /// the drawn bar while the Mailbox is on (`RootTabBar`).
    func hidesTabBar() -> some View {
        modifier(HidesTabBar())
    }
}

private struct HidesTabBar: ViewModifier {
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @State private var token = UUID()

    func body(content: Content) -> some View {
        content
            .toolbar(.hidden, for: .tabBar)
            .onAppear { rootTabs?.barHiders.insert(token) }
            .onDisappear { rootTabs?.barHiders.remove(token) }
    }
}
