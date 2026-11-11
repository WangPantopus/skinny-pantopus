//
//  CardGreetingView.swift
//  Pantopus
//
//  A card's own voice greeting as a thing on the table (wave 4 drawings 2, 3, 4), as web's `CardGreeting.tsx` draws it:
//  a cassette labelled "For {first}" in the sender's pen, or a cream gift tag on a string for Christmas with Jesus
//  Christ (pictures 59-67). Its reels turn while it plays or records, not with Reduce Motion. Nothing plays by itself.
//

import SwiftUI

extension MailPaper {
    static let cassetteTop = rgb(0x3A, 0x34, 0x31)
    static let cassetteBottom = rgb(0x21, 0x1D, 0x1B)
    static let cassetteLabel = rgb(0xF3, 0xEA, 0xD7)
    static let cassetteLine = rgb(0xC9, 0x8B, 0x84)
    static let cassetteWindow = rgb(0x14, 0x11, 0x10)
    static let cassetteReel = rgb(0xE9, 0xE1, 0xD1)
    static let giftTag = rgb(0xEF, 0xE6, 0xD3)
    static let giftTagHole = rgb(0x4A, 0x34, 0x23)
    static let giftTagString = rgb(0x8A, 0x6A, 0x45)
    static let giftTagWords = rgb(0x6B, 0x56, 0x40)
    static let greetingPill = rgb(16, 12, 10).opacity(0.72)
}

/// The cassette or the gift tag itself (not a button).
struct CardGreetingObject: View {
    /// Whose it is: "For {first}".
    let forName: String
    var gift = false
    var turning = false
    var recording = false
    var durationMs: Int?
    var tilt: Double = 3

    private var first: String {
        let name = HolidayCardWords.firstName(forName)
        return name.isEmpty ? forName : name
    }

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            if gift {
                tag(width: width)
            } else {
                cassette(width: width)
            }
        }
        .aspectRatio(gift ? 1.9 : 1.62, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func cassette(width: CGFloat) -> some View {
        VStack(spacing: width * 0.04) {
            ZStack(alignment: .topLeading) {
                MailPaper.cassetteLabel
                Text(verbatim: "For \(first)")
                    .font(Font(CardTableType.pen(width * 0.13)))
                    .foregroundStyle(MailPaper.tablePenInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, width * 0.05)
                    .padding(.top, width * 0.015)
                MailPaper.cassetteLine
                    .frame(height: 1)
                    .padding(.horizontal, width * 0.05)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, width * 0.06)
            }
            .clipShape(RoundedRectangle(cornerRadius: width * 0.02))
            .frame(height: width * 0.27)
            HStack {
                CardGreetingReel(turning: turning)
                Spacer(minLength: 0)
                CardGreetingReel(turning: turning)
            }
            .padding(.horizontal, width * 0.03)
            .padding(.vertical, width * 0.012)
            .frame(width: width * 0.58, height: width * 0.17)
            .background(MailPaper.cassetteWindow, in: Capsule())
        }
        .padding(width * 0.05)
        .frame(width: width, height: width / 1.62, alignment: .top)
        .background(
            LinearGradient(colors: [MailPaper.cassetteTop, MailPaper.cassetteBottom], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: width * 0.06)
        )
        .shadow(color: MailPaper.printShadow.opacity(0.5), radius: 11, x: 0, y: 12)
        .rotationEffect(.degrees(tilt))
    }

    private func tag(width: CGFloat) -> some View {
        let height = width / 1.9
        return ZStack(alignment: .topLeading) {
            CardGiftTagShape()
                .fill(MailPaper.giftTag)
                .shadow(color: MailPaper.printShadow.opacity(0.45), radius: 10, x: 0, y: 10)
            Circle()
                .fill(MailPaper.giftTagHole)
                .frame(width: height * 0.11, height: height * 0.11)
                .position(x: width * 0.09, y: height / 2)
            VStack(alignment: .leading, spacing: height * 0.02) {
                Text(verbatim: "For \(first)")
                    .font(Font(CardTableType.pen(width * 0.125)))
                    .foregroundStyle(MailPaper.tablePenInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 0)
                Group {
                    Text(recording ? "● RECORDING" : turning ? "❚❚ PLAYING" : "▶ PRESS TO PLAY")
                    if let durationMs, !recording {
                        Text(verbatim: HolidayCardGreetingWords.length(durationMs))
                    }
                }
                .font(.system(size: max(8, width * 0.068), weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(MailPaper.giftTagWords)
                .lineLimit(1)
            }
            .padding(.leading, width * 0.24)
            .padding(.trailing, width * 0.06)
            .padding(.vertical, height * 0.13)
            .frame(width: width, height: height, alignment: .leading)
        }
        .frame(width: width, height: height)
        .overlay(alignment: .leading) {
            // The string runs off from the tag's hole.
            Path { path in
                path.move(to: CGPoint(x: width * 0.09, y: height / 2))
                path.addCurve(
                    to: CGPoint(x: -width * 0.22, y: height * 0.3),
                    control1: CGPoint(x: -width * 0.02, y: height * 0.25),
                    control2: CGPoint(x: -width * 0.1, y: height * 0.75)
                )
            }
            .stroke(MailPaper.giftTagString, style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
        }
        .rotationEffect(.degrees(-tilt * 2))
    }
}

/// The gift tag's outline: a rectangle with its left end cut to a point.
private struct CardGiftTagShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.14, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.14, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        path.closeSubpath()
        return path
    }
}

