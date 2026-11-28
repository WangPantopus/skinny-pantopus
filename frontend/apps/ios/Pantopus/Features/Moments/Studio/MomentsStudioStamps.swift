//
//  MomentsStudioStamps.swift
//  Pantopus
//
//  The stamps on the Studio's picture ("Pulse, reinvented" phase 0 step 3). Where each sits is the composer model's
//  (`MomentsComposerModel.studioStamps`, sent with the Moment as `stamps`); what each reads before posting is read from
//  the server for this spot (CONTRACT 2a) and kept here; the server fills them again when the Moment goes out.
//
//  On the picture a stamp is an object: drag it, pinch it to size, turn it with two fingers; a tap picks it and shows
//  its frame with a handle, and the tray (or its × on the frame) takes it off.
//

import CoreLocation
import Observation
import SwiftUI

@Observable
@MainActor
final class MomentsStudioStamps {
    enum Reading: Equatable {
        case reading, read, failed
    }

    private(set) var reading: Reading = .reading
    /// What each stamp would read here now; a kind the server can't give here is missing.
    private(set) var values: [MomentStampKind: MomentStampValue] = [:]
    /// The stamp picked on the picture (its frame and handle show).
    var picked: MomentStampKind?
    /// Where a stamp may sit on this picture (`MomentMarks.safeBox`), and the size that shows it at its natural size on
    /// this screen; the layer measures both.
    @ObservationIgnored var safeBox = CGRect(x: 0, y: 0, width: 1, height: 1)
    @ObservationIgnored var startScale: Double = 1
    @ObservationIgnored private var readAt: CLLocationCoordinate2D?

    /// The tray's stamps, in its order: the ones the server gave a value for here, and the elevation from the phone's
    /// own reading where a height may show. Under a made-up name, none that says how high or how far from home.
    func offered(for model: MomentsComposerModel) -> [MomentStampKind] {
        MomentStampKind.allCases.filter { kind in
            values[kind] != nil && !(model.postsUnderMadeUpName && Self.notUnderMadeUpName.contains(kind))
        }
    }

    /// What a made-up name's Moment never carries (the made-up-names contract; CONTRACT 2c).
    static let notUnderMadeUpName: Set<MomentStampKind> = [.elevation, .homeDistance]

    /// Reads the stamps for the Moment's pin (again when the pin moved).
    func read(model: MomentsComposerModel) async {
        guard let pin = model.basePin else {
            values = [:]
            reading = .read
            return
        }
        reading = .reading
        do {
            let answer: StudioStampsPreviewDTO = try await APIClient.shared.request(
                StudioEndpoints.stampsPreview(latitude: pin.latitude, longitude: pin.longitude)
            )
            var read = answer.values
            // The elevation is the phone's own reading (the server rounds it on posting).
            if model.place?.canShowHeight == true, let feet = model.heightFeet {
                read[.elevation] = MomentStampValue(label: "\(feet) ft")
            }
            values = read
            readAt = pin
            reading = .read
        } catch {
            reading = .failed
            // A Studio-only request: refused, the switch may be off now (CONTRACT 1). Read it again at once.
            await PulseReinventedFlags.shared.recheck()
        }
    }

    /// Puts a stamp on the picture, at its natural size on this screen: the postmark at the left a little below the
    /// middle as on board B2, the others stacked toward the bottom, all inside the part every viewer shows.
    func place(_ kind: MomentStampKind, on model: MomentsComposerModel) {
        guard !model.studioStamps.contains(where: { $0.kind == kind }) else { return }
        let index = Double(model.studioStamps.count)
        let box = safeBox
        let spot = kind == .postmark
            ? MomentStampPlacement(
                kind: kind,
                x: box.minX + box.width * 0.22,
                y: box.minY + box.height * 0.45,
                scale: startScale,
                rotation: -9
            )
            : MomentStampPlacement(
                kind: kind,
                x: box.minX + box.width * 0.3,
                y: min(box.minY + box.height * (0.3 + index * 0.08), box.maxY),
                scale: startScale,
                rotation: 0
            )
        model.studioStamps.append(spot)
        picked = kind
    }

