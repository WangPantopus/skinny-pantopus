//
//  ScrollAwayHeader.swift
//  Pantopus
//
//  The page gets the whole screen while you read (founder request
//  2026-11-07): a screen's header slides away as its page scrolls down and
//  comes back near the top of the page, as the tab bar slides away and comes
//  back on a scroll up (`RootTabBarScrollWatcher`). Two kinds of header go:
//  the stacks' system bar on the screens that keep it
//  (`navigationBarScrollsAway()`), and a header a screen draws above its page
//  (`scrollAwayHeader(_:)`), whose page then runs under it and under the
//  status bar. Only the header of the screen whose page scrolled goes, at
//  phone width, and never with VoiceOver or Switch Control on. A screen
//  pushed over it, a sheet or a cover keeps its header, as do forms and
//  chats, whose Save, Close or name is in it.
//

import SwiftUI
import UIKit

extension View {
    /// The stack's system bar slides away while the page scrolls down and
    /// comes back near its top. For a pushed screen that keeps the bar, and a
    /// tab's root that shows it; elsewhere the bar is as the screen sets it.
    func navigationBarScrollsAway() -> some View {
        modifier(NavigationBarScrollsAway())
    }

    /// `header` sits above this page and slides away while the page scrolls
    /// down, coming back near its top. The page runs under it, and under the
    /// status bar, which `fill` paints so the clock stays readable.
    func scrollAwayHeader<Header: View>(
        fill: Color = Theme.Color.appBg,
        @ViewBuilder _ header: () -> Header
    ) -> some View {
        safeAreaInset(edge: .top, spacing: Spacing.s0) {
            header()
                .modifier(HeaderScrollsAway())
                .background(fill.ignoresSafeArea(edges: .top))
        }
    }
}

extension UIView {
    /// The screen this view is on: the nearest view controller, which for a
    /// SwiftUI screen is the hosting controller its stack pushed.
    var screenID: ObjectIdentifier? {
        var responder: UIResponder? = self
        while let current = responder {
            if let controller = current as? UIViewController { return ObjectIdentifier(controller) }
            responder = current.next
        }
        return nil
    }
}

/// Whether this screen's header is scrolled away.
private struct ScrollAwayState: DynamicProperty {
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.accessibilitySwitchControlEnabled) private var switchControlEnabled

    /// Away while the page of the screen it's on scrolls down, at phone
    /// width; for VoiceOver and Switch Control the header is how people find
    /// their way.
    @MainActor
    func isAway(screen: ObjectIdentifier?) -> Bool {
        guard let screen, horizontalSizeClass != .regular, !voiceOverEnabled, !switchControlEnabled,
              let rootTabs else { return false }
        return rootTabs.headerAwayScreen == screen
    }
}

private struct NavigationBarScrollsAway: ViewModifier {
    private var scroll = ScrollAwayState()
    @State private var screen: ObjectIdentifier?

    func body(content: Content) -> some View {
        let away = scroll.isAway(screen: screen)
        content
            .background {
                // Absent, the screen's own setting stands. Present, it hides
                // the bar whatever the screen sets inside: a toolbar setting in
                // a background reaches the stack as the screen's own does.
                if away {
                    Color.clear.toolbar(.hidden, for: .navigationBar)
                }
            }
            // With the bar away the page scrolls under the status bar: the
            // app background there keeps the clock readable.
            .overlay(alignment: .top) {
                if away {
                    Theme.Color.appBg
                        .frame(height: 0)
                        .ignoresSafeArea(edges: .top)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .background(ScreenReader(screen: $screen))
    }
}

private struct HeaderScrollsAway: ViewModifier {
    private var scroll = ScrollAwayState()
    @State private var screen: ObjectIdentifier?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let away = scroll.isAway(screen: screen)
        content
            // Its own height, however little room it's given on the way out.
            .fixedSize(horizontal: false, vertical: true)
            // Away, it leaves no room: slid up out of it, or with Reduce
            // Motion faded where it is.
            .frame(height: away ? 0 : nil, alignment: reduceMotion ? .top : .bottom)
            .clipped()
            .opacity(away ? 0 : 1)
            .allowsHitTesting(!away)
            .accessibilityHidden(away)
            .background(ScreenReader(screen: $screen))
    }
}

/// Reports the screen a view is on (`UIView.screenID`) once it's in a window.
private struct ScreenReader: UIViewRepresentable {
    @Binding var screen: ObjectIdentifier?

    func makeUIView(context _: Context) -> ReaderView {
        ReaderView()
    }

    func updateUIView(_ view: ReaderView, context _: Context) {
        let binding = $screen
        view.report = { found in
            if binding.wrappedValue != found { binding.wrappedValue = found }
        }
        view.reportScreen()
    }

    final class ReaderView: UIView {
        var report: (@MainActor (ObjectIdentifier?) -> Void)?

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            accessibilityElementsHidden = true
        }

        @available(*, unavailable)
        required init?(coder _: NSCoder) {
            nil
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            reportScreen()
        }

        func reportScreen() {
            guard window != nil else { return }
            let found = screenID
            // After SwiftUI's update, never during it.
            Task { @MainActor [weak self] in self?.report?(found) }
        }
    }
}
