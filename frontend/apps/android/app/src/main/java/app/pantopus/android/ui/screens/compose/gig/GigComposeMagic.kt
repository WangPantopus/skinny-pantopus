@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.compose.gig

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// MARK: - A12.8 Entity highlights

/**
 * A12.8 — pure highlight extraction for the describe field. Returns the
 * (inclusive) character ranges that get the magic span treatment once a
 * draft has landed:
 *  (a) $-amounts and numbers near "$" / "hour",
 *  (b) day / time words (Saturday, tomorrow, morning, …),
 *  (c) keywords matching the detected category.
 * Overlapping ranges are merged. Shared by [MagicHighlightTransformation]
 * and unit tests.
 */
fun magicHighlightRanges(
    text: String,
    detected: GigComposeCategory?,
): List<IntRange> {
    if (text.isEmpty()) return emptyList()
    val ranges = mutableListOf<IntRange>()
    MONEY_REGEX.findAll(text).forEach { ranges.add(it.range) }
    HOURS_REGEX.findAll(text).forEach { ranges.add(it.range) }
    DAY_TIME_REGEX.findAll(text).forEach { ranges.add(it.range) }
    detected?.let { category ->
        val lower = text.lowercase()
        magicCategoryKeywords(category).forEach { keyword ->
            var index = lower.indexOf(keyword)
            while (index >= 0) {
                ranges.add(index until index + keyword.length)
                index = lower.indexOf(keyword, index + 1)
            }
        }
    }
    return mergeRanges(ranges)
}

private val MONEY_REGEX = Regex("""\$\s?\d+(?:\.\d+)?""")
private val HOURS_REGEX = Regex("""\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b""", RegexOption.IGNORE_CASE)
private val DAY_TIME_REGEX =
    Regex(
        """\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|""" +
            """today|tomorrow|tonight|morning|afternoon|evening|weekend|noon|asap)\b""",
        RegexOption.IGNORE_CASE,
    )

/** Keywords the highlight pass marks for a detected category (mirrors [GigComposeViewModel.detectArchetype]). */
internal fun magicCategoryKeywords(category: GigComposeCategory): List<String> =
    when (category) {
        GigComposeCategory.Moving -> listOf("move", "moving", "haul", "u-haul", "load boxes")
        GigComposeCategory.Cleaning -> listOf("clean", "tidy", "scrub", "vacuum", "mop")
        GigComposeCategory.Handyman ->
            listOf(
                "assemble", "ikea", "furniture", "shelf", "shelves", "mount", "drill",
                "fix", "repair", "install", "handy", "patch", "drywall",
            )
        GigComposeCategory.PetCare -> listOf("dog", "cat", "pet", "puppy", "litter", "groom", "walk")
        GigComposeCategory.ChildCare -> listOf("babysit", "nanny", "kids", "child", "daycare")
        GigComposeCategory.Tutoring -> listOf("tutor", "lesson", "math", "homework", "test prep", "teach")
        GigComposeCategory.Delivery -> listOf("deliver", "pickup", "pick up", "drop off", "errand", "courier")
        GigComposeCategory.Tech -> listOf("wifi", "wi-fi", "computer", "laptop", "printer", "router", "troubleshoot", "setup")
        GigComposeCategory.Other -> emptyList()
    }

/** Merge overlapping / adjacent inclusive ranges, sorted by start. */
internal fun mergeRanges(ranges: List<IntRange>): List<IntRange> {
    if (ranges.isEmpty()) return emptyList()
    val sorted = ranges.sortedBy { it.first }
    val merged = mutableListOf(sorted.first())
    for (range in sorted.drop(1)) {
        val last = merged.last()
        if (range.first <= last.last + 1) {
            if (range.last > last.last) merged[merged.lastIndex] = last.first..range.last
        } else {
            merged.add(range)
        }
    }
    return merged
}

