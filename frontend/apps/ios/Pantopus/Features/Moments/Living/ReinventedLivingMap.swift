//
//  ReinventedLivingMap.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, the living map (PHASE-4 pieces 1 and 2, board B4), as the web's (`mapLight.ts`,
//  `PulseMap.tsx`). Only on the Pulse tab's map, which shows only while the switch is on for the person.
//
//  - While the map's answer says `heights_on` and `float_on` (CONTRACT 6b; the `moment_float` switch, as on today's
//    Moments map): a ring with a height floats at it, higher the higher it was made (today's `MomentsFloat` numbers),
//    with its shadow on the ground where the real sun puts it now; after sunset it hangs as a lantern on a thread; a
//    Moment shown only as its area is a soft cloud over it; a plan glows as a beacon with a small arc of the time
//    left before it starts.
//  - Night falls on the map when the sun is down over its middle (the map turns dark), whatever `float_on` says.
//  - Live beams (CONTRACT 9h): on the Live map, faint lines from several captures to where they all looked, read
//    after the map's own answer. A server without the route draws none and is not asked again.
//
//  The sun's place is NOAA's general solar position formula, the same as the web's and the server's
//  (`services/moments/sunPosition.js`), so the three agree. Nothing here is sent anywhere but the beams' read of the
//  map's own box.
//

import MapKit
import Observation
import SwiftUI

/// Where the sun is over a point: degrees clockwise from true north, and above the horizon (negative after sunset).
enum ReinventedSun {
    static func position(latitude: Double, longitude: Double, at date: Date = Date()) -> MomentSunDTO {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        let dayOfYear = Double(calendar.ordinality(of: .day, in: .year, for: date) ?? 1)
        let parts = calendar.dateComponents([.hour, .minute, .second], from: date)
        let hour = Double(parts.hour ?? 0) + Double(parts.minute ?? 0) / 60 + Double(parts.second ?? 0) / 3600
        let g = 2 * Double.pi / 365 * (dayOfYear - 1 + (hour - 12) / 24)
        let minutesFast = 229.18 * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) - 0.014615 * cos(2 * g)
            - 0.040849 * sin(2 * g))
        let declination = 0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g)
            + 0.000907 * sin(2 * g) - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
        let solarMinutes = hour * 60 + minutesFast + 4 * longitude
        let hourAngle = (solarMinutes / 4 - 180) * .pi / 180
        let lat = latitude * .pi / 180
        let cosZenith = sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle)
        let zenith = acos(max(-1, min(1, cosZenith)))
        let azimuth = atan2(sin(hourAngle), cos(hourAngle) * sin(lat) - tan(declination) * cos(lat)) * 180 / .pi + 180
        return MomentSunDTO(
            azimuthDeg: (azimuth.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360),
            elevationDeg: 90 - zenith * 180 / .pi
        )
    }
}

/// One live beam (CONTRACT 9h): where several people's captures were all looking, and from where.
struct ReinventedBeamDTO: Decodable, Identifiable {
    struct Point: Decodable {
        let latitude: Double
        let longitude: Double

        var coordinate: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }
    }

    let at: String
    let target: Point
    let from: [Point]

    var id: String {
        "\(at)/\(target.latitude),\(target.longitude)"
    }
}

private struct ReinventedBeamsResponse: Decodable {
    let beams: [ReinventedBeamDTO]

    private enum CodingKeys: String, CodingKey {
        case beams
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        beams = (try? c.decodeIfPresent(LossyList<ReinventedBeamDTO>.self, forKey: .beams))?.items ?? []
    }
}

/// The two words of the map's answer the living map reads (CONTRACT 6b).
private struct ReinventedMapLight: Decodable {
    let heightsOn: Bool
    let floatOn: Bool

    private enum CodingKeys: String, CodingKey {
        case heightsOn = "heights_on"
        case floatOn = "float_on"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        heightsOn = (try? c.decodeIfPresent(Bool.self, forKey: .heightsOn)) ?? false
        floatOn = (try? c.decodeIfPresent(Bool.self, forKey: .floatOn)) ?? false
    }
}

