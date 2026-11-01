@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.shared.feed.FeedAvatarTint
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage

/**
 * The profile header from the PRF drawings (`Main.dc.html`, iPhone frames; Android keeps the order, copy and
 * colors with its own controls): no banner, the photo or initials, the name that wraps, @username, one trust
 * line that explains itself, the tagline in bold, a bio of up to four lines with "more", then the actions,
 * which wrap instead of clipping. From 150% font the header stacks, the trust facts take a line each and the
 * buttons go full width (`LargestText.dc.html`).
 */

/** From this font scale the header stacks and the buttons go full width. */
internal const val PROFILE_LARGE_TEXT_SCALE = 1.5f

/** True at large font sizes, where the header stacks. */
@Composable
internal fun profileLargeText(): Boolean = LocalDensity.current.fontScale >= PROFILE_LARGE_TEXT_SCALE

private const val BIO_COLLAPSED_LINES = 4

/** The 48 dp minimum Android touch target. */
private val TOUCH_TARGET = 48.dp

private val PROFILE_AVATAR_PALETTE =
    listOf(FeedAvatarTint.SkyDeep, FeedAvatarTint.Green, FeedAvatarTint.Violet, FeedAvatarTint.Rose, FeedAvatarTint.Slate)

/**
 * PRF's one rule for a person's initials color, the same on iOS, Android and web (QUESTIONS.md, 2026-11-01): the
 * account id, lowercased, picks one of five colors by the sum of its character codes. Every avatar on the profile
 * screens uses it, so a person keeps one color there.
 */
internal fun profileAvatarTint(seed: String?): FeedAvatarTint {
    val key = seed?.trim()?.lowercase().orEmpty()
    if (key.isEmpty()) return FeedAvatarTint.SkyDeep
    return PROFILE_AVATAR_PALETTE[key.sumOf { it.code } % PROFILE_AVATAR_PALETTE.size]
}

/** Initials from the first and last word of the name ("Rowan Park" → RP, "Ava" → A), as on the other apps. */
internal fun profileInitials(name: String): String {
    val words = name.removePrefix("@").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    val first = words.firstOrNull()?.firstOrNull()?.uppercaseChar() ?: return ""
    val last = words.drop(1).lastOrNull()?.firstOrNull()?.uppercaseChar()
    return if (last == null) "$first" else "$first$last"
}

/** Top bar of someone's profile: Back and ⋯ (Share, Follow, Block, Report), each a 48 dp target. */
@Composable
internal fun ProfileTopBar(
    onBack: () -> Unit,
    onMore: (() -> Unit)?,
    moreLabel: String = "More: share, follow, block or report",
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ProfileIconButton(
            icon = PantopusIcon.ChevronLeft,
            label = "Back",
            onClick = onBack,
            iconSize = 26.dp,
            testTag = "publicProfileBack",
        )
        Spacer(Modifier.weight(1f))
        if (onMore != null) {
            ProfileIconButton(
                icon = PantopusIcon.MoreHorizontal,
                label = moreLabel,
                onClick = onMore,
                iconSize = 24.dp,
                testTag = "publicProfileMore",
            )
        }
    }
}

@Composable
internal fun ProfileIconButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    iconSize: Dp = 24.dp,
    tint: androidx.compose.ui.graphics.Color = PantopusColors.appText,
    testTag: String? = null,
) {
    Box(
        modifier =
            Modifier
                .size(TOUCH_TARGET)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = label }
                .then(testTag?.let { Modifier.testTag(it) } ?: Modifier),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = iconSize, tint = tint)
    }
}

/**
 * The photo, or initials on the feed's avatar color. The initials keep their size whatever the font scale: the
 * circle doesn't grow with the text, and screen readers skip the avatar (the name follows it).
 */
@Composable
internal fun ProfileAvatar(
    name: String,
    photoUrl: String?,
    seed: String?,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val initials = remember(name) { profileInitials(name) }
    val initialsSize = with(LocalDensity.current) { (size.value * 0.36f).dp.toSp() }
    val disc: @Composable () -> Unit = {
        Box(
            modifier = Modifier.fillMaxSize().background(profileAvatarTint(seed).color),
            contentAlignment = Alignment.Center,
        ) {
            if (initials.isEmpty()) {
                PantopusIconImage(
                    icon = PantopusIcon.User,
                    contentDescription = null,
                    size = size * 0.45f,
                    tint = PantopusColors.appTextInverse,
                )
            } else {
                Text(
                    text = initials,
                    fontSize = initialsSize,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    maxLines = 1,
                )
            }
        }
    }
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .clearAndSetSemantics { },
    ) {
        if (photoUrl.isNullOrBlank()) {
            disc()
        } else {
            SubcomposeAsyncImage(
                model = photoUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { disc() },
                error = { disc() },
            )
        }
    }
}

