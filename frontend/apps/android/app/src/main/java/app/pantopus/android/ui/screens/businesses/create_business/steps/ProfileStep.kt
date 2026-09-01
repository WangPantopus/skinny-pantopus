@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.businesses.create_business.BusinessHoursDay
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessLogoPick
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessUiState
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Create Business step 3 — Location Form + Hours + Logo. All three sections
 * may be skipped. Composed with Wizard + Form tokens (no design frames).
 * The logo lives here rather than in its own step because A12.10's designed
 * frame 1 fixes the readout at "1 of 4"; RN carries it as a separate step
 * (`src/app/businesses/new.tsx:27`).
 */
@Composable
fun ProfileStep(
    state: CreateBusinessUiState,
    callbacks: ProfileStepCallbacks,
) {
    BusinessIdentityChip()
    HeadlineBlock("Location, hours & logo")
    SubcopyBlock("Add a primary address, weekly hours and a logo, or skip for now.")

    LocationSection(state = state, callbacks = callbacks)

    if (!state.locationSkipped) {
        HoursSection(state = state, callbacks = callbacks)
    }

    LogoSection(state = state, callbacks = callbacks)

    state.submitError?.let { error ->
        Text(
            text = error,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("createBusinessSubmitError"),
        )
    }
}

@Composable
private fun LogoSection(
    state: CreateBusinessUiState,
    callbacks: ProfileStepCallbacks,
) {
    if (state.logoSkipped) {
        SkippedCard(
            icon = PantopusIcon.Image,
            label = "Logo skipped",
            subcopy = "You can add a logo later from the dashboard.",
            actionLabel = "Add a logo",
            onAction = callbacks.onUnskipLogo,
        )
        return
    }
    val pickLogo = rememberLogoPicker(onPicked = callbacks.onLogoPicked)
    val preview: ImageBitmap? =
        remember(state.logoPick) {
            state.logoPick?.bytes?.let { bytes ->
                runCatching {
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                }.getOrNull()
            }
        }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Logo",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(Spacing.s16 + Spacing.s8)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, CircleShape)
                        .clickable(onClick = pickLogo)
                        .testTag("createBusiness_logoPicker"),
                contentAlignment = Alignment.Center,
            ) {
                if (preview != null) {
                    Image(
                        bitmap = preview,
                        contentDescription = "Selected business logo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Image,
                            contentDescription = null,
                            size = Spacing.s5,
                            tint = PantopusColors.appTextMuted,
                        )
                        Text(
                            text = "Tap to select",
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = "Square works best — we crop to 800×800.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                if (state.logoPick != null) {
                    Text(
                        text = "Remove",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.error,
                        modifier =
                            Modifier
                                .clickable(onClick = callbacks.onClearLogo)
                                .testTag("createBusiness_logoRemove"),
                    )
                }
            }
        }
        Text(
            text = "Skip logo for now",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = callbacks.onSkipLogo)
                    .testTag("createBusiness_skipLogo")
                    .padding(vertical = Spacing.s2),
        )
    }
}

/**
 * Photo-picker launcher for the logo. Reads the bytes off the main thread
 * and hands back a [CreateBusinessLogoPick] with a randomised filename so
 * the picker's `IMG_xxxx` never reaches S3.
 */
@Composable
private fun rememberLogoPicker(onPicked: (CreateBusinessLogoPick) -> Unit): () -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val launcher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        runCatching {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        }.getOrNull()
                    } ?: return@launch
                onPicked(
                    CreateBusinessLogoPick(
                        bytes = bytes,
                        fileName = "business-logo-${System.currentTimeMillis()}.${extensionFor(mimeType)}",
                        mimeType = mimeType,
                    ),
                )
            }
        }
    return { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
}

private fun extensionFor(mimeType: String): String =
    when (mimeType.lowercase()) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/heic", "image/heif" -> "heic"
        else -> "jpg"
    }

