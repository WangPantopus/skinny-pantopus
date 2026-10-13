//
//  PlanDetailsForm.swift
//  Pantopus
//
//  Boards H2 (watch party), H3 (playdate), H4 (pickup game) and H5 (walk &
//  coffee): the kind's own choices, the title, when, where (with the place
//  picker, H6), spots, how people get in, the note for people who are in,
//  and for a watch party the "about" everyone sees.
//

import SwiftUI

struct PlanDetailsForm: View {
    @Bindable var model: PlanComposerModel
    let step: String
    let onBack: () -> Void
    let onPreview: () -> Void

    @State private var showsPlacePicker = false

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: model.kind.title, leading: .back, trailing: step, onLeading: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s6) {
                    PlanKindFields(model: model)
                    if model.kind != .pickupGame { titleField }
                    if model.kind == .walkCoffee { PlanWalkExtras(model: model) }
                    when
                    whereSection
                    spotsRow
                    approvalSection
                    if model.kind == .pickupGame { gearSwitch }
                    noteField
                    if model.kind == .watchParty { aboutField }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s6)
            }
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .background(Theme.Color.appBg)
        .sheet(isPresented: $showsPlacePicker) {
            PlanPlacePicker(model: model) { showsPlacePicker = false }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planDetailsForm")
    }

    // MARK: - Fields

    private var titleField: some View {
        PlanFormField(label: "Title") {
            PlanTextInput(placeholder: titlePlaceholder, text: $model.title, identifier: "planTitle")
        }
    }

    private var titlePlaceholder: String {
        switch model.kind {
        case .watchParty: "Seahawks game on the big screen"
        case .playdate: "Playground morning"
        case .pickupGame: ""
        case .walkCoffee: "Coffee walk around the lake"
        }
    }

    private var when: some View {
        PlanFormField(label: "When") {
            if model.kind == .pickupGame {
                PlanSegmented(
                    options: [(true, "Now"), (false, "Later")],
                    selection: $model.startsNow,
                    label: "When"
                )
            }
            PlanFormCard {
                if !(model.kind == .pickupGame && model.startsNow) {
                    PlanDateRow(
                        label: "Starts",
                        date: $model.start,
                        components: [.date, .hourAndMinute],
                        range: Date()...Date().addingTimeInterval(14 * 86400)
                    )
                    Divider().overlay(Theme.Color.appBorder)
                }
                PlanDateRow(
                    label: model.kind == .pickupGame && model.startsNow ? "Until" : "Ends",
                    date: $model.end,
                    components: [.hourAndMinute],
                    range: model.effectiveStart.addingTimeInterval(15 * 60)...model.effectiveStart.addingTimeInterval(8 * 3600)
                )
            }
            if model.kind == .playdate {
                PlanScopeLine(
                    text: "Neighbors see \u{201C}\(PlanFormat.dayPartPhrase(dayPart, day: model.start))\u{201D} until you accept them."
                )
            }
        }
        .onChange(of: model.start) { old, new in
            model.end = model.end.addingTimeInterval(new.timeIntervalSince(old))
        }
    }

    private var dayPart: PlanDayPart {
        let hour = Calendar.current.component(.hour, from: model.start)
        switch hour {
        case 5..<12: return .morning
        case 12..<17: return .afternoon
        case 17..<21: return .evening
        default: return .night
        }
    }

    private var whereSection: some View {
        PlanFormField(label: "Where") {
            if model.canHostAtHome {
                PlanSegmented(
                    options: [
                        (PlanComposerModel.Where.publicPlace, "A public place"),
                        (.home, model.kind == .walkCoffee ? "My porch" : "My place")
                    ],
                    selection: Binding(get: { model.whereKind }, set: { model.setWhere($0) }),
                    label: "Where"
                )
            }
            if model.whereKind == .home {
                PlanFormCard {
                    HStack(spacing: Spacing.s3) {
                        smallTile(.home, tint: Theme.Color.appSurfaceSunken, ink: Theme.Color.appTextStrong)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(model.kind == .walkCoffee ? "My porch" : "My place").planFont(.bodyStrong)
                                .foregroundStyle(Theme.Color.appText)
                            Text(model.home.map { home in
                                "Your home\(home.city.map { " in \($0)" } ?? "")"
                            } ?? "Add your home in Place first")
                                .planFont(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 10)
                }
                PlanScopeLine(text: "Only people you accept see your address. Everyone else sees the area.")
            } else {
                Button { showsPlacePicker = true } label: {
                    PlanFormCard {
                        HStack(spacing: Spacing.s3) {
                            smallTile(.mapPin, tint: model.kind.tint, ink: model.kind.color)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(model.place?.name ?? "Choose a place").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                                Text(placeSubtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                        }
                        .padding(.vertical, 10)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("planChoosePlace")
                PlanScopeLine(text: placeScope)
            }
        }
    }

    private var placeSubtitle: String {
        guard let place = model.place else { return "Parks, courts, cafés and more" }
        return [place.category?.capitalized, "public place"].compactMap { $0 }.joined(separator: " · ")
    }

    private var placeScope: String {
        switch model.kind {
        case .playdate: "Families you accept see the exact spot. Others see the neighborhood."
        case .pickupGame: "Your location only proves you're nearby. The pin shows the place's area."
        default: "People you accept see the exact spot. Everyone else sees the area."
        }
    }

    private var spotsRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(spotsTitle).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                Text(spotsSubtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            PlanStepper(value: $model.spots, range: 1...30, label: spotsTitle)
        }
    }

    private var spotsTitle: String {
        switch model.kind {
        case .watchParty: "Spots"
        case .playdate: "Families"
        case .pickupGame: "Players needed"
        case .walkCoffee: "People"
        }
    }

    private var spotsSubtitle: String {
        switch model.kind {
        case .watchParty: "People who can join, besides you"
        case .playdate: "Besides yours"
        case .pickupGame: "Shown as \u{201C}need \(model.spots)\u{201D}"
        case .walkCoffee: "Besides you"
        }
    }

    private var approvalSection: some View {
        PlanFormField(label: model.kind == .playdate ? "How families get in" : "How people get in") {
            PlanApprovalOptions(model: model)
        }
    }

    private var gearSwitch: some View {
        PlanSwitchRow(
            title: "I have extra \(PlanComposerOptions.gearNoun(model.sport))",
            subtitle: "Shown on the plan",
            isOn: $model.extraGear
        )
    }

    private var noteField: some View {
        PlanFormField(label: model.kind == .playdate ? "Note for families who are in" : "Note for people who are in", locked: true) {
            PlanTextInput(placeholder: notePlaceholder, text: $model.guestNote, multiline: true, limit: 500, identifier: "planGuestNote")
        }
    }

    private var notePlaceholder: String {
        switch model.kind {
        case .watchParty:
            model.whereKind == .home ? "Park on the street. The side gate is open." : "We'll be at the big table by the window."
        case .playdate: "Meet by the big slide. We'll bring bubbles."
        case .pickupGame: "Court 3, by the fence."
        case .walkCoffee: "Meet at the trailhead sign. Coffee after."
        }
    }

    private var aboutField: some View {
        PlanFormField(label: "About · everyone sees this") {
            PlanTextInput(
                placeholder: "Big screen in the backyard. Kids welcome.",
                text: $model.about,
                multiline: true,
                limit: 500,
                identifier: "planAbout"
            )
        }
    }

    private func smallTile(_ icon: PantopusIcon, tint: Color, ink: Color) -> some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(tint)
            .frame(width: 36, height: 36)
            .overlay(Icon(icon, size: 18, color: ink))
            .accessibilityHidden(true)
    }

    private var footer: some View {
        VStack(spacing: Spacing.s2) {
            if let problem = model.problem {
                Text(problem).planFont(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Button("Preview", action: onPreview)
                .planButton(.primary)
                .disabled(model.problem != nil)
                .accessibilityIdentifier("planPreviewButton")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
    }
}

// MARK: - Kind fields

/// The kind's own choices at the top of the form.
struct PlanKindFields: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        switch model.kind {
        case .watchParty:
            PlanFormField(label: "Game") {
                PlanChoiceChips(
                    options: gameOptions,
                    isSelected: { $0 == (model.game?.id ?? "") },
                    onTap: { id in model.pick(model.games.first { $0.id == id }) },
                    groupLabel: "Game",
                    identifier: "planGame"
                )
                Text("Picking a game fills in the title and the time.").planFont(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }
        case .playdate:
            PlanNote(
                icon: .shieldCheck,
                text: "Playdates happen in public places, parents stay, and only ages are shared. "
                    + "Everyone who joins has a verified address."
            )
            PlanFormField(label: "Kids' ages") {
                PlanChoiceChips(
                    options: PlanKidsAgeBand.allCases.map { PlanChoiceOption(id: $0, label: PlanComposerOptions.ageLabel($0)) },
                    isSelected: { model.kidsAges.contains($0) },
                    onTap: { band in
                        if model.kidsAges.contains(band) { model.kidsAges.remove(band) } else { model.kidsAges.insert(band) }
                    },
                    groupLabel: "Kids' ages",
                    identifier: "planKidsAges"
                )
            }
        case .pickupGame:
            PlanFormField(label: "Sport") {
                PlanChoiceChips(
                    options: PlanComposerOptions.sports.map { PlanChoiceOption(id: $0.value, label: $0.label) },
                    isSelected: { $0 == model.sport },
                    onTap: { model.sport = $0 },
                    groupLabel: "Sport",
                    identifier: "planSport"
                )
            }
            PlanFormField(label: "Level") {
                PlanSegmented(options: PlanComposerOptions.levels.map { ($0.value, $0.label) }, selection: $model.level, label: "Level")
            }
        case .walkCoffee:
            PlanFormField(label: "Kind") {
                PlanChoiceChips(
                    options: PlanComposerOptions.walkKinds.map { PlanChoiceOption(id: $0.value, label: $0.label) },
                    isSelected: { $0 == model.walkKind },
                    onTap: { model.walkKind = $0 },
                    groupLabel: "Kind",
                    identifier: "planWalkKind"
                )
            }
        }
    }

    /// "Seahawks · Sun 1:25 PM", then "Another game".
    private var gameOptions: [PlanChoiceOption<String>] {
        model.games.prefix(3).map { game in
            let name = game.label
            guard let start = game.startsAtDate,
                  let when = PlanFormat.rowWhen(state: .upcoming, start: start, end: nil) else {
                return PlanChoiceOption(id: game.id, label: name)
            }
            return PlanChoiceOption(id: game.id, label: "\(name) · \(when)")
        } + [PlanChoiceOption(id: "", label: "Another game")]
    }
}

/// H5's pace and "Dogs welcome".
struct PlanWalkExtras: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        PlanFormField(label: "Pace") {
            PlanSegmented(options: PlanComposerOptions.paces.map { ($0.value, $0.label) }, selection: $model.pace, label: "Pace")
        }
        PlanSwitchRow(title: "Dogs welcome", subtitle: "Shown on the plan", isOn: $model.dogsWelcome)
    }
}

/// "How people get in": the options for this kind and place, plus "Also let
/// in people I've hosted" where it applies.
struct PlanApprovalOptions: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        PlanFormCard {
            if model.kind == .playdate {
                optionRow(title: "You approve each family", subtitle: "Always on for playdates", selected: true, locked: true) {}
            } else {
                ForEach(Array(model.approvalOptions.enumerated()), id: \.element) { index, option in
                    if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                    optionRow(
                        title: title(option),
                        subtitle: subtitle(option),
                        selected: model.approval == option,
                        locked: false
                    ) { model.approval = option }
                }
                if model.kind != .pickupGame {
                    Divider().overlay(Theme.Color.appBorder)
                    Button { model.alsoHostedBefore.toggle() } label: {
                        HStack(spacing: Spacing.s3) {
                            PlanCheckbox(isOn: model.alsoHostedBefore)
                            VStack(alignment: .leading, spacing: 0) {
                                Text("Also let in people I've hosted").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                                Text("They get in right away, until the spots fill").planFont(.small)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(model.alsoHostedBefore ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("planAlsoHosted")
                }
            }
        }
    }

    private func title(_ option: PlanApproval) -> String {
        switch option {
        case .approveEach: "I approve each person"
        case .verifiedAuto: "Verified neighbors get in right away"
        case .anyoneNearby: "Anyone nearby gets in right away"
        }
    }

    private func subtitle(_ option: PlanApproval) -> String? {
        switch option {
        case .approveEach: model.whereKind == .home ? "Always on for plans at your place" : nil
        case .verifiedAuto: "Others ask, and you approve"
        case .anyoneNearby: "Until the spots fill"
        }
    }

    private func optionRow(title: String, subtitle: String?, selected: Bool, locked: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    if let subtitle { Text(subtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if locked {
                    Icon(.lock, size: 18, color: Theme.Color.appTextSecondary)
                } else if selected {
                    Icon(.check, size: 22, strokeWidth: 2.6, color: Theme.Color.primary600)
                }
            }
            .padding(.vertical, 10)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(locked)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
