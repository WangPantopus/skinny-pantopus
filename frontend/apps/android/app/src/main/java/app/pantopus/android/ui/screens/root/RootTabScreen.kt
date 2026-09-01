@file:Suppress("LargeClass", "LongMethod")

package app.pantopus.android.ui.screens.root

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.invisibleToUser
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.pantopus.android.BuildConfig
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.components.NavigationDrawer
import app.pantopus.android.ui.components.NavigationDrawerContext
import app.pantopus.android.ui.components.NavigationDrawerDestination
import app.pantopus.android.ui.components.composeEmail
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens._internal.TokenGalleryScreen
import app.pantopus.android.ui.screens.audience_profile.AudienceProfileScreen
import app.pantopus.android.ui.screens.audience_profile.AudienceProfileViewModel
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BROADCAST_DETAIL_ID_KEY
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailScreen
import app.pantopus.android.ui.screens.audience_profile.compose_broadcast.ComposeBroadcastScreen
import app.pantopus.android.ui.screens.audience_profile.edit_persona.EDIT_PERSONA_CREATE_ARG
import app.pantopus.android.ui.screens.audience_profile.edit_persona.EditPersonaScreen
import app.pantopus.android.ui.screens.beacon_profile.BEACON_HANDLE_KEY
import app.pantopus.android.ui.screens.beacon_profile.BeaconProfileScreen
import app.pantopus.android.ui.screens.business_profile.BUSINESS_PROFILE_BUSINESS_ID_KEY
import app.pantopus.android.ui.screens.business_profile.BUSINESS_PROFILE_PAGE_SLUG_KEY
import app.pantopus.android.ui.screens.business_profile.BusinessProfileScreen
import app.pantopus.android.ui.screens.businesses.MyBusinessesScreen
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessWizardScreen
import app.pantopus.android.ui.screens.businesses.invoices.BusinessInvoicesScreen
import app.pantopus.android.ui.screens.businesses.legal.BusinessLegalScreen
import app.pantopus.android.ui.screens.businesses.locations.BUSINESS_LOCATIONS_BUSINESS_ID_KEY
import app.pantopus.android.ui.screens.businesses.locations.BusinessLocationsScreen
import app.pantopus.android.ui.screens.businesses.owner_dashboard.BusinessOwnerScreen
import app.pantopus.android.ui.screens.businesses.page_blocks.BusinessPageBlocksScreen
import app.pantopus.android.ui.screens.businesses.page_blocks.PAGE_BLOCKS_BUSINESS_ID_KEY
import app.pantopus.android.ui.screens.businesses.page_blocks.PAGE_BLOCKS_PAGE_ID_KEY
import app.pantopus.android.ui.screens.businesses.page_blocks.PAGE_BLOCKS_PAGE_TITLE_KEY
import app.pantopus.android.ui.screens.businesses.page_editor.EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageScreen
import app.pantopus.android.ui.screens.businesses.pages.BUSINESS_PAGES_BUSINESS_ID_KEY
import app.pantopus.android.ui.screens.businesses.pages.BusinessPagesScreen
import app.pantopus.android.ui.screens.businesses.payments.BusinessPaymentsScreen
import app.pantopus.android.ui.screens.businesses.team.BusinessTeamScreen
import app.pantopus.android.ui.screens.ceremonial_mail.CeremonialMailWizardScreen
import app.pantopus.android.ui.screens.ceremonial_mail_open.CeremonialMailOpenScreen
import app.pantopus.android.ui.screens.compose.gig.GigComposeWizardScreen
import app.pantopus.android.ui.screens.compose.listing.ListingComposeStep
import app.pantopus.android.ui.screens.compose.listing.ListingComposeWizardScreen
import app.pantopus.android.ui.screens.compose.pulse.PulseComposeFlowScreen
import app.pantopus.android.ui.screens.connections.ConnectionsChatTarget
import app.pantopus.android.ui.screens.connections.ConnectionsScreen
import app.pantopus.android.ui.screens.contentdetail.GigDetailScreen
import app.pantopus.android.ui.screens.contentdetail.InvoiceDetailScreen
import app.pantopus.android.ui.screens.contentdetail.ListingDetailScreen
import app.pantopus.android.ui.screens.creator_audience.YourAudienceScreen
import app.pantopus.android.ui.screens.creator_inbox.CreatorInboxScreen
import app.pantopus.android.ui.screens.discoverbusinesses.DiscoverBusinessesScreen
import app.pantopus.android.ui.screens.discoverbusinesses.DiscoverBusinessesTarget
import app.pantopus.android.ui.screens.discoverhub.DiscoverHubScreen
import app.pantopus.android.ui.screens.discoverhub.DiscoverHubTarget
import app.pantopus.android.ui.screens.explore.ExploreEntity
import app.pantopus.android.ui.screens.explore.ExploreKind
import app.pantopus.android.ui.screens.explore.ExploreMapFocus
import app.pantopus.android.ui.screens.explore.ExploreMapScreen
import app.pantopus.android.ui.screens.feed.FeedScreen
import app.pantopus.android.ui.screens.feed.beacons.BeaconsFeedScreen
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.following.FollowingScreen
import app.pantopus.android.ui.screens.gigs.GigSearchScreen
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.gigs.GigsFeedScreen
import app.pantopus.android.ui.screens.gigs.quickpost.PostGigV1Screen
import app.pantopus.android.ui.screens.gigs.quickpost.PostGigV1ViewModel
import app.pantopus.android.ui.screens.gigs.tasks_map.TasksMapScreen
import app.pantopus.android.ui.screens.handshake.PrivacyHandshakeScreen
import app.pantopus.android.ui.screens.homes.HOME_DASHBOARD_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.HomeDashboardScreen
import app.pantopus.android.ui.screens.homes.MyHomesListScreen
import app.pantopus.android.ui.screens.homes.accesscodes.AccessCodesScreen
import app.pantopus.android.ui.screens.homes.accesscodes.EDIT_ACCESS_CODE_CATEGORY_KEY
import app.pantopus.android.ui.screens.homes.accesscodes.EDIT_ACCESS_CODE_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.accesscodes.EDIT_ACCESS_CODE_SECRET_ID_KEY
import app.pantopus.android.ui.screens.homes.accesscodes.EditAccessCodeFormScreen
import app.pantopus.android.ui.screens.homes.accesscodes.search.AccessCodesSearchScreen
import app.pantopus.android.ui.screens.homes.add_home.AddHomeWizardScreen
import app.pantopus.android.ui.screens.homes.bills.ADD_BILL_BILL_ID_KEY
import app.pantopus.android.ui.screens.homes.bills.ADD_BILL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.bills.AddBillWizardScreen
import app.pantopus.android.ui.screens.homes.bills.BILLS_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.bills.BILL_DETAIL_BILL_ID_KEY
import app.pantopus.android.ui.screens.homes.bills.BILL_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.bills.BillDetailScreen
import app.pantopus.android.ui.screens.homes.bills.BillsListScreen
import app.pantopus.android.ui.screens.homes.calendar.ADD_EVENT_EVENT_ID_KEY
import app.pantopus.android.ui.screens.homes.calendar.ADD_EVENT_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.calendar.ADD_EVENT_PREFILLED_CATEGORY_KEY
import app.pantopus.android.ui.screens.homes.calendar.AddEventCommit
import app.pantopus.android.ui.screens.homes.calendar.AddEventFormScreen
import app.pantopus.android.ui.screens.homes.calendar.EVENT_DETAIL_EVENT_ID_KEY
import app.pantopus.android.ui.screens.homes.calendar.EVENT_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.calendar.EventDetailScreen
import app.pantopus.android.ui.screens.homes.calendar.HOME_CALENDAR_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.calendar.HomeCalendarScreen
import app.pantopus.android.ui.screens.homes.claim_ownership.CLAIM_OWNERSHIP_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.claim_ownership.CLAIM_VERIFICATION_TYPE_KEY
import app.pantopus.android.ui.screens.homes.claim_ownership.ClaimOwnershipWizardScreen
import app.pantopus.android.ui.screens.homes.claim_review.HOME_CLAIM_REVIEW_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewScreen
import app.pantopus.android.ui.screens.homes.claims.MyClaimsListScreen
import app.pantopus.android.ui.screens.homes.documents.DOCUMENTS_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.documents.DOCUMENT_DETAIL_DOC_ID_KEY
import app.pantopus.android.ui.screens.homes.documents.DOCUMENT_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.documents.DocumentDetailScreen
import app.pantopus.android.ui.screens.homes.documents.DocumentSearchScreen
import app.pantopus.android.ui.screens.homes.documents.DocumentsScreen
import app.pantopus.android.ui.screens.homes.documents.UPLOAD_DOCUMENT_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.documents.UploadDocumentFormScreen
import app.pantopus.android.ui.screens.homes.emergency.ADD_EMERGENCY_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.emergency.ADD_EMERGENCY_ITEM_ID_KEY
import app.pantopus.android.ui.screens.homes.emergency.AddEmergencyInfoFormScreen
import app.pantopus.android.ui.screens.homes.emergency.EMERGENCY_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.emergency.EMERGENCY_DETAIL_ITEM_ID_KEY
import app.pantopus.android.ui.screens.homes.emergency.EMERGENCY_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.emergency.EmergencyInfoDetailScreen
import app.pantopus.android.ui.screens.homes.emergency.EmergencyInfoScreen
import app.pantopus.android.ui.screens.homes.find_home.FindHomeScreen
import app.pantopus.android.ui.screens.homes.guests.ADD_GUEST_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.guests.AddGuestFormScreen
import app.pantopus.android.ui.screens.homes.guests.GUEST_PASSES_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.guests.GuestPassesListScreen
import app.pantopus.android.ui.screens.homes.invite_owner.INVITE_OWNER_CURRENT_EMAIL_KEY
import app.pantopus.android.ui.screens.homes.invite_owner.INVITE_OWNER_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.invite_owner.InviteOwnerFormScreen
import app.pantopus.android.ui.screens.homes.issues.HOME_ISSUES_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.issues.HomeIssuesListScreen
import app.pantopus.android.ui.screens.homes.maintenance.LOG_MAINTENANCE_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.maintenance.LOG_MAINTENANCE_TASK_ID_KEY
import app.pantopus.android.ui.screens.homes.maintenance.LogMaintenanceFormScreen
import app.pantopus.android.ui.screens.homes.maintenance.MAINTENANCE_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.maintenance.MAINTENANCE_DETAIL_TASK_ID_KEY
import app.pantopus.android.ui.screens.homes.maintenance.MAINTENANCE_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.maintenance.MaintenanceDetailScreen
import app.pantopus.android.ui.screens.homes.maintenance.MaintenanceListScreen
import app.pantopus.android.ui.screens.homes.members.MEMBERS_LIST_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.members.MembersListScreen
import app.pantopus.android.ui.screens.homes.owners.OWNERS_LIST_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.owners.OwnersListScreen
import app.pantopus.android.ui.screens.homes.owners.transfer.TRANSFER_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.owners.transfer.TransferOwnershipScreen
import app.pantopus.android.ui.screens.homes.packages.LOG_PACKAGE_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.packages.LogPackageScreen
import app.pantopus.android.ui.screens.homes.packages.PACKAGES_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.packages.PACKAGE_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.packages.PACKAGE_DETAIL_PACKAGE_ID_KEY
import app.pantopus.android.ui.screens.homes.packages.PackageDetailScreen
import app.pantopus.android.ui.screens.homes.packages.PackagesListScreen
import app.pantopus.android.ui.screens.homes.pets.PETS_LIST_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.pets.PetsListScreen
import app.pantopus.android.ui.screens.homes.polls.POLLS_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.polls.POLL_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.polls.POLL_DETAIL_POLL_ID_KEY
import app.pantopus.android.ui.screens.homes.polls.PollDetailScreen
import app.pantopus.android.ui.screens.homes.polls.PollsListScreen
import app.pantopus.android.ui.screens.homes.polls.START_POLL_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.polls.StartPollFormScreen
import app.pantopus.android.ui.screens.homes.property_correction.PROPERTY_CORRECTION_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.property_correction.PropertyCorrectionScreen
import app.pantopus.android.ui.screens.homes.property_details.PropertyDetailsScreen
import app.pantopus.android.ui.screens.homes.settings.HOME_SETTINGS_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.HomeSettingsRoute
import app.pantopus.android.ui.screens.homes.settings.HomeSettingsScreen
import app.pantopus.android.ui.screens.homes.settings.cancel_claim.CANCEL_CLAIM_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.cancel_claim.CancelClaimScreen
import app.pantopus.android.ui.screens.homes.settings.leave_home.LEAVE_HOME_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.leave_home.LeaveHomeScreen
import app.pantopus.android.ui.screens.homes.settings.notifications.HomeNotificationsScreen
import app.pantopus.android.ui.screens.homes.settings.ownership_security.HOME_OWNERSHIP_SECURITY_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.ownership_security.HomeOwnershipSecurityScreen
import app.pantopus.android.ui.screens.homes.settings.photos.HomePhotosScreen
import app.pantopus.android.ui.screens.homes.settings.security.HOME_SECURITY_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.security.HomeSecurityScreen
import app.pantopus.android.ui.screens.homes.settings.trusted_neighbors.TrustedNeighborsScreen
import app.pantopus.android.ui.screens.homes.tasks.ADD_HOUSEHOLD_TASK_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.tasks.ADD_HOUSEHOLD_TASK_TASK_ID_KEY
import app.pantopus.android.ui.screens.homes.tasks.AddHouseholdTaskFormScreen
import app.pantopus.android.ui.screens.homes.tasks.HOUSEHOLD_TASKS_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.tasks.HouseholdTasksListScreen
import app.pantopus.android.ui.screens.homes.verify_landlord.VERIFY_LANDLORD_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.verify_landlord.VerifyLandlordWizardScreen
import app.pantopus.android.ui.screens.homes.verify_landlord.postcard.POSTCARD_VERIFICATION_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.verify_landlord.postcard.PostcardVerificationScreen
import app.pantopus.android.ui.screens.hub.ActionChipContent
import app.pantopus.android.ui.screens.hub.DiscoveryCardContent
import app.pantopus.android.ui.screens.hub.DiscoveryKind
import app.pantopus.android.ui.screens.hub.HubNavigationIntent
import app.pantopus.android.ui.screens.hub.HubScreen
import app.pantopus.android.ui.screens.hub.JumpBackItem
import app.pantopus.android.ui.screens.hub.PillarTile
import app.pantopus.android.ui.screens.hub.today.TodayDetailScreen
import app.pantopus.android.ui.screens.identity_center.IdentityCenterScreen
import app.pantopus.android.ui.screens.identity_center.IdentityKind
import app.pantopus.android.ui.screens.identity_center.view_as.ViewAsScreen
import app.pantopus.android.ui.screens.inbox.InboxScreen
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent
import app.pantopus.android.ui.screens.inbox.chat.ConversationRowVariant
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIDraftCard
import app.pantopus.android.ui.screens.inbox.conversation.ChatConversationChrome
import app.pantopus.android.ui.screens.inbox.conversation.ChatConversationHost
import app.pantopus.android.ui.screens.inbox.conversation.ChatConversationMode
import app.pantopus.android.ui.screens.inbox.conversation.ChatCounterparty
import app.pantopus.android.ui.screens.inbox.conversation.ChatCreatorThreadChrome
import app.pantopus.android.ui.screens.inbox.conversation.ChatCreatorThreadContext
import app.pantopus.android.ui.screens.inbox.conversation.ChatInitialTopic
import app.pantopus.android.ui.screens.inbox.conversation.ChatThreadMode
import app.pantopus.android.ui.screens.inbox.newmessage.NewMessageScreen
import app.pantopus.android.ui.screens.inbox.search.ChatSearchResult
import app.pantopus.android.ui.screens.inbox.search.ChatSearchResultKind
import app.pantopus.android.ui.screens.inbox.search.ChatSearchScreen
import app.pantopus.android.ui.screens.listing_offers.ListingOffersScreen
import app.pantopus.android.ui.screens.listings.MyListingsScreen
import app.pantopus.android.ui.screens.mailbox.community.CommunityMailScreen
import app.pantopus.android.ui.screens.mailbox.disambiguate.DISAMBIGUATE_MAIL_ID_KEY
import app.pantopus.android.ui.screens.mailbox.disambiguate.DisambiguateMailFormScreen
import app.pantopus.android.ui.screens.mailbox.earn.EarnScreen
import app.pantopus.android.ui.screens.mailbox.home_records.HomeRecordsScreen
import app.pantopus.android.ui.screens.mailbox.item_detail.MAILBOX_ITEM_DETAIL_MAIL_ID_KEY
import app.pantopus.android.ui.screens.mailbox.mail_day.MAIL_DAY_VARIANT_KEY
import app.pantopus.android.ui.screens.mailbox.mail_day.MailDayScreen
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailScreen
import app.pantopus.android.ui.screens.mailbox.mail_party.MailPartyScreen
import app.pantopus.android.ui.screens.mailbox.mail_task.MAIL_TASK_LIST_MAIL_ID_KEY
import app.pantopus.android.ui.screens.mailbox.mail_task.MAIL_TASK_LIST_NONE
import app.pantopus.android.ui.screens.mailbox.mail_task.MAIL_TASK_LIST_SENDER_KEY
import app.pantopus.android.ui.screens.mailbox.mail_task.MAIL_TASK_LIST_SUBJECT_KEY
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskListScreen
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskScreen
import app.pantopus.android.ui.screens.mailbox.mailbox_map.MailboxMapScreen
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailboxRootScreen
import app.pantopus.android.ui.screens.mailbox.package_gig.PACKAGE_GIG_MAIL_ID_KEY
import app.pantopus.android.ui.screens.mailbox.package_gig.PACKAGE_GIG_MAIL_ID_NONE
import app.pantopus.android.ui.screens.mailbox.package_gig.PACKAGE_GIG_MODE_KEY
import app.pantopus.android.ui.screens.mailbox.package_gig.PACKAGE_GIG_MODE_POST
import app.pantopus.android.ui.screens.mailbox.package_gig.PACKAGE_GIG_MODE_PRE
import app.pantopus.android.ui.screens.mailbox.package_gig.PackageGigScreen
import app.pantopus.android.ui.screens.mailbox.routing_queue.MailRoutingQueueScreen
import app.pantopus.android.ui.screens.mailbox.search.MailboxSearchScreen
import app.pantopus.android.ui.screens.mailbox.stamps.StampsScreen
import app.pantopus.android.ui.screens.mailbox.translation.MailTranslationScreen
import app.pantopus.android.ui.screens.mailbox.unboxing.UNBOXING_MAIL_ID_KEY
import app.pantopus.android.ui.screens.mailbox.unboxing.UNBOXING_MAIL_ID_NONE
import app.pantopus.android.ui.screens.mailbox.unboxing.UnboxingScreen
import app.pantopus.android.ui.screens.mailbox.vacation.VacationHoldScreen
import app.pantopus.android.ui.screens.mailbox.vault.VaultListScreen
import app.pantopus.android.ui.screens.marketplace.MarketplaceScreen
import app.pantopus.android.ui.screens.membership.MembershipDetailScreen
import app.pantopus.android.ui.screens.my_bids.MyBidsScreen
import app.pantopus.android.ui.screens.my_posts.MyPostsScreen
import app.pantopus.android.ui.screens.my_tasks.MyTasksScreen
import app.pantopus.android.ui.screens.notifications.NotificationsScreen
import app.pantopus.android.ui.screens.notifications.NotificationsZone
import app.pantopus.android.ui.screens.offers.OffersScreen
import app.pantopus.android.ui.screens.persona_dm.FanInboxScreen
import app.pantopus.android.ui.screens.persona_dm.PersonaDmThreadScreen
import app.pantopus.android.ui.screens.place.HomeLanding
import app.pantopus.android.ui.screens.place.HomeTabHostViewModel
import app.pantopus.android.ui.screens.place.PLACE_DASHBOARD_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.PlaceDashboardScreen
import app.pantopus.android.ui.screens.place.detail.PLACE_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.detail.PLACE_DETAIL_SLUG_KEY
import app.pantopus.android.ui.screens.place.detail.PlaceDetailScreen
import app.pantopus.android.ui.screens.place.messaging.NEIGHBOR_COMPOSE_ADDRESS_KEY
import app.pantopus.android.ui.screens.place.messaging.NEIGHBOR_COMPOSE_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.messaging.NEIGHBOR_MESSAGE_ID_KEY
import app.pantopus.android.ui.screens.place.messaging.NeighborMessageComposeScreen
import app.pantopus.android.ui.screens.place.messaging.NeighborMessageInboxScreen
import app.pantopus.android.ui.screens.place.messaging.NeighborMessageReceivedScreen
import app.pantopus.android.ui.screens.place.pulse.PLACE_PULSE_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.pulse.PlacePulseScreen
import app.pantopus.android.ui.screens.place.verify.PLACE_VERIFY_ADDRESS_KEY
import app.pantopus.android.ui.screens.place.verify.PLACE_VERIFY_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.verify.PLACE_VERIFY_METHOD_KEY
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyMethod
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyStatusScreen
import app.pantopus.android.ui.screens.posts.PULSE_POST_DETAIL_ID_KEY
import app.pantopus.android.ui.screens.posts.PulsePostDetailScreen
import app.pantopus.android.ui.screens.profile.EditProfileScreen
import app.pantopus.android.ui.screens.profile.PUBLIC_PROFILE_USER_ID_KEY
import app.pantopus.android.ui.screens.profile.PublicProfileScreen
import app.pantopus.android.ui.screens.profile.professional.ProfessionalProfileScreen
import app.pantopus.android.ui.screens.recent_activity.RecentActivityDestination
import app.pantopus.android.ui.screens.recent_activity.RecentActivityScreen
import app.pantopus.android.ui.screens.review_claims.ReviewClaimDetailScreen
import app.pantopus.android.ui.screens.review_claims.ReviewClaimsScreen
import app.pantopus.android.ui.screens.review_signups.ReviewSignupsScreen
import app.pantopus.android.ui.screens.saved_places.SavedPlacesScreen
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling.automations.MessageTemplateEditorScreen
import app.pantopus.android.ui.screens.scheduling.automations.RemindersQuickSetupScreen
import app.pantopus.android.ui.screens.scheduling.automations.TemplateLibraryScreen
import app.pantopus.android.ui.screens.scheduling.automations.WorkflowEditorScreen
import app.pantopus.android.ui.screens.scheduling.automations.WorkflowsListScreen
import app.pantopus.android.ui.screens.scheduling.availability.AvailabilityListScreen
import app.pantopus.android.ui.screens.scheduling.availability.BlockOffTimeScreen
import app.pantopus.android.ui.screens.scheduling.availability.BookingLimitsScreen
import app.pantopus.android.ui.screens.scheduling.availability.DateOverridesScreen
import app.pantopus.android.ui.screens.scheduling.availability.WeeklyHoursEditorScreen
import app.pantopus.android.ui.screens.scheduling.bookingpage.BookingPageManageScreen
import app.pantopus.android.ui.screens.scheduling.bookingpage.OneOffLinkGeneratorScreen
import app.pantopus.android.ui.screens.scheduling.bookingpage.PublicPagePreviewScreen
import app.pantopus.android.ui.screens.scheduling.bookings.BookingDetailScreen
import app.pantopus.android.ui.screens.scheduling.bookings.BookingsInboxScreen
import app.pantopus.android.ui.screens.scheduling.bookings_extra.BookingSearchFilterScreen
import app.pantopus.android.ui.screens.scheduling.bookings_extra.GroupRosterScreen
import app.pantopus.android.ui.screens.scheduling.bookings_extra.ManualBookingScreen
import app.pantopus.android.ui.screens.scheduling.bookings_extra.PostMeetingFollowupScreen
import app.pantopus.android.ui.screens.scheduling.bookings_extra.WaitlistScreen
import app.pantopus.android.ui.screens.scheduling.business.BusinessSchedulingSettingsScreen
import app.pantopus.android.ui.screens.scheduling.business.CollectiveEventSetupScreen
import app.pantopus.android.ui.screens.scheduling.business.MemberWorkingHoursScreen
import app.pantopus.android.ui.screens.scheduling.business.TeamBookingAvailabilityScreen
import app.pantopus.android.ui.screens.scheduling.eventtypes.ConnectedCalendarsScreen
import app.pantopus.android.ui.screens.scheduling.eventtypes.EventTypeEditorScreen
import app.pantopus.android.ui.screens.scheduling.eventtypes.EventTypeListScreen
import app.pantopus.android.ui.screens.scheduling.eventtypes.IntakeQuestionsEditorScreen
import app.pantopus.android.ui.screens.scheduling.findatime.FindATimeSetupScreen
import app.pantopus.android.ui.screens.scheduling.findatime.MemberPollResponseScreen
import app.pantopus.android.ui.screens.scheduling.findatime.SuggestedSlotsScreen
import app.pantopus.android.ui.screens.scheduling.findatime.WhosFreeScreen
import app.pantopus.android.ui.screens.scheduling.home.HouseholdAvailabilityScreen
import app.pantopus.android.ui.screens.scheduling.home.PermissionGatedSchedulerScreen
import app.pantopus.android.ui.screens.scheduling.hub.SchedulingHubScreen
import app.pantopus.android.ui.screens.scheduling.insights.EventTypePerformanceScreen
import app.pantopus.android.ui.screens.scheduling.insights.InsightsDashboardScreen
import app.pantopus.android.ui.screens.scheduling.insights.NoShowReportScreen
import app.pantopus.android.ui.screens.scheduling.insights.TeamPerformanceScreen
import app.pantopus.android.ui.screens.scheduling.invitee.confirm.ManageBookingScreen
import app.pantopus.android.ui.screens.scheduling.invitee.customer.MyBookingsScreen
import app.pantopus.android.ui.screens.scheduling.invitee.customer.RecurringSetupScreen
import app.pantopus.android.ui.screens.scheduling.invitee.discovery.BookerLandingScreen
import app.pantopus.android.ui.screens.scheduling.invitee.edge.OpenInAppInterstitialScreen
import app.pantopus.android.ui.screens.scheduling.invoices.InvoicesListScreen
import app.pantopus.android.ui.screens.scheduling.packages.BuyPackageScreen
import app.pantopus.android.ui.screens.scheduling.packages.MyPackagesScreen
import app.pantopus.android.ui.screens.scheduling.packages.PackageEditorScreen
import app.pantopus.android.ui.screens.scheduling.payments.CancellationRefundPolicyScreen
import app.pantopus.android.ui.screens.scheduling.polish.NotificationPermissionPromptScreen
import app.pantopus.android.ui.screens.scheduling.resources.BookResourceScreen
import app.pantopus.android.ui.screens.scheduling.resources.ResourceDetailScreen
import app.pantopus.android.ui.screens.scheduling.resources.ResourceEditorScreen
import app.pantopus.android.ui.screens.scheduling.resources.ResourceListScreen
import app.pantopus.android.ui.screens.scheduling.settings.NotificationPrefsScreen
import app.pantopus.android.ui.screens.scheduling.settings.SchedulingSettingsRootScreen
import app.pantopus.android.ui.screens.scheduling.setup.FirstRunWizardScreen
import app.pantopus.android.ui.screens.scheduling.setup.OnboardingHomeBusinessScreen
import app.pantopus.android.ui.screens.scheduling.visits.VisitDetailScreen
import app.pantopus.android.ui.screens.scheduling.visits.VisitSetupScreen
import app.pantopus.android.ui.screens.settings.NotificationSettingsScreen
import app.pantopus.android.ui.screens.settings.PrivacySettingsScreen
import app.pantopus.android.ui.screens.settings.SettingsIndexScreen
import app.pantopus.android.ui.screens.settings.SettingsRoute
import app.pantopus.android.ui.screens.settings.about.AboutScreen
import app.pantopus.android.ui.screens.settings.blocks.BlockedUsersScreen
import app.pantopus.android.ui.screens.settings.data_export.DataExportScreen
import app.pantopus.android.ui.screens.settings.help.HelpCenterScreen
import app.pantopus.android.ui.screens.settings.legal.LegalContentScreen
import app.pantopus.android.ui.screens.settings.legal.LegalDocument
import app.pantopus.android.ui.screens.settings.legal.LegalEmptyState
import app.pantopus.android.ui.screens.settings.legal.LegalIndexScreen
import app.pantopus.android.ui.screens.settings.password.PasswordChangeScreen
import app.pantopus.android.ui.screens.settings.payments.PaymentsScreen
import app.pantopus.android.ui.screens.settings.security.DevicesScreen
import app.pantopus.android.ui.screens.settings.verification.VerificationCenterScreen
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.screens.status.StatusWaitingScreen
import app.pantopus.android.ui.screens.status.waiting_room.WaitingRoomNav
import app.pantopus.android.ui.screens.status.waiting_room.WaitingRoomRoute
import app.pantopus.android.ui.screens.support_trains.SupportTrainsScreen
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainDetailActions
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainDetailScreen
import app.pantopus.android.ui.screens.support_trains.edit_signup.EditSignupFormScreen
import app.pantopus.android.ui.screens.support_trains.manage.ManageTrainScreen
import app.pantopus.android.ui.screens.support_trains.search.SupportTrainsSearchScreen
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainWizardScreen
import app.pantopus.android.ui.screens.token_accept.TokenAcceptScreen
import app.pantopus.android.ui.screens.universal_search.UniversalSearchDestination
import app.pantopus.android.ui.screens.universal_search.UniversalSearchScreen
import app.pantopus.android.ui.screens.wallet.WalletActivityListScreen
import app.pantopus.android.ui.screens.wallet.WalletScreen
import app.pantopus.android.ui.screens.wallet.scheduling.PaymentsSetupScreen
import app.pantopus.android.ui.screens.wallet.scheduling.PayoutsEarningsScreen
import app.pantopus.android.ui.screens.you.YouScreen
import app.pantopus.android.ui.theme.PantopusIcon
import kotlinx.coroutines.launch
import app.pantopus.android.ui.screens.scheduling.invoices.InvoiceDetailScreen as SchedulingInvoiceDetailScreen
import app.pantopus.android.ui.screens.scheduling.packages.PackagesListScreen as SchedulingPackagesListScreen

