//
//  MomentsStudioMovingWords.swift
//  Pantopus
//
//  "Pulse, reinvented", moving words (CONTRACT 7k; DESIGN row 2, "moving text" under Aa): the author's own short words
//  over the photo, in one of the Studio's letterings, moving in one of four ways (drift, pulse, wave, type). One more
//  playable kind, drawn and never answered; the photo is stored as today and the words are never drawn into it. With
//  the system's Reduce Motion on, the words stand still. Only the lettering's shared id crosses apps.
//

import SwiftUI

enum MomentsMovingWords {
    static let most = 2
    static let longest = 60

    /// The ten shared lettering ids, in the Studio's own letters (`classic` is the Studio's standard bold).
    static let letterings: [(id: String, face: MomentMarks.Typeface)] = [
        ("classic", .standard), ("serif", .serif), ("typewriter", .typewriter), ("marker", .marker),
        ("handwritten", .handwritten), ("rounded", .rounded), ("tall", .tall), ("script", .script),
        ("mono", .mono), ("elegant", .elegant)
    ]

    static let motions: [(id: String, name: String)] = [
        ("drift", "Drift"), ("pulse", "Pulse"), ("wave", "Wave"), ("type", "Type")
    ]

    /// White, warm yellow, black and sky.
    static let colors = MomentMovingWordsColor.all

    /// At most `longest` units as the server and the web count them (UTF-16), never cutting a letter in two: sixty
    /// letters with emoji in them are more than sixty units, and the server refuses those.
    static func cut(_ words: String) -> String {
        var units = 0
        var kept = ""
        for letter in words {
            units += letter.utf16.count
            if units > longest { break }
            kept.append(letter)
        }
        return kept
    }

    static func face(_ id: String?) -> MomentMarks.Typeface {
        letterings.first { $0.id == id }?.face ?? .standard
    }
}

/// The words, moving as their author chose; `unit` scales them with the picture.
struct MomentMovingWordsView: View {
    let item: MomentPlayItem
    var unit: CGFloat = 1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var words: String {
        (item.text ?? "").replacingOccurrences(of: "\n", with: " ")
    }

    private var color: Color {
        MomentSwatchLayer.color(item.color ?? MomentMovingWordsColor.white) ?? .white
    }

    private var font: Font {
        MomentsMovingWords.face(item.lettering).font(28 * unit * CGFloat(item.scale))
    }

    var body: some View {
        Group {
            if reduceMotion {
                letters(String(words), phase: 0, shown: words.count)
            } else {
                TimelineView(.animation) { timeline in
                    let time = timeline.date.timeIntervalSinceReferenceDate
                    moving(at: time)
                }
            }
        }
        .rotationEffect(.degrees(item.rotation))
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(words)
    }

    @ViewBuilder
    private func moving(at time: TimeInterval) -> some View {
        switch item.motion {
        case "pulse":
            letters(words, phase: 0, shown: words.count)
                .scaleEffect(1 + 0.06 * sin(time * 2.4))
        case "wave":
            letters(words, phase: time, shown: words.count)
        case "type":
            // One letter every 0.09 s, a 1.6 s hold, then again.
            let cycle = Double(words.count) * 0.09 + 1.6
            let shown = min(words.count, Int(time.truncatingRemainder(dividingBy: cycle) / 0.09))
            letters(words, phase: 0, shown: shown)
        default:
            letters(words, phase: 0, shown: words.count)
                .offset(y: 6 * unit * sin(time * 1.3))
        }
    }

    /// The letters; with `phase` they rise one after another (the wave), and only the first `shown` are seen.
    /// A line wraps, centred, inside 86% of the picture's width at the words' size, as the web draws them: between
    /// words, and inside a word only when the word alone is longer than that.
    private var widest: CGFloat {
        0.86 * 402 * unit * CGFloat(item.scale)
    }

    private func letters(_ text: String, phase: TimeInterval, shown: Int) -> some View {
        let characters = Array(text)
        return MomentWordsLayout(spaces: characters.map { $0 == " " }, widest: widest) {
            ForEach(Array(characters.enumerated()), id: \.offset) { index, letter in
                Text(String(letter))
                    .font(font)
                    .foregroundStyle(color)
                    .opacity(index < shown ? 1 : 0)
                    .offset(y: phase == 0 ? 0 : -7 * unit * max(0, sin(phase * 3 - Double(index) * 0.45)))
            }
        }
        .shadow(color: .black.opacity(color == .white || item.color == MomentMovingWordsColor.white ? 0.45 : 0.2), radius: 2, y: 1)
        .fixedSize()
    }
}

