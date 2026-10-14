//
//  PlanScreenSections.swift
//  Pantopus
//
//  The panel under a plan's map, by the viewer's standing: J1/J2 before
//  you're in, J5 requested, J6 on the waitlist, J7 you're in, H9 hosting,
//  and a cancelled or ended plan.
//

import SwiftUI

struct PlanScreenSections: View {
    let viewModel: PlanScreenViewModel
    let onOpenHost: (String) -> Void
    let onOpenRequests: () -> Void
    let onOpenChat: () -> Void
    let onChange: () -> Void
    let onCancel: () -> Void
    let onConfirm: (PlanConfirmation) -> Void

    var body: some View {
        if let card = viewModel.card {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                switch viewModel.mode {
                case .browsing:
                    PlanBrowsingSection(card: card, onOpenHost: onOpenHost)
                case .requested:
                    PlanRequestedSection(card: card, myRequest: viewModel.plan?.myRequest)
                case .waitlisted:
                    PlanWaitlistSection(card: card)
                case .going:
                    PlanGoingSection(viewModel: viewModel, card: card, onOpenChat: onOpenChat, onConfirm: onConfirm)
                case .hosting:
                    PlanHostingSection(
                        viewModel: viewModel,
                        card: card,
                        onOpenRequests: onOpenRequests,
                        onOpenChat: onOpenChat,
                        onChange: onChange,
                        onCancel: onCancel,
                        onConfirm: onConfirm
                    )
                case .closed:
                    PlanClosedSection(
                        card: card,
                        cancelNote: viewModel.plan?.cancelNote,
                        onOpenChat: viewModel.plan?.chatRoomId == nil ? nil : onOpenChat
                    )
                case .notThisTime:
                    EmptyView()
                }
            }
        }
    }
}

// MARK: - Shared rows

/// A small glyph and a line ("Sunday, Oct 18 · 1:25–4:45 PM").
struct PlanFactRow: View {
    let icon: PantopusIcon
    let text: String
    var strong = true

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(icon, size: 16, color: Theme.Color.appTextSecondary)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
            Text(text)
                .planFont(.small)
                .monospacedDigit()
                .foregroundStyle(strong ? Theme.Color.appTextStrong : Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The type tag, the title and the when and where lines.
struct PlanTitleBlock: View {
    let card: PlanCardDTO
    var showsTag = true

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if showsTag { PlanTypeTag(kind: card.kind) }
            Text(card.title)
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                PlanFactRow(icon: .calendar, text: PlanScreenLines.when(card))
                PlanFactRow(icon: .mapPin, text: PlanScreenLines.whereLine(card))
                if card.kind == .playdate, let ages = PlanRowModel.ages(card.details?.kidsAgeBands) {
                    PlanFactRow(icon: .planPlaydate, text: "Kids \(ages)")
                }
            }
        }
    }
}

/// A status banner: a 34 pt glyph square and two lines.
struct PlanBanner: View {
    enum Tone { case neutral, success, warning }

    let tone: Tone
    let icon: PantopusIcon
    let title: String
    let message: String?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(tone == .success ? Theme.Color.successSolid : Theme.Color.appSurface)
                .overlay {
                    if tone != .success {
                        RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1)
                    }
                }
                .frame(width: 34, height: 34)
                .overlay(Icon(icon, size: 18, strokeWidth: tone == .success ? 2.6 : 2, color: glyph))
            VStack(alignment: .leading, spacing: 0) {
                Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                if let message {
                    Text(message)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(background))
        .accessibilityElement(children: .combine)
    }

    private var background: Color {
        switch tone {
        case .neutral: Theme.Color.appSurfaceSunken
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        }
    }

    private var glyph: Color {
        switch tone {
        case .success: Theme.Color.appTextInverse
        case .warning: Theme.Color.warning
        case .neutral: Theme.Color.appTextStrong
        }
    }
}

/// A bordered card.
struct PlanCardBox<Content: View>: View {
    var padding: CGFloat = 14
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }
}