/** Non-tab routes reachable from within the Hub stack. */
private object ChildRoutes {
    const val MY_HOMES = "homes/my-homes"
    const val MY_CLAIMS = "homes/my-claims"
    const val ADD_HOME = "homes/add"

    /**
     * A12.1 — "Find or Add Home" discovery. Search public-preview homes,
     * start a claim on one, add a missing address, or paste an invite
     * code. Mirrors RN `src/app/homes/find.tsx`.
     */
    const val FIND_HOME = "homes/find"

    /** Legacy waitlist route — redirects to [CREATE_BUSINESS]. */
    const val BUSINESS_WAITLIST = "businesses/waitlist"

    /** A12.10 — Create Business wizard route. */
    const val CREATE_BUSINESS = "businesses/new"
    const val CLAIM_OWNERSHIP = "homes/{$CLAIM_OWNERSHIP_HOME_ID_KEY}/claim"

    /** Residency-verification variant of the evidence wizard. */
    const val VERIFY_RESIDENCY = "homes/{$CLAIM_OWNERSHIP_HOME_ID_KEY}/verify-residency"

    /** Per-home issue tracker (`HomeIssue`) — distinct from maintenance. */
    const val HOME_ISSUES = "homes/{$HOME_ISSUES_HOME_ID_KEY}/issues"

    /** A12.5 / A12.6 — Verify landlord wizard. Pushed from the home
     *  dashboard's ownership-claim CTA when the home record marks
     *  the resident as a renter, or directly via the
     *  `pantopus://homes/:id/verify-landlord` deep link. */
    const val VERIFY_LANDLORD = "homes/{$VERIFY_LANDLORD_HOME_ID_KEY}/verify-landlord"

    /** A12.7 — Postcard verification sibling status screen. */
    const val POSTCARD_VERIFICATION =
        "homes/{$POSTCARD_VERIFICATION_HOME_ID_KEY}/verify-postcard"
    const val MAILBOX_SEARCH = "mailbox/search"
    const val MAILBOX_ITEM_DETAIL = "mailbox/item/{$MAILBOX_ITEM_DETAIL_MAIL_ID_KEY}"

    /** T6.5e (P19.5) — Mailbox Vault list. Personal pillar. */
    const val MAILBOX_VAULT = "mailbox/vault"
    const val HOME_DASHBOARD = "homes/{$HOME_DASHBOARD_HOME_ID_KEY}"

    /**
     * W3 — Place Intelligence dashboard for a home. The Home tab
     * auto-navigates here when the user has a primary home; the switcher
     * re-pushes it for another home.
     */
    const val PLACE_DASHBOARD = "place/{$PLACE_DASHBOARD_HOME_ID_KEY}"

    fun placeDashboard(homeId: String): String = "place/$homeId"

    /** W4 — a Place group-detail page (today / your-home / risk / …). */
    const val PLACE_DETAIL = "place/{$PLACE_DETAIL_HOME_ID_KEY}/detail/{$PLACE_DETAIL_SLUG_KEY}"

    fun placeDetail(
        homeId: String,
        slug: String,
    ): String = "place/$homeId/detail/$slug"

    /** W4 — the full Today's Pulse signal stream. */
    const val PLACE_PULSE = "place/{$PLACE_PULSE_HOME_ID_KEY}/pulse"

    fun placePulse(homeId: String): String = "place/$homeId/pulse"

    /** W5 — the verify status screen (B2 → B3/B4) after a method choice. */
    const val PLACE_VERIFY_STATUS =
        "place/{$PLACE_VERIFY_HOME_ID_KEY}/verify/{$PLACE_VERIFY_METHOD_KEY}" +
            "?$PLACE_VERIFY_ADDRESS_KEY={$PLACE_VERIFY_ADDRESS_KEY}"

    fun placeVerifyStatus(
        homeId: String,
        method: String,
        address: String,
    ): String = "place/$homeId/verify/$method?$PLACE_VERIFY_ADDRESS_KEY=${java.net.URLEncoder.encode(address, "UTF-8")}"

    /** W7 D1 — compose a verified-neighbor heads-up (carries the address). */
    const val NEIGHBOR_COMPOSE =
        "place/{$NEIGHBOR_COMPOSE_HOME_ID_KEY}/message?$NEIGHBOR_COMPOSE_ADDRESS_KEY={$NEIGHBOR_COMPOSE_ADDRESS_KEY}"

    fun neighborCompose(
        homeId: String,
        address: String,
    ): String = "place/$homeId/message?$NEIGHBOR_COMPOSE_ADDRESS_KEY=${java.net.URLEncoder.encode(address, "UTF-8")}"

    /** W7 — the verified-neighbor inbox list. */
    const val NEIGHBOR_INBOX = "place/neighbor-inbox"

    /** W7 D2 — a single received verified-neighbor message. */
    const val NEIGHBOR_MESSAGE = "place/neighbor-message/{$NEIGHBOR_MESSAGE_ID_KEY}"

    fun neighborMessage(messageId: String): String = "place/neighbor-message/$messageId"

    /** Bills list (T5.2.2 / P13). */
    const val HOME_BILLS = "homes/{$BILLS_HOME_ID_KEY}/bills"

    /** Bill detail (read-mostly summary, mark-paid / remove). */
    const val BILL_DETAIL =
        "homes/{$BILL_DETAIL_HOME_ID_KEY}/bills/{$BILL_DETAIL_BILL_ID_KEY}"

    /** Add Bill wizard. */
    const val ADD_BILL = "homes/{$ADD_BILL_HOME_ID_KEY}/bills/new"

    /** Edit Bill wizard — same screen, hydrated from the existing row.
     *  The VM reads the bill id from its `SavedStateHandle`. */
    const val EDIT_BILL =
        "homes/{$ADD_BILL_HOME_ID_KEY}/bills/{$ADD_BILL_BILL_ID_KEY}/edit"

    /** Pets list per home (T5.2.1). */
    const val HOME_PETS = "homes/{$PETS_LIST_HOME_ID_KEY}/pets"

    /** Build the concrete path for a home pets list. */
    fun homePets(homeId: String): String = "homes/$homeId/pets"

    /** Home calendar per home (T6.4c / P18). */
    const val HOME_CALENDAR = "homes/{$HOME_CALENDAR_HOME_ID_KEY}/calendar"

    /** Build the concrete path for a home calendar. */
    fun homeCalendar(homeId: String): String = "homes/$homeId/calendar"

    /**
     * P2.7 — Add / edit calendar event form. Optional query params carry
     * the editing event id and a prefilled category when arriving from
     * the empty-state quick-start tiles.
     */
    const val ADD_CALENDAR_EVENT =
        "homes/{$ADD_EVENT_HOME_ID_KEY}/events/new" +
            "?$ADD_EVENT_EVENT_ID_KEY={$ADD_EVENT_EVENT_ID_KEY}" +
            "&$ADD_EVENT_PREFILLED_CATEGORY_KEY={$ADD_EVENT_PREFILLED_CATEGORY_KEY}"

    /** Build the concrete path for the calendar event form. */
    fun addCalendarEvent(
        homeId: String,
        eventId: String? = null,
        prefilledCategory: String? = null,
    ): String {
        val base = "homes/$homeId/events/new"
        val params =
            buildList {
                if (eventId != null) add("$ADD_EVENT_EVENT_ID_KEY=${java.net.URLEncoder.encode(eventId, "UTF-8")}")
                if (prefilledCategory != null) {
                    add(
                        "$ADD_EVENT_PREFILLED_CATEGORY_KEY=" +
                            java.net.URLEncoder.encode(prefilledCategory, "UTF-8"),
                    )
                }
            }
        return if (params.isEmpty()) base else "$base?${params.joinToString("&")}"
    }

    /** P2.7 — Read-only calendar event detail. */
    const val CALENDAR_EVENT_DETAIL =
        "homes/{$EVENT_DETAIL_HOME_ID_KEY}/events/{$EVENT_DETAIL_EVENT_ID_KEY}"

    /** Build the concrete path for a calendar event detail. */
    fun calendarEventDetail(
        homeId: String,
        eventId: String,
    ): String = "homes/$homeId/events/$eventId"

    /** Emergency info per home (T6.4b / P17). */
    const val HOME_EMERGENCY = "homes/{$EMERGENCY_HOME_ID_KEY}/emergency"

    /** Build the concrete path for a home emergency info screen. */
    fun homeEmergency(homeId: String): String = "homes/$homeId/emergency"

    /** Add Emergency Info form (P2.8). */
    const val ADD_EMERGENCY_INFO =
        "homes/{$ADD_EMERGENCY_HOME_ID_KEY}/emergency/new"

    /** Build the concrete path for the Add Emergency Info form. */
    fun addEmergencyInfo(homeId: String): String = "homes/$homeId/emergency/new"

    /** Edit Emergency Info form (P2.8). The form's VM reads the
     *  emergencyId from SavedStateHandle and seeds itself from the
     *  parent list. */
    const val EDIT_EMERGENCY_INFO =
        "homes/{$ADD_EMERGENCY_HOME_ID_KEY}/emergency/{$ADD_EMERGENCY_ITEM_ID_KEY}/edit"

    /** Build the concrete path for the Edit Emergency Info form. */
    fun editEmergencyInfo(
        homeId: String,
        emergencyId: String,
    ): String = "homes/$homeId/emergency/$emergencyId/edit"

    /** Emergency item detail (P2.8). */
    const val EMERGENCY_ITEM =
        "homes/{$EMERGENCY_DETAIL_HOME_ID_KEY}/emergency/{$EMERGENCY_DETAIL_ITEM_ID_KEY}"

    /** Build the concrete path for an emergency item detail. */
    fun emergencyItem(
        homeId: String,
        emergencyId: String,
    ): String = "homes/$homeId/emergency/$emergencyId"

    /** Documents per home (T6.4b / P17). */
    const val HOME_DOCS = "homes/{$DOCUMENTS_HOME_ID_KEY}/docs"

    /** Build the concrete path for a home documents screen. */
    fun homeDocs(homeId: String): String = "homes/$homeId/docs"

    /** P2.10 — Upload document form for a home. */
    const val UPLOAD_DOCUMENT = "homes/{$UPLOAD_DOCUMENT_HOME_ID_KEY}/docs/new"

    /** Build the concrete path for the upload document form. */
    fun uploadDocument(homeId: String): String = "homes/$homeId/docs/new"

    /** P2.10 — Document detail (preview + metadata + footer actions). */
    const val DOCUMENT_DETAIL =
        "homes/{$DOCUMENT_DETAIL_HOME_ID_KEY}/docs/{$DOCUMENT_DETAIL_DOC_ID_KEY}"

    /** Build the concrete path for the document detail screen. */
    fun documentDetail(
        homeId: String,
        documentId: String,
    ): String = "homes/$homeId/docs/$documentId"

    /** P4.5 — Document Search surface (title / tags / category). */
    const val DOCUMENT_SEARCH = "homes/{$DOCUMENTS_HOME_ID_KEY}/docs/search"

    /** Build the concrete path for the document search screen. */
    fun documentSearch(homeId: String): String = "homes/$homeId/docs/search"

    /** Packages list per home (T6.3d / P14). */
    const val HOME_PACKAGES = "homes/{$PACKAGES_HOME_ID_KEY}/packages"

    /** Package detail (read-mostly summary, mark-picked-up / remove). */
    const val PACKAGE_DETAIL =
        "homes/{$PACKAGE_DETAIL_HOME_ID_KEY}/packages/{$PACKAGE_DETAIL_PACKAGE_ID_KEY}"

    /** Log a package — single-page form (T6.3d). */
    const val LOG_PACKAGE = "homes/{$LOG_PACKAGE_HOME_ID_KEY}/packages/new"

    /** Build the concrete path for a home packages list. */
    fun homePackages(homeId: String): String = "homes/$homeId/packages"

    /** Build the concrete path for a package detail. */
    fun packageDetail(
        homeId: String,
        packageId: String,
    ): String = "homes/$homeId/packages/$packageId"

    /** Build the concrete path for the Log Package form. */
    fun logPackage(homeId: String): String = "homes/$homeId/packages/new"

    /** Polls list per home (T6.3e / P13). */
    const val HOME_POLLS = "homes/{$POLLS_HOME_ID_KEY}/polls"

    /** Poll detail (T6.3e / P13). */
    const val POLL_DETAIL = "homes/{$POLL_DETAIL_HOME_ID_KEY}/polls/{$POLL_DETAIL_POLL_ID_KEY}"

    /** Build the concrete path for a home polls list. */
    fun homePolls(homeId: String): String = "homes/$homeId/polls"

    /** Build the concrete path for a poll detail. */
    fun pollDetail(
        homeId: String,
        pollId: String,
    ): String = "homes/$homeId/polls/$pollId"

    /** Start-a-poll composer (P2.5). */
    const val START_POLL = "homes/{$START_POLL_HOME_ID_KEY}/polls/new"

    /** Build the concrete path for the Start-a-Poll form. */
    fun startPoll(homeId: String): String = "homes/$homeId/polls/new"

    /** Access codes per home (T6.4a). `homeName` rides as a query so the
     *  designed 2-line top bar can render without a second fetch. */
    const val ACCESS_CODES_HOME_ID_KEY = "homeId"
    const val ACCESS_CODES_HOME_NAME_KEY = "homeName"
    const val ACCESS_CODES =
        "homes/{$ACCESS_CODES_HOME_ID_KEY}/access?$ACCESS_CODES_HOME_NAME_KEY={$ACCESS_CODES_HOME_NAME_KEY}"

    /** Build the concrete path for the access codes screen. */
    fun accessCodes(
        homeId: String,
        homeName: String?,
    ): String {
        val encoded = homeName?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        return "homes/$homeId/access?$ACCESS_CODES_HOME_NAME_KEY=$encoded"
    }

    /**
     * Add / Edit access code form (P3.1). `secretId` set ⇒ edit
     * existing. `category` pre-selects the matching tile when reached
     * from the empty-state quick-starts. Both optional via the query
     * string.
     */
    const val EDIT_ACCESS_CODE =
        "homes/{$EDIT_ACCESS_CODE_HOME_ID_KEY}/access/edit" +
            "?$EDIT_ACCESS_CODE_SECRET_ID_KEY={$EDIT_ACCESS_CODE_SECRET_ID_KEY}" +
            "&$EDIT_ACCESS_CODE_CATEGORY_KEY={$EDIT_ACCESS_CODE_CATEGORY_KEY}"

    /** Build the concrete path for the Add / Edit access code form. */
    fun editAccessCode(
        homeId: String,
        secretId: String?,
        category: String?,
    ): String {
        val encodedSecret = secretId?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        val encodedCategory = category?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        return "homes/$homeId/access/edit" +
            "?$EDIT_ACCESS_CODE_SECRET_ID_KEY=$encodedSecret" +
            "&$EDIT_ACCESS_CODE_CATEGORY_KEY=$encodedCategory"
    }

    /** P4.6 — Access codes search. Reuses the shared SearchListShell.
     *  `homeId` scopes the corpus to one home and matches
     *  `AccessCodesSearchViewModel.HOME_ID_KEY`. */
    const val ACCESS_CODES_SEARCH = "homes/{$ACCESS_CODES_HOME_ID_KEY}/access/search"

    /** Build the concrete path for the Access codes search screen. */
    fun accessCodesSearch(homeId: String): String = "homes/$homeId/access/search"

    /** Household tasks list per home (T6.3c / P11). */
    const val HOME_TASKS = "homes/{$HOUSEHOLD_TASKS_HOME_ID_KEY}/tasks"

    /** Build the concrete path for a home household tasks list. */
    fun homeTasks(homeId: String): String = "homes/$homeId/tasks"

    /** P2.4 — Add a new household task. Reached from the household
     *  tasks list FAB and the empty-state CTA. */
    const val ADD_HOUSEHOLD_TASK = "homes/{$ADD_HOUSEHOLD_TASK_HOME_ID_KEY}/tasks/new"

    /** Build the concrete path for the Add Household Task form. */
    fun addHouseholdTask(homeId: String): String = "homes/$homeId/tasks/new"

    /** P2.4 — Edit an existing household task. Reached from the
     *  "Edit recurring" overflow action on a Recurring row. */
    const val EDIT_HOUSEHOLD_TASK =
        "homes/{$ADD_HOUSEHOLD_TASK_HOME_ID_KEY}/tasks/{$ADD_HOUSEHOLD_TASK_TASK_ID_KEY}/edit"

    /** Build the concrete path for the Edit Household Task form. */
    fun editHouseholdTask(
        homeId: String,
        taskId: String,
    ): String = "homes/$homeId/tasks/$taskId/edit"

    /** Maintenance list per home (T6.3b / P10). */
    const val HOME_MAINTENANCE = "homes/{$MAINTENANCE_HOME_ID_KEY}/maintenance"

    /** Build the concrete path for a home maintenance list. */
    fun homeMaintenance(homeId: String): String = "homes/$homeId/maintenance"

    /** P2.9 — Log a new maintenance entry. */
    const val LOG_MAINTENANCE = "homes/{$LOG_MAINTENANCE_HOME_ID_KEY}/maintenance/new"

    /** Build the concrete path for the log-maintenance form. */
    fun logMaintenance(homeId: String): String = "homes/$homeId/maintenance/new"

    /** P2.9 — Edit an existing maintenance entry. */
    const val EDIT_MAINTENANCE =
        "homes/{$LOG_MAINTENANCE_HOME_ID_KEY}/maintenance/{$LOG_MAINTENANCE_TASK_ID_KEY}/edit"

    /** Build the concrete path for the edit-maintenance form. */
    fun editMaintenance(
        homeId: String,
        taskId: String,
    ): String = "homes/$homeId/maintenance/$taskId/edit"

    /** P2.9 — Maintenance detail surface. */
    const val MAINTENANCE_DETAIL =
        "homes/{$MAINTENANCE_DETAIL_HOME_ID_KEY}/maintenance/{$MAINTENANCE_DETAIL_TASK_ID_KEY}"

    /** Build the concrete path for the maintenance detail screen. */
    fun maintenanceDetail(
        homeId: String,
        taskId: String,
    ): String = "homes/$homeId/maintenance/$taskId"

    /** Owners list per home (P15 / T6.3g). The Owners VM pulls the
     *  viewer's id from [AuthRepository] internally, so no extra arg
     *  needs to ride on the route. */
    const val HOME_OWNERS = "homes/{$OWNERS_LIST_HOME_ID_KEY}/owners"

    /** Build the concrete path for a home owners list. */
    fun homeOwners(homeId: String): String = "homes/$homeId/owners"

    /** H6 — per-home **owner** claim review (ownership + residency
     *  claims on this home). Distinct from the admin `review-claims`
     *  queue mounted elsewhere in this file. */
    const val HOME_CLAIM_REVIEW = "homes/{$HOME_CLAIM_REVIEW_HOME_ID_KEY}/owners/review-claims"

    /** Build the concrete path for the per-home claim-review screen. */
    fun homeClaimReview(homeId: String): String = "homes/$homeId/owners/review-claims"

    /** Members list per home (T6.3a / P9). */
    const val HOME_MEMBERS = "homes/{$MEMBERS_LIST_HOME_ID_KEY}/members"

    /** Build the concrete path for a home members list. */
    fun homeMembers(homeId: String): String = "homes/$homeId/members"

    /** A14.1 (P5.1) — Per-home Settings index. */
    const val HOME_SETTINGS = "homes/{$HOME_SETTINGS_HOME_ID_KEY}/settings"

    /** Build the concrete path for the per-home Settings index. */
    fun homeSettings(homeId: String): String = "homes/$homeId/settings"

    /** A14.2 (P5.1) — Per-home Security toggles. */
    const val HOME_SECURITY = "homes/{$HOME_SECURITY_HOME_ID_KEY}/settings/security"

    /** Build the concrete path for the per-home Security screen. */
    fun homeSecurity(homeId: String): String = "homes/$homeId/settings/security"

    /** A14.2 (policy variant) — per-home ownership security policy. */
    const val HOME_OWNERSHIP_SECURITY =
        "homes/{$HOME_OWNERSHIP_SECURITY_HOME_ID_KEY}/settings/ownership-security"

    /** Build the concrete path for the per-home Ownership & Security screen. */
    fun homeOwnershipSecurity(homeId: String): String = "homes/$homeId/settings/ownership-security"

    const val LEAVE_HOME = "homes/{$LEAVE_HOME_HOME_ID_KEY}/settings/leave"

    fun leaveHome(homeId: String): String = "homes/$homeId/settings/leave"

    const val CANCEL_CLAIM = "homes/{$CANCEL_CLAIM_HOME_ID_KEY}/settings/cancel-claim"

    fun cancelClaim(homeId: String): String = "homes/$homeId/settings/cancel-claim"

    const val HOME_PHOTOS = "homes/{$HOME_SETTINGS_HOME_ID_KEY}/settings/photos"

    fun homePhotos(homeId: String): String = "homes/$homeId/settings/photos"

    const val TRUSTED_NEIGHBORS = "homes/{$HOME_SETTINGS_HOME_ID_KEY}/settings/trusted-neighbors"

    fun trustedNeighbors(homeId: String): String = "homes/$homeId/settings/trusted-neighbors"

    const val HOME_NOTIFICATIONS = "homes/{$HOME_SETTINGS_HOME_ID_KEY}/settings/notifications"

    fun homeNotifications(homeId: String): String = "homes/$homeId/settings/notifications"

    const val PROPERTY_CORRECTION = "homes/{$PROPERTY_CORRECTION_HOME_ID_KEY}/property/correction"

    fun propertyCorrection(homeId: String): String = "homes/$homeId/property/correction"

    const val PUBLIC_PROFILE = "users/{$PUBLIC_PROFILE_USER_ID_KEY}"

    /** P1.6 — Typed Business **public** profile screen (A10.6). `businessId`
     *  is the business User UUID. Lives at the singular `business/{id}` so the
     *  plural `businesses/{id}` is free for the A10.7 owner view (B1.6). */
    const val BUSINESS_PROFILE = "business/{$BUSINESS_PROFILE_BUSINESS_ID_KEY}"

    /** Build the concrete path for a Business Profile. */
    fun businessProfile(businessId: String): String = "business/$businessId"

    /** P4.2 — A13.10 Edit Business Page (owner-only). Pushed from the
     *  `BusinessProfileScreen` overflow when `viewerIsOwner` is true,
     *  and from the `pantopus://businesses/:id/page-editor` deep link. */
    const val EDIT_BUSINESS_PAGE = "businesses/{$EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY}/page-editor"

    /** Build the concrete path for the Edit Business Page editor. */
    fun editBusinessPage(businessId: String): String = "businesses/$businessId/page-editor"

    /** C4 — the custom Pages CMS index (create / delete / revision history).
     *  Distinct from [EDIT_BUSINESS_PAGE], which edits business profile fields. */
    const val BUSINESS_PAGES = "businesses/{$BUSINESS_PAGES_BUSINESS_ID_KEY}/pages"

    fun businessPages(businessId: String): String = "businesses/$businessId/pages"

    /** C4 — the block builder for one custom page. */
    const val BUSINESS_PAGE_BLOCKS =
        "businesses/{$PAGE_BLOCKS_BUSINESS_ID_KEY}/pages/{$PAGE_BLOCKS_PAGE_ID_KEY}/blocks" +
            "?pageTitle={$PAGE_BLOCKS_PAGE_TITLE_KEY}"

    fun businessPageBlocks(
        businessId: String,
        pageId: String,
        pageTitle: String,
    ): String = "businesses/$businessId/pages/$pageId/blocks?pageTitle=${Uri.encode(pageTitle)}"

    /** C4 — the public profile opened on a named custom page, reached from
     *  `pantopus://b/:username/:slug`. */
    const val BUSINESS_PROFILE_PAGE =
        "business/{$BUSINESS_PROFILE_BUSINESS_ID_KEY}/page/{$BUSINESS_PROFILE_PAGE_SLUG_KEY}"

    fun businessProfilePage(
        businessId: String,
        pageSlug: String,
    ): String = "business/$businessId/page/${Uri.encode(pageSlug)}"

    const val PULSE_POST = "posts/{$PULSE_POST_DETAIL_ID_KEY}"

    const val INVITE_OWNER =
        "homes/{$INVITE_OWNER_HOME_ID_KEY}/invite?email={$INVITE_OWNER_CURRENT_EMAIL_KEY}"
    const val DISAMBIGUATE_MAIL = "mailbox/disambiguate/{$DISAMBIGUATE_MAIL_ID_KEY}"

    /** Mail routing queue — the disambiguation lane behind the Mailbox
     *  root's "N items need routing" banner. Walks
     *  `GET /api/mailbox/v2/pending` and resolves each row. */
    const val MAIL_ROUTING_QUEUE = "mailbox/routing-queue"

    /** Notifications center (T4.1). Reached from the Hub bell icon. */
    const val NOTIFICATIONS = "notifications"

    /**
     * S5 — the same screen with the optional identity-firewall zone arg.
     * The NavHost registers this pattern, so a plain `NOTIFICATIONS`
     * navigate still matches with `context == null`. The Hub megaphone
     * navigates with `context=audience` so the Beacon stream opens
     * directly (RN `?context=audience`).
     */
    const val NOTIFICATIONS_ROUTE = "notifications?context={context}"

    /** Query-arg key for [NOTIFICATIONS_ROUTE]. */
    const val NOTIFICATIONS_CONTEXT_KEY = "context"

    /** Builder for the zone-scoped notifications route. */
    fun notificationsZone(context: String): String = "notifications?context=$context"

    /** P1.5 — Recent activity log. Reached from the Hub
     *  `HubRecentActivity` "See all" CTA. */
    const val RECENT_ACTIVITY = "recent-activity"

    /** Connections center (T5.2.3). Reached from the You / Me action grid
     *  or via `pantopus://connections`. */
    const val CONNECTIONS = "connections"

    /** Cross-listing Offers (T5.2.4). Reached from the You tab. */
    const val OFFERS = "offers"

    /** My bids (T5.3.1). Reached from the You tab "My bids" action tile. */
    const val MY_BIDS = "my-bids"

    /** My tasks V2 (T5.3.2). Reached from the You tab "My gigs" action tile. */
    const val MY_TASKS = "my-tasks"

    /** P2.2 — Post-a-Task wizard. Reached from the My tasks FAB / empty CTA. */
    const val COMPOSE_TASK = "compose-task"

    /** My posts (T5.3.3). Reached from the You / Me Activity-section row. */
    const val MY_POSTS = "my-posts"

    /** Discover hub (T5.4.1 / P11). Reached from the Hub Discovery rail's
     *  "See all" CTA or via `pantopus://discover-hub`. */
    const val DISCOVER_HUB = "discover-hub"

    /** Discover businesses (T5.4.2 / P12). Until P12 lands, the Discover
     *  hub Businesses "See all" pushes here and renders a placeholder. */
    const val DISCOVER_BUSINESSES = "discover-businesses"

    /** Hub menu icon target. Replaced by Settings in T3.1. */
    const val MENU = "settings"

    /** P1.4 — Settings → Edit profile. Pushed from the Hub menu and
     *  from the You tab's "Edit profile" section row. */
    const val EDIT_PROFILE = "profile/edit"

    /** Notification preferences (T3.1). */
    const val SETTINGS_NOTIFICATIONS = "settings/notifications"

    /** Privacy preferences (T3.1). */
    const val SETTINGS_PRIVACY = "settings/privacy"

    /** P8 / T6.2c — Settings → Blocked users. */
    const val SETTINGS_BLOCKED_USERS = "settings/blocks"

    /** P8 / T6.2c — Settings → Password. */
    const val SETTINGS_PASSWORD = "settings/password"

    /** P8 / T6.2c — Settings → Verification (status grid). */
    const val SETTINGS_VERIFICATION = "settings/verification"

    /** Persistent login — Settings → Security → Devices & sessions. */
    const val SETTINGS_DEVICES = "settings/devices"

    /** P8 / T6.2c — Settings → Help (static FAQ + contact CTA). */
    const val SETTINGS_HELP = "settings/help"

    /** P8 / T6.2c — Settings → Legal (TOC). */
    const val SETTINGS_LEGAL = "settings/legal"

    /** P8 / T6.2c — Settings → Legal → :doc (markdown viewer). */
    const val SETTINGS_LEGAL_DOC_KEY = "doc"
    const val SETTINGS_LEGAL_CONTENT = "settings/legal/{$SETTINGS_LEGAL_DOC_KEY}"

    fun settingsLegalContent(doc: String): String = "settings/legal/${java.net.URLEncoder.encode(doc, "UTF-8")}"

    /** P8 / T6.2c — Settings → About. */
    const val SETTINGS_ABOUT = "settings/about"

    /** P5.2 / A14.6 — Settings → Payments (payments-out · Stripe setup
     *  · payout routing). Distinct from `pantopus://wallet` (earnings-in). */
    const val SETTINGS_PAYMENTS = "settings/payments"

    /**
     * Profile / account hub — reached from the Hub avatar (no longer a bottom
     * tab). `?tab=receipt` is the `monthly_receipt` push target and opens with
     * the Monthly Receipt card expanded (RN `/(tabs)/profile?tab=receipt`).
     */
    const val PROFILE = "profile?tab={tab}"

    /** Nav arg key for [PROFILE]'s `?tab=`. */
    const val PROFILE_TAB_KEY = "tab"

    fun profile(tab: String? = null): String = "profile?tab=${Uri.encode(tab.orEmpty())}"

    /** Profiles & Privacy / Identity Center (T3.2). */
    const val IDENTITY_CENTER = "identity-center"

    /** Public Profile management / Creator audience dashboard (T3.3). */
    const val AUDIENCE_PROFILE = "audience-profile"

    /** A21.1 — "My Beacon": the signed-in user's own public Beacon profile
     *  (owner role). Reached from the navigation drawer. No handle arg ⇒
     *  the VM resolves the owner via `GET /personas/me`. */
    const val MY_BEACON = "my-beacon"

    /** A21.1 — another user's public Beacon profile by handle (visitor role).
     *  Reached from the Following list. `{handle}` must match
     *  [BEACON_HANDLE_KEY] so the VM reads it from the SavedStateHandle. */
    const val BEACON_PROFILE = "beacon/{$BEACON_HANDLE_KEY}"

