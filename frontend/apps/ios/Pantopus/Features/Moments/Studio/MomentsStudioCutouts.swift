//
//  MomentsStudioCutouts.swift
//  Pantopus
//
//  "Pulse, reinvented", phase 0 step 4: cutouts (board B5, "Your cutouts:
//  Long-press anything in a photo to lift it"). A long press on the Studio's
//  photo lifts the thing under the finger (Apple's Vision, on the phone),
//  where it was: drag it, pinch it, turn it, or take it off. Each one lifted
//  is kept on this phone in "Your cutouts" (the Stamps and Play tray), to put
//  on later photos. At Post the cutouts are drawn into the picture like every
//  mark, so the server and every app see an ordinary picture.
//

import SwiftUI
import UIKit
import Vision

extension MomentMarks {
    /// A cutout on the picture: its picture (clear around the thing), where its middle is (0 to 1 across and down the
    /// picture), its width as a share of the picture's, and its turn in degrees clockwise.
    struct Cutout: Equatable, Identifiable {
        let id: UUID
        let image: UIImage
        var center: CGPoint
        var width: CGFloat
        var turn: CGFloat = 0

        /// Its rectangle, upright, on a picture `size` big.
        func rect(in size: CGSize) -> CGRect {
            let wide = width * size.width
            let high = wide * image.size.height / max(image.size.width, 1)
            return CGRect(x: center.x * size.width - wide / 2, y: center.y * size.height - high / 2, width: wide, height: high)
        }
    }
}

extension MomentMarksDrawing {
    /// The cutouts, each turned about its middle, over the lines and under the words.
    static func drawCutouts(_ cutouts: [MomentMarks.Cutout], in context: CGContext, size: CGSize) {
        guard !cutouts.isEmpty else { return }
        UIGraphicsPushContext(context)
        defer { UIGraphicsPopContext() }
        for cutout in cutouts {
            let rect = cutout.rect(in: size)
            context.saveGState()
            context.translateBy(x: rect.midX, y: rect.midY)
            context.rotate(by: cutout.turn * .pi / 180)
            cutout.image.draw(in: CGRect(x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height))
            context.restoreGState()
        }
    }
}

// MARK: - Lifting one

extension MomentsSubject {
    /// The thing under `point` (0 to 1 across and down the picture the marks are on) lifted out of `photo` (drawn on
    /// its canvas when placed): its picture cropped to it, and where it sat. Nil when nothing is there.
    static func cutout(
        _ photo: UIImage,
        placement: MomentPlacement?,
        backdrop: MomentPlacement.Backdrop?,
        at point: CGPoint
    ) async -> MomentMarks.Cutout? {
        await Task.detached(priority: .userInitiated) {
            guard let surface = surface(photo, placement: placement, backdrop: backdrop) else { return nil }
            let request = foregroundRequest()
            let handler = VNImageRequestHandler(cgImage: surface, options: [:])
            guard (try? handler.perform([request])) != nil, let observation = request.results?.first else {
                #if targetEnvironment(simulator)
                // Vision can't run in the simulator: an oval around the finger stands in (`standIn`).
                let oval = CGRect(x: point.x - 0.15, y: point.y - 0.12, width: 0.3, height: 0.24)
                guard let whole = standIn(surface, oval: oval),
                      let cropped = whole.cropping(to: CGRect(
                          x: oval.minX * CGFloat(surface.width),
                          y: oval.minY * CGFloat(surface.height),
                          width: oval.width * CGFloat(surface.width),
                          height: oval.height * CGFloat(surface.height)
                      ).integral)
                else { return nil }
                return MomentMarks.Cutout(id: UUID(), image: UIImage(cgImage: cropped), center: point, width: 0.3)
                #else
                return nil
                #endif
            }
            let mask = observation.instanceMask
            CVPixelBufferLockBaseAddress(mask, .readOnly)
            defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
            guard let base = CVPixelBufferGetBaseAddress(mask) else { return nil }
            let (wide, high, row) = (CVPixelBufferGetWidth(mask), CVPixelBufferGetHeight(mask), CVPixelBufferGetBytesPerRow(mask))
            let bytes = base.assumingMemoryBound(to: UInt8.self)
            // The thing under the finger, or the one nearest it within a finger's reach.
            var instance = Int(bytes[min(Int(point.y * CGFloat(high)), high - 1) * row + min(Int(point.x * CGFloat(wide)), wide - 1)])
            if instance == 0 { instance = nearest(bytes, grid: MaskGrid(wide: wide, high: high, row: row), to: point, reach: 0.06) }
            guard instance > 0, observation.allInstances.contains(instance) else { return nil }
            // Where it sits: the box around its pixels.
            var box = (minX: wide, minY: high, maxX: -1, maxY: -1)
            for y in 0..<high {
                for x in 0..<wide where bytes[y * row + x] == instance {
                    box = (min(box.minX, x), min(box.minY, y), max(box.maxX, x), max(box.maxY, y))
                }
            }
            guard box.maxX >= box.minX, box.maxY >= box.minY,
                  let lifted = try? observation.generateMaskedImage(
                      ofInstances: IndexSet(integer: instance),
                      from: handler,
                      croppedToInstancesExtent: true
                  ),
                  let image = cgImage(lifted)
            else { return nil }
            let center = CGPoint(
                x: (CGFloat(box.minX + box.maxX + 1) / 2) / CGFloat(wide),
                y: (CGFloat(box.minY + box.maxY + 1) / 2) / CGFloat(high)
            )
            return MomentMarks.Cutout(
                id: UUID(),
                image: UIImage(cgImage: image),
                center: center,
                width: CGFloat(box.maxX - box.minX + 1) / CGFloat(wide)
            )
        }.value
    }

