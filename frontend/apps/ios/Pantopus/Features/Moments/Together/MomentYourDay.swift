//
//  MomentYourDay.swift
//  Pantopus
//
//  "Your day" at 8 pm ("Pulse, reinvented" phase 3, PHASE-3 piece 10; board B12; CONTRACT 8k): in the evening, the
//  photos the person already took that day, laid along their path, for one tap to approve, change or skip. Everything
//  before the tap stays on the phone: the photos are read from the person's own library (only with their photo
//  permission; photos with no place in them are left out), the path between them is drawn for them alone, and no trail
//  is ever sent. Approving posts each chosen photo as an ordinary Moment through today's posting (pinned where and when
//  it was taken, as a photo picked from the library is), with `your_day: { date, id }`; the server keeps them as posts
//  that stay. "Not today" puts the card away until tomorrow. Only while `pulse_reinvented` is on for them. (The phone's own
//  reminder at 8 pm, with its Settings row, comes in a pull request of its own.)
//

import CoreLocation
import MapKit
import Observation
import Photos
import SwiftUI

/// One photo of the day, as only its owner sees it.
struct YourDayPhoto: Identifiable {
    let asset: PHAsset
    let at: Date
    let coordinate: CLLocationCoordinate2D
    var thumbnail: UIImage?
    var chosen = true

    var id: String {
        asset.localIdentifier
    }
}

@Observable
@MainActor
final class YourDayModel {
    static let shared = YourDayModel()
    /// From 8 pm to midnight, by the phone's own clock.
    static let opensAtHour = 20
    /// As many photos as one evening's card holds.
    static let most = 12

    enum Phase: Equatable {
        /// Nothing to show (not evening, switch off, no photos with a place, already decided today, or no permission).
        case hidden
        /// The library was never asked: the card offers to look.
        case asks
        case ready
        case posting(done: Int, total: Int)
        case posted(count: Int, audience: MomentAudience)
    }

    private(set) var phase = Phase.hidden
    private(set) var photos: [YourDayPhoto] = []
    private(set) var day = Date()
    var audience: MomentAudience = .connections
    var editing = false
    private(set) var note: String?
    @ObservationIgnored private let defaults = UserDefaults.standard

    var chosen: [YourDayPhoto] {
        photos.filter(\.chosen)
    }

    /// "Your Thursday".
    var title: String {
        "Your \(day.formatted(.dateTime.weekday(.wide)))"
    }

    /// The day as the server keeps it: YYYY-MM-DD in the phone's own time zone.
    static func dateKey(_ date: Date) -> String {
        let format = DateFormatter()
        format.calendar = Calendar(identifier: .gregorian)
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = .current
        format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }

    static var isEvening: Bool {
        Calendar.current.component(.hour, from: Date()) >= opensAtHour
    }

    /// Today's card was shared or put away ("Not today"): tonight's reminder isn't needed.
    var decidedToday: Bool {
        guard let account = MomentsComposerModel.account else { return false }
        return defaults.string(forKey: Self.decidedKey(account)) == Self.dateKey(Date())
    }

    private static func decidedKey(_ account: String) -> String {
        "pantopus.yourDay.decided.\(account)"
    }

