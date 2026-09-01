//
//  FindHomeView.swift
//  Pantopus
//
//  A12.1 "Find or Add Home" — the discovery surface RN reaches from
//  `homes/find`. Search public-preview homes, tap one to start an
//  ownership claim, add the missing address, or paste an invite code.
//
// swiftlint:disable type_body_length

import SwiftUI

@MainActor
public struct FindHomeView: View {
    @State private var viewModel: FindHomeViewModel
    @State private var presentedInviteToken: FindHomeInviteToken?
    @FocusState private var searchFocused: Bool

    private let onBack: @MainActor () -> Void
    private let onOpenClaimOwnership: @MainActor (String) -> Void
    private let onOpenAddHome: @MainActor () -> Void

    init(
        api: APIClient = .shared,
        onBack: @escaping @MainActor () -> Void,
        onOpenClaimOwnership: @escaping @MainActor (String) -> Void,
        onOpenAddHome: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: FindHomeViewModel(api: api))
        self.onBack = onBack
        self.onOpenClaimOwnership = onOpenClaimOwnership
        self.onOpenAddHome = onOpenAddHome
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            searchHeader
            resultsArea
            inviteSection
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onChange(of: viewModel.pendingEvent) { _, event in handle(event) }
        .onAppear { searchFocused = true }
        // Reuse the shared T3.5 Token / Accept surface rather than
        // re-implementing accept / decline here.
        .fullScreenCover(item: $presentedInviteToken) { item in
            TokenAcceptView(
                viewModel: TokenAcceptViewModel(
                    token: item.token,
                    onAccepted: { _ in presentedInviteToken = nil },
                    onDeclined: { presentedInviteToken = nil }
                )
            )
        }
        .accessibilityIdentifier("findHome")
    }

    // MARK: - Chrome

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("findHomeBack")

            Text("Find or Add Home")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private var searchHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.search, size: 18, color: Theme.Color.appTextSecondary)
                TextField(
                    "Search address (street + city + zip)",
                    text: Binding(
                        get: { viewModel.query },
                        set: { viewModel.updateQuery($0) }
                    )
                )
                .font(.system(size: 15))
                .foregroundStyle(Theme.Color.appText)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .focused($searchFocused)
                .onSubmit { viewModel.submitSearch() }
                .accessibilityIdentifier("findHomeSearchField")

                if !viewModel.query.isEmpty {
                    Button { viewModel.clearQuery() } label: {
                        Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                    .accessibilityIdentifier("findHomeSearchClear")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            }

            if case let .idle(hint) = viewModel.state, let hint {
                Text(hint)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.leading, Spacing.s1)
                    .accessibilityIdentifier("findHomeSearchHint")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
    }

    // MARK: - Result phases

    @ViewBuilder
    private var resultsArea: some View {
        switch viewModel.state {
        case .idle:
            idleFrame
        case .loading:
            shimmerFrame
        case let .loaded(homes):
            resultsList(homes)
        case .empty:
            emptyFrame
        case let .error(message):
            errorFrame(message)
        }
    }

    private var idleFrame: some View {
        VStack(spacing: Spacing.s3) {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .search,
                headline: "Search for your home",
                subcopy: "Enter a street address, city, or ZIP to find a home that's already on Pantopus.",
                cta: EmptyState.CTA(title: "Add missing address") {
                    await MainActor.run { viewModel.addMissingHome() }
                },
                tint: Theme.Color.homeBg,
                accent: Theme.Color.home
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("findHomeIdle")
    }

    private var shimmerFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 40, height: 40, cornerRadius: Radii.md)
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Shimmer(width: 190, height: 14)
                            Shimmer(width: 120, height: 12)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("findHomeLoading")
    }

    private func resultsList(_ homes: [DiscoveredHomeDTO]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s2) {
                ForEach(homes) { home in
                    FindHomeResultRow(home: home) { viewModel.selectHome(home) }
                }
                addMissingLink
                    .padding(.top, Spacing.s2)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s4)
        }
        .refreshable { await viewModel.refresh() }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("findHomeResults")
    }

    private var emptyFrame: some View {
        VStack(spacing: Spacing.s3) {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .home,
                headline: "No homes found",
                subcopy: "We couldn't find a home matching that address. Add it and we'll verify it with you.",
                cta: EmptyState.CTA(title: "Add missing address") {
                    await MainActor.run { viewModel.addMissingHome() }
                },
                tint: Theme.Color.homeBg,
                accent: Theme.Color.home
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("findHomeEmpty")
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer(minLength: Spacing.s0)
            Icon(.alertCircle, size: 32, color: Theme.Color.error)
            Text("Couldn't search homes")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s10)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Retry")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("findHomeRetry")
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("findHomeError")
    }

    private var addMissingLink: some View {
        Button { viewModel.addMissingHome() } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.plusCircle, size: 16, color: Theme.Color.primary600)
                Text("Add missing address")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 44)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("findHomeAddMissing")
    }

    // MARK: - Invite code

    private var inviteSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Button { viewModel.toggleInviteSection() } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.scanLine, size: 18, color: Theme.Color.primary600)
                    Text("Have an invite code?")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.primary600)
                    Spacer(minLength: Spacing.s0)
                    Icon(
                        viewModel.isInviteSectionExpanded ? .chevronUp : .chevronDown,
                        size: 16,
                        color: Theme.Color.primary600
                    )
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                viewModel.isInviteSectionExpanded ? "Hide invite code field" : "Enter an invite code"
            )
            .accessibilityIdentifier("findHomeInviteToggle")

            if viewModel.isInviteSectionExpanded {
                HStack(spacing: Spacing.s2) {
                    TextField(
                        "Enter a home invite code to continue.",
                        text: Binding(
                            get: { viewModel.inviteCode },
                            set: { viewModel.updateInviteCode($0) }
                        )
                    )
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.Color.appText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 44)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    }
                    .accessibilityIdentifier("findHomeInviteField")

                    Button {
                        Task { await viewModel.submitInviteCode() }
                    } label: {
                        Text(viewModel.isResolvingInvite ? "Checking…" : "Go")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, Spacing.s5)
                            .frame(height: 44)
                            .background(
                                inviteSubmitEnabled
                                    ? Theme.Color.primary600
                                    : Theme.Color.appSurfaceSunken
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(!inviteSubmitEnabled)
                    .accessibilityIdentifier("findHomeInviteSubmit")
                }

                if let inviteError = viewModel.inviteError {
                    Text(inviteError)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("findHomeInviteError")
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("findHomeInviteSection")
    }

    private var inviteSubmitEnabled: Bool {
        !viewModel.isResolvingInvite
            && !viewModel.inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Events

    private func handle(_ event: FindHomeOutboundEvent?) {
        guard let event else { return }
        switch event {
        case let .openClaimOwnership(homeId): onOpenClaimOwnership(homeId)
        case .openAddHome: onOpenAddHome()
        case let .openInviteToken(token):
            presentedInviteToken = FindHomeInviteToken(token: token)
        }
        viewModel.acknowledgePendingEvent()
    }
}

