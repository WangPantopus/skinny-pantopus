//
//  CommunityDetailLayout.swift
//  Pantopus
//
//  T6.5d (P22) — Community (A17.4) variant of the mail item detail.
//  Sits on the shared `MailItemDetailShell` (P19); replaces the
//  generic Body slot with a stack of community-specific cards:
//
//    - `CommunityBadgeCard` — HOA crest + tagline + membership
//    - `CommunityEventCard` — when / where / bring / weather
//    - `CommunityAttendeesStrip` — "13 going" + avatar reel
//    - body paragraphs from the author
//    - `CommunityPulseThreadCard` — cross-link to the related Pulse thread
//
//  Hero adds a "You're going" green check chip when RSVP is `.going`.
//  AI elf strip is intentionally driven by the design's two voices —
//  one before RSVP ("Pantopus read this for you"), one after
//  ("You're going to this") — and falls back to the V1 summary when
//  the backend hasn't populated it yet.
//
//  Actions slot is the RSVP chip row: Going (primary) / Maybe /
//  Can't make it · plus a secondary row of Ask / Add housemate /
//  Mute thread. The going-state collapses to a single "You're going"
//  pill button (tap to change).
//

import SwiftUI

// swiftlint:disable file_length multiple_closures_with_trailing_closure

@MainActor
struct CommunityDetailLayout: View {
    let content: MailDetailContent
    let community: CommunityDetailDTO
    let rsvpInFlight: Bool
    let onBack: @MainActor () -> Void
    let onRsvp: @MainActor (CommunityRsvpStatus) -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    /// T6.5e (P19.5) — Opens the host's Save-to-vault picker. Defaults
    /// to a no-op so existing call sites compile unchanged.
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { CommunityHeroCard(content: content, community: community) },
            keyFacts: { CommunityBadgeCard(community: community) },
            body: {
                VStack(spacing: Spacing.s3) {
                    if let event = community.event {
                        CommunityEventCard(event: event, accent: content.category.accent)
                    }
                    CommunityAttendeesStrip(
                        attendees: community.attendees,
                        attendeeCount: community.attendeeCount,
                        attendeesFromBlock: community.attendeesFromBlock,
                        going: community.rsvp == .going
                    )
                    if !content.bodyParagraphs.isEmpty {
                        CommunityBodyCard(
                            paragraphs: content.bodyParagraphs,
                            authorName: content.senderDisplayName,
                            authorInitials: content.senderInitials
                        )
                    }
                    if let pulse = community.pulseThread {
                        CommunityPulseThreadCard(thread: pulse, going: community.rsvp == .going)
                    }
                }
            },
            sender: { CommunitySenderCard(content: content, onOpenProfile: onOpenSenderProfile) },
            actions: {
                CommunityRsvpActions(
                    rsvp: community.rsvp,
                    inFlight: rsvpInFlight
                ) { onRsvp($0) }
            }
        )
        .accessibilityIdentifier("mailDetail_community")
    }

    // MARK: - Top bar

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Community mail",
            trust: .verified,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save to vault",
                isActive: false
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "share", icon: .share, label: "Share") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "addToCalendar", icon: .calendar, label: "Add to calendar") {},
                MailOverflowItem(id: "mute", icon: .bell, label: "Mute thread") {},
                MailOverflowItem(id: "report", icon: .info, label: "Report") {},
                MailOverflowItem(
                    id: "delete",
                    icon: .trash2,
                    label: "Delete",
                    isDestructive: true
                ) {}
            ]
        )
    }

    // MARK: - AI elf — community has two distinct voices

    private func makeAIElf() -> AIElfStripContent? {
        let going = community.rsvp == .going
        // When the V1 detail doesn't carry an `ai_summary` we still surface
        // the design's "neighbors going + weather + no conflicts" bullet
        // row using fields we already have — keeps the strip useful from
        // day one without blocking on the V2 summary endpoint.
        let summary = content.aiSummary ?? defaultElfSummary(going: going)
        let bullets: [AIElfBullet] = going ? makeGoingBullets() : makeOpenBullets()
        return AIElfStripContent(
            headline: going ? "You're going to this" : "Pantopus read this for you",
            summary: summary,
            bullets: bullets
        )
    }

    private func defaultElfSummary(going: Bool) -> String {
        if going {
            return "Saved to your calendar with a reminder. The organizer was notified you're coming."
        }
        let neighbors = community.attendeeCount
        let block = community.attendeesFromBlock ?? 0
        var line = "\(neighbors) neighbor\(neighbors == 1 ? "" : "s") going"
        if block > 0 { line += " · \(block) from your block" }
        if let weather = community.event?.weatherSummary {
            line += ". Weather: \(weather.lowercased())."
        } else {
            line += "."
        }
        return line
    }

    private func makeOpenBullets() -> [AIElfBullet] {
        var bullets: [AIElfBullet] = []
        bullets.append(
            AIElfBullet(
                icon: .users,
                label: "\(community.attendeeCount) neighbors going",
                text: community.attendeesFromBlock.map { "\($0) from your block" }
            )
        )
        if let event = community.event {
            if let temp = event.weatherTemperatureF, let summary = event.weatherSummary {
                bullets.append(
                    AIElfBullet(
                        icon: .info,
                        label: "\(temp)° \(summary.lowercased())",
                        text: nil
                    )
                )
            }
            if let day = event.dayLabel {
                bullets.append(
                    AIElfBullet(
                        icon: .calendar,
                        label: "Your \(day) is clear",
                        text: nil
                    )
                )
            }
        }
        return bullets
    }

    private func makeGoingBullets() -> [AIElfBullet] {
        var bullets: [AIElfBullet] = []
        bullets.append(
            AIElfBullet(
                icon: .calendarClock,
                label: "Calendar event added",
                text: "reminder set"
            )
        )
        if community.pulseThread != nil {
            bullets.append(
                AIElfBullet(
                    icon: .messageCircle,
                    label: "Day-of thread joined",
                    text: "so you can find folks when you arrive"
                )
            )
        }
        if community.event?.weatherSummary != nil {
            bullets.append(
                AIElfBullet(
                    icon: .info,
                    label: "Weather watch on",
                    text: "we'll ping if forecast changes"
                )
            )
        }
        return bullets
    }

    // MARK: - Attachments

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .other, name: name)
        }
        return AttachmentsRowContent(items: items)
    }
}

