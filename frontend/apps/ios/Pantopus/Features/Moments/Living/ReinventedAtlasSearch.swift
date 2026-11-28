//
//  ReinventedAtlasSearch.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, Atlas search (PHASE-4 piece 3; CONTRACT 9b; board B7), as the web's (`AtlasSearch.tsx`):
//  at the top of My Atlas, plain words across what the person took, what the people they know captured, what is around
//  their places, and what they learned and answered. Results are dated, newest first, each saying why it is there; a
//  Moment opens in the viewer, a post opens as itself, a field guide card opens the field guide. The words go in a
//  POST body, never in an address, and are never kept.
//

import Observation
import SwiftUI

private struct ReinventedAtlasSearchBody: Encodable {
    let q: String
    let cursor: String?
}

private extension ReinventedEndpoints {
    /// `POST /api/reinvented/atlas/search` (CONTRACT 9b): 20 a page, newest first.
    static func atlasSearch(_ body: ReinventedAtlasSearchBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/reinvented/atlas/search", body: body)
    }
}

/// One result: a Moment, a post, or a card in the reader's field guide.
struct ReinventedAtlasResult: Decodable, Identifiable {
    enum Thing {
        case moment(MomentDTO)
        case post(FeedPostDTO)
        case card(name: String, scientific: String?)
    }

    let id: String
    let at: Date?
    let why: String
    let thing: Thing

    private enum CodingKeys: String, CodingKey {
        case type, id, at, why, moment, post, card
    }

    private struct CardEntry: Decodable {
        struct Card: Decodable {
            let name: String
            let scientific: String?
        }

        let card: Card
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        let rawId = try c.decode(String.self, forKey: .id)
        id = "\(type):\(rawId)"
        at = MomentTime.parse(try? c.decodeIfPresent(String.self, forKey: .at))
        why = (try? c.decodeIfPresent(String.self, forKey: .why)) ?? ""
        switch type {
        case "moment": thing = try .moment(c.decode(MomentDTO.self, forKey: .moment))
        case "post": thing = try .post(c.decode(FeedPostDTO.self, forKey: .post))
        case "card":
            let entry = try c.decode(CardEntry.self, forKey: .card)
            thing = .card(name: entry.card.name, scientific: entry.card.scientific)
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "an unknown result")
        }
    }
}

private struct ReinventedAtlasSearchPage: Decodable {
    let results: [ReinventedAtlasResult]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case results
        case nextCursor = "next_cursor"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        results = (try? c.decodeIfPresent(LossyList<ReinventedAtlasResult>.self, forKey: .results))?.items ?? []
        nextCursor = try? c.decodeIfPresent(String.self, forKey: .nextCursor)
    }
}

@Observable
@MainActor
final class ReinventedAtlasSearchModel {
    private(set) var q: String?
    private(set) var results: [ReinventedAtlasResult] = []
    private(set) var reading = false
    private(set) var error: String?
    @ObservationIgnored private var cursor: String?
    @ObservationIgnored private var task: Task<Void, Never>?

    var hasMore: Bool {
        cursor != nil
    }

    func search(_ text: String) {
        let next = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard next.count >= 2 else { return }
        task?.cancel()
        q = next
        results = []
        cursor = nil
        read(page: nil)
    }

    func more() {
        guard let cursor, !reading else { return }
        read(page: cursor)
    }

    func clear() {
        task?.cancel()
        (q, results, cursor, error, reading) = (nil, [], nil, nil, false)
    }

