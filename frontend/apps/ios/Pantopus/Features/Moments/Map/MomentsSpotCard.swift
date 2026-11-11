//
//  MomentsSpotCard.swift
//  Pantopus
//
//  A crowded spot on the open iPhone Duo held sideways (board O3): the map
//  zooms in on the left half and this card on the right lists who is there:
//  the place, "5 people · 3 new", Play all, then New and Watched, one row
//  per person (their face in its ring, name, check, "12m ago · 23h left",
//  "2 Moments" when there's more than one, a chevron). No picture previews:
//  seeing a Moment counts as watching it. A row plays that person in the
//  same card, with a back chevron to this list; ✕ returns to the full map.
//

import SwiftUI

struct MomentsSpotCard: View {
    let title: String
    /// One per person at the spot, in the strip's order (you, new, then nearest).
    let people: [MomentsStripPerson]
    let rings: [MomentRingDTO]
    let onPlay: @MainActor (_ rings: [MomentRingDTO], _ start: Int, _ newOnly: Bool) -> Void
    /// A row: that person's queue, as a face in the strip plays it.
    let onPerson: @MainActor (MomentsStripPerson) -> Void
    let onClose: @MainActor () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        let fresh = people.filter { $0.face.isNew || $0.face.mine }
        let watched = people.filter { !($0.face.isNew || $0.face.mine) }
        VStack(spacing: 0) {
            header
            playAll
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if !fresh.isEmpty { group("New", fresh) }
                    if !fresh.isEmpty, !watched.isEmpty {
                        Rectangle()
                            .fill(Theme.Color.appText.opacity(colorScheme == .dark ? 0.12 : 0.10))
                            .frame(height: 1)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.top, Spacing.s2)
                            .accessibilityHidden(true)
                    }
                    if !watched.isEmpty { group("Watched", watched) }
                }
                .padding(.bottom, Spacing.s3)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .background {
            shape.fill(.ultraThinMaterial)
            shape.fill(MomentsPalette.pinSurface.opacity(0.9))
        }
        .clipShape(shape)
        .overlay(shape.strokeBorder(Theme.Color.appBorderSubtle.opacity(0.6), lineWidth: 0.5))
        .background {
            shape
                .fill(MomentsPalette.pinSurface)
                .shadow(color: .black.opacity(0.24), radius: 22, x: 0, y: 14)
                .shadow(color: .black.opacity(0.12), radius: 4, x: 0, y: 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Moments at \(title)")
        .accessibilityIdentifier("moments.spot")
    }

    private var header: some View {
        let count = MomentsMapViewModel.people(in: rings)
        let new = MomentsMapViewModel.newPeople(in: rings)
        return HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Text("\(count) \(count == 1 ? "person" : "people")" + (new == 0 ? "" : " · \(new) new"))
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("moments.spot.title")
            Button(action: onClose) {
                Icon(.x, size: 18, strokeWidth: 2.4, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.Color.appText.opacity(colorScheme == .dark ? 0.10 : 0.07)))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, -4)
            .accessibilityLabel("Close, back to the full map")
            .accessibilityIdentifier("moments.spot.close")
        }
        .padding(.top, 18)
        .padding(.leading, Spacing.s5)
        // The 36-pt ✕ ends 12 pt from the card's edge; its 44-pt button reaches 4 pt past it.
        .padding(.trailing, Spacing.s2)
    }

    private var playAll: some View {
        Button {
            // As the strip's Play all: the new ones first; everyone once all are watched.
            let new = rings.filter { $0.isNew && !$0.mine }
            onPlay(new.isEmpty ? rings : new, 0, !new.isEmpty)
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.play, size: 13, color: .white)
                Text("Play all").font(.system(size: 16, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Capsule().fill(Theme.Color.primarySolid))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(.top, 14)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, 6)
        .disabled(rings.isEmpty)
        .accessibilityIdentifier("moments.spot.playAll")
    }

    private func group(_ name: String, _ people: [MomentsStripPerson]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.top, Spacing.s3)
                .padding(.horizontal, Spacing.s5)
                .padding(.bottom, Spacing.s1)
                .accessibilityAddTraits(.isHeader)
            ForEach(people) { person in row(person) }
        }
    }

    private func row(_ person: MomentsStripPerson) -> some View {
        let face = person.face
        let fresh = face.isNew || face.mine
        return Button { onPerson(person) } label: {
            HStack(spacing: Spacing.s3) {
                MomentRingFace(ring: face)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(face.mine ? "You" : face.author.name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(fresh ? Theme.Color.appText : Theme.Color.appTextSecondary)
                            .lineLimit(1)
                        if face.author.verified, !face.mine {
                            MomentVerifiedCheck(size: 14, border: 0)
                        }
                    }
                    Text(Self.when(face))
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if face.moments.count > 1 {
                    Text("\(face.moments.count) Moments")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryTint)
                        .padding(.vertical, Spacing.s1)
                        .padding(.horizontal, 10)
                        .background(Capsule().fill(MomentsPalette.tint))
                }
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
            }
            .padding(.leading, Spacing.s4)
            .padding(.trailing, Spacing.s3)
            .frame(height: 72)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(MomentsSpeech.label(for: person))
        .accessibilityHint("Plays their Moments")
        .accessibilityIdentifier("moments.spot.row.\(face.id)")
    }

    /// "12m ago · 23h left": when their newest Moment was posted, and how long they stay on the map.
    private static func when(_ ring: MomentRingDTO) -> String {
        let created = ring.moments.compactMap { MomentTime.parse($0.createdAt) }.max()
        let ends = ring.moments.compactMap { MomentTime.parse($0.expiresAt) }.max()
        return [MomentTime.ago(created), MomentTime.left(ends)].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}
