@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "ReturnCount", "LongMethod")

package app.pantopus.android.ui.screens.business_profile

import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemDto
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessLocationDto
import app.pantopus.android.data.api.models.businesses.BusinessProfileDetailDto
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.BusinessUserDetailDto
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.profile.PublicProfileReview
import app.pantopus.android.ui.screens.saved_places.PendingSavePlace
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

/**
 * Pure projection from the business detail / public / public-profile DTOs onto
 * the single-scroll [BusinessProfileContent] the screen renders (A10.6).
 *
 * Extracted from `BusinessProfileViewModel` so the owner dashboard (A10.7) can
 * build the exact same public render for its "preview as neighbor" frame and
 * its owner-frame shared sections, without duplicating the projection. The
 * view-model keeps a thin `computeOpenState` wrapper for its unit tests.
 */
object BusinessProfileMapper {
    fun build(
        detail: BusinessDetailResponse,
        publicResponse: BusinessPublicResponse?,
        reviewsResponse: PublicProfileDto?,
        now: LocalDateTime = LocalDateTime.now(),
    ): BusinessProfileContent {
        val business = detail.business
        val profile = detail.profile
        val primaryLocation =
            profile?.primaryLocation
                ?: detail.locations.firstOrNull { it.isPrimary == true }
                ?: detail.locations.firstOrNull()

        val weekday = now.dayOfWeek.value % 7

        // Newly claimed = no track record yet (no reviews, no jobs).
        val reviewCount = business.reviewCount ?: reviewsResponse?.reviewCount ?: 0
        val jobs = business.gigsCompleted ?: reviewsResponse?.gigsCompleted ?: 0
        val isNewlyClaimed = reviewCount == 0 && jobs == 0

        val header =
            BusinessProfileHeader(
                displayName =
                    business.name?.takeIf { it.isNotEmpty() }
                        ?: business.username?.let { "@$it" }
                        ?: "Business",
                handle = business.username,
                locality = locality(business, primaryLocation),
                isVerified = isVerified(business, profile),
                logoIcon = null,
            )

        val scoped = scopedHours(publicResponse?.hours.orEmpty(), primaryLocation?.id)
        val status = computeOpenState(scoped, now)
        val hours = buildHours(scoped, weekday)

        val about =
            profile?.description?.takeIf { it.isNotEmpty() }
                ?: business.bio?.takeIf { it.isNotEmpty() }
                ?: business.tagline?.takeIf { it.isNotEmpty() }

        val serviceArea = buildServiceArea(primaryLocation, profile)

        return BusinessProfileContent(
            businessId = business.id,
            header = header,
            stats = buildStats(business, reviewsResponse, isNewlyClaimed),
            categories = buildCategories(profile?.categories ?: emptyList()),
            about = about,
            aboutChips = buildAboutChips(profile),
            status = status,
            hours = hours,
            serviceArea = serviceArea,
            services = (publicResponse?.catalog ?: emptyList()).map { buildService(it) },
            gallery = emptyList(),
            reviewSummary = buildReviewSummary(business, reviewsResponse),
            reviews = (reviewsResponse?.reviews ?: emptyList()).map { buildReview(it) },
            dock = buildDock(status, isNewlyClaimed),
            savedPlace = savedPlace(business, header.displayName, primaryLocation, serviceArea, detail.access?.isOwner == true),
            isNewlyClaimed = isNewlyClaimed,
            phoneNumber = profile?.publicPhone ?: primaryLocation?.phone,
            websiteUrl = normalizedWebsite(profile?.website),
            viewerIsOwner = detail.access?.isOwner == true,
        )
    }

    private fun isVerified(
        business: BusinessUserDetailDto,
        profile: BusinessProfileDetailDto?,
    ): Boolean {
        business.verified?.let { return it }
        return profile?.verificationStatus?.let { it != "unverified" } == true
    }

    private fun locality(
        business: BusinessUserDetailDto,
        location: BusinessLocationDto?,
    ): String? {
        val locCity = location?.city
        val locState = location?.state
        if (!locCity.isNullOrEmpty() && !locState.isNullOrEmpty()) return "$locCity, $locState"
        val bizCity = business.city
        val bizState = business.state
        if (!bizCity.isNullOrEmpty() && !bizState.isNullOrEmpty()) return "$bizCity, $bizState"
        return bizCity ?: bizState
    }

    // MARK: Stats

