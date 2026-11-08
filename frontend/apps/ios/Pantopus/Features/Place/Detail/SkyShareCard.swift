//
//  SkyShareCard.swift
//  Pantopus
//
//  "Share today's sky": the top of Today as a picture to send — the title
//  and date, the Now card's living sky with its reading, the sun card, and
//  Pantopus at the foot — or as a four-second clip in which the rain or
//  snow keeps falling. Drawn at the moment of sharing from what the screen
//  shows, in the screen's light or dark look. Only the city, never the
//  street or the house; no bins or neighbours' lights either. Parity twin
//  of Android's `SkyShareCard.kt`.
//

import AVFoundation
import CoreImage.CIFilterBuiltins
import SwiftUI

/// What the shared picture shows: the screen's weather, sun and air at a moment.
struct SkyShareCard {
    let weather: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?
    let air: SkyAir?
    let city: String
    /// The state after the city ("Camas, WA"); empty leaves the city alone.
    var state = ""
    /// The weather's source and when it was read, as under the Now card
    /// ("Apple WeatherKit · 11:16 PM").
    var source: String?
    var date: Date = .now
    var calendar: Calendar = .autoupdatingCurrent
    /// The screen's look when it was shared.
    var colorScheme: ColorScheme = .light
    /// Where the code at the foot leads: this build's web home page.
    var link = InviteLinks.siteURLString

    /// A story's 1080 × 1920 pixels, laid out at a phone's 402 points.
    static let width: CGFloat = 402
    static let height: CGFloat = 402 * 1920 / 1080
    static let scale: CGFloat = 1080 / 402
    static let clipSeconds = 4.0
    static let framesPerSecond = 30

    /// The same card at another moment.
    func at(_ moment: Date) -> SkyShareCard {
        var card = self
        card.date = moment
        return card
    }

    var place: String {
        state.isEmpty ? city : "\(city), \(state)"
    }

    /// "Today in Camas": the files' name.
    var title: String {
        "Today in \(city)"
    }

    var moment: SkyMoment {
        SkyMoment.at(date, sunrise: sun?.sunriseClock, sunset: sun?.sunsetClock, calendar: calendar)
    }

    var palette: SkyPalette.Sky {
        SkyPalette.sky(moment.phase, SkyPalette.Weather(weather.conditionCode))
    }

    /// Today's note when there is one worth sharing (never the household's pickup day).
    var note: SkyNote? {
        SkyNote.pick(now: date, moment: moment, weather: weather, pickups: [], air: air, calendar: calendar)
    }

    /// Rain, sleet or snow is falling, so a clip has something to show.
    var falls: Bool {
        let kind = SkyPalette.Weather(weather.conditionCode)
        return kind == .wet || kind == .storm || kind == .snow || weather.conditionCode == .sleet
    }

    /// Snow drifts down too slowly to loop cleanly, so a clip's end fades into its start.
    private var snows: Bool {
        SkyPalette.Weather(weather.conditionCode) == .snow || weather.conditionCode == .sleet
    }

    /// The picture as a PNG file to hand to the share sheet.
    @MainActor
    func pictureFile() throws -> URL {
        let renderer = ImageRenderer(content: SkyShareCardView(card: self))
        renderer.scale = Self.scale
        guard let data = renderer.uiImage?.pngData() else { throw CocoaError(.fileWriteUnknown) }
        let url = try Self.folder().appending(path: "\(fileName).png")
        try data.write(to: url, options: .atomic)
        return url
    }

