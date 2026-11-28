//
//  MomentWholeVideo.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece A on the iPhone (see the picture first; CONTRACT 10c), a video's side for readers:
//  a video its author marked `whole` is shown as they approved it, never cut, on every screen shape. With a `placement`
//  it is laid on its 9:16 canvas as placed (Resize's own `MomentPlacedCanvas`) and the canvas is fitted, as large as it
//  fits; without one it is fitted by its own size. Its backdrop is the Moment's two colours, or the poster's own top and
//  bottom ones. Stamps, items and dots sit over the canvas for a placed video, over the video's own box otherwise
//  (LEAD-6, 02:46). Only while the switch is on for the reader; any other video is today's, untouched: one line in
//  today's viewer hands it to `MomentWholeVideoFrame`, which gives today's view back unchanged.
//

import AVFoundation
import SwiftUI
import UIKit

/// Today's video view, or, for a reader whose switch is on and a Moment marked `whole`, the whole video.
struct MomentWholeVideoFrame: ViewModifier {
    let moment: MomentDTO
    let player: AVPlayer
    let poster: UIImage?
    @State private var flags = PulseReinventedFlags.shared

    func body(content: Content) -> some View {
        if flags.isOn, moment.layers.whole, let size = moment.pictureSize {
            MomentWholeVideo(moment: moment, player: player, poster: poster, size: size)
        } else {
            content
        }
    }
}

/// The whole video on its backdrop: on its canvas when placed, else fitted by its own size.
struct MomentWholeVideo: View {
    let moment: MomentDTO
    let player: AVPlayer
    let poster: UIImage?
    /// The video's own size (the Moment's `width` and `height`).
    let size: CGSize
    /// The poster's own two colours, read once, when the Moment carries none.
    @State private var ownBackdrop: MomentPlacement.Backdrop?

    var body: some View {
        GeometryReader { geo in
            let shape = placement == nil ? size.width / max(size.height, 1) : MomentPlacement.canvas
            let frame = Self.fit(shape, in: geo.size)
            ZStack {
                LinearGradient(colors: [Color(uiColor: colors.top), Color(uiColor: colors.bottom)], startPoint: .top, endPoint: .bottom)
                    .accessibilityHidden(true)
                picture
                    .frame(width: frame.width, height: frame.height)
                    .clipped()
                    .position(x: frame.midX, y: frame.midY)
                // Over the canvas for a placed video, over the video's own box otherwise.
                MomentLayersOverlay(moment: moment, picture: nil)
                    .frame(width: frame.width, height: frame.height)
                    .position(x: frame.midX, y: frame.midY)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(moment.author.shortName)'s video, whole")
        .accessibilityIdentifier("moments.viewer.video")
        .task(id: moment.id) {
            guard moment.layers.backdrop == nil, let poster else { return }
            ownBackdrop = MomentPlacementDrawing.backdrop(of: poster)
        }
    }

    private var placement: MomentPlacement? {
        moment.layers.placement.map {
            MomentPlacement(width: CGFloat($0.width), center: CGPoint(x: $0.x, y: $0.y), turn: CGFloat($0.turn))
        }
    }

    @ViewBuilder private var picture: some View {
        let video = ZStack {
            if let poster { Image(uiImage: poster).resizable().scaledToFill() }
            MomentsVideoSurface(player: player)
        }
        if let placement {
            MomentPlacedCanvas(aspect: size.width / max(size.height, 1), placement: placement, backdrop: colors) { video }
        } else {
            video
        }
    }

    private var colors: MomentPlacement.Backdrop {
        if let sent = moment.layers.backdrop,
           let top = MomentSwatchLayer.color(sent.top), let bottom = MomentSwatchLayer.color(sent.bottom) {
            return MomentPlacement.Backdrop(top: UIColor(top), bottom: UIColor(bottom))
        }
        return ownBackdrop ?? .dark
    }

    /// A box `shape` wide over high, as large as fits in `space`, in its middle.
    static func fit(_ shape: CGFloat, in space: CGSize) -> CGRect {
        let wide = space.width / max(space.height, 1) >= shape
        let size = wide
            ? CGSize(width: space.height * shape, height: space.height)
            : CGSize(width: space.width, height: space.width / max(shape, 0.01))
        return CGRect(x: (space.width - size.width) / 2, y: (space.height - size.height) / 2, width: size.width, height: size.height)
    }
}