    private fun buildStats(
        business: BusinessUserDetailDto,
        reviewsResponse: PublicProfileDto?,
        isNewlyClaimed: Boolean,
    ): List<BusinessStatCell> {
        val rating = business.averageRating ?: reviewsResponse?.averageRating
        val reviewCount = business.reviewCount ?: reviewsResponse?.reviewCount ?: 0
        val jobs = business.gigsCompleted ?: reviewsResponse?.gigsCompleted ?: 0
        val followers = business.followersCount ?: reviewsResponse?.followersCount ?: 0

        val ratingCell =
            if (rating != null && reviewCount > 0) {
                BusinessStatCell(
                    id = "rating",
                    value = String.format(Locale.US, "%.1f", rating),
                    label = "$reviewCount reviews",
                    leadingStar = true,
                    tint = BusinessStatTint.Star,
                )
            } else {
                BusinessStatCell(
                    id = "rating",
                    value = "—",
                    label = "No reviews yet",
                    leadingStar = true,
                    tint = BusinessStatTint.Muted,
                )
            }

        val jobsCell = BusinessStatCell(id = "jobs", value = "$jobs", label = "Jobs done")

        val thirdCell =
            if (isNewlyClaimed) {
                BusinessStatCell(id = "new", value = "New", label = "On Pantopus", tint = BusinessStatTint.Business)
            } else {
                BusinessStatCell(id = "followers", value = formatStat(followers), label = "Followers")
            }

        return listOf(ratingCell, jobsCell, thirdCell)
    }

    private fun formatStat(value: Int): String {
        if (value < 1_000) return value.toString()
        val truncated = value / 100.0 / 10.0
        return if (truncated == truncated.toInt().toDouble()) {
            "${truncated.toInt()}K"
        } else {
            String.format(Locale.US, "%.1fK", truncated)
        }
    }

    // MARK: Categories

    private fun buildCategories(categories: List<String>): List<BusinessCategoryChip> =
        categories.take(4).mapIndexed { index, name ->
            BusinessCategoryChip(
                id = name,
                label = name,
                icon = categoryIcon(name),
                accent = if (index == 0) categoryAccent(name) else BusinessCategoryAccent.Neutral,
            )
        }

    private fun categoryIcon(name: String): PantopusIcon {
        val lower = name.lowercase(Locale.US)
        return when {
            lower.contains("clean") -> PantopusIcon.Sparkles
            lower.contains("handy") || lower.contains("repair") || lower.contains("fix") -> PantopusIcon.Wrench
            lower.contains("dog") -> PantopusIcon.Dog
            lower.contains("pet") || lower.contains("cat") -> PantopusIcon.PawPrint
            lower.contains("move") -> PantopusIcon.Package
            lower.contains("eco") || lower.contains("green") -> PantopusIcon.Leaf
            lower.contains("home") || lower.contains("apartment") || lower.contains("house") -> PantopusIcon.Home
            else -> PantopusIcon.Tag
        }
    }

    private fun categoryAccent(name: String): BusinessCategoryAccent {
        val lower = name.lowercase(Locale.US)
        return when {
            lower.contains("clean") -> BusinessCategoryAccent.Cleaning
            lower.contains("handy") || lower.contains("repair") || lower.contains("fix") ->
                BusinessCategoryAccent.Handyman
            lower.contains("pet") || lower.contains("dog") || lower.contains("cat") -> BusinessCategoryAccent.Pet
            else -> BusinessCategoryAccent.Business
        }
    }

    // MARK: About chips

    private fun buildAboutChips(profile: BusinessProfileDetailDto?): List<BusinessAboutChip> {
        val chips = mutableListOf<BusinessAboutChip>()
        profile?.employeeCount?.takeIf { it.isNotEmpty() }?.let {
            chips += BusinessAboutChip("team", "$it team members", PantopusIcon.Users)
        }
        profile?.foundedYear?.let {
            chips += BusinessAboutChip("since", "Since $it", PantopusIcon.CalendarCheck)
        }
        return chips
    }

    // MARK: Hours + open/closed

    private fun scopedHours(
        rows: List<BusinessHoursDto>,
        primaryLocationId: String?,
    ): List<BusinessHoursDto> {
        if (primaryLocationId == null) return rows
        val scoped = rows.filter { it.locationId == primaryLocationId }
        return scoped.ifEmpty { rows }
    }

