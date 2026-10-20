import SwiftUI

/// Shares the existing preferences and acknowledgement with notification settings.
/// It also asks once about Suggestions from Pantopus (AI assistant phase 2
/// contract §3.4) while the server holds no answer, after the briefing notice
/// when both are due.
struct BriefingNoticeView: View {
    @State private var model = NotificationSettingsViewModel()
    private var scope: HomeClaimSessionScope {
        model.sessionScope
    }

    private struct Notice: Identifiable {
        enum Kind { case briefing, suggestions }
        let id = UUID()
        let kind: Kind
        var preferences: NotificationPreferencesDTO
    }

    @State private var notice: Notice?
    @State private var managing = false
    @State private var saving = false
    @State private var acknowledged = false
    @State private var error: String?
    /// The Suggestions notice waits for the briefing notice to close.
    @State private var suggestionsDue = false
    @State private var suggestionsError: String?

    var body: some View {
        Color.clear.frame(width: 0, height: 0)
            .task { await load() }
            .sheet(item: $notice, onDismiss: presentSuggestionsIfDue) { shown in
                if shown.kind == .suggestions {
                    suggestionsNotice
                } else if managing {
                    NavigationStack {
                        NotificationSettingsView { notice = nil }
                    }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.s4) {
                            Text("Your daily briefings")
                                .font(.title2.bold())
                            Text(summary(shown.preferences))
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
                                notice = nil
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

    /// "Turn on" and "Not now" each save the answer; the notice never comes
    /// back once the server holds one.
    private var suggestionsNotice: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                HStack(spacing: Spacing.s2) {
                    AskPantopusGlyph(size: 20)
                    Text(NotificationSettingsViewModel.suggestionsTitle)
                        .font(.title2.bold())
                }
                Text(NotificationSettingsViewModel.suggestionsCaption)
                Text("You can change this in Settings → Notifications.")
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let suggestionsError { Text(suggestionsError).foregroundStyle(Theme.Color.error) }
                PrimaryButton(title: "Turn on", isLoading: saving) {
                    await answerSuggestions(true)
                }
                .accessibilityIdentifier("suggestionsNoticeTurnOn")
                GhostButton(title: "Not now", isEnabled: !saving) {
                    await answerSuggestions(false)
                }
                .accessibilityIdentifier("suggestionsNoticeNotNow")
            }
            .padding(Spacing.s6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .foregroundStyle(Theme.Color.appText)
        .presentationDetents([.medium, .large])
        // One tap answers it; closing it without one would only bring it back.
        .interactiveDismissDisabled()
        .accessibilityIdentifier("suggestionsNotice")
    }

    private func summary(_ prefs: NotificationPreferencesDTO) -> String {
        let morning = prefs.dailyBriefingEnabled ? "On at \(prefs.dailyBriefingTimeLocal)" : "Off"
        let evening = prefs.eveningBriefingEnabled ? "On at \(prefs.eveningBriefingTimeLocal)" : "Off"
        return "Morning: \(morning)\nEvening: \(evening)"
    }

    /// Asked while the server knows the switch and holds no answer.
    private static func asksAboutSuggestions(_ prefs: NotificationPreferencesDTO) -> Bool {
        prefs.suggestionsSupported && prefs.suggestionsEnabled == nil
    }

    private func load() async {
        do {
            try scope.requireCurrent()
            let response = try await model.readPreferences(force: true)
            try Task.checkCancellation()
            try scope.requireCurrent()
            let prefs = response.preferences
            if prefs.dailyBriefingPromptedAt == nil {
                suggestionsDue = Self.asksAboutSuggestions(prefs)
                notice = Notice(kind: .briefing, preferences: prefs)
            } else if Self.asksAboutSuggestions(prefs) {
                notice = Notice(kind: .suggestions, preferences: prefs)
            }
        } catch { /* Try again on the next app entry; never block sign-in. */ }
    }

    /// After the briefing notice: the Suggestions notice, unless Settings
    /// (reached from "Manage notifications") answered it meanwhile.
    private func presentSuggestionsIfDue() {
        guard suggestionsDue else { return }
        suggestionsDue = false
        guard scope.isCurrent, let prefs = model.storedPreferences(), Self.asksAboutSuggestions(prefs) else { return }
        managing = false
        notice = Notice(kind: .suggestions, preferences: prefs)
    }

    @MainActor
    private func answerSuggestions(_ isOn: Bool) async {
        guard !saving else { return }
        saving = true
        suggestionsError = nil
        defer { saving = false }
        do {
            try scope.requireCurrent()
            _ = try await model.savePreferences(["suggestions_enabled": .bool(isOn)], generation: model.store.generation)
            try scope.requireCurrent()
            notice = nil
        } catch {
            // "Not now" closes anyway: the notice asks again on the next launch.
            guard scope.isCurrent, isOn else {
                notice = nil
                return
            }
            suggestionsError = "Couldn’t turn on Suggestions. You can turn them on in Settings → Notifications."
        }
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
            notice?.preferences = response.preferences
            acknowledged = response.preferences.dailyBriefingPromptedAt != nil
            return acknowledged
        } catch {
            guard scope.isCurrent else { notice = nil
                return false
            }
            self.error = "Couldn’t save your briefing settings. You can change them in notification settings."
            return false
        }
    }
}
