//
//  AddHomeWizardView.swift
//  Pantopus
//
//  Concrete Add-Home wizard. Composes `WizardShell` with five step bodies
//  and persists in-progress state via `@SceneStorage` so the wizard
//  survives process death (acceptance criterion #5).
//

// swiftlint:disable file_length

import SwiftUI

/// Pushed onto the Hub stack from the MyHomes FAB / empty-CTA. On
/// success, signals the parent stack to pop the wizard and route to the
/// new home's dashboard via `onOpenHomeDashboard`.
public struct AddHomeWizardView: View {
    @State private var viewModel: AddHomeWizardViewModel
    @SceneStorage("addHomeWizardForm") private var storedForm: String = ""
    @State private var hasRestored = false
    @Environment(\.dismiss) private var dismiss

    private let onOpenHomeDashboard: (String) -> Void
    /// `check-address` matched an already-claimed home and the user
    /// picked "owner" — route to the ownership-claim wizard for that
    /// existing home instead of creating a duplicate.
    private let onOpenClaimOwnership: (String) -> Void
    /// Residency claim filed against an existing home — route to the
    /// waiting room.
    private let onOpenWaitingRoom: (String) -> Void

    public init(
        onOpenHomeDashboard: @escaping (String) -> Void,
        onOpenClaimOwnership: @escaping (String) -> Void = { _ in },
        onOpenWaitingRoom: @escaping (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: AddHomeWizardViewModel())
        self.onOpenHomeDashboard = onOpenHomeDashboard
        self.onOpenClaimOwnership = onOpenClaimOwnership
        self.onOpenWaitingRoom = onOpenWaitingRoom
    }

    init(
        viewModel: AddHomeWizardViewModel,
        onOpenHomeDashboard: @escaping (String) -> Void,
        onOpenClaimOwnership: @escaping (String) -> Void = { _ in },
        onOpenWaitingRoom: @escaping (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenHomeDashboard = onOpenHomeDashboard
        self.onOpenClaimOwnership = onOpenClaimOwnership
        self.onOpenWaitingRoom = onOpenWaitingRoom
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepContent
            if let error = viewModel.errorMessage {
                AddHomeErrorBanner(message: error)
            }
        }
        .onAppear {
            restoreIfNeeded()
            // Fire the initial step view event since transitions only
            // fire on user-driven step changes after this point.
            if let stepNumber = viewModel.currentStep.stepNumber {
                Analytics.track(
                    .screenAddHomeWizardStepViewed(
                        stepNumber: stepNumber,
                        stepName: String(describing: viewModel.currentStep)
                    )
                )
            }
        }
        .onChange(of: viewModel.form) { _, _ in persist() }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .overlay {
            if viewModel.showsClaimedModal {
                AddressClaimedModal(viewModel: viewModel)
            }
        }
        // A12.2 Setup — the Wi-Fi QR scanner takes the whole screen so
        // the viewfinder matches RN's full-screen `QrScannerModal`.
        .fullScreenCover(isPresented: Binding(
            get: { viewModel.scannerTargetItemID != nil },
            set: { if !$0 { viewModel.closeWifiQRScanner() } }
        )) {
            WifiQRScannerSheet(
                onScanned: { viewModel.applyScannedWifi($0) },
                onClose: { viewModel.closeWifiQRScanner() }
            )
        }
        .alert(
            "Home created",
            isPresented: Binding(
                get: { viewModel.accessSecretWarning != nil },
                set: { if !$0 { viewModel.acknowledgeAccessSecretWarning() } }
            )
        ) {
            Button("OK", role: .cancel) { viewModel.acknowledgeAccessSecretWarning() }
        } message: {
            Text(viewModel.accessSecretWarning ?? "")
        }
        .accessibilityIdentifier("addHomeWizard")
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .address: AddressStep(viewModel: viewModel)
        case .confirm: AddHomeConfirmStep(viewModel: viewModel)
        case .role: RoleStep(viewModel: viewModel)
        case .review: ReviewStep(viewModel: viewModel)
        case .success: SuccessStep()
        }
    }

    private func restoreIfNeeded() {
        guard !hasRestored else { return }
        hasRestored = true
        guard let data = storedForm.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(AddHomeFormState.self, from: data)
        else { return }
        viewModel.restore(from: snapshot)
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(viewModel.form),
              let json = String(data: data, encoding: .utf8)
        else { return }
        storedForm = json
    }

    private func handle(_ event: AddHomeOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            storedForm = ""
            dismiss()
        case let .openHomeDashboard(homeId):
            storedForm = ""
            onOpenHomeDashboard(homeId)
        case let .openClaimOwnership(homeId):
            storedForm = ""
            onOpenClaimOwnership(homeId)
        case let .openWaitingRoom(homeId):
            storedForm = ""
            onOpenWaitingRoom(homeId)
        }
        viewModel.pendingEvent = nil
    }
}

// MARK: - Address-already-claimed modal (RN AddressClaimedModal)

