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
        .accessibilityIdentifier("planPlacePicker")
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 18, color: Theme.Color.appTextMuted)
            TextField("Search parks, courts, cafés", text: $query)
                .planFont(.body)
                .submitLabel(.search)
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
        let shown = query.trimmingCharacters(in: .whitespaces).count >= 2 ? results : nearby
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline(query.count >= 2 ? "Results" : "Public places near you").padding(.bottom, 2)
            if loading, shown.isEmpty {
                ForEach(0..<3, id: \.self) { _ in Shimmer(width: nil, height: 52, cornerRadius: Radii.lg).padding(.vertical, 6) }
            } else if shown.isEmpty {
                Text(query.count >= 2 ? "No places found. Try another name." : "No public places found nearby. Search for one.")
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
            parts
                .append(category.split(separator: ",").prefix(2).map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: " · ")
                    .capitalized)
        }
        if let meters = distance(to: place) {
            parts.append(String(format: "%.1f mi", meters / 1609.34))
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
        if let reply = try? await ScreenStore.shared.load(
            PlansEndpoints.nearbyPlaces(latitude: center.latitude, longitude: center.longitude),
            as: PlanPlacesResponse.self,
            kind: .publicPlace
        ) {
            nearby = reply.value.places
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
        guard !Task.isCancelled else { return }
        if let reply: PlanPlacesResponse = try? await APIClient.shared.request(
            GeoEndpoints.searchPlaces(query: text, latitude: center?.latitude, longitude: center?.longitude)
        ) {
            results = reply.places
        }
    }
}