/**
 * Name, @username, trust line, tagline and bio, then [actions]. [accountNameLine] is the owner's gray "stays
 * private" line; null hides it.
 */
@Composable
internal fun ProfileIdentityHeader(
    header: PublicProfileHeader,
    bio: String?,
    onTrustClick: () -> Unit,
    modifier: Modifier = Modifier,
    accountNameLine: String? = null,
    actions: @Composable () -> Unit,
) {
    val large = profileLargeText()
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s2)
                .testTag("publicProfileHeader"),
    ) {
        if (large) {
            ProfileAvatar(
                name = header.avatarName ?: header.displayName,
                photoUrl = header.avatarUrl,
                seed = header.avatarSeed,
                size = 64.dp,
            )
            Spacer(Modifier.height(Spacing.s4))
            ProfileNameBlock(header)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileAvatar(
                    name = header.avatarName ?: header.displayName,
                    photoUrl = header.avatarUrl,
                    seed = header.avatarSeed,
                    size = 84.dp,
                )
                Spacer(Modifier.size(Spacing.s4))
                Column(modifier = Modifier.weight(1f)) {
                    ProfileNameBlock(header)
                }
            }
        }
        ProfileTrustLine(
            trust = header.trust,
            stacked = large,
            onClick = onTrustClick,
            modifier = Modifier.padding(top = 6.dp),
        )
        if (accountNameLine != null) {
            Row(
                modifier = Modifier.padding(top = Spacing.s1).testTag("publicProfileAccountNameLine"),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(text = accountNameLine, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
            }
        }
        header.tagline?.let { tagline ->
            Text(
                text = tagline,
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(top = 10.dp).testTag("publicProfileTagline"),
            )
        }
        bio?.trim()?.takeIf { it.isNotEmpty() }?.let { ProfileBio(it) }
        Spacer(Modifier.height(18.dp))
        actions()
    }
}

@Composable
private fun ProfileNameBlock(header: PublicProfileHeader) {
    Text(
        text = header.displayName,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appText,
        modifier = Modifier.semantics { heading() }.testTag("publicProfileName"),
    )
    header.handle?.takeIf { it.isNotBlank() }?.let { handle ->
        Text(
            text = if (handle.startsWith("@")) handle else "@$handle",
            fontSize = 15.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(top = 2.dp).testTag("publicProfileHandle"),
        )
    }
}

/** Up to four lines, then "more" (a 48 dp target) for the rest. */
@Composable
private fun ProfileBio(bio: String) {
    var expanded by rememberSaveable(bio) { mutableStateOf(false) }
    var overflows by remember(bio) { mutableStateOf(false) }
    Text(
        text = bio,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        color = PantopusColors.appTextStrong,
        maxLines = if (expanded) Int.MAX_VALUE else BIO_COLLAPSED_LINES,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (!expanded) overflows = it.hasVisualOverflow },
        modifier = Modifier.padding(top = 6.dp).testTag("publicProfileBio"),
    )
    if (overflows && !expanded) {
        // Sits right under the bio; the 48 dp target reaches below it.
        Box(
            modifier =
                Modifier
                    .heightIn(min = TOUCH_TARGET)
                    .clickable(role = Role.Button, onClickLabel = "Show the whole bio") { expanded = true }
                    .padding(top = 2.dp)
                    .testTag("publicProfileBioMore"),
            contentAlignment = Alignment.TopStart,
        ) {
            Text(text = "more", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        }
    }
}

/**
 * "Verified neighbor · Vancouver · Joined Oct 2026": only the facts the read gave. A tap explains what it means.
 * [stacked] puts each fact on its own line (large text).
 */
@Composable
internal fun ProfileTrustLine(
    trust: ProfileTrust,
    stacked: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val facts = listOfNotNull(trust.city, trust.joined)
    if (!trust.verifiedNeighbor && facts.isEmpty()) return
    // A button only for a verified home: the explainer is about the home check (as on iOS and web).
    val tapModifier =
        modifier
            .heightIn(min = TOUCH_TARGET)
            .then(
                if (trust.verifiedNeighbor) {
                    Modifier.clickable(role = Role.Button, onClickLabel = "Learn what this means", onClick = onClick)
                } else {
                    Modifier
                },
            )
            .testTag("publicProfileTrustLine")
    if (stacked) {
        Column(modifier = tapModifier.padding(vertical = Spacing.s1)) {
            if (trust.verifiedNeighbor) VerifiedNeighborLabel()
            facts.forEach { Text(text = it, fontSize = 15.sp, lineHeight = 20.sp, color = PantopusColors.appTextMuted) }
        }
        return
    }
    Row(
        modifier = tapModifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (trust.verifiedNeighbor) {
            PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 17.dp, tint = PantopusColors.home)
        }
        Text(
            text =
                buildAnnotatedString {
                    if (trust.verifiedNeighbor) {
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.home)) { append("Verified neighbor") }
                        if (facts.isNotEmpty()) append(" · ")
                    }
                    append(facts.joinToString(" · "))
                },
            fontSize = 15.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun VerifiedNeighborLabel() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 17.dp, tint = PantopusColors.home)
        Text(
            text = "Verified neighbor",
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.home,
        )
    }
}

