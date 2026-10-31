//
//  HolidayCardArt.swift
//  Pantopus
//
//  A Christmas card (launch key `holiday_cards`; the web's `mailbox/cards`):
//  the founder's picture with its own cream border and, under it, the strip
//  the app prints as the original cards had it (the picture's caption by
//  hand, "CHRISTMAS, 2026" and a red postmark with the day it was mailed);
//  the back, where the note sits on faint rules; and turning it over. Every
//  size is a share of the card's width, as on the web, so a card reads the
//  same at any size. Like the Mailbox's drawn mail it is an illustration
//  with fixed type; VoiceOver reads it as one sentence.
//

import SwiftUI
import UIKit

/// The season's pictures. The first 17 ship with the app
/// (`Assets.xcassets/HolidayCards`); the website serves every other one
/// (`<web origin>/holiday-cards/<id>.jpg`, `-thumb.jpg` for the smaller
/// copy), and the phone keeps each one it loads (`PantopusImagePipeline`),
/// so it shows again offline and after a relaunch.
enum HolidayCardPicture {
    /// The picture, or its smaller copy for grids and thumbs, when it's at
    /// hand: shipped with the app, or loaded already. Nil until one from the
    /// website loads.
    static func image(_ design: String, thumb: Bool = false) -> UIImage? {
        if let shipped = UIImage(named: name(design, thumb: thumb)) { return shipped }
        return url(design, thumb: thumb).flatMap { PantopusImagePipeline.shared.cachedImage(for: $0) }
    }

    /// The picture from the app, the phone's copy or the website; nil when
    /// it can't load (offline, an error).
    static func load(_ design: String, thumb: Bool = false) async -> UIImage? {
        if let image = image(design, thumb: thumb) { return image }
        guard let url = url(design, thumb: thumb) else { return nil }
        return await PantopusImagePipeline.shared.image(for: url)
    }

    /// Loads pictures before they show, so they're there at once. Never in
    /// Low Data Mode or offline.
    @MainActor
    static func loadAhead(_ designs: [String], thumb: Bool = false, network: NetworkMonitor = .shared) {
        guard network.isOnline, !network.isLowData else { return }
        for design in designs where image(design, thumb: thumb) == nil {
            guard let url = url(design, thumb: thumb) else { continue }
            Task(priority: .utility) { _ = await PantopusImagePipeline.shared.image(for: url) }
        }
    }

    /// Where the website keeps a picture: this build's web origin
    /// (`PantopusPublicWebURL`). Nil for an id that isn't a picture's.
    static func url(_ design: String, thumb: Bool) -> URL? {
        guard design.range(of: #"^[a-z0-9][a-z0-9-]{0,63}$"#, options: .regularExpression) != nil else { return nil }
        return URL(string: InviteLinks.publicPageURLString(path: "/holiday-cards/\(name(design, thumb: thumb)).jpg"))
    }

    /// "christmas-2026-18", or "christmas-2026-18-thumb" for the smaller copy.
    static func name(_ design: String, thumb: Bool) -> String {
        thumb ? "\(design)-thumb" : design
    }

    /// Width over height of a picture before it loads: its height at 960
    /// wide from the server, else 960 × 1048.
    static func aspect(height: Int?) -> CGFloat {
        960 / CGFloat(height.flatMap { $0 > 0 ? $0 : nil } ?? 1048)
    }

    /// The three thumbs fanned out on the way in.
    static let fan = ["christmas-2026-01", "christmas-2026-08", "christmas-2026-15"]
}

/// The hand a caption is printed in: Nothing You Could Do (SIL OFL, bundled).
enum HolidayCardHand {
    static func font(size: CGFloat) -> Font {
        .custom("NothingYouCouldDo", size: size)
    }
}

/// A picture. One from the website shows as plain paper of its shape until
/// it loads, and stays paper when it can't: never a spinner or a broken
/// picture.
struct HolidayCardPictureView: View {
    let design: String
    var paper: String?
    /// The picture's height at 960 wide (the server's): its shape before it loads.
    var height: Int?
    var thumb = false

