//
//  SavedPlacesActionSheet.swift
//  Pantopus
//

import SwiftUI

/// BLOCK 2E Frame 3 — the row overflow action sheet: Open on map / Share
/// place / Remove (destructive). Driven by the VM's `actionTarget` binding.
struct SavedPlacesActionSheet: View {
    let target: SavedPlaceActionTarget
    let onOpenMap: @MainActor () -> Void
    let onRemove: @MainActor () -> Void
    let onCancel: @MainActor () -> Void

    /// System-share payload — the place name + an Apple Maps coordinate link.
    private var shareText: String {
        "\(target.label) \u{2014} https://maps.apple.com/?ll=\(target.latitude),\(target.longitude)"
    }

    var body: some View {
        VStack(spacing: Spacing.s2) {
            actionsCard
            cancelCard
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .background(Theme.Color.appSurfaceMuted)
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.visible)
    }

    private var actionsCard: some View {
        VStack(spacing: 0) {
            contextHeader
            divider
            sheetRow(icon: .map, label: "Open on map", id: "savedPlaces.action.openMap") {
                onOpenMap()
            }
            divider
            ShareLink(item: shareText) {
                HStack(spacing: Spacing.s3) {
                    Icon(.share, size: 20, color: Theme.Color.appText)
                    Text("Share place")
                        .font(.system(size: 15.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .contentShape(Rectangle())
            }
            .accessibilityIdentifier("savedPlaces.action.share")
            divider
            sheetRow(icon: .trash2, label: "Remove", destructive: true, id: "savedPlaces.action.remove") {
                onRemove()
            }
        }
        .background(card)
        .accessibilityIdentifier("savedPlaces.actionSheet")
    }

    private var contextHeader: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(target.type.tileBackground)
                Icon(target.type.icon, size: 16, color: target.type.tileForeground)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(target.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(target.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private func sheetRow(
        icon: PantopusIcon,
        label: String,
        destructive: Bool = false,
        id: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 20, color: destructive ? Theme.Color.error : Theme.Color.appText)
                Text(label)
                    .font(.system(size: 15.5, weight: .medium))
                    .foregroundStyle(destructive ? Theme.Color.error : Theme.Color.appText)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var cancelCard: some View {
        Button(action: onCancel) {
            Text("Cancel")
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .background(card)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("savedPlaces.actionCancel")
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorderSubtle)
            .frame(height: 1)
            .padding(.leading, Spacing.s12)
    }

    private var card: some View {
        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
            .fill(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}
