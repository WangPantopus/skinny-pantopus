//
//  MessagePreviewView.swift
//  Pantopus
//
//  Stream I16 — H7 Message Preview (sheet). Shows the rendered message per
//  channel before saving, with all variables resolved to sample data. A channel
//  tab strip (Push / Email / In-app / SMS) swaps a realistic device mock over a
//  soft stage. "Send test to me" is a coming-soon affordance (no endpoint yet).
//  Reachable inline from an editor (draft) or by route from a saved template id.
//

import SwiftUI

struct MessagePreviewView: View {
    @State private var model: MessagePreviewViewModel
    let onClose: () -> Void

    /// Channel tab order per the design (Push first).
    private let order: [WorkflowChannel] = [.push, .email, .inApp, .sms]

    /// Inline draft from an editor.
    init(
        owner: SchedulingOwner,
        subject: String?,
        body: String,
        channel: WorkflowChannel,
        onClose: @escaping () -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: MessagePreviewViewModel(
            owner: owner,
            source: .draft(subject: subject, body: body, channel: channel),
            client: client
        ))
        self.onClose = onClose
    }

    /// Saved template by id (routed entry).
    init(
        owner: SchedulingOwner,
        templateId: String,
        onClose: @escaping () -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: MessagePreviewViewModel(owner: owner, source: .template(id: templateId), client: client))
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoSheetHeader(title: "Preview", onClose: onClose)
            content
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .accessibilityIdentifier("scheduling.templates.preview")
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(model.accent).frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loaded:
            loadedBody
        case let .error(message):
            AutoErrorView(headline: "Couldn't load message", message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            AutoUnderlineTabs(
                tabs: order.map(\.label),
                selectedIndex: order.firstIndex(of: model.activeChannel) ?? 0,
                accent: model.accent
            ) { model.activeChannel = order[$0] }
            ScrollView {
                VStack(spacing: Spacing.s4) {
                    stage
                    AutoGhostButton(title: "Send test to me", icon: .send) { model.sendTest() }
                    if let note = model.testNote {
                        AutoNote(
                            tone: model.testNoteIsError ? .error : .success,
                            icon: model.testNoteIsError ? .alertTriangle : .checkCircle,
                            text: note
                        )
                    }
                    Color.clear.frame(height: Spacing.s2)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
            }
            footer
        }
    }

    private var stage: some View {
        VStack {
            channelMock
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    @ViewBuilder
    private var channelMock: some View {
        switch model.activeChannel {
        case .push: pushMock
        case .email: emailMock
        case .inApp: inAppMock
        case .sms: smsMock
        }
    }

    // MARK: Mocks

    private var pushMock: some View {
        HStack(alignment: .top, spacing: 10) {
            autoIconTile(.bell, bg: model.accent, fg: Theme.Color.appTextInverse, size: 34, glyph: 17)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("Pantopus").font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Text("now").font(.system(size: 10.5)).foregroundStyle(Theme.Color.appTextMuted)
                }
                Text(model.filledBody).font(.system(size: 12)).foregroundStyle(Theme.Color.appTextStrong).lineLimit(3)
            }
        }
        .padding(12)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var emailMock: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                autoIconTile(.mail, bg: model.accent, fg: Theme.Color.appTextInverse, size: 30, glyph: 14)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Pantopus").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    Text("hi@pantopus.co").font(.system(size: 10.5)).foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer()
            }
            .padding(.bottom, Spacing.s2)
            if let subject = model.filledSubject, !subject.isEmpty {
                Text(subject).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.Color.appText).padding(.bottom, Spacing.s1)
            }
            AutoRowDivider().padding(.vertical, Spacing.s2)
            Text(model.filledBody).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextStrong).fixedSize(
                horizontal: false,
                vertical: true
            )
            AutoRowDivider().padding(.vertical, Spacing.s2)
            Text("Sent by Pantopus scheduling").font(.system(size: 10)).foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var inAppMock: some View {
        HStack(alignment: .bottom, spacing: Spacing.s2) {
            autoIconTile(.messageSquare, bg: model.accentBg, fg: model.accent, size: 28, glyph: 14)
            Text(model.filledBody)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .pantopusShadow(.sm)
            Spacer(minLength: Spacing.s6)
        }
    }

    private var smsMock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .bottom, spacing: Spacing.s2) {
                Text(model.filledBody)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                Spacer(minLength: Spacing.s6)
            }
            let msgCount = model.filledBody.count > WorkflowChannel.smsSegmentLimit ? "2 messages" : "1 message"
            Text("\(model.filledBody.count) characters · \(msgCount)")
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var footer: some View {
        AutoSheetFooter {
            HStack(spacing: Spacing.s2) {
                AutoGhostButton(title: "Edit") { onClose() }
                AutoPrimaryButton(title: "Looks good", icon: .check) { onClose() }
            }
        }
    }
}