    /// The instance nearest `point` within `reach` (a share of the picture's width), 0 for none.
    /// An instance mask's size and its bytes per row.
    struct MaskGrid {
        let wide: Int
        let high: Int
        let row: Int
    }

    private static func nearest(_ bytes: UnsafePointer<UInt8>, grid: MaskGrid, to point: CGPoint, reach: CGFloat) -> Int {
        let (wide, high, row) = (grid.wide, grid.high, grid.row)
        let radius = max(1, Int(reach * CGFloat(wide)))
        let (cx, cy) = (Int(point.x * CGFloat(wide)), Int(point.y * CGFloat(high)))
        var best = (instance: 0, distance: Int.max)
        for y in max(cy - radius, 0)...min(cy + radius, high - 1) {
            for x in max(cx - radius, 0)...min(cx + radius, wide - 1) {
                let value = Int(bytes[y * row + x])
                let distance = (x - cx) * (x - cx) + (y - cy) * (y - cy)
                if value > 0, distance < best.distance { best = (value, distance) }
            }
        }
        return best.instance
    }
}

// MARK: - Your cutouts, kept on this phone

/// The cutouts lifted on this phone, newest first, as pictures in the app's own folder: never sent anywhere until one
/// is posted inside a photo. The 24 newest are kept, per account: another account signed in on this phone has its own,
/// and with nobody signed in none are kept or listed.
@MainActor
@Observable
final class MomentsCutoutShelf {
    static let shared = MomentsCutoutShelf()
    static let most = 24

    struct Kept: Identifiable, Equatable {
        let id: UUID
        let image: UIImage
    }

    private(set) var kept: [Kept] = []
    /// The account whose cutouts `kept` holds.
    @ObservationIgnored private var loadedFor: String?

    /// The signed-in person's own folder; nil with nobody signed in.
    private static var folder: URL? {
        guard let account = MomentsComposerModel.account else { return nil }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("StudioCutouts", isDirectory: true)
            .appendingPathComponent(account, isDirectory: true)
    }

    /// Reads the signed-in person's kept cutouts, once per account in an app run.
    func load() {
        let account = MomentsComposerModel.account
        guard loadedFor != account || account == nil else { return }
        loadedFor = account
        guard let folder = Self.folder else {
            kept = []
            return
        }
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ??
            []
        kept = files
            .filter { $0.pathExtension == "png" }
            .sorted { modified($0) > modified($1) }
            .compactMap { url in
                guard let id = UUID(uuidString: url.deletingPathExtension().lastPathComponent),
                      let image = UIImage(contentsOfFile: url.path) else { return nil }
                return Kept(id: id, image: image)
            }
    }

    /// Keeps a newly lifted cutout first; the oldest beyond 24 go.
    func keep(_ cutout: MomentMarks.Cutout) {
        load()
        guard let folder = Self.folder, let png = cutout.image.pngData() else { return }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? png.write(to: folder.appendingPathComponent("\(cutout.id.uuidString).png"), options: .atomic)
        kept.insert(Kept(id: cutout.id, image: cutout.image), at: 0)
        while kept.count > Self.most, let last = kept.popLast() {
            try? FileManager.default.removeItem(at: folder.appendingPathComponent("\(last.id.uuidString).png"))
        }
    }

    /// Removes one from this phone for good.
    func remove(_ id: UUID) {
        kept.removeAll { $0.id == id }
        guard let folder = Self.folder else { return }
        try? FileManager.default.removeItem(at: folder.appendingPathComponent("\(id.uuidString).png"))
    }