/**
 * A12.8 — paints [ranges] with the magic span (magicBg background, magic
 * colour, SemiBold). Text content is unchanged so offsets map 1:1.
 */
internal class MagicHighlightTransformation(
    private val ranges: List<IntRange>,
    private val style: SpanStyle,
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val builder = AnnotatedString.Builder(text)
        ranges.forEach { range ->
            if (range.first < text.length) {
                builder.addStyle(style, range.first, minOf(range.last + 1, text.length))
            }
        }
        return TransformedText(builder.toAnnotatedString(), OffsetMapping.Identity)
    }
}

// MARK: - Module prompts (LIVE)

/** One module-prompt row in the "TASK DETAILS" card. [id] ∈ when/where/effort/photos/budget. */
data class GigModulePrompt(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val value: String,
    val isFilled: Boolean,
)

/**
 * A12.8 — live module prompts derived from the form: When ← schedule,
 * Where ← location, Effort ← estimatedHours, Photos ← photoIds, Budget ←
 * budget fields. Empty until an archetype is detected.
 */
fun gigMagicModulePrompts(form: GigComposeFormState): List<GigModulePrompt> {
    if (form.detectedArchetype == null && form.category == null) return emptyList()
    val whenFilled =
        form.scheduleType != null &&
            (form.scheduleType != GigComposeScheduleType.OneTime || form.scheduledStartISO != null)
    val whereFilled =
        form.locationMode != null &&
            (form.locationMode != GigComposeLocationMode.APlace || form.placeAddress.isComplete)
    val effortFilled = form.estimatedHours.isNotBlank()
    val photosFilled = form.photoIds.isNotEmpty()
    val budgetFilled =
        when (form.budgetType) {
            null -> false
            GigComposeBudgetType.Offers -> true
            else -> form.budgetMin.isNotBlank()
        }
    return listOf(
        GigModulePrompt(
            id = "when",
            icon = PantopusIcon.Calendar,
            label = "When",
            value = if (whenFilled) modulePromptWhenValue(form) else "Add a time",
            isFilled = whenFilled,
        ),
        GigModulePrompt(
            id = "where",
            icon = PantopusIcon.MapPin,
            label = "Where",
            value = if (whereFilled) modulePromptWhereValue(form) else "Add a location",
            isFilled = whereFilled,
        ),
        GigModulePrompt(
            id = "effort",
            icon = PantopusIcon.Timer,
            label = "Effort",
            value = if (effortFilled) "~${form.estimatedHours} hours" else "Add an estimate",
            isFilled = effortFilled,
        ),
        GigModulePrompt(
            id = "photos",
            icon = PantopusIcon.Camera,
            label = "Photos",
            value =
                when (form.photoIds.size) {
                    0 -> "Recommended for better bids"
                    1 -> "1 photo"
                    else -> "${form.photoIds.size} photos"
                },
            isFilled = photosFilled,
        ),
        GigModulePrompt(
            id = "budget",
            icon = PantopusIcon.Wallet,
            label = "Budget",
            value = if (budgetFilled) modulePromptBudgetValue(form) else "Set a budget",
            isFilled = budgetFilled,
        ),
    )
}

private fun modulePromptWhenValue(form: GigComposeFormState): String =
    when (form.scheduleType) {
        GigComposeScheduleType.OneTime -> form.scheduledStartISO?.let { "Scheduled" } ?: "One-time"
        GigComposeScheduleType.Recurring -> "Recurring"
        GigComposeScheduleType.Flexible -> "Flexible"
        null -> "Add a time"
    }

private fun modulePromptWhereValue(form: GigComposeFormState): String =
    when (form.locationMode) {
        GigComposeLocationMode.YourAddress -> "Your saved address"
        GigComposeLocationMode.Virtual -> "Remote / Online"
        GigComposeLocationMode.APlace -> form.placeAddress.line1.ifBlank { "A place" }
        null -> "Add a location"
    }

