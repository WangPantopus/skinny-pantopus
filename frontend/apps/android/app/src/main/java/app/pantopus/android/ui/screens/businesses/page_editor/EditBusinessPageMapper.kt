@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.page_editor

import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemDto
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessLocationDto
import app.pantopus.android.data.api.models.businesses.SetBusinessHoursDayRequest
import app.pantopus.android.data.api.models.businesses.UpdateBusinessLocationRequest
import app.pantopus.android.data.api.models.common.JsonValue
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** Projects API payloads onto [EditBusinessPageContent]. */
internal object EditBusinessPageMapper {
    private val dayLabels = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
    private const val DESCRIPTION_CHAR_LIMIT = 600
    private const val HOURS_PER_DAY = 24

    /** `updateLocationSchema` requires `address` to be at least 3 chars. */
    private const val MIN_STREET_LENGTH = 3

    /** Setup checklist ticks "Description" once the blurb reads as a blurb. */
    private const val MIN_DESCRIPTION_LENGTH = 50

    fun content(
        detail: BusinessDetailResponse,
        hours: List<BusinessHoursDto>,
        catalog: List<BusinessCatalogItemDto>,
    ): EditBusinessPageContent {
        val business = detail.business
        val profile = detail.profile
        val location =
            profile?.primaryLocation
                ?: detail.locations.firstOrNull { it.isPrimary == true }
                ?: detail.locations.firstOrNull()
        val name = business.name.orEmpty()
        val descriptionText = profile?.description.orEmpty()
        val hasBanner = !profile?.bannerFileId.isNullOrBlank()
        val isPublished = profile?.isPublished == true
        val booking = stringMap(profile?.socialLinks)["booking"].orEmpty()

        // The mode below is a seed — `withRecomputedMode` derives the setup
        // checklist / unsaved badge from the assembled content.
        return withRecomputedMode(
            EditBusinessPageContent(
                businessId = business.id,
                mode = seedMode(isPublished, profile?.publishedAt),
                banner =
                    if (hasBanner) {
                        // The upload mirrors the banner onto the business user's cover photo.
                        EditBusinessPageBannerState.Filled(dirty = false, imageUrl = business.coverPhotoUrl)
                    } else {
                        EditBusinessPageBannerState.Empty
                    },
                logo =
                    if (!profile?.logoFileId.isNullOrBlank()) {
                        EditBusinessPageLogoState.Filled(
                            initial = name.take(1).uppercase(Locale.US),
                            imageUrl = business.profilePictureUrl,
                        )
                    } else {
                        EditBusinessPageLogoState.Empty
                    },
                name = field(name),
                tagline = field(business.tagline, "One short line, no punctuation"),
                category = field(profile?.categories.orEmpty().joinToString(" · "), "Pick a category"),
                categoryRequired = !isPublished,
                price = field(profile?.attributes?.get("price_level") as? String, "$ — $$$$"),
                description = descriptionState(descriptionText),
                hours = mapHours(hours),
                services = mapServices(catalog),
                gallery =
                    EditBusinessPageGalleryState(
                        tiles = emptyList(),
                        totalSlots = 20,
                        freshAddTile = false,
                        hintLabel = "0 of 20 · drag to reorder",
                    ),
                phone = field(stripPhonePrefix(profile?.publicPhone.orEmpty()), "(555) 000-0000"),
                email = field(profile?.publicEmail, "hello@business.com"),
                website = field(stripUrlScheme(profile?.website.orEmpty()), "yoursite.com"),
                bookingLink = field(stripUrlScheme(booking), "resy.com/…"),
                location = locationState(location),
            ),
        )
    }

    /**
     * Coerces a free-form jsonb object onto `String → String`, dropping
     * entries whose value isn't a string. `social_links` is user-writable
     * jsonb, so a null / numeric member degrades to "absent" instead of
     * failing the whole editor load.
     */
    fun stringMap(raw: JsonValue?): Map<String, String> =
        raw.orEmpty()
            .mapNotNull { (key, value) -> (value as? String)?.let { key to it } }
            .toMap()

