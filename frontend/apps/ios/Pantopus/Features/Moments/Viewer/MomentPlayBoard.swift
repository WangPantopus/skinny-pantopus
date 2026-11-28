//
//  MomentPlayBoard.swift
//  Pantopus
//
//  The board ("where do you stand", board B9), faces, fog-wipe and the swatch slider in the viewer (CONTRACT 7b, 7g).
//  On the board readers drag their own face among others' (connections show who they are; anyone else is "Someone
//  nearby"). Fog: the picture opens frosted and the reader wipes it clear on their own screen. Swatch: colours tried
//  over a real photo as a marked layer, the original one tap away; the photo itself never changes.
//

import SwiftUI

/// A face on a board or along the dial: the person's initials, or a plain face for someone the reader doesn't know.
struct MomentPlayFace: View {
    let person: MomentPlayPerson?
    let mine: Bool
    var size: CGFloat = 26

    var body: some View {
        Text(person?.initials ?? (mine ? "You" : "•"))
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(mine ? Theme.Color.primarySolid : .white)
            .frame(width: size, height: size)
            .background(Circle().fill(mine ? Color.white : Color.white.opacity(0.3)))
            .overlay(Circle().stroke(Color.white, lineWidth: mine ? 2 : 1))
            .accessibilityLabel(mine ? "You" : person?.name ?? "Someone nearby")
    }
}

/// "Where do you stand": a two-way board; the reader drags their face onto it, with an optional note.
struct MomentBoardCard: View {
    let moment: MomentDTO
    let item: MomentPlayItem
    @State private var dragged: CGPoint?
    @State private var note = ""
    @State private var problem: String?
    @State private var writing = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            MomentPlayTitle(words: item.question ?? "")
            board
                .frame(height: 220)
            if item.open, item.mine == nil {
                MomentPlayNote(words: "Drag your face to where you stand.")
            }
            if item.open, item.mine != nil || dragged != nil {
                // The note is written in a sheet of its own, above the keyboard.
                MomentPlayWriteField(
                    words: note.isEmpty ? item.mine?.note ?? "" : note,
                    placeholder: "A note (optional)",
                    id: "moments.play.board.note"
                ) {
                    if note.isEmpty { note = item.mine?.note ?? "" }
                    writing = true
                }
                .onChange(of: writing) { _, open in MomentPlayStore.shared.writingOn = open ? moment.id : nil }
                .sheet(isPresented: $writing) {
                    MomentPlayWriteSheet(
                        title: item.question ?? "",
                        placeholder: "A note (optional)",
                        limit: 60,
                        text: $note,
                        sendWords: "Save",
                        send: { await send() },
                        onDone: { writing = false }
                    )
                }
            }
            if item.open == false, item.mine == nil, MomentPlayAuthor.isMine(moment) {
                // The author: the notes people left, each can be removed.
                Button { MomentPlayStore.shared.answersOf = (moment.id, item) } label: {
                    Text("See the notes")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .underline()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.play.board.notes")
            }
            if let count = item.results?.count { MomentPlayNote(words: "\(count) \(count == 1 ? "person stands" : "people stand") here") }
            if let problem { MomentPlayNote(words: problem) }
        }
    }

    private var board: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.08))
                Rectangle().fill(Color.white.opacity(0.3)).frame(width: 1)
                Rectangle().fill(Color.white.opacity(0.3)).frame(height: 1)
                axisWords(size)
                ForEach(Array((item.results?.faces ?? []).filter { !$0.mine }.enumerated()), id: \.offset) { _, face in
                    MomentPlayFace(person: face.person, mine: false, size: 22)
                        .position(x: CGFloat(face.x) * size.width, y: (1 - CGFloat(face.y ?? 0.5)) * size.height)
                }
                if item.open || item.mine != nil {
                    mine(size)
                }
            }
            .coordinateSpace(name: "moments.board")
        }
    }

    private func axisWords(_ size: CGSize) -> some View {
        ZStack {
            word(item.yAxis?.top).position(x: size.width / 2, y: 10)
            word(item.yAxis?.bottom).position(x: size.width / 2, y: size.height - 10)
            word(item.xAxis?.left).position(x: 34, y: size.height / 2 - 10)
            word(item.xAxis?.right).position(x: size.width - 34, y: size.height / 2 - 10)
        }
        .allowsHitTesting(false)
    }

    private func word(_ words: String?) -> some View {
        Text(words ?? "").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.white.opacity(0.8)).lineLimit(1)
    }

    /// The reader's own face: where they put it (or waiting at the corner), dragged while answers are taken.
    private func mine(_ size: CGSize) -> some View {
        let placed = item.mine.flatMap { mine in mine.x.map { CGPoint(x: $0 * size.width, y: (1 - (mine.y ?? 0.5)) * size.height) } }
        let point = dragged ?? placed ?? CGPoint(x: size.width - 18, y: size.height - 18)
        return MomentPlayFace(person: nil, mine: true, size: 30)
            .position(point)
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named("moments.board"))
                    .onChanged { drag in
                        guard item.open else { return }
                        dragged = CGPoint(x: min(max(drag.location.x, 0), size.width), y: min(max(drag.location.y, 0), size.height))
                    }
                    .onEnded { _ in Task { await send(in: size) } }
            )
            .accessibilityHint("Drag to where you stand")
            .accessibilityIdentifier("moments.play.board.mine")
    }

    @discardableResult
    private func send(in size: CGSize? = nil) async -> String? {
        var body = MomentPlayAnswerBody()
        if let dragged, let size {
            body.x = (Double(dragged.x / max(size.width, 1)) * 100).rounded() / 100
            body.y = (Double(1 - dragged.y / max(size.height, 1)) * 100).rounded() / 100
        } else if let mine = item.mine, let x = mine.x, let y = mine.y {
            (body.x, body.y) = (x, y)
        } else {
            return nil
        }
        let words = note.trimmingCharacters(in: .whitespacesAndNewlines)
        body.note = words.isEmpty ? nil : words
        problem = await MomentPlayStore.shared.answer(body, item: item, on: moment.id)
        if problem == nil { dragged = nil }
        return problem
    }
}

