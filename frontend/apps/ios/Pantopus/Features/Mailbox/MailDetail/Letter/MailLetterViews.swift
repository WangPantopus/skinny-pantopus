//
//  MailLetterViews.swift
//  Pantopus
//
//  The letter page's paper (Mail tab drawings, board "R5-Bill"): the
//  envelope it came in, Pantopus's note clipped on top, and the letter
//  itself with its letterhead, addresses, date, text and what's enclosed.
//

import SwiftUI

/// The envelope at the top of the letter page. Tapping it shows who sent it
/// and its trail.
struct MailEnvelopeButton: View {
    let piece: MailPieceModel
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                MailPieceView(model: piece)
                HStack(spacing: Spacing.s1) {
                    Text("Who sent it, and its trail")
                    Icon(.chevronRight, size: 12, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                }
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Envelope. \(piece.accessibilityLabel)")
        .accessibilityHint("Shows who sent it and its trail.")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailLetterEnvelope")
    }
}

/// "Pantopus read this for you": the note clipped to the top of the letter.
struct MailReadForYouNote: View {
    let summary: MailSummary
    /// A bill's last line: check the amount before paying.
    let isBill: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: 6) {
                Icon(.sparkles, size: 15, color: Theme.Color.info)
                Text("Pantopus read this for you")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.info)
            }
            .accessibilityAddTraits(.isHeader)
            Text(summary.text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.Color.appText)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
            if !summary.keyFacts.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    ForEach(Array(summary.keyFacts.enumerated()), id: \.offset) { _, fact in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(fact.label)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .frame(width: 96, alignment: .leading)
                            Text(fact.value)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.appText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .font(.system(size: 13))
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.top, 10)
            }
            Text(isBill ? "Read from the letter below. Check the amount before you pay." : "Read from the letter below.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.top, 10)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.infoLight, lineWidth: 1))
        .shadow(color: .black.opacity(0.08), radius: 6, x: 0, y: 4)
        // The clip holds the note on at its top corner, clear of the heading.
        .overlay(alignment: .topTrailing) {
            PaperClip()
                .stroke(MailPaper.clip, style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
                .frame(width: 22, height: 48)
                .offset(x: -28, y: -16)
                .accessibilityHidden(true)
        }
        .rotationEffect(.degrees(-0.8))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailLetterNote")
    }
}

