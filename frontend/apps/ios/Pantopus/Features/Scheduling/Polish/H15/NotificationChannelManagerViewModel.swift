//
//  NotificationChannelManagerViewModel.swift
//  Pantopus
//
//  H15 · Stream I18. Drives the channel manager list screen — the iOS
//  equivalent of the Web ChannelsManager at /scheduling/settings/channels.
//
//  Shows three reminder-delivery channels (Push / Email / SMS), the live OS
//  push auth status (reconciled via UNUserNotificationCenter on appear and on
//  foreground-return so the row self-corrects if the user changed the setting),
//  and a "More channels" section backed by GET /connected-calendars (→ empty in
//  v1). Connect is deferred server-side (POST /connected-calendars/connect →
//  501); we surface it as a first-class "coming soon", never a dead end.
//
//  Cross-platform notes (see H15.json § crossPlatformNotes):
//  · Android hardcodes Personal accent; iOS resolves from the routing owner — ✓
//  · Web has a dedicated manager page; mobile previously exposed only the
//    prompt sheet — this file closes that gap.
//

import Observation
import SwiftUI

// MARK: - Channel state

/// The reachability state of a single reminder channel.
enum ChannelStatus: Equatable {
    /// Channel is connected and can deliver reminders.
    case on
    /// Channel is available but not yet set up by the user.
    case off
    /// Channel is blocked at the OS level (e.g. push denied in Settings).
    case blocked
    /// Channel is not yet available (server-side deferred).
    case comingSoon
    /// Channel cannot be used on this device/OS.
    case unsupported

    var label: String {
        switch self {
        case .on: "On"
        case .off: "Not set up"
        case .blocked: "Blocked"
        case .comingSoon: "Coming soon"
        case .unsupported: "Not supported"
        }
    }

    var pillStatus: SchedulingPillStatus {
        switch self {
        case .on: .active
        case .off: .draft
        case .blocked: .unavailable
        case .comingSoon: .paused
        case .unsupported: .cancelled
        }
    }
}

/// A single reminder-channel row for the manager list.
struct ChannelRow: Identifiable {
    let id: NotificationChannel
    /// Status derived from OS push auth or server preference.
    var status: ChannelStatus
    /// Detail copy explaining the current status.
    var detail: String
    /// CTA label for the row's action button, or `nil` when no action.
    var actionLabel: String?
    /// Which prompt frame to open when the action is tapped.
    var promptFrame: NotificationPromptFrame?
}

// MARK: - More-channels phase

enum MoreChannelsPhase {
    case loading
    case ready([ConnectedCalendarDTO])
    case error(String)
}

// MARK: - View model

@Observable
@MainActor
final class NotificationChannelManagerViewModel {
    let owner: SchedulingOwner
    let accountEmail: String

    private(set) var channelRows: [ChannelRow] = []
    private(set) var moreChannelsPhase: MoreChannelsPhase = .loading
    private(set) var isConnecting = false
    private(set) var connectToast: String?
    /// The prompt frame the manager wants to open — the view binds to this.
    var activePromptFrame: NotificationPromptFrame?

    private let service: NotificationChannelService
    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        accountEmail: String,
        service: NotificationChannelService = .shared,
        client: SchedulingClient = .shared
    ) {
        self.owner = owner
        self.accountEmail = accountEmail
        self.service = service
        self.client = client
    }

    // MARK: - Lifecycle

    func onAppear() async {
        async let push: Void = syncPushStatus()
        async let more: Void = loadMoreChannels()
        _ = await (push, more)
    }

    func onForeground() async {
        await syncPushStatus()
    }

    // MARK: - Push reconciliation

    private func syncPushStatus() async {
        let auth = await service.pushStatus()
        rebuildRows(pushAuth: auth)
    }

    private func rebuildRows(pushAuth: PushAuthorizationStatus) {
        let pushStatus: ChannelStatus
        let pushDetail: String
        let pushAction: String?
        let pushFrame: NotificationPromptFrame?

        switch pushAuth {
        case .authorized:
            pushStatus = .on
            pushDetail = "Booking reminders can reach this device."
            pushAction = "Manage"
            pushFrame = .connected(.push)
        case .denied:
            pushStatus = .blocked
            pushDetail = "Notifications are turned off in iOS Settings."
            pushAction = "How to enable"
            pushFrame = .denied
        case .notDetermined:
            pushStatus = .off
            pushDetail = "Turn on to get booking reminders right here."
            pushAction = "Turn on"
            pushFrame = .push
        }

        channelRows = [
            ChannelRow(
                id: .push,
                status: pushStatus,
                detail: pushDetail,
                actionLabel: pushAction,
                promptFrame: pushFrame
            ),
            ChannelRow(
                id: .email,
                status: .on,
                detail: accountEmail.isEmpty
                    ? "Confirmations and reminders go to your account email."
                    : "Reminders go to \(accountEmail).",
                actionLabel: "Use another email",
                promptFrame: .emailVerify(email: accountEmail)
            ),
            ChannelRow(
                id: .sms,
                status: .comingSoon,
                detail: "Text reminders aren't available yet.",
                actionLabel: "Preview",
                promptFrame: .smsVerify
            )
        ]
    }

    // MARK: - More channels

    func loadMoreChannels() async {
        moreChannelsPhase = .loading
        do {
            let response: ConnectedCalendarsResponse =
                try await client.request(SchedulingEndpoints.getConnectedCalendars())
            moreChannelsPhase = .ready(response.calendars)
        } catch {
            moreChannelsPhase = .error("We couldn't load your connected channels.")
        }
    }

    // MARK: - Actions

    func openPrompt(for row: ChannelRow) {
        guard let frame = row.promptFrame else { return }
        activePromptFrame = frame
    }

    /// Called when the channel prompt closes so we can reconcile the push row.
    func handlePromptResult(_ result: NotificationChannelConnectResult) {
        if case .deniedPush = result {
            Task { await syncPushStatus() }
        } else if case .connected = result {
            Task { await syncPushStatus() }
        }
    }

    func connectChannel() async {
        isConnecting = true
        defer { isConnecting = false }
        do {
            let _: EmptyResponse = try await client.request(SchedulingEndpoints.connectCalendar())
            connectToast = "Channel connected."
            await loadMoreChannels()
        } catch {
            // 501 NOT_AVAILABLE is the expected response — "coming soon".
            connectToast = "Connecting more channels is coming soon."
        }
        scheduleToastDismiss()
    }

    private func scheduleToastDismiss() {
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, connectToast != nil else { return }
            connectToast = nil
        }
    }

    // MARK: - Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }
}
