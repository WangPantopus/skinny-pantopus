//
//  CrewDayRouteHomeView.swift
//  Pantopus
//
//  17. One home (build kit 01-spec.md, board `RouteHome`): "123 Maple Lane"
//  and "3 of 6"; the address with Open in Maps, the first name; the job
//  (option, add-ons, included items, the price); access (the note, Gate is
//  ready); photos (camera or library, at least one, up to 8); a note for the
//  household; Mark done (needs a photo) and Can't get in.
//

import MapKit
import PhotosUI
import SwiftUI

struct CrewDayRouteHomeView: View {
    @State var model: CrewDayRouteHomeModel
    let onBack: () -> Void
    @State private var picked: [PhotosPickerItem] = []
    @State private var showsCamera = false
    @State private var asksCantGetIn = false
    @State private var cantGetInNote = ""
    @State private var showsOnMyWay = false
    @State private var viewer: CrewDayPhotoViewerRequest?
    @State private var toast: String?

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: model.home.map(CrewDayRouteCopy.place) ?? "Home", trailing: model.position, onLeading: onBack)
            switch model.state {
            case .loading:
                CrewDayLoadingView()
            case let .failed(message):
                CrewDayErrorView(message: message) { await model.load() }
            case let .loaded(home):
                page(home)
            }
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            Task { await model.add(items) }
        }
        .fullScreenCover(isPresented: $showsCamera) {
            SystemCameraPicker(isPresented: $showsCamera) { image in Task { await model.add(image) } }.ignoresSafeArea()
        }
        .fullScreenCover(item: $viewer) { MediaViewerView(items: CrewDayPhotoGrid.items($0.photos), startIndex: $0.index) }
        .sheet(isPresented: $showsOnMyWay) { CrewDayHomeOnMyWaySheet(model: model) }
        .alert("Can't get in?", isPresented: $asksCantGetIn) {
            TextField("What's in the way", text: $cantGetInNote)
            Button("Tell \(model.home.map(CrewDayRouteCopy.who) ?? "them")") { Task { await model.cantGetIn(note: cantGetInNote) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We record it on the booking, tell the household, and open your conversation with them.")
        }
        .overlay(alignment: .bottom) {
            if let toast {
                ToastView(message: ToastMessage(text: toast))
                    .padding(.bottom, 120)
                    .dismissToast(after: toast, minimum: 2.5) { self.toast = nil }
            }
        }
        .onChange(of: model.notice) { _, notice in
            guard let notice else { return }
            toast = notice
            model.notice = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRouteHome")
    }

    private func page(_ home: CrewDayHomeDTO) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    addressCard(home)
                    job(home)
                    access(home)
                    if model.isDone { doneCard(home) } else { photosSection }
                    if !model.isDone { noteField }
                    if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayRouteHomeError") }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await model.load() }
            if !model.isDone, !["cancelled", "declined"].contains(home.status) { footer(home) }
        }
    }

    // MARK: - Address, job, access

    private func addressCard(_ home: CrewDayHomeDTO) -> some View {
        CrewDayCard {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.Color.homeBg)
                    .frame(width: 40, height: 40)
                    .overlay(Icon(.house, size: 20, color: Theme.Color.home))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(home.address?.line ?? home.label).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    if let city = cityLine(home.address) {
                        Text(city).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let name = home.firstName {
                        Text(name).planFont(.small).foregroundStyle(Theme.Color.appTextStrong)
                    }
                    if !home.addressVisible {
                        CrewDayLockLine(text: "The address shows at 6 PM the evening before.")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
            if home.address?.latitude != nil || home.address?.line != nil {
                Button { openMaps(home) } label: {
                    PlanButtonLabel(title: "Open in Maps", icon: .navigation, kind: .secondary)
                }
                .planButton(.secondary, size: .small)
                .accessibilityIdentifier("crewDayRouteHomeMaps")
            }
        }
    }

    private func cityLine(_ address: CrewDayHomeDTO.Address?) -> String? {
        guard let address else { return nil }
        let stateZip = [address.state, address.zip].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let line = [address.city, stateZip].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        return line.isEmpty ? nil : line
    }

    private func job(_ home: CrewDayHomeDTO) -> some View {
        let parts = home.details.components(separatedBy: " · ")
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("The job")
            CrewDayCard {
                VStack(alignment: .leading, spacing: 2) {
                    Text(parts.first.map { $0.prefix(1).uppercased() + $0.dropFirst() } ?? "The job")
                        .planFont(.bodyStrong)
                        .foregroundStyle(Theme.Color.appText)
                    if parts.count > 1 {
                        Text("Add-on: " + parts.dropFirst().joined(separator: ", "))
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
                if let day = model.day, !day.included.isEmpty || day.outsideOnly {
                    Divider().overlay(Theme.Color.appBorder)
                    ForEach(day.included, id: \.self) { CrewDayCheckRow(text: $0, tint: Theme.Color.home) }
                    if day.outsideOnly {
                        CrewDayCheckRow(text: "Outside only", icon: .house, tint: Theme.Color.appTextSecondary)
                    }
                }
                Divider().overlay(Theme.Color.appBorder)
                HStack {
                    Text("Price").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer()
                    Text(home.priceCents.map { "\(CrewDayFormat.price($0)) · confirmed" } ?? "Waiting for your price")
                        .planFont(.bodyStrong)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                }
                .accessibilityElement(children: .combine)
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayRouteHomeJob")
        }
    }

    private func access(_ home: CrewDayHomeDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Access")
            CrewDayCard {
                Text(home.accessNote?.isEmpty == false ? home.accessNote ?? "" : accessFallback(home))
                    .planFont(.body)
                    .foregroundStyle(home.accessNote?.isEmpty == false ? Theme.Color.appText : Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let gate = home.gateReadyAt {
                    let time = CrewDayFormat.time(CrewDayFormat.instant(gate), timezone: model.route?.timezone)
                    CrewDayChip(text: "Gate is ready · \(time)", tone: .good)
                        .accessibilityIdentifier("crewDayRouteHomeGate")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayRouteHomeAccess")
        }
    }

    private func accessFallback(_ home: CrewDayHomeDTO) -> String {
        home.addressVisible ? "No note from the household." : "The access note shows at 6 PM the evening before."
    }

    private func doneCard(_ home: CrewDayHomeDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Done")
            CrewDayCard {
                CrewDayChip(text: CrewDayRouteCopy.status(home, timezone: model.route?.timezone), tone: .good)
                    .accessibilityIdentifier("crewDayRouteHomeStatus")
                if !home.photos.isEmpty {
                    CrewDayPhotoGrid(photos: home.photos) { viewer = CrewDayPhotoViewerRequest(photos: home.photos, index: $0) }
                }
                if let note = home.doneNote, !note.isEmpty {
                    CrewDayQuote(label: "Your note to the household", text: note, identifier: "crewDayRouteHomeDoneNote")
                }
            }
        }
    }
}

// MARK: - Photos, note, footer

private extension CrewDayRouteHomeView {
    var photosSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                Text.planOverline("Photos")
                Spacer()
                Text("At least one, up to 8").planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 4), spacing: Spacing.s2) {
                ForEach(model.photos) { photo in thumbnail(photo) }
            }
            if model.photos.count < CrewDayRouteHomeModel.photoLimit {
                HStack(spacing: Spacing.s2) {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { showsCamera = true } label: {
                            PlanButtonLabel(title: "Camera", icon: .camera, kind: .tonal)
                        }
                        .planButton(.tonal, size: .small)
                        .accessibilityIdentifier("crewDayRouteHomeCamera")
                    }
                    PhotosPicker(
                        selection: $picked,
                        maxSelectionCount: CrewDayRouteHomeModel.photoLimit - model.photos.count,
                        matching: .images
                    ) {
                        PlanButtonLabel(title: "Photo library", icon: .image, kind: .tonal)
                    }
                    .planButton(.tonal, size: .small)
                    .accessibilityIdentifier("crewDayRouteHomeLibrary")
                }
            }
        }
    }

    func thumbnail(_ photo: CrewDayRouteHomeModel.Photo) -> some View {
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
            .accessibilityIdentifier("crewDayRouteHomePhoto")
    }

    var noteField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Note for the household (optional)")
            TextField("What you did, anything they should know", text: $model.note, axis: .vertical)
                .planFont(.body)
                .lineLimit(3...8)
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                .onChange(of: model.note) { _, text in
                    if text.count > CrewDayRouteHomeModel.noteLimit { model.note = String(text.prefix(CrewDayRouteHomeModel.noteLimit)) }
                }
                .accessibilityLabel("Note for the household")
                .accessibilityIdentifier("crewDayRouteHomeNote")
            Text("Nothing extra is added without the household's OK.")
                .planFont(.footnote)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    func footer(_ home: CrewDayHomeDTO) -> some View {
        CrewDayFooter {
            Button { Task { await model.markDone() } } label: {
                PlanButtonLabel(title: "Mark done", isLoading: model.working)
            }
            .planButton(.primary)
            .disabled(!model.canMarkDone)
            .accessibilityIdentifier("crewDayRouteHomeDone")
            if model.photos.allSatisfy({ $0.path == nil }) {
                Text("Add at least one photo to mark this home done.")
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            HStack(spacing: Spacing.s2) {
                if home.status == "booked" || home.status == "on_the_way" {
                    Button(home.status == "on_the_way" ? "New time" : "On my way") { showsOnMyWay = true }
                        .planButton(.secondary, size: .small)
                        .accessibilityIdentifier("crewDayRouteHomeOnMyWay")
                }
                Button("Can't get in") {
                    cantGetInNote = "I'm at your home and can't get in. Can you open the gate?"
                    asksCantGetIn = true
                }
                .planButton(.secondary, size: .small)
                .accessibilityIdentifier("crewDayRouteHomeCantGetIn")
            }
        }
    }

    func openMaps(_ home: CrewDayHomeDTO) {
        let item: MKMapItem = if let lat = home.address?.latitude, let lng = home.address?.longitude {
            MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)))
        } else {
            MKMapItem.forCurrentLocation()
        }
        item.name = home.address?.line ?? home.label
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }
}

