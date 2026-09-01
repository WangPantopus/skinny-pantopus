//
//  ProSkillChip.swift
//  Pantopus
//
//  A.5 (A13.11) — Business-pillar skill chips. A chip added this session
//  flips to the amber "fresh" palette and shows a fresh dot; a removable
//  chip carries a trailing ×.
//

import SwiftUI

@MainActor
struct ProSkillChip: View {
    let skill: ProSkill
    var onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(skill.icon, size: 12, color: foreground)
            Text(skill.label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(foreground)
            if let onRemove {
                Button(action: onRemove) {
                    Icon(.x, size: 12, strokeWidth: 2.5, color: foreground)
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(skill.label)")
                .accessibilityIdentifier("proSkillRemove_\(skill.id)")
            }
        }
        .padding(.leading, Spacing.s2)
        .padding(.trailing, onRemove == nil ? Spacing.s2 : Spacing.s1)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(border, lineWidth: 1))
        .overlay(alignment: .topTrailing) {
            if skill.isFresh { FreshDot().offset(x: 1, y: -1) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(skill.isFresh ? "\(skill.label), added this session" : skill.label)
    }

    private var foreground: Color {
        skill.isFresh ? Theme.Color.warning : Theme.Color.business
    }

    private var background: Color {
        skill.isFresh ? Theme.Color.warningBg : Theme.Color.businessBg
    }

    private var border: Color {
        skill.isFresh ? Theme.Color.warningLight : Theme.Color.business.opacity(0.25)
    }
}

/// Dashed "+ Add" chip appended to the end of the skills wrap.
@MainActor
struct AddSkillChip: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 12, color: Theme.Color.appTextSecondary)
                Text("Add")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .frame(minHeight: 28)
            .overlay(
                Capsule().strokeBorder(
                    Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1, dash: [4])
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add skill")
        .accessibilityIdentifier("proAddSkillChip")
    }
}

#Preview {
    HStack {
        ProSkillChip(skill: ProSkill(id: "1", label: "Carpentry", icon: .hammer)) {}
        ProSkillChip(skill: ProSkill(id: "2", label: "Tile work", icon: .grid3x3, isFresh: true)) {}
        AddSkillChip {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
