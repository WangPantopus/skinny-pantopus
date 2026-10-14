import Foundation

enum PulseOfferRequestsState: Equatable {
    case loading
    case loaded(PulseOfferClaimsResponse)
    case error(String)
}

extension PulsePostDetailViewModel {
    var offerActionLabel: String {
        if conversation?.post.offer?.gone == true, offerRequestStatus != "chosen" {
            return offerRequestStatus == "requested" ? "Someone else got this one." : "Gone"
        }
        switch offerRequestStatus {
        case "requested": return "Requested"
        case "chosen": return "It's yours"
        case "enough_requests": return "Enough requests already"
        case "gone": return "Gone"
        default:
            if conversation?.post.action?.done == true { return "Requested" }
            if conversation?.post.offer?.requestsOpen == false { return "Enough requests already" }
            return "I'd like it"
        }
    }

    var canRequestOffer: Bool {
        guard let post = conversation?.post, post.type == "offer", !isOwner,
              post.offer?.requestsOpen == true, post.offer?.gone != true,
              post.action?.done != true, offerRequestStatus == nil else { return false }
        return pendingConversationActions.isEmpty && !isSendingComment
    }

    func requestConversationOffer() async {
        guard canRequestOffer, beginConversationAction("claim") else { return }
        defer { finishConversationAction("claim") }
        do {
            let response: PulseOfferClaimResponse = try await client.request(PulseEndpoints.requestOffer(postId: postId))
            guard let claim = response.claim, !claim.id.isEmpty, ["requested", "chosen"].contains(claim.status ?? "") else {
                showToast("Couldn't confirm your request. Try again.")
                return
            }
            offerRequestStatus = claim.status
            if var content = conversation, let status = response.postStatus {
                content.post.status = status
                state = .conversation(content)
            }
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            if clearRefusedConversation(error) { return }
            if let code = PulsePageViewModel.serverCode(error) {
                if code == "ENOUGH_REQUESTS" { offerRequestStatus = "enough_requests" }
                if code == "OFFER_GONE" { offerRequestStatus = "gone" }
            }
            showToast(Self.refusal(in: error) ?? "Couldn't request this offer. Try again.")
        }
    }

    func loadOfferRequests() async {
        guard isOwner, conversation?.post.type == "offer", pendingConversationActions.isEmpty else { return }
        let generation = conversationGeneration
        offerRequestsState = .loading
        do {
            let response: PulseOfferClaimsResponse = try await client.request(PulseEndpoints.offerRequests(postId: postId))
            guard generation == conversationGeneration, !Task.isCancelled else { return }
            offerRequestsState = .loaded(response)
        } catch {
            guard generation == conversationGeneration, !Task.isCancelled else { return }
            _ = clearRefusedConversation(error)
            offerRequestsState = .error(Self.refusal(in: error) ?? "Couldn't load requests. Try again.")
        }
    }

    func chooseConversationOffer(_ claim: PulseOfferClaimDTO) async {
        guard isOwner, claim.status == "requested", case let .loaded(requests) = offerRequestsState,
              requests.offer?.gone == false, requests.offer?.claimMode == "choose",
              requests.claims.contains(where: { $0.id == claim.id && $0.status == "requested" }),
              beginConversationAction("choose") else { return }
        defer { finishConversationAction("choose") }
        do {
            let response: PulseOfferClaimResponse = try await client.request(
                PulseEndpoints.chooseOfferRequest(postId: postId, claimId: claim.id)
            )
            guard response.claim?.id == claim.id, response.claim?.status == "chosen" else {
                showToast("Couldn't confirm your choice. Try again.")
                return
            }
            if var content = conversation, let status = response.postStatus {
                content.post.status = status
                state = .conversation(content)
            }
            offerRequestsState = .loading
            let requests: PulseOfferClaimsResponse = try await client.request(PulseEndpoints.offerRequests(postId: postId))
            offerRequestsState = .loaded(requests)
            await refreshConversationAfterMutation()
            PulsePostsRefresh.notifyPostsDidChange()
        } catch {
            _ = clearRefusedConversation(error)
            offerRequestsState = .error(Self.refusal(in: error) ?? "Couldn't confirm the request list. Reload before choosing again.")
        }
    }
}
