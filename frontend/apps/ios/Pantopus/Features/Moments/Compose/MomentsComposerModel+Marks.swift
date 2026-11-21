//
//  MomentsComposerModel+Marks.swift
//  Pantopus
//
//  Text, Draw and Resize on the photo on the Post screen (boards T1–T3): the
//  marks the picture carries and where it sits on the canvas, the editor
//  while it's open and what's being changed in it (the line being drawn, the
//  label being typed or moved, the picture being moved), all held by
//  the composer's model so a fold on the iPhone Duo keeps them. Done flattens the marks into the photo that goes up
//  (`use(marked:_:)`); the X drops what changed in that visit. A new picture
//  starts clean (the draft's `didSet`), so several picked together never
//  carry one's marks to the next.
//

import SwiftUI
import UIKit

@Observable
@MainActor
final class MomentsMarking {
    enum Tool: Equatable {
        case draw, text, resize
    }

    /// The photo at 2048 px or less, made when the editor first opens: what Done draws the marks onto.
    private(set) var base: UIImage?
    /// A video's picture as it's shown and its length (read when the editor first opens on it).
    private(set) var video: (size: CGSize, seconds: Double)?
    /// The marks on the Post screen's picture: what Done kept.
    private(set) var marks = MomentMarks()
    /// Where Done left the picture on the canvas (Resize, `+Resize`); nil: as taken.
    private(set) var placement: MomentPlacement?
    /// While the editor is open: where the picture is being moved to, nil while it's at cover. Resize changes it through
    /// `place(_:)`, which moves the marks when the picture changes state.
    var editingPlacement: MomentPlacement?
    /// The placed canvas's background, read from the photo when the editor first opens on it.
    var backdrop: MomentPlacement.Backdrop?
    /// Resize: a finger has touched the picture in this visit (the hint goes), and the picture is moving now (the part
    /// every phone shows is outlined).
    var resizeTouched = false
    var resizeMoving = false
    /// Resize: the gesture moving the picture, before its sticking.
    @ObservationIgnored var gesture: MomentPlacement?
    @ObservationIgnored var sampling: Task<Void, Never>?
    /// The editor is showing.
    private(set) var isOpen = false
    /// While the editor is open: the marks as they are being changed.
    private(set) var editing = MomentMarks()
    var tool = Tool.draw
    /// Draw's ink and line width (board T3 starts yellow, medium).
    var ink = MomentMarks.Ink.yellow
    var width = MomentMarks.Width.medium
    /// Text: the label with the keyboard, and the one picked (a pinch resizes it, the look and ink apply to it).
    private(set) var typing: UUID?
    private(set) var picked: UUID?
    /// Text's look and ink for the next label (board T2 starts on Label, white): the picked label's once one is.
    private(set) var style = MomentMarks.Style.label
    private(set) var textInk = MomentMarks.Ink.white
    /// The picture's own shape (width over height).
    @ObservationIgnored private(set) var pictureAspect: CGFloat = 1
    /// Text was opened: a new label appears in the middle with the keyboard up (once, so a fold doesn't add another).
    @ObservationIgnored var addsLabel = false
    /// Where a label was when a drag or a pinch on it began.
    @ObservationIgnored private var movedFrom: CGPoint?
    @ObservationIgnored private var sizedFrom: CGFloat?
    /// The editor's X asks first when something changed in this visit.
    var asksCancel = false
    /// Retake asks first when the picture has marks.
    var asksRetake = false
    /// A finger is drawing a line.
    @ObservationIgnored private var drawing = false
    @ObservationIgnored private var making: Task<Void, Never>?

    /// The marks the canvas draws while editing: all but the label being typed in, which is a text field.
    var shown: MomentMarks {
        guard let typing else { return editing }
        var shown = editing
        shown.labels.removeAll { $0.id == typing }
        return shown
    }

    /// Something changed in this visit to the editor.
    var changed: Bool {
        isOpen && (editing != marks || editingPlacement != placement)
    }

    /// The shape the marks are in (width over height), what the part every phone shows is worked out from: the
    /// picture's, or the canvas's once the picture is placed.
    var aspect: CGFloat {
        editingPlacement == nil ? pictureAspect : MomentPlacement.canvas
    }

