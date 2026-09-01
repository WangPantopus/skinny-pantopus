@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongParameterList",
    "LongMethod",
    "TooManyFunctions",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

/**
 * Stream A15 — shared local primitives + formatters for the Packages & Invoices
 * surfaces (G8–G13). These are stream-local (not Foundation `_shared`): the
 * designs lean on paper-card overline sections, segmented filters, steppers,
 * currency math, and a Stripe-not-connected gate that don't exist as shared
 * components. Tokens only — no hardcoded colours; on-scale spacing/radii use
 * `Spacing`/`Radii`. Functional chrome stays product sky; identity chrome uses
 * the owner pillar accent. Mirrors iOS `PackagesKit.swift`.
 */

// ─── Money & date formatting ────────────────────────────────────────────────

/** Currency / per-session math used across packages, buy, credits, invoices. */
object PackagesMoney {
    private const val CENTS_PER_UNIT = 100.0
    private const val DEFAULT_CURRENCY = "USD"

    /**
     * Format integer cents to a localised currency string (e.g. `$220.00`).
     * Unlike the shared `MoneyAndFlag.formatPrice` (which renders `0` as
     * "Free"), this always renders a currency amount so the order-summary /
     * per-session math reads `$0.00` rather than "Free".
     */
    fun format(
        cents: Int?,
        currency: String? = DEFAULT_CURRENCY,
    ): String {
        val amount = (cents ?: 0) / CENTS_PER_UNIT
        val code = currency?.takeIf { it.isNotBlank() }?.uppercase() ?: DEFAULT_CURRENCY
        return runCatching {
            NumberFormat.getCurrencyInstance(Locale.US).apply {
                this.currency = Currency.getInstance(code)
            }.format(amount)
        }.getOrElse { "%.2f %s".format(amount, code) }
    }

    /**
     * Per-session price (`total / sessions`) formatted as currency. Returns a
     * `$0.00`-style string when sessions is zero so the live math never divides
     * by zero.
     */
    fun perSession(
        totalCents: Int?,
        sessions: Int?,
        currency: String? = DEFAULT_CURRENCY,
    ): String {
        if (sessions == null || sessions <= 0) return format(0, currency)
        return format((totalCents ?: 0) / sessions, currency)
    }

    /**
     * Parse a user-typed price string ("$240.00", "240", "240.5", "240,50") to
     * cents. Decimal-aware (delegates to the shared [MoneyAndFlag.parseCents]).
     * Returns null when the field is empty / unparseable.
     */
    fun parseCents(raw: String): Int? = MoneyAndFlag.parseCents(raw)
}

/**
 * Date helpers for purchased/created timestamps. Renders in the device zone
 * (display-only timestamps, not slot reads, so no tz round-trip).
 */
object PackagesFormat {
    private val DAY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
    private val DATETIME_FMT: DateTimeFormatter =
        DateTimeFormatter.ofPattern(
            "EEE MMM d, h:mm a",
            Locale.US,
        )

    /** "Mar 12, 2027" in the device zone, or null when unparseable. */
    fun dayString(iso: String?): String? = iso?.let { parse(it)?.atZone(ZoneId.systemDefault())?.format(DAY_FMT) }

    /** "Sat Jun 14, 2:00 PM" in the device zone, or null when unparseable. */
    fun dateTimeString(iso: String?): String? = iso?.let { parse(it)?.atZone(ZoneId.systemDefault())?.format(DATETIME_FMT) }

    /** Epoch millis for an ISO timestamp (for upcoming/past comparisons), or null. */
    fun epochMillis(iso: String?): Long? = iso?.let { parse(it)?.toEpochMilli() }

    /** Tolerant ISO → [Instant]; null when unparseable. */
    fun instant(iso: String?): Instant? = iso?.let { parse(it) }

