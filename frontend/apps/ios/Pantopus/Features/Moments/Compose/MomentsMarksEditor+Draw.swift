//
//  MomentsMarksEditor+Draw.swift
//  Pantopus
//
//  Draw (board T3): a finger draws on the picture, in one of three widths
//  (the column at the right) and six inks (the row at the bottom); Undo takes
//  back the last line. No eraser. Lines are kept in the picture's own
//  coordinates (`MomentMarks`), so drawing is never held to what one phone
//  shows.
//

import AVFoundation
import SwiftUI

extension MomentsMarksEditor {
    /// Thin, medium, thick: 48-pt circles down the right side, a white dot as wide as the line.
    var widthColumn: some View {
        VStack(spacing: 10) {
            ForEach(MomentMarks.Width.allCases, id: \.self) { width in
                let selected = marking.width == width
                Button { marking.width = width } label: {
                    Circle()
                        .fill(Color.white)
                        .frame(width: dot(width), height: dot(width))
                        .frame(width: 48, height: 48)
                        .background(Circle().fill(Color.black.opacity(0.42)))
                        .overlay(Circle().strokeBorder(Color.white.opacity(selected ? 1 : 0.4), lineWidth: selected ? 2 : 1))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(width.name)
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("moments.marks.width.\(width.rawValue)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Line width")
    }

    private func dot(_ width: MomentMarks.Width) -> CGFloat {
        switch width {
        case .thin: 6
        case .medium: 11
        case .thick: 17
        }
    }

    /// "Draw with your finger." over the six inks; on a narrow card (on a table) the inks take two rows.
    func drawFooter(width: CGFloat) -> some View {
        VStack(spacing: Spacing.s3) {
            Text("Draw with your finger.")
                .scaledFont(13, weight: .medium)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
                .accessibilityHidden(true)
            ViewThatFits(in: .horizontal) {
                inks(MomentMarks.Ink.allCases)
                VStack(spacing: 0) {
                    inks(Array(MomentMarks.Ink.allCases.prefix(3)))
                    inks(Array(MomentMarks.Ink.allCases.suffix(3)))
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Ink color")
        }
        .frame(width: width)
    }

    private func inks(_ inks: [MomentMarks.Ink]) -> some View {
        HStack(spacing: 6) {
            ForEach(inks, id: \.self) { ink in
                swatch(ink, selected: marking.ink == ink) { marking.ink = ink }
            }
        }
    }

    /// One ink: a 30-pt disc, or 36 pt in a dark and a white ring when it's the one in use, in a 44-pt tap area.
    func swatch(_ ink: MomentMarks.Ink, selected: Bool, action: @escaping () -> Void) -> some View {
        let dark = Color(uiColor: MomentsPalette.ink(MomentMarks.Ink.black.rawValue))
        return Button(action: action) {
            Circle()
                .fill(Color(uiColor: MomentsPalette.ink(ink.rawValue)))
                .overlay {
                    if selected {
                        Circle().strokeBorder(dark, lineWidth: 3)
                    } else {
                        Circle().strokeBorder(ink == .white ? dark.opacity(0.5) : Color.white.opacity(0.8), lineWidth: 1.5)
                    }
                }
                .padding(selected ? 2 : 0)
                .overlay { if selected { Circle().strokeBorder(Color.white, lineWidth: 2) } }
                .frame(width: selected ? 40 : 30, height: selected ? 40 : 30)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(ink.name)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.marks.color.\(ink.rawValue)")
    }
}

/// The picture as the viewer frames it (filling `size`, a video playing muted), or its canvas once it's placed, its
/// marks, and a finger drawing a line on it. Its own view: it redraws with every point, the editor's controls don't.
struct MomentsMarksDrawArea: View {
    let marking: MomentsMarking
    let media: MomentsMarkedMedia
    /// What the marks are drawn over: the picture's own size, or the canvas's.
    let surface: CGSize
    let size: CGSize
    /// Text: VoiceOver's "Add words", which adds a label as opening Text does.
    var addWords: (() -> Void)?

    var body: some View {
        let fill = MomentMarks.fill(surface, in: size)
        Group {
            switch media {
            case let .photo(image):
                if let placement = marking.editingPlacement {
                    MomentPlacedCanvas(image: image, placement: placement, backdrop: marking.backdrop)
                        .frame(width: fill.width, height: fill.height)
                        .position(x: fill.midX, y: fill.midY)
                } else {
                    Image(uiImage: image).resizable().scaledToFill()
                }
            case let .video(url, _): MomentsMarksVideo(url: url)
            }
        }
        .frame(width: size.width, height: size.height)
        // An overlay, so the marks (as large as the whole picture, cropped edges included) never resize the frame.
        // The label being typed in is its text field (`MomentsMarksTextLayer`), not drawn under it.
        .overlay(alignment: .topLeading) {
            MomentMarksCanvas(marks: marking.shown, aspect: marking.aspect)
                .frame(width: fill.width, height: fill.height)
                .offset(x: fill.minX, y: fill.minY)
        }
        .clipped()
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { value in
                    let point = CGPoint(
                        x: (value.location.x - fill.minX) / fill.width,
                        y: (value.location.y - fill.minY) / fill.height
                    )
                    marking.draw(at: point, pictureWidth: fill.width)
                }
                .onEnded { _ in marking.endLine() },
            // Text: the labels' own layer takes the touches.
            isEnabled: marking.tool == .draw
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(media.isVideo ? "The video you're posting" : "The photo you're posting")
        .accessibilityHint(marking.tool == .draw ? "Draw on it with one finger." : "")
        .accessibilityActions {
            if let addWords { Button("Add words", action: addWords) }
        }
        .accessibilityIdentifier("moments.marks.picture")
    }
}

/// The video under the marks: muted and looping, on a player of its own (the Post screen keeps its own).
private struct MomentsMarksVideo: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        MomentsVideoSurface(player: player ?? AVPlayer())
            .onAppear {
                if player == nil {
                    let looping = AVPlayer(url: url)
                    looping.isMuted = true
                    player = looping
                }
                player?.play()
            }
            .onDisappear { player?.pause() }
            .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification)) { note in
                guard let item = note.object as? AVPlayerItem, item === player?.currentItem else { return }
                player?.seek(to: .zero)
                player?.play()
            }
    }
}
