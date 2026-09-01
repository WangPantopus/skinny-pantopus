//
//  CommunityBody.swift
//  Pantopus
//
//  A17.4 Community mailbox body: group seal, Pantopus summary, one
//  subtype card (poll / event / neighborhood update), attendee strip,
//  author note, Pulse thread link, and RSVP/action chips.
//

// swiftlint:disable file_length

import SwiftUI

@MainActor
public struct CommunityBody: View {
    private let community: CommunityDetailDTO
    private let authorName: String
    private let authorInitials: String
    private let paragraphs: [String]
    @State private var rsvp: CommunityRsvpStatus
    @State private var selectedPollOptionId: String?

    public init(
        community: CommunityDetailDTO,
        authorName: String,
        authorInitials: String,
        paragraphs: [String] = []
    ) {
        self.community = community
        self.authorName = authorName
        self.authorInitials = authorInitials
        self.paragraphs = paragraphs.isEmpty ? Self.defaultParagraphs(for: community.subtype) : paragraphs
        _rsvp = State(initialValue: community.rsvp)
        _selectedPollOptionId = State(initialValue: community.poll?.options.first(where: \.isSelected)?.id)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            CommunityBodyBadgeCard(community: community)
            CommunityBodyInsightCard(community: community, rsvp: rsvp)
            subtypeCard
            if community.attendeeCount > 0 || !community.attendees.isEmpty {
                CommunityBodyAttendeesCard(community: community, isGoing: rsvp == .going)
            }
            CommunityBodyMessageCard(
                authorName: authorName,
                authorInitials: authorInitials,
                paragraphs: paragraphs
            )
            if let thread = community.pulseThread {
                CommunityBodyPulseThreadCard(thread: thread, isGoing: rsvp == .going)
            }
            CommunityBodyActions(rsvp: $rsvp)
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("communityBody")
    }

    @ViewBuilder
    private var subtypeCard: some View {
        switch community.subtype {
        case .poll:
            if let poll = community.poll {
                CommunityBodyPollCard(
                    poll: poll,
                    selectedOptionId: $selectedPollOptionId
                )
            } else {
                CommunityBodyUpdateCard(update: .fallback)
            }
        case .event:
            if let event = community.event {
                CommunityBodyEventCard(event: event, accent: Theme.Color.home)
            } else if let update = community.update {
                CommunityBodyUpdateCard(update: update)
            } else {
                CommunityBodyUpdateCard(update: .fallback)
            }
        case .neighborhoodUpdate:
            CommunityBodyUpdateCard(update: community.update ?? .fallback)
        }
    }

    private static func defaultParagraphs(for subtype: CommunityMailSubtype) -> [String] {
        switch subtype {
        case .event:
            [
                "Hi neighbors - quick reminder that we are doing the spring playground cleanup this Saturday from 9 to 11 AM.",
                "If you have gardening gloves please bring them. We will have spares from the tool library and a few extra rakes."
            ]
        case .poll:
            [
                "Please vote when you have a minute. The board will use this to pick the final timing " +
                    "and post the decision Friday afternoon."
            ]
        case .neighborhoodUpdate:
            [
                "Sharing the latest neighborhood notes so everyone has the same plan before the weekend."
            ]
        }
    }
}

private struct CommunityBodyCard<Content: View>: View {
    let noPadding: Bool
    let content: Content

    init(noPadding: Bool = false, @ViewBuilder content: () -> Content) {
        self.noPadding = noPadding
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: noPadding ? 0 : Spacing.s3) {
            content
        }
        .padding(noPadding ? 0 : Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }
}

private struct CommunityBodyBadgeCard: View {
    let community: CommunityDetailDTO

