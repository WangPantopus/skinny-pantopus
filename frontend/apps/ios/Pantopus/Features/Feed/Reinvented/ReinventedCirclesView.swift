//
//  ReinventedCirclesView.swift
//  Pantopus
//
//  "Your circles" (CONTRACT 8d), opened from Close circle in the reach dial and pushed inside the dial's own
//  navigation: make a circle from your connections (they are invited, and in only by their own yes), say yes or no to
//  an invite (nobody is told who said no), and for each circle: who's in, your own "Keep my Moments …" choice, its
//  weekly magazine, rename, invite or remove people (its maker), leave, or end it. Words as the web's circles page.
//

import SwiftUI

/// Where the dial's navigation goes for circles.
enum ReinventedCircleRoute: Hashable {
    case circles
    case new
    case circle(String)
    case magazine(String)
}

enum ReinventedCircleWords {
    static let maxOthers = 7
    static let keep = "Keep my Moments for this circle after they fade: its weekly magazine and morning postcards"
    static let weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    /// "Friday", from the circle's `week_day` (0 Sunday to 6).
    static func day(_ number: Int) -> String {
        weekDays.indices.contains(number) ? weekDays[number] : "week"
    }
}

/// The faces of the people in a circle, overlapping.
struct ReinventedCircleFaces: View {
    let people: [MomentAuthorDTO]

    var body: some View {
        HStack(spacing: -10) {
            ForEach(people.prefix(5), id: \.id) { person in
                MomentAvatar(author: person, size: 30)
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }
}

struct ReinventedCirclesView: View {
    @Binding var path: [ReinventedCircleRoute]
    private let model = ReinventedCirclesModel.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text(Self.about)
                    .pulseFont(14)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if model.reading == .reading, model.circles.isEmpty, model.invites.isEmpty {
                    ReinventedCircleNote("Loading…")
                } else if model.reading == .failed {
                    ReinventedCircleNote("Your circles couldn't load.")
                    Button("Try again") { Task { await model.read() } }
                        .pulseFont(15, weight: .semibold)
                } else {
                    if !model.invites.isEmpty { invites }
                    circles
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Your circles")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.read() }
        .accessibilityIdentifier("reinventedCircles")
    }

    private var invites: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ReinventedCircleHeading("Invites")
            ForEach(model.invites) { circle in
                ReinventedCircleInviteRow(circle: circle)
            }
        }
    }

    private var circles: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !model.invites.isEmpty { ReinventedCircleHeading("Your circles") }
            ForEach(model.circles) { circle in
                Button { path.append(.circle(circle.id)) } label: { circleRow(circle) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("reinventedCircles.circle")
            }
            if model.circles.isEmpty, model.reading == .read { ReinventedCircleNote("No circles yet.") }
            Button { path.append(.new) } label: {
                Label { Text("New circle") } icon: { Icon(.plus, size: 16, strokeWidth: 2.4, color: .white) }
                    .pulseFont(15, weight: .semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 44)
                    .background(Capsule().fill(Theme.Color.primarySolid))
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("reinventedCircles.new")
        }
    }

    private func circleRow(_ circle: ReinventedCircleDTO) -> some View {
        HStack(spacing: Spacing.s3) {
            ReinventedCircleFaces(people: circle.members.filter(\.isIn).map(\.person))
            VStack(alignment: .leading, spacing: 2) {
                Text(circle.name)
                    .pulseFont(16, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                Text(Self.summary(circle))
                    .pulseFont(13)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s3)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder, lineWidth: 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    static let about = "Circles of 2 to 8 close people. Pick one in Close circle to see only them, and read its magazine "
        + "each week. Nobody outside a circle knows it exists."

    /// "3 in · 1 invited · new magazine".
    static func summary(_ circle: ReinventedCircleDTO) -> String {
        var words = "\(circle.inCount) in"
        if circle.invitedCount > 0 { words += " · \(circle.invitedCount) invited" }
        if circle.magazineReady { words += " · new magazine" }
        return words
    }
}

/// An invite: who asked, who's in, the keep choice, No thanks or Join.
struct ReinventedCircleInviteRow: View {
    let circle: ReinventedCircleDTO
    @State private var keep = false
    private let model = ReinventedCirclesModel.shared

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                ReinventedCircleFaces(people: circle.members.filter(\.isIn).map(\.person))
                VStack(alignment: .leading, spacing: 2) {
                    Text(circle.name)
                        .pulseFont(16, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("\(circle.owner?.name ?? "Someone") asked you to join · \(circle.inCount) in")
                        .pulseFont(13)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Toggle(isOn: $keep) {
                Text(ReinventedCircleWords.keep)
                    .pulseFont(13.5)
                    .foregroundStyle(Theme.Color.appText)
            }
            .tint(Theme.Color.primarySolid)
            .accessibilityIdentifier("reinventedCircles.invite.keep")
            HStack(spacing: Spacing.s2) {
                Spacer(minLength: 0)
                ReinventedCircleButton("No thanks", busy: model.busy) {
                    Task { await model.send(ReinventedCirclesEndpoints.leave(circle.id)) }
                }
                .accessibilityIdentifier("reinventedCircles.invite.no")
                ReinventedCircleButton("Join", strong: true, busy: model.busy) {
                    Task { await model.send(ReinventedCirclesEndpoints.join(circle.id, keepFaded: keep)) }
                }
                .accessibilityIdentifier("reinventedCircles.invite.join")
            }
            if let problem = model.problem { ReinventedCircleProblem(problem) }
        }
        .padding(Spacing.s3)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.primary50))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("reinventedCircles.invite")
    }
}

/// "New circle": its name, and who's in it (1 to 7 connections, invited).
struct ReinventedNewCircleView: View {
    @Binding var path: [ReinventedCircleRoute]
    @State private var name = ""
    @State private var people: [String] = []
    private let model = ReinventedCirclesModel.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Its name (only its people see it)")
                    .pulseFont(13.5, weight: .semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("Sunday walkers", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: name) { _, new in if new.count > 40 { name = String(new.prefix(40)) } }
                    .accessibilityIdentifier("reinventedCircles.new.name")
                Text(
                    "Who's in it (\(people.count) of up to \(ReinventedCircleWords.maxOthers)). "
                        + "They're invited, and in only when they say yes."
                )
                .pulseFont(13.5, weight: .semibold)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                ReinventedCirclePeoplePicker(picked: $people, max: ReinventedCircleWords.maxOthers)
                if let problem = model.problem { ReinventedCircleProblem(problem) }
                HStack(spacing: Spacing.s2) {
                    Spacer(minLength: 0)
                    ReinventedCircleButton(model.busy ? "Making…" : "Make the circle", strong: true, busy: model.busy) {
                        Task { await make() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || people.isEmpty)
                    .accessibilityIdentifier("reinventedCircles.new.make")
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("New circle")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.problem = nil }
    }

    private func make() async {
        guard let made = await model.make(name: name.trimmingCharacters(in: .whitespaces), people: people) else { return }
        if path.last == .new { path.removeLast() }
        path.append(.circle(made.id))
    }
}

/// Pick connections: a search over the person's connections, the picked ones shown as chips.
struct ReinventedCirclePeoplePicker: View {
    @Binding var picked: [String]
    var leaveOut: [String] = []
    let max: Int
    @State private var query = ""
    private let connections = MomentsStudioConnections.shared

