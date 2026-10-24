//
//  PlanPlacePicker.swift
//  Pantopus
//
//  Public places near the host, with search and a map (board H6).
//  Pickup games also offer the public place the host is at (board H4).
//  The list comes ordered for the plan (its kind, a pickup game's sport),
//  each place saying whether it's open for the plan's time; "Suggest
//  places" (PlanPlaceSuggestions) has Pantopus pick from it.
//

import MapKit
import SwiftUI

struct PlanPlacePicker: View {
    @Bindable var model: PlanComposerModel
    /// "You're here now" above the places (pickup games in the host flow, as on Android).
    var offersHereNow = false
    let onClose: () -> Void

    /// How long the picker keeps asking while the server gathers a new area's places.
    static let gatherLimit: TimeInterval = 150
    static let slowLine = "Places near you are taking longer than usual to load. Try again in a minute."
    static let unavailableLine = "Places near you aren't loading right now. Try again in a minute."
    /// No fix, no home and no last map center (as on Android).
    static let noLocationLine = "Share your location or add your home to find places nearby."

    /// What "You're here now" says while it looks, or after it found nothing.
    private enum HereNow {
        case idle, locating, noPlace, noLocation, failed, stillLoading
    }

    @State private var query = ""
    @State private var nearby: [PlanPlaceOptionDTO] = []
    @State private var results: [PlanPlaceOptionDTO] = []
    @State private var chosen: PlanPlaceOptionDTO?
    /// The chosen place came from "You're here now".
    @State private var chosenHereNow = false
    @State private var hereNow = HereNow.idle
    @State private var center: UserCoordinate?
    @State private var loading = true
    /// The server is still gathering this area's places (a first look can take up to a minute).
    @State private var gathering = false
    @State private var loadError: String?
    @State private var searchLoading = false
    @State private var searchGathering = false
    @State private var searchError: String?
    @State private var nearbyRetry = 0
    @State private var searchRetry = 0
    @State private var camera: MapCameraPosition = .automatic
    /// "© OpenStreetMap contributors", from the places reply.
    @State private var attribution: String?
    /// "Pick it on the map" is open (PlanPlaceMapPick).
    @State private var pickingOnMap = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Color.clear.frame(width: 44, height: 44)
                Text("Where?").planFont(.h4).foregroundStyle(Theme.Color.appText).frame(maxWidth: .infinity)
                Button(action: onClose) {
                    Icon(.x, size: 20, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s1)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    searchField
                    if chosen != nil || center != nil { miniMap }
                    suggestions
                    list
                    if let attribution {
                        Text("Places \(attribution)")
                            .planFont(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    Text("You can host within 3 miles of where you live or where you are now.")
                        .planFont(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s6)
            }
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .background(Theme.Color.appBg)
        .task(id: nearbyRetry) { await loadNearby() }
        .task(id: [query, String(searchRetry), center.map { "\($0.latitude),\($0.longitude)" } ?? ""]) {
            await search()
        }
        .planPlaceMapPick(isPresented: $pickingOnMap, kind: model.kind, center: center, homes: model.homePoints) { place in
            choose(place)
            model.place = place
            model.placeIsHereNow = false
            onClose()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPlacePicker")
    }

    private var searchText: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isSearching: Bool {
        searchText.count >= 2
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 18, color: Theme.Color.appTextMuted)
            TextField(model.kind == .studyGroup ? "Search libraries, cafés" : "Search parks, courts, cafés", text: $query)
                .planFont(.body)
                .submitLabel(.search)
                .accessibilityLabel("Search places")
                .accessibilityIdentifier("planPlaceSearch")
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 48)
        .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isSearchField)
    }

    private var miniMap: some View {
        Map(position: $camera, interactionModes: []) {
            UserAnnotation()
            if let chosen {
                Annotation(
                    "",
                    coordinate: CLLocationCoordinate2D(latitude: chosen.latitude, longitude: chosen.longitude),
                    anchor: .center
                ) {
                    PlanPinView(look: PlanPinLook(kind: model.kind, tag: chosen.name, isSelected: true))
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(alignment: .bottomTrailing) { if center != nil { PlanPlaceMapPickChip() } }
        .overlay { Color.clear.contentShape(Rectangle()).onTapGesture { if center != nil { pickingOnMap = true } } }
        .accessibilityElement()
        .accessibilityLabel(chosen.map { "Map showing \($0.name)" } ?? "Map near you")
        .accessibilityAddTraits(center != nil ? .isButton : [])
        .accessibilityHint(center != nil ? "Pick a place on the map" : "")
    }

    /// "Suggest places" once the list is in; from the search box, "Ask Pantopus" once the search is
    /// in and the words name no place ("big screens and food", as on Android).
    @ViewBuilder private var suggestions: some View {
        if isSearching {
            let namesAPlace = results.contains { $0.name.localizedCaseInsensitiveContains(searchText) }
            if !searchLoading, searchError == nil, !namesAPlace {
                PlanPlaceSuggestions(model: model, center: center, ask: String(searchText.prefix(120)), chosenId: chosen?.id) { choose($0) }
                    .id(searchText)
            }
        } else if !loading, loadError == nil, !nearby.isEmpty {
            PlanPlaceSuggestions(model: model, center: center, ask: nil, chosenId: chosen?.id) { choose($0) }
        }
    }

    @ViewBuilder private var list: some View {
        let shown = PlanPlaceFit.ordered(isSearching ? results : nearby, for: model.kind)
        let isLoading = isSearching ? searchLoading : loading
        let error = isSearching ? searchError : loadError
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline(isSearching ? "Results" : "Public places near you").padding(.bottom, 2)
            if offersHereNow { hereNowRow }
            if isLoading, shown.isEmpty {
                ForEach(0..<3, id: \.self) { _ in Shimmer(width: nil, height: 52, cornerRadius: Radii.lg).padding(.vertical, 6) }
                if isSearching ? searchGathering : gathering {
                    Text("Gathering the public places near you. The first look at an area can take up to a minute.")
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, Spacing.s1)
                        .accessibilityIdentifier("planPlaceGathering")
                }
            } else if let error {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(error)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("planPlaceError")
                    Button("Try again") {
                        if isSearching { searchRetry += 1 } else { nearbyRetry += 1 }
                    }
                    .planButton(.secondary)
                    .accessibilityIdentifier("planPlaceRetry")
                }
                .padding(.vertical, Spacing.s3)
            } else if shown.isEmpty {
                Text(isSearching
                    ? "No public places match \u{201C}\(query)\u{201D} within 3 miles."
                    : "No public places are on the map within 3 miles of you yet.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s3)
            }
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, place in
                PlanPlaceRow(
                    place: place,
                    kind: model.kind,
                    isOn: chosen?.id == place.id,
                    divider: index > 0 || offersHereNow,
                    center: center
                ) { choose(place) }
            }
            if center != nil { PlanPlaceMapPickRow { pickingOnMap = true } }
            if model.kind == .playdate { playdateHomeRow }
        }
    }

    private var playdateHomeRow: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.Color.appBorder)
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 44, height: 44)
                    .overlay(Icon(.home, size: 22, color: Theme.Color.appTextStrong))
                VStack(alignment: .leading, spacing: 0) {
                    Text("My place").planFont(.rowTitle).foregroundStyle(Theme.Color.appText)
                    Text("Not for playdates: they meet in public places").planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.vertical, 11)
            .opacity(0.5)
            .accessibilityElement(children: .combine)
        }
    }

    private var footer: some View {
        Button(chosen.map { "Use \($0.name)" } ?? "Choose a place") {
            model.place = chosen
            model.placeIsHereNow = chosenHereNow
            onClose()
        }
        .planButton(.primary)
        .disabled(chosen == nil)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
        .accessibilityIdentifier("planUsePlace")
    }
}

