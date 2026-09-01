@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import androidx.compose.ui.geometry.Offset

/**
 * A11.4 Mailbox map — deterministic sample spots (backend removed). The
 * first four entries mirror the rail cards in `mailbox-map-frames.jsx`
 * exactly. Kept in lock-step with the iOS `MailboxMapSampleData`.
 */
object MailboxMapSampleData {
    private const val WEEKDAY_SUNDAY = 1
    private const val WEEKDAY_MONDAY = 2
    private const val WEEKDAY_TUESDAY = 3
    private const val WEEKDAY_WEDNESDAY = 4
    private const val WEEKDAY_THURSDAY = 5
    private const val WEEKDAY_FRIDAY = 6
    private const val WEEKDAY_SATURDAY = 7

    /** "You are here" anchor as a 0…1 fraction of the map canvas. */
    val userAnchor = Offset(0.46f, 0.55f)

    val spots: List<MailboxSpot> =
        listOf(
            MailboxSpot(
                id = "hayes-valley-po",
                kind = MailboxSpotKind.Post,
                name = "Hayes Valley Post Office",
                address = "390 Hayes St · USPS",
                isOpen = true,
                hoursLabel = "Until 6 PM",
                statusLabel = "Open · closes 6 PM",
                walkLabel = "3 min · 0.2 mi",
                lastPickupLabel = "Last pickup 5 PM",
                services =
                    listOf(
                        MailboxServiceType.Stamps,
                        MailboxServiceType.Shipping,
                        MailboxServiceType.PoBoxes,
                        MailboxServiceType.Passport,
                    ),
                weekHours = weekHours("9–6", "9–6", "9–6", "9–6", "9–6", "10–4", "—"),
                mapX = 0.19f,
                mapY = 0.20f,
            ),
            MailboxSpot(
                id = "usps-drop-hayes-buchanan",
                kind = MailboxSpotKind.Drop,
                name = "USPS Drop Box · Hayes & Buchanan",
                address = "Hayes St & Buchanan St · USPS",
                isOpen = true,
                hoursLabel = "Pickup 5 PM",
                statusLabel = "Open · last pickup 5 PM",
                walkLabel = "4 min · 0.3 mi",
                lastPickupLabel = "Last pickup 5 PM",
                services = listOf(MailboxServiceType.DropOff),
                weekHours = weekHours("24h", "24h", "24h", "24h", "24h", "24h", "24h"),
                mapX = 0.43f,
                mapY = 0.13f,
            ),
            MailboxSpot(
                id = "amazon-hub-whole-foods",
                kind = MailboxSpotKind.Locker,
                name = "Amazon Hub Locker · Whole Foods",
                address = "450 Rhode Island St · Amazon",
                isOpen = true,
                hoursLabel = "Until 10 PM",
                statusLabel = "Open · closes 10 PM",
                walkLabel = "6 min · 0.4 mi",
                lastPickupLabel = null,
                services = listOf(MailboxServiceType.Pickup, MailboxServiceType.DropOff),
                weekHours = weekHours("7–10", "7–10", "7–10", "7–10", "7–10", "8–10", "8–9"),
                mapX = 0.61f,
                mapY = 0.24f,
            ),
            MailboxSpot(
                id = "fedex-office-market",
                kind = MailboxSpotKind.Carrier,
                name = "FedEx Office · Market St",
                address = "1800 Market St · FedEx",
                isOpen = true,
                hoursLabel = "Until 8 PM",
                statusLabel = "Open · closes 8 PM",
                walkLabel = "9 min · 0.6 mi",
                lastPickupLabel = "Last pickup 6 PM",
                services = listOf(MailboxServiceType.Shipping, MailboxServiceType.Printing, MailboxServiceType.Pickup),
                weekHours = weekHours("8–8", "8–8", "8–8", "8–8", "8–8", "9–6", "12–5"),
                mapX = 0.80f,
                mapY = 0.16f,
            ),
            MailboxSpot(
                id = "usps-drop-octavia",
                kind = MailboxSpotKind.Drop,
                name = "USPS Drop Box · Octavia Blvd",
                address = "Octavia Blvd & Fell St · USPS",
                isOpen = true,
                hoursLabel = "Pickup 4 PM",
                statusLabel = "Open · last pickup 4 PM",
                walkLabel = "5 min · 0.3 mi",
                lastPickupLabel = "Last pickup 4 PM",
                services = listOf(MailboxServiceType.DropOff),
                weekHours = weekHours("24h", "24h", "24h", "24h", "24h", "24h", "24h"),
                mapX = 0.33f,
                mapY = 0.34f,
            ),
            MailboxSpot(
                id = "civic-center-station",
                kind = MailboxSpotKind.Civic,
                name = "Civic Center Station",
                address = "101 Hyde St · City & County",
                isOpen = true,
                hoursLabel = "Until 5 PM",
                statusLabel = "Open · closes 5 PM",
                walkLabel = "8 min · 0.5 mi",
                lastPickupLabel = null,
                services = listOf(MailboxServiceType.PoBoxes, MailboxServiceType.Passport, MailboxServiceType.DropOff),
                weekHours = weekHours("8–5", "8–5", "8–5", "8–5", "8–5", "—", "—"),
                mapX = 0.67f,
                mapY = 0.37f,
            ),
            MailboxSpot(
                id = "ups-locker-safeway",
                kind = MailboxSpotKind.Locker,
                name = "UPS Access Point · Safeway",
                address = "298 King St · UPS",
                isOpen = true,
                hoursLabel = "Until 9 PM",
                statusLabel = "Open · closes 9 PM",
                walkLabel = "11 min · 0.7 mi",
                lastPickupLabel = null,
                services = listOf(MailboxServiceType.Pickup, MailboxServiceType.DropOff),
                weekHours = weekHours("6–9", "6–9", "6–9", "6–9", "6–9", "7–9", "8–8"),
                mapX = 0.86f,
                mapY = 0.31f,
            ),
            MailboxSpot(
                id = "usps-drop-duboce",
                kind = MailboxSpotKind.Drop,
                name = "USPS Drop Box · Duboce Park",
                address = "Duboce Ave & Noe St · USPS",
                isOpen = false,
                hoursLabel = "Pickup 3 PM",
                statusLabel = "Closed · next pickup 3 PM tomorrow",
                walkLabel = "12 min · 0.8 mi",
                lastPickupLabel = "Last pickup 3 PM",
                services = listOf(MailboxServiceType.DropOff),
                weekHours = weekHours("24h", "24h", "24h", "24h", "24h", "24h", "24h"),
                mapX = 0.15f,
                mapY = 0.45f,
            ),
            MailboxSpot(
                id = "ups-store-divisadero",
                kind = MailboxSpotKind.Carrier,
                name = "The UPS Store · Divisadero",
                address = "1750 Divisadero St · UPS",
                isOpen = true,
                hoursLabel = "Until 7 PM",
                statusLabel = "Open · closes 7 PM",
                walkLabel = "14 min · 0.9 mi",
                lastPickupLabel = "Last pickup 5 PM",
                services =
                    listOf(
                        MailboxServiceType.Shipping,
                        MailboxServiceType.Printing,
                        MailboxServiceType.Pickup,
                        MailboxServiceType.PoBoxes,
                    ),
                weekHours = weekHours("8–7", "8–7", "8–7", "8–7", "8–7", "9–5", "—"),
                mapX = 0.54f,
                mapY = 0.47f,
            ),
            MailboxSpot(
                id = "noe-valley-po",
                kind = MailboxSpotKind.Post,
                name = "Noe Valley Post Office",
                address = "4083 24th St · USPS",
                isOpen = true,
                hoursLabel = "Until 5 PM",
                statusLabel = "Open · closes 5 PM",
                walkLabel = "16 min · 1.0 mi",
                lastPickupLabel = "Last pickup 4 PM",
                services = listOf(MailboxServiceType.Stamps, MailboxServiceType.Shipping, MailboxServiceType.PoBoxes),
                weekHours = weekHours("8:30–5", "8:30–5", "8:30–5", "8:30–5", "8:30–5", "9–2", "—"),
                mapX = 0.30f,
                mapY = 0.27f,
            ),
            MailboxSpot(
                id = "city-hall-mailroom",
                kind = MailboxSpotKind.Civic,
                name = "City Hall Mailroom",
                address = "1 Dr Carlton B Goodlett Pl",
                isOpen = false,
                hoursLabel = "Opens 8 AM",
                statusLabel = "Closed · opens 8 AM",
                walkLabel = "10 min · 0.6 mi",
                lastPickupLabel = null,
                services = listOf(MailboxServiceType.DropOff, MailboxServiceType.PoBoxes),
                weekHours = weekHours("8–5", "8–5", "8–5", "8–5", "8–5", "—", "—"),
                mapX = 0.47f,
                mapY = 0.22f,
            ),
            MailboxSpot(
                id = "amazon-locker-castro",
                kind = MailboxSpotKind.Locker,
                name = "Amazon Hub Locker · Castro",
                address = "2280 Market St · Amazon",
                isOpen = true,
                hoursLabel = "Until 11 PM",
                statusLabel = "Open · closes 11 PM",
                walkLabel = "13 min · 0.8 mi",
                lastPickupLabel = null,
                services = listOf(MailboxServiceType.Pickup, MailboxServiceType.DropOff),
                weekHours = weekHours("6–11", "6–11", "6–11", "6–11", "6–11", "7–11", "8–10"),
                mapX = 0.72f,
                mapY = 0.45f,
            ),
        )

    /**
     * Build a Monday-first week-hour strip from seven Mon→Sun entries,
     * filling in the single-letter labels and `Calendar` weekday numbers
     * (1 = Sun … 7 = Sat) so the view can highlight the current day.
     */
    private fun weekHours(vararg hours: String): List<MailboxDayHours> {
        val labels = listOf("M", "T", "W", "T", "F", "S", "S")
        val weekdays =
            listOf(
                WEEKDAY_MONDAY,
                WEEKDAY_TUESDAY,
                WEEKDAY_WEDNESDAY,
                WEEKDAY_THURSDAY,
                WEEKDAY_FRIDAY,
                WEEKDAY_SATURDAY,
                WEEKDAY_SUNDAY,
            )
        return hours.mapIndexed { index, hour ->
            MailboxDayHours(weekday = weekdays[index], label = labels[index], hours = hour)
        }
    }
}
