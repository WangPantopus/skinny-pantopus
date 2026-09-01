@file:Suppress("MagicNumber", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.businesses

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * A08 — "My businesses". Bespoke avatar-first row list tinted with the
 * Business identity violet. Renders the enriched
 * `GET /api/businesses/my-businesses` projection (stats / team /
 * verification) as A08 cards, with a violet building FAB and a proof-led
 * empty state. Mirrors the iOS `MyBusinessesView`. The "Primary" badge
 * from the design is omitted (no primary-business concept in the backend).
 */
@Composable
fun MyBusinessesScreen(
    onOpenBusiness: (String) -> Unit,
    onRegister: () -> Unit,
    onClaim: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    viewModel: MyBusinessesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenBusiness = onOpenBusiness, onRegister = onRegister, onClaim = onClaim)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMyBusinessesViewed)
    }

    Scaffold(
        containerColor = PantopusColors.appBg,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "My businesses",
                        style = PantopusTextStyle.body,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            PantopusIconImage(
                                icon = PantopusIcon.ChevronLeft,
                                contentDescription = "Back",
                                tint = PantopusColors.appText,
                            )
                        }
                    }
                },
                colors =
                    TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = PantopusColors.appSurface,
                        titleContentColor = PantopusColors.appText,
                    ),
            )
        },
        floatingActionButton = {
            if (state !is MyBusinessesUiState.Empty) {
                AddBusinessFab(onClick = onRegister)
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize().testTag("myBusinessesContainer")) {
            when (val s = state) {
                is MyBusinessesUiState.Loading -> MyBusinessesSkeleton()
                is MyBusinessesUiState.Loaded -> LoadedList(s.cards, onOpen = viewModel::openBusiness)
                is MyBusinessesUiState.Empty -> MyBusinessesEmpty(onCreate = onRegister, onClaim = onClaim)
                is MyBusinessesUiState.Error -> MyBusinessesError(s.message, onRetry = viewModel::refresh)
            }
        }
    }
}

@Composable
private fun LoadedList(
    cards: List<BusinessCard>,
    onOpen: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("myBusinessesList"),
        contentPadding = PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        item { BusinessesIntroCard(cards.size) }
        items(cards, key = { it.id }) { card ->
            BusinessCardItem(card = card, onOpen = { onOpen(card.id) })
        }
    }
}

// MARK: Intro card

@Composable
private fun BusinessesIntroCard(count: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg.copy(alpha = 0.4f))
                .padding(Spacing.s3)
                .testTag("myBusinessesIntroCard"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Building2, null, size = 18.dp, tint = PantopusColors.business)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (count == 1) "1 verified business" else "$count verified businesses",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Tap any business to manage its inbox, gigs, and reviews",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: Business card

@Composable
private fun BusinessCardItem(
    card: BusinessCard,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .testTag("businessCard.${card.id}"),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BusinessLogoTile(card)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = card.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    card.categoryLabel?.let { cat ->
                        Text(cat, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong, maxLines = 1)
                        Text("·", fontSize = 11.sp, color = PantopusColors.appTextMuted)
                    }
                    PantopusIconImage(PantopusIcon.MapPin, null, size = 11.dp, tint = PantopusColors.appTextMuted)
                    Text(
                        card.locality,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    card.role?.let { role -> StatusChip(role.label, role.variant, icon = role.icon) }
                    if (card.teamCount > 0) {
                        TeamStack(card.teamInitials, card.teamCount)
                        Text("${card.teamCount} on team", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
            PantopusIconImage(PantopusIcon.ChevronRight, null, size = 18.dp, tint = PantopusColors.appTextSecondary)
        }
        Spacer(Modifier.height(Spacing.s3))
        if (card.pending) PendingStrip(onResume = onOpen) else StatsBand(card)
    }
}

@Composable
private fun BusinessLogoTile(card: BusinessCard) {
    Box(modifier = Modifier.size(56.dp)) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(if (card.pending) PantopusColors.warning else card.category.color),
            contentAlignment = Alignment.Center,
        ) {
            if (card.logoUrl != null) {
                AsyncImage(
                    model = card.logoUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(56.dp).clip(RoundedCornerShape(Radii.xl)),
                )
            } else {
                PantopusIconImage(card.category.icon, null, size = 26.dp, strokeWidth = 1.9f, tint = PantopusColors.appTextInverse)
            }
        }
        // Verification / pending badge overlay.
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 3.dp, y = 3.dp)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(if (card.verified) PantopusColors.business else PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (card.verified) PantopusIcon.Check else PantopusIcon.Hourglass,
                    contentDescription = if (card.verified) "Verified" else "Verification pending",
                    size = 11.dp,
                    strokeWidth = 3f,
                    tint = if (card.verified) PantopusColors.appTextInverse else PantopusColors.warning,
                )
            }
        }
    }
}

@Composable
private fun TeamStack(
    initials: List<String>,
    total: Int,
) {
    val tones = listOf(StatusChipVariant.Business, StatusChipVariant.Personal, StatusChipVariant.Warning, StatusChipVariant.Success)
    val overflow = total - initials.size
    Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
        initials.forEachIndexed { index, text ->
            TeamChip(text, tones[index % tones.size])
        }
        if (overflow > 0) TeamChip("+$overflow", StatusChipVariant.Neutral)
    }
}

