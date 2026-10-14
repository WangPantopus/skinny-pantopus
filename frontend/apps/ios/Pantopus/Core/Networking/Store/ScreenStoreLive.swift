//
//  ScreenStoreLive.swift
//  Pantopus
//
//  Live updates for the screen store (Instant Screens contract section 8).
//  `sync:changed` marks the copies its topics name out of date,
//  `notification:new` marks the notification list, and a socket that comes
//  back after a drop marks every Household, Messages and Notifications copy
//  (signals may have been missed meanwhile). A connection request or
//  acceptance, from the socket or a push, also marks Connections: the server
//  sends no topic for relationships. A screen on screen then re-reads
//  what went stale (`refreshesOnStoreChange`); the others catch up when they
//  next appear. Older servers send no `sync:changed`; nothing depends on it.
//

import SwiftUI
import UserNotifications

/// `sync:changed`: topic names only, never content or names.
struct SyncChangedEvent: Decodable {
    let topics: [String]
}

/// `notification:new`: any payload counts; only the notice's `type` is read.
struct NotificationSignal: Decodable {
    let type: String?

    init(from decoder: any Decoder) throws {
        type = try? decoder.container(keyedBy: CodingKeys.self).decode(String.self, forKey: .type)
    }

    private enum CodingKeys: String, CodingKey {
        case type
    }
}

extension Notification.Name {
    /// Copies were marked out of date by a change signal. `userInfo["topics"]`
    /// holds the topic names (`Set<String>`), or `userInfo["kinds"]` after a
    /// reconnect.
    static let screenStoreChanged = Notification.Name("screenStoreChanged")
}

@MainActor
enum ScreenStoreLive {
    private static var tasks: [Task<Void, Never>] = []
    private static var observers: [any NSObjectProtocol] = []
    /// The store `start` listens for; pushes mark only this one. A push opened
    /// on a cold launch comes first: there is no copy to mark yet, and making
    /// the shared store before the session is restored would wipe its saved copy.
    private static var liveStore: ScreenStore?
    /// When the app went to the background.
    private static var awaySince: Date?

    /// Starts listening, once: the socket keeps its subscriptions across
    /// reconnects, token refreshes and account switches.
    static func start(socket: SocketClient = .shared, store: ScreenStore = .shared) {
        guard tasks.isEmpty else { return }
        liveStore = store
        tasks.append(Task {
            for await change in socket.events(named: "sync:changed", as: SyncChangedEvent.self) {
                changed(topics: Set(change.topics), in: store)
            }
        })
        tasks.append(Task {
            for await notice in socket.events(named: "notification:new", as: NotificationSignal.self) {
                var topics: Set<String> = [ScreenTopic.notifications]
                if isConnectionNotice(notice.type) { topics.insert(ScreenTopic.connections) }
                changed(topics: topics, in: store)
            }
        })
        tasks.append(Task {
            var connectedBefore = false
            var dropped = false
            for await state in socket.connectionStates() {
                switch state {
                case .connected:
                    if dropped {
                        // Back after a drop: what may have changed meanwhile re-checks.
                        let kinds: Set<ScreenDataKind> = [.homes, .place, .messagesList, .notifications, .mailbox]
                        store.markStale(kinds: kinds)
                        NotificationCenter.default.post(
                            name: .screenStoreChanged,
                            object: nil,
                            userInfo: ["kinds": Set(kinds.map(\.rawValue))]
                        )
                    }
                    connectedBefore = true
                    dropped = false
                case .connecting, .disconnected:
                    if connectedBefore { dropped = true }
                }
            }
        })
        observePushesWhileAway()
    }

    /// A push shown while the app is open, or opened (`AppDelegate`): a
    /// connection request or acceptance marks Connections even when the
    /// socket missed the notice.
    static func pushArrived(type: String?) {
        if isConnectionNotice(type) { connectionNoticed() }
    }

    /// A connection request, or the viewer's request accepted (types from
    /// `backend/services/notificationService.js`).
    nonisolated static func isConnectionNotice(_ type: String?) -> Bool {
        type == "connection_request" || type == "connection_accepted"
    }

    private static func connectionNoticed() {
        guard let store = liveStore else { return }
        changed(topics: [ScreenTopic.connections], in: store)
    }

    /// Pushes that arrive while the app is in the background run no code
    /// here (alert pushes wake nothing). Coming back, those still in
    /// Notification Center count as arrived.
    private static func observePushesWhileAway() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { awaySince = Date() }
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                guard let since = awaySince else { return }
                awaySince = nil
                Task { @MainActor in
                    if await connectionPushDelivered(since: since) { connectionNoticed() }
                }
            }
        })
    }

    private nonisolated static func connectionPushDelivered(since: Date) async -> Bool {
        await UNUserNotificationCenter.current().deliveredNotifications().contains {
            $0.date > since && isConnectionNotice($0.request.content.userInfo["type"] as? String)
        }
    }

    private static func changed(topics: Set<String>, in store: ScreenStore) {
        guard !topics.isEmpty else { return }
        store.markStale(topics: topics)
        NotificationCenter.default.post(name: .screenStoreChanged, object: nil, userInfo: ["topics": topics])
    }
}

extension View {
    /// While this screen is on screen, a change signal that marked copies out
    /// of date runs `action`: the screen's own non-forced `load()`, which asks
    /// the server only for what went stale. `affects` narrows it to signals
    /// that concern this screen (topics, or kinds after a reconnect).
    func refreshesOnStoreChange(
        affects: @escaping (Notification) -> Bool = { _ in true },
        recheckOnAttach: Bool = false,
        onBackground: (@MainActor () -> Bool)? = nil,
        perform action: @escaping @MainActor () async -> Void
    ) -> some View {
        modifier(RefreshOnStoreChange(
            affects: affects,
            recheckOnAttach: recheckOnAttach,
            onBackground: onBackground,
            action: action
        ))
    }
}

