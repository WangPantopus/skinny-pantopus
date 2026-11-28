//
//  ReinventedMagazine.swift
//  Pantopus
//
//  A circle's weekly magazine (CONTRACT 8d): its week, laid out by the server on read from what its people posted
//  that this reader may see (nothing stored). Opening it marks it read for this reader. A tap opens the Moment or the
//  post as the reader may open it; up to eight weeks back. Words as the web's magazine.
//

import Observation
import SwiftUI

struct ReinventedMagazineItemDTO: Decodable, Hashable, Identifiable {
    let type: String
    let itemId: String
    let author: MomentAuthorDTO?
    let at: String
    let caption: String?
    let thumbURL: URL?
    let ended: Bool

    var id: String {
        "\(type):\(itemId)"
    }

    private enum CodingKeys: String, CodingKey {
        case type, author, at, caption, ended
        case itemId = "id"
        case thumbURL = "thumb_url"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? "post"
        itemId = try c.decode(String.self, forKey: .itemId)
        author = try? c.decodeIfPresent(MomentAuthorDTO.self, forKey: .author)
        at = (try? c.decodeIfPresent(String.self, forKey: .at)) ?? ""
        caption = try? c.decodeIfPresent(String.self, forKey: .caption)
        thumbURL = (try? c.decodeIfPresent(String.self, forKey: .thumbURL)).flatMap(URL.init(string:))
        ended = (try? c.decodeIfPresent(Bool.self, forKey: .ended)) ?? false
    }
}

struct ReinventedMagazineDTO: Decodable {
    struct Week: Decodable {
        let from: String
        let to: String
    }

    struct Page: Decodable {
        let layout: String
        let items: [ReinventedMagazineItemDTO]
    }

    struct Person: Decodable {
        let person: MomentAuthorDTO?
        let count: Int
    }

    struct CircleName: Decodable {
        let id: String
        let name: String
    }

    let circle: CircleName
    let week: Week
    let pages: [Page]
    let people: [Person]
    let empty: Bool
}

@Observable
@MainActor
final class ReinventedMagazineModel {
    enum Load: Equatable {
        case loading, loaded, failed
    }

    let circleId: String
    private(set) var load = Load.loading
    private(set) var magazine: ReinventedMagazineDTO?
    /// The older weeks asked for, newest last; empty is the newest finished week.
    private(set) var weeks: [String] = []

    init(circleId: String) {
        self.circleId = circleId
    }

    func read() async {
        load = .loading
        do {
            magazine = try await MomentsAPI.send(ReinventedCirclesEndpoints.magazine(circleId, week: weeks.last))
            load = .loaded
        } catch {
            load = .failed
            await PulseReinventedFlags.shared.recheck()
        }
        // Opening it marks it read: the circle's "new" goes.
        await ReinventedCirclesModel.shared.read()
    }

    func earlier() async {
        guard let from = magazine?.week.from, weeks.count < 8, let before = Self.dayBefore(from) else { return }
        weeks.append(before)
        await read()
    }

    func later() async {
        guard !weeks.isEmpty else { return }
        weeks.removeLast()
        await read()
    }

    private static let dayFormat: DateFormatter = {
        let format = DateFormatter()
        format.calendar = Calendar(identifier: .gregorian)
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = .current
        format.dateFormat = "yyyy-MM-dd"
        return format
    }()

    static func dayBefore(_ day: String) -> String? {
        guard let date = dayFormat.date(from: day),
              let before = Calendar(identifier: .gregorian).date(byAdding: .day, value: -1, to: date) else { return nil }
        return dayFormat.string(from: before)
    }

    /// "November 22".
    static func words(_ day: String) -> String {
        guard let date = dayFormat.date(from: day) else { return day }
        return date.formatted(.dateTime.month(.wide).day())
    }
}

struct ReinventedMagazineView: View {
    @State private var model: ReinventedMagazineModel
    let onOpen: (String) -> Void

