//
//  MomentsStudioWhole.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece A on the iPhone (see the picture first; CONTRACT 10c): the Studio's first screen
//  shows a photo whole, never cut, on the 9:16 canvas, with its own colours carried on around it, as readers will see
//  it. On that same screen one finger moves it and two size and turn it (sticking at quarter turns and the middle);
//  Fill fills the canvas and then reads Fit; Reset puts it back whole. This drives Resize's own model and engine
//  (`MomentPlacement`, `MomentsMarking.move`); only the fingers' glue is the Studio's.
//
//  A photo left whole posts as taken, at its own shape, with `whole` and its `backdrop`; once moved, sized, turned or
//  filled it is drawn into the canvas exactly as Resize's Done draws it, with the same two keys. Marks, stamps, items,
//  dots and cutouts move with the picture between "whole as taken" and "on the canvas", so each stays where the author
//  put it on the screen. A video, a text card and a before-and-after show and post as before. Only while the Studio is
//  open, which is only while the switch is on; with the switch off, today's composer is untouched.
//

import SwiftUI
import UIKit

extension MomentPlacement {
    /// Whole on the canvas, upright in the middle: as wide as the canvas for a picture at least as wide as 9:16, as tall
    /// as it for a taller one.
    static func fit(aspect: CGFloat) -> MomentPlacement {
        MomentPlacement(width: min(1, aspect / canvas), center: CGPoint(x: 0.5, y: 0.5), turn: 0)
    }
}

/// Where a point on a picture shown whole lands on the canvas, and back: what moves the marks, stamps, items, dots and
/// cutouts when the picture goes onto the canvas (its first move or Fill) and when it comes back whole (Reset, Fit).
struct MomentsStudioWholeMap {
    /// The picture's width as a share of the canvas's, and its height as a share of the canvas's height.
    let width: CGFloat
    let height: CGFloat
    /// Which way: from the picture to the canvas, or back.
    let toCanvas: Bool

    init(aspect: CGFloat, toCanvas: Bool) {
        width = MomentPlacement.fit(aspect: aspect).width
        height = width * MomentPlacement.canvas / max(aspect, 0.01)
        self.toCanvas = toCanvas
    }

    func point(_ point: CGPoint) -> CGPoint {
        toCanvas
            ? CGPoint(x: 0.5 + (point.x - 0.5) * width, y: 0.5 + (point.y - 0.5) * height)
            : CGPoint(x: 0.5 + (point.x - 0.5) / width, y: 0.5 + (point.y - 0.5) / height)
    }

    func point(x: Double, y: Double) -> (x: Double, y: Double) {
        let moved = point(CGPoint(x: x, y: y))
        return (Double(moved.x), Double(moved.y))
    }

    /// A size kept as a share of the picture's width, and one kept as a share of its height.
    var across: CGFloat {
        toCanvas ? width : 1 / width
    }

    var down: CGFloat {
        toCanvas ? height : 1 / height
    }

    func marks(_ marks: MomentMarks) -> MomentMarks {
        var moved = marks
        moved.strokes = marks.strokes.map { stroke in
            var stroke = stroke
            stroke.points = stroke.points.map(point)
            stroke.width *= across
            return stroke
        }
        moved.labels = marks.labels.map { label in
            var label = label
            label.center = point(label.center)
            label.size *= across
            return label
        }
        moved.cutouts = marks.cutouts.map(cutout)
        return moved
    }

    func cutout(_ cutout: MomentMarks.Cutout) -> MomentMarks.Cutout {
        var cutout = cutout
        cutout.center = point(cutout.center)
        cutout.width *= across
        return cutout
    }

    func stamp(_ stamp: MomentStampPlacement) -> MomentStampPlacement {
        var stamp = stamp
        (stamp.x, stamp.y) = point(x: stamp.x, y: stamp.y)
        stamp.scale *= Double(across)
        return stamp
    }

