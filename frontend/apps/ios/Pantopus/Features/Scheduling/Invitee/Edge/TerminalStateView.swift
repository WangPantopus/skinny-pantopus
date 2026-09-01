//
//  TerminalStateView.swift
//  Pantopus
//
//  D7 Unavailable / Expired / Paused / Secret (Stream I7). The calm, full-screen
//  terminal state for an invitee link that can't be booked right now. Each status
//  is rendered honestly (never alarm styling): a soft halo, a plain-language
//  headline + body, and a contextual affordance. Loading / error states wrap in
//  the offline banner. Tokens only.
//

import SwiftUI

struct TerminalStateView: View {
    @State private var viewModel: TerminalStateViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: TerminalStateViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.terminalState")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loading
        case let .resolved(kind, hostName):
            resolved(kind: kind, hostName: hostName)
        case let .error(message):
            EmptyState(
                icon: .wifiOff,
                headline: message,
                subcopy: "Check your connection and try again.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
        }
    }

    private var loading: some View {
        VStack(spacing: Spacing.s4) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 84, height: 84)
            Shimmer(width: 180, height: 18)
            Shimmer(width: 220, height: 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Loading")
    }

    private func resolved(kind: TerminalKind, hostName: String?) -> some View {
        let copy = TerminalCopy.copy(for: kind, hostName: hostName)
        return VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: copy.icon, tone: copy.tone, size: 84)
            VStack(spacing: Spacing.s2) {
                Text(copy.title)
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text(copy.body)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .frame(maxWidth: 250)
            }
            extra(kind: kind)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom) { dock(kind: kind) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(copy.title). \(copy.body)")
    }

    /// Per-status content block shown between the head/body and the dock
    /// (design: `extra`). Private → access-code input · paused → host note +
    /// reopen chip · cancelled → "Book again" inline link.
    @ViewBuilder
    private func extra(kind: TerminalKind) -> some View {
        switch kind {
        case .privateLink:
            TerminalCodeInput(
                code: $viewModel.accessCode
            ) { viewModel.submitAccessCode() }
        case .paused:
            if let note = viewModel.hostNote {
                TerminalPausedCard(
                    hostName: viewModel.hostNameLabel,
                    note: note,
                    reopenLabel: viewModel.reopenLabel
                )
            }
        case .cancelled:
            if viewModel.slug?.isEmpty == false {
                Button { viewModel.openBookingPage() } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.rotateCcw, size: 14, strokeWidth: 2.3, color: Theme.Color.primary600)
                        Text("Book again")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.terminalState.bookAgain")
            }
        case .notFound, .expired, .fullyBooked:
            EmptyView()
        }
    }

    private func dock(kind: TerminalKind) -> some View {
        EdgeDock {
            dockExtra(kind: kind)
            TerminalGetTheAppButton()
            GhostButton(title: "Back to Pantopus") { dismiss() }
        }
    }

    /// The status-specific secondary CTA pinned above the "Get the app" dock
    /// button (design: `dockExtra`).
    @ViewBuilder
    private func dockExtra(kind: TerminalKind) -> some View {
        switch kind {
        case .expired:
            TerminalSecondaryButton(icon: .mail, label: "Request a new link") {
                viewModel.requestNewLink()
            }
        case .paused:
            TerminalSecondaryButton(icon: .bell, label: "Notify me when it reopens") {
                viewModel.notifyWhenAvailable()
            }
        case .fullyBooked:
            TerminalSecondaryButton(icon: .bell, label: "Notify me when times open") {
                viewModel.notifyWhenAvailable()
            }
        case .notFound, .privateLink, .cancelled:
            EmptyView()
        }
    }
}

// MARK: - Per-status affordances

/// "Have a code?" inline access-code field + submit arrow (design `CodeInput`).
/// View-only: the unlock round-trip is deferred backend.
private struct TerminalCodeInput: View {
    @Binding var code: String
    let onSubmit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Have a code?")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                TextField("Enter access code", text: $code)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .onSubmit(onSubmit)
                    .frame(height: 42)
                    .padding(.horizontal, Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Button(action: onSubmit) {
                    Icon(.arrowRight, size: 17, strokeWidth: 2.3, color: Theme.Color.primary600)
                        .frame(width: 42, height: 42)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Submit code")
            }
        }
        .frame(maxWidth: 236)
    }
}

/// Paused host note card: initials disc + "A note from {host}" + italic quote +
/// "Reopens …" chip (design `PausedCard`). Rendered only when the backend
/// supplies the note (deferred otherwise).
private struct TerminalPausedCard: View {
    let hostName: String
    let note: String
    let reopenLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(initials)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 24, height: 24)
                    .background(
                        LinearGradient(
                            colors: [Theme.Color.primary400, Theme.Color.primary700],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(Circle())
                Text("A note from \(hostName)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Text("\u{201C}\(note)\u{201D}")
                .font(.system(size: 12))
                .italic()
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let reopenLabel {
                HStack(spacing: Spacing.s1) {
                    Icon(.calendar, size: 12, color: Theme.Color.appTextSecondary)
                    Text(reopenLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appSurface)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Capsule())
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: 240, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var initials: String {
        let parts = hostName.split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "·" : String(parts).uppercased()
    }
}

/// Outlined secondary dock CTA: glyph + label (design `SecondaryButton`).
private struct TerminalSecondaryButton: View {
    let icon: PantopusIcon
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Icon(icon, size: 14, strokeWidth: 2.1, color: Theme.Color.appText)
                Text(label)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.terminalState.secondary.\(label)")
    }
}

/// The Pantopus-branded "Get the app" CTA pinned on every status (design `Dock`'s
/// filled PILLAR button). View-only stub — the store hand-off is deferred backend.
private struct TerminalGetTheAppButton: View {
    var body: some View {
        Button {} label: {
            HStack(spacing: 7) {
                Icon(.smartphone, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                Text("Get the app")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.terminalState.getTheApp")
    }
}

// MARK: - Per-state copy

private enum TerminalCopy {
    struct Copy {
        let icon: PantopusIcon
        let tone: EdgeTone
        let title: String
        let body: String
    }

    static func copy(for kind: TerminalKind, hostName: String?) -> Copy {
        let host = hostName ?? "This host"
        switch kind {
        case .notFound:
            return Copy(
                icon: .searchX,
                tone: .neutral,
                title: "We can't find that page",
                body: "The link may be mistyped, or this page no longer exists."
            )
        case .privateLink:
            return Copy(
                icon: .lock,
                tone: .neutral,
                title: "This is a private link",
                body: "Ask the host for the right link, or enter your access code below."
            )
        case .expired:
            return Copy(
                icon: .clock,
                tone: .neutral,
                title: "This link has expired",
                body: "For your security, these links stop working after a while."
            )
        case .paused:
            return Copy(
                icon: .pauseCircle,
                tone: .neutral,
                title: "Bookings are paused",
                body: "\(host) isn't taking new bookings at the moment."
            )
        case .fullyBooked:
            return Copy(
                icon: .calendarX,
                tone: .neutral,
                title: "No times are open right now",
                body: "Every slot is taken for now — new times open up regularly."
            )
        case .cancelled:
            return Copy(
                icon: .xCircle,
                tone: .neutral,
                title: "This booking was cancelled",
                body: "The slot was released. Nothing further is owed."
            )
        }
    }
}

#if DEBUG
#Preview("Paused") {
    NavigationStack { TerminalStateView(viewModel: .preview(.paused)) }
}

#Preview("Expired") {
    NavigationStack { TerminalStateView(viewModel: .preview(.expired, hostName: nil)) }
}
#endif
