//
//  PartyDetailLayout.swift
//  Pantopus
//
//  A17.9 — Party ceremonial variant of the mail item detail. Sits on
//  the shared `MailItemDetailShell` (P19); body slots are the bespoke
//  Party components (`PartyHero`, party elf, `HostCard`, event details
//  with `DateTile`, `GoingStrip`, hand-written note, `PotluckList`).
//  The actions shelf is the bespoke `RsvpCluster` which carries the
//  three-way Going / Maybe / Can't plus the +1 stepper and the
//  Add-to-calendar hold.
//

import SwiftUI

// swiftlint:disable multiline_function_chains multiple_closures_with_trailing_closure

@MainActor
struct PartyDetailLayout: View {
    let content: MailDetailContent
    let party: PartyDetailDTO
    let rsvpInFlight: Bool
    let onBack: @MainActor () -> Void
    let onSetRsvp: @MainActor (PartyRsvpStatus) -> Void
    let onAdjustPlusOne: @MainActor (Int) -> Void
    let onClaimBring: @MainActor (Int) -> Void
    let onReleaseBring: @MainActor (Int) -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            hero: { PartyHero(party: party) },
            keyFacts: { EventDetailsCard(party: party) },
            body: { partyBody },
            sender: { HostCard(party: party, onOpenProfile: onOpenSenderProfile) },
            actions: {
                RsvpCluster(
                    party: party,
                    inFlight: rsvpInFlight,
                    onSetRsvp: onSetRsvp,
                    onAdjustPlusOne: onAdjustPlusOne,
                    onAddToCalendar: { /* stub — calendar wiring out of scope */ },
                    onGetDirections: { /* stub — map deep-link out of scope */ },
                    onMessageHost: { onOpenSenderProfile?(content.senderUserId ?? "host") },
                    onShareInvite: { onSaveToVault() },
                    onMute: { /* stub */ }
                )
            }
        )
        .accessibilityIdentifier("mailDetail_party")
    }

    private var partyBody: some View {
        VStack(spacing: Spacing.s3) {
            GoingStrip(party: party)
            PartyNoteCard(note: party.note)
            PotluckList(
                party: party,
                onClaim: onClaimBring,
                onRelease: onReleaseBring
            )
        }
    }

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Party invite",
            trust: .celebration,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save invite"
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "share", icon: .share, label: "Share invite") {},
                MailOverflowItem(id: "addToCalendar", icon: .calendarPlus, label: "Add to calendar") {},
                MailOverflowItem(id: "mute", icon: .bellOff, label: "Mute invite") {},
                MailOverflowItem(id: "report", icon: .alertTriangle, label: "Report") {}
            ]
        )
    }

    private func makeAIElf() -> AIElfStripContent? {
        let elf = party.rsvp == .going ? party.elfGoing : party.elfOpen
        let bullets = elf.bullets.map { source in
            AIElfBullet(icon: glyph(for: source.glyph), label: source.label, text: source.text)
        }
        return AIElfStripContent(headline: elf.headline, summary: elf.summary, bullets: bullets)
    }

    private func glyph(for glyph: PartyElfBullet.Glyph) -> PantopusIcon {
        switch glyph {
        case .users: .users
        case .cloudSun: .cloudSun
        case .calendar: .calendar
        case .calendarCheck: .calendarCheck
        case .userPlus: .userPlus
        case .gift: .gift
        }
    }
}

// MARK: - Host card

