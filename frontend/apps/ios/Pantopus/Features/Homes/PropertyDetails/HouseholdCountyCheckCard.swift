//
//  HouseholdCountyCheckCard.swift
//  Pantopus
//
//  Link and confirm (`backend/config/countyLinks.js`): the county's own page for a home with
//  no county record, then "Is this right?" with year built, size, bedrooms and baths once the
//  person is back. Drawn only when the server sends `county_check`.
//

import SwiftUI

/// Link and confirm on Property details, for a home no county record answers: the county's page, then "Is this
/// right?" with year built, size, bedrooms and baths once the person is back. Yes keeps them as the household's own.
struct HouseholdCountyCheckCard: View {
    let page: HouseholdCountyPageDTO
    let check: HouseholdCountyCheckDTO
    let actions: HouseholdActions
    /// Whether this person opened the county's page for this Home on this device; a relaunch still asks.
    @AppStorage private var opened: Bool

    init(page: HouseholdCountyPageDTO, check: HouseholdCountyCheckDTO, actions: HouseholdActions) {
        self.page = page
        self.check = check
        self.actions = actions
        _opened = AppStorage(wrappedValue: false, "countyPageOpened.\(actions.homeId)")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HouseholdCountyPageLink(page: page) { opened = true }
            if opened || check.confirmed != nil {
                Text(check.lead)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if check.facts.contains(where: { $0.value != nil }) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        ForEach(check.facts) { fact in
                            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                                Text(fact.label)
                                    .pantopusTextStyle(.small)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                Spacer(minLength: Spacing.s2)
                                Text(fact.value ?? "—")
                                    .pantopusTextStyle(.small)
                                    .foregroundStyle(Theme.Color.appText)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                if let confirmed = check.confirmed {
                    HStack(spacing: Spacing.s2) {
                        Text(confirmed)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: Spacing.s2)
                        if check.canUndo {
                            action("Undo", id: "undo") { actions.save([.undoConfirm(group: check.group)]) }
                        }
                    }
                }
                if let prompt = check.prompt {
                    HStack(spacing: Spacing.s3) {
                        Text(prompt)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: Spacing.s2)
                        action("Yes", id: "yes") { actions.save([.confirm(group: check.group)]) }
                    }
                }
                action(check.fix, id: "fix") { actions.edit(HouseholdGroupDTO(countyCheck: check)) }
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("propertyDetails_countyCheck")
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
        .accessibilityIdentifier("propertyDetails_countyCheck_\(id)")
    }
}

extension HouseholdGroupDTO {
    /// "Fix something" from "Is this right?" after the county's page: its four facts.
    init(countyCheck check: HouseholdCountyCheckDTO) {
        self.init(
            id: check.group,
            sectionId: nil,
            title: check.prompt ?? check.fix,
            lead: check.lead,
            prompt: nil,
            confirmed: nil,
            fix: nil,
            facts: check.facts,
            report: nil,
            reported: nil
        )
    }
}
