//
//  MyHouseholdAvailabilityView.swift
//  Pantopus
//
//  Stream I10 — F8 My Household Availability Settings.
//  Exposure-only boundary screen. Matches the A14 settings-list pattern:
//  a context header, a Personal-sky deep-link to the source of truth, and
//  toggle / disclosure rows for what this household sees. Home pillar green.
//

import SwiftUI

struct MyHouseholdAvailabilityView: View {
    @State private var viewModel: MyHouseholdAvailabilityViewModel
    @State private var optOutConfirm = false

    init(viewModel: MyHouseholdAvailabilityViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .navigationTitle("My availability")
            .navigationBarTitleDisplayMode(.inline)
            .background(Theme.Color.appBg)
            .accessibilityIdentifier("householdAvailability")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .confirmationDialog(
                "Hide your free/busy from \(viewModel.homeName)?",
                isPresented: $optOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Hide", role: .destructive) {
                    Task { await viewModel.setExposure(.shareFreeBusy, to: false) }
                }
                Button("Keep sharing", role: .cancel) {}
            } message: {
                Text("They won't be able to include you in Find a time.")
            }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load settings",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await viewModel.load() }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .ready:
            ready
        }
    }

    private var ready: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ContextHeaderCard(homeName: viewModel.homeName)

                if !viewModel.personalIsSetUp {
                    notSetUp
                } else {
                    sourceSection
                }

                exposureSection
                // The not-set-up frame (JSX FrameNotSetUp) omits the footnote —
                // it only appears once a Personal source exists to scope.
                if viewModel.personalIsSetUp {
                    FootNote()
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
        }
    }

    // MARK: - Sections

    private var sourceSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("Source")
            Card {
                DeepLinkRow { viewModel.openPersonalSource() }
            }
        }
    }

    private var notSetUp: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HomeInfoBanner(
                title: "Set up your availability in Personal first",
                message: "Until you set your free/busy hours, this household can't see when you're free."
            )
            Button {
                viewModel.openPersonalSource()
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.externalLink, size: 16, color: Theme.Color.appTextInverse)
                    Text("Set it up in Personal")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(Theme.Color.home)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("householdAvailability_setUpCTA")
        }
    }

    private var exposureSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("What this household sees")
            Card(padding: 0) {
                VStack(spacing: Spacing.s0) {
                    HouseholdToggleRow(
                        icon: .eye,
                        label: "Share my free/busy with this household",
                        sub: "Members see when you're free, never event details",
                        isOn: viewModel.shareFreeBusy,
                        disabled: !viewModel.personalIsSetUp,
                        saving: viewModel.savingExposure == .shareFreeBusy,
                        showsTopDivider: false
                    ) { newValue in
                        if newValue {
                            Task { await viewModel.setExposure(.shareFreeBusy, to: true) }
                        } else {
                            optOutConfirm = true
                        }
                    }
                    HouseholdToggleRow(
                        icon: .arrowsRepeat,
                        label: "Include me in round-robin rotation",
                        sub: "You can be auto-assigned when more than one is free",
                        isOn: viewModel.roundRobin,
                        disabled: !viewModel.personalIsSetUp,
                        saving: viewModel.savingExposure == .roundRobin
                    ) { newValue in
                        Task { await viewModel.setExposure(.roundRobin, to: newValue) }
                    }
                    if viewModel.personalIsSetUp {
                        DisclosureRow(
                            icon: .moon,
                            label: "Household quiet hours",
                            value: viewModel.quietHoursLabel
                        ) { viewModel.openQuietHours() }
                    }
                    HouseholdToggleRow(
                        icon: .calendarX,
                        label: "Auto-decline conflicting invites",
                        sub: nil,
                        isOn: viewModel.autoDecline,
                        disabled: !viewModel.personalIsSetUp,
                        saving: viewModel.savingExposure == .autoDecline
                    ) { newValue in
                        Task { await viewModel.setExposure(.autoDecline, to: newValue) }
                    }
                }
            }
        }
    }

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(height: 64, cornerRadius: Radii.xl)
            Shimmer(width: 80, height: 12)
            Shimmer(height: 56, cornerRadius: Radii.xl)
            Shimmer(width: 160, height: 12)
            Shimmer(height: 180, cornerRadius: Radii.xl)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Pieces