/// Two-page confirm modal shown when `POST /api/homes/check-address`
/// returns `HOME_FOUND_CLAIMED`. Copy mirrors RN's `ADDRESS_CHECK`
/// constants (`src/constants/ownershipCopy.ts:176-183`).
private struct AddressClaimedModal: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        ZStack {
            Rectangle()
                .fill(Theme.Color.appText.opacity(0.45))
                .ignoresSafeArea()
                .onTapGesture { viewModel.dismissClaimedModal() }
            card
                .padding(.horizontal, Spacing.s5)
        }
        .accessibilityIdentifier("addHomeAddressClaimedModal")
    }

    @ViewBuilder
    private var card: some View {
        if viewModel.showsConfirmAddressSheet {
            modalCard {
                Text("Confirm this is your address")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text("You entered:")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                Text(viewModel.claimedAddressLabel)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityIdentifier("addHomeClaimedAddressLabel")
                primaryButton("Confirm address", identifier: "addHomeClaimedConfirmAddress") {
                    viewModel.confirmClaimedAddress()
                }
                secondaryButton("Edit", identifier: "addHomeClaimedEditAddress") {
                    viewModel.dismissClaimedModal()
                }
            }
        } else {
            modalCard {
                Circle()
                    .fill(Theme.Color.personalBg)
                    .frame(width: 56, height: 56)
                    .overlay {
                        Icon(.shieldCheck, size: 28, color: Theme.Color.primary600)
                    }
                Text("This home already has verified members")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text("To protect privacy, you’ll need verification to join this home.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                primaryButton("This address is correct", identifier: "addHomeClaimedCorrect") {
                    viewModel.showConfirmAddressStep()
                }
                secondaryButton("Change address", identifier: "addHomeClaimedChangeAddress") {
                    viewModel.dismissClaimedModal()
                }
            }
        }
    }

    private func modalCard(@ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: Spacing.s3) {
            content()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func primaryButton(
        _ title: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func secondaryButton(
        _ title: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Step 2: Confirm

private struct AddHomeConfirmStep: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        HeadlineBlock("Confirm the property")
        SubcopyBlock(
            "We checked this address against our property records. Review the details before continuing."
        )
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let mismatch = viewModel.zipMismatch {
                ZipMismatchBanner(mismatch: mismatch) {
                    viewModel.applyGeocodedZip()
                }
            } else if let geocodedAddress = viewModel.geocodedAddress, viewModel.isGeocodeResolved {
                GeocodeConfirmationBlock(address: geocodedAddress)
            }
            AddressConfirmationFields(
                address: viewModel.form.address,
                isGeocodeResolved: viewModel.isGeocodeResolved,
                mismatch: viewModel.zipMismatch
            )
            if let check = viewModel.addressCheck {
                AddressVerdictRow(check: check)
            }
            PrimaryHomeToggle(isPrimary: viewModel.form.isPrimary) {
                viewModel.setPrimaryHome($0)
            }
            // A12.2 Details — nickname / type / beds / baths / sizes /
            // year / description, pre-filled from public records. Hidden
            // on the join-an-existing-home path, which RN skips too
            // (`useHomeForm.ts:619-623, :700-705`).
            if !viewModel.isClaimingExistingHome {
                Divider().background(Theme.Color.appBorderSubtle)
                AddHomeDetailsSection(viewModel: viewModel)
            }
        }
    }
}

// MARK: - Step 3: Role

private struct RoleStep: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        HeadlineBlock("What's your role?")
        SubcopyBlock("This determines what verification we'll ask for next.")
        VStack(spacing: Spacing.s2) {
            ForEach(AddHomeRole.allCases, id: \.self) { role in
                RoleRow(role: role, isSelected: viewModel.form.role == role) {
                    viewModel.selectRole(role)
                }
            }
        }
        // A12.2 Setup — RN's Setup step is role picker + "Networks &
        // codes" in one screen (`SetupStep.tsx:33-174`), and the block is
        // hidden when joining an existing home (`SetupStep.tsx:66`).
        if viewModel.showsAccessSetup {
            Divider()
                .background(Theme.Color.appBorderSubtle)
                .padding(.vertical, Spacing.s2)
            AddHomeAccessSetupSection(viewModel: viewModel)
        }
    }
}

// MARK: - Step 4: Review

