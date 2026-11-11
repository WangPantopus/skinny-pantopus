//
//  MomentsPlacePicker.swift
//  Pantopus
//
//  Picking the place's name on the Post sheet (the founder's 2026-11-10
//  addition; Moments contract v3 "Picking the place"): when more than one
//  name fits the exact pin, the place row opens this short list. "Find
//  another place" under it opens the place picker (founder, 2026-11-11): the
//  Pulse composer's, around the pin, for the coffee shop, the school or the
//  stadium the photo was taken in.
//

import SwiftUI

/// The names that fit the pin: the places right there, then the street, then the town. The one picked is
/// what everyone reads on the ring and in the viewer.
struct MomentsPlacePicker: View {
    let model: MomentsComposerModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let venue = model.pickedVenue {
                        venueRow(venue)
                    }
                    ForEach(Array(model.placeChoices.enumerated()), id: \.element.key) { index, choice in
                        row(choice, index: index)
                    }
                } footer: {
                    Text("Everyone who sees this Moment reads the name you pick.")
                }
                Section {
                    Button { model.findsPlace = true } label: {
                        HStack(spacing: Spacing.s3) {
                            Icon(.search, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                            Text("Find another place")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Theme.Color.primaryTint)
                            Spacer(minLength: 0)
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("moments.post.findPlace")
                }
            }
            .accessibilityIdentifier("moments.post.places")
            .navigationTitle("Name this place")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onClose)
                }
            }
        }
    }

    /// The venue picked in the place picker, leading the list (checked) while it names the Moment.
    private func venueRow(_ venue: MomentVenue) -> some View {
        Button(action: onClose) {
            HStack(spacing: Spacing.s3) {
                Text(venue.name)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
                Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.primaryTint)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits([.isButton, .isSelected])
        .accessibilityIdentifier("moments.post.place.venue")
    }

    private func row(_ choice: MomentPlaceChoiceDTO, index: Int) -> some View {
        let selected = choice.key == model.selectedPlaceKey
        return Button {
            model.placeKey = choice.key
            onClose()
        } label: {
            HStack(spacing: Spacing.s3) {
                Text(choice.label)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
                if selected { Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.primaryTint) }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.post.place.\(index)")
    }
}
