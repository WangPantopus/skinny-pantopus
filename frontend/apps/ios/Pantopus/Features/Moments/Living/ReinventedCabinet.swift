//
//  ReinventedCabinet.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, the cabinet profile and the yearly poster (PHASE-4 piece 5; CONTRACT 9d; board B8), as
//  the web's (`Cabinet.tsx`, `Poster.tsx`): in My Atlas, the person's own shelves of what they did (places stood, the
//  highest height they showed, field specimens, questions helped, strands sparked, canvases added to). No follower
//  count and no view count, anywhere. "Show my cabinet to people I know" is their own choice. The yearly poster puts
//  the year's numbers and one kept Moment a month (private to them) into a picture made on the phone; nothing of it is
//  shared by the server, and the phone's share sheet is the only way it leaves.
//

import Observation
import SwiftUI

struct ReinventedCabinetDTO: Decodable {
    let placesStood: Int
    let highestFt: Int?
    let specimens: Int
    let questionsHelped: Int
    let strandsSparked: Int
    let canvases: Int
    let since: String?
    let shownTo: String?

    private enum CodingKeys: String, CodingKey {
        case specimens, canvases, since
        case placesStood = "places_stood"
        case highestFt = "highest_ft"
        case questionsHelped = "questions_helped"
        case strandsSparked = "strands_sparked"
        case shownTo = "shown_to"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        placesStood = (try? c.decodeIfPresent(Int.self, forKey: .placesStood)) ?? 0
        highestFt = try? c.decodeIfPresent(Int.self, forKey: .highestFt)
        specimens = (try? c.decodeIfPresent(Int.self, forKey: .specimens)) ?? 0
        questionsHelped = (try? c.decodeIfPresent(Int.self, forKey: .questionsHelped)) ?? 0
        strandsSparked = (try? c.decodeIfPresent(Int.self, forKey: .strandsSparked)) ?? 0
        canvases = (try? c.decodeIfPresent(Int.self, forKey: .canvases)) ?? 0
        since = try? c.decodeIfPresent(String.self, forKey: .since)
        shownTo = try? c.decodeIfPresent(String.self, forKey: .shownTo)
    }

    /// One shelf: its icon, its number and its words; only numbers there are.
    struct Shelf: Identifiable {
        let icon: PantopusIcon
        let big: String
        let words: String
        var id: String {
            words
        }
    }

    var shelves: [Shelf] {
        func count(_ value: Int, _ one: String, _ many: String, _ icon: PantopusIcon) -> Shelf? {
            value > 0 ? Shelf(icon: icon, big: value.formatted(), words: value == 1 ? one : many) : nil
        }
        return [
            count(placesStood, "place stood", "places stood", .mapPin),
            highestFt.map { Shelf(icon: .mountain, big: "\($0.formatted()) ft", words: "highest shown") },
            count(specimens, "field specimen", "field specimens", .leaf),
            count(questionsHelped, "question helped", "questions helped", .messageCircle),
            count(strandsSparked, "strand sparked", "strands sparked", .sparkles),
            count(canvases, "canvas added to", "canvases added to", .image)
        ].compactMap { $0 }
    }
}

private struct ReinventedCabinetEnvelope: Decodable {
    let cabinet: ReinventedCabinetDTO
}

struct ReinventedPosterDTO: Decodable {
    struct Month: Decodable, Identifiable {
        let month: Int
        let moment: MomentDTO
        var id: Int {
            month
        }
    }

    let year: Int
    let numbers: ReinventedCabinetDTO
    let months: [Month]

    private enum CodingKeys: String, CodingKey {
        case year, numbers, months
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        year = try c.decode(Int.self, forKey: .year)
        numbers = try c.decode(ReinventedCabinetDTO.self, forKey: .numbers)
        months = (try? c.decodeIfPresent(LossyList<Month>.self, forKey: .months))?.items ?? []
    }
}

private struct ReinventedPosterEnvelope: Decodable {
    let poster: ReinventedPosterDTO
}

private struct ReinventedCabinetChoice: Encodable {
    let cabinetShown: Bool

    private enum CodingKeys: String, CodingKey {
        case cabinetShown = "cabinet_shown"
    }
}

