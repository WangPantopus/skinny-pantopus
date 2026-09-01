@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.scheduling.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.PantopusMiniToggle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling.hub.HubAvatarTone
import app.pantopus.android.ui.screens.scheduling.hub.hubToneColors
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

internal data class SeededPerson(val id: String, val name: String, val sub: String, val initials: String)

private val HOME_MEMBERS =
    listOf(
        SeededPerson("you", "You", "Verified · household admin", "Y"),
        SeededPerson("m2", "David K.", "Verified household member", "DK"),
        SeededPerson("m3", "Lena K.", "Verified household member", "LK"),
    )

private val BUSINESS_TEAM =
    listOf(
        Triple(SeededPerson("owner", "You", "Owner", "Y"), "OWNER", true),
        Triple(SeededPerson("t2", "Priya N.", "Stylist", "PN"), "STYLIST", false),
        Triple(SeededPerson("t3", "Marcus L.", "Stylist", "ML"), "STYLIST", false),
        Triple(SeededPerson("t4", "Dana W.", "Front desk", "DW"), "FRONT DESK", false),
    )

private data class ServiceChoice(val id: String, val icon: PantopusIcon, val label: String)

private val SERVICES =
    listOf(
        ServiceChoice("consultation", PantopusIcon.MessageSquare, "Consultation"),
        ServiceChoice("quote", PantopusIcon.Home, "Quote visit"),
        ServiceChoice("survey", PantopusIcon.ClipboardList, "Site survey"),
        ServiceChoice("service_call", PantopusIcon.Wrench, "Service call"),
    )

@Composable
internal fun OnboardingFlowSwitch(
    flow: OnboardingFlow,
    onSelect: (OnboardingFlow) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        FlowSegment("Home", flow == OnboardingFlow.Home, SchedulingPillar.Home, "onboardingFlow_home", Modifier.weight(1f)) {
            onSelect(OnboardingFlow.Home)
        }
        FlowSegment(
            "Business",
            flow == OnboardingFlow.Business,
            SchedulingPillar.Business,
            "onboardingFlow_business",
            Modifier.weight(1f),
        ) {
            onSelect(OnboardingFlow.Business)
        }
    }
}

@Composable
private fun FlowSegment(
    label: String,
    active: Boolean,
    pillar: SchedulingPillar,
    tag: String,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .height(36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (active) pillar.accent else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 12.5.sp,
        )
    }
}

@Composable
internal fun ComposedAvailabilityCard(
    message: String,
    timezoneId: String,
    pillar: SchedulingPillar,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.accentBg)
                .border(1.dp, pillar.accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(pillar.accent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarClock,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column {
                Text("Availability is composed automatically", color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                Text(message, color = PantopusColors.appTextStrong, fontSize = 12.sp)
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, pillar.accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.md))
                    .padding(horizontal = 10.dp, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 14.dp, tint = pillar.accent)
            Text(
                "Everyone's set to $timezoneId",
                color = PantopusColors.appTextStrong,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.5.sp,
                modifier = Modifier.weight(1f),
            )
            Row(
                modifier =
                    Modifier.clip(
                        RoundedCornerShape(Radii.pill),
                    ).background(PantopusColors.successLight).padding(horizontal = 8.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 10.dp, tint = PantopusColors.success)
                Text("CONFIRMED", color = PantopusColors.success, fontWeight = FontWeight.Bold, fontSize = 10.sp)
            }
        }
    }
}

@Composable
internal fun OnboardingMemberList(
    selected: Set<String>,
    pillar: SchedulingPillar,
    onToggle: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("Household members")
        SeededListCard {
            HOME_MEMBERS.forEachIndexed { index, person ->
                SeededPersonRow(
                    person = person,
                    trailing = {
                        // Design 32×18 mini toggle, not the Material 3 Switch
                        // (onboarding-shell.jsx "iOS 32×18 toggles"; iOS SetupMiniToggle).
                        PantopusMiniToggle(
                            checked = person.id in selected,
                            onCheckedChange = { onToggle(person.id) },
                            accent = pillar.accent,
                            modifier = Modifier.testTag("onboardingMember_${person.id}"),
                        )
                    },
                    divider = index < HOME_MEMBERS.lastIndex,
                    verified = true,
                )
            }
            InviteRow("Invite someone", "Add a family member by phone or email", pillar, "onboardingInviteMember")
        }
    }
}

