//
//  EditAccessCodeFormSkeleton.swift
//  Pantopus
//

import SwiftUI

/// Shown while the secret read confirms what this person may see and change.
/// Mirrors the form's field groups, as `AddHouseholdTaskFormSkeleton` does,
/// instead of a screen-level spinner. Mirrors the Android editor's skeleton.
@MainActor
struct EditAccessCodeFormSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Shimmer(width: 96, height: 12)
                    Shimmer(width: 240, height: 44)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Checking access")
    }
}
