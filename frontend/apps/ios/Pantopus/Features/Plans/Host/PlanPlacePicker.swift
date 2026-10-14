//
//  PlanPlacePicker.swift
//  Pantopus
//
//  Board H6 "Where?": search, a small map of the chosen place, public
//  places near the host (parks, playgrounds, libraries, courts, trails,
//  cafés, bars and restaurants), and "Use Crown Park". Playdates meet in
//  public places only.
//

import MapKit
import SwiftUI

struct PlanPlacePicker: View {
    @Bindable var model: PlanComposerModel
    let onClose: () -> Void

    @State private var query = ""
    @State private var nearby: [PlanPlaceOptionDTO] = []
    @State private var results: [PlanPlaceOptionDTO] = []
    @State private var chosen: PlanPlaceOptionDTO?
    @State private var center: UserCoordinate?
    @State private var loading = true
    @State private var camera: MapCameraPosition = .automatic
    /// "© OpenStreetMap contributors", from the places reply.
    @State private var attribution: String?

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
        .task { await loadNearby() }
        .task(id: query) { await search() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPlacePicker")
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 18, color: Theme.Color.appTextMuted)
            TextField("Search parks, courts, cafés", text: $query)
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
        .accessibilityElement()
        .accessibilityLabel(chosen.map { "Map showing \($0.name)" } ?? "Map near you")
    }

    @ViewBuilder private var list: some View {
        let shown = PlanPlaceFit.ordered(query.trimmingCharacters(in: .whitespaces).count >= 2 ? results : nearby, for: model.kind)
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline(query.count >= 2 ? "Results" : "Public places near you").padding(.bottom, 2)
            if loading, shown.isEmpty {
                ForEach(0..<3, id: \.self) { _ in Shimmer(width: nil, height: 52, cornerRadius: Radii.lg).padding(.vertical, 6) }
            } else if shown.isEmpty {
                Text(query.count >= 2 ? "No places match \u{201C}\(query)\u{201D}." : "No public places found nearby. Search for one.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s3)
            }
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, place in
                row(place, divider: index > 0)
            }
            if model.kind == .playdate {
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
        }
    }

    private func row(_ place: PlanPlaceOptionDTO, divider: Bool) -> some View {
        let isOn = chosen?.id == place.id
        return Button { choose(place) } label: {
            VStack(spacing: 0) {
                if divider { Divider().overlay(Theme.Color.appBorder) }
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(isOn ? model.kind.tint : Theme.Color.appSurfaceSunken)
                        .frame(width: 44, height: 44)
                        .overlay(Icon(icon(for: place), size: 22, color: isOn ? model.kind.color : Theme.Color.appTextStrong))
                    VStack(alignment: .leading, spacing: 0) {
                        Text(place.name).planFont(.rowTitle).foregroundStyle(Theme.Color.appText).lineLimit(1)
                        Text(subtitle(place)).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if isOn { Icon(.check, size: 22, strokeWidth: 2.6, color: Theme.Color.primary600) }
                }
                .padding(.vertical, 11)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    private func icon(for place: PlanPlaceOptionDTO) -> PantopusIcon {
        let category = (place.category ?? "").lowercased()
        if category.contains("park") || category.contains("playground") { return .trees }
        if category.contains("library") { return .landmark }
        if category.contains("café") || category.contains("cafe") || category.contains("coffee") { return .coffee }
        if category.contains("restaurant") || category.contains("bar") { return .utensils }
        return .mapPin
    }

    /// "Park · playground · 0.4 mi" (the host's own distance to a public place).
    private func subtitle(_ place: PlanPlaceOptionDTO) -> String {
        var parts: [String] = []
        if let category = place.category, !category.isEmpty {
            // "Park · playground": only the first word capitalized (board H6).
            let words = category.split(separator: ",").prefix(2).map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: " · ")
            parts.append(words.prefix(1).uppercased() + words.dropFirst())
        }
        if let meters = distance(to: place) {
            parts.append(PlanFormat.placeDistance(meters))
        }
        if parts.isEmpty, let address = place.address { parts.append(address) }
        return parts.joined(separator: " · ")
    }

    private func distance(to place: PlanPlaceOptionDTO) -> Double? {
        if let meters = place.distanceMeters { return meters }
        guard let center else { return nil }
        return CLLocation(latitude: center.latitude, longitude: center.longitude)
            .distance(from: CLLocation(latitude: place.latitude, longitude: place.longitude))
    }

    private var footer: some View {
        Button(chosen.map { "Use \($0.name)" } ?? "Choose a place") {
            model.place = chosen
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

    // MARK: - Reading

    private func choose(_ place: PlanPlaceOptionDTO) {
        chosen = place
        camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude),
            latitudinalMeters: 900,
            longitudinalMeters: 900
        ))
    }

    private func loadNearby() async {
        chosen = model.place
        if let chosen { choose(chosen) }
        let location = DeviceLocationProvider.shared
        if location.canLocateWithoutAsking, let fix = await location.requestCurrent(timeoutSeconds: 4) {
            center = fix
        } else if let home = model.home {
            center = UserCoordinate(latitude: home.latitude, longitude: home.longitude, accuracyMeters: 50)
        } else {
            center = PlansStoreReads.lastCenter
        }
        guard let center else {
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
        // The first ask for an area can answer 202 "loading" while the server
        // gathers its places: ask again a few times, 3 seconds apart.
        for attempt in 0..<6 {
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(3))
                if Task.isCancelled { return }
            }
            guard let reply = try? await ScreenStore.shared.load(
                PlansEndpoints.nearbyPlaces(latitude: center.latitude, longitude: center.longitude),
                as: PlanPlacesResponse.self,
                kind: .publicPlace,
                force: attempt > 0
            ) else { break }
            nearby = reply.value.places
            attribution = reply.value.attribution ?? attribution
            if !reply.value.loading { break }
        }
        loading = false
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard text.count >= 2 else {
            results = []
            return
        }
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled, let center = center ?? PlansStoreReads.lastCenter else { return }
        // Public places only, by name: never a street address someone lives at.
        if let reply: PlanPlacesResponse = try? await APIClient.shared.request(
            PlansEndpoints.nearbyPlaces(latitude: center.latitude, longitude: center.longitude, query: text)
        ) {
            results = reply.places
            attribution = reply.attribution ?? attribution
        }
    }
}