    private func modified(_ url: URL) -> Date {
        (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
    }
}

// MARK: - On the Studio's picture

extension MomentsComposerModel {
    /// The picture the cutouts sit on, its own size (the canvas once placed); nil for a text card or a video not read.
    var studioCutoutSurface: CGSize? {
        // A before and after takes stamps only (`MomentsStudioBeforeAfter`).
        if studioPair != nil { return nil }
        if studioShownPlacement != nil { return MomentPlacement.pixels }
        switch draft {
        case let .photo(image): return image.size
        case .video: return marking.video?.size
        case .text, nil: return nil
        }
    }

    /// Puts a cutout on the picture (one lifted here, or one of "Your cutouts" in the middle at a third of its width).
    func placeStudioCutout(_ cutout: MomentMarks.Cutout) {
        if marking.studio == nil { marking.studio = MomentsStudioTools() }
        marking.studio?.cutouts.append(cutout)
        marking.studio?.pickedCutout = cutout.id
    }

    /// At Post: the cutouts become part of the picture, drawn in like every mark, and the photo or video is made ready
    /// again with them. Nothing to do without cutouts.
    func drawInStudioCutouts() {
        guard let cutouts = marking.studio?.cutouts, !cutouts.isEmpty else { return }
        var marks = marking.marks
        marks.cutouts.append(contentsOf: cutouts)
        marking.studio?.cutouts = []
        marking.studio?.pickedCutout = nil
        switch draft {
        case let .photo(image):
            use(marked: marking.base ?? image, marks, placement: marking.placement)
        case let .video(url):
            if let video = marking.video { use(marked: url, video: video, marks, placement: marking.placement) }
        case .text, nil:
            return
        }
    }
}

/// The cutouts over the Studio's picture, and the long press that lifts one. Under the stamps, over the picture.
struct MomentsStudioCutoutLayer: View {
    let model: MomentsComposerModel
    /// A short line over the picture while lifting, or when nothing could be lifted.
    @State private var note: String?
    @State private var pressing: Task<Void, Never>?

    var body: some View {
        GeometryReader { geo in
            if let surface = model.studioCutoutSurface {
                let frame = MomentMarks.fill(surface, in: geo.size)
                // While the picture shows whole (`MomentsStudioWhole`), fingers on it move, size and turn it, and a press
                // held still lifts a cutout as before.
                let whole = model.studioWholeOffered ? MomentsStudioWholeFrames.canvas(around: geo.frame(in: .global), model: model) : nil
                ZStack {
                    if let whole {
                        MomentsStudioWholeTouches(
                            model: model,
                            canvas: whole,
                            onHold: { point in Task { await lift(at: point) } },
                            onHoldEnd: { model.marking.studio?.pickedCutout = nil },
                            onTap: { model.marking.studio?.pickedCutout = nil }
                        )
                        .accessibilityHidden(true)
                    } else {
                        Color.clear
                            .contentShape(Rectangle())
                            .gesture(longPress(frame: frame))
                            .accessibilityHidden(true)
                    }
                    ForEach(model.marking.studio?.cutouts ?? []) { cutout in
                        MomentsStudioPlacedCutout(model: model, cutout: cutout, frame: frame)
                    }
                    if let note {
                        noteView(note).position(x: geo.size.width / 2, y: geo.size.height * 0.42)
                    }
                }
            }
        }
    }

    private func noteView(_ words: String) -> some View {
        Text(words)
            .scaledFont(14, weight: .semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Capsule().fill(Color.black.opacity(0.7)))
            .allowsHitTesting(false)
            .accessibilityIdentifier("moments.studio.cutout.note")
    }

    /// Held still for half a second: the thing under the finger is lifted (a photo only; a video's thing moves).
    private func longPress(frame: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if hypot(value.translation.width, value.translation.height) > 10 {
                    pressing?.cancel()
                    pressing = nil
                    return
                }
                guard pressing == nil else { return }
                let start = value.startLocation
                pressing = Task {
                    try? await Task.sleep(for: .milliseconds(500))
                    guard !Task.isCancelled else { return }
                    await lift(at: CGPoint(x: (start.x - frame.minX) / frame.width, y: (start.y - frame.minY) / frame.height))
                }
            }
            .onEnded { _ in
                pressing?.cancel()
                pressing = nil
                model.marking.studio?.pickedCutout = nil
            }
    }