/// Lines the plan screens share.
enum PlanScreenLines {
    /// "Sunday, Oct 18 · 1:25–4:45 PM", "Saturday morning", "Happening now · until 10:30".
    static func when(_ card: PlanCardDTO) -> String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        if card.state == .live {
            return PlanFormat.rowWhen(state: .live, start: card.startsAtDate, end: card.endsAtDate, calendar: calendar) ?? "Happening now"
        }
        guard let start = card.startsAtDate else {
            return PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, calendar: calendar)
        }
        return PlanFormat.when(start: start, end: card.endsAtDate, long: true, calendar: calendar)
    }

    /// "Sun 1:25 PM", "Tomorrow 6:00 PM", "Happening now · until 10:30"; a
    /// playdate before you're in: "Saturday morning".
    static func shortWhen(_ card: PlanCardDTO) -> String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        return PlanFormat.rowWhen(state: card.state, start: card.startsAtDate, end: card.endsAtDate, calendar: calendar)
            ?? PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, calendar: calendar)
    }

    /// "Near Prune Hill · about 1 mi · at Sam's place" / "· a public place".
    static func whereLine(_ card: PlanCardDTO) -> String {
        var parts = [card.area.label]
        if let distance = PlanFormat.distance(card.distanceBand) { parts.append(distance) }
        switch card.placeKind {
        case .home: parts.append("at \(PlanCardLines.firstName(card.host.displayName))'s place")
        case .publicPlace: parts.append("a public place")
        case nil: break
        }
        return parts.joined(separator: " · ")
    }

    /// "Casual · extra paddles", "Easy pace · dogs welcome".
    static func details(_ card: PlanCardDTO) -> String? {
        guard let details = card.details else { return nil }
        var parts: [String] = []
        switch card.kind {
        case .pickupGame:
            if let level = details.level { parts.append(PlanComposerOptions.levelLabel(level)) }
            if details.extraGear == true { parts.append("extra \(PlanComposerOptions.gearNoun(details.sport))") }
        case .walkCoffee:
            if let pace = details.pace { parts.append("\(pace.capitalized) pace") }
            if details.dogsWelcome == true { parts.append("dogs welcome") }
        case .watchParty, .playdate:
            break
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - J1 / J2

struct PlanBrowsingSection: View {
    let card: PlanCardDTO
    let onOpenHost: (String) -> Void

    var body: some View {
        PlanTitleBlock(card: card)
        Button {
            if let id = card.host.userId { onOpenHost(id) }
        } label: {
            PlanCardBox(padding: 14) {
                PlanHostRow(host: card.host, kind: card.kind, showsChevron: card.host.userId != nil)
            }
        }
        .buttonStyle(.plain)
        .disabled(card.host.userId == nil)
        .accessibilityHint("Opens their profile")
        PlanSpotsBlock(card: card, trailing: card.kind == .playdate ? nil : "Names show once you're in")
        if card.kind == .playdate {
            PlanNote(
                icon: .shieldCheck,
                text: "Parents stay with their kids. Only ages are shared, never names, photos or schools. "
                    + "Everyone here has a verified address."
            )
        } else {
            if let about = card.about, !about.isEmpty {
                Text(about).planFont(.body).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
            }
            if let details = PlanScreenLines.details(card) {
                Text(details).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PlanFactRow(icon: .users, text: PlanCardLines.approval(card))
                PlanFactRow(icon: .shieldCheck, text: "Free, and for adults")
            }
        }
    }
}

/// The sky note with a glyph (J2's promise, H3's rules).
struct PlanNote: View {
    let icon: PantopusIcon
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(icon, size: 18, color: Theme.Color.primary700).padding(.top, 1)
            Text(text)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.infoBg))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - J5

struct PlanRequestedSection: View {
    let card: PlanCardDTO
    let myRequest: PlanMyRequestDTO?

    var body: some View {
        PlanBanner(
            tone: .neutral,
            icon: .clock,
            title: "Requested",
            message: PlanCardLines.answersWithin(card.host).map { "\($0) We'll tell you." }
                ?? "We'll tell you when \(PlanCardLines.firstName(card.host.displayName)) answers."
        )
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PlanTypeTag(kind: card.kind)
            Text(card.title).planFont(.h2).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
            Text(PlanCardLines.whenWhere(card, long: true))
                .planFont(.small)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        if let partySize = myRequest?.partySize {
            PlanCardBox {
                VStack(alignment: .leading, spacing: 6) {
                    Text.planOverline("Your request").padding(.bottom, 2)
                    if card.kind == .playdate {
                        let kids = myRequest?.kidsCount ?? 1
                        let ages = PlanRowModel.ages(myRequest?.kidsAgeBands).map { " · \($0)" } ?? ""
                        keyValue("Coming", "You + \(kids) kid\(kids == 1 ? "" : "s")\(ages)")
                    } else {
                        keyValue("Coming", partySize <= 1 ? "Just you" : "You + \(partySize - 1)")
                    }
                    // The last ask, with the day when it isn't today.
                    if let sentAt = PlanTime.parse(myRequest?.createdAt) {
                        keyValue("Sent", PlanFormat.past(sentAt))
                    }
                    if let note = myRequest?.note, !note.isEmpty {
                        Text("\u{201C}\(note)\u{201D}")
                            .planFont(.small)
                            .italic()
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        PlanSpotsBlock(card: card)
    }

    private func keyValue(_ key: String, _ value: String) -> some View {
        HStack {
            Text(key).foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(Theme.Color.appText)
        }
        .planFont(.small)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - J6

struct PlanWaitlistSection: View {
    let card: PlanCardDTO

    var body: some View {
        PlanBanner(
            tone: .neutral,
            icon: .list,
            title: "You're \(PlanRowModel.ordinal(card.viewer?.waitlistPosition ?? 1)) on the waitlist",
            // Only an automatic plan lets the next person in by itself; otherwise the host decides.
            message: card.howPeopleGetIn == "automatic"
                ? "If someone can't make it, you're in. We'll tell you right away."
                : "If someone can't make it, \(PlanCardLines.firstName(card.host.displayName)) can let you in. We'll tell you right away."
        )
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PlanTypeTag(kind: card.kind)
            Text(card.title).planFont(.h2).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
            Text(PlanCardLines.whenWhere(card, long: true))
                .planFont(.small)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            if let details = PlanScreenLines.details(card) {
                Text(details).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        if card.isFull {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    (Text("Full").fontWeight(.semibold) + Text(" · \(card.goingCount) of \(card.spots) \(noun)")
                        .foregroundColor(Theme.Color.appTextSecondary))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    if let waiting = card.waitlistCount, waiting > 0 {
                        Text("\(waiting) waiting").planFont(.small).foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                PlanSlotMeter(spots: card.spots, filled: card.goingCount)
            }
            .accessibilityElement(children: .combine)
        } else {
            // A spot opened while you wait (the host hasn't let the next person in yet): say so, as Android does.
            PlanSpotsBlock(card: card, trailing: (card.waitlistCount ?? 0) > 0 ? "\(card.waitlistCount ?? 0) waiting" : nil)
        }
        PlanCardBox {
            HStack(spacing: Spacing.s3) {
                PlanAvatar(name: card.host.displayName, url: card.host.avatarUrl)
                VStack(alignment: .leading, spacing: 0) {
                    Text(card.host.displayName).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    // The rule that applies (anyone nearby, verified neighbors, people hosted before), never a guess.
                    Text(PlanCardLines.approval(card))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var noun: String {
        switch card.kind {
        case .pickupGame: "players"
        case .playdate: "families"
        default: "people"
        }
    }
}

// MARK: - Cancelled or ended

struct PlanClosedSection: View {
    let card: PlanCardDTO
    /// The host's note when they cancelled (H12).
    var cancelNote: String?
    var showsTitle = true
    /// The plan's chat, read-only now, for people who were in.
    var onOpenChat: (() -> Void)?

    var body: some View {
        PlanBanner(
            tone: .neutral,
            icon: card.state == .cancelled ? .calendarX : .checkCircle,
            title: title,
            message: message
        )
        // The host's own note, as everyone was sent it (as on Android).
        if isHost, card.state == .cancelled, let note {
            Text("Your note: \u{201C}\(note)\u{201D}")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        if showsTitle { PlanTitleBlock(card: card) }
        if let onOpenChat {
            Button(action: onOpenChat) { PlanButtonLabel(title: "Read the group chat", icon: .messageCircle, kind: .secondary) }
                .planButton(.secondary, size: .small)
                .accessibilityIdentifier("planClosedChat")
        }
    }

    private var isHost: Bool {
        card.viewer?.isHost == true
    }

    private var note: String? {
        let note = cancelNote?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return note.isEmpty ? nil : note
    }

    private var title: String {
        guard card.state == .cancelled else { return "This plan has ended" }
        return isHost ? "You cancelled this plan" : "This plan was cancelled"
    }

    /// "Sam cancelled it: “Sorry, the courts are closed tonight.”"; the host
    /// reads who was told (as on Android).
    private var message: String? {
        guard card.state == .cancelled else { return nil }
        if isHost { return "Everyone who was in or waiting was told. The pin is off the map." }
        let host = PlanCardLines.firstName(card.host.displayName)
        if let note { return "\(host) cancelled it: \u{201C}\(note)\u{201D}" }
        return "\(host) cancelled it."
    }
}
