//
//  PlanAfterCard.swift
//  Pantopus
//
//  Board A5, after a plan: a guest is asked "How was Sunday's watch party?"
//  (only Pantopus sees the answer; "Something wasn't right" files a report
//  in the admin queue), and a host is offered "Host again", the same plan
//  next week. "Tell me when Sam hosts again" is not in v1 (brief section 2).
//

import SwiftUI

struct PlanAfterCard: View {
    let card: PlanCardDTO
    let model: PlansTodayModel
    let onHostAgain: (PlanDetailDTO) -> Void

    var body: some View {
        if card.viewer?.isHost == true { hostAgain } else { howWasIt }
    }

    private var dayKind: String {
        let day = card.startsAtDate.map { PlanFormat.dayHeading($0, calendar: PlanFormat.calendar(for: card.timezone)) } ?? "the"
        let possessive = day == "Today" ? "today's" : day == "Tomorrow" ? "the" : day == "the" ? "the" : "\(day)'s"
        return "\(possessive) \(card.kind.title.lowercased())"
    }

    // MARK: - Guest

    private var howWasIt: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                PlanTile(kind: card.kind)
                VStack(alignment: .leading, spacing: 0) {
                    Text("How was \(dayKind)?").planFont(.h4).foregroundStyle(Theme.Color.appText)
                    Text("Only Pantopus sees your answer.").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
            if let answer = model.answered[card.id] {
                Text(answer == .notRight
                    ? "Thanks for telling us. Someone from Pantopus will look at it."
                    : "Thanks. Glad you went.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: Spacing.s2) {
                    Button("Great") { Task { await model.answer(card, .great) } }
                        .planButton(.secondary, size: .small)
                        .accessibilityIdentifier("planAfterGreat")
                    Button("It was OK") { Task { await model.answer(card, .okay) } }
                        .planButton(.secondary, size: .small)
                    Button { Task { await model.answer(card, .notRight) } } label: {
                        PlanButtonLabel(title: "Something wasn't right", icon: .flag, kind: .secondary)
                    }
                    .planButton(.secondary, size: .small)
                    .accessibilityIdentifier("planAfterNotRight")
                }
                .disabled(model.working.contains(card.id))
            }
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("planAfter.\(card.id)")
    }

    // MARK: - Host

    private var hostAgain: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                PlanTile(kind: card.kind)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Host your \(card.kind.title.lowercased()) again?").planFont(.h4).foregroundStyle(Theme.Color.appText)
                    Text(cameLine).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: 10) {
                Button("Not now") { model.dismiss(card) }
                    .planButton(.tonal, size: .small)
                Button("Host again") {
                    Task {
                        if let detail = await model.hostAgain(card) { onHostAgain(detail) }
                    }
                }
                .planButton(.primary, size: .small)
                .accessibilityIdentifier("planHostAgain")
            }
            .disabled(model.working.contains(card.id))
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("planHostAgainCard.\(card.id)")
    }

    /// "5 people came last Tuesday. Same time next week?"
    private var cameLine: String {
        let weekday = card.startsAtDate.map { PlanFormat.dayHeading($0, calendar: PlanFormat.calendar(for: card.timezone)) }
        let when = weekday.map { $0 == "Today" ? "today" : $0 == "Tomorrow" ? "" : "last \($0)" } ?? ""
        let people = "\(card.goingCount) \(card.goingCount == 1 ? "person" : "people") came"
        return when.isEmpty ? "\(people). Same time next week?" : "\(people) \(when). Same time next week?"
    }
}

/// "Not now" on Host again, remembered per plan for this account.
@MainActor
enum PlanAfterDismissals {
    static func isDismissed(_ planId: String) -> Bool {
        (UserDefaults.standard.stringArray(forKey: key) ?? []).contains(planId.lowercased())
    }

    static func dismiss(_ planId: String) {
        var ids = UserDefaults.standard.stringArray(forKey: key) ?? []
        ids.append(planId.lowercased())
        UserDefaults.standard.set(Array(ids.suffix(100)), forKey: key)
    }

    private static var key: String {
        "pantopus.plans.afterDismissed.\(ScreenStore.accountKey)"
    }
}
