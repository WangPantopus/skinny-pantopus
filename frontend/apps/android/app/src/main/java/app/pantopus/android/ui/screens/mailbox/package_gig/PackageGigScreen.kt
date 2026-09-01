@file:Suppress(
    "PackageNaming",
    "FunctionNaming",
    "MagicNumber",
    "LongMethod",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.mailbox.package_gig

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.8 → "Ask a Neighbor". Two frames, matching RN
 * `src/app/mailbox/gig.tsx`:
 *
 *  - form    — pre-fill context card, the "WHAT DO YOU NEED?" selector
 *    (Hold Package / Put Inside / Sign for Me / Help Assemble / Custom),
 *    optional title + instructions + offer, the Verified-Neighbor safety
 *    note, and the "Post Task Request" CTA.
 *  - created — "Task Posted!" confirmation with the gig title, the
 *    pre-fill/visibility summary, and the two RN CTAs (Back to Package ·
 *    View Task Listing).
 *
 * The designs folder has no frame for this screen (A17.6 is the *inbound*
 * gig-mail detail), so the chrome follows the A17 nav + section-card
 * archetype already used by `MailTaskListScreen`.
 *
 * Mirrors `PackageGigView.swift` on iOS.
 */
@Composable
fun PackageGigScreen(
    onBack: () -> Unit,
    onOpenGig: (String) -> Unit,
    viewModel: PackageGigViewModel = hiltViewModel(),
) {
    val created by viewModel.created.collectAsStateWithLifecycle()
    val selectedType by viewModel.selectedType.collectAsStateWithLifecycle()
    val draftTitle by viewModel.draftTitle.collectAsStateWithLifecycle()
    val draftDescription by viewModel.draftDescription.collectAsStateWithLifecycle()
    val draftCompensation by viewModel.draftCompensation.collectAsStateWithLifecycle()
    val isCreating by viewModel.isCreating.collectAsStateWithLifecycle()
    val alert by viewModel.alert.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("packageGig"),
    ) {
        TopBar(eyebrow = viewModel.eyebrow, onBack = onBack)
        val current = created
        if (current == null) {
            FormFrame(
                options = viewModel.options,
                contextSubcopy = viewModel.contextSubcopy,
                selectedType = selectedType,
                title = draftTitle,
                description = draftDescription,
                compensation = draftCompensation,
                isCreating = isCreating,
                onSelect = viewModel::select,
                onTitleChange = viewModel::updateDraftTitle,
                onDescriptionChange = viewModel::updateDraftDescription,
                onCompensationChange = viewModel::updateDraftCompensation,
                onSubmit = viewModel::create,
            )
        } else {
            SuccessFrame(
                created = current,
                onBackToPackage = onBack,
                onViewListing = { onOpenGig(current.gigId) },
            )
        }
    }

    alert?.let { pending ->
        AlertDialog(
            onDismissRequest = viewModel::dismissAlert,
            title = { Text(text = pending.title) },
            text = { Text(text = pending.message) },
            confirmButton = {
                TextButton(onClick = viewModel::dismissAlert) { Text(text = "OK") }
            },
            modifier = Modifier.testTag("packageGig_alert"),
        )
    }
}

// ─── Top bar ──────────────────────────────────────────────────

@Composable
private fun TopBar(
    eyebrow: String,
    onBack: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(PantopusColors.appSurface),
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onBack)
                        .padding(vertical = Spacing.s2)
                        .testTag("packageGig_back"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back to Mailbox",
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Mailbox",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.primary600,
                )
            }
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.testTag("packageGig_eyebrow"),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.business),
                )
                Text(
                    text = eyebrow,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextStrong,
                )
            }
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.width(72.dp))
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle)
                    .align(Alignment.BottomStart),
        )
    }
}

// ─── Form frame ───────────────────────────────────────────────