    fun beaconProfile(handle: String): String = "beacon/${java.net.URLEncoder.encode(handle, "UTF-8")}"

    /** A22.2 "Your audience" — creator member management (pending requests
     *  + tier-grouped members). Pushed from the Audience Profile Followers
     *  tab "Your audience" row. */
    const val CREATOR_AUDIENCE_MEMBERS = "creator/audience/members"

    /** P1.3 — Broadcast detail full-screen takeover pushed from a tap
     *  on an update card on the Audience Profile. The tapped row's
     *  snapshot + the persona's tier ladder ride across the hop via
     *  [BroadcastDetailSeedCache] (routes can only carry strings). */
    const val BROADCAST_DETAIL = "broadcasts/{$BROADCAST_DETAIL_ID_KEY}"

    fun broadcastDetail(broadcastId: String): String = "broadcasts/${java.net.URLEncoder.encode(broadcastId, "UTF-8")}"

    /** P1.2 — Creator Inbox (standalone DM thread list for creators).
     *  Reached from the You tab Personal section row + Audience Profile
     *  Threads tab "View all messages" CTA + thread row tap. */
    const val CREATOR_INBOX = "creator-inbox"

    /** Ceremonial Mail Compose wizard (T3.7). */
    const val CEREMONIAL_MAIL = "mailbox/compose-letter"

    /** Ceremonial Mail Open reader (T3.8). `:id` is the Mail UUID. */
    const val CEREMONIAL_MAIL_OPEN_ID_KEY = "mailId"
    const val CEREMONIAL_MAIL_OPEN = "mailbox/letter/{$CEREMONIAL_MAIL_OPEN_ID_KEY}"

    fun ceremonialMailOpen(mailId: String): String = "mailbox/letter/${java.net.URLEncoder.encode(mailId, "UTF-8")}"

    /** Privacy Handshake wizard (T3.4). `:handle` is the persona being followed. */
    const val PRIVACY_HANDSHAKE_HANDLE_KEY = "personaHandle"
    const val PRIVACY_HANDSHAKE_PRESELECTED_TIER_KEY = "preselectedTierRank"
    const val PRIVACY_HANDSHAKE =
        "handshake/{$PRIVACY_HANDSHAKE_HANDLE_KEY}?" +
            "$PRIVACY_HANDSHAKE_PRESELECTED_TIER_KEY={$PRIVACY_HANDSHAKE_PRESELECTED_TIER_KEY}"

    fun privacyHandshake(
        handle: String,
        preselectedTierRank: Int? = null,
    ): String {
        val encoded = java.net.URLEncoder.encode(handle, "UTF-8")
        return if (preselectedTierRank != null) {
            "handshake/$encoded?$PRIVACY_HANDSHAKE_PRESELECTED_TIER_KEY=$preselectedTierRank"
        } else {
            "handshake/$encoded"
        }
    }

    /** Token / Accept screen (T3.5). Resolves the token then accepts
     *  via the matching backend route. Mirrors iOS DeepLinkRouter's
     *  `.invite(token)` destination. */
    const val TOKEN_ACCEPT_TOKEN_KEY = "token"
    const val TOKEN_ACCEPT = "invite/{$TOKEN_ACCEPT_TOKEN_KEY}"

    fun tokenAccept(token: String): String = "invite/${java.net.URLEncoder.encode(token, "UTF-8")}"

    /** T6.6c (P26.5) Support Trains list. */
    const val SUPPORT_TRAINS = "support-trains"

    /** P2.6 — Start-a-Support-Train wizard. Pushed by the Support
     *  Trains FAB / empty-state CTA. */
    const val START_SUPPORT_TRAIN = "support-trains/start"

    /** P4.6 — Support Trains search. Pushed from the Support Trains list
     *  top-bar search action; reuses the shared SearchListShell. */
    const val SUPPORT_TRAINS_SEARCH = "support-trains/search"

    /** T6.6c (P26.5) Review signups (organizer-only). `:id` is the
     *  Support Train UUID. Keep in sync with
     *  `ReviewSignupsViewModel.SUPPORT_TRAIN_ID_KEY`. */
    const val REVIEW_SIGNUPS_ID_KEY = "supportTrainId"
    const val REVIEW_SIGNUPS = "support-trains/{$REVIEW_SIGNUPS_ID_KEY}/review"

    fun reviewSignups(trainId: String): String = "support-trains/${java.net.URLEncoder.encode(trainId, "UTF-8")}/review"

    /** A10.9 (P3.1) Participant-facing Support Train detail. `:id`
     *  is the Support Train UUID. Replaces the previous default of
     *  landing on the organizer review queue; organizers still
     *  reach the queue via the dock-overflow `Manage signups`
     *  action on this screen. Keep in sync with
     *  `SupportTrainDetailViewModel.SUPPORT_TRAIN_ID_KEY`. */
    const val SUPPORT_TRAIN_DETAIL_ID_KEY = "supportTrainDetailId"
    const val SUPPORT_TRAIN_DETAIL = "support-trains/{$SUPPORT_TRAIN_DETAIL_ID_KEY}"

    fun supportTrainDetail(trainId: String): String = "support-trains/${java.net.URLEncoder.encode(trainId, "UTF-8")}"

    /** P3.7 Edit Signup form. `:reservationId` is the reservation UUID;
     *  the seed DTO is staged in
     *  `SupportTrainReservationsStore` by the Review-signups
     *  screen before navigation so the form can prefill without a
     *  re-fetch. Keep in sync with
     *  `EditSignupFormViewModel.RESERVATION_ID_KEY`. */
    const val EDIT_SIGNUP_ID_KEY = "reservationId"
    const val EDIT_SIGNUP = "support-trains/reservations/{$EDIT_SIGNUP_ID_KEY}/edit"

    fun editSignup(reservationId: String): String = "support-trains/reservations/${java.net.URLEncoder.encode(reservationId, "UTF-8")}/edit"

    /** P4.3 / A13.13 Manage train (organizer surface). `:id` is the
     *  Support Train UUID. Pushed from the A10.9 detail dock overflow
     *  when the viewer is the organizer and from the
     *  `pantopus://support-trains/:id/manage` deep link. Keep in sync
     *  with `ManageTrainViewModel.TRAIN_ID_KEY`. */
    const val MANAGE_TRAIN_ID_KEY = "supportTrainId"
    const val MANAGE_TRAIN = "support-trains/{$MANAGE_TRAIN_ID_KEY}/manage"

    fun manageTrain(trainId: String): String = "support-trains/${java.net.URLEncoder.encode(trainId, "UTF-8")}/manage"

    /** P1.1 — Admin Review-claims queue. Gated by [SettingsRoute.ReviewClaims]. */
    const val REVIEW_CLAIMS = "admin/review-claims"

    /** P1.1 — Admin Review-claim detail (single claim). Keep in sync with
     *  `ReviewClaimDetailViewModel.CLAIM_ID_KEY`. */
    const val REVIEW_CLAIM_DETAIL_ID_KEY = "claimId"
    const val REVIEW_CLAIM_DETAIL = "admin/review-claims/{$REVIEW_CLAIM_DETAIL_ID_KEY}"

    fun reviewClaimDetail(claimId: String): String = "admin/review-claims/${java.net.URLEncoder.encode(claimId, "UTF-8")}"

    /**
     * Generic placeholder for intents whose destination hasn't been
     * built yet. `label` is URL-encoded into the path and rendered by
     * the placeholder composable.
     */
    const val PLACEHOLDER_LABEL_KEY = "label"
    const val PLACEHOLDER = "_placeholder/generic?$PLACEHOLDER_LABEL_KEY={$PLACEHOLDER_LABEL_KEY}"

    /** Pulse tab (T1.2). Reached from Hub → pillar(.Pulse). */
    const val PULSE_FEED = "feed/pulse"

    /**
     * A03.2 — Beacon Updates feed (`surface=personas`). Reached from the
     * AudienceProfile entry and the `pantopus://beacons` deep link.
     */
    const val BEACONS_FEED = "feed/beacons"

    /**
     * §1A① — "Following": the Beacons the signed-in user follows. Reached
     * from the Audience Profile "Following" entry row.
     */
    const val FOLLOWING = "following"

    /** Gigs feed (T2.3). Reached from Hub → pillar(.Gigs). */
    const val GIGS_FEED = "gigs/feed"

    /** Gig Search (P4.4). Pushed from the Gigs feed search bar. */
    const val GIG_SEARCH = "gigs/search"

    /**
     * S2 — Universal search (All / Tasks / People / Beacons /
     * Businesses / Homes). Pushed from the navigation drawer's "Search"
     * row; gig-only search stays reachable from its Tasks tab and from
     * the Gigs feed search bar.
     */
    const val UNIVERSAL_SEARCH = "search"

    /** Gig detail target — placeholder until T2.6 Transactional Detail. */
    const val GIG_DETAIL_ID_KEY = "gigId"
    const val GIG_DETAIL = "gigs/{$GIG_DETAIL_ID_KEY}"

    /** Compose gig target — placeholder until the compose flow ships. */
    const val COMPOSE_GIG_CATEGORY_KEY = "category"
    const val COMPOSE_GIG = "gigs/compose?$COMPOSE_GIG_CATEGORY_KEY={$COMPOSE_GIG_CATEGORY_KEY}"

    /** Quick-post V1 single-screen gig form. Hub action chip entry point.
     *  A13.8 P4 — an optional `editGigId` arg turns the same screen into
     *  the owner's gig editor (My Tasks → Edit). */
    const val QUICK_POST_GIG_CATEGORY_KEY = "category"
    const val QUICK_POST_GIG_EDIT_ID_KEY = PostGigV1ViewModel.EDIT_GIG_ID_KEY
    const val QUICK_POST_GIG =
        "gigs/quick-post?$QUICK_POST_GIG_CATEGORY_KEY={$QUICK_POST_GIG_CATEGORY_KEY}" +
            "&$QUICK_POST_GIG_EDIT_ID_KEY={$QUICK_POST_GIG_EDIT_ID_KEY}"

    /** Nearby map opened from the Gigs feed map-toggle — seeded with the
     *  active category so the same filter applies on the map. */
    const val NEARBY_MAP_FOR_GIGS_CATEGORY_KEY = "category"
    const val NEARBY_MAP_FOR_GIGS =
        "gigs/map?$NEARBY_MAP_FOR_GIGS_CATEGORY_KEY={$NEARBY_MAP_FOR_GIGS_CATEGORY_KEY}"

    /** Marketplace tab (T2.5). Reached from Hub → pillar(.Marketplace). */
    const val MARKETPLACE = "marketplace"

    /** Listing detail target — placeholder until T2.6. */
    const val LISTING_DETAIL_ID_KEY = "listingId"
    const val LISTING_DETAIL = "listings/{$LISTING_DETAIL_ID_KEY}"

    /** Per-listing offers panel (T5.3.4). */
    const val LISTING_OFFERS_ID_KEY = "listingId"
    const val LISTING_OFFERS_TITLE_KEY = "listingTitle"
    const val LISTING_OFFERS =
        "listings/{$LISTING_OFFERS_ID_KEY}/offers?$LISTING_OFFERS_TITLE_KEY={$LISTING_OFFERS_TITLE_KEY}"

    /** Build the listing-offers path with an optional title hint. */
    fun listingOffers(
        listingId: String,
        title: String? = null,
    ): String {
        val encodedTitle = java.net.URLEncoder.encode(title ?: "", "UTF-8")
        return "listings/$listingId/offers?$LISTING_OFFERS_TITLE_KEY=$encodedTitle"
    }

    /** Snap & sell — the marketplace listing-compose wizard (P2.3). */
    const val COMPOSE_LISTING = "listings/compose"

    /** P3.3 — Edit an existing listing. Reached from the listing-detail
     *  overflow ("Edit listing") for the owner, or from the listing-
     *  offers panel's "Edit price" affordance (which seeds the optional
     *  `jumpToStep` query param to `Price`). */
    const val EDIT_LISTING_ID_KEY = "editListingId"
    const val EDIT_LISTING_JUMP_TO_STEP_KEY = "editJumpToStep"
    const val EDIT_LISTING =
        "listings/{$EDIT_LISTING_ID_KEY}/edit?$EDIT_LISTING_JUMP_TO_STEP_KEY={$EDIT_LISTING_JUMP_TO_STEP_KEY}"

    /** Build the edit-listing path with an optional jump-to-step. */
    fun editListing(
        listingId: String,
        jumpToStep: String? = null,
    ): String {
        val step = jumpToStep ?: ""
        return "listings/$listingId/edit?$EDIT_LISTING_JUMP_TO_STEP_KEY=$step"
    }

    /** T6.3f / P14 — My listings (seller's tabbed roster). */
    const val MY_LISTINGS = "listings/me"

    /** T6.3f / P14 — My businesses (owner / staff roster). */
    const val MY_BUSINESSES = "businesses/me"

    /** Invoice detail (T2.6 ContentDetailShell · invoice variant). */
    const val INVOICE_DETAIL_ID_KEY = "invoiceId"
    const val INVOICE_DETAIL = "invoices/{$INVOICE_DETAIL_ID_KEY}"

    /** Chat conversation (T2.2). Reached from Inbox → row tap. */
    const val CHAT_KIND_KEY = "kind"
    const val CHAT_ID_KEY = "id"
    const val CHAT_NAME_KEY = "name"
    const val CHAT_INITIALS_KEY = "initials"
    const val CHAT_VERIFIED_KEY = "verified"
    const val CHAT_IDENTITY_KEY = "identity"
    const val CHAT_LOCALITY_KEY = "locality"
    const val CHAT_ONLINE_KEY = "online"
    const val CHAT_TIER_NAME_KEY = "tierName"
    const val CHAT_TIER_RANK_KEY = "tierRank"
    const val CHAT_TOPIC_TYPE_KEY = "topicType"
    const val CHAT_TOPIC_REF_ID_KEY = "topicRefId"
    const val CHAT_TOPIC_TITLE_KEY = "topicTitle"

    /** A15 `.ctx-strip` — backing gig id for gig rooms (empty otherwise). */
    const val CHAT_GIG_ID_KEY = "gigId"

    /** P4.3 — message id to scroll to on open (Chat Search deep-link).
     *  Empty for normal opens, which land on the latest message. */
    const val CHAT_SCROLL_TO_KEY = "scrollTo"
    const val CHAT_CONVERSATION =
        "chat/{$CHAT_KIND_KEY}/{$CHAT_ID_KEY}?" +
            "$CHAT_NAME_KEY={$CHAT_NAME_KEY}" +
            "&$CHAT_INITIALS_KEY={$CHAT_INITIALS_KEY}" +
            "&$CHAT_VERIFIED_KEY={$CHAT_VERIFIED_KEY}" +
            "&$CHAT_IDENTITY_KEY={$CHAT_IDENTITY_KEY}" +
            "&$CHAT_LOCALITY_KEY={$CHAT_LOCALITY_KEY}" +
            "&$CHAT_ONLINE_KEY={$CHAT_ONLINE_KEY}" +
            "&$CHAT_TIER_NAME_KEY={$CHAT_TIER_NAME_KEY}" +
            "&$CHAT_TIER_RANK_KEY={$CHAT_TIER_RANK_KEY}" +
            "&$CHAT_SCROLL_TO_KEY={$CHAT_SCROLL_TO_KEY}" +
            "&$CHAT_TOPIC_TYPE_KEY={$CHAT_TOPIC_TYPE_KEY}" +
            "&$CHAT_TOPIC_REF_ID_KEY={$CHAT_TOPIC_REF_ID_KEY}" +
            "&$CHAT_TOPIC_TITLE_KEY={$CHAT_TOPIC_TITLE_KEY}" +
            "&$CHAT_GIG_ID_KEY={$CHAT_GIG_ID_KEY}"

    /** New message contact picker (T6.6b P25). Reached from Chat list
     *  compose button + empty-state CTA. */
    const val NEW_MESSAGE = "chat/new"

    /** P4.3 — Chat Search. Reached from the Chat list search bar. */
    const val CHAT_SEARCH = "chat/search"

    /** Compose post target — placeholder until the compose flow ships. */
    const val COMPOSE_INTENT_KEY = "intent"

    /** Optional Sports-lane starter prompt seeded into the draft body. */
    const val COMPOSE_BODY_KEY = "prefillBody"
    const val COMPOSE_POST =
        "feed/compose?$COMPOSE_INTENT_KEY={$COMPOSE_INTENT_KEY}&$COMPOSE_BODY_KEY={$COMPOSE_BODY_KEY}"

    /** P3.5 — Edit an existing Pulse post. Re-uses the compose flow. */
    const val EDIT_POST_POST_ID_KEY = "postId"
    const val EDIT_POST = "feed/edit/{$EDIT_POST_POST_ID_KEY}"

    /** Debug-only route reached via 5-tap easter egg on the Hub. */
    const val TOKEN_GALLERY = "_debug/token-gallery"

    /** Build the concrete path for a home dashboard. */
    fun homeDashboard(id: String): String = "homes/$id"

    /** Build the concrete path for the Bills list. */
    fun homeBills(homeId: String): String = "homes/$homeId/bills"

    /** Build the concrete path for a Bill detail. */
    fun billDetail(
        homeId: String,
        billId: String,
    ): String = "homes/$homeId/bills/$billId"

    /** Build the concrete path for the Add Bill wizard. */
    fun addBill(homeId: String): String = "homes/$homeId/bills/new"

    /** Build the concrete path for the Edit Bill wizard. */
    fun editBill(
        homeId: String,
        billId: String,
    ): String = "homes/$homeId/bills/$billId/edit"

    /** Build the concrete path for a mailbox item detail. */
    fun mailboxItemDetail(id: String): String = "mailbox/item/$id"

    /** Build the concrete path for a public profile. */
    fun publicProfile(id: String): String = "users/$id"

    /** Build the concrete path for a Pulse post detail. */
    fun pulsePost(id: String): String = "posts/$id"

    /**
     * Build the invite-owner path. `email` is forwarded so the form
     * can reject self-invites; pass `""` when unknown.
     */
    fun inviteOwner(
        homeId: String,
        currentEmail: String,
    ): String = "homes/$homeId/invite?email=${java.net.URLEncoder.encode(currentEmail, "UTF-8")}"

    /** Build the disambiguate-mail path. */
    fun disambiguateMail(mailId: String): String = "mailbox/disambiguate/$mailId"

    /** Build the claim-ownership wizard path. */
    fun claimOwnership(homeId: String): String = "homes/$homeId/claim"

    /**
     * Build the residency-verification path — the same wizard driven by
     * `verificationType=residency`, which sends `claim_type: 'resident'`
     * and offers the lease / utility-bill / tax-bill document set.
     */
    fun verifyResidency(homeId: String): String = "homes/$homeId/verify-residency"

    /** Build the per-home issue-tracker path. */
    fun homeIssues(homeId: String): String = "homes/$homeId/issues"

    /** Build the verify-landlord wizard path. */
    fun verifyLandlord(homeId: String): String = "homes/$homeId/verify-landlord"

    /** Build the postcard verification standalone path. */
    fun postcardVerification(homeId: String): String = "homes/$homeId/verify-postcard"

    /** Build the generic placeholder path with an encoded label. */
    fun placeholder(label: String): String = "_placeholder/generic?$PLACEHOLDER_LABEL_KEY=${java.net.URLEncoder.encode(label, "UTF-8")}"

    /** Build the compose-post path with the pre-fill intent encoded. */
    fun composePost(
        intent: String,
        prefillBody: String = "",
    ): String =
        "feed/compose?$COMPOSE_INTENT_KEY=${java.net.URLEncoder.encode(intent, "UTF-8")}" +
            "&$COMPOSE_BODY_KEY=${java.net.URLEncoder.encode(prefillBody, "UTF-8")}"

    /** Build the edit-post path. The VM reads `postId` via SavedStateHandle. */
    fun editPost(postId: String): String = "feed/edit/${java.net.URLEncoder.encode(postId, "UTF-8")}"

    /** Build the gig-detail path. */
    fun gigDetail(gigId: String): String = "gigs/$gigId"

    /** Build the compose-gig path with the active category pre-fill. */
    fun composeGig(category: String): String = "gigs/compose?$COMPOSE_GIG_CATEGORY_KEY=${java.net.URLEncoder.encode(category, "UTF-8")}"

    fun quickPostGig(category: String): String =
        "gigs/quick-post?$QUICK_POST_GIG_CATEGORY_KEY=${java.net.URLEncoder.encode(category, "UTF-8")}"

    /** P4 — open the quick-post V1 screen as the owner's gig editor. */
    fun editGig(gigId: String): String = "gigs/quick-post?$QUICK_POST_GIG_EDIT_ID_KEY=${java.net.URLEncoder.encode(gigId, "UTF-8")}"

    /** @deprecated Legacy path — resolves to [tasksMap]. */
    fun nearbyMapForGigs(category: String): String = tasksMap(category)

    /** Build the Tasks-map path with the active category seed. */
    fun tasksMap(category: String): String = "tasks/map?$TASKS_MAP_CATEGORY_KEY=${java.net.URLEncoder.encode(category, "UTF-8")}"

    /** Build the listing-detail path. */
    fun listingDetail(listingId: String): String = "listings/$listingId"

    /** Build the invoice-detail path. */
    fun invoiceDetail(invoiceId: String): String = "invoices/$invoiceId"

    /** Build the chat-conversation path with all header context encoded. */
    fun chatConversation(row: ConversationRowContent): String {
        val kind =
            when (row.variant) {
                ConversationRowVariant.AiAssistant -> "ai"
                is ConversationRowVariant.Group -> "room"
                ConversationRowVariant.Dm -> "person"
            }
        val identity =
            when (row.identityChip) {
                ConversationIdentityChip.Business -> "business"
                ConversationIdentityChip.Home -> "home"
                null -> ""
            }

        fun enc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        return "chat/$kind/${enc(row.id)}?" +
            "$CHAT_NAME_KEY=${enc(row.displayName)}" +
            "&$CHAT_INITIALS_KEY=${enc(row.initials)}" +
            "&$CHAT_VERIFIED_KEY=${row.verified}" +
            "&$CHAT_IDENTITY_KEY=${enc(identity)}" +
            "&$CHAT_LOCALITY_KEY=" +
            "&$CHAT_ONLINE_KEY=false" +
            "&$CHAT_TIER_NAME_KEY=" +
            "&$CHAT_TIER_RANK_KEY=" +
            "&$CHAT_SCROLL_TO_KEY=" +
            "&$CHAT_TOPIC_TYPE_KEY=" +
            "&$CHAT_TOPIC_REF_ID_KEY=" +
            "&$CHAT_TOPIC_TITLE_KEY=" +
            "&$CHAT_GIG_ID_KEY=${enc(row.gigId ?: "")}"
    }

    // A Creator Inbox row no longer builds a generic-chat path. Persona DMs
    // are addressed by thread id (`personaDmThread`) because the DM
    // serializer emits no user_id for either party — the previous
    // `counterpartyUserId ?: row.id` fallback pushed a thread/membership id
    // into chat as if it were a user id.

    /** Build the chat-conversation path for a New Message picker
     *  selection. The picker emits `userId / displayName / initials /
     *  verified / locality`; we route to person mode and surface the
     *  empty "Say hi" state on first paint. */
    fun chatConversationFromPicker(
        userId: String,
        displayName: String,
        initials: String,
        verified: Boolean,
        locality: String?,
        topicType: String? = null,
        topicRefId: String? = null,
        topicTitle: String? = null,
    ): String {
        fun enc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        return "chat/person/${enc(userId)}?" +
            "$CHAT_NAME_KEY=${enc(displayName)}" +
            "&$CHAT_INITIALS_KEY=${enc(initials)}" +
            "&$CHAT_VERIFIED_KEY=$verified" +
            "&$CHAT_IDENTITY_KEY=" +
            "&$CHAT_LOCALITY_KEY=${enc(locality ?: "")}" +
            "&$CHAT_ONLINE_KEY=false" +
            "&$CHAT_TIER_NAME_KEY=" +
            "&$CHAT_TIER_RANK_KEY=" +
            "&$CHAT_SCROLL_TO_KEY=" +
            "&$CHAT_TOPIC_TYPE_KEY=${enc(topicType ?: "")}" +
            "&$CHAT_TOPIC_REF_ID_KEY=${enc(topicRefId ?: "")}" +
            "&$CHAT_TOPIC_TITLE_KEY=${enc(topicTitle ?: "")}"
    }

    /** Build the chat-conversation path for a gig-scoped room. */
    fun chatConversationRoom(
        roomId: String,
        displayName: String,
        initials: String,
        verified: Boolean,
    ): String {
        fun enc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        return "chat/room/${enc(roomId)}?" +
            "$CHAT_NAME_KEY=${enc(displayName)}" +
            "&$CHAT_INITIALS_KEY=${enc(initials)}" +
            "&$CHAT_VERIFIED_KEY=$verified" +
            "&$CHAT_IDENTITY_KEY=" +
            "&$CHAT_LOCALITY_KEY=" +
            "&$CHAT_ONLINE_KEY=false" +
            "&$CHAT_TIER_NAME_KEY=" +
            "&$CHAT_TIER_RANK_KEY=" +
            "&$CHAT_SCROLL_TO_KEY=" +
            "&$CHAT_TOPIC_TYPE_KEY=" +
            "&$CHAT_TOPIC_REF_ID_KEY=" +
            "&$CHAT_TOPIC_TITLE_KEY="
    }

    /** Build the chat-conversation path for a Chat Search result. Carries
     *  the matched message id so the conversation opens scrolled to it
     *  (empty for name-only matches → opens at the latest message). */
    fun chatSearchConversation(result: ChatSearchResult): String {
        val kind =
            when (result.kind) {
                ChatSearchResultKind.Group -> "room"
                ChatSearchResultKind.Dm -> "person"
            }
        val identity =
            when (result.identityChip) {
                ConversationIdentityChip.Business -> "business"
                ConversationIdentityChip.Home -> "home"
                null -> ""
            }

        fun enc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        return "chat/$kind/${enc(result.conversationId)}?" +
            "$CHAT_NAME_KEY=${enc(result.displayName)}" +
            "&$CHAT_INITIALS_KEY=${enc(result.initials)}" +
            "&$CHAT_VERIFIED_KEY=${result.verified}" +
            "&$CHAT_IDENTITY_KEY=${enc(identity)}" +
            "&$CHAT_LOCALITY_KEY=" +
            "&$CHAT_ONLINE_KEY=false" +
            "&$CHAT_TIER_NAME_KEY=" +
            "&$CHAT_TIER_RANK_KEY=" +
            "&$CHAT_SCROLL_TO_KEY=${enc(result.matchedMessageId ?: "")}" +
            "&$CHAT_TOPIC_TYPE_KEY=" +
            "&$CHAT_TOPIC_REF_ID_KEY=" +
            "&$CHAT_TOPIC_TITLE_KEY="
    }

    // ---- Wave A bootstrap placeholders ------------------------------------
    // Routes pre-staged so every Wave A screen lands its navigation in one PR
    // without colliding on this file. Each is wired to NotYetAvailableView in
    // the NavHost below; when an A.x screen ships, swap that one composable
    // body for the real screen (the route + builder here are already correct).

    /**
     * A10.3 — Full "Today" briefing (weather, air, daylight, signals).
     *
     * `briefingDeliveryId` / `briefingKind` are non-empty only when opened
     * from a Morning/Evening Briefing push, whose metadata carries
     * `briefing_delivery_id` + `briefing_kind`. With an id the screen resolves
     * that stored delivery (`GET /api/hub/briefings/:id`) instead of showing
     * only the live `/api/hub/today` snapshot.
     */
    const val TODAY_DETAIL =
        "hub/today/detail?briefingDeliveryId={briefingDeliveryId}&briefingKind={briefingKind}"

    fun todayDetail(
        briefingDeliveryId: String? = null,
        briefingKind: String? = null,
    ): String =
        "hub/today/detail?briefingDeliveryId=${Uri.encode(briefingDeliveryId.orEmpty())}" +
            "&briefingKind=${Uri.encode(briefingKind.orEmpty())}"

    /** A10.10 — Wallet (earnings-side surface). Reached from the
     *  Settings → "Payments & payouts" row and the
     *  `pantopus://wallet` deep link. */
    const val WALLET = "wallet"

    /** WS5.1 — full wallet transaction history. */
    const val WALLET_ACTIVITY = "wallet/activity"

    /** WS5.3 — GDPR data-export request (mailto until backend job ships). */
    const val SETTINGS_DATA_EXPORT = "settings/data-export"
    const val PROPERTY_DETAILS_HOME_ID_KEY = "homeId"
    const val PROPERTY_DETAILS = "homes/{$PROPERTY_DETAILS_HOME_ID_KEY}/property"

    fun propertyDetails(homeId: String): String = "homes/$homeId/property"

    /** A.3 — Add a guest to a home. */
    const val ADD_GUEST_HOME_ID_KEY = "homeId"
    const val ADD_GUEST = "homes/{$ADD_GUEST_HOME_ID_KEY}/guests/new"

    fun addGuest(homeId: String): String = "homes/$homeId/guests/new"

    /** A13.6 — Guest-pass manager for a home (Active / Past + revoke).
     *  Pushed from Home settings → "Invite link"; its FAB opens
     *  [ADD_GUEST]. */
    const val GUEST_PASSES_HOME_ID_KEY = "homeId"
    const val GUEST_PASSES = "homes/{$GUEST_PASSES_HOME_ID_KEY}/guests"

    fun guestPasses(homeId: String): String = "homes/$homeId/guests"

    /** A13.4 — Transfer Ownership form. Pushed from the Owners list
     *  "Transfer" action and from `pantopus://homes/:id/owners/transfer`
     *  deep links. The form owns its own biometric bottom sheet. */
    const val TRANSFER_OWNERSHIP_HOME_ID_KEY = "homeId"
    const val TRANSFER_OWNERSHIP = "homes/{$TRANSFER_OWNERSHIP_HOME_ID_KEY}/owners/transfer"

    fun transferOwnership(homeId: String): String = "homes/$homeId/owners/transfer"

