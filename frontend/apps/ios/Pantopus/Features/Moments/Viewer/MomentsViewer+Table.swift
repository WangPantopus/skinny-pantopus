//
//  MomentsViewer+Table.swift
//  Pantopus
//
//  Watching on the iPhone Duo half folded on a table (the founder's Duo
//  boards T1 and T2, approved 2026-11-11). The top half stands up and shows
//  the Moment whole over a blurred copy of itself, with the bars and the
//  caption; what you touch is on the flat half: who it is, big previous,
//  pause and next (pause stays until it's tapped again: nobody holds a phone
//  that stands on a table), who is up next, and the reply box. On your own
//  Moment, Seen by opens on the flat half while the Moment plays on.
//
//  Typing, the system's keyboard fills the whole flat half (measured on the
//  Duo simulator: the app keeps only the standing half). So the reactions,
//  the note and the reply box move onto the standing half, under the
//  Moment, which gets smaller and stays whole: typing never covers it.
//

import SwiftUI

extension MomentsViewer {
    /// Seen by is a list beside your Moment, which keeps playing: on the open Duo's left half (board O6), or on a table
    /// on the flat half.
    var seenByBeside: Bool {
        isCard || duo.pose == .table
    }

    /// Boards T1 and T2, from the screen's top-left corner. The root takes the room above the keyboard: the whole screen,
    /// or while typing only the standing half.
    var tableLayout: some View {
        GeometryReader { geo in
            let fold = tableFold
            let typing = replyFocused
            let room = min(geo.size.height, fold.minY)
            let picture = tablePictureFrame(fold: fold, typing: typing, room: room)
            ZStack(alignment: .topLeading) {
                Color(white: 0.05)
                Color.black
                    .frame(width: duo.size.width, height: fold.maxY)
                MomentsBlurredBackdrop(model: model)
                    .frame(width: duo.size.width, height: fold.minY)
                // The bars 10 pt down, below anything the system keeps over the picture's columns (not drawn: none does).
                tableStage(size: picture.size, barsTop: max(10, duo.occludedBottom(from: picture.minX, to: picture.maxX)))
                    .offset(x: picture.minX, y: picture.minY)
                if typing {
                    // A tap above the keyboard puts it away and leaves the Moment where it is.
                    Color.black.opacity(0.001)
                        .frame(width: duo.size.width, height: room)
                        .onTapGesture { closeReply() }
                        .accessibilityHidden(true)
                }
                if !typing {
                    tableFlatHalf(fold: fold, height: geo.size.height)
                }
                if isReplying {
                    tableReactions
                        .offset(y: typing ? picture.maxY + 12 : fold.maxY + 100)
                }
                if typing, let name = model.ring?.author.shortName {
                    Text("\(name) gets your reply in Messages.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Color.white.opacity(0.8))
                        .frame(width: duo.size.width)
                        .offset(y: room - 12 - 48 - 15 - 15)
                        .accessibilityIdentifier("moments.viewer.replyHint")
                }
                // One reply box, on the flat half or (typing) right above the keyboard: it keeps the keyboard as it moves.
                tableBottomBar
                    .padding(.horizontal, Spacing.s5)
                    .frame(width: duo.size.width, height: 48)
                    .offset(y: typing ? room - 12 - 48 : geo.size.height - 23 - 48)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
        .ignoresSafeArea(.container)
    }

    /// The fold across the screen; where it would be if the system didn't say.
    private var tableFold: CGRect {
        duo.fold ?? CGRect(x: 0, y: ((duo.size.height - 40) / 2).rounded(), width: duo.size.width, height: 40)
    }

    /// The Moment in its tall shape, in the middle: as tall as the standing half, or typing, as tall as the room above the
    /// reactions, the note and the reply box (78 + 14 + 15 + 15 + 48, and 12 above and below them).
    private func tablePictureFrame(fold: CGRect, typing: Bool, room: CGFloat) -> CGRect {
        let height = typing ? max(room - 12 - 170 - 12, 120) : fold.minY
        let width = min(duo.size.width, (height * Self.tallShape).rounded())
        return CGRect(x: ((duo.size.width - width) / 2).rounded(), y: 0, width: width, height: height)
    }

    // MARK: - The standing half

    /// The picture whole, the bars over its top and the caption over its bottom (board T1). The same gesture as
    /// everywhere: tap on or back, hold to pause, swipe to change person or close.
    private func tableStage(size: CGSize, barsTop: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.black
            media
                .frame(width: size.width, height: size.height)
                .clipped()
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.black.opacity(0.45), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 80)
                        .allowsHitTesting(false)
                }
                .overlay(alignment: .bottom) {
                    // Typing, the picture is small: the caption waits, as on the phone.
                    if let caption = model.moment?.caption, !caption.isEmpty, model.moment?.kind != .text, !replyFocused {
                        MomentsTableCaption(caption: caption).padding(.bottom, 25)
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
            MomentsProgressBars(count: model.ring?.moments.count ?? 1, current: model.momentIndex, progress: model.progress)
                .padding(.horizontal, 10)
                .padding(.top, barsTop)
                .opacity(model.holding ? 0 : 1)
                .animation(.easeOut(duration: 0.15), value: model.holding)
        }
        .frame(width: size.width, height: size.height)
        .shadow(color: .black.opacity(0.55), radius: 30)
    }

    // MARK: - The flat half

    /// Board T1's flat half: who it is, previous / pause / next, Up next, a note; the reply box is placed by the layout.
    /// Your own Moment's Seen by takes the place of the buttons and Up next; the reactions take the buttons' place.
    private func tableFlatHalf(fold: CGRect, height: CGFloat) -> some View {
        VStack(spacing: Spacing.s0) {
            tableHeader
                .padding(.horizontal, Spacing.s5)
                .padding(.top, 16.5)
            if session.showsSeenBy, model.isMine {
                MomentsSeenBySheet(model: model, topPadding: 18) { session.showsSeenBy = false }
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl3, style: .continuous))
                    .environment(\.colorScheme, systemScheme)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, 23 + 48 + 12)
                    .transition(.opacity)
            } else {
                tableButtons
                    .frame(height: 80)
                    .padding(.top, 36)
                    .opacity(session.showsReactions ? 0 : 1)
                    .allowsHitTesting(!session.showsReactions)
                    .accessibilityHidden(session.showsReactions)
                tableUpNext
                    .padding(.top, 30)
                Spacer(minLength: 0)
                if let toast = model.toast {
                    MomentsToastView(toast: toast) { model.runToastAction() }
                        .padding(.bottom, Spacing.s3)
                        .transition(.opacity)
                }
                Color.clear.frame(height: 23 + 48)
            }
        }
        .frame(width: duo.size.width, height: max(height - fold.maxY, 0), alignment: .top)
        .background {
            // A tap outside the reactions (not typing) closes them.
            if session.showsReactions {
                Color.black.opacity(0.001).onTapGesture { closeReply() }
            }
        }
        .offset(y: fold.maxY)
        .animation(.easeOut(duration: 0.2), value: model.toast)
    }

    /// Face, name and check, "place · 2h ago · 22h left", and the round buttons: sound (a video), More, Close.
    private var tableHeader: some View {
        let author = model.ring?.author
        return HStack(spacing: Spacing.s3) {
            Group {
                if let author {
                    MomentAvatar(author: author, size: 44)
                } else if model.isMine {
                    MomentSelfFace(author: nil, size: 44)
                }
            }
            .environment(\.colorScheme, .light)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(model.isMine ? "Your Moment" : author?.name ?? "")
                        .font(.system(size: 17, weight: .semibold))
                        .lineLimit(1)
                    if author?.verified == true, !model.isMine {
                        MomentVerifiedCheck(size: 15, border: 0)
                            .accessibilityLabel("Verified resident")
                            .accessibilityHidden(false)
                    }
                }
                HStack(spacing: Spacing.s0) {
                    Text(model.metaPlace)
                        .lineLimit(1)
                    Text(model.metaPlace.isEmpty || model.metaTimes.isEmpty ? model.metaTimes : " · \(model.metaTimes)")
                        .lineLimit(1)
                        .fixedSize()
                        .layoutPriority(1)
                }
                .font(.system(size: 13.5))
                .foregroundStyle(Color.white.opacity(0.8))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel([model.metaPlace, model.metaTimes].filter { !$0.isEmpty }.joined(separator: " · "))
                .accessibilityIdentifier("moments.viewer.meta")
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("moments.viewer.author")
            if model.moment?.kind == .video {
                let label = model.muted ? "Sound off. Turn on" : "Sound on. Mute"
                tableRoundButton(model.muted ? .volumeX : .volume2, size: 44, label: label, id: "moments.viewer.sound") {
                    model.muted.toggle()
                }
            }
            if !model.isMine, author != nil {
                tableRoundButton(.moreHorizontal, size: 44, label: "More", id: "moments.viewer.more") { showsMenu = true }
            }
            tableRoundButton(.x, size: 44, label: "Close", id: "moments.viewer.close") { model.close() }
        }
        .frame(height: 48)
    }

    /// Big previous, pause and next (board T1). Pause stays until it's tapped again.
    private var tableButtons: some View {
        HStack(spacing: Spacing.s10) {
            tableRoundButton(.skipBack, size: 60, iconSize: 26, label: "Previous Moment", id: "moments.viewer.previous") {
                model.previous()
            }
            Button { session.paused.toggle() } label: {
                Icon(session.paused ? .play : .pause, size: 30, color: Color(white: 0.09))
                    .frame(width: 80, height: 80)
                    .background(Circle().fill(Color.white))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(session.paused ? "Play" : "Pause")
            .accessibilityIdentifier("moments.viewer.pause")
            tableRoundButton(.skipForward, size: 60, iconSize: 26, label: "Next Moment", id: "moments.viewer.next") {
                model.next()
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Who plays after this person: their faces in their rings, a tap plays them.
    @ViewBuilder
    private var tableUpNext: some View {
        let next = Array(model.upNext.enumerated())
        if !next.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Up next")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.7))
                    .padding(.leading, Spacing.s5)
                    .accessibilityAddTraits(.isHeader)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(next, id: \.element.id) { offset, ring in
                            Button { model.playRing(at: model.ringIndex + 1 + offset) } label: {
                                VStack(spacing: 5) {
                                    MomentRingFace(ring: ring)
                                    Text(ring.mine ? "You" : ring.author.shortName)
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                        .frame(maxWidth: 70)
                                }
                                .frame(width: 72)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(ring.mine ? "Your Moments" : ring.author.name)
                            .accessibilityIdentifier("moments.viewer.upNext.\(ring.id)")
                        }
                    }
                    .padding(.horizontal, Spacing.s3)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Up next")
            .accessibilityIdentifier("moments.viewer.upNext")
        }
    }

    /// The quick reactions: typing, on the standing half under the Moment (board T2); after React, in the buttons' place.
    private var tableReactions: some View {
        MomentsQuickReactions(chosen: model.myReaction) { emoji in
            Task { await model.react(emoji) }
            closeReply()
        }
        // A tap on a reaction while typing must reach it: the keyboard stays up until it has.
        .keepsKeyboardOnTap()
        .frame(width: min(445, duo.size.width))
        .frame(width: duo.size.width)
    }

    /// The reply box and the reaction button, or Send while typing (boards T1, T2); your own Moment's "Seen by", which
    /// opens and closes the list on the flat half.
    @ViewBuilder
    private var tableBottomBar: some View {
        if model.isMine {
            MomentsSeenByBar(count: model.moment?.viewerCount) {
                withAnimation(.easeOut(duration: 0.2)) { session.showsSeenBy.toggle() }
            }
        } else if let author = model.ring?.author {
            MomentsTableReplyBar(
                firstName: author.shortName,
                text: $session.replyText,
                focus: $replyFocused,
                isTyping: replyFocused,
                reaction: model.myReaction,
                canReply: author.kind != .pantopus,
                onReact: { session.showsReactions = true },
                onSend: send
            )
            // Send is a composer's button: tapping it sends, it doesn't just close the keyboard.
            .keepsKeyboardOnTap()
        }
    }

    /// A round button on a faint white fill.
    private func tableRoundButton(
        _ icon: PantopusIcon,
        size: CGFloat,
        iconSize: CGFloat = 22,
        label: String,
        id: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: iconSize, strokeWidth: icon == .x ? 2.2 : 2, color: .white)
                .frame(width: size, height: size)
                .background(Circle().fill(Color.white.opacity(0.12)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}

/// The caption over the picture on a table (board T1): smaller than the phone's, for the smaller picture.
struct MomentsTableCaption: View {
    let caption: String

    var body: some View {
        Text(caption)
            .font(.system(size: 14, weight: .medium))
            .lineSpacing(2)
            .lineLimit(3)
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .padding(.vertical, 7)
            .padding(.horizontal, Spacing.s3)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Color.black.opacity(0.5)))
            .padding(.horizontal, 10)
            .accessibilityIdentifier("moments.viewer.caption")
    }
}

/// The reply box on a table (boards T1, T2): 48 tall, with the reaction button on a faint fill, or Send while typing.
struct MomentsTableReplyBar: View {
    let firstName: String
    @Binding var text: String
    let focus: FocusState<Bool>.Binding
    let isTyping: Bool
    let reaction: String?
    let canReply: Bool
    let onReact: () -> Void
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: isTyping ? 10 : Spacing.s3) {
            if canReply {
                TextField("", text: $text, prompt: Text("Reply to \(firstName)").foregroundColor(Color.white.opacity(0.75)))
                    .font(Theme.Font.role(.body))
                    .foregroundStyle(.white)
                    .tint(Theme.Color.primary400)
                    .focused(focus)
                    .submitLabel(.send)
                    .onSubmit(onSend)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 48)
                    .typesInFieldOnTap(focus)
                    .overlay(Capsule().stroke(Color.white.opacity(isTyping ? 0.6 : 0.45), lineWidth: 1))
                    .accessibilityLabel("Reply to \(firstName)")
                    .accessibilityIdentifier("moments.viewer.reply")
            } else {
                Spacer(minLength: 0)
            }
            if isTyping {
                Button(action: onSend) {
                    Icon(.send, size: 22, strokeWidth: 2.4, color: .white)
                        .frame(width: 48, height: 48)
                        .background(Circle().fill(Theme.Color.primarySolid))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityLabel("Send")
                .accessibilityIdentifier("moments.viewer.send")
            } else {
                Button(action: onReact) {
                    Group {
                        if let reaction {
                            Text(reaction).font(.system(size: 26))
                        } else {
                            Icon(.smile, size: 26, strokeWidth: 1.75, color: .white)
                        }
                    }
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Color.white.opacity(0.12)))
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reaction.map { "Your reaction \($0). Change" } ?? "React")
                .accessibilityIdentifier("moments.viewer.react")
            }
        }
        .frame(height: 48)
    }
}
