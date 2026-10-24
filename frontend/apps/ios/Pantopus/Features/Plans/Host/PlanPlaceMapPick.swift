//
//  PlanPlaceMapPick.swift
//  Pantopus
//
//  H6's "Pick it on the map": for a public place the list doesn't have, the
//  host taps one of the places Apple Maps shows (parks, cafés, restaurants,
//  libraries, sports and more). Only a labeled place can be chosen, never a
//  dropped pin, which could land on someone's home: within 3 miles of where
//  the picker looks from (the circle), and not at one of the host's homes
//  (the server refuses that too). As on Android (PlaceMapPick).
//

import MapKit
import SwiftUI

struct PlanPlaceMapPick: View {
    let kind: PlanKind
    let center: UserCoordinate
    let homes: [(latitude: Double, longitude: Double)]
    let onUse: (PlanPlaceOptionDTO) -> Void
    let onClose: () -> Void

    /// As far as the list reaches; the server allows hosting within 5 km of a home or a fresh fix.
    static let reachMeters: CLLocationDistance = 3 * 1609.344

    @State private var camera: MapCameraPosition
    @State private var selection: MapFeature?

    init(
        kind: PlanKind,
        center: UserCoordinate,
        homes: [(latitude: Double, longitude: Double)],
        onUse: @escaping (PlanPlaceOptionDTO) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.kind = kind
        self.center = center
        self.homes = homes
        self.onUse = onUse
        self.onClose = onClose
        _camera = State(initialValue: .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
            latitudinalMeters: 2400,
            longitudinalMeters: 2400
        )))
    }

    var body: some View {
        Map(position: $camera, selection: $selection) {
            UserAnnotation()
            MapCircle(center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude), radius: Self.reachMeters)
                .foregroundStyle(kind.color.opacity(0.06))
                .stroke(kind.color.opacity(0.5), lineWidth: 1.5)
        }
        .mapStyle(.standard(pointsOfInterest: .including(Self.categories(for: kind))))
        .mapFeatureSelectionDisabled { $0.kind != .pointOfInterest }
        .safeAreaInset(edge: .top, spacing: 0) { header }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Group {
                if let selection { card(selection) } else { hint }
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPlaceMapPick")
    }

    private var header: some View {
        HStack {
            Color.clear.frame(width: 44, height: 44)
            Text("Pick a place").planFont(.h4).foregroundStyle(Theme.Color.appText).frame(maxWidth: .infinity)
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
        .background(Theme.Color.appSurface)
    }

    private var hint: some View {
        Text("Tap a park, café or other place the map shows, within 3 miles of you.")
            .planFont(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("planPlaceMapPickHint")
    }

    private func card(_ feature: MapFeature) -> some View {
        let name = feature.title?.replacingOccurrences(of: "\n", with: " ") ?? "This place"
        let category = Self.category(feature.pointOfInterestCategory)
        let meters = distance(to: feature.coordinate)
        let problem = problem(at: feature.coordinate, meters: meters)
        return VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(kind.tint)
                    .frame(width: 44, height: 44)
                    .overlay(Icon(
                        PlanPlaceRow.icon(for: Self.place(name, category, feature.coordinate, meters: meters)),
                        size: 22,
                        color: kind.color
                    ))
                VStack(alignment: .leading, spacing: 1) {
                    Text(name).planFont(.rowTitle).foregroundStyle(Theme.Color.appText).lineLimit(2)
                    Text([category.map { $0.prefix(1).uppercased() + $0.dropFirst() }, PlanFormat.placeDistance(meters)]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityElement(children: .combine)
            }
            if let problem {
                Text(problem)
                    .planFont(.footnote)
                    .foregroundStyle(Theme.Color.warning)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("planPlaceMapPickProblem")
            }
            Button("Use \(name)") { onUse(Self.place(name, category, feature.coordinate, meters: meters)) }
                .planButton(.primary)
                .disabled(problem != nil)
                .accessibilityIdentifier("planPlaceMapPickUse")
        }
    }

    private func distance(to coordinate: CLLocationCoordinate2D) -> CLLocationDistance {
        CLLocation(latitude: center.latitude, longitude: center.longitude)
            .distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
    }

    /// Why the place can't be used, or nil: too far to host, or one of the host's homes.
    private func problem(at coordinate: CLLocationCoordinate2D, meters: CLLocationDistance) -> String? {
        let spot = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let atHome = homes.contains { home in
            CLLocation(latitude: home.latitude, longitude: home.longitude).distance(from: spot) <= PlanHereNow.homeGuardMeters
        }
        if atHome { return "That's your home. Choose a public place nearby." }
        if meters > Self.reachMeters { return "That's more than 3 miles from you. Choose a place closer by." }
        return nil
    }

    private static func place(
        _ name: String,
        _ category: String?,
        _ coordinate: CLLocationCoordinate2D,
        meters: CLLocationDistance
    ) -> PlanPlaceOptionDTO {
        PlanPlaceOptionDTO(
            placeId: nil,
            name: name,
            category: category,
            address: nil,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            distanceMeters: meters
        )
    }

    /// The list's words for Apple's kinds of place (its icons and the "Bar · 0.7 mi" line).
    private static let categoryWords: [MKPointOfInterestCategory: String] = [
        .park: "park", .nationalPark: "park", .beach: "park", .campground: "park", .marina: "park",
        .cafe: "cafe", .bakery: "cafe", .restaurant: "restaurant",
        .nightlife: "bar", .brewery: "bar", .winery: "bar", .library: "library"
    ]

    static func category(_ category: MKPointOfInterestCategory?) -> String? {
        category.flatMap { categoryWords[$0] }
    }

    /// The kinds of place the map shows and lets the host tap: never bars for a playdate.
    static func categories(for kind: PlanKind) -> [MKPointOfInterestCategory] {
        var shown: [MKPointOfInterestCategory] = [
            .park, .nationalPark, .beach, .campground, .marina, .zoo, .aquarium, .amusementPark,
            .cafe, .bakery, .restaurant, .library, .museum, .university,
            .fitnessCenter, .stadium, .theater, .movieTheater
        ]
        if kind != .playdate { shown += [.nightlife, .brewery, .winery] }
        if #available(iOS 18.0, *) {
            shown += [
                .baseball, .basketball, .soccer, .tennis, .volleyball, .skatePark, .hiking, .swimming,
                .bowling, .golf, .miniGolf, .rockClimbing, .skating, .musicVenue
            ]
        }
        return shown
    }
}

