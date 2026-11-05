//
//  CrewDayProblemView.swift
//  Pantopus
//
//  7. Something needs attention (build kit 01-spec.md, board `Problem`):
//  full screen with Close. What's wrong (five kinds), what happened (required,
//  up to 1,000 characters), up to 4 photos from the library, then Send to
//  Pantopus support. While a case is open the same screen adds a note or
//  photos to it. Photos go up first (`POST /api/crew-days/uploads`, purpose
//  `problem`); the report sends their paths.
//

import PhotosUI
import SwiftUI

/// Opens the problem screen for a booking (a new report, or more for an open one).
struct CrewDayProblemRequest: Identifiable {
    let id = UUID()
    let bookingId: String
    let crewName: String
    let priceCents: Int?
    /// A case is open: this adds a note or photos to it.
    let adding: Bool

    init(booking: CrewDayBookingDTO) {
        bookingId = booking.id
        crewName = CrewDayBookingPageCopy.crewName(booking)
        priceCents = booking.priceCents
        adding = booking.problem?.status == "open"
    }
}

@Observable
@MainActor
final class CrewDayProblemModel {
    struct Photo: Identifiable {
        let id = UUID()
        let preview: UIImage
        var path: String?
        var failed = false
    }

    let request: CrewDayProblemRequest
    var kind = "missed"
    var note = ""
    private(set) var photos: [Photo] = []
    private(set) var sending = false
    var error: String?

    static let noteLimit = 1000
    static let photoLimit = 4

    init(request: CrewDayProblemRequest) {
        self.request = request
    }

    var uploading: Bool {
        photos.contains { $0.path == nil && !$0.failed }
    }

    var canSend: Bool {
        !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending && !uploading
    }

    /// Re-encoded as JPEG (no location or camera data), then uploaded one at a time.
    func add(_ items: [PhotosPickerItem]) async {
        for item in items.prefix(Self.photoLimit - photos.count) {
            guard let raw = try? await item.loadTransferable(type: Data.self),
                  let jpeg = ListingPhotoProcessor.uploadData(from: raw),
                  let preview = UIImage(data: jpeg) else {
                error = "That photo couldn't be read. Try another one."
                continue
            }
            let photo = Photo(preview: preview)
            photos.append(photo)
            do {
                let file = MultipartFile(fieldName: "photo", filename: "problem.jpg", mimeType: "image/jpeg", data: jpeg)
                let path = try await MultipartUploader.shared.uploadCrewDayPhoto(
                    bookingId: request.bookingId,
                    purpose: "problem",
                    file: file
                )
                update(photo.id) { $0.path = path }
            } catch {
                update(photo.id) { $0.failed = true }
                self.error = CrewDayErrors.sentence(for: error)
            }
        }
    }

    func remove(_ id: UUID) {
        photos.removeAll { $0.id == id }
    }

    /// The report (or the added note) → the booking it answers, or nil when it didn't go through.
    func send() async -> CrewDayBookingDTO? {
        guard canSend else { return nil }
        sending = true
        error = nil
        defer { sending = false }
        let body = CrewDayProblemBody(
            kind: request.adding ? nil : kind,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            photoPaths: photos.compactMap(\.path)
        )
        do {
            let response: CrewDayBookingWriteResponse = try await APIClient.shared.request(
                CrewDayEndpoints.problem(bookingId: request.bookingId, body)
            )
            return response.booking
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
            return nil
        }
    }

    private func update(_ id: UUID, _ change: (inout Photo) -> Void) {
        guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
        change(&photos[index])
    }
}

struct CrewDayProblemView: View {
    @State private var model: CrewDayProblemModel
    @State private var picked: [PhotosPickerItem] = []
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The booking the report answered, or nil when closed without sending.
    let onDone: (CrewDayBookingDTO?) -> Void

