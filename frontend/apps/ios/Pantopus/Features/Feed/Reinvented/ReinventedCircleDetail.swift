//
//  ReinventedCircleDetail.swift
//  Pantopus
//
//  One circle's page (CONTRACT 8d): its weekly magazine, who's in and who's invited, the member's own "Keep my
//  Moments …" choice, and for its maker: rename, invite more, remove someone, end it. Anyone may leave. Words as the
//  web's circles page.
//

import SwiftUI

struct ReinventedCircleDetail: View {
    let circleId: String
    @Binding var path: [ReinventedCircleRoute]
    @State private var name = ""
    @State private var adding: [String] = []
    @State private var confirming: Confirm?
    private let model = ReinventedCirclesModel.shared

    enum Confirm: String, Identifiable {
        case leave, end

        var id: String {
            rawValue
        }
    }

    var body: some View {
        Group {
            if let circle = model.circle(circleId) {
                page(circle)
            } else if model.reading == .reading {
                ReinventedCircleNote("Loading…").padding(Spacing.s4)
            } else {
                ReinventedCircleNote("This circle isn't there any more.").padding(Spacing.s4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.Color.appBg)
        .navigationTitle(model.circle(circleId)?.name ?? "Circle")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            model.problem = nil
            name = model.circle(circleId)?.name ?? ""
        }
        .alert(
            confirming == .end ? "End this circle?" : "Leave this circle?",
            isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
            presenting: confirming
        ) { what in
            Button("Keep it", role: .cancel) {}
            Button(what == .end ? "End it" : "Leave", role: .destructive) { Task { await finish(what) } }
        } message: { what in
            Text(
                what == .end
                    ? "End this circle for everyone in it? Its magazine goes with it."
                    : "Leave this circle? You can be invited again."
            )
        }
    }

    private func page(_ circle: ReinventedCircleDTO) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                magazineButton(circle)
                members(circle)
                Toggle(isOn: Binding(get: { circle.myKeepFaded }, set: { keep in
                    Task { await model.send(ReinventedCirclesEndpoints.keepFaded(circle.id, keep: keep)) }
                })) {
                    Text(ReinventedCircleWords.keep)
                        .pulseFont(13.5)
                        .foregroundStyle(Theme.Color.appText)
                }
                .tint(Theme.Color.primarySolid)
                .disabled(model.busy)
                .accessibilityIdentifier("reinventedCircles.keep")
                ReinventedCircleWindowChoice(circleId: circle.id) // phase 4: homes talk to homes (CONTRACT 9f)
                if circle.mine { makerControls(circle) }
                if let problem = model.problem { ReinventedCircleProblem(problem) }
                HStack(spacing: Spacing.s2) {
                    ReinventedCircleButton("Leave", busy: model.busy) { confirming = .leave }
                        .accessibilityIdentifier("reinventedCircles.leave")
                    if circle.mine {
                        ReinventedCircleButton("End the circle", danger: true, busy: model.busy) { confirming = .end }
                            .accessibilityIdentifier("reinventedCircles.end")
                    }
                }
            }
            .padding(Spacing.s4)
        }
    }

    private func magazineButton(_ circle: ReinventedCircleDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Its magazine comes each \(ReinventedCircleWords.day(circle.weekDay)).")
                .pulseFont(14)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button { path.append(.magazine(circle.id)) } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.newspaper, size: 18, strokeWidth: 2.2, color: .white)
                    Text(circle.magazineReady ? "This week's magazine · new" : "This week's magazine")
                        .pulseFont(15, weight: .semibold)
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(height: 44)
                .background(Capsule().fill(Theme.Color.primarySolid))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("reinventedCircles.magazine")
        }
    }

    private func members(_ circle: ReinventedCircleDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ReinventedCircleHeading("Who's in it")
            ForEach(circle.members, id: \.person.id) { member in
                HStack(spacing: Spacing.s3) {
                    MomentAvatar(author: member.person, size: 34)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(member.person.name)
                            .pulseFont(15, weight: .semibold)
                            .foregroundStyle(Theme.Color.appText)
                        Text(member.person.id == circle.owner?.id ? "Made it" : member.isIn ? "In" : "Invited")
                            .pulseFont(13)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: 0)
                    if circle.mine, member.person.id != circle.owner?.id {
                        ReinventedCircleButton("Remove", busy: model.busy) {
                            Task { await model.send(ReinventedCirclesEndpoints.change(circle.id, remove: [member.person.id])) }
                        }
                        .accessibilityIdentifier("reinventedCircles.remove")
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("reinventedCircles.member")
            }
        }
    }

    @ViewBuilder
    private func makerControls(_ circle: ReinventedCircleDTO) -> some View {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ReinventedCircleHeading("Name")
            HStack(spacing: Spacing.s2) {
                TextField("Name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: name) { _, new in if new.count > 40 { name = String(new.prefix(40)) } }
                    .accessibilityIdentifier("reinventedCircles.name")
                ReinventedCircleButton("Rename", busy: model.busy) {
                    Task { await model.send(ReinventedCirclesEndpoints.change(circle.id, name: trimmed)) }
                }
                .disabled(trimmed.isEmpty || trimmed == circle.name)
                .accessibilityIdentifier("reinventedCircles.rename")
            }
        }
        let room = ReinventedCircleWords.maxOthers + 1 - circle.members.count
        if room > 0 {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ReinventedCircleHeading("Invite more (\(room) more can join)")
                ReinventedCirclePeoplePicker(picked: $adding, leaveOut: circle.members.map(\.person.id), max: room)
                ReinventedCircleButton("Invite them", busy: model.busy) {
                    Task {
                        if await model.send(ReinventedCirclesEndpoints.change(circle.id, add: adding)) { adding = [] }
                    }
                }
                .disabled(adding.isEmpty)
                .accessibilityIdentifier("reinventedCircles.invite.send")
            }
        }
    }

    private func finish(_ what: Confirm) async {
        let endpoint = what == .end ? ReinventedCirclesEndpoints.end(circleId) : ReinventedCirclesEndpoints.leave(circleId)
        guard await model.send(endpoint) else { return }
        path.removeAll { $0 == .circle(circleId) || $0 == .magazine(circleId) }
    }
}