@Composable
private fun TeamChip(
    text: String,
    variant: StatusChipVariant,
) {
    Box(
        modifier = Modifier.size(20.dp).clip(CircleShape).background(variant.background),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = 8.5.sp, fontWeight = FontWeight.Bold, color = variant.foreground)
    }
}

@Composable
private fun StatsBand(card: BusinessCard) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatCell(PantopusIcon.MessageSquare, card.openChats.toString(), null, "Open chats", Modifier.weight(1f))
        StatDivider()
        StatCell(PantopusIcon.CalendarCheck, card.bookingsThisWeek.toString(), null, "This week", Modifier.weight(1f))
        StatDivider()
        StatCell(
            PantopusIcon.Star,
            card.ratingText,
            if (card.reviewCount > 0) "(${card.reviewCount})" else null,
            "Rating",
            Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatDivider() {
    Box(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s2)
                .width(1.dp)
                .height(26.dp)
                .background(PantopusColors.appBorder),
    )
}

@Composable
private fun StatCell(
    icon: PantopusIcon,
    value: String,
    sub: String?,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(icon, null, size = Radii.lg, tint = PantopusColors.appTextSecondary)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (sub != null) Text(sub, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextMuted)
        }
        Text(label, fontSize = 10.sp, color = PantopusColors.appTextMuted)
    }
}

@Composable
private fun PendingStrip(onResume: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg.copy(alpha = 0.5f))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(PantopusIcon.Hourglass, null, size = 14.dp, tint = PantopusColors.warning)
        Column(modifier = Modifier.weight(1f)) {
            Text("Verification pending", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.warning)
            Text("Earn the violet verified mark", fontSize = 10.5.sp, color = PantopusColors.warning.copy(alpha = 0.85f))
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .clickable(onClick = onResume)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text("Verify", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.warning)
            PantopusIconImage(PantopusIcon.ArrowRight, null, size = 11.dp, tint = PantopusColors.warning)
        }
    }
}

@Composable
private fun AddBusinessFab(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark)))
                .clickable(onClick = onClick)
                .testTag("myBusinessesFab"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(PantopusIcon.Building2, "Create a business", size = Radii.xl3, tint = PantopusColors.appTextInverse)
    }
}

// MARK: Empty

@Composable
private fun MyBusinessesEmpty(
    onCreate: () -> Unit,
    onClaim: () -> Unit,
) {
    val proofs =
        listOf(
            Triple(PantopusIcon.IdCard, "EIN / Tax ID", "IRS-issued · verified within 1 business day"),
            Triple(PantopusIcon.FileText, "State registration certificate", "Upload Articles of Incorporation or DBA"),
            Triple(PantopusIcon.CreditCard, "Linked payment processor", "Stripe, Square, or Toast · instant"),
        )
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6)
                .padding(top = Spacing.s16)
                .testTag("myBusinessesEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        // Disc with check overlay.
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier.size(96.dp).clip(CircleShape).background(PantopusColors.businessBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.Building2, null, size = 40.dp, strokeWidth = 1.7f, tint = PantopusColors.business)
            }
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape).background(PantopusColors.business),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.Check, null, size = Radii.xl, strokeWidth = 3f, tint = PantopusColors.appTextInverse)
            }
        }
        Text(
            "Create your first verified business page",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Reach repeat clients who know you, take quotes inside Pantopus, and earn the violet verified mark. Pick a proof to start.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            proofs.forEach { (icon, title, sub) -> ProofRow(icon, title, sub, onCreate) }
        }
        // Gradient CTA.
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark)))
                    .clickable(onClick = onCreate)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                    .testTag("myBusinessesCreate"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(PantopusIcon.Building2, null, size = Radii.xl, tint = PantopusColors.appTextInverse)
            Text("Create a business", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextInverse)
        }
        Row(
            modifier = Modifier.clickable(onClick = onClaim).testTag("myBusinessesClaim").padding(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text("Already listed? Claim an existing page", fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
            PantopusIconImage(PantopusIcon.ArrowUpRight, null, size = Radii.lg, tint = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun ProofRow(
    icon: PantopusIcon,
    title: String,
    sub: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, null, size = Radii.xl, tint = PantopusColors.business)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(sub, fontSize = 11.sp, color = PantopusColors.appTextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = Radii.xl, tint = PantopusColors.appTextMuted)
    }
}

// MARK: Loading + error

@Composable
private fun MyBusinessesSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 60.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        repeat(3) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Shimmer(width = 56.dp, height = 56.dp, cornerRadius = Radii.xl)
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Shimmer(width = 160.dp, height = 14.dp)
                        Shimmer(width = 120.dp, height = 11.dp)
                        Shimmer(width = 90.dp, height = 18.dp, cornerRadius = Radii.pill)
                    }
                }
                Shimmer(width = 320.dp, height = 44.dp, cornerRadius = Radii.md, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun MyBusinessesError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
    ) {
        PantopusIconImage(PantopusIcon.AlertCircle, null, size = 40.dp, tint = PantopusColors.error)
        Text("Couldn't load your businesses", style = PantopusTextStyle.h3, color = PantopusColors.appText)
        Text(
            message,
            fontSize = 14.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.business)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3),
        ) {
            Text("Try again", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextInverse)
        }
    }
}
