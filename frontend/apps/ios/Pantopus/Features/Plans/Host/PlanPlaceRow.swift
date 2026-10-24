//
//  PlanPlaceRow.swift
//  Pantopus
//
//  One public place in H6's list (and in its suggestions): its icon, name,
//  kind and distance, then what matters for the plan's time ("Open until
//  11 PM · Outdoor seating", or "Closes at 2 PM" in amber), and for a
//  suggestion why it suits the plan.
//

import CoreLocation
import SwiftUI

struct PlanPlaceRow: View {
    let place: PlanPlaceOptionDTO
    let kind: PlanKind
    let isOn: Bool
    let divider: Bool
    /// Where the picker looks from, for a place the server sent without its distance.
    let center: UserCoordinate?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                if divider { Divider().overlay(Theme.Color.appBorder) }
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(isOn ? kind.tint : Theme.Color.appSurfaceSunken)
                        .frame(width: 44, height: 44)
                        .overlay(Icon(Self.icon(for: place), size: 22, color: isOn ? kind.color : Theme.Color.appTextStrong))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(place.name).planFont(.rowTitle).foregroundStyle(Theme.Color.appText).lineLimit(1)
                        Text(subtitle).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                        if let why = place.why {
                            HStack(alignment: .firstTextBaseline, spacing: 5) {
                                Icon(.sparkles, size: 12, color: Theme.Color.primaryInk)
                                Text(why)
                                    .planFont(.footnote)
                                    .foregroundStyle(Theme.Color.appTextStrong)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(.top, 2)
                        }
                        if let detail = place.detail {
                            Text(detail.text)
                                .planFont(.footnote)
                                .foregroundStyle(detail.isWarning ? Theme.Color.warning : Theme.Color.appTextSecondary)
                                .lineLimit(2)
                                .accessibilityIdentifier("planPlaceDetail")
                        }
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

    static func icon(for place: PlanPlaceOptionDTO) -> PantopusIcon {
        let category = (place.category ?? "").lowercased()
        if category.contains("park") || category.contains("playground") || category.contains("trail") { return .trees }
        if category.contains("library") { return .landmark }
        if category.contains("café") || category.contains("cafe") || category.contains("coffee") { return .coffee }
        if category.contains("restaurant") || category.contains("bar") { return .utensils }
        return .mapPin
    }

    /// "Court · pickleball · 0.4 mi": the kind of place, a court's first sport, the host's distance
    /// to it (as Android's placeRowCaption).
    private var subtitle: String {
        // An older reply has only `category`, possibly "park, playground".
        let given = place.categories.isEmpty
            ? (place.category ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            : place.categories
        let words = given.reduce(into: [String]()) { kept, word in
            if !word.isEmpty, !kept.contains(word) { kept.append(word) }
        }
        var parts = words.prefix(2).enumerated().map { index, word in
            let spoken = word.replacingOccurrences(of: "_", with: " ")
            return index == 0 ? spoken.prefix(1).uppercased() + spoken.dropFirst() : spoken
        }
        if let meters = distance { parts.append(PlanFormat.placeDistance(meters)) }
        if parts.isEmpty, let address = place.address { parts.append(address) }
        return parts.joined(separator: " · ")
    }

    private var distance: Double? {
        if let meters = place.distanceMeters { return meters }
        guard let center else { return nil }
        return CLLocation(latitude: center.latitude, longitude: center.longitude)
            .distance(from: CLLocation(latitude: place.latitude, longitude: place.longitude))
    }
}
