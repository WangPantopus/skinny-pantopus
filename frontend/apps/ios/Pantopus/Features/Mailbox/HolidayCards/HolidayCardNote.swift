//
//  HolidayCardNote.swift
//  Pantopus
//
//  The note on the back of a Christmas card, set by TextKit so each line
//  sits on one of the back's rules: fountain-pen blue italic serif, its size
//  and line pitch a share of the card's width (4.7% and 7.6%, as on the
//  web). The same view writes the note (no scrolling: a card holds what fits
//  on it, up to the letter limit) and reads it on the card page.
//

import SwiftUI
import UIKit

enum HolidayCardNote {
    /// The note's type size and line pitch, as shares of the card's width.
    static let size: CGFloat = 0.047
    static let pitch: CGFloat = 0.076

    /// Letters as the server counts them (code points).
    static func letters(_ text: String) -> Int {
        text.unicodeScalars.count
    }

    static func font(size: CGFloat) -> UIFont {
        let base = UIFont.systemFont(ofSize: size)
        let serif = base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor
        let italic = serif.withSymbolicTraits(.traitItalic) ?? serif
        return UIFont(descriptor: italic, size: size)
    }

    static func attributes(cardWidth: CGFloat, color: UIColor) -> [NSAttributedString.Key: Any] {
        let style = NSMutableParagraphStyle()
        style.minimumLineHeight = cardWidth * pitch
        style.maximumLineHeight = cardWidth * pitch
        style.lineBreakMode = .byWordWrapping
        return [.font: font(size: cardWidth * size), .foregroundColor: color, .paragraphStyle: style]
    }
}

/// The note on its rules: written while `isEditable`, read otherwise.
struct HolidayCardNoteText: UIViewRepresentable {
    @Binding var text: String
    /// The width of the whole card (the type scales with it).
    let cardWidth: CGFloat
    var placeholder = ""
    var isEditable = false
    var limit = Int.max

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> HolidayCardNoteView {
        let view = HolidayCardNoteView()
        view.editor.delegate = context.coordinator
        view.editor.isEditable = isEditable
        view.editor.isSelectable = isEditable
        view.isUserInteractionEnabled = isEditable
        if isEditable {
            view.editor.accessibilityLabel = "Your note on the back of the card"
            view.editor.accessibilityIdentifier = "sendCardNote"
        } else {
            view.accessibilityElementsHidden = true
        }
        return view
    }

    func updateUIView(_ view: HolidayCardNoteView, context: Context) {
        context.coordinator.parent = self
        view.setStyle(cardWidth: cardWidth)
        if view.editor.text != text {
            view.editor.attributedText = NSAttributedString(string: text, attributes: view.inkAttributes)
        }
        view.placeholderView.attributedText = NSAttributedString(string: placeholder, attributes: view.placeholderAttributes)
        view.placeholderView.isHidden = !text.isEmpty
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView _: HolidayCardNoteView, context _: Context) -> CGSize? {
        CGSize(width: proposal.width ?? 0, height: proposal.height ?? 0)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: HolidayCardNoteText

        init(_ parent: HolidayCardNoteText) {
            self.parent = parent
        }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
            (textView.superview as? HolidayCardNoteView)?.placeholderView.isHidden = !textView.text.isEmpty
        }

        /// Up to the letter limit (a paste is cut to what's left, as on the
        /// web), and no more than fits on the card.
        func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText: String) -> Bool {
            let current = textView.text ?? ""
            guard let swiftRange = Range(range, in: current) else { return false }
            let kept = HolidayCardNote.letters(current) - HolidayCardNote.letters(String(current[swiftRange]))
            let room = max(0, parent.limit - kept)
            var insert = replacementText
            if HolidayCardNote.letters(insert) > room {
                insert = String(String.UnicodeScalarView(insert.unicodeScalars.prefix(room)))
            }
            let next = current.replacingCharacters(in: swiftRange, with: insert)
            guard (textView.superview as? HolidayCardNoteView)?.fits(next) ?? true else { return false }
            guard insert != replacementText else { return true }
            // Cut to the limit: put in what's left by hand.
            textView.textStorage.replaceCharacters(
                in: range,
                with: NSAttributedString(string: insert, attributes: textView.typingAttributes)
            )
            let caret = range.location + (insert as NSString).length
            textView.selectedRange = NSRange(location: caret, length: 0)
            textViewDidChange(textView)
            return false
        }
    }
}

/// The text view and, under it, its placeholder set the same way, so "Dear
/// Maya," sits where the writing will start.
final class HolidayCardNoteView: UIView {
    let editor = UITextView()
    let placeholderView = UITextView()
    private(set) var inkAttributes: [NSAttributedString.Key: Any] = [:]
    private(set) var placeholderAttributes: [NSAttributedString.Key: Any] = [:]
    private var styledWidth: CGFloat = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        for view in [placeholderView, editor] {
            view.backgroundColor = .clear
            view.textContainerInset = .zero
            view.textContainer.lineFragmentPadding = 0
            view.isScrollEnabled = false
            view.autocorrectionType = .default
            view.frame = bounds
            view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(view)
        }
        placeholderView.isEditable = false
        placeholderView.isSelectable = false
        placeholderView.isUserInteractionEnabled = false
        placeholderView.isAccessibilityElement = false
        editor.tintColor = UIColor(MailPaper.cardInk)
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// The type for this card width; re-sets the note when the width changes.
    func setStyle(cardWidth: CGFloat) {
        guard cardWidth > 0, abs(cardWidth - styledWidth) > 0.5 else { return }
        styledWidth = cardWidth
        let ink = UIColor(MailPaper.cardInk)
        inkAttributes = HolidayCardNote.attributes(cardWidth: cardWidth, color: ink)
        placeholderAttributes = HolidayCardNote.attributes(cardWidth: cardWidth, color: ink.withAlphaComponent(0.45))
        editor.typingAttributes = inkAttributes
        editor.attributedText = NSAttributedString(string: editor.text ?? "", attributes: inkAttributes)
    }

    /// Whether this note fits on the card's lines.
    func fits(_ text: String) -> Bool {
        guard bounds.height > 0, bounds.width > 0 else { return true }
        // A last empty line still takes a line.
        let measured = text.hasSuffix("\n") ? text + "x" : text
        let height = NSAttributedString(string: measured, attributes: inkAttributes)
            .boundingRect(
                with: CGSize(width: bounds.width, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin],
                context: nil
            )
            .height
        return height <= bounds.height + 1
    }
}
