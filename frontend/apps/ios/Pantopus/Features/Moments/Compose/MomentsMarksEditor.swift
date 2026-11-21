//
//  MomentsMarksEditor.swift
//  Pantopus
//
//  Text, Draw and Resize on the photo being posted (boards T2, T3). The
//  picture (or, once it's placed, its 9:16 canvas) is shown in the viewer's
//  own frame (the phone's full width above the reply bar, filled and cropped
//  as people will see it), with a dashed line where labels may begin, below
//  the lowest any viewer's top bar reaches. On the
//  iPhone Duo it is the same card the Post screen shows for each pose, with
//  the controls over it. X drops what
//  changed in this visit (asking first when something did); Done keeps it.
//  The editor is a branch of the composer's stack and its state lives in the
//  composer's model (`MomentsMarking`), so a fold keeps it.
//

import SwiftUI

struct MomentsMarksEditor: View {
    let model: MomentsComposerModel
    let media: MomentsMarkedMedia
    @Environment(\.momentsDuoScreen) var duo
    /// Where the keyboard's top is on the screen (the screen's bottom while it's down), and where the looks and inks
    /// begin: a label being typed in stays above both.
    @State var keyboardTop: CGFloat = .infinity
    @State var footerTop: CGFloat = .infinity

    var marking: MomentsMarking {
        model.marking
    }

    /// What fills the frame and carries the marks: the picture, or its canvas while it's placed and all through Resize.
    var surface: CGSize {
        marking.tool == .resize || marking.editingPlacement != nil ? MomentPlacement.pixels : media.size
    }

    var body: some View {
        asksBeforeCancel(ZStack {
            screenLayer
            keyboardReader
        })
        .accessibilityElement(children: .contain)
        .accessibilityAction(.escape) { model.cancelMarks() }
        .accessibilityIdentifier("moments.marks")
    }

    /// The X's question when something changed in this visit.
    private func asksBeforeCancel(_ content: some View) -> some View {
        let asks = Binding(get: { marking.asksCancel }, set: { marking.asksCancel = $0 })
        return content.alert("Discard your changes?", isPresented: asks) {
            Button("Discard", role: .destructive) { marking.cancel() }
                .accessibilityIdentifier("moments.marks.discard")
            Button("Keep editing", role: .cancel) {}
                .accessibilityIdentifier("moments.marks.keep")
        }
    }

