//
//  ReinventedPlacesYouFollow.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, places you follow (PHASE-4 piece 4; CONTRACT 9c), as the web's (`FollowedPlaces.tsx`):
//  at the top of Explore, up to five far places (a hometown, Kyoto) whose Explore items come into Explore. They are the
//  person's own choice and private: nobody is ever told or shown what someone follows. A place is found with the
//  phone's own place search (MapKit, no key and no new service) and sent as its name and point; the server rounds
//  the point to about a kilometre. Explore's first page then brings "From <place>, a place you follow" items, shown
//  here as a row of cards.
//

import MapKit
import Observation
import SwiftUI

struct ReinventedFollowedPlace: Decodable, Identifiable, Equatable {
    let id: String
    let label: String
    let latitude: Double
    let longitude: Double
}

private struct ReinventedPlacesAnswer: Decodable {
    let places: [ReinventedFollowedPlace]
}

private struct ReinventedFollowBody: Encodable {
    let label: String
    let latitude: Double
    let longitude: Double
}

private extension ReinventedEndpoints {
    /// `GET /api/reinvented/places` (CONTRACT 9c): the person's own followed places.
    static var places: Endpoint {
        Endpoint(method: .get, path: "/api/reinvented/places", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `POST /api/reinvented/places`: follow a place (the same place again answers the one kept).
    static func follow(_ body: ReinventedFollowBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/reinvented/places", body: body)
    }

    /// `DELETE /api/reinvented/places/:id`: stop following it.
    static func unfollow(_ id: String) -> Endpoint {
        let part = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? id
        return Endpoint(method: .delete, path: "/api/reinvented/places/\(part)")
    }
}

/// The person's followed places, and the Explore items Explore's first page brought from them.
@Observable
@MainActor
final class ReinventedPlacesYouFollow {
    static let shared = ReinventedPlacesYouFollow()
    static let most = 5

    private(set) var places: [ReinventedFollowedPlace] = []
    /// Explore's first page `followed` (CONTRACT 9c): up to ten items near the places followed.
    private(set) var followed: [ReinventedExploreItemDTO] = []
    private(set) var error: String?
    private(set) var saving = false

    private struct FirstPage: Decodable {
        let followed: [ReinventedExploreItemDTO]

        private enum CodingKeys: String, CodingKey {
            case followed
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            followed = (try? c.decodeIfPresent(LossyList<ReinventedExploreItemDTO>.self, forKey: .followed))?.items ?? []
        }
    }

    /// Explore answered a page: the first one carries `followed`.
    func explored(_ data: Data, first: Bool) {
        guard first else { return }
        followed = (try? JSONDecoder().decode(FirstPage.self, from: data))?.followed ?? []
    }

    func load() async {
        guard let answer: ReinventedPlacesAnswer = try? await APIClient.shared.request(ReinventedEndpoints.places) else { return }
        places = answer.places
    }

    /// Follows a place; true when it went through.
    func follow(label: String, at coordinate: CLLocationCoordinate2D) async -> Bool {
        saving = true
        error = nil
        defer { saving = false }
        let body = ReinventedFollowBody(label: String(label.prefix(60)), latitude: coordinate.latitude, longitude: coordinate.longitude)
        do {
            _ = try await APIClient.shared.request(ReinventedEndpoints.follow(body), as: EmptyResponse.self)
            await load()
            return true
        } catch {
            if case let .clientError(status, _) = error as? APIError {
                self.error = status == 409
                    ? "You follow five places. Stop following one to add another."
                    : "That place couldn't be followed. Pick it from the list."
            } else {
                if case .forbidden = error as? APIError { await PulseReinventedFlags.shared.recheck() }
                self.error = "That didn't save. Try again."
            }
            return false
        }
    }

    func unfollow(_ place: ReinventedFollowedPlace) async -> Bool {
        do {
            _ = try await APIClient.shared.request(ReinventedEndpoints.unfollow(place.id), as: EmptyResponse.self)
            places.removeAll { $0.id == place.id }
            return true
        } catch {
            self.error = "That didn't save. Try again."
            return false
        }
    }
}

/// At the top of Explore: the places followed, "Follow a place", and what came from them.
struct ReinventedFollowedPlacesSection: View {
    /// Explore reads again after a follow or an unfollow, so its items come and go.
    let pulse: ReinventedPulseModel
    let moment: (MomentDTO) -> Void
    let post: (String) -> Void
    private let model = ReinventedPlacesYouFollow.shared
    @State private var finding = false

    private static let followNote = "Follow a hometown or a far place, and what people there share with everyone comes into "
        + "Explore. Nobody sees what you follow."

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Places you follow")
                .pulseFont(15, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s4)
                .accessibilityAddTraits(.isHeader)
            // PHASE-6 A3: a 16 pt gutter, and the row scrolls from it (it sat against the screen's left edge).
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(model.places) { place in
                        HStack(spacing: 6) {
                            Icon(.mapPin, size: 13, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                            Text(place.label)
                                .pulseFont(13.5, weight: .semibold)
                                .foregroundStyle(Theme.Color.appText)
                                .lineLimit(1)
                            Button {
                                Task { if await model.unfollow(place) { await pulse.refresh() } }
                            } label: {
                                Icon(.x, size: 12, strokeWidth: 2.6, color: Theme.Color.appTextSecondary)
                                    .frame(width: 22, height: 22)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Stop following \(place.label)")
                            .accessibilityIdentifier("reinventedPlaces.unfollow.\(place.id)")
                        }
                        .padding(.leading, 10)
                        .padding(.trailing, 4)
                        .frame(height: 32)
                        .background(Capsule().fill(Theme.Color.appSurface))
                        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                    }
                    if model.places.count < ReinventedPlacesYouFollow.most {
                        Button { finding = true } label: {
                            HStack(spacing: 5) {
                                Icon(.plus, size: 13, strokeWidth: 2.4, color: .white)
                                Text("Follow a place")
                                    .pulseFont(13.5, weight: .bold)
                                    .foregroundStyle(.white)
                            }
                            .padding(.horizontal, 12)
                            .frame(height: 32)
                            .background(Capsule().fill(Theme.Color.primarySolid))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("reinventedPlaces.follow")
                    }
                }
            }
            .contentMargins(.horizontal, Spacing.s4, for: .scrollContent)
            if model.places.isEmpty {
                Text(Self.followNote)
                    .pulseFont(13)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, Spacing.s4)
            }
            if let error = model.error {
                Text(error)
                    .pulseFont(13, weight: .semibold)
                    .foregroundStyle(Theme.Color.error)
                    .padding(.horizontal, Spacing.s4)
            }
            if !model.followed.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s2) {
                        ForEach(model.followed) { entry in
                            card(entry)
                        }
                    }
                }
                .contentMargins(.horizontal, Spacing.s4, for: .scrollContent)
            }
        }
        .padding(.bottom, Spacing.s2)
        .task { await model.load() }
        .sheet(isPresented: $finding) {
            ReinventedPlaceFinder { label, coordinate in
                Task {
                    if await model.follow(label: label, at: coordinate) { await pulse.refresh() }
                }
                finding = false
            }
            .presentationDetents([.large])
        }
        .accessibilityIdentifier("reinventedPlaces")
    }

    private func card(_ entry: ReinventedExploreItemDTO) -> some View {
        Button {
            switch entry.item.content {
            case let .moment(item): moment(item)
            case let .post(item): post(item.id)
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                switch entry.item.content {
                case let .moment(moment):
                    ReinventedAtlasPicture(moment: moment, large: false)
                        .frame(width: 128, height: 150)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                case let .post(post):
                    Text(post.title?.isEmpty == false ? post.title ?? "" : post.content)
                        .pulseFont(14, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(5)
                        .padding(10)
                        .frame(width: 128, height: 150, alignment: .topLeading)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.Color.appSurface))
                }
                if let why = entry.why {
                    Text(why)
                        .pulseFont(12)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                        .frame(width: 128, alignment: .leading)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedPlaces.item.\(entry.id)")
    }
}

/// The phone's own place search (MapKit): type a town, pick it, follow it.
private struct ReinventedPlaceFinder: View {
    let onPick: (String, CLLocationCoordinate2D) -> Void
    @State private var search = ReinventedPlaceSearch()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(search.results, id: \.self) { result in
                Button {
                    Task {
                        guard let coordinate = await search.coordinate(of: result) else { return }
                        onPick(result.title, coordinate)
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(result.title).foregroundStyle(Theme.Color.appText)
                        if !result.subtitle.isEmpty {
                            Text(result.subtitle)
                                .pulseFont(13)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
            }
            .searchable(text: $search.text, placement: .navigationBarDrawer(displayMode: .always), prompt: "A town or a place")
            .navigationTitle("Follow a place")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

@Observable
@MainActor
private final class ReinventedPlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
    var text = "" {
        didSet { completer.queryFragment = text }
    }

    private(set) var results: [MKLocalSearchCompletion] = []
    @ObservationIgnored private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.resultTypes = [.address, .pointOfInterest]
        completer.delegate = self
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        // The completer calls back on the main thread.
        MainActor.assumeIsolated { results = completer.results }
    }

    func coordinate(of completion: MKLocalSearchCompletion) async -> CLLocationCoordinate2D? {
        let response = try? await MKLocalSearch(request: MKLocalSearch.Request(completion: completion)).start()
        return response?.mapItems.first?.placemark.coordinate
    }
}
