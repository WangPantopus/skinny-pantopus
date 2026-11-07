//
//  CardTableArt.swift
//  Pantopus
//
//  The art of the card on the table (launch key `card_table`). Asset catalogs
//  can't hold WebP, so it ships as loose files in `HolidayCardTable/` and is
//  decoded away from the main thread before the screen shows. The decoded set
//  stays only while something holds it.
//

import SwiftUI
import UIKit

/// The decoded art.
final class CardTableArt: Sendable {
    let envelopeFront: UIImage
    let pocket: UIImage
    let inside: UIImage
    let flapOut: UIImage
    let flapIn: UIImage
    let flapGold: UIImage
    let pocketShadow: UIImage
    let flapShadow: UIImage
    let wax: UIImage
    let waxCracked: UIImage
    let stampPeak: UIImage
    let stampFir: UIImage
    let stampRiver: UIImage
    let postmark: UIImage
    let paper: UIImage
    let light: UIImage
    let cloth: UIImage
    /// 256 pixels to 128 points, so it stays as fine as film grain.
    let grain: UIImage

    private init() async {
        async let envelopeFront = Self.decoded("env-front")
        async let pocket = Self.decoded("env-pocket")
        async let inside = Self.decoded("env-inside")
        async let flapOut = Self.decoded("env-flap-out")
        async let flapIn = Self.decoded("env-flap-in")
        async let flapGold = Self.decoded("env-flap-gold")
        async let pocketShadow = Self.decoded("env-pocket-shadow")
        async let flapShadow = Self.decoded("env-flap-shadow")
        async let wax = Self.decoded("wax-gold")
        async let waxCracked = Self.decoded("wax-gold-cracked")
        async let stampPeak = Self.decoded("stamp-peak")
        async let stampFir = Self.decoded("stamp-fir")
        async let stampRiver = Self.decoded("stamp-river")
        async let postmark = Self.decoded("postmark-blank")
        async let paper = Self.decoded("paper")
        async let light = Self.decoded("light")
        async let cloth = Self.decoded("table-cloth")
        async let grain = Self.decoded("grain", type: "png", scale: 2)
        self.envelopeFront = await envelopeFront
        self.pocket = await pocket
        self.inside = await inside
        self.flapOut = await flapOut
        self.flapIn = await flapIn
        self.flapGold = await flapGold
        self.pocketShadow = await pocketShadow
        self.flapShadow = await flapShadow
        self.wax = await wax
        self.waxCracked = await waxCracked
        self.stampPeak = await stampPeak
        self.stampFir = await stampFir
        self.stampRiver = await stampRiver
        self.postmark = await postmark
        self.paper = await paper
        self.light = await light
        self.cloth = await cloth
        self.grain = await grain
    }

    /// The card's stamp, from its number (`["fir","peak","river"][(n-1)%3]`, so a card always has the same one).
    func stamp(number: Int?) -> UIImage {
        switch ((number ?? 1) - 1 + 3) % 3 {
        case 0: stampFir
        case 1: stampPeak
        default: stampRiver
        }
    }

    // MARK: Loading

    @MainActor private weak static var current: CardTableArt?

    /// The art, decoded away from the main thread (at once when it's already held).
    @MainActor
    static func load() async -> CardTableArt {
        if let current { return current }
        let art = await Task.detached(priority: .userInitiated) { await CardTableArt() }.value
        current = art
        return art
    }

    /// One file, as a small image for something that doesn't need the whole set (the Mailbox row); nil if it's
    /// missing.
    static func file(_ name: String, type: String = "webp", scale: CGFloat = 1) -> UIImage? {
        guard let path = Bundle.main.path(forResource: name, ofType: type, inDirectory: "HolidayCardTable"),
              let image = UIImage(contentsOfFile: path) else { return nil }
        guard scale != 1, let cgImage = image.cgImage else { return image }
        return UIImage(cgImage: cgImage, scale: scale, orientation: .up)
    }

    private static func decoded(_ name: String, type: String = "webp", scale: CGFloat = 1) async -> UIImage {
        let image = file(name, type: type, scale: scale)
        assert(image != nil, "Missing card table art: \(name)")
        guard let image else { return UIImage() }
        return await image.byPreparingForDisplay() ?? image
    }
}
