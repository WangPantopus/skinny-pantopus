//
//  RootTabContainer.swift
//  Pantopus
//
//  The tabs' container while the Mailbox is on (Mail tab, founder decisions
//  2026-10-26/27): Place · Today · Nearby · Plans · Mail · Messages. SwiftUI's
//  TabView moves a sixth tab under "More" on iPhone, even with its bar hidden,
//  so these tabs live in a UIKit container that does what the system tab bar
//  controller does without its bar: one hosting controller per tab, made the
//  first time the tab opens and kept, so each tab's NavigationStack keeps its
//  place; only the selected tab is in the window, so its screens appear and
//  disappear as they did under the system bar and a screen in another tab
//  never counts as on screen (`ScreenStoreLive`). `RootTabView` draws the bar
//  (`RootTabBar`) over it; the tabs' screens keep clear of it as they did of
//  the system bar, and `RootTabBarScrollWatcher` slides it away while a page
//  scrolls down.
//

import SwiftUI
import UIKit

/// What a tab's screens read from `RootTabView`'s environment. A hosting
/// controller starts from a fresh environment, so these are passed on.
struct RootTabEnvironment: Equatable {
    let auth: AuthManager
    let tabs: RootTabModel
    let scenePhase: ScenePhase

    static func == (lhs: RootTabEnvironment, rhs: RootTabEnvironment) -> Bool {
        lhs.auth === rhs.auth && lhs.tabs === rhs.tabs && lhs.scenePhase == rhs.scenePhase
    }
}

/// A tab's root inside its hosting controller, with the environment passed on.
struct RootTabHostedRoot: View {
    let root: AnyView
    let environment: RootTabEnvironment
    /// The tab's cards and item screens match their zoom here (`ItemZoomTransition`).
    @Namespace private var itemZoom

    var body: some View {
        root
            .environment(environment.auth)
            .environment(environment.tabs)
            .environment(AppLockManager.shared)
            .environment(\.scenePhase, environment.scenePhase)
            .environment(\.itemZoomNamespace, itemZoom)
            // The app-wide tint, as `RootTabView` sets it on the system tab view.
            .tint(Theme.Color.primaryTint)
    }
}

/// The tabs, as `RootTabView` describes them.
struct RootTabContainer: UIViewControllerRepresentable {
    /// The tabs on the bar, in order.
    let tabs: [RootTab]
    let selected: RootTab
    /// The room the bar takes at the bottom; `.none` while a screen hides it.
    let barSpace: RootTabBarSpace
    let environment: RootTabEnvironment
    /// Changes when the selected tab is tapped again: its stack goes back to its root.
    let reselection: RootTabReselection?
    /// Builds a tab's root, once, the first time the tab opens.
    let makeRoot: @MainActor (RootTab) -> AnyView

    func makeUIViewController(context _: Context) -> RootTabContainerController {
        RootTabContainerController()
    }

    func updateUIViewController(_ controller: RootTabContainerController, context _: Context) {
        controller.update(
            tabs: tabs,
            selected: selected,
            barSpace: barSpace,
            environment: environment,
            makeRoot: makeRoot
        )
        controller.reselect(reselection)
    }
}

/// One hosting controller per opened tab; the selected one's view fills this
/// controller's view, the others wait out of the window.
@MainActor
final class RootTabContainerController: UIViewController {
    private var hosts: [RootTab: UIHostingController<RootTabHostedRoot>] = [:]
    private var roots: [RootTab: AnyView] = [:]
    private(set) var selectedTab: RootTab?
    private var environment: RootTabEnvironment?
    private var barSpace = RootTabBarSpace.none
    /// The bottom inset each tab's screens get for the bar, from `barSpace`
    /// and this screen's bottom safe area.
    private var barInset: CGFloat = 0
    private let scrollWatcher = RootTabBarScrollWatcher()
    private var handledReselection: UUID?
    /// Between `viewWillAppear` and `viewDidDisappear`: tab switches then
    /// tell the tabs they appear and disappear.
    private var isShowing = false

    /// The selected tab's hosting controller (`ScreenStoreLive`, the payment presenters).
    var selectedViewController: UIViewController? {
        selectedTab.flatMap { hosts[$0] }
    }

    override var shouldAutomaticallyForwardAppearanceMethods: Bool {
        false
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        scrollWatcher.install(on: view)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applyBarInset()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        selectedViewController?.view.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        isShowing = true
        selectedViewController?.beginAppearanceTransition(true, animated: animated)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        selectedViewController?.endAppearanceTransition()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        selectedViewController?.beginAppearanceTransition(false, animated: animated)
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        isShowing = false
        selectedViewController?.endAppearanceTransition()
    }

