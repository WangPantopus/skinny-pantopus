//
//  BallotLiveCountView.swift
//  Pantopus
//
//  Place — "Your ballot", the live count drawn while ballots are counted
//  (the November 3, 2026 results design): a status line, then each race
//  with a bar per choice, or one Yes/No bar for a measure. A candidate's
//  party, as the state words it, sits under the name; the two major
//  parties' bars are blue and red, and everything else is neutral slate.
//  Nothing marks a leader. Statewide races can start folded behind one
//  row. Parity twin of the web's `LiveCount` and Android's
//  `BallotLiveCount`.
//
//  Every word and number comes from the server (`civic_election.live_count`);
//  this view only lays them out.
//

import SwiftUI

struct BallotLiveCountView: View {
    let count: BallotLiveCount

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            (Text(count.status).fontWeight(.semibold).foregroundStyle(Theme.Color.appText)
                + Text(" · \(count.posted)").foregroundStyle(Theme.Color.appTextSecondary))
                .font(.system(size: 13))
            ForEach(count.groups, id: \.key) { group in
                BallotCountGroupView(group: group)
            }
        }
        .accessibilityIdentifier("place.ballot.count")
    }
}

private struct BallotCountGroupView: View {
    let group: BallotCountGroup
    @State private var open: Bool

    init(group: BallotCountGroup) {
        self.group = group
        _open = State(initialValue: group.fold == nil)
    }

    var body: some View {
        if let fold = group.fold, !open {
            Button {
                open = true
            } label: {
                foldRow(fold)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows these races")
            .accessibilityIdentifier("place.ballot.count.show")
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(group.title)
                    .textCase(.uppercase)
                    .font(.system(size: 11, weight: .semibold))
                    .kerning(0.66)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.bottom, 2)
                    .accessibilityAddTraits(.isHeader)
                ForEach(Array(group.races.enumerated()), id: \.element.key) { index, race in
                    BallotCountRaceView(race: race, first: index == 0)
                }
                if group.fold != nil {
                    Button {
                        open = false
                    } label: {
                        Text("Show fewer")
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, Spacing.s1)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("place.ballot.count.fold")
                }
            }
        }
    }

    private func foldRow(_ fold: BallotCountFold) -> some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(fold.label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text(fold.detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: Spacing.s1) {
                Text("Show")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Icon(.chevronDown, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
        )
        .contentShape(Rectangle())
    }
}

private struct BallotCountRaceView: View {
    let race: BallotCountRace
    let first: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            title
            if race.kind == "measure", race.options.count == 2 {
                BallotMeasureBar(yes: race.options[0], no: race.options[1])
            } else {
                ForEach(Array(race.options.enumerated()), id: \.offset) { _, option in
                    BallotCandidateRow(option: option)
                }
            }
        }
        .padding(.top, first ? 6 : Spacing.s3)
        .padding(.bottom, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            if !first {
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
            }
        }
    }

    private var title: some View {
        let name = Text(race.title).fontWeight(.semibold).foregroundStyle(Theme.Color.appText)
        let text = race.qualifier.map { name + Text(" · \($0)").foregroundStyle(Theme.Color.appTextSecondary) } ?? name
        return text
            .font(.system(size: 14))
            .accessibilityAddTraits(.isHeader)
    }
}

private struct BallotCandidateRow: View {
    let option: BallotCountOption

    /// The bar and the party dot: blue and red for the two major parties,
    /// the neutral slate for everyone else.
    private var fill: Color {
        switch option.partyTone {
        case "democratic": Theme.Color.ballotCountDemocratic
        case "republican": Theme.Color.ballotCountRepublican
        default: Theme.Color.ballotCountFill
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Text(option.name)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(option.votesLabel)
                    .font(.system(size: 12.5).monospacedDigit())
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text(option.percentLabel)
                    .font(.system(size: 14, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minWidth: 46, alignment: .trailing)
            }
            if let party = option.partyLabel {
                HStack(spacing: 6) {
                    Circle()
                        .fill(fill)
                        .frame(width: 7, height: 7)
                    Text(party)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.top, -2)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(Theme.Color.appBorder)
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(fill)
                        .frame(width: geo.size.width * min(1, max(0, option.share)))
                }
            }
            .frame(height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        let party = option.partyLabel.map { ", \($0)" } ?? ""
        return "\(option.name)\(party), \(option.percentLabel), \(option.votesLabel) votes"
    }
}

private struct BallotMeasureBar: View {
    let yes: BallotCountOption
    let no: BallotCountOption

    var body: some View {
        VStack(spacing: 7) {
            HStack(spacing: Spacing.s3) {
                side(yes, nameFirst: true)
                Spacer(minLength: 0)
                side(no, nameFirst: false)
            }
            .font(.system(size: 14).monospacedDigit())
            GeometryReader { geo in
                HStack(spacing: 2) {
                    UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 4, style: .continuous)
                        .fill(Theme.Color.ballotCountYes)
                        .frame(width: max(0, (geo.size.width - 2) * yesFraction))
                    UnevenRoundedRectangle(bottomTrailingRadius: 4, topTrailingRadius: 4, style: .continuous)
                        .fill(Theme.Color.ballotCountNo)
                }
            }
            .frame(height: 8)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(yes.name) \(yes.percentLabel), \(no.name) \(no.percentLabel)")
    }

    /// The two sides split the whole bar between them.
    private var yesFraction: Double {
        let both = yes.share + no.share
        return both > 0 ? yes.share / both : 0.5
    }

    private func side(_ option: BallotCountOption, nameFirst: Bool) -> Text {
        let name = Text(option.name).foregroundStyle(Theme.Color.appTextSecondary)
        let percent = Text(option.percentLabel).fontWeight(.semibold).foregroundStyle(Theme.Color.appText)
        return nameFirst ? name + Text(" ") + percent : percent + Text(" ") + name
    }
}
