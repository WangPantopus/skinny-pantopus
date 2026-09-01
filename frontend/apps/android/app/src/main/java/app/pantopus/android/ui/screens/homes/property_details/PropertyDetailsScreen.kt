@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "PackageNaming")
@file:OptIn(com.google.maps.android.compose.MapsComposeExperimentalApi::class)

package app.pantopus.android.ui.screens.homes.property_details

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.DataRow
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.SourcePill
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

/** A.4 / A13.5 — read-mostly property facts with mismatch correction CTA. */
@Composable
fun PropertyDetailsScreen(
    onBack: () -> Unit,
    onRequestCorrection: () -> Unit = {},
    viewModel: PropertyDetailsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    PropertyDetailsScreenContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::refresh,
        onRequestCorrection = onRequestCorrection,
    )
}

@Composable
internal fun PropertyDetailsScreenContent(
    state: PropertyDetailsUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onRequestCorrection: () -> Unit,
    renderGoogleMap: Boolean = true,
) {
    Box(modifier = Modifier.fillMaxSize().testTag("propertyDetails")) {
        when (state) {
            PropertyDetailsUiState.Loading -> LoadingBody(onBack = onBack)
            is PropertyDetailsUiState.Clean ->
                LoadedBody(
                    content = state.content,
                    isMismatch = false,
                    onBack = onBack,
                    onRequestCorrection = onRequestCorrection,
                    renderGoogleMap = renderGoogleMap,
                )
            is PropertyDetailsUiState.Mismatch ->
                LoadedBody(
                    content = state.content,
                    isMismatch = true,
                    onBack = onBack,
                    onRequestCorrection = onRequestCorrection,
                    renderGoogleMap = renderGoogleMap,
                )
            is PropertyDetailsUiState.Error ->
                ErrorBody(message = state.message, onBack = onBack, onRetry = onRetry)
        }
    }
}

@Composable
private fun LoadedBody(
    content: PropertyDetailsContent,
    isMismatch: Boolean,
    onBack: () -> Unit,
    onRequestCorrection: () -> Unit,
    renderGoogleMap: Boolean,
) {
    ContentDetailShell(
        title = "Property details",
        onBack = onBack,
        cta = {
            if (isMismatch) {
                StickyCorrectionButton(onRequestCorrection = onRequestCorrection)
            }
        },
        header = {
            PropertyHero(
                address = content.address,
                renderGoogleMap = renderGoogleMap,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                if (isMismatch && content.banner != null) {
                    MismatchBanner(data = content.banner)
                }
                PropertySection(title = "Property", rows = content.propertyFacts)
                // Records (ATTOM provenance) + Verification sources have no
                // clean backend mapping today, so they're hidden when the
                // projection leaves them empty.
                if (content.records.isNotEmpty()) {
                    PropertySection(title = "Records", rows = content.records)
                }
                if (content.verification.isNotEmpty()) {
                    VerificationSection(sources = content.verification)
                }
                if (isMismatch) {
                    Spacer(Modifier.height(Spacing.s12))
                }
            }
        },
    )
}

@Composable
private fun PropertyHero(
    address: PropertyAddress,
    renderGoogleMap: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .semantics {
                    contentDescription = "${address.line1}, ${address.line2}. Household"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = address.line1,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            Text(
                text = address.line2,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            HouseholdPill(modifier = Modifier.padding(top = Spacing.s1))
        }
        PropertyMapPreview(
            address = address,
            renderGoogleMap = renderGoogleMap,
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        )
    }
}

@Composable
private fun PropertyMapPreview(
    address: PropertyAddress,
    renderGoogleMap: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!renderGoogleMap) {
        StaticMapPreview(modifier = modifier.testTag("propertyDetails_staticMap"))
        return
    }

    val coordinate = remember(address.latitude, address.longitude) { LatLng(address.latitude, address.longitude) }
    val cameraState =
        rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coordinate, 16f)
        }
    val mapProperties = remember { MapProperties(isMyLocationEnabled = false) }
    val uiSettings =
        remember {
            MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = false,
                rotationGesturesEnabled = false,
                scrollGesturesEnabled = false,
                tiltGesturesEnabled = false,
                zoomControlsEnabled = false,
                zoomGesturesEnabled = false,
            )
        }

    GoogleMap(
        modifier = modifier.testTag("propertyDetails_googleMap"),
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
    ) {
        val markerState = remember(coordinate) { MarkerState(position = coordinate) }
        MarkerComposable(
            keys = arrayOf<Any>("home"),
            state = markerState,
            anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
        ) {
            HomePinDot()
        }
    }
}

