package app.pantopus.android.ui.screens.place.launch

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewLockedSection
import app.pantopus.android.data.api.models.place.PlacePreviewSectionStatus
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceDensityCard
import app.pantopus.android.ui.screens.place.components.PlaceGroupLabel
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

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

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.MapPin, null, size = 16.dp, strokeWidth = 2.25f, tint = PantopusColors.home)
                }
                Text("Pantopus", fontSize = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp, color = PantopusColors.appText)
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

        Spacer(modifier = Modifier.weight(1f))

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier.clip(
                        CircleShape,
                    ).background(
                        PantopusColors.appSurface,
                    ).border(1.dp, PantopusColors.appBorder, CircleShape).padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text("🇺🇸", fontSize = 13.sp)
                Text("United States", fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            }
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
                Text(
                    "Just here to follow someone or browse?",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.fillMaxWidth().clickable(onClick = onCreateAccount),
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(PantopusIcon.Lock, null, size = 13.dp, strokeWidth = 2f, tint = PantopusColors.appTextMuted)
            Text("Private by default. Verification builds trust, not exposure.", fontSize = 12.sp, color = PantopusColors.appTextMuted)
        }
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
    Box(modifier = Modifier.fillMaxSize()) {
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
                preview.free?.let { free ->
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
        }
    }
}

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
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp)) {
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
