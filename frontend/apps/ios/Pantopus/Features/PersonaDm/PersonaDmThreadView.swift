//
//  PersonaDmThreadView.swift
//  Pantopus
//
//  A15.4 "Creator thread" / A15.5 "Fan thread". Top bar (back · avatar ·
//  @handle + display name) → fan-side reply-policy banner → message
//  bubbles (viewer right, counterparty left) → composer.
//
//  Deliberately NOT `ChatConversationView`: persona DMs are addressed by
//  thread id and carry no counterparty user id, so the generic chat
//  surface can't model them.
//

import SwiftUI

public struct PersonaDmThreadView: View {
    @State private var viewModel: PersonaDmThreadViewModel
    private let onBack: @MainActor () -> Void

    public init(
        personaId: String,
        threadId: String,
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(
            initialValue: PersonaDmThreadViewModel(personaId: personaId, threadId: threadId)
        )
        self.onBack = onBack
    }

    init(viewModel: PersonaDmThreadViewModel, onBack: @escaping @MainActor () -> Void = {}) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .toolbar(.hidden, for: .tabBar)
        .accessibilityIdentifier("personaDmThread")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("personaDmThreadBackButton")

            if let header = headerContent {
                Circle()
                    .fill(Theme.Color.businessBg)
                    .frame(width: 34, height: 34)
                    .overlay {
                        Text(header.initials)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.business)
                    }
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(header.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(header.subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            } else {
                Text("Conversation")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 56)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("personaDmThreadHeader")
    }

    private var headerContent: PersonaDmThreadLoaded? {
        switch viewModel.state {
        case let .loaded(loaded): loaded
        case let .empty(loaded): loaded
        case .loading, .error: nil
        }
    }

    // MARK: - State switch

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .loaded(loaded):
            thread(loaded, messages: loaded.messages)
        case let .empty(loaded):
            thread(loaded, messages: [])
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 180, height: 40, cornerRadius: Radii.lg)
            Shimmer(width: 220, height: 52, cornerRadius: Radii.lg)
                .frame(maxWidth: .infinity, alignment: .trailing)
            Shimmer(width: 160, height: 40, cornerRadius: Radii.lg)
            Spacer()
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityIdentifier("personaDmThreadLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load this thread")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("personaDmThreadRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("personaDmThreadError")
    }

    // MARK: - Thread body

    private func thread(_ loaded: PersonaDmThreadLoaded, messages: [PersonaDmMessageContent]) -> some View {
        VStack(spacing: Spacing.s0) {
            if let banner = loaded.policyBanner {
                policyBanner(banner)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Spacing.s2) {
                        if messages.isEmpty {
                            Text("No messages yet. Say hi to start the thread.")
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.top, Spacing.s10)
                                .accessibilityIdentifier("personaDmThreadEmpty")
                        }
                        ForEach(messages) { message in
                            bubbleRow(message).id(message.id)
                        }
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s3)
                }
                .refreshable { await viewModel.refresh() }
                .onChange(of: messages.count) {
                    guard let last = messages.last else { return }
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .accessibilityIdentifier("personaDmThreadMessages")
            composer
        }
    }

    private func policyBanner(_ banner: PersonaDmPolicyBanner) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(
                banner.kind == .missed ? .alertTriangle : .info,
                size: 14,
                color: banner.kind == .missed ? Theme.Color.error : Theme.Color.primary700
            )
            Text(banner.text)
                .font(.system(size: 12))
                .foregroundStyle(banner.kind == .missed ? Theme.Color.error : Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(banner.kind == .missed ? Theme.Color.errorBg : Theme.Color.infoBg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(banner.kind == .missed ? Theme.Color.errorLight : Theme.Color.infoLight)
                .frame(height: 1)
        }
        .accessibilityIdentifier(
            banner.kind == .missed ? "personaDmThreadSlaMissedBanner" : "personaDmThreadPolicyBanner"
        )
    }

    private func bubbleRow(_ message: PersonaDmMessageContent) -> some View {
        VStack(alignment: message.fromViewer ? .trailing : .leading, spacing: 2) {
            Text(message.body)
                .font(.system(size: 14))
                .foregroundStyle(
                    message.fromViewer ? Theme.Color.appTextInverse : Theme.Color.appText
                )
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(message.fromViewer ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(Self.bubbleShape(fromViewer: message.fromViewer))
            HStack(spacing: Spacing.s1) {
                Text(message.timeLabel)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
                if message.readByCounterparty {
                    Icon(.checkCheck, size: 11, color: Theme.Color.primary600)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: message.fromViewer ? .trailing : .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(message.fromViewer ? "You" : "They") said \(message.body), \(message.timeLabel)"
        )
    }

    // MARK: - Composer

    private var composer: some View {
        VStack(spacing: Spacing.s1) {
            if let sendError = viewModel.sendError {
                Text(sendError)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("personaDmThreadSendError")
            }
            HStack(alignment: .bottom, spacing: Spacing.s2) {
                TextField("Type a message…", text: $viewModel.draft, axis: .vertical)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1...5)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .frame(minHeight: 40)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                    .onChange(of: viewModel.draft) {
                        if viewModel.sendError != nil { viewModel.sendError = nil }
                    }
                    .accessibilityIdentifier("personaDmThreadInput")

                Button {
                    Task { await viewModel.send() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(viewModel.canSend ? Theme.Color.primary600 : Theme.Color.primary200)
                            .frame(width: 40, height: 40)
                        if viewModel.isSending {
                            ProgressView().tint(Theme.Color.appTextInverse)
                        } else {
                            Icon(.arrowUp, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(!viewModel.canSend)
                .accessibilityLabel("Send message")
                .accessibilityIdentifier("personaDmThreadSend")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("personaDmThreadComposer")
    }
}

private extension PersonaDmThreadView {
    /// Chat-bubble shape — the sender's own corner is tucked in, matching
    /// the A15 chat archetype's `border-bottom-*-radius: 4px` treatment.
    static func bubbleShape(fromViewer: Bool) -> UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Radii.xl,
            bottomLeadingRadius: fromViewer ? Radii.xl : Radii.xs,
            bottomTrailingRadius: fromViewer ? Radii.xs : Radii.xl,
            topTrailingRadius: Radii.xl,
            style: .continuous
        )
    }
}
