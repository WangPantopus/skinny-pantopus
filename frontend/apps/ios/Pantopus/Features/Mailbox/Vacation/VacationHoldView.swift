//
//  VacationHoldView.swift
//  Pantopus
//
//  A14.8 — Vacation Hold screen. Two variants:
//
//  · scheduling — From / To date pickers wrapped around a 13-day
//    `DateSpan` strip, a 4-row scope-toggle card (mail · packages ·
//    magic task · civic notices locked), an optional forwarding chevron
//    row, and an emergency-contact chevron row. Top bar trailing slot
//    renders `Save` in `primary600` (disabled until the draft is valid).
//
//  · active — sky-gradient `HoldStatusHero` with pulsing pill + days-
//    left + 3-cell stats grid, a "Currently held" ledger via `HeldList`,
//    read-only forwarding + emergency cards, a destructive "End hold
//    early" row at the bottom, and the trailing slot in the top bar
//    swaps `Save` for a muted `Edit` text button.
//

// swiftlint:disable file_length

import SwiftUI

public struct VacationHoldView: View {
    @State private var viewModel: VacationHoldViewModel
    /// A14.8 — "End hold early" is destructive (the backend marks the
    /// hold `cancelled` and clears `User.vacation_mode`), so it confirms.
    @State private var showsEndHoldConfirm = false

    public init(viewModel: VacationHoldViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    switch viewModel.mode {
                    case let .scheduling(draft):
                        VacationSchedulingBody(
                            draft: draft,
                            onPickFromDate: { viewModel.tapFromDate() },
                            onPickToDate: { viewModel.tapToDate() },
                            onToggleScope: { kind, isOn in viewModel.toggleScope(kind, isOn: isOn) },
                            onToggleForwarding: { viewModel.toggleForwarding($0) },
                            onTapForwarding: { viewModel.tapForwarding() },
                            onTapEmergency: { viewModel.tapEmergency() }
                        )
                    case let .active(hold):
                        VacationActiveBody(
                            hold: hold,
                            onTapForwarding: { viewModel.tapForwarding() },
                            onTapEmergency: { viewModel.tapEmergency() },
                            onEndHold: { showsEndHoldConfirm = true }
                        )
                    }
                }
                .padding(.bottom, Spacing.s6)
            }
            .background(Theme.Color.appBg)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("vacationHold")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onAppear { Analytics.track(.screenVacationHoldViewed(mode: modeAnalyticsTag)) }
        .confirmationDialog(
            "End your vacation hold?",
            isPresented: $showsEndHoldConfirm,
            titleVisibility: .visible
        ) {
            Button("End hold", role: .destructive) {
                Task { await viewModel.endHoldEarly() }
            }
            .accessibilityIdentifier("vacationHoldEndConfirm")
            Button("Keep holding", role: .cancel) {}
        } message: {
            Text("Mail and packages resume delivery right away.")
        }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastBanner(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 1_800_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
            }
        }
    }

    private var modeAnalyticsTag: String {
        switch viewModel.mode {
        case .scheduling: "scheduling"
        case .active: "active"
        }
    }

    private var topBar: some View {
        ZStack {
            Text("Vacation hold")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("vacationHoldTitle")
            HStack {
                Button(
                    action: { viewModel.tapBack() },
                    label: {
                        Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                            .frame(width: 44, height: 44)
                    }
                )
                .accessibilityLabel("Back")
                .accessibilityIdentifier("vacationHoldBack")
                Spacer()
                Button(
                    action: { Task { await viewModel.tapTrailingAction() } },
                    label: {
                        Text(viewModel.trailingActionLabel)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(viewModel.trailingActionTint)
                            .frame(minWidth: 60, minHeight: 44)
                    }
                )
                .disabled(!viewModel.trailingActionEnabled)
                .accessibilityLabel(viewModel.trailingActionLabel)
                .accessibilityIdentifier("vacationHoldTrailingAction")
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Scheduling body

private struct VacationSchedulingBody: View {
    let draft: VacationScheduleDraft
    let onPickFromDate: () -> Void
    let onPickToDate: () -> Void
    let onToggleScope: (VacationHoldScope.Kind, Bool) -> Void
    let onToggleForwarding: (Bool) -> Void
    let onTapForwarding: () -> Void
    let onTapEmergency: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            VacationOverline("When")
            whenCard

            VacationOverline("Hold during this period")
            scopesCard
            VacationCardHelper("Civic notices always get delivered — too important to hold.")

            VacationOverline("Forwarding")
            forwardingCard
            VacationCardHelper("Urgent items (overnight, signature-required) re-route the same day.")

            VacationOverline("Emergency contact")
            emergencyCard
            VacationCardHelper("We'll call them if a delivery driver flags an issue at your door.")

            VacationMonoFooter(draft.footerBlurb)
        }
    }

    private var whenCard: some View {
        VacationCard {
            VacationDateRow(
                label: "From",
                sub: "9:00 AM pickup",
                value: VacationHoldFormatter.weekdayShort(draft.fromDate),
                onTap: onPickFromDate,
                identifier: "vacationHoldFromDate"
            )
            VacationHairline()
            VacationDateRow(
                label: "To",
                sub: "Resume delivery",
                value: VacationHoldFormatter.weekdayShort(draft.toDate),
                onTap: onPickToDate,
                identifier: "vacationHoldToDate"
            )
            VacationHairline()
            DateSpan(
                days: draft.spanDays,
                fromWeekday: VacationHoldFormatter.weekdayLabel(draft.fromDate),
                toWeekday: VacationHoldFormatter.weekdayLabel(draft.toDate)
            )
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, 14)
        }
    }

    private var scopesCard: some View {
        VacationCard {
            ForEach(Array(draft.scopes.enumerated()), id: \.element.id) { index, scope in
                VacationToggleRow(
                    label: scope.label,
                    sub: scope.sub,
                    isOn: scope.isOn,
                    isLocked: scope.isLocked,
                    onChange: { newValue in onToggleScope(scope.kind, newValue) },
                    identifier: "vacationHoldScope.\(scope.id)"
                )
                if index < draft.scopes.count - 1 {
                    VacationHairline()
                }
            }
        }
    }

    private var forwardingCard: some View {
        VacationCard {
            VacationToggleRow(
                label: "Forward urgent mail",
                sub: "Else held until you return",
                isOn: draft.forwardingEnabled,
                isLocked: false,
                onChange: onToggleForwarding,
                identifier: "vacationHoldForwardToggle"
            )
            if draft.forwardingEnabled, let forwarding = draft.forwarding {
                VacationHairline()
                VacationChevronRow(
                    leadingIcon: .mapPin,
                    leadingTint: Theme.Color.primary600,
                    leadingBackground: Theme.Color.primary50,
                    title: forwarding.title,
                    sub: forwarding.sub,
                    onTap: onTapForwarding,
                    identifier: "vacationHoldForwardAddress"
                )
            }
        }
    }

    private var emergencyCard: some View {
        VacationCard {
            if let emergency = draft.emergency {
                VacationChevronRow(
                    leading: AnyView(
                        VacationAvatar(initials: emergency.initials)
                    ),
                    title: "\(emergency.name) (\(emergency.relation.lowercased()))",
                    sub: emergency.phone,
                    onTap: onTapEmergency,
                    identifier: "vacationHoldEmergencyContact"
                )
            } else {
                VacationChevronRow(
                    leadingIcon: .userPlus,
                    leadingTint: Theme.Color.primary600,
                    leadingBackground: Theme.Color.primary50,
                    title: "Add an emergency contact",
                    sub: "Optional — for delivery-driver issues",
                    onTap: onTapEmergency,
                    identifier: "vacationHoldEmergencyContact"
                )
            }
        }
    }
}

