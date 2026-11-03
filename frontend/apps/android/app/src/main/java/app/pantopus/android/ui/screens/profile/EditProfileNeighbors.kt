@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.identity.OwnLocalProfileResponse
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/*
 * The PRF editor's pieces (`Edit.dc.html`): the live preview card ("How neighbors see you · updates as you type"), the
 * "Neighbors see this" / "Only you see this" headers, the photo neighbors see (what Privacy's "How neighbors see you"
 * card did before it became a row that opens this editor), Home address and "Who sees your city".
 */

/** What the preview card takes from your account read: your color seed and the trust line's facts. */
internal data class EditOwnFacts(
    val seed: String,
    /** Its city is your verified home's; the typed city stands in when there is none. */
    val trust: ProfileTrust,
)

/** What the preview card shows, from the form as typed. */
internal data class EditPreview(
    val name: String,
    val handle: String?,
    val photoUrl: String?,
    val seed: String,
    val trust: ProfileTrust,
    val tagline: String?,
    val bio: String?,
)

/** The longest name neighbors may see (the account name's rule). */
internal const val NEIGHBOR_NAME_LIMIT = 255

/** The typed name as it would be saved: spaces as in an account name. */
internal fun normalizedNeighborName(text: String): String = text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")

/** Under the photo neighbors see: whose photo it is and what changes it. */
internal fun neighborPhotoNote(view: OwnLocalProfileResponse): String =
    when {
        view.profile.avatarUrl == null -> "Neighbors see your initials until you add one."
        view.followsAccount.avatarUrl -> "Your account photo: it changes when you change your account photo below."
        else -> "A photo just for neighbors: changing your account photo won't change it."
    }

/** "How neighbors see you · updates as you type": the header neighbors get, as you edit it. */
@Composable
internal fun EditProfilePreviewCard(preview: EditPreview) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("editProfilePreview")) {
        Text(
            text = "How neighbors see you · updates as you type",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(bottom = Spacing.s2),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s4),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                ProfileAvatar(name = preview.name, photoUrl = preview.photoUrl, seed = preview.seed, size = 56.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = preview.name.ifBlank { "Your name" },
                        fontSize = 20.sp,
                        lineHeight = 25.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    preview.handle?.let {
                        Text(text = "@$it", fontSize = 14.sp, lineHeight = 19.sp, color = PantopusColors.appTextMuted)
                    }
                }
            }
            EditPreviewTrustLine(preview.trust)
            preview.tagline?.let {
                Text(
                    text = it,
                    fontSize = 15.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.padding(top = Spacing.s2),
                )
            }
            preview.bio?.let {
                Text(
                    text = it,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.appTextStrong,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = Spacing.s1),
                )
            }
        }
    }
}

/** "Verified neighbor · Vancouver · Joined Oct 2026", only what's true. */
@Composable
private fun EditPreviewTrustLine(trust: ProfileTrust) {
    val words = listOfNotNull("Verified neighbor".takeIf { trust.verifiedNeighbor }, trust.city, trust.joined)
    if (words.isEmpty()) return
    Row(
        modifier = Modifier.padding(top = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (trust.verifiedNeighbor) {
            PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 15.dp, tint = PantopusColors.home)
        }
        Text(text = words.joinToString(" · "), fontSize = 14.sp, lineHeight = 19.sp, color = PantopusColors.appTextMuted)
    }
}

/** "Neighbors see this" / "Only you see this": which identity the fields below change. */
@Composable
internal fun EditSectionHeader(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    title: String,
    subtitle: String,
    tag: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4).testTag(tag),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(background), contentAlignment = Alignment.Center) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = tint)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 20.sp,
                lineHeight = 25.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = subtitle, fontSize = 14.sp, lineHeight = 19.sp, color = PantopusColors.appTextMuted)
        }
    }
}