// MARK: - Reading

private extension PlanPlacePicker {
    private func choose(_ place: PlanPlaceOptionDTO, hereNow: Bool = false) {
        chosen = place
        chosenHereNow = hereNow
        camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude),
            latitudinalMeters: 900,
            longitudinalMeters: 900
        ))
    }

    /// The plan the list is for: places that suit it first, each saying whether it's open then.
    private var planQuery: PlanPlaceQuery {
        PlanPlaceQuery(
            kind: model.kind,
            sport: model.kind == .pickupGame ? model.sport : nil,
            startsAt: model.effectiveStart,
            endsAt: model.end
        )
    }

    private func loadNearby() async {
        loading = true
        gathering = false
        loadError = nil
        if nearbyRetry == 0 {
            chosen = model.place
            if let chosen { choose(chosen, hereNow: model.placeIsHereNow) }
        }
        let resolvedCenter = await locationCenter()
        guard !Task.isCancelled else { return }
        center = resolvedCenter
        guard let center else {
            loadError = Self.noLocationLine
            loading = false
            return
        }
        if chosen == nil {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                latitudinalMeters: 1600,
                longitudinalMeters: 1600
            ))
        }
        let endpoint = PlansEndpoints.nearbyPlaces(latitude: center.latitude, longitude: center.longitude, for: planQuery)
        // An area the server hasn't looked at yet answers 202 "loading" while it gathers the places
        // (up to a minute when the map servers are busy): keep asking, 3 seconds apart.
        let started = Date()
        var attempt = 0
        while true {
            do {
                let reply = try await ScreenStore.shared.load(
                    endpoint,
                    as: PlanPlacesResponse.self,
                    kind: .publicPlace,
                    force: nearbyRetry > 0 || attempt > 0
                )
                guard !Task.isCancelled else { return }
                nearby = reply.value.places
                attribution = reply.value.attribution ?? attribution
                if !reply.value.loading {
                    loading = false
                    gathering = false
                    return
                }
                gathering = true
            } catch {
                guard !Task.isCancelled else { return }
                loadError = Self.failure(error)
                loading = false
                gathering = false
                return
            }
            attempt += 1
            if Date().timeIntervalSince(started) > Self.gatherLimit { break }
            try? await Task.sleep(for: .seconds(3))
            if Task.isCancelled { return }
        }
        loadError = Self.slowLine
        loading = false
        gathering = false
    }

    private func locationCenter() async -> UserCoordinate? {
        let location = DeviceLocationProvider.shared
        if location.canLocateWithoutAsking, let fix = await location.requestCurrent(timeoutSeconds: 4) {
            return fix
        }
        if let home = model.home {
            return UserCoordinate(latitude: home.latitude, longitude: home.longitude, accuracyMeters: 50)
        }
        return PlansStoreReads.lastCenter
    }

    private func search() async {
        let text = searchText
        results = []
        searchError = nil
        searchLoading = false
        searchGathering = false
        guard text.count >= 2 else {
            return
        }
        searchLoading = true
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        guard let center = center ?? PlansStoreReads.lastCenter else {
            searchError = Self.noLocationLine
            searchLoading = false
            return
        }
        // Public places only, by name: never a street address someone lives at.
        let endpoint = PlansEndpoints.nearbyPlaces(latitude: center.latitude, longitude: center.longitude, query: text, for: planQuery)
        let started = Date()
        while true {
            do {
                let reply: PlanPlacesResponse = try await APIClient.shared.request(endpoint)
                guard !Task.isCancelled else { return }
                results = reply.places
                attribution = reply.attribution ?? attribution
                if !reply.loading { break }
                searchGathering = true
            } catch {
                guard !Task.isCancelled else { return }
                searchError = Self.failure(error)
                break
            }
            if Date().timeIntervalSince(started) > Self.gatherLimit {
                searchError = Self.slowLine
                break
            }
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
        }
        searchLoading = false
        searchGathering = false
    }

    /// Offline, or the server's "unavailable" (its map servers failed just now), or anything else.
    static func failure(_ error: any Error) -> String {
        if !NetworkMonitor.shared.isOnline { return "You're offline. Places load when you're back online." }
        if case .server = error as? APIError { return unavailableLine }
        return "Couldn't load places. Check your connection and try again."
    }
}