/// "On my way" (or a new time) from one home.
struct CrewDayHomeOnMyWaySheet: View {
    let model: CrewDayRouteHomeModel
    @State private var start = CrewDayOnMyWaySheet.defaultStart()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let end = start.addingTimeInterval(3600)
        let who = model.home.map(CrewDayRouteCopy.who) ?? "the household"
        VStack(alignment: .leading, spacing: Spacing.s4) {
            CrewDaySheetHeader(title: "On my way to \(model.home.map(CrewDayRouteCopy.place) ?? "this home")") { dismiss() }
            Text("\(who) gets a push with this window and can tell you when the gate is ready.")
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Spacing.s3) {
                Text("Expected").planFont(.label).foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Button { start = start.addingTimeInterval(-15 * 60) } label: {
                    Icon(.minus, size: 18, color: Theme.Color.appText).frame(width: 44, height: 44)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("15 minutes earlier")
                Text(CrewDayFormat.window(from: start, to: end, timezone: model.route?.timezone))
                    .planFont(.bodyStrong)
                    .monospacedDigit()
                    .accessibilityIdentifier("crewDayRouteOnMyWayTime")
                Button { start = start.addingTimeInterval(15 * 60) } label: {
                    Icon(.plus, size: 18, color: Theme.Color.appText).frame(width: 44, height: 44)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("15 minutes later")
            }
            Button {
                Task { if await model.onMyWay(start: start, end: end) { dismiss() } }
            } label: {
                PlanButtonLabel(title: "Tell \(who)", isLoading: model.working)
            }
            .planButton(.primary)
            .disabled(model.working)
            .accessibilityIdentifier("crewDayRouteOnMyWaySend")
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s4)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRouteOnMyWaySheet")
    }
}
