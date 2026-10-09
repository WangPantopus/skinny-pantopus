//
//  SkyPalette.swift
//  Pantopus
//
//  Illustration colours for the Today tab: the living sky over the
//  resident's house (one gradient per time of day and kind of weather),
//  the ground and house silhouettes, sun, moon and window light, and the
//  EPA air-quality band hues the AQI gauge draws.
//
//  Why not in `Theme.Color`? A sky looks the same in light and dark mode,
//  and the scene blends these colours (a silhouette is the horizon colour
//  darkened), which the asset-catalog `(name) → Color` tokens can't do.
//  Kept here, like `SpeciesPalette`, so no hex literal reaches `Features/**`.
//  The values mirror Android's `SkyPalette.kt`.
//

import SwiftUI

/// An sRGB colour held as components so the scene can blend two of them.
public struct SkyRGB: Sendable, Hashable {
    public let red: Double
    public let green: Double
    public let blue: Double

    public init(red: Double, green: Double, blue: Double) {
        self.red = red
        self.green = green
        self.blue = blue
    }

    /// `SkyRGB(0x0B5FA5)`: a 24-bit RGB value.
    public init(_ rgb: UInt32) {
        red = Double((rgb >> 16) & 0xFF) / 255
        green = Double((rgb >> 8) & 0xFF) / 255
        blue = Double(rgb & 0xFF) / 255
    }

    /// Linear blend toward `other`; `amount` 0 keeps this colour, 1 gives `other`.
    public func mixed(with other: SkyRGB, by amount: Double) -> SkyRGB {
        let t = min(max(amount, 0), 1)
        return SkyRGB(
            red: red + (other.red - red) * t,
            green: green + (other.green - green) * t,
            blue: blue + (other.blue - blue) * t
        )
    }

    public var color: Color {
        Color(red: red, green: green, blue: blue)
    }

    public func color(opacity: Double) -> Color {
        Color(red: red, green: green, blue: blue, opacity: opacity)
    }
}

public enum SkyPalette {
    /// Where the sun is: the 40 minutes either side of sunrise and sunset
    /// get their own warm skies.
    public enum Phase: Sendable, Hashable {
        case dawn
        case day
        case dusk
        case night
    }

    /// The weather families the sky distinguishes.
    public enum Weather: Sendable, Hashable {
        case clear
        case partly
        case overcast
        case fog
        case wet
        case snow
        case storm
    }

    /// Zenith, middle and horizon colours of the sky.
    public struct Sky: Sendable, Hashable {
        public let top: SkyRGB
        public let mid: SkyRGB
        public let bottom: SkyRGB

        init(_ top: UInt32, _ mid: UInt32, _ bottom: UInt32) {
            self.top = SkyRGB(top)
            self.mid = SkyRGB(mid)
            self.bottom = SkyRGB(bottom)
        }
    }

    public static func sky(_ phase: Phase, _ weather: Weather) -> Sky {
        switch phase {
        case .day: daySky(weather)
        case .dawn: dawnSky(weather)
        case .dusk: duskSky(weather)
        case .night: nightSky(weather)
        }
    }

    private static func daySky(_ weather: Weather) -> Sky {
        switch weather {
        case .clear: Sky(0x0B5FA5, 0x1D8FD8, 0x7CC8F2)
        case .partly: Sky(0x22609F, 0x4A8DCB, 0xA3CDEB)
        case .overcast: Sky(0x46566B, 0x677A8F, 0xA5B3C3)
        case .fog: Sky(0x5E6C7E, 0x8592A2, 0xC3CCD6)
        case .wet: Sky(0x2B394D, 0x44566C, 0x7B8DA2)
        case .snow: Sky(0x4A5F79, 0x7A90A8, 0xCAD7E4)
        case .storm: Sky(0x1C2433, 0x2D3849, 0x4A586C)
        }
    }

    private static func dawnSky(_ weather: Weather) -> Sky {
        switch weather {
        case .clear: Sky(0x1F2F6B, 0x7A4E9E, 0xF2A273)
        case .partly: Sky(0x26356E, 0x7E5A9C, 0xE9A783)
        case .overcast: Sky(0x363D52, 0x685F78, 0xB0948F)
        case .fog: Sky(0x454B5E, 0x7A7488, 0xC2AAA2)
        case .wet: Sky(0x262E40, 0x4C4A5F, 0x8A7A80)
        case .snow: Sky(0x3A4560, 0x76708C, 0xD4BDB8)
        case .storm: Sky(0x191D2B, 0x2F2D40, 0x55495A)
        }
    }

