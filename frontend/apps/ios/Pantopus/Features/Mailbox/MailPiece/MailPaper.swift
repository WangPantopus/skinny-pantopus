//
//  MailPaper.swift
//  Pantopus
//
//  The paper and ink of the Mail tab's drawn mail (Mail tab drawings, board
//  "Parts", 2026-10-27): cream letter paper, white window envelopes, postcard
//  card, kraft, the booklet's cover, postal ink, the stamps' art and the
//  mailbox. These are object colours, not interface colours, so they live in
//  this one palette (exempt from the hex guard in `verify-tokens.sh`, like
//  the other bespoke palettes). In dark mode the paper dims instead of
//  inverting, so a letter still reads as paper and its ink keeps contrast.
//

import SwiftUI
import UIKit

enum MailPaper {
    // MARK: Paper

    /// Letter paper (cream).
    static let letter = dynamic(light: 0xFBF6EA, dark: 0xD9D1BE)
    static let letterEdge = dynamic(light: 0xEBE1CB, dark: 0xB9AF98)
    /// Window envelope and enclosed sheets (white).
    static let envelope = dynamic(light: 0xFFFFFF, dark: 0xD8DCE1)
    static let envelopeEdge = dynamic(light: 0xE2E8F0, dark: 0xA9B1BC)
    /// The envelope's window.
    static let window = dynamic(light: 0xEEF5FA, dark: 0xC6D3DD)
    static let windowEdge = dynamic(light: 0xCFE0EB, dark: 0x9FB2C1)
    /// Postcard card.
    static let card = dynamic(light: 0xFFFDF7, dark: 0xDDD8CB)
    static let cardRule = dynamic(light: 0xE2DCCD, dark: 0xB4AD9C)
    /// Special delivery's inner sheet.
    static let special = dynamic(light: 0xFFFDF8, dark: 0xDCD7CC)
    /// Kraft paper and its tape.
    static let kraft = dynamic(light: 0xC9A676, dark: 0xA88A5F)
    static let kraftInk = dynamic(light: 0x3B2A16, dark: 0x2A1E10)
    static let tape = Color(red: 246 / 255, green: 232 / 255, blue: 186 / 255).opacity(0.78)
    /// The booklet's cover and its pages under it.
    static let bookletCover = Color(red: 0x0C / 255, green: 0x4A / 255, blue: 0x6E / 255)
    static let bookletTitle = Color.white
    static let bookletSubtitle = Color(red: 0xBA / 255, green: 0xE6 / 255, blue: 0xFD / 255)
    static let bookletPage = dynamic(light: 0xF8FAFC, dark: 0xC9CED6)
    static let bookletPageUnder = dynamic(light: 0xF1F5F9, dark: 0xB8BEC8)

