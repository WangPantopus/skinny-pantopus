//
//  ProfileTogetherSection.swift
//  Pantopus
//
//  "You and Rowan" on someone's profile (the 11-01 redesign, `Main.dc.html`):
//  at most two lines about what you share, one per kind, in this order: a
//  plan you're both in, a Support Train you both help with, people you both
//  know, skills you both have (`GET /api/users/:id/in-common`). The plan and
//  the train open; people and skills don't (there is no shared-connections
//  list). The section hides when there's nothing to say.
//

import SwiftUI

/// One "You and <name>" line.
public struct ProfileTogetherLine: Identifiable, Hashable, Sendable {
    /// A piece of the sentence; the names and titles are bold.
    public struct Part: Hashable, Sendable {
        let text: String
        let isBold: Bool

        static func plain(_ text: String) -> Part {
            Part(text: text, isBold: false)
        }

        static func bold(_ text: String) -> Part {
            Part(text: text, isBold: true)
        }
    }

    public enum Leading: Hashable, Sendable {
        case plan(PlanKind?)
        case train
        case skills
        /// Up to two of the people, then "+N" for the rest.
        case people([ProfileInCommon.Person], more: Int)
    }

    public enum Target: Hashable, Sendable {
        case plan(id: String)
        case supportTrain(id: String)
    }

    public let id: String
    public let parts: [Part]
    /// The plan's time, under the sentence.
    public let detail: String?
    public let leading: Leading
    public let target: Target?

    /// The sentence and its time, as VoiceOver reads the row.
    var spoken: String {
        let sentence = parts.map(\.text).joined()
        return detail.map { "\(sentence), \($0)" } ?? sentence
    }

    /// At most two lines, one per kind, in the brief's order: the soonest plan,
    /// the first Support Train, the people you both know, your shared skills.
    static func lines(
        from shared: ProfileInCommon,
        firstName: String,
        viewerId: String?,
        profileId: String,
        now: Date = Date()
    ) -> [ProfileTogetherLine] {
        var lines: [ProfileTogetherLine] = []
        if let plan = shared.plans.first {
            lines.append(planLine(plan, firstName: firstName, viewerId: viewerId, profileId: profileId, now: now))
        }
        if let train = shared.supportTrains.first {
            lines.append(ProfileTogetherLine(
                id: "train",
                parts: [.plain("You both signed up to help with "), .bold(train.title)],
                detail: nil,
                leading: .train,
                target: .supportTrain(id: train.id)
            ))
        }
        if shared.connectionCount > 0 {
            lines.append(peopleLine(shared))
        }
        if !shared.skills.isEmpty {
            lines.append(ProfileTogetherLine(
                id: "skills",
                parts: [.plain("You both help with ")] + listed(Array(shared.skills.prefix(3))),
                detail: nil,
                leading: .skills,
                target: nil
            ))
        }
        return Array(lines.prefix(2))
    }

    /// Who hosts decides the words: "Rowan's going to your Morning dog walk",
    /// "You're going to Rowan's Riverside walk & coffee", or "You're both going to …".
    private static func planLine(
        _ plan: ProfileInCommon.Plan,
        firstName: String,
        viewerId: String?,
        profileId: String,
        now: Date
    ) -> ProfileTogetherLine {
        let title = plan.title.isEmpty ? (plan.kind?.title ?? "a plan") : plan.title
        let parts: [Part] = if let host = plan.hostId, host == viewerId {
            [.plain("\(firstName)'s going to your "), .bold(title)]
        } else if plan.hostId == profileId {
            [.plain("You're going to \(firstName)'s "), .bold(title)]
        } else {
            [.plain("You're both going to "), .bold(title)]
        }
        let detail = PlanTime.parse(plan.startsAt).map {
            PlanFormat.when(start: $0, end: PlanTime.parse(plan.endsAt), now: now)
        }
        return ProfileTogetherLine(id: "plan", parts: parts, detail: detail, leading: .plan(plan.kind), target: .plan(id: plan.id))
    }

    /// "You both know Ava and Ben", "… Ava, Ben and 1 other": first names only.
    private static func peopleLine(_ shared: ProfileInCommon) -> ProfileTogetherLine {
        let shown = Array(shared.people.prefix(2))
        let names = shown.map { $0.name.split(separator: " ").first.map(String.init) ?? $0.name }.filter { !$0.isEmpty }
        let others = max(0, shared.connectionCount - names.count)
        var parts: [Part] = [.plain("You both know ")]
        if names.isEmpty {
            parts.append(.bold("\(others) \(others == 1 ? "neighbor" : "neighbors")"))
        } else if others == 0 {
            parts += listed(names)
        } else {
            parts += names.count == 1 ? [.bold(names[0])] : [.bold(names[0]), .plain(", "), .bold(names[1])]
            parts.append(.plain(" and \(others) \(others == 1 ? "other" : "others")"))
        }
        return ProfileTogetherLine(
            id: "people",
            parts: parts,
            detail: nil,
            leading: .people(shown, more: max(0, shared.connectionCount - shown.count)),
            target: nil
        )
    }

