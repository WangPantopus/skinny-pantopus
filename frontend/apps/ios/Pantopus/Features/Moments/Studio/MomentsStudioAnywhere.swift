//
//  MomentsStudioAnywhere.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6, piece F2 on the iPhone (with section 6 I and K): text, stamps and playable items go
//  anywhere on the canvas readers get (the whole 9:16 screen, the backdrop around the picture included), at any size,
//  and nothing bounces back. The one limit: at least 24 pt of the thing itself stays on the canvas (all of a smaller
//  one), and its middle stays on it (the server takes 0 to 1 there). The moment anything lies off the picture's own
//  box while the picture is whole as taken, the picture goes onto its canvas where it shows, with everything on it, so
//  the Moment posts in its canvas form (a photo drawn into the canvas with `whole`, a video with its `placement`) and
//  readers see each thing where it was put.
//
//  Nothing is lost under the Studio's own controls (section K): the canvas is fitted whole between the top of the
//  screen's safe area and the bottom bar; stamps and items lie over the X and the tool rail, so where they overlap the
//  thing gets the touch; and while one is under a finger the controls fade to 30% and take no touches.
//
//  Only for a photo or a video on the Studio's first screen (`studioWholeOffered`), which is only while the switch is
//  on. A text card, a before-and-after and today's composer keep their bounds.
//

import SwiftUI
import UIKit

enum MomentsStudioAnywhere {
    /// How much of a thing always stays on the canvas, in points.
    static let kept: CGFloat = 24

    /// Where a thing `size` points big (its upright box) may rest with its middle at `center` (shares of `frame`): at
    /// least 24 pt of it on the canvas (`canvas`, in the same shares) on both axes, and its middle on the canvas.
    static func hold(_ center: CGPoint, size: CGSize, frame: CGSize, canvas: CGRect) -> CGPoint {
        CGPoint(
            x: axis(center.x, size: size.width, length: frame.width, low: canvas.minX, high: canvas.maxX),
            y: axis(center.y, size: size.height, length: frame.height, low: canvas.minY, high: canvas.maxY)
        )
    }

    private static func axis(_ value: CGFloat, size: CGFloat, length: CGFloat, low: CGFloat, high: CGFloat) -> CGFloat {
        guard length > 0 else { return value }
        let keep = min(kept, max(size, 0)) / length
        let half = max(size, 0) / 2 / length
        let lowest = max(low + keep - half, low)
        let highest = min(high - keep + half, high)
        return lowest > highest ? (low + high) / 2 : min(max(value, lowest), highest)
    }

    /// Whether any part of a thing lies off the picture's own box (0 to 1 of `frame`).
    static func offPicture(_ center: CGPoint, size: CGSize, frame: CGSize) -> Bool {
        let halfX = size.width / 2 / max(frame.width, 1)
        let halfY = size.height / 2 / max(frame.height, 1)
        let slack: CGFloat = 0.002
        return center.x - halfX < -slack || center.x + halfX > 1 + slack || center.y - halfY < -slack || center.y + halfY > 1 + slack
    }

    /// The upright box around `size` turned by `degrees`.
    static func turned(_ size: CGSize, by degrees: Double) -> CGSize {
        let angle = degrees * .pi / 180
        let cosine = abs(CGFloat(cos(angle)))
        let sine = abs(CGFloat(sin(angle)))
        return CGSize(width: size.width * cosine + size.height * sine, height: size.width * sine + size.height * cosine)
    }
}

extension MomentsComposerModel {
    /// The canvas readers get, in the shares things are placed in now: the whole frame once the picture is on its
    /// canvas, wider (or taller) than the picture around a picture whole as taken.
    var studioCanvasBox: CGRect {
        let all = CGRect(x: 0, y: 0, width: 1, height: 1)
        guard studioShownPlacement == nil, let aspect = studioPictureAspect else { return all }
        let map = MomentsStudioWholeMap(aspect: aspect, toCanvas: false)
        let corner = map.point(.zero)
        let end = map.point(CGPoint(x: 1, y: 1))
        return CGRect(x: corner.x, y: corner.y, width: end.x - corner.x, height: end.y - corner.y)
    }

    /// Something was put off the picture's own box (or Text opened): the picture goes onto its canvas where it shows,
    /// fitted whole, with everything on it.
    func studioWholeOntoCanvas() {
        guard studioWholeOffered, !isPosting, studioShownPlacement == nil else { return }
        studioWholeBegin()
        studioWholeEnd()
    }

    /// Whether the middle of anything on the picture would lie off its own box with the picture whole as taken again
    /// (`map` from the canvas back to the picture): then Reset keeps it on its canvas, fitted whole.
    func studioThingsOffPicture(_ map: MomentsStudioWholeMap) -> Bool {
        var points = studioStamps.map { CGPoint(x: $0.x, y: $0.y) } + marking.editing.labels.map(\.center)
        if let tools = marking.studio {
            points += tools.play.filter { $0.box == nil }.map { CGPoint(x: $0.x, y: $0.y) }
            points += tools.dots.map { CGPoint(x: $0.x, y: $0.y) } + tools.cutouts.map(\.center)
        }
        return points.map(map.point).contains { !(0...1).contains($0.x) || !(0...1).contains($0.y) }
    }