private struct HostCard: View {
    let party: PartyDetailDTO
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("HOST")
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(party.host.name)
                            .font(.system(size: 14.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(party.host.relationLabel)
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(Theme.Color.personal)
                            .padding(.horizontal, Spacing.s2)
                            .padding(.vertical, 2)
                            .background(Theme.Color.personalBg)
                            .clipShape(Capsule())
                    }
                    Text(party.host.blurb)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Button(action: { onOpenProfile?("host") }) {
                    Icon(.messageSquare, size: 14, color: Theme.Color.appTextStrong)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Message host")
                .accessibilityIdentifier("partyHostCard_message")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyHostCard")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Text(party.host.initials)
                .font(.system(size: 14, weight: .heavy))
                .tracking(0.2)
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: 44, height: 44)
                .background(
                    LinearGradient(
                        colors: [Theme.Color.categoryParty, Theme.Color.error],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.Color.categoryParty.opacity(0.55), lineWidth: 2))
                .shadow(color: Theme.Color.categoryParty.opacity(0.25), radius: 4, x: 0, y: 2)
            if party.host.isVerified {
                ZStack {
                    Circle().fill(Theme.Color.success).frame(width: 16, height: 16)
                    Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                }
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            }
        }
    }
}

// MARK: - Event details (where + vibe rows)

private struct EventDetailsCard: View {
    let party: PartyDetailDTO

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text("THE DETAILS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                HStack(spacing: 3) {
                    Icon(.navigation, size: 11, color: Theme.Color.primary600)
                    Text(party.event.walkLabel)
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)

            VStack(spacing: Spacing.s2 + 2) {
                HStack(spacing: Spacing.s3) {
                    PartyMap()
                    VStack(alignment: .leading, spacing: 3) {
                        Text(party.event.location)
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(party.event.locationNote)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                vibeRows
            }
            .padding(Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyEventDetails")
    }

    private var vibeRows: some View {
        VStack(spacing: Spacing.s0) {
            VibeRow(icon: .shirt, label: "DRESS CODE", value: party.event.dressCode)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VibeRow(icon: .baby, label: "KIDS", value: party.event.kids)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VibeRow(
                icon: .cloudSun,
                label: "FORECAST",
                value: "\(party.event.weatherTemperatureF)° · \(party.event.weatherSummary)"
            )
        }
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

/// Abstract mini-map preview (party.jsx PartyMap): four street-grid
/// blocks (one park-green) split by white roads, tiny house dots, and
/// a drop pin near the venue corner. Purely decorative — geometry
/// mirrors the design's 64×64 SVG.
private struct PartyMap: View {
    var body: some View {
        ZStack {
            Theme.Color.appSurfaceSunken
            Group {
                Rectangle().fill(Theme.Color.appBorderSubtle)
                    .frame(width: 28, height: 28).position(x: 14, y: 14)
                Rectangle().fill(Theme.Color.appBorderSubtle)
                    .frame(width: 30, height: 28).position(x: 49, y: 14)
                Rectangle().fill(Theme.Color.appBorderSubtle)
                    .frame(width: 28, height: 28).position(x: 14, y: 50)
                Rectangle().fill(Theme.Color.successBg)
                    .frame(width: 30, height: 28).position(x: 49, y: 50)
            }
            Rectangle().fill(Theme.Color.appSurface)
                .frame(width: 6, height: 64).position(x: 31, y: 32)
            Rectangle().fill(Theme.Color.appSurface)
                .frame(width: 64, height: 8).position(x: 32, y: 32)
            Rectangle().fill(Theme.Color.appBorder)
                .frame(width: 1, height: 64).position(x: 31, y: 32)
            Rectangle().fill(Theme.Color.appBorder)
                .frame(width: 64, height: 1).position(x: 32, y: 32)
            Group {
                Rectangle().fill(Theme.Color.appBorderStrong)
                    .frame(width: 6, height: 6).position(x: 9, y: 9)
                Rectangle().fill(Theme.Color.appBorderStrong)
                    .frame(width: 6, height: 6).position(x: 21, y: 17)
                Rectangle().fill(Theme.Color.appBorderStrong)
                    .frame(width: 6, height: 6).position(x: 47, y: 9)
                Rectangle().fill(Theme.Color.appBorderStrong)
                    .frame(width: 6, height: 6).position(x: 9, y: 47)
            }
            PartyMapPinDrop()
                .position(x: 47, y: 40)
        }
        .frame(width: 64, height: 64)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityIdentifier("partyEventDetails_miniMap")
    }
}

/// Teardrop map pin — rounded square with one sharp corner, rotated so
/// the point faces down (JSX `borderRadius: '50% 50% 50% 0'` trick).
private struct PartyMapPinDrop: View {
    var body: some View {
        teardrop
            .fill(Theme.Color.categoryParty)
            .overlay(teardrop.stroke(Theme.Color.appSurface, lineWidth: 2))
            .frame(width: 20, height: 20)
            .rotationEffect(.degrees(-45))
            .shadow(color: Color.black.opacity(0.25), radius: 2, x: 0, y: 1)
    }

    private var teardrop: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 10,
            bottomLeadingRadius: 0,
            bottomTrailingRadius: 10,
            topTrailingRadius: 10
        )
    }
}

private struct VibeRow: View {
    let icon: PantopusIcon
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 12, color: Theme.Color.categoryParty)
                .frame(width: 24, height: 24)
                .background(Theme.Color.appSurface)
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 7))
            Text(label)
                .font(.system(size: 10.5, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(minWidth: 76, alignment: .leading)
            Text(value)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
    }
}

