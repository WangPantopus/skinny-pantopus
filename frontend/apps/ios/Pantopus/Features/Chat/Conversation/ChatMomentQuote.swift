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
    /// A text card's color name and its first words, while it runs and the server sends them.
    public let background: String?
    public let excerpt: String?

    init?(_ moment: ChatMomentRefDTO?, side: ChatMessageSide) {
        guard let moment else { return nil }
        momentId = moment.id
        label = moment.ended ? "Moment ended" : (side == .outgoing ? "Replied to their Moment" : "Replied to your Moment")
        thumbURL = moment.thumbnail
        kind = moment.kind
        ended = moment.ended
        background = moment.ended ? nil : moment.background
        let words = moment.ended ? nil : moment.excerpt?.trimmingCharacters(in: .whitespacesAndNewlines)
        excerpt = words?.isEmpty == false ? words : nil
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
                    if quote.kind == "text", let excerpt = quote.excerpt {
                        ChatMomentCardQuote(excerpt: excerpt, background: quote.background, side: side)
                    } else {
                        ChatMomentThumbnail(url: quote.thumbURL, kind: quote.kind, background: quote.background, width: 54, height: 72)
                    }
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
                onClose: {
                    watching = nil
                    // What was watched here is no longer new on the Moments tab.
                    Task { await MomentsTabDot.shared.reread() }
                }
            )
        }
        .alert(note ?? "", isPresented: Binding(get: { note != nil }, set: { if !$0 { note = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(quote.excerpt.map { "\(quote.label): \($0)" } ?? quote.label)
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

/// A text card in a quote: its own color with its first words, two lines at most. As wide as its words,
/// up to 200 points, on the bubble's side.
struct ChatMomentCardQuote: View {
    let excerpt: String
    let background: String?
    let side: ChatMessageSide

    var body: some View {
        let colors = MomentsPalette.card(background)
        Text(excerpt)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(2)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(LinearGradient(colors: [colors.top, colors.bottom], startPoint: .top, endPoint: .bottom))
            )
            .frame(maxWidth: 200, alignment: side == .outgoing ? .trailing : .leading)
            .accessibilityHidden(true)
    }
}

/// A Moment's small picture: its photo or video poster, else a mark for its kind (a text card in its color).
struct ChatMomentThumbnail: View {
    let url: URL?
    let kind: String
    /// A text card's color name; the teal card when the server doesn't say.
    var background: String?
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
            let colors = MomentsPalette.card(background)
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