private fun modulePromptBudgetValue(form: GigComposeFormState): String =
    when (form.budgetType) {
        GigComposeBudgetType.Offers -> "Open to bids"
        GigComposeBudgetType.Hourly -> "$${form.budgetMin}/hr"
        GigComposeBudgetType.Fixed ->
            if (form.budgetMax.isNotBlank()) "$${form.budgetMin}–$${form.budgetMax}" else "$${form.budgetMin}"
        null -> "Set a budget"
    }

/** Module-prompt row id → the wizard step that owns the missing detail. */
fun stepForModulePrompt(id: String): GigComposeStep =
    when (id) {
        "effort", "budget" -> GigComposeStep.BudgetMode
        else -> GigComposeStep.FillGaps
    }

// MARK: - Category accent helpers

/** A12.8 manual path renders the eight concrete archetypes; `Other` remains valid for restored state. */
val gigComposeManualPickerCategories: List<GigComposeCategory> =
    GigComposeCategory.entries.filter { it != GigComposeCategory.Other }

val GigComposeCategory.tileIcon: PantopusIcon
    get() =
        when (this) {
            GigComposeCategory.Handyman -> PantopusIcon.Hammer
            GigComposeCategory.Cleaning -> PantopusIcon.Sparkles
            GigComposeCategory.Moving -> PantopusIcon.Package
            GigComposeCategory.PetCare -> PantopusIcon.PawPrint
            GigComposeCategory.ChildCare -> PantopusIcon.Heart
            GigComposeCategory.Tutoring -> PantopusIcon.Lightbulb
            GigComposeCategory.Delivery -> PantopusIcon.Send
            GigComposeCategory.Tech -> PantopusIcon.Laptop
            GigComposeCategory.Other -> PantopusIcon.MoreHorizontal
        }

val GigComposeCategory.accent: Color
    get() =
        when (this) {
            GigComposeCategory.Handyman -> PantopusColors.handyman
            GigComposeCategory.Cleaning -> PantopusColors.cleaning
            GigComposeCategory.Moving -> PantopusColors.moving
            GigComposeCategory.PetCare -> PantopusColors.petCare
            GigComposeCategory.ChildCare -> PantopusColors.childCare
            GigComposeCategory.Tutoring -> PantopusColors.tutoring
            GigComposeCategory.Delivery -> PantopusColors.delivery
            GigComposeCategory.Tech -> PantopusColors.tech
            GigComposeCategory.Other -> PantopusColors.appTextSecondary
        }

val GigComposeCategory.examples: String
    get() =
        when (this) {
            GigComposeCategory.Handyman -> "Assembly · repairs · install"
            GigComposeCategory.Cleaning -> "Home · move-out · windows"
            GigComposeCategory.Moving -> "Boxes · furniture · loading"
            GigComposeCategory.PetCare -> "Walks · sitting · grooming"
            GigComposeCategory.ChildCare -> "Sitting · pickups · tutoring"
            GigComposeCategory.Tutoring -> "Math · music · test prep"
            GigComposeCategory.Delivery -> "Pickups · drops · errands"
            GigComposeCategory.Tech -> "Wifi · setup · troubleshoot"
            GigComposeCategory.Other -> "Anything else"
        }

/** Humanise a backend `task_archetype` key: "home_service" → "Home service". */
fun humanizeArchetype(raw: String?): String? =
    raw
        ?.replace('_', ' ')
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.replaceFirstChar { it.uppercaseChar() }

val GigComposeEngagementMode.label: String
    get() =
        when (this) {
            GigComposeEngagementMode.OneTime -> "One-time"
            GigComposeEngagementMode.Recurring -> "Recurring"
            GigComposeEngagementMode.OpenEnded -> "Open-ended"
        }

val GigComposeEngagementMode.subcopy: String
    get() =
        when (this) {
            GigComposeEngagementMode.OneTime -> "Done once"
            GigComposeEngagementMode.Recurring -> "Weekly +"
            GigComposeEngagementMode.OpenEnded -> "Until done"
        }