/// The letter on its paper: letterhead, the addresses and date, the text,
/// and each enclosure with Open.
struct MailLetterPaper: View {
    let letter: MailLetter
    /// The enclosure being fetched, if any.
    let openingEnclosure: String?
    let onOpenEnclosure: (MailEnclosure) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            letterhead
            addresses
                .padding(.top, 14)
            if letter.paragraphs.isEmpty {
                Text("There's no text with this one.")
                    .font(.system(size: 14, design: .serif).italic())
                    .foregroundStyle(MailPaper.printSoft)
                    .padding(.top, Spacing.s4)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(letter.paragraphs.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph)
                            .font(.system(size: 15, design: .serif))
                            .foregroundStyle(MailPaper.postalInk)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                            .textSelection(.enabled)
                    }
                }
                .padding(.top, Spacing.s4)
            }
            ForEach(letter.enclosures) { enclosure in
                MailEnclosureSlip(
                    enclosure: enclosure,
                    isOpening: openingEnclosure == enclosure.id
                ) { onOpenEnclosure(enclosure) }
                    .padding(.top, Spacing.s3)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, Spacing.s10)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MailPaper.sheet, in: RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous).strokeBorder(MailPaper.sheetEdge, lineWidth: 1))
        .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
        .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 10)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Letter from \(letter.senderName)")
        .accessibilityIdentifier("mailLetterPaper")
    }

    private var letterhead: some View {
        HStack(spacing: 10) {
            Text(String(letter.senderName.prefix(1)).uppercased())
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(MailPaper.envelope)
                .frame(width: 30, height: 30)
                .background(MailPaper.postalInk, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(letter.senderName.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(MailPaper.postalInk)
                    .fixedSize(horizontal: false, vertical: true)
                if let line = letter.senderLine {
                    Text(line)
                        .font(.system(size: 11))
                        .foregroundStyle(MailPaper.printSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.bottom, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { Rectangle().fill(MailPaper.sheetRule).frame(height: 1) }
        .accessibilityElement(children: .combine)
    }

    private var addresses: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(letter.recipient.name)
                if let line = letter.recipient.addressLine { Text(line) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: Spacing.s0) {
                Text(letter.dateLine)
                    .foregroundStyle(MailPaper.printSoft)
                if let reference = letter.reference {
                    Text(reference)
                        .fontWeight(.bold)
                        .foregroundStyle(MailPaper.postalInk)
                }
            }
            .multilineTextAlignment(.trailing)
        }
        .font(.system(size: 14, design: .serif))
        .foregroundStyle(MailPaper.postalInk)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }
}

/// "Enclosed: warranty card · 1 page · Open".
struct MailEnclosureSlip: View {
    let enclosure: MailEnclosure
    let isOpening: Bool
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 10) {
                Icon(icon, size: 20, color: MailPaper.postalInk)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Enclosed: \(enclosure.name)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(MailPaper.postalInk)
                        .lineLimit(2)
                    if let meta {
                        Text(meta)
                            .font(.system(size: 12))
                            .foregroundStyle(MailPaper.printSoft)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if isOpening {
                    ProgressView()
                        .frame(minWidth: 44, minHeight: 44)
                } else {
                    Text("Open")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minWidth: 44, minHeight: 44)
                }
            }
            .padding(.leading, Spacing.s3)
            .padding(.trailing, Spacing.s1)
            .padding(.vertical, 2)
            .background(MailPaper.slip, in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).strokeBorder(MailPaper.sheetEdge, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isOpening)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(["Enclosed: \(enclosure.name)", meta].compactMap(\.self).joined(separator: ", "))
        .accessibilityHint(isOpening ? "Opening." : "Opens it.")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailLetterEnclosure.\(enclosure.id)")
    }

    private var icon: PantopusIcon {
        (enclosure.mimeType ?? "").hasPrefix("image/") ? .image : .fileText
    }

    /// "PDF · 240 KB".
    private var meta: String? {
        let type: String? = switch enclosure.mimeType ?? "" {
        case "application/pdf": "PDF"
        case let mime where mime.hasPrefix("image/"): "Photo"
        default: nil
        }
        let size = enclosure.sizeBytes.map {
            ByteCountFormatter.string(fromByteCount: Int64($0), countStyle: .file)
        }
        let parts = [type, size].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

/// The paper clip from the drawing (`M7 30 V9 a4 4 0 0 1 8 0 V36 a6 6 0 0 1 -12 0 V14`).
private struct PaperClip: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 22
        let sy = rect.height / 48
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }
        var path = Path()
        path.move(to: point(7, 30))
        path.addLine(to: point(7, 9))
        path.addArc(center: point(11, 9), radius: 4 * sx, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: point(15, 36))
        path.addArc(center: point(9, 36), radius: 6 * sx, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
        path.addLine(to: point(3, 14))
        return path
    }
}

/// A bundle, opened: the pieces it holds, each opening its own letter page.
struct MailBundleContents: View {
    let pieces: [MailPieceModel]
    /// Nil while the pieces load; a message when they couldn't.
    let failure: String?
    let isLoading: Bool
    let onOpen: (String) -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(pieces.isEmpty ? "Inside" : "Inside · \(pieces.count) \(pieces.count == 1 ? "piece" : "pieces")")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.7)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            if isLoading, pieces.isEmpty {
                Shimmer(height: 150, cornerRadius: Radii.sm)
                    .accessibilityLabel("Opening the bundle")
            } else if let failure, pieces.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(failure)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Try again", action: onRetry)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("mailBundleRetry")
                }
            } else if pieces.isEmpty {
                Text("Nothing in this bundle is yours to open.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                ForEach(pieces) { piece in
                    Button { onOpen(piece.id) } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            MailPieceView(model: piece)
                            Text(piece.meta.line)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(piece.spokenWithArrival)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("mailBundlePiece.\(piece.id)")
                }
            }
        }
        .accessibilityIdentifier("mailBundleContents")
    }
}
