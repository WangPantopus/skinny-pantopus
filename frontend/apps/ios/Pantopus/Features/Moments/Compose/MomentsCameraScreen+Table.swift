//
//  MomentsCameraScreen+Table.swift
//  Pantopus
//
//  The camera as a tripod: the iPhone Duo half folded on a table (the
//  founder's Duo board T3, approved 2026-11-11). The standing half shows
//  what the camera sees, wide, with the Moment's tall frame marked: what is
//  inside it becomes the Moment. Everything you touch is on the flat half:
//  Close, Photo | Video, the flash, the library, the shutter and the switch,
//  a 3 or 10 second timer, and Library · Camera · Text. Nobody holds a
//  button on a phone that stands up, so a video starts with a tap and stops
//  with another (30 seconds at most); with a timer, big seconds count down
//  in the frame first. While recording, the time shows where the hint is.
//

import SwiftUI

extension MomentsCameraScreen {
    /// Board T3, from the screen's top-left corner.
    var tableLayout: some View {
        let fold = duo.fold ?? CGRect(x: 0, y: ((duo.size.height - 40) / 2).rounded(), width: duo.size.width, height: 40)
        let tall = CGSize(width: (fold.minY * 9 / 16).rounded(), height: fold.minY)
        let left = ((duo.size.width - tall.width) / 2).rounded()
        return GeometryReader { _ in
            ZStack(alignment: .topLeading) {
                Color(white: 0.05)
                Color.black
                    .frame(width: duo.size.width, height: fold.maxY)
                ZStack(alignment: .topLeading) {
                    Color.black
                    if camera.ready == true {
                        MomentsCameraPreview(session: camera.controller.session)
                    }
                    // Outside the tall frame the picture is shaded: only what is inside becomes the Moment.
                    Color.black.opacity(0.58)
                        .frame(width: left, height: tall.height)
                    Color.black.opacity(0.58)
                        .frame(width: max(duo.size.width - left - tall.width, 0), height: tall.height)
                        .offset(x: left + tall.width)
                    ZStack {
                        Rectangle()
                            .strokeBorder(Color.white.opacity(0.92), lineWidth: 2)
                            .accessibilityHidden(true)
                        if camera.ready == false {
                            unavailable
                        }
                        if let countdown = camera.countdown {
                            Text("\(countdown)")
                                .font(.system(size: 96, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.5), radius: 6, x: 0, y: 2)
                                .contentTransition(.numericText(countsDown: true))
                                .animation(.easeOut(duration: 0.2), value: countdown)
                                .accessibilityIdentifier("moments.camera.countdown")
                        }
                    }
                    .frame(width: tall.width, height: tall.height)
                    .offset(x: left)
                    MomentsPlaceChip(place: model.placeChip)
                        .offset(x: Spacing.s4, y: Spacing.s4)
                }
                .frame(width: duo.size.width, height: fold.minY, alignment: .topLeading)
                .clipped()
                tripodControls(top: fold.maxY)
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - The flat half

    /// From the flat half's top (the fold's bottom): Close, Photo | Video and the flash; the library, the shutter and
    /// the switch; the timer; the hint, or the time while recording; the tabs.
    private func tripodControls(top: CGFloat) -> some View {
        let busy = camera.recording || camera.countdown != nil
        return ZStack(alignment: .topLeading) {
            tripodRoundButton(.x, label: "Close", id: "moments.camera.close", enabled: true) { onClose() }
                .offset(x: Spacing.s5, y: top + 16.5)
            photoOrVideo
                .opacity(busy ? 0.4 : 1)
                .disabled(busy)
                .frame(width: duo.size.width)
                .offset(y: top + 18.5)
            tripodRoundButton(
                camera.flash ? .zap : .zapOff,
                label: camera.flash ? "Flash on" : "Flash off",
                id: "moments.camera.flash",
                enabled: camera.ready == true
            ) { camera.flash.toggle() }
                .offset(x: duo.size.width - Spacing.s5 - 44, y: top + 16.5)
            HStack(spacing: 86.5) {
                libraryButton(size: 52)
                tripodShutter
                switchButton(size: 52, fill: Color.white.opacity(0.12))
            }
            .frame(width: duo.size.width, height: 96)
            .offset(y: top + 90.5)
            timerRow
                .opacity(busy ? 0.4 : 1)
                .disabled(busy)
                .frame(width: duo.size.width, height: 40)
                .offset(y: top + 216.5)
            tripodHint
                .padding(.horizontal, Spacing.s6)
                .frame(width: duo.size.width)
                .offset(y: top + 286.5)
            MomentsModeTabs(model: model)
                .frame(width: duo.size.width)
                .opacity(busy ? 0 : 1)
                .allowsHitTesting(!busy)
                .offset(y: top + 372.5)
        }
    }

    /// Photo | Video: what the shutter takes.
    private var photoOrVideo: some View {
        HStack(spacing: 3) {
            tripodSegment("Photo", selected: !camera.tripodVideo, id: "moments.camera.mode.photo") { camera.tripodVideo = false }
            tripodSegment("Video", selected: camera.tripodVideo, id: "moments.camera.mode.video") { camera.tripodVideo = true }
        }
        .padding(3)
        .frame(width: 200, height: 40)
        .background(Capsule().fill(Color.white.opacity(0.12)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Photo or video")
    }

    private func tripodSegment(_ title: String, selected: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14.5, weight: selected ? .bold : .semibold))
                .foregroundStyle(selected ? Color(white: 0.09) : Color.white.opacity(0.78))
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(Capsule().fill(selected ? Color.white : Color.clear))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(id)
    }

    /// Timer: Off · 3s · 10s.
    private var timerRow: some View {
        HStack(spacing: 10) {
            Text("Timer")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.72))
                .padding(.trailing, Spacing.s1)
                .accessibilityHidden(true)
            ForEach([0, 3, 10], id: \.self) { seconds in
                let selected = camera.timer == seconds
                Button { camera.timer = seconds } label: {
                    Text(seconds == 0 ? "Off" : "\(seconds)s")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(selected ? Color(white: 0.09) : Color.white)
                        .padding(.horizontal, 14)
                        .frame(minWidth: 56)
                        .frame(height: 36)
                        .background(Capsule().fill(selected ? Color.white : Color.white.opacity(0.12)))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(seconds == 0 ? "Timer off" : "Timer \(seconds) seconds")
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("moments.camera.timer.\(seconds == 0 ? "off" : "\(seconds)")")
            }
        }
    }

    /// "Tap to start. Tap again to stop. Up to 30 seconds." for a video; while recording, the time.
    private var tripodHint: some View {
        Group {
            if camera.recording {
                Text(camera.timeLabel)
                    .font(.system(size: 16, weight: .bold))
                    .monospacedDigit()
            } else if camera.tripodVideo {
                Text("Tap to start. Tap again to stop. Up to 30 seconds.")
                    .font(.system(size: 14, weight: .medium))
            }
        }
        .foregroundStyle(Color.white.opacity(camera.recording ? 1 : 0.86))
        .multilineTextAlignment(.center)
        .accessibilityIdentifier("moments.camera.hint")
    }

    /// The tripod's shutter, tapped: white for a photo, red for a video; recording, the red stop in its 30-second ring.
    private var tripodShutter: some View {
        let label = if camera.recording {
            "Stop the video"
        } else if camera.countdown != nil {
            "Stop the timer"
        } else {
            camera.tripodVideo ? "Start the video. Tap again to stop" : "Take a photo"
        }
        let inner: CGFloat = camera.recording ? 40 : camera.tripodVideo ? 74 : 76
        return Button { camera.tripodShutter() } label: {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(camera.recording ? 0.35 : 1), lineWidth: 5)
                if camera.recording {
                    Circle()
                        .trim(from: 0, to: min(camera.elapsed / MomentsMediaExport.maxVideoSeconds, 1))
                        .stroke(Theme.Color.errorSolid, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                Circle()
                    .fill(camera.tripodVideo || camera.recording ? Theme.Color.errorSolid : Color.white)
                    .frame(width: inner, height: inner)
                    .animation(.easeOut(duration: 0.15), value: camera.recording)
            }
            .frame(width: 96, height: 96)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .opacity(camera.ready == true ? 1 : 0.4)
        .disabled(camera.ready != true || camera.capturing)
        .accessibilityLabel(label)
        .accessibilityIdentifier("moments.camera.shutter")
    }

    /// Close and the flash: 44-pt round buttons on a faint white fill.
    private func tripodRoundButton(
        _ icon: PantopusIcon, label: String, id: String, enabled: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: 22, strokeWidth: icon == .x ? 2.2 : 2, color: .white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.white.opacity(0.12)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .opacity(enabled ? 1 : 0.4)
        .disabled(!enabled)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}
