//
//  MomentsStudioPlay.swift
//  Pantopus
//
//  The Play part of the Studio's "Stamps and Play" tray ("Pulse, reinvented" phase 2; CONTRACT 7b, 7g; board B5): a poll,
//  a slider, the spectrum dial, "where do you stand", a question box, guess and reveal, a countdown, a quote lifted from
//  the photo, fog and a swatch. Up to four on a post (a before and after counts). Each is placed on the picture as a
//  stamp is, dragged where it belongs, and goes out with the Moment (`play`); it can't be changed after posting.
//

import SwiftUI
import Vision

extension MomentsComposerModel {
    static let playLimit = 4

    var studioPlayItems: [MomentPlayItem] {
        guard draft != nil else { return [] }
        return (marking.studio?.play ?? []).filter { item in
            switch item.kind {
            case .fog, .swatch: draft != .text
            case .movingWords: offersLooks
            default: true
            }
        }
    }

    /// Room for one more item on this post.
    var offersMorePlay: Bool {
        (studioPlay?.count ?? 0) < Self.playLimit
    }

    func addStudioPlay(_ item: MomentPlayItem) {
        guard offersMorePlay else { return }
        if marking.studio == nil { marking.studio = MomentsStudioTools() }
        var placed = item
        let count = Double(marking.studio?.play.count ?? 0)
        placed.y = min(0.3 + count * 0.12, 0.7)
        marking.studio?.play.append(placed)
        marking.studio?.pickedPlay = placed.id
    }

    func removeStudioPlay(_ id: String) {
        marking.studio?.play.removeAll { $0.id == id }
        marking.studio?.pickedPlay = nil
    }

    func moveStudioPlay(_ id: String, x: Double, y: Double) {
        guard let index = marking.studio?.play.firstIndex(where: { $0.id == id }) else { return }
        marking.studio?.play[index].x = (min(max(x, 0.05), 0.95) * 1000).rounded() / 1000
        marking.studio?.play[index].y = (min(max(y, 0.05), 0.95) * 1000).rounded() / 1000
    }

    /// A fresh id for an item of `kind` ("poll-1", "poll-2"…); never "c-" or "k-" (those are a dot's answers).
    func playId(_ kind: MomentPlayItem.Kind) -> String {
        let base = kind == .beforeAfter ? "pair" : kind.rawValue
        var number = 1
        while (marking.studio?.play ?? []).contains(where: { $0.id == "\(base)-\(number)" }) {
            number += 1
        }
        return "\(base)-\(number)"
    }
}

/// Lines of words found in the Studio's photo, for lifting a quote (on the phone; nothing is sent).
enum MomentsQuoteLifter {
    static func lines(in image: UIImage) async -> [String] {
        await Task.detached(priority: .userInitiated) {
            guard let cgImage = image.cgImage else { return [] }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            try? VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.filter { $0.count > 2 }
        }.value
    }
}

/// Items placed on the Studio's picture: drawn as readers will see them; drag to move, tap to pick, then remove.
struct MomentsStudioPlayLayer: View {
    let model: MomentsComposerModel
    let picture: CGSize?

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            // A swatch's area, as readers will see it outlined; it takes no touch.
            ForEach(model.studioPlayItems.filter { $0.kind == .swatch }) { item in
                let rect = MomentSwatchLayer.rect(item, in: frame)
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)
                    .allowsHitTesting(false)
            }
            ForEach(model.studioPlayItems.filter { $0.kind != .fog && $0.kind != .swatch }) { item in
                MomentsStudioPlacedPlay(model: model, item: item, frame: frame, screen: geo.size)
            }
            // Fog and a swatch cover the whole picture rather than sit on it: each says it is on, and comes off with ✕.
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(model.studioPlayItems.filter { $0.kind == .fog || $0.kind == .swatch }) { item in
                    MomentsStudioCoverChip(item: item) { model.removeStudioPlay(item.id) }
                }
            }
            .padding(.leading, Spacing.s4)
            .padding(.top, 128)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// "Fog-wipe on" or a swatch's paints, at the top left of the Studio's picture (clear of the tool rail), with ✕.
private struct MomentsStudioCoverChip: View {
    let item: MomentPlayItem
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            if item.kind == .swatch {
                HStack(spacing: -4) {
                    ForEach(Array((item.colors ?? []).compactMap(MomentSwatchLayer.color).enumerated()), id: \.offset) { _, color in
                        Circle().fill(color).frame(width: 16, height: 16).overlay(Circle().stroke(Color.white, lineWidth: 1))
                    }
                }
                .accessibilityHidden(true)
            } else {
                Icon(.cloud, size: 15, strokeWidth: 2.2, color: .white)
                    .accessibilityHidden(true)
            }
            Text(item.kind == .fog ? "Fog-wipe on" : "Swatch on")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .accessibilityLabel(item.kind == .fog ? "Fog-wipe: the picture opens frosted" : "Swatch: people try these colours on")
            Button(action: onRemove) {
                Icon(.x, size: 14, strokeWidth: 2.6, color: .white)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.kind == .fog ? "Take the fog off" : "Take the swatch off")
            .accessibilityIdentifier("moments.studio.play.\(item.id).remove")
        }
        .padding(.leading, 12)
        .padding(.trailing, 6)
        .frame(height: 34)
        .background(Capsule().fill(Color.black.opacity(0.55)))
        // The words and the x stay two elements, so VoiceOver reaches the x.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.play.\(item.id)")
    }
}

private struct MomentsStudioPlacedPlay: View {
    let model: MomentsComposerModel
    let item: MomentPlayItem
    let frame: CGRect
    let screen: CGSize
    @GestureState private var moving: CGSize = .zero

    var body: some View {
        let picked = model.marking.studio?.pickedPlay == item.id
        VStack(spacing: Spacing.s1) {
            if picked {
                Button { model.removeStudioPlay(item.id) } label: {
                    Text("Remove")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Color.black.opacity(0.7)))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.studio.play.remove")
            }
            if item.kind == .movingWords {
                // Moving words are drawn as readers will see them, moving.
                MomentMovingWordsView(item: item)
                    .padding(6)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white, lineWidth: picked ? 2 : 0))
            } else {
                MomentPlayCard(moment: nil, item: item, preview: true)
                    .frame(width: 250)
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.white, lineWidth: picked ? 2 : 0))
            }
        }
        .scaleEffect(0.86)
        .position(
            x: min(max(frame.minX + item.x * frame.width, 120), screen.width - 120) + moving.width,
            y: frame.minY + item.y * frame.height + moving.height
        )
        .gesture(
            DragGesture(minimumDistance: 4)
                .updating($moving) { value, moving, _ in moving = value.translation }
                .onEnded { value in
                    model.moveStudioPlay(
                        item.id,
                        x: item.x + value.translation.width / max(frame.width, 1),
                        y: item.y + value.translation.height / max(frame.height, 1)
                    )
                }
        )
        .simultaneousGesture(TapGesture().onEnded { model.marking.studio?.pickedPlay = picked ? nil : item.id })
        .accessibilityElement(children: .contain)
        .accessibilityHint("Drag to move it. Tap to pick it, then Remove.")
        .accessibilityIdentifier("moments.studio.play.\(item.id)")
    }
}