// MARK: - Party note (handwriting-feel)

private struct PartyNoteCard: View {
    let note: PartyNoteContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                Text(note.eyebrow.uppercased())
                    .font(.system(size: 10.5, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.categoryParty.opacity(0.8))
                Spacer()
                Icon(.quote, size: 18, color: Theme.Color.categoryParty.opacity(0.4))
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(Array(note.paragraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.system(size: 14.5, design: .serif))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineSpacing(3)
                }
                Text("— \(note.signature)")
                    .font(.system(size: 14, weight: .regular, design: .serif).italic())
                    .foregroundStyle(Theme.Color.categoryParty)
                    .padding(.top, Spacing.s1)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3 + 2)
        .background(
            LinearGradient(
                colors: [Theme.Color.appSurface, Theme.Color.errorBg.opacity(0.6)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.categoryParty.opacity(0.30), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyNoteCard")
    }
}

#Preview("Open") {
    PartyDetailLayout(
        content: previewContent,
        party: MailItemSampleData.partyInvite,
        rsvpInFlight: false,
        onBack: {},
        onSetRsvp: { _ in },
        onAdjustPlusOne: { _ in },
        onClaimBring: { _ in },
        onReleaseBring: { _ in },
        onOpenSenderProfile: nil
    )
}

#Preview("Going") {
    PartyDetailLayout(
        content: previewContent,
        party: MailItemSampleData.partyInviteGoing,
        rsvpInFlight: false,
        onBack: {},
        onSetRsvp: { _ in },
        onAdjustPlusOne: { _ in },
        onClaimBring: { _ in },
        onReleaseBring: { _ in },
        onOpenSenderProfile: nil
    )
}

private var previewContent: MailDetailContent {
    MailDetailContent(
        mailId: "preview-party",
        category: .party,
        trust: .verified,
        detailTrust: .celebration,
        senderDisplayName: "Priya R.",
        senderMeta: "Maple St · 3 doors down",
        senderTypeLabel: "Pantopus user",
        carrierLine: "via Pantopus Mail",
        senderInitials: "PR",
        senderUserId: "user-priya",
        title: "Backyard housewarming · Sat May 24, 6 PM",
        excerpt: nil,
        referenceLabel: "Invite EVT-0517 · 12 invited · personal",
        createdAtLabel: "Wed May 21, 2026",
        expiresAtLabel: nil,
        readStatusLabel: "Unread",
        bodyParagraphs: [],
        attachments: [],
        aiSummary: nil,
        ackRequired: false,
        isAcknowledged: false,
        partyDetail: MailItemSampleData.partyInvite
    )
}
