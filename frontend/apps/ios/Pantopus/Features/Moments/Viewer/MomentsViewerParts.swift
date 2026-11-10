//
//  MomentsViewerParts.swift
//  Pantopus
//
//  The pieces of watching (boards V1–V5): one progress bar per Moment in
//  the ring, the header (face, name, check, "place · 2h ago · 4h left",
//  sound, …, close), the caption, the reply box with the reaction button,
//  your own Moment's "Seen by", the quick reactions, and the short notes
//  that confirm what happened.
//

import SwiftUI

/// One bar per Moment in the ring: watched full, the one playing filling, the rest empty.
struct MomentsProgressBars: View {
    let count: Int
    let current: Int
    let progress: Double

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(0..<max(count, 1), id: \.self) { index in
                GeometryReader { geo in
                    Capsule()
                        .fill(Color.white.opacity(0.35))
                        .overlay(alignment: .leading) {
                            Capsule()
                                .fill(Color.white)
                                .frame(width: geo.size.width * fill(at: index))
                        }
                }
                .frame(height: 3)
                .accessibilityIdentifier("moments.viewer.bar.\(index)")
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Moment \(current + 1) of \(max(count, 1))")
    }

    private func fill(at index: Int) -> Double {
        if index < current { return 1 }
        if index > current { return 0 }
        return min(max(progress, 0), 1)
    }
}

/// The header: face, name and check, the place and times, and the buttons.
struct MomentsViewerHeader: View {
    let author: MomentAuthorDTO?
    let isMine: Bool
    /// "Vancouver Community Library" and "2h ago · 22h left": the place is cut short before the times are.
    let place: String
    let times: String
    let isVideo: Bool
    let muted: Bool
    /// While typing a reply only close shows (board V4).
    let compact: Bool
    let onSound: () -> Void
    let onMore: () -> Void
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Group {
                // Your own face is the one your ring shows on the map: your picture, else your initials.
                if let author {
                    MomentAvatar(author: author, size: 36)
                } else if isMine {
                    MomentSelfFace(author: author, size: 36)
                }
            }
            // Light fill and dark initials with a white edge, as the boards draw it over a dark picture.
            .environment(\.colorScheme, .light)
            .overlay { if isMine || author != nil { Circle().stroke(Color.white, lineWidth: 1.5) } }
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(isMine ? "Your Moment" : author?.name ?? "")
                        .font(.system(size: 15, weight: .semibold))
                        .lineLimit(1)
                    if author?.verified == true, !isMine {
                        MomentVerifiedCheck(size: 14, border: 0)
                            .accessibilityLabel("Verified resident")
                            .accessibilityHidden(false)
                    }
                }
                HStack(spacing: 0) {
                    Text(place)
                        .lineLimit(1)
                    Text(place.isEmpty || times.isEmpty ? times : " · \(times)")
                        .lineLimit(1)
                        .fixedSize()
                        .layoutPriority(1)
                }
                .font(.system(size: 12.5))
                .foregroundStyle(Color.white.opacity(0.88))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel([place, times].filter { !$0.isEmpty }.joined(separator: " · "))
                .accessibilityIdentifier("moments.viewer.meta")
            }
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.4), radius: 1, x: 0, y: 1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("moments.viewer.author")
            if !compact {
                if isVideo {
                    headerButton(
                        muted ? .volumeX : .volume2,
                        width: 40,
                        label: muted ? "Sound off. Turn on" : "Sound on. Mute",
                        id: "moments.viewer.sound",
                        action: onSound
                    )
                }
                if !isMine, author != nil {
                    headerButton(
                        .moreHorizontal,
                        width: isVideo ? 40 : 44,
                        label: "More",
                        id: "moments.viewer.more",
                        action: onMore
                    )
                }
            }
            headerButton(.x, width: isVideo && !compact ? 40 : 44, label: "Close", id: "moments.viewer.close", action: onClose)
        }
        .padding(.leading, Spacing.s3)
        .padding(.trailing, Spacing.s1)
        .frame(height: 48)
    }

    /// A white header button: close at 24 pt, the others at 22 (board V1).
    private func headerButton(
        _ icon: PantopusIcon, width: CGFloat, label: String, id: String, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: icon == .x ? 24 : 22, color: .white)
                .frame(width: width, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}

/// The caption line over a photo or video.
struct MomentsCaptionPill: View {
    let caption: String

    var body: some View {
        Text(caption)
            .font(.system(size: 16, weight: .medium))
            .lineSpacing(3)
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .padding(.vertical, Spacing.s2)
            .padding(.horizontal, 14)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.black.opacity(0.48)))
            .padding(.horizontal, Spacing.s10)
            .accessibilityIdentifier("moments.viewer.caption")
    }
}