private extension ReinventedEndpoints {
    static func cabinet(_ userId: String) -> Endpoint {
        let part = userId
            .addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? userId
        return Endpoint(method: .get, path: "/api/reinvented/cabinet/\(part)", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static func poster(_ year: Int) -> Endpoint {
        Endpoint(method: .get, path: "/api/reinvented/poster/\(year)", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static func showCabinet(_ on: Bool) -> Endpoint {
        Endpoint(method: .patch, path: "/api/reinvented/settings", body: ReinventedCabinetChoice(cabinetShown: on))
    }
}

/// "Your cabinet" in My Atlas.
struct ReinventedCabinet: View {
    @State private var cabinet: ReinventedCabinetDTO?
    @State private var poster = false
    @State private var saving = false

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        // A stack, not a Group: with nothing in it yet a Group never appears, so its task would never read.
        VStack(alignment: .leading, spacing: 0) {
            if let cabinet {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Your cabinet")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        if let since = Self.since(cabinet.since) {
                            Text(since)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer()
                        Button("Make my \(String(Self.year)) poster") { poster = true }
                            .font(.system(size: 13, weight: .bold))
                            .accessibilityIdentifier("reinventedCabinet.poster")
                    }
                    if cabinet.shelves.isEmpty {
                        Text("Nothing on the shelves yet. Moments, answers and Retakes fill them.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    } else {
                        LazyVGrid(columns: columns, spacing: 8) {
                            ForEach(cabinet.shelves) { shelf in
                                ReinventedShelf(shelf: shelf)
                            }
                        }
                    }
                    Toggle(isOn: Binding(get: { cabinet.shownTo == "people_you_know" }, set: { show($0) })) {
                        Text("Show my cabinet to people I know")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .disabled(saving)
                    .accessibilityIdentifier("reinventedCabinet.shown")
                }
                .accessibilityIdentifier("reinventedCabinet")
            }
        }
        .task { await read() }
        .sheet(isPresented: $poster) {
            ReinventedPosterView(year: Self.year)
                .presentationDetents([.large])
        }
    }

    /// The year in Pacific time, as the server counts it.
    static var year: Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles") ?? .current
        return calendar.component(.year, from: Date())
    }

    private static func since(_ day: String?) -> String? {
        guard let day, let date = MomentTime.parse(day + "T12:00:00Z") else { return nil }
        return "since \(date.formatted(.dateTime.month(.abbreviated).day().year()))"
    }

    private func read() async {
        guard let me = MomentsComposerModel.account,
              let read: ReinventedCabinetEnvelope = try? await APIClient.shared.request(ReinventedEndpoints.cabinet(me)) else { return }
        cabinet = read.cabinet
    }

    private func show(_ on: Bool) {
        saving = true
        Task {
            _ = try? await APIClient.shared.request(ReinventedEndpoints.showCabinet(on), as: EmptyResponse.self)
            await read()
            saving = false
        }
    }
}

private struct ReinventedShelf: View {
    let shelf: ReinventedCabinetDTO.Shelf

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(shelf.icon, size: 18, strokeWidth: 2.2, color: Theme.Color.primaryTint)
            VStack(alignment: .leading, spacing: 0) {
                Text(shelf.big)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(shelf.words)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

/// The yearly poster: shown here, made into a picture on the phone, and handed to the share sheet if the person asks.
private struct ReinventedPosterView: View {
    let year: Int
    @State private var poster: ReinventedPosterDTO?
    @State private var failed = false
    @State private var picture: Image?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        NavigationStack {
            ScrollView {
                if let poster {
                    VStack(spacing: Spacing.s4) {
                        ReinventedPosterArt(poster: poster, pictures: true)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        if let picture {
                            ShareLink(item: picture, preview: SharePreview("Pantopus \(String(year))", image: picture)) {
                                Text("Save or share the picture")
                                    .font(.system(size: 15, weight: .bold))
                            }
                            .accessibilityIdentifier("reinventedPoster.share")
                        }
                        Text("Made on this phone. Nothing is shared unless you share it.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(Spacing.s4)
                } else if failed {
                    Text("Your poster couldn't load. Try again later.")
                        .padding(Spacing.s6)
                } else {
                    ProgressView().padding(Spacing.s6)
                }
            }
            .navigationTitle("Your \(String(year))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .task {
            do {
                let read: ReinventedPosterEnvelope = try await APIClient.shared.request(ReinventedEndpoints.poster(year))
                poster = read.poster
                // The shared picture draws each month as its colour: a picture still loading can't be drawn into it.
                let renderer = ImageRenderer(content: ReinventedPosterArt(poster: read.poster, pictures: false).frame(width: 360))
                renderer.scale = max(displayScale, 3)
                if let made = renderer.uiImage { picture = Image(uiImage: made) }
            } catch {
                failed = true
            }
        }
    }
}

/// The poster itself: the year, the numbers, and twelve months.
private struct ReinventedPosterArt: View {
    let poster: ReinventedPosterDTO
    /// On the screen the months show their pictures; in the shared picture each is its colour and its month.
    let pictures: Bool

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(String(poster.year))
                .font(.system(size: 44, weight: .heavy))
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 2) {
                ForEach(poster.numbers.shelves) { shelf in
                    Text("\(shelf.big) \(shelf.words)")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.92))
                }
            }
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(1...12, id: \.self) { month in
                    let moment = poster.months.first { $0.month == month }?.moment
                    ZStack(alignment: .bottomLeading) {
                        Rectangle().fill(Color.white.opacity(moment == nil ? 0.08 : 0.22))
                        if pictures, let moment {
                            ReinventedAtlasPicture(moment: moment, large: false)
                        }
                        // On a dark chip, so it reads over a month's picture too.
                        Text(Calendar.current.shortMonthSymbols[month - 1])
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.black.opacity(0.55)))
                            .padding(4)
                    }
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipped()
                }
            }
            Text("Pantopus")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(20)
        .background(LinearGradient(
            colors: [Color(red: 0.05, green: 0.09, blue: 0.16), Color(red: 0.10, green: 0.23, blue: 0.33)],
            startPoint: .top,
            endPoint: .bottom
        ))
    }
}