    private fun parse(iso: String): Instant? =
        runCatching { Instant.parse(iso) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()
            ?: runCatching { LocalDateTime.parse(iso).toInstant(ZoneOffset.UTC) }.getOrNull()
}

// ─── Package row formatting ─────────────────────────────────────────────────

/** "5 sessions · $220.00 · $44.00 each" — the G8 / G10 per-row subtitle math. */
fun packageSubtitle(
    sessions: Int,
    priceCents: Int?,
    currency: String?,
): String {
    val sessionLabel = "$sessions session${if (sessions == 1) "" else "s"}"
    val total = PackagesMoney.format(priceCents, currency)
    val each = PackagesMoney.perSession(priceCents, sessions, currency)
    return "$sessionLabel · $total · $each each"
}

/** "· 12 sold" beside the status chip, or null when a package has no sales. */
fun packageSoldLabel(soldCount: Int?): String? {
    val sold = soldCount ?: return null
    return if (sold > 0) "· $sold sold" else null
}

// ─── Identity gradient ──────────────────────────────────────────────────────

/**
 * A two-stop gradient derived from the owner pillar tokens (never hex) — used
 * for the owner/payer avatar discs in My Packages, Buy Package, Invoices.
 */
fun pillarGradient(pillar: SchedulingPillar): Brush =
    when (pillar) {
        SchedulingPillar.Business ->
            Brush.linearGradient(
                listOf(PantopusColors.business, PantopusColors.businessDark),
            )
        SchedulingPillar.Home ->
            Brush.linearGradient(
                listOf(PantopusColors.home, PantopusColors.homeDark),
            )
        SchedulingPillar.Personal ->
            Brush.linearGradient(
                listOf(PantopusColors.primary500, PantopusColors.primary700),
            )
    }

// ─── Top bar ────────────────────────────────────────────────────────────────

/**
 * 46dp scheduling top bar with a back chevron, centred title, and an optional
 * trailing slot. Mirrors the established scheduling chrome, kept stream-local.
 */
@Composable
fun PkgTopBar(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    trailing: @Composable () -> Unit = {},
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(46.dp)
                .background(PantopusColors.appSurface),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .align(Alignment.BottomCenter)
                    .background(PantopusColors.appBorder),
        )
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                Box(
                    modifier =
                        Modifier.size(36.dp).clip(RoundedCornerShape(Radii.md)).clickable(
                            onClickLabel = "Back",
                            onClick = onBack,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Back",
                        size = 21.dp,
                        tint = PantopusColors.appText,
                    )
                }
            } else {
                Box(modifier = Modifier.size(36.dp))
            }
            Text(
                text = title,
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier.widthIn(min = 36.dp),
                contentAlignment = Alignment.CenterEnd,
            ) { trailing() }
        }
    }
}

/** 36dp icon button for the top-bar trailing slot (the `+` / search glyph). */
@Composable
fun PkgTopBarIconButton(
    icon: PantopusIcon,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = PantopusColors.primary600,
) {
    Box(
        modifier =
            modifier.size(
                36.dp,
            ).clip(
                RoundedCornerShape(Radii.pill),
            ).clickable(onClickLabel = contentDescription, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = contentDescription,
            size = 21.dp,
            tint = tint,
        )
    }
}

// ─── Card ───────────────────────────────────────────────────────────────────

/**
 * White paper card with an optional uppercase overline header. Matches the
 * design's `Card overline=…` section primitive (radius 16, hairline border).
 */
@Composable
fun PkgCard(
    modifier: Modifier = Modifier,
    overline: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (overline != null) {
            Text(
                text = overline.uppercase(Locale.US),
                color = PantopusColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
            )
        }
        content()
    }
}

/** A plain grouped row-card (rows stacked inside a single bordered surface). */
@Composable
fun PkgRowCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 14.dp),
        content = content,
    )
}

// ─── Status chip ────────────────────────────────────────────────────────────

enum class PkgChipTone { Success, Sky, Warning, Neutral, Business }

private fun PkgChipTone.bg(): Color =
    when (this) {
        PkgChipTone.Success -> PantopusColors.successBg
        PkgChipTone.Sky -> PantopusColors.infoBg
        PkgChipTone.Warning -> PantopusColors.warningBg
        PkgChipTone.Neutral -> PantopusColors.appSurfaceSunken
        PkgChipTone.Business -> PantopusColors.businessBg
    }

private fun PkgChipTone.fg(): Color =
    when (this) {
        PkgChipTone.Success -> PantopusColors.success
        PkgChipTone.Sky -> PantopusColors.info
        PkgChipTone.Warning -> PantopusColors.warning
        PkgChipTone.Neutral -> PantopusColors.appTextSecondary
        PkgChipTone.Business -> PantopusColors.business
    }