    private func read(page: String?) {
        guard let q else { return }
        reading = true
        error = nil
        task = Task { [weak self] in
            do {
                let read: ReinventedAtlasSearchPage = try await APIClient.shared.request(
                    ReinventedEndpoints.atlasSearch(ReinventedAtlasSearchBody(q: q, cursor: page))
                )
                guard !Task.isCancelled, let self, self.q == q else { return }
                let seen = Set(results.map(\.id))
                results += read.results.filter { !seen.contains($0.id) }
                cursor = read.nextCursor
            } catch {
                guard !Task.isCancelled, let self else { return }
                self.error = await Self.words(for: error)
            }
            self?.reading = false
        }
    }

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

/// At the top of My Atlas: the search field, and while a search shows, its results.
/// Words typed in the new Pulse's lens (PHASE-6 A1) for the Atlas to search when it opens.
@MainActor
enum ReinventedAtlasSearchPending {
    static var words: String?
}

struct ReinventedAtlasSearch: View {
    @State private var model = ReinventedAtlasSearchModel()
    @State private var text = ""
    @State private var guide = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            field
            if let error = model.error {
                Text(error)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("reinventedAtlas.search.error")
            } else if let q = model.q {
                results(q)
            } else {
                // Curiosity constellations near you (CONTRACT 9c) and the cabinet (9d) while nothing is searched.
                ReinventedConstellations()
                ReinventedEchoes()
                ReinventedCabinet()
            }
        }
        .sheet(isPresented: $guide) {
            MomentsFieldGuide { guide = false }
                .presentationDetents([.large])
        }
        .onAppear {
            guard let words = ReinventedAtlasSearchPending.words else { return }
            ReinventedAtlasSearchPending.words = nil
            text = words
            model.search(words)
        }
    }

    private var field: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            TextField("Search your Atlas: mushroom, sunset", text: $text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.Color.appText)
                .submitLabel(.search)
                .onSubmit { model.search(text) }
                .accessibilityIdentifier("reinventedAtlas.search.field")
            if model.q != nil || !text.isEmpty {
                Button {
                    text = ""
                    model.clear()
                } label: {
                    Icon(.x, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear the search")
                .accessibilityIdentifier("reinventedAtlas.search.clear")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 42)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func results(_ q: String) -> some View {
        if model.results.isEmpty, model.reading {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 60)
        } else if model.results.isEmpty {
            Text("Nothing found for \u{201C}\(q)\u{201D}. Try other words.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("reinventedAtlas.search.none")
        } else {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(model.results) { result in
                    row(result)
                }
                if model.hasMore {
                    Button(model.reading ? "Loading…" : "Show more") { model.more() }
                        .font(.system(size: 14, weight: .semibold))
                        .disabled(model.reading)
                        .accessibilityIdentifier("reinventedAtlas.search.more")
                }
            }
            Divider()
                .padding(.vertical, Spacing.s1)
        }
    }

    private func row(_ result: ReinventedAtlasResult) -> some View {
        Button { open(result) } label: {
            HStack(spacing: Spacing.s3) {
                thumb(result)
                VStack(alignment: .leading, spacing: 2) {
                    Text(words(result))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text([result.why, result.at.map { $0.formatted(.dateTime.month(.abbreviated).day()) }]
                        .compactMap { $0?.isEmpty == false ? $0 : nil }
                        .joined(separator: " · "))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedAtlas.search.result.\(result.id)")
    }

    @ViewBuilder
    private func thumb(_ result: ReinventedAtlasResult) -> some View {
        switch result.thing {
        case let .moment(moment):
            ReinventedAtlasPicture(moment: moment, large: false)
                .frame(width: 52, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
        case .post:
            tile(.image)
        case .card:
            tile(.leaf)
        }
    }

    private func tile(_ icon: PantopusIcon) -> some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Theme.Color.appSurfaceRaised)
            .frame(width: 52, height: 64)
            .overlay { Icon(icon, size: 20, strokeWidth: 2, color: Theme.Color.primaryTint) }
    }

    private func words(_ result: ReinventedAtlasResult) -> String {
        switch result.thing {
        case let .moment(moment):
            let said = (moment.kind == .text ? moment.text : moment.caption)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return said.flatMap { $0.isEmpty ? nil : $0 } ?? (moment.placeLabel.isEmpty ? "A Moment" : moment.placeLabel)
        case let .post(post):
            let title = post.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return title.isEmpty ? post.content : title
        case let .card(name, scientific):
            return [name, scientific].compactMap { $0 }.joined(separator: " · ")
        }
    }

    private func open(_ result: ReinventedAtlasResult) {
        switch result.thing {
        case let .moment(moment):
            DeepLinkRouter.shared.handle(path: "/moments/\(moment.id)")
        case let .post(post):
            DeepLinkRouter.shared.handle(path: "/posts/\(post.id)")
        case .card:
            guide = true
        }
    }
}
