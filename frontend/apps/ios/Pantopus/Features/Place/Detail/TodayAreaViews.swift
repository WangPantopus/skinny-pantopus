//
//  TodayAreaViews.swift
//  Pantopus
//
//  What someone with no address on Pantopus yet sees (TABCARD section 4,
//  drawings TodayNoAddress and PlaceFirstRun): Today's start card with "Use
//  my location" and "Type my address", the "Add your address for the rest"
//  card last on the city's day, and the Sun card for that city on Place's
//  address-first screen. Both address buttons open Place's address-first
//  screen, never the Add Home steps. Words and ids match Android and web.
//

import SwiftUI

extension RootTabModel {
    /// "Type my address" and "Add your address": the Place tab on its root,
    /// the address-first screen for someone with no address yet.
    func openAddressFirst() {
        pendingMenuAction = .backToPlace
        selected = .place
    }
}

/// Today with no Home, saved address or claim in review, and no city kept
/// yet. Only the "Use my location" tap asks the system for location.
struct TodayAreaStartCard: View {
    /// A fix came and its city is kept: Today shows that city's day.
    let onLocated: () -> Void
    let onTypeAddress: () -> Void
    private let store = TodayAreaStore.shared

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.cloudSun, size: 28, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 56, height: 56)
            Text("Today starts where you are")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(
                "See the sun, weather and air for your city now. Add your address for pickup day, tax deadlines and alerts on your street."
            )
            .font(.system(size: 14))
            .lineSpacing(3)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
            PrimaryButton(title: "Use my location", isLoading: store.isLocating) {
                // A fix and its city kept: Today shows that city's day.
                if await store.locate() { onLocated() }
            }
            .accessibilityIdentifier("today.areaStart.useLocation")
            GhostButton(title: "Type my address") { onTypeAddress() }
                .accessibilityIdentifier("today.areaStart.typeAddress")
            // Refused, off, or no fix came.
            if store.wasRefused {
                Text("Location is off for Pantopus. You can type your address instead.")
                    .font(.system(size: 13))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("today.areaStart.denied")
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.areaStart")
    }
}

/// Last on the city's day: the rest of Today needs the street.
struct TodayAreaAddAddressCard: View {
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Add your address for the rest")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            Text("Pickup day, tax deadlines, council meetings and alerts for your street.")
                .font(.system(size: 14))
                .lineSpacing(3)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            PrimaryButton(title: "Add your address") { action() }
                .accessibilityIdentifier("today.areaAddAddress.add")
                .padding(.top, 4)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.areaAddAddress")
    }
}

/// Place's address-first screen with a city kept: "RIGHT NOW IN VANCOUVER"
/// over the Sun card from the city's Today. Until that answer comes, or when
/// it fails, the example card stays.
struct PlaceAreaSunCard<Example: View>: View {
    let area: TodayArea
    @ViewBuilder let example: () -> Example
    @State private var today: PlaceIntelligence?

    var body: some View {
        Group {
            if let today, let sun = Self.section(.sunriseSunset, in: today)?.sunriseSunset {
                TodaySunArcCard(
                    data: sun,
                    calendar: Self.calendar(today),
                    weather: Self.weather(today),
                    overline: "RIGHT NOW IN \(placeName(today).uppercased())"
                )
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("place.firstRun.sunCard")
            } else {
                example()
            }
        }
        .task(id: area.identity) {
            today = TodayAreaStore.shared.keptToday(for: area)?.value
            if let fresh = try? await TodayAreaStore.shared.today(for: area) { today = fresh.value }
        }
    }

    /// The city ("Vancouver"), else what the server calls the area ("Near you").
    private func placeName(_ today: PlaceIntelligence) -> String {
        let city = area.city ?? (today.place.city.isEmpty ? nil : today.place.city)
        return city ?? area.label ?? today.place.label
    }

    private static func section(_ id: PlaceSectionID, in intel: PlaceIntelligence) -> PlaceSectionEnvelope? {
        intel.groups.lazy.flatMap(\.sections).first { $0.id == id }
    }

    /// The sun's times are the city's: its own clock.
    private static func calendar(_ intel: PlaceIntelligence) -> Calendar {
        var calendar = Calendar.autoupdatingCurrent
        if let zone = intel.timeZone.flatMap(TimeZone.init(identifier:)) { calendar.timeZone = zone }
        return calendar
    }

    private static func weather(_ intel: PlaceIntelligence) -> WeatherConditionCode? {
        guard let weather = section(.weather, in: intel), weather.status == .ready || weather.status == .stale else { return nil }
        return weather.weather?.conditionCode
    }
}
