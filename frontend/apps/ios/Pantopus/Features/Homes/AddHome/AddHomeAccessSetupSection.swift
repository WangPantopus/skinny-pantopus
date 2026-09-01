//
//  AddHomeAccessSetupSection.swift
//  Pantopus
//
//  A12.2 — the Add-Home wizard's Setup block: "Networks & codes
//  (optional)". Ports RN's `src/components/homes/SetupStep.tsx:66-173`
//  — repeatable rows of (access type × label × secret), a per-row reveal
//  toggle, a "Scan WiFi QR" affordance on Wi-Fi rows, and an "Add another
//  network or code" button.
//
//  Each filled row becomes a `POST /api/homes/:id/access` call once the
//  home exists (`backend/routes/home.js:5735`), matching RN's
//  `finalizeCreatedHome`.
//
//  Rendered on the wizard's Role step, which is RN's Setup step — role
//  picker first, networks & codes underneath — and hidden entirely when
//  the user is joining an existing home.
//

import SwiftUI

struct AddHomeAccessSetupSection: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Networks & codes (optional)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(
                    "Add WiFi (main, guest, etc.) and other codes like door or gate. "
                        + "Passwords can't be read from your device for security—enter them manually."
                )
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(viewModel.accessItems) { item in
                AccessItemCard(
                    item: item,
                    canRemove: viewModel.accessItems.count > 1,
                    onSelectType: { viewModel.updateAccessType(item.id, to: $0) },
                    onLabelChange: { viewModel.updateAccessLabel(item.id, to: $0) },
                    onSecretChange: { viewModel.updateAccessSecret(item.id, to: $0) },
                    onToggleReveal: { viewModel.toggleAccessSecretRevealed(item.id) },
                    onScanQR: { viewModel.openWifiQRScanner(for: item.id) },
                    onRemove: { viewModel.removeAccessItem(item.id) }
                )
            }

            Button {
                viewModel.addAccessItem()
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.plusCircle, size: 20, strokeWidth: 2, color: Theme.Color.primary600)
                    Text("Add another network or code")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("addHome_addAccessItem")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("addHomeAccessSetupSection")
    }
}

// MARK: - One row

private struct AccessItemCard: View {
    let item: AddHomeAccessItem
    let canRemove: Bool
    let onSelectType: (AddHomeAccessType) -> Void
    let onLabelChange: (String) -> Void
    let onSecretChange: (String) -> Void
    let onToggleReveal: () -> Void
    let onScanQR: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                typeChips
                if canRemove {
                    Button(action: onRemove) {
                        Icon(.trash2, size: 18, strokeWidth: 2, color: Theme.Color.error)
                            .frame(width: 36, height: 36)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(item.accessType.label) entry")
                    .accessibilityIdentifier("addHome_removeAccessItem")
                }
            }

            if item.accessType == .wifi {
                Button(action: onScanQR) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.scanLine, size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                        Text("Scan WiFi QR")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("addHome_scanWifiQr")
            }

            AddHomeTextField(
                label: "Label (e.g. Main WiFi, Front door)",
                placeholder: item.accessType.labelPlaceholder,
                text: Binding(get: { item.label }, set: onLabelChange),
                errorText: item.labelError,
                identifier: "addHome_accessLabel"
            )

            AddHomeTextField(
                label: item.accessType.valueFieldLabel,
                placeholder: item.accessType.valuePlaceholder,
                text: Binding(get: { item.secretValue }, set: onSecretChange),
                isSecure: !item.isRevealed,
                errorText: item.valueError,
                trailing: AnyView(
                    Button(action: onToggleReveal) {
                        Icon(
                            item.isRevealed ? .eyeOff : .eye,
                            size: 18,
                            strokeWidth: 2,
                            color: Theme.Color.appTextSecondary
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(item.isRevealed ? "Hide value" : "Show value")
                    .accessibilityIdentifier("addHome_toggleAccessSecret")
                ),
                identifier: "addHome_accessSecret"
            )
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }

    private var typeChips: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Type")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(AddHomeAccessType.allCases, id: \.self) { type in
                        chip(type)
                    }
                }
                .padding(.horizontal, 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chip(_ type: AddHomeAccessType) -> some View {
        let isSelected = item.accessType == type
        return Button {
            onSelectType(type)
        } label: {
            Text(type.label)
                .font(.system(size: 12.5, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(isSelected ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("addHome_accessType_\(type.rawValue)")
    }
}