private struct ReviewStep: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        HeadlineBlock("Review and submit")
        SubcopyBlock("Make sure everything below looks right before submitting.")
        ReviewSummaryBlock(summaryRows)
    }

    /// Address / role / primary, plus everything the Details and Setup
    /// blocks collected — the review step previously showed only the
    /// first three, so nothing the user typed on those blocks was
    /// verifiable before submit.
    private var summaryRows: [ReviewSummaryRow] {
        var rows: [ReviewSummaryRow] = [
            ReviewSummaryRow(
                label: "Address",
                value: composedAddress(viewModel.form.address)
            ),
            ReviewSummaryRow(
                label: "Role",
                value: viewModel.form.role?.label ?? "—"
            ),
            ReviewSummaryRow(
                label: "Primary",
                value: viewModel.form.isPrimary ? "Yes" : "No"
            )
        ]
        guard !viewModel.isClaimingExistingHome else { return rows }
        let details = viewModel.form.details
        let nickname = details.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        if !nickname.isEmpty {
            rows.append(ReviewSummaryRow(label: "Nickname", value: nickname))
        }
        rows.append(ReviewSummaryRow(label: "Home type", value: details.homeType.label))
        if let size = bedBathSummary(details) {
            rows.append(ReviewSummaryRow(label: "Size", value: size))
        }
        if !details.sqFt.isEmpty {
            rows.append(ReviewSummaryRow(label: "Home size", value: "\(details.sqFt) sq ft"))
        }
        if !details.lotSqFt.isEmpty {
            rows.append(ReviewSummaryRow(label: "Lot size", value: "\(details.lotSqFt) sq ft"))
        }
        if !details.yearBuilt.isEmpty {
            rows.append(ReviewSummaryRow(label: "Year built", value: details.yearBuilt))
        }
        let secretCount = viewModel.accessItems.filter(\.isComplete).count
        if secretCount > 0 {
            rows.append(ReviewSummaryRow(
                label: "Networks & codes",
                value: secretCount == 1 ? "1 entry" : "\(secretCount) entries"
            ))
        }
        return rows
    }

    private func bedBathSummary(_ details: AddHomeDetailsFields) -> String? {
        var parts: [String] = []
        if !details.bedrooms.isEmpty { parts.append("\(details.bedrooms) bd") }
        if !details.bathrooms.isEmpty { parts.append("\(details.bathrooms) ba") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func composedAddress(_ fields: AddHomeAddressFields) -> String {
        var parts: [String] = [fields.street]
        if !fields.unit.isEmpty { parts.append(fields.unit) }
        parts.append(fields.city)
        parts.append("\(fields.state) \(fields.zipCode)")
        return parts.joined(separator: ", ")
    }
}

// MARK: - Step 5: Success

private struct SuccessStep: View {
    var body: some View {
        // Re-use the T3.6 Status / Waiting screen so the home-added
        // terminal shares its chrome with the claim-submitted and
        // check-your-email frames.
        // Dock-less body — `WizardShell` owns the sticky CTA dock here, so the
        // full `StatusWaitingView` would render a second stacked pair. Mirrors
        // Android's `AddHomeWizardScreen` using `StatusWaitingBody`.
        StatusWaitingBodyView(
            content: .claimSubmitted(homeName: nil)
                .withHeadline("Home added")
                .withSubcopy("We'll email you when verification completes.")
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension StatusWaitingContent {
    func withHeadline(_ headline: String) -> StatusWaitingContent {
        StatusWaitingContent(
            halo: halo,
            headline: headline,
            subcopy: subcopy,
            bodyEmphasis: bodyEmphasis,
            addressChip: addressChip,
            statusPill: statusPill,
            timeline: timeline,
            currentStageId: currentStageId,
            actionCards: actionCards,
            explainerBullets: explainerBullets,
            actionStack: actionStack,
            footnote: footnote,
            primaryCta: primaryCta,
            secondaryCta: secondaryCta
        )
    }

    func withSubcopy(_ subcopy: String) -> StatusWaitingContent {
        StatusWaitingContent(
            halo: halo,
            headline: headline,
            subcopy: subcopy,
            bodyEmphasis: bodyEmphasis,
            addressChip: addressChip,
            statusPill: statusPill,
            timeline: timeline,
            currentStageId: currentStageId,
            actionCards: actionCards,
            explainerBullets: explainerBullets,
            actionStack: actionStack,
            footnote: footnote,
            primaryCta: primaryCta,
            secondaryCta: secondaryCta
        )
    }
}

private struct AddressVerdictRow: View {
    let check: CheckAddressResponse

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(verdictIcon, size: 20, color: verdictColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(verdictHeadline)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Text(verdictSubcopy)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(verdictHeadline). \(verdictSubcopy)")
    }

    private var verdictIcon: PantopusIcon {
        check.exists ? .alertCircle : .checkCircle
    }

    private var verdictColor: Color {
        check.exists ? Theme.Color.warning : Theme.Color.success
    }

    private var verdictHeadline: String {
        check.exists
            ? "Already on Pantopus"
            : "Looks good"
    }

    private var verdictSubcopy: String {
        if check.exists {
            return "Another household already has this address. We'll route you to a join flow next."
        }
        return "We'll create a new household for this address."
    }
}

private struct PrimaryHomeToggle: View {
    let isPrimary: Bool
    let onChange: @MainActor @Sendable (Bool) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("This is my primary home")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Text("Use this home for default mail and notifications.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Toggle(
                "",
                isOn: Binding(get: { isPrimary }, set: onChange)
            )
            .labelsHidden()
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("addHome_primaryToggle")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

private struct RoleRow: View {
    let role: AddHomeRole
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                Text(role.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addHome_role_\(role.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct AddHomeErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("addHomeErrorBanner")
    }
}

#Preview {
    AddHomeWizardView { _ in }
}