@Composable
private fun StaticMapPreview(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .background(PantopusColors.primary25),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            repeat(3) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurface),
                )
            }
        }
        HomePinDot()
    }
}

@Composable
private fun HomePinDot() {
    Box(
        modifier =
            Modifier
                .size(26.dp)
                .pantopusShadow(PantopusElevations.sm, CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.primary600)
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun HouseholdPill(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "Household" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Home, contentDescription = null, size = Radii.lg, tint = PantopusColors.home)
        Text(text = "Household", style = PantopusTextStyle.overline, color = PantopusColors.home)
    }
}

@Composable
private fun PropertySection(
    title: String,
    rows: List<PropertyFactRow>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        SectionHeader(title)
        PropertyCard {
            rows.forEachIndexed { index, row ->
                DataRow(
                    label = row.label,
                    value = row.value,
                    sub = row.sub,
                    mono = row.mono,
                    mismatch = row.mismatch,
                    testTag = "propertyDetails_row_${row.id}",
                )
                if (index < rows.lastIndex) RowDivider()
            }
        }
    }
}

@Composable
private fun VerificationSection(sources: List<VerificationSource>) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        SectionHeader("Verification")
        PropertyCard {
            sources.forEachIndexed { index, source ->
                VerificationRow(source = source)
                if (index < sources.lastIndex) RowDivider()
            }
        }
    }
}

@Composable
private fun VerificationRow(source: VerificationSource) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {
                    contentDescription = "${source.title}, ${source.pill.label}. ${source.detail}"
                }
                .testTag("propertyDetails_source_${source.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = source.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            SourcePill(text = source.pill.label, tone = source.pill.tone, icon = source.pill.icon)
        }
        Text(
            text = source.detail,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun PropertyCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        content()
    }
}

@Composable
private fun RowDivider() {
    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
}

@Composable
private fun MismatchBanner(data: MismatchBannerData) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .clickable { expanded = !expanded }
                .padding(Spacing.s3)
                .semantics {
                    role = Role.Button
                    contentDescription = "${data.summary} ${data.detail}"
                }
                .testTag("propertyDetails_mismatchBanner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.warningLight),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertTriangle,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.warning,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = data.summary,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (expanded) {
                Text(
                    text = data.detail,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.warning,
            modifier = Modifier.rotate(if (expanded) 90f else 0f),
        )
    }
}

@Composable
private fun StickyCorrectionButton(onRequestCorrection: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 50.dp)
                .pantopusShadow(PantopusElevations.primary, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(onClick = onRequestCorrection)
                .padding(horizontal = Spacing.s4)
                .semantics {
                    role = Role.Button
                    contentDescription = "Request correction"
                }
                .testTag("propertyDetails_requestCorrectionCTA"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Request correction",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextInverse,
        )
        Spacer(Modifier.size(Spacing.s2))
        PantopusIconImage(
            icon = PantopusIcon.ArrowRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun LoadingBody(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Property details",
        onBack = onBack,
        header = {
            Shimmer(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .height(220.dp)
                        .clip(RoundedCornerShape(Radii.lg)),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                repeat(3) {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                        Shimmer(modifier = Modifier.fillMaxWidth(0.38f).height(12.dp))
                        Shimmer(modifier = Modifier.fillMaxWidth().height(168.dp).clip(RoundedCornerShape(Radii.lg)))
                    }
                }
            }
        },
    )
}

@Composable
private fun ErrorBody(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Property details",
        onBack = onBack,
        header = {},
        body = {
            Box(modifier = Modifier.fillMaxWidth().height(400.dp)) {
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load property details",
                    subcopy = message,
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
            }
        },
    )
}