val GigComposeEngagementMode.icon: PantopusIcon
    get() =
        when (this) {
            GigComposeEngagementMode.OneTime -> PantopusIcon.CircleDot
            GigComposeEngagementMode.Recurring -> PantopusIcon.ArrowsRepeat
            GigComposeEngagementMode.OpenEnded -> PantopusIcon.Infinity
        }

/** Canonical `gigCompose.engagement_<mode>` suffix (mirrored on iOS). */
val GigComposeEngagementMode.tagSuffix: String
    get() =
        when (this) {
            GigComposeEngagementMode.OneTime -> "oneTime"
            GigComposeEngagementMode.Recurring -> "recurring"
            GigComposeEngagementMode.OpenEnded -> "openEnded"
        }

// MARK: - Step 1A: Magic describe

@Composable
internal fun MagicDescribeStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
    isRecording: Boolean = false,
    onMicTap: () -> Unit = {},
    onImageTap: () -> Unit = {},
    onAttachTap: () -> Unit = {},
) {
    val focusManager = LocalFocusManager.current
    ComposeIdentityChip(state, vm)
    HeadlineBlock("What do you need done?")
    SubcopyBlock("Describe it in your own words. Pantopus figures out the category, fills in the details, and posts it for bids.")
    MagicDescribeCard(
        text = state.form.describeText,
        onTextChange = vm::setDescribeText,
        detected = state.form.detectedArchetype,
        isParsed = state.form.detectedArchetype != null,
        isParsing = state.isParsingDraft,
        isRecording = isRecording,
        isTranscribing = state.isTranscribing,
        onMicTap = onMicTap,
        onImageTap = onImageTap,
        onAttachTap = onAttachTap,
        onDismissKeyboard = focusManager::clearFocus,
    )
    // A12.8 — empty describe text → smart-template chip row.
    if (state.form.describeText.isEmpty() && state.templates.isNotEmpty()) {
        TemplateChipRow(templates = state.templates, onTap = vm::applyTemplate)
    }
    // P0.1 — backend follow-up question rides under the describe field.
    state.clarifyingQuestion?.let { question ->
        ClarifyingQuestionHint(question)
    }
    state.form.detectedArchetype?.let { archetype ->
        DetectedCategoryRow(
            archetype = archetype,
            taskArchetype = state.form.taskArchetype,
            onChange = {
                focusManager.clearFocus()
                vm.setComposeMode(ComposeMode.Manual)
            },
        )
        ModulePromptsCard(
            prompts = gigMagicModulePrompts(state.form),
            onPromptTap = { id -> vm.jumpToStep(stepForModulePrompt(id)) },
        )
    }
    EngagementModeControl(
        selected = state.form.engagementMode,
        onSelect = { mode ->
            focusManager.clearFocus()
            vm.selectEngagementMode(mode)
        },
    )
}