/// `Identifiable` wrapper so the resolved invite token can drive a
/// `fullScreenCover(item:)`.
private struct FindHomeInviteToken: Identifiable {
    let token: String
    var id: String {
        token
    }
}

// MARK: - Result row

private struct FindHomeResultRow: View {
    let home: DiscoveredHomeDTO
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.homeBg)
                    .frame(width: 40, height: 40)
                    .overlay {
                        Icon(.home, size: 20, strokeWidth: 2, color: Theme.Color.home)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(primaryLine)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let secondaryLine {
                        Text(secondaryLine)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s0)
                if let badge {
                    Text(badge)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, Spacing.s1)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                } else {
                    Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(primaryLine). \(secondaryLine ?? "")")
        .accessibilityIdentifier("findHomeResult.\(home.id)")
    }

    private var primaryLine: String {
        home.address?.nilIfEmpty ?? home.name?.nilIfEmpty ?? "Unnamed home"
    }

    private var secondaryLine: String? {
        [home.city, home.state, home.zipcode]
            .compactMap { $0?.nilIfEmpty }
            .joined(separator: ", ")
            .nilIfEmpty
    }

    /// Homes the viewer already belongs to (or has a live claim on)
    /// are not re-claimable — mirror the A12.1 "Claimed" pill.
    private var badge: String? {
        if home.isMember { return "Member" }
        switch home.claimStatus {
        case "pending": return "Pending"
        case "verified": return "Claimed"
        default: return nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