/// "Pick on map" on H6's small map, which opens the map pick (the map itself is the button).
struct PlanPlaceMapPickChip: View {
    var body: some View {
        HStack(spacing: 6) {
            Icon(.map, size: 14, color: Theme.Color.appText)
            Text("Pick on map").planFont(.label).foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(Theme.Color.appSurface.opacity(0.92)))
        .padding(Spacing.s2)
        .accessibilityHidden(true)
    }
}

/// "Can't find it? Pick it on the map" under H6's list, also while it loads or when it can't.
struct PlanPlaceMapPickRow: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Divider().overlay(Theme.Color.appBorder)
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(width: 44, height: 44)
                        .overlay(Icon(.map, size: 22, color: Theme.Color.appTextStrong))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Can't find it? Pick it on the map").planFont(.rowTitle).foregroundStyle(Theme.Color.appText)
                        Text("Tap any park, café or other place the map shows")
                            .planFont(.footnote)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.vertical, 11)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("planPlacePickOnMap")
    }
}

extension View {
    /// Shows the map pick over H6. The place the host used reaches `onPicked` once the map has
    /// closed, so H6 can close in turn.
    func planPlaceMapPick(
        isPresented: Binding<Bool>,
        kind: PlanKind,
        center: UserCoordinate?,
        homes: [(latitude: Double, longitude: Double)],
        onPicked: @escaping (PlanPlaceOptionDTO) -> Void
    ) -> some View {
        modifier(PlanPlaceMapPickPresenter(isPresented: isPresented, kind: kind, center: center, homes: homes, onPicked: onPicked))
    }
}

private struct PlanPlaceMapPickPresenter: ViewModifier {
    @Binding var isPresented: Bool
    let kind: PlanKind
    let center: UserCoordinate?
    let homes: [(latitude: Double, longitude: Double)]
    let onPicked: (PlanPlaceOptionDTO) -> Void

    @State private var picked: PlanPlaceOptionDTO?

    func body(content: Content) -> some View {
        content.fullScreenCover(isPresented: $isPresented, onDismiss: pickedClosed) {
            if let center {
                PlanPlaceMapPick(
                    kind: kind,
                    center: center,
                    homes: homes,
                    onUse: { place in
                        picked = place
                        isPresented = false
                    },
                    onClose: { isPresented = false }
                )
            }
        }
    }

    private func pickedClosed() {
        guard let place = picked else { return }
        picked = nil
        onPicked(place)
    }
}