/// A reel behind the cassette's window: turning while it plays or records, still with Reduce Motion.
private struct CardGreetingReel: View {
    let turning: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: !turning || reduceMotion)) { context in
            let angle = turning && !reduceMotion
                ? context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2.4) / 2.4 * 360 : 0
            ZStack {
                Circle()
                    .stroke(MailPaper.cassetteReel, style: StrokeStyle(lineWidth: 2.4, dash: [4.6, 2.7]))
                    .padding(1.5)
                Circle()
                    .fill(MailPaper.cassetteReel.opacity(0.85))
                    .padding(6.5)
            }
            .rotationEffect(.degrees(angle))
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

/// The greeting to press and play: the object, and under a cassette "▶ Press to play · 0:18" (a gift tag carries the
/// words itself). One press loads and plays it; another pauses it.
struct CardGreetingButton: View {
    let source: CardMediaSource?
    var local: Data?
    let durationMs: Int?
    /// Who it's for, on its label.
    let forName: String
    /// Who recorded it, for screen readers.
    let fromName: String
    var gift = false
    var tilt: Double = 3
    /// In sight: once it isn't (the card turned back), it stops.
    var active = true

    @State private var player = HolidayCardGreetingPlayer()

    var body: some View {
        let from = HolidayCardWords.firstName(fromName).isEmpty ? "them" : HolidayCardWords.firstName(fromName)
        Button {
            Task { await player.toggle() }
        } label: {
            VStack(spacing: 6) {
                CardGreetingObject(forName: forName, gift: gift, turning: player.playing, durationMs: durationMs, tilt: tilt)
                if !gift {
                    Text(verbatim: "\(pillWord) · \(HolidayCardGreetingWords.length(durationMs))")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(MailPaper.tableCream)
                        // Its own width, even past a small cassette's (the closed Duo's), so every word shows.
                        .fixedSize()
                        .padding(.horizontal, 11)
                        .padding(.vertical, 4)
                        .background(MailPaper.greetingPill, in: Capsule())
                }
                if player.state == .failed {
                    Text("This greeting couldn’t be played.")
                        .font(.system(size: 12))
                        .foregroundStyle(MailPaper.tableCream)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(player.playing
            ? "Pause the greeting from \(from)"
            : "Play the greeting from \(from), \(HolidayCardGreetingWords.spoken(durationMs))")
        .accessibilityAddTraits(player.playing ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("cardGreeting")
        .onAppear { player.set(source: source, local: local) }
        .onChange(of: source) { _, new in player.set(source: new, local: local) }
        .onChange(of: active) { _, isActive in if !isActive { player.stop() } }
        .onDisappear { player.stop() }
    }

    private var pillWord: String {
        switch player.state {
        case .playing: "❚❚ Playing"
        case .loading: "Loading…"
        case .idle, .failed: "▶ Press to play"
        }
    }
}