    /// The clip as an H.264 movie file: the page drawn once, then only the Now
    /// card, frame by frame, over its place.
    @MainActor
    func clipFile() async throws -> URL {
        let url = try Self.folder().appending(path: "\(fileName).mp4")
        let plate = SkySharePlate()
        let pageRenderer = ImageRenderer(content: SkyShareCardView(card: self, plate: plate))
        pageRenderer.scale = Self.scale
        guard let page = pageRenderer.cgImage, plate.frame.width > 0 else { throw CocoaError(.fileWriteUnknown) }
        let clip = try SkyClipWriter(url: url, framesPerSecond: Self.framesPerSecond)
        let whole = CGRect(x: 0, y: 0, width: SkyClipWriter.width, height: SkyClipWriter.height)
        // Core Graphics counts from the bottom.
        let spot = CGRect(
            x: plate.frame.minX * Self.scale,
            y: CGFloat(SkyClipWriter.height) - plate.frame.maxY * Self.scale,
            width: plate.frame.width * Self.scale,
            height: plate.frame.height * Self.scale
        )
        let sky = ImageRenderer(content: SkyShareNowCard(card: self, falling: 0).frame(width: plate.frame.width))
        sky.scale = Self.scale
        let frames = Int(Self.clipSeconds) * Self.framesPerSecond
        let fade = snows ? Self.framesPerSecond * 2 / 3 : 0
        for frame in 0..<frames {
            // A second in, so a fade's earlier frames never reach before the start.
            let time = 1 + Double(frame) / Double(Self.framesPerSecond)
            sky.content = SkyShareNowCard(card: self, falling: time).frame(width: plate.frame.width)
            guard let now = sky.cgImage else { throw CocoaError(.fileWriteUnknown) }
            var early: (image: CGImage, alpha: CGFloat)?
            if frame >= frames - fade {
                sky.content = SkyShareNowCard(card: self, falling: time - Self.clipSeconds).frame(width: plate.frame.width)
                if let image = sky.cgImage {
                    early = (image, CGFloat(frame - (frames - fade) + 1) / CGFloat(fade))
                }
            }
            try await clip.append(frame) { context in
                context.draw(page, in: whole)
                context.draw(now, in: spot)
                if let early {
                    context.setAlpha(early.alpha)
                    context.draw(early.image, in: spot)
                }
            }
            await Task.yield()
        }
        try await clip.finish()
        return url
    }

    var fileName: String {
        title.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
    }

    private static func folder() throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appending(path: "sky-share", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }
}

/// Where the Now card sits on the page, noted while a clip's page is drawn.
@MainActor
final class SkySharePlate {
    var frame: CGRect = .zero

    func note(_ frame: CGRect) -> some View {
        self.frame = frame
        return Color.clear
    }
}

/// Frames into an H.264 movie the picture's size.
@MainActor
private final class SkyClipWriter {
    static let width = 1080
    static let height = 1920

    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private let adaptor: AVAssetWriterInputPixelBufferAdaptor
    private let framesPerSecond: Int

    init(url: URL, framesPerSecond: Int) throws {
        try? FileManager.default.removeItem(at: url)
        writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Self.width,
            AVVideoHeightKey: Self.height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 10_000_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ],
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2
            ]
        ])
        input.expectsMediaDataInRealTime = false
        adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Self.width,
            kCVPixelBufferHeightKey as String: Self.height
        ])
        self.framesPerSecond = framesPerSecond
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
        writer.startSession(atSourceTime: .zero)
    }

    func append(_ frame: Int, draw: (CGContext) -> Void) async throws {
        var made: CVPixelBuffer?
        guard let pool = adaptor.pixelBufferPool,
              CVPixelBufferPoolCreatePixelBuffer(nil, pool, &made) == kCVReturnSuccess, let buffer = made else {
            writer.cancelWriting()
            throw writer.error ?? CocoaError(.fileWriteUnknown)
        }
        CVPixelBufferLockBaseAddress(buffer, [])
        if let space = CGColorSpace(name: CGColorSpace.sRGB), let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: Self.width,
            height: Self.height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) {
            draw(context)
        }
        CVPixelBufferUnlockBaseAddress(buffer, [])
        while !input.isReadyForMoreMediaData {
            try await Task.sleep(for: .milliseconds(5))
        }
        adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(framesPerSecond)))
    }

    func finish() async throws {
        input.markAsFinished()
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            writer.finishWriting { done.resume() }
        }
        guard writer.status == .completed else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
    }
}

/// The picture: Today's title, the Now card, the sun card and Pantopus, on
/// the page's own ground.
struct SkyShareCardView: View {
    let card: SkyShareCard
    /// A clip frame's moment for the rain or snow; nil holds them still.
    var falling: Double?
    /// For a clip: the Now card's place keeps only its shadow (the card is
    /// drawn over it frame by frame), and where it is goes here.
    var plate: SkySharePlate?

