//
//  ReinventedAliveStrip.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1, Alive right now (PHASE-1 §2 piece 6; CONTRACT 6c): over the list, a strip of tall
//  previews: Moments live from here with their weather, plans starting soon, and rings for people you know. A tap
//  opens the Moment in today's viewer, the plan in Plans, or the person's Moments. Nothing is drawn when the strip is
//  empty.
//

import CoreLocation
import Observation
import SwiftUI

@Observable
@MainActor
final class ReinventedStripModel {
    private(set) var strip: ReinventedStripResponse?
    @ObservationIgnored private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func read() async {
        let here = CLLocationManager().location?.coordinate
        let endpoint = ReinventedEndpoints.strip(at: here.map { ($0.latitude, $0.longitude) })
        guard let response = try? await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true),
              (200..<300).contains(response.response.statusCode) else { return }
        strip = try? JSONDecoder().decode(ReinventedStripResponse.self, from: response.data)
    }
}

struct ReinventedAliveStrip: View {
    let strip: ReinventedStripResponse
    let onOpenMoment: (MomentDTO) -> Void
    let onOpenRing: (MomentRingDTO) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Alive right now")
                .pulseFont(13, weight: .bold)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(strip.liveHere) { live in liveTile(live.moment) }
                    ForEach(strip.plansSoon) { plan in planTile(plan) }
                    ForEach(strip.people) { ring in personTile(ring) }
                }
                .padding(.horizontal, Spacing.s4)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reinventedPulse.alive")
    }

    private func tile(@ViewBuilder _ content: () -> some View) -> some View {
        content()
            .frame(width: 96, height: 150)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }

    private func liveTile(_ moment: MomentDTO) -> some View {
        Button { onOpenMoment(moment) } label: {
            tile {
                ZStack(alignment: .bottomLeading) {
                    AsyncImage(url: moment.kind == .video ? moment.poster ?? moment.media : moment.media) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Theme.Color.appSurfaceRaised
                    }
                    .frame(width: 96, height: 150)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            MomentsLiveSign(size: 11, color: MomentsPalette.live)
                            Text("Live")
                                .pulseFont(11, weight: .bold)
                        }
                        if let weather = moment.live.weather {
                            Text(weather.text)
                                .pulseFont(11, weight: .semibold)
                                .lineLimit(1)
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(Color.black.opacity(0.45))
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(moment.author.shortName)'s Moment, live from here")
        .accessibilityIdentifier("reinventedPulse.alive.moment.\(moment.id)")
    }

    private func planTile(_ plan: PlanPinDTO) -> some View {
        Button { DeepLinkRouter.shared.handle(path: "/plans/\(plan.id)") } label: {
            tile {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Icon(.calendarCheck, size: 20, strokeWidth: 2.2, color: .white)
                    Text("Starting soon")
                        .pulseFont(11, weight: .bold)
                        .foregroundStyle(.white.opacity(0.85))
                    Text(plan.title)
                        .pulseFont(13, weight: .bold)
                        .foregroundStyle(.white)
                        .lineLimit(4)
                    Spacer(minLength: 0)
                }
                .padding(Spacing.s2)
                .frame(width: 96, height: 150, alignment: .topLeading)
                .background(Theme.Color.primarySolid)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Plan starting soon: \(plan.title)")
        .accessibilityIdentifier("reinventedPulse.alive.plan.\(plan.id)")
    }

    private func personTile(_ ring: MomentRingDTO) -> some View {
        Button { onOpenRing(ring) } label: {
            tile {
                VStack(spacing: Spacing.s2) {
                    Spacer(minLength: 0)
                    MomentRingFace(ring: ring)
                    Text(ring.author.shortName)
                        .pulseFont(12, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .frame(width: 96, height: 150)
                .background(Theme.Color.appSurface)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(ring.author.shortName)'s Moments")
        .accessibilityIdentifier("reinventedPulse.alive.person.\(ring.id)")
    }
}