    /** A11.1 — Tasks map. Gigs-only mode of the MapListHybrid archetype,
     *  opened from the Gigs feed's list/map toggle. Seeded with the active
     *  category so the same filter applies on the map. */
    const val TASKS_MAP_CATEGORY_KEY = "category"
    const val TASKS_MAP = "tasks/map?$TASKS_MAP_CATEGORY_KEY={$TASKS_MAP_CATEGORY_KEY}"

    /** A.x — Explore (neighbourhood discovery surface). */
    const val EXPLORE = "explore"
    const val EXPLORE_LAT_KEY = "lat"
    const val EXPLORE_LNG_KEY = "lng"
    const val EXPLORE_LABEL_KEY = "label"
    const val EXPLORE_ROUTE =
        "$EXPLORE?$EXPLORE_LAT_KEY={$EXPLORE_LAT_KEY}&$EXPLORE_LNG_KEY={$EXPLORE_LNG_KEY}&$EXPLORE_LABEL_KEY={$EXPLORE_LABEL_KEY}"

    /** BLOCK 2E — Saved Places list. */
    const val SAVED_PLACES = "saved-places"

    fun explore(
        latitude: Double,
        longitude: Double,
        label: String,
    ): String = "$EXPLORE?$EXPLORE_LAT_KEY=$latitude&$EXPLORE_LNG_KEY=$longitude&$EXPLORE_LABEL_KEY=${Uri.encode(label)}"

    /** B.1 prerequisite — Mailbox root archetype. */
    const val MAILBOX_ROOT = "mailbox/root"

    /** A.x — Mailbox map. */
    const val MAILBOX_MAP = "mailbox/map"

    /** A17.4 — Community mail feed (neighborhood / civic). */
    const val MAILBOX_COMMUNITY = "mailbox/community"

    /** Family Mail Party — household co-opening (discover / live session). */
    const val MAILBOX_PARTY = "mailbox/party"

    /** Home Records — the linked-asset hub behind the Mailbox. */
    const val MAILBOX_HOME_RECORDS = "mailbox/records"

    /** A14.8 — Vacation hold (scheduling + active variants). */
    const val MAILBOX_VACATION = "mailbox/vacation"

    /**
     * A13.16 — My Mail Day editor. `{variant}` accepts "populated" (default)
     * or "empty" to switch between the mid-afternoon triage view and the
     * "nothing new today" hero. The Mailbox root header CTA pushes
     * "populated"; the deep link `pantopus://mailbox/mailday` lands here too.
     */
    const val MAIL_DAY = "mailbox/mailday/{variant}"

    fun mailDay(variant: String = "populated"): String = "mailbox/mailday/$variant"

    /** A.x — Membership detail for a persona. */
    const val MEMBERSHIP_DETAIL_PERSONA_ID_KEY = "personaId"
    const val MEMBERSHIP_DETAIL = "personas/{$MEMBERSHIP_DETAIL_PERSONA_ID_KEY}/membership"

    fun membershipDetail(personaId: String): String = "personas/$personaId/membership"

    /**
     * C5 — Persona DM thread (A15.4 creator side / A15.5 fan side). Addressed
     * by thread id: persona DMs carry no counterparty user id on the wire, so
     * there is nothing else to route on.
     */
    const val PERSONA_DM_PERSONA_ID_KEY = "personaId"
    const val PERSONA_DM_THREAD_ID_KEY = "threadId"
    const val PERSONA_DM_THREAD =
        "personas/{$PERSONA_DM_PERSONA_ID_KEY}/dms/{$PERSONA_DM_THREAD_ID_KEY}"

    fun personaDmThread(
        personaId: String,
        threadId: String,
    ): String = "personas/$personaId/dms/$threadId"

    /** C5 — Fan-side persona inbox for one persona (A15.5). */
    const val FAN_INBOX_PERSONA_ID_KEY = "personaId"
    const val FAN_INBOX = "personas/{$FAN_INBOX_PERSONA_ID_KEY}/inbox"

    fun fanInbox(personaId: String): String = "personas/$personaId/inbox"

    /** A.5 — Professional profile. */
    const val PROFESSIONAL_PROFILE = "professional-profile"

    /** A.6 — Edit persona. */
    const val EDIT_PERSONA_PERSONA_ID_KEY = "personaId"
    const val EDIT_PERSONA = "personas/{$EDIT_PERSONA_PERSONA_ID_KEY}/edit"

    fun editPersona(personaId: String): String = "personas/$personaId/edit"

    /** A.7 — Compose broadcast from a persona. */
    const val COMPOSE_BROADCAST_PERSONA_ID_KEY = "personaId"
    const val COMPOSE_BROADCAST = "personas/{$COMPOSE_BROADCAST_PERSONA_ID_KEY}/broadcast/new"

    fun composeBroadcast(personaId: String): String = "personas/$personaId/broadcast/new"

    // ---- Batch 2 (B1.6) routing seam --------------------------------------
    // Pre-staged so every batch-2 screen (B2–B5) lands its navigation without
    // colliding on this file. Each is wired to NotYetAvailableView in the
    // NavHost below; when an A.x screen ships, swap that one composable body
    // for the real screen (the route + builder here are already correct).

    /** A17.11 — Stamps / postage wallet. */
    const val STAMPS = "mailbox/stamps"

    /** A17.12 — Mail-derived task detail. `:taskId` is the Task UUID. */
    const val MAIL_TASK_ID_KEY = "taskId"
    const val MAIL_TASK = "mailbox/tasks/{$MAIL_TASK_ID_KEY}"

    fun mailTask(taskId: String): String = "mailbox/tasks/$taskId"

    /**
     * A17.12 (list) — every mail-linked task. All three legs are optional;
     * absent ones travel as the `-` sentinel. When `mailId` is present the
     * screen opens in its create frame for that mail.
     */
    const val MAIL_TASK_LIST =
        "mailbox/tasks?mailId={mailId}&mailSubject={mailSubject}&mailSender={mailSender}"

    fun mailTaskList(
        mailId: String? = null,
        mailSubject: String? = null,
        mailSender: String? = null,
    ): String {
        fun leg(value: String?) = Uri.encode(value?.takeIf { it.isNotBlank() } ?: MAIL_TASK_LIST_NONE)
        return "mailbox/tasks?mailId=${leg(mailId)}" +
            "&mailSubject=${leg(mailSubject)}&mailSender=${leg(mailSender)}"
    }

    /** A17.13 — Auto-translated mail view. `:mailId` is the source Mail UUID. */
    const val TRANSLATION_MAIL_ID_KEY = "mailId"
    const val TRANSLATION = "mailbox/translation/{$TRANSLATION_MAIL_ID_KEY}"

    fun translation(mailId: String): String = "mailbox/translation/$mailId"

    /**
     * A17.14 — Unboxing capture flow for a delivered package. The route
     * carries the originating mail id; without one the screen has nothing
     * to persist and says so. Absent ids travel as the `-` sentinel.
     */
    const val UNBOXING = "mailbox/unboxing?mailId={mailId}"

    fun unboxing(mailId: String? = null): String =
        "mailbox/unboxing?mailId=" + Uri.encode(mailId?.takeIf { it.isNotBlank() } ?: UNBOXING_MAIL_ID_NONE)

    /**
     * A17.8 → "Ask a Neighbor" — the package-help gig created from a mailbox
     * package. Carries the source mail id plus RN's `mode=pre|post` leg
     * (`src/app/mailbox/gig.tsx`).
     */
    const val PACKAGE_GIG = "mailbox/gig?mailId={mailId}&mode={mode}"

    fun packageGig(
        mailId: String,
        isPreDelivery: Boolean,
    ): String {
        val mode = if (isPreDelivery) PACKAGE_GIG_MODE_PRE else PACKAGE_GIG_MODE_POST
        val leg = Uri.encode(mailId.takeIf { it.isNotBlank() } ?: PACKAGE_GIG_MAIL_ID_NONE)
        return "mailbox/gig?mailId=$leg&mode=$mode"
    }

    /** A10.11 — Earn dashboard (Wallet sibling). */
    const val EARN = "mailbox/earn"

    /** A10.7 — Business owner view. `:businessId` is the business User UUID.
     *  Plural `businesses/{id}`; the public profile (A10.6) is the singular
     *  `business/{id}` (see [BUSINESS_PROFILE]). */
    const val BUSINESS_OWNER_ID_KEY = "businessId"
    const val BUSINESS_OWNER = "businesses/{$BUSINESS_OWNER_ID_KEY}"

    fun businessOwner(businessId: String): String = "businesses/$businessId"

    /** B2C — Business team & roles management. Reuses [BUSINESS_OWNER_ID_KEY]. */
    const val BUSINESS_TEAM = "businesses/{$BUSINESS_OWNER_ID_KEY}/team"

    fun businessTeam(businessId: String): String = "businesses/$businessId/team"

    /** C3 — Business Stripe Connect payouts. Reuses [BUSINESS_OWNER_ID_KEY]. */
    const val BUSINESS_PAYMENTS_OWNER = "businesses/{$BUSINESS_OWNER_ID_KEY}/payments"

    fun businessPaymentsOwner(businessId: String): String = "businesses/$businessId/payments"

    /** C3 — Business invoicing (list / create / void). Reuses [BUSINESS_OWNER_ID_KEY]. */
    const val BUSINESS_INVOICES_OWNER = "businesses/{$BUSINESS_OWNER_ID_KEY}/invoices"

    fun businessInvoicesOwner(businessId: String): String = "businesses/$businessId/invoices"

    /** C3 — Business legal record + verification. Reuses [BUSINESS_OWNER_ID_KEY]. */
    const val BUSINESS_LEGAL = "businesses/{$BUSINESS_OWNER_ID_KEY}/legal"

    fun businessLegal(businessId: String): String = "businesses/$businessId/legal"

    /** Locations & Hours list MVP. Reuses [BUSINESS_OWNER_ID_KEY]. */
    const val BUSINESS_LOCATIONS = "businesses/{$BUSINESS_LOCATIONS_BUSINESS_ID_KEY}/locations"

    fun businessLocations(businessId: String): String = "businesses/$businessId/locations"

    /** A18.5 — "View as" identity preview. */
    const val VIEW_AS = "identity/preview"

    /** A18.4 — Persistent "waiting for approval" room. `:homeId` is the home UUID. */
    const val WAITING_ROOM_HOME_ID_KEY = "homeId"
    const val WAITING_ROOM = "homes/{$WAITING_ROOM_HOME_ID_KEY}/waiting-room"

    fun waitingRoom(homeId: String): String = "homes/$homeId/waiting-room"

    /**
     * A18 — claim status / waiting surface for a single ownership claim,
     * opened from a My Claims row. Mirrors iOS `HubRoute.claimStatus`.
     */
    const val CLAIM_STATUS_CLAIM_ID_KEY = "claimId"
    const val CLAIM_STATUS = "homes/claims/{$CLAIM_STATUS_CLAIM_ID_KEY}/status"

    fun claimStatus(claimId: String): String = "homes/claims/$claimId/status"
}

/**
 * Fire a `mailto:` intent, swallowing [ActivityNotFoundException] when the
 * device has no mail client. iOS degrades silently here (`openURL` on a
 * `mailto:` URL is a no-op without a mail app), so the CTA does nothing on
 * both platforms rather than crashing on Android.
 */
private fun Context.openMailto(uri: String) {
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(uri))
    try {
        startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        Log.i("RootTabScreen", "mailto ignored: no mail client installed")
    }
}

