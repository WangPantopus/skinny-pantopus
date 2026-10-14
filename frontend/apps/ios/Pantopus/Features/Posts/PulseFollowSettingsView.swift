import SwiftUI

struct PulseFollowSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PulseFollowSettingsViewModel
    let onChanged: () async -> Void

    init(postId: String, canFollowUntilEnd: Bool, onChanged: @escaping () async -> Void) {
        _viewModel = State(initialValue: PulseFollowSettingsViewModel(postId: postId, canFollowUntilEnd: canFollowUntilEnd))
        self.onChanged = onChanged
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    content
                    if let message = viewModel.errorMessage {
                        Text(message).pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(Spacing.s4)
                .disabled(viewModel.isSaving)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Following")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("pulseFollowClose")
                }
            }
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
        .accessibilityIdentifier("pulseFollowSettings")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            FeedSkeletonCard().accessibilityLabel("Loading follow settings")
        case let .loaded(follow):
            settings(follow)
        case .empty:
            EmptyState(
                icon: .bookmark,
                headline: "Not following this conversation",
                subcopy: "Follow to keep up with it here. Notifications start off.",
                cta: .init(title: "Follow") {
                    if await viewModel.update(notify: "off", ends: viewModel.canFollowUntilEnd ? "on_resolve" : "keep") {
                        await onChanged()
                    }
                }
            )
        case let .error(message):
            PulsePageErrorCard(message: message) { Task { await viewModel.load() } }
        }
    }

    private func settings(_ follow: PulseFollowDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Saved to Following").pulseFont(.title).accessibilityAddTraits(.isHeader)
            if follow.notify == "off" {
                Text("Notifications are off.").pulseFont(.body).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text("WANT UPDATES?").pulseFont(.overline)
            notificationToggle("Daily recap of new replies", value: "recap", follow: follow)
            notificationToggle("Notify me about each update", value: "each", follow: follow)
            Text("FOLLOW FOR HOW LONG?").pulseFont(.overline)
            if viewModel.canFollowUntilEnd { duration("Until it ends", value: "on_resolve", follow: follow) }
            duration("For a week", value: "week", follow: follow)
            duration("Keep following", value: "keep", follow: follow)
            Button("Stop following", role: .destructive) {
                Task {
                    if await viewModel.stopFollowing() { await onChanged()
                        dismiss()
                    }
                }
            }
            .pulseFont(.button)
            .frame(minHeight: 44)
            .accessibilityIdentifier("pulseFollowStop")
            Text("Replies to you always reach Messages.").pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
        }
        .foregroundStyle(Theme.Color.appText)
    }

    private func notificationToggle(_ title: String, value: String, follow: PulseFollowDTO) -> some View {
        Toggle(isOn: Binding(get: { follow.notify == value }, set: { enabled in
            Task {
                if await viewModel.update(notify: enabled ? value : "off", ends: follow.ends ?? "") { await onChanged() }
            }
        })) {
            Text(title).pulseFont(.body)
        }
        .accessibilityIdentifier("pulseFollowNotify_\(value)")
    }

    private func duration(_ title: String, value: String, follow: PulseFollowDTO) -> some View {
        Button {
            Task {
                if await viewModel.update(notify: follow.notify ?? "", ends: value) { await onChanged() }
            }
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(follow.ends == value ? .circleCheck : .circle, size: 24, color: Theme.Color.primaryInk)
                    .accessibilityHidden(true)
                Text(title).pulseFont(.body)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(follow.ends == value ? .isSelected : [])
        .accessibilityIdentifier("pulseFollowDuration_\(value)")
    }
}