/** Small semantic chip with a tone-driven fill (package active/archived, etc.). */
@Composable
fun PkgChip(
    text: String,
    tone: PkgChipTone,
    modifier: Modifier = Modifier,
    uppercased: Boolean = false,
) {
    Text(
        text = if (uppercased) text.uppercase(Locale.US) else text,
        color = tone.fg(),
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.bg())
                .padding(horizontal = 7.dp, vertical = 3.dp),
    )
}

// ─── Segmented control ──────────────────────────────────────────────────────

/** Inline segmented control (Active/Archived, Expiry). Pillar accent on select. */
@Composable
fun PkgSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(9.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEachIndexed { index, option ->
            val on = index == selectedIndex
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onSelect(index) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option,
                    color = if (on) accent else PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }
    }
}

// ─── Stepper ────────────────────────────────────────────────────────────────

/** +/- stepper bound to an Int with min/max clamping. */
@Composable
fun PkgStepper(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    range: IntRange = 1..1000,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .alpha(if (enabled) 1f else 0.5f),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepButton(PantopusIcon.Minus, "Decrease", enabled && value > range.first) {
            onValueChange((value - 1).coerceAtLeast(range.first))
        }
        Text(
            text = "$value",
            color = PantopusColors.appText,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(min = 44.dp),
        )
        StepButton(PantopusIcon.Plus, "Increase", enabled && value < range.last) {
            onValueChange((value + 1).coerceAtMost(range.last))
        }
    }
}

@Composable
private fun StepButton(
    icon: PantopusIcon,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier.size(
                36.dp,
            ).clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = label,
            size = 16.dp,
            tint = if (enabled) PantopusColors.appText else PantopusColors.appTextMuted,
        )
    }
}

// ─── Toggle row ─────────────────────────────────────────────────────────────

@Composable
fun PkgToggleRow(
    icon: PantopusIcon,
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    sub: String? = null,
    accent: Color = PantopusColors.primary600,
) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 44.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier.size(
                    32.dp,
                ).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (sub != null) {
                Text(text = sub, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appSurface,
                    checkedTrackColor = accent,
                    uncheckedThumbColor = PantopusColors.appSurface,
                    uncheckedTrackColor = PantopusColors.appBorderStrong,
                    uncheckedBorderColor = PantopusColors.appBorderStrong,
                ),
        )
    }
}

// ─── Text fields ────────────────────────────────────────────────────────────

/** Labelled single-line text input (1.5dp border). `error` paints it red. */
@Composable
fun PkgTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
    error: Boolean = false,
    helper: String? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label != null) {
            Text(
                text = label,
                color = PantopusColors.appTextStrong,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        1.5.dp,
                        if (error) PantopusColors.error else PantopusColors.appBorder,
                        RoundedCornerShape(Radii.md),
                    )
                    .padding(horizontal = 11.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                textStyle = TextStyle(color = PantopusColors.appText, fontSize = 13.sp),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(placeholder, color = PantopusColors.appTextMuted, fontSize = 13.sp)
                    }
                    inner()
                },
            )
        }
        if (helper != null) {
            Text(
                text = helper,
                color = if (error) PantopusColors.error else PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
            )
        }
    }
}

/** Multiline counterpart to [PkgTextField] (min 48dp, 1.5dp border). */
@Composable
fun PkgMultilineField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label != null) {
            Text(
                text = label,
                color = PantopusColors.appTextStrong,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 11.dp, vertical = 9.dp),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = PantopusColors.appText, fontSize = 13.sp),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(placeholder, color = PantopusColors.appTextMuted, fontSize = 13.sp)
                    }
                    inner()
                },
            )
        }
    }
}

// ─── Note callout ───────────────────────────────────────────────────────────

enum class PkgNoteTone { Info, Warning, Error }

private fun PkgNoteTone.bg(): Color =
    when (this) {
        PkgNoteTone.Info -> PantopusColors.infoBg
        PkgNoteTone.Warning -> PantopusColors.warningBg
        PkgNoteTone.Error -> PantopusColors.errorBg
    }

