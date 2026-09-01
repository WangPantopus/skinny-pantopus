@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.homes.pets

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PetSpecies
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/** Test tag on the Add Pet wizard root. */
const val ADD_PET_WIZARD_TAG = "addPetWizard"

/**
 * Hilt entry point used to fetch the singleton [HomePetsRepository] from a
 * `@Composable` scope. The wizard VM isn't a Hilt VM — the host screen
 * owns its lifecycle — but it still needs the repo to call the network.
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface AddPetWizardDeps {
    fun homePetsRepository(): HomePetsRepository
}

/**
 * Presents the Add / Edit Pet wizard as a full-screen Dialog. Mirrors
 * the iOS pattern where the wizard is presented as a `.sheet(item:)` —
 * keeps the list visible underneath via the modal scrim and re-shows on
 * dismiss.
 *
 * @param existing non-null = edit mode (PUT); null = add mode (POST)
 * @param onClose returns the created / updated [PetDto] on submit, `null`
 *   when the user dismisses without saving
 */
@Composable
fun AddPetWizardSheet(
    homeId: String,
    existing: PetDto?,
    onClose: (PetDto?) -> Unit,
) {
    val context = LocalContext.current
    val repo =
        remember {
            EntryPointAccessors
                .fromApplication(context.applicationContext, AddPetWizardDeps::class.java)
                .homePetsRepository()
        }
    val viewModel =
        remember(homeId, existing?.id) {
            AddPetWizardViewModel(homeId = homeId, existing = existing, repo = repo)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(state.currentStep) {
        Analytics.track(
            AnalyticsEvent.ScreenPetsWizardStepViewed(
                stepNumber = state.currentStep.number,
                stepName = state.currentStep.name,
            ),
        )
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            AddPetEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onClose(null)
            }
            is AddPetEvent.Submitted -> {
                viewModel.acknowledgeEvent()
                onClose(event.pet)
            }
        }
    }

    Dialog(
        onDismissRequest = { onClose(null) },
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = false,
            ),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag(ADD_PET_WIZARD_TAG),
        ) {
            WizardShell(model = viewModel) {
                when (state.currentStep) {
                    AddPetStep.Species -> SpeciesStep(state.form.species, viewModel::setSpecies)
                    AddPetStep.Basics ->
                        BasicsStep(
                            name = state.form.name,
                            breed = state.form.breed,
                            onName = viewModel::setName,
                            onBreed = viewModel::setBreed,
                        )
                    AddPetStep.Details ->
                        DetailsStep(
                            photoUrl = state.form.photoUrl,
                            vetName = state.form.vetName,
                            vetPhone = state.form.vetPhone,
                            notes = state.form.notes,
                            onPhoto = viewModel::setPhotoUrl,
                            onVetName = viewModel::setVetName,
                            onVetPhone = viewModel::setVetPhone,
                            onNotes = viewModel::setNotes,
                        )
                }
                state.errorMessage?.let { ErrorBanner(it) }
            }
        }
    }
}

// MARK: - Step composables

@Composable
private fun SpeciesStep(
    selected: PetSpecies,
    onSelect: (PetSpecies) -> Unit,
) {
    HeadlineBlock(AddPetStep.Species.title)
    SubcopyBlock(AddPetStep.Species.subcopy)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PetSpecies.entries.forEach { species ->
            SpeciesTile(
                species = species,
                isSelected = selected == species,
                onSelect = { onSelect(species) },
            )
        }
    }
}

@Composable
private fun SpeciesTile(
    species: PetSpecies,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val palette = species.palette
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    val borderWidth = if (isSelected) 2.dp else 1.dp
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(borderWidth, borderColor, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onSelect)
                .padding(Spacing.s3)
                .testTag("addPet_species_${species.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        Brush.linearGradient(
                            colors =
                                listOf(
                                    palette.iconBackground.start,
                                    palette.iconBackground.end,
                                ),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = palette.icon,
                contentDescription = null,
                size = 22.dp,
                tint = palette.iconForeground,
            )
        }
        Text(
            text = species.label,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun BasicsStep(
    name: String,
    breed: String,
    onName: (String) -> Unit,
    onBreed: (String) -> Unit,
) {
    HeadlineBlock(AddPetStep.Basics.title)
    SubcopyBlock(AddPetStep.Basics.subcopy)
    FormFieldsBlock {
        PantopusTextField(
            label = "Name",
            value = name,
            onValueChange = onName,
            placeholder = "Mango",
            fieldTestTag = "addPet_name",
        )
        PantopusTextField(
            label = "Breed (optional)",
            value = breed,
            onValueChange = onBreed,
            placeholder = "Golden Retriever",
            fieldTestTag = "addPet_breed",
        )
    }
}

@Composable
private fun DetailsStep(
    photoUrl: String,
    vetName: String,
    vetPhone: String,
    notes: String,
    onPhoto: (String) -> Unit,
    onVetName: (String) -> Unit,
    onVetPhone: (String) -> Unit,
    onNotes: (String) -> Unit,
) {
    HeadlineBlock(AddPetStep.Details.title)
    SubcopyBlock(AddPetStep.Details.subcopy)
    FormFieldsBlock {
        PantopusTextField(
            label = "Photo URL (optional)",
            value = photoUrl,
            onValueChange = onPhoto,
            placeholder = "https://…/mango.jpg",
            fieldTestTag = "addPet_photoUrl",
        )
        PantopusTextField(
            label = "Vet name (optional)",
            value = vetName,
            onValueChange = onVetName,
            placeholder = "Bay Area Animal Hospital",
            fieldTestTag = "addPet_vetName",
        )
        PantopusTextField(
            label = "Vet phone (optional)",
            value = vetPhone,
            onValueChange = onVetPhone,
            placeholder = "(415) 555-0142",
            keyboardType = KeyboardType.Phone,
            fieldTestTag = "addPet_vetPhone",
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Notes",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 96.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s2),
            ) {
                BasicTextField(
                    value = notes,
                    onValueChange = onNotes,
                    modifier = Modifier.fillMaxSize().testTag("addPet_notes"),
                    textStyle =
                        TextStyle(
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                )
            }
        }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("addPetErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
        )
    }
    Spacer(Modifier.height(Spacing.s2))
}
