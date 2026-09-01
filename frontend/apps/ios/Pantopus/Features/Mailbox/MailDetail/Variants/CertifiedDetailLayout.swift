//
//  CertifiedDetailLayout.swift
//  Pantopus
//
//  T6.5c (P21) — Certified (A17.3) variant of the mail item detail.
//  Sits on the shared `MailItemDetailShell` (P19) and adds:
//    - `CertifiedStampBadge` on the trailing edge of the hero
//    - emphasis treatment on the Deadline + Amount key facts
//    - `ChainOfCustodyTimeline` (shared) for the postal scan history
//    - `CombinedSenderCarrierCard` (feature-local) replaces the
//      standard sender card
//    - "Acknowledge receipt" primary action — wired to the same
//      `PATCH /api/mailbox/:id/ack` endpoint as the generic A17.1 view
//      so we don't fork the optimistic-ack path
//

import Foundation
import SwiftUI

// swiftlint:disable file_length type_body_length multiple_closures_with_trailing_closure

@MainActor
struct CertifiedDetailLayout: View {
    let content: MailDetailContent
    let certified: CertifiedDetailDTO
    let ackInFlight: Bool
    let onBack: @MainActor () -> Void
    let onAcknowledge: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    /// T6.5e (P19.5) — Opens the Save-to-vault picker. The host
    /// (`MailDetailView`) owns the confirmation dialog; the variant
    /// just signals the trigger. Defaults to a no-op so existing call
    /// sites compile unchanged.
    var onSaveToVault: @MainActor () -> Void = {}
    /// A17.12 — opens the Elf-extracted task Pantopus made from this
    /// certified notice. `nil` hides the affordance (e.g. snapshot
    /// fixtures), so existing call sites compile unchanged.
    var onOpenExtractedTask: (@MainActor () -> Void)?
    /// A17.3 — fetches the legal delivery proof
    /// (`GET …/p2/certified/:mailId/proof`). RN only offers this once the
    /// item is acknowledged (`src/app/mailbox/certified.tsx:200`), which
    /// matches the route's own 400 gate.
    var onDownloadProof: @MainActor () -> Void = {}
    /// `true` once the proof has been fetched — the tile flips to
    /// "Saved" (RN's `✓ Saved`).
    var proofSaved: Bool = false
    /// `true` while the proof fetch is in flight.
    var proofInFlight: Bool = false
    @State private var showsConfirmGate = false
    @State private var didAutoPresentConfirmGate = false
    @State private var showsTermsSheet = false

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { HeroCard(content: content, certified: certified) },
            keyFacts: { keyFactsCard },
            body: {
                ChainOfCustodyTimeline(
                    subtitle: "Postal scans · cryptographic receipts",
                    status: chainStatus,
                    events: makeChainEvents()
                )
            },
            sender: { senderAndNotice },
            actions: { actionsRow }
        )
        .onAppear {
            guard !didAutoPresentConfirmGate, shouldShowConfirmGate else { return }
            didAutoPresentConfirmGate = true
            showsConfirmGate = true
        }
        .sheet(isPresented: $showsConfirmGate) {
            CertifiedConfirmGate(
                senderName: content.senderDisplayName,
                referenceNumber: certified.referenceNumber,
                deadlineLabel: certified.acknowledgeBy.flatMap(formatDeadline),
                isSigning: ackInFlight,
                onReviewFirst: { showsConfirmGate = false },
                onSign: {
                    showsConfirmGate = false
                    onAcknowledge()
                }
            )
        }
        .sheet(isPresented: $showsTermsSheet) {
            if let termsURL = certified.termsURL {
                CertifiedTermsSheet(termsURL: termsURL) {
                    showsTermsSheet = false
                }
            }
        }
        .accessibilityIdentifier("mailDetail_certified")
    }

    // MARK: - Top bar

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Certified mail",
            trust: .verified,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save to vault",
                isActive: false
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "forward", icon: .send, label: "Forward") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {},
                MailOverflowItem(id: "report", icon: .info, label: "Report") {},
                MailOverflowItem(id: "delete", icon: .trash2, label: "Delete", isDestructive: true) {}
            ]
        )
    }

    // MARK: - AI elf

    private func makeAIElf() -> AIElfStripContent? {
        guard let summary = content.aiSummary, !summary.isEmpty else { return nil }
        return AIElfStripContent(
            headline: content.isAcknowledged ? "What happens next" : "Pantopus read this for you",
            summary: summary
        )
    }

    // MARK: - Attachments

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .pdf, name: name)
        }
        return AttachmentsRowContent(items: items)
    }

    // MARK: - Key facts (emphasised Deadline + Amount)

    private var keyFactsCard: some View {
        CertifiedKeyFactsCard(rows: makeKeyFacts())
    }

    /// Build the key facts in the A17.3 order: amount first, then the
    /// due/signing date, followed by reference and document metadata.
    private func makeKeyFacts() -> [CertifiedKeyFact] {
        var rows: [CertifiedKeyFact] = []
        if let amount = extractAmount(from: content.bodyParagraphs.joined(separator: "\n\n")) {
            rows.append(
                CertifiedKeyFact(
                    icon: .dollarSign,
                    label: "Amount due",
                    value: amount,
                    note: nil,
                    tag: CertifiedKeyFactTag(text: "New charge", background: Theme.Color.errorBg, foreground: Theme.Color.error),
                    isEmphasis: true
                )
            )
        }
        if let deadline = certified.acknowledgeBy.flatMap(formatDeadline) {
            rows.append(
                CertifiedKeyFact(
                    icon: .calendarClock,
                    label: amountLabel,
                    value: deadline,
                    note: "Required to keep the chain unbroken",
                    tag: countdownTag(certified.acknowledgeBy),
                    isEmphasis: true
                )
            )
        }
        if let reference = certifiedReference {
            rows.append(
                CertifiedKeyFact(
                    icon: .hash,
                    label: "Reference",
                    value: reference,
                    note: nil,
                    tag: nil,
                    isEmphasis: false
                )
            )
        }
        if let documentType = certified.documentType {
            rows.append(
                CertifiedKeyFact(
                    icon: .fileText,
                    label: "Document type",
                    value: documentType,
                    note: nil,
                    tag: nil,
                    isEmphasis: false
                )
            )
        }
        if let received = content.createdAtLabel {
            rows.append(
                CertifiedKeyFact(
                    icon: .calendar,
                    label: "Received",
                    value: received,
                    note: nil,
                    tag: nil,
                    isEmphasis: false
                )
            )
        }
        return rows
    }

    private var amountLabel: String {
        extractAmount(from: content.bodyParagraphs.joined(separator: "\n\n")) == nil ? "Sign by" : "Pay by"
    }

    private var certifiedReference: String? {
        let ref = certified.referenceNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        return ref.isEmpty ? nil : ref
    }

    // MARK: - Chain of custody

    private var chainStatus: ChainOfCustodyStatus {
        // Backend doesn't expose a "broken" flag today — treat the
        // chain as unbroken when at least one step is complete, else
        // collapse to a custom "Pending" pill so the user sees the row
        // is informational rather than a guarantee.
        let anyComplete = certified.chain.contains { $0.isComplete }
        if anyComplete { return .unbroken }
        return .custom(
            label: "Pending",
            background: Theme.Color.appSurfaceSunken,
            foreground: Theme.Color.appTextSecondary
        )
    }

    private func makeChainEvents() -> [ChainOfCustodyEvent] {
        certified.chain.map { step in
            ChainOfCustodyEvent(
                id: step.id,
                icon: iconForChainStep(id: step.id),
                label: step.label,
                meta: nil,
                timestamp: step.occurredAt.flatMap(formatChainTimestamp),
                isPantopusEvent: step.id.lowercased().contains("ack")
                    || step.id.lowercased().contains("pantopus"),
                isComplete: step.isComplete
            )
        }
    }

    private func iconForChainStep(id: String) -> PantopusIcon {
        let lower = id.lowercased()
        if lower.contains("ack") { return .badgeCheck }
        if lower.contains("deliver") { return .mailbox }
        if lower.contains("transit") || lower.contains("plane") { return .package }
        if lower.contains("scan") { return .scanLine }
        if lower.contains("postmark") || lower.contains("postal") { return .stamp }
        return .check
    }

    // MARK: - Sender card

    private var senderCard: some View {
        CombinedSenderCarrierCard(
            senderName: content.senderDisplayName,
            senderMeta: content.senderMeta,
            senderInitials: content.senderInitials,
            senderAvatarTint: content.category.accent,
            senderUserId: content.senderUserId,
            trust: content.trust,
            carrier: defaultCarrier(),
            onOpenSenderProfile: onOpenSenderProfile
        )
    }

    private var senderAndNotice: some View {
        VStack(spacing: Spacing.s3) {
            if let onOpenExtractedTask {
                ExtractedTaskCard(onTap: onOpenExtractedTask)
            }
            senderCard
            if shouldShowTermsSummary {
                CertifiedTermsSummaryCard(
                    termsURL: certified.termsURL,
                    onViewTerms: termsSummaryAction
                )
            }
            if !content.bodyParagraphs.isEmpty {
                BodyCard(paragraphs: content.bodyParagraphs)
            }
        }
    }

    private var shouldShowTermsSummary: Bool {
        certified.termsURL != nil || certified.acknowledgeBy != nil
    }

    private var termsSummaryAction: (@MainActor () -> Void)? {
        guard certified.termsURL != nil else { return nil }
        return { showsTermsSheet = true }
    }

    /// Until the backend surfaces carrier metadata on the V1 detail, we
    /// emit a sensible default per the design — USPS Certified Mail with
    /// the certified reference repurposed as the tracking number.
    private func defaultCarrier() -> MailCarrierInfo {
        MailCarrierInfo(
            service: "USPS Certified Mail",
            trackingId: certifiedReference,
            signatureRequired: true,
            postmarkVerified: true
        )
    }

    // MARK: - Actions

    private var actionsRow: some View {
        VStack(spacing: Spacing.s2) {
            acknowledgeButton
            secondaryRow
            disclaimer
        }
    }

    private var acknowledgeButton: some View {
        Button(action: { handleAcknowledgeTap() }) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    content.isAcknowledged || content.isArchived ? .checkCircle : .check,
                    size: 16,
                    color: content.isAcknowledged || content.isArchived ? Theme.Color.success : Theme.Color.appTextInverse
                )
                Text(primaryActionTitle)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(content.isAcknowledged || content.isArchived ? Theme.Color.success : Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(content.isAcknowledged || content.isArchived ? Theme.Color.appSurface : Theme.Color.primary600)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(
                        content.isAcknowledged || content.isArchived ? Theme.Color.successLight : Color.clear,
                        lineWidth: 1.5
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(ackInFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(ackInFlight || content.isArchived)
        .accessibilityIdentifier("mailDetail_certified_acknowledge")
    }

    private var primaryActionTitle: String {
        if content.isArchived { return "Archived · receipt on file" }
        if content.isAcknowledged { return "Signed · receipt on file" }
        return "Sign for delivery"
    }

    private var shouldShowConfirmGate: Bool {
        content.readStatusLabel.lowercased() == "unread"
            && !content.isAcknowledged
            && !content.isArchived
    }

    private func handleAcknowledgeTap() {
        if shouldShowConfirmGate {
            showsConfirmGate = true
        } else {
            onAcknowledge()
        }
    }

    private var secondaryRow: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)],
            spacing: Spacing.s2
        ) {
            secondaryTile(icon: .dollarSign, label: "Pay")
            secondaryTile(icon: .calendar, label: "Calendar")
            secondaryTile(icon: .flag, label: "Dispute")
            secondaryTile(icon: .archive, label: "Archive")
            // A17.3 — the legal delivery proof only exists after the
            // acknowledgement is on file, so the tile appears with it.
            if content.isAcknowledged {
                proofTile
            }
        }
    }

    /// "⬇ Proof" → "✓ Saved" (RN `certified.tsx:200-207`).
    private var proofTile: some View {
        Button(action: { onDownloadProof() }) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    proofSaved ? .badgeCheck : .download,
                    size: 15,
                    color: proofSaved ? Theme.Color.success : Theme.Color.primary600
                )
                Text(proofSaved ? "Saved" : "Proof")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(proofSaved ? Theme.Color.success : Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 11)
            .background(proofSaved ? Theme.Color.successBg : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(proofSaved ? Theme.Color.successLight : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .opacity(proofInFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(proofInFlight || proofSaved)
        .accessibilityLabel(proofSaved ? "Delivery proof saved" : "Download delivery proof")
        .accessibilityIdentifier("mailDetail_certified_proof")
    }

    private func secondaryTile(icon: PantopusIcon, label: String) -> some View {
        Button(action: {}) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 15, color: Theme.Color.primary600)
                Text(label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 11)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var disclaimer: some View {
        Text(
            "Acknowledging confirms receipt only · it does not waive your right to appeal or dispute the charge."
        )
        .font(.system(size: 10.5))
        .foregroundStyle(Theme.Color.appTextMuted)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 18)
    }

    // MARK: - Helpers

    private func formatDeadline(_ iso: String) -> String? {
        MailDetailViewModel.formatLongDate(iso)
    }

    private func countdownTag(_ iso: String?) -> CertifiedKeyFactTag? {
        guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
        if days < 0 {
            return CertifiedKeyFactTag(
                text: "Overdue",
                background: Theme.Color.errorBg,
                foreground: Theme.Color.error
            )
        }
        if days == 0 {
            return CertifiedKeyFactTag(
                text: "Today",
                background: Theme.Color.warningBg,
                foreground: Theme.Color.warning
            )
        }
        return CertifiedKeyFactTag(
            text: "\(days) days left",
            background: Theme.Color.warningBg,
            foreground: Theme.Color.warning
        )
    }

    private func formatChainTimestamp(_ iso: String) -> String {
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = isoFull.date(from: iso) ?? plain.date(from: iso) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE · h:mm a"
        return formatter.string(from: date)
    }

    private func extractAmount(from body: String) -> String? {
        // Best-effort heuristic — grab the first `$X,XXX.XX` match in
        // the body and present it as the headline amount. Backend will
        // expose a typed `amount` field on the certified payload in a
        // follow-up; this keeps the surface useful until then.
        let pattern = #"\$\d{1,3}(?:,\d{3})*(?:\.\d{2})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(body.startIndex..<body.endIndex, in: body)
        guard let match = regex.firstMatch(in: body, range: range),
              let matchRange = Range(match.range, in: body) else {
            return nil
        }
        return String(body[matchRange])
    }
}