@Composable
internal fun OnboardingTeamList(
    seated: Set<String>,
    pillar: SchedulingPillar,
    onToggle: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SetupOverline("Team seats")
            Spacer(Modifier.weight(1f))
            Text("${seated.size} of 5 seats used", color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 11.sp)
        }
        SeededListCard {
            BUSINESS_TEAM.forEachIndexed { index, (person, role, _) ->
                val on = person.id in seated
                SeededPersonRow(
                    person = person,
                    roleChip = role,
                    rolePillar = pillar,
                    statusSub = if (on) "Seated · bookable" else "Not seated",
                    trailing = {
                        // Design 32×18 mini toggle, not the Material 3 Switch
                        // (onboarding-shell.jsx "iOS 32×18 toggles"; iOS SetupMiniToggle).
                        PantopusMiniToggle(
                            checked = on,
                            onCheckedChange = { onToggle(person.id) },
                            accent = pillar.accent,
                            modifier = Modifier.testTag("onboardingSeat_${person.id}"),
                        )
                    },
                    divider = index < BUSINESS_TEAM.lastIndex,
                )
            }
            InviteRow("Invite teammate", "2 seats left on your plan", pillar, "onboardingInviteTeammate")
        }
    }
}

@Composable
private fun SeededListCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) { content() }
}

@Composable
private fun SeededPersonRow(
    person: SeededPerson,
    trailing: @Composable () -> Unit,
    divider: Boolean,
    roleChip: String? = null,
    rolePillar: SchedulingPillar? = null,
    statusSub: String? = null,
    verified: Boolean = false,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Per-person tinted avatar — the design gives every member/teammate a
        // distinct colored disc (onboarding-home-frames.jsx MemberRow `grad`,
        // onboarding-business-frames.jsx TeamRow). Reuses the hub avatar-tone
        // cycle, keyed by name like iOS `SchedulingHubModel.avatarTone(for:)`.
        val (avatarBg, avatarFg) = hubToneColors(seededAvatarTone(person.name))
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(avatarBg),
                contentAlignment = Alignment.Center,
            ) {
                Text(person.initials, color = avatarFg, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            if (verified) {
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.success),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 9.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(person.name, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                if (roleChip != null && rolePillar != null) {
                    val isOwner = roleChip.equals("Owner", ignoreCase = true)
                    Box(
                        modifier =
                            Modifier.clip(
                                RoundedCornerShape(Radii.pill),
                            ).background(if (isOwner) rolePillar.accentBg else PantopusColors.appSurfaceSunken)
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                    ) {
                        Text(
                            roleChip,
                            color = if (isOwner) rolePillar.accent else PantopusColors.appTextSecondary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.5.sp,
                        )
                    }
                }
            }
            Text(statusSub ?: person.sub, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        trailing()
    }
    if (divider) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).padding(start = 13.dp).background(PantopusColors.appBorderSubtle))
    }
}