    var body: some View {
        CommunityBodyCard {
            HStack(spacing: Spacing.s3) {
                ZStack(alignment: .bottomTrailing) {
                    Icon(.trees, size: 26, color: Theme.Color.home)
                        .frame(width: 56, height: 56)
                        .background(Theme.Color.appSurface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.home, lineWidth: 2))
                    if community.group.isVerified {
                        Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                            .frame(width: 18, height: 18)
                            .background(Theme.Color.success)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                            .offset(x: 2, y: 2)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HStack(spacing: Spacing.s1) {
                        Text(community.group.name)
                            .pantopusTextStyle(.small)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.appText)
                        if community.group.isVerified {
                            Text("VERIFIED HOA")
                                .pantopusTextStyle(.overline)
                                .foregroundStyle(Theme.Color.success)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.Color.successBg)
                                .clipShape(Capsule())
                        }
                    }
                    if let tagline = community.group.tagline {
                        Text(tagline)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Text(metaLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("communityBody.badge")
    }

    private var metaLine: String {
        var parts: [String] = []
        if let role = community.group.role {
            parts.append(role + (community.group.membershipSince.map { " since \($0)" } ?? ""))
        }
        if let count = community.group.memberCount {
            parts.append("\(count) members")
        }
        if let founded = community.group.founded {
            parts.append(founded)
        }
        return parts.isEmpty ? "Verified neighborhood group" : parts.joined(separator: " - ")
    }
}

private struct CommunityBodyInsightCard: View {
    let community: CommunityDetailDTO
    let rsvp: CommunityRsvpStatus

    var body: some View {
        CommunityBodyCard {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.sparkles, size: 14, color: Theme.Color.appTextInverse)
                    .frame(width: 26, height: 26)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(rsvp == .going ? "You're going to this" : "Pantopus read this for you")
                        .pantopusTextStyle(.small)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.primary800)
                    Text(summary)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.primary900)
                    ForEach(bullets, id: \.label) { bullet in
                        HStack(alignment: .top, spacing: Spacing.s2) {
                            Icon(bullet.icon, size: 11, color: Theme.Color.primary700)
                                .frame(width: 18, height: 18)
                                .background(Theme.Color.appSurface)
                                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                            Text(bullet.label)
                                .pantopusTextStyle(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.appTextStrong)
                        }
                    }
                }
            }
        }
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("communityBody.insight")
    }

    private var summary: String {
        if rsvp == .going {
            return "Saved with a reminder. The organizer can see that you are coming."
        }
        switch community.subtype {
        case .event:
            return "\(community.attendeeCount) neighbors are going" +
                (community.attendeesFromBlock.map { " - \($0) from your block." } ?? ".")
        case .poll:
            return "A quick neighborhood poll is open. Your response helps the group pick the next step."
        case .neighborhoodUpdate:
            return "A verified neighborhood update was sent to households near you."
        }
    }

    private var bullets: [(icon: PantopusIcon, label: String)] {
        switch community.subtype {
        case .event:
            [
                (.users, "\(community.attendeeCount) neighbors going"),
                (.calendar, community.event?.timeRange ?? "Schedule included"),
                (.info, community.event?.weatherSummary ?? "Details are ready")
            ]
        case .poll:
            [
                (.listChecks, "\(community.poll?.totalVotes ?? 0) votes so far"),
                (.clock, community.poll?.closesAtLabel ?? "Poll still open"),
                (.shieldCheck, "Verified residents only")
            ]
        case .neighborhoodUpdate:
            [
                (.radio, "Neighborhood-wide note"),
                (.shieldCheck, "Verified sender"),
                (.messageCircle, "Discussion thread linked")
            ]
        }
    }
}

private struct CommunityBodyEventCard: View {
    let event: CommunityEventInfo
    let accent: Color

    var body: some View {
        CommunityBodyCard(noPadding: true) {
            CommunityBodyCardHeader(title: "Event details")
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if event.dayLabel != nil || event.dateLabel != nil || event.timeRange != nil {
                    eventRow(
                        icon: .calendar,
                        overline: "When",
                        title: [event.dayLabel, event.dateLabel].compactMap { $0 }.joined(separator: ", "),
                        detail: event.timeRange
                    )
                }
                if let location = event.location {
                    eventRow(
                        icon: .mapPin,
                        overline: "Where",
                        title: location,
                        detail: event.locationNote ?? event.distanceLabel
                    )
                }
                if !event.bringItems.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text("Bring if you can")
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        ForEach(Array(event.bringItems.enumerated()), id: \.offset) { _, item in
                            HStack(alignment: .top, spacing: Spacing.s2) {
                                Icon(.check, size: 12, color: Theme.Color.success)
                                    .padding(.top, 2)
                                Text(item)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextStrong)
                            }
                        }
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                if let weather = event.weatherSummary {
                    HStack(spacing: Spacing.s2) {
                        Icon(.sun, size: 18, color: Theme.Color.primary700)
                        Text(event.weatherTemperatureF.map { "\($0)°F" } ?? "Forecast")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.primary800)
                        Text(weather)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.primary700)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.infoBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(Spacing.s3)
        }
        .accessibilityIdentifier("communityBody.eventCard")
    }

    private func eventRow(
        icon: PantopusIcon,
        overline: String,
        title: String,
        detail: String?
    ) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            Icon(icon, size: 20, color: accent)
                .frame(width: 52, height: 56)
                .background(Theme.Color.successBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(overline)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                if let detail {
                    Text(detail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }
}

private struct CommunityBodyPollCard: View {
    let poll: CommunityPollInfo
    @Binding var selectedOptionId: String?

    var body: some View {
        CommunityBodyCard(noPadding: true) {
            CommunityBodyCardHeader(title: "Poll")
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text(poll.question)
                    .pantopusTextStyle(.body)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                VStack(spacing: Spacing.s2) {
                    ForEach(poll.options) { option in
                        optionButton(option)
                    }
                }
                HStack {
                    Text("\(poll.totalVotes) votes")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let closes = poll.closesAtLabel {
                        Text("- closes \(closes)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer()
                    if let status = poll.statusLabel {
                        Text(status)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.success)
                    }
                }
            }
            .padding(Spacing.s3)
        }
        .accessibilityIdentifier("communityBody.pollCard")
    }

    private func optionButton(_ option: CommunityPollOption) -> some View {
        Button {
            selectedOptionId = option.id
        } label: {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(selectedOptionId == option.id ? Theme.Color.primary50 : Theme.Color.appSurface)
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.primary100)
                        .frame(width: proxy.size.width * optionShare(option))
                    HStack(spacing: Spacing.s2) {
                        Icon(
                            selectedOptionId == option.id ? .checkCircle : .circle,
                            size: 16,
                            color: selectedOptionId == option.id ? Theme.Color.primary600 : Theme.Color.appTextMuted
                        )
                        Text(option.label)
                            .pantopusTextStyle(.small)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                        Spacer()
                        Text("\(Int(optionShare(option) * 100))%")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.primary700)
                    }
                    .padding(.horizontal, Spacing.s3)
                }
            }
            .frame(minHeight: 48)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        selectedOptionId == option.id ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: selectedOptionId == option.id ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Vote for \(option.label)")
        .accessibilityIdentifier("communityBody.poll.option.\(option.id)")
    }

    private func optionShare(_ option: CommunityPollOption) -> CGFloat {
        guard poll.totalVotes > 0 else { return 0 }
        return max(0.08, CGFloat(option.voteCount) / CGFloat(poll.totalVotes))
    }
}

