//
//  MomentsViewer+Duo.swift
//  Pantopus
//
//  Watching on the iPhone Duo (the founder's Duo boards, approved
//  2026-11-11). Closed (C3–C5): the picture fills the column beside the side
//  strip, which is a phone photo's shape, and Close, More and Sound move into
//  the strip under the clock, with the reaction button at its bottom. Open
//  upright (U2), and until their own layouts land open sideways and on a
//  table: the Moment shows whole in its tall shape over a blurred copy of
//  itself, the header below the clock corner.
//

import SwiftUI

extension MomentsViewer {
    /// The Moment's shape: 9 wide by 16 tall.
    static let tallShape: CGFloat = 9.0 / 16.0

    // MARK: - Closed

    /// Board C3: the column, rounded where it meets the strip, and the strip's buttons. Typing (C4), the column ends
    /// at the keyboard, which runs under the strip too.
    var closedLayout: some View {
        GeometryReader { geo in
            let column = CGSize(width: duo.column.width, height: geo.size.height)
            ZStack(alignment: .topLeading) {
                ZStack(alignment: .bottom) {
                    duoStage(size: column, barsTop: barsTop(from: 0, to: column.width), headerButtons: false)
                    bottomColumn(floating: true, showsReact: false)
                    if session.showsSeenBy {
                        // Board C5: the phone's sheet, kept in the column so Close stays in view in the strip.
                        MomentsColumnSheet(
                            systemScheme: systemScheme,
                            onClose: { session.showsSeenBy = false },
                            content: { MomentsSeenBySheet(model: model) { session.showsSeenBy = false } }
                        )
                    }
                }
                .frame(width: column.width, height: column.height)
                .clipShape(UnevenRoundedRectangle(bottomTrailingRadius: 24, topTrailingRadius: 24, style: .continuous))
                MomentsStripButtons(screen: duo, height: geo.size.height, top: stripButtons, bottom: stripReactButton)
            }
        }
        .ignoresSafeArea(.container)
    }

    /// Close, then More (someone else's Moment) and Sound (a video). While typing a reply only Close shows (C4).
    private var stripButtons: [MomentsStripButtons.Item] {
        let close = MomentsStripButtons.Item(id: "moments.viewer.close", icon: .x, label: "Close") { model.close() }
        guard !isReplying else { return [close] }
        var items = [close]
        if !model.isMine, model.ring?.author != nil {
            items.append(MomentsStripButtons.Item(id: "moments.viewer.more", icon: .moreHorizontal, label: "More") {
                showsMenu = true
            })
        }
        if model.moment?.kind == .video {
            let label = model.muted ? "Sound off. Turn on" : "Sound on. Mute"
            items.append(MomentsStripButtons.Item(id: "moments.viewer.sound", icon: model.muted ? .volumeX : .volume2, label: label) {
                model.muted.toggle()
            })
        }
        return items
    }

    /// The reaction button, at the strip's bottom: someone else's Moment, not while replying.
    private var stripReactButton: MomentsStripButtons.Item? {
        guard !isReplying, !model.isMine, model.ring?.author != nil else { return nil }
        let label = model.myReaction.map { "Your reaction \($0). Change" } ?? "React"
        return MomentsStripButtons.Item(id: "moments.viewer.react", icon: .smile, label: label, emoji: model.myReaction) {
            session.showsReactions = true
        }
    }

    // MARK: - Upright (and, for now, open sideways and on a table)

    /// Board U2: the Moment whole, as tall as the screen, over a blurred copy of itself. The picture never moves
    /// for the keyboard; the reply rides above it. Both layers are GeometryReaders, which take exactly the space
    /// they're offered: a fixed frame bigger than that (the screen, while the keyboard is up) would grow the viewer
    /// and feed a wrong screen back to the reader.
    var framedLayout: some View {
        ZStack {
            GeometryReader { geo in
                let size = geo.size
                let width = framedWidth(in: size)
                let left = ((size.width - width) / 2).rounded()
                ZStack(alignment: .topLeading) {
                    MomentsBlurredBackdrop(model: model)
                        .frame(width: size.width, height: size.height)
                    duoStage(
                        size: CGSize(width: width, height: size.height),
                        barsTop: barsTop(from: left, to: left + width),
                        headerButtons: true
                    )
                    .clipped()
                    .shadow(color: .black.opacity(0.5), radius: 30)
                    .offset(x: left)
                }
            }
            .ignoresSafeArea()
            GeometryReader { geo in
                bottomColumn(floating: true, showsReact: true)
                    .frame(width: framedWidth(in: duo.size), height: geo.size.height)
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            .ignoresSafeArea(.container)
        }
    }

    /// The Moment's tall frame on a screen this big: as tall as the screen, never wider than it.
    private func framedWidth(in size: CGSize) -> CGFloat {
        min(size.width, (size.height * Self.tallShape).rounded())
    }

    // MARK: - The Moment in a column or a frame

    /// Where the progress bars start: 12 pt from the top, below the top inset and below anything the system keeps over
    /// these columns of the screen (upright, the clock corner).
    private func barsTop(from minX: CGFloat, to maxX: CGFloat) -> CGFloat {
        max(12, duo.insets.top, duo.occludedBottom(from: minX, to: maxX))
    }

    /// The picture filling `size`, with the bars and the header over its top and the caption over its bottom. Closed
    /// the header's buttons are in the side strip. The caption sits above the reply box floating over the picture,
    /// or (the card beside the map, where the box is under the picture) 63 pt off the picture's bottom, as on the phone.
    func duoStage(size: CGSize, barsTop: CGFloat, headerButtons: Bool, captionBottom: CGFloat = 70) -> some View {
        ZStack(alignment: .top) {
            Color.black
            media
                .frame(width: size.width, height: size.height)
                .clipped()
                .overlay { if isReplying { Color.black.opacity(0.55) } }
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 170)
                        .allowsHitTesting(false)
                }
                .overlay(alignment: .bottom) {
                    if let caption = model.moment?.caption, !caption.isEmpty, model.moment?.kind != .text, !isReplying {
                        MomentsCaptionPill(caption: caption).padding(.bottom, captionBottom)
                    }
                }
                .overlay {
                    if let pop = model.reactionPop {
                        MomentsReactionPop(emoji: pop.emoji).id(pop.id)
                    }
                }
                .contentShape(Rectangle())
                .gesture(pressGesture(width: size.width))
                .accessibilityAction(named: "Next Moment") { model.next() }
                .accessibilityAction(named: "Previous Moment") { model.previous() }
                .accessibilityAction(named: "Next person") { model.nextRing() }
            VStack(spacing: 0) {
                MomentsProgressBars(count: model.ring?.moments.count ?? 1, current: model.momentIndex, progress: model.progress)
                    .padding(.horizontal, 10)
                    .padding(.top, barsTop)
                MomentsViewerHeader(
                    author: model.ring?.author,
                    isMine: model.isMine,
                    place: model.metaPlace,
                    times: model.metaTimes,
                    isVideo: model.moment?.kind == .video,
                    muted: model.muted,
                    compact: isReplying,
                    showsButtons: headerButtons,
                    onBack: isCard ? onBack : nil,
                    onSound: { model.muted.toggle() },
                    onMore: { showsMenu = true },
                    onClose: { model.close() }
                )
                .padding(.top, 9)
                if let taken = model.metaTaken {
                    MomentsTakenPill(taken: taken)
                }
            }
            .opacity(model.holding ? 0 : 1)
            .animation(.easeOut(duration: 0.15), value: model.holding)
        }
        .frame(width: size.width, height: size.height)
    }
}