    func item(_ item: MomentPlayItem) -> MomentPlayItem {
        var item = item
        (item.x, item.y) = point(x: item.x, y: item.y)
        item.scale *= Double(across)
        // A fog or a swatch covers a part of the picture: its corner moves, its sides follow the picture's.
        if let box = item.box {
            let corner = point(x: box.x, y: box.y)
            item.box = MomentPlayItem.Box(x: corner.x, y: corner.y, w: box.w * Double(across), h: box.h * Double(down))
        }
        return item
    }

    func dot(_ dot: MomentDotDTO) -> MomentDotDTO {
        var dot = dot
        (dot.x, dot.y) = point(x: dot.x, y: dot.y)
        // A thing's ring is sized by the picture's width.
        if let box = dot.box {
            dot.box = MomentPlayItem.Box(x: box.x, y: box.y, w: box.w * Double(across), h: box.h * Double(across))
        }
        return dot
    }
}

extension MomentsComposerModel {
    /// The Studio's first screen shows this picture whole: a photo, not a before-and-after.
    var studioWholeOffered: Bool {
        guard marking.studio != nil, studioPair == nil, case .photo = draft else { return false }
        return true
    }

    /// Where the picture sits on the canvas as shown now (the fingers' while they move it, Done's after); nil: whole as
    /// taken.
    var studioShownPlacement: MomentPlacement? {
        marking.isOpen ? marking.editingPlacement : marking.placement
    }

    /// The photo's own shape, width over height.
    var studioPictureAspect: CGFloat? {
        guard case let .photo(image) = draft, image.size.height > 0 else { return nil }
        return image.size.width / image.size.height
    }

    /// The picture fills the canvas (Fill): the rail offers Fit.
    var studioWholeFilled: Bool {
        guard let aspect = studioPictureAspect, let placement = studioShownPlacement else { return false }
        return placement.isCover(aspect: aspect)
    }

    /// Moved, sized or turned on the canvas (not just filled): the rail offers Reset.
    var studioWholeMoved: Bool {
        studioShownPlacement != nil && !studioWholeFilled
    }

    // MARK: - Fingers

    /// A finger came down on the picture: Resize's engine takes it (the Studio stays on screen, `adjusting`), and a
    /// picture still whole as taken goes onto the canvas where it shows, with everything on it.
    func studioWholeBegin() {
        guard studioWholeOffered, !isPosting, let aspect = studioPictureAspect else { return }
        guard openWholeEditor() else { return }
        if marking.editingPlacement == nil { moveWholeThings(MomentsStudioWholeMap(aspect: aspect, toCanvas: true)) }
        marking.beginMoving()
    }

    /// One step of the fingers, in Resize's own terms (`MomentsMarking.move`).
    func studioWholeStep(move: CGVector, scale: CGFloat, turn: CGFloat, around anchor: CGPoint) {
        guard marking.isOpen, marking.studio?.adjusting == true, let aspect = studioPictureAspect else { return }
        marking.move(by: move, scale: scale, turn: turn, around: anchor)
        // Exactly at cover Resize counts the picture as taken again; here it stays on the canvas, filling it.
        if marking.editingPlacement == nil { keepFilled(aspect: aspect) }
    }

    /// The fingers lifted: kept, as Resize's Done keeps it.
    func studioWholeEnd() {
        guard marking.studio?.adjusting == true else { return }
        marking.endMoving()
        keepWhole()
    }

    // MARK: - Fill, Fit and Reset

    /// Fill: the picture covers the canvas (drawn into it at Post), whatever it was.
    func studioWholeFill() {
        guard studioWholeOffered, !isPosting, let aspect = studioPictureAspect, openWholeEditor() else { return }
        if marking.editingPlacement == nil { moveWholeThings(MomentsStudioWholeMap(aspect: aspect, toCanvas: true)) }
        marking.editingPlacement = .cover(aspect: aspect)
        keepWhole()
    }

