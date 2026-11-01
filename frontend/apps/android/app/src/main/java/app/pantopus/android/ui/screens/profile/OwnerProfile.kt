@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.you.me.InviteProgressCard
import app.pantopus.android.ui.screens.you.me.MonthlyReceiptCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/*
 * Your own profile (PRF step 2, `Own.dc.html` / `OwnWhole.dc.html`): the same page neighbors see, in owner mode.
 * ✕ (or Back when pushed) and Share on top, Edit profile + Preview as, up to two tips only you see, your latest two
 * posts, "Your <month>", "Your account" and Log out. Preview as shows the page exactly as one audience does
 * (`PreviewMenu.dc.html`, `PreviewAnyone.dc.html`).
 */

/** The owner's top bar: ✕ for the cover from ☰, Back when pushed from your own name; "Your profile"; Share. */
@Composable
internal fun OwnerTopBar(
    cover: Boolean,
    onClose: () -> Unit,
    onShare: (() -> Unit)?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s1).testTag("ownerProfileTopBar"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ProfileIconButton(
            icon = if (cover) PantopusIcon.X else PantopusIcon.ChevronLeft,
            label = if (cover) "Close" else "Back",
            onClick = onClose,
            iconSize = if (cover) 24.dp else 26.dp,
            testTag = "ownerProfileClose",
        )
        Text(
            text = "Your profile",
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        if (onShare != null) {
            ProfileIconButton(
                icon = PantopusIcon.Share,
                label = "Share your profile",
                onClick = onShare,
                iconSize = 22.dp,
                testTag = "ownerProfileShare",
            )
        } else {
            Spacer(Modifier.size(48.dp))
        }
    }
}

/** "Previewing as …" with Done, in place of the top bar while a preview shows. */
@Composable
internal fun PreviewBanner(
    audience: PreviewAudience,
    onDone: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(14.dp))
                .padding(start = 14.dp, top = Spacing.s2, bottom = Spacing.s2, end = Spacing.s1)
                .testTag("ownerPreviewBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 20.dp, tint = PantopusColors.primary600)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = audience.banner,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = audience.bannerDetail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
        }
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(role = Role.Button, onClick = onDone)
                    .padding(horizontal = 10.dp)
                    .testTag("ownerPreviewDone"),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Done", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        }
    }
}

/** "Preview your profile as": Anyone with the link, Neighbors, Your connections, and Cancel. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PreviewAsSheet(
    onPick: (PreviewAudience) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("ownerPreviewSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s6),
        ) {
            Text(
                text = "Preview your profile as",
                fontSize = 22.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s1).semantics { heading() },
            )
            Text(
                text = "See it exactly the way each group does.",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(start = Spacing.s1, end = Spacing.s1, top = Spacing.s1, bottom = Spacing.s4),
            )
            AboutCard(tag = "ownerPreviewChoices") {
                PreviewAudience.entries.forEachIndexed { index, audience ->
                    if (index > 0) AboutDivider()
                    PreviewChoiceRow(audience = audience, onClick = { onPick(audience) })
                }
            }
            ProfileActionButton(
                title = "Cancel",
                icon = null,
                primary = false,
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                testTag = "ownerPreviewCancel",
            )
        }
    }
}

@Composable
private fun PreviewChoiceRow(
    audience: PreviewAudience,
    onClick: () -> Unit,
) {
    val (icon, tint, bg) =
        when (audience) {
            PreviewAudience.Anyone -> Triple(PantopusIcon.Globe, PantopusColors.primary600, PantopusColors.primary100)
            PreviewAudience.Neighbors -> Triple(PantopusIcon.Home, PantopusColors.home, PantopusColors.homeBg)
            PreviewAudience.Connections -> Triple(PantopusIcon.Users, PantopusColors.magic, PantopusColors.magicBg)
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 76.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("ownerPreview_${audience.apiValue}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(CircleShape).background(bg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = audience.label,
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = audience.detail, fontSize = 14.sp, lineHeight = 19.sp, color = PantopusColors.appTextMuted)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Up to two tips only you see, each closable (remembered on this phone). Tapping one opens Edit profile. */
@Composable
internal fun OwnerTips(
    tips: List<OwnerTip>,
    onOpen: (OwnerTip) -> Unit,
    onDismiss: (OwnerTip) -> Unit,
) {
    if (tips.isEmpty()) return
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4).testTag("ownerTips"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        tips.forEach { tip ->
            val (icon, title, body) =
                when (tip) {
                    OwnerTip.Photo ->
                        Triple(PantopusIcon.Camera, "Add a photo", "Your initials show until you do. Only you see this tip.")
                    OwnerTip.Tagline ->
                        Triple(
                            PantopusIcon.Pencil,
                            "Write a tagline",
                            "One line about you, in bold under your name. Only you see this tip.",
                        )
                    OwnerTip.Skills ->
                        Triple(PantopusIcon.Hand, "Add what you help with", "Neighbors look for help nearby. Only you see this tip.")
                }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.xl))
                        .testTag("ownerTip_${tip.key}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clickable(role = Role.Button, onClick = { onOpen(tip) })
                            .padding(start = 14.dp, top = Spacing.s3, bottom = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Box(
                        modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.primary100),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.primary600)
                    }
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Text(
                            text = title,
                            fontSize = 15.sp,
                            lineHeight = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appText,
                        )
                        Text(text = body, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
                    }
                }
                ProfileIconButton(
                    icon = PantopusIcon.X,
                    label = "Hide this tip",
                    onClick = { onDismiss(tip) },
                    iconSize = 18.dp,
                    tint = PantopusColors.appTextMuted,
                    testTag = "ownerTipHide_${tip.key}",
                )
            }
        }
    }
}

