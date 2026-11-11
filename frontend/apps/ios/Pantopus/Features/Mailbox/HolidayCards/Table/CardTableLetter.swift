//
//  CardTableLetter.swift
//  Pantopus
//
//  A letter on the table (launch key `card_table`, plan Part 10): the welcome
//  letter arrives in the cream envelope with the red seal on a slate cloth,
//  opens with the same moves, and comes out as a cream sheet folded in three
//  that opens the letter page.
//

import SwiftUI

/// The welcome letter folded in three, as it comes out of its envelope: cream paper, its heading, a few lines of
/// writing seen as rules, and the fold.
struct CardTableLetterSheet: View, Equatable {
    let paperGrain: UIImage?
    let title: String

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let u = size.width / 100
            let rect = CGRect(origin: .zero, size: size)
            var sheet = context
            sheet.clip(to: Path(roundedRect: rect, cornerRadius: 0.7 * u, style: .continuous))
            sheet.fill(Path(rect), with: .color(MailPaper.letter))
            let font = CardTableSerif.font(size: 6.2 * u, weight: .semibold)
            sheet.drawText(
                Text(title).font(Font(font)).foregroundColor(MailPaper.tablePenInk),
                x: 9 * u,
                baseline: 17 * u + CardTableType.baseline(font, lineHeight: 6.2 * u)
            )
            var lines = Path()
            for line in 0..<6 {
                let y = (34 + CGFloat(line) * 9) * u
                lines.move(to: CGPoint(x: 9 * u, y: y))
                lines.addLine(to: CGPoint(x: (line == 5 ? 62 : 91) * u, y: y))
            }
            sheet.stroke(lines, with: .color(MailPaper.tableRule), lineWidth: max(1, 0.35 * u))
            // Folded in three: the lower crease, a soft shade under it.
            let crease = size.height * 2 / 3
            sheet.fill(
                Path(CGRect(x: 0, y: crease, width: size.width, height: 5 * u)),
                with: .linearGradient(
                    Gradient(colors: [.black.opacity(0.07), .clear]),
                    startPoint: CGPoint(x: 0, y: crease),
                    endPoint: CGPoint(x: 0, y: crease + 5 * u)
                )
            )
            var fold = Path()
            fold.move(to: CGPoint(x: 0, y: crease))
            fold.addLine(to: CGPoint(x: size.width, y: crease))
            sheet.stroke(fold, with: .color(.black.opacity(0.12)), lineWidth: 1)
            sheet.fillPaperGrain(paperGrain, in: rect, u: u, opacity: 0.8)
            sheet.strokeCardEdges(in: rect, u: u)
        }
        .accessibilityHidden(true)
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.paperGrain === rhs.paperGrain && lhs.title == rhs.title
    }
}

extension CardTableContent {
    /// Pantopus's welcome letter (plan Part 10): from Pantopus to the person whose Mailbox it's in, on the slate cloth;
    /// no picture, note, postmark or Christmas.
    init(welcomeLetterTo toName: String, year: Int) {
        self.init(
            design: "",
            number: nil,
            caption: "",
            paper: nil,
            table: nil,
            slug: nil,
            year: year,
            mailedOn: nil,
            note: "",
            fromName: "Pantopus",
            toName: toName,
            sealed: false,
            sealedUntil: nil,
            sealedInDays: "",
            sealedDayCount: 0,
            verse: nil,
            isLetter: true
        )
    }
}

/// Pantopus's welcome letter on the table, the whole screen (plan Part 10). Out of its envelope it opens the letter
/// page (`onOpen`); closing it leaves it sealed in the Mailbox.
struct CardTableLetterHost: View {
    @State private var model: CardTableModel
    let onClose: () -> Void

    init(onOpen: @escaping () -> Void, onClose: @escaping () -> Void) {
        let year = Calendar.current.component(.year, from: Date())
        let model = CardTableModel(content: CardTableContent(welcomeLetterTo: MailPieceRecipient.personName, year: year), startsOnTable: false)
        model.onLetterOut = onOpen
        _model = State(initialValue: model)
        self.onClose = onClose
    }

    var body: some View {
        CardTableScreen(model: model, menuItems: [], closeLabel: "Back to the Mailbox", canShare: false, onClose: onClose)
            .toolbar(.hidden, for: .navigationBar)
    }
}
