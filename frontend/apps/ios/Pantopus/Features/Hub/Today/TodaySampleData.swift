//
//  TodaySampleData.swift
//  Pantopus
//
//  Deterministic stub fixtures for the Today briefing. Backend has been
//  removed from the repo, so the view-model reads these directly; they also
//  drive previews and snapshot baselines. Values mirror the A10.3 design
//  frames (`today-frames.jsx`): `populated` = mild & mostly sunny,
//  `alert` = hard-freeze advisory.
//

import Foundation

public enum TodaySampleData {
    /// FRAME 1 · POPULATED — Tuesday, mild & mostly sunny.
    public static let populated = TodayDetailContent(
        kicker: "Elm Park",
        dateLabel: "Tue · May 20",
        temperature: "67°",
        condition: "Mostly sunny",
        highLowFeels: "High 74° · Low 58° · Feels like 65°",
        glyph: .sun,
        chips: [
            TodayHeroChip(icon: .leaf, label: "AQI", value: "42", scale: "Good", dotTone: .success),
            TodayHeroChip(icon: .sunDim, label: "UV", value: "6", scale: "High", dotTone: .warning),
            TodayHeroChip(icon: .wind, label: "Wind", value: "8mph")
        ],
        ribbon: nil,
        sunSky: TodaySunSky(
            progress: 0.42,
            sunrise: "6:14 AM",
            sunset: "7:32 PM",
            phaseLabel: "Mid-morning",
            daylight: "13h 18m of daylight"
        ),
        signalsTitle: "Signals · 4 today",
        signalsAccent: .personal,
        signals: [
            TodaySignal(
                id: "rain",
                icon: .cloudRain,
                tone: .personal,
                title: "Light shower expected",
                body: "60% chance after 4pm. Pickup umbrella in foyer.",
                timing: "4pm"
            ),
            TodaySignal(
                id: "pollen",
                icon: .flower,
                tone: .warning,
                title: "Tree pollen high",
                body: "Oak & birch. Lena's allergy log is logging it as a 3-tissue day.",
                timing: "All day",
                severity: TodaySignal.Severity(label: "High", tone: .warning)
            ),
            TodaySignal(
                id: "transit",
                icon: .bus,
                tone: .neutral,
                title: "M14 reroute through 2pm",
                body: "Construction on 14th & 3rd. Add ~7m to your commute.",
                timing: "9a–2p"
            ),
            TodaySignal(
                id: "recycling",
                icon: .trash2,
                tone: .home,
                title: "Recycling pickup",
                body: "Bins curbside before 7am. Maria's on rotation.",
                timing: "Tomorrow"
            )
        ],
        aroundTitle: "Around the block",
        around: [
            TodayAroundItem(id: "market", tone: .home, text: "Farmers market open 8a–2p · 92 St"),
            TodayAroundItem(id: "cleanup", tone: .personal, text: "Park cleanup volunteers · 10am, Elm Park entrance"),
            TodayAroundItem(id: "cafe", tone: .business, text: "Café Sol — pastry drop at 7:30am")
        ],
        share: TodayShareCard(
            title: "Share today's briefing",
            subtitle: "3 members · sent to your household chat"
        )
    )

    /// FRAME 2 · ADVISORY — hard-freeze warning (stand-in for "empty", since
    /// Today always has data).
    public static let alert = TodayDetailContent(
        kicker: "Elm Park · Advisory",
        dateLabel: "Thu · Jan 18",
        temperature: "19°",
        condition: "Hard freeze",
        highLowFeels: "High 24° · Low 9° · Wind chill -4°",
        glyph: .snowflake,
        chips: [
            TodayHeroChip(icon: .leaf, label: "AQI", value: "88", scale: "Moderate", dotTone: .warning),
            TodayHeroChip(icon: .sunDim, label: "UV", value: "2", scale: "Low", dotTone: .success),
            TodayHeroChip(icon: .wind, label: "Wind", value: "22mph")
        ],
        ribbon: TodayAlertRibbon(
            title: "NWS hard-freeze warning · until 8am Fri",
            body: "Drip indoor taps. Bring pets in. Cover outdoor faucets."
        ),
        sunSky: TodaySunSky(
            progress: 0.42,
            sunrise: "7:18 AM",
            sunset: "4:53 PM",
            phaseLabel: "Shorter day",
            daylight: "9h 35m of daylight"
        ),
        signalsTitle: "Signals · 5 today",
        signalsAccent: .error,
        signals: [
            TodaySignal(
                id: "pipe",
                icon: .droplets,
                tone: .personal,
                title: "Pipe freeze risk",
                body: "Drip kitchen + bath taps. Open cabinet doors under sinks.",
                timing: "Overnight",
                severity: TodaySignal.Severity(label: "Critical", tone: .error)
            ),
            TodaySignal(
                id: "grid",
                icon: .zap,
                tone: .warning,
                title: "Grid strain alert",
                body: "ConEd: reduce heat to 68° between 6–9pm if possible.",
                timing: "6–9pm",
                severity: TodaySignal.Severity(label: "Watch", tone: .warning)
            ),
            TodaySignal(
                id: "pets",
                icon: .dog,
                tone: .home,
                title: "Pets inside",
                body: "Wind chill -4°. Walk Murphy max 10 minutes.",
                timing: "All day"
            ),
            TodaySignal(
                id: "transit",
                icon: .bus,
                tone: .neutral,
                title: "MTA delays expected",
                body: "Switch heater issues on the L. Allow +15 min.",
                timing: "Morning"
            ),
            TodaySignal(
                id: "checkin",
                icon: .users,
                tone: .business,
                title: "Check on Mrs. Ono (3A)",
                body: "Block check-in chain · you're up Thursday.",
                timing: "By 8pm"
            )
        ],
        aroundTitle: "Around the block",
        around: [],
        share: TodayShareCard(
            title: "Forward this advisory",
            subtitle: "3 members · also nudges the building chat"
        )
    )
}
