//
//  MomentMarks+Studio.swift
//  Pantopus
//
//  "Pulse, reinvented", phase 0 step 4 (founder, 2026-11-26): the Studio's
//  Text and Draw. Text gets twelve letterings and Draw gets a highlighter, an
//  arrow and an eraser; both take inks from the photo itself (its own colors,
//  and an eyedropper). They are extra fields on today's marks
//  (`MomentMarks`), empty unless the Studio set them, so a Moment drawn in
//  today's editor is drawn exactly as before. Like every mark they are drawn
//  into the picture on the phone before it goes up: the server and every app
//  see an ordinary picture.
//

import SwiftUI
import UIKit

extension MomentMarks {
    /// What drew a line. `marker` is today's pen.
    enum Pen: String, CaseIterable {
        case marker, highlighter, arrow, eraser

        var name: String {
            switch self {
            case .marker: "Pen"
            case .highlighter: "Highlighter"
            case .arrow: "Arrow"
            case .eraser: "Eraser"
            }
        }

        var icon: PantopusIcon {
            switch self {
            case .marker: .pencil
            case .highlighter: .highlighter
            case .arrow: .arrowUpRight
            case .eraser: .eraser
            }
        }

        /// A highlighter and an eraser are wider than the line width picked: a highlighter covers words, an eraser is
        /// easy to aim.
        var widthFactor: CGFloat {
            switch self {
            case .marker, .arrow: 1
            case .highlighter: 2.6
            case .eraser: 2.4
            }
        }
    }

    /// A label's letters. `standard` is today's (bold system letters); the rest are on every iPhone, or bundled with
    /// the app (Handwritten).
    enum Typeface: String, CaseIterable {
        case standard, serif, rounded, mono, tall, wide, poster, elegant, typewriter, marker, handwritten, script

        var name: String {
            switch self {
            case .standard: "Classic"
            case .serif: "Serif"
            case .rounded: "Rounded"
            case .mono: "Mono"
            case .tall: "Tall"
            case .wide: "Wide"
            case .poster: "Poster"
            case .elegant: "Elegant"
            case .typewriter: "Typewriter"
            case .marker: "Marker"
            case .handwritten: "Handwritten"
            case .script: "Script"
            }
        }

        /// The letters at `size` points (or units).
        func uiFont(_ size: CGFloat) -> UIFont {
            let bold = UIFont.systemFont(ofSize: size, weight: .bold)
            switch self {
            case .standard: return bold
            case .serif: return Self.designed(.serif, weight: .bold, size: size)
            case .rounded: return Self.designed(.rounded, weight: .heavy, size: size)
            case .mono: return Self.designed(.monospaced, weight: .bold, size: size)
            case .tall: return UIFont.systemFont(ofSize: size, weight: .heavy, width: .condensed)
            case .wide: return UIFont.systemFont(ofSize: size, weight: .bold, width: .expanded)
            case .poster: return UIFont(name: "Futura-CondensedExtraBold", size: size) ?? bold
            case .elegant: return UIFont(name: "Didot-Bold", size: size) ?? bold
            case .typewriter: return UIFont(name: "AmericanTypewriter-Bold", size: size) ?? bold
            case .marker: return UIFont(name: "MarkerFelt-Wide", size: size) ?? bold
            case .handwritten: return UIFont(name: "NothingYouCouldDo", size: size) ?? bold
            case .script: return UIFont(name: "SnellRoundhand-Black", size: size) ?? bold
            }
        }

        /// The same letters for a SwiftUI view (the label being typed in, the lettering row).
        func font(_ size: CGFloat) -> Font {
            self == .standard ? .system(size: size, weight: .bold) : Font(uiFont(size) as CTFont)
        }

        private static func designed(_ design: UIFontDescriptor.SystemDesign, weight: UIFont.Weight, size: CGFloat) -> UIFont {
            let system = UIFont.systemFont(ofSize: size, weight: weight)
            return system.fontDescriptor.withDesign(design).map { UIFont(descriptor: $0, size: size) } ?? system
        }
    }

    /// An ink taken from the photo (its own colors, or the eyedropper), in sRGB from 0 to 1.
    struct Tint: Equatable, Hashable {
        var red: CGFloat
        var green: CGFloat
        var blue: CGFloat

        var uiColor: UIColor {
            UIColor(red: red, green: green, blue: blue, alpha: 1)
        }

        /// How light it looks (Rec. 709 weights): dark letters go on a light one.
        var lightness: CGFloat {
            0.2126 * red + 0.7152 * green + 0.0722 * blue
        }

        var isLight: Bool {
            lightness > 0.6
        }

        /// How far apart two inks look, roughly (0 the same, about 1.7 black to white).
        func distance(to other: Tint) -> CGFloat {
            let (dr, dg, db) = (red - other.red, green - other.green, blue - other.blue)
            return (2 * dr * dr + 4 * dg * dg + 3 * db * db).squareRoot() / 3
        }

