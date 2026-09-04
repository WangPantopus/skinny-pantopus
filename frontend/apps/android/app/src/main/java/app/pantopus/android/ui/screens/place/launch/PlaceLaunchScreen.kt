package app.pantopus.android.ui.screens.place.launch

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlaceMoneyLead
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewAha
import app.pantopus.android.data.api.models.place.PlacePreviewAhaTone
import app.pantopus.android.data.api.models.place.PlacePreviewLockedSection
import app.pantopus.android.data.api.models.place.PlacePreviewPlaceRef
import app.pantopus.android.data.api.models.place.PlacePreviewSectionStatus
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlaceSectionView
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceDensityCard
import app.pantopus.android.ui.screens.place.components.PlaceGroupLabel
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.MarkVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusLockup
import app.pantopus.android.ui.theme.Spacing

@Composable
fun PlaceLaunchScreen(
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
    viewModel: PlaceLaunchViewModel = hiltViewModel(),
) {
    val step by viewModel.step.collectAsStateWithLifecycle()

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        when (val current = step) {
            LaunchStep.Hero -> Hero(viewModel, onSignIn, onCreateAccount)
            is LaunchStep.Preview ->
                PreviewBody(current.preview, onSignIn, onCreateAccount, onBack = viewModel::backToHero)
            is LaunchStep.Region -> RegionBody(current.message, onCreateAccount, onBack = viewModel::backToHero)
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun Hero(
    viewModel: PlaceLaunchViewModel,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val suggestions by viewModel.suggestions.collectAsStateWithLifecycle()
    val loading by viewModel.loadingPreview.collectAsStateWithLifecycle()

    // Signed-out root: nothing above us pads the status bar, so do it here.
    Column(modifier = Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 24.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusLockup(size = 22.dp, variant = MarkVariant.Light)
            // Demoted to the top bar so the address field is the first control.
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(start = 10.dp),
            ) {
                Text("🇺🇸", fontSize = 11.sp)
                Text("United States", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                "Sign in",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.clickable(onClick = onSignIn),
            )
        }

        // One job: get a stranger from a postcard to type their address. The
        // field is the hero, the proof line answers the privacy objection,
        // the example card shows what comes back. Scrolls only when it must.
        Column(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = 32.dp, bottom = 24.dp),
        ) {
            Text(
                "See what's true about your address.",
                fontSize = 31.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.87).sp,
                lineHeight = 37.sp,
                color = PantopusColors.appText,
            )
            Text(
                "Your flood risk, today's air, your home's value, and who your verified neighbors are — free, no account.",
                fontSize = 15.sp,
                lineHeight = 21.sp,
                color = PantopusColors.appTextSecondary,
            )

            AddressField(query = query, onChange = viewModel::onQueryChange, onClear = { viewModel.onQueryChange("") })

            if (query.isNotBlank() && suggestions.isNotEmpty()) {
                Column(
                    modifier =
                        Modifier.fillMaxWidth().clip(
                            RoundedCornerShape(14.dp),
                        ).background(PantopusColors.appSurface).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp)),
                ) {
                    suggestions.forEach { s ->
                        Row(
                            modifier =
                                Modifier.fillMaxWidth().clickable {
                                    viewModel.select(s)
                                }.padding(
                                    horizontal = 14.dp,
                                    vertical = 11.dp,
                                ),
                            horizontalArrangement = Arrangement.spacedBy(11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            PantopusIconImage(PantopusIcon.MapPin, null, size = 16.dp, strokeWidth = 2f, tint = PantopusColors.appTextMuted)
                            Column {
                                Text(s.primaryText, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                                s.secondaryText?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.appTextMuted) }
                            }
                        }
                    }
                }
            } else {
                PrimaryButton(title = "See your place", isLoading = loading, isEnabled = query.isNotBlank(), onClick = {
                    viewModel.loadPreview(query)
                }, modifier = Modifier.fillMaxWidth())
                PrivacyProof()
                ExampleCard(modifier = Modifier.padding(top = 8.dp))
                Text(
                    "Just here to follow someone or browse?",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.fillMaxWidth().clickable(onClick = onCreateAccount),
                )
            }
        }
    }
}

/** The privacy answer where the decision is made: what a neighbor sees, and what they never see. */
@Composable
private fun PrivacyProof() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp).testTag("startPrivacyProof"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            PantopusIcon.ShieldCheck,
            null,
            size = 15.dp,
            strokeWidth = 2.1f,
            tint = PantopusColors.home,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            buildAnnotatedString {
                append("Neighbors see a first name and a street. ")
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) {
                    append("Never your house number.")
                }
            },
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private data class ExampleReading(val icon: PantopusIcon, val label: String, val value: String, val tone: ExampleTone)

private enum class ExampleTone { GOOD, WATCH, NEUTRAL }

