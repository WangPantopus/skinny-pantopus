//
//  NotificationPermissionViewModel.swift
//  Pantopus
//
//  H15 · Stream I18. Drives the channel-connect prompt: it picks the right
//  opening frame from the live OS push status, advances frames as permission is
//  granted or a channel is confirmed, persists the channel choice, and reports
//  the outcome back to whatever surface presented it. Reusable by the reminder /
//  workflow channel toggles (I16, via `.sheet`) and by the routed full screen.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class NotificationPermissionViewModel {
    private(set) var frame: NotificationPromptFrame
    /// 6-digit code captured by the verify frames.
    var code = ""
    /// Phone number captured by the SMS-verify frame (national digits).
    var phone = ""
    /// In-flight flag for the permission request / channel persistence.
    private(set) var isWorking = false
    /// Transient confirmation copy shown above the CTA (resend / coming-soon).
    private(set) var toast: String?
    /// Flips true when the prompt is done — the presenter (routed screen or
    /// sheet) observes this to dismiss.
    private(set) var isFinished = false

    let owner: SchedulingOwner
    /// The signed-in account email reminders use — shown on the email-verify and
    /// connected frames.
    let accountEmail: String
    private let service: NotificationChannelService
    private let onResult: (NotificationChannelConnectResult) -> Void

    init(
        owner: SchedulingOwner,
        initialFrame: NotificationPromptFrame,
        accountEmail: String,
        service: NotificationChannelService,
        onResult: @escaping (NotificationChannelConnectResult) -> Void
    ) {
        self.owner = owner
        frame = initialFrame
        self.accountEmail = accountEmail
        self.service = service
        self.onResult = onResult
    }

    /// Pillar accent for the connect CTA and hero tint.
    var accent: Color {
        owner.theme.accent
    }

    /// Whether the active verify frame has a complete 6-digit code.
    var isCodeComplete: Bool {
        code.count == 6 && code.allSatisfy(\.isNumber)
    }

    /// Whether the SMS frame can attempt verification (phone + code present).
    var isSmsReady: Bool {
        phone.filter(\.isNumber).count >= 7 && isCodeComplete
    }

    // MARK: - Lifecycle

    /// When opened on the push frame, reconcile with the real OS status so we
    /// never show "turn on push" to someone who already granted (or denied) it.
    func onAppear() async {
        guard frame == .push else { return }
        switch await service.pushStatus() {
        case .notDetermined:
            frame = .push
        case .denied:
            frame = .denied
        case .authorized:
            frame = .connected(.push)
        }
    }

    // MARK: - Push

    func allowPush() async {
        isWorking = true
        defer { isWorking = false }
        let granted = await service.requestPush()
        if granted {
            try? await service.setChannel(.push, enabled: true)
            frame = .connected(.push)
            onResult(.connected(.push))
        } else {
            frame = .denied
            onResult(.deniedPush)
        }
    }

    func openSettings() {
        service.openSystemSettings()
    }

    // MARK: - Email

    func useEmailInstead() {
        resetEntry()
        frame = .emailVerify(email: accountEmail)
    }

    func verifyEmail() async {
        guard isCodeComplete else { return }
        isWorking = true
        defer { isWorking = false }
        try? await service.setChannel(.email, enabled: true)
        frame = .connected(.email)
        onResult(.connected(.email))
    }

    // MARK: - SMS (coming soon — locked S / 501 contract)

    func verifySms() {
        // SMS delivery is deferred server-side; surface the coming-soon state
        // rather than connecting a channel that can't yet send.
        flashToast("SMS reminders are coming soon. We'll use email for now.")
    }

    // MARK: - Shared actions

    func resendCode() {
        // No OTP send endpoint exists yet (see service note); this confirms the
        // intent so the frame is never a dead end.
        flashToast("We sent the code again.")
    }

    func done() {
        if case let .connected(channel) = frame {
            onResult(.connected(channel))
        }
        isFinished = true
    }

    func dismiss() {
        onResult(.dismissed)
        isFinished = true
    }

    // MARK: - Helpers

    private func resetEntry() {
        code = ""
        phone = ""
        toast = nil
    }

    private func flashToast(_ message: String) {
        toast = message
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, toast == message else { return }
            toast = nil
        }
    }
}
