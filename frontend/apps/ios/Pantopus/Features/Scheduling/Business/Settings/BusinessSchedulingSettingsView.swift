//
//  BusinessSchedulingSettingsView.swift
//  Pantopus
//
//  G5 Business Scheduling Settings (Stream I13). Grouped settings index on the
//  Business violet pillar — Confirmation · Scheduling · Policy · Notifications ·
//  Payments. Matches `bizsettings-frames.jsx` (saved / loading / auto-confirm /
//  payments-required / permission-gated). Tokens only; functional chrome sky.
//

import SwiftUI

// swiftlint:disable file_length
struct BusinessSchedulingSettingsView: View {
    @State private var model: BusinessSchedulingSettingsViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: BusinessSchedulingSettingsViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: "Booking") { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { savedToast }
        .task { await model.load() }
        .sheet(isPresented: $model.showTimezoneSheet) {
            TimezoneSelectorSheet(
                selectedIdentifier: model.timezone,
                accent: model.accent,
                onSelect: { id in Task { await model.saveTimezone(id) } },
                onDone: { model.showTimezoneSheet = false }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            BizSettingsSkeleton()
        case .loaded:
            loadedBody
        case let .error(message):
            BizSettingsError(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Defaults flow into each service — change them per service anytime.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s1)

                confirmationCard
                schedulingGroup
                if !model.isGated { policyGroup }
                notificationsGroup
                if !model.isGated { paymentsGroup }
                if model.isGated { gatedNote }

                Color.clear.frame(height: Spacing.s8)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
        }
    }

    // MARK: Confirmation

    private var confirmationCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BizOverline(text: "Confirmation")
            BizCard(padding: EdgeInsets(top: 11, leading: 13, bottom: 11, trailing: 13)) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(spacing: Spacing.s2) {
                        iconTile(.calendarCheck, accent: true)
                        Text("New bookings")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    BizSegmented(
                        options: ["Auto-confirm", "Approve each request"],
                        selectedIndex: model.confirmationApprove ? 1 : 0,
                        accent: model.accent,
                        disabled: model.isGated
                    ) { idx in model.confirmationApprove = idx == 1 }
                        .opacity(model.isGated ? 0.55 : 1)
                    Text(model.confirmationApprove
                        ? "You approve each request before it lands on your calendar."
                        : "Auto-confirm sends the booking straight to your calendar.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if model.confirmationApprove {
                        BizRowDivider().padding(.top, Spacing.s1)
                        // Design: trailing={gated?null:undefined} — informational
                        // row; no chevron and no tap in either state.
                        BizSettingsRow(
                            icon: .hourglass,
                            label: "Approval window",
                            sub: "24h to respond",
                            trailing: { EmptyView() },
                            onTap: nil
                        )
                    }
                }
            }
        }
    }

    // MARK: Scheduling

    /// Design G5: each row carries an independent chevron implying a per-row
    /// sub-screen (bizsettings-frames.jsx:55-64). Min-notice / horizon / buffers
    /// are per-SERVICE on the backend (no owner-level store), so all three route
    /// to the event-type list where the user edits them per service. No dedicated
    /// sub-screen routes exist for these fields (acknowledged cross-platform gap).
    private var schedulingGroup: some View {
        BizGroup(title: "Scheduling") {
            BizSettingsRow(
                icon: .clock,
                label: "Minimum notice",
                sub: model.minNoticeValue,
                trailing: { gatedChevron },
                onTap: rowTap { model.openSchedulingDefaults() }
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .calendarRange,
                label: "Booking horizon",
                sub: model.horizonValue,
                trailing: { gatedChevron },
                onTap: rowTap { model.openSchedulingDefaults() }
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .arrowRightLeft,
                label: "Buffers",
                sub: model.buffersValue,
                trailing: { gatedChevron },
                onTap: rowTap { model.openSchedulingDefaults() }
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .globe,
                label: "Time zone",
                sub: model.timezone,
                trailing: { timezoneTrailing },
                onTap: rowTap { model.openTimezone() }
            )
        }
        .opacity(model.isGated ? 0.7 : 1)
    }

    @ViewBuilder
    private var timezoneTrailing: some View {
        if model.savingTimezone {
            Shimmer(width: 70, height: 14, cornerRadius: Radii.sm)
        } else {
            gatedChevron
        }
    }

    // MARK: Policy

    private var policyGroup: some View {
        BizGroup(title: "Policy") {
            BizSettingsRow(
                icon: .shield,
                label: "Cancellation & no-show policy",
                sub: model.cancellationValue,
                trailing: { gatedChevron },
                onTap: rowTap { model.openCancellationPolicy() }
            )
        }
    }

    // MARK: Notifications

    private var notificationsGroup: some View {
        BizGroup(title: "Notifications") {
            BizSettingsRow(
                icon: .bell,
                label: "Notify the owner",
                sub: nil,
                trailing: {
                    Toggle("", isOn: Binding(get: { model.notifyOwner }, set: { v in Task { await model.setNotifyOwner(v) } }))
                        .labelsHidden()
                        .tint(model.accent)
                        .disabled(model.isGated)
                },
                onTap: nil
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .userCheck,
                label: "Notify the assigned member",
                sub: nil,
                trailing: {
                    Toggle("", isOn: Binding(get: { model.notifyAssigned }, set: { v in Task { await model.setNotifyAssigned(v) } }))
                        .labelsHidden()
                        .tint(model.accent)
                        .disabled(model.isGated)
                },
                onTap: nil
            )
        }
        .opacity(model.isGated ? 0.7 : 1)
    }

    // MARK: Payments

    private var paymentsGroup: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BizGroup(title: "Payments") {
                BizSettingsRow(
                    icon: .creditCard,
                    iconTint: Theme.Color.stripeBrand,
                    iconBg: Theme.Color.stripeBrand.opacity(0.10),
                    label: "Stripe payments",
                    sub: model.paymentsConnected ? model.payoutSub : "Not connected",
                    trailing: { paymentsTrailing },
                    onTap: { model.openPayments() }
                )
            }
            if model.paymentsRequired {
                BizNote(tone: .warning, icon: .alertTriangle, text: "Connect payments to charge for services.")
            }
        }
    }

    @ViewBuilder
    private var paymentsTrailing: some View {
        if model.paymentsConnected {
            HStack(spacing: 7) {
                BizChip(tone: .success, icon: .check, text: "Connected")
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        } else {
            Text("Connect")
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, 13)
                .frame(height: 28)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
        }
    }

    // MARK: Gated note

    private var gatedNote: some View {
        HStack(spacing: 7) {
            Icon(.lock, size: 13, color: Theme.Color.appTextMuted)
            Text("Only admins can change booking settings.")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s1)
    }

    // MARK: Bits

    @ViewBuilder
    private var gatedChevron: some View {
        if model.isGated {
            Color.clear.frame(width: 1, height: 1)
        } else {
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
    }

    private func rowTap(_ action: @escaping () -> Void) -> (() -> Void)? {
        model.isGated ? nil : action
    }

    private func iconTile(_ icon: PantopusIcon, accent: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(accent ? Theme.Color.businessBg : Theme.Color.appSurfaceSunken)
            Icon(icon, size: 16, color: accent ? Theme.Color.business : Theme.Color.appTextSecondary)
        }
        .frame(width: 32, height: 32)
    }

    private var savedToast: some View {
        Group {
            if model.showSavedToast {
                HStack(spacing: Spacing.s2) {
                    Icon(.check, size: 15, strokeWidth: 3, color: Theme.Color.success)
                    Text("Changes saved")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .pantopusShadow(.lg)
                .padding(.top, Spacing.s3)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.showSavedToast)
    }
}

// MARK: - Top bar

struct BizTopBar: View {
    let title: String
    var trailing: AnyView?
    let onBack: () -> Void

    init(title: String, trailing: AnyView? = nil, onBack: @escaping () -> Void) {
        self.title = title
        self.trailing = trailing
        self.onBack = onBack
    }

    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 21, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Back")
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            if let trailing {
                trailing.frame(minWidth: 36, alignment: .trailing)
            } else {
                Color.clear.frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

// MARK: - Grouped settings primitives

struct BizGroup<Content: View>: View {
    let title: String
    var accent: Color = Theme.Color.business
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BizOverline(text: title, color: accent)
            VStack(spacing: Spacing.s0) { content }
                .padding(.horizontal, 13)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .pantopusShadow(.sm)
        }
    }
}

struct BizSettingsRow<Trailing: View>: View {
    var icon: PantopusIcon?
    var iconTint: Color?
    /// Explicit disc background. When nil, derives from `iconTint` (0.14) or the
    /// sunken neutral. Brand marks (e.g. the Stripe disc) pass an explicit cool
    /// wash here so the disc reads as the brand swatch, not a tinted-glyph chip.
    var iconBg: Color?
    let label: String
    var sub: String?
    let trailing: Trailing
    var onTap: (() -> Void)?

    init(
        icon: PantopusIcon? = nil,
        iconTint: Color? = nil,
        iconBg: Color? = nil,
        label: String,
        sub: String? = nil,
        @ViewBuilder trailing: () -> Trailing,
        onTap: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.iconTint = iconTint
        self.iconBg = iconBg
        self.label = label
        self.sub = sub
        self.trailing = trailing()
        self.onTap = onTap
    }

    var body: some View {
        let row = HStack(spacing: 11) {
            if let icon {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(iconBg ?? (iconTint.map { $0.opacity(0.14) } ?? Theme.Color.appSurfaceSunken))
                    Icon(icon, size: 16, color: iconTint ?? Theme.Color.appTextSecondary)
                }
                .frame(width: 32, height: 32)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                if let sub {
                    Text(sub).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            trailing
        }
        .padding(.vertical, 11)
        .frame(minHeight: 44)
        .contentShape(Rectangle())

        if let onTap {
            Button(action: onTap) { row }.buttonStyle(.plain)
        } else {
            row
        }
    }
}

struct BizSegmented: View {
    let options: [String]
    let selectedIndex: Int
    var accent: Color = Theme.Color.business
    var disabled: Bool = false
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                let on = idx == selectedIndex
                Button { onSelect(idx) } label: {
                    Text(opt)
                        .font(.system(size: 11, weight: on ? .bold : .semibold))
                        .foregroundStyle(on ? accent : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(on ? Theme.Color.appSurface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .pantopusShadow(on ? .sm : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .disabled(disabled)
    }
}

// MARK: - Skeleton + error

private struct BizSettingsSkeleton: View {
    /// Mirrors `bizsettings-frames.jsx` FrameLoading: three ShimGroups of 1 / 4 / 2
    /// rows, each row a 32×32 disc + two stacked text shimmers in a card.
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                shimGroup(rows: 1)
                shimGroup(rows: 4)
                shimGroup(rows: 2)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s4)
        }
    }

    private func shimGroup(rows: Int) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: 90, height: 9, cornerRadius: Radii.xs)
            VStack(spacing: Spacing.s0) {
                ForEach(0..<rows, id: \.self) { i in
                    HStack(spacing: 11) {
                        Shimmer(width: 32, height: 32, cornerRadius: 9)
                        VStack(alignment: .leading, spacing: Spacing.s0) {
                            Shimmer(width: 130, height: 11, cornerRadius: Radii.xs)
                            Shimmer(width: 170, height: 8, cornerRadius: Radii.xs)
                                .padding(.top, 6)
                        }
                        Spacer(minLength: Spacing.s2)
                    }
                    .padding(.vertical, 13)
                    if i != rows - 1 { BizRowDivider() }
                }
            }
            .padding(.horizontal, 13)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .pantopusShadow(.sm)
        }
    }
}

private struct BizSettingsError: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load settings")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}
