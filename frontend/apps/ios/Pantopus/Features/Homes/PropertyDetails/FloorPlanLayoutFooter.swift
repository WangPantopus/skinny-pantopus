//
//  FloorPlanLayoutFooter.swift
//  Pantopus
//
//  "Is this your layout?", for a unit its building's floor-plan sheet names
//  (`backend/services/householdFacts.js`). A server without it draws nothing new.
//

import SwiftUI

/// "Is this your layout?" at the foot of the card a building's floor plan fills, or what the household said.
struct FloorPlanLayoutFooter: View {
    let layout: FloorPlanLayoutDTO
    let actions: HouseholdActions

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let answered = layout.answered {
                HStack(spacing: Spacing.s2) {
                    Text(answered)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: Spacing.s2)
                    if layout.canUndo {
                        action("Undo", id: "undo") { actions.answerLayout("undo") }
                    }
                }
            } else if let prompt = layout.prompt {
                HStack(spacing: Spacing.s3) {
                    Text(prompt)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: Spacing.s2)
                    action("Yes", id: "yes") { actions.answerLayout("yes") }
                    action("No", id: "no") { actions.answerLayout("no") }
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("propertyDetails_floorPlan")
    }

    private func action(_ title: String, id: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Text(title)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.primary600)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(actions.saving)
        .accessibilityIdentifier("propertyDetails_floorPlan_\(id)")
    }
}
