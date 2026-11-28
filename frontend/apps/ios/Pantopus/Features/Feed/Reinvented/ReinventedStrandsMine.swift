//
//  ReinventedStrandsMine.swift
//  Pantopus
//
//  Strands, the follower's side ("Pulse, reinvented" phase 3, PHASE-3 piece 5; CONTRACT 8c). A strand is made only from
//  the follower's own acts, so the follower holds two things: the choice ("Tell people when their post led me
//  somewhere", one row in Settings' Privacy group, on unless they turn it off; `strands` in
//  `GET/PATCH /api/reinvented/settings`) and every strand they are in, each one theirs to take back
//  (`GET /api/reinvented/strands?side=mine`, `DELETE /api/reinvented/strands/:id`: that person no longer sees it and it is
//  never made again). The list sits in My Atlas under "Went because of you". Only while the switch is on: with it off
//  nothing here is read or drawn, and Settings is today's.
//

import Observation
import SwiftUI

/// One strand the reader is in: whose post, what kind, when.
struct ReinventedMyStrandDTO: Decodable, Hashable, Identifiable {
    let id: String
    let kind: String
    let author: MomentAuthorDTO?
    let at: String?

    private enum CodingKeys: String, CodingKey {
        case id, kind, author, at
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = (try? c.decodeIfPresent(String.self, forKey: .kind)) ?? "went"
        author = try? c.decodeIfPresent(MomentAuthorDTO.self, forKey: .author)
        at = try? c.decodeIfPresent(String.self, forKey: .at)
    }
}

struct ReinventedMyStrandsPageDTO: Decodable {
    let strands: [ReinventedMyStrandDTO]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case strands
        case nextCursor = "next_cursor"
    }
}

/// `{ "strands": … }` of `GET/PATCH /api/reinvented/settings`: only the strands choice is read here.
private struct ReinventedStrandsChoiceDTO: Decodable {
    let strands: Bool

    private enum CodingKeys: String, CodingKey {
        case strands
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        strands = (try? c.decodeIfPresent(Bool.self, forKey: .strands)) ?? true
    }
}

private struct ReinventedStrandsChoiceBody: Encodable {
    let strands: Bool
}