/** What the trust line means, in plain words. */
@Composable
internal fun ProfileTrustExplainer(
    firstName: String,
    trust: ProfileTrust,
    isOwner: Boolean,
    onDismiss: () -> Unit,
) {
    val city = trust.city
    val body =
        when {
            isOwner && trust.verifiedNeighbor ->
                "Neighbors see “Verified neighbor” because you confirmed your home. Your address is never shown."
            isOwner -> "Verify your home and neighbors see “Verified neighbor” next to your name. Your address is never shown."
            trust.verifiedNeighbor && city != null -> "Pantopus confirmed $firstName lives in $city. Their address is never shown."
            trust.verifiedNeighbor -> "Pantopus confirmed where $firstName lives. Their address is never shown."
            else -> "$firstName hasn't verified a home on Pantopus yet."
        }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (trust.verifiedNeighbor) "Verified neighbor" else "Not verified yet") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(body)
                trust.joined?.let { Text("$it.", color = PantopusColors.appTextSecondary) }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.testTag("publicProfileTrustExplainerOk")) { Text("OK") }
        },
    )
}

/** What the header's actions show: the viewer's side of this person. */
internal data class ProfileActionsState(
    val isOwner: Boolean = false,
    val connection: ProfileConnection = ProfileConnection.None,
    /** Connect / Requested / the request banner / Connected show only once the relationship read answered. */
    val showsConnection: Boolean = false,
    val inFlight: Boolean = false,
    /** The relationship read is still running: Connect's place is held so the buttons don't jump. */
    val relationshipPending: Boolean = false,
)

internal data class ProfileActionCallbacks(
    val onConnect: () -> Unit = {},
    val onWithdraw: () -> Unit = {},
    val onAccept: () -> Unit = {},
    val onDecline: () -> Unit = {},
    val onDisconnect: () -> Unit = {},
    val onMessage: () -> Unit = {},
    val onEditProfile: () -> Unit = {},
)

/**
 * The actions by relationship: none → Connect + Message; request sent → Requested (tap to withdraw) + Message;
 * request received → "<name> wants to connect" with Accept / Not now above Message; connected → Message +
 * Connected ▾ (Disconnect); blocked → nothing. Your own profile shows Edit profile and never Message or Connect.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ProfileHeaderActions(
    state: ProfileActionsState,
    callbacks: ProfileActionCallbacks,
    firstName: String,
) {
    val large = profileLargeText()
    when {
        state.isOwner ->
            ProfileActionRow(large) {
                ProfileActionButton(
                    title = "Edit profile",
                    icon = PantopusIcon.Pencil,
                    primary = true,
                    onClick = callbacks.onEditProfile,
                    modifier = Modifier.weight(1f),
                    testTag = "publicProfileEditProfile",
                )
            }
        state.connection == ProfileConnection.Blocked -> Unit
        state.relationshipPending && !state.showsConnection ->
            ProfileActionRow(large) {
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = TOUCH_TARGET)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurfaceSunken)
                            .clearAndSetSemantics { }
                            .testTag("publicProfileActionPending"),
                )
                MessageButton(primary = false, onClick = callbacks.onMessage)
            }
        !state.showsConnection ->
            ProfileActionRow(large) { MessageButton(primary = true, onClick = callbacks.onMessage) }
        state.connection == ProfileConnection.PendingReceived ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                ConnectRequestBanner(
                    firstName = firstName,
                    inFlight = state.inFlight,
                    large = large,
                    onAccept = callbacks.onAccept,
                    onNotNow = callbacks.onDecline,
                )
                ProfileActionRow(large) { MessageButton(primary = false, onClick = callbacks.onMessage) }
            }
        else -> ProfileActionRow(large) { RelationshipButtons(state, callbacks, firstName) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowScope.RelationshipButtons(
    state: ProfileActionsState,
    callbacks: ProfileActionCallbacks,
    firstName: String,
) {
    when (state.connection) {
        ProfileConnection.None -> {
            ProfileActionButton(
                title = "Connect",
                icon = PantopusIcon.UserPlus,
                primary = true,
                onClick = callbacks.onConnect,
                modifier = Modifier.weight(1f),
                enabled = !state.inFlight,
                testTag = "publicProfileConnectCta",
            )
            MessageButton(primary = false, onClick = callbacks.onMessage)
        }
        // The filled button stays on the left, as on iOS and web.
        ProfileConnection.PendingSent -> {
            MessageButton(primary = true, onClick = callbacks.onMessage)
            ProfileActionButton(
                title = "Requested",
                icon = PantopusIcon.Clock,
                primary = false,
                onClick = callbacks.onWithdraw,
                modifier = Modifier.weight(1f),
                enabled = !state.inFlight,
                testTag = "publicProfileConnectCta",
                clickLabel = "Withdraw your request",
            )
        }
        ProfileConnection.Connected -> {
            MessageButton(primary = true, onClick = callbacks.onMessage)
            ConnectedMenuButton(firstName = firstName, enabled = !state.inFlight, onDisconnect = callbacks.onDisconnect)
        }
        ProfileConnection.PendingReceived, ProfileConnection.Blocked -> Unit
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowScope.MessageButton(
    primary: Boolean,
    onClick: () -> Unit,
) {
    ProfileActionButton(
        title = "Message",
        icon = PantopusIcon.MessageSquare,
        primary = primary,
        onClick = onClick,
        modifier = Modifier.weight(1f),
        testTag = "publicProfileMessage",
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowScope.ConnectedMenuButton(
    firstName: String,
    enabled: Boolean,
    onDisconnect: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier = Modifier.weight(1f)) {
        ProfileActionButton(
            title = "Connected",
            icon = PantopusIcon.Check,
            primary = false,
            onClick = { open = true },
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            trailingIcon = PantopusIcon.ChevronDown,
            testTag = "publicProfileConnectCta",
            clickLabel = "Connection options",
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("Disconnect from $firstName", color = PantopusColors.error) },
                leadingIcon = {
                    PantopusIconImage(icon = PantopusIcon.UserMinus, contentDescription = null, size = 20.dp, tint = PantopusColors.error)
                },
                onClick = {
                    open = false
                    onDisconnect()
                },
                modifier = Modifier.heightIn(min = TOUCH_TARGET).testTag("publicProfileDisconnect"),
            )
        }
    }
}

/** Two buttons side by side, or one per line from 150% font. They wrap rather than clip their labels. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ProfileActionRow(
    large: Boolean,
    content: @Composable FlowRowScope.() -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().testTag("publicProfileActions"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = if (large) 1 else 2,
        content = content,
    )
}

/**
 * A 48 dp (or taller) header button: filled sky for the main action, outlined for the other. The label wraps
 * onto a second line instead of clipping ("Mess").
 */
