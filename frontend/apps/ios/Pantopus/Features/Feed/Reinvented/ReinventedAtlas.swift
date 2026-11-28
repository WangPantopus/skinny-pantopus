//
//  ReinventedAtlas.swift
//  Pantopus
//
//  My Atlas ("Pulse, reinvented" phase 1, PHASE-1 §5 step 7; CONTRACT 6e): the switch's third choice, List | Map |
//  Atlas. Every Moment the person posts while the switch is on is kept for them alone after it fades for everyone
//  else: by date in the list's place, and on the map as their own pins. One opens with its picture, when and where,
//  and "Delete for good" (it ends if still live, and its picture is removed at once).
//

import SwiftUI

@MainActor
@Observable
final class ReinventedAtlasModel {
    enum Phase: Equatable {
        case loading, loaded, failed
    }

    private(set) var phase = Phase.loading
    private(set) var moments: [MomentDTO] = []
    private(set) var loadingMore = false
    @ObservationIgnored private var cursor: String?
    @ObservationIgnored private var hasMore = false

    /// The kept Moments by day, newest first.
    var days: [(day: String, moments: [MomentDTO])] {
        var out: [(day: String, moments: [MomentDTO])] = []
        for moment in moments {
            let day = Self.dayWords(moment.createdAtDate)
            if out.last?.day == day { out[out.count - 1].moments.append(moment) } else { out.append((day, [moment])) }
        }
        return out
    }

    func load() async {
        if moments.isEmpty { phase = .loading }
        await read(cursor: nil)
    }

    func loadMoreIfNeeded(after moment: MomentDTO) async {
        guard hasMore, !loadingMore, moment.id == moments.last?.id else { return }
        loadingMore = true
        defer { loadingMore = false }
        await read(cursor: cursor)
    }

    private func read(cursor: String?) async {
        do {
            let page: ReinventedAtlasPage = try await APIClient.shared.request(ReinventedEndpoints.atlas(cursor: cursor))
            moments = cursor == nil ? page.moments : moments + page.moments.filter { new in !moments.contains { $0.id == new.id } }
            self.cursor = page.nextCursor
            hasMore = page.nextCursor != nil
            phase = .loaded
        } catch {
            if case APIError.forbidden = error { await PulseReinventedFlags.shared.recheck() }
            if cursor == nil, moments.isEmpty { phase = .failed }
        }
    }

    /// Delete for good. Nil when done, else the words to show.
    func deleteForGood(_ moment: MomentDTO) async -> String? {
        do {
            _ = try await APIClient.shared.request(ReinventedEndpoints.deleteForGood(id: moment.id))
            moments.removeAll { $0.id == moment.id }
            return nil
        } catch let APIError.clientError(status, message) where status == 409 {
            return Self.serverWords(message) ?? "This Moment is being reviewed. You can delete it for good once the review is done."
        } catch {
            if case APIError.forbidden = error { await PulseReinventedFlags.shared.recheck() }
            return "Couldn't delete it. Try again."
        }
    }

    private static func serverWords(_ body: String?) -> String? {
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (json["message"] as? String) ?? (json["error"] as? String)
    }

    static func dayWords(_ date: Date?) -> String {
        guard let date else { return "" }
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    static func timeWords(_ date: Date?) -> String {
        date?.formatted(.dateTime.hour().minute()) ?? ""
    }
}

/// My Atlas by date, in the list's place.
struct ReinventedAtlasView: View {
    let model: ReinventedAtlasModel
    let onOpen: (MomentDTO) -> Void
    /// "Went because of you" (CONTRACT 8c), read beside the Atlas.
    @State private var strands = ReinventedStrandsModel()
    /// The strands the reader is in, each theirs to take back (CONTRACT 8c, the follower's side).
    @State private var strandsMine = ReinventedStrandsMineModel()