    var body: some View {
        HolidayCardPictureImage(design: design, thumb: thumb) { image in
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } else {
                MailPaper.cardPaper(paper)
                    .aspectRatio(HolidayCardPicture.aspect(height: height), contentMode: .fit)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Hands its content the picture once it's at hand (nil until then),
/// loading one from the website; it tries again when the phone comes back
/// online.
struct HolidayCardPictureImage<Content: View>: View {
    let design: String
    var thumb = false
    @ViewBuilder let content: (UIImage?) -> Content
    @State private var loaded: Loaded?

    private struct Loaded {
        let name: String
        let image: UIImage
    }

    var body: some View {
        let name = HolidayCardPicture.name(design, thumb: thumb)
        let image = HolidayCardPicture.image(design, thumb: thumb) ?? (loaded?.name == name ? loaded?.image : nil)
        content(image)
            .task(id: image == nil ? "\(name) \(NetworkMonitor.shared.isOnline)" : name) {
                guard image == nil, let picture = await HolidayCardPicture.load(design, thumb: thumb), !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: 0.2)) { loaded = Loaded(name: name, image: picture) }
            }
    }
}

/// The picture side: the photo, then the printed strip, with the soft darker
/// edges of an old card over both.
struct HolidayCardFront: View {
    let design: String
    let caption: String?
    let paper: String?
    /// The picture's height at 960 wide (the server's): its shape before it loads.
    var height: Int?
    let year: Int
    /// The day it was mailed ("OCT 30") for the postmark; none while it's
    /// being written.
    var mailedOn: String?
    var thumb = false

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HolidayCardPictureView(design: design, paper: paper, height: height, thumb: thumb)
            HolidayCardStrip(caption: caption, year: year, mailedOn: mailedOn)
                .aspectRatio(1 / 0.15, contentMode: .fit)
        }
        .background(MailPaper.cardPaper(paper))
        .overlay { HolidayCardEdges() }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// What the app prints under the picture: the caption by hand, the year,
/// and the postmark at the right.
private struct HolidayCardStrip: View {
    let caption: String?
    let year: Int
    let mailedOn: String?

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let text = caption ?? ""
            // About the size the original cards printed it; a long caption
            // gets smaller so it stays on one line beside the postmark (the
            // hand runs up to 0.53 em a letter).
            let captionSize = width * min(0.048, 0.70 / max(1, CGFloat(text.count) * 0.53))
            ZStack(alignment: .topLeading) {
                CardGrain()
                Text(text)
                    .font(HolidayCardHand.font(size: captionSize))
                    .foregroundStyle(MailPaper.cardCaptionInk)
                    .lineLimit(1)
                    .fixedSize()
                    .frame(width: width * 0.74, height: captionSize)
                    .offset(x: width * 0.04, y: width * 0.034)
                Text("CHRISTMAS, \(String(year))")
                    .font(.system(size: width * 0.022, design: .serif))
                    .tracking(width * 0.022 * 0.42)
                    .foregroundStyle(MailPaper.cardYearInk)
                    .lineLimit(1)
                    .fixedSize()
                    .frame(width: width * 0.74)
                    .offset(x: width * 0.04, y: width * 0.102)
                HolidayCardPostmark(day: mailedOn, year: year)
                    .frame(width: width * 0.2, height: width * 0.12)
                    .offset(x: width * 0.78, y: width * 0.018)
            }
        }
    }
}

/// The red postmark: two rings with the day over the year, and three wavy
/// lines to the right (drawn in the web's 100 × 60 box).
struct HolidayCardPostmark: View {
    let day: String?
    let year: Int

    var body: some View {
        Canvas { context, size in
            let unit = size.width / 100
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * unit, y: y * unit)
            }
            let ink = MailPaper.cardPostmark
            context.stroke(
                Path(ellipseIn: CGRect(x: 14 * unit, y: 8 * unit, width: 44 * unit, height: 44 * unit)),
                with: .color(ink.opacity(0.82)),
                lineWidth: 1.6 * unit
            )
            context.stroke(
                Path(ellipseIn: CGRect(x: 17.5 * unit, y: 11.5 * unit, width: 37 * unit, height: 37 * unit)),
                with: .color(ink.opacity(0.82)),
                lineWidth: 0.8 * unit
            )
            for y: CGFloat in [21, 30, 39] {
                var wave = Path()
                wave.move(to: point(58, y))
                wave.addQuadCurve(to: point(70, y), control: point(64, y - 4))
                wave.addQuadCurve(to: point(82, y), control: point(76, y + 4))
                wave.addQuadCurve(to: point(94, y), control: point(88, y - 4))
                context.stroke(wave, with: .color(ink.opacity(0.82)), lineWidth: 1.6 * unit)
            }
            let dayText = day.flatMap { $0.isEmpty ? nil : $0 }
            let daySize = (dayText == nil ? 10 : 7.6) * unit
            let yearSize = 8.5 * unit
            // The web sets each line on its baseline; a cap's middle sits about a third of the size above it.
            context.draw(
                Text(dayText ?? "DEC").font(.system(size: daySize, weight: .bold, design: .serif))
                    .foregroundColor(ink.opacity(0.86)),
                at: point(36, (dayText == nil ? 33 : 28) - daySize / unit * 0.35)
            )
            context.draw(
                Text(String(year)).font(.system(size: yearSize, weight: .bold, design: .serif))
                    .foregroundColor(ink.opacity(0.86)),
                at: point(36, (dayText == nil ? 45 : 40) - 8.5 * 0.35)
            )
        }
        .accessibilityHidden(true)
    }
}

