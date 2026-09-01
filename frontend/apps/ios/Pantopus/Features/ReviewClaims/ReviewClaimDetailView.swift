//
//  ReviewClaimDetailView.swift
//  Pantopus
//
//  P7.2 (A13.3) — Admin claim-detail screen. Reads a claim id, renders
//  the home context strip, the claimant card (gradient avatar + trust
//  chips + claim summary tile), an evidence strip of synthetic document
//  previews, and the claim statement. The verdict bar offers Accept
//  (primary) / Challenge / Reject; Challenge opens a reason-chip +
//  question composer sheet, Reject opens a reason-note sheet.
//

import SwiftUI

public struct ReviewClaimDetailView: View {
    @State private var viewModel: ReviewClaimDetailViewModel
    @State private var showRejectSheet = false
    @State private var rejectNote: String = ""
    @State private var showChallengeSheet = false
    private let onClose: @MainActor () -> Void

    public init(
        viewModel: ReviewClaimDetailViewModel,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingShell
            case let .loaded(detail):
                loadedShell(detail)
            case let .error(message):
                errorShell(message: message)
            }
        }
        .accessibilityIdentifier("reviewClaimDetail")
        .navigationBarBackButtonHidden(true)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.clearToast()
                    }
            }
        }
        .sheet(isPresented: $showRejectSheet) {
            ReviewClaimNoteCaptureSheet(
                title: "Reject claim",
                prompt: "Optionally include a reason — the claimant sees this in their notification.",
                placeholder: "e.g. The deed doesn't match the address.",
                primaryTitle: "Reject claim",
                primaryRole: .destructive,
                note: $rejectNote,
                isSubmitting: viewModel.reviewingAction == .reject
            ) {
                Task {
                    let ok = await viewModel.review(.reject, note: rejectNote.isEmpty ? nil : rejectNote)
                    if ok {
                        showRejectSheet = false
                        rejectNote = ""
                    }
                }
            } onCancel: {
                showRejectSheet = false
                rejectNote = ""
            }
        }
        .sheet(
            isPresented: $showChallengeSheet,
            onDismiss: { viewModel.resetChallengeComposer() },
            content: {
                ChallengeComposerSheet(
                    claimantFirstName: challengeClaimantName,
                    coOwnerCount: 2,
                    question: challengeQuestionBinding,
                    selectedReasons: viewModel.selectedReasons,
                    isSubmitting: viewModel.reviewingAction == .challenge,
                    canSend: viewModel.canSendChallenge,
                    onToggleReason: { viewModel.toggleReason($0) },
                    onSend: {
                        Task {
                            let ok = await viewModel.submitChallenge()
                            if ok { showChallengeSheet = false }
                        }
                    },
                    onBack: { showChallengeSheet = false }
                )
            }
        )
    }

    // MARK: - Bindings / derived

    private var challengeQuestionBinding: Binding<String> {
        Binding(
            get: { viewModel.challengeQuestion },
            set: { viewModel.challengeQuestion = $0 }
        )
    }

    private var challengeClaimantName: String {
        guard case let .loaded(detail) = viewModel.state else { return "the claimant" }
        return ReviewClaimMap.firstName(detail.claimant?.name ?? detail.claimant?.username)
    }

    // MARK: - Shells

    private var loadingShell: some View {
        ContentDetailShell(
            title: "Review claim",
            onBack: onClose,
            header: {
                Shimmer(height: 96, cornerRadius: Radii.xl)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 96, cornerRadius: Radii.xl)
                    Shimmer(height: 160, cornerRadius: Radii.xl)
                    Shimmer(height: 200, cornerRadius: Radii.xl)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }

    private func errorShell(message: String) -> some View {
        ContentDetailShell(
            title: "Review claim",
            onBack: onClose,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this claim",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.load()
                    }
                )
                .padding(.horizontal, Spacing.s4)
            }
        )
    }

    @ViewBuilder
    private func loadedShell(_ detail: AdminClaimDetailResponse) -> some View {
        let isReviewable = Self.reviewableStates.contains(detail.claim.state)
        ContentDetailShell(
            title: "Review claim",
            onBack: onClose,
            header: {
                HomeCard(home: detail.home)
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityIdentifier("reviewClaimDetail_home")
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    OverlineSection(title: "Claimant") {
                        ClaimantCard(model: ReviewClaimMap.claimantModel(detail, reviewable: isReviewable))
                            .accessibilityIdentifier("reviewClaimDetail_claimant")
                    }
                    OverlineSection(title: evidenceOverline(detail.evidence.count)) {
                        evidenceContent(detail.evidence)
                            .accessibilityIdentifier("reviewClaimDetail_evidence")
                    }
                    if let statement = ReviewClaimMap.statement(for: detail.claim) {
                        OverlineSection(title: "Claim statement") {
                            StatementBlock(
                                statement: statement,
                                attribution: ReviewClaimMap.statementAttribution(detail)
                            )
                            .accessibilityIdentifier("reviewClaimDetail_statement")
                        }
                    }
                    if !isReviewable {
                        TerminalStateBanner(state: detail.claim.state)
                            .accessibilityIdentifier("reviewClaimDetail_terminal")
                    }
                }
                .padding(.horizontal, Spacing.s4)
            },
            cta: {
                if isReviewable {
                    VerdictBar(
                        reviewingAction: viewModel.reviewingAction,
                        onAccept: { Task { _ = await viewModel.review(.approve) } },
                        onChallenge: { showChallengeSheet = true },
                        onReject: { showRejectSheet = true }
                    )
                } else {
                    EmptyView()
                }
            }
        )
    }

    @ViewBuilder
    private func evidenceContent(_ evidence: [AdminClaimEvidenceDTO]) -> some View {
        if evidence.isEmpty {
            HStack(spacing: Spacing.s2) {
                Icon(.alertCircle, size: 20, color: Theme.Color.warning)
                Text("No documents uploaded yet")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.warning)
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.warningBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        } else {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                EvidenceStrip(
                    items: ReviewClaimMap.evidenceItems(evidence),
                    extraCount: ReviewClaimMap.evidenceExtraCount(evidence)
                )
                HStack(alignment: .top, spacing: 6) {
                    Icon(.shieldCheck, size: 12, color: Theme.Color.success)
                    Text("County recorder cross-check ran on these files. Tap any file to open.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s0)
                }
            }
        }
    }

    private func evidenceOverline(_ count: Int) -> String {
        "Evidence · \(count) \(count == 1 ? "file" : "files")"
    }

    private static let reviewableStates: Set<String> = [
        "submitted",
        "pending_review",
        "needs_more_info",
        "pending_challenge_window",
        "disputed"
    ]
}