extension ReinventedEndpoints {
    /// `GET /api/reinvented/beams` (CONTRACT 9h): the live beams in the map's box.
    static func beams(south: Double, west: Double, north: Double, east: Double) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/reinvented/beams",
            query: [
                "south": String(format: "%.5f", south),
                "west": String(format: "%.5f", west),
                "north": String(format: "%.5f", north),
                "east": String(format: "%.5f", east)
            ],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }
}

/// The living map's light, read from each answer of the Pulse map.
@Observable
@MainActor
final class ReinventedLivingMap {
    static let shared = ReinventedLivingMap()

    /// Rings float, plans glow: the map's answer said `heights_on` and `float_on`.
    private(set) var floats = false
    /// The sun over the middle of the map, moved only when it moves enough to change a shadow.
    private(set) var sun: MomentSunDTO?
    /// Live beams in the box, on the Live map only.
    private(set) var beams: [ReinventedBeamDTO] = []

    /// The box and the time of the map's last answer (Ask the map asks for that box).
    @ObservationIgnored private(set) var region: MKCoordinateRegion?
    @ObservationIgnored private(set) var time = "live"
    @ObservationIgnored private var beamsRead: Task<Void, Never>?
    @ObservationIgnored private var beamsMissing = false
    @ObservationIgnored private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// The sun is down over the middle of the map.
    var night: Bool {
        (sun?.elevationDeg ?? 30) <= 0
    }

    /// The map's answer came (a 200): what it says about floating, the sun over the box's middle, and the beams.
    func answered(_ data: Data, region: MKCoordinateRegion, time: String) {
        if time != self.time { ReinventedMapAsk.shared.clear() }
        self.region = region
        self.time = time
        let light = try? JSONDecoder().decode(ReinventedMapLight.self, from: data)
        let on = (light?.heightsOn ?? false) && (light?.floatOn ?? false)
        if floats != on { floats = on }
        let next = ReinventedSun.position(latitude: region.center.latitude, longitude: region.center.longitude)
        if let sun, abs(sun.azimuthDeg - next.azimuthDeg) < 3, abs(sun.elevationDeg - next.elevationDeg) < 1.5,
           (sun.elevationDeg > 0) == (next.elevationDeg > 0) {
            // The same light: the pins aren't drawn again.
        } else {
            sun = next
        }
        readBeams(region: region, live: time == "live")
        ReinventedTownSound.shared.moved(region: region, time: time)
    }

    private func readBeams(region: MKCoordinateRegion, live: Bool) {
        beamsRead?.cancel()
        guard live, !beamsMissing else {
            if !beams.isEmpty { beams = [] }
            return
        }
        let box = ReinventedMapBox(region) // inside the world, as the map's own read
        let endpoint = ReinventedEndpoints.beams(
            south: box.south,
            west: box.west,
            north: box.north,
            east: box.east
        )
        beamsRead = Task { [weak self, api] in
            guard let response = try? await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true),
                  !Task.isCancelled, let self else { return }
            switch response.response.statusCode {
            case 200..<300:
                let read = (try? JSONDecoder().decode(ReinventedBeamsResponse.self, from: response.data))?.beams ?? []
                if read.map(\.id) != beams.map(\.id) { beams = read }
            case 404:
                // A server from before the beams: none are drawn, and it isn't asked again in this run.
                beamsMissing = true
                beams = []
            default:
                return
            }
        }
    }
}

// MARK: - The pins

/// The peek deck's pins stay flat (they are cards, not the map).
extension EnvironmentValues {
    @Entry var reinventedFlat = false
}

/// A ring on the Pulse map: today's pin, or, while rings float, at its height by day, a lantern by night, or a cloud
/// over its area. Its bottom is the ring's spot on the ground, as today's pin's tip is.
struct ReinventedLivingRing: View {
    let ring: MomentRingDTO
    @Environment(\.reinventedFlat) private var flat
    private let living = ReinventedLivingMap.shared