// MARK: - Hero (community-flavored)

private struct CommunityHeroCard: View {
    let content: MailDetailContent
    let community: CommunityDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                CategoryBadge(category: content.category)
                Spacer()
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Text(content.senderDisplayName.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(content.title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let excerpt = content.excerpt, !excerpt.isEmpty {
                Text(excerpt)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if community.rsvp == .going {
                goingChip
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(content.category.accent).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var goingChip: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 13, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Theme.Color.success)
                .clipShape(Circle())
            Text("You're going")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_community_goingChip")
    }
}

private struct CategoryBadge: View {
    let category: MailItemCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 11, color: category.accent)
            Text(category.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(category.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(category.rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

// MARK: - Community badge (HOA / neighborhood-group seal)

private struct CommunityBadgeCard: View {
    let community: CommunityDetailDTO

    var body: some View {
        HStack(spacing: Spacing.s3) {
            crest
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s1) {
                    Text(community.group.name)
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if community.group.isVerified {
                        Text("VERIFIED HOA")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Theme.Color.success)
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
                        .lineLimit(2)
                }
                HStack(spacing: Spacing.s2) {
                    if let role = community.group.role {
                        Label {
                            Text(role + (community.group.membershipSince.map { " · since \($0)" } ?? ""))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextStrong)
                        } icon: {
                            Icon(.shieldCheck, size: 11, color: Theme.Color.success)
                        }
                    }
                    if let count = community.group.memberCount {
                        Text("\(count) members")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.top, 2)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
        }
        .padding(Spacing.s3)
        .background(
            LinearGradient(
                colors: [Theme.Color.successBg, Theme.Color.appSurface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_community_badge")
    }

    private var crest: some View {
        ZStack(alignment: .bottomTrailing) {
            Icon(.users, size: 26, color: Theme.Color.success)
                .frame(width: 56, height: 56)
                .background(Theme.Color.appSurface)
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.Color.success, lineWidth: 2))
            if community.group.isVerified {
                Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                    .frame(width: 18, height: 18)
                    .background(Theme.Color.success)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 2, y: 2)
            }
        }
    }
}

// MARK: - Event details card (when / where / bring / weather)

private struct CommunityEventCard: View {
    let event: CommunityEventInfo
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("EVENT DETAILS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if event.dayLabel != nil || event.dateLabel != nil || event.timeRange != nil {
                    whenRow
                }
                if event.location != nil {
                    whereRow
                }
                if !event.bringItems.isEmpty {
                    bringList
                }
                if let summary = event.weatherSummary {
                    weatherStrip(summary: summary)
                }
            }
            .padding(Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_community_eventCard")
    }

    private var whenRow: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            DateChip(day: event.dayLabel, date: event.dateLabel, accent: accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("WHEN")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("\(event.dayLabel ?? "")\(event.dayLabel != nil && event.dateLabel != nil ? ", " : "")\(event.dateLabel ?? "")")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let range = event.timeRange {
                    Text(range)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var whereRow: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            MiniMap(accent: accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("WHERE")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(event.location ?? "")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let note = event.locationNote {
                    Text(note)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let distance = event.distanceLabel {
                    HStack(spacing: 3) {
                        Icon(.arrowRight, size: 11, color: Theme.Color.primary600)
                        Text(distance)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Theme.Color.primary600)
                    }
                    .padding(.top, 2)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var bringList: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("BRING IF YOU CAN")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ForEach(Array(event.bringItems.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 6) {
                        Icon(.check, size: 11, color: Theme.Color.success)
                            .padding(.top, 3)
                        Text(item)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: Spacing.s0)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func weatherStrip(summary: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 18, color: Theme.Color.primary700)
            if let temp = event.weatherTemperatureF {
                Text("\(temp)°F")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.Color.primary800)
            }
            Text(summary)
                .pantopusTextStyle(.caption)
                .foregroundColor(Theme.Color.primary700)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct DateChip: View {
    let day: String?
    let date: String?
    let accent: Color

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Text((monthAbbr ?? "").uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 3)
                .background(accent)
            VStack(spacing: 1) {
                Text(dayNum ?? "")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let day {
                    Text(day.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Theme.Color.appSurface)
        }
        .frame(width: 52, height: 56)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var monthAbbr: String? {
        guard let date else { return nil }
        return date.split(separator: " ").first.map(String.init)
    }

    private var dayNum: String? {
        guard let date else { return nil }
        let parts = date.split(separator: " ")
        return parts.count >= 2 ? String(parts[1]) : nil
    }
}

/// Abstract mini-map preview (community.jsx MiniMap): park block +
/// crossing paths + tree dots under a centered drop pin. Purely
/// decorative — geometry mirrors the design's 52×56 SVG.
private struct MiniMap: View {
    let accent: Color

    var body: some View {
        ZStack {
            Theme.Color.successBg
            Rectangle()
                .fill(Theme.Color.successLight)
                .frame(width: 40, height: 28)
                .position(x: 26, y: 28)
            Rectangle()
                .fill(Theme.Color.appSurface)
                .frame(width: 52, height: 3)
                .position(x: 26, y: 21.5)
            Rectangle()
                .fill(Theme.Color.appSurface)
                .frame(width: 3, height: 56)
                .position(x: 21.5, y: 28)
            Group {
                Circle().fill(Theme.Color.success).frame(width: 4, height: 4).position(x: 10, y: 18)
                Circle().fill(Theme.Color.success).frame(width: 4, height: 4).position(x: 38, y: 36)
                Circle().fill(Theme.Color.success).frame(width: 3, height: 3).position(x: 40, y: 18)
            }
            .opacity(0.7)
            MapPinDrop(accent: accent, size: 18)
                .position(x: 26, y: 20)
        }
        .frame(width: 52, height: 56)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityIdentifier("mailDetail_community_miniMap")
    }
}

/// Teardrop map pin — rounded square with one sharp corner, rotated so
/// the point faces down (JSX `borderRadius: '50% 50% 50% 0'` trick).
private struct MapPinDrop: View {
    let accent: Color
    let size: CGFloat

    var body: some View {
        teardrop
            .fill(accent)
            .overlay(teardrop.stroke(Theme.Color.appSurface, lineWidth: 2))
            .frame(width: size, height: size)
            .rotationEffect(.degrees(-45))
            .shadow(color: Color.black.opacity(0.25), radius: 2, x: 0, y: 1)
    }

    private var teardrop: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: size / 2,
            bottomLeadingRadius: 0,
            bottomTrailingRadius: size / 2,
            topTrailingRadius: size / 2
        )
    }
}

// MARK: - Attendees strip

private struct CommunityAttendeesStrip: View {
    let attendees: [CommunityAttendee]
    let attendeeCount: Int
    let attendeesFromBlock: Int?
    let going: Bool

    private let visibleSlots = 6

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(attendeeCount) going".uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(going
                        ? "Including you"
                        : (attendeesFromBlock.map { "\($0) from your block · all verified residents" }
                            ?? "All verified residents"))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                HStack(spacing: 2) {
                    Text("See all")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Theme.Color.primary600)
                    Icon(.chevronRight, size: 11, color: Theme.Color.primary600)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    if going { YouAvatar() }
                    ForEach(visibleAttendees) { attendee in
                        AvatarBubble(attendee: attendee)
                    }
                    if remainingCount > 0 { OverflowBubble(count: remainingCount) }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_community_attendees")
    }

    private var visibleAttendees: [CommunityAttendee] {
        Array(attendees.prefix(visibleSlots))
    }

    private var remainingCount: Int {
        max(0, attendeeCount - visibleSlots - (going ? 1 : 0))
    }
}

private struct AvatarBubble: View {
    let attendee: CommunityAttendee

    var body: some View {
        VStack(spacing: Spacing.s1) {
            ZStack(alignment: .bottomTrailing) {
                Text(attendee.initials)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 36, height: 36)
                    .background(avatarColor)
                    .clipShape(Circle())
                if attendee.isVerified {
                    Icon(.check, size: 7, color: Theme.Color.appTextInverse)
                        .frame(width: 12, height: 12)
                        .background(Theme.Color.success)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
            Text(attendee.displayName.split(separator: " ").first.map(String.init) ?? attendee.displayName)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .frame(width: 44)
    }

    private var avatarColor: Color {
        // Deterministic accent per initials so the row reads as a real
        // group photo rather than a uniform pill stack. Picks from the
        // identity-token swatches so all six dot colors are on the
        // design palette.
        let palette: [Color] = [
            Theme.Color.home,
            Theme.Color.tutoring,
            Theme.Color.business,
            Theme.Color.handyman,
            Theme.Color.error,
            Theme.Color.cleaning
        ]
        let hash = attendee.initials.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return palette[hash % palette.count]
    }
}

private struct YouAvatar: View {
    var body: some View {
        VStack(spacing: Spacing.s1) {
            Text("You")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: 36, height: 36)
                .background(
                    LinearGradient(
                        colors: [Theme.Color.primary500, Theme.Color.primary700],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.Color.primary300, lineWidth: 2.5))
            Text("You")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(Theme.Color.primary700)
        }
        .frame(width: 44)
    }
}

private struct OverflowBubble: View {
    let count: Int

    var body: some View {
        VStack(spacing: Spacing.s1) {
            Text("+\(count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(width: 36, height: 36)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
                .overlay(
                    Circle().stroke(Theme.Color.appBorderStrong, lineWidth: 1.5)
                        .foregroundColor(.clear)
                )
            Text("more")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(width: 44)
    }
}

// MARK: - Body (with author chip)

private struct CommunityBodyCard: View {
    let paragraphs: [String]
    let authorName: String
    let authorInitials: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(authorInitials)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 28, height: 28)
                    .background(Theme.Color.business)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(authorName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("posted by neighbor")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

// MARK: - Pulse thread cross-link

private struct CommunityPulseThreadCard: View {
    let thread: CommunityPulseThread
    let going: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.users, size: 13, color: Theme.Color.primary700)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.primary100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                Text("PULSE THREAD")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(thread.title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(metaLine)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let preview = thread.lastReplyPreview, let author = thread.lastReplyAuthor {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Text(String(author.prefix(2)).uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(width: 22, height: 22)
                        .background(Theme.Color.success)
                        .clipShape(Circle())
                    (
                        Text(author).bold() + Text(" \(preview)")
                    )
                    .pantopusTextStyle(.caption)
                    .foregroundColor(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                    Spacer()
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Button(action: {}) {
                HStack(spacing: Spacing.s1) {
                    Text(going ? "Open thread · you're in" : "Join the thread")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Theme.Color.primary700)
                    Icon(.arrowRight, size: 13, color: Theme.Color.primary700)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Theme.Color.primary200, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailDetail_community_pulseThread")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var metaLine: String {
        var parts = ["\(thread.replyCount) replies"]
        if let author = thread.lastReplyAuthor, let age = thread.lastReplyAge {
            parts.append("last from \(author) \(age) ago")
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Sender card

private struct CommunitySenderCard: View {
    let content: MailDetailContent
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("SENDER")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: Spacing.s3) {
                Text(content.senderInitials)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 44, height: 44)
                    .background(content.category.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                VStack(alignment: .leading, spacing: 2) {
                    Text(content.senderDisplayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let meta = content.senderMeta {
                        Text(meta)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    HStack(spacing: Spacing.s1) {
                        Icon(.shieldCheck, size: 11, color: Theme.Color.success)
                        Text("Verified neighbor")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.Color.success)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: Spacing.s0)
                if onOpenProfile != nil, content.senderUserId != nil {
                    Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if let onOpenProfile, let userId = content.senderUserId {
                    onOpenProfile(userId)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

// MARK: - RSVP actions

struct CommunityRsvpActions: View {
    let rsvp: CommunityRsvpStatus
    let inFlight: Bool
    let onSelect: @MainActor (CommunityRsvpStatus) -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if rsvp == .going {
                goingPill
            } else {
                rsvpChipRow
            }
            secondaryRow
        }
    }

    private var goingPill: some View {
        Button(action: { onSelect(.undecided) }) {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle, size: 16, color: Theme.Color.success)
                Text("You're going · tap to change")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Theme.Color.success)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Theme.Color.successLight, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(inFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(inFlight)
        .accessibilityIdentifier("mailDetail_community_goingPill")
    }

    private var rsvpChipRow: some View {
        HStack(spacing: Spacing.s2) {
            rsvpChip(.going, icon: .check, label: "Going", isPrimary: true)
            rsvpChip(.maybe, icon: .info, label: "Maybe", isPrimary: false)
            rsvpChip(.notGoing, icon: .x, label: "Can't make it", isPrimary: false)
        }
    }

    private func rsvpChip(
        _ status: CommunityRsvpStatus,
        icon: PantopusIcon,
        label: String,
        isPrimary: Bool
    ) -> some View {
        Button(action: { onSelect(status) }) {
            HStack(spacing: 5) {
                Icon(
                    icon,
                    size: 14,
                    color: isPrimary ? Theme.Color.appTextInverse : Theme.Color.appText
                )
                Text(label)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundColor(isPrimary ? Theme.Color.appTextInverse : Theme.Color.appText)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(isPrimary ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(isPrimary ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .opacity(inFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(inFlight)
        .accessibilityIdentifier("mailDetail_community_rsvp_\(status.rawValue)")
    }

    private var secondaryRow: some View {
        HStack(spacing: Spacing.s2) {
            secondaryChip(icon: .messageSquarePlus, label: "Ask a question", id: "mailDetail_community_ask")
            secondaryChip(icon: .users, label: "Add housemate", id: "mailDetail_community_addHousemate")
            secondaryChip(icon: .bell, label: "Mute thread", id: "mailDetail_community_mute")
        }
    }

    private func secondaryChip(icon: PantopusIcon, label: String, id: String) -> some View {
        Button(action: {}) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 16, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundColor(Theme.Color.appTextStrong)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}