private val exampleReadings =
    listOf(
        ExampleReading(PantopusIcon.Wind, "Air today", "Good · AQI 24", ExampleTone.GOOD),
        ExampleReading(PantopusIcon.Waves, "Flood zone", "X · minimal", ExampleTone.GOOD),
        ExampleReading(PantopusIcon.TestTube, "Radon", "Zone 1 · test it", ExampleTone.WATCH),
        ExampleReading(PantopusIcon.Trash2, "Next pickup", "Tue · garbage + recycling", ExampleTone.NEUTRAL),
    )

/**
 * A glimpse of the answer in the dashboard's own row grammar. Static and
 * labeled as an example; nothing here pretends to be the reader's.
 */
@Composable
private fun ExampleCard(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth().placeCard().testTag("startExampleCard")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("EXAMPLE", fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.9.sp, color = PantopusColors.appTextMuted)
            Spacer(modifier = Modifier.weight(1f))
            Text("A home in Camas, WA", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        }
        exampleReadings.forEachIndexed { index, reading ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 60.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.appBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(reading.icon, null, size = 16.dp, strokeWidth = 2f, tint = PantopusColors.appTextSecondary)
                }
                Text(
                    reading.label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    val dot =
                        when (reading.tone) {
                            ExampleTone.GOOD -> PantopusColors.home
                            ExampleTone.WATCH -> PantopusColors.warning
                            ExampleTone.NEUTRAL -> PantopusColors.appTextMuted
                        }
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(dot))
                    Text(reading.value, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
                }
            }
        }
        Text(
            "Yours takes about three seconds and stays on this screen until you save it.",
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
        )
    }
}

