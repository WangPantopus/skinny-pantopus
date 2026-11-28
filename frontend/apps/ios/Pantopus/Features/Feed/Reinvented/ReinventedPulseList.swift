//
//  ReinventedPulseList.swift
//  Pantopus
//
//  The new Pulse's list (PHASE-1 §2 pieces 3 and 4): two looks for two lifetimes. A Moment that fades is borderless
//  and full width with its time left; a post that stays is today's Pulse card (`PulsePostCard`, its reactions, Save,
//  Repost and Reply as everywhere) under a status line ("Question, 3 answers", "Solved", "Spot", "Plan"). A thin line
//  with the band's label where the distance band changes ("Your street", "Camas", "2 mi"); the end line from the
//  server ("Caught up around you. Keep exploring?").
//

import SwiftUI

struct ReinventedPulseList: View {
    let model: ReinventedPulseModel
    /// Alive right now, over the list; nil or empty draws nothing.
    let strip: ReinventedStripResponse?
    let onOpenPost: (String) -> Void
    let onOpenMoment: (MomentDTO) -> Void
    let onOpenRing: (MomentRingDTO) -> Void
    let onRefreshStrip: () async -> Void
    /// "Tonight in <town>" (8k): the film's Moments as one run in the viewer.
    var onOpenRun: ([MomentRingDTO]) -> Void = { _ in }
    /// Nothing passed the filters (PHASE-5 B): clear them.
    var onClearFilters: () -> Void = {}