    /// The layer measured the picture: where stamps may sit, and the size that is natural on this screen.
    func measured(aspect: CGFloat, pictureWidth: CGFloat, screenWidth: CGFloat) {
        safeBox = MomentMarks.safeBox(aspect: aspect)
        startScale = min(max(Double(screenWidth / max(pictureWidth, 1)), 0.25), 4)
    }
}

/// The stamps over the Studio's picture, placed on the picture itself (0–1 across and down, as `MomentMarks` places
/// marks) and sized as a share of its drawn width (scale 1 is 96/402 of it for the postmark). They stay inside the part
/// every phone's viewer shows (`MomentMarks.safeBox`).
struct MomentsStudioStampLayer: View {
    let model: MomentsComposerModel
    let stamps: MomentsStudioStamps
    /// The picture's own size, for where it's drawn (nil for a text card: the card is the screen).
    let picture: CGSize?
    /// Whether a tap away from every stamp is caught here (it lets go of the picked one). Over the Studio's controls
    /// (PHASE-6 K) the stamps take only their own touches, and the catch stays under the controls.
    var catchesTaps = true
    /// Only the catch, under the controls; the stamps themselves are drawn over them.
    var catchOnly = false

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            let unit = frame.width / 402
            ZStack {
                // A tap on the picture away from every stamp lets go of the picked one.
                if catchesTaps {
                    Color.clear
                        .contentShape(Rectangle())
                        .onTapGesture { stamps.picked = nil }
                        .allowsHitTesting(stamps.picked != nil)
                }
                ForEach(catchOnly ? [] : model.studioStamps, id: \.kind) { placement in
                    MomentsStudioPlacedStamp(
                        model: model,
                        stamps: stamps,
                        placement: placement,
                        frame: frame,
                        unit: unit
                    )
                }
            }
            .onChange(of: frame, initial: true) { _, frame in
                stamps.measured(aspect: frame.width / max(frame.height, 1), pictureWidth: frame.width, screenWidth: geo.size.width)
            }
        }
    }
}

/// One stamp on the picture, with its gestures.
private struct MomentsStudioPlacedStamp: View {
    let model: MomentsComposerModel
    let stamps: MomentsStudioStamps
    let placement: MomentStampPlacement
    let frame: CGRect
    let unit: CGFloat
    /// The stamp's own size at scale 1 on a 402-wide picture, measured.
    @State private var natural = CGSize(width: 96, height: 96)
    @GestureState private var drag: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var turn: Angle = .zero

    var body: some View {
        let picked = stamps.picked == placement.kind
        let center = CGPoint(
            x: frame.minX + placement.x * frame.width + drag.width,
            y: frame.minY + placement.y * frame.height + drag.height
        )
        // The postmark as it will show: wet while the Moment will read "Live from here" (the camera's own shot here).
        MomentStampView(kind: placement.kind, value: stamps.values[placement.kind], wet: model.showsLive)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { natural = $0 }
            .padding(6)
            .overlay {
                if picked {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                }
            }
            .overlay(alignment: .topTrailing) {
                if picked {
                    Button {
                        model.studioStamps.removeAll { $0.kind == placement.kind }
                        stamps.picked = nil
                    } label: {
                        Icon(.x, size: 12, strokeWidth: 3, color: .white)
                            .frame(width: 24, height: 24)
                            .background(Circle().fill(Color.black.opacity(0.75)))
                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                            .contentShape(Circle().inset(by: -8))
                    }
                    .buttonStyle(.plain)
                    .offset(x: 11, y: -11)
                    .accessibilityLabel("Take it off")
                    .accessibilityIdentifier("moments.studio.stamp.remove")
                }
            }
            .scaleEffect(CGFloat(placement.scale) * pinch * unit)
            .rotationEffect(.degrees(placement.rotation) + turn)
            .position(center)
            .gesture(moveGesture.simultaneously(with: pinchGesture).simultaneously(with: turnGesture))
            // Under a finger, the Studio's controls fade and take no touches (PHASE-6 K).
            .onChange(of: drag != .zero || pinch != 1 || turn != .zero) { _, moving in model.studioDragging(moving) }
            .onTapGesture { stamps.picked = picked ? nil : placement.kind }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(MomentStampView.name(placement.kind))
            .accessibilityHint("Drag to move it, pinch to size it")
            .accessibilityIdentifier("moments.studio.stamp.\(placement.kind.rawValue)")
    }

