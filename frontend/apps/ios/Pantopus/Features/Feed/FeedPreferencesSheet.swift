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
//  (`backend/routes/posts.js:2257` / `:2286`).
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

/// Loads + patches the signed-in user's feed preferences.
@Observable
@MainActor
public final class FeedPreferencesViewModel {
    public private(set) var state: FeedPreferencesState = .loading
    /// True while a `PUT` is in flight — disables the rows.
    public private(set) var isSaving = false
    /// Transient error banner text.
    public var toastMessage: String?

    private let api: APIClient
    private let logger = Logger(label: "app.pantopus.ios.FeedPreferences")

    init(api: APIClient = .shared) {
        self.api = api
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

    private func update(_ body: FeedPreferencesUpdateRequest) async {
        guard case let .loaded(current) = state, !isSaving else { return }
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
            showPoliticsPlace: patch.showPoliticsPlace ?? current.showPoliticsPlace
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
            content
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
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
                body: "Crime reports, hazards, and safety warnings",
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
            HStack(spacing: Spacing.s2) {
                Icon(.info, size: 13, color: Theme.Color.appTextMuted)
                Text("These preferences sync across all your devices.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.top, Spacing.s5)
            if let toast = viewModel.toastMessage {
                Text(toast)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .padding(.top, Spacing.s2)
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        viewModel.toastMessage = nil
                    }
            }
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
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulsePreferencesRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s5)
        .accessibilityIdentifier("pulsePreferencesError")
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