@Composable
private fun LocationSection(
    state: CreateBusinessUiState,
    callbacks: ProfileStepCallbacks,
) {
    if (state.locationSkipped) {
        SkippedCard(
            icon = PantopusIcon.MapPin,
            label = "Location skipped",
            subcopy = "You can add a location later from the dashboard.",
            actionLabel = "Add a location",
            onAction = callbacks.onUnskipLocation,
        )
        return
    }
    FormFieldsBlock {
        PantopusTextField(
            label = "Address",
            value = state.address,
            onValueChange = callbacks.onAddressChange,
            placeholder = "123 Main St",
            fieldTestTag = "createBusiness_address",
        )
        PantopusTextField(
            label = "City",
            value = state.city,
            onValueChange = callbacks.onCityChange,
            placeholder = "Vancouver",
            fieldTestTag = "createBusiness_city",
        )
        PantopusTextField(
            label = "State",
            value = state.state,
            onValueChange = callbacks.onStateChange,
            placeholder = "WA",
            fieldTestTag = "createBusiness_state",
        )
        PantopusTextField(
            label = "ZIP code",
            value = state.zip,
            onValueChange = callbacks.onZipChange,
            placeholder = "98660",
            keyboardType = KeyboardType.Number,
            fieldTestTag = "createBusiness_zip",
        )
        Text(
            text = "Skip location for now",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = callbacks.onSkipLocation)
                    .testTag("createBusiness_skipLocation")
                    .padding(vertical = Spacing.s2),
        )
    }
}

@Composable
private fun HoursSection(
    state: CreateBusinessUiState,
    callbacks: ProfileStepCallbacks,
) {
    when {
        state.hoursSkipped -> {
            SkippedCard(
                icon = PantopusIcon.Clock,
                label = "Hours skipped",
                subcopy = "You can set hours later from the dashboard.",
                actionLabel = "Set hours",
                onAction = callbacks.onUnskipHours,
            )
        }
        state.address.trim().isEmpty() -> {
            Text(
                text = "Add an address and city to configure hours, or skip location above.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        else -> {
            HoursEditor(
                hours = state.hours,
                onToggleDayClosed = callbacks.onToggleDayClosed,
                onSkipHours = callbacks.onSkipHours,
            )
        }
    }
}

@Composable
private fun HoursEditor(
    hours: List<BusinessHoursDay>,
    onToggleDayClosed: (Int) -> Unit,
    onSkipHours: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Hours",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s3),
        ) {
            hours.forEachIndexed { index, day ->
                HoursRow(day = day, onToggle = { onToggleDayClosed(day.dayOfWeek) })
                if (index < hours.lastIndex) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle)
                }
            }
        }
        Text(
            text = "Skip hours for now",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onSkipHours)
                    .testTag("createBusiness_skipHours")
                    .padding(vertical = Spacing.s2),
        )
    }
}

@Composable
private fun HoursRow(
    day: BusinessHoursDay,
    onToggle: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s2)
                .testTag("createBusiness_hoursDay_${day.dayOfWeek}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(Spacing.s8)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(
                        if (day.isClosed) PantopusColors.appSurfaceSunken else PantopusColors.businessBg,
                    )
                    .border(
                        width = 1.dp,
                        color = if (day.isClosed) PantopusColors.appBorder else PantopusColors.business,
                        shape = RoundedCornerShape(Radii.xs),
                    )
                    .clickable(onClick = onToggle),
            contentAlignment = Alignment.Center,
        ) {
            if (!day.isClosed) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Spacing.s4,
                    tint = PantopusColors.business,
                )
            }
        }
        Text(
            text = day.shortLabel,
            style = PantopusTextStyle.body,
            color = if (day.isClosed) PantopusColors.appTextSecondary else PantopusColors.appText,
        )
        if (day.isClosed) {
            Text(
                text = "Closed",
                style = PantopusTextStyle.caption.copy(fontStyle = FontStyle.Italic),
                color = PantopusColors.appTextSecondary,
            )
        } else {
            Text(
                text = "${day.openTime} – ${day.closeTime}",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appText,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun SkippedCard(
    icon: PantopusIcon,
    label: String,
    subcopy: String,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(Spacing.s12)
                    .clip(CircleShape)
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = Spacing.s5,
                tint = PantopusColors.business,
            )
        }
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText)
        Text(
            text = subcopy,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Text(
            text = actionLabel,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.business,
            modifier = Modifier.clickable(onClick = onAction),
        )
    }
}
