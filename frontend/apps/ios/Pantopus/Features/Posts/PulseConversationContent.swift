//
//  PulseConversationContent.swift
//  Pantopus
//
//  The contract returns flat replies, oldest first. Branches preserve that
//  order and render just one indented level, including deeper exchanges.
//

import Foundation

public struct PulseConversationContent: Sendable, Equatable {
    public var post: PulsePostDTO
    public var replies: [PulseReplyDTO]

    public init(post: PulsePostDTO, replies: [PulseReplyDTO]) {
        self.post = post
        var ids = Set<String>()
        self.replies = replies.filter { !$0.id.isEmpty && ids.insert($0.id).inserted }
    }

    public var replyCountText: String {
        replies.count == 1 ? "1 reply · oldest first" : "\(replies.count) replies · oldest first"
    }

    public var branches: [PulseReplyBranch] {
        let byId = Dictionary(uniqueKeysWithValues: replies.map { ($0.id, $0) })
        var order: [String] = []
        var groups: [String: [PulseReplyDTO]] = [:]
        for reply in replies {
            let root = rootId(for: reply, byId: byId)
            if groups[root] == nil { order.append(root) }
            groups[root, default: []].append(reply)
        }
        return order.map { id in
            let members = groups[id] ?? []
            return PulseReplyBranch(
                id: id,
                root: members.first { $0.id == id },
                descendants: members.filter { $0.id != id }
            )
        }
    }

    public func replyingToName(_ reply: PulseReplyDTO) -> String? {
        guard reply.parentCommentId != nil || reply.replyTo != nil else { return nil }
        if replies.first(where: { $0.id == reply.parentCommentId })?.removed == true { return "a neighbor" }
        if let name = reply.replyTo?.displayName, !name.isEmpty { return name }
        if let parent = replies.first(where: { $0.id == reply.parentCommentId }), !parent.removed,
           let name = parent.author?.displayName, !name.isEmpty { return name }
        return "a neighbor"
    }

    private func rootId(for reply: PulseReplyDTO, byId: [String: PulseReplyDTO]) -> String {
        if let branch = reply.branchId, !branch.isEmpty { return branch }
        // Missing branch ids on old data: follow the real parent, with a
        // cycle guard. A missing parent gets a Reply removed placeholder.
        var node = reply
        var visited: Set<String> = [node.id]
        while let parent = node.parentCommentId, !parent.isEmpty {
            guard visited.insert(parent).inserted else { return reply.id }
            guard let next = byId[parent] else { return parent }
            node = next
        }
        return node.id
    }
}

public struct PulseReplyBranch: Identifiable, Sendable, Equatable {
    public let id: String
    public let root: PulseReplyDTO?
    public let descendants: [PulseReplyDTO]

    public static let initialDescendants = 3

    public func shownDescendants(expanded: Bool) -> [PulseReplyDTO] {
        expanded ? descendants : Array(descendants.prefix(Self.initialDescendants))
    }

    public var expansionLabel: String? {
        let hidden = descendants.count - Self.initialDescendants
        guard hidden > 0 else { return nil }
        var names: [String] = []
        // The people in the replies the line stands for, not the shown ones.
        for reply in descendants.dropFirst(Self.initialDescendants) where !reply.removed {
            if let name = reply.author?.displayName, !name.isEmpty, !names.contains(name) { names.append(name) }
        }
        let count = hidden == 1 ? "1 more reply" : "\(hidden) more replies"
        return names.count == 2 ? "\(count) between \(names[0]) and \(names[1])" : count
    }
}