@Composable
private fun InviteRow(
    title: String,
    sub: String,
    pillar: SchedulingPillar,
    tag: String,
) {
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClickLabel = title) {}.padding(horizontal = 13.dp, vertical = 11.dp).testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(CircleShape).background(pillar.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.UserPlus, contentDescription = null, size = 17.dp, tint = pillar.accent)
        }
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text(title, color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(sub, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
internal fun OnboardingModePicker(
    mode: String,
    pillar: SchedulingPillar,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("How times combine")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ModeTile(
                id = "collective",
                icon = PantopusIcon.Users,
                title = "Collective",
                body = "Everyone must be free. Times are the overlap of all selected members.",
                selected = mode == "collective",
                pillar = pillar,
                onClick = { onSelect("collective") },
                modifier = Modifier.weight(1f),
            )
            ModeTile(
                id = "round_robin",
                icon = PantopusIcon.ArrowsRepeat,
                title = "Round-robin",
                body = "Whoever's free gets the booking. Times are the union, assigned by a rule.",
                selected = mode == "round_robin",
                pillar = pillar,
                onClick = { onSelect("round_robin") },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ModeTile(
    id: String,
    icon: PantopusIcon,
    title: String,
    body: String,
    selected: Boolean,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) pillar.accentBg else PantopusColors.appSurface)
                .border(1.5.dp, if (selected) pillar.accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(13.dp)
                .testTag("onboardingMode_$id"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 20.dp,
                tint = if (selected) pillar.accent else PantopusColors.appTextStrong,
            )
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(if (selected) pillar.accent else PantopusColors.appSurface)
                        .border(1.5.dp, if (selected) pillar.accent else PantopusColors.appBorderStrong, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Text(title, color = if (selected) pillar.accent else PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
        Text(body, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
    }
}

@Composable
internal fun OnboardingRoundRobinRule(
    rule: String,
    pillar: SchedulingPillar,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("Assignment rule")
        SeededListCard {
            RuleRow(
                "balanced",
                PantopusIcon.ArrowDownUp,
                "Balanced — even out who hosts",
                rule == "balanced",
                pillar,
            ) { onSelect("balanced") }
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            RuleRow("priority", PantopusIcon.ListChecks, "By priority order", rule == "priority", pillar) { onSelect("priority") }
        }
    }
}

@Composable
private fun RuleRow(
    id: String,
    icon: PantopusIcon,
    label: String,
    selected: Boolean,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth().clickable(
                onClick = onClick,
            ).padding(horizontal = 13.dp, vertical = 11.dp).testTag("onboardingRule_$id"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    28.dp,
                ).clip(RoundedCornerShape(Radii.md)).background(if (selected) pillar.accentBg else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                tint = if (selected) pillar.accent else PantopusColors.appTextSecondary,
            )
        }
        Text(label, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.weight(1f))
        RadioDot(selected = selected, pillar = pillar)
    }
}

@Composable
private fun RadioDot(
    selected: Boolean,
    pillar: SchedulingPillar,
) {
    Box(
        modifier =
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .background(if (selected) pillar.accent else PantopusColors.appSurface)
                .border(1.5.dp, if (selected) pillar.accent else PantopusColors.appBorderStrong, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(PantopusColors.appTextInverse))
        }
    }
}

@Composable
internal fun OnboardingServicePicker(
    serviceType: String,
    duration: Int,
    priceText: String,
    paidEnabled: Boolean,
    pillar: SchedulingPillar,
    onSelect: (String) -> Unit,
    onDuration: (Int) -> Unit,
    onPrice: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        SetupOverline("Service type")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SERVICES.chunked(2).forEach { rowChoices ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    rowChoices.forEach { choice ->
                        ServiceTile(choice, choice.id == serviceType, pillar, { onSelect(choice.id) }, Modifier.weight(1f))
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp)) {
            DurationDropdownField(duration, onDuration, Modifier.weight(1f))
            // Paid gate: the price input only renders where paid scheduling is
            // enabled (iOS parity — production creates a free service).
            if (paidEnabled) PriceField(priceText, onPrice, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ServiceTile(
    choice: ServiceChoice,
    selected: Boolean,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) pillar.accentBg else PantopusColors.appSurface)
                .border(1.5.dp, if (selected) pillar.accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 13.dp)
                .testTag("onboardingService_${choice.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = choice.icon,
            contentDescription = null,
            size = 18.dp,
            tint = if (selected) pillar.accent else PantopusColors.appTextStrong,
        )
        Text(
            choice.label,
            color = if (selected) pillar.accent else PantopusColors.appText,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 12.5.sp,
        )
    }
}

@Composable
private fun DurationDropdownField(
    duration: Int,
    onDuration: (Int) -> Unit,
    modifier: Modifier,
) {
    // Single dropdown field ("30 min ▾") per onboarding-business-frames.jsx and the
    // iOS durationField Menu — not a four-chip stepper group.
    val options = listOf(15, 30, 45, 60)
    var expanded by remember { mutableStateOf(false) }
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        SetupOverline("Duration")
        Box {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .clickable { expanded = true }
                        .padding(horizontal = Spacing.s3, vertical = 10.dp)
                        .testTag("onboardingDuration"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "$duration min",
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.5.sp,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { m ->
                    DropdownMenuItem(
                        text = { Text("$m min") },
                        onClick = {
                            onDuration(m)
                            expanded = false
                        },
                        modifier = Modifier.testTag("onboardingDuration_$m"),
                    )
                }
            }
        }
    }
}