/// Letters in rows no wider than `widest`, each row centred: a row breaks at a space (dropped at the row's ends), and
/// inside a word only when that word alone is wider than a row.
struct MomentWordsLayout: Layout {
    /// One per letter: true for a space.
    let spaces: [Bool]
    let widest: CGFloat

    private struct Row {
        var letters: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    func sizeThatFits(proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let rows = rows(subviews)
        return CGSize(width: rows.map(\.width).max() ?? 0, height: rows.reduce(0) { $0 + $1.height })
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var top = bounds.minY
        var placed = Set<Int>()
        for row in rows(subviews) {
            var left = bounds.midX - row.width / 2
            for index in row.letters {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: left, y: top), anchor: .topLeading, proposal: .unspecified)
                left += size.width
                placed.insert(index)
            }
            top += row.height
        }
        // A space dropped at a row's end is still placed (out of sight, with no size).
        for index in subviews.indices where !placed.contains(index) {
            subviews[index].place(at: CGPoint(x: bounds.minX, y: bounds.minY), anchor: .topLeading, proposal: .zero)
        }
    }

    private func rows(_ subviews: Subviews) -> [Row] {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let isSpace = { (index: Int) in index < spaces.count && spaces[index] }
        var rows: [Row] = []
        var row = Row()
        func put(_ index: Int) {
            row.letters.append(index)
            row.width += sizes[index].width
            row.height = max(row.height, sizes[index].height)
        }
        func close() {
            while let last = row.letters.last, isSpace(last) {
                row.letters.removeLast()
                row.width -= sizes[last].width
            }
            if !row.letters.isEmpty { rows.append(row) }
            row = Row()
        }
        var index = 0
        while index < sizes.count {
            if isSpace(index) {
                if !row.letters.isEmpty { put(index) }
                index += 1
                continue
            }
            var end = index
            while end < sizes.count, !isSpace(end) {
                end += 1
            }
            let word = sizes[index..<end].reduce(0) { $0 + $1.width }
            if !row.letters.isEmpty, row.width + word > widest { close() }
            for letter in index..<end {
                if word > widest, !row.letters.isEmpty, row.width + sizes[letter].width > widest { close() }
                put(letter)
            }
            index = end
        }
        close()
        return rows
    }
}

/// The Studio's form for moving words: the words, a lettering, a motion and a colour.
struct MomentsStudioMovingWordsForm: View {
    @Binding var words: String
    @Binding var lettering: String
    @Binding var motion: String
    @Binding var color: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            TextField("Your words, one line", text: $words)
                .textFieldStyle(.roundedBorder)
                .onChange(of: words) { _, next in
                    let line = next.replacingOccurrences(of: "\n", with: " ")
                    if line.utf16.count > MomentsMovingWords.longest || line != next {
                        words = MomentsMovingWords.cut(line)
                    }
                }
                .accessibilityIdentifier("moments.studio.play.movingWords.text")
            chips(MomentsMovingWords.letterings.map { ($0.id, $0.face.name) }, selection: $lettering) { id in
                MomentsMovingWords.face(id).font(15)
            }
            chips(MomentsMovingWords.motions.map { ($0.id, $0.name) }, selection: $motion) { _ in .system(size: 14, weight: .semibold) }
            HStack(spacing: Spacing.s2) {
                ForEach(MomentsMovingWords.colors, id: \.self) { hex in
                    Button { color = hex } label: {
                        Circle()
                            .fill(MomentSwatchLayer.color(hex) ?? .white)
                            .frame(width: 30, height: 30)
                            .overlay(Circle().stroke(Theme.Color.appText, lineWidth: color == hex ? 3 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Colour \(hex)")
                    .accessibilityAddTraits(color == hex ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }

    private func chips(_ all: [(String, String)], selection: Binding<String>, font: @escaping (String) -> Font) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(all, id: \.0) { id, name in
                    let on = selection.wrappedValue == id
                    Button { selection.wrappedValue = id } label: {
                        Text(name)
                            .font(font(id))
                            .foregroundStyle(on ? Color.white : Theme.Color.appText)
                            .padding(.horizontal, 12)
                            .frame(height: 32)
                            .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurface))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }
}