    /// Reads the day's photos, in the evening only and once nothing was decided for today.
    func read() async {
        guard PulseReinventedFlags.shared.isOn, let account = MomentsComposerModel.account else {
            phase = .hidden
            return
        }
        await YourDayReminder.arm()
        if case .posting = phase { return }
        let now = Date()
        let key = Self.dateKey(now)
        guard Self.isEvening, defaults.string(forKey: Self.decidedKey(account)) != key else {
            if case .posted = phase, Self.dateKey(day) == key { return }
            phase = .hidden
            return
        }
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .notDetermined:
            phase = .asks
            return
        case .authorized, .limited:
            break
        default:
            phase = .hidden
            return
        }
        // The same day's card keeps the person's choices while it is read again.
        if Self.dateKey(day) == key, phase == .ready, !photos.isEmpty { return }
        day = now
        photos = Self.todaysPhotos(since: Calendar.current.startOfDay(for: now))
        phase = photos.isEmpty ? .hidden : .ready
        for index in photos.indices {
            let asset = photos[index].asset
            let image = await MomentsLibraryLoader.thumbnail(for: asset, side: 240)
            if index < photos.count, photos[index].asset == asset { photos[index].thumbnail = image }
        }
    }

    /// "Look at today's photos": asks for the library once, then reads.
    func allow() async {
        _ = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        await read()
    }

    func toggle(_ photo: YourDayPhoto) {
        guard let index = photos.firstIndex(where: { $0.id == photo.id }) else { return }
        photos[index].chosen.toggle()
    }

    /// "Not today": the card goes until tomorrow evening.
    func notToday() {
        if let account = MomentsComposerModel.account { defaults.set(Self.dateKey(day), forKey: Self.decidedKey(account)) }
        phase = .hidden
        editing = false
    }

    /// Posts the chosen photos, oldest first, each its own Moment through today's posting, under the chosen audience.
    /// A photo today's posting refuses is left on the card with the words why, and the rest still post; a refusal
    /// because the switch went off puts the card away at once.
    func share() async {
        let chosen = chosen
        guard !chosen.isEmpty, phase == .ready, let account = MomentsComposerModel.account else { return }
        note = nil
        editing = false
        let date = Self.dateKey(day)
        let id = UUID().uuidString.lowercased()
        var posted = 0
        var refused: [String] = []
        phase = .posting(done: 0, total: chosen.count)
        for photo in chosen {
            if let failure = await Self.post(photo, audience: audience, date: date, id: id) {
                await PulseReinventedFlags.shared.recheck()
                guard PulseReinventedFlags.shared.isOn else {
                    phase = .hidden
                    return
                }
                refused.append(failure)
                if let index = photos.firstIndex(where: { $0.id == photo.id }) { photos[index].chosen = false }
            } else {
                posted += 1
                photos.removeAll { $0.id == photo.id }
            }
            phase = .posting(done: posted + refused.count, total: chosen.count)
        }
        if refused.isEmpty {
            defaults.set(date, forKey: Self.decidedKey(account))
            phase = .posted(count: posted, audience: audience)
            return
        }
        // What wasn't posted stays on the card (left out), with the words why.
        let lead = refused.count == 1 ? "1 photo couldn't be shared" : "\(refused.count) photos couldn't be shared"
        let done = posted > 0 ? " The other \(posted == 1 ? "one was" : "\(posted) were") shared." : ""
        note = "\(lead): \(refused[0])\(done)"
        phase = photos.isEmpty ? .hidden : .ready
    }

    /// One photo through today's composer, without its sheet: pinned where the file says it was taken, `your_day`
    /// added by `TogetherStudio`. Nil when it posted, or the words of why not.
    private static func post(_ photo: YourDayPhoto, audience: MomentAudience, date: String, id: String) async -> String? {
        let model = MomentsComposerModel()
        model.restoreChoices()
        await model.use(asset: photo.asset)
        guard model.draft != nil else { return model.error ?? "Couldn't open that photo." }
        model.audience = audience
        // Under the person's own name only: a made-up name chosen earlier in the Studio never carries into "Your day".
        model.postsUnderMadeUpName = false
        let together = TogetherStudio.shared
        together.context = .yourDay(date: date, id: id)
        together.claim(model)
        defer { together.release(model) }
        guard model.canPost else { return model.error ?? "Couldn't post that photo. Try again." }
        return await model.post() ? nil : model.error ?? "Couldn't post that photo. Try again."
    }

    /// Today's photos with a place in them, oldest first (screenshots left out).
    private static func todaysPhotos(since start: Date) -> [YourDayPhoto] {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(
            format: "mediaType == %d AND creationDate >= %@",
            PHAssetMediaType.image.rawValue,
            start as NSDate
        )
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        let result = PHAsset.fetchAssets(with: options)
        var found: [YourDayPhoto] = []
        result.enumerateObjects { asset, _, stop in
            guard !asset.mediaSubtypes.contains(.photoScreenshot), let place = asset.location, let at = asset.creationDate else { return }
            found.append(YourDayPhoto(asset: asset, at: at, coordinate: place.coordinate))
            if found.count >= most { stop.pointee = true }
        }
        return found
    }
}

// MARK: - The card

/// At the top of Around me in the evening: the day's photos along the person's path, private to them.
struct YourDayCard: View {
    private let model = YourDayModel.shared

