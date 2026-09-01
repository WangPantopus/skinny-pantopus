//
//  SettingsTopBar.swift
//  Pantopus
//
//  Shared 52pt top bar for Settings sub-routes that don't use
//  `GroupedListView` (which has its own identical bar). Keeps the
//  back-chevron + centered title + 1pt bottom hairline shape
//  consistent across Settings.
//

import SwiftUI

@MainActor
struct SettingsTopBar: View {
    let title: String
    let onBack: @MainActor () -> Void
    var trailing: TrailingAction?

    struct TrailingAction {
        let label: String
        let isEnabled: Bool
        let handler: @MainActor () -> Void
    }

    var body: some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("settingsTopBarBack")
            Spacer()
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if let trailing {
                Button(action: trailing.handler) {
                    Text(trailing.label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(
                            trailing.isEnabled
                                ? Theme.Color.primary600
                                : Theme.Color.appTextMuted
                        )
                        .frame(minWidth: 36, minHeight: 36)
                }
                .buttonStyle(.plain)
                .disabled(!trailing.isEnabled)
                .accessibilityIdentifier("settingsTopBarAction")
            } else {
                Spacer().frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}