// MARK: - Active body

private struct VacationActiveBody: View {
    let hold: VacationActiveHold
    let onTapForwarding: () -> Void
    let onTapEmergency: () -> Void
    let onEndHold: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HoldStatusHero(
                daysLeft: hold.daysLeft,
                untilLabel: hold.untilLabel,
                stats: hold.stats
            )
            .padding(.horizontal, Spacing.s3)
            .padding(.top, 14)

            VacationOverline("Currently held")
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HeldList(items: hold.heldItems)
                Text(hold.resumeBlurb)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
            }
            .padding(.horizontal, Spacing.s3)

            if let forwarding = hold.forwarding {
                VacationOverline("Forwarding to")
                VacationCard {
                    VacationChevronRow(
                        leadingIcon: .mapPin,
                        leadingTint: Theme.Color.primary600,
                        leadingBackground: Theme.Color.primary50,
                        title: forwarding.title,
                        sub: forwarding.sub,
                        onTap: onTapForwarding,
                        identifier: "vacationHoldActiveForwarding"
                    )
                }
            }

            if let emergency = hold.emergency {
                VacationOverline("Emergency contact")
                VacationCard {
                    VacationChevronRow(
                        leading: AnyView(VacationAvatar(initials: emergency.initials)),
                        title: "\(emergency.name) (\(emergency.relation.lowercased()))",
                        sub: emergency.phone,
                        onTap: onTapEmergency,
                        identifier: "vacationHoldActiveEmergency"
                    )
                }
            }

            VacationCard {
                VacationDestructiveRow(
                    label: "End hold early",
                    sub: "Mail resumes tomorrow morning",
                    onTap: onEndHold,
                    identifier: "vacationHoldEndEarly"
                )
            }
            .padding(.top, 18)

            VacationMonoFooter(hold.activeSinceLabel)
        }
    }
}

