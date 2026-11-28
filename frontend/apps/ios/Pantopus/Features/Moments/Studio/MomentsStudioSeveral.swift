//
//  MomentsStudioSeveral.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece A5 on the iPhone (LEAD-8's yes, 2026-11-28): several picked together in the
//  library. Each is still its own Moment and opens whole with its own fit when its turn comes ("Post 2 of 3", today's
//  `MomentsComposerModel+Several`); the Studio adds a row of small thumbnails in its bar: the one on the screen ringed,
//  the ones waiting after it in their order. A tap on a waiting one makes it the next; a long press on any one offers
//  "Leave this one out". No swipe on the picture: one finger on the picture moves it (the founder's point 10).
//
//  Nothing is jumped to: the one on the screen keeps its fit, marks, stamps and items until it posts or is left out.
//  Left out, it isn't posted and what was done to it goes; the next takes the screen as after a post. Only the model's
//  own `waiting` and `pickedTogether` are changed; nothing new is sent.
//

import Photos
import SwiftUI
import UIKit

extension MomentsComposerModel {
    /// The row shows while two or more picked together are still in play in the Studio.
    var studioShowsSeveral: Bool {
        pickedTogether > 1 && draft != nil && marking.studio != nil
    }

    /// A waiting one goes next (the order changes; nothing posts).
    func studioMakeNext(_ asset: PHAsset) {
        guard !isPosting, let index = waiting.firstIndex(of: asset), index > 0 else { return }
        waiting.insert(waiting.remove(at: index), at: 0)
    }

    /// A waiting one is left out: it won't be posted, and the count says so.
    func studioLeaveOut(_ asset: PHAsset) {
        guard !isPosting, let index = waiting.firstIndex(of: asset) else { return }
        waiting.remove(at: index)
        pickedTogether -= 1
    }

    /// The one on the screen is left out: what was done to it goes, and the next takes the screen as after a post.
    /// False when none is left (the composer closes).
    func studioLeaveOutCurrent() async -> Bool {
        guard !isPosting, pickedTogether > 1, !waiting.isEmpty else { return true }
        pickedTogether -= 1
        dropPictureTools()
        studioStamps = []
        return await moveOn()
    }
}

/// The row of the ones picked together, in the Studio's bar.
struct MomentsStudioSeveralRow: View {
    let model: MomentsComposerModel
    /// None left after the one on the screen is left out: the composer closes.
    let onNoneLeft: () -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s1) {
                current
                ForEach(Array(model.waiting.enumerated()), id: \.element.localIdentifier) { index, asset in
                    waiting(asset, next: index == 0)
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize)
        .disabled(model.isPosting)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Picked together")
        .accessibilityIdentifier("moments.studio.several")
    }

    private var current: some View {
        MomentsStudioSeveralThumb(image: currentImage, ringed: true, badge: nil)
            .contextMenu {
                // The last one left is left out with the X, as today.
                if !model.waiting.isEmpty {
                    Button("Leave this one out", role: .destructive) {
                        Task { if await !model.studioLeaveOutCurrent() { onNoneLeft() } }
                    }
                }
            }
            .accessibilityLabel("This one, \(model.pickedPosition ?? "")")
            .accessibilityAction(named: "Leave this one out") {
                Task { if await !model.studioLeaveOutCurrent() { onNoneLeft() } }
            }
            .accessibilityIdentifier("moments.studio.several.current")
    }

    private func waiting(_ asset: PHAsset, next: Bool) -> some View {
        Button { model.studioMakeNext(asset) } label: {
            MomentsStudioSeveralThumb(asset: asset, badge: next ? "Next" : nil)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Leave this one out", role: .destructive) { model.studioLeaveOut(asset) }
        }
        .accessibilityLabel(next ? "Next" : "Waiting")
        .accessibilityHint(next ? "Posts after this one" : "Tap to post it next")
        .accessibilityAction(named: "Leave this one out") { model.studioLeaveOut(asset) }
        .accessibilityIdentifier("moments.studio.several.waiting")
    }

    private var currentImage: UIImage? {
        if case let .photo(image) = model.draft { return image }
        return nil
    }
}

/// One small square: 36 pt to the eye, 44 pt to the finger.
private struct MomentsStudioSeveralThumb: View {
    var image: UIImage?
    var asset: PHAsset?
    var ringed = false
    let badge: String?
    @State private var loaded: UIImage?

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                if let shown = image ?? loaded {
                    Image(uiImage: shown).resizable().scaledToFill()
                } else {
                    Color.white.opacity(0.12)
                        .overlay { Icon(.image, size: 14, strokeWidth: 2, color: Color.white.opacity(0.7)) }
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.white, lineWidth: ringed ? 2 : 0))
            if let badge {
                Text(badge)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 4)
                    .background(Capsule().fill(Color.black.opacity(0.7)))
                    .offset(y: 4)
            }
        }
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
        .task(id: asset?.localIdentifier) {
            guard let asset, image == nil else { return }
            loaded = await Self.thumbnail(asset)
        }
    }

    private static func thumbnail(_ asset: PHAsset) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = false
            PHImageManager.default().requestImage(
                for: asset, targetSize: CGSize(width: 108, height: 108), contentMode: .aspectFill, options: options
            ) { image, _ in
                continuation.resume(returning: image)
            }
        }
    }
}
