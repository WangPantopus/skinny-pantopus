//
//  MomentsStudioDrawer.swift
//  Pantopus
//
//  The Studio's details, a sheet opened from the bar's one summary line (a
//  tap, or the bar dragged up; PHASE-5 A4, PHASE-6 F3): who sees it, and every
//  row of today's Post sheet that isn't on the picture. The small map and the
//  place (with the place picker), "Taken" or the Live line, "Show the area
//  instead" or "Pin it at a place", "No location", the height and the weather,
//  "Share later", and 1, 6, 24 or 48 hours. The caption and Post are on the
//  Studio itself.
//
//  The rows are today's own (`MomentsPostSheet+Place`, `MomentsPostSheet+Sky`),
//  read from a Post sheet made only to lend them, so the two screens can never
//  disagree; the few that are private to the sheet's file are drawn here the
//  same way.
//

import SwiftUI

struct MomentsStudioDrawer: View {
    let model: MomentsComposerModel
    let onDone: () -> Void
    @Environment(AuthManager.self) private var auth
    /// The made-up name screen, when "Made-up name" is picked here before there is one.
    @State private var showsNameScreen = false

    /// Today's Post sheet, never shown: its rows read only the model.
    private var rows: MomentsPostSheet {
        MomentsPostSheet(model: model, asCard: true) {}
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                options
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s6)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Theme.Color.appSurface)
            .navigationTitle(model.studioPostKind?.name ?? "Who, where and how long")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                        .accessibilityIdentifier("moments.studio.drawer.done")
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.drawer")
        // What is inside scrolls at every rest; the sheet moves only by its grabber (PHASE-6 G).
        .presentationContentInteraction(.scrolls)
        // The short list of names, and the place picker it can open, as on today's Post sheet.
        .sheet(isPresented: Binding(get: { model.picksPlace || model.findsPlace }, set: { if !$0 { model.closePlaceSheets() } })) {
            Group {
                if model.findsPlace, let anchor = model.placePickerAnchor {
                    rows.placeFinder(anchor: anchor)
                } else {
                    MomentsPlacePicker(model: model) { model.picksPlace = false }
                }
            }
            .presentationDetents(model.findsPlace ? [.large] : [.medium])
            .presentationBackground(Theme.Color.appSurface)
        }
    }

    private var options: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Who sees it (PHASE-5 A4: the bar keeps one summary line; the details are all here).
            MomentsStudioAudienceRow(model: model) { showsNameScreen = true }
                .padding(.vertical, Spacing.s2)
                .sheet(isPresented: $showsNameScreen) {
                    PenNameSetupView { _ in model.pickStudioAudience(.madeUp) }
                }
            // A post made from it (CONTRACT 6d): the kind's own details first; a Moment's own rows (the Live mark,
            // the area, the height and the weather, "Share later", how long) don't apply to it.
            if let kind = model.studioPostKind {
                MomentsStudioKindDetails(model: model, kind: kind)
            }
            if !model.noLocationOn {
                MomentsPostMap(
                    pin: model.pin,
                    showArea: model.floats || model.madeUpFloats,
                    disc: model.skyDisc ?? model.madeUpDisc,
                    me: me,
                    placeholder: model.locating == .unavailable ? "Location is off" : "Finding where you are…",
                    height: 130,
                    fullMap: MomentsPostFullMap.Place(model: model)
                )
                .padding(.top, Spacing.s2)
            }
            Group {
                // Under a made-up name the server floats it over its area: no exact spot to read or pick.
                if model.madeUpFloats { madeUpPlaceLine } else { rows.placeRow }
            }
            .padding(.top, Spacing.s2)
            if let taken = model.takenLine {
                rows.takenRow(taken).padding(.top, 2)
            } else if model.showsLive, !madeUp, !asPost {
                rows.liveRow.padding(.top, 2)
            }
            if madeUp {
                // Under a made-up name the server floats it over its area and keeps no Live mark, weather or height
                // (the made-up-names contract): those rows go.
                Text("Under your made-up name it shows over its area, or at a public place you pick, with no Live mark, weather or height.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s2)
                    .accessibilityIdentifier("moments.studio.madeUpNote")
            }
            if model.pin == nil, model.locating == .unavailable, !model.noLocationOn {
                Text("Turn on location for Pantopus in Settings to post a Moment.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.error)
                    .padding(.horizontal, Spacing.s1)
                    .accessibilityIdentifier("moments.studio.locationOff")
            }
            if model.showsHomeNotice, !madeUp {
                homeNotice.padding(.top, Spacing.s2)
            }
            if model.skyAtHome, !madeUp {
                rows.skyHomeNote.padding(.top, Spacing.s2)
            }
            if model.offersMadeUpPin {
                // Away from home a made-up name's Moment floats over its area unless its author pins it at a place.
                rows.pinRow.padding(.top, Spacing.s2)
            }
            if !madeUp {
                if !model.noLocationOn, !asPost {
                    Group { if model.sky != nil { rows.pinRow } else { areaRow } }
                        .padding(.top, Spacing.s2)
                }
                rows.noLocationRow
                    .padding(.top, model.noLocationOn ? Spacing.s2 : 0)
                // A post's height, weather and time are its stamps', which the server fills.
                if !asPost, model.offersHeight, let feet = model.heightFeet {
                    rows.heightRow(feet: feet)
                } else if !asPost, model.greysHeight {
                    rows.greyHeightRow
                }
                if !asPost, model.offersWeather, let weather = model.live.weather {
                    rows.weatherRow(weather)
                }
            }
            if model.sky != nil, !model.shareLaterChoices.isEmpty, !asPost {
                rows.shareLaterRow
            }
            if model.offersExplore {
                MomentsStudioExploreRow(model: model)
            }
            if model.showsDeckRow {
                MomentsStudioDeckRow(model: model)
            }
            TogetherStudioRows(model: model) // Phase 3's rows (CONTRACT 8): nothing unless the switch is on and one applies.
            if !asPost {
                Text("How long")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s4)
                    .accessibilityAddTraits(.isHeader)
                durations.padding(.top, Spacing.s2)
            }
        }
    }

    /// Made into one of today's Pulse posts ("+ Ask / Kind").
    private var asPost: Bool {
        model.studioPostKind != nil
    }

    /// Posted under the made-up name (`MomentsStudioMadeUpName`).
    private var madeUp: Bool {
        model.postsUnderMadeUpName
    }

    private var madeUpPlaceLine: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.mapPin, size: 18, strokeWidth: 2.2, color: Theme.Color.primaryTint)
            Text("Area · \(model.studioAreaName)")
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s1)
        .frame(minHeight: 32)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moments.studio.madeUpPlace")
    }

    private var me: MomentAuthorDTO? {
        guard case let .signedIn(user) = auth.state else { return nil }
        return MomentAuthorDTO(me: user)
    }

    /// At your own home with an exact pin: today's amber note.
    private var homeNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(.alertTriangle, size: 20, strokeWidth: 2.2, color: Theme.Color.warning)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text("This is your home. People will see the pin on it.")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                Text("Turn on Show the area instead to show only the area.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, 14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.warningBg))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moments.studio.home")
    }

    private var areaRow: some View {
        Toggle(isOn: Binding(get: { model.showArea }, set: { model.showArea = $0 })) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Show the area instead")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text("People see a pin within about half a mile, not the exact spot")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .tint(Theme.Color.primarySolid)
        .padding(.horizontal, Spacing.s1)
        .frame(minHeight: 52)
        .accessibilityIdentifier("moments.studio.area")
    }

    private var durations: some View {
        HStack(spacing: Spacing.s2) {
            ForEach([1, 6, 24, 48], id: \.self) { hours in
                let selected = model.hours == hours
                Button { model.hours = hours } label: {
                    Text("\(hours)h")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(selected ? Color.white : Theme.Color.appText)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(selected ? Theme.Color.primarySolid : Color.clear))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(selected ? Theme.Color.primarySolid : Theme.Color.appBorder, lineWidth: 1)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(hours == 1 ? "1 hour" : "\(hours) hours")
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("moments.studio.hours.\(hours)")
            }
        }
    }
}