/** "See all N posts" under your latest two: opens My posts. */
@Composable
internal fun SeeAllPostsButton(
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.s3)
                .testTag("ownerSeeAllPosts"),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}

/**
 * Below the tabs on your own page: "Your <month>" (only when last month wasn't all zero), "Your account" and Log out.
 * Every place the old Me screen opened stays reachable here, in ☰ or on the Place tab.
 */
@Composable
internal fun OwnerAccountSection(
    extras: OwnerExtras,
    navigation: OwnerNavigation,
    onOpenMonth: () -> Unit,
    onShareMonth: () -> Unit,
    onOpenInvite: () -> Unit,
    onLogOut: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).testTag("ownerAccountSection"),
        verticalArrangement = Arrangement.spacedBy(28.dp),
    ) {
        extras.receipt?.let(::ownerMonthLine)?.let { (title, line) ->
            OwnerMonthCard(title = title, line = line, onOpen = onOpenMonth, onShare = onShareMonth)
        }
        Column {
            Text(
                text = "Your account",
                fontSize = 20.sp,
                lineHeight = 25.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(bottom = 10.dp).semantics { heading() },
            )
            AboutCard(tag = "ownerAccountList") {
                AccountRow(PantopusIcon.Users, "Connections", extras.connectionsLabel, navigation.onOpenConnections, "ownerRowConnections")
                AboutDivider()
                AccountRow(PantopusIcon.Hand, "Support trains", null, navigation.onOpenSupportTrains, "ownerRowSupportTrains")
                AboutDivider()
                AccountRow(PantopusIcon.Bookmark, "Saved places", null, navigation.onOpenSavedPlaces, "ownerRowSavedPlaces")
                AboutDivider()
                AccountRow(
                    PantopusIcon.UserPlus,
                    "Invite neighbors",
                    extras.invite?.totalConverted?.takeIf { it > 0 }?.let { "$it joined" },
                    onOpenInvite,
                    "ownerRowInvite",
                )
                AboutDivider()
                AccountRow(PantopusIcon.Settings, "Settings & privacy", null, navigation.onOpenSettings, "ownerRowSettings")
                AboutDivider()
                AccountRow(PantopusIcon.HelpCircle, "Help", null, navigation.onOpenHelp, "ownerRowHelp")
                navigation.debugRows.forEach { (key, label) ->
                    AboutDivider()
                    AccountRow(PantopusIcon.Wrench, label, null, { navigation.onDebugRow(key) }, "ownerRowDebug_$key")
                }
            }
            Row(
                modifier =
                    Modifier
                        .padding(top = Spacing.s4)
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .clickable(role = Role.Button, onClick = onLogOut)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                        .testTag("ownerLogOut"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PantopusIconImage(icon = PantopusIcon.DoorOpen, contentDescription = null, size = 20.dp, tint = PantopusColors.error)
                Text(text = "Log out", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.error)
            }
        }
        Spacer(Modifier.height(Spacing.s6))
    }
}

