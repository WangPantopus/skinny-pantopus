//
//  MomentsViewer.swift
//  Pantopus
//
//  Watching (boards V1–V5), full screen and always dark. Tap the right side
//  for the next Moment and the left for the one before; hold to pause; swipe
//  left for the next ring nearby and right for the one before; swipe down
//  to go back to the map. A video plays with its sound (the header mutes
//  it). Typing a reply pauses and shows the quick reactions; the reply lands
//  in Messages. On your own Moment, "Seen by" opens the list of who watched.
//

import SwiftUI

struct MomentsViewer: View {
    @State private var model: MomentsViewerModel
    @State private var replyText = ""
    @FocusState private var replyFocused: Bool
    @State private var showsReactions = false
    @State private var showsMenu = false
    @State private var showsReport = false
    @State private var showsBlock = false
    @State private var showsSeenBy = false
    @State private var dragOffset: CGSize = .zero
    @State private var pressStarted: Date?
    @State private var pressMoved = false
    @State private var holdTask: Task<Void, Never>?
    /// The Home indicator's inset, measured by the stage (which ignores the keyboard).
    @State private var homeInset: CGFloat = 34
    @Environment(\.scenePhase) private var scenePhase
    private let onHideAuthor: @MainActor (String) -> Void
    private let onShowAuthor: @MainActor (String) -> Void
    /// The phone's light or dark: Seen by follows it over the dark viewer.
    private let systemScheme: ColorScheme
    private let onClose: @MainActor () -> Void

    init(
        request: MomentsWatchRequest,
        systemScheme: ColorScheme,
        onWatched: @escaping @MainActor (Set<String>) -> Void,
        onHideAuthor: @escaping @MainActor (String) -> Void,
        onShowAuthor: @escaping @MainActor (String) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        _model = State(initialValue: MomentsViewerModel(request: request, onWatched: onWatched))
        self.onHideAuthor = onHideAuthor
        self.onShowAuthor = onShowAuthor
        self.systemScheme = systemScheme
        self.onClose = onClose
    }

    /// How far the viewer has been dragged down, never negative.
    private var dragDown: CGFloat {
        max(dragOffset.height, 0)
    }

    /// The viewer shrinks a little as it's dragged down.
    private var dragScale: CGFloat {
        let travel: CGFloat = min(dragDown, 400)
        return 1 - travel / 2400
    }

