//
//  ReinventedStrands.swift
//  Pantopus
//
//  Strands ("Pulse, reinvented" phase 3, PHASE-3 piece 5; CONTRACT 8c): "Dana went because of your Moment." Told to
//  the first person only, between people only, never shown to anyone else, and never about a person without their own
//  act (their Want to go, then their own post from there; a frame added to a Retake; a pass). The first person reads
//  theirs at the top of My Atlas, private to them; a tap opens the post or Moment it came from, as they may open it.
//  Only while the switch is on: My Atlas itself exists only then.
//

import Observation
import SwiftUI

/// One group of strands: one source, one day, one kind.
struct ReinventedStrandGroupDTO: Decodable, Hashable, Identifiable {
    struct Source: Decodable, Hashable {
        let id: String
        let type: String
        let caption: String?
    }

    let source: Source
    let day: String
    let count: Int
    let people: [MomentAuthorDTO]
    let kind: String
    let label: String
    let unseen: Bool
    let itemIds: [String]

    var id: String {
        "\(source.id):\(day):\(kind)"
    }

    private enum CodingKeys: String, CodingKey {
        case source, day, count, people, kind, label, unseen, items
    }

    private struct Item: Decodable {
        let id: String
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        source = try c.decode(Source.self, forKey: .source)
        day = try c.decodeIfPresent(String.self, forKey: .day) ?? ""
        count = (try? c.decodeIfPresent(Int.self, forKey: .count)) ?? 0
        people = (try? c.decodeIfPresent([MomentAuthorDTO].self, forKey: .people)) ?? []
        kind = (try? c.decodeIfPresent(String.self, forKey: .kind)) ?? "went"
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
        unseen = (try? c.decodeIfPresent(Bool.self, forKey: .unseen)) ?? false
        itemIds = ((try? c.decodeIfPresent([Item].self, forKey: .items)) ?? []).map(\.id)
    }
}

struct ReinventedStrandsPageDTO: Decodable {
    let strands: [ReinventedStrandGroupDTO]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case strands
        case nextCursor = "next_cursor"
    }
}

private struct StrandsSeenBody: Encodable {
    let ids: [String]
}

enum ReinventedStrandsEndpoints {
    /// `GET /api/reinvented/strands?cursor=`: the strands told to the reader, newest first, grouped by source and day.
    /// Route `backend/routes/reinvented.js:535`.
    static func strands(cursor: String?) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/reinvented/strands",
            query: cursor.map { ["cursor": $0] } ?? [:],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `POST /api/reinvented/strands/seen` `{ ids }`: the new ones were on screen. Route
    /// `backend/routes/reinvented.js:544`.
    static func seen(ids: [String]) -> Endpoint {
        Endpoint(method: .post, path: "/api/reinvented/strands/seen", body: StrandsSeenBody(ids: ids))
    }
}

@Observable
@MainActor
final class ReinventedStrandsModel {
    private(set) var groups: [ReinventedStrandGroupDTO] = []
    private(set) var nextCursor: String?
    private(set) var loadingMore = false
    @ObservationIgnored private var marked: Set<String> = []

    var unseenCount: Int {
        groups.filter(\.unseen).reduce(0) { $0 + $1.itemIds.count }
    }

    func load() async {
        do {
            let page: ReinventedStrandsPageDTO = try await MomentsAPI.send(ReinventedStrandsEndpoints.strands(cursor: nil))
            groups = page.strands
            nextCursor = page.nextCursor
        } catch {
            // Nothing to tell, or the switch went off on the server: the section stays away.
            groups = []
            await PulseReinventedFlags.shared.recheck()
        }
    }

    func loadMore() async {
        guard let nextCursor, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        guard let page: ReinventedStrandsPageDTO = try? await MomentsAPI.send(ReinventedStrandsEndpoints.strands(cursor: nextCursor))
        else { return }
        groups += page.strands.filter { group in !groups.contains { $0.id == group.id } }
        self.nextCursor = page.nextCursor
    }

    /// Once the new ones have been on screen a moment they are seen: the dot goes, the strands stay.
    func markSeen() async {
        let ids = groups.filter(\.unseen).flatMap(\.itemIds).filter { !marked.contains($0) }
        guard !ids.isEmpty else { return }
        try? await Task.sleep(for: .seconds(1.5))
        guard !Task.isCancelled else { return }
        marked.formUnion(ids)
        do {
            try await MomentsAPI.send(ReinventedStrandsEndpoints.seen(ids: ids))
        } catch {
            marked.subtract(ids)
        }
    }
}

/// At the top of My Atlas: "Went because of you", only when there is something to tell. My Atlas reads the model
/// (`ReinventedAtlasView`): a task hung on this view would be dropped while it draws nothing.
struct ReinventedWentBecauseOfYou: View {
    let model: ReinventedStrandsModel

    var body: some View {
        if !model.groups.isEmpty {
            section
        }
    }

    private var section: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text("Went because of you")
                    .pulseFont(16, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                if model.unseenCount > 0 {
                    Text("\(model.unseenCount) new")
                        .pulseFont(12, weight: .bold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Theme.Color.primarySolid))
                        .accessibilityIdentifier("reinventedStrands.new")
                }
            }
            Text("Only you see these. Nobody else is told.")
                .pulseFont(13)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ForEach(Array(model.groups.enumerated()), id: \.element.id) { index, group in
                if index == 0 || model.groups[index - 1].day != group.day {
                    Text(Self.dayWords(group.day))
                        .pulseFont(13, weight: .semibold)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.top, Spacing.s1)
                }
                row(group)
            }
            if model.nextCursor != nil {
                Button(model.loadingMore ? "Loading…" : "Show more") { Task { await model.loadMore() } }
                    .pulseFont(14, weight: .semibold)
                    .disabled(model.loadingMore)
            }
        }
        .padding(Spacing.s3)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurface))
        .task(id: model.unseenCount) { await model.markSeen() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reinventedStrands")
    }

    private func row(_ group: ReinventedStrandGroupDTO) -> some View {
        Button { open(group.source) } label: {
            HStack(spacing: Spacing.s3) {
                HStack(spacing: -10) {
                    ForEach(group.people.prefix(3), id: \.id) { person in
                        MomentAvatar(author: person, size: 30)
                            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    }
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(group.label)
                        .pulseFont(14.5, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    if let caption = group.source.caption {
                        Text(caption)
                            .pulseFont(13)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if group.unseen {
                    Circle().fill(Theme.Color.primarySolid).frame(width: 8, height: 8).accessibilityLabel("New")
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedStrands.group")
    }

    /// The post or Moment it came from, as the reader may open it now.
    private func open(_ source: ReinventedStrandGroupDTO.Source) {
        DeepLinkRouter.shared.handle(path: source.type == "moment" ? "/moments/\(source.id)" : "/posts/\(source.id)")
    }

    /// "Today", "Yesterday", or "Nov 26" (the server's day is the author's own, as YYYY-MM-DD).
    static func dayWords(_ day: String) -> String {
        let parse = DateFormatter()
        parse.calendar = Calendar(identifier: .gregorian)
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.dateFormat = "yyyy-MM-dd"
        guard let date = parse.date(from: day) else { return day }
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}