    init(request: CrewDayProblemRequest, onDone: @escaping (CrewDayBookingDTO?) -> Void) {
        _model = State(initialValue: CrewDayProblemModel(request: request))
        self.onDone = onDone
    }

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar.crewDay(
                title: model.request.adding ? "Add a note or photo" : "Something needs attention",
                leading: .close
            ) { onDone(nil) }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text(intro)
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    if !model.request.adding { kinds }
                    noteField
                    photosSection
                    HStack(alignment: .top, spacing: 10) {
                        Icon(.lifeBuoy, size: 16, color: Theme.Color.appTextSecondary).padding(.top, 2)
                        Text("We reply within one business day. \(model.request.crewName) sees your note so they can make it right.")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                    if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayProblemError") }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
            }
            .scrollDismissesKeyboard(.interactively)
            CrewDayFooter {
                Button { Task { if let booking = await model.send() { onDone(booking) } } } label: {
                    PlanButtonLabel(title: "Send to Pantopus support", isLoading: model.sending)
                }
                .crewDayButton(.primary)
                .disabled(!model.canSend)
                .accessibilityIdentifier("crewDayProblemSend")
            }
        }
        .background(Theme.Color.appBg)
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            Task { await model.add(items) }
        }
        .interactiveDismissDisabled(model.sending || model.uploading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayProblem")
    }

    private var intro: String {
        if model.request.adding { return "Add to what you told Pantopus support. Your charge still waits." }
        let price = model.request.priceCents.map { "\(CrewDayFormat.price($0)) " } ?? ""
        return "Tell us what's wrong. Pantopus support owns it until it's fixed, and your \(price)charge waits."
    }

    private var kinds: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("What's wrong?")
            CrewDayCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(CrewDayBookingPageCopy.problemKinds.enumerated()), id: \.element.key) { index, kind in
                        if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                        Button { model.kind = kind.key } label: {
                            HStack(spacing: Spacing.s3) {
                                Icon(
                                    model.kind == kind.key ? .circleDot : .circle,
                                    size: 22,
                                    color: model.kind == kind.key ? Theme.Color.primarySolid : Theme.Color.appBorderStrong
                                )
                                Text(kind.label)
                                    .planFont(.body)
                                    .foregroundStyle(Theme.Color.appText)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.horizontal, 14)
                            .frame(minHeight: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(model.kind == kind.key ? [.isButton, .isSelected] : .isButton)
                        .accessibilityIdentifier("crewDayProblemKind_\(kind.key)")
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayProblemKinds")
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("What happened?")
            TextField("The back gutters still have leaves in them.", text: $model.note, axis: .vertical)
                .planFont(.body)
                .lineLimit(4...10)
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                .onChange(of: model.note) { _, text in
                    if text.count > CrewDayProblemModel.noteLimit { model.note = String(text.prefix(CrewDayProblemModel.noteLimit)) }
                }
                .accessibilityLabel("What happened?")
                .accessibilityIdentifier("crewDayProblemNote")
            Text("\(model.note.count) / 1,000")
                .planFont(.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityLabel("\(model.note.count) of 1,000 characters")
        }
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDayHeaderRow {
                Text.planOverline("Photos (optional)")
            } trailing: {
                Text("Up to 4").planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
            }
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: typeSize.isAccessibilitySize ? 2 : 4),
                spacing: Spacing.s2
            ) {
                ForEach(model.photos) { photo in
                    thumbnail(photo)
                }
                if model.photos.count < CrewDayProblemModel.photoLimit {
                    Color.clear
                        .aspectRatio(1, contentMode: .fit)
                        .overlay { addPhoto }
                }
            }
        }
    }

    /// The dashed "Add photo" tile: the photo library, up to 4 in all.
    private var addPhoto: some View {
        PhotosPicker(
            selection: $picked,
            maxSelectionCount: CrewDayProblemModel.photoLimit - model.photos.count,
            matching: .images
        ) {
            VStack(spacing: Spacing.s1) {
                Icon(.camera, size: 20, color: Theme.Color.primaryInk)
                Text("Add photo")
                    .planFont(.chip)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add photo")
        .accessibilityIdentifier("crewDayProblemAddPhoto")
    }

    private func thumbnail(_ photo: CrewDayProblemModel.Photo) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay { Image(uiImage: photo.preview).resizable().scaledToFill() }
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                if photo.path == nil, !photo.failed {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else if photo.failed {
                    Icon(.circleAlert, size: 20, color: Theme.Color.error)
                }
            }
            .overlay(alignment: .topTrailing) {
                Button { model.remove(photo.id) } label: {
                    Icon(.x, size: 12, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(Theme.Color.appText.opacity(0.7)))
                        .frame(width: 44, height: 44, alignment: .topTrailing)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove photo")
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(photo.failed ? "Photo that didn't upload" : "Photo")
            .accessibilityIdentifier("crewDayProblemPhoto")
    }
}