    /// A new picture, Retake, or the composer starting again: no marks, the editor closed.
    func clear() {
        making?.cancel()
        making = nil
        sampling?.cancel()
        sampling = nil
        base = nil
        video = nil
        marks = MomentMarks()
        editing = MomentMarks()
        (placement, editingPlacement, backdrop, gesture) = (nil, nil, nil, nil)
        (resizeTouched, resizeMoving) = (false, false)
        isOpen = false
        asksCancel = false
        asksRetake = false
        drawing = false
        typing = nil
        picked = nil
    }

    /// Opens the editor on a picture `size` big (a photo's, or a video's as shown) with the marks it has, still
    /// editable. For a photo, the 2048 px copy is made the first time.
    func open(_ tool: Tool, size: CGSize, photo image: UIImage?) {
        self.tool = tool
        editing = marks
        editingPlacement = placement
        drawing = false
        (typing, picked) = (nil, nil)
        (resizeTouched, resizeMoving, gesture) = (false, false, nil)
        pictureAspect = size.height > 0 ? size.width / size.height : 1
        addsLabel = tool == .text && marks.labels.count < MomentMarks.maxLabels
        isOpen = true
        if tool == .resize, let image { sampleBackdrop(image) }
        guard let image, base == nil, making == nil else { return }
        making = Task { [weak self] in
            let made = await MomentMarksDrawing.base(image)
            guard !Task.isCancelled else { return }
            self?.base = made
        }
    }

    /// A video on the Post screen: its picture's size and length, for the editor and for Done.
    func opened(video size: CGSize, seconds: Double) {
        video = (size, seconds)
    }

    /// Done: the picture carries `marks` now, drawn on `base` (a photo's) or over every frame (a video's), and sits at
    /// `placement` on the canvas (nil: as taken).
    func keep(
        _ marks: MomentMarks,
        base: UIImage?,
        video: (size: CGSize, seconds: Double)? = nil,
        placement: MomentPlacement? = nil,
        backdrop: MomentPlacement.Backdrop? = nil
    ) {
        self.marks = marks
        self.base = base
        self.video = video
        self.placement = placement
        self.backdrop = backdrop
        editing = marks
        editingPlacement = placement
        (resizeMoving, gesture) = (false, nil)
        (typing, picked) = (nil, nil)
        isOpen = false
    }

    /// The X (after asking, when something changed): what changed in this visit goes.
    func cancel() {
        editing = marks
        editingPlacement = placement
        (resizeMoving, gesture) = (false, nil)
        asksCancel = false
        (typing, picked) = (nil, nil)
        isOpen = false
    }

    // MARK: - Draw

    /// A finger at `point` (picture coordinates) on a picture shown `pictureWidth` points wide: a new line when the
    /// finger has just come down, else the line goes on.
    func draw(at point: CGPoint, pictureWidth: CGFloat) {
        guard isOpen, pictureWidth > 0 else { return }
        if !drawing {
            guard editing.strokes.count < MomentMarks.maxStrokes else { return }
            drawing = true
            editing.strokes.append(MomentMarks.Stroke(points: [point], ink: ink, width: width.points / pictureWidth))
            return
        }
        guard let last = editing.strokes.indices.last, let previous = editing.strokes[last].points.last else { return }
        // Under half a point apart on the screen adds nothing to the line.
        guard hypot(point.x - previous.x, point.y - previous.y) * pictureWidth >= 0.5 else { return }
        editing.strokes[last].points.append(point)
    }

    func endLine() {
        drawing = false
    }

    /// Resize (`+Resize`): the marks being changed, moved to the coordinates of the picture's new state.
    func moveMarks(_ moved: MomentMarks) {
        editing = moved
    }

    /// Undo: the last line goes.
    func undo() {
        guard !editing.strokes.isEmpty else { return }
        drawing = false
        editing.strokes.removeLast()
    }
}

// MARK: - Text (board T2)

extension MomentsMarking {
    func label(_ id: UUID) -> MomentMarks.Label? {
        editing.labels.first { $0.id == id }
    }

    /// A new label, typed in at once, at `point` (picture coordinates), held between `rows` like a dragged one: false
    /// at five labels.
    @discardableResult
    func addLabel(at point: CGPoint, pictureWidth: CGFloat, within rows: ClosedRange<CGFloat>) -> Bool {
        guard isOpen, tool == .text, pictureWidth > 0 else { return false }
        endTyping()
        guard editing.labels.count < MomentMarks.maxLabels else { return false }
        let label = clamped(hold(clamped(MomentMarks.Label(
            id: UUID(),
            text: "",
            style: style,
            ink: textInk,
            center: point,
            size: MomentMarks.newLetterPoints / pictureWidth
        )), within: rows))
        editing.labels.append(label)
        (typing, picked) = (label.id, label.id)
        return true
    }