    var body: some View {
        if !flat, living.floats, ring.floating {
            cloud
        } else if !flat, living.floats, let height = ring.shownHeight {
            if living.night { lantern(height) } else { floating(height) }
        } else {
            MomentRingPin(ring: ring)
        }
    }

    /// How far above its spot the disc hangs: 6 points on the ground to 32 at 15,000 ft or in flight (as the web's).
    private func lift(_ height: MomentShownHeight) -> CGFloat {
        6 + 26 * MomentsFloat.lift(height)
    }

    private func floating(_ height: MomentShownHeight) -> some View {
        let scale = MomentsFloat.scale(height)
        let shadow = living.sun.map { MomentsFloat.shadow(height, sun: $0) } ?? MomentsFloat.areaShadow
        return VStack(spacing: 0) {
            disc(scale: scale, height: height)
            Color.clear.frame(width: 1, height: lift(height))
        }
        // Its shadow on the ground, where the sun puts it: a soft spot drawn with a gradient (a blur draws nothing
        // inside a map pin).
        .background(alignment: .bottom) {
            ReinventedGroundShadow(width: 56 * scale, height: 22 * scale, opacity: min(shadow.opacity * 1.5, 0.5))
                .offset(x: shadow.offset.width, y: shadow.offset.height / 2)
        }
        .accessibilityLabel("\(ring.author.shortName)'s Moment, \(height.spoken)")
    }

    private func lantern(_ height: MomentShownHeight) -> some View {
        let scale = MomentsFloat.scale(height)
        return VStack(spacing: 0) {
            disc(scale: scale, height: height)
                .background {
                    Circle()
                        .fill(RadialGradient(
                            colors: [ReinventedLivingPalette.lantern.opacity(0.65), ReinventedLivingPalette.lantern.opacity(0)],
                            center: .center,
                            startRadius: 18 * scale,
                            endRadius: 46 * scale
                        ))
                        .frame(width: 92 * scale, height: 92 * scale)
                        .allowsHitTesting(false)
                }
            // The thread down to its spot, and the spot itself.
            Rectangle()
                .fill(ReinventedLivingPalette.lantern.opacity(0.8))
                .frame(width: 1.5, height: lift(height))
            Circle()
                .fill(ReinventedLivingPalette.lantern)
                .frame(width: 5, height: 5)
        }
        .accessibilityLabel("\(ring.author.shortName)'s Moment, a lantern at \(height.spoken)")
    }

    private var cloud: some View {
        VStack(spacing: 0) {
            MomentRingPin(ring: ring, tail: false)
                .background {
                    // A soft cloud over its area, seen on the light map and the dark one.
                    Ellipse()
                        .fill(RadialGradient(
                            colors: [Color.white.opacity(0.95), Color.white.opacity(0.75), Color.white.opacity(0)],
                            center: .center,
                            startRadius: 0,
                            endRadius: 66
                        ))
                        .overlay(Ellipse().stroke(Color.black.opacity(0.08), lineWidth: 1).padding(14))
                        .frame(width: 132, height: 88)
                        .allowsHitTesting(false)
                }
            Color.clear.frame(width: 1, height: 10)
        }
        .background(alignment: .bottom) {
            ReinventedGroundShadow(width: 52, height: 18, opacity: 0.35)
        }
        .accessibilityLabel("\(ring.author.shortName)'s Moment, over its area")
    }

    /// The disc with no tail, a little bigger the higher it was made, its height over it (so its shadow shows below).
    private func disc(scale: CGFloat, height: MomentShownHeight) -> some View {
        MomentRingPin(ring: ring, tail: false)
            .scaleEffect(scale)
            .frame(width: 64 * scale, height: 64 * scale)
            .overlay(alignment: .top) {
                MomentsHeightTag(height: height)
                    .fixedSize()
                    .offset(y: -MomentsHeightTag.barHeight * 0.75)
                    .allowsHitTesting(false)
            }
    }
}