    /// The safe area as this cover has it (the keyboard never moves the picture).
    private var screenLayer: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            let width = geo.size.width + insets.leading + insets.trailing
            screen(size: CGSize(width: width, height: geo.size.height + insets.top + insets.bottom), insets: insets)
        }
        .ignoresSafeArea(.keyboard)
    }

    /// The keyboard's top, from a layer that gives way to it.
    private var keyboardReader: some View {
        Color.clear
            .ignoresSafeArea(.container)
            .allowsHitTesting(false)
            .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: { keyboardTop = $0 }
    }

    /// Everything in the screen's own points, from its top-left corner.
    private func screen(size: CGSize, insets: EdgeInsets) -> some View {
        let frame = pictureFrame(size)
        let full = controlRoom(frame, size: size, insets: insets)
        // With the keyboard up, the looks and inks sit right above it.
        let typing = keyboardTop < size.height - max(insets.bottom, 1) - 1
        let room = typing ? CGRect(
            x: full.minX,
            y: full.minY,
            width: full.width,
            height: max(min(full.maxY, keyboardTop - Spacing.s2) - full.minY, 0)
        ) : full
        // Between the top bar's buttons and the bottom controls: where labels are put and dragged.
        let free = (room.minY + 48 - frame.minY)...max(room.minY + 48 - frame.minY, footerTop - frame.minY - Spacing.s1)
        return ZStack(alignment: .topLeading) {
            Color.black
            pictureArea(frame: frame, free: free)
                .overlay {
                    if marking.tool == .text {
                        MomentsMarksTextLayer(marking: marking, picture: surface, size: frame.size, free: free)
                    }
                }
                .overlay(alignment: .top) { viewerStrip(frame) }
                .overlay(alignment: .bottom) {
                    LinearGradient(colors: [.clear, Color.black.opacity(0.5)], startPoint: .top, endPoint: .bottom)
                        .frame(height: min(200, frame.height / 3))
                        .allowsHitTesting(false)
                }
                .clipShape(pictureShape)
                .offset(x: frame.minX, y: frame.minY)
            VStack(spacing: 0) {
                topBar
                Spacer(minLength: Spacing.s2)
                Group {
                    switch marking.tool {
                    case .text: textFooter(width: room.width, typing: typing)
                    case .draw: drawFooter(width: room.width)
                    case .resize: resizeFooter(width: room.width, aboveEdge: max(room.maxY - frame.maxY, 0) + Spacing.s3)
                    }
                }
                .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).minY } action: { footerTop = $0 }
            }
            .frame(width: room.width, height: room.height)
            .overlay(alignment: .trailing) { if marking.tool == .draw { widthColumn } }
            .offset(x: room.minX, y: room.minY)
            if marking.tool == .resize, resetOnStrip { stripReset(below: frame, width: size.width) }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .ignoresSafeArea()
    }

    /// The picture under the marks: Resize's, which the fingers move, or Draw and Text's.
    @ViewBuilder
    private func pictureArea(frame: CGRect, free: ClosedRange<CGFloat>) -> some View {
        if marking.tool == .resize, case let .photo(image) = media {
            MomentsResizeArea(marking: marking, image: image, size: frame.size)
        } else {
            MomentsMarksDrawArea(
                marking: marking,
                media: media,
                surface: surface,
                size: frame.size,
                addWords: addWords(frame: frame, free: free)
            )
        }
    }

    // MARK: - Where things go

    /// The picture's frame on the screen: the viewer's on the phone (full width, above its 68-pt reply bar), the Post
    /// screen's card on the iPhone Duo.
    func pictureFrame(_ size: CGSize) -> CGRect {
        switch duo.pose {
        case .phone:
            return CGRect(x: 0, y: 0, width: size.width, height: max(size.height - 68, 200))
        case .closed:
            return duo.column
        case .wide:
            let card = duo.card
            return CGRect(x: ((duo.leftHalf.width - card.width) / 2).rounded(), y: card.minY, width: card.width, height: card.height)
        case .upright:
            let width = min(size.width, (size.height * 9 / 16).rounded())
            return CGRect(x: ((size.width - width) / 2).rounded(), y: 0, width: width, height: size.height)
        case .table:
            let fold = duo.fold ?? CGRect(x: 0, y: ((size.height - 40) / 2).rounded(), width: size.width, height: 40)
            let width = (fold.minY * 9 / 16).rounded()
            return CGRect(x: ((size.width - width) / 2).rounded(), y: 0, width: width, height: fold.minY)
        }
    }

    /// Where the controls go: inside the safe area on the phone (the swatches sit low, over the reply bar's place);
    /// over the card on the iPhone Duo, below anything the system keeps over it (upright, the clock corner).
    func controlRoom(_ frame: CGRect, size: CGSize, insets: EdgeInsets) -> CGRect {
        let inset = Spacing.s3
        if duo.pose == .phone {
            let top = insets.top + 2
            let bottom = size.height - max(insets.bottom, inset)
            return CGRect(x: inset, y: top, width: max(size.width - 2 * inset, 0), height: max(bottom - top, 0))
        }
        let top = max(frame.minY + inset, insets.top, duo.occludedBottom(from: frame.minX, to: frame.maxX) + Spacing.s2)
        let bottom = frame.maxY - (frame.maxY >= size.height - 1 ? max(insets.bottom, inset) : inset)
        return CGRect(x: frame.minX + inset, y: top, width: max(frame.width - 2 * inset, 0), height: max(bottom - top, 0))
    }

    /// The viewer's corners: rounded at the bottom on the phone, toward the side strip closed, all round open sideways.
    var pictureShape: UnevenRoundedRectangle {
        switch duo.pose {
        case .phone: UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous)
        case .closed: UnevenRoundedRectangle(bottomTrailingRadius: 24, topTrailingRadius: 24, style: .continuous)
        case .wide: UnevenRoundedRectangle(topLeadingRadius: 28, bottomLeadingRadius: 28, bottomTrailingRadius: 28, topTrailingRadius: 28)
        case .upright, .table: UnevenRoundedRectangle()
        }
    }

    /// Text: VoiceOver's "Add words" on the picture, a label as opening Text adds; at five it says so.
    private func addWords(frame: CGRect, free: ClosedRange<CGFloat>) -> (() -> Void)? {
        guard marking.tool == .text else { return nil }
        return { [marking, surface] in
            if !MomentsMarksTextLayer.addLabel(marking: marking, picture: surface, size: frame.size, free: free) {
                AccessibilityNotification.Announcement("Five labels is the most.").post()
            }
        }
    }

    /// The viewer's top gradient, and a dashed line where labels may begin: below the lowest line any phone's viewer
    /// top bar reaches in this picture (`MomentMarks.safeBox`), the same place in the picture on every phone.
    func viewerStrip(_ frame: CGRect) -> some View {
        let fill = MomentMarks.fill(surface, in: frame.size)
        let line = max(fill.minY + MomentMarks.safeBox(aspect: surface.width / max(surface.height, 1)).minY * fill.height, 0)
        return ZStack(alignment: .top) {
            LinearGradient(colors: [Color.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: max(line + 60, 170))
            // White over a dark line just under it, so it shows on light pictures and dark ones.
            dashes(Color.black.opacity(0.4), width: frame.width).offset(y: line + 1)
            dashes(Color.white.opacity(0.5), width: frame.width).offset(y: line)
        }
        .frame(width: frame.width, alignment: .top)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func dashes(_ color: Color, width: CGFloat) -> some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: 0.5))
            path.addLine(to: CGPoint(x: width, y: 0.5))
        }
        .stroke(color, style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
        .frame(height: 1)
    }

    // MARK: - The top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            roundButton(.x, size: 22, label: "Cancel", id: "moments.marks.cancel") { model.cancelMarks() }
            Spacer(minLength: Spacing.s2)
            if marking.tool == .draw { MomentsMarksUndo(marking: marking) }
            Button { model.applyMarks() } label: {
                Text("Done")
                    .scaledFont(15, weight: .bold)
                    .foregroundStyle(Color(uiColor: MomentsPalette.ink(MomentMarks.Ink.black.rawValue)))
                    .padding(.horizontal, 18)
                    .padding(.vertical, Spacing.s1)
                    .frame(minHeight: 40)
                    .background(Capsule().fill(Color.white))
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("moments.marks.done")
        }
    }

    /// A 44-pt round button on the picture (X, Undo).
    func roundButton(_ icon: PantopusIcon, size: CGFloat, label: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: size, strokeWidth: 2.4, color: .white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.black.opacity(0.42)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}

/// Undo, off while there's no line to take back. Its own view: it follows every line drawn, the rest of the editor
/// doesn't need to.
private struct MomentsMarksUndo: View {
    let marking: MomentsMarking

    var body: some View {
        let empty = marking.editing.strokes.isEmpty
        Button { marking.undo() } label: {
            Icon(.undo2, size: 20, strokeWidth: 2.4, color: .white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.black.opacity(0.42)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(empty)
        .opacity(empty ? 0.5 : 1)
        .accessibilityLabel("Undo")
        .accessibilityIdentifier("moments.marks.undo")
    }
}
