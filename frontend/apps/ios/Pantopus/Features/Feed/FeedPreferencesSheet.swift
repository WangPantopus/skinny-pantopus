//
//  FeedPreferencesSheet.swift
//  Pantopus
//
//  Pulse Preferences — the bottom sheet behind the Pulse header's
//  preferences control. Mirrors RN
//  `src/components/feed/FeedPreferencesSheet.tsx`: two Place-feed toggles
//  (deals, safety alerts) plus a single political-content toggle that
//  writes both the Place and Connections columns.
//  Backed by `GET`/`PUT /api/posts/feed-preferences`
//  (`backend/routes/posts.js:2257` / `:2286`). Below them, the Pulse topics
//  this person muted from a post's menu, each with Unmute (Pulse S4;
//  `GET`/`DELETE /api/posts/mute`).
//

import Foundation
import Logging
import Observation
import SwiftUI

/// Render state for the Pulse preferences sheet.
public enum FeedPreferencesState: Sendable, Equatable {
    case loading
    case loaded(FeedPreferencesDTO)
    case error(message: String)
}

/// The Pulse topics this person muted, as the sheet lists them.
public enum MutedTopicsState: Sendable, Equatable {
    case loading
    case loaded([TopicMuteDTO])
    case error
}

/// Loads + patches the signed-in user's feed preferences.
@Observable
@MainActor
public final class FeedPreferencesViewModel {
    public private(set) var state: FeedPreferencesState = .loading
    /// True while a `PUT` is in flight — disables the rows.
    public private(set) var isSaving = false
    /// Last save error, cleared when the user tries another change.
    public var toastMessage: String?
    /// The muted Pulse topics (Pulse S4).
    public private(set) var mutedTopics: MutedTopicsState = .loading

    private let api: APIClient
    private let moderation: FeedModerationStore
    private let logger = Logger(label: "app.pantopus.ios.FeedPreferences")

    init(api: APIClient = .shared, moderation: FeedModerationStore = .shared) {
        self.api = api
        self.moderation = moderation
    }

    /// `GET /api/posts/feed-preferences`.
    public func load() async {
        if case .loaded = state { return }
        await refresh()
    }

    /// Retry / re-fetch.
    public func refresh() async {
        state = .loading
        do {
            let response: FeedPreferencesResponse = try await api.request(
                FeedActionsEndpoints.feedPreferences()
            )
            state = .loaded(response.preferences)
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load preferences."
            state = .error(message: message)
        }
    }

    /// Show / hide local business deals on the Place surface. The backend
    /// column is `hide_deals_place`, so the switch is inverted.
    public func setShowDeals(_ show: Bool) async {
        await update(FeedPreferencesUpdateRequest(hideDealsPlace: !show))
    }

    /// Show / hide safety alerts on the Place surface.
    public func setShowAlerts(_ show: Bool) async {
        await update(FeedPreferencesUpdateRequest(hideAlertsPlace: !show))
    }

    /// One switch writes both political-content columns — RN does the same
    /// (`FeedPreferencesSheet.tsx:112-115`).
    public func setShowPolitics(_ show: Bool) async {
        await update(
            FeedPreferencesUpdateRequest(
                showPoliticsConnections: show,
                showPoliticsPlace: show
            )
        )
    }

    /// `GET /api/posts/mute` → `topic_mutes`, including the shipping feed's post categories.
    public func loadMutedTopics() async {
        mutedTopics = .loading
        do {
            let response: MutedEntitiesResponse = try await api.request(FeedActionsEndpoints.mutedEntities())
            mutedTopics = .loaded(response.topicMutes.filter {
                LaunchFeatures.pulseRedesign || PulseTopic(stored: $0.topic) == nil
            })
        } catch {
            mutedTopics = .error
        }
    }