private fun PkgNoteTone.fg(): Color =
    when (this) {
        PkgNoteTone.Info -> PantopusColors.info
        PkgNoteTone.Warning -> PantopusColors.warning
        PkgNoteTone.Error -> PantopusColors.error
    }

@Composable
fun PkgNote(
    tone: PkgNoteTone,
    icon: PantopusIcon,
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(tone.bg())
                .border(1.dp, tone.fg().copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = tone.fg())
        Text(
            text = text,
            color = tone.fg(),
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 16.sp,
            modifier = Modifier.weight(1f),
        )
    }
}

// ─── Buttons ────────────────────────────────────────────────────────────────

/** Full-width primary CTA (sky) with optional leading icon + in-flight spinner. */
@Composable
fun PkgPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .alpha(if (enabled && !loading) 1f else 0.45f)
                .clickable(enabled = enabled && !loading, onClickLabel = label, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
        } else {
            if (icon != null) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Box(modifier = Modifier.size(8.dp))
            }
            Text(
                text = label,
                color = PantopusColors.appTextInverse,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Outline / ghost button used in docks and inline actions. */
@Composable
fun PkgGhostButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .alpha(if (enabled) 1f else 0.45f)
                .clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appText,
            )
            Box(modifier = Modifier.size(7.dp))
        }
        Text(
            text = label,
            color = PantopusColors.appText,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

// ─── Sticky dock ────────────────────────────────────────────────────────────

/** Bottom dock (top hairline) hosting one or more action buttons. */
@Composable
fun PkgDock(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier.fillMaxWidth().padding(
                    start = 14.dp,
                    end = 14.dp,
                    top = 10.dp,
                    bottom = 22.dp,
                ),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) { content() }
    }
}

// ─── Stripe-not-connected gate ──────────────────────────────────────────────

/**
 * Centred "Connect payments" gate (Invoices frame 5) — shown when the owner
 * hasn't connected Stripe. CTA deep-links to Payments setup (A14).
 */
@Composable
fun PkgStripeGate(
    icon: PantopusIcon,
    title: String,
    message: String,
    onConnect: () -> Unit,
    modifier: Modifier = Modifier,
    ctaLabel: String = "Connect",
) {
    Box(
        modifier =
            modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.warningBg)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xl))
                    .padding(horizontal = Spacing.s4, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier =
                    Modifier.size(
                        48.dp,
                    ).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 23.dp,
                    tint = PantopusColors.warning,
                )
            }
            Text(
                text = title,
                color = PantopusColors.warning,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Text(
                text = message,
                color = PantopusColors.warning.copy(alpha = 0.9f),
                fontSize = 11.5.sp,
                textAlign = TextAlign.Center,
                lineHeight = 16.sp,
            )
            Row(
                modifier =
                    Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable(onClickLabel = ctaLabel, onClick = onConnect)
                        .padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ExternalLink,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = ctaLabel,
                    color = PantopusColors.appTextInverse,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

// ─── Coming soon (paid flag off) ────────────────────────────────────────────

/**
 * Calm gate shown when paid scheduling is off — priced surfaces (packages,
 * invoices) hide behind the flag + Stripe TEST mode.
 */
@Composable
fun PkgComingSoon(
    title: String,
    modifier: Modifier = Modifier,
    message: String = "Paid scheduling is coming soon.",
) {
    Column(
        modifier =
            modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).padding(horizontal = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier.size(
                    72.dp,
                ).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 30.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.business,
            )
        }
        Box(modifier = Modifier.height(Spacing.s4))
        Text(
            text = title,
            color = PantopusColors.appText,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Box(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            color = PantopusColors.appTextSecondary,
            fontSize = 13.5.sp,
            textAlign = TextAlign.Center,
            lineHeight = 19.sp,
        )
    }
}

// ─── Toast capsule ──────────────────────────────────────────────────────────

/**
 * Dark pill toast (e.g. "Invoice sent", save errors) shown as a top overlay.
 * Optional leading [icon] (success-tinted check by default).
 */
@Composable
fun PkgToastCapsule(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = PantopusIcon.Check,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 3f,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = text,
            color = PantopusColors.appTextInverse,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// Shared monospace family for invoice references / receipt rows.
internal val MonoFont = FontFamily.Monospace