/// The reply box and the reaction button (V1); while typing, Send (V4).
struct MomentsReplyBar: View {
    let firstName: String
    @Binding var text: String
    let focus: FocusState<Bool>.Binding
    let isTyping: Bool
    let reaction: String?
    let canReply: Bool
    let onReact: () -> Void
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: isTyping ? Spacing.s2 : 10) {
            if canReply {
                TextField("", text: $text, prompt: Text("Reply to \(firstName)").foregroundColor(Color.white.opacity(0.75)))
                    .font(.system(size: 15))
                    .foregroundStyle(.white)
                    .tint(Theme.Color.primary400)
                    .focused(focus)
                    .submitLabel(.send)
                    .onSubmit(onSend)
                    .padding(.horizontal, isTyping ? Spacing.s4 : 18)
                    .frame(height: 44)
                    .typesInFieldOnTap(focus)
                    .background(Capsule().fill(Color.black.opacity(isTyping ? 0.25 : 0)))
                    .overlay(Capsule().stroke(Color.white.opacity(isTyping ? 0.6 : 0.45), lineWidth: 1))
                    .accessibilityLabel("Reply to \(firstName)")
                    .accessibilityIdentifier("moments.viewer.reply")
            } else {
                Spacer(minLength: 0)
            }
            if isTyping {
                Button(action: onSend) {
                    Icon(.send, size: 20, strokeWidth: 2.4, color: .white)
                        .frame(width: 44, height: 44)
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
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reaction.map { "Your reaction \($0). Change" } ?? "React")
                .accessibilityIdentifier("moments.viewer.react")
            }
        }
        .frame(height: 44)
    }
}

/// Your own Moment: "Seen by 12" (or "No views yet") where others have the reply box.
struct MomentsSeenByBar: View {
    let count: Int?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.eye, size: 20, color: .white)
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
                Icon(.chevronUp, size: 16, color: Color.white.opacity(0.8))
            }
            .padding(.horizontal, 18)
            .frame(height: 44)
            .overlay(Capsule().stroke(Color.white.opacity(0.45), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint("Shows who watched")
        .accessibilityIdentifier("moments.viewer.seenBy")
    }

    private var label: String {
        guard let count else { return "Seen by" }
        return count == 0 ? "No views yet" : "Seen by \(count)"
    }
}

/// Board V4's quick reactions: the seven emoji, and while typing who gets the reply.
struct MomentsQuickReactions: View {
    let chosen: String?
    let onPick: (PostReactionEmoji) -> Void

    var body: some View {
        VStack(spacing: 10) {
            Text("Quick reactions")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.75))
            HStack(spacing: 0) {
                ForEach(PostReactionEmoji.allCases) { emoji in
                    Button { onPick(emoji) } label: {
                        Text(emoji.rawValue)
                            .font(.system(size: 34))
                            .frame(width: 46, height: 52)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(Color.white.opacity(isChosen(emoji) ? 0.22 : 0))
                            )
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(emoji.name)
                    .accessibilityAddTraits(isChosen(emoji) ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("moments.viewer.reaction.\(emoji.id)")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Quick reactions")
            .accessibilityIdentifier("moments.viewer.reactions")
        }
    }

    private func isChosen(_ emoji: PostReactionEmoji) -> Bool {
        chosen.flatMap(PostReactionEmoji.init(wire:)) == emoji
    }
}

/// A short note over the viewer ("Saved to Photos"), with an optional action.
struct MomentsToastView: View {
    let toast: MomentsViewerModel.Toast
    let onAction: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(toast.text)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
            if let action = toast.action {
                Button(action, action: onAction)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary300)
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("moments.viewer.toastAction")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color.black.opacity(0.72)))
        // Undo stays a button of its own under the note.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.viewer.toast")
    }
}

/// The quick reaction just chosen, popping over the Moment: it grows, settles, drifts up and fades in about half a second.
struct MomentsReactionPop: View {
    let emoji: String
    @State private var scale: CGFloat = 0.6
    @State private var lift: CGFloat = 0
    @State private var opacity: Double = 1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(emoji)
            .font(.system(size: 96))
            .scaleEffect(scale)
            .offset(y: lift)
            .opacity(opacity)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear {
                guard !reduceMotion else {
                    scale = 1
                    withAnimation(.easeOut(duration: 0.3).delay(0.4)) { opacity = 0 }
                    return
                }
                withAnimation(.spring(response: 0.22, dampingFraction: 0.5)) { scale = 1.2 }
                withAnimation(.easeOut(duration: 0.18).delay(0.2)) { scale = 1 }
                withAnimation(.easeIn(duration: 0.3).delay(0.3)) {
                    lift = -70
                    opacity = 0
                }
            }
    }
}
