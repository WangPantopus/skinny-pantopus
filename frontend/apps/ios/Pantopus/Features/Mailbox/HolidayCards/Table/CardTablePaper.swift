//
//  CardTablePaper.swift
//  Pantopus
//
//  The colours of the card on the table (launch key `card_table`). These are
//  object colours, not interface colours: the table is always dark, in light
//  mode and dark mode, like a photo viewer, so nothing here changes with the
//  phone's setting.
//

import SwiftUI

extension MailPaper {
    /// The page under the table while it loads, and whatever's left of the screen past the cloth.
    static let tableNight = rgb(0x14, 0x10, 0x13)
    /// The words and buttons around the card.
    static let tableCream = rgb(0xF6, 0xEC, 0xD9)
    static let tableCreamSoft = tableCream.opacity(0.74)
    static let tableCreamFaint = tableCream.opacity(0.5)
    static let tableGlass = rgb(24, 18, 16).opacity(0.36)
    static let tableGlassLine = tableCream.opacity(0.16)
    static let tableToast = rgb(24, 18, 16).opacity(0.88)
    static let tableMenu = rgb(28, 22, 20).opacity(0.94)
    /// The share sheet over the table.
    static let tableSheet = rgb(0x21, 0x1B, 0x19)
    static let tableWax = rgb(0x8B, 0x1D, 0x1D)
    static let tableGold = rgb(0xD8, 0xB7, 0x6F)
    /// Reverence's candlelight from the lower left (plan Part 7).
    static let tableCandle = rgb(255, 176, 96)
    /// Under a card taken out of its envelope in the Mailbox (plan Part 4).
    static let cardTakenOutShadow = rgb(40, 8, 6).opacity(0.45)
    /// The window's vignette at its darkest.
    static let tableVignette = rgb(6, 3, 4)

    /// The pen on the back of the card.
    static let tablePenInk = rgb(0x1B, 0x2A, 0x5C)
    static let tableRule = rgb(74, 84, 118).opacity(0.2)
    static let tableFromLabel = rgb(0x6A, 0x5F, 0x52)
    static let tableFoot = rgb(0x8A, 0x7F, 0x70)
    static let tablePhotoEdge = rgb(70, 50, 20).opacity(0.25)
    static let tableCardEdge = rgb(110, 80, 30).opacity(0.2)
    static let tablePaperDefault = rgb(0xF9, 0xF1, 0xE3)
    static let tablePostmarkInk = rgb(19, 13, 15).opacity(0.8)

    /// The pen on the envelope.
    static let tableToName = rgb(0xFB, 0xEE, 0xD2)
    static let tableToNameShadow = rgb(60, 8, 10).opacity(0.5)
    static let tableFromName = rgb(0xF4, 0xE2, 0xBF)
    static let tableSealedStamp = rgb(0xEC, 0xD7, 0xA4)
    /// The light sliding over the gold in the lining, and over the card.
    static let tableGlint = rgb(255, 238, 186)
    static let tableGlintEdge = rgb(255, 232, 170)
    static let tableSheen = rgb(255, 250, 235)
    /// The paper slip on a share picture, and a link preview's words.
    static let tableSlip = rgb(0xF4, 0xEA, 0xD6)
    static let tableSlipInk = rgb(0x3A, 0x2F, 0x26)
    static let tableSlipLine = rgb(0x5B, 0x4D, 0x3F)
    static let tableLinkCaption = rgb(0xFB, 0xF1, 0xDC)
    static let tableLinkTitle = rgb(0xE8, 0xD3, 0xA4)

    /// A colour from 0-255 channels, in sRGB.
    static func rgb(_ red: Double, _ green: Double, _ blue: Double) -> Color {
        Color(.sRGB, red: red / 255, green: green / 255, blue: blue / 255)
    }

    /// The colour the grey cloth is multiplied by, from the picture's table colour (a hex string from the server,
    /// slate if it's missing or malformed). The formula bakes each cloth the way the sample's tables were baked.
    static func tableTint(_ hex: String?) -> Color {
        let channels = hexChannels(hex) ?? SIMD3(0x3B / 255, 0x4C / 255, 0x6E / 255)
        let (red, green) = (channels.x, channels.y)
        let blue = channels.z
        let lum = 0.299 * red + 0.587 * green + 0.114 * blue
        guard lum > 0 else { return .black }
        func tint(_ channel: Double) -> Double {
            min(1, max(0, (lum + (channel - lum) * 1.12) * (0.135 / lum) * 1.7))
        }
        return Color(.sRGB, red: tint(red), green: tint(green), blue: tint(blue))
    }

    private static func hexChannels(_ hex: String?) -> SIMD3<Double>? {
        guard var text = hex else { return nil }
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        return SIMD3(Double(value >> 16 & 0xFF) / 255, Double(value >> 8 & 0xFF) / 255, Double(value & 0xFF) / 255)
    }
}