    var body: some View {
        switch model.load {
        case .loading:
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    ForEach(0..<3, id: \.self) { _ in FeedSkeletonCard(withTitle: true) }
                }
                .padding(.horizontal, Spacing.s4)
            }
            .accessibilityLabel("Loading Pulse")
        case let .failed(message):
            EmptyState(
                icon: .alertTriangle,
                headline: "Pulse didn't load",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await model.refresh() }
            )
            .padding(.top, Spacing.s5)
        case .needsPlace:
            EmptyState(
                icon: .mapPin,
                headline: "Where should Pulse look?",
                subcopy: "Turn on location for Pantopus in Settings, or add your home in Place, to see what's around you.",
                cta: EmptyState.CTA(title: "Show my circle instead") { await model.pick(reach: "close", miles: model.miles) }
            )
            .padding(.top, Spacing.s5)
        case .loaded:
            list
        }
    }

    private var list: some View {
        ScrollViewReader { proxy in
            scroll
                // A pin tapped on the map (PHASE-6 B): the list goes to its row.
                .onChange(of: model.scrollTarget) { _, target in
                    guard let target else { return }
                    withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(target, anchor: .top) }
                    model.scrollTarget = nil
                }
        }
    }

    private var scroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s3) {
                if let strip, !strip.isEmpty, model.reach != "explore" {
                    ReinventedAliveStrip(strip: strip, onOpenMoment: onOpenMoment, onOpenRing: onOpenRing)
                }
                // Your day (CONTRACT 8k): in the evening, the person's own photos of the day, private until they share.
                if model.reach == "around", model.chip == "all" { YourDayCard() }
                // Tonight in <town> (CONTRACT 8k): in the evening, on Around me's whole list, read once the list has come.
                if model.reach == "around", model.chip == "all" { ReinventedTownFilmCard(onPlay: onOpenRun) }
                // Eyes on near you (CONTRACT 8f): read only once the Ask chip is picked.
                if model.chip == "ask" { EyesOnNearSection(viewer: model.viewer) }
                // Relics near you (CONTRACT 8g): read only once the Spots chip is picked.
                if model.chip == "spots" { RelicsNearSection() }
                // Places you follow (CONTRACT 9c, phase 4): at the top of Explore.
                if model.reach == "explore" { ReinventedFollowedPlacesSection(pulse: model, moment: onOpenMoment, post: onOpenPost) }
                if model.reach == "close" { ReinventedWindowsRow() } // phase 4: homes talk to homes (CONTRACT 9f)
                if model.isEmpty {
                    emptyNote
                }
                ForEach(model.rows) { row in
                    rowView(row).id(row.id)
                }
                more
            }
            // An older area's rows while the new one's read is out (PHASE-6 B): dimmed, never emptied.
            .opacity(model.stale ? 0.6 : 1)
            .animation(.easeOut(duration: 0.2), value: model.stale)
            .padding(.bottom, 120)
        }
        .refreshable {
            await model.refresh()
            await onRefreshStrip()
        }
        // Tonight in <town> (8k): only in the evening, only once the list's first page is here (this view is the loaded list).
        .task(id: model.reach == "around" && model.chip == "all") {
            if model.reach == "around", model.chip == "all" {
                async let day: Void = YourDayModel.shared.read()
                await ReinventedTownFilmModel.shared.read()
                await day
            }
        }
        .accessibilityIdentifier("reinventedPulse.list")
    }

    private func rowView(_ row: ReinventedPulseModel.Row) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            switch row {
            case let .band(band):
                bandLine(band)
            case let .heading(words):
                heading(words)
            case let .moment(moment, why, kept):
                if kept {
                    keptCard(moment)
                } else {
                    ReinventedMomentRow(moment: moment) { onOpenMoment(moment) }
                }
                if let why { whyLine(why) }
            case let .post(card, why):
                postCard(card)
                if let why { whyLine(why) }
            }
        }
    }

    @ViewBuilder private var more: some View {
        if model.hasMore, let pause = model.pause {
            // Explore pauses: more only when asked.
            Button(pause) { Task { await model.loadMore() } }
                .font(.system(size: 15, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .accessibilityIdentifier("reinventedPulse.keepExploring")
        } else if model.hasMore {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                // Once per page: a row that stays on screen after a page came (or after the area's first page came back)
                // reads the next one, instead of spinning.
                .task(id: model.nextPage) { await model.loadMore() }
        } else if let end = model.end, !(model.reach == "explore" && model.isEmpty) {
            Text(end)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.vertical, Spacing.s5)
                .accessibilityIdentifier("reinventedPulse.end")
        }
    }

    /// A Moment its author kept: a post that stays, in the bordered look, under "Kept · stays".
    private func keptCard(_ moment: MomentDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            // A Retake's row (CONTRACT 8e) says so; it opens the whole Retake.
            Text(moment.together.retake?.tag ?? moment.together.convergence?.tag ?? moment.together.pinboard?.tag ?? "Kept · stays")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.primaryTint)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
            ReinventedMomentRow(moment: moment, kept: true) { onOpenMoment(moment) }
                .padding(.bottom, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("reinventedPulse.kept.\(moment.id)")
    }

    private func heading(_ words: String) -> some View {
        Text(words)
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .accessibilityAddTraits(.isHeader)
    }

    /// "Why am I seeing this?", answered in one line.
    private func whyLine(_ why: String) -> some View {
        HStack(spacing: 6) {
            Icon(.info, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text(why)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Why you're seeing this: \(why)")
    }

    /// Nothing here: what there is to do.
    private var emptyNote: some View {
        VStack(spacing: Spacing.s2) {
            Text(Self.emptyTitle(model.reach))
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(Self.emptyLine(model.reach))
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            if model.filters != nil {
                // Nothing passed the filters: clear them, or look wider.
                HStack(spacing: Spacing.s3) {
                    Button("Clear the filters", action: onClearFilters)
                        .accessibilityIdentifier("reinventedPulse.empty.clearFilters")
                    Button("Look wider") { Task { await widen() } }
                        .accessibilityIdentifier("reinventedPulse.empty.wider")
                }
                .font(.system(size: 14, weight: .semibold))
                .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s5)
        .accessibilityIdentifier("reinventedPulse.empty")
    }

    /// One step wider: Close circle to Around me, Around me to its farthest, then Explore.
    private func widen() async {
        if model.reach == "close" {
            await model.pick(reach: "around", miles: model.miles)
        } else if model.miles < 25 {
            await model.pick(reach: "around", miles: 25)
        } else {
            await model.pick(reach: "explore", miles: model.miles)
        }
    }

    private func bandLine(_ band: ReinventedBandDTO) -> some View {
        HStack(spacing: Spacing.s2) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            Text(band.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize()
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier("reinventedPulse.band.\(band.band)")
    }

    /// A post that stays: its status line over today's Pulse card, in a border.
    private func postCard(_ card: PulsePostCardContent) -> some View {
        let cards = model.cards
        let postId = card.id
        let reply: @MainActor () -> Void = { onOpenPost(postId) }
        let going: @MainActor () -> Void = { Task { await cards.tapReaction(postId: postId) } }
        return VStack(alignment: .leading, spacing: 0) {
            if let status = Self.status(of: card) {
                Text(status)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primaryTint)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("reinventedPulse.status.\(postId)")
            }
            if let line = model.travel(of: postId)?.line {
                Text(line)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s1)
                    .accessibilityIdentifier("reinventedPulse.travel.\(postId)")
            }
            PulsePostCard(
                content: card,
                onTap: { onOpenPost(postId) },
                onPickReaction: { emoji in Task { await cards.pickReaction(postId: postId, emoji: emoji) } },
                onRSVP: card.attendees == nil ? nil : going,
                onToggleSave: { Task { await cards.toggleSave(postId: postId) } },
                onToggleRepost: { cards.openRepostChooser(postId: postId) },
                repostChooser: PulseCardRepostChooser(
                    target: Binding(get: { cards.repostChooser }, set: { cards.repostChooser = $0 }),
                    onToggle: { postId in Task { await cards.toggleRepost(postId: postId) } },
                    onQuote: { postId in cards.beginQuote(postId: postId) }
                ),
                onReply: reply
            )
            if let travel = model.travel(of: postId) {
                ReinventedPassItOn(postId: postId, travel: travel, viewer: model.viewer)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s3)
    }

    static func emptyLine(_ reach: String) -> String {
        reach == "explore"
            ? "Explore shows only what people chose to share with everyone. Check back later today."
            : "Post a Moment with + and it shows here first. Or widen what Pulse shows from the pill at the top."
    }

    static func emptyTitle(_ reach: String) -> String {
        switch reach {
        case "close": "Nothing from your circle right now"
        case "explore": "Nothing from elsewhere yet today"
        default: "Quiet around here right now"
        }
    }

    /// The status line for a post that stays, from the kinds today's Pulse has.
    static func status(of card: PulsePostCardContent) -> String? {
        let replies = card.commentCount
        switch card.intent {
        case .ask:
            if card.actions.isSolved { return "Solved" }
            return replies == 1 ? "Question, 1 answer" : "Question, \(replies) answers"
        case .recommend:
            // "Spot, 8 want to go" (PHASE-1 §2.3): the Want to go signal's count, on a post that carries signals.
            let want = card.reaction.signals?.count(of: .wantToGo) ?? 0
            return want > 0 ? "Spot, \(want) want to go" : "Spot"
        case .event:
            let going = card.reaction.likeCount
            return going > 0 ? "Plan, \(going) going" : "Plan"
        default:
            return nil
        }
    }
}

/// A Moment that fades: borderless, full width, its picture (or its card), who and where, and its time left.
struct ReinventedMomentRow: View {
    let moment: MomentDTO
    /// A kept Moment says no time left: it stays.
    var kept = false
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                picture
                    .frame(maxWidth: .infinity)
                    .frame(height: 380)
                    .clipped()
                    .overlay(alignment: .topLeading) { header.padding(Spacing.s3) }
                if let caption = moment.caption, !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .padding(.horizontal, Spacing.s4)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
        .accessibilityHint("Opens the Moment")
        .accessibilityIdentifier("reinventedPulse.moment.\(moment.id)")
    }

    @ViewBuilder private var picture: some View {
        switch moment.kind {
        case .text:
            MomentsTextCard(text: moment.text ?? "", background: moment.background)
        case .photo, .video:
            AsyncImage(url: moment.kind == .video ? moment.poster ?? moment.media : moment.media) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Theme.Color.appSurfaceRaised
            }
        }
    }

    private var header: some View {
        HStack(spacing: 6) {
            Text(moment.author.shortName)
                .font(.system(size: 13, weight: .bold))
            if !kept {
                Text("·")
                Text(timeLeft)
                    .font(.system(size: 13, weight: .semibold))
            }
            if !moment.placeLabel.isEmpty {
                Text("·")
                Text(moment.placeLabel)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(Color.black.opacity(0.5)))
    }

    /// "5h left", "40m left".
    private var timeLeft: String {
        guard let end = MomentTime.parse(moment.expiresAt) else { return "" }
        let minutes = max(Int(end.timeIntervalSinceNow / 60), 0)
        return minutes >= 60 ? "\(minutes / 60)h left" : "\(minutes)m left"
    }

    private var spoken: String {
        var parts = ["\(moment.author.shortName)'s Moment", timeLeft]
        if !moment.placeLabel.isEmpty { parts.append(moment.placeLabel) }
        if let caption = moment.caption, !caption.isEmpty { parts.append(caption) }
        return parts.joined(separator: ", ")
    }
}
