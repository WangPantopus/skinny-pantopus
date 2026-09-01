//
//  AddHouseholdTaskFormSkeleton.swift
//  Pantopus
//

import SwiftUI

/// Shimmer skeleton shown while Edit-mode hydration runs. Mirrors the
/// loaded geometry so the form snaps in without a layout jump.
@MainActor
struct AddHouseholdTaskFormSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            ZStack {
                Text("Edit task")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            ForEach(0..<3, id: \.self) { group in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Shimmer(width: 96, height: 12)
                        .padding(.horizontal, Spacing.s4)
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        ForEach(0..<(group == 0 ? 2 : 2), id: \.self) { _ in
                            Shimmer(width: 240, height: 44)
                        }
                    }
                    .padding(Spacing.s4)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .padding(.horizontal, Spacing.s4)
                }
            }
            Spacer()
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("addHouseholdTaskFormSkeleton")
    }
}

#Preview("Add - empty") {
    AddHouseholdTaskFormView(homeId: "preview-home") {}
}

#Preview("Edit - prefilled") {
    AddHouseholdTaskFormView(
        homeId: "preview-home",
        taskId: "preview-task"
    ) {}
}