        /// A plain name for VoiceOver ("Dark green", "Light blue").
        var spokenName: String {
            let high = max(red, green, blue)
            let low = min(red, green, blue)
            let chroma = high - low
            let light = lightness
            if chroma < 0.12 {
                return light > 0.85 ? "White" : light < 0.15 ? "Black" : light > 0.55 ? "Light gray" : "Gray"
            }
            var hue: CGFloat = if high == red {
                ((green - blue) / chroma).truncatingRemainder(dividingBy: 6)
            } else if high == green {
                (blue - red) / chroma + 2
            } else {
                (red - green) / chroma + 4
            }
            hue = (hue * 60 + 360).truncatingRemainder(dividingBy: 360)
            let base = switch hue {
            case ..<15, 345...: "red"
            case ..<40: light < 0.45 ? "brown" : "orange"
            case ..<70: "yellow"
            case ..<160: "green"
            case ..<200: "teal"
            case ..<255: "blue"
            case ..<290: "purple"
            default: "pink"
            }
            let shade = light > 0.7 ? "Light " : light < 0.3 ? "Dark " : ""
            return shade.isEmpty ? base.capitalized : shade + base
        }
    }
}

extension MomentMarks.Stroke {
    /// A line only the Studio draws: a highlighter, an arrow, an eraser, or an ink from the photo.
    var isStudio: Bool {
        pen != .marker || tint != nil
    }
}

/// What the Studio's Text and Draw make the next line or label with, held by the composer's marking (so a fold keeps
/// it) while the Studio is open. Nil in today's composer: its lines and labels are made as before.
struct MomentsStudioTools {
    /// Draw: the pen, and an ink from the photo (nil: the six inks' own).
    var pen = MomentMarks.Pen.marker
    var drawTint: MomentMarks.Tint?
    /// Text: the letters, and an ink from the photo.
    var font = MomentMarks.Typeface.standard
    var textTint: MomentMarks.Tint?
    /// The eyedropper is out: a finger on the picture takes the ink under it.
    var dropping = false
    /// See the picture first (`MomentsStudioWhole`): fingers on the first screen move the picture through Resize's
    /// editor, open without its screen.
    var adjusting = false
    /// The picture the marks are on, small, to read its colors from: made when Text or Draw opens in the Studio.
    var picture: MomentsStudioSample?
    /// Behind the subject: Vision is lifting it now, or found none in this picture.
    var lifting = false
    var noSubject = false
    /// Cutouts on the Studio's picture (`MomentsStudioCutouts`), drawn into it at Post, and the one picked.
    var cutouts: [MomentMarks.Cutout] = []
    var pickedCutout: UUID?
    /// "Also show in Explore" ("Pulse, reinvented" phase 1, CONTRACT 6f, `MomentsStudioExplore`).
    var explore = false
    /// "+ Ask / Kind" (phase 1, CONTRACT 6d, `MomentsStudioPostKind`): the kind picked and its details.
    var post = MomentsStudioPostDraft()
    /// Film looks (`MomentsStudioLooks`): the look picked, and the photo as it was before any look, so another look
    /// starts from it again.
    var look = MomentsStudioLook.original
    var lookOriginal: UIImage?
    /// The photo the look made: while the picture is still that one, the look and its original hold.
    var lookResult: UIImage?
    /// Before and after (`MomentsStudioBeforeAfter`): the side-by-side picture it made, and what to put back.
    var pair: MomentsStudioPair?
    /// People picked after "@" in the caption (`MomentsStudioMentions`): sent while their "@Name" is still in it.
    var mentioned: [MomentsStudioMention] = []
    /// Illuminate's dots on things in the picture (`MomentsStudioDots`), and the one being edited.
    var dots: [MomentDotDTO] = []
    var pickedDot: String?
    /// Blur before posting (`MomentsStudioBlur`): what was found on this photo, and the blurred photo.
    var blur: MomentsStudioBlurState?
    /// Sound (`MomentsStudioSound`): Voice Spark with its words, or place sound; and each whisper dot's three seconds.
    var voice: MomentsStudioRecording?
    var voiceWords = ""
    var place: MomentsStudioRecording?
    var whispers: [String: MomentsStudioRecording] = [:]
    /// Playable items made in the tray's Play maker (`MomentsStudioPlay`), and the one picked on the picture.
    var play: [MomentPlayItem] = []
    var pickedPlay: String?
    /// Loop (`MomentsStudioLoop`, CONTRACT 7j): the loop made from the video, and the video it was made from.
    var loop: MomentsStudioLoopMade?
    /// A Live Photo's motion (`MomentsStudioMotion`): its clip, the photo it's being copied for, and "Motion on".
    var motion: MomentsStudioMotionClip?
    var motionFor: String?
    var keepsMotion = true

    /// A line just begun: made with the pen and ink picked here.
    func dress(_ stroke: inout MomentMarks.Stroke) {
        stroke.pen = pen
        stroke.tint = pen == .eraser ? nil : drawTint
        stroke.width *= pen.widthFactor
    }

    /// A label just added: in the letters and ink picked here.
    func dress(_ label: inout MomentMarks.Label) {
        label.font = font
        label.tint = textTint
    }
}