private struct CommunityBodyUpdateCard: View {
    let update: CommunityUpdateInfo

    var body: some View {
        CommunityBodyCard(noPadding: true) {
            CommunityBodyCardHeader(title: "Neighborhood update")
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.radio, size: 18, color: Theme.Color.home)
                        .frame(width: 34, height: 34)
                        .background(Theme.Color.successBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text(update.headline)
                            .pantopusTextStyle(.body)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.appText)
                        if let summary = update.summary {
                            Text(summary)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appTextStrong)
                        }
                    }
                }
                ForEach(Array(update.items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Icon(.check, size: 12, color: Theme.Color.success)
                            .padding(.top, 3)
                        Text(item)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
                if let footer = update.footerLabel ?? update.statusLabel {
                    Text(footer)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .background(Theme.Color.infoBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(Spacing.s3)
        }
        .accessibilityIdentifier("communityBody.updateCard")
    }
}

private struct CommunityBodyAttendeesCard: View {
    let community: CommunityDetailDTO
    let isGoing: Bool
    private let visibleCount = 6

    var body: some View {
        CommunityBodyCard(noPadding: true) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(community.attendeeCount) going")
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(isGoing
                        ? "Including you"
                        : (community.attendeesFromBlock.map { "\($0) from your block - all verified residents" }
                            ?? "All verified residents"))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Text("See all")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Divider().background(Theme.Color.appBorderSubtle)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    if isGoing {
                        CommunityBodyAvatar(initials: "You", label: "You", tint: Theme.Color.primary600, verified: false)
                    }
                    ForEach(Array(community.attendees.prefix(visibleCount))) { attendee in
                        CommunityBodyAvatar(
                            initials: attendee.initials,
                            label: attendee.displayName.split(separator: " ").first.map(String.init) ?? attendee.displayName,
                            tint: avatarColor(for: attendee),
                            verified: attendee.isVerified
                        )
                    }
                    if remainingCount > 0 {
                        CommunityBodyAvatar(
                            initials: "+\(remainingCount)",
                            label: "more",
                            tint: Theme.Color.appTextStrong,
                            verified: false,
                            muted: true
                        )
                    }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
            }
        }
        .accessibilityIdentifier("communityBody.attendees")
    }

    private var remainingCount: Int {
        max(0, community.attendeeCount - visibleCount - (isGoing ? 1 : 0))
    }

    private func avatarColor(for attendee: CommunityAttendee) -> Color {
        let palette: [Color] = [
            Theme.Color.home,
            Theme.Color.primary600,
            Theme.Color.business,
            Theme.Color.warning,
            Theme.Color.error,
            Theme.Color.home
        ]
        let hash = attendee.initials.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return palette[hash % palette.count]
    }
}

private struct CommunityBodyAvatar: View {
    let initials: String
    let label: String
    let tint: Color
    let verified: Bool
    var muted = false