    /// A stamp or an item came under a finger, or was let go: the controls fade, or come back.
    func studioDragging(_ dragging: Bool) {
        guard marking.studio != nil, marking.studio?.dragging != dragging else { return }
        withAnimation(.easeOut(duration: 0.15)) { marking.studio?.dragging = dragging }
    }

    /// Text in the Studio: anywhere on the canvas the editor shows (its own frame, filled: the screen's width above
    /// its 68-pt reply bar), so the picture goes onto its canvas first. Set only here, while the Studio is open.
    func studioOpensText() {
        guard studioWholeOffered else { return }
        studioWholeOntoCanvas()
        guard studioShownPlacement != nil else { return }
        let window = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
        let screen = window?.bounds.size ?? CGSize(width: 402, height: 874)
        let frame = CGSize(width: screen.width, height: max(screen.height - 68, 200))
        let scale = max(frame.width / 9, frame.height / 16)
        let across = min(1, frame.width / (9 * scale))
        let down = min(1, frame.height / (16 * scale))
        marking.labelBounds = CGRect(x: (1 - across) / 2, y: (1 - down) / 2, width: across, height: down)
    }

    /// Text's wider bounds end when its editor closes. Going back to today's composer (the switch went off), with the
    /// editor closed: each label outside today's safe box is brought back into it once, and drawn in again.
    func studioTextClosed(goingBack: Bool) {
        marking.labelBounds = nil
        guard goingBack, !marking.isOpen else { return }
        var marks = marking.marks
        let held = marks.labels.map { marking.clamped($0) }
        guard held != marks.labels else { return }
        marks.labels = held
        switch draft {
        case let .photo(image): use(marked: marking.base ?? image, marks, placement: marking.placement)
        case let .video(url): if let video = marking.video { use(marked: url, video: video, marks, placement: marking.placement) }
        case .text, nil: break
        }
    }
}

// MARK: - The room the canvas is fitted in (section K 1)

/// The room between the top of the screen's safe area and the Studio's bottom bar, in the window's points.
@Observable
@MainActor
final class MomentsStudioRoom {
    var top: CGFloat = 0
    var barTop: CGFloat?

    var rect: CGRect? {
        guard let barTop, barTop > top + 120 else { return nil }
        return CGRect(x: 0, y: top, width: .greatestFiniteMagnitude, height: barTop - top)
    }
}

private struct MomentsStudioRoomKey: EnvironmentKey {
    static let defaultValue: CGRect? = nil
}

extension EnvironmentValues {
    /// Where the Studio's canvas is fitted whole, in the window's points: nil is the whole screen.
    var studioRoom: CGRect? {
        get { self[MomentsStudioRoomKey.self] }
        set { self[MomentsStudioRoomKey.self] = newValue }
    }
}

extension View {
    /// The Studio's stage: reads where its safe area starts, hands the room to the canvas and everything on it.
    func studioRoom(_ room: MomentsStudioRoom) -> some View {
        onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).minY } action: { room.top = $0 }
            .environment(\.studioRoom, room.rect)
    }

    /// The Studio's bottom bar: where it starts (kept while the keyboard is up, so the picture never jumps).
    func studioBarTop(_ room: MomentsStudioRoom, frozen: Bool) -> some View {
        onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).minY } action: { top in
            if !frozen { room.barTop = top }
        }
    }

    /// The Studio's controls, filling the screen; while a stamp or an item is under a finger, faded to 30% and taking
    /// no touches.
    func studioFillsWhileFading(_ model: MomentsComposerModel) -> some View {
        let dragging = model.marking.studio?.dragging == true
        return opacity(dragging ? 0.3 : 1)
            .allowsHitTesting(!dragging)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// The Studio's stage: stamps and items over its controls, and the room above the bar for the canvas.
    func studioItemsOnTop(
        model: MomentsComposerModel,
        stamps: MomentsStudioStamps,
        picture: CGSize?,
        room: MomentsStudioRoom
    ) -> some View {
        overlay { MomentsStudioItemsOnTop(model: model, stamps: stamps, picture: picture) }
            .studioRoom(room)
    }
}

/// Stamps and playable items over the Studio's controls (section K 3), framed as the picture is drawn.
struct MomentsStudioItemsOnTop: View {
    let model: MomentsComposerModel
    let stamps: MomentsStudioStamps
    let picture: CGSize?

    var body: some View {
        ZStack {
            MomentsStudioStampLayer(model: model, stamps: stamps, picture: picture, catchesTaps: false)
            MomentsStudioPlayLayer(model: model, picture: picture)
        }
        .modifier(MomentsStudioWholeFrame(model: model))
        .ignoresSafeArea()
        // While a Post is in flight nothing moves: what goes out is what was there when Post was tapped.
        .allowsHitTesting(!model.isPosting)
    }
}