/// Fog: the picture frosted until the reader wipes it with a finger (on their own screen only).
struct MomentFogLayer: View {
    let moment: MomentDTO
    let item: MomentPlayItem
    @State private var wipes: [CGPoint] = []

    var body: some View {
        GeometryReader { geo in
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(Color.white.opacity(0.25))
                .mask {
                    Canvas { context, size in
                        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.black))
                        context.blendMode = .destinationOut
                        for point in wipes {
                            context.fill(
                                Path(ellipseIn: CGRect(x: point.x - 34, y: point.y - 34, width: 68, height: 68)),
                                with: .color(.black)
                            )
                        }
                    }
                }
                .overlay {
                    if wipes.isEmpty {
                        Text("Wipe to see")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                            .environment(\.colorScheme, .light)
                            .allowsHitTesting(false)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { drag in
                            wipes.append(drag.location)
                            // Most of it wiped: the fog lifts for good on this screen.
                            if Double(wipes.count) * 68 * 68 > Double(geo.size.width * geo.size.height) * 0.45 {
                                MomentPlayStore.shared.wiped.insert(moment.id)
                            }
                        }
                )
                .accessibilityElement()
                .accessibilityLabel("A frosted picture")
                .accessibilityAction(named: "Wipe it clear") { MomentPlayStore.shared.wiped.insert(moment.id) }
                .accessibilityIdentifier("moments.play.fog")
        }
    }
}

/// Swatch: colours to try over a part of the photo, marked as a try-on; "Original" takes it off.
struct MomentSwatchLayer: View {
    let moment: MomentDTO
    let item: MomentPlayItem
    let frame: CGRect
    private let store = MomentPlayStore.shared

    /// The swatch's area on the picture.
    static func rect(_ item: MomentPlayItem, in frame: CGRect) -> CGRect {
        let box = item.box ?? MomentPlayItem.Box(x: 0.3, y: 0.3, w: 0.4, h: 0.4)
        return CGRect(
            x: frame.minX + box.x * frame.width,
            y: frame.minY + box.y * frame.height,
            width: box.w * frame.width,
            height: box.h * frame.height
        )
    }

    var body: some View {
        let rect = Self.rect(item, in: frame)
        let colors = (item.colors ?? []).compactMap(Self.color)
        let key = "\(moment.id)/\(item.id)"
        let tried = store.swatchTried[key]
        // The paint itself is `MomentSwatchPaint`, under the stamps; here the area's edge and the paints to try.
        ZStack {
            RoundedRectangle(cornerRadius: 6)
                .stroke(Color.white, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                .frame(width: rect.width, height: rect.height)
                .position(x: rect.midX, y: rect.midY)
                .allowsHitTesting(false)
            HStack(spacing: 6) {
                ForEach(Array(colors.enumerated()), id: \.offset) { index, color in
                    Button { store.swatchTried[key] = tried == index ? nil : index } label: {
                        Circle()
                            .fill(color)
                            .frame(width: 28, height: 28)
                            .overlay(Circle().stroke(Color.white, lineWidth: tried == index ? 3 : 1.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Try colour \(index + 1)")
                    .accessibilityIdentifier("moments.play.swatch.\(index)")
                }
                Button("Original") { store.swatchTried[key] = nil }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .accessibilityIdentifier("moments.play.swatch.original")
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.black.opacity(0.6)))
            .position(x: rect.midX, y: min(rect.maxY + 26, frame.maxY - 20))
            if tried != nil {
                Text("Try-on")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.black.opacity(0.6)))
                    .position(x: rect.minX + 30, y: rect.minY + 14)
            }
        }
    }

    /// "#RRGGBB" as a colour.
    static func color(_ hex: String) -> Color? {
        let digits = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        return Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

/// A swatch's paint being tried, on the photo itself: drawn under the stamps, so a stamp over the area keeps its own
/// colours. Nothing while the reader shows the original.
struct MomentSwatchPaint: View {
    let moment: MomentDTO
    let picture: CGSize?
    private let store = MomentPlayStore.shared

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            ForEach(moment.layers.play.filter { $0.kind == .swatch }) { item in
                let colors = (item.colors ?? []).compactMap(MomentSwatchLayer.color)
                if let tried = store.swatchTried["\(moment.id)/\(item.id)"], let color = colors[safeIndex: tried] {
                    let rect = MomentSwatchLayer.rect(item, in: frame)
                    RoundedRectangle(cornerRadius: 6)
                        .fill(color)
                        .blendMode(.multiply)
                        .frame(width: rect.width, height: rect.height)
                        .position(x: rect.midX, y: rect.midY)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private extension Array {
    subscript(safeIndex index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

/// Whether the person watching made the Moment (the author sees results and answers, never the controls).
enum MomentPlayAuthor {
    @MainActor
    static func isMine(_ moment: MomentDTO) -> Bool {
        MomentsComposerModel.account == moment.author.id
    }
}
