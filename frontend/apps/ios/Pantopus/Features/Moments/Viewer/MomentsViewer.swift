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

/// Where the viewer shows: full screen over what opened it, or on the open iPhone Duo as a card beside the map
/// (board O2), inside the Moments tab.
enum MomentsViewerPresentation: Equatable {
    case cover
    case card
}

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
    /// Which way the press under the finger is going, once it has moved: it keeps to that way until it lifts.
    @State var pressAxis: Axis?
    /// How far a sideways drag has turned the page toward the person after (negative) or before (`+Paging`).
    @State var pageOffset: CGFloat = 0
    @State var pageWidth: CGFloat = 0
    /// The page is finishing its turn: touches wait for it.
    @State var turning = false
    /// A pinch on a photo: how big, around where, and whether the press under it began before the pinch.
    @State var zoom: CGFloat = 1
    @State var zoomAnchor: UnitPoint = .center
    @State var zooming = false
    @State var pressZoomed = false
    @Environment(\.accessibilityReduceMotion) var reduceMotion
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
    let presentation: MomentsViewerPresentation
    /// The card opened from a crowded spot's list (board O3): a back chevron at the header's leading edge returns to it.
    let onBack: (@MainActor () -> Void)?
    /// The place under the name, tapped: whoever opened the viewer over a map shows that spot on it.
    let onShowPlace: (@MainActor (MomentRingDTO) -> Void)?
    private let onClose: @MainActor () -> Void

    init(
        session: MomentsWatchSession,
        systemScheme: ColorScheme,
        stopsOnDisappear: Bool = false,
        presentation: MomentsViewerPresentation = .cover,
        onBack: (@MainActor () -> Void)? = nil,
        onShowPlace: (@MainActor (MomentRingDTO) -> Void)? = nil,
        onHideAuthor: @escaping @MainActor (String) -> Void,
        onShowAuthor: @escaping @MainActor (String) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.session = session
        self.systemScheme = systemScheme
        self.stopsOnDisappear = stopsOnDisappear
        self.presentation = presentation
        self.onBack = onBack
        self.onShowPlace = onShowPlace
        self.onHideAuthor = onHideAuthor
        self.onShowAuthor = onShowAuthor
        self.onClose = onClose
    }

    var model: MomentsViewerModel {
        session.model
    }

    /// A card lives in the Moments tab, which reads how the Duo is held; a cover reads its own screen.
    var duo: MomentsDuoScreen {
        isCard ? openerScreen : ownScreen ?? openerScreen
    }

    var isCard: Bool {
        presentation == .card
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
        menuDialogs(on: layout, active: !isCard)
            // A card's black and shadow are a plain card behind it (not the playing picture's), and move with it.
            .background {
                if isCard {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(Color.black)
                        .shadow(color: .black.opacity(0.38), radius: 22, x: 0, y: 14)
                        .shadow(color: .black.opacity(0.22), radius: 4, x: 0, y: 2)
                }
            }
            .offset(y: max(0, dragOffset.height))
            .scaleEffect(dragScale)
            // A card has its own rounded black; behind a cover the black fades as it's dragged down.
            .background { if !isCard { Color.black.opacity(backdropOpacity).ignoresSafeArea() } }
            // Watching is always dark. A card is inside the tab, so only the card goes dark, not the app.
            .environment(\.colorScheme, .dark)
            .preferredColorScheme(isCard ? nil : .dark)
            .readsMomentsDuoScreen(Binding(get: { duo }, set: { if !isCard { ownScreen = $0 } }))
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
            // The pause button is the table's (board T1): lifted off the table, the Moment plays on.
            .onChange(of: duo.pose, initial: true) { _, pose in if pose != .table { session.paused = false } }
            .alert("Block \(model.ring?.author.shortName ?? "")?", isPresented: $showsBlock) {
                Button("Block", role: .destructive) { Task { await model.blockAuthor(onHide: onHideAuthor) } }
                    .accessibilityIdentifier("moments.blockConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You won't see each other's Moments or posts, and you can't message each other. They aren't told.")
            }
            // Closed, the iPhone Duo shows Seen by in its column (`MomentsColumnSheet`), and beside the card the map
            // shows it on the left (board O6); a fold to either takes this sheet down without closing Seen by.
            .sheet(isPresented: Binding(
                get: { session.showsSeenBy && showsSeenBySheet },
                set: { if $0 || showsSeenBySheet { session.showsSeenBy = $0 } }
            )) {
                MomentsSeenBySheet(model: model)
                    .presentationDetents([.fraction(0.56), .large])
                    .presentationDragIndicator(.visible)
                    .presentationBackground(Theme.Color.appSurface)
                    .environment(\.colorScheme, systemScheme)
                    .preferredColorScheme(systemScheme)
            }
            .momentsViewerProfile(session: session, systemScheme: systemScheme)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("moments.viewer")
    }

    /// The phone's viewer, or the Duo's for how it's held.
    @ViewBuilder
    private var layout: some View {
        if isCard {
            cardLayout
        } else {
            switch duo.pose {
            case .phone:
                ZStack(alignment: .bottom) {
                    // The person a sideways drag is bringing in, beside the one showing.
                    if let incoming {
                        GeometryReader { geo in peekStage(geo, incoming.peek) }
                            .ignoresSafeArea(.keyboard)
                            .modifier(MomentsPageTurn(position: incoming.position, width: pageWidth, flat: reduceMotion))
                    }
                    GeometryReader { geo in stage(geo) }
                        .ignoresSafeArea(.keyboard)
                        .modifier(MomentsPageTurn(position: pageOffset, width: pageWidth, flat: reduceMotion))
                    bottomColumn(floating: false, showsReact: true)
                }
            case .closed:
                closedLayout
            case .wide, .upright:
                framedLayout
            case .table:
                tableLayout
            }
        }
    }

    /// Seen by is the system's sheet: not closed (the column's sheet), not in the card or on a table (the list beside it).
    private var showsSeenBySheet: Bool {
        !seenByBeside && duo.pose != .closed
    }

    /// Paused by a menu, a sheet or a dialog over the viewer, or on a table by its pause button. Beside the card and on a
    /// table, Seen by covers nothing: your Moment keeps playing next to the list (board O6).
    private var covered: Bool {
        showsMenu || showsReport || showsBlock || session.profile != nil
            || (session.showsSeenBy && !seenByBeside) || (session.paused && duo.pose == .table)
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
                .scaleEffect(zoom, anchor: zoomAnchor)
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
                .overlay { if isReplying { Color.black.opacity(0.55) } }
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 180)
                        .allowsHitTesting(false)
                }
                .overlay(alignment: .bottom) {
                    // The caption gives way to a reply being written, and to a photo being pinched bigger.
                    if let caption = model.moment?.caption, !caption.isEmpty, model.moment?.kind != .text, !isReplying, !zooming {
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
                .simultaneousGesture(zoomGesture)
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
                    onPlace: placeAction,
                    onAuthor: authorAction,
                    onSound: { model.muted.toggle() },
                    onMore: { showsMenu = true },
                    onClose: { model.close() }
                )
                .padding(.top, 9)
                if let taken = model.metaTaken {
                    MomentsTakenPill(taken: taken)
                }
            }
            .opacity(model.holding || zooming ? 0 : 1)
            .animation(.easeOut(duration: 0.15), value: model.holding || zooming)
            // How high it was made, down the right edge (`MomentsViewerHeights.swift`): there with the header.
            if let rail = model.heightRail(you: ownHeight) {
                let top = geo.safeAreaInsets.top + Self.railTop
                MomentsViewerHeights(rail: rail, top: top, length: max(mediaHeight - Self.railBelow - top, 120))
                    .opacity(model.holding || zooming || isReplying ? 0 : 1)
            }
        }
        .ignoresSafeArea()
        .onChange(of: geo.safeAreaInsets.bottom, initial: true) { _, inset in homeInset = inset }
        .onChange(of: geo.size.width, initial: true) { _, width in pageWidth = width }
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
                // don't read through the reactions and the reply box. On a table nothing covers the card.
                MomentsTextCard(text: isReplying && duo.pose != .table ? "" : moment.text ?? "", background: moment.background)
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
    /// the picture 12 pt off its bottom (`floating`), and closed the reaction button is in the side strip. In the
    /// card beside the map it sits under the picture as on the phone, 12 pt off the card's bottom (`bottomInset`).
    func bottomColumn(floating: Bool, showsReact: Bool, bottomInset: CGFloat? = nil) -> some View {
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
                .padding(
                    .bottom,
                    bottomInset ?? (floating ? Spacing.s3 : replyFocused ? Spacing.s2 : max(14 - homeInset, -20))
                )
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
            // Beside the map, "Seen by" opens and closes the list on the left (board O6).
            MomentsSeenByBar(count: model.moment?.viewerCount, floating: floating) {
                if isCard { session.showsSeenBy.toggle() } else { session.showsSeenBy = true }
            }
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

    func send() {
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
    /// settles (closing or half folding the Duo drops it just before the screen is laid out again; lifting it off a
    /// table drops it just after). On the open Duo the card and the cover trade places: the screen that had the
    /// keyboard goes without saying it lost it, so the session still says the box has it.
    private func giveReplyFocusBack() {
        guard session.wantsReplyFocusBack || session.replyFocused else { return }
        for delay in [80, 250, 500, 1000] {
            Task {
                try? await Task.sleep(for: .milliseconds(delay))
                guard session.replyFocusDropped != nil || session.replyFocused, !replyFocused else { return }
                replyFocused = true
            }
        }
    }
}
