//
//  SavedPlaceRootView.swift
//  Pantopus
//
//  The Place tab for someone who saved their address privately but has no
//  Home yet: their address, one next step (set it up as their Home), and
//  what's public about it. They are never asked for the address again.
//  The facts are the preview's own (`PlacePreviewContent`), read for the
//  saved point by `GET /api/saved-places/:id/preview`; nothing is kept on
//  the phone.
//

import SwiftUI

@Observable
@MainActor
final class SavedPlaceRootViewModel {
    enum State {
        case loading
        case loaded(PlacePreview)
        case error
    }

    let place: SavedPlaceDTO
    private(set) var state: State = .loading
    private(set) var isRefreshing = false
    private let api: APIClient

    init(place: SavedPlaceDTO, api: APIClient = .shared) {
        self.place = place
        self.api = api
    }

    /// A failed re-read keeps the facts already on screen.
    func load() async {
        do {
            let preview: PlacePreview = try await api.request(SavedPlacesEndpoints.preview(id: place.id))
            state = .loaded(preview)
        } catch {
            guard !(error is CancellationError) else { return }
            if case .loaded = state { return }
            state = .error
        }
    }

    func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        await load()
    }
}

struct SavedPlaceRootView: View {
    @State private var viewModel: SavedPlaceRootViewModel
    private let unreadCount: Int
    private let scrollToTop: UUID?
    private let onOpenNotifications: () -> Void
    private let onOpenMenu: () -> Void
    private let onSetUpHome: () -> Void
    private let onLookUpAddress: () -> Void

    init(
        viewModel: SavedPlaceRootViewModel,
        unreadCount: Int,
        scrollToTop: UUID?,
        onOpenNotifications: @escaping () -> Void,
        onOpenMenu: @escaping () -> Void,
        onSetUpHome: @escaping () -> Void,
        onLookUpAddress: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.unreadCount = unreadCount
        self.scrollToTop = scrollToTop
        self.onOpenNotifications = onOpenNotifications
        self.onOpenMenu = onOpenMenu
        self.onSetUpHome = onSetUpHome
        self.onLookUpAddress = onLookUpAddress
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                        .id(Self.topAnchor)
                    nextStep
                        .padding(.top, Spacing.s4)
                    content
                }
                .padding(.horizontal, 16)
                .padding(.bottom, Spacing.s10)
            }
            .onChange(of: scrollToTop) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(Self.topAnchor, anchor: .top) }
            }
        }
        .background(Theme.Color.appBg)
        // With the navigation bar hidden the content slid under the status
        // bar; this zero-height inset paints the app background there.
        .safeAreaInset(edge: .top, spacing: 0) {
            Color.clear.frame(height: 0).background(Theme.Color.appBg.ignoresSafeArea(edges: .top))
        }
        .toolbar(.hidden, for: .navigationBar)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.savedRoot")
    }

    private static let topAnchor = "place.savedRoot.top"

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Your Place")
                    .font(.system(size: 28, weight: .bold))
                    .kerning(-0.56)
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: 5) {
                    Icon(.mapPin, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    Text(viewModel.place.label)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .accessibilityElement(children: .combine)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 0) {
                PlaceBellButton(unreadCount: unreadCount, action: onOpenNotifications)
                Button(action: onOpenMenu) {
                    Icon(.menu, size: 20, color: Theme.Color.appText)
                        .frame(width: Spacing.s12, height: Spacing.s12)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Menu")
                .accessibilityIdentifier("place.menu")
            }
        }
        .padding(.horizontal, 2)
        .padding(.top, Spacing.s2)
    }

    /// The one next step: make the saved address their Home.
    private var nextStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Theme.Color.homeBg)
                    Icon(.home, size: 20, strokeWidth: 2, color: Theme.Color.home)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Is this your home?")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("Set it up for pickup and radon reminders and your household's tasks.")
                        .font(.system(size: 13.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            PrimaryButton(title: "Set up this Home") { onSetUpHome() }
                .accessibilityIdentifier("place.savedRoot.setUp")
            Button(action: onLookUpAddress) {
                Text("Look up a different address")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("place.savedRoot.lookUp")
            HStack(spacing: 6) {
                Icon(.shieldCheck, size: 14, strokeWidth: 2.25, color: Theme.Color.home)
                Text("Saved privately. Only you can see it.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityElement(children: .combine)
        }
        .padding(Spacing.s4)
        .placeCard()
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { _ in
                    PlaceSkeleton(widthFraction: 1, height: 76, radius: 16)
                }
            }
            .padding(.top, 20)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading what's public about this address")
        case let .loaded(preview):
            if preview.status == .couldNotPlace || preview.status == .unsupportedRegion {
                Text(preview.message ?? "We couldn't place this address.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 20)
            } else {
                PlacePreviewContent(
                    preview: preview,
                    showsLocked: false,
                    onAction: onSetUpHome,
                    onRetry: { Task { await viewModel.refresh() } },
                    retrying: viewModel.isRefreshing
                )
            }
        case .error:
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Couldn't load what's public about this address.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Button("Try again") { Task { await viewModel.refresh() } }
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("place.savedRoot.retry")
            }
            .padding(.top, 20)
        }
    }
}