private struct RefreshOnStoreChange: ViewModifier {
    let affects: (Notification) -> Bool
    /// Opted-in screens load on actual window attachment instead of SwiftUI appearance.
    let recheckOnAttach: Bool
    /// Clears temporary-access content and returns whether resuming needs a re-check.
    /// Opted-in screens also clear when their window detaches.
    let onBackground: (@MainActor () -> Bool)?
    let action: @MainActor () async -> Void
    @State private var probe = WindowProbe()
    @State private var recheckOnResume = false

    func body(content: Content) -> some View {
        content
            .background(WindowProbeView(probe: probe, onAttach: attached, onDetach: detached))
            .onReceive(NotificationCenter.default.publisher(for: .screenStoreChanged)) { note in
                guard canRefresh, UIApplication.shared.applicationState == .active, affects(note) else { return }
                performIfVisible()
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
                // Clear before the app snapshot and even if UIKit already
                // detached this retained screen from its window.
                let needsRecheck = onBackground?() ?? false
                recheckOnResume = needsRecheck || recheckOnAttach
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                resumeIfNeeded()
            }
    }

    private var canRefresh: Bool {
        probe.isOnScreen && (!recheckOnAttach || probe.isTopNavigationScreen)
    }

    private func attached() {
        if recheckOnAttach { recheckOnResume = true }
        resumeIfNeeded()
    }

    private func detached() {
        // A dropped copy can leave the window while another one still shows the screen.
        guard recheckOnAttach, !probe.isOnScreen else { return }
        _ = onBackground?()
        recheckOnResume = true
    }

    private func resumeIfNeeded() {
        // UIKit may reattach a retained screen after didBecomeActive. Keep
        // the pending re-check until both conditions hold; hidden screens wait.
        guard recheckOnResume, canRefresh, UIApplication.shared.applicationState == .active else { return }
        recheckOnResume = false
        performIfVisible()
    }

    private func performIfVisible() {
        Task {
            // A navigation transition may detach the screen after the signal
            // but before this task starts. Preserve its pending re-check.
            if recheckOnAttach, !canRefresh || UIApplication.shared.applicationState != .active {
                recheckOnResume = true
                return
            }
            await action()
        }
    }
}

/// SwiftUI can reattach a covered screen and fire its appearance callbacks
/// while another navigation destination is on top. Sensitive callers also
/// check the containing controller's position in every navigation stack.
/// SwiftUI can also give one screen a second probe view and then drop the
/// first (iOS 27: Nearby's "See your plan", pushed right after a full-screen
/// cover closes). The view it updated last isn't always the one that stays,
/// so the probe watches every copy and counts the ones in the window.
@MainActor
private final class WindowProbe {
    private let views = NSHashTable<UIView>.weakObjects()

    func watch(_ view: UIView) {
        views.add(view)
    }

    var isOnScreen: Bool {
        !viewsInWindow.isEmpty
    }

    var isTopNavigationScreen: Bool {
        viewsInWindow.contains { Self.isTopNavigationScreen($0) }
    }

    private var viewsInWindow: [UIView] {
        views.allObjects.filter { $0.window != nil }
    }

    private static func isTopNavigationScreen(_ view: UIView) -> Bool {
        var responder: UIResponder? = view
        while let current = responder, !(current is UIViewController) {
            responder = current.next
        }
        guard var controller = responder as? UIViewController else { return false }
        while let parent = controller.parent {
            // Use the stack's top, not visibleViewController: a screen must
            // still recheck access while its own reservation sheet is open.
            if let navigation = parent as? UINavigationController,
               navigation.topViewController !== controller { return false }
            if let tabs = parent as? UITabBarController,
               tabs.selectedViewController !== controller { return false }
            controller = parent
        }
        return true
    }
}

private struct WindowProbeView: UIViewRepresentable {
    let probe: WindowProbe
    let onAttach: @MainActor () -> Void
    let onDetach: @MainActor () -> Void

    func makeUIView(context _: Context) -> WindowProbeUIView {
        let view = WindowProbeUIView()
        view.isHidden = true
        view.isUserInteractionEnabled = false
        view.onAttach = onAttach
        view.onDetach = onDetach
        probe.watch(view)
        return view
    }

    func updateUIView(_ view: WindowProbeUIView, context _: Context) {
        probe.watch(view)
        view.onAttach = onAttach
        view.onDetach = onDetach
    }
}

private final class WindowProbeUIView: UIView {
    var onAttach: (@MainActor () -> Void)?
    var onDetach: (@MainActor () -> Void)?
    private var windowChange = 0

    override func didMoveToWindow() {
        super.didMoveToWindow()
        windowChange &+= 1
        let revision = windowChange
        let attached = window != nil
        // Run after SwiftUI's update; a newer transition supersedes this one.
        Task { @MainActor [weak self] in
            guard let self, windowChange == revision, (window != nil) == attached else { return }
            if attached { onAttach?() } else { onDetach?() }
        }
    }
}

extension Notification {
    /// Whether a store change signal names `topic` (or, after a reconnect, `kind`).
    func names(topic: String? = nil, kind: ScreenDataKind? = nil) -> Bool {
        if let topic, let topics = userInfo?["topics"] as? Set<String>, topics.contains(topic.lowercased()) { return true }
        if let kind, let kinds = userInfo?["kinds"] as? Set<String>, kinds.contains(kind.rawValue) { return true }
        return false
    }
}