    private let columns = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                // The grid's own shape while it loads.
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(0..<9, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Theme.Color.appSurfaceRaised)
                            .aspectRatio(3 / 4, contentMode: .fit)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading your Atlas")
            case .failed:
                VStack(spacing: Spacing.s3) {
                    Text("Your Atlas couldn't load.")
                        .pulseFont(15, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Button("Try again") { Task { await model.load() } }
                        .accessibilityIdentifier("reinventedAtlas.retry")
                }
                .frame(maxWidth: .infinity, minHeight: 160)
            case .loaded:
                ScrollView { loaded }
                    .refreshable {
                        await model.load()
                        await strands.load()
                        await strandsMine.load()
                    }
            }
        }
        .task { await model.load() }
        .task { await strands.load() }
        .task { await strandsMine.load() }
        .accessibilityIdentifier("reinventedAtlas")
    }

    private var loaded: some View {
        LazyVStack(alignment: .leading, spacing: Spacing.s3) {
            ReinventedAtlasSearch() // phase 4: Atlas search (CONTRACT 9b)
            Text("My Atlas: every Moment you take is kept here for you alone, after it fades for everyone else.")
                .pulseFont(13)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            // Strands (CONTRACT 8c): "Dana went because of your Moment", private to you; nothing when there are none.
            ReinventedWentBecauseOfYou(model: strands)
            ReinventedStrandsYoureIn(model: strandsMine)
            if model.moments.isEmpty {
                Text("Nothing here yet. The Moments you post from now on are kept here.")
                    .pulseFont(15)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.vertical, Spacing.s6)
                    .accessibilityIdentifier("reinventedAtlas.empty")
            }
            ForEach(model.days, id: \.day) { day in
                Text(day.day)
                    .pulseFont(15, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(day.moments) { moment in
                        card(moment)
                            .task { await model.loadMoreIfNeeded(after: moment) }
                    }
                }
            }
            if model.loadingMore {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s6)
    }

    private func card(_ moment: MomentDTO) -> some View {
        Button { onOpen(moment) } label: {
            ReinventedAtlasPicture(moment: moment)
                .aspectRatio(3 / 4, contentMode: .fill)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(alignment: .bottomLeading) {
                    Text(ReinventedAtlasModel.timeWords(moment.createdAtDate))
                        .pulseFont(11, weight: .semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.black.opacity(0.5)))
                        .padding(5)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Self.spoken(moment))
        .accessibilityIdentifier("reinventedAtlas.moment.\(moment.id)")
    }

    static func spoken(_ moment: MomentDTO) -> String {
        [ReinventedAtlasModel.timeWords(moment.createdAtDate), moment.placeLabel, moment.caption ?? moment.text ?? ""]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}

/// A kept Moment's picture: the photo, a video's poster, or the text card.
struct ReinventedAtlasPicture: View {
    let moment: MomentDTO
    /// The opened Moment's picture (bigger words) rather than a tile of the grid.
    var large = false

    var body: some View {
        switch moment.kind {
        case .text:
            // The card's colors and words, sized for a tile (today's card is drawn for a whole screen).
            let colors = MomentsPalette.card(moment.background ?? "teal")
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
                .overlay {
                    Text(moment.text ?? "")
                        .pulseFont(large ? 24 : 14, weight: .semibold)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                        .lineLimit(large ? 8 : 5)
                        .minimumScaleFactor(0.8)
                        .padding(large ? Spacing.s6 : Spacing.s2)
                }
        case .photo, .video:
            Color.clear.overlay {
                AsyncImage(url: moment.kind == .video ? moment.poster ?? moment.media : moment.media) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Theme.Color.appSurfaceRaised
                }
            }
            .clipped()
        }
    }
}

/// One kept Moment, opened from the Atlas or its pin: when and where, its words, and Delete for good.
struct ReinventedAtlasItem: View {
    let moment: MomentDTO
    let model: ReinventedAtlasModel
    let onClose: () -> Void
    @State private var asking = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ReinventedAtlasPicture(moment: moment, large: true)
                .frame(maxWidth: .infinity)
                .frame(height: 300)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(ReinventedAtlasModel.dayWords(moment.createdAtDate))
                .pulseFont(17, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
            Text([ReinventedAtlasModel.timeWords(moment.createdAtDate), moment.placeLabel].filter { !$0.isEmpty }.joined(separator: " · "))
                .pulseFont(14)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let caption = moment.caption, !caption.isEmpty {
                Text(caption).pulseFont(15).foregroundStyle(Theme.Color.appText)
            }
            Text("Only you see your Atlas.")
                .pulseFont(13)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let error {
                Text(error)
                    .pulseFont(14, weight: .semibold)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("reinventedAtlas.error")
            }
            Spacer(minLength: 0)
            actions
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("reinventedAtlas.item")
    }

    @ViewBuilder private var actions: some View {
        if asking {
            Text("Delete this Moment for good? Its picture is removed now and can't come back.")
                .pulseFont(14)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Spacing.s3) {
                Button(busy ? "Deleting…" : "Delete for good", role: .destructive) { Task { await remove() } }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.Color.error)
                    .disabled(busy)
                    .accessibilityIdentifier("reinventedAtlas.confirmDelete")
                Button("Keep it") { asking = false }
                    .buttonStyle(.bordered)
                    .disabled(busy)
                    .accessibilityIdentifier("reinventedAtlas.keep")
            }
        } else {
            HStack(spacing: Spacing.s3) {
                Button("Close", action: onClose)
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("reinventedAtlas.close")
                Button("Delete for good", role: .destructive) { asking = true }
                    .buttonStyle(.bordered)
                    .tint(Theme.Color.error)
                    .accessibilityIdentifier("reinventedAtlas.delete")
            }
        }
    }

    private func remove() async {
        busy = true
        error = nil
        if let words = await model.deleteForGood(moment) {
            error = words
            busy = false
            asking = false
        } else {
            onClose()
        }
    }
}
