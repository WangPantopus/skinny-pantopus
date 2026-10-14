import SwiftUI

struct PulseAudiencePickerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var areas = PulseAudiencePickerViewModel()
    @State private var selection: PulseAreaChoice?
    @State private var confirmsAudience = false
    let viewModel: PulsePostDetailViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text("People outside this audience will lose access. You can't widen it later.")
                        .pulseFont(.body)
                        .foregroundStyle(Theme.Color.appText)
                    if viewModel.conversation?.post.readScope == "public" {
                        Button("Verified neighbors of the town") { selection = nil
                            confirmsAudience = true
                        }
                        .pulseFont(.button)
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("pulseAudienceTown")
                    } else {
                        narrowerAreas
                    }
                    if let message = viewModel.toastMessage {
                        Text(message).pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(Spacing.s4)
                .disabled(!viewModel.pendingConversationActions.isEmpty)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Who can read")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("pulseAudienceClose")
                }
            }
            .task(id: viewModel.conversation?.post.about?.areaId) {
                if viewModel.conversation?.post.readScope == "verified_town" {
                    await areas.load(postAreaId: viewModel.conversation?.post.about?.areaId)
                }
            }
            .onChange(of: viewModel.canNarrowAudience) { _, allowed in if !allowed { dismiss() } }
            .alert("Limit who can read?", isPresented: $confirmsAudience) {
                Button("Limit audience") {
                    let area = selection
                    selection = nil
                    Task {
                        let saved = await viewModel.narrowConversation(
                            readScope: area == nil ? "verified_town" : "verified_area",
                            areaId: area?.id
                        )
                        if saved { dismiss() }
                    }
                }
                .accessibilityIdentifier("pulseAudienceConfirm")
                Button("Cancel", role: .cancel) { selection = nil }
            } message: {
                Text("Only verified neighbors of \(selection?.title ?? "the town") will be able to read this. You can't widen it later.")
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
        .accessibilityIdentifier("pulseAudiencePicker")
    }

    @ViewBuilder private var narrowerAreas: some View {
        switch areas.state {
        case .loading:
            FeedSkeletonCard().accessibilityLabel("Loading eligible areas")
        case let .loaded(choices):
            ForEach(choices) { area in
                Button { selection = area
                    confirmsAudience = true
                } label: {
                    Text("Verified neighbors of \(area.title)")
                        .pulseFont(.button)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
                .accessibilityIdentifier("pulseAudienceArea_\(area.id)")
            }
        case .empty:
            EmptyState(
                icon: .mapPin,
                headline: "No narrower area available",
                subcopy: "No open street or neighborhood is available for this post and your verified home.",
                cta: .init(title: "Try again") { await areas.load(postAreaId: viewModel.conversation?.post.about?.areaId) }
            )
        case let .error(message):
            PulsePageErrorCard(message: message) {
                Task { await areas.load(postAreaId: viewModel.conversation?.post.about?.areaId) }
            }
        }
    }
}