    func update(
        tabs: [RootTab],
        selected: RootTab,
        barSpace: RootTabBarSpace,
        environment: RootTabEnvironment,
        makeRoot: @MainActor (RootTab) -> AnyView
    ) {
        // A tab that left the bar (Plans switched off) goes with its screens.
        for tab in hosts.keys where !tabs.contains(tab) {
            remove(tab)
        }
        if environment != self.environment {
            self.environment = environment
            for (tab, host) in hosts {
                if let root = roots[tab] { host.rootView = RootTabHostedRoot(root: root, environment: environment) }
            }
        }
        scrollWatcher.tabs = environment.tabs
        if barSpace != self.barSpace {
            self.barSpace = barSpace
            applyBarInset()
        }
        let shown = tabs.contains(selected) ? selected : tabs.first
        guard let shown, shown != selectedTab else { return }
        show(shown, environment: environment, makeRoot: makeRoot)
    }

    /// Tapping the selected tab again takes its stack back to its root, as the
    /// system tab bar did.
    func reselect(_ reselection: RootTabReselection?) {
        guard let reselection, reselection.id != handledReselection else { return }
        handledReselection = reselection.id
        guard reselection.tab == selectedTab, let host = selectedViewController else { return }
        for navigation in Self.outermostNavigationControllers(in: host)
            where navigation.viewIfLoaded?.window != nil && navigation.viewControllers.count > 1 {
            navigation.popToRootViewController(animated: true)
        }
    }

    private var insets: UIEdgeInsets {
        UIEdgeInsets(top: 0, left: 0, bottom: barInset, right: 0)
    }

    /// Keeps each tab's screens clear of the bar: the flat bar's height over
    /// the safe area, or the floating bar's reach from the screen's edge (49
    /// points over the Home indicator's 34, the system bar's 83 in all).
    private func applyBarInset() {
        let safeAreaBottom = view.safeAreaInsets.bottom
        let inset = barSpace.inset(safeAreaBottom: safeAreaBottom)
        scrollWatcher.barHeight = inset > 0 ? inset + safeAreaBottom : 0
        guard inset != barInset else { return }
        barInset = inset
        for host in hosts.values {
            host.additionalSafeAreaInsets = insets
        }
    }

    private func show(
        _ tab: RootTab,
        environment: RootTabEnvironment,
        makeRoot: @MainActor (RootTab) -> AnyView
    ) {
        let outgoing = selectedViewController
        let incoming = hosts[tab] ?? makeHost(for: tab, environment: environment, makeRoot: makeRoot)
        selectedTab = tab
        if isShowing {
            outgoing?.beginAppearanceTransition(false, animated: false)
            incoming.beginAppearanceTransition(true, animated: false)
        }
        outgoing?.view.removeFromSuperview()
        incoming.view.frame = view.bounds
        view.addSubview(incoming.view)
        if isShowing {
            outgoing?.endAppearanceTransition()
            incoming.endAppearanceTransition()
        }
        setNeedsStatusBarAppearanceUpdate()
    }

    private func makeHost(
        for tab: RootTab,
        environment: RootTabEnvironment,
        makeRoot: @MainActor (RootTab) -> AnyView
    ) -> UIHostingController<RootTabHostedRoot> {
        let root = makeRoot(tab)
        let host = UIHostingController(rootView: RootTabHostedRoot(root: root, environment: environment))
        host.additionalSafeAreaInsets = insets
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addChild(host)
        host.didMove(toParent: self)
        roots[tab] = root
        hosts[tab] = host
        return host
    }

    private func remove(_ tab: RootTab) {
        guard let host = hosts[tab] else { return }
        if tab == selectedTab {
            if isShowing { host.beginAppearanceTransition(false, animated: false) }
            host.view.removeFromSuperview()
            if isShowing { host.endAppearanceTransition() }
            selectedTab = nil
        }
        host.willMove(toParent: nil)
        host.removeFromParent()
        hosts[tab] = nil
        roots[tab] = nil
    }

    /// A tab's own NavigationStacks (not the stacks inside them).
    private static func outermostNavigationControllers(in controller: UIViewController) -> [UINavigationController] {
        controller.children.flatMap { child -> [UINavigationController] in
            if let navigation = child as? UINavigationController { return [navigation] }
            return outermostNavigationControllers(in: child)
        }
    }
}