    /// A tap on a label: it takes the keyboard (the one typed in before is finished first).
    func startTyping(_ id: UUID) {
        guard typing != id else { return }
        endTyping()
        guard label(id) != nil else { return }
        typing = id
        pick(id)
    }

    /// The keyboard went away: a label left empty goes.
    func endTyping() {
        guard let id = typing else { return }
        typing = nil
        guard label(id)?.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true else { return }
        editing.labels.removeAll { $0.id == id }
        if picked == id { picked = nil }
    }

    /// What's typed in the label with the keyboard, up to 80 characters.
    func type(_ text: String) {
        guard let id = typing else { return }
        update(id) { $0.text = String(text.prefix(MomentMarks.maxLetters)) }
    }

    /// The label picked takes the look and ink row.
    func pick(_ id: UUID) {
        picked = id
        if let label = label(id) { (style, textInk) = (label.style, label.ink) }
    }

    /// A finger dragging a label, `translation` in picture coordinates since it came down. The label also stays
    /// between `rows` (picture heights), clear of the editor's own buttons, so it can always be picked up again.
    func drag(_ id: UUID, by translation: CGSize, within rows: ClosedRange<CGFloat>) {
        guard let label = label(id) else { return }
        if movedFrom == nil {
            movedFrom = label.center
            pick(id)
        }
        guard let from = movedFrom else { return }
        update(id) { moved in
            moved.center = CGPoint(x: from.x + translation.width, y: from.y + translation.height)
            moved = hold(moved, within: rows)
        }
    }

    /// `label` with its middle where its whole box stays between `rows` (picture heights), when it fits there.
    private func hold(_ label: MomentMarks.Label, within rows: ClosedRange<CGFloat>) -> MomentMarks.Label {
        var label = label
        let half = MomentMarksDrawing.lay(label, aspect: aspect).box.height / 2 / (MomentMarksDrawing.unit / max(aspect, 0.01))
        label.center.y = Self.within(label.center.y, rows.lowerBound + half, rows.upperBound - half)
        return label
    }

    func endDrag() {
        movedFrom = nil
    }

    /// Two fingers pinching anywhere on the picture: the picked label grows or shrinks.
    func pinch(_ magnification: CGFloat) {
        guard let id = typing ?? picked, let label = label(id) else { return }
        if sizedFrom == nil { sizedFrom = label.size }
        guard let from = sizedFrom else { return }
        update(id) { $0.size = from * magnification }
    }

    func endPinch() {
        sizedFrom = nil
    }

    /// The look row: for the picked label, and the next one.
    func setStyle(_ style: MomentMarks.Style) {
        self.style = style
        if let id = typing ?? picked { update(id) { $0.style = style } }
    }

    /// The ink row: for the picked label, and the next one.
    func setTextInk(_ ink: MomentMarks.Ink) {
        textInk = ink
        if let id = typing ?? picked { update(id) { $0.ink = ink } }
    }

    /// VoiceOver's moves: a step across or down the picture.
    func nudge(_ id: UUID, dx: CGFloat, dy: CGFloat) {
        pick(id)
        update(id) { $0.center = CGPoint(x: $0.center.x + dx, y: $0.center.y + dy) }
    }

    /// VoiceOver's Make larger and Make smaller.
    func scale(_ id: UUID, by factor: CGFloat) {
        pick(id)
        update(id) { $0.size *= factor }
    }

    /// VoiceOver's Delete.
    func delete(_ id: UUID) {
        if typing == id { typing = nil }
        if picked == id { picked = nil }
        editing.labels.removeAll { $0.id == id }
    }

    /// Changes one label and holds it to the part every phone shows.
    private func update(_ id: UUID, _ change: (inout MomentMarks.Label) -> Void) {
        guard let index = editing.labels.firstIndex(where: { $0.id == id }) else { return }
        var label = editing.labels[index]
        change(&label)
        editing.labels[index] = clamped(label)
    }

