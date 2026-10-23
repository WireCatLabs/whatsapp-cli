<!--
GENERATED. DO NOT EDIT.
Source: spec/bot/business-messaging-api_v23.0.yaml
Run: pnpm bot:generate
-->

# WhatsApp Cloud API coverage

63 operations from openapi v23.0.

| Operation | Call | Command | Effect | Request source | Status | Summary |
|---|---|---|---|---|---|---|
| `addPhoneNumbers` | `POST /{Version}/{Business-ID}/add_phone_numbers` | `wa <profile> bot api add-phone-numbers` | write | contract | generated | Add Phone Number to Business Account |
| `getBusinessPortfolio` | `GET /{Version}/{Business-ID}` | `wa <profile> bot api get-business-portfolio` | read | — | generated | Get Business Portfolio (Specific Fields) |
| `getOwnedWhatsAppBusinessAccounts` | `GET /{Version}/{Business-ID}/owned_whatsapp_business_accounts` | `wa <profile> bot api get-owned-whats-app-business-accounts` | read | — | generated | Get Owned WhatsApp Business Accounts |
| `getBlockedUsers` | `GET /{Version}/{Phone-Number-ID}/block_users` | `wa <profile> bot api get-blocked-users` | read | — | generated | Get blocked users |
| `blockUsers` | `POST /{Version}/{Phone-Number-ID}/block_users` | `wa <profile> bot api block-users` | write | example | generated | Block user(s) |
| `unblockUsers` | `DELETE /{Version}/{Phone-Number-ID}/block_users` | `wa <profile> bot api unblock-users` | write | example | generated | Unblock user(s) |
| `checkCallPermissions` | `GET /{Version}/{Phone-Number-ID}/call_permissions` | `wa <profile> bot api check-call-permissions` | read | — | generated | Check Call Permissions |
| `manageCalls` | `POST /{Version}/{Phone-Number-ID}/calls` | `wa <profile> bot api manage-calls` | write | contract | generated | Manage Calls |
| `sendMarketingMessage` | `POST /{Version}/{Phone-Number-ID}/marketing_messages` | `wa <profile> bot api send-marketing-message` | write | contract | generated | Send Marketing Template Message |
| `uploadMedia` | `POST /{Version}/{Phone-Number-ID}/media` | `wa <profile> bot api upload-media` | write | example | generated | Upload Image |
| `sendMessage` | `POST /{Version}/{Phone-Number-ID}/messages` | `wa <profile> bot api send-message` | write | contract | generated | Send Message. |
| `listQrCodes` | `GET /{Version}/{Phone-Number-ID}/message_qrdls` | `wa <profile> bot api list-qr-codes` | read | — | generated | List All Message QR Codes |
| `createOrUpdateQrCode` | `POST /{Version}/{Phone-Number-ID}/message_qrdls` | `wa <profile> bot api create-or-update-qr-code` | write | contract | generated | Create or Update Message QR Code |
| `getQrCode` | `GET /{Version}/{Phone-Number-ID}/message_qrdls/{QR-Code-ID}` | `wa <profile> bot api get-qr-code` | read | — | generated | Get Individual Message QR Code |
| `deleteQrCode` | `DELETE /{Version}/{Phone-Number-ID}/message_qrdls/{QR-Code-ID}` | `wa <profile> bot api delete-qr-code` | destructive | — | generated | Delete Individual Message QR Code |
| `sendEncryptedMessage` | `POST /{Version}/{Phone-Number-ID}/messages_encrypted` | `wa <profile> bot api send-encrypted-message` | write | contract | generated | Send Encrypted Message |
| `getOfficialBusinessAccountStatus` | `GET /{Version}/{Phone-Number-ID}/official_business_account` | `wa <profile> bot api get-official-business-account-status` | read | — | generated | Get Official Business Account Status |
| `requestOfficialBusinessAccount` | `POST /{Version}/{Phone-Number-ID}/official_business_account` | `wa <profile> bot api request-official-business-account` | write | contract | generated | Update Official Business Account Status |
| `getPhoneNumber` | `GET /{Version}/{Phone-Number-ID}` | `wa <profile> bot api get-phone-number` | read | — | generated | Retrieve WhatsApp Business Phone Number Information |
| `updatePhoneNumber` | `POST /{Version}/{Phone-Number-ID}` | `wa <profile> bot api update-phone-number` | write | contract | generated | Update WhatsApp Business Account Phone Number Status and Configuration |
| `deregisterPhoneNumber` | `POST /{Version}/{Phone-Number-ID}/deregister` | `wa <profile> bot api deregister-phone-number` | destructive | — | generated | Deregister WhatsApp Business Phone Number |
| `getMessageHistory` | `GET /{Version}/{Phone-Number-ID}/message_history` | `wa <profile> bot api get-message-history` | read | — | generated | Get WhatsApp Business Account Message History |
| `registerPhoneNumber` | `POST /{Version}/{Phone-Number-ID}/register` | `wa <profile> bot api register-phone-number` | destructive | contract | generated | Register WhatsApp Business Phone Number |
| `requestVerificationCode` | `POST /{Version}/{Phone-Number-ID}/request_code` | `wa <profile> bot api request-verification-code` | write | contract | generated | Request Phone Number Verification Code |
| `getPhoneNumberSettings` | `GET /{Version}/{Phone-Number-ID}/settings` | `wa <profile> bot api get-phone-number-settings` | read | — | generated | Get phone number settings |
| `updatePhoneNumberSettings` | `POST /{Version}/{Phone-Number-ID}/settings` | `wa <profile> bot api update-phone-number-settings` | write | contract | generated | Update phone number settings |
| `verifyPhoneNumberCode` | `POST /{Version}/{Phone-Number-ID}/verify_code` | `wa <profile> bot api verify-phone-number-code` | write | contract | generated | Verify Phone Number Verification Code |
| `getEncryptionPublicKey` | `GET /{Version}/{Phone-Number-ID}/whatsapp_business_encryption` | `wa <profile> bot api get-encryption-public-key` | read | — | generated | Get Business Encryption Public Key |
| `setEncryptionPublicKey` | `POST /{Version}/{Phone-Number-ID}/whatsapp_business_encryption` | `wa <profile> bot api set-encryption-public-key` | write | contract | generated | Set Business Encryption Public Key |
| `getBusinessProfile` | `GET /{Version}/{Phone-Number-ID}/whatsapp_business_profile` | `wa <profile> bot api get-business-profile` | read | — | generated | Get WhatsApp Business Profile |
| `updateBusinessProfile` | `POST /{Version}/{Phone-Number-ID}/whatsapp_business_profile` | `wa <profile> bot api update-business-profile` | write | contract | generated | Update WhatsApp Business Profile |
| `getCommerceSettings` | `GET /{Version}/{Phone-Number-ID}/whatsapp_commerce_settings` | `wa <profile> bot api get-commerce-settings` | read | — | generated | Get commerce settings |
| `setCommerceSettings` | `POST /{Version}/{Phone-Number-ID}/whatsapp_commerce_settings` | `wa <profile> bot api set-commerce-settings` | write | — | generated | Set or update commerce settings |
| `getBusinessComplianceInfo` | `GET /{Version}/{Phone-Number-ID}/business_compliance_info` | `wa <profile> bot api get-business-compliance-info` | read | — | generated | Get Business Compliance Information |
| `updateBusinessComplianceInfo` | `POST /{Version}/{Phone-Number-ID}/business_compliance_info` | `wa <profile> bot api update-business-compliance-info` | write | contract | generated | Update Business Compliance Information |
| `getMedia` | `GET /{Version}/{Media-ID}` | `wa <profile> bot api get-media` | read | — | generated | Retrieve Media URL |
| `deleteMedia` | `DELETE /{Version}/{Media-ID}` | `wa <profile> bot api delete-media` | destructive | — | generated | Delete Media |
| `getMessageHistoryEvents` | `GET /{Version}/{Message-History-ID}/events` | `wa <profile> bot api get-message-history-events` | read | — | generated | Get WhatsApp Message History Events |
| `getAssignedWhatsAppBusinessAccounts` | `GET /{Version}/{User-ID}/assigned_whatsapp_business_accounts` | `wa <profile> bot api get-assigned-whats-app-business-accounts` | read | — | generated | Get Assigned WhatsApp Business Accounts |
| `getWhatsAppAccountNumberDetails` | `GET /{Version}/{WhatsApp-Account-Number-ID}` | `wa <profile> bot api get-whats-app-account-number-details` | read | — | generated | Get WhatsApp Account Number Details |
| `getAssignedUsers` | `GET /{Version}/{WhatsApp-Business-Account-ID}/assigned_users` | `wa <profile> bot api get-assigned-users` | read | — | generated | List Assigned Users |
| `addAssignedUser` | `POST /{Version}/{WhatsApp-Business-Account-ID}/assigned_users` | `wa <profile> bot api add-assigned-user` | write | contract | generated | Add User to WhatsApp Business Account |
| `removeAssignedUser` | `DELETE /{Version}/{WhatsApp-Business-Account-ID}/assigned_users` | `wa <profile> bot api remove-assigned-user` | write | contract | generated | Remove User from WhatsApp Business Account |
| `configureConversationalAutomation` | `POST /{Version}/{Phone-Number-ID}/conversational_automation` | `wa <profile> bot api configure-conversational-automation` | write | contract | generated | Configure Conversational Automation |
| `getCreditLines` | `GET /{Version}/{Business-ID}/extendedcredits` | `wa <profile> bot api get-credit-lines` | read | — | generated | Get credit lines |
| `listPhoneNumbers` | `GET /{Version}/{WABA-ID}/phone_numbers` | `wa <profile> bot api list-phone-numbers` | read | — | generated | Get WhatsApp Business Account Phone Numbers |
| `createPhoneNumber` | `POST /{Version}/{WABA-ID}/phone_numbers` | `wa <profile> bot api create-phone-number` | write | contract | generated | Create WhatsApp Business Account Phone Number |
| `listSchedules` | `GET /{Version}/{WABA-ID}/schedules` | `wa <profile> bot api list-schedules` | read | — | generated | Get WhatsApp Business Account Schedules |
| `createSchedule` | `POST /{Version}/{WABA-ID}/schedules` | `wa <profile> bot api create-schedule` | write | contract | generated | Create WhatsApp Business Account Schedule |
| `listSubscribedApps` | `GET /{Version}/{WABA-ID}/subscribed_apps` | `wa <profile> bot api list-subscribed-apps` | read | — | generated | Get All Subscriptions for a WABA |
| `subscribeApp` | `POST /{Version}/{WABA-ID}/subscribed_apps` | `wa <profile> bot api subscribe-app` | write | contract | generated | Subscribe to WABA Webhooks |
| `unsubscribeApp` | `DELETE /{Version}/{WABA-ID}/subscribed_apps` | `wa <profile> bot api unsubscribe-app` | write | — | generated | Unsubscribe from WABA Webhooks |
| `getTemplate` | `GET /{Version}/{TEMPLATE_ID}` | `wa <profile> bot api get-template` | read | — | generated | Get template by ID (default fields) |
| `editTemplate` | `POST /{Version}/{TEMPLATE_ID}` | `wa <profile> bot api edit-template` | write | example | generated | Edit template |
| `listTemplates` | `GET /{Version}/{WABA-ID}/message_templates` | `wa <profile> bot api list-templates` | read | — | generated | Get template by name (default fields) |
| `createTemplate` | `POST /{Version}/{WABA-ID}/message_templates` | `wa <profile> bot api create-template` | write | example | generated | Create authentication template w/ OTP copy code button |
| `deleteTemplate` | `DELETE /{Version}/{WABA-ID}/message_templates` | `wa <profile> bot api delete-template` | destructive | — | generated | Delete template by name |
| `listActivities` | `GET /{Version}/{WABA-ID}/activities` | `wa <profile> bot api list-activities` | read | — | generated | Get WhatsApp Business Account Activities |
| `getBusinessAccount` | `GET /{Version}/{WABA-ID}` | `wa <profile> bot api get-business-account` | read | — | generated | Get WhatsApp Business Account Details |
| `updateBusinessAccount` | `POST /{Version}/{WABA-ID}` | `wa <profile> bot api update-business-account` | write | contract | generated | Update WhatsApp Business Account |
| `getBusinessBot` | `GET /{Version}/{WABA-Bot-ID}` | `wa <profile> bot api get-business-bot` | read | — | generated | Get WhatsApp Business Bot Details |
| `getBusinessProfileById` | `GET /{Version}/{WhatsApp-Business-Profile-ID}` | `wa <profile> bot api get-business-profile-by-id` | read | — | generated | Get WhatsApp Business Profile Details |
| `updateBusinessProfileById` | `POST /{Version}/{WhatsApp-Business-Profile-ID}` | `wa <profile> bot api update-business-profile-by-id` | write | contract | generated | Update WhatsApp Business Profile |