    private static func duskSky(_ weather: Weather) -> Sky {
        switch weather {
        case .clear: Sky(0x1B1846, 0x8E3A6E, 0xF0884A)
        case .partly: Sky(0x211D4C, 0x86426F, 0xE58F5E)
        case .overcast: Sky(0x2A2B40, 0x584A60, 0xA07B70)
        case .fog: Sky(0x3A3A4E, 0x6A5D6E, 0xB5938A)
        case .wet: Sky(0x1F2233, 0x423A4E, 0x7A5F62)
        case .snow: Sky(0x2F3350, 0x6A5C7A, 0xC9A9A8)
        case .storm: Sky(0x14151F, 0x2A2433, 0x4D3A44)
        }
    }

    private static func nightSky(_ weather: Weather) -> Sky {
        switch weather {
        case .clear: Sky(0x060A1C, 0x101838, 0x25305C)
        case .partly: Sky(0x080D20, 0x141C3B, 0x2A3459)
        case .overcast: Sky(0x0E121B, 0x1A202D, 0x2B3444)
        case .fog: Sky(0x12161E, 0x202631, 0x353D4A)
        case .wet: Sky(0x0A101C, 0x152031, 0x253349)
        case .snow: Sky(0x111829, 0x202D47, 0x3C4C68)
        case .storm: Sky(0x06080E, 0x111522, 0x1F2536)
        }
    }

    /// Near-black blue the ground silhouettes are darkened toward.
    public static let ink = SkyRGB(0x04070F)
    public static let white = SkyRGB(0xFFFFFF)
    public static let black = SkyRGB(0x000000)
    /// The legibility scrim behind the temperature (slate 950).
    public static let scrim = SkyRGB(0x020617)

    /// Sun disc high in the sky, and low near sunrise and sunset.
    public static let sunHigh = SkyRGB(0xFFE08A)
    public static let sunLow = SkyRGB(0xFFC27A)
    public static let moon = SkyRGB(0xEEF1FA)
    public static let moonShadow = SkyRGB(0xCBD5F5)
    public static let moonGlow = SkyRGB(0xE2E8FF)
    /// Lamp light in the house windows after dark.
    public static let windowGlow = SkyRGB(0xFFD27A)

    /// Partly-cloudy puffs, tinted by the light they're in.
    public static let cloudDawn = SkyRGB(0xF6E3EA)
    public static let cloudDusk = SkyRGB(0xF8DCCB)
    public static let cloudNight = SkyRGB(0x3A4668)

    public static let rainDay = SkyRGB(0xE1EBFA)
    public static let rainNight = SkyRGB(0xAABEE6)
    public static let fogDay = SkyRGB(0xEBF0F5)
    public static let fogNight = SkyRGB(0xC8D2E1)
    public static let lightning = SkyRGB(0xEBF0FF)
    public static let bolt = SkyRGB(0xFFFADC)
    public static let smoke = SkyRGB(0xE6EBF5)
    public static let leafDay = SkyRGB(0xEAB308)
    public static let leafNight = SkyRGB(0xA08C5A)
    /// Frost creeping in from the card's corners on a freezing morning.
    public static let frost = SkyRGB(0xE8F4FF)
    /// Wildfire smoke: the amber veil by day, a brown one at night, and the
    /// dim red sun seen through it.
    public static let smokeHaze = SkyRGB(0xC8A27A)
    public static let smokeHazeNight = SkyRGB(0x5A4636)
    public static let smokeSun = SkyRGB(0xF0743E)

    /// The round tree through the year, blended into the silhouette.
    public static let treeSpring = SkyRGB(0x7BC67E)
    public static let treeSummer = SkyRGB(0x3F8F4A)
    public static let treeAutumn = SkyRGB(0xE07A2E)
    public static let treeAutumnDeep = SkyRGB(0xB8432A)
    public static let blossom = SkyRGB(0xF9A8D4)
    public static let pine = SkyRGB(0x2F6B3F)

    /// Bins at the curb: garbage, recycling, yard waste.
    public static let binGarbage = SkyRGB(0x4B5563)
    public static let binRecycling = SkyRGB(0x2563EB)
    public static let binYard = SkyRGB(0x15803D)

    /// Snow-covered hills and house, day and night.
    public static let snowHillBackDay = SkyRGB(0xDCE5EF)
    public static let snowHillFrontDay = SkyRGB(0xF3F6FA)
    public static let snowHouseDay = SkyRGB(0x5E7088)
    public static let snowHillBackNight = SkyRGB(0x5B6B86)
    public static let snowHillFrontNight = SkyRGB(0x46546E)
    public static let snowHouseNight = SkyRGB(0x2C3850)

    /// EPA AQI category hues, Good → Hazardous (the web's `AQI_BANDS`).
    public static let airQualityBands: [SkyRGB] = [
        SkyRGB(0x16A34A), SkyRGB(0xEAB308), SkyRGB(0xF97316),
        SkyRGB(0xDC2626), SkyRGB(0x7C3AED), SkyRGB(0x7F1D1D)
    ]
}
