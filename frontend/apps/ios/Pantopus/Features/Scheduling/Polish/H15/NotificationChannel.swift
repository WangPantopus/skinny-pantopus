//
//  NotificationChannel.swift
//  Pantopus
//
//  H15 Notification / Reminder Permission & Channel Connect Prompt · Stream I18.
//  The just-in-time precondition surface for reminder channels: it grants OS
//  push permission, or confirms the email / phone a reminder will use, so a
//  reminder is never configured against a dead channel. These are the value
//  types the prompt is driven by — the frame the sheet shows, the channel being
//  connected, the OS push state, and the result reported back to the caller.
//
//  Wiring (see reference/calendarly-backend-api.md + the I18 GLOBAL WIRING
//  CONTRACT): push is a real OS gate (UNUserNotificationCenter); email/SMS
//  channel state round-trips through `GET/PUT /notification-preferences`
//  (`prefs.channels`, unknown keys preserved); SMS stays "coming soon"
//  (the locked-S / 501 contract). Presented locally as a `.sheet` by the
//  reminder/workflow surfaces (I16) and as a routed full screen here.
//

import SwiftUI

/// A reminder/notification delivery channel the prompt can connect.
public enum NotificationChannel: String, Sendable, Hashable, CaseIterable {
    case push
    case email
    case sms

    /// SMS is not yet deliverable server-side — surfaced with the same
    /// "coming soon" treatment as the locked S column and the 501 connect.
    public var isComingSoon: Bool {
        self == .sms
    }

    /// Hero glyph for the channel's prompt frame.
    var glyph: PantopusIcon {
        switch self {
        case .push: .bellRing
        case .email: .mail
        case .sms: .messageSquare
        }
    }

    /// Title shown on the connected/success frame.
    var connectedTitle: String {
        switch self {
        case .push: "Push is on"
        case .email: "Email confirmed"
        case .sms: "Phone confirmed"
        }
    }

    /// Body shown on the connected/success frame. `target` is the device hint,
    /// the verified email, or the phone number.
    func connectedBody(target: String) -> String {
        switch self {
        case .push: "Reminders will send to this device."
        case .email, .sms: "Reminders will send to \(target)."
        }
    }
}

/// Which frame of the H15 prompt is showing. The owning surface (a reminder or
/// workflow channel toggle) sets the initial frame; the prompt advances it as
/// permission is granted or a code is verified.
enum NotificationPromptFrame: Equatable {
    /// Request OS push permission for this device.
    case push
    /// Confirm the account email a reminder will use (carries the address).
    case emailVerify(email: String)
    /// Verify a phone for SMS (coming soon).
    case smsVerify
    /// Channel granted/verified — the calm success frame.
    case connected(NotificationChannel)
    /// Push is off at the OS level — deep-link to Settings, email still works.
    case denied
}

/// The OS push authorization state, collapsed to the three the prompt branches on.
public enum PushAuthorizationStatus: Sendable, Equatable {
    case notDetermined
    case denied
    case authorized
}

/// Reported back to the surface that presented the prompt so it can reflect the
/// channel's new state on its own toggle (e.g. the Default Reminders sheet).
public enum NotificationChannelConnectResult: Sendable, Equatable {
    case connected(NotificationChannel)
    case deniedPush
    case dismissed
}
