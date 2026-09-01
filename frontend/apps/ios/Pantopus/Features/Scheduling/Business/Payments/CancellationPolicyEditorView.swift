//
//  CancellationPolicyEditorView.swift
//  Pantopus
//
//  G14 Cancellation & Refund Policy editor (Stream I14). Preset picker with
//  inline custom rows, a live "what the invitee sees" preview, and a sticky
//  Save. Matches `policy-sheet-frames.jsx` (default / preset-selected / custom).
//  Routed full screen; styled like the design's selector sheet. Tokens only.
//

import SwiftUI

struct CancellationPolicyEditorView: View {
    @State private var model: CancellationPolicyEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        eventTypeId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: CancellationPolicyEditorViewModel(
            owner: owner,
            eventTypeId: eventTypeId,
            push: push,
            client: client
        ))
    }

    var body: some View {
        PaidSurfaceGate(
            title: "Cancellation policy",
            onBack: { dismiss() },
            content: { gatedBody }
        )
        .task { await model.load() }
        .onChange(of: model.didSave) { _, saved in
            if saved { dismiss() }
        }
    }

    private var gatedBody: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: "Cancellation & refund policy") { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { saveErrorToast }
        .accessibilityIdentifier("scheduling.cancellationPolicyEditor")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            PaymentsSkeleton()
        case .loaded:
            loadedBody
        case let .error(message):
            PaymentsErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Pick how refunds work when someone cancels.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s1)
                        .padding(.top, Spacing.s1)

                    ForEach(CancellationPolicyEditorViewModel.Preset.allCases, id: \.self) { preset in
                        PresetCard(
                            preset: preset,
                            selected: model.selectedPreset == preset,
                            accent: model.accent
                        ) { model.select(preset) }
                    }

                    if model.isCustom {
                        customRows.padding(.top, Spacing.s1)
                    }

                    preview.padding(.top, Spacing.s1)

                    Text(model.footnote)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s1)

                    Color.clear.frame(height: Spacing.s6)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s2)
            }

            BizSheetFooter {
                BizPrimaryButton(title: "Save policy", isSaving: model.saving) {
                    Task { await model.save() }
                }
                .accessibilityIdentifier("scheduling.cancellationPolicyEditor.save")
            }
        }
    }

    // MARK: Custom rows

    private var customRows: some View {
        BizCard {
            VStack(spacing: Spacing.s0) {
                customRow(icon: .clock, label: "Free-cancellation cutoff") {
                    UnitStepper(
                        value: model.customCutoffHours,
                        unit: "h",
                        accent: model.accent,
                        canDecrement: model.canDecrementCutoff,
                        canIncrement: model.canIncrementCutoff,
                        onDecrement: { model.decrementCutoff() },
                        onIncrement: { model.incrementCutoff() }
                    )
                }
                BizRowDivider()
                customRow(icon: .percent, label: "Refund after cutoff") {
                    UnitStepper(
                        value: model.customRefundPct,
                        unit: "%",
                        accent: model.accent,
                        canDecrement: model.canDecrementRefund,
                        canIncrement: model.canIncrementRefund,
                        onDecrement: { model.decrementRefund() },
                        onIncrement: { model.incrementRefund() }
                    )
                }
                BizRowDivider()
                customRow(icon: .lock, label: "Deposit is non-refundable") {
                    Toggle("", isOn: Binding(
                        get: { model.depositNonRefundable },
                        set: { model.depositNonRefundable = $0 }
                    ))
                    .labelsHidden()
                    .tint(model.accent)
                    .accessibilityIdentifier("scheduling.cancellationPolicyEditor.depositToggle")
                }
                BizRowDivider()
                Button { model.cycleNoShow() } label: {
                    HStack(spacing: 11) {
                        iconTile(.userX)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("No-show handling")
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(model.noShowMode.label)
                                .font(.system(size: 10.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s2)
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(.vertical, 11)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.cancellationPolicyEditor.noShowRow")
            }
        }
    }

    private func customRow(
        icon: PantopusIcon,
        label: String,
        @ViewBuilder trailing: () -> some View
    ) -> some View {
        HStack(spacing: 11) {
            iconTile(icon)
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s2)
            trailing()
        }
        .padding(.vertical, 11)
        .frame(minHeight: 44)
    }

    private func iconTile(_ icon: PantopusIcon) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Theme.Color.appSurfaceSunken)
            Icon(icon, size: 15, color: Theme.Color.appTextStrong)
        }
        .frame(width: 30, height: 30)
    }

    // MARK: Preview

    private var preview: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: Spacing.s1) {
                Icon(.eye, size: 13, color: model.accent)
                Text("What the invitee sees")
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.5)
                    .textCase(.uppercase)
                    .foregroundStyle(model.accent)
            }
            Text(model.previewText)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(model.accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("scheduling.cancellationPolicyEditor.preview")
    }

    // MARK: Save error toast

    @ViewBuilder
    private var saveErrorToast: some View {
        if let message = model.saveError {
            HStack(spacing: Spacing.s2) {
                Icon(.alertCircle, size: 15, color: Theme.Color.appTextInverse)
                Text(message)
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
            .task {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                model.clearSaveError()
            }
        }
    }
}

// MARK: - Preset card

private struct PresetCard: View {
    let preset: CancellationPolicyEditorViewModel.Preset
    let selected: Bool
    let accent: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(preset.rawValue)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(preset.summary)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                radio
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? accent.opacity(0.10) : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(selected ? accent : Theme.Color.appBorder, lineWidth: selected ? 1.5 : 1)
            )
            // JSX: unselected cards carry `0 1px 2px rgba(0,0,0,0.03)`; selected
            // cards are flat (`boxShadow:'none'`).
            .pantopusShadow(selected ? PantopusShadow(color: .black, opacity: 0, radius: 0, x: 0, y: 0) : .sm)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.cancellationPolicyEditor.preset.\(preset.rawValue)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var radio: some View {
        ZStack {
            Circle()
                .fill(selected ? accent : Color.clear)
            if !selected {
                Circle().stroke(Theme.Color.appBorderStrong, lineWidth: 1.5)
            } else {
                Icon(.check, size: 12, strokeWidth: 3.2, color: Theme.Color.appTextInverse)
            }
        }
        .frame(width: 20, height: 20)
        .accessibilityHidden(true)
    }
}

// MARK: - Unit stepper (− value+unit +)

private struct UnitStepper: View {
    let value: Int
    let unit: String
    let accent: Color
    var canDecrement = true
    var canIncrement = true
    let onDecrement: () -> Void
    let onIncrement: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s1) {
            stepButton(.minus, enabled: canDecrement, color: Theme.Color.appTextStrong, action: onDecrement)
                .accessibilityLabel("Decrease")
            Text(verbatim: "\(value)\(unit)")
                .font(.system(size: 11.5, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(accent)
                .frame(minWidth: 34)
                .padding(.vertical, 3)
                .background(accent.opacity(0.12))
                .clipShape(Capsule())
            stepButton(.plus, enabled: canIncrement, color: accent, action: onIncrement)
                .accessibilityLabel("Increase")
        }
    }

    private func stepButton(_ icon: PantopusIcon, enabled: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().stroke(Theme.Color.appBorder, lineWidth: 1)
                // biz-kit.jsx Stepper small=true: h=22, ic=11
                Icon(icon, size: 11, color: enabled ? color : Theme.Color.appTextMuted)
            }
            .frame(width: 22, height: 22)
            .background(Theme.Color.appSurface, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        CancellationPolicyEditorView(owner: .business(id: "biz1"), eventTypeId: nil) { _ in }
    }
}
#endif