enum ReinventedStrandsMineEndpoints {
    /// `GET /api/reinvented/strands?side=mine&cursor=`: the strands the reader is in. Route
    /// `backend/routes/reinvented.js:534`.
    static func mine(cursor: String?) -> Endpoint {
        var query = ["side": "mine"]
        if let cursor { query["cursor"] = cursor }
        return Endpoint(method: .get, path: "/api/reinvented/strands", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `DELETE /api/reinvented/strands/:id`: the follower takes one back (`204`).
    static func takeBack(_ id: String) -> Endpoint {
        let part = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? id
        return Endpoint(method: .delete, path: "/api/reinvented/strands/\(part)")
    }

    /// `GET /api/reinvented/settings`: the person's own choices, `strands` among them.
    static let settings = Endpoint(method: .get, path: "/api/reinvented/settings", cachePolicy: .reloadIgnoringLocalCacheData)

    /// `PATCH /api/reinvented/settings` with `{ "strands": … }`.
    static func setChoice(_ on: Bool) -> Endpoint {
        Endpoint(method: .patch, path: "/api/reinvented/settings", body: ReinventedStrandsChoiceBody(strands: on))
    }
}

// MARK: - The choice

/// "Tell people when their post led me somewhere": read only while the switch is on, kept for the app run, per account.
@Observable
@MainActor
final class ReinventedStrandsChoice {
    static let shared = ReinventedStrandsChoice()

    /// Nil until read (or when it couldn't be read: no row).
    private(set) var on: Bool?
    private var account: String?

    @discardableResult
    func read() async -> Bool? {
        let current = MomentsComposerModel.account
        if account != current { (on, account) = (nil, current) }
        guard PulseReinventedFlags.shared.isOn else { return nil }
        if let choice = try? await MomentsAPI.send(ReinventedStrandsMineEndpoints.settings, as: ReinventedStrandsChoiceDTO.self) {
            on = choice.strands
        }
        return on
    }

    /// Saves the choice; the server's answer, or nil when it couldn't be saved.
    func set(_ wanted: Bool) async -> Bool? {
        guard let choice = try? await MomentsAPI.send(ReinventedStrandsMineEndpoints.setChoice(wanted), as: ReinventedStrandsChoiceDTO.self)
        else { return nil }
        on = choice.strands
        return on
    }
}

extension SettingsIndexViewModel {
    static let strandsChoiceRow = "strandsChoice"

    /// The strands row, after Pantopus AI's in the Privacy group; nothing with the switch off or before it was read.
    var strandsChoiceRows: [GroupedListRow] {
        guard PulseReinventedFlags.shared.isOn else { return [] }
        guard let on = ReinventedStrandsChoice.shared.on else { return yourDayReminderRows }
        return [
            GroupedListRow(
                id: Self.strandsChoiceRow,
                label: "Tell people when their post led me somewhere",
                subtext: "When you mark Want to go on someone’s post and later post from there, they’re told you went because of them. "
                    + "Only them. The ones you’re in are in My Atlas, each yours to take back.",
                control: .toggle(isOn: on),
                accessibilityIdentifier: "settings.strands"
            )
        ] + yourDayReminderRows
    }

    /// The row's switch flipped: saved, or put back when the server says no. True when it was this row.
    func toggleStrandsChoice(_ rowId: String, isOn: Bool) async -> Bool {
        if await toggleYourDayReminder(rowId, isOn: isOn) { return true }
        guard rowId == Self.strandsChoiceRow else { return false }
        await ReinventedStrandsChoice.shared.set(isOn)
        return true
    }
}

// MARK: - The strands the reader is in

@Observable
@MainActor
final class ReinventedStrandsMineModel {
    private(set) var strands: [ReinventedMyStrandDTO] = []
    private(set) var nextCursor: String?
    private(set) var loadingMore = false
    private(set) var takingBack: Set<String> = []
    private(set) var failed: String?

    func load() async {
        guard let page = try? await MomentsAPI.send(ReinventedStrandsMineEndpoints.mine(cursor: nil), as: ReinventedMyStrandsPageDTO.self)
        else {
            strands = []
            return
        }
        strands = page.strands
        nextCursor = page.nextCursor
    }

    func loadMore() async {
        guard let nextCursor, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        guard let page = try? await MomentsAPI.send(
            ReinventedStrandsMineEndpoints.mine(cursor: nextCursor),
            as: ReinventedMyStrandsPageDTO.self
        )
        else { return }
        strands += page.strands.filter { strand in !strands.contains { $0.id == strand.id } }
        self.nextCursor = page.nextCursor
    }

    func takeBack(_ strand: ReinventedMyStrandDTO) async {
        guard !takingBack.contains(strand.id) else { return }
        takingBack.insert(strand.id)
        failed = nil
        defer { takingBack.remove(strand.id) }
        do {
            try await MomentsAPI.send(ReinventedStrandsMineEndpoints.takeBack(strand.id))
            strands.removeAll { $0.id == strand.id }
        } catch {
            failed = "Couldn’t take that back. Try again."
        }
    }
}

/// In My Atlas, under "Went because of you": the strands the reader is in, each one theirs to take back.
/// Nothing when there are none.
struct ReinventedStrandsYoureIn: View {
    let model: ReinventedStrandsMineModel

    var body: some View {
        if !model.strands.isEmpty {
            section
        }
    }

    private var section: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Strands you’re in")
                .pulseFont(16, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Take one back and that person no longer sees it.")
                .pulseFont(13)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ForEach(model.strands) { strand in
                row(strand)
            }
            if let failed = model.failed {
                Text(failed)
                    .pulseFont(13)
                    .foregroundStyle(Theme.Color.error)
            }
            if model.nextCursor != nil {
                Button(model.loadingMore ? "Loading…" : "Show more") { Task { await model.loadMore() } }
                    .pulseFont(14, weight: .semibold)
                    .disabled(model.loadingMore)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurface))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reinventedStrandsMine")
    }

    private func row(_ strand: ReinventedMyStrandDTO) -> some View {
        HStack(spacing: Spacing.s3) {
            if let author = strand.author {
                MomentAvatar(author: author, size: 30).accessibilityHidden(true)
            }
            Text(Self.words(strand))
                .pulseFont(14)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Take back") { Task { await model.takeBack(strand) } }
                .pulseFont(14, weight: .semibold)
                .disabled(model.takingBack.contains(strand.id))
                .accessibilityIdentifier("reinventedStrandsMine.takeBack")
        }
        .accessibilityElement(children: .combine)
    }

    /// "You went because of Dana Lee · Nov 27", as the web says it.
    static func words(_ strand: ReinventedMyStrandDTO) -> String {
        let lead = switch strand.kind {
        case "retake": "You added to the Retake of"
        case "passed": "You carried on a post by"
        default: "You went because of"
        }
        let name = strand.author?.name ?? "someone"
        guard let day = strand.at.flatMap(Self.date) else { return "\(lead) \(name)" }
        return "\(lead) \(name) · \(day.formatted(.dateTime.month(.abbreviated).day()))"
    }

    private static func date(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