// MARK: - Hero with stamp

private struct HeroCard: View {
    let content: MailDetailContent
    let certified: CertifiedDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s1) {
                TrustBadge()
                CategoryBadge(category: content.category)
                Spacer()
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            HStack(alignment: .top, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(content.senderDisplayName.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(content.title)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(certified.referenceNumber)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.top, Spacing.s1)
                }
                CertifiedStampBadge(trackingId: certified.referenceNumber)
            }
            if content.isAcknowledged {
                acknowledgedRow
            }
            if content.isArchived {
                archivedRow
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(content.category.accent).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var acknowledgedRow: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 13, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Theme.Color.success)
                .clipShape(Circle())
            (
                Text("Acknowledged").bold()
                    + Text(" · receipt on file").foregroundColor(Theme.Color.success.opacity(0.85))
            )
            .pantopusTextStyle(.caption)
            .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.top, Spacing.s2)
    }

    private var archivedRow: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.archive, size: 13, color: Theme.Color.appTextSecondary)
                .frame(width: 20, height: 20)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
            Text("Archived · saved with certified receipt")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.top, Spacing.s2)
    }
}

// MARK: - Elf-extracted task affordance (A17.12)

/// "Pantopus made a task" row surfaced on certified notices that carry a
/// deadline. Tapping it opens the A17.12 Mail-task detail. Indigo task
/// accent so it reads as the automated-productivity chrome.
private struct ExtractedTaskCard: View {
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: { onTap() }) {
            HStack(spacing: Spacing.s3) {
                Icon(.listChecks, size: 18, color: Theme.Color.categoryTask)
                    .frame(width: 38, height: 38)
                    .background(Theme.Color.categoryTask.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.sparkles, size: 10, color: Theme.Color.categoryTask)
                        Text("Pantopus made a task")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    Text("Submit written comment · due Fri 5:00 PM")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Text("View task")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.categoryTask)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3 - 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.categoryTask.opacity(0.35), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailDetail_viewExtractedTask")
        .accessibilityLabel("Pantopus made a task: Submit written comment, due Friday 5 PM. View task.")
    }
}