    private fun buildHours(
        rows: List<BusinessHoursDto>,
        weekday: Int,
    ): List<BusinessHoursRow> =
        rows.sortedBy { it.dayOfWeek }.map { row ->
            val dayIndex = row.dayOfWeek.coerceIn(0, 6)
            val isClosed = row.isClosed == true
            val time =
                when {
                    isClosed -> "Closed"
                    row.openTime != null && row.closeTime != null ->
                        "${formatTime(row.openTime)} – ${formatTime(row.closeTime)}"
                    else -> "—"
                }
            BusinessHoursRow(
                id = row.id ?: "${row.locationId.orEmpty()}-${row.dayOfWeek}",
                dayLabel = fullDayName(dayIndex),
                timeLabel = time,
                isClosed = isClosed,
                isToday = dayIndex == weekday,
            )
        }

    /** Pure, testable open/closed projection — `now` is injected. */
    fun computeOpenState(
        rows: List<BusinessHoursDto>,
        now: LocalDateTime,
    ): BusinessOpenState? {
        if (rows.isEmpty()) return null
        val weekday = now.dayOfWeek.value % 7
        val minutesNow = now.hour * 60 + now.minute
        val byDay = rows.groupBy { it.dayOfWeek.coerceIn(0, 6) }

        val today = byDay[weekday]?.firstOrNull()
        if (today != null) {
            val state = todayOpenState(today, minutesNow)
            if (state != null) return state
        }
        val next = nextOpening(byDay, weekday)
        if (next != null) return next

        return BusinessOpenState(false, "Closed", "Hours vary", "Closed")
    }

    private fun todayOpenState(
        today: BusinessHoursDto,
        minutesNow: Int,
    ): BusinessOpenState? {
        if (today.isClosed == true) return null
        val openM = minutes(today.openTime) ?: return null
        val closeM = minutes(today.closeTime) ?: return null
        if (minutesNow in openM until closeM) {
            return BusinessOpenState(
                isOpen = true,
                statusLabel = "Open now",
                statusDetail = "Closes ${formatTime(today.closeTime.orEmpty())}",
                chipLabel = "Open now",
            )
        }
        if (minutesNow < openM) {
            return BusinessOpenState(
                isOpen = false,
                statusLabel = "Closed now",
                statusDetail = "Opens today at ${formatTime(today.openTime.orEmpty())}",
                chipLabel = "Closed · opens ${formatTime(today.openTime.orEmpty())}",
            )
        }
        return null
    }

    private fun nextOpening(
        byDay: Map<Int, List<BusinessHoursDto>>,
        weekday: Int,
    ): BusinessOpenState? {
        for (offset in 1..7) {
            val day = (weekday + offset) % 7
            val open = openTimeFor(byDay[day]?.firstOrNull())
            if (open != null) {
                val whenLabel = if (offset == 1) "tomorrow" else fullDayName(day)
                return BusinessOpenState(
                    isOpen = false,
                    statusLabel = "Closed now",
                    statusDetail = "Opens $whenLabel at ${formatTime(open)}",
                    chipLabel = "Closed · opens ${formatTime(open)}",
                )
            }
        }
        return null
    }

    private fun openTimeFor(row: BusinessHoursDto?): String? {
        val open = row?.openTime ?: return null
        return open.takeUnless { row.isClosed == true || minutes(it) == null }
    }

