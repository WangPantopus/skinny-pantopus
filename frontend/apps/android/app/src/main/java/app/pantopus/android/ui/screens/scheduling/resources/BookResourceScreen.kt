@file:Suppress(
    "PackageNaming",
    "UNUSED_PARAMETER",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MagicNumber",
    "LongParameterList",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.ConflictAlternativesSheet
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val BOOK_RESOURCE_TAG = "scheduling.bookResource"

/** F12 Book a Resource. */
@Composable
fun BookResourceScreen(
    resourceId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookResourceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val conflict by viewModel.slotConflict.collectAsStateWithLifecycle()
    val saveError by viewModel.saveError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }

    val title =
        when (val s = state) {
            is BookResourceUiState.Form -> if (s.resourceName.isBlank()) "Book" else "Book ${s.resourceName}"
            else -> "Book"
        }
    val isSuccess = state is BookResourceUiState.Success

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag(BOOK_RESOURCE_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            if (!isSuccess) {
                SchedulingTopBar(
                    title = title,
                    leading = SchedulingTopBarLeading.Back,
                    onLeading = onBack,
                    applyStatusBarInset = true,
                )
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (val s = state) {
                BookResourceUiState.Loading -> SchedulingLoadingSkeleton(rows = 3)
                is BookResourceUiState.Error ->
                    ErrorState(
                        headline = "Couldn't open this resource",
                        message = s.message,
                        onRetry = viewModel::load,
                    )
                is BookResourceUiState.Form -> BookForm(s, viewModel)
                is BookResourceUiState.Success ->
                    BookSuccess(s, onBackToCalendar = {
                        viewModel.calendarRoute()?.let(onNavigate)
                            ?: onBack()
                    })
            }
        }
    }

    conflict?.let { c ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ConflictAlternativesSheet(
            conflict = c,
            onPick = viewModel::applyAlternative,
            onPickAnotherTime = viewModel::dismissConflict,
            onDismiss = viewModel::dismissConflict,
            sheetState = sheetState,
            accent = PantopusColors.home,
            title = "That time was just taken",
        )
    }

    saveError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearSaveError,
            confirmButton = { TextButton(onClick = viewModel::clearSaveError) { Text("OK") } },
            title = { Text("Couldn't book") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun BookForm(
    form: BookResourceUiState.Form,
    viewModel: BookResourceViewModel,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        BookFormContent(form = form, viewModel = viewModel, isDimmed = form.isSubmitting)
        if (form.isSubmitting) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                SavingOverlay(label = "Booking the charger")
            }
        }
    }
}

@Composable
private fun BookFormContent(
    form: BookResourceUiState.Form,
    viewModel: BookResourceViewModel,
    isDimmed: Boolean,
) {
    Column(modifier = Modifier.fillMaxSize().alpha(if (isDimmed) 0.45f else 1f)) {
        Column(
            modifier =
                Modifier
                    .weight(
                        1f,
                    ).verticalScroll(rememberScrollState())
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (form.ruleChips.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    form.ruleChips.forEach {
                        RuleChipView(icon = it.icon, text = it.text, home = false)
                    }
                }
            }
            SectionCard(overline = "When") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { viewModel.stepDay(-1) }, enabled = form.canStepBack) {
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronLeft,
                            contentDescription = "Previous day",
                            size = 18.dp,
                            tint = if (form.canStepBack) PantopusColors.appText else PantopusColors.appTextMuted,
                        )
                    }
                    Text(
                        form.dayLabel,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    IconButton(onClick = { viewModel.stepDay(1) }) {
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronRight,
                            contentDescription = "Next day",
                            size = 18.dp,
                            tint = PantopusColors.appText,
                        )
                    }
                }
                HourGrid(form, onTap = viewModel::tap)
                form.statusLine?.let { StatusPill(it) }
            }
            SectionCard(overline = "For whom") {
                ForWhomPicker(form.members, form.forWhom, onPick = viewModel::pickMember)
            }
            SectionCard(overline = "Notes") {
                NoteField(value = form.note, onValueChange = viewModel::setNote)
            }
        }
        Column {
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            Box(
                modifier =
                    Modifier
                        .background(
                            PantopusColors.appSurface,
                        ).fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            ) {
                HomePrimaryButton(
                    title = "Submit booking",
                    icon = PantopusIcon.Check,
                    isEnabled = form.canSubmit,
                    isLoading = form.isSubmitting,
                    onClick = viewModel::submit,
                )
            }
        }
    }
}

