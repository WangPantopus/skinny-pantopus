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
    public let label: String
    public let thumbURL: URL?
    public let kind: String
    public let ended: Bool

    init?(_ moment: ChatMomentRefDTO?, side: ChatMessageSide) {
        guard let moment else { return nil }
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

    var body: some View {
        VStack(alignment: side == .outgoing ? .trailing : .leading, spacing: Spacing.s1) {
            Text(quote.label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(quote.ended ? Theme.Color.appTextMuted : Theme.Color.appTextSecondary)
            if !quote.ended {
                ChatMomentThumbnail(url: quote.thumbURL, kind: quote.kind, width: 54, height: 72)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(quote.label)
        .accessibilityIdentifier("chat.momentQuote")
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