## Renamed

| Meta's id | Command |
|---|---|
| `getBusinessPortfolioSpecificFields` | `get-business-portfolio` |
| `blockUserS` | `block-users` |
| `unblockUserS` | `unblock-users` |
| `uploadImage` | `upload-media` |
| `listAllQrCodes` | `list-qr-codes` |
| `getIndividualQrCode` | `get-qr-code` |
| `deleteIndividualQrCode` | `delete-qr-code` |
| `GraphWhatsAppBusinessAccountToNumberCurrentStatusOfficialBusinessAccountPost` | `request-official-business-account` |
| `getPhoneNumberById` | `get-phone-number` |
| `updatePhoneNumberStatus` | `update-phone-number` |
| `registerWhatsAppBusinessPhoneNumber` | `register-phone-number` |
| `getBusinessEncryptionPublicKey` | `get-encryption-public-key` |
| `setBusinessEncryptionPublicKey` | `set-encryption-public-key` |
| `getWhatsAppBusinessProfile` | `get-business-profile` |
| `updateWhatsAppBusinessProfileInformation` | `update-business-profile` |
| `setOrUpdateCommerceSettings` | `set-commerce-settings` |
| `retrieveMediaUrl` | `get-media` |
| `getWhatsAppBusinessAccountPhoneNumbers` | `list-phone-numbers` |
| `createWhatsAppBusinessAccountPhoneNumber` | `create-phone-number` |
| `getWhatsAppBusinessAccountSchedules` | `list-schedules` |
| `createWhatsAppBusinessAccountSchedule` | `create-schedule` |
| `getAllSubscriptionsForAWaba` | `list-subscribed-apps` |
| `subscribeToWabaWebhooks` | `subscribe-app` |
| `unsubscribeFromWabaWebhooks` | `unsubscribe-app` |
| `getTemplateByIdDefaultFields` | `get-template` |
| `getTemplateByNameDefaultFields` | `list-templates` |
| `createAuthenticationTemplateWOtpCopyCodeButton` | `create-template` |
| `deleteTemplateByName` | `delete-template` |
| `getWhatsAppBusinessAccountActivities` | `list-activities` |
| `getWhatsAppBusinessAccountDetails` | `get-business-account` |
| `updateWhatsAppBusinessAccount` | `update-business-account` |
| `getWhatsAppBusinessBotDetails` | `get-business-bot` |
| `getWhatsAppBusinessProfileDetails` | `get-business-profile-by-id` |
| `updateWhatsAppBusinessProfile` | `update-business-profile-by-id` |