/// Paper grain: faint dots every 6 points, so a printed strip reads as card stock.
struct CardGrain: View {
    var color = MailPaper.cardGrain

    var body: some View {
        Canvas { context, size in
            var dots = Path()
            var y: CGFloat = 3
            while y < size.height {
                var x: CGFloat = 3
                while x < size.width {
                    dots.addEllipse(in: CGRect(x: x - 0.65, y: y - 0.65, width: 1.3, height: 1.3))
                    x += 6
                }
                y += 6
            }
            context.fill(dots, with: .color(color))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The soft darker edges of an old card, over its whole face.
struct HolidayCardEdges: View {
    var body: some View {
        GeometryReader { geo in
            Rectangle()
                .strokeBorder(MailPaper.cardEdge, lineWidth: geo.size.width * 0.03)
                .blur(radius: geo.size.width * 0.015)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The back of a card, laid over the picture side at the same size: the same
/// card stock, faint rules with the note on them, who it's from printed at
/// the bottom, and the Pantopus Post line under that. `note` draws the
/// writing in the box it's given (its width decides the type's size).
struct HolidayCardBack<Note: View>: View {
    let paper: String?
    let fromName: String
    let year: Int
    @ViewBuilder let note: (_ cardWidth: CGFloat) -> Note

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let noteHeight = max(0, geo.size.height - width * 0.23)
            ZStack {
                MailPaper.cardPaper(paper)
                CardGrain()
                ZStack(alignment: .topLeading) {
                    CardRules(pitch: width * HolidayCardNote.pitch)
                    note(width)
                }
                .frame(width: width * 0.84, height: noteHeight)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.leading, width * 0.08)
                .padding(.top, width * 0.08)
                Text("FROM \(fromName.uppercased())")
                    .font(.system(size: width * 0.03, design: .serif))
                    .tracking(width * 0.03 * 0.2)
                    .foregroundStyle(MailPaper.cardFrom)
                    .lineLimit(1)
                    .frame(width: width * 0.84, alignment: .leading)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .padding(.leading, width * 0.08)
                    .padding(.bottom, width * 0.075)
                Text("PANTOPUS POST · CHRISTMAS \(String(year))")
                    .font(.system(size: width * 0.019, design: .serif))
                    .tracking(width * 0.019 * 0.3)
                    .foregroundStyle(MailPaper.cardFooter)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, width * 0.03)
            }
        }
        .overlay { HolidayCardEdges() }
        .clipped()
    }
}

/// One faint rule under each line of the note.
private struct CardRules: View {
    let pitch: CGFloat

    var body: some View {
        Canvas { context, size in
            guard pitch > 2 else { return }
            var rules = Path()
            var y = pitch - 0.5
            while y < size.height {
                rules.move(to: CGPoint(x: 0, y: y))
                rules.addLine(to: CGPoint(x: size.width, y: y))
                y += pitch
            }
            context.stroke(rules, with: .color(MailPaper.cardRuleLine), lineWidth: 1)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A card you can turn over: the back laid over the picture side, turning in
/// half a second; with Reduce Motion the sides swap without turning.
struct HolidayCardFlip<Front: View, Back: View>: View {
    let showBack: Bool
    @ViewBuilder let front: Front
    @ViewBuilder let back: Back
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let angle: Double = showBack ? 180 : 0
        front
            .modifier(CardSide(angle: angle, isBack: false))
            .overlay { back.modifier(CardSide(angle: angle, isBack: true)) }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.5), value: showBack)
    }
}

/// One side of a turning card: it turns with the card and shows only while
/// it faces you (the turn's angle is read at every frame).
private struct CardSide: ViewModifier, Animatable {
    var angle: Double
    let isBack: Bool

    var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    func body(content: Content) -> some View {
        let backShows = angle > 90
        content
            .rotation3DEffect(.degrees(isBack ? angle - 180 : angle), axis: (x: 0, y: 1, z: 0), perspective: 0.35)
            .opacity(backShows == isBack ? 1 : 0)
            .allowsHitTesting(backShows == isBack)
            .accessibilityHidden(backShows != isBack)
    }
}