    var body: some View {
        switch model.phase {
        case .hidden:
            EmptyView()
        case .asks:
            card {
                header
                Text("See the photos you took today along your path. Only you see it until you share.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s3) {
                    Button { Task { await model.allow() } } label: { pill("Look at today's photos", strong: true) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("yourDay.allow")
                    Button("Not today") { model.notToday() }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("yourDay.notToday")
                }
            }
        case .ready, .posting:
            card {
                header
                Text(summary)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                YourDayPathMap(photos: model.photos)
                photosRow
                if model.editing { audiencePicker }
                if let note = model.note {
                    Text(note)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("yourDay.note")
                }
                actions
            }
        case let .posted(count, audience):
            card {
                header
                Text("Shared \(count == 1 ? "1 photo" : "\(count) photos") with \(audience == .connections ? "Friends" : "people nearby"). "
                    + "They stay in your Atlas.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("yourDay.posted")
            }
        }
    }

    private var summary: String {
        let count = model.photos.count
        return "\(count == 1 ? "1 photo" : "\(count) photos") you already took, along your path. Nothing is shared until you say so."
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(model.title)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Text("Only you see this")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
    }

    private var photosRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(Array(model.photos.enumerated()), id: \.element.id) { index, photo in
                    Button { if model.editing { model.toggle(photo) } } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            ZStack(alignment: .topTrailing) {
                                Group {
                                    if let image = photo.thumbnail {
                                        Image(uiImage: image).resizable().scaledToFill()
                                    } else {
                                        Theme.Color.appSurfaceRaised
                                    }
                                }
                                .frame(width: 104, height: 78)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                                .opacity(photo.chosen ? 1 : 0.35)
                                if model.editing {
                                    Group {
                                        if photo.chosen {
                                            Icon(.check, size: 13, strokeWidth: 3, color: .white)
                                                .frame(width: 22, height: 22)
                                                .background(Circle().fill(Theme.Color.primarySolid))
                                        } else {
                                            Circle().stroke(Color.white, lineWidth: 2).frame(width: 20, height: 20)
                                        }
                                    }
                                    .padding(4)
                                    .accessibilityHidden(true)
                                }
                            }
                            Text("\(index + 1) · \(photo.at.formatted(date: .omitted, time: .shortened))")
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(photo.chosen ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Photo \(index + 1), \(photo.at.formatted(date: .omitted, time: .shortened))")
                    .accessibilityValue(photo.chosen ? "Chosen" : "Left out")
                    .accessibilityIdentifier("yourDay.photo")
                }
            }
        }
    }

    private var audiencePicker: some View {
        Picker("Who sees them", selection: Binding(get: { model.audience }, set: { model.audience = $0 })) {
            Text("Friends").tag(MomentAudience.connections)
            Text("People nearby").tag(MomentAudience.nearby)
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("yourDay.audience")
    }

    @ViewBuilder private var actions: some View {
        if case let .posting(done, total) = model.phase {
            HStack(spacing: Spacing.s2) {
                ProgressView()
                Text("Sharing \(min(done + 1, total)) of \(total)…")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
        } else {
            HStack(spacing: Spacing.s3) {
                let count = model.chosen.count
                Button { Task { await model.share() } } label: {
                    pill(model.audience == .connections ? "Share with Friends" : "Share with people nearby", strong: true)
                }
                .buttonStyle(.plain)
                .disabled(count == 0)
                .opacity(count == 0 ? 0.5 : 1)
                .accessibilityIdentifier("yourDay.share")
                Button { model.editing.toggle() } label: { pill(model.editing ? "Done" : "Edit", strong: false) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("yourDay.edit")
                Spacer(minLength: 0)
                Button("Not today") { model.notToday() }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("yourDay.notToday")
            }
        }
    }

    private func pill(_ words: String, strong: Bool) -> some View {
        Text(words)
            .font(.system(size: 14.5, weight: .semibold))
            .foregroundStyle(strong ? Color.white : Theme.Color.appText)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 16)
            .frame(minHeight: 42)
            .background(Capsule().fill(strong ? Theme.Color.primarySolid : Theme.Color.appSurface))
            .overlay(Capsule().stroke(strong ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
            .contentShape(Capsule())
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) { content() }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder, lineWidth: 1))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("yourDay")
    }
}

/// The day's path for its owner alone: numbered photos in time order and a dotted line between them. Drawn on the
/// phone only; never sent.
struct YourDayPathMap: View {
    let photos: [YourDayPhoto]

    var body: some View {
        Map(initialPosition: .automatic, interactionModes: []) {
            if photos.count > 1 {
                MapPolyline(coordinates: photos.map(\.coordinate))
                    .stroke(Theme.Color.primarySolid, style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [2, 6]))
            }
            ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                Annotation("", coordinate: photo.coordinate) {
                    Text("\(index + 1)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(photo.chosen ? Theme.Color.primarySolid : Color.gray))
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }
            }
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .id(photos.map(\.id).joined())
        .accessibilityLabel("Your path today, with \(photos.count) photos")
    }
}
