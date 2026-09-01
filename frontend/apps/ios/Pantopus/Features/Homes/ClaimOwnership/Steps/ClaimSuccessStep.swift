//
//  ClaimSuccessStep.swift
//  Pantopus
//
//  Final step of the Claim Ownership wizard. Routes through the
//  shared T3.6 Status / Waiting view so all "submitted" surfaces
//  share the same chrome, ETA chip, and follow-up cards.
//

import SwiftUI

struct ClaimSuccessStep: View {
    let homeName: String?
    /// Extra line describing what the submission actually did — a
    /// parallel claim, or a challenge that opened against the current
    /// verified household. Derived from the backend's
    /// `routing_classification` (RN passes the same signal into its
    /// `submitted` screen as `?parallel=1` / `?challenge=1`).
    let outcomeNote: String?

    init(homeName: String? = nil, outcomeNote: String? = nil) {
        self.homeName = homeName
        self.outcomeNote = outcomeNote
    }

    var body: some View {
        // Dock-less body: `WizardShell` already supplies the sticky CTA dock,
        // so the full `StatusWaitingView` would stack a second one. Mirrors
        // Android's `ClaimOwnershipWizardScreen` using `StatusWaitingBody`.
        VStack(alignment: .leading, spacing: Spacing.s3) {
            StatusWaitingBodyView(content: .claimSubmitted(homeName: homeName))
            if let outcomeNote {
                Text(outcomeNote)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .accessibilityIdentifier("claimOwnership_outcomeNote")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    ClaimSuccessStep(homeName: "412 Elm St")
        .background(Theme.Color.appBg)
}