private fun NavHostController.navigateToRootTab(route: PantopusRoute) {
    navigate(route.path) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

private fun routeForAIDraft(draft: ChatAIDraftCard): String =
    when (draft.type) {
        "gig" -> ChildRoutes.composeGig(GigsCategory.All.key)
        "listing" -> ChildRoutes.COMPOSE_LISTING
        "post" -> ChildRoutes.composePost(PulseIntent.Ask.key)
        else -> ChildRoutes.composePost(PulseIntent.Ask.key)
    }

/** An optional (nullable, default-null) string nav arg — query-style args on scheduling routes. */
private fun optionalStringNavArg(name: String) =
    navArgument(name) {
        type = NavType.StringType
        nullable = true
        defaultValue = null
    }

/**
 * The optional `ownerKind`/`ownerId` query args every owner-scoped Calendarly
 * route declares (see `SchedulingRoutes.ARG_OWNER_KIND`). ViewModels rebuild the
 * owner via `SchedulingOwner.fromRoute(SavedStateHandle)`; absent args mean Personal.
 */
private fun schedulingOwnerNavArgs() =
    listOf(
        optionalStringNavArg(SchedulingRoutes.ARG_OWNER_KIND),
        optionalStringNavArg(SchedulingRoutes.ARG_OWNER_ID),
    )

/** The optional `homeId` query arg carried by the F8/F9–F14 home scheduling routes. */
private fun schedulingHomeNavArg() = optionalStringNavArg(SchedulingRoutes.ARG_HOME_ID)

/**
 * Signed-in root. Hosts [PantopusBottomBar] + a [NavHost] with the five
 * top-level destinations from [PantopusRoute] plus drill-down destinations
 * wired from the Hub.
 *
 * @param inboxBadgeCount Unread count shown on the Messages tab. Wired to
 *     live data in Prompt P8.
 */
@Composable
fun RootTabScreen(inboxBadgeCount: Int = 0) {
    val navController = rememberNavController()
    // P6.6 — system share / mail + contacts picker for the placeholder sweep.
    val appContext = androidx.compose.ui.platform.LocalContext.current
    val findPeopleLauncher =
        androidx.activity.compose.rememberLauncherForActivityResult(
            androidx.activity.result.contract.ActivityResultContracts.PickContact(),
        ) { uri ->
            if (uri != null) appContext.shareText(InviteLinks.INVITE_MESSAGE, "Invite to Pantopus")
        }
    val sessionViewModel: RootSessionViewModel = hiltViewModel()
    val chatBadgeViewModel: ChatBadgeViewModel = hiltViewModel()
    val currentHandle by sessionViewModel.currentHandle.collectAsStateWithLifecycle()
    val liveInboxBadgeCount by chatBadgeViewModel.unreadMessages.collectAsStateWithLifecycle()
    // §1C-b — context-aware navigation drawer, opened from the Hub menu button
    // (repurposed from "open Settings"; Settings now lives as a drawer row).
    val navDrawerState = rememberDrawerState(DrawerValue.Closed)
    val navDrawerScope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = PantopusRoute.fromPath(backStackEntry?.destination?.route) ?: PantopusRoute.Home
    val resolvedInboxBadgeCount = maxOf(inboxBadgeCount, liveInboxBadgeCount)
    val badges: Map<PantopusRoute, Int> =
        if (resolvedInboxBadgeCount > 0) mapOf(PantopusRoute.Messages to resolvedInboxBadgeCount) else emptyMap()

    // Consume pending deep links — when the host activity (or a
    // notification tap) routed a URL or path through DeepLinkRouter,
    // dispatch to the matching screen. Mirrors the iOS T4.1 routing
    // table from `docs/07-frontend-mobile-app.md §9`.
    val pendingDeepLink by DeepLinkRouter.pending.collectAsStateWithLifecycle()
    LaunchedEffect(pendingDeepLink) {
        when (val pending = pendingDeepLink) {
            null -> Unit
            is DeepLinkRouter.Destination.Invite -> {
                navController.navigate(ChildRoutes.tokenAccept(pending.token))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.JoinInvite -> {
                navController.navigate(ChildRoutes.tokenAccept(pending.code))
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Notifications -> {
                navController.navigate(ChildRoutes.NOTIFICATIONS)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Feed -> {
                navController.navigateToRootTab(PantopusRoute.Pulse)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Home -> {
                navController.navigateToRootTab(PantopusRoute.Home)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Connections -> {
                navController.navigate(ChildRoutes.CONNECTIONS)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Beacons -> {
                navController.navigate(ChildRoutes.BEACONS_FEED)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.DiscoverHub -> {
                navController.navigate(ChildRoutes.DISCOVER_HUB)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Wallet -> {
                navController.navigate(ChildRoutes.WALLET)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.PaymentsSettings -> {
                navController.navigate(ChildRoutes.MENU)
                navController.navigate(ChildRoutes.SETTINGS_PAYMENTS)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.CreateBusiness -> {
                navController.navigate(ChildRoutes.CREATE_BUSINESS)
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.Post -> {
                navController.navigateToRootTab(PantopusRoute.Pulse)
                navController.navigate(ChildRoutes.pulsePost(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.Conversation -> {
                // Chat push taps carry `/chat/<roomId>` (+ optional `name`
                // appended by NotificationDispatcher from the push title).
                // Land on the Messages tab first so Back pops to the chat
                // list, then push the thread itself.
                navController.navigateToRootTab(PantopusRoute.Messages)
                if (pending.id.isNotBlank()) {
                    val display = pending.name?.takeIf { it.isNotBlank() } ?: "Conversation"
                    val initials =
                        display
                            .split(" ")
                            .take(2)
                            .mapNotNull { it.firstOrNull()?.toString() }
                            .joinToString("")
                            .uppercase()
                            .ifEmpty { "?" }
                    navController.navigate(
                        ChildRoutes.chatConversationRoom(
                            roomId = pending.id,
                            displayName = display,
                            initials = initials,
                            verified = false,
                        ),
                    )
                }
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.SupportTrain -> {
                // A10.9 (P3.1) — `pantopus://support-trains/:id` now
                // lands on the participant detail. Organizers reach
                // the review queue from the dock overflow on the
                // detail screen, or via the explicit
                // `support-trains/:id/manage` deep link
                // (handled separately).
                navController.navigate(ChildRoutes.SUPPORT_TRAINS)
                if (pending.id.isNotBlank()) {
                    navController.navigate(ChildRoutes.supportTrainDetail(pending.id))
                }
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.SupportTrainManage -> {
                // P4.3 / A13.13 — `pantopus://support-trains/:id/manage`
                // lands on the organizer Manage Train surface. Drop the
                // user on the Support Trains list first so a back-tap
                // pops to a known surface, then push manage.
                navController.navigate(ChildRoutes.SUPPORT_TRAINS)
                if (pending.id.isNotBlank()) {
                    navController.navigate(ChildRoutes.manageTrain(pending.id))
                }
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.Gig -> {
                navController.navigateToRootTab(PantopusRoute.Tasks)
                navController.navigate(ChildRoutes.gigDetail(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.Listing -> {
                navController.navigateToRootTab(PantopusRoute.Marketplace)
                navController.navigate(ChildRoutes.listingDetail(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.HomeDetail -> {
                navController.navigate(ChildRoutes.homeDashboard(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.HomeDashboard -> {
                navController.navigate(ChildRoutes.homeDashboard(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.HomeMemberRequests -> {
                navController.navigate(ChildRoutes.homeMembers(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.HomeOwnersTransfer -> {
                // Push the home's dashboard underneath so a back-tap from
                // the transfer form lands somewhere useful rather than at
                // the empty Hub root.
                navController.navigate(ChildRoutes.homeDashboard(pending.id))
                navController.navigate(ChildRoutes.transferOwnership(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.VerifyLandlord -> {
                navController.navigate(ChildRoutes.verifyLandlord(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.PostcardVerification -> {
                navController.navigate(ChildRoutes.postcardVerification(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.User -> {
                navController.navigate(ChildRoutes.publicProfile(pending.id))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.BeaconProfile -> {
                navController.navigate(ChildRoutes.beaconProfile(pending.handle))
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.VacationHold -> {
                // A14.8 — push the Mailbox root first so Back returns
                // to the mailbox surface (not the hub home), then drill
                // into the Vacation hold screen.
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.MAILBOX_VACATION)
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.MailDay -> {
                // Push mailbox root first so Back walks back through the
                // drawer view, then push the day editor on top.
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.mailDay())
                DeepLinkRouter.consume()
            }
            // ---- B1.6 batch-2 routing seam. The mailbox sub-screens push
            // through MAILBOX_ROOT first so Back walks back through the
            // mailbox, matching VacationHold / MailDay above. ----
            DeepLinkRouter.Destination.Stamps -> {
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.STAMPS)
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.MailTask -> {
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.mailTask(pending.taskId))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.MailTranslation -> {
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.translation(pending.mailId))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.Unboxing -> {
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.unboxing(pending.mailId))
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.Earn -> {
                navController.navigate(ChildRoutes.MAILBOX_ROOT)
                navController.navigate(ChildRoutes.EARN)
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.BusinessOwner -> {
                navController.navigate(ChildRoutes.businessOwner(pending.businessId))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.BusinessProfile -> {
                navController.navigate(ChildRoutes.businessProfile(pending.businessId))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.BusinessPage -> {
                // C4 — `pantopus://b/:username/:slug` keeps the slug so the
                // named custom page opens, matching RN's `?pageSlug=` redirect.
                navController.navigate(
                    ChildRoutes.businessProfilePage(pending.businessId, pending.pageSlug),
                )
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.EditBusinessPage -> {
                navController.navigate(ChildRoutes.editBusinessPage(pending.businessId))
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.ViewAs -> {
                navController.navigate(ChildRoutes.VIEW_AS)
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.WaitingRoom -> {
                // Drop the home dashboard underneath so a back-tap from the
                // waiting room lands on the home, mirroring HomeOwnersTransfer.
                navController.navigate(ChildRoutes.homeDashboard(pending.homeId))
                navController.navigate(ChildRoutes.waitingRoom(pending.homeId))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.HubToday -> {
                // Morning/Evening Briefing push → the stored delivery, not just
                // the live `/api/hub/today` snapshot.
                navController.navigate(
                    ChildRoutes.todayDetail(pending.briefingDeliveryId, pending.kind),
                )
                DeepLinkRouter.consume()
            }
            DeepLinkRouter.Destination.MonthlyReceipt -> {
                // `monthly_receipt` push → profile with the receipt expanded.
                navController.navigate(ChildRoutes.profile(tab = "receipt"))
                DeepLinkRouter.consume()
            }
            is DeepLinkRouter.Destination.ResetPassword,
            is DeepLinkRouter.Destination.VerifyEmail,
            is DeepLinkRouter.Destination.Unknown,
            -> {
                DeepLinkRouter.consume()
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = navDrawerState,
        gesturesEnabled = navDrawerState.isOpen,
        drawerContent = {
            NavigationDrawer(
                context = NavigationDrawerContext.Personal(name = currentHandle),
                onSelect = { destination ->
                    navDrawerScope.launch { navDrawerState.close() }
                    navController.navigate(
                        routeForDrawer(
                            destination,
                            NavigationDrawerContext.Personal(name = currentHandle),
                        ),
                    )
                },
                onOpenIdentityCenter = {
                    navDrawerScope.launch { navDrawerState.close() }
                    navController.navigate(ChildRoutes.IDENTITY_CENTER)
                },
                onBackToHub = {
                    navDrawerScope.launch { navDrawerState.close() }
                },
            )
        },
    ) {
        Scaffold(
            bottomBar = {
                PantopusBottomBar(
                    selected = currentRoute,
                    badges = badges,
                    onSelect = { target ->
                        if (target == currentRoute) return@PantopusBottomBar
                        navController.navigate(target.path) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            },
        ) { padding: PaddingValues ->
            NavHost(
                navController = navController,
                startDestination = PantopusRoute.Home.path,
                modifier = Modifier.padding(padding),
            ) {
                composable(PantopusRoute.Home.path) {
                    // W3 — land the Home tab on the Place dashboard when the
                    // user has a primary home. One-shot push over Hub so Hub
                    // stays reachable (back) and is the no-home fallback;
                    // parity with the iOS HubTabRoot auto-land.
                    val placeHostVm: HomeTabHostViewModel = hiltViewModel()
                    val placeLanding by placeHostVm.landing.collectAsStateWithLifecycle()
                    var didLandPlace by rememberSaveable { mutableStateOf(false) }
                    LaunchedEffect(placeLanding) {
                        val landing = placeLanding
                        if (!didLandPlace && landing is HomeLanding.PlaceDashboard) {
                            didLandPlace = true
                            navController.navigate(ChildRoutes.placeDashboard(landing.homeId))
                        }
                    }
                    HubWithDebugFiveTap(navController = navController) {
                        HubScreen(onIntent = { intent ->
                            when (intent) {
                                HubNavigationIntent.OpenNotifications ->
                                    navController.navigate(ChildRoutes.NOTIFICATIONS)
                                HubNavigationIntent.OpenAudienceNotifications ->
                                    navController.navigate(
                                        ChildRoutes.notificationsZone(NotificationsZone.Audience.rawValue),
                                    )
                                HubNavigationIntent.OpenMenu ->
                                    navDrawerScope.launch { navDrawerState.open() }
                                HubNavigationIntent.OpenProfile ->
                                    navController.navigate(ChildRoutes.profile())
                                HubNavigationIntent.StartVerification ->
                                    navController.navigate(ChildRoutes.ADD_HOME)
                                is HubNavigationIntent.ActionTapped ->
                                    when (intent.kind) {
                                        ActionChipContent.Kind.AddHome ->
                                            navController.navigate(ChildRoutes.ADD_HOME)
                                        ActionChipContent.Kind.ScanMail ->
                                            navController.navigate(ChildRoutes.MAILBOX_ROOT)
                                        ActionChipContent.Kind.PostTask ->
                                            navController.navigate(ChildRoutes.quickPostGig(GigsCategory.All.key))
                                        ActionChipContent.Kind.SnapAndSell ->
                                            navController.navigate(ChildRoutes.COMPOSE_LISTING)
                                    }
                                is HubNavigationIntent.PillarTapped ->
                                    when (intent.pillar) {
                                        PillarTile.Pillar.Mail ->
                                            navController.navigate(ChildRoutes.MAILBOX_ROOT)
                                        PillarTile.Pillar.Pulse ->
                                            navController.navigateToRootTab(PantopusRoute.Pulse)
                                        PillarTile.Pillar.Marketplace ->
                                            navController.navigateToRootTab(PantopusRoute.Marketplace)
                                        PillarTile.Pillar.Gigs ->
                                            navController.navigateToRootTab(PantopusRoute.Tasks)
                                    }
                                is HubNavigationIntent.DiscoveryTapped ->
                                    routeForDiscovery(intent.item).also { navController.navigate(it) }
                                HubNavigationIntent.OpenDiscoverHub ->
                                    navController.navigate(ChildRoutes.DISCOVER_HUB)
                                HubNavigationIntent.OpenExploreMap ->
                                    navController.navigate(ChildRoutes.EXPLORE)
                                HubNavigationIntent.OpenFindBusinesses ->
                                    navController.navigate(ChildRoutes.DISCOVER_BUSINESSES)
                                is HubNavigationIntent.JumpBackTapped ->
                                    if (intent.item.route.startsWith("/app/chat")) {
                                        navController.navigateToRootTab(PantopusRoute.Messages)
                                    } else {
                                        navController.navigate(routeForJumpBackIn(intent.item))
                                    }
                                // `statusItems[].route` uses the same canonical web
                                // paths as `jumpBackIn[].route`, so they share one
                                // resolver.
                                is HubNavigationIntent.StatusItemTapped ->
                                    if (intent.item.route.startsWith("/app/chat")) {
                                        navController.navigateToRootTab(PantopusRoute.Messages)
                                    } else {
                                        navController.navigate(
                                            routeForJumpBackIn(
                                                JumpBackItem(
                                                    id = intent.item.id,
                                                    title = intent.item.title,
                                                    icon = intent.item.icon,
                                                    route = intent.item.route,
                                                ),
                                            ),
                                        )
                                    }
                                HubNavigationIntent.OpenToday ->
                                    navController.navigate(ChildRoutes.todayDetail())
                                HubNavigationIntent.OpenRecentActivity ->
                                    navController.navigate(ChildRoutes.RECENT_ACTIVITY)
                            }
                        })
                    }
                }
                composable(PantopusRoute.Pulse.path) {
                    FeedScreen(
                        onOpenPost = { postId -> navController.navigate(ChildRoutes.pulsePost(postId)) },
                        onCompose = { intent -> navController.navigate(ChildRoutes.composePost(intent.key)) },
                        onComposeStarter = { starter ->
                            navController.navigate(
                                ChildRoutes.composePost(PulseIntent.Ask.key, starter.placeholder),
                            )
                        },
                    )
                }
                composable(PantopusRoute.Tasks.path) {
                    GigsFeedScreen(
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                        onCompose = { category -> navController.navigate(ChildRoutes.composeGig(category.key)) },
                        onOpenMap = { category -> navController.navigate(ChildRoutes.tasksMap(category.key)) },
                        onOpenSearch = { navController.navigate(ChildRoutes.GIG_SEARCH) },
                        onOpenSupportTrain = { trainId ->
                            navController.navigate(ChildRoutes.supportTrainDetail(trainId))
                        },
                        onOpenMyTasks = { navController.navigate(ChildRoutes.MY_TASKS) },
                        onOpenMySupportTrains = { navController.navigate(ChildRoutes.SUPPORT_TRAINS) },
                    )
                }
                composable(PantopusRoute.Marketplace.path) {
                    MarketplaceScreen(
                        onOpenListing = { listingId -> navController.navigate(ChildRoutes.listingDetail(listingId)) },
                        onCompose = { navController.navigate(ChildRoutes.COMPOSE_LISTING) },
                    )
                }
                composable(PantopusRoute.Messages.path) {
                    InboxScreen(
                        onOpenConversation = { row ->
                            navController.navigate(ChildRoutes.chatConversation(row))
                        },
                        onCompose = { navController.navigate(ChildRoutes.NEW_MESSAGE) },
                        onOpenSearch = { navController.navigate(ChildRoutes.CHAT_SEARCH) },
                    )
                }
                composable(
                    ChildRoutes.PROFILE,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.PROFILE_TAB_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { profileEntry ->
                    YouScreen(
                        expandMonthlyReceipt =
                            profileEntry.arguments
                                ?.getString(ChildRoutes.PROFILE_TAB_KEY)
                                ?.lowercase() == "receipt",
                        onOpenPublicProfile = { userId ->
                            navController.navigate(ChildRoutes.publicProfile(userId))
                        },
                        onOpenPulsePost = { postId ->
                            navController.navigate(ChildRoutes.pulsePost(postId))
                        },
                        onInviteOwner = { homeId, email ->
                            navController.navigate(ChildRoutes.inviteOwner(homeId, email))
                        },
                        onDisambiguateMail = { mailId ->
                            navController.navigate(ChildRoutes.disambiguateMail(mailId))
                        },
                        onOpenPrivacyHandshake = { handle ->
                            navController.navigate(ChildRoutes.privacyHandshake(handle))
                        },
                        onOpenInviteToken = { token ->
                            navController.navigate(ChildRoutes.tokenAccept(token))
                        },
                        onOpenCeremonialMail = {
                            navController.navigate(ChildRoutes.CEREMONIAL_MAIL)
                        },
                        onOpenCeremonialMailOpen = { mailId ->
                            navController.navigate(ChildRoutes.ceremonialMailOpen(mailId))
                        },
                        onOpenMailbox = { navController.navigate(ChildRoutes.MAILBOX_ROOT) },
                        onOpenEditProfile = {
                            navController.navigate(ChildRoutes.EDIT_PROFILE)
                        },
                        onOpenPlaceholder = { label ->
                            navController.navigate(ChildRoutes.placeholder(label))
                        },
                        onOpenSettings = { navController.navigate(ChildRoutes.MENU) },
                        onOpenOffers = { navController.navigate(ChildRoutes.OFFERS) },
                        onOpenMyBids = { navController.navigate(ChildRoutes.MY_BIDS) },
                        onOpenMyTasks = { navController.navigate(ChildRoutes.MY_TASKS) },
                        onOpenMyPosts = { navController.navigate(ChildRoutes.MY_POSTS) },
                        onOpenConnections = { navController.navigate(ChildRoutes.CONNECTIONS) },
                        onOpenSupportTrains = { navController.navigate(ChildRoutes.SUPPORT_TRAINS) },
                        onOpenIdentityCenter = { navController.navigate(ChildRoutes.IDENTITY_CENTER) },
                        onOpenAudienceProfile = { navController.navigate(ChildRoutes.AUDIENCE_PROFILE) },
                        onOpenCreatorInbox = { navController.navigate(ChildRoutes.CREATOR_INBOX) },
                        onOpenSavedPlaces = { navController.navigate(ChildRoutes.SAVED_PLACES) },
                        onOpenHomeBills = { homeId -> navController.navigate(ChildRoutes.homeBills(homeId)) },
                        onOpenHomePets = { homeId -> navController.navigate(ChildRoutes.homePets(homeId)) },
                        onOpenHomeCalendar = { homeId ->
                            navController.navigate(ChildRoutes.homeCalendar(homeId))
                        },
                        onOpenHomePackages = { homeId ->
                            navController.navigate(ChildRoutes.homePackages(homeId))
                        },
                        onOpenHomePolls = { homeId -> navController.navigate(ChildRoutes.homePolls(homeId)) },
                        onOpenAccessCodes = { homeId, homeName ->
                            navController.navigate(ChildRoutes.accessCodes(homeId, homeName))
                        },
                        onOpenHomeTasks = { homeId -> navController.navigate(ChildRoutes.homeTasks(homeId)) },
                        onOpenHomeMaintenance = { homeId ->
                            navController.navigate(ChildRoutes.homeMaintenance(homeId))
                        },
                        onOpenHomeOwners = { homeId -> navController.navigate(ChildRoutes.homeOwners(homeId)) },
                        onOpenHomeMembers = { homeId -> navController.navigate(ChildRoutes.homeMembers(homeId)) },
                        onOpenMyHomes = { navController.navigate(ChildRoutes.MY_HOMES) },
                        onOpenMyListings = { navController.navigate(ChildRoutes.MY_LISTINGS) },
                        onOpenMyBusinesses = { navController.navigate(ChildRoutes.MY_BUSINESSES) },
                        onOpenScheduling = { navController.navigate(SchedulingRoutes.HUB) },
                    )
                }

                composable(ChildRoutes.MY_HOMES) {
                    MyHomesListScreen(
                        onOpenHome = { homeId -> navController.navigate(ChildRoutes.homeDashboard(homeId)) },
                        onAddHome = { navController.navigate(ChildRoutes.ADD_HOME) },
                        onFindHome = { navController.navigate(ChildRoutes.FIND_HOME) },
                        onBack = { navController.popBackStack() },
                        onUploadOwnershipEvidence = { homeId ->
                            navController.navigate(ChildRoutes.claimOwnership(homeId))
                        },
                        onVerifyResidency = { homeId ->
                            navController.navigate(ChildRoutes.verifyResidency(homeId))
                        },
                    )
                }
                composable(ChildRoutes.MY_LISTINGS) {
                    MyListingsScreen(
                        onOpenListing = { listingId -> navController.navigate(ChildRoutes.listingDetail(listingId)) },
                        onCompose = { navController.navigate(ChildRoutes.COMPOSE_LISTING) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.MY_BUSINESSES) {
                    MyBusinessesScreen(
                        // B3.2 — an owned business opens its owner dashboard (A10.7).
                        onOpenBusiness = { businessId -> navController.navigate(ChildRoutes.businessOwner(businessId)) },
                        onRegister = { navController.navigate(ChildRoutes.CREATE_BUSINESS) },
                        onClaim = { navController.navigate(ChildRoutes.DISCOVER_BUSINESSES) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.CREATE_BUSINESS) {
                    CreateBusinessWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenBusiness = { businessId ->
                            navController.popBackStack(ChildRoutes.CREATE_BUSINESS, inclusive = true)
                            navController.navigate(ChildRoutes.businessOwner(businessId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.PLACE_DASHBOARD,
                    arguments = listOf(navArgument(PLACE_DASHBOARD_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(PLACE_DASHBOARD_HOME_ID_KEY).orEmpty()
                    PlaceDashboardScreen(
                        homeId = homeId,
                        onOpenSection = { hid, slug -> navController.navigate(ChildRoutes.placeDetail(hid, slug)) },
                        onSwitchHome = { id -> navController.navigate(ChildRoutes.placeDashboard(id)) },
                        onAddPlace = { navController.navigate(ChildRoutes.ADD_HOME) },
                        onStartVerify = { method, address ->
                            navController.navigate(ChildRoutes.placeVerifyStatus(homeId, method.slug, address))
                        },
                        onOpenPulse = { navController.navigate(ChildRoutes.placePulse(homeId)) },
                        onComposeMessage = { address ->
                            navController.navigate(ChildRoutes.neighborCompose(homeId, address))
                        },
                        onOpenInbox = { navController.navigate(ChildRoutes.NEIGHBOR_INBOX) },
                    )
                }
                composable(
                    route = ChildRoutes.PLACE_DETAIL,
                    arguments =
                        listOf(
                            navArgument(PLACE_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(PLACE_DETAIL_SLUG_KEY) { type = NavType.StringType },
                        ),
                ) {
                    PlaceDetailScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PLACE_PULSE,
                    arguments = listOf(navArgument(PLACE_PULSE_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    PlacePulseScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PLACE_VERIFY_STATUS,
                    arguments =
                        listOf(
                            navArgument(PLACE_VERIFY_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(PLACE_VERIFY_METHOD_KEY) { type = NavType.StringType },
                            navArgument(PLACE_VERIFY_ADDRESS_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { entry ->
                    PlaceVerifyStatusScreen(
                        address = entry.arguments?.getString(PLACE_VERIFY_ADDRESS_KEY).orEmpty(),
                        method = PlaceVerifyMethod.fromSlug(entry.arguments?.getString(PLACE_VERIFY_METHOD_KEY)),
                        onBack = { navController.popBackStack() },
                        onDone = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.NEIGHBOR_COMPOSE,
                    arguments =
                        listOf(
                            navArgument(NEIGHBOR_COMPOSE_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(NEIGHBOR_COMPOSE_ADDRESS_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) {
                    NeighborMessageComposeScreen(
                        onBack = { navController.popBackStack() },
                        onChangeRecipient = { navController.popBackStack() },
                        onDone = { navController.popBackStack() },
                    )
                }
                composable(route = ChildRoutes.NEIGHBOR_INBOX) {
                    NeighborMessageInboxScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMessage = { messageId -> navController.navigate(ChildRoutes.neighborMessage(messageId)) },
                    )
                }
                composable(
                    route = ChildRoutes.NEIGHBOR_MESSAGE,
                    arguments = listOf(navArgument(NEIGHBOR_MESSAGE_ID_KEY) { type = NavType.StringType }),
                ) {
                    NeighborMessageReceivedScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.HOME_DASHBOARD,
                    arguments = listOf(navArgument(HOME_DASHBOARD_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    HomeDashboardScreen(
                        onBack = { navController.popBackStack() },
                        onInviteOwner = { homeId ->
                            navController.navigate(ChildRoutes.inviteOwner(homeId, ""))
                        },
                        onClaimOwnership = { homeId ->
                            // The ownership-claim flow branches on whether the
                            // resident is the owner or a renter. Until the
                            // backend wires that decision into the claim
                            // start endpoint, we key off the sample-data
                            // homeId pattern so QA can hit either path. Both
                            // branches start identically from the dashboard
                            // banner.
                            val target =
                                if (
                                    homeId.contains("renter", ignoreCase = true) ||
                                    homeId.contains("verify-landlord", ignoreCase = true)
                                ) {
                                    ChildRoutes.verifyLandlord(homeId)
                                } else {
                                    ChildRoutes.claimOwnership(homeId)
                                }
                            navController.navigate(target)
                        },
                        onOpenClaimsList = { navController.navigate(ChildRoutes.MY_CLAIMS) },
                        onOpenBills = { homeId ->
                            navController.navigate(ChildRoutes.homeBills(homeId))
                        },
                        onOpenPolls = { homeId ->
                            navController.navigate(ChildRoutes.homePolls(homeId))
                        },
                        onOpenPlaceholder = { label ->
                            navController.navigate(ChildRoutes.placeholder(label))
                        },
                        onOpenPets = { homeId ->
                            navController.navigate(ChildRoutes.homePets(homeId))
                        },
                        onOpenCalendar = { homeId ->
                            navController.navigate(ChildRoutes.homeCalendar(homeId))
                        },
                        onOpenDocs = { homeId ->
                            navController.navigate(ChildRoutes.homeDocs(homeId))
                        },
                        onOpenEmergency = { homeId ->
                            navController.navigate(ChildRoutes.homeEmergency(homeId))
                        },
                        onOpenPackages = { homeId ->
                            navController.navigate(ChildRoutes.homePackages(homeId))
                        },
                        onOpenAccessCodes = { homeId, homeName ->
                            navController.navigate(ChildRoutes.accessCodes(homeId, homeName))
                        },
                        onOpenTasks = { homeId ->
                            navController.navigate(ChildRoutes.homeTasks(homeId))
                        },
                        onOpenMaintenance = { homeId ->
                            navController.navigate(ChildRoutes.homeMaintenance(homeId))
                        },
                        onOpenMembers = { homeId ->
                            navController.navigate(ChildRoutes.homeMembers(homeId))
                        },
                        onOpenPropertyDetails = { homeId ->
                            navController.navigate(ChildRoutes.propertyDetails(homeId))
                        },
                        onOpenSettings = { homeId ->
                            navController.navigate(ChildRoutes.homeSettings(homeId))
                        },
                        onHireHelp = { categoryKey ->
                            // H1 — "Hire" on a seasonal-checklist item opens
                            // the gig composer pre-filtered to the item's
                            // category.
                            navController.navigate(ChildRoutes.composeGig(categoryKey))
                        },
                        onAddTask = { homeId ->
                            navController.navigate(ChildRoutes.addHouseholdTask(homeId))
                        },
                        onTrackBill = { homeId ->
                            navController.navigate(ChildRoutes.addBill(homeId))
                        },
                        onTrackPackage = { homeId ->
                            navController.navigate(ChildRoutes.logPackage(homeId))
                        },
                        onSendMail = {
                            navController.navigate(ChildRoutes.CEREMONIAL_MAIL)
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_BILLS,
                    arguments = listOf(navArgument(BILLS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(BILLS_HOME_ID_KEY).orEmpty()
                    BillsListScreen(
                        onOpenBill = { billId ->
                            navController.navigate(ChildRoutes.billDetail(homeId, billId))
                        },
                        onAddBill = { navController.navigate(ChildRoutes.addBill(homeId)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.BILL_DETAIL,
                    arguments =
                        listOf(
                            navArgument(BILL_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(BILL_DETAIL_BILL_ID_KEY) { type = NavType.StringType },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(BILL_DETAIL_HOME_ID_KEY).orEmpty()
                    val billId = entry.arguments?.getString(BILL_DETAIL_BILL_ID_KEY).orEmpty()
                    BillDetailScreen(
                        onBack = { navController.popBackStack() },
                        onEdit = {
                            navController.navigate(ChildRoutes.editBill(homeId, billId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.ADD_BILL,
                    arguments = listOf(navArgument(ADD_BILL_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(ADD_BILL_HOME_ID_KEY).orEmpty()
                    AddBillWizardScreen(
                        onClose = { navController.popBackStack() },
                        onCreated = { billId ->
                            // Replace the wizard with the bill detail so Back
                            // returns to the Bills list, not the success step.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.billDetail(homeId, billId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_BILL,
                    arguments =
                        listOf(
                            navArgument(ADD_BILL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(ADD_BILL_BILL_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    AddBillWizardScreen(
                        onClose = { navController.popBackStack() },
                        onCreated = { _ ->
                            // Unreachable in edit mode — wizard emits
                            // `Updated` on save instead of `Created`.
                            navController.popBackStack()
                        },
                        onUpdated = { _ ->
                            // Pop the wizard so the bill detail (already on
                            // the stack underneath) becomes visible again.
                            navController.popBackStack()
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_PETS,
                    arguments = listOf(navArgument(PETS_LIST_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    PetsListScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.HOME_CALENDAR,
                    arguments =
                        listOf(navArgument(HOME_CALENDAR_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(HOME_CALENDAR_HOME_ID_KEY).orEmpty()
                    HomeCalendarScreen(
                        onAddEvent = {
                            navController.navigate(ChildRoutes.addCalendarEvent(homeId = homeId))
                        },
                        onOpenEvent = { eventId ->
                            navController.navigate(
                                ChildRoutes.calendarEventDetail(homeId = homeId, eventId = eventId),
                            )
                        },
                        onNavigate = { route -> navController.navigate(route) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.ADD_CALENDAR_EVENT,
                    arguments =
                        listOf(
                            navArgument(ADD_EVENT_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(ADD_EVENT_EVENT_ID_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                            navArgument(ADD_EVENT_PREFILLED_CATEGORY_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(ADD_EVENT_HOME_ID_KEY).orEmpty()
                    AddEventFormScreen(
                        onClose = { navController.popBackStack() },
                        onCommit = { commit ->
                            when (commit) {
                                is AddEventCommit.Created -> {
                                    navController.popBackStack()
                                    navController.navigate(
                                        ChildRoutes.calendarEventDetail(
                                            homeId = homeId,
                                            eventId = commit.eventId,
                                        ),
                                    )
                                }
                                is AddEventCommit.Updated -> {
                                    // Replace the form AND the stale detail with
                                    // a fresh detail so the re-fetched event
                                    // shows the updated fields.
                                    navController.navigate(
                                        ChildRoutes.calendarEventDetail(
                                            homeId = homeId,
                                            eventId = commit.eventId,
                                        ),
                                    ) {
                                        popUpTo(ChildRoutes.CALENDAR_EVENT_DETAIL) {
                                            inclusive = true
                                        }
                                    }
                                }
                            }
                        },
                    )
                }
                composable(
                    route = ChildRoutes.CALENDAR_EVENT_DETAIL,
                    arguments =
                        listOf(
                            navArgument(EVENT_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(EVENT_DETAIL_EVENT_ID_KEY) { type = NavType.StringType },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(EVENT_DETAIL_HOME_ID_KEY).orEmpty()
                    EventDetailScreen(
                        onBack = { navController.popBackStack() },
                        onEdit = { event ->
                            navController.navigate(
                                ChildRoutes.addCalendarEvent(
                                    homeId = homeId,
                                    eventId = event.id,
                                    prefilledCategory = event.eventType,
                                ),
                            )
                        },
                    )
                }
                // ── Calendarly scheduling (A0) — pre-stubbed routes; feature streams fill the bodies ──
                composable(SchedulingRoutes.HUB) {
                    SchedulingHubScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.SETUP_WIZARD) {
                    FirstRunWizardScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.SETTINGS,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    SchedulingSettingsRootScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.NOTIFICATIONS,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    NotificationPrefsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.ONBOARDING,
                    arguments = listOf(optionalStringNavArg(SchedulingRoutes.ARG_FLOW)) + schedulingOwnerNavArgs(),
                ) {
                    OnboardingHomeBusinessScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.EVENT_TYPE_LIST,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    EventTypeListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.EVENT_TYPE_EDITOR,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_EVENT_TYPE_ID) { type = NavType.StringType }),
                ) { entry ->
                    EventTypeEditorScreen(
                        eventTypeId = entry.arguments?.getString(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.INTAKE_QUESTIONS_EDITOR,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_EVENT_TYPE_ID) { type = NavType.StringType }),
                ) { entry ->
                    IntakeQuestionsEditorScreen(
                        eventTypeId = entry.arguments?.getString(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.CONNECTED_CALENDARS) {
                    ConnectedCalendarsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.AVAILABILITY_LIST) {
                    AvailabilityListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.WEEKLY_HOURS_EDITOR,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_SCHEDULE_ID) { type = NavType.StringType }),
                ) { entry ->
                    WeeklyHoursEditorScreen(
                        scheduleId = entry.arguments?.getString(SchedulingRoutes.ARG_SCHEDULE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.DATE_OVERRIDES,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_SCHEDULE_ID) { type = NavType.StringType }),
                ) { entry ->
                    DateOverridesScreen(
                        scheduleId = entry.arguments?.getString(SchedulingRoutes.ARG_SCHEDULE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.BOOKING_LIMITS) {
                    BookingLimitsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.BLOCK_OFF_TIME) {
                    BlockOffTimeScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.BOOKING_PAGE_MANAGE,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    BookingPageManageScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.PUBLIC_PAGE_PREVIEW,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    PublicPagePreviewScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.ONE_OFF_LINK_GENERATOR) {
                    OneOffLinkGeneratorScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.PUBLIC_BOOKING,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_SLUG) { type = NavType.StringType }),
                ) { entry ->
                    BookerLandingScreen(
                        slug = entry.arguments?.getString(SchedulingRoutes.ARG_SLUG).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.PUBLIC_BOOKING_ONEOFF,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_ONEOFF_TOKEN) { type = NavType.StringType }),
                ) { entry ->
                    BookerLandingScreen(
                        oneOffToken = entry.arguments?.getString(SchedulingRoutes.ARG_ONEOFF_TOKEN).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.MANAGE_BOOKING,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_MANAGE_TOKEN) { type = NavType.StringType }),
                ) { entry ->
                    ManageBookingScreen(
                        manageToken = entry.arguments?.getString(SchedulingRoutes.ARG_MANAGE_TOKEN).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.MY_BOOKINGS) {
                    MyBookingsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.OPEN_IN_APP_INTERSTITIAL) {
                    OpenInAppInterstitialScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.RECURRING_SETUP) {
                    RecurringSetupScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.BOOKINGS_INBOX) {
                    BookingsInboxScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.BOOKING_DETAIL,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_BOOKING_ID) { type = NavType.StringType }),
                ) { entry ->
                    BookingDetailScreen(
                        bookingId = entry.arguments?.getString(SchedulingRoutes.ARG_BOOKING_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.BOOKING_SEARCH) {
                    BookingSearchFilterScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.GROUP_ROSTER,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_BOOKING_ID) { type = NavType.StringType }),
                ) { entry ->
                    GroupRosterScreen(
                        bookingId = entry.arguments?.getString(SchedulingRoutes.ARG_BOOKING_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.MANUAL_BOOKING,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    ManualBookingScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.WAITLIST) {
                    WaitlistScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.POST_MEETING_FOLLOWUP,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_BOOKING_ID) { type = NavType.StringType }),
                ) { entry ->
                    PostMeetingFollowupScreen(
                        bookingId = entry.arguments?.getString(SchedulingRoutes.ARG_BOOKING_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.HOUSEHOLD_AVAILABILITY,
                    arguments = listOf(schedulingHomeNavArg()),
                ) {
                    HouseholdAvailabilityScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.PERMISSION_GATED_SCHEDULER) {
                    PermissionGatedSchedulerScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.FIND_A_TIME) {
                    FindATimeSetupScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.FIND_A_TIME_SLOTS) {
                    SuggestedSlotsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.MEMBER_POLL_RESPONSE,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_POLL_ID) { type = NavType.StringType }),
                ) { entry ->
                    MemberPollResponseScreen(
                        pollId = entry.arguments?.getString(SchedulingRoutes.ARG_POLL_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.WHOS_FREE) {
                    WhosFreeScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.RESOURCE_LIST,
                    arguments = listOf(schedulingHomeNavArg()),
                ) {
                    ResourceListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.RESOURCE_EDITOR,
                    arguments =
                        listOf(
                            navArgument(SchedulingRoutes.ARG_RESOURCE_ID) { type = NavType.StringType },
                            schedulingHomeNavArg(),
                        ),
                ) { entry ->
                    ResourceEditorScreen(
                        resourceId = entry.arguments?.getString(SchedulingRoutes.ARG_RESOURCE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.RESOURCE_DETAIL,
                    arguments =
                        listOf(
                            navArgument(SchedulingRoutes.ARG_RESOURCE_ID) { type = NavType.StringType },
                            schedulingHomeNavArg(),
                        ),
                ) { entry ->
                    ResourceDetailScreen(
                        resourceId = entry.arguments?.getString(SchedulingRoutes.ARG_RESOURCE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.BOOK_RESOURCE,
                    arguments =
                        listOf(
                            navArgument(SchedulingRoutes.ARG_RESOURCE_ID) { type = NavType.StringType },
                            schedulingHomeNavArg(),
                        ),
                ) { entry ->
                    BookResourceScreen(
                        resourceId = entry.arguments?.getString(SchedulingRoutes.ARG_RESOURCE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.VISIT_SETUP,
                    arguments = listOf(schedulingHomeNavArg()),
                ) {
                    VisitSetupScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.VISIT_DETAIL,
                    arguments =
                        listOf(
                            navArgument(SchedulingRoutes.ARG_VISIT_ID) { type = NavType.StringType },
                            schedulingHomeNavArg(),
                        ),
                ) { entry ->
                    VisitDetailScreen(
                        visitId = entry.arguments?.getString(SchedulingRoutes.ARG_VISIT_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.BUSINESS_SCHEDULING_SETTINGS) {
                    BusinessSchedulingSettingsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.TEAM_BOOKING_AVAILABILITY) {
                    TeamBookingAvailabilityScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.COLLECTIVE_EVENT_SETUP,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_EVENT_TYPE_ID) { type = NavType.StringType }),
                ) { entry ->
                    CollectiveEventSetupScreen(
                        eventTypeId = entry.arguments?.getString(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.MEMBER_WORKING_HOURS,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_MEMBER_ID) { type = NavType.StringType }),
                ) { entry ->
                    MemberWorkingHoursScreen(
                        memberId = entry.arguments?.getString(SchedulingRoutes.ARG_MEMBER_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.PAYMENTS_SETUP) {
                    PaymentsSetupScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.PAYOUTS) {
                    PayoutsEarningsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.CANCELLATION_REFUND_POLICY) {
                    CancellationRefundPolicyScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.PACKAGES_LIST) {
                    SchedulingPackagesListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.PACKAGE_EDITOR,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_PACKAGE_ID) { type = NavType.StringType }),
                ) { entry ->
                    PackageEditorScreen(
                        packageId = entry.arguments?.getString(SchedulingRoutes.ARG_PACKAGE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.BUY_PACKAGE,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_PACKAGE_ID) { type = NavType.StringType }),
                ) { entry ->
                    BuyPackageScreen(
                        packageId = entry.arguments?.getString(SchedulingRoutes.ARG_PACKAGE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.MY_PACKAGES) {
                    MyPackagesScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.INVOICES_LIST) {
                    InvoicesListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.INVOICE_DETAIL,
                    arguments = listOf(navArgument(SchedulingRoutes.ARG_INVOICE_ID) { type = NavType.StringType }),
                ) { entry ->
                    SchedulingInvoiceDetailScreen(
                        invoiceId = entry.arguments?.getString(SchedulingRoutes.ARG_INVOICE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.REMINDERS_QUICK_SETUP,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    RemindersQuickSetupScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.WORKFLOWS_LIST,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    WorkflowsListScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.WORKFLOW_EDITOR,
                    arguments =
                        listOf(navArgument(SchedulingRoutes.ARG_WORKFLOW_ID) { type = NavType.StringType }) +
                            schedulingOwnerNavArgs(),
                ) { entry ->
                    WorkflowEditorScreen(
                        workflowId = entry.arguments?.getString(SchedulingRoutes.ARG_WORKFLOW_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = SchedulingRoutes.MESSAGE_TEMPLATE_EDITOR,
                    arguments =
                        listOf(navArgument(SchedulingRoutes.ARG_TEMPLATE_ID) { type = NavType.StringType }) +
                            schedulingOwnerNavArgs(),
                ) { entry ->
                    MessageTemplateEditorScreen(
                        templateId = entry.arguments?.getString(SchedulingRoutes.ARG_TEMPLATE_ID).orEmpty(),
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    SchedulingRoutes.TEMPLATE_LIBRARY,
                    arguments = schedulingOwnerNavArgs(),
                ) {
                    TemplateLibraryScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.INSIGHTS_DASHBOARD) {
                    InsightsDashboardScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.EVENT_TYPE_PERFORMANCE) {
                    EventTypePerformanceScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.NO_SHOW_REPORT) {
                    NoShowReportScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.TEAM_PERFORMANCE) {
                    TeamPerformanceScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(SchedulingRoutes.NOTIFICATION_PERMISSION_PROMPT) {
                    NotificationPermissionPromptScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route -> navController.navigate(route) },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_EMERGENCY,
                    arguments = listOf(navArgument(EMERGENCY_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(EMERGENCY_HOME_ID_KEY).orEmpty()
                    EmergencyInfoScreen(
                        onAction = { dto ->
                            navController.navigate(ChildRoutes.emergencyItem(homeId, dto.id))
                        },
                        onAdd = { navController.navigate(ChildRoutes.addEmergencyInfo(homeId)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.ADD_EMERGENCY_INFO,
                    arguments =
                        listOf(navArgument(ADD_EMERGENCY_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    AddEmergencyInfoFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_EMERGENCY_INFO,
                    arguments =
                        listOf(
                            navArgument(ADD_EMERGENCY_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(ADD_EMERGENCY_ITEM_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    AddEmergencyInfoFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.EMERGENCY_ITEM,
                    arguments =
                        listOf(
                            navArgument(EMERGENCY_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(EMERGENCY_DETAIL_ITEM_ID_KEY) { type = NavType.StringType },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(EMERGENCY_DETAIL_HOME_ID_KEY).orEmpty()
                    val emergencyId = entry.arguments?.getString(EMERGENCY_DETAIL_ITEM_ID_KEY).orEmpty()
                    EmergencyInfoDetailScreen(
                        onBack = { navController.popBackStack() },
                        onEdit = {
                            navController.navigate(ChildRoutes.editEmergencyInfo(homeId, emergencyId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_PACKAGES,
                    arguments = listOf(navArgument(PACKAGES_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(PACKAGES_HOME_ID_KEY).orEmpty()
                    PackagesListScreen(
                        currentUserId = null,
                        memberLookup = { null },
                        onOpenPackage = { packageId ->
                            navController.navigate(ChildRoutes.packageDetail(homeId, packageId))
                        },
                        onLogPackage = { navController.navigate(ChildRoutes.logPackage(homeId)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_POLLS,
                    arguments = listOf(navArgument(POLLS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(POLLS_HOME_ID_KEY).orEmpty()
                    PollsListScreen(
                        onOpenPoll = { pollId ->
                            navController.navigate(ChildRoutes.pollDetail(homeId, pollId))
                        },
                        onStartPoll = {
                            navController.navigate(ChildRoutes.startPoll(homeId))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.START_POLL,
                    arguments = listOf(navArgument(START_POLL_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    StartPollFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_DOCS,
                    arguments = listOf(navArgument(DOCUMENTS_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    val docsHomeId = it.arguments?.getString(DOCUMENTS_HOME_ID_KEY).orEmpty()
                    DocumentsScreen(
                        onOpenDocument = { dto ->
                            navController.navigate(ChildRoutes.documentDetail(dto.homeId, dto.id))
                        },
                        onUpload = {
                            navController.navigate(ChildRoutes.uploadDocument(docsHomeId))
                        },
                        onSearch = { navController.navigate(ChildRoutes.documentSearch(docsHomeId)) },
                        onExport = { navController.navigate(ChildRoutes.placeholder("Export documents")) },
                        onDocumentAction = { dto, _ ->
                            navController.navigate(ChildRoutes.documentDetail(dto.homeId, dto.id))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.DOCUMENT_SEARCH,
                    arguments = listOf(navArgument(DOCUMENTS_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    DocumentSearchScreen(
                        onOpenDocument = { dto ->
                            navController.navigate(ChildRoutes.documentDetail(dto.homeId, dto.id))
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.UPLOAD_DOCUMENT,
                    arguments = listOf(navArgument(UPLOAD_DOCUMENT_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    UploadDocumentFormScreen(
                        onClose = { navController.popBackStack() },
                        onUploaded = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.DOCUMENT_DETAIL,
                    arguments =
                        listOf(
                            navArgument(DOCUMENT_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(DOCUMENT_DETAIL_DOC_ID_KEY) { type = NavType.StringType },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(DOCUMENT_DETAIL_HOME_ID_KEY).orEmpty()
                    DocumentDetailScreen(
                        onBack = { navController.popBackStack() },
                        onReplace = {
                            navController.navigate(ChildRoutes.uploadDocument(homeId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.POLL_DETAIL,
                    arguments =
                        listOf(
                            navArgument(POLL_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(POLL_DETAIL_POLL_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    PollDetailScreen(
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.ACCESS_CODES,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.ACCESS_CODES_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.ACCESS_CODES_HOME_NAME_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) { backStackEntry ->
                    val homeIdArg = backStackEntry.arguments?.getString(ChildRoutes.ACCESS_CODES_HOME_ID_KEY).orEmpty()
                    AccessCodesScreen(
                        onAddCode = { category ->
                            navController.navigate(
                                ChildRoutes.editAccessCode(
                                    homeId = homeIdArg,
                                    secretId = null,
                                    category = category?.wire,
                                ),
                            )
                        },
                        onEditCode = { secretId ->
                            navController.navigate(
                                ChildRoutes.editAccessCode(
                                    homeId = homeIdArg,
                                    secretId = secretId,
                                    category = null,
                                ),
                            )
                        },
                        onSearch = {
                            navController.navigate(ChildRoutes.accessCodesSearch(homeIdArg))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.ACCESS_CODES_SEARCH,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.ACCESS_CODES_HOME_ID_KEY) { type = NavType.StringType },
                        ),
                ) { backStackEntry ->
                    val homeIdArg = backStackEntry.arguments?.getString(ChildRoutes.ACCESS_CODES_HOME_ID_KEY).orEmpty()
                    AccessCodesSearchScreen(
                        onOpenCode = { secretId ->
                            navController.navigate(
                                ChildRoutes.editAccessCode(
                                    homeId = homeIdArg,
                                    secretId = secretId,
                                    category = null,
                                ),
                            )
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_ACCESS_CODE,
                    arguments =
                        listOf(
                            navArgument(EDIT_ACCESS_CODE_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(EDIT_ACCESS_CODE_SECRET_ID_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                            navArgument(EDIT_ACCESS_CODE_CATEGORY_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) {
                    EditAccessCodeFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_TASKS,
                    arguments = listOf(navArgument(HOUSEHOLD_TASKS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(HOUSEHOLD_TASKS_HOME_ID_KEY).orEmpty()
                    HouseholdTasksListScreen(
                        onOpenTask = { _ ->
                            navController.navigate(ChildRoutes.placeholder("Task detail"))
                        },
                        onAddTask = {
                            navController.navigate(ChildRoutes.addHouseholdTask(homeId))
                        },
                        onEditRecurring = { taskId ->
                            navController.navigate(ChildRoutes.editHouseholdTask(homeId, taskId))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.ADD_HOUSEHOLD_TASK,
                    arguments = listOf(navArgument(ADD_HOUSEHOLD_TASK_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    AddHouseholdTaskFormScreen(
                        onClose = { navController.popBackStack() },
                        onCreated = {
                            // Pop back to the tasks list; the list refreshes
                            // on next visit.
                            navController.popBackStack()
                        },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_HOUSEHOLD_TASK,
                    arguments =
                        listOf(
                            navArgument(ADD_HOUSEHOLD_TASK_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(ADD_HOUSEHOLD_TASK_TASK_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    AddHouseholdTaskFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_MAINTENANCE,
                    arguments = listOf(navArgument(MAINTENANCE_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId =
                        entry.arguments?.getString(MAINTENANCE_HOME_ID_KEY) ?: ""
                    MaintenanceListScreen(
                        onOpenTask = { taskId ->
                            navController.navigate(ChildRoutes.maintenanceDetail(homeId, taskId))
                        },
                        onAddTask = {
                            navController.navigate(ChildRoutes.logMaintenance(homeId))
                        },
                        onBack = { navController.popBackStack() },
                        onOpenIssues = {
                            navController.navigate(ChildRoutes.homeIssues(homeId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.LOG_MAINTENANCE,
                    arguments = listOf(navArgument(LOG_MAINTENANCE_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId =
                        entry.arguments?.getString(LOG_MAINTENANCE_HOME_ID_KEY) ?: ""
                    LogMaintenanceFormScreen(
                        onClose = { navController.popBackStack() },
                        onSubmitted = { taskId ->
                            navController.popBackStack(
                                ChildRoutes.homeMaintenance(homeId),
                                inclusive = false,
                            )
                            navController.navigate(ChildRoutes.maintenanceDetail(homeId, taskId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_MAINTENANCE,
                    arguments =
                        listOf(
                            navArgument(LOG_MAINTENANCE_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(LOG_MAINTENANCE_TASK_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    LogMaintenanceFormScreen(
                        onClose = { navController.popBackStack() },
                        onSubmitted = { _ -> navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.MAINTENANCE_DETAIL,
                    arguments =
                        listOf(
                            navArgument(MAINTENANCE_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(MAINTENANCE_DETAIL_TASK_ID_KEY) { type = NavType.StringType },
                        ),
                ) { entry ->
                    val homeId = entry.arguments?.getString(MAINTENANCE_DETAIL_HOME_ID_KEY) ?: ""
                    val taskId = entry.arguments?.getString(MAINTENANCE_DETAIL_TASK_ID_KEY) ?: ""
                    MaintenanceDetailScreen(
                        onBack = { navController.popBackStack() },
                        onEdit = {
                            navController.navigate(ChildRoutes.editMaintenance(homeId, taskId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_OWNERS,
                    arguments = listOf(navArgument(OWNERS_LIST_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    OwnersListScreen(
                        onOpenInvite = { homeId ->
                            navController.navigate(ChildRoutes.inviteOwner(homeId, ""))
                        },
                        onOpenTransfer = { homeId ->
                            navController.navigate(ChildRoutes.transferOwnership(homeId))
                        },
                        onOpenClaimReview = { homeId ->
                            navController.navigate(ChildRoutes.homeClaimReview(homeId))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_CLAIM_REVIEW,
                    arguments =
                        listOf(
                            navArgument(HOME_CLAIM_REVIEW_HOME_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    HomeClaimReviewScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PACKAGE_DETAIL,
                    arguments =
                        listOf(
                            navArgument(PACKAGE_DETAIL_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(PACKAGE_DETAIL_PACKAGE_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    PackageDetailScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.LOG_PACKAGE,
                    arguments = listOf(navArgument(LOG_PACKAGE_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(LOG_PACKAGE_HOME_ID_KEY).orEmpty()
                    LogPackageScreen(
                        onClose = { navController.popBackStack() },
                        onCreated = { packageId ->
                            // Replace the log-package destination with the
                            // new package's detail so Back returns to the
                            // Packages list, not the form.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.packageDetail(homeId, packageId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_MEMBERS,
                    arguments = listOf(navArgument(MEMBERS_LIST_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(MEMBERS_LIST_HOME_ID_KEY).orEmpty()
                    MembersListScreen(
                        onBack = { navController.popBackStack() },
                        onAddGuest = { navController.navigate(ChildRoutes.addGuest(homeId)) },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_SETTINGS,
                    arguments = listOf(navArgument(HOME_SETTINGS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(HOME_SETTINGS_HOME_ID_KEY).orEmpty()
                    HomeSettingsScreen(
                        onBack = { navController.popBackStack() },
                        onNavigate = { route ->
                            when (route) {
                                HomeSettingsRoute.Address, HomeSettingsRoute.PropertyDetails ->
                                    navController.navigate(ChildRoutes.propertyDetails(homeId))
                                HomeSettingsRoute.Photos ->
                                    navController.navigate(ChildRoutes.homePhotos(homeId))
                                HomeSettingsRoute.Documents ->
                                    navController.navigate(ChildRoutes.homeDocs(homeId))
                                HomeSettingsRoute.AccessCodes ->
                                    navController.navigate(ChildRoutes.accessCodes(homeId, null))
                                HomeSettingsRoute.TrustedNeighbors ->
                                    navController.navigate(ChildRoutes.trustedNeighbors(homeId))
                                HomeSettingsRoute.Security ->
                                    navController.navigate(ChildRoutes.homeSecurity(homeId))
                                HomeSettingsRoute.OwnershipSecurity ->
                                    navController.navigate(ChildRoutes.homeOwnershipSecurity(homeId))
                                HomeSettingsRoute.People ->
                                    navController.navigate(ChildRoutes.homeMembers(homeId))
                                HomeSettingsRoute.InviteLink ->
                                    // A13.6 — the guest-pass manager
                                    // (Active / Past + revoke). The Add
                                    // Guest form is reachable from its FAB.
                                    navController.navigate(ChildRoutes.guestPasses(homeId))
                                HomeSettingsRoute.HomeNotifications ->
                                    navController.navigate(ChildRoutes.homeNotifications(homeId))
                                HomeSettingsRoute.LeaveHome ->
                                    navController.navigate(ChildRoutes.leaveHome(homeId))
                                HomeSettingsRoute.CancelClaim ->
                                    navController.navigate(ChildRoutes.cancelClaim(homeId))
                            }
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_SECURITY,
                    arguments = listOf(navArgument(HOME_SECURITY_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    HomeSecurityScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.HOME_OWNERSHIP_SECURITY,
                    arguments =
                        listOf(
                            navArgument(HOME_OWNERSHIP_SECURITY_HOME_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    HomeOwnershipSecurityScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.LEAVE_HOME,
                    arguments = listOf(navArgument(LEAVE_HOME_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    LeaveHomeScreen(
                        onBack = { navController.popBackStack() },
                        onLeft = {
                            // Move-out revokes membership, so the dashboard for
                            // this home now 403s — drop it along with the
                            // settings stack. Mirrors iOS `HubTabRoot`.
                            val poppedToHomes =
                                navController.popBackStack(ChildRoutes.HOME_DASHBOARD, inclusive = true)
                            if (!poppedToHomes) {
                                navController.popBackStack(ChildRoutes.HOME_SETTINGS, inclusive = true)
                            }
                        },
                    )
                }
                composable(
                    route = ChildRoutes.CANCEL_CLAIM,
                    arguments = listOf(navArgument(CANCEL_CLAIM_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    CancelClaimScreen(
                        onBack = { navController.popBackStack() },
                        onCancelled = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_PHOTOS,
                    arguments = listOf(navArgument(HOME_SETTINGS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(HOME_SETTINGS_HOME_ID_KEY).orEmpty()
                    HomePhotosScreen(
                        onBack = { navController.popBackStack() },
                        onOpenDocuments = { navController.navigate(ChildRoutes.homeDocs(homeId)) },
                    )
                }
                composable(
                    route = ChildRoutes.TRUSTED_NEIGHBORS,
                    arguments = listOf(navArgument(HOME_SETTINGS_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    TrustedNeighborsScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.HOME_NOTIFICATIONS,
                    arguments = listOf(navArgument(HOME_SETTINGS_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    HomeNotificationsScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PROPERTY_CORRECTION,
                    arguments = listOf(navArgument(PROPERTY_CORRECTION_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    PropertyCorrectionScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.MAILBOX_ITEM_DETAIL,
                    arguments = listOf(navArgument(MAILBOX_ITEM_DETAIL_MAIL_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    // T6.5b (P20) — generic A17.1 mail detail. P21-P23 will
                    // add package / coupon / booklet / certified variants on
                    // top of the same shared shell.
                    val mailId = entry.arguments?.getString(MAILBOX_ITEM_DETAIL_MAIL_ID_KEY).orEmpty()
                    MailDetailScreen(
                        onBack = { navController.popBackStack() },
                        onOpenSenderProfile = { userId ->
                            navController.navigate(ChildRoutes.publicProfile(userId))
                        },
                        onTranslate = { navController.navigate(ChildRoutes.translation(mailId)) },
                        onOpenExtractedTask = { sourceMailId ->
                            // A17.12 — the certified-notice "view task" affordance
                            // opens the mail-derived task keyed by its source mail.
                            navController.navigate(ChildRoutes.mailTask(sourceMailId))
                        },
                        onOpenCeremonialMail = { ceremonialId ->
                            // Replace (not push) so Back returns to the Mailbox,
                            // matching RN's `router.replace`.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.ceremonialMailOpen(ceremonialId))
                        },
                        onCreateTask = { sourceMailId ->
                            // A17.12 — RN's "Create Task" in the detail MORE row
                            // (`src/app/mailbox/detail.tsx:221-227`).
                            navController.navigate(ChildRoutes.mailTaskList(mailId = sourceMailId))
                        },
                        onOpenUnboxing = { sourceMailId ->
                            navController.navigate(ChildRoutes.unboxing(sourceMailId))
                        },
                        onAskNeighbor = { sourceMailId, isPreDelivery ->
                            // A17.8 → "Ask a Neighbor" (RN `mailbox/package.tsx:204`).
                            navController.navigate(
                                ChildRoutes.packageGig(mailId = sourceMailId, isPreDelivery = isPreDelivery),
                            )
                        },
                    )
                }
                composable(
                    route = ChildRoutes.PUBLIC_PROFILE,
                    arguments = listOf(navArgument(PUBLIC_PROFILE_USER_ID_KEY) { type = NavType.StringType }),
                ) {
                    PublicProfileScreen(
                        onBack = { navController.popBackStack() },
                        onOpenHandshake = { handle, tierRank ->
                            navController.navigate(ChildRoutes.privacyHandshake(handle, tierRank))
                        },
                        onOpenMessages = { profile ->
                            navController.navigate(
                                ChildRoutes.chatConversationFromPicker(
                                    userId = profile.id,
                                    displayName = profile.displayName,
                                    initials = initialsFromName(profile.displayName),
                                    verified = profile.verified == true,
                                    locality = profile.locality,
                                ),
                            )
                        },
                        // Gigs tab rows open gig detail; review cards open the
                        // reviewer's own public profile.
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                        onOpenProfile = { reviewerId ->
                            navController.navigate(ChildRoutes.publicProfile(reviewerId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.BUSINESS_PROFILE,
                    arguments = listOf(navArgument(BUSINESS_PROFILE_BUSINESS_ID_KEY) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
                    val businessId = backStackEntry.arguments?.getString(BUSINESS_PROFILE_BUSINESS_ID_KEY) ?: ""
                    BusinessProfileScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMessages = { roomId, displayName, initials, verified ->
                            navController.navigate(
                                ChildRoutes.chatConversationRoom(
                                    roomId = roomId,
                                    displayName = displayName,
                                    initials = initials,
                                    verified = verified,
                                ),
                            )
                        },
                        onShare = {
                            appContext.shareText(
                                "Check out this business on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                "Share business",
                            )
                        },
                        onOpenReport = { navController.navigate(ChildRoutes.placeholder("Report business")) },
                        onOpenWebsite = { uri -> runCatching { uriHandler.openUri(uri) } },
                        onBook = { navController.navigate(ChildRoutes.placeholder("Book")) },
                        onEdit = { navController.navigate(ChildRoutes.editBusinessPage(businessId)) },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_BUSINESS_PAGE,
                    arguments = listOf(navArgument(EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY) { type = NavType.StringType }),
                ) {
                    EditBusinessPageScreen(
                        onBack = { navController.popBackStack() },
                        onPreview = { navController.popBackStack() },
                    )
                }
                // C4 — public profile opened on a named custom page
                // (`pantopus://b/:username/:slug`).
                composable(
                    route = ChildRoutes.BUSINESS_PROFILE_PAGE,
                    arguments =
                        listOf(
                            navArgument(BUSINESS_PROFILE_BUSINESS_ID_KEY) { type = NavType.StringType },
                            navArgument(BUSINESS_PROFILE_PAGE_SLUG_KEY) { type = NavType.StringType },
                        ),
                ) { backStackEntry ->
                    val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
                    val businessId = backStackEntry.arguments?.getString(BUSINESS_PROFILE_BUSINESS_ID_KEY) ?: ""
                    BusinessProfileScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMessages = { roomId, displayName, initials, verified ->
                            navController.navigate(
                                ChildRoutes.chatConversationRoom(
                                    roomId = roomId,
                                    displayName = displayName,
                                    initials = initials,
                                    verified = verified,
                                ),
                            )
                        },
                        onShare = {
                            appContext.shareText(
                                "Check out this business on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                "Share business",
                            )
                        },
                        onOpenReport = { navController.navigate(ChildRoutes.placeholder("Report business")) },
                        onOpenWebsite = { uri -> runCatching { uriHandler.openUri(uri) } },
                        onBook = { navController.navigate(ChildRoutes.placeholder("Book")) },
                        onEdit = { navController.navigate(ChildRoutes.editBusinessPage(businessId)) },
                    )
                }
                // C4 — custom Pages CMS index.
                composable(
                    route = ChildRoutes.BUSINESS_PAGES,
                    arguments = listOf(navArgument(BUSINESS_PAGES_BUSINESS_ID_KEY) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val businessId = backStackEntry.arguments?.getString(BUSINESS_PAGES_BUSINESS_ID_KEY) ?: ""
                    BusinessPagesScreen(
                        onBack = { navController.popBackStack() },
                        onOpenPage = { row ->
                            navController.navigate(
                                ChildRoutes.businessPageBlocks(
                                    businessId = businessId,
                                    pageId = row.id,
                                    pageTitle = row.title,
                                ),
                            )
                        },
                    )
                }
                // C4 — block builder for one custom page.
                composable(
                    route = ChildRoutes.BUSINESS_PAGE_BLOCKS,
                    arguments =
                        listOf(
                            navArgument(PAGE_BLOCKS_BUSINESS_ID_KEY) { type = NavType.StringType },
                            navArgument(PAGE_BLOCKS_PAGE_ID_KEY) { type = NavType.StringType },
                            navArgument(PAGE_BLOCKS_PAGE_TITLE_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) {
                    BusinessPageBlocksScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PULSE_POST,
                    arguments = listOf(navArgument(PULSE_POST_DETAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    PulsePostDetailScreen(
                        onBack = { navController.popBackStack() },
                        onOpenProfile = { userId ->
                            navController.navigate(ChildRoutes.publicProfile(userId))
                        },
                        onEdit = { postId ->
                            navController.navigate(ChildRoutes.editPost(postId))
                        },
                        onOpenBusiness = { username ->
                            // "Nearby Providers" row → `/business/:username`.
                            navController.navigate(ChildRoutes.businessProfile(username))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.INVITE_OWNER,
                    arguments =
                        listOf(
                            navArgument(INVITE_OWNER_HOME_ID_KEY) { type = NavType.StringType },
                            navArgument(INVITE_OWNER_CURRENT_EMAIL_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) {
                    InviteOwnerFormScreen(onClose = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.DISAMBIGUATE_MAIL,
                    arguments = listOf(navArgument(DISAMBIGUATE_MAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    DisambiguateMailFormScreen(onClose = { navController.popBackStack() })
                }
                composable(ChildRoutes.MAIL_ROUTING_QUEUE) {
                    MailRoutingQueueScreen(onClose = { navController.popBackStack() })
                }
                composable(ChildRoutes.MAILBOX_VAULT) {
                    // T6.5e (P19.5) — Mailbox Vault list-of-rows surface.
                    VaultListScreen(
                        onOpenItem = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                        onAddTapped = {
                            // FAB shortcut — drop the user back to the inbox
                            // where mail items expose the kebab
                            // "Save to vault" action.
                            navController.navigate(ChildRoutes.MAILBOX_ROOT) {
                                popUpTo(ChildRoutes.MAILBOX_ROOT) { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        onOpenMailbox = {
                            navController.navigate(ChildRoutes.MAILBOX_ROOT) {
                                popUpTo(ChildRoutes.MAILBOX_ROOT) { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.CHAT_CONVERSATION,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.CHAT_KIND_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.CHAT_ID_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.CHAT_NAME_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_INITIALS_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_VERIFIED_KEY) {
                                type = NavType.StringType
                                defaultValue = "false"
                            },
                            navArgument(ChildRoutes.CHAT_IDENTITY_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_LOCALITY_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_ONLINE_KEY) {
                                type = NavType.StringType
                                defaultValue = "false"
                            },
                            navArgument(ChildRoutes.CHAT_TIER_NAME_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_TIER_RANK_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_SCROLL_TO_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_TOPIC_TYPE_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_TOPIC_REF_ID_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_TOPIC_TITLE_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument(ChildRoutes.CHAT_GIG_ID_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { entry ->
                    val args = entry.arguments ?: return@composable
                    val kind = args.getString(ChildRoutes.CHAT_KIND_KEY).orEmpty()
                    val id = args.getString(ChildRoutes.CHAT_ID_KEY).orEmpty()
                    val name = args.getString(ChildRoutes.CHAT_NAME_KEY).orEmpty()
                    val initials = args.getString(ChildRoutes.CHAT_INITIALS_KEY).orEmpty()
                    val verified = args.getString(ChildRoutes.CHAT_VERIFIED_KEY) == "true"
                    val locality = args.getString(ChildRoutes.CHAT_LOCALITY_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val online = args.getString(ChildRoutes.CHAT_ONLINE_KEY) == "true"
                    val tierName = args.getString(ChildRoutes.CHAT_TIER_NAME_KEY).orEmpty().ifEmpty { "Free" }
                    val tierRank = args.getString(ChildRoutes.CHAT_TIER_RANK_KEY).orEmpty().toIntOrNull() ?: 1
                    val scrollTo = args.getString(ChildRoutes.CHAT_SCROLL_TO_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val topicType = args.getString(ChildRoutes.CHAT_TOPIC_TYPE_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val topicRefId = args.getString(ChildRoutes.CHAT_TOPIC_REF_ID_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val topicTitle = args.getString(ChildRoutes.CHAT_TOPIC_TITLE_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val gigId = args.getString(ChildRoutes.CHAT_GIG_ID_KEY).orEmpty().takeIf { it.isNotEmpty() }
                    val initialTopic =
                        if (topicType != null && topicTitle != null) {
                            ChatInitialTopic(topicType = topicType, topicRefId = topicRefId, title = topicTitle)
                        } else {
                            null
                        }
                    val mode: ChatThreadMode =
                        when (kind) {
                            "ai" -> ChatThreadMode.Ai
                            "room" -> ChatThreadMode.Room(id)
                            "creator" -> ChatThreadMode.Person(otherUserId = id)
                            else -> ChatThreadMode.Person(otherUserId = id)
                        }
                    val counterparty: ChatCounterparty =
                        when (kind) {
                            "ai" -> ChatCounterparty.Ai(displayName = name)
                            "room" -> ChatCounterparty.Group(displayName = name, memberCount = null)
                            "creator" ->
                                ChatCounterparty.Person(
                                    displayName = name,
                                    initials = initials,
                                    locality = locality,
                                    verified = verified,
                                    online = online,
                                )
                            else ->
                                ChatCounterparty.Person(
                                    displayName = name,
                                    initials = initials,
                                    locality = locality,
                                    verified = verified,
                                    online = online,
                                )
                        }
                    val conversationMode: ChatConversationMode =
                        when (kind) {
                            "ai" -> ChatConversationMode.AiAssistant
                            "creator" -> ChatConversationMode.CreatorThread
                            else -> ChatConversationMode.Dm
                        }
                    val creatorContext =
                        if (conversationMode == ChatConversationMode.CreatorThread) {
                            ChatCreatorThreadContext.defaults(fanTierName = tierName, fanTierRank = tierRank)
                        } else {
                            null
                        }
                    ChatConversationHost(
                        mode = mode,
                        counterparty = counterparty,
                        chrome =
                            ChatConversationChrome(
                                mode = conversationMode,
                                creatorThread =
                                    creatorContext?.let {
                                        ChatCreatorThreadChrome(
                                            context = it,
                                            onOpenAudienceProfile = { navController.navigate(ChildRoutes.AUDIENCE_PROFILE) },
                                        )
                                    },
                            ),
                        onBack = { navController.popBackStack() },
                        scrollToMessageId = scrollTo,
                        initialTopic = initialTopic,
                        gigId = gigId,
                        onUseAIDraft = { draft ->
                            navController.navigate(routeForAIDraft(draft))
                        },
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                        onOpenListing = { listingId -> navController.navigate(ChildRoutes.listingDetail(listingId)) },
                    )
                }
                composable(ChildRoutes.CHAT_SEARCH) {
                    ChatSearchScreen(
                        onOpenResult = { result ->
                            navController.navigate(ChildRoutes.chatSearchConversation(result))
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.NEW_MESSAGE) {
                    NewMessageScreen(
                        onCancel = { navController.popBackStack() },
                        onSelect = { destination ->
                            // Pop the picker first so back from the
                            // conversation returns to the chat list, not
                            // the picker (mirrors iOS InboxTabRoot).
                            navController.popBackStack()
                            navController.navigate(
                                ChildRoutes.chatConversationFromPicker(
                                    userId = destination.userId,
                                    displayName = destination.displayName,
                                    initials = destination.initials,
                                    verified = destination.verified,
                                    locality = destination.locality,
                                ),
                            )
                        },
                        onInvite = { appContext.shareText(InviteLinks.INVITE_MESSAGE, "Invite to Pantopus") },
                    )
                }
                composable(ChildRoutes.PULSE_FEED) {
                    FeedScreen(
                        onOpenPost = { postId -> navController.navigate(ChildRoutes.pulsePost(postId)) },
                        onCompose = { intent -> navController.navigate(ChildRoutes.composePost(intent.key)) },
                        onBack = { navController.popBackStack() },
                        onComposeStarter = { starter ->
                            navController.navigate(
                                ChildRoutes.composePost(PulseIntent.Ask.key, starter.placeholder),
                            )
                        },
                    )
                }
                composable(ChildRoutes.BEACONS_FEED) {
                    BeaconsFeedScreen(
                        onOpenPost = { postId -> navController.navigate(ChildRoutes.pulsePost(postId)) },
                        onCompose = { intent -> navController.navigate(ChildRoutes.composePost(intent.key)) },
                        onDiscover = { navController.navigate(ChildRoutes.DISCOVER_HUB) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.FOLLOWING) {
                    FollowingScreen(
                        onBack = { navController.popBackStack() },
                        onDiscover = { navController.navigate(ChildRoutes.DISCOVER_HUB) },
                        onOpenPersona = { handle -> navController.navigate(ChildRoutes.beaconProfile(handle)) },
                    )
                }
                composable(ChildRoutes.MARKETPLACE) {
                    MarketplaceScreen(
                        onOpenListing = { listingId -> navController.navigate(ChildRoutes.listingDetail(listingId)) },
                        onCompose = { navController.navigate(ChildRoutes.COMPOSE_LISTING) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.LISTING_DETAIL,
                    arguments = listOf(navArgument(ChildRoutes.LISTING_DETAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    ListingDetailScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMessages = { listing ->
                            listing.userId?.let { sellerId ->
                                val name = listing.title ?: "Seller"
                                navController.navigate(
                                    ChildRoutes.chatConversationFromPicker(
                                        userId = sellerId,
                                        displayName = name,
                                        initials = initialsFromName(name),
                                        verified = false,
                                        locality = listing.locationName,
                                        topicType = "listing",
                                        topicRefId = listing.id,
                                        topicTitle = name,
                                    ),
                                )
                            }
                        },
                        onViewOffers = { dto ->
                            navController.navigate(ChildRoutes.listingOffers(dto.id, dto.title))
                        },
                        onEditListing = { dto ->
                            navController.navigate(ChildRoutes.editListing(dto.id))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.LISTING_OFFERS,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.LISTING_OFFERS_ID_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.LISTING_OFFERS_TITLE_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { entry ->
                    val listingId = entry.arguments?.getString(ChildRoutes.LISTING_OFFERS_ID_KEY).orEmpty()
                    ListingOffersScreen(
                        onBack = { navController.popBackStack() },
                        onShareListing = {
                            appContext.shareText(
                                "Check out this listing on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                "Share listing",
                            )
                        },
                        onOpenBuyer = { buyer -> navController.navigate(ChildRoutes.publicProfile(buyer.id)) },
                        onOpenTransaction = { navController.navigate(ChildRoutes.placeholder("Transaction detail")) },
                        onEditPrice = {
                            navController.navigate(
                                ChildRoutes.editListing(
                                    listingId = listingId,
                                    jumpToStep = ListingComposeStep.Price.name,
                                ),
                            )
                        },
                    )
                }
                composable(
                    route = ChildRoutes.INVOICE_DETAIL,
                    arguments = listOf(navArgument(ChildRoutes.INVOICE_DETAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    InvoiceDetailScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.COMPOSE_LISTING) {
                    ListingComposeWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenListingDetail = { listingId ->
                            // Pop the wizard then push detail so Back returns to
                            // Marketplace, not the success screen.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.listingDetail(listingId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_LISTING,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.EDIT_LISTING_ID_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.EDIT_LISTING_JUMP_TO_STEP_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) {
                    ListingComposeWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenListingDetail = { _ -> navController.popBackStack() },
                        onListingUpdated = { _ ->
                            // Pop the edit wizard. The detail / offers screen
                            // underneath refreshes from its own LaunchedEffect.
                            navController.popBackStack()
                        },
                    )
                }
                composable(ChildRoutes.GIGS_FEED) {
                    GigsFeedScreen(
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                        onCompose = { category -> navController.navigate(ChildRoutes.composeGig(category.key)) },
                        onOpenMap = { category -> navController.navigate(ChildRoutes.tasksMap(category.key)) },
                        onOpenSearch = { navController.navigate(ChildRoutes.GIG_SEARCH) },
                        onBack = { navController.popBackStack() },
                        onOpenSupportTrain = { trainId ->
                            navController.navigate(ChildRoutes.supportTrainDetail(trainId))
                        },
                        onOpenMyTasks = { navController.navigate(ChildRoutes.MY_TASKS) },
                        onOpenMySupportTrains = { navController.navigate(ChildRoutes.SUPPORT_TRAINS) },
                    )
                }
                composable(ChildRoutes.GIG_SEARCH) {
                    GigSearchScreen(
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.UNIVERSAL_SEARCH) {
                    UniversalSearchScreen(
                        onOpen = { destination ->
                            navController.navigate(routeForUniversalSearch(destination))
                        },
                        onBrowseNearbyBusinesses = {
                            navController.navigate(ChildRoutes.DISCOVER_BUSINESSES)
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.GIG_DETAIL,
                    arguments = listOf(navArgument(ChildRoutes.GIG_DETAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    GigDetailScreen(
                        onBack = { navController.popBackStack() },
                        onOpenChat = { roomId, displayName, initials, verified ->
                            navController.navigate(
                                ChildRoutes.chatConversationRoom(
                                    roomId = roomId,
                                    displayName = displayName,
                                    initials = initials,
                                    verified = verified,
                                ),
                            )
                        },
                    )
                }
                composable(
                    route = ChildRoutes.NEARBY_MAP_FOR_GIGS,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.NEARBY_MAP_FOR_GIGS_CATEGORY_KEY) {
                                type = NavType.StringType
                                defaultValue = GigsCategory.All.key
                            },
                        ),
                ) { entry ->
                    val raw =
                        entry.arguments?.getString(ChildRoutes.NEARBY_MAP_FOR_GIGS_CATEGORY_KEY) ?: GigsCategory.All.key
                    TasksMapScreen(
                        onOpenTask = { taskId -> navController.navigate(ChildRoutes.gigDetail(taskId)) },
                        onCompose = { category -> navController.navigate(ChildRoutes.composeGig(category.key)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.QUICK_POST_GIG,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.QUICK_POST_GIG_CATEGORY_KEY) {
                                type = NavType.StringType
                                defaultValue = GigsCategory.All.key
                            },
                            // P4 — set when opened as the owner's gig editor;
                            // PostGigV1ViewModel reads it via SavedStateHandle.
                            navArgument(ChildRoutes.QUICK_POST_GIG_EDIT_ID_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) { entry ->
                    val raw = entry.arguments?.getString(ChildRoutes.QUICK_POST_GIG_CATEGORY_KEY) ?: GigsCategory.All.key
                    PostGigV1Screen(
                        onDismiss = { navController.popBackStack() },
                        onPosted = { gigId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.gigDetail(gigId))
                        },
                        preselectedCategoryKey = raw,
                    )
                }
                composable(
                    route = ChildRoutes.COMPOSE_GIG,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.COMPOSE_GIG_CATEGORY_KEY) {
                                type = NavType.StringType
                                defaultValue = GigsCategory.All.key
                            },
                        ),
                ) { entry ->
                    val raw = entry.arguments?.getString(ChildRoutes.COMPOSE_GIG_CATEGORY_KEY) ?: GigsCategory.All.key
                    GigComposeWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenGigDetail = { gigId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.gigDetail(gigId))
                        },
                        preselectedCategoryKey = raw,
                    )
                }
                composable(
                    route = ChildRoutes.COMPOSE_POST,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.COMPOSE_INTENT_KEY) {
                                type = NavType.StringType
                                defaultValue = PulseIntent.All.key
                            },
                            navArgument(ChildRoutes.COMPOSE_BODY_KEY) {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { entry ->
                    val raw = entry.arguments?.getString(ChildRoutes.COMPOSE_INTENT_KEY) ?: PulseIntent.All.key
                    val feedIntent = PulseIntent.entries.firstOrNull { it.key == raw }
                    PulseComposeFlowScreen(
                        onBack = { navController.popBackStack() },
                        prefillFeedIntent = feedIntent,
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_POST,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.EDIT_POST_POST_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) { entry ->
                    PulseComposeFlowScreen(
                        onBack = { navController.popBackStack() },
                        editingPostId = entry.arguments?.getString(ChildRoutes.EDIT_POST_POST_ID_KEY),
                    )
                }
                composable(
                    route = ChildRoutes.NOTIFICATIONS_ROUTE,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.NOTIFICATIONS_CONTEXT_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) {
                    // The VM reads `context` from SavedStateHandle; a plain
                    // `notifications` navigate leaves it null (unscoped list).
                    NotificationsScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.RECENT_ACTIVITY) {
                    RecentActivityScreen(
                        onBack = { navController.popBackStack() },
                        onOpen = { destination ->
                            when (destination) {
                                is RecentActivityDestination.GigDetail ->
                                    navController.navigate(ChildRoutes.gigDetail(destination.id))
                                is RecentActivityDestination.ListingDetail ->
                                    navController.navigate(ChildRoutes.listingDetail(destination.id))
                                is RecentActivityDestination.MailItemDetail ->
                                    navController.navigate(ChildRoutes.mailboxItemDetail(destination.id))
                                is RecentActivityDestination.PulsePost ->
                                    navController.navigate(ChildRoutes.pulsePost(destination.id))
                                is RecentActivityDestination.HomeDashboard ->
                                    navController.navigate(ChildRoutes.homeDashboard(destination.id))
                                is RecentActivityDestination.Placeholder ->
                                    navController.navigate(ChildRoutes.placeholder(destination.label))
                            }
                        },
                    )
                }
                composable(ChildRoutes.CONNECTIONS) {
                    ConnectionsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenChat = { target: ConnectionsChatTarget ->
                            val row =
                                ConversationRowContent(
                                    id = target.userId,
                                    variant = ConversationRowVariant.Dm,
                                    displayName = target.displayName,
                                    initials = target.initials,
                                    avatarUrl = null,
                                    identityChip = null,
                                    verified = target.verified,
                                    preview = "",
                                    timeLabel = "",
                                    unread = 0,
                                    pinned = false,
                                    topicKinds = emptySet(),
                                    storageKey = "person:${target.userId}",
                                )
                            navController.navigate(ChildRoutes.chatConversation(row))
                        },
                        onFindPeople = {
                            findPeopleLauncher.launch(null)
                        },
                    )
                }
                composable(ChildRoutes.DISCOVER_HUB) {
                    DiscoverHubScreen(
                        onBack = { navController.popBackStack() },
                        onSelect = { target ->
                            when (target) {
                                is DiscoverHubTarget.Person ->
                                    navController.navigate(ChildRoutes.publicProfile(target.userId))
                                is DiscoverHubTarget.Business ->
                                    navController.navigate(ChildRoutes.businessProfile(target.businessId))
                                is DiscoverHubTarget.Gig ->
                                    navController.navigate(ChildRoutes.gigDetail(target.gigId))
                                is DiscoverHubTarget.Listing ->
                                    navController.navigate(ChildRoutes.listingDetail(target.listingId))
                                is DiscoverHubTarget.Post ->
                                    navController.navigate(ChildRoutes.pulsePost(target.postId))
                                DiscoverHubTarget.SeeAllPeople ->
                                    navController.navigate(ChildRoutes.CONNECTIONS)
                                DiscoverHubTarget.SeeAllBusinesses ->
                                    navController.navigate(ChildRoutes.DISCOVER_BUSINESSES)
                                DiscoverHubTarget.SeeAllGigs ->
                                    navController.navigate(ChildRoutes.GIGS_FEED)
                                DiscoverHubTarget.SeeAllListings ->
                                    navController.navigate(ChildRoutes.MARKETPLACE)
                                DiscoverHubTarget.SeeAllPosts ->
                                    navController.navigate(ChildRoutes.PULSE_FEED)
                            }
                        },
                        onOpenMap = { navController.navigate(ChildRoutes.EXPLORE) },
                    )
                }
                composable(ChildRoutes.DISCOVER_BUSINESSES) {
                    DiscoverBusinessesScreen(
                        onBack = { navController.popBackStack() },
                        onSelect = { target ->
                            when (target) {
                                is DiscoverBusinessesTarget.Business ->
                                    navController.navigate(ChildRoutes.businessProfile(target.businessId))
                                DiscoverBusinessesTarget.SetHomeAddress ->
                                    navController.navigate(ChildRoutes.ADD_HOME)
                                DiscoverBusinessesTarget.InviteBusiness ->
                                    appContext.composeEmail(
                                        subject = "Join Pantopus",
                                        body =
                                            "I'd love to see your business on Pantopus — neighbors near " +
                                                "me are looking for trusted local pros. ${InviteLinks.DOWNLOAD_URL}",
                                    )
                            }
                        },
                    )
                }
                composable(ChildRoutes.OFFERS) {
                    OffersScreen(
                        onBack = { navController.popBackStack() },
                        onOpenOfferDetail = { dto ->
                            val gigId = dto.gigId ?: dto.gig?.id
                            if (!gigId.isNullOrBlank()) {
                                navController.navigate(ChildRoutes.gigDetail(gigId))
                            }
                        },
                        onBrowseListings = { navController.navigate(ChildRoutes.MARKETPLACE) },
                        onPostTask = { navController.navigate(ChildRoutes.COMPOSE_TASK) },
                    )
                }
                composable(ChildRoutes.MY_BIDS) {
                    MyBidsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenBid = { dto ->
                            val gigId = dto.gigId ?: dto.gig?.id
                            if (!gigId.isNullOrBlank()) {
                                navController.navigate(ChildRoutes.gigDetail(gigId))
                            }
                        },
                        onBrowseTasks = { navController.navigate(ChildRoutes.GIGS_FEED) },
                        onMessageClient = { dto ->
                            // Push to gig detail; "Message poster" is wired there.
                            val gigId = dto.gigId ?: dto.gig?.id
                            if (!gigId.isNullOrBlank()) {
                                navController.navigate(ChildRoutes.gigDetail(gigId))
                            }
                        },
                        // Edit-bid + Leave-review are presented as sheets from
                        // inside the screen (P3.4) — no router wiring needed.
                    )
                }
                composable(ChildRoutes.MY_TASKS) {
                    MyTasksScreen(
                        onBack = { navController.popBackStack() },
                        onOpenTask = { dto -> navController.navigate(ChildRoutes.gigDetail(dto.id)) },
                        onOpenBids = { dto -> navController.navigate(ChildRoutes.gigDetail(dto.id)) },
                        // P4 — Edit reopens the V1 quick-post screen prefilled.
                        onEditTask = { dto -> navController.navigate(ChildRoutes.editGig(dto.id)) },
                        onMessageWorker = { dto -> navController.navigate(ChildRoutes.gigDetail(dto.id)) },
                        onLeaveReview = { dto -> navController.navigate(ChildRoutes.gigDetail(dto.id)) },
                        onPostTask = { navController.navigate(ChildRoutes.COMPOSE_TASK) },
                        onRepost = { navController.navigate(ChildRoutes.COMPOSE_TASK) },
                        onRebook = { categoryKey ->
                            navController.navigate(ChildRoutes.composeGig(categoryKey))
                        },
                    )
                }
                composable(ChildRoutes.COMPOSE_TASK) {
                    GigComposeWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenGigDetail = { gigId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.gigDetail(gigId))
                        },
                        preselectedCategoryKey = null,
                    )
                }
                composable(ChildRoutes.MY_POSTS) {
                    MyPostsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenPost = { dto -> navController.navigate(ChildRoutes.pulsePost(dto.id)) },
                        onCompose = { navController.navigate(ChildRoutes.composePost("")) },
                        onEditPost = { dto -> navController.navigate(ChildRoutes.editPost(dto.id)) },
                    )
                }
                composable(ChildRoutes.MENU) {
                    SettingsIndexScreen(
                        onClose = { navController.popBackStack() },
                        onNavigate = { route ->
                            when (route) {
                                SettingsRoute.Notifications -> navController.navigate(ChildRoutes.SETTINGS_NOTIFICATIONS)
                                SettingsRoute.Privacy -> navController.navigate(ChildRoutes.SETTINGS_PRIVACY)
                                SettingsRoute.IdentityCenter -> navController.navigate(ChildRoutes.IDENTITY_CENTER)
                                SettingsRoute.EditProfile -> navController.navigate(ChildRoutes.EDIT_PROFILE)
                                SettingsRoute.Password -> navController.navigate(ChildRoutes.SETTINGS_PASSWORD)
                                SettingsRoute.Verification -> navController.navigate(ChildRoutes.SETTINGS_VERIFICATION)
                                SettingsRoute.Devices -> navController.navigate(ChildRoutes.SETTINGS_DEVICES)
                                SettingsRoute.Blocks -> navController.navigate(ChildRoutes.SETTINGS_BLOCKED_USERS)
                                // Parked until P8.5 — see docs/t6-open-questions-decisions.md Q7.
                                SettingsRoute.DataExport -> navController.navigate(ChildRoutes.SETTINGS_DATA_EXPORT)
                                // P5.2 / A14.6 — Settings → Payments (payments-out · Stripe
                                // setup · payout routing). Distinct from A10.10 Wallet
                                // (earnings-in) which lives at `ChildRoutes.WALLET` and
                                // is reachable via the Wallet tab + `pantopus://wallet`
                                // deep link.
                                SettingsRoute.PaymentsPayouts -> navController.navigate(ChildRoutes.SETTINGS_PAYMENTS)
                                SettingsRoute.Help -> navController.navigate(ChildRoutes.SETTINGS_HELP)
                                SettingsRoute.Legal -> navController.navigate(ChildRoutes.SETTINGS_LEGAL)
                                SettingsRoute.About -> navController.navigate(ChildRoutes.SETTINGS_ABOUT)
                                SettingsRoute.ReviewClaims -> {
                                    // Close settings, push the admin queue.
                                    navController.popBackStack()
                                    navController.navigate(ChildRoutes.REVIEW_CLAIMS)
                                }
                                SettingsRoute.DidSignOut -> navController.popBackStack()
                            }
                        },
                    )
                }
                composable(ChildRoutes.EDIT_PROFILE) {
                    EditProfileScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_NOTIFICATIONS) {
                    NotificationSettingsScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_PRIVACY) {
                    PrivacySettingsScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_BLOCKED_USERS) {
                    BlockedUsersScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_PASSWORD) {
                    PasswordChangeScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_VERIFICATION) {
                    VerificationCenterScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_DEVICES) {
                    DevicesScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_DATA_EXPORT) {
                    val context = androidx.compose.ui.platform.LocalContext.current
                    DataExportScreen(
                        onBack = { navController.popBackStack() },
                        onEmailPrivacy = {
                            context.openMailto("mailto:privacy@pantopus.com?subject=Data%20export%20request")
                        },
                    )
                }
                composable(ChildRoutes.SETTINGS_HELP) {
                    val context = androidx.compose.ui.platform.LocalContext.current
                    HelpCenterScreen(
                        onBack = { navController.popBackStack() },
                        onEmailSupport = {
                            context.openMailto("mailto:support@pantopus.app?subject=Help")
                        },
                    )
                }
                composable(ChildRoutes.SETTINGS_LEGAL) {
                    LegalIndexScreen(
                        onBack = { navController.popBackStack() },
                        onSelectDocument = { doc ->
                            navController.navigate(ChildRoutes.settingsLegalContent(doc.rowId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.SETTINGS_LEGAL_CONTENT,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.SETTINGS_LEGAL_DOC_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) { entry ->
                    val docId = entry.arguments?.getString(ChildRoutes.SETTINGS_LEGAL_DOC_KEY).orEmpty()
                    val doc = LegalDocument.entries.firstOrNull { it.rowId == docId }
                    if (doc != null) {
                        LegalContentScreen(document = doc, onBack = { navController.popBackStack() })
                    } else {
                        LegalEmptyState(onBack = { navController.popBackStack() })
                    }
                }
                composable(ChildRoutes.SETTINGS_ABOUT) {
                    AboutScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.SETTINGS_PAYMENTS) {
                    PaymentsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenWallet = { navController.navigate(ChildRoutes.WALLET) },
                    )
                }
                composable(
                    route = ChildRoutes.PRIVACY_HANDSHAKE,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.PRIVACY_HANDSHAKE_HANDLE_KEY) {
                                type = NavType.StringType
                            },
                            navArgument(ChildRoutes.PRIVACY_HANDSHAKE_PRESELECTED_TIER_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) {
                    PrivacyHandshakeScreen(
                        onDismiss = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.TOKEN_ACCEPT,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.TOKEN_ACCEPT_TOKEN_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    TokenAcceptScreen(
                        onDismiss = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.CEREMONIAL_MAIL) {
                    CeremonialMailWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenMail = { mailId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.CEREMONIAL_MAIL_OPEN,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.CEREMONIAL_MAIL_OPEN_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    CeremonialMailOpenScreen(
                        onBack = { navController.popBackStack() },
                        onWriteBack = {
                            navController.navigate(ChildRoutes.CEREMONIAL_MAIL)
                        },
                    )
                }
                composable(ChildRoutes.AUDIENCE_PROFILE) {
                    val audienceViewModel: AudienceProfileViewModel = hiltViewModel()
                    AudienceProfileScreen(
                        onBack = { navController.popBackStack() },
                        onOpenFollower = { row ->
                            navController.navigate(ChildRoutes.placeholder("Follower · ${row.displayName}"))
                        },
                        onOpenThread = {
                            navController.navigate(ChildRoutes.CREATOR_INBOX)
                        },
                        onOpenBroadcast = { card, tiers ->
                            audienceViewModel.cacheBroadcastSeed(card, tiers)
                            navController.navigate(ChildRoutes.broadcastDetail(card.id))
                        },
                        onOpenSetup = {
                            navController.navigate(ChildRoutes.privacyHandshake(currentHandle))
                        },
                        onOpenCreatorInbox = {
                            navController.navigate(ChildRoutes.CREATOR_INBOX)
                        },
                        onComposeBroadcast = { personaId ->
                            navController.navigate(ChildRoutes.composeBroadcast(personaId))
                        },
                        onOpenEditPersona = {
                            // The editor resolves the signed-in user's Beacon from
                            // GET /api/personas/me, so the arg is advisory only.
                            navController.navigate(ChildRoutes.editPersona(EDIT_PERSONA_CREATE_ARG))
                        },
                        onOpenBeacons = {
                            navController.navigate(ChildRoutes.BEACONS_FEED)
                        },
                        onOpenFollowing = {
                            navController.navigate(ChildRoutes.FOLLOWING)
                        },
                        onOpenMembers = {
                            navController.navigate(ChildRoutes.CREATOR_AUDIENCE_MEMBERS)
                        },
                        viewModel = audienceViewModel,
                    )
                }
                composable(ChildRoutes.CREATOR_AUDIENCE_MEMBERS) {
                    YourAudienceScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    ChildRoutes.BROADCAST_DETAIL,
                    arguments = listOf(navArgument(BROADCAST_DETAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    BroadcastDetailScreen(
                        onBack = { navController.popBackStack() },
                        onOverflow = {},
                        onReply = { navController.navigate(ChildRoutes.CREATOR_INBOX) },
                        onBoost = null,
                        onPin = null,
                    )
                }
                composable(ChildRoutes.CREATOR_INBOX) {
                    CreatorInboxScreen(
                        onBack = { navController.popBackStack() },
                        onOpenThread = { row ->
                            // The row id IS the PersonaDmThread id — persona DMs
                            // carry no counterparty user id to fall back to.
                            navController.navigate(
                                ChildRoutes.personaDmThread(row.personaId, row.id),
                            )
                        },
                        onOpenBroadcast = { navController.navigate(ChildRoutes.AUDIENCE_PROFILE) },
                        onOpenSettings = { navController.navigate(ChildRoutes.placeholder("Inbox settings")) },
                    )
                }
                composable(
                    route = ChildRoutes.PERSONA_DM_THREAD,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.PERSONA_DM_PERSONA_ID_KEY) { type = NavType.StringType },
                            navArgument(ChildRoutes.PERSONA_DM_THREAD_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    PersonaDmThreadScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.FAN_INBOX,
                    arguments =
                        listOf(navArgument(ChildRoutes.FAN_INBOX_PERSONA_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val personaId = entry.arguments?.getString(ChildRoutes.FAN_INBOX_PERSONA_ID_KEY).orEmpty()
                    FanInboxScreen(
                        onBack = { navController.popBackStack() },
                        onChangeTier = { navController.popBackStack() },
                        onOpenThread = { threadId ->
                            // Replace the resolver so Back lands on the
                            // membership screen, not on this screen again.
                            navController.navigate(ChildRoutes.personaDmThread(personaId, threadId)) {
                                popUpTo(ChildRoutes.FAN_INBOX) { inclusive = true }
                            }
                        },
                    )
                }
                composable(ChildRoutes.IDENTITY_CENTER) {
                    IdentityCenterScreen(
                        onBack = { navController.popBackStack() },
                        onOpenIdentity = { card ->
                            when (card.kind) {
                                IdentityKind.PublicProfile ->
                                    navController.navigate(ChildRoutes.AUDIENCE_PROFILE)
                                IdentityKind.Local ->
                                    navController.navigate(ChildRoutes.placeholder("Local profile"))
                                IdentityKind.Personal ->
                                    navController.navigate(ChildRoutes.placeholder("Personal"))
                                IdentityKind.Professional ->
                                    navController.navigate(ChildRoutes.PROFESSIONAL_PROFILE)
                            }
                        },
                        onOpenPlaceholder = { label ->
                            navController.navigate(ChildRoutes.placeholder(label))
                        },
                        onOpenViewAs = { navController.navigate(ChildRoutes.VIEW_AS) },
                    )
                }
                composable(ChildRoutes.MAILBOX_SEARCH) {
                    MailboxSearchScreen(
                        onOpenMail = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.SUPPORT_TRAINS) {
                    SupportTrainsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenTrain = { trainId ->
                            navController.navigate(ChildRoutes.supportTrainDetail(trainId))
                        },
                        onStartTrain = {
                            navController.navigate(ChildRoutes.START_SUPPORT_TRAIN)
                        },
                        onSearch = {
                            navController.navigate(ChildRoutes.SUPPORT_TRAINS_SEARCH)
                        },
                    )
                }
                composable(ChildRoutes.SUPPORT_TRAINS_SEARCH) {
                    SupportTrainsSearchScreen(
                        onOpenTrain = { trainId ->
                            navController.navigate(ChildRoutes.supportTrainDetail(trainId))
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.START_SUPPORT_TRAIN) {
                    StartSupportTrainWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenTrain = { trainId ->
                            // A10.9 (P3.1) — After publish we land on the
                            // participant detail; the organizer who just
                            // launched it reaches the review queue via
                            // the dock overflow on the detail screen.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.supportTrainDetail(trainId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.SUPPORT_TRAIN_DETAIL,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.SUPPORT_TRAIN_DETAIL_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) { entry ->
                    val trainId = entry.arguments?.getString(ChildRoutes.SUPPORT_TRAIN_DETAIL_ID_KEY).orEmpty()
                    SupportTrainDetailScreen(
                        actions =
                            SupportTrainDetailActions(
                                onBack = { navController.popBackStack() },
                                onOpenManage = {
                                    // P4.3 / A13.13 — A10.9 dock-overflow lands
                                    // on the organizer Manage Train surface (was
                                    // wired to review-signups as a stub before
                                    // A13.13 shipped).
                                    navController.navigate(ChildRoutes.manageTrain(trainId))
                                },
                                onShare = {
                                    appContext.shareText(
                                        "Join my support train on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                        "Share train",
                                    )
                                },
                                onSignUp = {
                                    // Slot-claim sheet lands with the
                                    // editor surface in a P3.7 follow-up — surface
                                    // the affordance via a placeholder for now so
                                    // the dock CTA remains testable.
                                    navController.navigate(ChildRoutes.placeholder("Claim a slot"))
                                },
                                onEditSlot = {
                                    navController.navigate(ChildRoutes.placeholder("Edit your slot"))
                                },
                                onSendCard = {
                                    navController.navigate(ChildRoutes.placeholder("Send a card"))
                                },
                                onJoinAsBackup = {
                                    navController.navigate(ChildRoutes.placeholder("Join as backup"))
                                },
                                onMessageHost = {
                                    navController.navigate(ChildRoutes.placeholder("Message host"))
                                },
                            ),
                    )
                }
                composable(
                    route = ChildRoutes.REVIEW_SIGNUPS,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.REVIEW_SIGNUPS_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    ReviewSignupsScreen(
                        onBack = { navController.popBackStack() },
                        onShareTrain = {
                            appContext.shareText(
                                "Join my support train on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                "Share train",
                            )
                        },
                        onEditSignup = { reservationId ->
                            navController.navigate(ChildRoutes.editSignup(reservationId))
                        },
                        onMessageHelper = { reservationId ->
                            navController.navigate(ChildRoutes.placeholder("Message helper · $reservationId"))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.EDIT_SIGNUP,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.EDIT_SIGNUP_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    EditSignupFormScreen(
                        onClose = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.MANAGE_TRAIN,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.MANAGE_TRAIN_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    ManageTrainScreen(
                        onBack = { navController.popBackStack() },
                        onOpenAnalytics = { id ->
                            navController.navigate(ChildRoutes.placeholder("Train analytics · $id"))
                        },
                        onEditDates = { id ->
                            navController.navigate(ChildRoutes.placeholder("Edit dates · $id"))
                        },
                        onInviteHelpers = { id ->
                            navController.navigate(ChildRoutes.placeholder("Invite helpers · $id"))
                        },
                    )
                }
                composable(ChildRoutes.REVIEW_CLAIMS) {
                    ReviewClaimsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenClaim = { claimId ->
                            navController.navigate(ChildRoutes.reviewClaimDetail(claimId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.REVIEW_CLAIM_DETAIL,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.REVIEW_CLAIM_DETAIL_ID_KEY) {
                                type = NavType.StringType
                            },
                        ),
                ) {
                    // VM reads `claimId` from SavedStateHandle via the
                    // `CLAIM_ID_KEY` constant, which mirrors
                    // `REVIEW_CLAIM_DETAIL_ID_KEY` above.
                    ReviewClaimDetailScreen(
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.PLACEHOLDER,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.PLACEHOLDER_LABEL_KEY) {
                                type = NavType.StringType
                                defaultValue = "This"
                            },
                        ),
                ) { entry ->
                    val label = entry.arguments?.getString(ChildRoutes.PLACEHOLDER_LABEL_KEY) ?: "This"
                    NotYetAvailableView(tabName = label, icon = PantopusIcon.Info)
                }
                // ---- Wave A bootstrap placeholders. Swap each body for the real
                // screen when the matching A.x screen ships. ----
                composable(
                    ChildRoutes.TODAY_DETAIL,
                    arguments =
                        listOf(
                            navArgument("briefingDeliveryId") {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument("briefingKind") {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) {
                    TodayDetailScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.WALLET) {
                    // Withdraw + payout setup (Block 3C) are handled inside
                    // WalletScreen via WalletViewModel (Stripe Connect onboarding /
                    // dashboard / withdraw); only navigation stays as callbacks.
                    WalletScreen(
                        onBack = { navController.popBackStack() },
                        onOpenHistory = { navController.navigate(ChildRoutes.WALLET_ACTIVITY) },
                        onOpenTaxDocs = {
                            navController.navigate(ChildRoutes.placeholder("Tax documents"))
                        },
                        onSeeAllActivity = { navController.navigate(ChildRoutes.WALLET_ACTIVITY) },
                    )
                }
                composable(ChildRoutes.WALLET_ACTIVITY) {
                    WalletActivityListScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.PROPERTY_DETAILS,
                    arguments =
                        listOf(navArgument(ChildRoutes.PROPERTY_DETAILS_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(ChildRoutes.PROPERTY_DETAILS_HOME_ID_KEY).orEmpty()
                    PropertyDetailsScreen(
                        onBack = { navController.popBackStack() },
                        onRequestCorrection = {
                            navController.navigate(ChildRoutes.propertyCorrection(homeId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.ADD_GUEST,
                    arguments = listOf(navArgument(ADD_GUEST_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    AddGuestFormScreen(
                        onClose = { navController.popBackStack() },
                        onSent = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.GUEST_PASSES,
                    arguments = listOf(navArgument(GUEST_PASSES_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    // A13.6 — Guest-pass manager. The FAB pushes the Add
                    // Guest form; popping back re-fetches so the new pass
                    // appears.
                    val homeId = entry.arguments?.getString(GUEST_PASSES_HOME_ID_KEY).orEmpty()
                    GuestPassesListScreen(
                        onBack = { navController.popBackStack() },
                        onAddGuest = { navController.navigate(ChildRoutes.addGuest(homeId)) },
                    )
                }
                composable(
                    route = ChildRoutes.TRANSFER_OWNERSHIP,
                    arguments = listOf(navArgument(TRANSFER_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    TransferOwnershipScreen(
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.TASKS_MAP,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.TASKS_MAP_CATEGORY_KEY) {
                                type = NavType.StringType
                                defaultValue = GigsCategory.All.key
                            },
                        ),
                ) {
                    TasksMapScreen(
                        onOpenTask = { taskId -> navController.navigate(ChildRoutes.gigDetail(taskId)) },
                        onCompose = { category -> navController.navigate(ChildRoutes.composeGig(category.key)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.EXPLORE_ROUTE,
                    arguments =
                        listOf(
                            navArgument(ChildRoutes.EXPLORE_LAT_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                            navArgument(ChildRoutes.EXPLORE_LNG_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                            navArgument(ChildRoutes.EXPLORE_LABEL_KEY) {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            },
                        ),
                ) { entry ->
                    val latitude = entry.arguments?.getString(ChildRoutes.EXPLORE_LAT_KEY)?.toDoubleOrNull()
                    val longitude = entry.arguments?.getString(ChildRoutes.EXPLORE_LNG_KEY)?.toDoubleOrNull()
                    val focus =
                        if (latitude != null && longitude != null) {
                            ExploreMapFocus(
                                latitude = latitude,
                                longitude = longitude,
                                label = entry.arguments?.getString(ChildRoutes.EXPLORE_LABEL_KEY).orEmpty(),
                            )
                        } else {
                            null
                        }
                    ExploreMapScreen(
                        focus = focus,
                        onOpenEntity = { entity: ExploreEntity ->
                            when (entity.kind) {
                                ExploreKind.Task -> navController.navigate(ChildRoutes.gigDetail(entity.id))
                                ExploreKind.Item -> navController.navigate(ChildRoutes.listingDetail(entity.id))
                                ExploreKind.Post -> navController.navigate(ChildRoutes.pulsePost(entity.id))
                                ExploreKind.Spot -> navController.navigate(ChildRoutes.businessProfile(entity.id))
                                // `homes` markers are neighborhood addresses,
                                // not homes the viewer owns — the backend has
                                // no viewer-facing detail route for someone
                                // else's home, so the tap selects the pin and
                                // the rail card carries the address.
                                ExploreKind.Home -> Unit
                            }
                        },
                        onOpenSaved = { navController.navigate(ChildRoutes.SAVED_PLACES) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.SAVED_PLACES) {
                    SavedPlacesScreen(
                        onBack = { navController.popBackStack() },
                        onExplore = {
                            navController.navigate(ChildRoutes.EXPLORE) {
                                popUpTo(ChildRoutes.SAVED_PLACES) { inclusive = true }
                                launchSingleTop = true
                            }
                        },
                        onOpenMap = { latitude, longitude, label ->
                            navController.navigate(ChildRoutes.explore(latitude, longitude, label)) {
                                popUpTo(ChildRoutes.SAVED_PLACES) { inclusive = true }
                                launchSingleTop = true
                            }
                        },
                    )
                }
                composable(ChildRoutes.MAILBOX_ROOT) {
                    MailboxRootScreen(
                        onOpenMail = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                        onOpenSearch = { navController.navigate(ChildRoutes.MAILBOX_SEARCH) },
                        onOpenMap = { navController.navigate(ChildRoutes.MAILBOX_MAP) },
                        onOpenMailDay = { navController.navigate(ChildRoutes.mailDay()) },
                        onOpenEarn = { navController.navigate(ChildRoutes.EARN) },
                        onOpenVacationHold = { navController.navigate(ChildRoutes.MAILBOX_VACATION) },
                        onOpenStamps = { navController.navigate(ChildRoutes.STAMPS) },
                        onOpenUnboxing = { navController.navigate(ChildRoutes.unboxing()) },
                        onOpenCompose = { navController.navigate(ChildRoutes.CEREMONIAL_MAIL) },
                        onOpenRoutingQueue = { navController.navigate(ChildRoutes.MAIL_ROUTING_QUEUE) },
                        onOpenMailParty = { navController.navigate(ChildRoutes.MAILBOX_PARTY) },
                        onOpenCommunity = { navController.navigate(ChildRoutes.MAILBOX_COMMUNITY) },
                        onOpenRecords = { navController.navigate(ChildRoutes.MAILBOX_HOME_RECORDS) },
                        onOpenMailTasks = { navController.navigate(ChildRoutes.mailTaskList()) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.MAILBOX_PARTY) {
                    MailPartyScreen(
                        onBack = { navController.popBackStack() },
                        // Declining a party opens the item solo — the same
                        // mail detail the drawer rows push.
                        onOpenMail = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                    )
                }
                composable(ChildRoutes.MAILBOX_COMMUNITY) {
                    CommunityMailScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.MAILBOX_HOME_RECORDS) {
                    HomeRecordsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMail = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                    )
                }
                composable(ChildRoutes.MAILBOX_MAP) {
                    MailboxMapScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.MAILBOX_VACATION) {
                    VacationHoldScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.MAIL_DAY,
                    arguments = listOf(navArgument(MAIL_DAY_VARIANT_KEY) { type = NavType.StringType }),
                ) {
                    MailDayScreen(
                        onClose = { navController.popBackStack() },
                        onScan = { /* Out of scope per A13.16 — scanner integration */ },
                        onSeeHistory = { /* Out of scope */ },
                        onOpenNudge = { /* Out of scope */ },
                    )
                }
                // ---- Batch 2 (B1.6) routing seam. Swap each body for the real
                // screen when the matching A.x screen ships. ----
                composable(ChildRoutes.STAMPS) {
                    StampsScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.MAIL_TASK,
                    arguments = listOf(navArgument(ChildRoutes.MAIL_TASK_ID_KEY) { type = NavType.StringType }),
                ) {
                    // A17.12 — Mail-derived task detail. Source-mail + next-up
                    // taps push the originating mail item onto this same stack.
                    MailTaskScreen(
                        onBack = { navController.popBackStack() },
                        onOpenMail = { mailId ->
                            navController.navigate(ChildRoutes.mailboxItemDetail(mailId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.MAIL_TASK_LIST,
                    arguments =
                        listOf(
                            navArgument(MAIL_TASK_LIST_MAIL_ID_KEY) {
                                type = NavType.StringType
                                defaultValue = MAIL_TASK_LIST_NONE
                            },
                            navArgument(MAIL_TASK_LIST_SUBJECT_KEY) {
                                type = NavType.StringType
                                defaultValue = MAIL_TASK_LIST_NONE
                            },
                            navArgument(MAIL_TASK_LIST_SENDER_KEY) {
                                type = NavType.StringType
                                defaultValue = MAIL_TASK_LIST_NONE
                            },
                        ),
                ) {
                    // A17.12 (list) — every mail-linked task, plus the
                    // create-from-mail form when the route carries a mail id.
                    MailTaskListScreen(
                        onBack = { navController.popBackStack() },
                        onOpenTask = { taskId -> navController.navigate(ChildRoutes.mailTask(taskId)) },
                        onPostAsNeighborTask = { sourceMailId ->
                            // A17.8 — RN's "Post as Neighbor Task Instead"
                            // (`mailbox/tasks.tsx:236`) always escalates in
                            // post-delivery mode.
                            navController.navigate(
                                ChildRoutes.packageGig(mailId = sourceMailId, isPreDelivery = false),
                            )
                        },
                    )
                }
                composable(
                    route = ChildRoutes.TRANSLATION,
                    arguments = listOf(navArgument(ChildRoutes.TRANSLATION_MAIL_ID_KEY) { type = NavType.StringType }),
                ) {
                    MailTranslationScreen(
                        onBack = { navController.popBackStack() },
                        onReply = { navController.navigate(ChildRoutes.placeholder("Reply in English")) },
                    )
                }
                composable(
                    route = ChildRoutes.UNBOXING,
                    arguments =
                        listOf(
                            navArgument(UNBOXING_MAIL_ID_KEY) {
                                type = NavType.StringType
                                defaultValue = UNBOXING_MAIL_ID_NONE
                            },
                        ),
                ) {
                    // A17.14 — the capture flow loads the real `MailPackage` row for
                    // the routed mail id and every action writes to the p2 package
                    // routes. Without a mail id there is nothing to persist, and the
                    // screen says so rather than projecting a fixture.
                    UnboxingScreen(
                        onBack = { navController.popBackStack() },
                        onScanNext = { /* re-arms capture in-place — stays on this screen */ },
                        onOpenDrawer = { navController.navigate(ChildRoutes.MAILBOX_VAULT) },
                    )
                }
                composable(
                    route = ChildRoutes.PACKAGE_GIG,
                    arguments =
                        listOf(
                            navArgument(PACKAGE_GIG_MAIL_ID_KEY) {
                                type = NavType.StringType
                                defaultValue = PACKAGE_GIG_MAIL_ID_NONE
                            },
                            navArgument(PACKAGE_GIG_MODE_KEY) {
                                type = NavType.StringType
                                defaultValue = PACKAGE_GIG_MODE_POST
                            },
                        ),
                ) {
                    // A17.8 → "Ask a Neighbor" — posts the package-help gig via
                    // `POST api/mailbox/v2/p2/package/:mailId/gig` and deep-links
                    // into the created gig, matching RN `mailbox/gig.tsx`.
                    PackageGigScreen(
                        onBack = { navController.popBackStack() },
                        onOpenGig = { gigId -> navController.navigate(ChildRoutes.gigDetail(gigId)) },
                    )
                }
                composable(ChildRoutes.EARN) {
                    EarnScreen(
                        onBack = { navController.popBackStack() },
                        onHelp = { navController.navigate(ChildRoutes.placeholder("Earn help")) },
                        onCashOut = { navController.navigate(ChildRoutes.SETTINGS_PAYMENTS) },
                        onBrowseTasks = { navController.navigate(ChildRoutes.GIGS_FEED) },
                        onReferNeighbor = { navController.navigate(ChildRoutes.placeholder("Refer a neighbor")) },
                        onOfferService = { navController.navigate(ChildRoutes.placeholder("Offer a service")) },
                        onManagePayout = { navController.navigate(ChildRoutes.SETTINGS_PAYMENTS) },
                        onAddBank = { navController.navigate(ChildRoutes.SETTINGS_PAYMENTS) },
                        onSeeAllEarnings = { navController.navigate(ChildRoutes.placeholder("All earnings")) },
                        onOpenTaxDocs = { navController.navigate(ChildRoutes.placeholder("Tax documents")) },
                    )
                }
                composable(
                    route = ChildRoutes.BUSINESS_OWNER,
                    arguments = listOf(navArgument(ChildRoutes.BUSINESS_OWNER_ID_KEY) { type = NavType.StringType }),
                ) { backStackEntry ->
                    val businessId = backStackEntry.arguments?.getString(ChildRoutes.BUSINESS_OWNER_ID_KEY) ?: ""
                    BusinessOwnerScreen(
                        onBack = { navController.popBackStack() },
                        onEditPage = { navController.navigate(ChildRoutes.editBusinessPage(businessId)) },
                        onOpenInsights = { navController.navigate(ChildRoutes.placeholder("Insights")) },
                        onOpenSettings = { navController.navigate(ChildRoutes.placeholder("Business settings")) },
                        onOpenTeam = { navController.navigate(ChildRoutes.businessTeam(businessId)) },
                        onOpenPages = { navController.navigate(ChildRoutes.businessPages(businessId)) },
                        onOpenPayments = {
                            navController.navigate(ChildRoutes.businessPaymentsOwner(businessId))
                        },
                        onOpenInvoices = {
                            navController.navigate(ChildRoutes.businessInvoicesOwner(businessId))
                        },
                        onOpenLegal = { navController.navigate(ChildRoutes.businessLegal(businessId)) },
                        onOpenChatRoom = { roomId, name, _ ->
                            navController.navigate(
                                ChildRoutes.chatConversationRoom(
                                    roomId = roomId,
                                    displayName = name,
                                    initials = initialsFromName(name),
                                    verified = false,
                                ),
                            )
                        },
                        onOpenPost = { postId -> navController.navigate(ChildRoutes.pulsePost(postId)) },
                    )
                }
                composable(
                    route = ChildRoutes.BUSINESS_TEAM,
                    arguments = listOf(navArgument(ChildRoutes.BUSINESS_OWNER_ID_KEY) { type = NavType.StringType }),
                ) {
                    BusinessTeamScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.BUSINESS_PAYMENTS_OWNER,
                    arguments = listOf(navArgument(ChildRoutes.BUSINESS_OWNER_ID_KEY) { type = NavType.StringType }),
                ) {
                    BusinessPaymentsScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.BUSINESS_INVOICES_OWNER,
                    arguments = listOf(navArgument(ChildRoutes.BUSINESS_OWNER_ID_KEY) { type = NavType.StringType }),
                ) {
                    BusinessInvoicesScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.BUSINESS_LEGAL,
                    arguments = listOf(navArgument(ChildRoutes.BUSINESS_OWNER_ID_KEY) { type = NavType.StringType }),
                ) {
                    BusinessLegalScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.BUSINESS_LOCATIONS,
                    arguments =
                        listOf(navArgument(BUSINESS_LOCATIONS_BUSINESS_ID_KEY) { type = NavType.StringType }),
                ) {
                    BusinessLocationsScreen(onBack = { navController.popBackStack() })
                }
                composable(ChildRoutes.VIEW_AS) {
                    ViewAsScreen(
                        onBack = { navController.popBackStack() },
                        onManagePrivacy = { navController.navigate(ChildRoutes.SETTINGS_PRIVACY) },
                        onEdit = { navController.navigate(ChildRoutes.EDIT_PROFILE) },
                    )
                }
                composable(
                    route = ChildRoutes.WAITING_ROOM,
                    arguments = listOf(navArgument(ChildRoutes.WAITING_ROOM_HOME_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    val homeId = entry.arguments?.getString(ChildRoutes.WAITING_ROOM_HOME_ID_KEY).orEmpty()
                    WaitingRoomRoute(
                        onBack = { navController.popBackStack() },
                        onNav = { nav ->
                            when (nav) {
                                WaitingRoomNav.Notifications ->
                                    navController.navigate(ChildRoutes.NOTIFICATIONS)
                                is WaitingRoomNav.BackToHome ->
                                    navController.navigate(ChildRoutes.homeDashboard(nav.homeId)) {
                                        popUpTo(ChildRoutes.homeDashboard(nav.homeId)) { inclusive = true }
                                    }
                                is WaitingRoomNav.ViewClaim ->
                                    navController.navigate(ChildRoutes.MY_CLAIMS)
                                is WaitingRoomNav.UpdateEvidence ->
                                    navController.navigate(ChildRoutes.claimOwnership(nav.homeId))
                                is WaitingRoomNav.CancelClaim ->
                                    navController.navigate(ChildRoutes.cancelClaim(nav.homeId))
                                // Verification Center action cards.
                                is WaitingRoomNav.VerifyPostcard ->
                                    navController.navigate(ChildRoutes.postcardVerification(nav.homeId))
                                is WaitingRoomNav.UploadProof ->
                                    navController.navigate(ChildRoutes.verifyResidency(nav.homeId))
                                is WaitingRoomNav.LandlordVerification ->
                                    navController.navigate(ChildRoutes.verifyLandlord(nav.homeId))
                                is WaitingRoomNav.LeaveHome ->
                                    navController.navigate(ChildRoutes.leaveHome(nav.homeId))
                                WaitingRoomNav.RequestHelp ->
                                    navController.navigate(ChildRoutes.SETTINGS_HELP)
                            }
                        },
                    )
                }
                composable(
                    route = ChildRoutes.MEMBERSHIP_DETAIL,
                    arguments =
                        listOf(navArgument(ChildRoutes.MEMBERSHIP_DETAIL_PERSONA_ID_KEY) { type = NavType.StringType }),
                ) {
                    MembershipDetailScreen(
                        onBack = { navController.popBackStack() },
                        onShare = {
                            appContext.shareText(
                                "Check out this membership on Pantopus — ${InviteLinks.DOWNLOAD_URL}",
                                "Share membership",
                            )
                        },
                        onOpenPersona = {
                            navController.navigate(ChildRoutes.AUDIENCE_PROFILE)
                        },
                        onUpdatePayment = {
                            navController.navigate(ChildRoutes.placeholder("Update payment"))
                        },
                        onCancel = {
                            navController.navigate(ChildRoutes.placeholder("Membership cancelled"))
                        },
                        // Change tier + refund request are real in-screen flows
                        // now (tier picker sheet / refund sheet), not
                        // placeholder pushes.
                        onOpenInbox = { resolvedPersonaId ->
                            navController.navigate(ChildRoutes.fanInbox(resolvedPersonaId))
                        },
                    )
                }
                composable(ChildRoutes.PROFESSIONAL_PROFILE) {
                    ProfessionalProfileScreen(onBack = { navController.popBackStack() })
                }
                composable(
                    route = ChildRoutes.EDIT_PERSONA,
                    arguments =
                        listOf(navArgument(ChildRoutes.EDIT_PERSONA_PERSONA_ID_KEY) { type = NavType.StringType }),
                ) {
                    EditPersonaScreen(
                        onClose = { navController.popBackStack() },
                        onViewBeacon = { handle -> navController.navigate(ChildRoutes.beaconProfile(handle)) },
                    )
                }
                composable(
                    route = ChildRoutes.COMPOSE_BROADCAST,
                    arguments =
                        listOf(navArgument(ChildRoutes.COMPOSE_BROADCAST_PERSONA_ID_KEY) { type = NavType.StringType }),
                ) {
                    ComposeBroadcastScreen(
                        onClose = { navController.popBackStack() },
                        onSent = { navController.popBackStack() },
                    )
                }
                composable(ChildRoutes.MY_BEACON) {
                    BeaconProfileScreen(
                        onBack = { navController.popBackStack() },
                        onEditPersona = { personaId -> navController.navigate(ChildRoutes.editPersona(personaId)) },
                        onComposeBroadcast = { personaId -> navController.navigate(ChildRoutes.composeBroadcast(personaId)) },
                        onOpenInsights = { navController.navigate(ChildRoutes.AUDIENCE_PROFILE) },
                        onCreateBeacon = { navController.navigate(ChildRoutes.editPersona(EDIT_PERSONA_CREATE_ARG)) },
                    )
                }
                composable(
                    route = ChildRoutes.BEACON_PROFILE,
                    arguments = listOf(navArgument(BEACON_HANDLE_KEY) { type = NavType.StringType }),
                ) {
                    BeaconProfileScreen(
                        onBack = { navController.popBackStack() },
                        onEditPersona = { personaId -> navController.navigate(ChildRoutes.editPersona(personaId)) },
                        onComposeBroadcast = { personaId -> navController.navigate(ChildRoutes.composeBroadcast(personaId)) },
                        onFollowHandshake = { handle, tierRank ->
                            navController.navigate(ChildRoutes.privacyHandshake(handle, tierRank))
                        },
                    )
                }
                composable(ChildRoutes.ADD_HOME) {
                    AddHomeWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenHomeDashboard = { homeId ->
                            // Pop the wizard then push the dashboard so Back
                            // returns to MyHomes, not the success screen.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.homeDashboard(homeId))
                        },
                        onOpenClaimOwnership = { homeId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.claimOwnership(homeId))
                        },
                        onOpenWaitingRoom = { homeId ->
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.waitingRoom(homeId))
                        },
                    )
                }
                composable(ChildRoutes.FIND_HOME) {
                    FindHomeScreen(
                        onBack = { navController.popBackStack() },
                        onOpenClaimOwnership = { homeId ->
                            navController.navigate(ChildRoutes.claimOwnership(homeId))
                        },
                        onOpenAddHome = { navController.navigate(ChildRoutes.ADD_HOME) },
                        onOpenInviteToken = { token ->
                            navController.navigate(ChildRoutes.tokenAccept(token))
                        },
                    )
                }
                composable(ChildRoutes.BUSINESS_WAITLIST) {
                    // Waitlist is retired — immediately forward to create wizard.
                    LaunchedEffect(Unit) {
                        navController.navigate(ChildRoutes.CREATE_BUSINESS) {
                            popUpTo(ChildRoutes.BUSINESS_WAITLIST) { inclusive = true }
                        }
                    }
                }
                composable(
                    route = ChildRoutes.CLAIM_OWNERSHIP,
                    arguments = listOf(navArgument(CLAIM_OWNERSHIP_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    ClaimOwnershipWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenClaimsList = {
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.MY_CLAIMS)
                        },
                        onOpenFindHome = {
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.FIND_HOME)
                        },
                    )
                }
                composable(
                    route = ChildRoutes.VERIFY_RESIDENCY,
                    arguments =
                        listOf(
                            navArgument(CLAIM_OWNERSHIP_HOME_ID_KEY) { type = NavType.StringType },
                            // Not part of the path — the default flips the
                            // wizard into its residency variant.
                            navArgument(CLAIM_VERIFICATION_TYPE_KEY) {
                                type = NavType.StringType
                                defaultValue = "residency"
                            },
                        ),
                ) {
                    ClaimOwnershipWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenClaimsList = {
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.MY_CLAIMS)
                        },
                        onOpenFindHome = {
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.FIND_HOME)
                        },
                    )
                }
                composable(
                    route = ChildRoutes.HOME_ISSUES,
                    arguments = listOf(navArgument(HOME_ISSUES_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    HomeIssuesListScreen(
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.VERIFY_LANDLORD,
                    arguments = listOf(navArgument(VERIFY_LANDLORD_HOME_ID_KEY) { type = NavType.StringType }),
                ) {
                    VerifyLandlordWizardScreen(
                        onDismiss = { navController.popBackStack() },
                        onOpenPostcardVerification = { resolvedHomeId ->
                            // Replace the wizard with the postcard tracker so
                            // Back returns to the home dashboard, not the
                            // wizard.
                            navController.popBackStack()
                            navController.navigate(ChildRoutes.postcardVerification(resolvedHomeId))
                        },
                    )
                }
                composable(
                    route = ChildRoutes.POSTCARD_VERIFICATION,
                    arguments =
                        listOf(
                            navArgument(POSTCARD_VERIFICATION_HOME_ID_KEY) { type = NavType.StringType },
                        ),
                ) {
                    PostcardVerificationScreen(
                        onDismiss = { navController.popBackStack() },
                        onVerified = { _ ->
                            // Pop the tracker — the underlying home dashboard
                            // refreshes on next visit.
                            navController.popBackStack()
                        },
                    )
                }
                composable(ChildRoutes.MY_CLAIMS) {
                    MyClaimsListScreen(
                        onStartNewClaim = { navController.navigate(ChildRoutes.ADD_HOME) },
                        onOpenClaim = { claimId ->
                            navController.navigate(ChildRoutes.claimStatus(claimId))
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = ChildRoutes.CLAIM_STATUS,
                    arguments =
                        listOf(navArgument(ChildRoutes.CLAIM_STATUS_CLAIM_ID_KEY) { type = NavType.StringType }),
                ) { entry ->
                    // Mirrors iOS `HubTabRoot`/`YouTabRoot` `.claimStatus`:
                    // the A18 "Under review" frame, not a placeholder. The
                    // backend masks every in-flight claim to `under_review`
                    // (`backend/routes/homeOwnership.js:2107`), so there is no
                    // per-claim detail beyond what the list row already shows.
                    val claimId = entry.arguments?.getString(ChildRoutes.CLAIM_STATUS_CLAIM_ID_KEY).orEmpty()
                    StatusWaitingScreen(
                        content = StatusWaitingContent.underReview(homeName = null),
                        onAction = { card -> if (card.id == "addEvidence") navController.popBackStack() },
                        onPrimary = { navController.popBackStack() },
                        onSecondary = { if (claimId.isNotEmpty()) navController.popBackStack() },
                    )
                }
                if (BuildConfig.DEBUG) {
                    composable(ChildRoutes.TOKEN_GALLERY) { TokenGalleryScreen() }
                }
            }
        }
    }
}

/**
 * Wraps [HubScreen] with a 44dp invisible 5-tap target in the top-leading
 * corner so debug builds can jump to the token gallery — the production
 * hub hides its toolbar so there's no visible title to attach to. No-op in
 * release builds; semantically hidden so TalkBack can't trip it.
 */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
@Suppress("ModifierMissing")
private fun HubWithDebugFiveTap(
    navController: NavHostController,
    content: @Composable () -> Unit,
) {
    if (!BuildConfig.DEBUG) {
        content()
        return
    }
    Box {
        content()
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .size(44.dp)
                    .semantics { invisibleToUser() }
                    .pointerInput(Unit) {
                        var taps = 0
                        var lastTap = 0L
                        detectTapGestures(onTap = {
                            val now = System.currentTimeMillis()
                            taps = if (now - lastTap < FIVE_TAP_WINDOW_MS) taps + 1 else 1
                            lastTap = now
                            if (taps >= 5) {
                                taps = 0
                                navController.navigate(ChildRoutes.TOKEN_GALLERY)
                            }
                        })
                    },
        )
    }
}

private const val FIVE_TAP_WINDOW_MS: Long = 1_500L

/**
 * Dispatch a Hub discovery-card tap to the matching detail route. Items
 * whose detail screen isn't built yet land on the generic placeholder
 * with a labelled title.
 */
private fun routeForDiscovery(item: DiscoveryCardContent): String =
    when (item.kind) {
        DiscoveryKind.Post -> ChildRoutes.pulsePost(item.id)
        DiscoveryKind.Person -> ChildRoutes.publicProfile(item.id)
        DiscoveryKind.Gig -> ChildRoutes.gigDetail(item.id)
        DiscoveryKind.Business -> ChildRoutes.businessProfile(item.id)
        DiscoveryKind.Unknown -> ChildRoutes.placeholder(item.title)
    }

/**
 * §1C-b — maps a navigation-drawer destination onto an existing route.
 * Destinations with no shipped native route fall back to the NotYetAvailable
 * placeholder. Home / Business destinations read the active id from [context]
 * (mirrors iOS `HubTabRoot.route(forDrawer:context:)`).
 */
@Suppress("CyclomaticComplexMethod")
private fun routeForDrawer(
    destination: NavigationDrawerDestination,
    context: NavigationDrawerContext,
): String {
    val businessId = (context as? NavigationDrawerContext.Business)?.id.orEmpty()
    val homeId = (context as? NavigationDrawerContext.Home)?.id.orEmpty()
    return when (destination) {
        NavigationDrawerDestination.MyHomes -> ChildRoutes.MY_HOMES
        NavigationDrawerDestination.MyBusinesses -> ChildRoutes.MY_BUSINESSES
        NavigationDrawerDestination.Connections -> ChildRoutes.CONNECTIONS
        NavigationDrawerDestination.Mailbox -> ChildRoutes.MAILBOX_ROOT
        NavigationDrawerDestination.ProfileAndPrivacy -> ChildRoutes.IDENTITY_CENTER
        NavigationDrawerDestination.BeaconUpdates -> ChildRoutes.BEACONS_FEED
        NavigationDrawerDestination.Search -> ChildRoutes.UNIVERSAL_SEARCH
        NavigationDrawerDestination.DiscoverNeighbors -> ChildRoutes.DISCOVER_HUB
        NavigationDrawerDestination.MyBeacon -> ChildRoutes.MY_BEACON
        NavigationDrawerDestination.MyListings -> ChildRoutes.MY_LISTINGS
        NavigationDrawerDestination.MyPulse -> ChildRoutes.MY_POSTS
        NavigationDrawerDestination.MyTasks -> ChildRoutes.MY_TASKS
        NavigationDrawerDestination.MyBids -> ChildRoutes.MY_BIDS
        NavigationDrawerDestination.OffersAndBids -> ChildRoutes.OFFERS
        NavigationDrawerDestination.PostTask -> ChildRoutes.quickPostGig(GigsCategory.All.key)
        NavigationDrawerDestination.WalletAndPayments -> ChildRoutes.WALLET
        NavigationDrawerDestination.Settings -> ChildRoutes.MENU
        NavigationDrawerDestination.HelpSupport -> ChildRoutes.SETTINGS_HELP
        // C3 — the business drawer's Payments row belongs on the business's
        // own Stripe Connect surface, not on the personal payout settings.
        NavigationDrawerDestination.BusinessPayments ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.businessPaymentsOwner(businessId)
            } else {
                ChildRoutes.SETTINGS_PAYMENTS
            }
        NavigationDrawerDestination.HomeProperty ->
            if (homeId.isNotEmpty()) {
                ChildRoutes.propertyDetails(homeId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.HomeOverview ->
            if (homeId.isNotEmpty()) {
                ChildRoutes.homeDashboard(homeId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.HomeTasks ->
            if (homeId.isNotEmpty()) ChildRoutes.homeTasks(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeIssues ->
            if (homeId.isNotEmpty()) ChildRoutes.homeIssues(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeBills ->
            if (homeId.isNotEmpty()) ChildRoutes.homeBills(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeMembers ->
            if (homeId.isNotEmpty()) ChildRoutes.homeMembers(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeMailbox -> ChildRoutes.MAILBOX_ROOT
        NavigationDrawerDestination.HomePackages ->
            if (homeId.isNotEmpty()) ChildRoutes.homePackages(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeDocuments ->
            if (homeId.isNotEmpty()) ChildRoutes.homeDocs(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeVendors -> ChildRoutes.placeholder("Vendors")
        NavigationDrawerDestination.HomeEmergency ->
            if (homeId.isNotEmpty()) ChildRoutes.homeEmergency(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.HomeSettings ->
            if (homeId.isNotEmpty()) ChildRoutes.homeSettings(homeId) else ChildRoutes.placeholder("Coming soon")
        NavigationDrawerDestination.BusinessOverview ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.businessOwner(businessId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.BusinessProfileRow ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.businessProfile(businessId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.BusinessPages ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.editBusinessPage(businessId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.BusinessTeam ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.businessTeam(businessId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.BusinessPostTask ->
            ChildRoutes.quickPostGig(GigsCategory.All.key)
        NavigationDrawerDestination.BusinessLocations ->
            if (businessId.isNotEmpty()) {
                ChildRoutes.businessLocations(businessId)
            } else {
                ChildRoutes.placeholder("Coming soon")
            }
        NavigationDrawerDestination.BusinessCatalog,
        NavigationDrawerDestination.BusinessChat,
        NavigationDrawerDestination.BusinessReviews,
        NavigationDrawerDestination.BusinessSettings,
        -> ChildRoutes.placeholder("Coming soon")
    }
}

/**
 * S2 — maps a universal-search result onto the route that opens it.
 * Mirrors iOS `HubTabRoot.route(forUniversalSearch:)`.
 *
 * Home rows come from `api/homes/discover`, which only returns
 * `public_preview` homes the viewer may not belong to. The home
 * dashboard falls back to the public profile for non-members, so it is
 * the correct landing surface for both cases.
 */
private fun routeForUniversalSearch(destination: UniversalSearchDestination): String =
    when (destination) {
        is UniversalSearchDestination.Task -> ChildRoutes.gigDetail(destination.gigId)
        is UniversalSearchDestination.Person -> ChildRoutes.publicProfile(destination.userId)
        is UniversalSearchDestination.Beacon -> ChildRoutes.beaconProfile(destination.handle)
        is UniversalSearchDestination.Business -> ChildRoutes.businessProfile(destination.businessId)
        is UniversalSearchDestination.Home -> ChildRoutes.homeDashboard(destination.homeId)
    }

/**
 * Backend `jumpBackIn` items carry a canonical web route (e.g.
 * `/app/mailbox?scope=home&homeId=…`, `/app/homes/<id>/dashboard`,
 * `/app/chat`, `/gigs/new`). Map onto a native destination; fall back
 * to a labelled placeholder when nothing matches.
 */
private fun routeForJumpBackIn(item: JumpBackItem): String {
    val path = item.route
    if (path.startsWith("/app/mailbox")) return ChildRoutes.MAILBOX_ROOT
    homeIdFromRoute(path)?.let { return ChildRoutes.homeDashboard(it) }
    if (path.startsWith("/app/chat")) return ChildRoutes.placeholder("Messages")
    if (path.startsWith("/gigs/new")) return ChildRoutes.composeGig(GigsCategory.All.key)
    if (path.startsWith("/gigs")) return ChildRoutes.GIGS_FEED
    return ChildRoutes.placeholder(item.title)
}

/** Extracts `<id>` from `/app/homes/<id>/dashboard`. */
private fun homeIdFromRoute(route: String): String? {
    val prefix = "/app/homes/"
    if (!route.startsWith(prefix)) return null
    val segment = route.removePrefix(prefix).substringBefore('/')
    return segment.takeIf { it.isNotEmpty() }
}

/**
 * Two-letter initials derived from a display name. Falls back to `··`
 * when the input has no alphanumeric content so the chat header's avatar
 * still renders.
 */
private fun initialsFromName(name: String): String {
    val joined =
        name
            .split(" ")
            .take(2)
            .mapNotNull { it.firstOrNull()?.toString() }
            .joinToString("")
            .uppercase()
    return joined.ifEmpty { "··" }
}
