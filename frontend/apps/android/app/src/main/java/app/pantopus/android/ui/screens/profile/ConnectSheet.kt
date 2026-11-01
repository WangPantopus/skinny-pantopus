@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Connect sheet (`Connect.dc.html`): what connecting means, an optional note of up to 500 characters (it
 * reaches them only in their notification), Send request, and "Just follow <name>'s public posts" for people who
 * only want the posts. A failed send keeps the sheet and the note, and says why.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfileConnectSheet(
    header: PublicProfileHeader,
    firstName: String,
    plansOn: Boolean,
    isFollowing: Boolean,
    canFollow: Boolean,
    connectState: PublicProfileActionState,
    onSend: (String) -> Unit,
    onJustFollow: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var note by rememberSaveable { mutableStateOf("") }
    val sending = connectState is PublicProfileActionState.InFlight
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.closesKeyboardOnTapOrScroll().testTag("publicProfileConnectSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    .padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s6),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileAvatar(
                    name = header.avatarName ?: header.displayName,
                    photoUrl = header.avatarUrl,
                    seed = header.avatarSeed,
                    size = 44.dp,
                )
                Spacer(Modifier.width(Spacing.s3))
                Text(
                    text = "Connect with $firstName?",
                    fontSize = 22.sp,
                    lineHeight = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
            }
            Text(
                text =
                    if (plansOn) {
                        "You'll see each other's connections-only posts and can invite each other to plans. " +
                            "$firstName approves your request first."
                    } else {
                        "You'll see each other's connections-only posts. $firstName approves your request first."
                    },
                fontSize = 16.sp,
                lineHeight = 22.sp,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.padding(top = Spacing.s3),
            )
            Text(
                text = "Add a note (optional)",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.padding(top = 18.dp, bottom = 6.dp),
            )
            NoteField(
                value = note,
                firstName = firstName,
                enabled = !sending,
                onChange = { note = it.take(CONNECT_NOTE_MAX) },
            )
            Text(
                text = "${note.length} / $CONNECT_NOTE_MAX",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextMuted,
                textAlign = TextAlign.End,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Spacing.s1)
                        .semantics { contentDescription = "${note.length} of $CONNECT_NOTE_MAX characters" },
            )
            (connectState as? PublicProfileActionState.Failed)?.let { failed ->
                Text(
                    text = failed.message,
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.error,
                    modifier = Modifier.padding(top = Spacing.s2).testTag("publicProfileConnectError"),
                )
            }
            ProfileActionButton(
                title = if (sending) "Sending…" else "Send request",
                icon = PantopusIcon.UserPlus,
                primary = true,
                onClick = { onSend(note) },
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                enabled = !sending,
                testTag = "publicProfileSendRequest",
            )
            if (canFollow) {
                OrDivider()
                if (isFollowing) {
                    Text(
                        text = "You already follow $firstName's public posts.",
                        fontSize = 15.sp,
                        lineHeight = 20.sp,
                        color = PantopusColors.appTextSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().testTag("publicProfileAlreadyFollowing"),
                    )
                } else {
                    ProfileActionButton(
                        title = "Just follow $firstName's public posts",
                        icon = null,
                        primary = false,
                        onClick = onJustFollow,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !sending,
                        testTag = "publicProfileJustFollow",
                    )
                    Text(
                        text = "Their public posts show up in your Pulse. No request needed.",
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.appTextMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
                    )
                }
            }
        }
    }
}

@Composable
private fun NoteField(
    value: String,
    firstName: String,
    enabled: Boolean,
    onChange: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .keepsKeyboard()
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = Spacing.s3),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onChange,
            enabled = enabled,
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 16.sp, lineHeight = 22.sp, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            minLines = 3,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("publicProfileConnectNote")
                    .semantics { contentDescription = "Add a note, optional" },
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        text = "Hi $firstName, I'm a neighbor nearby. Would love to connect!",
                        fontSize = 16.sp,
                        lineHeight = 22.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
    }
}

@Composable
private fun OrDivider() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
        Text(text = "or", fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
        Box(Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
    }
}