    /// `DELETE /api/posts/mute` for one topic mute: the row leaves at once and
    /// comes back if the call fails. True once the server took it.
    public func unmute(_ mute: TopicMuteDTO) async -> Bool {
        guard case let .loaded(current) = mutedTopics, !isSaving else { return false }
        toastMessage = nil
        isSaving = true
        defer { isSaving = false }
        mutedTopics = .loaded(current.filter { $0 != mute })
        do {
            _ = try await api.request(
                FeedActionsEndpoints.unmutePulseTopic(mute.topic, areaId: mute.areaId),
                as: PostActionAckResponse.self
            )
            moderation.removeTopicMute(mute.topic)
            moderation.removePostTypeMute(mute.topic)
            // Saved feed pages were read without this topic's posts.
            ScreenStore.store(for: api).markStale(topics: [ScreenTopic.posts])
            PulsePostsRefresh.notifyPostsDidChange()
            return true
        } catch {
            mutedTopics = .loaded(current)
            toastMessage = "Couldn't unmute that category or topic. Try again."
            return false
        }
    }

    private func update(_ body: FeedPreferencesUpdateRequest) async {
        guard case let .loaded(current) = state, !isSaving else { return }
        toastMessage = nil
        isSaving = true
        defer { isSaving = false }
        // Optimistic — the row reflects the tap straight away.
        state = .loaded(Self.merged(current, with: body))
        do {
            let response: FeedPreferencesResponse = try await api.request(
                FeedActionsEndpoints.updateFeedPreferences(body)
            )
            state = .loaded(response.preferences)
        } catch {
            logger.warning("Feed preference update failed: \(error)")
            state = .loaded(current)
            toastMessage = "Couldn't save that preference."
        }
    }

    private static func merged(
        _ current: FeedPreferencesDTO,
        with patch: FeedPreferencesUpdateRequest
    ) -> FeedPreferencesDTO {
        FeedPreferencesDTO(
            hideDealsPlace: patch.hideDealsPlace ?? current.hideDealsPlace,
            hideAlertsPlace: patch.hideAlertsPlace ?? current.hideAlertsPlace,
            showPoliticsConnections: patch.showPoliticsConnections ?? current.showPoliticsConnections,
            showPoliticsPlace: patch.showPoliticsPlace ?? current.showPoliticsPlace,
            sports: current.sports
        )
    }
}

/// Bottom sheet body for Pulse Preferences.
public struct FeedPreferencesSheet: View {
    @State private var viewModel: FeedPreferencesViewModel
    private let onClose: @MainActor () -> Void
    /// Fired after any successful write so the host feed can refetch —
    /// RN's `onPrefsChanged` → `feed.onRefresh()`.
    private let onPrefsChanged: @MainActor () -> Void

