//
//  ContentDetailLocationMapView.swift
//  Pantopus
//
//  Mini map for gig/task detail — privacy-aware pin or ~500m circle,
//  tappable to open a full-screen interactive explorer.
//

import MapKit
import SwiftUI

struct ContentDetailLocationMapView: View {
    let map: ContentDetailLocationMap
    var useLiveMap: Bool = true

    @State private var expanded = false
    @State private var cameraPosition: MapCameraPosition

    init(map: ContentDetailLocationMap, useLiveMap: Bool = true) {
        self.map = map
        self.useLiveMap = useLiveMap
        _cameraPosition = State(initialValue: Self.cameraPosition(for: map))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Button {
                if useLiveMap { expanded = true }
            } label: {
                ZStack(alignment: .bottomTrailing) {
                    mapCanvas(interactive: false)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .shadow(color: .black.opacity(0.06), radius: 10, x: 0, y: 4)

                    if useLiveMap {
                        exploreChip
                            .padding(Spacing.s3)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("contentDetailLocationMapPreview")
            .accessibilityLabel(map.isApproximate ? "Approximate task location map" : "Task location map")
            .accessibilityHint("Opens an interactive map")

            Text(map.footnote)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s5)
        .fullScreenCover(isPresented: $expanded) {
            expandedMap
        }
    }

    private var exploreChip: some View {
        HStack(spacing: 4) {
            Icon(.externalLink, size: 12, strokeWidth: 2.2, color: Theme.Color.appText)
            Text("Explore")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.Color.appBorder.opacity(0.7), lineWidth: 1))
    }

    private var expandedMap: some View {
        NavigationStack {
            ZStack(alignment: .topLeading) {
                mapCanvas(interactive: true)
                    .ignoresSafeArea()

                Button {
                    expanded = false
                } label: {
                    Icon(.x, size: 16, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.appBorder.opacity(0.7), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.leading, Spacing.s4)
                .padding(.top, Spacing.s3)
                .accessibilityIdentifier("contentDetailLocationMapClose")
            }
            .navigationBarHidden(true)
        }
        .accessibilityIdentifier("contentDetailLocationMapExpanded")
    }

    @ViewBuilder
    private func mapCanvas(interactive: Bool) -> some View {
        if useLiveMap {
            Map(position: $cameraPosition, interactionModes: interactive ? [.pan, .zoom] : []) {
                mapAnnotations
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .mapControls {
                if interactive {
                    MapCompass()
                    MapScaleView()
                }
            }
        } else {
            staticMapPreview
        }
    }

    @MapContentBuilder
    private var mapAnnotations: some MapContent {
        let coordinate = CLLocationCoordinate2D(latitude: map.latitude, longitude: map.longitude)
        if map.isApproximate {
            MapCircle(center: coordinate, radius: 500)
                .foregroundStyle(Theme.Color.primary600.opacity(0.14))
                .stroke(Theme.Color.primary600.opacity(0.85), lineWidth: 2)
        } else {
            Annotation("", coordinate: coordinate, anchor: .center) {
                ContentDetailMapPin(color: map.category.color)
            }
        }
    }

    private var staticMapPreview: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.Color.primary50, Theme.Color.appSurfaceSunken],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            ContentDetailMapPin(color: map.category.color)
        }
    }

    private static func cameraPosition(for map: ContentDetailLocationMap) -> MapCameraPosition {
        let center = CLLocationCoordinate2D(latitude: map.latitude, longitude: map.longitude)
        let spanMeters: CLLocationDistance = map.isApproximate ? 2400 : 900
        return .region(MKCoordinateRegion(
            center: center,
            latitudinalMeters: spanMeters,
            longitudinalMeters: spanMeters
        ))
    }
}

private struct ContentDetailMapPin: View {
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.22))
                .frame(width: 42, height: 42)
            Circle()
                .fill(color)
                .frame(width: 24, height: 24)
                .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.28), radius: 3, x: 0, y: 2)
            Icon(.mapPin, size: 11, strokeWidth: 2.4, color: .white)
        }
        .frame(width: 44, height: 44)
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Location map — exact") {
    ContentDetailLocationMapView(
        map: ContentDetailLocationMap(
            latitude: 45.587,
            longitude: -122.399,
            isApproximate: false,
            footnote: "Drag to pan · pinch to zoom.",
            category: .handyman
        ),
        useLiveMap: false
    )
}
#endif