@Composable
private fun TemplateChipRow(
    templates: List<GigComposeTemplate>,
    onTap: (GigComposeTemplate) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .testTag("gigCompose.templates"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        templates.forEach { template ->
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .clickable(role = Role.Button, onClick = { onTap(template) })
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("gigCompose.templateChip_${template.id}")
                        .semantics { contentDescription = template.label },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (template.icon.isNotEmpty()) {
                    Text(template.icon, fontSize = 13.sp)
                }
                Text(
                    template.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun ClarifyingQuestionHint(question: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.magic.copy(alpha = 0.08f))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("composeGigClarifyingQuestion"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.magic,
        )
        Text(question, fontSize = 12.sp, color = PantopusColors.appTextSecondary, lineHeight = 17.sp)
    }
}

/**
 * P6c — posting-identity chip. Static "PERSONAL · YOU" when the user has
 * no businesses; with businesses it becomes a picker that opens the
 * identity sheet ([GigPickerSheet.Identity]). A business selection
 * repaints the chip in the business identity tokens and rides the
 * submission as `beneficiary_user_id`.
 */
@Composable
internal fun ComposeIdentityChip(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    val isBusiness = state.form.beneficiaryUserId != null
    val accent = if (isBusiness) PantopusColors.business else PantopusColors.personal
    val accentBg = if (isBusiness) PantopusColors.businessBg else PantopusColors.personalBg
    val label =
        if (isBusiness) {
            "BUSINESS · ${(state.form.beneficiaryLabel ?: "BUSINESS").uppercase()}"
        } else {
            "PERSONAL · YOU"
        }
    val isPicker = state.identityOptions.isNotEmpty()
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(accentBg)
                .let { base ->
                    if (isPicker) {
                        base.clickable(role = Role.Button) { vm.presentPicker(GigPickerSheet.Identity) }
                    } else {
                        base
                    }
                }
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("gigCompose.identity")
                .semantics { contentDescription = "Posting as $label" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (isBusiness) PantopusIcon.Briefcase else PantopusIcon.User,
            contentDescription = null,
            size = 11.dp,
            tint = accent,
        )
        Text(label, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = accent)
        if (isPicker) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 11.dp,
                tint = accent,
            )
        }
    }
}

@Composable
private fun MagicDescribeCard(
    text: String,
    onTextChange: (String) -> Unit,
    detected: GigComposeCategory?,
    isParsed: Boolean,
    isParsing: Boolean,
    isRecording: Boolean,
    isTranscribing: Boolean,
    onMicTap: () -> Unit,
    onImageTap: () -> Unit,
    onAttachTap: () -> Unit,
    onDismissKeyboard: () -> Unit,
) {
    // A12.8 — entity highlights once a draft landed (identity transform
    // while still parsing / before detection).
    val highlightStyle =
        SpanStyle(
            background = PantopusColors.magicBg,
            color = PantopusColors.magic,
            fontWeight = FontWeight.SemiBold,
        )
    val transformation =
        remember(text, detected, isParsed) {
            if (isParsed) {
                MagicHighlightTransformation(magicHighlightRanges(text, detected), highlightStyle)
            } else {
                VisualTransformation.None
            }
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("gigCompose.describe.card"),
    ) {
        // Magic header strip
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.magic.copy(alpha = 0.08f))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier = Modifier.size(22.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.magic),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text("Magic Task", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.magic)
            Spacer(Modifier.weight(1f))
            if (isParsing) {
                // P0.1 — backend magic-draft call in flight.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier = Modifier.testTag("gigCompose.describe.status"),
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.magic))
                    Text("PARSING…", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.magic)
                }
            } else if (isParsed) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier = Modifier.testTag("gigCompose.describe.status"),
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.success))
                    Text("PARSED", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
                }
            }
        }
        HorizontalDivider(color = PantopusColors.magic.copy(alpha = 0.18f))
        BasicTextField(
            value = text,
            onValueChange = onTextChange,
            textStyle = TextStyle(color = PantopusColors.appText, fontSize = 14.5.sp, lineHeight = 21.sp),
            cursorBrush = SolidColor(PantopusColors.primary600),
            visualTransformation = transformation,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onDismissKeyboard() }),
            modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp).padding(Spacing.s3).testTag("gigCompose.describe.field"),
            decorationBox = { inner ->
                if (text.isEmpty()) {
                    Text(
                        "e.g. Need someone to assemble an IKEA desk this Saturday morning…",
                        fontSize = 14.5.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        // A12.8 — tool row: mic / image / paperclip + character counter.
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (isRecording) {
                RecordingStopButton(onTap = onMicTap)
            } else {
                DescribeToolButton(
                    icon = PantopusIcon.Mic,
                    testTag = "gigCompose.describe.mic",
                    label = if (isTranscribing) "Transcribing voice note" else "Record a voice note",
                    tint = if (isTranscribing) PantopusColors.magic else PantopusColors.appTextSecondary,
                    onTap = onMicTap,
                )
            }
            DescribeToolButton(
                icon = PantopusIcon.Image,
                testTag = "gigCompose.describe.image",
                label = "Add a photo",
                onTap = onImageTap,
            )
            DescribeToolButton(
                icon = PantopusIcon.Paperclip,
                testTag = "gigCompose.describe.attach",
                label = "Attach a file",
                onTap = onAttachTap,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "${text.length} / ${GigComposeLimits.DESCRIBE_MAX}",
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("gigCompose.describe.counter"),
            )
        }
    }
}

