import ImageIO
import PDFKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Bytes remain in memory and are rendered without a public URL or a browser.
struct PrivateClaimEvidenceView: View {
    @State var model: PrivateClaimEvidenceViewModel
    @State private var removal: PrivateClaimEvidenceDTO?
    @State private var showFilePicker = false
    @State private var pickerError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !model.isCurrent { Text("Your session changed. Reopen the claim to continue.") } else {
                    Text("Private claim documents").font(.headline)
                    Text("Saving a file does not verify it or approve the claim.").font(.subheadline)
                    if model.busy { ProgressView() }
                    if let error = model.error { Text(error).foregroundStyle(Theme.Color.error) }
                    if let notice = model.notice { Text(notice).accessibilityIdentifier("claimEvidence.notice") }
                    if model.pendingVerification, model.visiblePreview == nil {
                        Text("The verification result is unknown. Retry the same decision after checking current access.")
                        Button("Retry document verification") { Task { await model.verify() } }.disabled(!model.mayVerify)
                    }
                    if let pickerError { Text(pickerError).foregroundStyle(Theme.Color.error) }
                    if model.mayUpload {
                        Picker("Document type", selection: $model.selectedDocumentType) {
                            ForEach(model.documentOptions) { option in Text(option.label).tag(option.id) }
                        }.disabled(model.pendingUpload != nil)
                        if let pending = model.pendingUpload {
                            Text(pending.file.filename)
                            Button("Save or retry this document") { Task { await model.upload() } }
                        } else { Button("Choose private document") { showFilePicker = true } }
                    }
                    if model.evidence.isEmpty, !model.busy { Text("No private documents are available.") }
                    ForEach(model.evidence) { record in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(record.fileName).font(.headline)
                            Text(record.state == "retired" ? "Removed · history retained" : record.status.capitalized)
                            HStack {
                                if record.available {
                                    Button("Open document") { Task { await model.open(record) } }
                                        .disabled(model.busy || model.pendingVerification)
                                }
                                if model.mayRetire(record) {
                                    Button(record.state == "retired" ? "Retry file cleanup" : "Remove pending file", role: .destructive) {
                                        removal = record
                                    }
                                }
                            }
                        }.accessibilityIdentifier("claimEvidence.file.\(record.id)")
                    }
                    if let preview = model.visiblePreview {
                        Divider()
                        Text(preview.record.fileName).font(.headline)
                        PrivateClaimDocumentPreview(data: preview.bytes, mimeType: preview.record.mimeType)
                            .frame(minHeight: 280)
                        if preview.inspection != nil, preview.canRender {
                            Toggle(
                                "I inspected this document and confirm it supports this claim.",
                                isOn: $model.confirmedDocument
                            )
                            .disabled(model.busy || model.pendingVerification)
                            Button(model.pendingVerification ? "Retry document verification" : "Verify this document") {
                                Task { await model.verify() }
                            }.disabled(!model.mayVerify).accessibilityIdentifier("claimEvidence.verify")
                        }
                        Button("Close document") { model.closePreview() }.disabled(model.busy || model.pendingVerification)
                    }
                    Button("Reload documents") { Task { await model.load() } }
                        .disabled(model.busy || model.pendingVerification)
                }
            }.padding()
        }
        .task { await model.load() }
        .onDisappear { model.retire() }
        .onChange(of: model.isCurrent) { _, current in if !current { model.retire() } }
        .fileImporter(isPresented: $showFilePicker, allowedContentTypes: [.pdf, .plainText, .image]) { result in
            do {
                guard model.mayUpload else { return }
                try model.picked(ClaimPickedFile.read(result.get()))
                pickerError = nil
            } catch { pickerError = error.localizedDescription }
        }
        .confirmationDialog(
            "Remove this pending document?",
            isPresented: Binding(
                get: { removal != nil },
                set: { if !$0 { removal = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let record = removal {
                Button("Remove pending document", role: .destructive) { Task { await model.remove(record) }
                    removal = nil
                }
            }
        } message: { Text("Its private file will be retired. Claim and document history remain.") }
    }
}

private struct PrivateClaimDocumentPreview: View {
    let data: Data
    let mimeType: String
    var body: some View {
        if mimeType == "application/pdf", let document = PDFDocument(data: data) {
            LazyVStack(spacing: 16) {
                ForEach(0..<document.pageCount, id: \.self) { index in
                    if let page = document.page(at: index) {
                        Image(uiImage: page.thumbnail(of: CGSize(width: 1200, height: 1600), for: .mediaBox))
                            .resizable().scaledToFit().accessibilityLabel("Document page \(index + 1)")
                    }
                }
            }
        } else if mimeType == "text/plain", let text = String(data: data, encoding: .utf8) {
            Text(text).frame(maxWidth: .infinity, alignment: .leading)
        } else if let image = PrivateClaimImagePreview.decode(data) {
            Image(uiImage: image).resizable().scaledToFit()
        } else { Text("This document cannot be previewed. Do not verify it until you can inspect its contents.") }
    }
}

/// Decode only a bounded thumbnail, avoiding full-resolution image allocations.
enum PrivateClaimImagePreview {
    static let maximumPixelSize = 1600

    static func decode(_ data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceShouldCacheImmediately: true,
                  kCGImageSourceThumbnailMaxPixelSize: maximumPixelSize
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }
}
