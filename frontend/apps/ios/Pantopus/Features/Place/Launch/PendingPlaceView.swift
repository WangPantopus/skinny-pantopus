import SwiftUI

/// The post-auth arrival. Bookmark consent never performs Home creation or verification.
struct PendingPlaceView: View {
    @State var viewModel: PendingPlaceViewModel
    var onDone: () -> Void
    var onSavedPlaces: () -> Void
    var onSetUpHome: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text(viewModel.saved == nil ? "Keep this address handy" : "Saved privately")
                    .font(Theme.Font.h2).foregroundStyle(Theme.Color.appText)
                if let draft = viewModel.draft {
                    Text(draft.label).font(Theme.Font.body).textSelection(.enabled)
                    Text("A private bookmark for your account. Setting up and verifying a Home is a separate step.")
                        .font(Theme.Font.body).foregroundStyle(Theme.Color.appTextSecondary)
                    if let message = viewModel.errorMessage {
                        Text(message).foregroundStyle(Theme.Color.appTextSecondary)
                            .accessibilityIdentifier("place.arrival.error")
                    }
                    if viewModel.saved != nil {
                        PrimaryButton(title: "View saved places", action: onSavedPlaces)
                        Button("Set up a Home", action: onSetUpHome)
                        Button("Continue exploring", action: onDone)
                    } else {
                        PrimaryButton(
                            title: viewModel.errorMessage == nil ? "Save privately" : "Try saving again",
                            isLoading: viewModel.isSaving
                        ) { await viewModel.save() }
                            .accessibilityIdentifier("place.arrival.save")
                        Button("Not now") { viewModel.discard()
                            onDone()
                        }
                        .disabled(viewModel.isSaving)
                        Text("This unfinished preview stays on this device for up to 24 hours.")
                            .font(Theme.Font.caption).foregroundStyle(Theme.Color.appTextMuted)
                    }
                    Divider()
                    Text("Public address preview").font(Theme.Font.h3)
                    if viewModel.previewError {
                        Text(viewModel.saved == nil
                            ? "The preview is temporarily unavailable. You can still save the address."
                            : "Your address is saved. Try the preview again in a moment.")
                        Button("Retry preview") { Task { await viewModel.loadPreview() } }
                    } else if let preview = viewModel.preview {
                        if let aha = preview.aha, aha.isRenderable {
                            Text(aha.headline).font(Theme.Font.h3)
                            Text(aha.detail).font(Theme.Font.body)
                        }
                        ForEach(preview.sections ?? [], id: \.id) { section in
                            PlaceSectionView(env: section, onOpen: nil, onVerify: nil, onClaim: nil)
                        }
                    } else {
                        ProgressView("Loading preview…")
                    }
                } else {
                    Text("This preview expired or was cleared. You can look up the address again from Explore.")
                    Button("Continue", action: onDone)
                }
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Address preview")
        .accessibilityIdentifier("place.arrival")
        .task { await viewModel.loadPreview() }
    }
}