    /// "A", "A and B", "A, B and C", each bold.
    private static func listed(_ items: [String]) -> [Part] {
        var parts: [Part] = []
        for (index, item) in items.enumerated() {
            if index > 0 { parts.append(.plain(index == items.count - 1 ? " and " : ", ")) }
            parts.append(.bold(item))
        }
        return parts
    }
}

// MARK: - Section

/// "You and <name>": a titled card of up to two lines, between the header and
/// the tabs. Only for a signed-in visitor.
@MainActor
struct ProfileTogetherSection: View {
    let firstName: String
    let lines: [ProfileTogetherLine]
    let onOpen: @MainActor (ProfileTogetherLine.Target) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var scaledDisc: CGFloat = 30

    /// The picture column fits two faces and "+N" only when a people line
    /// needs it; otherwise each sentence starts right after its icon.
    private var pictureWidth: CGFloat {
        let hasPeople = lines.contains { line in
            if case .people = line.leading { true } else { false }
        }
        return min(scaledDisc, 44) * (hasPeople ? 7.0 / 3.0 : 1)
    }

    /// The hairline starts where the sentences do.
    private var separatorInset: CGFloat {
        typeSize.isAccessibilitySize ? Spacing.s4 : Spacing.s4 + pictureWidth + Spacing.s3
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("You and \(firstName)")
                .scaledFont(20, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: Spacing.s0) {
                ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                    row(line)
                    if index < lines.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorder)
                            .frame(height: 1)
                            .padding(.leading, separatorInset)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfileTogether")
    }

    @ViewBuilder
    private func row(_ line: ProfileTogetherLine) -> some View {
        switch line.target {
        case let .some(target):
            Button { onOpen(target) } label: {
                ProfileTogetherRow(line: line, pictureWidth: pictureWidth)
            }
            .buttonStyle(.plain)
            .accessibilityHint(target.hint)
            .accessibilityIdentifier("publicProfileTogether_\(line.id)")
        case .none:
            ProfileTogetherRow(line: line, pictureWidth: pictureWidth)
                .accessibilityIdentifier("publicProfileTogether_\(line.id)")
        }
    }
}

private extension ProfileTogetherLine.Target {
    var hint: String {
        switch self {
        case .plan: "Opens the plan"
        case .supportTrain: "Opens the Support Train"
        }
    }
}

/// The picture on the left (the plan's kind, the train, the people) and the
/// sentence. At accessibility sizes the picture sits above the sentence.
@MainActor
private struct ProfileTogetherRow: View {
    let line: ProfileTogetherLine
    let pictureWidth: CGFloat

    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var scaledDisc: CGFloat = 30

    private var disc: CGFloat {
        min(scaledDisc, 44)
    }

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Spacing.s2))
            : AnyLayout(HStackLayout(alignment: .center, spacing: Spacing.s3))
        layout {
            leading
                .frame(width: typeSize.isAccessibilitySize ? nil : pictureWidth, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                sentence
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail = line.detail {
                    Text(detail)
                        .scaledFont(13)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 60)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(line.spoken)
    }

    private var sentence: Text {
        line.parts.reduce(Text(verbatim: "")) { text, part in
            text + (part.isBold ? Text(verbatim: part.text).fontWeight(.semibold) : Text(verbatim: part.text))
        }
    }

    @ViewBuilder private var leading: some View {
        switch line.leading {
        case let .plan(kind):
            iconDisc(
                kind?.icon ?? .calendar,
                color: kind?.color ?? Theme.Color.appTextSecondary,
                background: kind?.tint ?? Theme.Color.appSurfaceSunken
            )
        case .train:
            iconDisc(.handCoins, color: Theme.Color.home, background: Theme.Color.homeBg)
        case .skills:
            iconDisc(.wrench, color: Theme.Color.appTextSecondary, background: Theme.Color.appSurfaceSunken)
        case let .people(people, more):
            HStack(spacing: -disc / 3) {
                ForEach(people) { person in
                    ProfileAvatarDisc(
                        name: person.name,
                        showsInitials: !person.name.isEmpty,
                        imageURL: person.avatarURL.flatMap(URL.init(string:)),
                        color: ProfileAvatarColor(userId: person.id),
                        size: disc
                    )
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
                if more > 0 {
                    Text(verbatim: "+\(more)")
                        .font(.system(size: disc * 0.36, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: disc, height: disc)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
        }
    }

    private func iconDisc(_ icon: PantopusIcon, color: Color, background: Color) -> some View {
        Icon(icon, size: disc * 0.53, color: color)
            .frame(width: disc, height: disc)
            .background(background)
            .clipShape(Circle())
    }
}