    init(
        viewModel: FeedPreferencesViewModel? = nil,
        onClose: @escaping @MainActor () -> Void,
        onPrefsChanged: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel ?? FeedPreferencesViewModel())
        self.onClose = onClose
        self.onPrefsChanged = onPrefsChanged
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            if let message = viewModel.toastMessage {
                Text(message)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.vertical, Spacing.s2)
                    .accessibilityIdentifier("pulsePreferencesSaveError")
            }
            // Scrolls once the muted topics or a large text size need the room.
            ScrollView(.vertical, showsIndicators: true) {
                content
                    .padding(.bottom, Spacing.s5)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        // Muted topics are the redesign's (Pulse S4, launch cut #11).
        .task { await viewModel.loadMutedTopics() }
        .accessibilityIdentifier("pulsePreferencesSheet")
    }

    private var header: some View {
        HStack {
            Text("Pulse Preferences")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button(action: onClose) {
                Icon(.x, size: 18, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close preferences")
            .accessibilityIdentifier("pulsePreferencesClose")
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s3)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .loaded(prefs):
            loadedFrame(prefs)
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 56, cornerRadius: Radii.sm)
            }
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s4)
        .accessibilityIdentifier("pulsePreferencesLoading")
    }

    private func loadedFrame(_ prefs: FeedPreferencesDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionLabel("PLACE FEED")
            preferenceRow(
                title: "Show deals",
                body: "Deals and promotions from local businesses",
                isOn: !prefs.hideDealsPlace,
                identifier: "pulsePreferencesShowDeals"
            ) { next in
                await viewModel.setShowDeals(next)
                onPrefsChanged()
            }
            preferenceRow(
                title: "Show safety alerts",
                body: "Hazards, outages and safety warnings",
                isOn: !prefs.hideAlertsPlace,
                identifier: "pulsePreferencesShowAlerts"
            ) { next in
                await viewModel.setShowAlerts(next)
                onPrefsChanged()
            }
            sectionLabel("CONTENT")
            preferenceRow(
                title: "Show political content",
                body: "Political posts are hidden by default to keep your feed focused"
                    + " on neighborhood life",
                isOn: prefs.showPoliticsPlace,
                identifier: "pulsePreferencesShowPolitics"
            ) { next in
                await viewModel.setShowPolitics(next)
                onPrefsChanged()
            }
            mutedTopicsSection
            HStack(spacing: Spacing.s2) {
                Icon(.info, size: 13, color: Theme.Color.appTextMuted)
                Text("These preferences sync across all your devices.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.top, Spacing.s5)
        }
        .padding(.horizontal, Spacing.s5)
        .accessibilityIdentifier("pulsePreferencesLoaded")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 32, color: Theme.Color.error)
            Text("Couldn't load preferences")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 40)
                    .background(Theme.Color.primarySolid)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulsePreferencesRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s5)
        .accessibilityIdentifier("pulsePreferencesError")
    }

    // MARK: - Muted topics (Pulse S4)

    private var mutedTopicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text(LaunchFeatures.pulseRedesign ? "MUTED TOPICS & CATEGORIES" : "MUTED CATEGORIES")
                .pulseFont(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityAddTraits(.isHeader)
                .padding(.top, Spacing.s5)
                .padding(.bottom, Spacing.s2)
            switch viewModel.mutedTopics {
            case .loading:
                Shimmer(height: 44, cornerRadius: Radii.sm)
            case let .loaded(mutes) where mutes.isEmpty:
                Text(LaunchFeatures.pulseRedesign ? "No muted topics or categories." : "No muted categories.")
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s2)
            case let .loaded(mutes):
                ForEach(mutes) { mute in
                    mutedTopicRow(mute)
                }
            case .error:
                HStack(spacing: Spacing.s3) {
                    Text("Couldn't load your mutes.")
                        .pulseFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s2)
                    Button("Try again") {
                        Task { await viewModel.loadMutedTopics() }
                    }
                    .pulseFont(.button)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("pulsePreferencesMutedTopicsRetry")
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulsePreferencesMutedTopics")
    }

    private func mutedTopicRow(_ mute: TopicMuteDTO) -> some View {
        let topic = PulseTopic(stored: mute.topic)
        let name = topic?.label ?? mute.topic.replacingOccurrences(of: "_", with: " ").capitalized
        let scope = topic == nil ? "Post category · Unmute in all feeds" : (mute.areaId == nil ? "Everywhere" : "In one area")
        return HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appText)
                Text(scope)
                    .pulseFont(.footnote)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityElement(children: .combine)
            Spacer(minLength: Spacing.s2)
            Button {
                Task {
                    if await viewModel.unmute(mute) {
                        onPrefsChanged()
                    }
                }
            } label: {
                Text("Unmute")
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .padding(.horizontal, Spacing.s2)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isSaving)
            .accessibilityLabel("Unmute \(name)")
            .accessibilityIdentifier("pulsePreferencesUnmuteTopic_\(mute.topic)")
        }
        .padding(.vertical, Spacing.s1)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("pulsePreferencesMutedTopic_\(mute.topic)")
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .tracking(1)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s2)
    }

    private func preferenceRow(
        title: String,
        body: String,
        isOn: Bool,
        identifier: String,
        onChange: @escaping @MainActor (Bool) async -> Void
    ) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Toggle(
                "",
                isOn: Binding(
                    get: { isOn },
                    set: { next in Task { await onChange(next) } }
                )
            )
            .labelsHidden()
            .tint(Theme.Color.primary600)
            .disabled(viewModel.isSaving)
            .accessibilityLabel(title)
            .accessibilityIdentifier(identifier)
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

#Preview {
    FeedPreferencesSheet {}
}