    /// The black behind the viewer fades as it's dragged down.
    private var backdropOpacity: Double {
        let travel: CGFloat = min(dragDown, 300)
        return 1 - Double(travel) / 600
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geo in stage(geo) }
                .ignoresSafeArea(.keyboard)
            bottomColumn
        }
        .offset(y: max(0, dragOffset.height))
        .scaleEffect(dragScale)
        .background(Color.black.opacity(backdropOpacity).ignoresSafeArea())
        .preferredColorScheme(.dark)
        .task { model.start() }
        .onDisappear { model.stop() }
        .onChange(of: model.isClosed) { _, closed in if closed { onClose() } }
        .onChange(of: replyFocused) { _, focused in
            model.replying = focused || showsReactions
        }
        .onChange(of: showsReactions) { _, open in model.replying = open || replyFocused }
        .onChange(of: covered) { _, isCovered in model.covered = isCovered }
        // A reply half-typed for one person is never left in the next person's box.
        .onChange(of: model.brief?.id) { _, _ in replyText = "" }
        // Another app, a call or the notification shade: it waits, and picks up where it was.
        .onChange(of: scenePhase, initial: true) { _, phase in model.away = phase != .active }
        .confirmationDialog("Moment options", isPresented: $showsMenu, titleVisibility: .hidden) { menu }
        .confirmationDialog("Report this Moment?", isPresented: $showsReport, titleVisibility: .visible) {
            ForEach(Self.reportReasons, id: \.token) { reason in
                Button(reason.label) { Task { await model.report(reason: reason.token) } }
                    .accessibilityIdentifier("moments.report.\(reason.token)")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Reports go to the Pantopus team. The person isn't told who reported.")
        }
        .alert("Block \(model.ring?.author.name ?? "")?", isPresented: $showsBlock) {
            Button("Block", role: .destructive) { Task { await model.blockAuthor(onHide: onHideAuthor) } }
                .accessibilityIdentifier("moments.blockConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You won't see each other's Moments or posts, and you can't message each other. They aren't told.")
        }
        .sheet(isPresented: $showsSeenBy) {
            MomentsSeenBySheet(model: model)
                .presentationDetents([.fraction(0.56), .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.Color.appSurface)
                .environment(\.colorScheme, systemScheme)
                .preferredColorScheme(systemScheme)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.viewer")
    }

    /// Paused by a menu, a sheet or a dialog over the viewer.
    private var covered: Bool {
        showsMenu || showsReport || showsBlock || showsSeenBy
    }

    // MARK: - Stage

    private func stage(_ geo: GeometryProxy) -> some View {
        let height = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
        let mediaHeight = max(height - 68, 200)
        return ZStack(alignment: .top) {
            Color.black
            media
                .frame(width: geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing, height: mediaHeight)
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
                .overlay { if isReplying { Color.black.opacity(0.5) } }
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 180)
                        .allowsHitTesting(false)
                }
                .overlay(alignment: .bottom) {
                    if let caption = model.moment?.caption, !caption.isEmpty, model.moment?.kind != .text, !isReplying {
                        MomentsCaptionPill(caption: caption).padding(.bottom, 63)
                    }
                }
                .overlay {
                    if let pop = model.reactionPop {
                        MomentsReactionPop(emoji: pop.emoji).id(pop.id)
                    }
                }
                .contentShape(Rectangle())
                .gesture(pressGesture(width: geo.size.width))
                // VoiceOver can't tap a side: the same moves as actions.
                .accessibilityAction(named: "Next Moment") { model.next() }
                .accessibilityAction(named: "Previous Moment") { model.previous() }
                .accessibilityAction(named: "Next person") { model.nextRing() }
            VStack(spacing: 0) {
                MomentsProgressBars(count: model.ring?.moments.count ?? 1, current: model.momentIndex, progress: model.progress)
                    .padding(.horizontal, 10)
                    .padding(.top, geo.safeAreaInsets.top + 8)
                MomentsViewerHeader(
                    author: model.ring?.author,
                    isMine: model.isMine,
                    place: model.metaPlace,
                    times: model.metaTimes,
                    isVideo: model.moment?.kind == .video,
                    muted: model.muted,
                    compact: isReplying,
                    onSound: { model.muted.toggle() },
                    onMore: { showsMenu = true },
                    onClose: { model.close() }
                )
                .padding(.top, 9)
            }
            .opacity(model.holding ? 0 : 1)
            .animation(.easeOut(duration: 0.15), value: model.holding)
        }
        .ignoresSafeArea()
        .onChange(of: geo.safeAreaInsets.bottom, initial: true) { _, inset in homeInset = inset }
    }

    @ViewBuilder
    private var media: some View {
        switch model.load {
        case .ready:
            content
        case .loading:
            ZStack {
                if let moment = model.moment, moment.kind == .text {
                    MomentsTextCard(text: moment.text ?? "", background: moment.background)
                } else if let poster = model.poster {
                    // A video getting ready: its first picture, not a spinner on black.
                    Image(uiImage: poster).resizable().scaledToFill()
                } else {
                    Color(white: 0.08)
                    ProgressView().tint(.white)
                }
            }
        case let .gone(message), let .failed(message):
            ZStack {
                Color(white: 0.08)
                VStack(spacing: Spacing.s3) {
                    Text(message)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.white)
                    if case .failed = model.load {
                        Button("Try again") { model.retry() }
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary300)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let moment = model.moment {
            switch moment.kind {
            case .photo:
                if let image = model.image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .accessibilityLabel("\(moment.author.shortName)'s photo")
                        .accessibilityIdentifier("moments.viewer.photo")
                }
            case .video:
                ZStack {
                    Color.black
                    if let poster = model.poster {
                        Image(uiImage: poster).resizable().scaledToFill()
                    }
                    MomentsVideoSurface(player: model.video.player)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(moment.author.shortName)'s video")
                .accessibilityIdentifier("moments.viewer.video")
            case .text:
                MomentsTextCard(text: moment.text ?? "", background: moment.background)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("moments.viewer.text")
            }
        }
    }

    // MARK: - Bottom

    private var isReplying: Bool {
        replyFocused || showsReactions
    }

    private var bottomColumn: some View {
        VStack(spacing: 0) {
            if isReplying {
                Spacer(minLength: 0)
                MomentsQuickReactions(chosen: model.myReaction) { emoji in
                    Task { await model.react(emoji) }
                    closeReply()
                }
                // A tap on a reaction while typing must reach it: the keyboard stays up until it has.
                .keepsKeyboardOnTap()
                .padding(.bottom, 14)
                if replyFocused, let name = model.ring?.author.shortName {
                    Text("\(name) gets your reply in Messages.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Color.white.opacity(0.78))
                        .padding(.bottom, Spacing.s3)
                        .accessibilityIdentifier("moments.viewer.replyHint")
                }
            } else {
                Spacer(minLength: 0)
            }
            if let toast = model.toast {
                MomentsToastView(toast: toast) { model.runToastAction() }
                    .padding(.bottom, Spacing.s3)
                    .transition(.opacity)
            }
            bottomBar
                // Send is a composer's button: tapping it sends, it doesn't just close the keyboard.
                .keepsKeyboardOnTap()
                .padding(.horizontal, Spacing.s3)
                // 14 pt off the screen's bottom, into the Home indicator's area as the boards draw it;
                // over the keyboard while typing.
                .padding(.bottom, replyFocused ? Spacing.s2 : max(14 - homeInset, -20))
        }
        .background {
            // A tap outside the reactions (not typing) closes them.
            if showsReactions, !replyFocused {
                Color.black.opacity(0.001).onTapGesture { closeReply() }
            }
        }
        .animation(.easeOut(duration: 0.2), value: model.toast)
    }

    @ViewBuilder
    private var bottomBar: some View {
        if model.isMine {
            MomentsSeenByBar(count: model.moment?.viewerCount) { showsSeenBy = true }
        } else if let author = model.ring?.author {
            MomentsReplyBar(
                firstName: author.shortName,
                text: $replyText,
                focus: $replyFocused,
                isTyping: replyFocused,
                reaction: model.myReaction,
                canReply: author.kind != .pantopus,
                onReact: { showsReactions = true },
                onSend: send
            )
        }
    }

    private func send() {
        let text = replyText
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Task {
            if await model.reply(text) {
                replyText = ""
                closeReply()
            }
        }
    }

    private func closeReply() {
        showsReactions = false
        replyFocused = false
    }

    /// The post report reasons (`reportPostSchema`), as Pulse offers them.
    private static let reportReasons: [(token: String, label: String)] = [
        ("spam", "Spam"),
        ("harassment", "Harassment"),
        ("inappropriate", "Inappropriate content"),
        ("misinformation", "Misinformation"),
        ("safety", "Safety concern"),
        ("other", "Something else")
    ]
}

// MARK: - Gestures and the … menu

extension MomentsViewer {
    /// One gesture for the whole picture: a tap moves on or back, a hold
    /// pauses, a swipe changes ring or closes.
    func pressGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if pressStarted == nil {
                    pressStarted = Date()
                    pressMoved = false
                    holdTask = Task {
                        try? await Task.sleep(for: .milliseconds(220))
                        guard !Task.isCancelled, !pressMoved else { return }
                        model.holding = true
                    }
                }
                guard hypot(value.translation.width, value.translation.height) > 10 else { return }
                pressMoved = true
                holdTask?.cancel()
                if model.holding { model.holding = false }
                if value.translation.height > 0, abs(value.translation.height) > abs(value.translation.width) {
                    dragOffset = value.translation
                }
            }
            .onEnded { value in
                holdTask?.cancel()
                let wasHolding = model.holding
                model.holding = false
                pressStarted = nil
                defer { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { dragOffset = .zero } }
                if isReplying {
                    closeReply()
                } else if pressMoved {
                    swipe(value.translation)
                } else if !wasHolding {
                    if value.location.x < width / 3 { model.previous() } else { model.next() }
                }
            }
    }

    /// Down closes, up opens Seen by (yours) or the reply (theirs), left and right change ring.
    private func swipe(_ translation: CGSize) {
        let dx = translation.width
        let dy = translation.height
        let vertical = abs(dy) > abs(dx)
        if vertical, dy > 110 {
            model.close()
        } else if vertical, dy < -70 {
            if model.isMine {
                showsSeenBy = true
            } else if model.ring?.author.kind != .pantopus {
                replyFocused = true
            }
        } else if !vertical, dx < -60 {
            model.nextRing()
        } else if !vertical, dx > 60 {
            model.previousRing()
        }
    }

    @ViewBuilder
    var menu: some View {
        Button("Report", role: .destructive) { showsReport = true }
            .accessibilityIdentifier("moments.menu.report")
        Button(muteLabel) {
            Task { await model.muteAuthor(onHide: onHideAuthor, onShow: onShowAuthor) }
        }
        .accessibilityIdentifier("moments.menu.mute")
        Button("Block", role: .destructive) { showsBlock = true }
            .accessibilityIdentifier("moments.menu.block")
        Button("Cancel", role: .cancel) {}
    }

    private var muteLabel: String {
        switch model.ring?.author.kind {
        case .business: "Mute this business's Moments"
        case .pantopus: "Mute Pantopus Moments"
        default: "Mute this person's Moments"
        }
    }
}
