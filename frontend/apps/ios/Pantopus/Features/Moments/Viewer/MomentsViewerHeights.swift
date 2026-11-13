//
//  MomentsViewerHeights.swift
//  Pantopus
//
//  How high the Moment being watched was made (board H4): a tag on the
//  Moment, a mountain and "3,480 ft" (a plane for one posted in flight), and
//  on the phone a rail down the right edge from 0 ft to a round number above
//  the highest thing on it. On the rail: this Moment's face at its height,
//  the faces of other people's rings that carry one (the rings the viewer
//  was opened with), and "You" where the phone last read your own height.
//
//  The rail is drawn on a square-root scale, so a Moment by the river and one
//  on a summit both have room. None of it takes a touch: the viewer's taps,
//  hold, swipes and reply box work as they always have. It shows only while
//  the Moment carries a height (heights are on for you and its author showed
//  it), and hides with the rest of the viewer's own controls.
//

import SwiftUI

/// One face on the rail.
struct MomentsRailFace: Identifiable, Hashable {
    let id: String
    let author: MomentAuthorDTO
    let height: MomentShownHeight
}

/// What the rail draws, worked out from the viewer's model.
struct MomentsHeightRail: Equatable {
    let showing: MomentsRailFace
    let others: [MomentsRailFace]
    /// Your own height now, in feet; nil when the phone has no reading.
    let you: Int?
    /// The round number at the top.
    let top: Int

    /// The rail holds this many other faces at most: the nearest in the queue.
    static let mostOthers = 10
    private static let tops = [100, 250, 500, 1000, 2500, 5000, 10000, 20000, 40000, 60000]

    init(showing: MomentsRailFace, others: [MomentsRailFace], you: Int?) {
        self.showing = showing
        self.others = others
        self.you = you
        let highest = ([showing.height.feet] + others.map(\.height.feet) + [you].compactMap { $0 }).max() ?? 0
        // Room above the highest face, so it never sits on the top label.
        top = Self.tops.first { Double($0) >= Double(highest) * 1.12 } ?? Self.tops[Self.tops.count - 1]
    }

    /// How far up the rail a height sits, 0 at the bottom to 1 at the top: the square root, so low heights spread out.
    func place(_ feet: Int) -> CGFloat {
        CGFloat((Double(max(feet, 0)) / Double(top)).squareRoot().clamped(to: 0...1))
    }

    /// What VoiceOver reads for the rail.
    var spoken: String {
        var parts = ["Elevation scale, 0 to \(top.formatted()) feet"]
        parts.append("this Moment at \(showing.height.feet.formatted()) feet")
        parts += others.map { "\($0.author.shortName) at \($0.height.feet.formatted()) feet" }
        if let you { parts.append("you at \(you.formatted()) feet") }
        return parts.joined(separator: ", ")
    }
}

extension MomentsViewerModel {
    /// The height of the Moment showing; nil when it carries none, and until it has loaded.
    var shownHeight: MomentShownHeight? {
        guard load == .ready, let moment, moment.id == brief?.id else { return nil }
        return moment.shownHeight
    }

    /// The rail for the Moment showing: its face, other people's rings that carry a height, and you.
    func heightRail(you: Int?) -> MomentsHeightRail? {
        guard let ring, let height = shownHeight else { return nil }
        let others = rings
            .filter { $0.id != ring.id && !$0.mine && $0.author.id != ring.author.id }
            .compactMap { other in other.shownHeight.map { MomentsRailFace(id: other.id, author: other.author, height: $0) } }
            .prefix(MomentsHeightRail.mostOthers)
        return MomentsHeightRail(
            showing: MomentsRailFace(id: ring.id, author: ring.author, height: height),
            others: Array(others),
            you: you
        )
    }
}

/// The tag: a mountain (a plane in flight) in the band's colour and the number, on white as board H4 draws it.
struct MomentsViewerHeightTag: View {
    let height: MomentShownHeight
    /// Smaller under the name, where the Duo and a table show it without a rail.
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 5 : 6) {
            Icon(
                height.flying ? .plane : .mountain,
                size: compact ? 12 : 14,
                strokeWidth: 2.25,
                color: MomentsPalette.height(height.band)
            )
            .frame(width: height.flying ? nil : (compact ? 19 : 22))
            Text(height.text)
                .font(.system(size: compact ? 12.5 : 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, compact ? 10 : Spacing.s3)
        .frame(height: compact ? 26 : 32)
        .background(Capsule().fill(.white))
        .compositingGroup()
        .shadow(color: .black.opacity(0.25), radius: 3, x: 0, y: 1)
        // The viewer is always dark; the tag is white, with the light colours.
        .environment(\.colorScheme, .light)
        .accessibilityElement(children: .ignore)
        // A flight's number is an altitude, not an elevation: its own words say so.
        .accessibilityLabel(height.flying ? height.spoken.capitalizedFirst : "Elevation: " + height.spoken)
        .accessibilityIdentifier("moments.viewer.height")
    }
}

