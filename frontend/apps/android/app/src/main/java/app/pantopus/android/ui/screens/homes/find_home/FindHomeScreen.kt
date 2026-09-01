@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.homes.find_home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homediscovery.DiscoveredHomeDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag applied to the Find-or-Add-Home screen root. */
const val FIND_HOME_SCREEN_TAG: String = "findHome"

/**
 * A12.1 "Find or Add Home" — the discovery surface RN reaches from
 * `homes/find`. Search public-preview homes, tap one to start an
 * ownership claim, add the missing address, or paste an invite code.
 */
@Composable
fun FindHomeScreen(
    onBack: () -> Unit,
    onOpenClaimOwnership: (String) -> Unit,
    onOpenAddHome: () -> Unit,
    onOpenInviteToken: (String) -> Unit,
    viewModel: FindHomeViewModel = hiltViewModel(),
) {
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val inviteExpanded by viewModel.inviteSectionExpanded.collectAsStateWithLifecycle()
    val inviteCode by viewModel.inviteCode.collectAsStateWithLifecycle()
    val isResolvingInvite by viewModel.isResolvingInvite.collectAsStateWithLifecycle()
    val inviteError by viewModel.inviteError.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            is FindHomeOutboundEvent.OpenClaimOwnership -> {
                viewModel.acknowledgeEvent()
                onOpenClaimOwnership(event.homeId)
            }
            FindHomeOutboundEvent.OpenAddHome -> {
                viewModel.acknowledgeEvent()
                onOpenAddHome()
            }
            is FindHomeOutboundEvent.OpenInviteToken -> {
                viewModel.acknowledgeEvent()
                onOpenInviteToken(event.token)
            }
            null -> Unit
        }
    }

    OfflineBannerHost(isOffline = !online) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag(FIND_HOME_SCREEN_TAG),
        ) {
            FindHomeTopBar(onBack = onBack)
            FindHomeSearchHeader(
                query = query,
                hint = (state as? FindHomeUiState.Idle)?.hint,
                onQueryChange = viewModel::updateQuery,
                onSubmit = viewModel::submitSearch,
                onClear = viewModel::clearQuery,
            )
            Box(modifier = Modifier.weight(1f)) {
                when (val current = state) {
                    is FindHomeUiState.Idle ->
                        FindHomeIdleFrame(onAddMissing = viewModel::addMissingHome)
                    FindHomeUiState.Loading -> FindHomeLoadingFrame()
                    is FindHomeUiState.Loaded ->
                        FindHomeResults(
                            homes = current.homes,
                            onSelect = viewModel::selectHome,
                            onAddMissing = viewModel::addMissingHome,
                        )
                    FindHomeUiState.Empty ->
                        FindHomeEmptyFrame(onAddMissing = viewModel::addMissingHome)
                    is FindHomeUiState.Error ->
                        FindHomeErrorFrame(message = current.message, onRetry = viewModel::refresh)
                }
            }
            FindHomeInviteSection(
                expanded = inviteExpanded,
                code = inviteCode,
                isResolving = isResolvingInvite,
                error = inviteError,
                onToggle = viewModel::toggleInviteSection,
                onCodeChange = viewModel::updateInviteCode,
                onSubmit = viewModel::submitInviteCode,
            )
        }
    }
}

// MARK: - Chrome

@Composable
private fun FindHomeTopBar(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(Spacing.s12)
                        .clickable(role = Role.Button, onClick = onBack)
                        .testTag("findHomeBack")
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Text(
                text = "Find or Add Home",
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Box(modifier = Modifier.size(Spacing.s12))
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun FindHomeSearchHeader(
    query: String,
    hint: String?,
    onQueryChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onClear: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text(
                        text = "Search address (street + city + zip)",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextMuted,
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
                    modifier = Modifier.fillMaxWidth().testTag("findHomeSearchField"),
                )
            }
            if (query.isNotEmpty()) {
                Box(
                    modifier =
                        Modifier
                            .size(Spacing.s8)
                            .clickable(role = Role.Button, onClick = onClear)
                            .testTag("findHomeSearchClear")
                            .semantics { contentDescription = "Clear search" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        hint?.let {
            Text(
                text = it,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("findHomeSearchHint"),
            )
        }
    }
}

// MARK: - Result phases

@Composable
private fun FindHomeIdleFrame(onAddMissing: () -> Unit) {
    EmptyState(
        icon = PantopusIcon.Search,
        headline = "Search for your home",
        subcopy = "Enter a street address, city, or ZIP to find a home that's already on Pantopus.",
        ctaTitle = "Add missing address",
        onCta = onAddMissing,
        tint = PantopusColors.homeBg,
        accent = PantopusColors.home,
        modifier = Modifier.testTag("findHomeIdle"),
    )
}

@Composable
private fun FindHomeEmptyFrame(onAddMissing: () -> Unit) {
    EmptyState(
        icon = PantopusIcon.Home,
        headline = "No homes found",
        subcopy = "We couldn't find a home matching that address. Add it and we'll verify it with you.",
        ctaTitle = "Add missing address",
        onCta = onAddMissing,
        tint = PantopusColors.homeBg,
        accent = PantopusColors.home,
        modifier = Modifier.testTag("findHomeEmpty"),
    )
}

@Composable
private fun FindHomeLoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("findHomeLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(5) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Shimmer(width = Spacing.s10, height = Spacing.s10, cornerRadius = Radii.md)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 190.dp, height = 14.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                }
            }
        }
    }
}

