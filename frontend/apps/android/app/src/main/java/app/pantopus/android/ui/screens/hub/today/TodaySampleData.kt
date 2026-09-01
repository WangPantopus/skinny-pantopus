@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Deterministic stub fixtures for the Today briefing. Backend has been
 * removed from the repo, so the view-model reads these directly; they also
 * drive previews and Paparazzi baselines. Values mirror the A10.3 design
 * frames (`today-frames.jsx`).
 */
object TodaySampleData {
    /** FRAME 1 · POPULATED — Tuesday, mild & mostly sunny. */
    val populated =
        TodayDetailContent(
            kicker = "Elm Park",
            dateLabel = "Tue · May 20",
            temperature = "67°",
            condition = "Mostly sunny",
            highLowFeels = "High 74° · Low 58° · Feels like 65°",
            glyph = PantopusIcon.Sun,
            chips =
                listOf(
                    TodayHeroChip(PantopusIcon.Leaf, "AQI", "42", "Good", TodayTone.Success),
                    TodayHeroChip(PantopusIcon.SunDim, "UV", "6", "High", TodayTone.Warning),
                    TodayHeroChip(PantopusIcon.Wind, "Wind", "8mph"),
                ),
            ribbon = null,
            sunSky =
                TodaySunSky(
                    progress = 0.42f,
                    sunrise = "6:14 AM",
                    sunset = "7:32 PM",
                    phaseLabel = "Mid-morning",
                    daylight = "13h 18m of daylight",
                ),
            signalsTitle = "Signals · 4 today",
            signalsAccent = TodayTone.Personal,
            signals =
                listOf(
                    TodaySignal(
                        id = "rain",
                        icon = PantopusIcon.CloudRain,
                        tone = TodayTone.Personal,
                        title = "Light shower expected",
                        body = "60% chance after 4pm. Pickup umbrella in foyer.",
                        timing = "4pm",
                    ),
                    TodaySignal(
                        id = "pollen",
                        icon = PantopusIcon.Flower,
                        tone = TodayTone.Warning,
                        title = "Tree pollen high",
                        body = "Oak & birch. Lena's allergy log is logging it as a 3-tissue day.",
                        timing = "All day",
                        severity = TodaySignalSeverity("High", TodayTone.Warning),
                    ),
                    TodaySignal(
                        id = "transit",
                        icon = PantopusIcon.Bus,
                        tone = TodayTone.Neutral,
                        title = "M14 reroute through 2pm",
                        body = "Construction on 14th & 3rd. Add ~7m to your commute.",
                        timing = "9a–2p",
                    ),
                    TodaySignal(
                        id = "recycling",
                        icon = PantopusIcon.Trash2,
                        tone = TodayTone.Home,
                        title = "Recycling pickup",
                        body = "Bins curbside before 7am. Maria's on rotation.",
                        timing = "Tomorrow",
                    ),
                ),
            aroundTitle = "Around the block",
            around =
                listOf(
                    TodayAroundItem("market", TodayTone.Home, "Farmers market open 8a–2p · 92 St"),
                    TodayAroundItem("cleanup", TodayTone.Personal, "Park cleanup volunteers · 10am, Elm Park entrance"),
                    TodayAroundItem("cafe", TodayTone.Business, "Café Sol — pastry drop at 7:30am"),
                ),
            share =
                TodayShareCard(
                    title = "Share today's briefing",
                    subtitle = "3 members · sent to your household chat",
                ),
        )

    /** FRAME 2 · ADVISORY — hard-freeze warning (stand-in for "empty"). */
    val alert =
        TodayDetailContent(
            kicker = "Elm Park · Advisory",
            dateLabel = "Thu · Jan 18",
            temperature = "19°",
            condition = "Hard freeze",
            highLowFeels = "High 24° · Low 9° · Wind chill -4°",
            glyph = PantopusIcon.Snowflake,
            chips =
                listOf(
                    TodayHeroChip(PantopusIcon.Leaf, "AQI", "88", "Moderate", TodayTone.Warning),
                    TodayHeroChip(PantopusIcon.SunDim, "UV", "2", "Low", TodayTone.Success),
                    TodayHeroChip(PantopusIcon.Wind, "Wind", "22mph"),
                ),
            ribbon =
                TodayAlertRibbon(
                    title = "NWS hard-freeze warning · until 8am Fri",
                    body = "Drip indoor taps. Bring pets in. Cover outdoor faucets.",
                ),
            sunSky =
                TodaySunSky(
                    progress = 0.42f,
                    sunrise = "7:18 AM",
                    sunset = "4:53 PM",
                    phaseLabel = "Shorter day",
                    daylight = "9h 35m of daylight",
                ),
            signalsTitle = "Signals · 5 today",
            signalsAccent = TodayTone.Error,
            signals =
                listOf(
                    TodaySignal(
                        id = "pipe",
                        icon = PantopusIcon.Droplets,
                        tone = TodayTone.Personal,
                        title = "Pipe freeze risk",
                        body = "Drip kitchen + bath taps. Open cabinet doors under sinks.",
                        timing = "Overnight",
                        severity = TodaySignalSeverity("Critical", TodayTone.Error),
                    ),
                    TodaySignal(
                        id = "grid",
                        icon = PantopusIcon.Zap,
                        tone = TodayTone.Warning,
                        title = "Grid strain alert",
                        body = "ConEd: reduce heat to 68° between 6–9pm if possible.",
                        timing = "6–9pm",
                        severity = TodaySignalSeverity("Watch", TodayTone.Warning),
                    ),
                    TodaySignal(
                        id = "pets",
                        icon = PantopusIcon.Dog,
                        tone = TodayTone.Home,
                        title = "Pets inside",
                        body = "Wind chill -4°. Walk Murphy max 10 minutes.",
                        timing = "All day",
                    ),
                    TodaySignal(
                        id = "transit",
                        icon = PantopusIcon.Bus,
                        tone = TodayTone.Neutral,
                        title = "MTA delays expected",
                        body = "Switch heater issues on the L. Allow +15 min.",
                        timing = "Morning",
                    ),
                    TodaySignal(
                        id = "checkin",
                        icon = PantopusIcon.Users,
                        tone = TodayTone.Business,
                        title = "Check on Mrs. Ono (3A)",
                        body = "Block check-in chain · you're up Thursday.",
                        timing = "By 8pm",
                    ),
                ),
            aroundTitle = "Around the block",
            around = emptyList(),
            share =
                TodayShareCard(
                    title = "Forward this advisory",
                    subtitle = "3 members · also nudges the building chat",
                ),
        )
}
