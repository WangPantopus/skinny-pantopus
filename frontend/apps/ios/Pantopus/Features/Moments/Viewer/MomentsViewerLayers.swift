//
//  MomentsViewerLayers.swift
//  Pantopus
//
//  What "Pulse, reinvented" phase 2 lays over a Moment's photo in the viewer (CONTRACT 7), drawn only while the switch
//  is on for the person watching. With it off, or on a Moment with none, the photo is today's: the same picture with
//  the same label, and its stamps (`MomentStampsOverlay`, which draws nothing with the switch off).
//
//  Before and after (CONTRACT 7g): one half over the other with a curtain (`MomentBeforeAfterView`); the stamps sit on
//  one half's frame. The viewer holds still on it, so the reader compares at their own pace and taps on when they
//  choose.
//
//  Dots (CONTRACT 7c): a tap on one opens what it holds (a note, a rating, a link that opens only on a tap); the
//  viewer holds still while it's open. The author can take a dot off their own Moment.
//

import Observation
import SwiftUI

/// A Moment's photo in the viewer, with what is laid over it.
struct MomentPhotoSurface: View {
    let moment: MomentDTO
    let image: UIImage
    @State private var flags = PulseReinventedFlags.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if flags.isOn, moment.layers.whole, moment.layers.beforeAfter == nil {
            // See the picture first (phase 5, CONTRACT 10c): the author's whole picture, fitted, on its backdrop.
            MomentWholePicture(moment: moment, image: image)
        } else if flags.isOn, let pair = moment.layers.beforeAfter {
            MomentBeforeAfterView(picture: image, item: pair)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("\(moment.author.shortName)'s before and after")
                .accessibilityIdentifier("moments.viewer.photo")
                .overlay { MomentLayersOverlay(moment: moment, picture: MomentBeforeAfterHalves.size(of: image.size)) }
        } else if flags.isOn, let motion = moment.layers.motion, motion.url != nil {
            // A Live Photo's motion (phase 5 C, CONTRACT 10b): once, silently, as it opens; again with its sound while held.
            Color.clear
                .overlay {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .accessibilityLabel("\(moment.author.shortName)'s photo")
                        .accessibilityIdentifier("moments.viewer.photo")
                        .overlay { MomentMotionLayer(motion: motion, fills: true) }
                }
                .clipped()
                .overlay { MomentLayersOverlay(moment: moment, picture: image.size) }
                .overlay(alignment: .bottomLeading) { MomentMotionMark().padding(.leading, 16).padding(.bottom, 120) }
        } else if flags.isOn, MomentDepth.shows(reduceMotion: reduceMotion) {
            // Depth windows (phase 4): tilt to look around; flat with Reduce Motion, in Low Power Mode, or when slow.
            MomentDepthWindow(moment: moment, image: image)
        } else if flags.isOn, !moment.layers.dots.isEmpty || !moment.layers.play.isEmpty {
            // Dots and items open cards: they are laid over the frame that shows, not the photo's overflow, so a card
            // stays on the screen on a wide photo.
            Color.clear
                .overlay {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .accessibilityLabel("\(moment.author.shortName)'s photo")
                        .accessibilityIdentifier("moments.viewer.photo")
                }
                .clipped()
                .overlay { MomentLayersOverlay(moment: moment, picture: image.size) }
        } else {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .accessibilityLabel("\(moment.author.shortName)'s photo")
                .accessibilityIdentifier("moments.viewer.photo")
                // "Pulse, reinvented": its stamps, only while the switch is on for you.
                .overlay { MomentLayersOverlay(moment: moment, picture: image.size) }
        }
    }
}

extension MomentsViewerModel {
    /// The viewer holds still on a before and after (as the web's viewer does), and while a dot is open: the reader
    /// goes on with a tap.
    var playHolds: Bool {
        guard PulseReinventedFlags.shared.isOn, let moment else { return false }
        if MomentDotPrompt.shared.open?.momentId == moment.id || soundHolds { return true }
        if playItemsHold || deckHolds { return true }
        return moment.kind == .photo && moment.layers.beforeAfter != nil
    }
}

/// The dot open over the viewer (one at a time), and dots the author took off in this run.
@Observable
@MainActor
final class MomentDotPrompt {
    struct Open: Equatable {
        let momentId: String
        let dotId: String
    }

    static let shared = MomentDotPrompt()

