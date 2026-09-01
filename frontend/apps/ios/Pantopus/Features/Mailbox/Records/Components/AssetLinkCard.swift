//
//  AssetLinkCard.swift
//  Pantopus
//
//  One row in the Home Records asset index: category glyph, name,
//  room · manufacturer, warranty pill, and the linked-mail count.
//
//  Mirrors `ui/screens/mailbox/home_records/components/AssetLinkCard.kt`.
//

import SwiftUI

struct AssetLinkCard: View {
    let asset: HomeRecordAsset
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.homeBg)
                        .frame(width: 42, height: 42)
                    Icon(asset.category.icon, size: 22, color: Theme.Color.home)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(asset.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if metaLine != nil {
                        Text(metaLine ?? "")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .lineLimit(1)
                    }
                    HStack(spacing: Spacing.s2) {
                        Text(asset.warranty.label)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(asset.warranty.tint)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(asset.warranty.background)
                            .clipShape(Capsule())
                        Text(mailCountLabel)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appBorderStrong)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("homeRecords_asset_\(asset.id)")
        .accessibilityLabel("\(asset.name). Warranty \(asset.warranty.label). \(mailCountLabel)")
    }

    private var metaLine: String? {
        let parts = [asset.room, asset.manufacturer].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var mailCountLabel: String {
        "\(asset.linkedMailCount) mail item\(asset.linkedMailCount == 1 ? "" : "s")"
    }
}

#if DEBUG
#Preview("Asset row") {
    AssetLinkCard(
        asset: HomeRecordAsset(
            id: "a-1",
            name: "Bosch 800 dishwasher",
            category: .appliance,
            room: "Kitchen",
            manufacturer: "Bosch",
            modelNumber: "SHPM88Z75N",
            purchasedLabel: "Mar 4, 2024",
            warranty: .expiringSoon,
            linkedMailCount: 3
        )
    ) {}
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
#endif