    /// Fit and Reset: whole as taken again, everything on it back on the picture where it shows.
    func studioWholeReset() {
        guard studioWholeOffered, !isPosting, let aspect = studioPictureAspect, studioShownPlacement != nil,
              openWholeEditor() else { return }
        if marking.editingPlacement != nil { moveWholeThings(MomentsStudioWholeMap(aspect: aspect, toCanvas: false)) }
        marking.editingPlacement = nil
        keepWhole()
    }

    /// VoiceOver's sizes and turns, about the canvas's middle.
    func studioWholeNudge(scale: CGFloat = 1, turn: CGFloat = 0) {
        studioWholeBegin()
        studioWholeStep(move: .zero, scale: scale, turn: turn, around: CGPoint(x: 0.5, y: 0.5 / MomentPlacement.canvas))
        studioWholeEnd()
    }

    /// Resize's editor, open on this photo without its screen: the Studio's first screen is the one showing.
    private func openWholeEditor() -> Bool {
        if !marking.isOpen {
            marking.studio?.adjusting = true
            openMarks(.resize)
        }
        return marking.isOpen && marking.studio?.adjusting == true
    }

    /// Done: the photo at its place, with its marks, as Resize's Done keeps it (drawn into the canvas once placed).
    private func keepWhole() {
        defer { marking.studio?.adjusting = false }
        guard case let .photo(image) = draft, !isPosting else { return marking.cancel() }
        use(marked: marking.base ?? image, marking.editing, placement: marking.editingPlacement)
    }

    private func keepFilled(aspect: CGFloat) {
        marking.editingPlacement = .cover(aspect: aspect)
        marking.moveMarks(marking.editing.placed(aspect: aspect))
    }

    /// Everything on the picture goes with it between "whole as taken" and "on the canvas"; the picture's place too.
    private func moveWholeThings(_ map: MomentsStudioWholeMap) {
        guard let aspect = studioPictureAspect else { return }
        marking.moveMarks(map.marks(marking.editing))
        if map.toCanvas { marking.editingPlacement = .fit(aspect: aspect) }
        studioStamps = studioStamps.map(map.stamp)
        guard var tools = marking.studio else { return }
        tools.play = tools.play.map(map.item)
        tools.dots = tools.dots.map(map.dot)
        tools.cutouts = tools.cutouts.map(map.cutout)
        marking.studio = tools
    }

    // MARK: - Sent (CONTRACT 10c)

    /// True for a photo from the Studio's first screen while the switch reads on at sending; nil otherwise, never false.
    var studioWhole: Bool? {
        guard studioWholeOffered, PulseReinventedFlags.shared.isOn else { return nil }
        return true
    }

    /// A whole video's place on the canvas: a video shows and posts as before for now.
    var studioWholePlacement: MomentWholePlacementDTO? {
        nil
    }

    /// The two colours the picture sits on, once read from it.
    var studioBackdrop: MomentBackdropDTO? {
        guard let colors = marking.backdrop else { return nil }
        return MomentBackdropDTO(top: Self.wireColor(colors.top), bottom: Self.wireColor(colors.bottom))
    }

    /// `#RRGGBB`, upper-case, as the contract keeps it.
    private static func wireColor(_ color: UIColor) -> String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: nil)
        let byte = { (part: CGFloat) in Int((min(max(part, 0), 1) * 255).rounded()) }
        return "#" + String(format: "%02X%02X%02X", byte(red), byte(green), byte(blue))
    }
}

// MARK: - The screen

/// Where the canvas sits on the Studio's screen (whole, never cut: as large as fits, in the middle), and where the
/// picture and everything on it are drawn: the picture's own box while it's whole as taken, else the canvas.
@MainActor
struct MomentsStudioWholeFrames {
    let canvas: CGRect
    let layers: CGRect

    init(model: MomentsComposerModel, screen: CGSize) {
        let wide = screen.width / max(screen.height, 1) >= MomentPlacement.canvas
        let size = wide
            ? CGSize(width: screen.height * MomentPlacement.canvas, height: screen.height)
            : CGSize(width: screen.width, height: screen.width / MomentPlacement.canvas)
        canvas = CGRect(x: (screen.width - size.width) / 2, y: (screen.height - size.height) / 2, width: size.width, height: size.height)
        layers = Self.picture(in: canvas, model: model) ?? canvas
    }