@Composable
private fun DescribeToolButton(
    icon: PantopusIcon,
    testTag: String,
    label: String,
    tint: Color = PantopusColors.appTextSecondary,
    onTap: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm))
                .clickable(role = Role.Button, onClick = onTap)
                .testTag(testTag)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = tint)
    }
}

/** A12.8 — recording in progress: red dot + Stop, tap to finish. */
@Composable
private fun RecordingStopButton(onTap: () -> Unit) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 32.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.error, RoundedCornerShape(Radii.sm))
                .clickable(role = Role.Button, onClick = onTap)
                .padding(horizontal = Spacing.s2)
                .testTag("gigCompose.describe.mic")
                .semantics { contentDescription = "Stop recording" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(8.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.error))
        Text("Stop", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.error)
    }
}

/**
 * A12.8 — detected-category row: 36dp archetype icon tile, "DETECTED
 * CATEGORY" overline, "Handyman · Furniture assembly" line (category
 * label + humanised `task_archetype`), "Change" → manual picker.
 */
@Composable
private fun DetectedCategoryRow(
    archetype: GigComposeCategory,
    taskArchetype: String?,
    onChange: () -> Unit,
) {
    val subtitle =
        humanizeArchetype(taskArchetype)
            ?.takeIf { !it.equals(archetype.label, ignoreCase = true) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigCompose.detected"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(Radii.md)).background(archetype.accent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = archetype.tileIcon,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = archetype.accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("DETECTED CATEGORY", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            Text(
                if (subtitle != null) "${archetype.label} · $subtitle" else archetype.label,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        }
        Text(
            "Change",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .clickable(role = Role.Button, onClick = onChange)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                    .testTag("gigCompose.detected.change"),
        )
    }
}

@Composable
private fun ModulePromptsCard(
    prompts: List<GigModulePrompt>,
    onPromptTap: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("gigCompose.modulePrompts"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3, bottom = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "TASK DETAILS",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "${prompts.count { it.isFilled }} of ${prompts.size} filled",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.success,
            )
        }
        prompts.forEachIndexed { index, prompt ->
            ModulePromptRow(prompt, onTap = { onPromptTap(prompt.id) })
            if (index < prompts.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun ModulePromptRow(
    prompt: GigModulePrompt,
    onTap: () -> Unit,
) {
    val accent = if (prompt.isFilled) PantopusColors.success else PantopusColors.warning
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("gigCompose.modulePrompt_${prompt.id}")
                .semantics { contentDescription = "${prompt.label}: ${prompt.value}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(28.dp).clip(RoundedCornerShape(Radii.sm)).background(accent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = prompt.icon, contentDescription = null, size = 14.dp, strokeWidth = 2.2f, tint = accent)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(prompt.label, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            Text(
                prompt.value,
                fontSize = 13.sp,
                fontWeight = if (prompt.isFilled) FontWeight.SemiBold else FontWeight.Normal,
                color = if (prompt.isFilled) PantopusColors.appText else PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        if (prompt.isFilled) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.6f,
                tint = PantopusColors.success,
            )
        } else {
            Text(
                "Add",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warning,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.warning.copy(alpha = 0.12f))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            )
        }
    }
}

