//
//  NewMessageView.swift
//  Pantopus
//
//  Contact picker for the New Message flow (T6.6b P25). Modal-style
//  top bar (Cancel + title), sticky search bar (the primary
//  affordance), then stacked card-style sections — Connections,
//  Recent, All verified — each with avatar-first contact rows. Tap a
//  row → emit a `NewMessageDestination` to the host, which pops the
//  picker and pushes the chat-conversation route in `.person` mode.
//

import SwiftUI

public struct NewMessageView: View {
    @State private var viewModel: NewMessageViewModel
    @FocusState private var searchFocused: Bool

    public init(viewModel: NewMessageViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            searchBar
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .accessibilityIdentifier("newMessage")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(alignment: .center, spacing: Spacing.s0) {
            Button { viewModel.tapCancel() } label: {
                Text("Cancel")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.primary600)
                    .padding(.horizontal, Spacing.s2)
                    .frame(height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel")
            .accessibilityIdentifier("newMessageCancel")
            Spacer(minLength: Spacing.s0)
            Text("New message")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("newMessageTitle")
            Spacer(minLength: Spacing.s0)
            // Spacer to balance the Cancel button's width and keep
            // the title visually centered.
            Color.clear.frame(width: 60, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        let hasText = !viewModel.searchText.isEmpty
        return HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, color: searchFocused ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            TextField(
                "Search by name or neighborhood",
                text: Binding(
                    get: { viewModel.searchText },
                    set: { viewModel.updateSearch($0) }
                )
            )
            .focused($searchFocused)
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.appText)
            .submitLabel(.search)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("newMessageSearchField")
            if hasText {
                Button { viewModel.clearSearch() } label: {
                    Icon(.x, size: 14, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .accessibilityIdentifier("newMessageSearchClear")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(
                    searchFocused ? Theme.Color.primary600 : Color.clear,
                    lineWidth: 1.5
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case .empty: emptyFrame
        case let .loaded(sections): loadedFrame(sections)
        case let .error(message): errorFrame(message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: 18) {
                ForEach(0..<2, id: \.self) { _ in
                    sectionSkeleton
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("newMessageLoading")
    }

    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: 10) {
            Shimmer(width: 100, height: 11, cornerRadius: Radii.xs)
                .padding(.leading, Spacing.s1)
            VStack(spacing: Spacing.s0) {
                ForEach(0..<3, id: \.self) { idx in
                    HStack(spacing: 11) {
                        Shimmer(width: 38, height: 38, cornerRadius: 19)
                        VStack(alignment: .leading, spacing: 5) {
                            Shimmer(width: 140, height: 12, cornerRadius: Radii.xs)
                            Shimmer(width: 100, height: 10, cornerRadius: Radii.xs)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    if idx < 2 {
                        Rectangle().fill(Theme.Color.appBorder.opacity(0.6)).frame(height: 1).padding(.leading, 14)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        }
    }

    private var emptyFrame: some View {
        VStack(spacing: 18) {
            Spacer()
            Icon(.search, size: 32, strokeWidth: 1.8, color: Theme.Color.primary600)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            VStack(spacing: Spacing.s2) {
                Text(viewModel.emptyHeadline)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
                    .accessibilityAddTraits(.isHeader)
                Text(viewModel.emptyBody)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
            HStack(spacing: 6) {
                ForEach(viewModel.emptySearchHints, id: \.self) { hint in
                    HStack(spacing: Spacing.s1) {
                        Icon(.search, size: 10, color: Theme.Color.appTextMuted)
                        Text(hint)
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
            }
            Button { viewModel.tapInvite() } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.userPlus, size: 15, color: Theme.Color.appText)
                    Text("Invite someone to Pantopus")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("newMessageInvite")
            Spacer()
        }
        .padding(.horizontal, Spacing.s8)
        .padding(.bottom, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("newMessageEmpty")
    }

    private func loadedFrame(_ sections: [NewMessageSection]) -> some View {
        ScrollView {
            VStack(spacing: 18) {
                ForEach(sections) { section in
                    sectionCard(section)
                }
                if sections.isEmpty {
                    searchEmptyState
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("newMessageContent")
    }

    /// Pivot used when search is active but no rows match. Distinct
    /// from the full empty frame so the search bar stays addressable.
    private var searchEmptyState: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.search, size: 28, strokeWidth: 1.8, color: Theme.Color.primary600)
                .frame(width: 56, height: 56)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("No matches")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Try a different name or neighborhood.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.top, Spacing.s10)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("newMessageNoMatches")
    }

    private func sectionCard(_ section: NewMessageSection) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Text(section.label.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.88)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("(\(section.rows.count))")
                    .font(.system(size: 11, weight: .medium))
                    .kerning(0.44)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s1)
            .padding(.top, Spacing.s1)
            .padding(.bottom, 10)
            .accessibilityIdentifier("newMessageSection_\(section.id.rawValue)")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(section.rows.enumerated()), id: \.element.id) { index, row in
                    NewMessageContactRowView(row: row) { viewModel.tap(row: row) }
                    if index < section.rows.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorder.opacity(0.6))
                            .frame(height: 1)
                            .padding(.leading, 14)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        }
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load contacts")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("newMessageRetry")
            Spacer()
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("newMessageError")
    }
}

// MARK: - Row view

private struct NewMessageContactRowView: View {
    let row: NewMessageContactRow
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: 11) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let locality = row.locality {
                        HStack(spacing: Spacing.s1) {
                            Icon(.mapPin, size: 10, color: Theme.Color.appTextSecondary)
                            Text(locality)
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    if let sub = row.sub {
                        HStack(spacing: Spacing.s1) {
                            if let icon = row.subIcon {
                                Icon(icon, size: 10, color: Theme.Color.appTextMuted)
                            }
                            Text(sub)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextMuted)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            .frame(minHeight: 56)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("newMessageRow_\(row.userId)")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.Color.primary500)
                Text(row.initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 38, height: 38)
            if row.verified {
                Icon(.check, size: 8, strokeWidth: 3.5, color: Theme.Color.appTextInverse)
                    .frame(width: 14, height: 14)
                    .background(badgeColor)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 2, y: 2)
            }
        }
        .frame(width: 42, height: 42)
    }

    private var badgeColor: Color {
        switch row.identity {
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    private var accessibilityLabel: String {
        var parts = [row.name]
        if let locality = row.locality { parts.append(locality) }
        if let sub = row.sub { parts.append(sub) }
        if row.verified { parts.append("verified") }
        return parts.joined(separator: ", ")
    }
}