    /// The picture's own box on the canvas while it's whole as taken; nil once it's on the canvas.
    private static func picture(in canvas: CGRect, model: MomentsComposerModel) -> CGRect? {
        guard model.studioShownPlacement == nil, let aspect = model.studioPictureAspect else { return nil }
        let width = canvas.width * MomentPlacement.fit(aspect: aspect).width
        let height = width / aspect
        return CGRect(x: canvas.midX - width / 2, y: canvas.midY - height / 2, width: width, height: height)
    }

    /// The canvas around the frame everything is drawn in (both in the window): the same middle, wider while the
    /// picture is whole as taken.
    static func canvas(around layers: CGRect, model: MomentsComposerModel) -> CGRect {
        guard model.studioShownPlacement == nil, let aspect = model.studioPictureAspect else { return layers }
        let width = layers.width / MomentPlacement.fit(aspect: aspect).width
        let height = width / MomentPlacement.canvas
        return CGRect(x: layers.midX - width / 2, y: layers.midY - height / 2, width: width, height: height)
    }
}

/// The first screen's picture: its own colours, top to bottom, all around; on them the photo whole as taken, or the
/// canvas with the photo where it was put; its marks on it.
struct MomentsStudioWholeCanvas: View {
    let model: MomentsComposerModel

    var body: some View {
        GeometryReader { geo in
            let frames = MomentsStudioWholeFrames(model: model, screen: geo.size)
            let colors = model.marking.backdrop ?? .dark
            ZStack {
                LinearGradient(colors: [Color(uiColor: colors.top), Color(uiColor: colors.bottom)], startPoint: .top, endPoint: .bottom)
                    .accessibilityHidden(true)
                if case let .photo(image) = model.draft {
                    MomentsMarkedPhoto(
                        image: image,
                        marks: model.marking.isOpen ? model.marking.shown : model.marking.marks,
                        placement: model.studioShownPlacement,
                        backdrop: model.marking.backdrop
                    )
                    .frame(width: frames.layers.width, height: frames.layers.height)
                    .clipped()
                    .position(x: frames.layers.midX, y: frames.layers.midY)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("The photo you're posting, whole")
                    .accessibilityActions {
                        Button("Make larger") { model.studioWholeNudge(scale: 1.2) }
                        Button("Make smaller") { model.studioWholeNudge(scale: 1 / 1.2) }
                        Button("Turn left") { model.studioWholeNudge(turn: -15) }
                        Button("Turn right") { model.studioWholeNudge(turn: 15) }
                    }
                    .accessibilityIdentifier("moments.studio.whole.picture")
                    // Its colours, read once, for the backdrop around it.
                    .task(id: ObjectIdentifier(image)) { model.marking.sampleBackdrop(image) }
                }
            }
        }
    }
}

/// Everything on the picture, over a whole photo: framed where the picture is drawn. Anything else is as before.
struct MomentsStudioWholeFrame: ViewModifier {
    let model: MomentsComposerModel

    func body(content: Content) -> some View {
        if model.studioWholeOffered {
            GeometryReader { geo in
                let layers = MomentsStudioWholeFrames(model: model, screen: geo.size).layers
                content
                    .frame(width: layers.width, height: layers.height)
                    .position(x: layers.midX, y: layers.midY)
            }
        } else {
            content
        }
    }
}

extension MomentsComposerModel {
    /// The picture the stamps, items and dots are placed on: the photo or the video as it is; once placed on a canvas
    /// (Resize, or the first screen's fingers), or for a text card, the screen-filling canvas itself.
    var studioStampPicture: CGSize? {
        guard studioShownPlacement == nil else { return nil }
        switch draft {
        case let .photo(image): return studioPair == nil ? image.size : MomentBeforeAfterHalves.size(of: image.size)
        case .video: return marking.video?.size
        case .text, nil: return nil
        }
    }
}