    private func lift(at point: CGPoint) async {
        guard case let .photo(image) = model.draft else {
            return say("Cutouts lift from photos.")
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        note = "Lifting…"
        let cutout = await MomentsSubject.cutout(
            model.marking.base ?? image,
            placement: model.marking.placement,
            backdrop: model.marking.backdrop,
            at: point
        )
        guard let cutout else { return say("Nothing to lift there. Try holding on a person, a pet or a thing.") }
        note = nil
        model.placeStudioCutout(cutout)
        MomentsCutoutShelf.shared.keep(cutout)
        AccessibilityNotification.Announcement("Cutout lifted. It's in Your cutouts too.").post()
    }

    private func say(_ words: String) {
        note = words
        AccessibilityNotification.Announcement(words).post()
        Task {
            try? await Task.sleep(for: .seconds(2.5))
            if note == words { note = nil }
        }
    }
}

/// One cutout on the picture: drag to move, pinch to size, twist to turn, tap to pick (and take it off).
private struct MomentsStudioPlacedCutout: View {
    let model: MomentsComposerModel
    let cutout: MomentMarks.Cutout
    let frame: CGRect
    @GestureState private var drag: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var turn: Angle = .zero

    var body: some View {
        let picked = model.marking.studio?.pickedCutout == cutout.id
        let rect = cutout.rect(in: frame.size)
        let size = CGSize(width: rect.width * pinch, height: rect.height * pinch)
        let center = CGPoint(x: frame.minX + rect.midX + drag.width, y: frame.minY + rect.midY + drag.height)
        let angle: Angle = .degrees(Double(cutout.turn)) + turn
        return framed(picked: picked, size: size)
            .rotationEffect(angle)
            .position(center)
            .gesture(moving.simultaneously(with: pinching).simultaneously(with: turning))
            .onTapGesture { model.marking.studio?.pickedCutout = picked ? nil : cutout.id }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Cutout")
            .accessibilityHint("Drag to move it, pinch to size it")
            .accessibilityAction(named: "Make larger") { update { $0.width = min($0.width * 1.2, 1.5) } }
            .accessibilityAction(named: "Make smaller") { update { $0.width = max($0.width / 1.2, 0.05) } }
            .accessibilityAction(named: "Take it off") { takeOff() }
            .accessibilityIdentifier("moments.studio.cutout")
    }

    /// The cutout at `size`, with the dashed frame and the take-off button while it's the picked one.
    private func framed(picked: Bool, size: CGSize) -> some View {
        Image(uiImage: cutout.image)
            .resizable()
            .frame(width: size.width, height: size.height)
            .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 3)
            .overlay { if picked { pickedFrame } }
            .overlay(alignment: .topTrailing) { if picked { removeButton } }
    }

    private var pickedFrame: some View {
        RoundedRectangle(cornerRadius: 10)
            .stroke(Color.white, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            .padding(-6)
    }

    private var removeButton: some View {
        Button { takeOff() } label: {
            Icon(.x, size: 12, strokeWidth: 3, color: .white)
                .frame(width: 24, height: 24)
                .background(Circle().fill(Color.black.opacity(0.75)))
                .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                .contentShape(Circle().inset(by: -8))
        }
        .buttonStyle(.plain)
        .offset(x: 14, y: -14)
        .accessibilityLabel("Take it off")
        .accessibilityIdentifier("moments.studio.cutout.remove")
    }

    private func takeOff() {
        model.marking.studio?.cutouts.removeAll { $0.id == cutout.id }
        model.marking.studio?.pickedCutout = nil
    }

    private var moving: some Gesture {
        DragGesture(minimumDistance: 2)
            .updating($drag) { value, state, _ in state = value.translation }
            .onEnded { value in
                update {
                    $0.center.x = min(max($0.center.x + value.translation.width / max(frame.width, 1), 0), 1)
                    $0.center.y = min(max($0.center.y + value.translation.height / max(frame.height, 1), 0), 1)
                }
            }
    }

    private var pinching: some Gesture {
        MagnifyGesture()
            .updating($pinch) { value, state, _ in state = value.magnification }
            .onEnded { value in update { $0.width = min(max($0.width * value.magnification, 0.05), 1.5) } }
    }

    private var turning: some Gesture {
        RotateGesture()
            .updating($turn) { value, state, _ in state = value.rotation }
            .onEnded { value in
                update { $0.turn = (($0.turn + value.rotation.degrees + 180).truncatingRemainder(dividingBy: 360)) - 180 }
            }
    }

    private func update(_ change: (inout MomentMarks.Cutout) -> Void) {
        guard var tools = model.marking.studio, let index = tools.cutouts.firstIndex(where: { $0.id == cutout.id }) else { return }
        change(&tools.cutouts[index])
        model.marking.studio = tools
    }
}