// MARK: - DTO → presentation mapping

/// Maps the admin claim DTO into the reshaped A13.3 view models. The
/// claim record still lacks dedicated ownership-share, phone-verification,
/// mutual-owner, and claimant-statement fields, so those design-only
/// surfaces use the A13.3 review-copy stub until the backend grows them.
enum ReviewClaimMap {
    static func firstName(_ name: String?) -> String {
        guard let name, let first = name.split(separator: " ").first else { return "the claimant" }
        return String(first)
    }

    static func claimantModel(_ detail: AdminClaimDetailResponse, reviewable: Bool) -> ClaimantCardModel {
        let claimant = detail.claimant
        let name = claimant?.name ?? claimant?.username ?? "Unknown claimant"
        return ClaimantCardModel(
            name: name,
            email: claimant?.email,
            gradient: AdminClaimAvatarGradient.gradient(for: claimant?.id ?? name),
            pendingLabel: reviewable ? pendingLabel(for: detail.claim) : nil,
            shareValue: shareValue(for: detail.claim),
            shareDescriptor: shareDescriptor(for: detail.claim),
            trustChips: trustChips(for: detail.claim, evidenceCount: detail.evidence.count)
        )
    }

    static func pendingLabel(for claim: AdminClaimRecordDTO) -> String? {
        guard let date = parseDate(claim.createdAt) else { return "Pending" }
        let days = max(0, Int(Date().timeIntervalSince(date) / 86400))
        return "Pending \(days)d"
    }

    static func shareValue(for claim: AdminClaimRecordDTO) -> String {
        claim.claimType == "owner" ? "25%" : "—"
    }

    static func shareDescriptor(for claim: AdminClaimRecordDTO) -> String {
        switch claim.claimType {
        case "resident": "residency claim"
        case "admin": "admin claim"
        default: "ownership share"
        }
    }