    fun unsavedCount(content: EditBusinessPageContent): Int {
        return textEditCount(content) + locationEditCount(content) + mediaEditCount(content)
    }

    private fun textEditCount(content: EditBusinessPageContent): Int {
        var count = 0
        if (content.name.isDirty) count++
        if (content.tagline.isDirty) count++
        if (content.category.isDirty) count++
        if (content.price.isDirty) count++
        val desc = content.description
        if (desc is EditBusinessPageDescriptionState.Field && desc.field.isDirty) count++
        if (content.phone.isDirty) count++
        if (content.email.isDirty) count++
        if (content.website.isDirty) count++
        content.bookingLink?.let { if (it.isDirty) count++ }
        return count
    }

    private fun locationEditCount(content: EditBusinessPageContent): Int {
        var count = 0
        if (content.location.address.isDirty) count++
        if (content.location.city.isDirty) count++
        if (content.location.state.isDirty) count++
        if (content.location.zip.isDirty) count++
        if (content.location.suite.isDirty) count++
        if (content.location.pinDirty) count++
        return count
    }

    private fun mediaEditCount(content: EditBusinessPageContent): Int {
        var count = 0
        val banner = content.banner
        if (banner is EditBusinessPageBannerState.Filled && banner.dirty) count++
        val hours = content.hours
        if (hours is EditBusinessPageHoursState.Rows && hours.rows.any { it.isDirty }) count++
        val services = content.services
        if (services is EditBusinessPageServicesState.Chips && services.chips.any { it.isFresh }) count++
        if (content.gallery.freshAddTile) count++
        return count
    }

    fun withRecomputedMode(content: EditBusinessPageContent): EditBusinessPageContent {
        val dirty = unsavedCount(content)
        val mode =
            when (val current = content.mode) {
                is EditBusinessPageMode.Published ->
                    current.copy(unsavedCount = dirty)
                is EditBusinessPageMode.Setup -> {
                    val items = setupItemsFromContent(content)
                    val done = items.count { it.done }
                    EditBusinessPageMode.Setup(
                        done = done,
                        total = items.size,
                        remaining = items.size - done,
                        items = items,
                    )
                }
            }
        return content.copy(mode = mode)
    }

    fun normalizeWebsite(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        val lower = trimmed.lowercase(Locale.US)
        if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed
        return "https://$trimmed"
    }