/// Which public places suit a plan: the kind's own places first (courts and
/// parks for a pickup game, playgrounds for a playdate, trails for a walk,
/// bars and restaurants for a watch party), nearest first within each, the
/// rest after; never a bar for a playdate.
enum PlanPlaceFit {
    static func ordered(_ places: [PlanPlaceOptionDTO], for kind: PlanKind) -> [PlanPlaceOptionDTO] {
        let preferred = preferredCategories(kind)
        let allowed = places.filter { kind != .playdate || ($0.category ?? "").lowercased() != "bar" }
        return allowed.enumerated()
            .sorted { first, second in
                let one = rank(first.element, preferred)
                let two = rank(second.element, preferred)
                return one == two ? first.offset < second.offset : one < two
            }
            .map(\.element)
    }

    private static func rank(_ place: PlanPlaceOptionDTO, _ preferred: [String]) -> Int {
        preferred.firstIndex(of: (place.category ?? "").lowercased()) ?? preferred.count
    }

    private static func preferredCategories(_ kind: PlanKind) -> [String] {
        switch kind {
        case .watchParty: ["bar", "restaurant", "cafe", "community_center"]
        case .playdate: ["playground", "park", "library", "community_center"]
        case .pickupGame: ["court", "park", "playground", "community_center"]
        case .walkCoffee: ["trail", "park", "cafe"]
        }
    }
}
