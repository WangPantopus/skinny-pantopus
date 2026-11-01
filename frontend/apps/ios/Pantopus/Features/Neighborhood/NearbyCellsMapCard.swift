//
//  NearbyCellsMapCard.swift
//  Pantopus
//
//  The Nearby window (Wedge v2 §4): verified households by block cell
//  around the viewer's place, shaded by the same floored buckets as the
//  public preview. Alive from the first minute — an empty grid is still a
//  map of where you are — and safe by construction: the server sends a
//  bucket per ~1 km cell and nothing else. Nobody's home, including
//  yours, is a point on this map. Parity twin of the web `NearbyCellsMap`.
//
//  On a wide screen (the iPhone Duo open) the map fills the column beside
//  Neighborhood's key and invite (`NeighborhoodTabRoot`): the same map
//  (`NearbyCellsMap`), with its key and note in that column
//  (`NearbyCellsKey`) instead of under it.
//

import MapKit
import SwiftUI

/// The map, its key and its note in one card: the Neighborhood segment's window, and the Pulse quiet card's.
struct NearbyCellsMapCard: View {
    let cells: NeighborhoodCellsDTO

    var body: some View {
        if cells.center != nil {
            VStack(alignment: .leading, spacing: 0) {
                NearbyCellsMap(cells: cells)
                    .frame(height: 240)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16))
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 14) {
                        ForEach(neighborhoodCellLegendOrder, id: \.self) { bucket in
                            HStack(spacing: 5) {
                                NearbyCellSwatch(bucket: bucket, size: 11)
                                Text(cells.buckets[bucket] ?? bucket)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                        }
                    }
                    Text(nearbyCellsNote)
                        .font(.system(size: 12))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .placeCard()
            .accessibilityIdentifier("nearby.cellsMap")
        }
    }
}

/// The cells on the map, framed around the viewer's cell. A picture of the neighborhood: it doesn't pan or zoom.
struct NearbyCellsMap: View {
    let cells: NeighborhoodCellsDTO

    var body: some View {
        if let center = cells.center {
            Map(initialPosition: .region(region(around: center)), interactionModes: []) {
                ForEach(cells.cells) { cell in
                    if let coordinates = corners(of: cell) {
                        MapPolygon(coordinates: coordinates)
                            .foregroundStyle(Theme.Color.primaryInk.opacity(neighborhoodCellFillAlpha(cell.bucket)))
                            .stroke(
                                cell.isHome ? Theme.Color.appText : Theme.Color.primary600.opacity(0.6),
                                lineWidth: cell.isHome ? 2.5 : 1
                            )
                    }
                }
            }
        }
    }

    /// Frames the 5×5 grid (~6 km across) around the viewer's cell.
    private func region(around center: NeighborhoodCellsDTO.Center) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: center.lat, longitude: center.lng),
            span: MKCoordinateSpan(latitudeDelta: 0.06, longitudeDelta: 0.08)
        )
    }

    private func corners(of cell: NeighborhoodCellsDTO.Cell) -> [CLLocationCoordinate2D]? {
        guard cell.bounds.count == 2, cell.bounds[0].count == 2, cell.bounds[1].count == 2 else { return nil }
        let minLat = cell.bounds[0][0], minLng = cell.bounds[0][1]
        let maxLat = cell.bounds[1][0], maxLng = cell.bounds[1][1]
        return [
            CLLocationCoordinate2D(latitude: minLat, longitude: minLng),
            CLLocationCoordinate2D(latitude: minLat, longitude: maxLng),
            CLLocationCoordinate2D(latitude: maxLat, longitude: maxLng),
            CLLocationCoordinate2D(latitude: maxLat, longitude: minLng)
        ]
    }
}

/// The map's key and note, in the column beside the map on a wide screen.
struct NearbyCellsKey: View {
    let cells: NeighborhoodCellsDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 9) {
                ForEach(neighborhoodCellLegendOrder, id: \.self) { bucket in
                    HStack(spacing: 10) {
                        NearbyCellSwatch(bucket: bucket, size: 14)
                        Text(cells.buckets[bucket] ?? bucket)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
            }
            Text(nearbyCellsNote)
                .font(.system(size: 13))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .placeCard()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("nearby.cellsKey")
    }
}

/// A bucket's square in the key, a shade stronger than its cells so the lightest still shows.
private struct NearbyCellSwatch: View {
    let bucket: String
    let size: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 3)
            .fill(Theme.Color.primary600.opacity(max(0.18, neighborhoodCellFillAlpha(bucket) + 0.15)))
            .frame(width: size, height: size)
    }
}

private let nearbyCellsNote = "Cells, not rooftops: about a kilometre each, shaded by how many households have verified. "
    + "Your cell is outlined. No home is ever a dot."