// MARK: - Layout primitives (Vacation-local)

private struct VacationOverline: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .kerning(0.9)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 18)
            .padding(.bottom, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct VacationCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: Spacing.s0) {
            content()
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s3)
    }
}

private struct VacationCardHelper: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct VacationMonoFooter: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(Theme.Color.appTextMuted)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s6)
            .padding(.bottom, Spacing.s2)
            .frame(maxWidth: .infinity)
    }
}

private struct VacationHairline: View {
    var body: some View {
        Rectangle()
            .fill(Theme.Color.appBorder.opacity(0.6))
            .frame(height: 1)
            .padding(.leading, Spacing.s4)
    }
}

private struct VacationDateRow: View {
    let label: String
    let sub: String
    let value: String
    let onTap: () -> Void
    let identifier: String

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                    Text(sub)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Text(value)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(label): \(value)")
    }
}

private struct VacationToggleRow: View {
    let label: String
    let sub: String
    let isOn: Bool
    let isLocked: Bool
    let onChange: (Bool) -> Void
    let identifier: String

    var body: some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text(sub)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            if isLocked {
                LockedChip()
                    .accessibilityIdentifier("\(identifier).locked")
            } else {
                Toggle("", isOn: Binding(
                    get: { isOn },
                    set: { onChange($0) }
                ))
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("\(identifier).toggle")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .accessibilityIdentifier(identifier)
    }
}

private struct LockedChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.lock, size: 10, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
            Text("Always on".uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }
}

private struct VacationChevronRow: View {
    enum Leading {
        case icon(PantopusIcon, tint: Color, background: Color)
        case view(AnyView)
    }

    let leading: Leading
    let title: String
    let sub: String
    let onTap: () -> Void
    let identifier: String

    init(
        leadingIcon: PantopusIcon,
        leadingTint: Color,
        leadingBackground: Color,
        title: String,
        sub: String,
        onTap: @escaping () -> Void,
        identifier: String
    ) {
        leading = .icon(leadingIcon, tint: leadingTint, background: leadingBackground)
        self.title = title
        self.sub = sub
        self.onTap = onTap
        self.identifier = identifier
    }

    init(
        leading: AnyView,
        title: String,
        sub: String,
        onTap: @escaping () -> Void,
        identifier: String
    ) {
        self.leading = .view(leading)
        self.title = title
        self.sub = sub
        self.onTap = onTap
        self.identifier = identifier
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                leadingView
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                    Text(sub)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(title), \(sub)")
    }

    @ViewBuilder
    private var leadingView: some View {
        switch leading {
        case let .icon(icon, tint, background):
            Icon(icon, size: 16, strokeWidth: 2, color: tint)
                .frame(width: 32, height: 32)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        case let .view(view):
            view
        }
    }
}

/// A14.8 — destructive card row ("End hold early") at the bottom of the
/// active body. Error-tinted label + secondary sub, no chevron, per the
/// JSX active frame's `destructive` Row.
private struct VacationDestructiveRow: View {
    let label: String
    let sub: String
    let onTap: () -> Void
    let identifier: String

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                Text(sub)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(label), \(sub)")
    }
}

private struct VacationAvatar: View {
    let initials: String

    var body: some View {
        Text(initials.prefix(2).uppercased())
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Theme.Color.appTextStrong)
            .frame(width: 32, height: 32)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Circle())
            .accessibilityHidden(true)
    }
}

// MARK: - Formatting helpers

enum VacationHoldFormatter {
    /// "Tue, May 28" — date-row value.
    static func weekdayShort(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    /// "Tue · May 28" — DateSpan caption beneath the dashed strip.
    static func weekdayLabel(_ date: Date) -> String {
        let weekday = DateFormatter()
        weekday.locale = Locale(identifier: "en_US_POSIX")
        weekday.dateFormat = "EEE"
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "MMM d"
        return "\(weekday.string(from: date)) · \(day.string(from: date))"
    }
}

// MARK: - Toast

/// Local copy of the mailbox toast chrome. `MailDetailView` and
/// `MailTranslationView` each declare their own `private` one; this mirrors
/// them so the three stay visually identical without a cross-file dependency.
private struct ToastBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appText.opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityLabel(message)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("A14.8 · scheduling") {
    VacationHoldView(viewModel: VacationHoldViewModel(seed: .scheduling))
}

#Preview("A14.8 · active") {
    VacationHoldView(viewModel: VacationHoldViewModel(seed: .active))
}
#endif
