//
//  MomentPinPreview.swift
//  Pantopus
//
//  A pin on the Moments map shows a small look at the person's newest Moment
//  inside its ring (founder, 2026-11-11: "Yes, add previews"): the photo's or
//  video's thumbnail, or a text card's colours, with the person's face as a
//  small badge at the bottom left so they stay recognisable. With no preview
//  (an older server, a ring with no location, a picture that didn't load) the
//  pin is the face pin it always was: never a blank, never a spinner. The
//  ring keeps its meaning (sky to green while new, grey once watched), and
//  crowded spots and the row of faces keep faces.
//
//  Seeing a preview is not watching the Moment: no view is recorded for it.
//  The pictures are tiny, held in memory only and never on disk, as the
//  viewer's are, and each is loaded once however often the map is read.
//

import SwiftUI
import UIKit

/// The pins' small pictures, by Moment: in memory only, each loaded once.
@MainActor
final class MomentPinPictures {
    static let shared = MomentPinPictures()

    /// The map shows at most a few hundred rings; older pictures go first.
    private static let limit = 300
    /// A picture that didn't load isn't asked for again this soon (the next map read carries a fresh link).
    private static let retryAfter: TimeInterval = 60

    private let session = URLSession(configuration: .ephemeral)
    private var images: [String: UIImage] = [:]
    private var order: [String] = []
    private var loading: [String: Task<UIImage?, Never>] = [:]
    private var failedAt: [String: Date] = [:]

    private init() {}

    func held(_ momentId: String) -> UIImage? {
        images[momentId]
    }

    /// The preview's picture, from memory or its link; nil for a text card or when it can't be loaded.
    func picture(for preview: MomentRingPreviewDTO) async -> UIImage? {
        let id = preview.momentId
        if let image = images[id] { return image }
        guard let url = preview.thumbURL else { return nil }
        if let failed = failedAt[id], Date().timeIntervalSince(failed) < Self.retryAfter { return nil }
        if let running = loading[id] { return await running.value }
        let task = Task { [session] () -> UIImage? in
            guard let (data, response) = try? await session.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode ?? 200 < 400 else { return nil }
            return UIImage(data: data)
        }
        loading[id] = task
        let image = await task.value
        loading[id] = nil
        if let image {
            hold(image, as: id)
        } else {
            failedAt[id] = Date()
        }
        return image
    }

    /// Signed out: the next person on this phone starts with none.
    func reset() {
        for task in loading.values {
            task.cancel()
        }
        loading = [:]
        images = [:]
        order = []
        failedAt = [:]
    }

    private func hold(_ image: UIImage, as id: String) {
        images[id] = image
        order.append(id)
        while order.count > Self.limit {
            images.removeValue(forKey: order.removeFirst())
        }
    }
}

/// What fills a pin's ring, in the pin's own 64 pt box: the preview with the face as a badge, or the face.
struct MomentPinInside: View {
    let ring: MomentRingDTO
    /// The picture loaded for the preview showing, and which Moment it is of.
    @State private var loaded: LoadedPicture?

    private struct LoadedPicture {
        let momentId: String
        let image: UIImage
    }

    /// The face or the preview, inside the ring.
    private static let size: CGFloat = 50
    private static let badgeSize: CGFloat = 22

    var body: some View {
        inside
            .frame(width: 64, height: 64, alignment: .topLeading)
            .accessibilityHidden(true)
            .task(id: shown?.momentId) { await load() }
    }

    /// The preview there is something to draw for, if any.
    private var shown: MomentRingPreviewDTO? {
        guard let preview = ring.preview, preview.canShow else { return nil }
        return preview
    }

    /// The preview's picture once it is in memory: loaded here, or by another pin of the same Moment before.
    private var picture: UIImage? {
        guard let shown, shown.kind != .text else { return nil }
        if let loaded, loaded.momentId == shown.momentId { return loaded.image }
        return MomentPinPictures.shared.held(shown.momentId)
    }

    private func load() async {
        guard let shown, shown.kind != .text else { return }
        guard let image = await MomentPinPictures.shared.picture(for: shown) else { return }
        loaded = LoadedPicture(momentId: shown.momentId, image: image)
    }

    @ViewBuilder
    private var inside: some View {
        if let shown, shown.kind == .text {
            ZStack(alignment: .topLeading) {
                card(shown.background).offset(x: 7, y: 7)
                badge
            }
        } else if let picture {
            ZStack(alignment: .topLeading) {
                thumbnail(picture).offset(x: 7, y: 7)
                badge
            }
        } else {
            MomentAvatar(author: ring.author, size: Self.size).offset(x: 7, y: 7)
        }
    }

    private func thumbnail(_ image: UIImage) -> some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .frame(width: Self.size, height: Self.size)
            .clipShape(Circle())
    }

    /// A text card in small: its two colours, and "Aa" for the words on it.
    private func card(_ background: String?) -> some View {
        let colors = MomentsPalette.card(background)
        let gradient = LinearGradient(colors: [colors.top, colors.bottom], startPoint: .top, endPoint: .bottom)
        return Circle()
            .fill(gradient)
            .frame(width: Self.size, height: Self.size)
            .overlay {
                Text("Aa")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.92))
            }
    }

    /// The person, small, at the bottom left of the ring (the verified check keeps the bottom right).
    private var badge: some View {
        MomentAvatar(author: ring.author, size: Self.badgeSize)
            .padding(2)
            .background(Circle().fill(MomentsPalette.pinSurface))
            .offset(x: 1, y: 37)
    }
}
