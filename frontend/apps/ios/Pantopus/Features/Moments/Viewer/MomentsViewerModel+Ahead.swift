//
//  MomentsViewerModel+Ahead.swift
//  Pantopus
//
//  What the viewer reads before it's asked for (founder, 2026-11-11: "no
//  lagging"): the Moments a tap or a swipe can show next, in one request, with
//  their pictures and the next video made ready; and the person on either
//  side, for the page a sideways drag brings in.
//

import Foundation

extension MomentsViewerModel {
    /// Reads ahead what a tap or a swipe can show next, nearest first: the next Moment, the one before, the first
    /// of the person after and of the person before, then the rest of this ring. One request reads them all; the
    /// nearest four get their pictures too, and the next video is made ready to play.
    func readAhead() {
        guard let ring else { return }
        let after = nextIndex(in: ring, after: momentIndex).map { ring.moments[$0].id } ?? opening(of: ringIndex + 1)?.id
        let before = momentIndex > 0 ? ring.moments[momentIndex - 1].id : nil
        var ids = [after, before, opening(of: ringIndex + 1)?.id, opening(of: ringIndex - 1)?.id].compactMap { $0 }
        ids += ring.moments.indices.filter { $0 > momentIndex }.map { ring.moments[$0].id }
        var seen: Set<String> = [brief?.id ?? ""]
        ids = ids.filter { seen.insert($0).inserted }
        guard !ids.isEmpty else { return }
        readingAhead?.cancel()
        readingAhead = Task { [weak self, cache] in
            let playable = await cache.readAhead(Array(ids.prefix(24)), pictures: 4)
            guard let self, !Task.isCancelled, let after else { return }
            if let next = playable.first(where: { $0.id == after }), next.kind == .video, let url = next.media {
                video.preload(url, id: next.id)
            }
        }
    }

    /// The Moment a ring opens on: its first one new to the viewer.
    private func opening(of index: Int) -> MomentBriefDTO? {
        guard rings.indices.contains(index), !rings[index].moments.isEmpty else { return nil }
        let start = startIndex(in: index)
        return rings[index].moments[rings[index].moments.indices.contains(start) ? start : 0]
    }

    // MARK: - Where a ring starts and how long a Moment shows

    func startIndex(in index: Int) -> Int {
        guard rings.indices.contains(index) else { return 0 }
        return rings[index].moments.firstIndex { !$0.seen } ?? 0
    }

    /// The next to play in a ring: the next one, or with Play all the next not watched.
    func nextIndex(in ring: MomentRingDTO, after index: Int) -> Int? {
        let rest = ring.moments.indices.filter { $0 > index }
        return newOnly ? rest.first { !ring.moments[$0].seen } : rest.first
    }

    /// A photo shows for six seconds; a text card for 3 s plus 45 ms a character, between 6 and 12 (the same on Android).
    func duration(of moment: MomentDTO) -> Double {
        guard moment.kind == .text, let text = moment.text else { return Self.photoSeconds }
        return min(12, max(Self.photoSeconds, 3 + 0.045 * Double(text.count)))
    }

    // MARK: - The person on either side

    /// What a drag toward the person after (`step` 1) or before (-1) slides in: who they are and, when it has been
    /// read ahead, the Moment their ring opens on.
    func peek(_ step: Int) -> MomentsPeek? {
        let index = ringIndex + step
        guard rings.indices.contains(index), let brief = opening(of: index) else { return nil }
        let detail = cache.ready(brief.id)
        return MomentsPeek(
            ring: rings[index],
            index: rings[index].moments.firstIndex { $0.id == brief.id } ?? 0,
            brief: brief,
            moment: detail,
            picture: cache.heldPicture(brief.id) ?? cache.heldPoster(brief.id)
        )
    }
}