    var body: some View {
        VStack(spacing: Spacing.s1) {
            ZStack(alignment: .bottomTrailing) {
                Text(initials)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(muted ? Theme.Color.appTextStrong : Theme.Color.appTextInverse)
                    .frame(width: 36, height: 36)
                    .background(muted ? Theme.Color.appSurfaceSunken : tint)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(muted ? Theme.Color.appBorderStrong : Color.clear, lineWidth: 1.5))
                if verified {
                    Icon(.check, size: 7, color: Theme.Color.appTextInverse)
                        .frame(width: 12, height: 12)
                        .background(Theme.Color.success)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .frame(width: 44)
        .accessibilityLabel(label)
    }
}

private struct CommunityBodyMessageCard: View {
    let authorName: String
    let authorInitials: String
    let paragraphs: [String]

    var body: some View {
        CommunityBodyCard {
            HStack(spacing: Spacing.s2) {
                Text(authorInitials)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 28, height: 28)
                    .background(Theme.Color.business)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(authorName)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("posted by neighbor")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityIdentifier("communityBody.message")
    }
}

private struct CommunityBodyPulseThreadCard: View {
    let thread: CommunityPulseThread
    let isGoing: Bool

    var body: some View {
        CommunityBodyCard {
            HStack(spacing: Spacing.s2) {
                Icon(.radio, size: 13, color: Theme.Color.primary700)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.primary100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                Text("Pulse thread")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(thread.title)
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
            Text(metaLine)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let preview = thread.lastReplyPreview, let author = thread.lastReplyAuthor {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Text(String(author.prefix(2)).uppercased())
                        .pantopusTextStyle(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(width: 22, height: 22)
                        .background(Theme.Color.success)
                        .clipShape(Circle())
                    Text("\(author) \(preview)")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            Button(action: {}, label: {
                HStack(spacing: Spacing.s1) {
                    Text(isGoing ? "Open thread - you're in" : "Join the thread")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.primary700)
                    Icon(.arrowRight, size: 14, color: Theme.Color.primary700)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.primary200, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            })
            .buttonStyle(.plain)
            .accessibilityLabel(isGoing ? "Open thread, you're in" : "Join the thread")
            .accessibilityIdentifier("communityBody.openThread")
        }
        .accessibilityIdentifier("communityBody.pulseThread")
    }

    private var metaLine: String {
        var parts = ["\(thread.replyCount) replies"]
        if let author = thread.lastReplyAuthor, let age = thread.lastReplyAge {
            parts.append("last from \(author) \(age) ago")
        }
        return parts.joined(separator: " - ")
    }
}

private struct CommunityBodyActions: View {
    @Binding var rsvp: CommunityRsvpStatus

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if rsvp == .going {
                Button { rsvp = .undecided } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.checkCircle, size: 16, color: Theme.Color.success)
                        Text("You're going - tap to change")
                            .pantopusTextStyle(.small)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.success)
                    }
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.successLight, lineWidth: 1.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Change RSVP")
                .accessibilityIdentifier("communityBody.rsvp.change")
            } else {
                HStack(spacing: Spacing.s2) {
                    rsvpButton(.going, label: "Going", icon: .check, primary: true)
                    rsvpButton(.maybe, label: "Maybe", icon: .helpCircle)
                    rsvpButton(.notGoing, label: "Can't make it", icon: .x)
                }
            }
            HStack(spacing: Spacing.s2) {
                actionChip(icon: .messageSquarePlus, label: "Ask", id: "ask")
                actionChip(icon: .userPlus, label: "Housemate", id: "housemate")
                actionChip(icon: .bell, label: "Mute", id: "mute")
            }
        }
        .accessibilityIdentifier("communityBody.actions")
    }

    private func rsvpButton(
        _ status: CommunityRsvpStatus,
        label: String,
        icon: PantopusIcon,
        primary: Bool = false
    ) -> some View {
        Button { rsvp = status } label: {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 14, color: primary ? Theme.Color.appTextInverse : Theme.Color.appText)
                Text(label)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(primary ? Theme.Color.appTextInverse : Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(primary ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(primary ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("communityBody.rsvp.\(status.rawValue)")
    }

    private func actionChip(icon: PantopusIcon, label: String, id: String) -> some View {
        Button(action: {}, label: {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 16, color: Theme.Color.appTextStrong)
                Text(label)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        })
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("communityBody.action.\(id)")
    }
}

private struct CommunityBodyCardHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            .accessibilityAddTraits(.isHeader)
    }
}

private extension CommunityUpdateInfo {
    static let fallback = CommunityUpdateInfo(
        headline: "Neighborhood update",
        summary: "A verified neighborhood group shared a new update.",
        items: ["Open the Pulse thread for discussion.", "Household members can be added to the thread."],
        statusLabel: "Verified community mail",
        footerLabel: nil
    )
}

#Preview {
    ScrollView {
        CommunityBody(
            community: MailItemSampleData.communityEvent,
            authorName: "Aliyah W.",
            authorInitials: "AW"
        )
    }
    .background(Theme.Color.appBg)
}