    /// `label` inside the part every phone shows: letters no smaller than the picture check reads and no larger than
    /// fit there with every word on one line, and its middle where the whole label stays inside.
    func clamped(_ label: MomentMarks.Label) -> MomentMarks.Label {
        var label = label
        let safe = MomentMarks.safeBox(aspect: aspect)
        let unit = MomentMarksDrawing.unit
        let tall = unit / max(aspect, 0.01)
        let smallest = MomentMarks.minLetterSize(aspect: aspect)
        label.size = min(max(label.size, smallest), MomentMarks.maxLetterSize)
        var laid = MomentMarksDrawing.lay(label, aspect: aspect)
        /// Smaller while it overflows the box, or while a word that could fit a whole line (13.1 letters) doesn't fit the
        /// line it has (it would break inside the word). A longer word (a web address) keeps the size and breaks.
        func breaksWord() -> Bool {
            let word = MomentMarksDrawing.longestWord(label)
            return word > laid.wordsRect.width && word <= label.size * unit * MomentMarksDrawing.wrap
        }
        while laid.box.width > safe.width * unit + 0.5 || laid.box.height > safe.height * tall + 0.5 || breaksWord(),
              label.size > smallest {
            label.size = max(smallest, label.size * 0.95)
            laid = MomentMarksDrawing.lay(label, aspect: aspect)
        }
        let half = CGSize(width: laid.box.width / 2 / unit, height: laid.box.height / 2 / tall)
        label.center.x = Self.within(label.center.x, safe.minX + half.width, safe.maxX - half.width)
        label.center.y = Self.within(label.center.y, safe.minY + half.height, safe.maxY - half.height)
        return label
    }

    private static func within(_ value: CGFloat, _ low: CGFloat, _ high: CGFloat) -> CGFloat {
        low > high ? (low + high) / 2 : min(max(value, low), high)
    }
}

/// What the marks editor shows under the marks: the photo, or the video (as shown, after the phone's rotation).
enum MomentsMarkedMedia {
    case photo(UIImage)
    case video(URL, size: CGSize)

    var size: CGSize {
        switch self {
        case let .photo(image): image.size
        case let .video(_, size): size
        }
    }

    var isVideo: Bool {
        if case .video = self { return true }
        return false
    }
}

extension MomentsComposerModel {
    /// Text and Draw are offered on a photo or a video. They are off while a Post is going (it would swap the file
    /// being sent).
    var offersMarks: Bool {
        switch draft {
        case .photo, .video: true
        case .text, nil: false
        }
    }

    /// What the open editor marks.
    var markedMedia: MomentsMarkedMedia? {
        switch draft {
        case let .photo(image): .photo(image)
        case let .video(url): marking.video.map { .video(url, size: $0.size) }
        case .text, nil: nil
        }
    }

    /// The Post screen's Text or Draw pill. A video's size and length are read first (once).
    func openMarks(_ tool: MomentsMarking.Tool) {
        guard !isPosting else { return }
        switch draft {
        case let .photo(image):
            marking.open(tool, size: image.size, photo: image)
        case let .video(url):
            if let video = marking.video { return marking.open(tool, size: video.size, photo: nil) }
            Task {
                guard let shown = await MomentsMediaExport.shown(url), draft == .video(url), !isPosting else { return }
                marking.opened(video: shown.size, seconds: shown.seconds)
                marking.open(tool, size: shown.size, photo: nil)
            }
        case .text, nil:
            return
        }
    }

    /// The editor's Done: nothing changed closes it; else the photo goes up with the marks drawn in, or the video is
    /// exported again with them over every frame of every part.
    func applyMarks() {
        marking.endTyping()
        guard marking.changed else { return marking.cancel() }
        switch draft {
        case let .photo(image): use(marked: marking.base ?? image, marking.editing, placement: marking.editingPlacement)
        case let .video(url): if let video = marking.video { use(marked: url, video: video, marking.editing) }
        case .text, nil: marking.cancel()
        }
    }

    /// The editor's X: asks first when something changed.
    func cancelMarks() {
        marking.endTyping()
        if marking.changed {
            marking.asksCancel = true
        } else {
            marking.cancel()
        }
    }

    /// Retake on a picture with marks, or a placed one, asks first ("Discard this Moment?").
    func askRetake() {
        guard !isSending else { return }
        if marking.marks.isEmpty, marking.placement == nil {
            retake()
        } else {
            marking.asksRetake = true
        }
    }
}
