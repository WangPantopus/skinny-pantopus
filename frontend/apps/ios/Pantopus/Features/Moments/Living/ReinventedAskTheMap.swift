//
//  ReinventedAskTheMap.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, Ask the map (PHASE-4 piece 3; CONTRACT 9b), as the web's (`AskTheMap.tsx`): at the
//  Pulse map's Map height, type "cozy study cafe" and the pins in view that match light up while the rest dim. The
//  words and the map's own box go in a POST body, never in an address, and are never kept. The server answers only
//  what this reader's map already shows for the time in view; the map lights those, each with the words it matched.
//

import MapKit
import Observation
import SwiftUI

private struct ReinventedMapAskBody: Encodable {
    let q: String
    let south: Double
    let west: Double
    let north: Double
    let east: Double
    let time: String
}

private struct ReinventedMapAskAnswer: Decodable {
    struct Match: Decodable {
        let type: String
        let id: String
        let words: [String]
    }

    let matches: [Match]
    let more: Bool

    private enum CodingKeys: String, CodingKey {
        case matches, more
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        matches = (try? c.decodeIfPresent(LossyList<Match>.self, forKey: .matches))?.items ?? []
        more = (try? c.decodeIfPresent(Bool.self, forKey: .more)) ?? false
    }
}

private extension ReinventedEndpoints {
    /// `POST /api/reinvented/map/ask` (CONTRACT 9b): the words and the map's box and time, in the body.
    static func askMap(_ body: ReinventedMapAskBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/reinvented/map/ask", body: body)
    }
}

/// What the map was asked, and the pins it lit.
@Observable
@MainActor
final class ReinventedMapAsk {
    struct Lit {
        let q: String
        /// The map's pin ids (`ring-…`, `mark-…`, `kept-…`) that matched, with the words each matched.
        let pins: [String: [String]]
        let more: Bool
    }

    static let shared = ReinventedMapAsk()

    private(set) var lit: Lit?
    private(set) var asking = false
    private(set) var error: String?
    @ObservationIgnored private var task: Task<Void, Never>?

    func clear() {
        task?.cancel()
        asking = false
        if lit != nil { lit = nil }
        if error != nil { error = nil }
    }

    /// A pin dims while the map shows what it was asked and the pin didn't match.
    func dims(_ id: String) -> Bool {
        guard let lit else { return false }
        return lit.pins[id] == nil
    }

    func words(_ id: String) -> [String]? {
        lit?.pins[id]
    }

    /// Asks for the map's box and time as last answered, and lights the pins of `items` that match.
    func ask(_ text: String, items: [ReinventedMapModel.Item]) {
        let q = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard q.count >= 2, let region = ReinventedLivingMap.shared.region else { return }
        let box = ReinventedMapBox(region) // inside the world, as the map's own read
        let body = ReinventedMapAskBody(
            q: q,
            south: box.south,
            west: box.west,
            north: box.north,
            east: box.east,
            time: ReinventedLivingMap.shared.time
        )
        task?.cancel()
        asking = true
        error = nil
        task = Task { [weak self] in
            do {
                let answer: ReinventedMapAskAnswer = try await APIClient.shared.request(ReinventedEndpoints.askMap(body))
                guard !Task.isCancelled, let self else { return }
                lit = Lit(q: q, pins: Self.pins(answer.matches, items: items), more: answer.more)
            } catch {
                guard !Task.isCancelled, let self else { return }
                self.error = await Self.words(for: error)
            }
            self?.asking = false
        }
    }