/// The tag under the name, for the layouts without a rail (the iPhone Duo's, and a table): beside "Taken Oct 3".
struct MomentsViewerHeightLine: View {
    let height: MomentShownHeight

    var body: some View {
        MomentsViewerHeightTag(height: height, compact: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Under the name: the header's leading inset, the 36 pt face and its 10 pt gap.
            .padding(.leading, 58)
            .padding(.top, 6)
            .allowsHitTesting(false)
    }
}

/// The phone's rail and tag, down the right edge between the header and the caption.
struct MomentsViewerHeights: View {
    let rail: MomentsHeightRail
    /// From the stage's top to the rail's top, and how tall the rail is.
    let top: CGFloat
    let length: CGFloat

    /// The rail's line is this far in from the right edge.
    private static let inset: CGFloat = 30
    private static let showingFace: CGFloat = 34
    private static let endReach: CGFloat = 22
    private static let otherFace: CGFloat = 24

    var body: some View {
        ZStack(alignment: .topTrailing) {
            line
            ForEach(rail.others) { face in
                MomentAvatar(author: face.author, size: Self.otherFace - 4)
                    .padding(2)
                    .background(Circle().fill(.white))
                    // The viewer is always dark: the faces keep their light colours on it, as the board draws them.
                    .environment(\.colorScheme, .light)
                    .position(x: 0, y: spot(face.height.feet))
            }
            if let you = rail.you {
                Text("You")
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primarySolid)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(.white))
                    .environment(\.colorScheme, .light)
                    .accessibilityHidden(true)
                    .position(x: 0, y: spot(you))
            }
            showing
        }
        .frame(width: 0, height: length, alignment: .topTrailing)
        .padding(.top, top)
        .padding(.trailing, Self.inset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .allowsHitTesting(false)
        .accessibilityElement(children: .contain)
    }

    /// The line with its ticks, "5,000 ft" over it and "0 ft" under it.
    private var line: some View {
        ZStack {
            Capsule()
                .fill(.white.opacity(0.7))
                .frame(width: 2, height: length)
                .position(x: 0, y: length / 2)
            ForEach(1..<4, id: \.self) { step in
                Capsule()
                    .fill(.white.opacity(0.7))
                    .frame(width: 10, height: 2)
                    .position(x: 0, y: length * CGFloat(step) / 4)
            }
            end("\(rail.top.formatted()) ft", y: -16)
            end("0 ft", y: length + 16)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rail.spoken)
        .accessibilityIdentifier("moments.viewer.heightRail")
    }

    /// A label at one end of the line: centred on it, or, when it is too wide for that ("40,000 ft"), kept on the
    /// screen with its right end `endReach` past the line.
    private func end(_ words: String, y: CGFloat) -> some View {
        Color.clear
            .frame(width: 0, height: 0)
            .overlay {
                Text(words)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, Spacing.s2)
                    .frame(height: 20)
                    .background(Capsule().fill(.black.opacity(0.48)))
                    .alignmentGuide(HorizontalAlignment.center) { max($0.width / 2, $0.width - Self.endReach) }
            }
            .position(x: 0, y: y)
    }

    /// This Moment's face, bigger, in its band's colour, with the tag beside it.
    private var showing: some View {
        let height = rail.showing.height
        return MomentAvatar(author: rail.showing.author, size: Self.showingFace - 8)
            .padding(3)
            .background(Circle().fill(MomentsPalette.height(height.band)))
            .padding(1.5)
            .background(Circle().fill(.white))
            .environment(\.colorScheme, .light)
            .overlay(alignment: .leading) {
                MomentsViewerHeightTag(height: height)
                    .alignmentGuide(.leading) { $0[.trailing] + 10 }
            }
            .position(x: 0, y: spot(height.feet))
    }

    /// Where on the rail a height sits, from its top.
    private func spot(_ feet: Int) -> CGFloat {
        length * (1 - rail.place(feet))
    }
}

extension MomentsViewer {
    /// Your own height now, in feet, from the fix the phone already has: the viewer asks for no location of its own.
    var ownHeight: Int? {
        DeviceLocationProvider.shared.cachedHeight().flatMap {
            MomentHeight.feet(meters: $0.meters, accuracyM: $0.accuracyMeters, speedMps: $0.speedMps)
        }
    }

    /// Where the phone's rail starts under the stage's top, and how long it is: under the header, above the caption.
    static let railTop: CGFloat = 126
    static let railBelow: CGFloat = 180
}

private extension String {
    /// "posted in flight at 34,000 feet" as a sentence of its own.
    var capitalizedFirst: String {
        prefix(1).uppercased() + dropFirst()
    }
}

private extension Double {
    func clamped(to range: ClosedRange<Double>) -> Double {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
