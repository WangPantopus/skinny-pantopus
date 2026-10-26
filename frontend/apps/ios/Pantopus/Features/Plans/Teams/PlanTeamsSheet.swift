import SwiftUI

struct PlanTeamsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = PlanTeamsModel()

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Your teams", leading: .close) { dismiss() }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    PlanTextInput(
                        placeholder: "Search teams, cities or states",
                        text: $model.query,
                        identifier: "sportsTeamSearch",
                        label: "Search teams"
                    )
                    PlanSwitchRow(title: "Not into sports", subtitle: "Hide game suggestions", isOn: Binding(
                        get: { model.preferences.watch == "off" },
                        set: { value in Task { await model.save(SportsPreferencesDTO(watch: value ? "off" : "on")) } }
                    ))
                    if !model.query.isEmpty {
                        teamChoices("Search results", teams: model.results)
                    } else {
                        teamChoices("Suggested near you", teams: model.suggested)
                    }
                    chosen("Following", ids: model.preferences.teams ?? [], hidden: false)
                    chosen("Hidden teams", ids: model.preferences.hidden ?? [], hidden: true)
                    PlanFormField(label: "Leagues · postseason and championships") {
                        PlanChoiceChips(
                            options: PlanTeamsModel.leagues.map { PlanChoiceOption(id: $0, label: PlanTeamsModel.leagueLabel($0)) },
                            isSelected: { (model.preferences.leagues ?? []).contains($0) },
                            onTap: { id in Task { await model.toggleLeague(id) } },
                            groupLabel: "Follow leagues"
                        )
                    }
                    if let error = model.error {
                        Text(error).planFont(.small).foregroundStyle(Theme.Color.warning)
                        Button("Try again") { Task { await model.load() } }.planButton(.text)
                    }
                }
                .padding(Spacing.s4)
                .disabled(model.saving)
            }
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .task(id: model.query) {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            await model.search()
        }
    }

    private func teamChoices(_ title: String, teams: [PlanTeamDTO]) -> some View {
        PlanFormField(label: title) {
            if teams.isEmpty {
                Text(model.query.isEmpty ? "Search for any team you follow." : "No teams found.")
                    .planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
            PlanChoiceChips(
                options: teams.map { PlanChoiceOption(id: $0.id, label: $0.name) },
                isSelected: { (model.preferences.teams ?? []).contains($0) },
                onTap: { id in Task { await model.follow(id) } },
                groupLabel: title,
                identifier: "sportsTeam"
            )
        }
    }

    private func chosen(_ title: String, ids: [String], hidden: Bool) -> some View {
        PlanFormField(label: title) {
            if ids.isEmpty { Text("None yet").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary) }
            ForEach(ids, id: \.self) { id in
                HStack {
                    Text(model.known[id]?.name ?? id).planFont(.body)
                    Spacer()
                    Button(hidden ? "Unhide" : "Remove") {
                        Task { if hidden { await model.unhide(id) } else { await model.follow(id) } }
                    }
                    .planButton(.text)
                    .accessibilityLabel("\(hidden ? "Unhide" : "Remove") \(model.known[id]?.name ?? id)")
                }
            }
        }
    }
}

struct PlanWatchGameFields: View {
    @Bindable var model: PlanComposerModel
    @State private var showsTeams = false
    @State private var teams = PlanTeamsModel()

    var body: some View {
        PlanFormField(label: "Game") {
            TimelineView(.periodic(from: .now, by: 30)) { context in
                PlanChoiceChips(
                    options: options(at: context.date),
                    isSelected: { $0 == (model.game?.id ?? "") },
                    onTap: { id in model.pick(model.games.first { $0.id == id && $0.isAvailable(at: Date()) }) },
                    groupLabel: "Game",
                    identifier: "planGame",
                    menu: model.sports?.canChoose == true ? { id in
                        AnyView(PlanSportsMenu(
                            game: model.games.first { $0.id == id },
                            model: teams
                        ) { await model.loadGames() })
                    } : nil
                )
            }
            Text("Picking a game fills in the title and the time.").planFont(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            if model.sports?.canChoose == true {
                Button("Edit teams") { showsTeams = true }.planButton(.text).accessibilityIdentifier("sportsEditTeams")
            }
            if let attribution = model.sports?.attribution {
                Text(attribution).planFont(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }
            if let error = teams.error { Text(error).planFont(.small).foregroundStyle(Theme.Color.warning) }
        }
        .sheet(isPresented: $showsTeams, onDismiss: { Task { await model.loadGames() } }, content: { PlanTeamsSheet() })
    }

    private func options(at now: Date) -> [PlanChoiceOption<String>] {
        model.games.filter { $0.isAvailable(at: now) }.prefix(3).map { game in
            let when = game.startsAtDate.flatMap { PlanFormat.rowWhen(state: .upcoming, start: $0, end: nil) }
            return PlanChoiceOption(id: game.id, label: when.map { "\(game.matchupLabel) · \($0)" } ?? game.matchupLabel)
        } + [PlanChoiceOption(id: "", label: "Another game")]
    }
}

struct PlanSportsMenu: View {
    let game: PlanGameOptionDTO?
    let model: PlanTeamsModel
    let onChange: () async -> Void

    var body: some View {
        if let game, let team = game.team {
            Button("Hide \(game.label) games") {
                Task { if await model.hide(team) { await onChange() } }
            }
        }
        Button("Not into sports") {
            Task { if await model.save(SportsPreferencesDTO(watch: "off")) { await onChange() } }
        }
    }
}
