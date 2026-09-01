//
//  BusinessLegalView.swift
//  Pantopus
//
//  A10.7 owner surface — "Legal & verification". Verification tier card +
//  evidence ledger + self-attestation + document upload, then the private
//  (legal / finance) record form behind a "private to the owner" notice.
//
//  Mirrors RN `src/components/business/tabs/LegalTab.tsx` and Android
//  `BusinessLegalScreen.kt`.
//
// swiftlint:disable file_length type_body_length

import SwiftUI
import UniformTypeIdentifiers

/// Documents the owner may attach as verification evidence.
private let evidenceUploadTypes: [UTType] = [.pdf, .image, .plainText]

/// Owner-only legal + verification surface for a single business.
public struct BusinessLegalView: View {
    @State private var viewModel: BusinessLegalViewModel
    @State private var showsFilePicker = false
    @State private var pendingEvidenceType: BusinessEvidenceType?
    @State private var showsAttestConfirm = false

    public init(businessId: String) {
        _viewModel = State(initialValue: BusinessLegalViewModel(businessId: businessId))
    }

    /// Preview / test seam.
    init(viewModel: BusinessLegalViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Theme.Color.appBg)
            .navigationTitle("Legal & verification")
            .navigationBarTitleDisplayMode(.inline)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("businessLegal.screen")
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .onDisappear { viewModel.clearSensitive() }
            .fileImporter(
                isPresented: $showsFilePicker,
                allowedContentTypes: evidenceUploadTypes,
                allowsMultipleSelection: false
            ) { result in
                handlePicked(result)
            }
            .alert("Attest to your legal details?", isPresented: $showsAttestConfirm) {
                Button("Attest", role: .destructive) {
                    Task { await viewModel.selfAttest() }
                }
                .accessibilityIdentifier("businessLegal_attestConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(
                    "You're confirming that \"\(viewModel.legalName)\" is this business's registered "
                        + "legal name and that its address on Pantopus is correct. This is recorded "
                        + "against your account."
                )
            }
            .overlay(alignment: .bottom) { actionToast }
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case let .loaded(payload):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    privacyNotice
                    verificationCard(payload)
                    if let nonprofit = payload.nonprofit {
                        nonprofitCard(nonprofit, canUpload: payload.canUploadEvidence)
                    }
                    if payload.privateAccessDenied {
                        deniedCard
                    } else {
                        privateRecordCard(payload)
                    }
                }
                .padding(Spacing.s4)
            }
            .accessibilityIdentifier("businessLegal.loaded")
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load legal info",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .accessibilityIdentifier("businessLegal.error")
        }
    }

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(height: 56, cornerRadius: Radii.lg)
            Shimmer(height: 210, cornerRadius: Radii.lg)
            Shimmer(height: 260, cornerRadius: Radii.lg)
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("businessLegal.loading")
    }

    // MARK: - Privacy notice

    private var privacyNotice: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.lock, size: 14, strokeWidth: 2, color: Theme.Color.warning)
            Text("This information is private and only visible to the business owner.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("businessLegal.privacyNotice")
    }

    // MARK: - Verification card

    private func verificationCard(_ payload: BusinessLegalContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(tierIcon(payload.tier), size: 18, strokeWidth: 2, color: tierAccent(payload.tier))
                Text("Verification")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s2)
                Text(payload.tier.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(tierAccent(payload.tier))
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 3)
                    .background(tierBackground(payload.tier))
                    .clipShape(Capsule())
                    .accessibilityIdentifier("businessLegal.tierPill")
            }

            Text(payload.tier.blurb)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let verified = payload.verifiedDateLabel {
                Text("Verified \(verified)")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }

            if !payload.evidence.isEmpty {
                VStack(spacing: Spacing.s0) {
                    ForEach(payload.evidence) { row in
                        evidenceRow(row)
                        if row.id != payload.evidence.last?.id {
                            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                        }
                    }
                }
                .background(Theme.Color.appBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("businessLegal.evidenceLedger")
            }

            if payload.canSelfAttest {
                selfAttestBlock
            } else if let reason = payload.selfAttestBlockedReason {
                Text(reason)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.warning)
                    .accessibilityIdentifier("businessLegal.attestBlocked")
            }

            if payload.canUploadEvidence {
                uploadMenu
            } else {
                Text("A document is already in review, or this business is fully verified.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("businessLegal.uploadBlocked")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessLegal.verificationCard")
    }

    private func evidenceRow(_ row: BusinessEvidenceRow) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.fileText, size: 15, color: Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let date = row.dateLabel {
                    Text(date)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s2)
            Text(row.status.capitalized)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(evidenceAccent(row.status))
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 2)
                .background(evidenceBackground(row.status))
                .clipShape(Capsule())
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("businessLegal.evidence.\(row.id)")
    }

    private var selfAttestBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Toggle(isOn: $viewModel.addressConfirmed) {
                Text("I confirm this business's registered address on Pantopus is correct.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .tint(Theme.Color.business)
            .accessibilityIdentifier("businessLegal.addressConfirm")

            PrimaryButton(
                title: "Attest to legal details",
                isLoading: viewModel.action == .attesting,
                isEnabled: viewModel.addressConfirmed
                    && !viewModel.legalName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ) {
                await MainActor.run { showsAttestConfirm = true }
            }
            .accessibilityIdentifier("businessLegal.selfAttest")
        }
    }

    private var uploadMenu: some View {
        Menu {
            ForEach(BusinessEvidenceType.allCases) { type in
                Button(type.label) {
                    pendingEvidenceType = type
                    showsFilePicker = true
                }
                .accessibilityIdentifier("businessLegal.upload.\(type.rawValue)")
            }
        } label: {
            HStack(spacing: Spacing.s1) {
                if viewModel.action == .uploading {
                    ProgressView().controlSize(.small).tint(Theme.Color.business)
                } else {
                    Icon(.plusCircle, size: 16, color: Theme.Color.business)
                }
                Text("Upload verification document")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.businessBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .accessibilityIdentifier("businessLegal.uploadEvidence")
    }

    // MARK: - Nonprofit card

    private func nonprofitCard(_ nonprofit: BusinessNonprofitVerificationDTO, canUpload: Bool) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.badgeCheck, size: 18, strokeWidth: 2, color: Theme.Color.business)
                Text("Nonprofit verification")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
            }
            if nonprofit.einApproved {
                Text("501(c)(3) status verified — your platform fee is 0%.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.success)
            } else if nonprofit.einPending {
                Text("Pending admin review — your EIN / tax-exempt documentation is being checked.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.warning)
            } else {
                Text(
                    "Upload your IRS determination letter or EIN verification to confirm 501(c)(3) "
                        + "status and unlock a 0% platform fee."
                )
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                if canUpload {
                    HStack(spacing: Spacing.s2) {
                        nonprofitUploadButton(.einVerification, title: "EIN letter")
                        nonprofitUploadButton(.taxExemptLetter, title: "501(c)(3) letter")
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessLegal.nonprofitCard")
    }

    private func nonprofitUploadButton(_ type: BusinessEvidenceType, title: String) -> some View {
        Button {
            pendingEvidenceType = type
            showsFilePicker = true
        } label: {
            Text(title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(Theme.Color.business)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("businessLegal.nonprofitUpload.\(type.rawValue)")
    }

    // MARK: - Private record

    private func privateRecordCard(_ payload: BusinessLegalContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("LEGAL & FINANCE")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)

            PantopusTextField(
                "Legal business name",
                text: $viewModel.legalName,
                placeholder: "Registered business name",
                identifier: "businessLegal.legalName"
            )

            PantopusTextField(
                "Tax ID (last 4 digits)",
                text: $viewModel.taxIdLast4,
                placeholder: "1234",
                keyboardType: .numberPad,
                identifier: "businessLegal.taxIdLast4"
            )
            .onChange(of: viewModel.taxIdLast4) { _, newValue in
                let digits = String(newValue.filter(\.isNumber).prefix(4))
                if digits != newValue { viewModel.taxIdLast4 = digits }
            }

            Text("Pantopus only ever stores the last four digits. Never enter a full EIN or SSN.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)

            PantopusTextField(
                "Support email",
                text: $viewModel.supportEmail,
                placeholder: "support@yourbusiness.com",
                keyboardType: .emailAddress,
                identifier: "businessLegal.supportEmail"
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

            PrimaryButton(
                title: payload.hasPrivateRecord ? "Update" : "Save",
                isLoading: viewModel.action == .saving
            ) {
                await viewModel.savePrivateRecord()
            }
            .accessibilityIdentifier("businessLegal.save")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessLegal.privateCard")
    }

    private var deniedCard: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shieldAlert, size: 16, color: Theme.Color.appTextMuted)
            VStack(alignment: .leading, spacing: 2) {
                Text("Legal details are owner-only")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Ask the business owner to update the legal name, tax ID or support email.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessLegal.privateDenied")
    }

    // MARK: - File picking

    private func handlePicked(_ result: Result<[URL], any Error>) {
        guard let type = pendingEvidenceType else { return }
        pendingEvidenceType = nil
        guard case let .success(urls) = result, let url = urls.first else { return }
        let didStart = url.startAccessingSecurityScopedResource()
        defer { if didStart { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return }
        let mime = (UTType(filenameExtension: url.pathExtension)?.preferredMIMEType)
            ?? "application/octet-stream"
        let file = PickedEvidenceFile(
            filename: url.lastPathComponent,
            mimeType: mime,
            data: data
        )
        Task { await viewModel.uploadEvidence(type: type, file: file) }
    }

    // MARK: - Tokens

    private func tierIcon(_ tier: BusinessVerificationTier) -> PantopusIcon {
        switch tier {
        case .unverified: .shieldAlert
        case .selfAttested: .shield
        case .documentVerified, .governmentVerified: .shieldCheck
        }
    }

    private func tierAccent(_ tier: BusinessVerificationTier) -> Color {
        switch tier {
        case .unverified: Theme.Color.appTextSecondary
        case .selfAttested: Theme.Color.info
        case .documentVerified, .governmentVerified: Theme.Color.success
        }
    }

    private func tierBackground(_ tier: BusinessVerificationTier) -> Color {
        switch tier {
        case .unverified: Theme.Color.appBorderSubtle
        case .selfAttested: Theme.Color.infoBg
        case .documentVerified, .governmentVerified: Theme.Color.successBg
        }
    }

    private func evidenceAccent(_ status: String) -> Color {
        switch status {
        case "approved": Theme.Color.success
        case "rejected": Theme.Color.error
        default: Theme.Color.warning
        }
    }

    private func evidenceBackground(_ status: String) -> Color {
        switch status {
        case "approved": Theme.Color.successBg
        case "rejected": Theme.Color.errorBg
        default: Theme.Color.warningBg
        }
    }

    // MARK: - Action toast

    @ViewBuilder private var actionToast: some View {
        switch viewModel.action {
        case let .succeeded(message):
            toast(message, background: Theme.Color.success)
        case let .failed(message):
            toast(message, background: Theme.Color.error)
        default:
            EmptyView()
        }
    }

    private func toast(_ message: String, background: Color) -> some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(Spacing.s4)
            .accessibilityIdentifier("businessLegal.actionToast")
            .onTapGesture { viewModel.clearAction() }
            .task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                viewModel.clearAction()
            }
    }
}

#Preview("Unverified") {
    NavigationStack {
        BusinessLegalView(
            viewModel: BusinessLegalViewModel(
                businessId: "biz",
                content: BusinessLegalContent(
                    tier: .unverified,
                    verifiedDateLabel: nil,
                    evidence: [],
                    canSelfAttest: true,
                    selfAttestBlockedReason: nil,
                    canUploadEvidence: true,
                    nonprofit: nil,
                    hasPrivateRecord: false,
                    privateAccessDenied: false
                )
            )
        )
    }
}
