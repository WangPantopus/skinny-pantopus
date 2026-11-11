//
//  MomentsPostSheet+Place.swift
//  Pantopus
//
//  The Post sheet's place row (the name others will read; for an exact pin it
//  opens the short list of names, or the place picker around the pin, the
//  Pulse composer's, founder 2026-11-11), the place picker itself, and the
//  "Taken Oct 3" line for an old album photo or video.
//

import SwiftUI

extension MomentsPostSheet {
    func placeFinder(anchor: MediaCaptureLocation) -> some View {
        let reach = model.pickWithinM
        return PlacePickerSheet(
            currentTag: model.pickedVenue.map {
                PostPlaceTag(name: $0.name, latitude: $0.latitude, longitude: $0.longitude, placeId: $0.placeId, kind: "poi")
            },
            anchoredAt: anchor,
            placeFilter: { place in (place.placeId?.hasPrefix("osm:") ?? false) && (place.distanceM ?? .infinity) <= reach },
            onSelect: { tag in
                model.pickVenue(tag)
                model.picksPlace = false
            },
            onRemove: {
                model.clearVenue()
                model.picksPlace = false
            },
            onDismiss: {
                model.findsPlace = false
                model.picksPlace = false
            }
        )
    }

    /// "Taken Oct 3 · Everyone will see this date": an album photo or video from more than a day ago.
    func takenRow(_ taken: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.calendar, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text(taken)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Everyone will see this date")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(taken). Everyone will see this date.")
        .accessibilityIdentifier("moments.post.taken")
    }

    /// The place row; for an exact pin a button with a chevron: the short list of names when more than one fits the
    /// pin (with "Find another place" under them), else the place picker right away.
    @ViewBuilder var placeRow: some View {
        if !model.canFindPlace {
            placeLine(canChange: false)
                .accessibilityElement(children: .combine)
        } else {
            Button {
                if model.placeChoices.isEmpty { model.findsPlace = true } else { model.picksPlace = true }
            } label: { placeLine(canChange: true).contentShape(Rectangle()) }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint("Picks another place for this Moment")
                .accessibilityIdentifier("moments.post.placeChange")
        }
    }

    func placeLine(canChange: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(
                model.showsHomeNotice ? .home : .mapPin,
                size: 18,
                strokeWidth: 2.2,
                color: Theme.Color.primaryTint
            )
            Text(model.placeLine)
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("moments.post.place")
            Text(model.showArea ? "Area only" : "Exact spot")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if canChange {
                Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, Spacing.s1)
        .frame(minHeight: canChange ? 44 : 32)
    }
}