@Composable
internal fun ProfileActionButton(
    title: String,
    icon: PantopusIcon?,
    primary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    trailingIcon: PantopusIcon? = null,
    testTag: String? = null,
    clickLabel: String? = null,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val ink = if (primary) PantopusColors.appTextInverse else PantopusColors.appText
    Row(
        modifier =
            modifier
                .heightIn(min = TOUCH_TARGET)
                .alpha(if (enabled) 1f else DISABLED_BUTTON_ALPHA)
                .clip(shape)
                .then(
                    if (primary) {
                        Modifier.background(PantopusColors.primary600)
                    } else {
                        Modifier.background(PantopusColors.appSurface).border(1.dp, PantopusColors.appBorderStrong, shape)
                    },
                )
                .clickable(enabled = enabled, role = Role.Button, onClickLabel = clickLabel, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .then(testTag?.let { Modifier.testTag(it) } ?: Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        icon?.let { PantopusIconImage(icon = it, contentDescription = null, size = 19.dp, strokeWidth = 2.25f, tint = ink) }
        Text(
            text = title,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f, fill = false),
        )
        trailingIcon?.let { PantopusIconImage(icon = it, contentDescription = null, size = 15.dp, strokeWidth = 2.5f, tint = ink) }
    }
}

private const val DISABLED_BUTTON_ALPHA = 0.6f

/** "<name> wants to connect" with Accept / Not now. The note they wrote travels only in their notification. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ConnectRequestBanner(
    firstName: String,
    inFlight: Boolean,
    large: Boolean,
    onAccept: () -> Unit,
    onNotNow: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag("publicProfileRequestBanner"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.primary100),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.UserPlus, contentDescription = null, size = 20.dp, tint = PantopusColors.primary600)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$firstName wants to connect",
                    fontSize = 17.sp,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = "You'd see each other's connections-only posts.",
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        ProfileActionRow(large) {
            ProfileActionButton(
                title = "Accept",
                icon = PantopusIcon.Check,
                primary = true,
                onClick = onAccept,
                modifier = Modifier.weight(1f),
                enabled = !inFlight,
                testTag = "publicProfileAcceptRequest",
            )
            ProfileActionButton(
                title = "Not now",
                icon = null,
                primary = false,
                onClick = onNotNow,
                modifier = Modifier.weight(1f),
                enabled = !inFlight,
                testTag = "publicProfileDeclineRequest",
                clickLabel = "Decline the request",
            )
        }
    }
}
