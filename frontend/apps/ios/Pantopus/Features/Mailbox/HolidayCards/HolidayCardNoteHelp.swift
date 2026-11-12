//
//  HolidayCardNoteHelp.swift
//  Pantopus
//
//  "Help me write it" on the write step of Send a Christmas card (the
//  server's launch key `card_note_help`; `GET /api/mailbox/cards` says
//  `note_help` while it can be used). The sender may add one line to mention;
//  Pantopus AI offers up to three notes (heartfelt, light, brief) within the
//  card's letter limit. They pick one, it goes on the card, and they edit it
//  there like anything they typed. Undo brings back what they had written.
//  Nothing is stored or sent from here: the card's own Seal it does that.
//

import SwiftUI

/// The helper's state for one card.
@Observable
@MainActor
final class HolidayCardNoteHelp {
    enum State: Equatable {
        case asking
        case writing
        case ideas([HolidayCardNoteIdea])
        case failed(String)
    }

    static let hintLimit = 200
    static let fallback = "Couldn’t write a note just now. Try again, or write it yourself."

    private(set) var state: State = .asking
    var hint = "" {
        didSet {
            if hint.count > Self.hintLimit { hint = String(hint.prefix(Self.hintLimit)) }
        }
    }

    /// Every note shown for this card so far, so "Try again" gets different ones.
    @ObservationIgnored private var shown: [String] = []
    /// The picture and the people the notes on show were written for (`cardKey`).
    @ObservationIgnored private var ideasFor: String?
    /// What was on the card before a note went on it, and that note: Undo stays until the note is edited.
    private var before: String?
    private var applied: String?
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Undo shows while the note on the card is still the one picked here.
    func canUndo(_ message: String) -> Bool {
        before != nil && applied == message
    }

    /// What the notes start from: the sender's own words, not a note picked here and left as it was.
    func ownWords(_ message: String) -> String {
        canUndo(message) ? before ?? message : message
    }

    /// Who the notes are for, in the sheet's first line.
    static func forLine(names: [String], count: Int) -> String {
        if count > 2 { return "One note for all \(count) people, so it names no one." }
        if !names.isEmpty, names.count == count { return "For \(names.joined(separator: " and "))." }
        return count == 2 ? "One note for both of them." : "A note for them."
    }

    /// One picture and the people it's to, as the notes were written for them.
    static func cardKey(design: String, names: [String], count: Int) -> String {
        "\(design)|\(names.joined(separator: ","))|\(count)"
    }

    /// The sheet opens where it was left: the notes still show for the same picture and people (`card`, a `cardKey`).
    /// After a failure, or once the picture or who it's for has changed, it asks again, so a note never names someone
    /// else.
    func opened(for card: String) {
        if state == .writing { return }
        if case .ideas = state, ideasFor == card { return }
        state = .asking
    }

    func write(design: String, names: [String], count: Int, message: String, limit: Int) async {
        guard state != .writing else { return }
        guard NetworkMonitor.shared.isOnline else {
            state = .failed("You’re offline. Try again when you’re back online.")
            return
        }
        let written = ownWords(message).trimmingCharacters(in: .whitespacesAndNewlines)
        let mention = hint.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = HolidayCardNoteHelpBody(
            design: design,
            to: names,
            count: count,
            hint: mention.isEmpty ? nil : mention,
            note: written.isEmpty ? nil : ownWords(message),
            passedOver: shown.isEmpty ? nil : Array(shown.suffix(6))
        )
        state = .writing
        do {
            let answer: HolidayCardNoteIdeasResponse = try await api.request(HolidayCardEndpoints.noteHelp(body))
            let fits = answer.notes.filter {
                !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && HolidayCardNote.letters($0.text) <= limit
            }
            guard !fits.isEmpty else {
                state = .failed(Self.fallback)
                return
            }
            shown.append(contentsOf: fits.map(\.text))
            ideasFor = Self.cardKey(design: design, names: names, count: count)
            state = .ideas(fits)
        } catch {
            state = .failed(Self.sentence(error) ?? Self.fallback)
        }
    }

    /// Puts a note on the card: returns the card's new note. A second pick keeps the first one's Undo.
    func use(_ text: String, message: String) -> String {
        before = canUndo(message) ? before : message
        applied = text
        return text
    }

    /// The card's note from before a note was picked here, once.
    func undo() -> String? {
        defer {
            before = nil
            applied = nil
        }
        return before
    }

    /// The server's own sentence for a note it didn't write (`{ error, message }`).
    static func sentence(_ error: any Error) -> String? {
        let body: String? = switch error as? APIError {
        case let .clientError(_, message): message
        case let .server(_, body): body
        default: nil
        }
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let message = json["message"] as? String, !message.isEmpty else { return nil }
        return message
    }

    static func toneName(_ tone: String) -> String {
        switch tone {
        case "heartfelt": "Heartfelt"
        case "light": "Light"
        case "brief": "Brief"
        default: tone.capitalized
        }
    }
}

