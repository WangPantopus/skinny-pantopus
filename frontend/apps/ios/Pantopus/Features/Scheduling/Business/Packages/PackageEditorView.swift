//
//  PackageEditorView.swift
//  Pantopus
//
//  G9 Create / Edit Package (owner) — Stream I15. Reuses the shared `FormShell`
//  (back chevron + title + sticky "Save package" CTA + discard confirm) and
//  fills the body with the design's overline cards. Matches
//  `createpackage-frames.jsx`. Tokens only.
//

import SwiftUI

struct PackageEditorView: View {
    @State private var model: PackageEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        packageId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: PackageEditorViewModel(owner: owner, packageId: packageId, push: push, client: client))
    }

    private var title: String {
        model.isEditing ? "Edit package" : "New package"
    }

    var body: some View {
        Group {
            switch model.phase {
            case .comingSoon:
                gated
            case let .error(message):
                errored(message)
            case .loading, .ready:
                form
            }
        }
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.packageEditor")
    }

    private var form: some View {
        FormShell(
            title: title,
            leading: .back,
            rightActionLabel: nil,
            bottomActionLabel: "Save package",
            isValid: model.isValid && model.phase == .ready,
            isDirty: model.isDirty,
            isSaving: model.saving,
            onClose: { dismiss() },
            onCommit: { Task { await model.save { dismiss() } } },
            content: {
                if model.phase == .loading {
                    loadingBody
                } else {
                    cards
                }
            }
        )
    }

    private var cards: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if !model.isEditing {
                Text("Set a price and we'll do the per-session math.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
            }
            detailsCard
            // Frame 4: when active buyers hold credits, warn and lock
            // sessions/eligibility tiles — createpackage-frames.jsx:162-163.
            if model.isLocked {
                PkgNote(
                    tone: .warning,
                    icon: .lock,
                    // swiftlint:disable:next line_length
                    text: "\(model.activeBuyerCount) \(model.activeBuyerCount == 1 ? "person owns" : "people own") credits — you can't change sessions or eligibility while credits are active."
                )
            }
            redeemCard
            sessionsCard
            priceCard
            if model.isEditing {
                PkgNote(
                    tone: .info,
                    icon: .info,
                    text: "Changing the price creates a new Stripe price. Current buyers keep their terms."
                )
            }
            expiryCard
            activeCard
            // Inline save failure keeps the form (and the user's edits)
            // mounted — a full-screen error here would discard them on Retry.
            if let saveError = model.saveError {
                PkgNote(tone: .error, icon: .alertTriangle, text: saveError)
                    .accessibilityIdentifier("packageEditorSaveError")
            }
            Color.clear.frame(height: Spacing.s8)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    // MARK: Cards

    private var detailsCard: some View {
        PkgCard(overline: "Details") {
            PkgTextField(
                label: "Name",
                placeholder: "5-session cleaning",
                text: $model.name,
                error: model.nameError,
                helper: model.nameError ? "Give your package a name" : nil
            )
            PkgMultilineField(
                label: "Description",
                placeholder: "What's included",
                text: $model.packageDescription
            )
        }
    }

    private var redeemCard: some View {
        PkgCard(overline: "Redeems against") {
            if model.eventTypes.isEmpty {
                Text("Credits apply to all of your services.")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                    spacing: 8
                ) {
                    EventTile(
                        title: "All services",
                        duration: "Any event",
                        icon: .layers,
                        selected: model.selectedEventTypeId == nil,
                        accent: model.accent,
                        accentBg: model.theme.accentBg,
                        locked: model.isLocked
                    ) { model.selectEventType(nil) }
                    ForEach(model.eventTypes) { type in
                        EventTile(
                            title: type.name,
                            duration: model.tileDuration(type),
                            icon: .calendar,
                            selected: model.selectedEventTypeId == type.id,
                            accent: model.accent,
                            accentBg: model.theme.accentBg,
                            locked: model.isLocked
                        ) { model.selectEventType(type.id) }
                    }
                }
            }
        }
    }

    private var sessionsCard: some View {
        PkgCard(overline: "Sessions") {
            HStack {
                Text("Number of sessions").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Spacer()
                PkgStepper(value: $model.sessionsCount, disabled: model.isLocked)
            }
        }
    }

    private var priceCard: some View {
        PkgCard(overline: "Price") {
            HStack(alignment: .top, spacing: 8) {
                PkgTextField(placeholder: "$0.00", text: $model.priceText, keyboard: .decimalPad)
                Text("USD")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, 12)
                    .frame(height: 40)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            Text("\(model.perSessionLabel) per session")
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(model.accent)
        }
    }

    private var expiryCard: some View {
        // Functional control → product sky (design `Segmented` selects in blue700),
        // not the pillar accent. View-only until the expiry column lands.
        PkgCard(overline: "Expiry") {
            PkgSegmented(
                options: PackageEditorViewModel.Expiry.allCases.map(\.label),
                selectedIndex: PackageEditorViewModel.Expiry.allCases.firstIndex(of: model.expiry) ?? 1,
                accent: Theme.Color.primary700
            ) { idx in
                model.expiry = PackageEditorViewModel.Expiry.allCases[idx]
            }
        }
    }

    private var activeCard: some View {
        // Design's toggle switch is functional sky (`E.blue600`), not the pillar
        // accent — keep the switch product sky.
        PkgCard {
            PkgToggleRow(
                icon: .power,
                label: "Active",
                sub: "Buyers can purchase this package",
                isOn: $model.isActive,
                accent: Theme.Color.primary600
            )
        }
    }

    // MARK: Loading / gated / error

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(0..<4, id: \.self) { _ in
                Shimmer(width: 80, height: 9, cornerRadius: Radii.xs)
                Shimmer(height: 96, cornerRadius: Radii.xl)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
    }

    private var gated: some View {
        VStack(spacing: Spacing.s0) {
            PkgTopBar(title: title) { dismiss() }
            PkgComingSoon(title: "Packages")
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
    }

    private func errored(_ message: String) -> some View {
        VStack(spacing: Spacing.s0) {
            PkgTopBar(title: title) { dismiss() }
            PkgErrorState(message: message) { Task { await model.load() } }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
    }
}

// MARK: - Multiline field

/// Multiline counterpart to the shared `PkgTextField`, matching the design's
/// `TextInput … multiline` (1.5px border, radius 8, 48pt min height). Kept
/// stream-local because `PkgTextField` is single-line; promote to the shared
/// kit if another screen needs it.
private struct PkgMultilineField: View {
    var label: String?
    let placeholder: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label {
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
            }
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 9)
                }
                TextField("", text: $text, axis: .vertical)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2...5)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 9)
            }
            .frame(minHeight: 48, alignment: .topLeading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }
}

// MARK: - Event tile

private struct EventTile: View {
    let title: String
    let duration: String
    let icon: PantopusIcon
    let selected: Bool
    let accent: Color
    let accentBg: Color
    /// When true, the tile is dimmed and non-interactive (Frame 4: active buyers
    /// lock sessions + eligibility — createpackage-frames.jsx:16, 163).
    var locked = false
    let action: () -> Void

    var body: some View {
        Button(action: locked ? {} : action) {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Icon(icon, size: 15, color: selected ? accent : Theme.Color.appTextSecondary)
                    Spacer()
                    if selected { Icon(.check, size: 14, strokeWidth: 3, color: accent) }
                }
                Text(title)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if !duration.isEmpty {
                    Text(duration)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .padding(.vertical, 10)
            .background(selected ? accentBg : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(selected ? accent : Theme.Color.appBorder, lineWidth: selected ? 1.5 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(locked ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(locked)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