    private fun minutes(raw: String?): Int? {
        if (raw == null) return null
        val parts = raw.split(":")
        if (parts.size < 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null
        return hour * 60 + minute
    }

    private fun formatTime(raw: String): String {
        val parts = raw.split(":")
        if (parts.size < 2) return raw
        val hour = parts[0].toIntOrNull() ?: return raw
        val minute = parts[1].toIntOrNull() ?: return raw
        val suffix = if (hour >= 12) "PM" else "AM"
        val normalised = if (hour % 12 == 0) 12 else hour % 12
        return if (minute == 0) "$normalised $suffix" else String.format(Locale.US, "%d:%02d %s", normalised, minute, suffix)
    }

    private fun fullDayName(index: Int): String {
        val names = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
        return names[index.coerceIn(0, 6)]
    }

    // MARK: Service area

    private fun buildServiceArea(
        location: BusinessLocationDto?,
        profile: BusinessProfileDetailDto?,
    ): BusinessServiceArea? {
        val serviceAreaText = profile?.serviceArea?.formattedLabel()
        if (location == null) {
            return serviceAreaText?.let {
                BusinessServiceArea("Service area", null, it, null, null)
            }
        }
        val cityState =
            listOfNotNull(
                location.city?.takeIf { it.isNotEmpty() },
                location.state?.takeIf { it.isNotEmpty() },
            ).joinToString(", ")
        val title = cityState.ifEmpty { location.address ?: "Service area" }
        val detail = if (!location.address.isNullOrEmpty() && cityState.isNotEmpty()) location.address else null
        return BusinessServiceArea(
            title = title,
            detail = detail,
            serviceArea = serviceAreaText,
            latitude = location.location?.lat,
            longitude = location.location?.lng,
        )
    }

    private fun savedPlace(
        business: BusinessUserDetailDto,
        label: String,
        location: BusinessLocationDto?,
        serviceArea: BusinessServiceArea?,
        viewerIsOwner: Boolean,
    ): PendingSavePlace? {
        val latitude = serviceArea?.latitude ?: return null
        val longitude = serviceArea.longitude ?: return null
        if (viewerIsOwner) return null
        return PendingSavePlace(
            label = label,
            latitude = latitude,
            longitude = longitude,
            city = location?.city ?: business.city,
            state = location?.state ?: business.state,
            sourceId = business.id,
        )
    }

    // MARK: Services

    private fun buildService(item: BusinessCatalogItemDto): BusinessServiceRow =
        BusinessServiceRow(
            id = item.id,
            name = item.name,
            detail = item.description,
            priceLabel = priceLabel(item),
            unit = null,
            icon = PantopusIcon.Tag,
        )

    private fun priceLabel(item: BusinessCatalogItemDto): String {
        val currency = item.currency?.uppercase(Locale.US) ?: "USD"
        val symbol = if (currency == "USD") "$" else ""
        val formatDollars: (Int) -> String = { cents ->
            val value = cents / 100.0
            if (value == value.toInt().toDouble()) {
                String.format(Locale.US, "%s%d", symbol, value.toInt())
            } else {
                String.format(Locale.US, "%s%.2f", symbol, value)
            }
        }
        val min = item.priceCents
        val max = item.priceMaxCents
        return when {
            min != null && max != null && max > min -> "${formatDollars(min)} – ${formatDollars(max)}"
            min != null -> {
                val unit = item.priceUnit?.let { "/$it" } ?: ""
                "${formatDollars(min)}$unit"
            }
            item.kind == "donation" -> "Suggested"
            else -> "Contact"
        }
    }

    // MARK: Reviews

    private fun buildReviewSummary(
        business: BusinessUserDetailDto,
        reviewsResponse: PublicProfileDto?,
    ): BusinessReviewSummary? {
        val count = business.reviewCount ?: reviewsResponse?.reviewCount ?: 0
        if (count <= 0) return null
        val average = business.averageRating ?: reviewsResponse?.averageRating ?: 0.0
        return BusinessReviewSummary(average = average, count = count, distribution = emptyList())
    }

    private fun buildReview(review: PublicProfileReview): BusinessReviewCard =
        BusinessReviewCard(
            id = review.id ?: UUID.randomUUID().toString(),
            reviewerName = review.reviewerName ?: "Anonymous",
            reviewerAvatarUrl = review.reviewerAvatar,
            rating = review.rating.coerceIn(0, 5),
            body = review.content.orEmpty(),
            timestamp = relativeTimestamp(review.createdAt),
            verified = false,
        )

    private fun relativeTimestamp(iso: String?): String {
        if (iso.isNullOrEmpty()) return ""
        val instant =
            try {
                Instant.parse(iso)
            } catch (_: Throwable) {
                return ""
            }
        val seconds = Duration.between(instant, Instant.now()).seconds
        return when {
            seconds < 60 -> "Just now"
            seconds < 3_600 -> "${seconds / 60}m ago"
            seconds < 86_400 -> "${seconds / 3_600}h ago"
            seconds < 604_800 -> "${seconds / 86_400}d ago"
            else ->
                instant.atZone(ZoneId.systemDefault()).toLocalDate()
                    .format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
        }
    }

    // MARK: Dock

    private fun buildDock(
        status: BusinessOpenState?,
        isNewlyClaimed: Boolean,
    ): BusinessActionDock {
        val isClosed = status?.isOpen == false
        val secondary =
            if (isNewlyClaimed || isClosed) BusinessActionDock.Secondary.Call else BusinessActionDock.Secondary.Book
        val note = if (isClosed) "Closed now — messages answered when they reopen" else null
        return BusinessActionDock(secondary = secondary, note = note)
    }

    // MARK: Misc

    private fun normalizedWebsite(raw: String?): String? {
        if (raw.isNullOrEmpty()) return null
        return if (raw.startsWith("http://", true) || raw.startsWith("https://", true)) raw else "https://$raw"
    }
}
