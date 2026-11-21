//
//  ProfilePostCardSurfaces.swift
//  Pantopus
//
//  The modals behind a profile's Pulse cards (`ProfilePostCardsModel`): the
//  card's "Post options" menu (Open plan on your own plan's post, Share…,
//  Pin to profile on your own posts, Report post), Pulse's report-reason
//  picker, the Repost chooser and the composer its "Repost with your words"
//  opens (PULSEREPOST contract §2, §8), and the system share sheet.
//  Copy and ids follow the Pulse feed's (`FeedPostActionSurfaces`).
//  On a list it stands behind every card (a profile). Given a post, it is
//  that card's alone: on a wide screen (the iPhone Duo open) the system draws
//  these menus as a bubble pointing at the view they are attached to, so
//  Today's Around you attaches each card's to its own "Post options" button.
//

import SwiftUI

/// A post link on its way to the system share sheet.
private struct ProfilePostShareTarget: Identifiable {
    let id: String
    let url: URL
    let sessionId: String?
}

/// "Repost with your words": the composer over the screen with the card's post quoted. Once for a list of cards:
/// behind all of them on a profile (`ProfilePostCardSurfaces`), and on Today's Around you page, whose cards each
/// have their own menus.
@MainActor
struct ProfilePostQuoteComposer: ViewModifier {
    let model: ProfilePostCardsModel

    func body(content: Content) -> some View {
        content
            .fullScreenCover(item: Binding(get: { model.quoteDraft }, set: { model.quoteDraft = $0 })) { quote in
                PulseComposeFlowView(
                    quoting: quote,
                    onCancel: { model.quoteDraft = nil },
                    onPosted: { _ in model.quoteDraft = nil }
                )
                .readableColumn()
            }
    }
}

@MainActor
struct ProfilePostCardSurfaces: ViewModifier {
    let model: ProfilePostCardsModel
    /// The one post these menus are for; nil for whichever card of the model asks.
    var postId: String?
    @State private var shareTarget: ProfilePostShareTarget?

    func body(content: Content) -> some View {
        // One card's menus leave the composer to the screen: every card presenting it would present it many times.
        if postId == nil {
            menus(content).modifier(ProfilePostQuoteComposer(model: model))
        } else {
            menus(content)
        }
    }

    private func menus(_ content: Content) -> some View {
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
            // The Repost chooser is presented by each card's ↻ (PulseCardRepostChooser).
            .sheet(item: $shareTarget) { target in
                SystemShareSheet(items: [target.url]) {
                    Task { await model.recordShare(postId: target.id, sessionId: target.sessionId) }
                }
            }
    }

    @ViewBuilder private var optionsMenu: some View {
        if let card = model.overflowCard {
            if card.actions.canOpenPlan {
                Button("Open plan") { model.openPlan(postId: card.id) }
                    .accessibilityIdentifier("profilePostOptionsOpenPlan")
            }
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
            get: { isMine(model.overflowPostId) },
            set: { shown in if !shown, isMine(model.overflowPostId) { model.overflowPostId = nil } }
        )
    }

    private var presentingReport: Binding<Bool> {
        Binding(
            get: { isMine(model.reportingPostId) },
            set: { shown in if !shown, isMine(model.reportingPostId) { model.reportingPostId = nil } }
        )
    }

    /// A post is asking, and it is this modifier's (any post's, without one of its own).
    private func isMine(_ asking: String?) -> Bool {
        guard let asking else { return false }
        return postId == nil || postId == asking
    }
}