    private var moveGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .updating($drag) { value, drag, _ in drag = value.translation }
            .onEnded { value in
                // On the Studio's first screen: anywhere on the canvas (PHASE-6 F2).
                if model.studioWholeOffered { return drop(by: value.translation) }
                update { placement in
                    // Inside the part every viewer shows (`MomentMarks.safeBox`): the whole stamp, as far as its size goes.
                    let box = stamps.safeBox
                    let halfWidth = min(
                        Double(natural.width) * placement.scale * Double(unit) / 2 / Double(max(frame.width, 1)),
                        box.width / 2
                    )
                    let halfHeight = min(
                        Double(natural.height) * placement.scale * Double(unit) / 2 / Double(max(frame.height, 1)),
                        box.height / 2
                    )
                    let x = placement.x + value.translation.width / max(frame.width, 1)
                    let y = placement.y + value.translation.height / max(frame.height, 1)
                    placement.x = min(max(x, box.minX + halfWidth), box.maxX - halfWidth)
                    placement.y = min(max(y, box.minY + halfHeight), box.maxY - halfHeight)
                }
            }
    }

    private var pinchGesture: some Gesture {
        MagnifyGesture()
            .updating($pinch) { value, pinch, _ in pinch = value.magnification }
            .onEnded { value in
                update { placement in placement.scale = min(max(placement.scale * value.magnification, 0.25), 4) }
                if model.studioWholeOffered { drop(by: .zero) }
            }
    }

    private var turnGesture: some Gesture {
        RotateGesture()
            .updating($turn) { value, turn, _ in turn = value.rotation }
            .onEnded { value in
                update { placement in
                    var degrees = placement.rotation + value.rotation.degrees
                    while degrees > 180 {
                        degrees -= 360
                    }
                    while degrees < -180 {
                        degrees += 360
                    }
                    placement.rotation = degrees
                }
                if model.studioWholeOffered { drop(by: .zero) }
            }
    }

    /// Let go anywhere on the canvas: at least 24 pt of the stamp stays on it, and its middle; off the picture's own
    /// box, the picture goes onto its canvas so readers see the stamp where it was put.
    private func drop(by translation: CGSize) {
        guard let now = model.studioStamps.first(where: { $0.kind == placement.kind }) else { return }
        let size = MomentsStudioAnywhere.turned(
            CGSize(width: natural.width * CGFloat(now.scale) * unit, height: natural.height * CGFloat(now.scale) * unit),
            by: now.rotation
        )
        let moved = CGPoint(x: now.x + translation.width / max(frame.width, 1), y: now.y + translation.height / max(frame.height, 1))
        let held = MomentsStudioAnywhere.hold(moved, size: size, frame: frame.size, canvas: model.studioCanvasBox)
        update { placement in
            placement.x = Double(held.x)
            placement.y = Double(held.y)
        }
        if MomentsStudioAnywhere.offPicture(held, size: size, frame: frame.size) { model.studioWholeOntoCanvas() }
    }

    private func update(_ change: (inout MomentStampPlacement) -> Void) {
        guard let index = model.studioStamps.firstIndex(where: { $0.kind == placement.kind }) else { return }
        change(&model.studioStamps[index])
        stamps.picked = placement.kind
    }
}

extension PulseReinventedFlags {
    /// A request only the new screens make failed: the switch is read again at once, so one turned off on the server
    /// (`403 PULSE_REINVENTED_OFF`, CONTRACT 1) takes the person back to today's screens, keeping what they made.
    func recheck() async {
        guard case let .signedIn(user) = AuthManager.shared.state else { return }
        await refresh(account: user.id, force: true)
    }
}