    /// A Moment lights its ring (or the reader's own kept pin); a post lights its mark.
    private static func pins(_ matches: [ReinventedMapAskAnswer.Match], items: [ReinventedMapModel.Item]) -> [String: [String]] {
        var byMoment: [String: String] = [:]
        var byPost: [String: String] = [:]
        for item in items {
            switch item {
            case let .ring(ring): for brief in ring.moments {
                    byMoment[brief.id] = item.id
                }
            case let .kept(kept): byMoment[kept.id] = item.id
            case let .mark(mark): byPost[mark.post.id] = item.id
            case .ticket: break
            }
        }
        var out: [String: [String]] = [:]
        for match in matches {
            guard let pin = match.type == "post" ? byPost[match.id] : byMoment[match.id] else { continue }
            out[pin, default: []].append(contentsOf: match.words.filter { !(out[pin]?.contains($0) ?? false) })
        }
        return out
    }

    /// What a refused ask says; a switch turned off reads the switch again.
    private static func words(for error: any Error) async -> String {
        switch error as? APIError {
        case let .clientError(status, _) where status == 429:
            return "That's a lot of searching. Wait a minute, then try again."
        case .clientError:
            return "Try a word or two, like \u{201C}mushroom\u{201D} or \u{201C}sunset\u{201D}."
        case .forbidden:
            await PulseReinventedFlags.shared.recheck()
            return "Search couldn't finish. Try again."
        default:
            return "Search couldn't finish. Try again."
        }
    }
}

/// The bar under the time row at the Map height: "Ask the map", and what it lit.
struct ReinventedAskBar: View {
    let map: ReinventedMapModel
    private let ask = ReinventedMapAsk.shared
    @State private var text = ""
    @FocusState private var typing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: Spacing.s2) {
                Icon(.search, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                TextField("Ask the map: cozy study cafe", text: $text)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.Color.appText)
                    .submitLabel(.search)
                    .focused($typing)
                    .onSubmit { ask.ask(text, items: map.items) }
                    .disabled(ask.asking)
                    .accessibilityIdentifier("reinventedPulse.ask.field")
                if ask.asking {
                    ProgressView().controlSize(.small)
                } else if ask.lit != nil || !text.isEmpty {
                    Button {
                        text = ""
                        ask.clear()
                    } label: {
                        Icon(.x, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                            .frame(width: 28, height: 28)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear and show every pin")
                    .accessibilityIdentifier("reinventedPulse.ask.clear")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 40)
            .background(Capsule().fill(Theme.Color.appSurface))
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .overlay(alignment: .trailing) {
                // Listen to the town (CONTRACT 9g), beside the bar.
                ReinventedListenButton().offset(x: 48)
            }
            .padding(.trailing, 48)
            if let said {
                Text(said)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Theme.Color.appSurface.opacity(0.92)))
                    .accessibilityIdentifier("reinventedPulse.ask.said")
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    /// "3 lit for "cafe"", or that nothing here matched, or why it couldn't ask.
    private var said: String? {
        if let error = ask.error { return error }
        guard let lit = ask.lit else { return ReinventedListenButton.said }
        let shown = map.items.filter { lit.pins[$0.id] != nil }.count
        guard shown > 0 else { return "Nothing here for \u{201C}\(lit.q)\u{201D}. Move the map or try other words." }
        return "\(shown) lit for \u{201C}\(lit.q)\u{201D}" + (lit.more ? ", and more beyond these" : "")
    }
}

extension View {
    /// A pin on the Pulse map while it shows what it was asked: lit with the words it matched, or dimmed.
    func reinventedLit(_ id: String) -> some View {
        modifier(ReinventedLitPin(id: id))
    }
}

private struct ReinventedLitPin: ViewModifier {
    let id: String
    @Environment(\.reinventedFlat) private var flat
    private let ask = ReinventedMapAsk.shared

    func body(content: Content) -> some View {
        if flat || ask.lit == nil {
            content
        } else if let words = ask.words(id) {
            content
                .overlay(alignment: .top) {
                    Text(words.prefix(3).joined(separator: " · "))
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Theme.Color.primarySolid))
                        .offset(y: -22)
                        .allowsHitTesting(false)
                }
                .accessibilityValue("Matches \(words.joined(separator: ", "))")
        } else {
            content.opacity(0.28)
        }
    }
}
