//
//  ProfilePostCardSurfaces.swift
//  Pantopus
//
//  The modals behind a profile's Pulse cards (`ProfilePostCardsModel`): the
//  card's "Post options" menu (Share…, Pin to profile on your own posts,
//  Report post), Pulse's report-reason picker and the system share sheet.
//  Copy and ids follow the Pulse feed's (`FeedPostActionSurfaces`).
//

import SwiftUI

/// A post link on its way to the system share sheet.
private struct ProfilePostShareTarget: Identifiable {
    let id: String
    let url: URL
    let sessionId: String?
}

@MainActor
struct ProfilePostCardSurfaces: ViewModifier {
    let model: ProfilePostCardsModel
    @State private var shareTarget: ProfilePostShareTarget?

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                "Post options",
                isPresented: presentingOptions,
                titleVisibility: .visible
            ) {
                optionsMenu
            }
            .confirmationDialog(
                "Report this post?",
                isPresented: presentingReport,
                titleVisibility: .visible
            ) {
                ForEach(pulseReportReasons, id: \.key) { reason in
                    Button(reason.label) {
                        guard let id = model.reportingPostId else { return }
                        model.reportingPostId = nil
                        Task { await model.report(postId: id, reason: reason.key) }
                    }
                    .accessibilityIdentifier("profilePostReportReason_\(reason.key)")
                }
                Button("Cancel", role: .cancel) { model.reportingPostId = nil }
            } message: {
                Text("Reports are reviewed by the Pantopus team. The author isn't told who reported.")
            }
            .sheet(item: $shareTarget) { target in
                SystemShareSheet(items: [target.url]) {
                    Task { await model.recordShare(postId: target.id, sessionId: target.sessionId) }
                }
            }
    }

    @ViewBuilder private var optionsMenu: some View {
        if let card = model.overflowCard {
            if model.shareURL(postId: card.id) != nil {
                Button("Share…") {
                    model.overflowPostId = nil
                    Task {
                        if let url = await model.authorizeShare(postId: card.id) {
                            shareTarget = ProfilePostShareTarget(
                                id: card.id,
                                url: url,
                                sessionId: AuthManager.shared.sessionId
                            )
                        }
                    }
                }
                .accessibilityIdentifier("profilePostOptionsShare")
            }
            if let pinTitle = model.pinTitle(postId: card.id) {
                Button(pinTitle) {
                    model.overflowPostId = nil
                    Task { await model.togglePin(postId: card.id) }
                }
                .accessibilityIdentifier("profilePostOptionsPin")
            }
            if card.actions.canReport {
                Button("Report post", role: .destructive) {
                    model.overflowPostId = nil
                    model.reportingPostId = card.id
                }
                .accessibilityIdentifier("profilePostOptionsReport")
            }
            Button("Cancel", role: .cancel) { model.overflowPostId = nil }
        }
    }

    private var presentingOptions: Binding<Bool> {
        Binding(
            get: { model.overflowPostId != nil },
            set: { shown in if !shown { model.overflowPostId = nil } }
        )
    }

    private var presentingReport: Binding<Bool> {
        Binding(
            get: { model.reportingPostId != nil },
            set: { shown in if !shown { model.reportingPostId = nil } }
        )
    }
}
