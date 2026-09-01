//
//  RebookRailView.swift
//  Pantopus
//
//  "Rebook a favorite helper" rail — a horizontal card row of the
//  poster's recently-completed tasks with the worker who did them and a
//  one-tap Rebook CTA that opens the composer prefilled with the task
//  title. Mirrors RN `components/gigs/RebookSection.tsx`, mounted above
//  the My tasks list.
//
//  Backend: `GET /api/gigs/rebookable` (`backend/routes/gigs.js:2885`).
//  The rail renders nothing until loaded and nothing when the server
//  returns an empty list — it is an opportunistic accessory, not a
//  primary surface, so it carries no empty/error state of its own
//  (matching RN's silent-catch behaviour).
//

import Foundation
import Observation
import SwiftUI

// MARK: - View model

@Observable
@MainActor
public final class RebookRailViewModel {
    public enum State: Sendable, Equatable {
        case loading
        case loaded([RebookableGigDTO])
        /// Fetch failed — the rail hides itself rather than shouting.
        case unavailable
    }

    public private(set) var state: State = .loading

    private let api: APIClient
    private var loadedOnce = false

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// `true` only when the server actually returned rebookable tasks.
    public var isVisible: Bool {
        if case let .loaded(items) = state { return !items.isEmpty }
        return false
    }

    public var items: [RebookableGigDTO] {
        if case let .loaded(items) = state { return items }
        return []
    }

    public func load() async {
        guard !loadedOnce else { return }
        loadedOnce = true
        await refresh()
    }

    public func refresh() async {
        do {
            let response: RebookableGigsResponse = try await api.request(GigExtrasEndpoints.rebookable())
            state = .loaded(response.rebookable)
        } catch {
            state = .unavailable
        }
    }

    // MARK: - Pure projections (test surface)

    /// "Mar 4" — the completion date under the category/price line.
    public static func completedLabel(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    /// `$60` for whole dollars, `$62.50` otherwise — RN `formatPrice`.
    public static func priceLabel(_ price: Double?) -> String? {
        guard let price else { return nil }
        if price == price.rounded() { return "$\(Int(price))" }
        return String(format: "$%.2f", price)
    }

    /// "Cleaning · $60" — category and price, either half optional.
    public static func taskLabel(category: String?, price: Double?) -> String {
        let parts = [
            GigsCategory.from(backendKey: category).label,
            priceLabel(price)
        ].compactMap { $0 }
        return parts.joined(separator: " · ")
    }

    /// "4.9" — one decimal, or an em dash when the worker has no rating.
    public static func ratingLabel(_ rating: Double?) -> String {
        guard let rating, rating > 0 else { return "\u{2014}" }
        return String(format: "%.1f", rating)
    }
}

// MARK: - View

/// Horizontal rail of rebookable tasks. Collapses to nothing while
/// loading, on failure, and when the list is empty.
public struct RebookRailView: View {
    @State private var viewModel: RebookRailViewModel
    private let onRebook: @MainActor (RebookableGigDTO) -> Void

    /// Not `public`: the default argument constructs a `RebookRailViewModel`,
    /// whose init is internal because it takes an internal `APIClient`.
    init(
        viewModel: RebookRailViewModel = RebookRailViewModel(),
        onRebook: @escaping @MainActor (RebookableGigDTO) -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onRebook = onRebook
    }

    public var body: some View {
        Group {
            if viewModel.isVisible {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    header
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.s2) {
                            ForEach(viewModel.items) { gig in
                                card(gig)
                            }
                        }
                        .padding(.horizontal, Spacing.s4)
                    }
                }
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s2)
                .accessibilityIdentifier("rebookRail")
            }
        }
        .task { await viewModel.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Rebook a favorite helper")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("One tap to rehire")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("rebookRailHeader")
    }

    private func card(_ gig: RebookableGigDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            workerRow(gig)
            HStack(spacing: 3) {
                Icon(.star, size: 12, strokeWidth: 2.2, color: Theme.Color.warning)
                Text(RebookRailViewModel.ratingLabel(gig.worker?.rating))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(RebookRailViewModel.taskLabel(category: gig.category, price: gig.price))
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            if let completed = RebookRailViewModel.completedLabel(gig.completedAt) {
                Text(completed)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Button {
                onRebook(gig)
            } label: {
                HStack(spacing: 4) {
                    Icon(.arrowsRepeat, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                    Text("Rebook")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("rebookRail.\(gig.id).rebook")
        }
        .padding(Spacing.s3)
        .frame(width: 152, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("rebookRail.\(gig.id)")
    }

    private func workerRow(_ gig: RebookableGigDTO) -> some View {
        HStack(spacing: Spacing.s2) {
            avatar(gig.worker)
            Text(gig.worker?.displayName ?? "Helper")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
        }
    }

    @ViewBuilder private func avatar(_ worker: RebookableWorkerDTO?) -> some View {
        if let raw = worker?.avatarUrl, let url = URL(string: raw) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                initialsAvatar(worker)
            }
            .frame(width: 40, height: 40)
            .clipShape(Circle())
        } else {
            initialsAvatar(worker)
        }
    }

    private func initialsAvatar(_ worker: RebookableWorkerDTO?) -> some View {
        ZStack {
            Circle().fill(Theme.Color.personalBg)
            Text(worker?.initials ?? "?")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.primary600)
        }
        .frame(width: 40, height: 40)
    }
}