@Composable
private fun HourGrid(
    form: BookResourceUiState.Form,
    onTap: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        form.hours.chunked(4).forEach { rowHours ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier = Modifier.fillMaxWidth(),
            ) {
                rowHours.forEach { hour ->
                    HourCell(
                        hour = hour,
                        state = form.cells[hour] ?: BookCellState.Free,
                        onTap = onTap,
                        modifier = Modifier.weight(1f),
                    )
                }
                repeat(4 - rowHours.size) { Box(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun HourCell(
    hour: Int,
    state: BookCellState,
    onTap: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val background =
        when (state) {
            BookCellState.Selected -> PantopusColors.home
            BookCellState.SelectedConflict -> PantopusColors.errorBg
            BookCellState.Taken, BookCellState.Off -> PantopusColors.appSurfaceSunken
            BookCellState.Free -> PantopusColors.appSurface
        }
    val foreground =
        when (state) {
            BookCellState.Selected -> PantopusColors.appTextInverse
            BookCellState.SelectedConflict -> PantopusColors.error
            BookCellState.Taken, BookCellState.Off -> PantopusColors.appTextMuted
            BookCellState.Free -> PantopusColors.appText
        }
    val borderColor =
        when (state) {
            BookCellState.SelectedConflict -> PantopusColors.error
            BookCellState.Free -> PantopusColors.appBorder
            else -> Color.Transparent
        }
    Box(
        modifier =
            modifier
                .heightIn(min = 34.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .then(
                    if (borderColor ==
                        Color.Transparent
                    ) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, borderColor, RoundedCornerShape(Radii.md))
                    },
                ).clickable(enabled = state != BookCellState.Off) { onTap(hour) }
                .padding(vertical = Spacing.s2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = hourLabel(hour),
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
            textDecoration =
                if (state ==
                    BookCellState.Taken
                ) {
                    TextDecoration.LineThrough
                } else {
                    TextDecoration.None
                },
        )
    }
}

@Composable
private fun StatusPill(status: BookStatusLine) {
    val (icon, color, bg) =
        when (status.tone) {
            BookStatusTone.Ok ->
                Triple(
                    PantopusIcon.CheckCircle,
                    PantopusColors.success,
                    PantopusColors.successBg,
                )
            BookStatusTone.Conflict ->
                Triple(
                    PantopusIcon.XCircle,
                    PantopusColors.error,
                    PantopusColors.errorBg,
                )
            BookStatusTone.Warning ->
                Triple(
                    PantopusIcon.TriangleAlert,
                    PantopusColors.warning,
                    PantopusColors.warningBg,
                )
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(
                    RoundedCornerShape(Radii.md),
                ).background(bg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = color)
        Text(status.text, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}

@Composable
private fun ForWhomPicker(
    members: List<HomeMember>,
    selected: HomeMember?,
    onPick: (HomeMember) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(enabled = members.isNotEmpty()) { expanded = true }
                    .padding(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (selected != null) {
                HomeMemberAvatar(member = selected, size = 28.dp)
                Text(
                    selected.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
            } else {
                Text(
                    "Choose a member",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            members.forEach { member ->
                DropdownMenuItem(text = { Text(member.name) }, onClick = {
                    onPick(member)
                    expanded =
                        false
                })
            }
        }
    }
}

/** Multiline optional note field (F12 Notes section). */
@Composable
private fun NoteField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    androidx.compose.foundation.text.BasicTextField(
        value = value,
        onValueChange = onValueChange,
        textStyle =
            androidx.compose.ui.text.TextStyle(
                fontSize = 13.sp,
                color = PantopusColors.appText,
            ),
        cursorBrush = androidx.compose.ui.graphics.SolidColor(PantopusColors.home),
        minLines = 2,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        decorationBox = { inner ->
            if (value.isEmpty()) {
                Text(
                    "Add a note (optional)",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            inner()
        },
    )
}

@Composable
private fun BookSuccess(
    success: BookResourceUiState.Success,
    onBackToCalendar: () -> Unit,
) {
    val accent = if (success.approval) PantopusColors.warning else PantopusColors.home
    val accentBg = if (success.approval) PantopusColors.warningBg else PantopusColors.homeBg
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(84.dp).clip(CircleShape).background(accentBg),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier.size(52.dp).clip(CircleShape).background(accent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (success.approval) PantopusIcon.Clock else PantopusIcon.Check,
                    contentDescription = null,
                    size = 28.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Text(
            success.title,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Text(
            success.body,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (success.note.isNotBlank()) {
            SuccessNotePill(text = success.note)
        }
        HomePrimaryButton(
            title = "Back to calendar",
            icon = PantopusIcon.Home,
            onClick = onBackToCalendar,
        )
    }
}

private fun hourLabel(hour: Int): String {
    val period = if (hour < 12) "a" else "p"
    val display = if (hour % 12 == 0) 12 else hour % 12
    return "$display$period"
}
