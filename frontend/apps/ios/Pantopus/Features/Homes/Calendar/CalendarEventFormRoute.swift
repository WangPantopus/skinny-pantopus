//
//  CalendarEventFormRoute.swift
//  Pantopus
//
//  P2.7 — Routing helper for the Add / Edit Event form. The form
//  view-model hydrates from a `CalendarEventDTO` synchronously, but the
//  detail endpoint doesn't exist server-side today. When the host pushes
//  in edit mode with just an `eventId`, this wrapper fetches the parent
//  events list to find the row, then renders the form. For create mode
//  the wrapper is a thin pass-through.
//

import SwiftUI

@MainActor
struct CalendarEventFormRoute: View {
    private let homeId: String
    private let eventId: String?
    private let prefilledCategory: String?
    private let api: APIClient
    private let onClose: @MainActor () -> Void
    private let onCommitted: @MainActor (AddEventFormEvent) -> Void

    @State private var prefetch: PrefetchState

    init(
        homeId: String,
        eventId: String?,
        prefilledCategory: String? = nil,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void,
        onCommitted: @escaping @MainActor (AddEventFormEvent) -> Void
    ) {
        self.homeId = homeId
        self.eventId = eventId
        self.prefilledCategory = prefilledCategory
        self.api = api
        self.onClose = onClose
        self.onCommitted = onCommitted
        _prefetch = State(initialValue: eventId == nil ? .ready(nil) : .loading)
    }

    var body: some View {
        Group {
            switch prefetch {
            case let .ready(editing):
                AddEventFormView(
                    homeId: homeId,
                    editingEvent: editing,
                    prefilledCategory: editing == nil
                        ? prefilledCategory.flatMap { CalendarEventCategory.from(eventType: $0) }
                        : nil,
                    api: api,
                    onClose: onClose,
                    onCommitted: onCommitted
                )
            case .loading:
                LoadingShell(title: "Loading event", onClose: onClose)
            case let .error(message):
                ErrorShell(message: message, onClose: onClose) {
                    await prefetchEditing()
                }
            }
        }
        .task {
            if eventId != nil, case .loading = prefetch {
                await prefetchEditing()
            }
        }
    }

    private func prefetchEditing() async {
        guard let eventId else { return }
        prefetch = .loading
        do {
            let response: GetHomeEventsResponse = try await api.request(
                HomesEndpoints.homeEvents(homeId: homeId)
            )
            guard let match = response.events.first(where: { $0.id == eventId }) else {
                prefetch = .error(message: "This event is no longer available.")
                return
            }
            prefetch = .ready(match)
        } catch {
            prefetch = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this event."
            )
        }
    }

    enum PrefetchState: Equatable {
        case loading
        case ready(CalendarEventDTO?)
        case error(message: String)
    }
}

private struct LoadingShell: View {
    let title: String
    let onClose: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Button {
                    onClose()
                } label: {
                    Icon(.x, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close")
                Spacer()
                Text(title)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 80, cornerRadius: Radii.lg)
                Shimmer(height: 200, cornerRadius: Radii.lg)
                Shimmer(height: 100, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s4)
            Spacer()
        }
        .background(Theme.Color.appBg)
    }
}

private struct ErrorShell: View {
    let message: String
    let onClose: @MainActor () -> Void
    let onRetry: @MainActor () async -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Button {
                    onClose()
                } label: {
                    Icon(.x, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close")
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this event",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await onRetry() }
            )
            Spacer()
        }
        .background(Theme.Color.appBg)
    }
}