    /**
     * Re-applies the `+1` the loader stripped so a save round-trips the
     * country code instead of dropping it. A number the user typed with its
     * own `+` prefix is left alone.
     */
    fun restorePhonePrefix(
        raw: String,
        hadCountryCode: Boolean,
    ): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty() || !hadCountryCode || trimmed.startsWith("+")) return trimmed
        return "+1 $trimmed"
    }

    /**
     * Folds the edited `booking` key into the full `social_links` object
     * loaded from the server. The PATCH route replaces the jsonb column
     * wholesale (`backend/routes/businesses.js:1134`), so every key that
     * should survive has to travel in the patch.
     */
    fun mergedSocialLinks(
        existing: Map<String, String>,
        booking: String,
    ): Map<String, String> {
        val merged = existing.toMutableMap()
        val trimmed = booking.trim()
        if (trimmed.isEmpty()) merged.remove("booking") else merged["booking"] = trimmed
        return merged
    }

    /**
     * Same wholesale-overwrite guard for `attributes` — merges the edited
     * `price_level` into the object loaded from the server.
     */
    fun mergedAttributes(
        existing: Map<String, Any?>,
        priceLevel: String,
    ): Map<String, Any?> {
        val merged = existing.toMutableMap()
        val trimmed = priceLevel.trim()
        if (trimmed.isEmpty()) merged.remove("price_level") else merged["price_level"] = trimmed
        return merged
    }

    /**
     * Body for the location PATCH. The route re-geocodes from whatever
     * address parts it receives (`backend/routes/businesses.js:1811`), so a
     * partial body would relocate the pin from a partial address. Every
     * component therefore travels whenever any one of them changed, keeping
     * the geocode input a complete, coherent address. The suite travels too,
     * empty when the box is: left out, the route would check the new address
     * with the saved suite and keep it.
     */
    fun locationPayload(location: EditBusinessPageLocation): UpdateBusinessLocationRequest =
        UpdateBusinessLocationRequest(
            address = location.address.current.trim(),
            address2 = location.suite.current.trim(),
            city = location.city.current.trim(),
            state = location.state.current.trim(),
            zipcode = location.zip.current.trim(),
        )

    /**
     * Client-side mirror of `updateLocationSchema`
     * (`backend/routes/businesses.js:190`). The full component set travels on
     * every address edit, so street + city must both be present — those two
     * are `required` server-side and are what makes the geocode resolvable.
     */
    fun locationValidationError(location: EditBusinessPageLocation): String? {
        if (!location.hasAddressEdits) return null
        if (location.address.current.trim().length < MIN_STREET_LENGTH) {
            return "Enter a street address."
        }
        if (location.city.current.isBlank()) {
            return "Enter a city."
        }
        return null
    }

    /** The whole week for `PUT …/hours`, which replaces what is saved; null when no row changed. */
    fun hoursPayload(state: EditBusinessPageHoursState): List<SetBusinessHoursDayRequest>? {
        if (!state.rows.any { it.isDirty }) return null
        return state.rows.mapNotNull(::hoursRequest).ifEmpty { null }
    }

    private fun hoursRequest(row: EditBusinessPageHoursRow): SetBusinessHoursDayRequest? {
        val day = dayLabels.indexOfFirst { it == row.dayLabel || it.lowercase(Locale.US) == row.id }
        if (day < 0) return null
        val source = row.source
        if (!row.isDirty && source != null) {
            return SetBusinessHoursDayRequest(day, source.openTime, source.closeTime, source.isClosed == true, source.notes)
        }
        return when (val state = row.state) {
            is EditBusinessPageHoursRow.State.Open ->
                SetBusinessHoursDayRequest(
                    dayOfWeek = day,
                    openTime = apiTime(state.openLabel, source?.openTime),
                    closeTime = apiTime(state.closeLabel, source?.closeTime),
                    isClosed = false,
                    notes = source?.notes,
                )
            EditBusinessPageHoursRow.State.Closed -> SetBusinessHoursDayRequest(day, isClosed = true, notes = source?.notes)
            EditBusinessPageHoursRow.State.NotSet -> null
        }
    }

    /** The saved value when the label still reads the same, so an edit to one end keeps the other's seconds. */
    private fun apiTime(
        label: String,
        saved: String?,
    ): String? = saved?.takeIf { formatApiTime(it) == label } ?: parseDisplayTime(label)

    /** The rows after one row's hours change; putting the saved hours back clears its dirty mark. */
    fun withRowHours(
        rows: List<EditBusinessPageHoursRow>,
        saved: List<EditBusinessPageHoursRow>,
        id: String,
        value: EditBusinessPageHoursRow.State,
    ): List<EditBusinessPageHoursRow> {
        val selected = rows.firstOrNull { it.id == id } ?: return rows
        val day = selected.dayLabel
        // Closed and open all day answer for the whole day, so they replace its other intervals.
        val replacesDay = value == EditBusinessPageHoursRow.State.Closed || value.isAllDay
        val kept = rows.filterNot { replacesDay && it.dayLabel == day && it.id != id }
        val intervalsChanged = kept.count { it.dayLabel == day } != saved.count { it.dayLabel == day }
        return kept.map { row ->
            if (row.id == id) {
                val savedState = row.source?.let(::hoursState)
                val sameAsSaved = savedState != null && (value == savedState || (value.isAllDay && savedState.isAllDay))
                row.copy(state = value, isDirty = intervalsChanged || !sameAsSaved)
            } else {
                row
            }
        }
    }

    fun mapHours(hours: List<BusinessHoursDto>): EditBusinessPageHoursState {
        val byDay = hours.groupBy { it.dayOfWeek }
        val rows =
            dayLabels.flatMapIndexed { index, label ->
                val id = label.lowercase(Locale.US)
                val intervals = byDay[index].orEmpty().sortedBy { it.openTime.orEmpty() }
                if (intervals.isEmpty()) {
                    listOf(EditBusinessPageHoursRow(id = id, dayLabel = label, state = EditBusinessPageHoursRow.State.NotSet))
                } else {
                    intervals.mapIndexed { offset, row ->
                        EditBusinessPageHoursRow(
                            id = if (offset == 0) id else "$id-$offset",
                            dayLabel = label,
                            state = hoursState(row),
                            source = row,
                        )
                    }
                }
            }
        if (rows.all { it.state is EditBusinessPageHoursRow.State.NotSet }) {
            return EditBusinessPageHoursState.QuickApply(rows = rows)
        }
        return EditBusinessPageHoursState.Rows(
            rows = rows,
            footerHint = "Tap a day to edit its hours. Save to apply your changes.",
        )
    }

    private fun hoursState(row: BusinessHoursDto): EditBusinessPageHoursRow.State {
        if (row.isClosed == true) return EditBusinessPageHoursRow.State.Closed
        val open = formatApiTime(row.openTime)
        val close = formatApiTime(row.closeTime)
        return if (open != null && close != null) {
            EditBusinessPageHoursRow.State.Open(open, close)
        } else {
            EditBusinessPageHoursRow.State.NotSet
        }
    }

    fun mapServices(catalog: List<BusinessCatalogItemDto>): EditBusinessPageServicesState {
        val chips =
            catalog.take(12).map { item ->
                EditBusinessPageServiceChip(
                    id = item.id,
                    label = item.name,
                    iconKey = "sparkles",
                )
            }
        return if (chips.isEmpty()) {
            EditBusinessPageServicesState.Prompt(
                EditBusinessPagePrompt(
                    iconKey = "sparkles",
                    title = "Add at least one service",
                    subtitle = "Show neighbors what this business offers.",
                    ctaLabel = "Add",
                ),
            )
        } else {
            EditBusinessPageServicesState.Chips(chips = chips)
        }
    }

    private fun setupItemsFromContent(content: EditBusinessPageContent): List<EditBusinessPageSetupItem> {
        val description =
            when (val desc = content.description) {
                is EditBusinessPageDescriptionState.Field -> desc.field.current
                is EditBusinessPageDescriptionState.Prompt -> ""
            }
        val hasHours =
            when (val hours = content.hours) {
                is EditBusinessPageHoursState.Rows ->
                    hours.rows.any { it.state !is EditBusinessPageHoursRow.State.NotSet }
                is EditBusinessPageHoursState.QuickApply -> false
            }
        val services = content.services
        val hasServices =
            services is EditBusinessPageServicesState.Chips && services.chips.isNotEmpty()
        val hasContact = content.phone.current.isNotBlank() || content.email.current.isNotBlank()
        return listOf(
            EditBusinessPageSetupItem("name", "Name", content.name.current.isNotBlank()),
            EditBusinessPageSetupItem("contact", "Contact", hasContact),
            EditBusinessPageSetupItem(
                "location",
                "Location",
                content.location.address.current.isNotBlank(),
            ),
            EditBusinessPageSetupItem(
                "banner",
                "Banner",
                content.banner is EditBusinessPageBannerState.Filled,
            ),
            EditBusinessPageSetupItem("desc", "Description", description.length >= MIN_DESCRIPTION_LENGTH),
            EditBusinessPageSetupItem("hours", "Hours", hasHours),
            EditBusinessPageSetupItem("services", "Services", hasServices),
        )
    }

    /** Placeholder mode replaced by [withRecomputedMode] on the way out. */
    private fun seedMode(
        isPublished: Boolean,
        publishedAt: String?,
    ): EditBusinessPageMode =
        if (isPublished) {
            EditBusinessPageMode.Published(
                unsavedCount = 0,
                lastPublishedLabel = lastPublishedLabel(publishedAt),
            )
        } else {
            EditBusinessPageMode.Setup(done = 0, total = 0, remaining = 0, items = emptyList())
        }

    private fun field(
        value: String?,
        placeholder: String = "",
    ): EditBusinessPageField {
        val text = value.orEmpty()
        return EditBusinessPageField(original = text, current = text, placeholder = placeholder)
    }

    private fun descriptionState(text: String): EditBusinessPageDescriptionState =
        if (text.isBlank()) {
            EditBusinessPageDescriptionState.Prompt(
                EditBusinessPagePrompt(
                    iconKey = "fileText",
                    title = "Tell neighbors what you do",
                    subtitle = "A short paragraph helps your page rank in local search.",
                    ctaLabel = "Write",
                ),
            )
        } else {
            EditBusinessPageDescriptionState.Field(
                field = EditBusinessPageField(original = text, current = text),
                charLimit = DESCRIPTION_CHAR_LIMIT,
            )
        }

    /**
     * Address components stay separate — `address` is the street line only,
     * matching the backend column it writes back to.
     */
    private fun locationState(location: BusinessLocationDto?): EditBusinessPageLocation =
        EditBusinessPageLocation(
            address = field(location?.address, "Street address"),
            suite = field(location?.address2, "Suite 200, Unit B"),
            city = field(location?.city, "City"),
            state = field(location?.state, "State"),
            zip = field(location?.zipcode, "ZIP"),
            mapVerified = location?.location != null,
        )

    private fun lastPublishedLabel(publishedAt: String?): String {
        val date = publishedAt?.let { parseIso(it) } ?: return "Published"
        val elapsed = System.currentTimeMillis() - date.time
        val days = TimeUnit.MILLISECONDS.toDays(elapsed)
        return when {
            days < 1 -> "Published · today"
            days < 7 -> "Published · $days day${if (days == 1L) "" else "s"} ago"
            else -> {
                val formatter = SimpleDateFormat("MMM d, yyyy", Locale.US)
                "Published · ${formatter.format(date)}"
            }
        }
    }

    private fun parseIso(value: String): Date? {
        val patterns =
            listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
            )
        for (pattern in patterns) {
            try {
                val formatter = SimpleDateFormat(pattern, Locale.US)
                formatter.timeZone = TimeZone.getTimeZone("UTC")
                return formatter.parse(value)
            } catch (_: Exception) {
                // try next
            }
        }
        return null
    }

    private fun formatApiTime(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val parts = value.split(":")
        val hour = parts.firstOrNull()?.toIntOrNull() ?: return value
        if (hour == HOURS_PER_DAY) return EditBusinessPageHoursRow.END_OF_DAY_LABEL
        val minute = parts.getOrNull(1)?.take(2) ?: "00"
        val period = if (hour >= 12) "PM" else "AM"
        val hour12 = if (hour % 12 == 0) 12 else hour % 12
        return "$hour12:$minute $period"
    }

    private fun parseDisplayTime(value: String): String? {
        val trimmed = value.trim().uppercase(Locale.US)
        if (trimmed == EditBusinessPageHoursRow.END_OF_DAY_LABEL) return trimmed
        val formats = listOf("h:mm a", "h:mma", "HH:mm", "H:mm")
        for (format in formats) {
            try {
                val parser = SimpleDateFormat(format, Locale.US)
                val date = parser.parse(trimmed) ?: continue
                val out = SimpleDateFormat("HH:mm", Locale.US)
                return out.format(date)
            } catch (_: Exception) {
                // try next
            }
        }
        return null
    }

    private fun stripUrlScheme(value: String): String {
        var result = value.trim()
        listOf("https://", "http://").forEach { prefix ->
            if (result.lowercase(Locale.US).startsWith(prefix)) {
                result = result.drop(prefix.length)
            }
        }
        return result
    }

    private fun stripPhonePrefix(value: String): String {
        var result = value.trim()
        if (result.startsWith("+1")) {
            result = result.drop(2).trim()
        }
        return result
    }
}
