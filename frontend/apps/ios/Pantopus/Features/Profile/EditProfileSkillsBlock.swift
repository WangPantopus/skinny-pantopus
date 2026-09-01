//
//  EditProfileSkillsBlock.swift
//  Pantopus
//
//  Skills editor for the Edit Profile form — an add-skill input plus
//  tap-to-remove chips. The working list lives on
//  `EditProfileViewModel` and is committed by its `save()` through
//  `PUT /api/users/skills` (`backend/routes/users.js:2246`, mounted at
//  `backend/app.js:306`) alongside the profile PATCH.
//
//  Chip presentation matches the read-only skill chips already rendered
//  on the public profile (`Features/Shared/ContentDetail/Bodies/
//  StatsTabsBody.swift:262`), with a remove glyph added.
//

import SwiftUI

/// Add-skill input + removable chip row for the Edit Profile form.
@MainActor
struct EditProfileSkillsBlock: View {
    let skills: [String]
    let draft: String
    let canAdd: Bool
    let onDraftChange: @MainActor (String) -> Void
    let onAdd: @MainActor () -> Void
    let onRemove: @MainActor (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                PantopusTextField(
                    "Add a skill",
                    text: Binding(get: { draft }, set: { onDraftChange($0) }),
                    placeholder: "Plumbing, tutoring, dog walking…",
                    identifier: "field_skillDraft"
                )
                .onSubmit { onAdd() }
                Button("Add") { onAdd() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(canAdd ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                    .frame(minWidth: 56, minHeight: 44)
                    .disabled(!canAdd)
                    .accessibilityIdentifier("editProfileAddSkillButton")
                    .padding(.top, Spacing.s5)
            }
            if skills.isEmpty {
                Text("No skills yet. Neighbors browse these when they're looking for help.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("editProfileSkillsEmpty")
            } else {
                EditProfileSkillChips(skills: skills, onRemove: onRemove)
            }
        }
        .accessibilityIdentifier("editProfileSkills")
    }
}

/// Wrapping row of removable skill chips.
private struct EditProfileSkillChips: View {
    let skills: [String]
    let onRemove: @MainActor (String) -> Void

    var body: some View {
        EditProfileSkillsFlowLayout(spacing: Spacing.s2) {
            ForEach(skills, id: \.self) { skill in
                Button { onRemove(skill) } label: {
                    HStack(spacing: Spacing.s1) {
                        Text(skill)
                            .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary700)
                        Icon(.x, size: 12, color: Theme.Color.primary700)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(Theme.Color.primary100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("editProfileSkillChip_\(skill)")
                .accessibilityLabel("Remove \(skill)")
            }
        }
    }
}

/// Minimal flow layout — wraps children to the next row when they
/// overflow. Mirrors `StatsTabsFlowLayout` in `StatsTabsBody.swift`, kept
/// local because these chips carry an interactive remove affordance.
private struct EditProfileSkillsFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if rowWidth + size.width > width {
                totalHeight += rowHeight + spacing
                rowWidth = size.width + spacing
                rowHeight = size.height
            } else {
                rowWidth += size.width + spacing
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        return CGSize(width: width, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