@Composable
private fun AddressField(
    query: String,
    onChange: (String) -> Unit,
    onClear: () -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth().clip(
                RoundedCornerShape(14.dp),
            ).background(
                PantopusColors.appSurface,
            ).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.MapPin, null, size = 18.dp, strokeWidth = 2f, tint = PantopusColors.appTextMuted)
        Box(modifier = Modifier.weight(1f)) {
            if (query.isEmpty()) {
                Text("Type your home address", fontSize = 16.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = query,
                onValueChange = onChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 16.sp, color = PantopusColors.appText),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (query.isNotEmpty()) {
            PantopusIconImage(
                PantopusIcon.X,
                "Clear",
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
                modifier = Modifier.clickable(onClick = onClear),
            )
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun PreviewBody(
    preview: PlacePreview,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
    onBack: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.Top) {
                Box(
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(PantopusColors.appSurface).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        PantopusIcon.ChevronLeft,
                        "Back",
                        size = 20.dp,
                        strokeWidth = 2.5f,
                        tint = PantopusColors.appTextStrong,
                    )
                }
                Column(modifier = Modifier.weight(1f).padding(start = 4.dp)) {
                    Text(
                        "Your Place",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.4).sp,
                        color = PantopusColors.appText,
                    )
                    preview.place?.address?.let {
                        Text(
                            it,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Text(
                    "Sign in",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.clickable(onClick = onSignIn),
                )
            }
            Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth().placeCard().padding(14.dp).padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(PantopusColors.homeBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(PantopusIcon.Check, null, size = 22.dp, strokeWidth = 2.5f, tint = PantopusColors.home)
                    }
                    Text(
                        "Here's what's public about your address — a free, one-time look.",
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
                // A real dollar band when one exists for this address,
                // and nothing at all when it does not — the tiles carry
                // the page as before. Never synthesized client-side.
                // The aha card leads (Wedge v2 D1): the most surprising ready
                // fact, in the server's words.
                preview.aha?.takeIf { it.isRenderable }?.let { AhaCard(it, onCreateAccount) }
                preview.moneyLead?.takeIf { it.isRenderable }?.let { MoneyLeadCard(it) }
                // Every Band-A section through the dashboard's own cards;
                // older backends send only `free` and keep the three tiles.
                val sections = preview.sections.orEmpty()
                if (sections.isNotEmpty()) PreviewSections(sections, onCreateAccount)
                preview.free?.takeIf { sections.isEmpty() }?.let { free ->
                    PlaceGroupLabel(text = "Risk & readiness", modifier = Modifier.padding(top = 18.dp))
                    PlaceSectionCard(
                        title = "Flood",
                        icon = PantopusIcon.Waves,
                        state =
                            if (free.flood.status == PlacePreviewSectionStatus.READY) {
                                PlaceSectionCardState.LOADED
                            } else {
                                PlaceSectionCardState.UNAVAILABLE
                            },
                        value = free.flood.description ?: free.flood.zone?.let { "Zone $it" },
                        chip = free.flood.zone?.let { PlaceChipModel(PlaceChipTone.SUCCESS, free.flood.description ?: "Flood zone") },
                    )
                    PlaceGroupLabel(text = "Your block", modifier = Modifier.padding(top = 18.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PlaceDensityCard(bucket = free.density.bucket, label = free.density.label, ctaTitle = null, onTap = null)
                        if (free.area.status == PlacePreviewSectionStatus.READY) {
                            PlaceSectionCard(
                                title = "Homes here",
                                icon = PantopusIcon.Home,
                                state = PlaceSectionCardState.LOADED,
                                value = free.area.medianYearBuilt?.let { "Median built $it" } ?: free.area.note,
                                caption = free.area.note,
                            )
                        }
                    }
                }
                preview.locked?.takeIf { it.isNotEmpty() }?.let { locked ->
                    PlaceGroupLabel(text = "More with a free account", modifier = Modifier.padding(top = 18.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        locked.forEach { LockedPreviewCard(it, onCreateAccount) }
                    }
                }
                Spacer(modifier = Modifier.height(120.dp))
            }
        }
        Column(
            modifier =
                Modifier.align(
                    Alignment.BottomCenter,
                ).fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = 16.dp).padding(top = 14.dp, bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Create a free account to save this place and get daily updates",
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            PrimaryButton(title = "Create account", onClick = onCreateAccount, modifier = Modifier.fillMaxWidth())
            preview.place?.let { place -> ShareAddressLink(place) }
        }
    }
}

/**
 * The share card (Wedge v2 D5): the link is the preview of THIS address on
 * the web, whose OG image is rendered on the fly by `/api/og/place` —
 * nothing is stored. The system share sheet does the rest.
 */
@Composable
private fun ShareAddressLink(place: PlacePreviewPlaceRef) {
    val context = LocalContext.current
    val address = listOfNotNull(place.address, place.city, place.state, place.zipcode).filter { it.isNotBlank() }.joinToString(", ")
    if (address.isBlank()) return
    Row(
        modifier =
            Modifier
                .clickable {
                    val url = BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/') + "/start?address=" + Uri.encode(address)
                    val send =
                        Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "What's true about this address")
                            putExtra(Intent.EXTRA_TEXT, url)
                        }
                    context.startActivity(Intent.createChooser(send, "Share this address"))
                }
                .padding(vertical = 4.dp)
                .testTag("place.preview.share"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.Share, null, size = 14.dp, strokeWidth = 2f, tint = PantopusColors.primary600)
        Text("Share this address", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}

/**
 * The preview's lead figure (Wave 4). Present only when the backend
 * had a real benchmark — a census-tract NFIP premium band or a county
 * HUD fair-market rent — and it carries the scope it is true at so the
 * reader is not sold a county estimate as their own bill.
 */
@Composable
private fun MoneyLeadCard(lead: PlaceMoneyLead) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .placeCard()
                .padding(Spacing.s4)
                .padding(top = 14.dp)
                .testTag("place.preview.moneyLead"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.DollarSign, null, size = 19.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            Text(
                lead.headline,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 20.sp,
                color = PantopusColors.appText,
            )
        }
        // Guarded, the way iOS already guards them: an empty string here
        // rendered a bare gap where a disclosure belongs.
        if (lead.detail.isNotEmpty()) {
            Text(lead.detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
        // The scope disclosure, rendered STRUCTURALLY rather than trusted
        // to prose. Every `kind` the server emits today also puts the
        // scope in `detail`, so this is belt-and-braces — but a dollar
        // figure is the most believable thing on the page and the easiest
        // to read as being about THIS home, and the day a lead ships whose
        // `detail` omits it the figure would stand alone. Web has shown
        // this since Wave 4; both native clients decoded it and rendered
        // neither.
        val footer = scopeFooter(lead)
        if (footer.isNotEmpty()) {
            Text(
                footer,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("place.preview.moneyLead.scope"),
            )
        }
    }
}

/**
 * "FEMA · OpenFEMA NFIP policies · census tract-level, not this home"
 *
 * Mirrors the web footer and the iOS one. Either half may be absent, so
 * the parts are joined rather than formatted into a fixed template — an
 * empty source must not leave a leading separator.
 */
private fun scopeFooter(lead: PlaceMoneyLead): String =
    listOfNotNull(
        lead.source.takeIf { it.isNotEmpty() },
        lead.scope.takeIf { it.isNotEmpty() }?.let { "$it-level, not this home" },
    ).joinToString(" · ")

@Composable
private fun LockedPreviewCard(
    section: PlacePreviewLockedSection,
    onCreateAccount: () -> Unit,
) {
    val icon =
        when (section.groupId) {
            PlaceGroup.TODAY -> PantopusIcon.CloudSun
            PlaceGroup.YOUR_HOME -> PantopusIcon.Home
            PlaceGroup.HEALTH_ENVIRONMENT -> PantopusIcon.Droplets
            PlaceGroup.MONEY_SIGNALS -> PantopusIcon.Zap
            PlaceGroup.CIVIC -> PantopusIcon.Landmark
            PlaceGroup.RISK_READINESS -> PantopusIcon.Waves
            else -> PantopusIcon.MapPin
        }
    PlaceLockedCard(
        title = section.title,
        reason = section.reason,
        cta = if (section.unlock == app.pantopus.android.data.api.models.place.PlacePreviewUnlock.CLAIM) "Claim home" else "Create account",
        icon = icon,
        onTap = onCreateAccount,
    )
}

@Composable
private fun RegionBody(
    message: String,
    onBrowse: () -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 28.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Box(
                modifier = Modifier.size(34.dp).clip(CircleShape).background(PantopusColors.appSurface).clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.ChevronLeft, "Back", size = 20.dp, strokeWidth = 2.5f, tint = PantopusColors.appTextStrong)
            }
        }
        Spacer(modifier = Modifier.weight(1f))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(modifier = Modifier.size(80.dp).clip(CircleShape).background(PantopusColors.homeBg), contentAlignment = Alignment.Center) {
                PantopusIconImage(PantopusIcon.MapPin, null, size = 34.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            Text(
                "Home features are coming to your region.",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.fillMaxWidth(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Text(
                "$message Today, home intelligence reads off U.S. sources — county records, " +
                    "FEMA, the Census. Following, fanning, and messaging work in your region right now.",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            PrimaryButton(title = "Follow people & places", onClick = onBrowse, modifier = Modifier.fillMaxWidth())
        }
        Spacer(modifier = Modifier.weight(1f))
    }
}

// ─── Wedge v2 D1: the aha card and the Band-A sections ───────

private val PREVIEW_GROUP_ORDER =
    listOf(
        PlaceGroup.TODAY to "Today",
        PlaceGroup.RISK_READINESS to "Risk & readiness",
        PlaceGroup.HEALTH_ENVIRONMENT to "Health & environment",
        PlaceGroup.YOUR_BLOCK to "Your block",
        PlaceGroup.MONEY_SIGNALS to "Money signals",
        PlaceGroup.CIVIC to "Civic",
        PlaceGroup.YOUR_HOME to "Your home",
    )

/** Headline, grade, detail and follow-up are the server's words, rendered whole. */
@Composable
private fun AhaCard(
    aha: PlacePreviewAha,
    onFollowUp: () -> Unit,
) {
    val tone =
        when (aha.toneEnum) {
            PlacePreviewAhaTone.ALERT -> PlaceChipTone.ERROR
            PlacePreviewAhaTone.WATCH -> PlaceChipTone.WARNING
            PlacePreviewAhaTone.INFO -> PlaceChipTone.SKY
            PlacePreviewAhaTone.CALM -> PlaceChipTone.SUCCESS
        }
    val icon =
        when (aha.toneEnum) {
            PlacePreviewAhaTone.ALERT, PlacePreviewAhaTone.WATCH -> PantopusIcon.Flame
            PlacePreviewAhaTone.INFO -> PantopusIcon.MapPin
            PlacePreviewAhaTone.CALM -> PantopusIcon.Sparkles
        }
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp).placeCard().padding(16.dp).testTag("place.preview.aha"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon, null, size = 19.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            PlaceChip(PlaceChipModel(tone, aha.grade.ifEmpty { "What stands out" }))
        }
        Text(aha.headline, fontSize = 17.sp, fontWeight = FontWeight.Bold, lineHeight = 23.sp, color = PantopusColors.appText)
        if (aha.detail.isNotEmpty()) {
            Text(aha.detail, fontSize = 13.5.sp, lineHeight = 19.sp, color = PantopusColors.appTextSecondary)
        }
        if (aha.followUp.isNotEmpty()) {
            Row(
                modifier = Modifier.clickable(onClick = onFollowUp).testTag("place.preview.aha.followUp"),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(aha.followUp, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
                PantopusIconImage(PantopusIcon.ChevronRight, null, size = 14.dp, strokeWidth = 2.25f, tint = PantopusColors.primary600)
            }
        }
    }
}

@Composable
private fun PreviewSections(
    sections: List<PlaceSectionEnvelope>,
    onCreateAccount: () -> Unit,
) {
    PREVIEW_GROUP_ORDER.forEach { (group, label) ->
        val items = sections.filter { it.groupId == group }
        if (items.isNotEmpty()) {
            PlaceGroupLabel(text = label, modifier = Modifier.padding(top = 18.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items.forEach { env ->
                    PlaceSectionView(env = env, onOpen = null, onVerify = onCreateAccount, onClaim = onCreateAccount)
                }
            }
        }
    }
}
