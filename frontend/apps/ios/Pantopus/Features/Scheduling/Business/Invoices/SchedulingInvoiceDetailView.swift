//
//  SchedulingInvoiceDetailView.swift
//  Pantopus
//
//  G13 Invoice Detail (owner) — Stream I15. Mono reference header, total hero,
//  payer→payee identity cards, parsed line-items table, and a Send / Share dock.
//  Matches `invoicedetail-frames.jsx` within the InvoiceDTO's available fields.
//  Tokens only.
//
//  NOTE: renamed from `InvoiceDetailView` to avoid a same-module filename/type
//  collision with `Features/ContentDetail/InvoiceDetailView.swift` that broke
//  the XcodeGen target build.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct SchedulingInvoiceDetailView: View {
    @State private var model: SchedulingInvoiceDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        invoiceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: SchedulingInvoiceDetailViewModel(owner: owner, invoiceId: invoiceId, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            // Design: top-bar trailing = StatusPill showing invoice lifecycle
            // (`invoicedetail-frames.jsx` line 159). Rendered from the best-
            // available status (see `model.invoiceStatusString`).
            PkgTopBar(title: "Invoice", onBack: { dismiss() }, trailing: {
                if model.phase == .loaded {
                    InvoiceStatusChip(status: model.invoiceStatusString)
                        .padding(.trailing, Spacing.s2)
                }
            })
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { sentToast }
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.invoiceDetail")
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .comingSoon:
            PkgComingSoon(title: "Invoice")
        case let .error(message):
            PkgErrorState(message: message) { Task { await model.load() } }
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.headerLine)
                        .font(.system(size: 10.5, design: .monospaced)).foregroundStyle(Theme.Color.appTextSecondary)
                    hero
                    payerPayee.padding(.top, 14)
                    lineItemsSection.padding(.top, 16)
                    timelineSection.padding(.top, 16)
                    paymentTermsSection.padding(.top, 16)
                    if let sendError = model.sendError {
                        PkgNote(tone: .error, icon: .alertTriangle, text: sendError)
                            .padding(.top, Spacing.s4)
                            .accessibilityIdentifier("invoiceSendError")
                    }
                    Color.clear.frame(height: Spacing.s2)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
            }
            dock
        }
    }

    private var hero: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(model.totalLabel)
                .font(.system(size: 30, weight: .heavy))
                .tracking(-1.1)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
            Text("total · \(model.currencyCode)").font(.system(size: 11.5, weight: .medium)).foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.top, 16)
    }

    private var payerPayee: some View {
        HStack(spacing: 8) {
            identityCard(label: "From", name: "\(model.theme.title) provider", sub: model.theme.title, color: model.accent)
            identityCard(label: "To", name: "Customer", sub: model.recipientLabel, color: Theme.Color.personal)
        }
    }

    private func identityCard(label: String, name: String, sub: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.system(size: 8.5, weight: .bold)).tracking(0.4).foregroundStyle(Theme.Color.appTextMuted)
            Text(name).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.Color.appText).lineLimit(1)
            HStack(spacing: 4) {
                Circle().fill(color).frame(width: 6, height: 6)
                Text(sub).font(.system(size: 9.5, weight: .semibold)).foregroundStyle(color).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 11)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurface)
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    /// JSX `Section` chrome — `i data-lucide` glyph + uppercase overline title.
    private func sectionHeader(_ title: String, icon: PantopusIcon) -> some View {
        HStack(spacing: 6) {
            Icon(icon, size: 13, color: Theme.Color.appTextSecondary)
            Text(title.uppercased()).font(.system(size: 9.5, weight: .bold)).tracking(0.8).foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Line items", icon: .list)
            if model.lineItems.isEmpty {
                Text("Itemized details aren't available for this invoice.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurface)
                    .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            } else {
                table
            }
        }
    }

    private var table: some View {
        VStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s0) {
                Text("ITEM").frame(maxWidth: .infinity, alignment: .leading)
                Text("QTY").frame(width: 24, alignment: .center)
                Text("UNIT").frame(width: 52, alignment: .trailing)
                Text("TOTAL").frame(width: 56, alignment: .trailing)
            }
            .font(.system(size: 8.5, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(Theme.Color.appSurfaceRaised)
            ForEach(model.lineItems) { item in
                HStack(spacing: Spacing.s0) {
                    Text(item.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(2)
                    Text(item.quantity.map(String.init) ?? "—")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 24, alignment: .center)
                    Text(model.unitLabel(item))
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 52, alignment: .trailing)
                    Text(model.lineTotalLabel(item))
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                        .frame(width: 56, alignment: .trailing)
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 9)
                Divider().background(Theme.Color.appBorderSubtle)
            }
            HStack {
                Text("Total")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text(model.totalLabel)
                    .font(.system(size: 15, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 9)
            .background(Theme.Color.appSurfaceRaised)
        }
        .background(Theme.Color.appSurface)
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    /// Payment-timeline section (`invoicedetail-frames.jsx` `Timeline`): a
    /// bordered card with a left connecting rail, one check-dot row per
    /// lifecycle event, and a mono timestamp trailing each label. Fed by the
    /// VM's real Created/Sent events (richer Paid/Refunded/Voided dots stay
    /// deferred pending the absent `status`/`paid_at` — see VM).
    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Timeline", icon: .activity)
            VStack(spacing: Spacing.s0) {
                let events = model.timelineEvents
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    timelineRow(event, isLast: index == events.count - 1)
                }
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
    }

    private func timelineRow(_ event: SchedulingInvoiceDetailViewModel.TimelineEvent, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            // Dot + connecting rail (design: 13px dot, 1.5px rail to next row).
            ZStack(alignment: .top) {
                if !isLast {
                    Rectangle().fill(Theme.Color.appBorder)
                        .frame(width: 1.5)
                        .padding(.top, 13)
                }
                Circle().fill(timelineTone(event.tone))
                    .frame(width: 13, height: 13)
                    .overlay(Icon(.check, size: 8, strokeWidth: 4, color: Theme.Color.appTextInverse))
            }
            .frame(width: 13)
            HStack(alignment: .firstTextBaseline) {
                Text(event.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Text(event.time).font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.bottom, isLast ? 0 : 12)
        }
    }

    private func timelineTone(_ tone: SchedulingInvoiceDetailViewModel.TimelineEvent.Tone) -> Color {
        switch tone {
        case .neutral: Theme.Color.appTextMuted
        case .accent: model.accent
        case .success: Theme.Color.success
        }
    }

    /// Static product policy copy — JSX "Payment terms" section.
    private var paymentTermsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Payment terms", icon: .fileText)
            Text("Net 14 from issue. Pantopus Pay, card, or ACH.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Status-driven dock (`invoicedetail-frames.jsx` lines 196–202).
    /// Seven configurations mapped from `model.dockConfig`:
    ///   draft        → Send only
    ///   sent/overdue → Mark paid (ghost) + Resend (primary) + Overflow
    ///   paid/refunded→ Share (ghost) + Download PDF (primary)
    ///   partial      → Mark paid (ghost) + Send balance (primary)
    ///   void         → Share only (ghost full-width)
    private var dock: some View {
        PkgDock { dockContent }
    }

    @ViewBuilder
    private var dockContent: some View {
        switch model.dockConfig {
        case .sendOnly:
            PkgPrimaryButton(label: "Send", icon: .send, loading: model.sending) {
                Task { await model.send() }
            }

        case .markPaidResendOverflow:
            PkgGhostButton(label: "Mark paid", icon: .check) { model.markPaid() }
            PkgPrimaryButton(label: "Resend", icon: .send, loading: model.sending) {
                Task { await model.send() }
            }
            overflowButton

        case .shareDownload:
            shareGhostButton
            PkgPrimaryButton(label: "Download PDF", icon: .download) { model.downloadPDF() }

        case .markPaidSendBalance:
            PkgGhostButton(label: "Mark paid", icon: .check) { model.markPaid() }
            PkgPrimaryButton(label: "Send balance", icon: .send, loading: model.sending) {
                Task { await model.send() }
            }

        case .shareOnly:
            shareGhostButton
        }
    }

    private var shareGhostButton: some View {
        ShareLink(item: model.shareText) {
            HStack(spacing: 7) {
                Icon(.share2, size: 15, color: Theme.Color.appText)
                Text("Share").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        }
        .accessibilityLabel("Share invoice")
    }

    private var overflowButton: some View {
        Button { model.showOverflow() } label: {
            Icon(.ellipsis, size: 18, color: Theme.Color.appTextStrong)
                .frame(width: 46, height: 46)
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More options")
        .fixedSize()
    }

    private var sentToast: some View {
        Group {
            if model.showSentToast {
                HStack(spacing: Spacing.s2) {
                    Icon(.check, size: 15, strokeWidth: 3, color: Theme.Color.success)
                    Text("Invoice sent").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .pantopusShadow(.lg)
                .padding(.top, Spacing.s3)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.showSentToast)
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 200, height: 10)
                Shimmer(width: 160, height: 30)
                HStack(spacing: 8) { Shimmer(height: 64, cornerRadius: Radii.lg)
                    Shimmer(height: 64, cornerRadius: Radii.lg)
                }
                Shimmer(height: 160, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
        }
    }
}
