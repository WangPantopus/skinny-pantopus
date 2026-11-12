//
//  MomentsRingViews.swift
//  Pantopus
//
//  The pieces boards M1, M2 and P5 build the Moments map from: the face in a
//  ring (a person's photo or initials, a business's logo or store, the
//  Pantopus mark), the ring itself (sky to green while something in it is
//  new to you, grey once watched, one segment per Moment), the pin on the
//  map with its tail, the face in the strip, the crowded spot's bubble, and
//  your own ring while a Moment posts.
//

import SwiftUI

// MARK: - Face

/// The face inside a ring: the author's photo over their initials, a store
/// for a business without a logo, the Pantopus mark for the curator.
struct MomentAvatar: View {
    let author: MomentAuthorDTO
    let size: CGFloat

    var body: some View {
        let tone = author.kind == .business ? MomentsPalette.Tone.violet : MomentsPalette.Tone.of(author.id)
        ZStack {
            Circle().fill(author.kind == .pantopus ? Color.white : tone.fill)
            switch author.kind {
            case .pantopus:
                PantopusMark(size: size * 0.6).accessibilityHidden(true)
            case .business where author.photoURL == nil:
                Icon(.store, size: size * 0.48, strokeWidth: 1.75, color: tone.ink)
            default:
                Text(author.initials)
                    .font(.system(size: Self.fontSize(for: size), weight: .semibold))
                    .foregroundStyle(tone.ink)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            if author.kind != .pantopus {
                AvatarPhoto(url: author.photoURL)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private static func fontSize(for size: CGFloat) -> CGFloat {
        switch size {
        case 48...: 18
        case 42...: 15
        case 38...: 14
        default: 13
        }
    }
}

/// The small check of a verified resident, on a ring or beside a name.
struct MomentVerifiedCheck: View {
    var size: CGFloat = 18
    var border: CGFloat = 2

    var body: some View {
        ZStack {
            Circle().fill(Theme.Color.primarySolid)
            Icon(.check, size: size * 0.5, strokeWidth: 3, color: .white)
        }
        .frame(width: size, height: size)
        .overlay {
            if border > 0 { Circle().stroke(MomentsPalette.pinSurface, lineWidth: border) }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Ring

/// The ring around a face: one segment per Moment, each sky to green while
/// it's new to you and grey once watched. A single Moment is a whole ring.
struct MomentRingStroke: View {
    /// Seen or not, per Moment, in the order they play.
    let seen: [Bool]
    let lineWidth: CGFloat

    var body: some View {
        GeometryReader { geo in
            let count = max(seen.count, 1)
            let radius = (min(geo.size.width, geo.size.height) - lineWidth) / 2
            let circumference = 2 * Double.pi * Double(radius)
            // The boards' dash: each segment is its share of the ring less 8 pt, round caps over the gap.
            let share = count > 1 ? max((circumference / Double(count) - 8) / circumference, 0.02) : 1
            ZStack {
                ForEach(0..<count, id: \.self) { index in
                    let start = Double(index) / Double(count)
                    let isSeen = index < seen.count ? seen[index] : false
                    Circle()
                        .inset(by: lineWidth / 2)
                        .trim(from: start, to: start + share)
                        .stroke(
                            isSeen ? AnyShapeStyle(MomentsPalette.ringSeen) : AnyShapeStyle(MomentsPalette.ringGradient),
                            style: StrokeStyle(lineWidth: lineWidth, lineCap: count > 1 ? .round : .butt)
                        )
                }
            }
            .rotationEffect(.degrees(-90))
        }
    }
}

// MARK: - Map pin

/// Board M1's pin: a 64 × 72 disc with a tail, the ring and the face, and the
/// verified check at the bottom right. Its point is the tail's tip.
struct MomentRingPin: View {
    let ring: MomentRingDTO
    /// Playing in the card beside the map on the open iPhone Duo (board O2): a quarter bigger, standing on its tip,
    /// in a sky halo.
    var playing = false

    static let size = CGSize(width: 64, height: 72)
    /// Where the tip of the tail sits in the pin, for the map's anchor.
    static let anchor = UnitPoint(x: 0.5, y: 71.0 / 72.0)
    /// The playing ring's scale, and how far its middle then sits above the tip.
    static let playingScale: CGFloat = 1.25
    static let playingMiddleAboveTip = (71 - 32) * playingScale

    var body: some View {
        // One view either way, so the face's photo isn't loaded again when the ring starts or stops playing.
        pin
            .scaleEffect(playing ? Self.playingScale : 1, anchor: Self.anchor)
            .background {
                if playing {
                    Circle()
                        .fill(MomentsPalette.ringStart.opacity(0.2))
                        .overlay(Circle().strokeBorder(MomentsPalette.ringStart.opacity(0.4), lineWidth: 2))
                        .frame(width: 108, height: 108)
                        .position(x: 32, y: 71 - Self.playingMiddleAboveTip)
                }
            }
    }

    private var pin: some View {
        ZStack(alignment: .topLeading) {
            PinTail()
                .fill(MomentsPalette.pinSurface)
                .frame(width: 64, height: 72)
            Circle()
                .fill(MomentsPalette.pinSurface)
                .frame(width: 63, height: 63)
                .offset(x: 0.5, y: 0.5)
            MomentRingStroke(seen: ring.ringSeen, lineWidth: 3.5)
                .frame(width: 62, height: 62)
                .offset(x: 1, y: 1)
            // The face, or a small look at their newest Moment with the face as a badge (`MomentPinPreview.swift`).
            MomentPinInside(ring: ring)
            if ring.author.verified {
                MomentVerifiedCheck()
                    .offset(x: 44, y: 42)
            }
        }
        .frame(width: Self.size.width, height: Self.size.height, alignment: .topLeading)
        .compositingGroup()
        .shadow(color: .black.opacity(0.3), radius: 1.5, x: 0, y: 2)
    }
}

/// The pin's tail: a triangle under the disc, its tip at (32, 71).
private struct PinTail: Shape {
    func path(in rect: CGRect) -> Path {
        let scaleX = rect.width / 64
        let scaleY = rect.height / 72
        var path = Path()
        path.move(to: CGPoint(x: 25 * scaleX, y: 58 * scaleY))
        path.addLine(to: CGPoint(x: 32 * scaleX, y: 71 * scaleY))
        path.addLine(to: CGPoint(x: 39 * scaleX, y: 58 * scaleY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Strip face

/// A face in the strip under the map: a 56 pt ring and the first name under it.
struct MomentStripFace: View {
    let ring: MomentRingDTO

    var body: some View {
        VStack(spacing: Spacing.s1) {
            MomentRingFace(ring: ring)
            Text(ring.mine ? "You" : ring.author.shortName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(ring.isNew || ring.mine ? Theme.Color.appText : Theme.Color.appTextSecondary)
                .lineLimit(1)
                .frame(maxWidth: 60)
        }
        .frame(width: 62)
    }
}

/// A face in its ring, 56 pt: the strip's faces, and the crowded spot's list on the open iPhone Duo (board O3).
struct MomentRingFace: View {
    let ring: MomentRingDTO

    var body: some View {
        ZStack {
            Circle().fill(MomentsPalette.pinSurface).frame(width: 55, height: 55)
            MomentRingStroke(seen: ring.ringSeen, lineWidth: 3)
                .frame(width: 54.5, height: 54.5)
            MomentAvatar(author: ring.author, size: 44)
        }
        .frame(width: 56, height: 56)
    }
}

// MARK: - Crowded spot

/// Board M1's bubble for a crowded spot: up to three faces and "+N", in a
/// ring that's sky to green while anything in it is new, with a tail.
struct MomentClusterBubble: View {
    let rings: [MomentRingDTO]

    var body: some View {
        let shown = Array(rings.prefix(3))
        let hasNew = rings.contains { $0.isNew || $0.mine }
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                HStack(spacing: -12) {
                    ForEach(shown) { ring in
                        MomentAvatar(author: ring.author, size: 32)
                            .overlay(Circle().stroke(MomentsPalette.pinSurface, lineWidth: 2))
                            .frame(width: 36, height: 36)
                    }
                }
                if rings.count > shown.count {
                    Text("+\(rings.count - shown.count)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.leading, 6)
                }
            }
            .padding(.leading, 4)
            .padding(.trailing, rings.count > shown.count ? 12 : 4)
            .frame(height: 44)
            .background(Capsule().fill(MomentsPalette.pinSurface))
            .overlay(
                Capsule().strokeBorder(
                    hasNew ? AnyShapeStyle(MomentsPalette.ringGradient) : AnyShapeStyle(MomentsPalette.ringSeen),
                    lineWidth: 3
                )
                .padding(-3)
            )
            .padding(3)
            ClusterTail()
                .fill(MomentsPalette.pinSurface)
                .frame(width: 16, height: 9)
                .offset(y: -1)
        }
        .compositingGroup()
        .shadow(color: .black.opacity(0.25), radius: 3, x: 0, y: 2)
    }
}

private struct ClusterTail: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Posting

/// Board P5: your ring while a Moment posts, its progress drawn round the
/// face in the primary colour over a light track.
struct MomentPostingRing: View {
    let progress: Double
    let avatar: MomentAuthorDTO?
    /// The map's pin (64 pt, with a tail) or the strip's face (56 pt).
    var asPin = true

    var body: some View {
        let size: CGFloat = asPin ? 64 : 56
        let line: CGFloat = asPin ? 3.5 : 3
        let face: CGFloat = asPin ? 50 : 44
        ZStack(alignment: .top) {
            if asPin {
                PinTail().fill(MomentsPalette.pinSurface).frame(width: 64, height: 72)
            }
            ZStack {
                Circle().fill(MomentsPalette.pinSurface).frame(width: size - 1, height: size - 1)
                Circle()
                    .inset(by: line / 2 + 0.5)
                    .stroke(MomentsPalette.ringTrack, lineWidth: line)
                Circle()
                    .inset(by: line / 2 + 0.5)
                    .trim(from: 0, to: max(0.02, min(progress, 1)))
                    .stroke(Theme.Color.primarySolid, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                MomentSelfFace(author: avatar, size: face)
            }
            .frame(width: size, height: size)
        }
        .frame(width: size, height: asPin ? 72 : 56, alignment: .top)
        .compositingGroup()
        .shadow(color: .black.opacity(asPin ? 0.3 : 0), radius: 1.5, x: 0, y: 2)
    }
}

extension MomentAuthorDTO {
    /// You, from the signed-in account, as your own ring shows you.
    init(me user: UserDTO) {
        self.init(
            id: user.id,
            name: user.displayName ?? "",
            firstName: nil,
            avatarURL: user.avatarURL?.absoluteString,
            initials: nil,
            verified: false,
            kind: .person
        )
    }
}

/// Your own face: your photo, else the person glyph on the soft blue the boards draw for you.
struct MomentSelfFace: View {
    let author: MomentAuthorDTO?
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(MomentsPalette.Tone.blue.fill)
            Icon(.user, size: size * 0.48, color: MomentsPalette.Tone.blue.ink)
            AvatarPhoto(url: author?.photoURL)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}
