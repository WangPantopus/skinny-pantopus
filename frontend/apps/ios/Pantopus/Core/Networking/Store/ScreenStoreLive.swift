//
//  ScreenStoreLive.swift
//  Pantopus
//
//  Live updates for the screen store (Instant Screens contract section 8).
//  `sync:changed` marks the copies its topics name out of date,
//  `notification:new` marks the notification list, and a socket that comes
//  back after a drop marks every Household, Messages and Notifications copy
//  (signals may have been missed meanwhile). A screen on screen then re-reads
//  what went stale (`refreshesOnStoreChange`); the others catch up when they
//  next appear. Older servers send no `sync:changed`; nothing depends on it.
//

import SwiftUI

/// `sync:changed`: topic names only, never content or names.
struct SyncChangedEvent: Decodable {
    let topics: [String]
}

/// Any payload: only the event's arrival matters.
struct SocketSignal: Decodable {
    init(from _: any Decoder) throws {}
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

    /// Starts listening, once: the socket keeps its subscriptions across
    /// reconnects, token refreshes and account switches.
    static func start(socket: SocketClient = .shared, store: ScreenStore = .shared) {
        guard tasks.isEmpty else { return }
        tasks.append(Task {
            for await change in socket.events(named: "sync:changed", as: SyncChangedEvent.self) {
                changed(topics: Set(change.topics), in: store)
            }
        })
        tasks.append(Task {
            for await _ in socket.events(named: "notification:new", as: SocketSignal.self) {
                changed(topics: [ScreenTopic.notifications], in: store)
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
        onBackground: (@MainActor () -> Bool)? = nil,
        perform action: @escaping @MainActor () async -> Void
    ) -> some View {
        modifier(RefreshOnStoreChange(affects: affects, onBackground: onBackground, action: action))
    }
}

private struct RefreshOnStoreChange: ViewModifier {
    let affects: (Notification) -> Bool
    /// Clears temporary-access content and returns whether resuming needs a re-check.
    let onBackground: (@MainActor () -> Bool)?
    let action: @MainActor () async -> Void
    @State private var probe = WindowProbe()
    @State private var recheckOnResume = false

    func body(content: Content) -> some View {
        content
            .background(WindowProbeView(probe: probe))
            .onReceive(NotificationCenter.default.publisher(for: .screenStoreChanged)) { note in
                guard probe.isOnScreen, UIApplication.shared.applicationState == .active, affects(note) else { return }
                Task { await action() }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                guard probe.isOnScreen else { return }
                recheckOnResume = onBackground?() ?? false
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                guard recheckOnResume, probe.isOnScreen else { return }
                recheckOnResume = false
                Task { await action() }
            }
    }
}

/// Whether a screen is really showing. `onAppear`/`onDisappear` can't tell:
/// SwiftUI re-fires `onAppear` for a view two screens under the top of a
/// stack with no matching `onDisappear`. UIKit takes covered screens (and
/// unselected tabs) out of the window, so a view in the window is showing.
@MainActor
private final class WindowProbe {
    weak var view: UIView?

    var isOnScreen: Bool {
        view?.window != nil
    }
}

private struct WindowProbeView: UIViewRepresentable {
    let probe: WindowProbe

    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        view.isHidden = true
        view.isUserInteractionEnabled = false
        probe.view = view
        return view
    }

    func updateUIView(_ view: UIView, context _: Context) {
        probe.view = view
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