    var body: some View {
        let all = connections.people.filter { !leaveOut.contains($0.id) }
        let words = query.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = all.filter { words.isEmpty || $0.name.lowercased().contains(words) }.prefix(30)
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !picked.isEmpty { chips(all) }
            TextField("Search your connections", text: $query)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("reinventedCircles.picker.search")
            if connections.reading == .reading || connections.reading == .idle {
                ReinventedCircleNote("Reading your connections…")
            } else if connections.reading == .failed {
                ReinventedCircleNote("Couldn't read your connections. Try again later.")
            } else if all.isEmpty {
                ReinventedCircleNote(
                    connections.people.isEmpty
                        ? "Circles are made from the people you're connected with."
                        : "Everyone you're connected with is in it already."
                )
            } else {
                ForEach(Array(shown), id: \.id) { person in row(person) }
            }
        }
        .task { await connections.readIfNeeded() }
    }

    private func chips(_ all: [MomentsStudioMention]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(picked, id: \.self) { id in
                    let name = all.first { $0.id == id }?.name ?? "Someone"
                    Button { picked.removeAll { $0 == id } } label: {
                        Text("\(name) ×")
                            .pulseFont(13.5, weight: .semibold)
                            .foregroundStyle(Theme.Color.primaryTint)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 32)
                            .background(Capsule().fill(Theme.Color.primary50))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Take \(name) off")
                }
            }
        }
    }

    private func row(_ person: MomentsStudioMention) -> some View {
        let on = picked.contains(person.id)
        let full = !on && picked.count >= max
        return Button {
            if on { picked.removeAll { $0 == person.id } } else if !full { picked.append(person.id) }
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(
                    on ? .checkCircle : .circle,
                    size: 20,
                    strokeWidth: 2,
                    color: on ? Theme.Color.primarySolid : Theme.Color.appTextSecondary
                )
                Text(person.name)
                    .pulseFont(15)
                    .foregroundStyle(full ? Theme.Color.appTextSecondary : Theme.Color.appText)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(full)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedCircles.picker.person")
    }
}

// MARK: - Small parts

struct ReinventedCircleNote: View {
    let words: String

    init(_ words: String) {
        self.words = words
    }

    var body: some View {
        Text(words)
            .pulseFont(14)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct ReinventedCircleHeading: View {
    let words: String

    init(_ words: String) {
        self.words = words
    }

    var body: some View {
        Text(words)
            .pulseFont(13, weight: .bold)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .textCase(.uppercase)
            .accessibilityAddTraits(.isHeader)
    }
}

struct ReinventedCircleProblem: View {
    let words: String

    init(_ words: String) {
        self.words = words
    }

    var body: some View {
        Text(words)
            .pulseFont(13.5, weight: .semibold)
            .foregroundStyle(Theme.Color.error)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("reinventedCircles.problem")
    }
}

struct ReinventedCircleButton: View {
    let title: String
    var strong = false
    var danger = false
    var busy = false
    let action: () -> Void

    init(_ title: String, strong: Bool = false, danger: Bool = false, busy: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.strong = strong
        self.danger = danger
        self.busy = busy
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .pulseFont(15, weight: .semibold)
                .foregroundStyle(strong ? .white : danger ? Theme.Color.error : Theme.Color.appText)
                .padding(.horizontal, Spacing.s4)
                .frame(height: 40)
                .background(Capsule().fill(strong ? Theme.Color.primarySolid : Theme.Color.appSurface))
                .overlay(Capsule().stroke(strong ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
    }
}
