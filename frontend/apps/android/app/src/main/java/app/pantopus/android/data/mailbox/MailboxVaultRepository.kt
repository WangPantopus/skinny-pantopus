package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.vault.CreateVaultFolderRequest
import app.pantopus.android.data.api.models.mailbox.vault.FileToVaultRequest
import app.pantopus.android.data.api.models.mailbox.vault.FileToVaultResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderItemsResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultFoldersResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultSearchResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxVaultApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * T6.5e (P19.5) — Thin wrapper around [MailboxVaultApi] that maps
 * throwables into the [NetworkResult] taxonomy.
 */
@Singleton
class MailboxVaultRepository
    @Inject
    constructor(
        private val api: MailboxVaultApi,
    ) {
        /** `GET /api/mailbox/v2/p2/vault/folders`. */
        suspend fun folders(drawer: String? = "personal"): NetworkResult<VaultFoldersResponse> = safeApiCall { api.folders(drawer) }

        /** `POST /api/mailbox/v2/p2/vault/folder`. */
        suspend fun createFolder(request: CreateVaultFolderRequest): NetworkResult<VaultFolderResponse> =
            safeApiCall { api.createFolder(request) }

        /** `GET /api/mailbox/v2/p2/vault/folder/:folderId/items`. */
        suspend fun folderItems(
            folderId: String,
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<VaultFolderItemsResponse> = safeApiCall { api.folderItems(folderId, limit, offset) }

        /** `POST /api/mailbox/v2/p2/vault/file`. */
        suspend fun file(
            mailId: String,
            folderId: String,
        ): NetworkResult<FileToVaultResponse> = safeApiCall { api.file(FileToVaultRequest(mailId, folderId)) }

        /**
         * `GET /api/mailbox/v2/p2/vault/search`. A `null` [drawer] searches
         * every drawer, which is what the Vault search field does.
         */
        suspend fun search(
            query: String,
            drawer: String? = null,
            limit: Int = 20,
            offset: Int = 0,
        ): NetworkResult<VaultSearchResponse> = safeApiCall { api.search(query, drawer, null, limit, offset) }
    }