@Composable
private fun FormFrame(
    options: List<PackageGigOption>,
    contextSubcopy: String,
    selectedType: PackageGigType?,
    title: String,
    description: String,
    compensation: String,
    isCreating: Boolean,
    onSelect: (PackageGigType) -> Unit,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onCompensationChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Ask a Neighbor",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )

        ContextCard(subcopy = contextSubcopy)

        SectionCard(label = "WHAT DO YOU NEED?") {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                options.forEach { option ->
                    OptionCard(
                        option = option,
                        selected = option.type == selectedType,
                        onClick = { onSelect(option.type) },
                    )
                }
            }
        }

        if (selectedType != null) {
            SectionCard(label = "DETAILS (OPTIONAL)") {
                OutlinedTextField(
                    value = title,
                    onValueChange = onTitleChange,
                    label = { Text("Custom title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("packageGig_field_title"),
                )
                Spacer(Modifier.size(Spacing.s2))
                OutlinedTextField(
                    value = description,
                    onValueChange = onDescriptionChange,
                    label = { Text("Additional instructions for the neighbor…") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth().testTag("packageGig_field_description"),
                )
                Spacer(Modifier.size(Spacing.s2))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Offer (optional)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Spacer(Modifier.weight(1f))
                    OutlinedTextField(
                        value = compensation,
                        onValueChange = onCompensationChange,
                        label = { Text("$") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(130.dp).testTag("packageGig_field_compensation"),
                    )
                }
            }
        }

        SafetyNote()

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        if (selectedType == null) {
                            PantopusColors.appSurfaceSunken
                        } else {
                            PantopusColors.business
                        },
                    )
                    .clickable(enabled = selectedType != null && !isCreating, onClick = onSubmit)
                    .testTag("packageGig_submit"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 17.dp,
                tint =
                    if (selectedType == null) {
                        PantopusColors.appTextSecondary
                    } else {
                        PantopusColors.appTextInverse
                    },
            )
            Spacer(Modifier.size(Spacing.s2))
            Text(
                text = if (isCreating) "Posting…" else "Post Task Request",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color =
                    if (selectedType == null) {
                        PantopusColors.appTextSecondary
                    } else {
                        PantopusColors.appTextInverse
                    },
            )
        }
        Spacer(Modifier.height(Spacing.s10))
    }
}

@Composable
private fun ContextCard(subcopy: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg)
                .padding(Spacing.s3)
                .testTag("packageGig_context"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Package,
            contentDescription = null,
            size = 22.dp,
            tint = PantopusColors.business,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Package details pre-filled",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
            )
            Text(text = subcopy, fontSize = 11.sp, color = PantopusColors.business)
        }
    }
}

@Composable
private fun OptionCard(
    option: PackageGigOption,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(
                    if (selected) PantopusColors.businessBg else PantopusColors.appSurfaceSunken,
                )
                .border(
                    width = 2.dp,
                    color = if (selected) PantopusColors.business else Color.Transparent,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("packageGig_option_${option.type.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = option.icon,
            contentDescription = null,
            size = 22.dp,
            tint = if (selected) PantopusColors.business else PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = option.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) PantopusColors.business else PantopusColors.appText,
            )
            Text(
                text = option.subtitle,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = if (selected) PantopusIcon.CircleDot else PantopusIcon.Circle,
            contentDescription = if (selected) "Selected" else null,
            size = 21.dp,
            tint = if (selected) PantopusColors.business else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SafetyNote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .padding(Spacing.s3)
                .testTag("packageGig_safetyNote"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "Only Verified Neighbors with trust scores can see and accept package gigs",
            fontSize = 12.sp,
            color = PantopusColors.success,
        )
    }
}

// ─── Success frame ────────────────────────────────────────────

@Composable
private fun SuccessFrame(
    created: PackageGigCreated,
    onBackToPackage: () -> Unit,
    onViewListing: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s10)
                .testTag("packageGig_success"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.xl),
                    )
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 40.dp,
                tint = PantopusColors.success,
            )
            Text(
                text = "Task Posted!",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "“${created.title}” has been posted. " +
                        "Verified Neighbors nearby will be notified.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.businessBg)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                SuccessRow(
                    label = "Package",
                    value =
                        if (created.isPreDelivery) {
                            "Pre-filled from your mailbox"
                        } else {
                            "Pre-filled from your delivery"
                        },
                )
                SuccessRow(label = "Visibility", value = "Verified Neighbors within 0.5 mi")
            }
        }

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.business)
                    .clickable(onClick = onBackToPackage)
                    .testTag("packageGig_backToPackage"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Back to Package",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable(onClick = onViewListing)
                    .testTag("packageGig_viewListing"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "View Task Listing",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun SuccessRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, fontSize = 12.sp, color = PantopusColors.business)
        Spacer(Modifier.weight(1f))
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.business,
            textAlign = TextAlign.End,
        )
    }
}

// ─── Section shell ────────────────────────────────────────────

@Composable
private fun SectionCard(
    label: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.xl),
                )
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
        )
        content()
    }
}