    private static let page = "skySharePage"

    var body: some View {
        VStack(spacing: 0) {
            title
            now
            if let source = card.source {
                Text(source)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 12)
            } else {
                Spacer().frame(height: 12)
            }
            if let sun = card.sun {
                TodaySunArcCard(data: sun, calendar: card.calendar, weather: card.weather.conditionCode, at: card.date)
            }
            Spacer(minLength: 24)
            foot
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 52)
        .padding(.bottom, 44)
        .frame(width: SkyShareCard.width, height: SkyShareCard.height)
        .background(Theme.Color.appBg)
        .coordinateSpace(.named(Self.page))
        .environment(\.colorScheme, card.colorScheme)
    }

    /// Today's title, date and place, as at the top of the tab
    /// (`AddressTodayTabView.titleBlock`), with the city for the address.
    private var title: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Today")
                    .font(.system(size: 22, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                Text(card.date.formatted(
                    Date.FormatStyle(timeZone: card.calendar.timeZone)
                        .weekday(.abbreviated)
                        .month(.abbreviated)
                        .day()
                ))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text(card.place)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 2)
        .padding(.vertical, 10)
        .padding(.bottom, 2)
    }

    @ViewBuilder
    private var now: some View {
        let shadow = RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(card.palette.mid.color)
            .shadow(color: card.palette.mid.color(opacity: 0.28), radius: 14, y: 6)
        if let plate {
            SkyShareNowCard(card: card)
                .hidden()
                .background(shadow)
                .background(GeometryReader { proxy in plate.note(proxy.frame(in: .named(Self.page))) })
        } else {
            SkyShareNowCard(card: card, falling: falling)
                .background(shadow)
        }
    }

    /// Pantopus, its address, and a code a phone can scan from the picture.
    private var foot: some View {
        HStack(spacing: 12) {
            PantopusMark(size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Powered by Pantopus")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(URL(string: card.link)?.host() ?? card.link)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if let code = SkyShareCode.image(card.link) {
                Image(decorative: code, scale: 1)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: 58, height: 58)
                    .padding(5)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(SkyPalette.white.color))
            }
        }
        .padding(.horizontal, 4)
    }
}

/// The Now card as `TodaySkyHero` draws it, without the household's own
/// house, bins or street lights, and without its shadow.
struct SkyShareNowCard: View {
    let card: SkyShareCard
    /// A clip frame's moment for the rain or snow; nil holds them still.
    var falling: Double?

    var body: some View {
        let moment = card.moment
        let painter = TodaySkyPainter(
            condition: card.weather.conditionCode,
            moment: moment,
            temperature: card.weather.currentTempF,
            note: nil,
            season: SkySeason.at(card.date, calendar: card.calendar),
            meteorShower: SkyNote.meteors(now: card.date, moment: moment, calendar: card.calendar) != nil,
            smoke: card.air?.smoke ?? 0,
            rain: SkyScrub.rain(card.weather.hourly, at: card.date),
            windMph: card.weather.windMph,
            windFrom: card.weather.windDirection,
            still: true,
            falling: falling
        )
        ZStack(alignment: .topLeading) {
            Canvas { context, size in
                painter.paint(context, size: size, time: 0)
            }
            TodaySkyReading(
                reading: SkyReadingModel(now: card.weather, note: card.note, picked: nil, at: card.date, calendar: card.calendar),
                hours: 0,
                scrub: .constant(nil)
            )
        }
        .frame(maxWidth: .infinity, minHeight: TodaySkyHero.height)
        // Its own height, as in the tab's scroll view, not a share of the page.
        .fixedSize(horizontal: false, vertical: true)
        .background(card.palette.mid.color)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(SkyPalette.white.color(opacity: 0.1), lineWidth: 1))
    }
}

/// The code at the foot, one pixel a module (drawn without smoothing), made once per address.
@MainActor
private enum SkyShareCode {
    private static var made: (link: String, image: CGImage)?

    static func image(_ link: String) -> CGImage? {
        if let made, made.link == link { return made.image }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(link.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage, let image = CIContext().createCGImage(output, from: output.extent) else { return nil }
        made = (link, image)
        return image
    }
}