    init(circleId: String, onOpen: @escaping (String) -> Void) {
        _model = State(initialValue: ReinventedMagazineModel(circleId: circleId))
        self.onOpen = onOpen
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                switch model.load {
                case .loading: ReinventedCircleNote("Laying out the week…")
                case .failed: ReinventedCircleNote("This magazine couldn't load.")
                case .loaded: if let magazine = model.magazine { pages(magazine) }
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle(model.magazine?.circle.name ?? "Magazine")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { weekButtons }
        .task { await model.read() }
        .accessibilityIdentifier("reinventedMagazine")
    }

    @ToolbarContentBuilder
    private var weekButtons: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            if model.magazine != nil, model.weeks.count < 8 {
                Button("An earlier week") { Task { await model.earlier() } }
                    .accessibilityIdentifier("reinventedMagazine.earlier")
            }
            Spacer()
            if !model.weeks.isEmpty {
                Button("A later week") { Task { await model.later() } }
                    .accessibilityIdentifier("reinventedMagazine.later")
            }
        }
    }

    @ViewBuilder
    private func pages(_ magazine: ReinventedMagazineDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(magazine.circle.name)
                .pulseFont(13, weight: .bold)
                .foregroundStyle(Theme.Color.primaryTint)
                .textCase(.uppercase)
            Text("\(ReinventedMagazineModel.words(magazine.week.from)) to \(ReinventedMagazineModel.words(magazine.week.to))")
                .pulseFont(26, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            if !magazine.people.isEmpty { people(magazine.people) }
        }
        if magazine.empty || magazine.pages.isEmpty {
            ReinventedCircleNote("Nothing from this circle that week.")
        } else {
            ForEach(Array(magazine.pages.enumerated()), id: \.offset) { _, page in
                self.page(page)
            }
        }
    }

    private func people(_ people: [ReinventedMagazineDTO.Person]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s3) {
                ForEach(Array(people.enumerated()), id: \.offset) { _, entry in
                    if let person = entry.person {
                        HStack(spacing: 6) {
                            MomentAvatar(author: person, size: 22)
                            Text("\(person.name) · \(entry.count)")
                                .pulseFont(13)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
            }
        }
        .padding(.top, Spacing.s1)
    }

    /// cover: one big item; one: full width; two: side by side; grid: two by two.
    @ViewBuilder
    private func page(_ page: ReinventedMagazineDTO.Page) -> some View {
        switch page.layout {
        case "two", "grid":
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s3), count: 2), spacing: Spacing.s3) {
                ForEach(page.items) { item in tile(item, height: 170) }
            }
        default:
            ForEach(page.items) { item in tile(item, height: page.layout == "cover" ? 320 : 220) }
        }
    }

    private func tile(_ item: ReinventedMagazineItemDTO, height: CGFloat) -> some View {
        Button { onOpen(item.type == "moment" ? "/moments/\(item.itemId)" : "/posts/\(item.itemId)") } label: {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                picture(item)
                    .frame(maxWidth: .infinity)
                    .frame(height: height)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                HStack(alignment: .top, spacing: Spacing.s2) {
                    if let author = item.author { MomentAvatar(author: author, size: 24) }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.author?.name ?? "")
                            .pulseFont(13.5, weight: .semibold)
                            .foregroundStyle(Theme.Color.appText)
                        if let caption = item.caption, item.thumbURL != nil {
                            Text(caption)
                                .pulseFont(13)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(2)
                        }
                        if item.ended {
                            Text("Kept after it faded")
                                .pulseFont(12.5)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedMagazine.item")
    }

    @ViewBuilder
    private func picture(_ item: ReinventedMagazineItemDTO) -> some View {
        if let url = item.thumbURL {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Theme.Color.appSurfaceSunken
            }
        } else {
            Text(item.caption ?? "…")
                .pulseFont(17, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.leading)
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Theme.Color.appSurfaceRaised)
        }
    }
}