extension HolidayCardRecipient {
    /// Who "Help me write it" writes to: first names for people found by name, and how many the card goes to in all.
    var noteHelpNames: [String] {
        switch self {
        case let .person(_, name): [HolidayCardWords.firstName(name)]
        case .email, .link: []
        case let .list(entries): entries.flatMap(\.noteHelpNames)
        }
    }

    var noteHelpCount: Int {
        entries?.count ?? 1
    }
}

/// The row under the card: the button, and Undo right after a note went on the card.
struct HolidayCardNoteHelpRow: View {
    let help: HolidayCardNoteHelp
    let message: String
    let onOpen: () -> Void
    let onUndo: () -> Void
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let undo = help.canUndo(message)
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                HolidayCardPaperButton(title: "Help me write it", isPressed: false, action: onOpen)
                    .accessibilityIdentifier("sendCardNoteHelp")
                if undo {
                    HolidayCardPaperButton(title: "Undo", isPressed: false, action: onUndo)
                        .accessibilityIdentifier("sendCardNoteUndo")
                } else {
                    hint("Three notes to pick from and edit.")
                }
                Spacer(minLength: 0)
            }
            if undo {
                hint("It’s on the card. Change anything you like.")
            }
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("sendCardNoteHelpHint")
    }
}

/// The sheet: one line to mention, then the notes to pick from.
struct HolidayCardNoteHelpSheet: View {
    @Bindable var help: HolidayCardNoteHelp
    /// Who the notes are for ("For Maria.").
    let forWhom: String
    /// The card already has words of the sender's own: the notes start from them.
    let startsFromNote: Bool
    let limit: Int
    let onWrite: () -> Void
    let onUse: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var typing: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                header
                Text(startsFromNote ? "\(forWhom) It starts from what you’ve written." : forWhom)
                    .font(.system(size: 14))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("sendCardNoteFor")
                mention
                if case let .ideas(notes) = help.state {
                    ForEach(notes) { idea(_: $0) }
                }
                if case let .failed(message) = help.state {
                    Text(message)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(MailPaper.wax)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("sendCardNoteFailed")
                }
                action
                Text("Written by Pantopus AI. Pick one, then make it sound like you.")
                    .font(.system(size: 13))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Spacing.s5)
        }
        .scrollDismissesKeyboard(.interactively)
        .accessibilityIdentifier("sendCardNoteHelpPanel")
    }

    private var header: some View {
        HStack {
            Text("Help me write it")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(MailPaper.cardText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button {
                dismiss()
            } label: {
                Text("Close")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("sendCardNoteClose")
        }
    }

    private var mention: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Anything to mention? (optional)")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(MailPaper.cardText)
            TextField(
                "",
                text: $help.hint,
                prompt: Text(verbatim: "We missed you at Thanksgiving").foregroundStyle(MailPaper.cardTextMuted)
            )
            .font(.system(size: 16))
            .foregroundStyle(MailPaper.cardText)
            .submitLabel(.go)
            .onSubmit {
                typing = false
                if help.state != .writing { onWrite() }
            }
            .focused($typing)
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .typesInFieldOnTap($typing)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(typing ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
            )
            .accessibilityLabel("Anything to mention? Optional")
            .accessibilityIdentifier("sendCardNoteHint")
        }
    }

    @ViewBuilder private var action: some View {
        switch help.state {
        case .asking, .writing:
            HolidayCardWaxButton(title: "Write three notes", isLoading: help.state == .writing) {
                typing = false
                onWrite()
            }
            .accessibilityIdentifier("sendCardNoteWrite")
        case .ideas, .failed:
            HolidayCardPaperButton(title: "Try again", fullWidth: true) {
                typing = false
                onWrite()
            }
            .accessibilityIdentifier("sendCardNoteAgain")
        }
    }

    /// One note, in the card's hand, with its letters and "Use this one".
    private func idea(_ note: HolidayCardNoteIdea) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(HolidayCardNoteHelp.toneName(note.tone).uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(1)
                .foregroundStyle(MailPaper.wax)
                .accessibilityAddTraits(.isHeader)
            Text(note.text)
                .font(Font(HolidayCardNote.font(size: 19)))
                .lineSpacing(4)
                .foregroundStyle(MailPaper.cardInk)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("sendCardNoteText-\(note.tone)")
            HStack {
                Text("\(HolidayCardNote.letters(note.text)) of \(limit) letters")
                    .font(.system(size: 13))
                    .foregroundStyle(MailPaper.cardTextSoft)
                Spacer(minLength: Spacing.s2)
                HolidayCardPaperButton(title: "Use this one", isPressed: false) {
                    onUse(note.text)
                    dismiss()
                }
                .accessibilityIdentifier("sendCardNoteUse-\(note.tone)")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardFieldEdge, lineWidth: 1))
        .accessibilityElement(children: .contain)
    }
}