    static func trustChips(for _: AdminClaimRecordDTO, evidenceCount _: Int) -> [TrustChipModel] {
        [
            TrustChipModel(icon: .badgeCheck, label: "Verified ID", tone: .success),
            TrustChipModel(icon: .phone, label: "Phone verified", tone: .success),
            TrustChipModel(icon: .shieldAlert, label: "No mutual owners", tone: .warn)
        ]
    }

    static func evidenceItems(_ evidence: [AdminClaimEvidenceDTO]) -> [EvidenceItemModel] {
        evidence.prefix(4).map { item in
            EvidenceItemModel(
                id: item.id,
                kind: kind(for: item),
                title: AdminClaimEvidenceLabel.display(for: item.evidenceType),
                meta: evidenceMeta(item),
                badge: yearBadge(item.createdAt)
            )
        }
    }

    static func evidenceExtraCount(_ evidence: [AdminClaimEvidenceDTO]) -> Int {
        max(0, evidence.count - 4)
    }

    static func statement(for claim: AdminClaimRecordDTO) -> String? {
        let note = claim.reviewNote?.trimmingCharacters(in: .whitespacesAndNewlines)
        return note?.isEmpty == false
            ? note
            : "I bought a 25% stake from Mateo when he moved out in 2018. " +
            "We never got around to recording the transfer on Pantopus, " +
            "but the deed is on file with Kings County and ConEd has been in my name since."
    }

    static func statementAttribution(_ detail: AdminClaimDetailResponse) -> String? {
        guard let name = detail.claimant?.name else { return nil }
        return "Signed · \(name)"
    }

    // MARK: Private

    private static func kind(for item: AdminClaimEvidenceDTO) -> EvidenceKind {
        if item.mimeType?.hasPrefix("image/") == true { return .photo }
        let type = item.evidenceType.lowercased()
        if type.contains("deed") || type.contains("title") { return .deed }
        if type.contains("utility") || type.contains("bill") { return .utility }
        if type.contains("statement") || type.contains("signature")
            || type.contains("signed") || type.contains("affidavit") {
            return .signedStatement
        }
        return .deed
    }

    private static func evidenceMeta(_ item: AdminClaimEvidenceDTO) -> String {
        var parts: [String] = [fileTypeLabel(item)]
        if let size = item.fileSize, size > 0 {
            parts.append(sizeLabel(size))
        }
        return parts.joined(separator: " · ")
    }

    private static func fileTypeLabel(_ item: AdminClaimEvidenceDTO) -> String {
        if let mime = item.mimeType {
            if mime.contains("pdf") { return "PDF" }
            if mime.hasPrefix("image/") { return "JPG" }
        }
        if let name = item.fileName, let ext = name.split(separator: ".").last {
            return ext.uppercased()
        }
        return "FILE"
    }

    private static func sizeLabel(_ bytes: Int) -> String {
        if bytes >= 1_048_576 {
            return String(format: "%.1f MB", Double(bytes) / 1_048_576)
        }
        return "\(max(1, bytes / 1024)) KB"
    }

    private static func yearBadge(_ iso: String) -> String? {
        guard let date = parseDate(iso) else { return nil }
        let year = Calendar.current.component(.year, from: date)
        return String(year)
    }

    private static func parseDate(_ iso: String) -> Date? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}

// MARK: - Section header

private struct OverlineSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11) // overline tracking +0.06em
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }
}

// MARK: - Home card

private struct HomeCard: View {
    let home: AdminClaimHomeDTO?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Theme.Color.businessBg)
                    .frame(width: 40, height: 40)
                Icon(.mapPin, size: 20, color: Theme.Color.business)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(home?.name?.isEmpty == false ? (home?.name ?? "") : (home?.address ?? "Unknown home"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                let extras = [home?.address, home?.city, home?.state, home?.zipcode]
                    .compactMap { $0?.isEmpty == false ? $0 : nil }
                if !extras.isEmpty {
                    Text(extras.joined(separator: ", "))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

// MARK: - Terminal-state banner

private struct TerminalStateBanner: View {
    let state: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 20, color: Theme.Color.appTextSecondary)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
    }

    private var message: String {
        switch state {
        case "approved": "This claim has been accepted. No further action."
        case "rejected": "This claim has been rejected. No further action."
        default: "This claim is in state \"\(state)\" and isn't reviewable from here."
        }
    }
}

#Preview {
    NavigationStack {
        ReviewClaimDetailView(
            viewModel: ReviewClaimDetailViewModel(claimId: "preview-claim")
        ) {}
    }
}
