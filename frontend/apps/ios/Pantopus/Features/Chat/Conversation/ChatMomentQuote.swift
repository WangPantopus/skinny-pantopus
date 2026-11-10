//
//  ChatMomentQuote.swift
//  Pantopus
//
//  A reply to a Moment lands in Messages with the Moment above it (Moments
//  contract "Chat"): "Replied to your Moment" for the person who posted it,
//  "Replied to their Moment" for the one who replied, and once it has ended
//  "Moment ended" with no picture. The picture is a small signed link; a
//  thread read back from the phone's cache shows the Moment's kind instead.
//

import SwiftUI

/// The quote's words and picture.
public struct ChatMomentQuote: Sendable, Hashable {
    public let momentId: String
    public let label: String
    public let thumbURL: URL?
    public let kind: String
    public let ended: Bool

    init?(_ moment: ChatMomentRefDTO?, side: ChatMessageSide) {
        guard let moment else { return nil }
        momentId = moment.id
        label = moment.ended ? "Moment ended" : (side == .outgoing ? "Replied to their Moment" : "Replied to your Moment")
        thumbURL = moment.thumbnail
        kind = moment.kind
        ended = moment.ended
    }
}

/// The quote above the message's bubble, on the bubble's side.
struct ChatMomentQuoteView: View {
    let quote: ChatMomentQuote
    let side: ChatMessageSide
    @State private var watching: MomentsWatchRequest?
    @State private var opening = false
    @State private var note: String?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: open) {
            VStack(alignment: side == .outgoing ? .trailing : .leading, spacing: Spacing.s1) {
                Text(quote.label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(quote.ended ? Theme.Color.appTextMuted : Theme.Color.appTextSecondary)
                if !quote.ended {
                    ChatMomentThumbnail(url: quote.thumbURL, kind: quote.kind, width: 54, height: 72)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // "Moment ended" opens nothing.
        .disabled(quote.ended || opening)
        .fullScreenCover(item: $watching) { request in
            MomentsViewer(
                request: request,
                systemScheme: colorScheme,
                onWatched: { _ in },
                onHideAuthor: { _ in },
                onShowAuthor: { _ in },
                onClose: { watching = nil }
            )
        }
        .alert(note ?? "", isPresented: Binding(get: { note != nil }, set: { if !$0 { note = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(quote.label)
        .accessibilityHint(quote.ended ? "" : "Opens the Moment")
        .accessibilityAddTraits(quote.ended ? [] : .isButton)
        .accessibilityIdentifier("chat.momentQuote")
    }

    /// Opens the viewer on that one Moment (on your own, with Seen by).
    private func open() {
        guard !quote.ended, !opening else { return }
        opening = true
        Task {
            defer { opening = false }
            do {
                let moment = try await MomentsAPI.send(MomentsEndpoints.moment(id: quote.momentId), as: MomentEnvelope.self).moment
                var me: String?
                if case let .signedIn(user) = AuthManager.shared.state { me = user.id }
                let ring = MomentRingDTO(moment: moment, mine: moment.author.id == me)
                watching = MomentsWatchRequest(rings: [ring], start: 0, newOnly: false)
            } catch {
                note = (error as? MomentsFailure)?.message ?? "This Moment isn't available."
            }
        }
    }
}

/// A Moment's small picture: its photo or video poster, else a mark for its kind.
struct ChatMomentThumbnail: View {
    let url: URL?
    let kind: String
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: width < 48 ? 8 : 10, style: .continuous)
            .fill(placeholderFill)
            .overlay {
                Icon(icon, size: width * 0.36, color: kind == "text" ? .white : Theme.Color.appTextMuted)
            }
            .overlay {
                if let url {
                    CachedAsyncImage(url: url, keepsOnDisk: false) { phase in
                        if case let .success(image) = phase {
                            image.resizable().scaledToFill()
                        } else {
                            // Something to hold the loader: with nothing drawn here it never starts.
                            Color.clear
                        }
                    }
                }
            }
            .frame(width: width, height: height)
            .clipShape(RoundedRectangle(cornerRadius: width < 48 ? 8 : 10, style: .continuous))
            .accessibilityHidden(true)
    }

    private var placeholderFill: AnyShapeStyle {
        if kind == "text" {
            let colors = MomentsPalette.card(nil)
            return AnyShapeStyle(LinearGradient(colors: [colors.top, colors.bottom], startPoint: .top, endPoint: .bottom))
        }
        return AnyShapeStyle(Theme.Color.appSurfaceSunken)
    }

    private var icon: PantopusIcon {
        switch kind {
        case "video": .video
        case "text": .textCursorInput
        default: .image
        }
    }
}