@Composable
private fun FindHomeErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6)
                .testTag("findHomeError"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 32.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = "Couldn't search homes",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Box(
            modifier =
                Modifier
                    .padding(top = Spacing.s4)
                    .heightIn(min = Spacing.s12)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(role = Role.Button, onClick = onRetry)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                    .testTag("findHomeRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Retry", style = PantopusTextStyle.body, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
private fun FindHomeResults(
    homes: List<DiscoveredHomeDto>,
    onSelect: (DiscoveredHomeDto) -> Unit,
    onAddMissing: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("findHomeResults"),
        contentPadding =
            PaddingValues(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        items(homes, key = { it.id }) { home ->
            FindHomeResultRow(home = home, onClick = { onSelect(home) })
        }
        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = Spacing.s12)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .clickable(role = Role.Button, onClick = onAddMissing)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                        .testTag("findHomeAddMissing"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.PlusCircle,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Add missing address",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun FindHomeResultRow(
    home: DiscoveredHomeDto,
    onClick: () -> Unit,
) {
    val primaryLine =
        home.address?.trim()?.takeIf { it.isNotEmpty() }
            ?: home.name?.trim()?.takeIf { it.isNotEmpty() }
            ?: "Unnamed home"
    val secondaryLine =
        listOfNotNull(home.city, home.state, home.zipcode)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString(", ")
            .takeIf { it.isNotEmpty() }
    val badge =
        when {
            home.isMember -> "Member"
            home.claimStatus == "pending" -> "Pending"
            home.claimStatus == "verified" -> "Claimed"
            else -> null
        }

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(Spacing.s3)
                .testTag("findHomeResult.${home.id}")
                .semantics { contentDescription = "$primaryLine. ${secondaryLine.orEmpty()}" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(Spacing.s10)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Home,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.home,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = primaryLine,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            secondaryLine?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (badge != null) {
            Text(
                text = badge,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

// MARK: - Invite code

@Composable
private fun FindHomeInviteSection(
    expanded: Boolean,
    code: String,
    isResolving: Boolean,
    error: String?,
    onToggle: () -> Unit,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val submitEnabled = !isResolving && code.trim().isNotEmpty()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s4)
                .testTag("findHomeInviteSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Spacing.s12)
                    .clickable(role = Role.Button, onClick = onToggle)
                    .testTag("findHomeInviteToggle")
                    .semantics {
                        contentDescription =
                            if (expanded) "Hide invite code field" else "Enter an invite code"
                    },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ScanLine,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Have an invite code?",
                style = PantopusTextStyle.body,
                color = PantopusColors.primary600,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
        }
        if (expanded) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = Spacing.s12)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (code.isEmpty()) {
                        Text(
                            text = "Enter a home invite code to continue.",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    BasicTextField(
                        value = code,
                        onValueChange = onCodeChange,
                        singleLine = true,
                        textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                        cursorBrush = SolidColor(PantopusColors.primary600),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { onSubmit() }),
                        modifier = Modifier.fillMaxWidth().testTag("findHomeInviteField"),
                    )
                }
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = Spacing.s12)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(
                                if (submitEnabled) {
                                    PantopusColors.primary600
                                } else {
                                    PantopusColors.appSurfaceSunken
                                },
                            ).clickable(enabled = submitEnabled, role = Role.Button, onClick = onSubmit)
                            .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                            .testTag("findHomeInviteSubmit"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (isResolving) "Checking…" else "Go",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
            error?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("findHomeInviteError"),
                )
            }
        }
    }
}
