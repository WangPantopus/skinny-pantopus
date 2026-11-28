//
//  MomentWholePicture.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece A (see the picture first; CONTRACT 10c): a photo its author marked `whole` is
//  shown as they approved it, on every screen shape. It is fitted by its own width and height, as large as fits and
//  never cut, whatever its shape (never assumed 9:16), on its backdrop: the two colours the author's picture sat on,
//  or, when the Moment has none, the picture's own top and bottom colours as Resize makes them. The author's stamps,
//  items, dots and pins are laid over the fitted picture itself, so each stays where it was put. Only with the switch
//  on; a Moment without `whole` is drawn as today (filling the screen).
//

import SwiftUI
import UIKit

struct MomentWholePicture: View {
    let moment: MomentDTO
    let image: UIImage
    /// The picture's own two colours, read once, when the Moment carries none.
    @State private var ownBackdrop: MomentPlacement.Backdrop?

    var body: some View {
        ZStack {
            backdrop
                .ignoresSafeArea()
                .accessibilityHidden(true)
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .accessibilityLabel("\(moment.author.shortName)'s photo")
                .accessibilityIdentifier("moments.viewer.photo")
                // A Live Photo's motion (phase 5 C), fitted as the picture is.
                .overlay {
                    if let motion = moment.layers.motion, motion.url != nil { MomentMotionLayer(motion: motion, fills: false) }
                }
                // The layers' frame is the fitted picture, so they fill it exactly as on the author's canvas.
                .overlay { MomentLayersOverlay(moment: moment, picture: image.size) }
            if moment.layers.motion?.url != nil {
                MomentMotionMark()
                    .padding(.leading, 16)
                    .padding(.bottom, 120)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
        }
        .task(id: moment.id) {
            guard moment.layers.backdrop == nil else { return }
            ownBackdrop = MomentPlacementDrawing.backdrop(of: image)
        }
    }

    private var colors: (top: Color, bottom: Color) {
        if let sent = moment.layers.backdrop,
           let top = MomentSwatchLayer.color(sent.top), let bottom = MomentSwatchLayer.color(sent.bottom) {
            return (top, bottom)
        }
        let own = ownBackdrop ?? .dark
        return (Color(uiColor: own.top), Color(uiColor: own.bottom))
    }

    private var backdrop: some View {
        let colors = colors
        return LinearGradient(colors: [colors.top, colors.bottom], startPoint: .top, endPoint: .bottom)
    }
}