// MARK: - You're here now

private extension PlanPlacePicker {
    /// "You're here now": once it found the place, the row names it, as board H4 does ("City courts / You're here now").
    var hereNowRow: some View {
        let found = chosenHereNow ? chosen : nil
        return Button { Task { await useHereNow() } } label: {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(Theme.Color.primary100)
                    .frame(width: 44, height: 44)
                    .overlay(Icon(.navigation, size: 22, color: Theme.Color.primary700))
                VStack(alignment: .leading, spacing: 0) {
                    Text(found?.name ?? "You're here now").planFont(.rowTitle).foregroundStyle(Theme.Color.appText).lineLimit(2)
                    Text(found == nil ? hereNowLine : "You're here now").planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if found != nil { Icon(.check, size: 22, strokeWidth: 2.6, color: Theme.Color.primary600) }
            }
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(hereNow == .locating)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(found != nil ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("planPlaceHereNow")
    }

    var hereNowLine: String {
        switch hereNow {
        case .idle: "Use the park or court you're at"
        case .locating: "Finding where you are…"
        case .noPlace: "No public place right here. Pick one below."
        case .noLocation: "Turn on location to use where you are."
        case .failed: "Couldn't load places. Tap to try again."
        case .stillLoading: "Places are still loading. Tap to try again."
        }
    }

    /// Choose a named public place within 150 m, never the fix itself or one of the host's homes.
    func useHereNow() async {
        hereNow = .locating
        guard let fix = await DeviceLocationProvider.shared.requestCurrent(timeoutSeconds: 6) else {
            hereNow = .noLocation
            return
        }
        var around: [PlanPlaceOptionDTO] = []
        var finished = false
        // A first ask for an area can answer "loading" while the server gathers its places (as in loadNearby).
        for attempt in 0..<8 {
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(3))
                if Task.isCancelled { return }
            }
            do {
                let reply: PlanPlacesResponse = try await APIClient.shared.request(
                    PlansEndpoints.nearbyPlaces(latitude: fix.latitude, longitude: fix.longitude)
                )
                guard !Task.isCancelled else { return }
                around = reply.places
                attribution = reply.attribution ?? attribution
                if !reply.loading {
                    finished = true
                    break
                }
            } catch {
                guard !Task.isCancelled else { return }
                hereNow = .failed
                return
            }
        }
        guard finished else {
            hereNow = .stillLoading
            return
        }
        guard let spot = PlanHereNow.spot(in: around, around: fix, homes: model.homePoints) else {
            hereNow = .noPlace
            return
        }
        hereNow = .idle
        choose(spot, hereNow: true)
    }
}
