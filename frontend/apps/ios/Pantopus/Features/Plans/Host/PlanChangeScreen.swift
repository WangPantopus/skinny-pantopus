//
//  PlanChangeScreen.swift
//  Pantopus
//
//  Board H11 "Change the time": the new start and end, what it was, and
//  when people are in and the start moves by more than 30 minutes (or a
//  public plan moves to another place, with the H6 picker), the warning
//  and a preview of the "Still coming?" push they'll get. The server sends
//  it (`PATCH /api/plans/:id`).
//

import SwiftUI

struct PlanChangeScreen: View {
    let planId: String
    let onBack: () -> Void

    @State private var plan: PlanDetailDTO?
    @State private var start = Date()
    @State private var end = Date()
    @State private var isSaving = false
    @State private var error: String?
    /// The H6 picker's draft, for moving a public plan.
    @State private var placeDraft: PlanComposerModel?
    @State private var newPlace: PlanPlaceOptionDTO?

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Change the time", leading: .back, onLeading: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    if let card = plan?.card {
                        when(card)
                        if card.placeKind != .home { place(card) }
                        if asksStillComing(card) { warning(card) }
                        if asksStillComing(card) { preview(card) }
                    } else {
                        Shimmer(width: nil, height: 120, cornerRadius: Radii.xl)
                    }
                    if let error {
                        Text(error).planFont(.small).foregroundStyle(Theme.Color.error).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s6)
            }
            if let card = plan?.card { footer(card) }
        }
        .background(Theme.Color.appBg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
        .sheet(item: $placeDraft) { draft in
            PlanPlacePicker(model: draft) {
                newPlace = draft.place ?? newPlace
                placeDraft = nil
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planChange")
    }

    private func place(_ card: PlanCardDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Where")
            Button {
                let draft = PlanComposerModel(start: PlansHostStart(kind: card.kind))
                draft.place = newPlace
                placeDraft = draft
            } label: {
                PlanFormCard {
                    HStack(spacing: Spacing.s3) {
                        Text(newPlace?.name ?? plan?.place?.name ?? card.area.label)
                            .planFont(.body)
                            .foregroundStyle(newPlace == nil ? Theme.Color.appText : Theme.Color.primary700)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(.vertical, Spacing.s2)
                    .frame(minHeight: 52)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Where: \(newPlace?.name ?? plan?.place?.name ?? card.area.label)")
            .accessibilityHint("Choose another place")
            .accessibilityIdentifier("planChangePlace")
        }
    }

    private func load() async {
        guard let detail = try? await PlansStoreReads.detail(id: planId) else {
            error = "We couldn't load this plan."
            return
        }
        plan = detail
        start = detail.card.startsAtDate ?? Date()
        end = detail.card.endsAtDate ?? start.addingTimeInterval(7200)
    }

    private func when(_ card: PlanCardDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("When")
            VStack(spacing: 0) {
                DatePicker(
                    selection: $start,
                    in: Date()...Date().addingTimeInterval(14 * 86400),
                    displayedComponents: [.date, .hourAndMinute]
                ) {
                    Text("Starts").planFont(.body)
                }
                .tint(Theme.Color.primary700)
                .padding(.vertical, 10)
                .onChange(of: start) { old, new in
                    // Keep the length when the start moves.
                    end = end.addingTimeInterval(new.timeIntervalSince(old))
                }
                Divider().overlay(Theme.Color.appBorder)
                DatePicker(
                    selection: $end,
                    in: start.addingTimeInterval(15 * 60)...start.addingTimeInterval(8 * 3600),
                    displayedComponents: [.hourAndMinute]
                ) {
                    Text("Ends").planFont(.body)
                }
                .padding(.vertical, 10)
            }
            .padding(.horizontal, 14)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            if let original = card.startsAtDate, abs(original.timeIntervalSince(start)) >= 60 {
                Text("Was \(PlanFormat.time(original, calendar: PlanFormat.calendar(for: card.timezone)))")
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    /// Everyone coming, parties counted in full ("Alex + 1" is two), as the board's "5 people are in".
    private func goingCount(_ card: PlanCardDTO) -> Int {
        let guests = (plan?.people ?? []).filter { !$0.isHost }
        return guests.isEmpty ? card.goingCount : guests.reduce(0) { $0 + max($1.partySize, 1) }
    }

    /// Moving the start by more than 30 minutes, or the place, asks everyone who's in.
    private func asksStillComing(_ card: PlanCardDTO) -> Bool {
        goingCount(card) > 0 && (newPlace != nil || timeMoved(card))
    }

    private func timeMoved(_ card: PlanCardDTO) -> Bool {
        guard let original = card.startsAtDate else { return false }
        return abs(original.timeIntervalSince(start)) > 30 * 60
    }

    /// The push the server sends, word for word (board H11; Android shows the same).
    private func pushWords(_ card: PlanCardDTO) -> (title: String, body: String) {
        let calendar = PlanFormat.calendar(for: card.timezone)
        let host = PlanCardLines.firstName(card.host.displayName)
        let noun = card.kind.title.lowercased()
        let now = "Now \(PlanFormat.dayPhrase(start, calendar: calendar)) at \(PlanFormat.time(start, calendar: calendar))"
        if newPlace != nil, timeMoved(card) { return ("\(host) changed the \(noun)", "\(now), at a new place. Still coming?") }
        if newPlace != nil { return ("\(host) changed the place", "It's at a new place now. Still coming?") }
        return ("\(host) moved the \(noun)", "\(now). Still coming?")
    }

    private func warning(_ card: PlanCardDTO) -> some View {
        let going = goingCount(card)
        return PlanBanner(
            tone: .warning,
            icon: .alertTriangle,
            title: "\(going) \(going == 1 ? "person is" : "people are") in",
            message: newPlace == nil
                ? "Moving the time by more than 30 minutes asks each of them \u{201C}Still coming?\u{201D}"
                : "Changing the place asks each of them \u{201C}Still coming?\u{201D}"
        )
    }

    private func preview(_ card: PlanCardDTO) -> some View {
        let push = pushWords(card)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("What they'll get")
            VStack(alignment: .leading, spacing: 3) {
                Text("Pantopus · now").planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
                Text(push.title).planFont(.smallStrong).foregroundStyle(Theme.Color.appText)
                Text(push.body)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appText)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.Color.appSurfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            VStack(spacing: 0) {
                Text("Still coming").frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 13)
                Divider().overlay(Theme.Color.appBorder)
                Text("Can't make it").frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 13)
            }
            .planFont(.body)
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s4)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .accessibilityElement(children: .combine)
    }

    private func footer(_ card: PlanCardDTO) -> some View {
        VStack(spacing: Spacing.s2) {
            Button(action: save) {
                PlanButtonLabel(title: asksStillComing(card) ? "Save and ask them" : "Save", kind: .primary, isLoading: isSaving)
            }
            .planButton(.primary)
            .disabled(isSaving)
            .accessibilityIdentifier("planChangeSave")
            if let original = card.startsAtDate {
                Button("Keep \(PlanFormat.time(original, calendar: PlanFormat.calendar(for: card.timezone)))", action: onBack)
                    .planButton(.text, size: .extraSmall)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
    }

    private func save() {
        var body = UpdatePlanBody()
        body.startsAt = PlanTime.string(start)
        body.endsAt = PlanTime.string(end)
        if let newPlace {
            body.place = PlanPlaceBody(
                kind: .publicPlace,
                name: newPlace.name,
                address: newPlace.address,
                latitude: newPlace.latitude,
                longitude: newPlace.longitude,
                homeId: nil
            )
        }
        Task {
            isSaving = true
            error = nil
            do {
                let _: PlanDetailDTO = try await APIClient.shared.request(PlansEndpoints.update(id: planId, body))
                PlansStoreReads.changed(planId: planId)
                isSaving = false
                onBack()
            } catch {
                isSaving = false
                self.error = PlanErrors.sentence(for: error)
            }
        }
    }
}