@Composable
private fun AccountRow(
    icon: PantopusIcon,
    title: String,
    value: String?,
    onClick: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(start = Spacing.s4, end = 14.dp, top = 10.dp, bottom = 10.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appTextStrong)
        Text(text = title, fontSize = 16.sp, lineHeight = 21.sp, color = PantopusColors.appText, modifier = Modifier.weight(1f))
        value?.let { Text(text = it, fontSize = 15.sp, lineHeight = 20.sp, color = PantopusColors.appTextMuted) }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun OwnerMonthCard(
    title: String,
    line: String,
    onOpen: () -> Unit,
    onShare: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("ownerMonthLine"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .clickable(role = Role.Button, onClickLabel = "See last month", onClick = onOpen)
                    .padding(start = 14.dp, top = Spacing.s3, bottom = Spacing.s3, end = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Hand, contentDescription = null, size = 18.dp, tint = PantopusColors.home)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(text = line, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
            }
        }
        Box(
            modifier =
                Modifier
                    .padding(end = Spacing.s3)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                    .clickable(role = Role.Button, onClick = onShare)
                    .padding(horizontal = Spacing.s4, vertical = 10.dp)
                    .testTag("ownerMonthShare"),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Share", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
    }
}

/** Last month in full (the receipt card the Me screen had); also where the `monthly_receipt` push lands. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun OwnerReceiptSheet(
    receipt: MonthlyReceiptDto,
    onShare: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("ownerReceiptSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s6),
        ) {
            MonthlyReceiptCard(receipt = receipt, startExpanded = true, onShare = onShare)
        }
    }
}

/** Invite neighbors: the invite card the Me screen had, with its progress and Share. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun OwnerInviteSheet(
    progress: InviteProgressDto,
    onShare: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("ownerInviteSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s6),
        ) {
            InviteProgressCard(progress = progress, onShare = onShare)
        }
    }
}

/**
 * Previewing as anyone with the link: signed-out visitors can't read posts, so the page says so instead of a list
 * (CONTRACT: `sign_in_required`). The Sign in button is what they'd see; in a preview it does nothing.
 */
@Composable
internal fun PostsForNeighborsCard(firstName: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s5, vertical = Spacing.s6)
                .testTag("ownerPreviewPostsForNeighbors"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 22.dp, tint = PantopusColors.appTextSecondary)
        }
        Text(
            text = "Posts are for neighbors",
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3).semantics { heading() },
        )
        Text(
            text = "Sign in or join Pantopus to see $firstName's posts and pinned posts.",
            fontSize = 15.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp).widthIn(max = 280.dp),
        )
        Box(
            modifier =
                Modifier
                    .padding(top = Spacing.s4)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Sign in", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
    }
}

/** The preview couldn't be shown: that audience can't open your profile, or the read failed. */
@Composable
internal fun PreviewProblemCard(
    closed: Boolean,
    audience: PreviewAudience,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s5)
                .testTag(if (closed) "ownerPreviewClosed" else "ownerPreviewFailed"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = if (closed) "${audience.label} can't open your profile" else "Couldn't load the preview",
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                if (closed) {
                    // A private or registered-only profile (Edit profile) or "Who can find you" (Settings & privacy).
                    "Your privacy settings keep your profile from them. Change who can see your profile in Edit profile, " +
                        "or who can find you in Settings & privacy."
                } else {
                    "Check your connection and try again."
                },
            fontSize = 15.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
        )
        if (!closed) {
            ProfileActionButton(title = "Try again", icon = PantopusIcon.RefreshCw, primary = false, onClick = onRetry)
        }
    }
}

