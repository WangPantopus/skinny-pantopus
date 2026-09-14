import SwiftUI
import UniformTypeIdentifiers

struct HomeTaskMediaView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var model: HomeTaskMediaViewModel
    @State private var isVisible = false
    @State private var showPicker = false
    @State private var pickerRevision = 0
    @State private var pickerError: String?
    @State private var removal: HomeTaskMediaDTO?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !model.isCurrent {
                        Text("Your session changed. Reopen the task to continue.")
                    } else if !model.isActive {
                        Text("Attachment content is hidden.")
                    } else {
                        content
                    }
                }.padding()
            }
            .navigationTitle("Private attachments")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .accessibilityIdentifier("homeTaskMedia")
            .onAppear { isVisible = true }
            .task { await model.activate(ifCurrent: model.activationRevision) }
            .onDisappear { isVisible = false
                model.suspend()
            }
            .onChange(of: scenePhase) { _, phase in
                guard isVisible else { return }
                if phase == .active { activate() } else { model.suspend() }
            }
            .onChange(of: model.isCurrent) { _, current in if !current { model.retire() } }
            .fileImporter(isPresented: $showPicker, allowedContentTypes: [.pdf, .plainText, .image]) { result in
                guard isVisible, model.isCurrent else { return }
                do { try model.picked(ClaimPickedFile.read(result.get()), revision: pickerRevision)
                    pickerError = nil
                } catch { pickerError = error.localizedDescription }
            }
            .confirmationDialog(
                "Remove this attachment?",
                isPresented: Binding(get: { removal != nil }, set: { if !$0 { removal = nil } }),
                titleVisibility: .visible
            ) {
                if let record = removal {
                    Button("Remove attachment", role: .destructive) {
                        removal = nil
                        Task { await model.remove(record) }
                    }
                }
            } message: { Text("The private file will be removed. Its history remains.") }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("PDF, text or supported images up to 25 MB. Files stay private to people with current task access.")
                .font(.subheadline)
            if model.busy { ProgressView() }
            if let error = model.error { Text(error).foregroundStyle(Theme.Color.error) }
            if let notice = model.notice { Text(notice).accessibilityIdentifier("homeTaskMedia.notice") }
            if let pickerError { Text(pickerError).foregroundStyle(Theme.Color.error) }
            if model.mayChoose {
                Button("Choose attachment") {
                    pickerRevision = model.activationRevision
                    showPicker = true
                }.accessibilityIdentifier("homeTaskMedia.choose")
            }
            if let pending = model.pendingUpload {
                Text("Selected: \(pending.file.filename)")
                Text(
                    "Retry this same file until upload is confirmed. After leaving the task, reopen attachments to check its status."
                )
                .font(.caption)
                if model.mayAcknowledgeRemovedUpload {
                    Text("The server confirms this upload was removed. Clear its saved request before choosing another file.")
                    Button("Clear removed upload request") { Task { await model.acknowledgeRemovedUpload(id: pending.id) } }
                        .accessibilityIdentifier("homeTaskMedia.clearRemovedUpload")
                } else {
                    Button("Save or retry this attachment") { Task { await model.upload(id: pending.id) } }
                        .disabled(!model.mayRetryUpload).accessibilityIdentifier("homeTaskMedia.retryUpload")
                }
                if model.mayDiscardUnsent { Button("Discard unsubmitted file") { model.discardUnsent(id: pending.id) } }
            }
            if model.pendingRemoval != nil {
                Text("Removal is unconfirmed. Retry removal of the same attachment.")
                Button("Retry attachment removal") { Task { await model.retryRemoval() } }
                    .disabled(!model.mayRetryRemoval)
            }
            ForEach(model.media) { record in
                VStack(alignment: .leading, spacing: 8) {
                    Text(record.fileName).font(.headline)
                    Text(status(record)).font(.subheadline)
                    if record.available {
                        Button("Open attachment") { Task { await model.open(record) } }.disabled(model.busy)
                    }
                    if model.mayRemove(record) {
                        Button(record.cleanupPending == true ? "Retry file cleanup" : "Remove attachment", role: .destructive) {
                            removal = record
                        }
                    }
                }.accessibilityIdentifier("homeTaskMedia.file.\(record.id)")
            }
            if let preview = model.visiblePreview, let mime = preview.record.mimeType {
                Divider()
                Text(preview.record.fileName).font(.headline)
                PrivateHomeFilePreview(data: preview.bytes, mimeType: mime, textLimit: 200_000).frame(minHeight: 280)
                Button("Close preview") { model.closePreview()
                    Task { await model.load() }
                }
            }
            Button("Reload attachments") { Task { await model.load() } }.disabled(model.busy)
        }
    }

    private func status(_ record: HomeTaskMediaDTO) -> String {
        switch record.state {
        case "legacy": "Older attachment unavailable. Verified reupload is required."
        case "reserved": "Upload incomplete. Retry the original selected file, or remove this reservation before choosing it again."
        case "retired": record.cleanupPending == true ? "Hidden · private file cleanup needs a retry" : "Removed · history retained"
        default: "Private file · \(ByteCountFormatter.string(fromByteCount: Int64(record.fileSize), countStyle: .file))"
        }
    }

    private func activate() {
        let revision = model.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await model.activate(ifCurrent: revision)
        }
    }
}