    /// The letter itself, unfolded on its page, its rules, and an
    /// enclosure's slip inside it.
    static let sheet = dynamic(light: 0xFFFEFA, dark: 0xDDD8CC)
    static let sheetEdge = dynamic(light: 0xECE7DA, dark: 0xB9AF98)
    static let sheetRule = dynamic(light: 0xE7E1D2, dark: 0xBDB4A0)
    static let slip = dynamic(light: 0xF8F6F0, dark: 0xCFC9BB)
    /// The Counter's surface, and the manila of due tags and Vault folders.
    static let counter = dynamic(light: 0xEEEAE3, dark: 0x2A2723)
    static let manila = dynamic(light: 0xF3E3B5, dark: 0xD9C79A)
    static let manilaTab = dynamic(light: 0xE6CF92, dark: 0xC4AF7C)
    static let manilaEdge = dynamic(light: 0xD9C48C, dark: 0xB39F6E)
    static let manilaInk = Color(red: 0x5C / 255, green: 0x44 / 255, blue: 0x10 / 255)
    /// The closed Home mailbox (grey, padlocked).
    static let lockedBody = Color(red: 0x94 / 255, green: 0xA3 / 255, blue: 0xB8 / 255)
    static let lockedDoor = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)
    static let lockedPlate = Color(red: 0xF1 / 255, green: 0xF5 / 255, blue: 0xF9 / 255)
    /// The paper clip holding Pantopus's note to the letter.
    static let clip = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)

    // MARK: Ink

    /// Postmarks, printed postage and typewritten labels.
    static let postalInk = Color(red: 0x1F / 255, green: 0x29 / 255, blue: 0x37 / 255)
    /// Handwritten addresses (serif).
    static let handInk = Color(red: 0x0F / 255, green: 0x17 / 255, blue: 0x2A / 255)
    static let handInkSoft = Color(red: 0x33 / 255, green: 0x41 / 255, blue: 0x55 / 255)
    /// Secondary print on paper (return address lines).
    static let printSoft = Color(red: 0x4E / 255, green: 0x55 / 255, blue: 0x63 / 255)
    /// The verified mark's green and the unverified red, printed on paper.
    static let verifiedInk = Color(red: 0x04 / 255, green: 0x78 / 255, blue: 0x57 / 255)
    static let pantopusInk = Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xA1 / 255)
    static let warningInk = Color(red: 0xA8 / 255, green: 0x1A / 255, blue: 0x1A / 255)
    /// Lines on the sheet peeking out of an opened envelope.
    static let sheetLine = Color(red: 0xCB / 255, green: 0xD5 / 255, blue: 0xE1 / 255)
    static let sheetLineSoft = Color(red: 0xE2 / 255, green: 0xE8 / 255, blue: 0xF0 / 255)

    // MARK: Special delivery border

    static let stripeRed = Color(red: 0xA8 / 255, green: 0x1A / 255, blue: 0x1A / 255)
    static let stripeBlue = Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xA1 / 255)
    static let stripeWhite = Color.white

    // MARK: Stamps (art)

    static let firSky = Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xA1 / 255)
    static let firTree = Color(red: 0xE0 / 255, green: 0xF2 / 255, blue: 0xFE / 255)
    static let sun = Color(red: 0xFD / 255, green: 0xE6 / 255, blue: 0x8A / 255)
    static let peakSky = Color(red: 0x9A / 255, green: 0x4A / 255, blue: 0x08 / 255)
    static let peakRock = Color(red: 0xFE / 255, green: 0xF3 / 255, blue: 0xC7 / 255)
    static let riverLand = Color(red: 0x15 / 255, green: 0x80 / 255, blue: 0x3D / 255)
    static let riverWater = Color(red: 0xBB / 255, green: 0xF7 / 255, blue: 0xD0 / 255)
    static let riverPeak = Color(red: 0xDC / 255, green: 0xFC / 255, blue: 0xE7 / 255)

    // MARK: The mailbox

    static let mailboxPost = Color(red: 0x8A / 255, green: 0x6A / 255, blue: 0x4A / 255)
    static let mailboxBody = Color(red: 0x02 / 255, green: 0x84 / 255, blue: 0xC7 / 255)
    static let mailboxDoor = Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xA1 / 255)
    static let mailboxInside = Color(red: 0x0B / 255, green: 0x25 / 255, blue: 0x37 / 255)
    static let mailboxHandle = Color(red: 0xE0 / 255, green: 0xF2 / 255, blue: 0xFE / 255)
    static let mailboxPlate = Color(red: 0xF8 / 255, green: 0xFA / 255, blue: 0xFC / 255)
    static let mailboxFlag = Color(red: 0xC2 / 255, green: 0x41 / 255, blue: 0x0C / 255)

    // MARK: Christmas cards (holiday_cards; the web's `cards/cardArt.ts`)

    /// The red card envelope, its cream ink, and the "Christmas card" label.
    static let cardEnvelope = dynamic(light: 0x9F2F28, dark: 0x8F2A24)
    static let cardEnvelopeInk = Color(red: 0xFD / 255, green: 0xF2 / 255, blue: 0xE3 / 255)
    static let cardEnvelopeAddress = Color(red: 0xFF / 255, green: 0xFA / 255, blue: 0xF0 / 255)
    static let cardEnvelopeLabel = Color(red: 0xFD / 255, green: 0xE7 / 255, blue: 0xC8 / 255)
    /// The "Do not open until Christmas" seal: cream, ringed in dark red.
    static let cardSeal = Color(red: 0xFD / 255, green: 0xF2 / 255, blue: 0xE3 / 255)
    static let cardSealInk = Color(red: 0x7A / 255, green: 0x14 / 255, blue: 0x14 / 255)
    /// Wax red: the card flow's buttons, its step dots and headings; and the
    /// cream of the words on a wax button.
    static let wax = Color(red: 0x8B / 255, green: 0x1D / 255, blue: 0x1D / 255)
    static let waxText = Color(red: 0xFF / 255, green: 0xF7 / 255, blue: 0xED / 255)
    /// The printed strip under the picture: the caption's hand, the year, the
    /// red postmark; and the soft darker edges of an old card.
    static let cardCaptionInk = Color(red: 0x1D / 255, green: 0x2B / 255, blue: 0x63 / 255)
    static let cardYearInk = Color(red: 0x2B / 255, green: 0x26 / 255, blue: 0x22 / 255)
    static let cardPostmark = Color(red: 0xB2 / 255, green: 0x41 / 255, blue: 0x3A / 255)
    static let cardEdge = Color(red: 110 / 255, green: 80 / 255, blue: 30 / 255).opacity(0.13)
    static let cardGrain = Color(red: 120 / 255, green: 95 / 255, blue: 60 / 255).opacity(0.07)
    static let cardShadow = Color(red: 60 / 255, green: 40 / 255, blue: 10 / 255)
    /// The back: fountain-pen blue, its faint rules, who it's from, the footer.
    static let cardInk = Color(red: 0x2C / 255, green: 0x4A / 255, blue: 0x8A / 255)
    static let cardRuleLine = Color(red: 120 / 255, green: 100 / 255, blue: 70 / 255).opacity(0.22)
    static let cardFrom = Color(red: 0x4A / 255, green: 0x3F / 255, blue: 0x33 / 255)
    static let cardFooter = Color(red: 0x8A / 255, green: 0x7A / 255, blue: 0x62 / 255)
    /// The desk the card flow sits on (the app's own background in dark mode),
    /// and the cream of its fields, rows and notes, their edges and lines.
    static let cardDesk = Color(red: 0xF5 / 255, green: 0xF0 / 255, blue: 0xE8 / 255)
    static let cardField = dynamic(light: 0xFFFDF8, dark: 0xE7E2D6)
    static let cardFieldEdge = dynamic(light: 0xD6CBB6, dark: 0xB4AA96)
    static let cardRowEdge = dynamic(light: 0xE3D8C3, dark: 0xBFB49F)
    static let cardRowLine = dynamic(light: 0xE7DCC6, dark: 0xC4B9A3)
    static let cardNote = dynamic(light: 0xFBF6EC, dark: 0xE2DCCF)
    static let cardPressed = dynamic(light: 0xF5EFE3, dark: 0xD9D2C3)
    /// A person's initial in the search rows.
    static let cardAvatar = Color(red: 0xEB / 255, green: 0xE3 / 255, blue: 0xD4 / 255)
    static let cardAvatarInk = Color(red: 0x5B / 255, green: 0x4A / 255, blue: 0x36 / 255)
    /// Words on the cream: dark, softer, and the soft words on the desk.
    static let cardText = Color(red: 0x11 / 255, green: 0x18 / 255, blue: 0x27 / 255)
    static let cardTextSoft = Color(red: 0x37 / 255, green: 0x41 / 255, blue: 0x51 / 255)
    static let cardTextMuted = Color(red: 0x4E / 255, green: 0x55 / 255, blue: 0x63 / 255)
    /// The step dots still ahead.
    static let cardDotAhead = Color(red: 0xD6 / 255, green: 0xCB / 255, blue: 0xB6 / 255)
    /// The small headings on the desk (Look it over's sections) and its soft
    /// links ("Open it again").
    static let cardLabel = Color(red: 0x6B / 255, green: 0x5A / 255, blue: 0x3E / 255)
    static let cardLink = Color(red: 0x7C / 255, green: 0x4A / 255, blue: 0x2D / 255)

    /// A card's paper from its design (`#rrggbb`); the season's cream when
    /// it's missing or unreadable.
    static func cardPaper(_ hex: String?) -> Color {
        let digits = (hex ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "# "))
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else {
            return Color(uiColor: uiColor(0xF7F0E2))
        }
        return Color(uiColor: uiColor(value))
    }

    /// A colour that dims in dark mode (paper under a lamp, not inverted).
    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            uiColor(traits.userInterfaceStyle == .dark ? dark : light)
        })
    }

    private static func uiColor(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