/** Your own page's buttons: Edit profile and Preview as ▾ (`Own.dc.html`). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OwnerHeaderActions(
    onEditProfile: () -> Unit,
    onPreviewAs: () -> Unit,
) {
    ProfileActionRow(profileLargeText()) {
        ProfileActionButton(
            title = "Edit profile",
            icon = PantopusIcon.Pencil,
            primary = true,
            onClick = onEditProfile,
            modifier = Modifier.weight(1f),
            testTag = "publicProfileEditProfile",
        )
        ProfileActionButton(
            title = "Preview as",
            icon = PantopusIcon.Eye,
            primary = false,
            onClick = onPreviewAs,
            modifier = Modifier.weight(1f),
            trailingIcon = PantopusIcon.ChevronDown,
            testTag = "ownerPreviewAs",
            clickLabel = "Choose who to preview your profile as",
        )
    }
}

/**
 * The buttons that audience would see on your profile. In a preview they do nothing: it shows the page, it doesn't
 * act on it.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PreviewHeaderActions(
    audience: PreviewAudience,
    firstName: String,
) {
    ProfileActionRow(profileLargeText()) {
        when (audience) {
            PreviewAudience.Anyone ->
                ProfileActionButton(
                    title = "Join Pantopus to connect with $firstName",
                    icon = PantopusIcon.UserPlus,
                    primary = true,
                    onClick = {},
                    modifier = Modifier.weight(1f),
                    testTag = "ownerPreviewJoin",
                )
            PreviewAudience.Neighbors -> {
                ProfileActionButton("Connect", PantopusIcon.UserPlus, primary = true, onClick = {}, modifier = Modifier.weight(1f))
                ProfileActionButton("Message", PantopusIcon.MessageSquare, primary = false, onClick = {}, modifier = Modifier.weight(1f))
            }
            PreviewAudience.Connections -> {
                ProfileActionButton("Message", PantopusIcon.MessageSquare, primary = true, onClick = {}, modifier = Modifier.weight(1f))
                ProfileActionButton(
                    title = "Connected",
                    icon = PantopusIcon.Check,
                    primary = false,
                    onClick = {},
                    modifier = Modifier.weight(1f),
                    trailingIcon = PantopusIcon.ChevronDown,
                )
            }
        }
    }
}

/**
 * Preview as: the page exactly as [ProfilePreviewState.audience] gets it, under a banner with Done; while it loads,
 * placeholders; if that audience can't open your profile, or the read failed, it says so.
 */
@Composable
internal fun OwnerPreviewFrame(
    preview: ProfilePreviewState,
    onDone: () -> Unit,
    onRetry: () -> Unit,
    onOpenGig: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    when (preview) {
        is ProfilePreviewState.Loaded -> {
            var tab by rememberSaveable(preview.audience) { mutableStateOf(LocalProfileTab.Posts) }
            LocalProfileLoadedFrame(
                content = preview.content,
                selectedTab = tab,
                actions = ProfileActionsState(),
                callbacks = ProfileActionCallbacks(),
                onBack = onDone,
                onSelectTab = { tab = it },
                onOverflow = {},
                onOpenGig = onOpenGig,
                onOpenProfile = onOpenProfile,
                onOpenLink = onOpenLink,
                postCards = preview.cards,
                mode = ProfileFrameMode.Preview(audience = preview.audience, onDone = onDone),
            )
        }
        else ->
            Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("ownerPreviewPending")) {
                PreviewBanner(audience = preview.audience, onDone = onDone)
                when (preview) {
                    is ProfilePreviewState.Closed -> PreviewProblemCard(closed = true, audience = preview.audience, onRetry = onRetry)
                    is ProfilePreviewState.Failed -> PreviewProblemCard(closed = false, audience = preview.audience, onRetry = onRetry)
                    else ->
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(Spacing.s5),
                            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                        ) {
                            Shimmer(width = 84.dp, height = 84.dp, cornerRadius = 42.dp)
                            Shimmer(width = 200.dp, height = 24.dp, cornerRadius = Radii.sm)
                            Shimmer(width = 280.dp, height = 16.dp, cornerRadius = Radii.sm)
                            Shimmer(width = 320.dp, height = 48.dp, cornerRadius = Radii.lg)
                        }
                }
            }
    }
}