private struct TrustBadge: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 11, color: Theme.Color.success)
            Text("Verified")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .accessibilityLabel("Verified sender")
    }
}

private struct CategoryBadge: View {
    let category: MailItemCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 11, color: category.accent)
            Text(category.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(category.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(category.rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

// MARK: - Certified key facts card (emphasis treatment)

struct CertifiedKeyFactTag: Hashable {
    let text: String
    let background: Color
    let foreground: Color
}

struct CertifiedKeyFact: Identifiable, Hashable {
    let id: String
    let icon: PantopusIcon
    let label: String
    let value: String
    let note: String?
    let tag: CertifiedKeyFactTag?
    let isEmphasis: Bool

    init(
        id: String = UUID().uuidString,
        icon: PantopusIcon,
        label: String,
        value: String,
        note: String?,
        tag: CertifiedKeyFactTag?,
        isEmphasis: Bool
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.note = note
        self.tag = tag
        self.isEmphasis = isEmphasis
    }
}

private struct CertifiedKeyFactsCard: View {
    let rows: [CertifiedKeyFact]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("KEY FACTS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                Row(row: row)
                if index < rows.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private struct Row: View {
        let row: CertifiedKeyFact

        var body: some View {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(row.icon, size: row.isEmphasis ? 15 : 13, color: tintForeground)
                    .frame(width: row.isEmphasis ? 28 : 24, height: row.isEmphasis ? 28 : 24)
                    .background(tintBackground)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                VStack(alignment: .leading, spacing: row.isEmphasis ? 2 : 1) {
                    Text(row.label.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(row.value)
                        .font(.system(size: row.isEmphasis ? 16 : 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let note = row.note {
                        Text(note)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
                if let tag = row.tag {
                    Text(tag.text)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(tag.foreground)
                        .padding(.horizontal, Spacing.s1 + 2)
                        .padding(.vertical, 3)
                        .background(tag.background)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                }
            }
            .padding(row.isEmphasis ? Spacing.s3 : Spacing.s2)
            .padding(.horizontal, row.isEmphasis ? 0 : Spacing.s1)
            .background(row.isEmphasis ? Theme.Color.warningBg : Color.clear)
        }

        private var tintBackground: Color {
            row.isEmphasis ? Theme.Color.warningLight : Theme.Color.appSurfaceSunken
        }

        private var tintForeground: Color {
            row.isEmphasis ? Theme.Color.warning : Theme.Color.appTextStrong
        }
    }
}

private struct BodyCard: View {
    let paragraphs: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NOTICE TEXT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}