@Composable
private fun PriceField(
    priceText: String,
    onPrice: (String) -> Unit,
    modifier: Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        SetupOverline("Price")
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("$", color = PantopusColors.appTextSecondary, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Spacer(Modifier.width(Spacing.s1))
            BasicTextField(
                value = priceText,
                onValueChange = onPrice,
                singleLine = true,
                textStyle =
                    PantopusTextStyle.small.copy(
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace,
                    ),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f).testTag("onboardingPrice"),
            )
            // Design `Field` renders a 14px fg4 trailing glyph whenever `adorn` is set;
            // onboarding-business-frames.jsx gives Price `adorn="pencil"`. iOS already has it.
            PantopusIconImage(
                icon = PantopusIcon.Pencil,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
internal fun OnboardingConfirmMode(
    mode: String,
    pillar: SchedulingPillar,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("How bookings get confirmed")
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurfaceSunken).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            ConfirmSegment(
                "auto",
                PantopusIcon.Zap,
                "Auto-confirm bookings",
                mode == "auto",
                pillar,
                Modifier.weight(1f),
            ) { onSelect("auto") }
            ConfirmSegment("approve", PantopusIcon.UserCheck, "I approve each one", mode == "approve", pillar, Modifier.weight(1f)) {
                onSelect("approve")
            }
        }
    }
}

@Composable
private fun ConfirmSegment(
    id: String,
    icon: PantopusIcon,
    label: String,
    active: Boolean,
    pillar: SchedulingPillar,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (active) PantopusColors.appSurface else PantopusColors.appSurfaceSunken)
                .border(1.5.dp, if (active) pillar.accent else PantopusColors.appSurfaceSunken, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s2)
                .testTag("onboardingConfirm_$id"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = if (active) pillar.accent else PantopusColors.appTextSecondary,
        )
        Text(
            label,
            color = if (active) pillar.accent else PantopusColors.appTextSecondary,
            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 12.5.sp,
        )
    }
}

@Composable
internal fun OnboardingApproveExplainer(pillar: SchedulingPillar) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.accentBg)
                .border(1.dp, pillar.accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .padding(14.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(pillar.accent),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.UserCheck, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextInverse)
        }
        Column {
            Text("You approve each booking", color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
            Text(
                "Requests land in your queue. The slot is held for 24 hours and the client is notified once you confirm.",
                color = PantopusColors.appTextStrong,
                fontSize = 12.sp,
            )
        }
    }
}

/**
 * Deterministic per-name tone from the hub avatar cycle — same hash as iOS
 * `SchedulingHubModel.avatarTone(for:)` (sum of scalar values mod tone count)
 * so the two platforms color the same person the same way.
 */
private fun seededAvatarTone(name: String): HubAvatarTone {
    val tones = HubAvatarTone.entries
    return tones[name.sumOf { it.code } % tones.size]
}

internal fun composedMessage(flow: OnboardingFlow): String =
    if (flow == OnboardingFlow.Home) {
        "Times come from each member's personal availability — you're not setting hours twice."
    } else {
        "Booking times come from each seated teammate's personal availability — no one re-enters their hours."
    }