    var open: Open?
    var removed: Set<String> = []

    func shown(_ moment: MomentDTO) -> [MomentDotDTO] {
        moment.layers.dots.filter { !removed.contains("\(moment.id)/\($0.id)") }
    }
}

/// What "Pulse, reinvented" lays over a Moment's photo or video: its stamps, then its dots. Nothing with the switch off.
struct MomentLayersOverlay: View {
    let moment: MomentDTO
    /// The picture's own size (one half's for a before and after); nil for a text card.
    let picture: CGSize?
    @State private var flags = PulseReinventedFlags.shared

    var body: some View {
        if flags.isOn {
            // Clear underneath so the layers always have the picture's size (the stamps draw nothing without stamps).
            ZStack {
                Color.clear
                // A swatch's paint is tried on the photo, under the stamps.
                if moment.layers.play.contains(where: { $0.kind == .swatch }) {
                    MomentSwatchPaint(moment: moment, picture: picture)
                }
                MomentStampsOverlay(moment: moment, picture: picture)
                if !moment.layers.play.isEmpty {
                    MomentPlayOverlay(moment: moment, picture: picture)
                }
                if moment.kind != .text, !moment.layers.dots.isEmpty {
                    MomentDotsOverlay(moment: moment, picture: picture)
                }
                MomentPinsOverlay(moment: moment, picture: picture) // Pins on the photo (8b): only where replies show.
            }
        } else {
            // With the switch off: exactly today's overlay.
            MomentStampsOverlay(moment: moment, picture: picture)
        }
    }
}

/// A Moment's dots in the viewer, and the open one's card.
struct MomentDotsOverlay: View {
    let moment: MomentDTO
    let picture: CGSize?
    private let prompt = MomentDotPrompt.shared

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            let dots = prompt.shown(moment)
            let open = dots.first { prompt.open == MomentDotPrompt.Open(momentId: moment.id, dotId: $0.id) }
            ZStack {
                if open != nil {
                    // A tap away from the card closes it (and goes nowhere else).
                    Color.clear
                        .contentShape(Rectangle())
                        .onTapGesture { prompt.open = nil }
                        .accessibilityHidden(true)
                }
                ForEach(dots, id: \.id) { dot in
                    Button {
                        prompt.open = open?.id == dot.id ? nil : MomentDotPrompt.Open(momentId: moment.id, dotId: dot.id)
                    } label: {
                        MomentDotMark(kind: dot.kind, picked: open?.id == dot.id)
                            .frame(width: 44, height: 44)
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .position(x: frame.minX + dot.x * frame.width, y: frame.minY + dot.y * frame.height)
                    .accessibilityLabel(MomentDotCard.spoken(dot))
                    .accessibilityIdentifier("moments.viewer.dot.\(dot.id)")
                }
                if let open {
                    let x = frame.minX + open.x * frame.width
                    let y = frame.minY + open.y * frame.height
                    // A video fills the screen past its edges (a 9:16 video by about 45 points a side on an iPhone):
                    // the card stays inside the part that shows.
                    let shown = MomentLayerScreen.shown(in: geo)
                    MomentDotCard(moment: moment, dot: open)
                        .frame(width: min(shown.width - 32, 280))
                        .fixedSize(horizontal: false, vertical: true)
                        .position(
                            x: min(max(x, shown.minX + 156), max(shown.maxX - 156, shown.minX + 156)),
                            y: y > geo.size.height * 0.55 ? y - (open.kind == .thing ? 150 : 96) : y + (open.kind == .thing ? 150 : 96)
                        )
                }
            }
        }
    }
}

/// The part of a layer that is on the screen, in the layer's own coordinates. A video, or a photo of another shape than
/// the screen, is drawn filling it, so its layer runs past the screen's edges; a card opened on it stays inside this.
enum MomentLayerScreen {
    @MainActor
    static func shown(in geo: GeometryProxy) -> CGRect {
        let whole = CGRect(origin: .zero, size: geo.size)
        let global = geo.frame(in: .global)
        let window = UIApplication.shared.connectedScenes.lazy.compactMap { ($0 as? UIWindowScene)?.keyWindow?.bounds }.first
        guard let window else { return whole }
        let visible = global.intersection(window)
        guard !visible.isNull, visible.width > 120, visible.height > 120 else { return whole }
        return visible.offsetBy(dx: -global.minX, dy: -global.minY)
    }
}
