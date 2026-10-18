import SwiftUI

/// Shares the existing preferences and acknowledgement with notification settings.
struct BriefingNoticeView: View {
    @State private var model = NotificationSettingsViewModel()
    private var scope: HomeClaimSessionScope {
        model.sessionScope
    }

    @State private var preferences: NotificationPreferencesDTO?
    @State private var presented = false
    @State private var managing = false
    @State private var saving = false
    @State private var acknowledged = false
    @State private var error: String?

    var body: some View {
        Color.clear.frame(width: 0, height: 0)
            .task { await load() }
            .sheet(isPresented: $presented) {
                if managing {
                    NavigationStack {
                        NotificationSettingsView { presented = false }
                    }
                } else if let preferences {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.s4) {
                            Text("Your daily briefings")
                                .font(.title2.bold())
                            Text(summary(preferences))
                            Text("Times follow your briefing location’s time zone. We only notify you when there’s something useful.")
                            Text(
                                "Change the times or turn either briefing off in Settings → Notifications. " +
                                    "Your phone also needs to allow Pantopus notifications."
                            )
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            if let error { Text(error).foregroundStyle(Theme.Color.error) }
                            PrimaryButton(title: "Manage notifications", isLoading: saving) {
                                managing = true
                            }
                            GhostButton(title: "Got it", isEnabled: !saving) {
                                presented = false
                            }
                        }
                        .padding(Spacing.s6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .foregroundStyle(Theme.Color.appText)
                    .presentationDetents([.medium, .large])
                    .interactiveDismissDisabled(saving)
                    .accessibilityIdentifier("briefingDefaultsNotice")
                    .task { _ = await recordNotice() }
                }
            }
    }

    private func summary(_ prefs: NotificationPreferencesDTO) -> String {
        let morning = prefs.dailyBriefingEnabled ? "On at \(prefs.dailyBriefingTimeLocal)" : "Off"
        let evening = prefs.eveningBriefingEnabled ? "On at \(prefs.eveningBriefingTimeLocal)" : "Off"
        return "Morning: \(morning)\nEvening: \(evening)"
    }

    private func load() async {
        do {
            try scope.requireCurrent()
            let response = try await model.readPreferences(force: true)
            try Task.checkCancellation()
            try scope.requireCurrent()
            guard response.preferences.dailyBriefingPromptedAt == nil else { return }
            preferences = response.preferences
            presented = true
        } catch { /* Try again on the next app entry; never block sign-in. */ }
    }

    @MainActor
    private func recordNotice() async -> Bool {
        if acknowledged { return scope.isCurrent }
        guard !saving else { return false }
        saving = true
        error = nil
        defer { saving = false }
        do {
            try scope.requireCurrent()
            let response = try await model.savePreferences([
                "daily_briefing_prompted": .bool(true),
                "device_timezone": .string(TimeZone.autoupdatingCurrent.identifier)
            ], generation: model.store.generation)
            try Task.checkCancellation()
            try scope.requireCurrent()
            preferences = response.preferences
            acknowledged = response.preferences.dailyBriefingPromptedAt != nil
            return acknowledged
        } catch {
            guard scope.isCurrent else { presented = false
                return false
            }
            self.error = "Couldn’t save your briefing settings. You can change them in notification settings."
            return false
        }
    }
}