/** A line of help under a field. */
@Composable
internal fun FieldHelp(text: String) {
    Text(text = text, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
}

/**
 * The photo neighbors see (your Local Profile's), with what Privacy's "How neighbors see you" card offered: choose a
 * photo, use your account photo, or remove it (initials). Each change saves at once.
 */
@Composable
internal fun NeighborPhotoRow(
    view: OwnLocalProfileResponse,
    name: String,
    seed: String,
    busy: Boolean,
    onPicked: (ByteArray?, String, String) -> Unit,
    onUseAccountPhoto: () -> Unit,
    onRemove: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    val photoUrl = view.profile.avatarUrl
    val accountPhotoUrl = view.account.avatarUrl
    val picker =
        rememberLauncherForActivityResult(contract = ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
            // A null Uri is a plain cancel, not a failure: stay silent.
            if (uri == null) return@rememberLauncherForActivityResult
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val extension = if (mimeType.equals("image/png", ignoreCase = true)) "png" else "jpg"
            val filename = "profile-${System.currentTimeMillis()}.$extension"
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
                    }
                onPicked(bytes, filename, mimeType)
            }
        }
    val choosePhoto = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
    Row(
        modifier = Modifier.fillMaxWidth().testTag("editProfileNeighborPhoto"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.alpha(if (busy) 0.5f else 1f)) {
            ProfileAvatar(name = name, photoUrl = photoUrl, seed = seed, size = 56.dp)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Profile photo",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = neighborPhotoNote(view), fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
        }
        Box {
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary100)
                        .clickable(enabled = !busy, role = Role.Button, onClickLabel = "Change the photo neighbors see") {
                            if (photoUrl == null && accountPhotoUrl == null) {
                                choosePhoto()
                            } else {
                                menu = true
                            }
                        }
                        .padding(horizontal = Spacing.s4)
                        .testTag("editProfileNeighborPhotoButton"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (photoUrl == null) "Add" else "Change",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(
                    text = { Text("Choose a photo") },
                    onClick = {
                        menu = false
                        choosePhoto()
                    },
                    modifier = Modifier.heightIn(min = 48.dp),
                )
                if (accountPhotoUrl != null && accountPhotoUrl != photoUrl) {
                    DropdownMenuItem(
                        text = { Text("Use my account photo") },
                        onClick = {
                            menu = false
                            onUseAccountPhoto()
                        },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
                if (photoUrl != null) {
                    DropdownMenuItem(
                        text = { Text("Remove photo", color = PantopusColors.error) },
                        onClick = {
                            menu = false
                            onRemove()
                        },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
        }
    }
}

/** A row that opens something else: Home address (My Homes), Who sees your city. */
@Composable
internal fun EditLinkRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String?,
    value: String?,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appTextStrong)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            subtitle?.let { Text(text = it, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted) }
            // Under the title, so a long value wraps instead of squeezing it at large text sizes.
            value?.let { Text(text = it, fontSize = 15.sp, lineHeight = 20.sp, color = PantopusColors.primary600) }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** "Who sees your city" (`show_neighborhood`), with web's labels. */
internal enum class CityAudience(val apiValue: String, val label: String, val detail: String) {
    Everyone("public", "Everyone", "Anyone who can open your profile."),
    Connections("followers", "Connections and household", "People you're connected to and live with."),
    OnlyMe("private", "Only me", "Nobody else sees your city."),
    ;

    companion object {
        /** A missing setting is "Connections and household", the server's default. */
        fun from(value: String?): CityAudience = entries.firstOrNull { it.apiValue == value } ?: Connections
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CityAudienceSheet(
    selected: CityAudience,
    onPick: (CityAudience) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("editProfileCitySheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s6),
        ) {
            Text(
                text = "Who sees your city",
                fontSize = 22.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s1).semantics { heading() },
            )
            Text(
                text = "Your city shows next to your name. Your address is never shown.",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(start = Spacing.s1, end = Spacing.s1, top = Spacing.s1, bottom = Spacing.s4),
            )
            AboutCard(tag = "editProfileCityChoices") {
                CityAudience.entries.forEachIndexed { index, choice ->
                    if (index > 0) AboutDivider()
                    CityAudienceChoice(choice = choice, selected = choice == selected, onPick = { onPick(choice) })
                }
            }
        }
    }
}

@Composable
private fun CityAudienceChoice(
    choice: CityAudience,
    selected: Boolean,
    onPick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 64.dp)
                .selectable(selected = selected, role = Role.RadioButton, onClick = onPick)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag("editProfileCity_${choice.apiValue}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = choice.label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = choice.detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
        }
        if (selected) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 20.dp, tint = PantopusColors.primary600)
        }
    }
}