private struct SectionOverline: View {
    let text: String
    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.leading, Spacing.s1)
    }
}

private struct Card<Content: View>: View {
    var padding: CGFloat = Spacing.s3
    @ViewBuilder var content: Content

    init(padding: CGFloat = Spacing.s3, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

private struct ContextHeaderCard: View {
    let homeName: String
    var body: some View {
        Card {
            HStack(spacing: Spacing.s3) {
                Icon(.home, size: 20, color: Theme.Color.home)
                    .frame(width: 40, height: 40)
                    .background(Theme.Color.homeBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(homeName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text("How you appear here")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct DeepLinkRow: View {
    let onTap: @MainActor () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(.calendar, size: 16, color: Theme.Color.personal)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.infoLight, lineWidth: 1)
                    )
                VStack(alignment: .leading, spacing: 1) {
                    Text("Edit my full availability in Personal")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    Text("Your source of truth — changes apply everywhere")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("householdAvailability_editSource")
    }
}

private struct HouseholdToggleRow: View {
    let icon: PantopusIcon
    let label: String
    let sub: String?
    let isOn: Bool
    var disabled: Bool = false
    var saving: Bool = false
    var showsTopDivider: Bool = true
    let onToggle: @MainActor (Bool) -> Void

    var body: some View {
        VStack(spacing: 0) {
            if showsTopDivider {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 16, color: tint)
                    .frame(width: 32, height: 32)
                    .background(iconBackground)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    if let sub {
                        Text(sub)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if saving {
                    ProgressView().controlSize(.small)
                } else {
                    GreenSwitch(isOn: isOn, disabled: disabled) { onToggle(!isOn) }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 11)
            .opacity(disabled ? 0.5 : 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(isOn ? "On" : "Off")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("householdToggle_\(label)")
    }

    private var tint: Color {
        (isOn && !disabled) ? Theme.Color.home : Theme.Color.appTextSecondary
    }

    private var iconBackground: Color {
        (isOn && !disabled) ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken
    }
}

/// Bespoke 36×20 home-green switch matching the design's `Toggle` primitive.
private struct GreenSwitch: View {
    let isOn: Bool
    var disabled: Bool = false
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: isOn ? .trailing : .leading) {
                Capsule()
                    .fill(disabled ? Theme.Color.appSurfaceSunken : (isOn ? Theme.Color.home : Theme.Color.appBorderStrong))
                    .frame(width: 36, height: 20)
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: 16, height: 16)
                    .padding(.horizontal, 2)
                    .pantopusShadow(.sm)
            }
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .animation(.easeInOut(duration: 0.15), value: isOn)
    }
}

private struct DisclosureRow: View {
    let icon: PantopusIcon
    let label: String
    let value: String
    let onTap: @MainActor () -> Void
    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            Button(action: onTap) {
                HStack(spacing: Spacing.s3) {
                    Icon(icon, size: 16, color: Theme.Color.appTextStrong)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    Text(label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    Text(value)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .contentShape(Rectangle())
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 11)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("householdAvailability_quietHours")
        }
    }
}

private struct FootNote: View {
    var body: some View {
        Text("This only controls what this household sees. It doesn't change your personal calendar.")
            .font(.system(size: 11))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s1)
            .padding(.top, Spacing.s1)
    }
}

/// Info banner matching the design's `Banner` (info tone) primitive.
struct HomeInfoBanner: View {
    var icon: PantopusIcon = .info
    let title: String
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 15, color: Theme.Color.info)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.info)
                Text(message)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MyHouseholdAvailabilityView(
            viewModel: MyHouseholdAvailabilityViewModel(homeId: "preview")
        )
    }
}
#endif