/// A soft spot on the ground: a gradient, since a blur draws nothing inside a map pin.
private struct ReinventedGroundShadow: View {
    let width: CGFloat
    let height: CGFloat
    let opacity: Double

    var body: some View {
        Ellipse()
            .fill(RadialGradient(
                colors: [MomentsPalette.floatShadow.opacity(opacity), MomentsPalette.floatShadow.opacity(0)],
                center: .center,
                startRadius: 0,
                endRadius: width / 2
            ))
            .frame(width: width, height: height)
            .allowsHitTesting(false)
    }
}

enum ReinventedLivingPalette {
    /// A lantern's warm light, and the beams after dark.
    static let lantern = Color(red: 0.99, green: 0.90, blue: 0.54)
    /// The beams by day.
    static let beamDay = Color(red: 0.22, green: 0.74, blue: 0.97)
}

/// A plan's pin while rings float: it glows as a beacon, with an arc of the hours left before it starts (a full ring
/// six hours ahead, empty once it has started).
private struct ReinventedBeacon: ViewModifier {
    let ticket: PlanPinDTO
    @Environment(\.reinventedFlat) private var flat
    private let living = ReinventedLivingMap.shared

    func body(content: Content) -> some View {
        let lit = !flat && living.floats
        content
            // A halo around the ticket (gradients and strokes: a blur draws nothing inside a map pin).
            .padding(lit ? 5 : 0)
            .background {
                if lit {
                    Capsule()
                        .fill(Theme.Color.primarySolid.opacity(0.22))
                        .overlay(Capsule().stroke(Theme.Color.primarySolid.opacity(0.55), lineWidth: 2))
                        .allowsHitTesting(false)
                }
            }
            // The hours left before it starts, as an arc on a small white face at the ticket's corner.
            .overlay(alignment: .topTrailing) {
                if lit, let left = Self.left(ticket) {
                    ZStack {
                        Circle().fill(Color.white)
                        Circle()
                            .trim(from: 0, to: left)
                            .stroke(Theme.Color.primarySolid, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .padding(3)
                    }
                    .frame(width: 20, height: 20)
                    .offset(x: 8, y: -8)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
            }
    }

    /// The share of six hours still to wait before the plan starts; nil once started or with no start time.
    private static func left(_ ticket: PlanPinDTO) -> CGFloat? {
        guard let starts = MomentTime.parse(ticket.startsAt) else { return nil }
        let hours = starts.timeIntervalSinceNow / 3600
        guard hours > 0 else { return nil }
        return CGFloat(min(hours / 6, 1))
    }
}

extension View {
    /// A plan's pin glows while rings float on the Pulse map.
    func reinventedBeacon(_ ticket: PlanPinDTO) -> some View {
        modifier(ReinventedBeacon(ticket: ticket))
    }

    /// Night falls on the Pulse map when the sun is down over its middle: the map takes its dark look.
    func reinventedNight() -> some View {
        modifier(ReinventedNight())
    }
}

private struct ReinventedNight: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    private let living = ReinventedLivingMap.shared

    func body(content: Content) -> some View {
        content.environment(\.colorScheme, living.night ? .dark : scheme)
    }
}

// MARK: - The beams

/// Live beams on the Pulse map: a faint line from each capture to where they all looked, and a glow there. Not tappable.
struct ReinventedBeamsContent: MapContent {
    let beams: [ReinventedBeamDTO]
    let night: Bool

    var body: some MapContent {
        let color = night ? ReinventedLivingPalette.lantern : ReinventedLivingPalette.beamDay
        ForEach(beams) { beam in
            ForEach(Array(beam.from.enumerated()), id: \.offset) { _, from in
                MapPolyline(coordinates: [from.coordinate, beam.target.coordinate])
                    .stroke(color.opacity(0.45), lineWidth: 3)
            }
            Annotation("", coordinate: beam.target.coordinate, anchor: .center) {
                Circle()
                    .fill(color.opacity(0.35))
                    .frame(width: 18, height: 18)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }
}