@Composable
private fun EngagementModeControl(
    selected: GigComposeEngagementMode,
    onSelect: (GigComposeEngagementMode) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            "ENGAGEMENT",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            GigComposeEngagementMode.entries.forEach { option ->
                val active = option == selected
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(if (active) PantopusColors.primary50 else PantopusColors.appSurface)
                            .border(
                                width = if (active) 1.5.dp else 1.dp,
                                color = if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.lg),
                            )
                            .clickable(role = Role.Button, onClick = { onSelect(option) })
                            .padding(vertical = Spacing.s2)
                            .testTag("gigCompose.engagement_${option.tagSuffix}")
                            .semantics { contentDescription = "${option.label}, ${option.subcopy}" },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = option.icon,
                        contentDescription = null,
                        size = Radii.xl,
                        strokeWidth = 2.2f,
                        tint = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                    Text(
                        option.label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (active) PantopusColors.primary700 else PantopusColors.appText,
                    )
                    Text(
                        option.subcopy,
                        fontSize = 10.sp,
                        color = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

// MARK: - Step 1B: Manual picker

@Composable
internal fun ManualPickerStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    TryMagicBanner(onTap = { vm.setComposeMode(ComposeMode.Magic) })
    ComposeIdentityChip(state, vm)
    HeadlineBlock("Pick a category")
    SubcopyBlock("Skipping the describe step? Pick the archetype directly — we'll ask the questions that matter for it.")
    val rows = gigComposeManualPickerCategories.chunked(2)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        for (row in rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                for (category in row) {
                    Box(modifier = Modifier.weight(1f)) {
                        MagicCategoryTile(
                            category = category,
                            isSelected = state.form.category == category,
                            onTap = { vm.selectCategory(category) },
                        )
                    }
                }
                repeat(2 - row.size) { Box(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

/** A12.8 — purple "Try Magic Task instead" banner (sparkles tile + arrow). */
@Composable
private fun TryMagicBanner(onTap: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.magic.copy(alpha = 0.08f))
                .border(1.dp, PantopusColors.magicBorder, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onTap)
                .padding(Spacing.s3)
                .testTag("gigCompose.manual.magicBanner")
                .semantics { contentDescription = "Try Magic Task instead" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(28.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.magic),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("Try Magic Task instead", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.magic)
            Text(
                "Describe it in plain English — faster for most posts.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        PantopusIconImage(icon = PantopusIcon.ArrowRight, contentDescription = null, size = 15.dp, tint = PantopusColors.magic)
    }
}

@Composable
private fun MagicCategoryTile(
    category: GigComposeCategory,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 84.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(role = Role.Button, onClick = onTap)
                .padding(Spacing.s3)
                .testTag("gigCompose.manual.tile_${category.key}")
                .semantics { contentDescription = if (isSelected) "${category.label}, selected" else category.label },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(category.accent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = category.tileIcon, contentDescription = null, size = 17.dp, strokeWidth = 2.2f, tint = category.accent)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(category.label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(category.examples, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        }
    }
}

// MARK: - Sample data

/** A12.8 — deterministic Magic Task sample for previews + Paparazzi. */
object GigComposeMagicSampleData {
    const val DESCRIBE_TEXT =
        "Need someone to assemble an IKEA desk this Saturday morning. " +
            "It's the big one with drawers — 3 boxes, probably 2 hours of work."

    val parsedForm =
        GigComposeFormState(
            composeMode = ComposeMode.Magic,
            describeText = DESCRIBE_TEXT,
            detectedArchetype = GigComposeCategory.Handyman,
            taskArchetype = "home_service",
            category = GigComposeCategory.Handyman,
            budgetType = GigComposeBudgetType.Fixed,
            budgetMin = "80",
            budgetMax = "120",
            estimatedHours = "2",
            scheduleType = GigComposeScheduleType.Flexible,
            locationMode = GigComposeLocationMode.YourAddress,
        )

    val manualForm = GigComposeFormState(composeMode = ComposeMode.Manual)
}
