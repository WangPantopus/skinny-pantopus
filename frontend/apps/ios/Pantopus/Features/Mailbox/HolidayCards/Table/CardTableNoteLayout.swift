//
//  CardTableNoteLayout.swift
//  Pantopus
//
//  Where the words of a note go on the back of the card (launch key
//  `card_table`): 6u on a 7.6u line on 11 rules, each word with a small shift
//  and turn so the writing isn't machine-straight. The turns come from the
//  card's number, so it looks the same every time. Latin letters are in the
//  pen; the system's fonts take over for other scripts. A note written on an
//  older app can run past the rules in the pen, so it gets smaller until it
//  fits (and tighter, if it has more lines than rules).
//

import SwiftUI
import UIKit

struct CardTableNoteLayout {
    /// The note's box and its lines, in u.
    static let left: CGFloat = 8
    static let top: CGFloat = 9
    static let width: CGFloat = 85
    static let pitch: CGFloat = 7.6
    static let size: CGFloat = 6
    static let ruleCount = 11
    /// The rules' whole height: `pitch` times `ruleCount`.
    static let boxHeight: CGFloat = 83.6
    private static let smallest: CGFloat = 4.2

    /// One word on the card, in points.
    struct Word {
        let text: String
        /// The middle of its box.
        let center: CGPoint
        let baseline: CGFloat
        let width: CGFloat
        let shift: CGFloat
        let turn: Double
        let opacity: Double
    }

    let words: [Word]
    let font: UIFont
    /// How many lines it takes at this size.
    let lineCount: Int

    init(text: String, seed: Int?, u: CGFloat) {
        var size = Self.size
        var lines = Self.lines(text, font: CardTableType.pen(size * u), width: Self.width * u)
        while lines.count > Self.ruleCount, size > Self.smallest {
            size -= 0.2
            lines = Self.lines(text, font: CardTableType.pen(size * u), width: Self.width * u)
        }
        let pitch = lines.count > Self.ruleCount ? Self.pitch * CGFloat(Self.ruleCount) / CGFloat(lines.count) : Self.pitch
        let font = CardTableType.pen(size * u)
        self.font = font
        lineCount = lines.count
        var random = CardTableRandom(seed: (seed ?? 1) * 7 + 3)
        let lineHeight = pitch * u
        let baselineInLine = CardTableType.baseline(font, lineHeight: lineHeight)
        let em = size * u
        var placed: [Word] = []
        for (index, line) in lines.enumerated() {
            let lineTop = (Self.top * u) + CGFloat(index) * lineHeight
            for word in line {
                let shift = (random.next() - 0.5) * 0.34 * em
                let turn = (random.next() - 0.5) * 1.5
                let opacity = 0.86 + random.next() * 0.14
                guard !word.text.isEmpty else { continue }
                placed.append(Word(
                    text: word.text,
                    center: CGPoint(x: Self.left * u + word.x + word.width / 2, y: lineTop + lineHeight / 2),
                    baseline: lineTop + baselineInLine,
                    width: word.width,
                    shift: shift,
                    turn: turn,
                    opacity: opacity
                ))
            }
        }
        words = placed
    }

    /// Draws the note, in ink that sinks into the paper.
    func draw(in context: GraphicsContext) {
        var ink = context
        ink.blendMode = .multiply
        let swiftUIFont = Font(font)
        for word in words {
            var layer = ink
            layer.opacity = word.opacity
            layer.translateBy(x: word.center.x, y: word.center.y + word.shift)
            layer.rotate(by: .degrees(word.turn))
            layer.drawText(
                Text(word.text).font(swiftUIFont).foregroundColor(MailPaper.tablePenInk),
                x: -word.width / 2,
                baseline: word.baseline - word.center.y
            )
        }
    }

    // MARK: Wrapping

    private struct LaidWord {
        let text: String
        let x: CGFloat
        let width: CGFloat
    }

    /// Breaks the note into lines of words: a new line where the writer started one, and wherever the next word
    /// doesn't fit. A word wider than a line (no spaces in it, as in some scripts) breaks between its letters.
    private static func lines(_ text: String, font: UIFont, width: CGFloat) -> [[LaidWord]] {
        let attributes: [NSAttributedString.Key: Any] = [.font: font]
        func measure(_ string: String) -> CGFloat {
            (string as NSString).size(withAttributes: attributes).width
        }
        let space = measure(" ")
        var result: [[LaidWord]] = []
        for paragraph in text.components(separatedBy: "\n") {
            var line: [LaidWord] = []
            var x: CGFloat = 0
            func place(_ word: String, _ wordWidth: CGFloat) {
                if !line.isEmpty, x + wordWidth > width {
                    result.append(line)
                    line = []
                    x = 0
                }
                line.append(LaidWord(text: word, x: x, width: wordWidth))
                x += wordWidth + space
            }
            for word in paragraph.components(separatedBy: " ") {
                let wordWidth = measure(word)
                if wordWidth <= width {
                    place(word, wordWidth)
                    continue
                }
                var piece = ""
                for character in word {
                    if measure(piece + String(character)) > width, !piece.isEmpty {
                        place(piece, measure(piece))
                        piece = ""
                    }
                    piece.append(character)
                }
                if !piece.isEmpty { place(piece, measure(piece)) }
            }
            result.append(line)
        }
        return result
    }
}

/// The seeded numbers each word's shift and turn come from, the same on every app.
struct CardTableRandom {
    private var state: UInt32

    init(seed: Int) {
        state = UInt32(truncatingIfNeeded: seed)
    }

    mutating func next() -> CGFloat {
        state = state &* 1_664_525 &+ 1_013_904_223
        return CGFloat(state) / 4_294_967_296
    }
}
