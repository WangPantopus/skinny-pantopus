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
//  On the iPhone Duo it takes the Duo's layouts (`MomentsViewer+Duo.swift`).
//  What it shows lives in a `MomentsWatchSession` held by whoever opened it,
//  so a fold that builds this screen again picks up where it was.
//

import SwiftUI

struct MomentsViewer: View {
    @Bindable var session: MomentsWatchSession
    @FocusState var replyFocused: Bool
    @State var showsMenu = false
    @State var showsReport = false
    @State var showsBlock = false
    @State var dragOffset: CGSize = .zero
    @State var pressStarted: Date?
    @State var pressMoved = false
    @State var holdTask: Task<Void, Never>?
    /// The Home indicator's inset, measured by the stage (which ignores the keyboard).
    @State private var homeInset: CGFloat = 34
    /// How the iPhone Duo is held, as this screen reads it (a cover has a screen of its own); until then, as the
    /// screen that opened it read it.
    @State private var ownScreen: MomentsDuoScreen?
    @Environment(\.momentsDuoScreen) private var openerScreen
    @Environment(\.scenePhase) private var scenePhase
    let onHideAuthor: @MainActor (String) -> Void
    let onShowAuthor: @MainActor (String) -> Void
    /// The phone's light or dark: Seen by follows it over the dark viewer.
    let systemScheme: ColorScheme
    /// A viewer whose opener can go away with it (a chat's quote) stops when it leaves the screen. The Moments tab
    /// holds its watching above the screen and stops it only when the person closes it.
    private let stopsOnDisappear: Bool
    private let onClose: @MainActor () -> Void

    init(
        session: MomentsWatchSession,
        systemScheme: ColorScheme,
        stopsOnDisappear: Bool = false,
        onHideAuthor: @escaping @MainActor (String) -> Void,
        onShowAuthor: @escaping @MainActor (String) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.session = session
        self.systemScheme = systemScheme
        self.stopsOnDisappear = stopsOnDisappear
        self.onHideAuthor = onHideAuthor
        self.onShowAuthor = onShowAuthor
        self.onClose = onClose
    }

    var model: MomentsViewerModel {
        session.model
    }

