//
//  ClaimStatement.swift
//  Pantopus
//
//  A12.4 — Claim ownership · Evidence. Optional free-text statement the
//  claimant adds for the reviewer. Header with an "Optional" tag + a live
//  character counter, capped at `maxChars`.
//

import SwiftUI

/// Optional reviewer statement field. Bound to the wizard view model's note.
struct ClaimStatement: View {
    @Binding var text: String
    var maxChars: Int = 500
    let placeholder: String

    private var cappedBinding: Binding<String> {
        Binding(
            get: { text },
            set: { text = String($0.prefix(maxChars)) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                Text("Your statement")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Optional")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .textCase(.uppercase)
                Spacer(minLength: Spacing.s0)
                Text("\(text.count)/\(maxChars)")
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextMuted)
            }

            TextField(placeholder, text: cappedBinding, axis: .vertical)
                .font(.system(size: 13))
                .lineLimit(3...8)
                .foregroundStyle(Theme.Color.appText)
                .padding(Spacing.s3)
                .frame(minHeight: 64, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                }
                .accessibilityIdentifier("claimOwnership_note")
        }
    }
}

#Preview {
    VStack(spacing: Spacing.s5) {
        ClaimStatement(
            text: .constant(""),
            placeholder: ClaimUploadCopy.statementPlaceholder
        )
        ClaimStatement(
            text: .constant("I purchased the property at 412 Elm St in March 2022."),
            placeholder: ClaimUploadCopy.statementPlaceholder
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
