//
//  ReinventedConstellations.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, curiosity constellations near you (PHASE-4 piece 4; CONTRACT 9c), as the web's
//  (`Constellations.tsx`): in My Atlas, within five miles of where the phone is, the Retakes people keep adding to, the
//  skies several caught, the field specimens named, and the questions people answered. The phone's place goes in the
//  POST body, never in an address, and is never kept; with no place, nothing is asked and nothing shows. Each is
//  something the person may already open: a Retake start, a specimen's Moment or post, an answer's post.
//

import CoreLocation
import Observation
import SwiftUI

private struct ReinventedConstellationsBody: Encodable {
    let latitude: Double
    let longitude: Double
}

struct ReinventedConstellationsDTO: Decodable {
    struct Retake: Decodable, Identifiable {
        let id: String
        let title: String?
        let frames: Int?
    }

    struct Sky: Decodable, Identifiable {
        let id: String
        let kind: String?
        let title: String?
        let pieces: Int?
    }

    struct Specimen: Decodable, Identifiable {
        let type: String
        let id: String
        let names: [String]
    }

    struct Answer: Decodable, Identifiable {
        let id: String
        let question: String?
        let answers: Int?
    }

    let retakes: [Retake]
    let skies: [Sky]
    let specimens: [Specimen]
    let answers: [Answer]

    private enum CodingKeys: String, CodingKey {
        case retakes, skies, specimens, answers
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        retakes = (try? c.decodeIfPresent(LossyList<Retake>.self, forKey: .retakes))?.items ?? []
        skies = (try? c.decodeIfPresent(LossyList<Sky>.self, forKey: .skies))?.items ?? []
        specimens = (try? c.decodeIfPresent(LossyList<Specimen>.self, forKey: .specimens))?.items ?? []
        answers = (try? c.decodeIfPresent(LossyList<Answer>.self, forKey: .answers))?.items ?? []
    }

    var isEmpty: Bool {
        retakes.isEmpty && skies.isEmpty && specimens.isEmpty && answers.isEmpty
    }
}

private extension ReinventedEndpoints {
    /// `POST /api/reinvented/constellations` (CONTRACT 9c): the phone's place in the body.
    static func constellations(_ body: ReinventedConstellationsBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/reinvented/constellations", body: body)
    }
}

/// "Near you" in My Atlas: nothing while it loads, with no place, or with nothing near.
struct ReinventedConstellations: View {
    @State private var found: ReinventedConstellationsDTO?

    var body: some View {
        // A stack, not a Group: with nothing in it yet a Group never appears, so its task would never read.
        VStack(alignment: .leading, spacing: 0) {
            if let found, !found.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Near you")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.s2) {
                            ForEach(found.retakes) { retake in
                                chip(.camera, retake.title ?? "A Retake", count(retake.frames, "frame")) { open("/moments/\(retake.id)") }
                            }
                            ForEach(found.skies) { sky in
                                chip(.sun, sky.title ?? sky.kind?.capitalized ?? "A sky", count(sky.pieces, "piece"), open: nil)
                            }
                            ForEach(found.specimens) { specimen in
                                chip(.leaf, specimen.names.prefix(2).joined(separator: ", "), "Named nearby") {
                                    open(specimen.type == "post" ? "/posts/\(specimen.id)" : "/moments/\(specimen.id)")
                                }
                            }
                            ForEach(found.answers) { answer in
                                chip(.messageCircle, answer.question ?? "A question", count(answer.answers, "answer")) {
                                    open("/posts/\(answer.id)")
                                }
                            }
                        }
                    }
                }
                .accessibilityIdentifier("reinventedAtlas.constellations")
            }
        }
        .task { await read() }
    }

    private func count(_ value: Int?, _ word: String) -> String {
        guard let value else { return "" }
        return "\(value) \(word)\(value == 1 ? "" : "s")"
    }

    private func chip(_ icon: PantopusIcon, _ title: String, _ line: String, open: (() -> Void)?) -> some View {
        Button { open?() } label: {
            VStack(alignment: .leading, spacing: 3) {
                Icon(icon, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if !line.isEmpty {
                    Text(line)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(10)
            .frame(width: 150, height: 96, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(open == nil)
    }

    private func open(_ path: String) {
        DeepLinkRouter.shared.handle(path: path)
    }

    private func read() async {
        guard let here = CLLocationManager().location?.coordinate else { return }
        let body = ReinventedConstellationsBody(latitude: here.latitude, longitude: here.longitude)
        found = try? await APIClient.shared.request(ReinventedEndpoints.constellations(body))
    }
}