    var duo: MomentsDuoScreen {
        ownScreen ?? openerScreen
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
        layout
            .offset(y: max(0, dragOffset.height))
            .scaleEffect(dragScale)
            .background(Color.black.opacity(backdropOpacity).ignoresSafeArea())
            .preferredColorScheme(.dark)
            .readsMomentsDuoScreen(Binding(get: { duo }, set: { ownScreen = $0 }))
            .task { model.start() }
            .onAppear(perform: giveReplyFocusBack)
            .onDisappear { if stopsOnDisappear { model.stop() } }
            .onChange(of: model.isClosed) { _, closed in if closed { onClose() } }
            .onChange(of: replyFocused) { _, focused in
                model.replying = focused || session.showsReactions
                noteReplyFocus(focused)
            }
            .onChange(of: session.showsReactions) { _, open in model.replying = open || replyFocused }
            // `initial`: a screen built again by a fold starts with nothing covering the Moment.
            .onChange(of: covered, initial: true) { _, isCovered in model.covered = isCovered }
            // A reply half-typed for one person is never left in the next person's box.
            .onChange(of: model.brief?.id) { _, _ in session.replyText = "" }
            // Another app, a call or the notification shade: it waits, and picks up where it was.
            .onChange(of: scenePhase, initial: true) { _, phase in model.away = phase != .active }
            // Folding or turning the Duo takes the keyboard just before the new layout: the reply box gets it back.
            .onChange(of: duo.pose) { _, _ in giveReplyFocusBack() }
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
            .alert("Block \(model.ring?.author.shortName ?? "")?", isPresented: $showsBlock) {
                Button("Block", role: .destructive) { Task { await model.blockAuthor(onHide: onHideAuthor) } }
                    .accessibilityIdentifier("moments.blockConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You won't see each other's Moments or posts, and you can't message each other. They aren't told.")
            }
            // Closed, the iPhone Duo shows Seen by in its column (`MomentsColumnSheet`); a fold there takes this sheet
            // down without closing Seen by.
            .sheet(isPresented: Binding(
                get: { session.showsSeenBy && duo.pose != .closed },
                set: { if $0 || duo.pose != .closed { session.showsSeenBy = $0 } }
            )) {
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

    /// The phone's viewer, or the Duo's for how it's held.
    @ViewBuilder
    private var layout: some View {
        switch duo.pose {
        case .phone:
            ZStack(alignment: .bottom) {
                GeometryReader { geo in stage(geo) }
                    .ignoresSafeArea(.keyboard)
                bottomColumn(floating: false, showsReact: true)
            }
        case .closed:
            closedLayout
        case .wide, .upright, .table:
            framedLayout
        }
    }

    /// Paused by a menu, a sheet or a dialog over the viewer.
    private var covered: Bool {
        showsMenu || showsReport || showsBlock || session.showsSeenBy
    }
}

extension MomentsViewer {
    // MARK: - Stage

    private func stage(_ geo: GeometryProxy) -> some View {
        let height = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
        let mediaHeight = max(height - 68, 200)
        return ZStack(alignment: .top) {
            Color.black
            media
                .frame(width: geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing, height: mediaHeight)
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
                .overlay { if isReplying { Color.black.opacity(0.55) } }
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
    var media: some View {
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
                // While a reply is being written the card keeps its color and gives up its words, so they
                // don't read through the reactions and the reply box.
                MomentsTextCard(text: isReplying ? "" : moment.text ?? "", background: moment.background)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("moments.viewer.text")
            }
        }
    }

    // MARK: - Bottom

    var isReplying: Bool {
        replyFocused || session.showsReactions
    }

    /// The reactions while replying, a short note, and the reply box (or Seen by). On the Duo the box floats over
    /// the picture 12 pt off its bottom (`floating`), and closed the reaction button is in the side strip.
    func bottomColumn(floating: Bool, showsReact: Bool) -> some View {
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
            bottomBar(floating: floating, showsReact: showsReact)
                // Send is a composer's button: tapping it sends, it doesn't just close the keyboard.
                .keepsKeyboardOnTap()
                .padding(.horizontal, Spacing.s3)
                // 14 pt off the screen's bottom, into the Home indicator's area as the boards draw it;
                // over the keyboard while typing. On the Duo, 12 pt off the picture's bottom or the keyboard.
                .padding(.bottom, floating ? Spacing.s3 : replyFocused ? Spacing.s2 : max(14 - homeInset, -20))
        }
        .background {
            // A tap outside the reactions (not typing) closes them.
            if session.showsReactions, !replyFocused {
                Color.black.opacity(0.001).onTapGesture { closeReply() }
            }
        }
        .animation(.easeOut(duration: 0.2), value: model.toast)
    }

    @ViewBuilder
    private func bottomBar(floating: Bool, showsReact: Bool) -> some View {
        if model.isMine {
            MomentsSeenByBar(count: model.moment?.viewerCount, floating: floating) { session.showsSeenBy = true }
        } else if let author = model.ring?.author {
            MomentsReplyBar(
                firstName: author.shortName,
                text: $session.replyText,
                focus: $replyFocused,
                isTyping: replyFocused,
                reaction: model.myReaction,
                canReply: author.kind != .pantopus,
                showsReact: showsReact,
                floating: floating,
                onReact: { session.showsReactions = true },
                onSend: send
            )
        }
    }

    private func send() {
        let text = session.replyText
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Task {
            if await model.reply(text) {
                session.replyText = ""
                closeReply()
            }
        }
    }

    func closeReply() {
        session.replyClosed()
        session.showsReactions = false
        replyFocused = false
    }

    // MARK: - The keyboard through a fold

    /// Remembers whether the reply box has the keyboard; losing it without a close (a fold) is noted with the time.
    private func noteReplyFocus(_ focused: Bool) {
        if focused {
            session.replyFocused = true
            session.replyFocusDropped = nil
        } else if session.replyFocused {
            session.replyFocused = false
            session.replyFocusDropped = Date()
        }
    }

    /// A fold took the keyboard a moment ago: the reply box asks for it again, a few times while the new screen
    /// settles (closing or half folding the Duo drops it just before the screen is laid out again).
    private func giveReplyFocusBack() {
        guard session.wantsReplyFocusBack, !replyFocused else { return }
        for delay in [80, 250, 500, 1000] {
            Task {
                try? await Task.sleep(for: .milliseconds(delay))
                guard session.replyFocusDropped != nil, !replyFocused else { return }
                replyFocused = true
            }
        }
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
