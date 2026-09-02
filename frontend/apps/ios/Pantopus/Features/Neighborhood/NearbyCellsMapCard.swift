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

import MapKit
import SwiftUI

struct NearbyCellsMapCard: View {
    let cells: NeighborhoodCellsDTO

    var body: some View {
        if let center = cells.center {
            VStack(alignment: .leading, spacing: 0) {
                Map(initialPosition: .region(region(around: center)), interactionModes: []) {
                    ForEach(cells.cells) { cell in
                        if let coordinates = corners(of: cell) {
                            MapPolygon(coordinates: coordinates)
                                .foregroundStyle(Theme.Color.primary600.opacity(neighborhoodCellFillAlpha(cell.bucket)))
                                .stroke(
                                    cell.isHome ? Theme.Color.appText : Theme.Color.primary600.opacity(0.6),
                                    lineWidth: cell.isHome ? 2.5 : 1
                                )
                        }
                    }
                }
                .frame(height: 240)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16))
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 14) {
                        ForEach(neighborhoodCellLegendOrder, id: \.self) { bucket in
                            HStack(spacing: 5) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Theme.Color.primary600.opacity(max(0.18, neighborhoodCellFillAlpha(bucket) + 0.15)))
                                    .frame(width: 11, height: 11)
                                Text(cells.buckets[bucket] ?? bucket)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                        }
                    }
                    Text("Cells, not rooftops: about a kilometre each, shaded by how many households have verified. "
                        + "Your cell is outlined. No home is ever a dot.")
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
            CLLocationCoordinate2D(latitude: maxLat, longitude: minLng),
        ]
    }
}