## Left out

| Operation | Call | Why |
|---|---|---|
| `getConnectedClientBusinesses` | `GET /{Version}/{Application-ID}/connected_client_businesses` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `createWhatsAppBusinessSolution` | `POST /{Version}/{Application-ID}/whatsapp_business_solution` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getApplicationWhatsAppBusinessSolutions` | `GET /{Version}/{Application-ID}/whatsapp_business_solutions` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getPreVerifiedPhoneNumbers` | `GET /{Version}/{Business-ID}/preverified_numbers` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getClientWhatsAppBusinessAccounts` | `GET /{Version}/{Business-ID}/client_whatsapp_business_accounts` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `onboardPartnersToMMLite` | `POST /{Version}/{Business-ID}/onboard_partners_to_mm_lite` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `sharePreVerifiedPhoneNumber` | `POST /{Version}/{Business-ID}/share_preverified_numbers` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getActiveGroups` | `GET /{Version}/{Phone-Number-ID}/groups` | Groups need the Official Business Account badge; left out until the owner has one |
| `createGroup` | `POST /{Version}/{Phone-Number-ID}/groups` | Groups need the Official Business Account badge; left out until the owner has one |
| `createGroupInviteLink` | `POST /{Version}/{group_id}/invite_link` | Groups need the Official Business Account badge; left out until the owner has one |
| `deleteGroupInviteLink` | `DELETE /{Version}/{group_id}/invite_link` | Groups need the Official Business Account badge; left out until the owner has one |
| `getJoinRequests` | `GET /{Version}/{group_id}/join_requests` | Groups need the Official Business Account badge; left out until the owner has one |
| `approveJoinRequests` | `POST /{Version}/{group_id}/join_requests` | Groups need the Official Business Account badge; left out until the owner has one |
| `rejectJoinRequests` | `DELETE /{Version}/{group_id}/join_requests` | Groups need the Official Business Account badge; left out until the owner has one |
| `addGroupParticipants` | `POST /{Version}/{group_id}/participants` | Groups need the Official Business Account badge; left out until the owner has one |
| `removeGroupParticipants` | `DELETE /{Version}/{group_id}/participants` | Groups need the Official Business Account badge; left out until the owner has one |
| `getGroupInfo` | `GET /{Version}/{group_id}` | Groups need the Official Business Account badge; left out until the owner has one |
| `updateGroupSettings` | `POST /{Version}/{group_id}` | Groups need the Official Business Account badge; left out until the owner has one |
| `deleteGroup` | `DELETE /{Version}/{group_id}` | Groups need the Official Business Account badge; left out until the owner has one |
| `downloadMedia` | `GET /{Version}/{Media-URL}` | its path is a whole URL on Meta's media host, which lives five minutes; the media commands fetch it with the token |
| `getMigrationIntentDetails` | `GET /{Version}/{Migration-Intent-ID}` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getPreVerifiedPhoneNumberDetails` | `GET /{Version}/{Pre-Verified-Phone-Number-ID}` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `deletePreVerifiedPhoneNumber` | `DELETE /{Version}/{Pre-Verified-Phone-Number-ID}` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getPreVerifiedPhoneNumberPartners` | `GET /{Version}/{Pre-Verified-Phone-Number-ID}/partners` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `requestPreVerifiedPhoneNumberCode` | `POST /{Version}/{Pre-Verified-Phone-Number-ID}/request_code` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `verifyPreVerifiedPhoneNumberCode` | `POST /{Version}/{Pre-Verified-Phone-Number-ID}/verify_code` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getSolutionAccessToken` | `GET /{Version}/{Solution-ID}/access_token` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `acceptWhatsAppBusinessSolutionDeactivationRequest` | `POST /{Version}/{Solution-ID}/accept_deactivation_request` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `acceptWhatsAppBusinessSolution` | `POST /{Version}/{Solution-ID}/accept` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getSolutionDetails` | `GET /{Version}/{Solution-ID}` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `rejectSolutionDeactivationRequest` | `POST /{Version}/{Solution-ID}/reject_deactivation_request` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `rejectSolutionRequest` | `POST /{Version}/{Solution-ID}/reject` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `sendSolutionDeactivationRequest` | `POST /{Version}/{Solution-ID}/send_deactivation_request` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `listFlows` | `GET /{Version}/{WABA-ID}/flows` | Flows are not in scope for the first bot release |
| `createFlow` | `POST /{Version}/{WABA-ID}/flows` | Flows are not in scope for the first bot release |
| `migrateFlows` | `POST /{Version}/{WABA-ID}/migrate_flows` | Flows are not in scope for the first bot release |
| `getFlow` | `GET /{Version}/{Flow-ID}` | Flows are not in scope for the first bot release |
| `updateFlowMetadata` | `POST /{Version}/{Flow-ID}` | Flows are not in scope for the first bot release |
| `deleteFlow` | `DELETE /{Version}/{Flow-ID}` | Flows are not in scope for the first bot release |
| `listAssetsGetFlowJsonUrl` | `GET /{Version}/{Flow-ID}/assets` | Flows are not in scope for the first bot release |
| `updateFlowJson` | `POST /{Version}/{Flow-ID}/assets` | Flows are not in scope for the first bot release |
| `publishFlow` | `POST /{Version}/{Flow-ID}/publish` | Flows are not in scope for the first bot release |
| `deprecateFlow` | `POST /{Version}/{Flow-ID}/deprecate` | Flows are not in scope for the first bot release |
| `getInProgressOnBehalfRequests` | `GET /{Version}/{WABA-ID}/in_progress_onbehalf_request` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `getOBOMobilityIntent` | `GET /{Version}/{OBO-Mobility-Intent-ID}` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `createOBOMobilityIntent` | `POST /{Version}/{WABA-ID}/obo_mobility_intent` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `setOBOMobilityIntent` | `POST /{Version}/{WABA-ID}/set_obo_mobility_intent` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `setSolutionMigrationIntent` | `POST /{Version}/{WABA-ID}/set_solution_migration_intent` | Tech Provider / Solution Partner only; a direct developer cannot call it |
| `listWabaSolutions` | `GET /{Version}/{WABA-ID}/solutions` | Tech Provider / Solution Partner only; a direct developer cannot call it |
