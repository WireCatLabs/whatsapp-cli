// GENERATED. DO NOT EDIT.
// Source: spec/bot/business-messaging-api_v23.0.yaml
// Run: pnpm bot:generate

import type { ManifestOperation } from "@wirecat/cli-base/codegen"

export const operations: readonly ManifestOperation[] = [
  {
    id: "addPhoneNumbers",
    command: "add-phone-numbers",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Business-ID}/add_phone_numbers",
    },
    effect: "write",
    summary: "Add Phone Number to Business Account",
    description:
      "Add a preverified phone number to a WhatsApp Business Account. This endpoint is used by\nPartners to create a pool of Partner owned numbers that end clients\ncan purchase.\n\n**Use Cases:**\n- Add new phone numbers to scale messaging operations\n- Set up phone numbers for different business locations\n- Manage phone number inventory for business messaging\n- Configure phone numbers for specific messaging workflows\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Phone Number Requirements:**\n- Must be in E.164 format (e.g., +1234567890)\n- Must not be already registered to another WhatsApp Business Account\n- Must be capable of receiving SMS for verification\n- Must comply with WhatsApp's business messaging policies\n",
    tags: ["Business Phone Numbers"],
    parameters: [
      {
        name: "Business-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID can be found in your Business Manager\nor through business management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "AddPhoneNumbersRequest",
    },
    response: {
      confidence: "contract",
      schema: "AddPhoneNumbersResponse",
    },
  },
  {
    id: "getBusinessPortfolio",
    command: "get-business-portfolio",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Business-ID}",
    },
    effect: "read",
    summary: "Get Business Portfolio (Specific Fields)",
    description:
      "Endpoint reference: [Business](https://developers.facebook.com/docs/marketing-api/reference/business/)",
    tags: ["Business Portfolio"],
    parameters: [
      {
        name: "Business-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetBusinessPortfolioResponse",
    },
  },
  {
    id: "getOwnedWhatsAppBusinessAccounts",
    command: "get-owned-whats-app-business-accounts",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Business-ID}/owned_whatsapp_business_accounts",
    },
    effect: "read",
    summary: "Get Owned WhatsApp Business Accounts",
    description:
      "Retrieve WhatsApp Business Accounts owned by the specified business. This endpoint\nprovides comprehensive information about all WABAs owned by the business, including\naccount details, configuration, and status information.\n\n**Use Cases:**\n- Retrieve all WhatsApp Business Accounts owned by a business\n- Filter accounts by business type\n- Find specific accounts by ID\n- Monitor business portfolio of WhatsApp Business Accounts\n- Manage account access and permissions across multiple WABAs\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nAccount information can be cached for short periods, but status and configuration\nmay change frequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["Owned WhatsApp Business Accounts"],
    parameters: [
      {
        name: "Business-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your Business ID. This ID represents the business portfolio that owns the\nWhatsApp Business Accounts and can be found in your Business Manager settings.\n",
      },
      {
        name: "business_type",
        in: "query",
        required: false,
        schema: {
          type: "array",
          items: {
            type: "ref",
            ref: "WhatsAppBusinessType",
          },
        },
        description:
          "Filter accounts by business type. Can specify multiple types as comma-separated values.\nUse this to filter between enterprise and small-medium business accounts.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for forward pagination. Use the cursor from the previous response\nto get the next page of results.\n",
      },
      {
        name: "first",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description:
          "Number of results to return in forward pagination. Maximum value is 100.\nUse with 'after' cursor for forward pagination.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for backward pagination. Use the cursor from the previous response\nto get the previous page of results.\n",
      },
      {
        name: "last",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description:
          "Number of results to return in backward pagination. Maximum value is 100.\nUse with 'before' cursor for backward pagination.\n",
      },
      {
        name: "find",
        in: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Find a specific WhatsApp Business Account by ID within the owned accounts.\nUse this to quickly locate a specific account.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessAccountsConnection",
    },
  },
  {
    id: "getBlockedUsers",
    command: "get-blocked-users",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/block_users",
    },
    effect: "read",
    summary: "Get blocked users",
    description:
      "- Guide: [Block Users](https://developers.facebook.com/docs/business-messaging/whatsapp/block-users)\n    \n- Endpoint reference: [GET WhatsApp Buiness Phone Number > block_users](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/block_users/#Reading)",
    tags: ["Block Users"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
  },
  {
    id: "blockUsers",
    command: "block-users",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/block_users",
    },
    effect: "write",
    summary: "Block user(s)",
    description:
      "- Guide: [Block Users](https://developers.facebook.com/docs/business-messaging/whatsapp/block-users)\n    \n- Endpoint reference: [POST WhatsApp Buiness Phone Number > block_users](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/block_users/#Creating)",
    tags: ["Block Users"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "example",
      schema: "BlockUsersRequest",
    },
  },
  {
    id: "unblockUsers",
    command: "unblock-users",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{Phone-Number-ID}/block_users",
    },
    effect: "write",
    summary: "Unblock user(s)",
    description:
      "- Guide: [Block Users](https://developers.facebook.com/docs/business-messaging/whatsapp/block-users)\n    \n- Endpoint reference: [DELETE WhatsApp Buiness Phone Number > block_users](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/block_users/#Deleting)",
    tags: ["Block Users"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "example",
      schema: "UnblockUsersRequest",
    },
  },
  {
    id: "checkCallPermissions",
    command: "check-call-permissions",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/call_permissions",
    },
    effect: "read",
    summary: "Check Call Permissions",
    description:
      "Check whether you have permission to call a WhatsApp user and what actions are available. This endpoint returns the current permission status for calling a specific user, along with available actions and their limits.\n\n**Permission Status:**\n- `granted`: You have active permission to call this user - `pending`: A permission request has been sent but not yet approved - `denied`: The user has denied call permissions - `expired`: Previous permission has expired\n\n**Available Actions:**\n- `start_call`: Initiate a new call to this user - `send_call_permission_request`: Send a permission request to this user\n\n**Error Handling:**\nThis endpoint may return various error codes including rate limiting errors if too many permission checks are made within a short period.\n",
    tags: ["Call Permissions"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
        description: "The ID of the phone number registered with your WhatsApp Business Account",
      },
      {
        name: "user_wa_id",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "The WhatsApp ID of the user you want to check call permissions for",
      },
    ],
    response: {
      confidence: "contract",
      schema: "CallPermissionCheckResponsePayload",
    },
  },
  {
    id: "manageCalls",
    command: "manage-calls",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/calls",
    },
    effect: "write",
    summary: "Manage Calls",
    description:
      'Use this endpoint to initiate, accept, reject, or terminate WhatsApp calls.\n\n**For initiating or managing a call:**\nSend a POST request with the appropriate action (connect, pre_accept, accept, reject, terminate).\n\n**For terminating a call:**\nSend a POST request with action "terminate" and the call_id.\n\n**Note:** Response with error code 138006 indicates a lack of a call request permission for this business number from the WhatsApp user.\n',
    tags: ["Calls"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
        description: "The ID of the phone number registered with your WhatsApp Business Account",
      },
    ],
    request: {
      required: false,
      confidence: "contract",
      schema: "ManageCallsRequest",
    },
    response: {
      confidence: "contract",
      schema: "ManageCallsResponse",
    },
  },
  {
    id: "sendMarketingMessage",
    command: "send-marketing-message",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/marketing_messages",
    },
    effect: "write",
    summary: "Send Marketing Template Message",
    description:
      "Send marketing template messages using pre-approved templates. Supports optional product policy controls and message activity sharing settings.",
    tags: ["Marketing Messages"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
        description: "WhatsApp Business Phone Number ID",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "MarketingMessageRequestPayload",
    },
    response: {
      confidence: "contract",
      schema: "MarketingMessageResponsePayload",
    },
  },
  {
    id: "uploadMedia",
    command: "upload-media",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/media",
    },
    effect: "write",
    summary: "Upload Image",
    description:
      "This request uploads an image as .jpeg. The parameters are specified as **form-data** in the request **body**.",
    tags: ["Media"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "example",
      schema: "UploadMediaRequest",
      contentType: "multipart/form-data",
    },
    response: {
      confidence: "contract",
      schema: "UploadMediaResponse",
    },
  },
  {
    id: "sendMessage",
    command: "send-message",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/messages",
    },
    effect: "write",
    summary: "Send Message.",
    description: "Send Message.",
    tags: ["Messages"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "contract",
      schema: "Message",
    },
    response: {
      confidence: "contract",
      schema: "MessageResponsePayload",
    },
  },
  {
    id: "listQrCodes",
    command: "list-qr-codes",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/message_qrdls",
    },
    effect: "read",
    summary: "List All Message QR Codes",
    description:
      "Retrieve all message QR codes for a phone number, sorted by creation time (newest first).\nSupports field selection, filtering by code, cursor-based pagination, and QR image generation.\n",
    tags: ["QR Code Collection"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The WhatsApp Business Account phone number ID for which to list QR codes.\nThis ID is provided when you add a phone number to your WhatsApp Business Account.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          'Comma-separated list of fields to include in the response. Available fields:\n- code: QR code identifier (always included)\n- prefilled_message: Pre-filled message text (always included)\n- deep_link_url: WhatsApp deep link URL (always included)\n- creation_time: Unix timestamp when QR code was created (first-party apps only)\n- qr_image_url.format(FORMAT): QR code image URL where FORMAT is SVG or PNG\n\nExample: "code,prefilled_message,qr_image_url.format(SVG)"\n',
      },
      {
        name: "code",
        in: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 14,
          maxLength: 14,
          pattern: "^[A-Z2-7]{14}$",
        },
        description:
          "Filter results to a specific QR code by its unique identifier.\nWhen provided, only the matching QR code will be returned (if it exists).\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 25,
        },
        description:
          "Maximum number of QR codes to return in a single response.\nDefault and maximum limit is typically 25.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the next page of results.\nObtain this value from the paging.cursors.after field in previous responses.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the previous page of results.\nObtain this value from the paging.cursors.before field in previous responses.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "QrCodeList",
    },
  },
  {
    id: "createOrUpdateQrCode",
    command: "create-or-update-qr-code",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/message_qrdls",
    },
    effect: "write",
    summary: "Create or Update Message QR Code",
    description:
      "Create a new QR code (without code parameter) or update existing QR code (with code parameter).\nSupports optional QR image generation in PNG or SVG format.\n",
    tags: ["QR Code Collection"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The WhatsApp Business Account phone number ID for which to create or update the QR code.\nThis ID is provided when you add a phone number to your WhatsApp Business Account.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "CreateOrUpdateQrCodeRequest",
    },
    response: {
      confidence: "contract",
      schema: "QrCodeResponse",
    },
  },
  {
    id: "getQrCode",
    command: "get-qr-code",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/message_qrdls/{QR-Code-ID}",
    },
    effect: "read",
    summary: "Get Individual Message QR Code",
    description:
      "Retrieve details for a specific QR code by its unique identifier.\nSupports field selection and QR image generation. Response returns QR code in data array for consistency.\n",
    tags: ["Individual QR Code"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The WhatsApp Business Account phone number ID that owns the QR code.\nThis ID is provided when you add a phone number to your WhatsApp Business Account.\n",
      },
      {
        name: "QR-Code-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          minLength: 14,
          maxLength: 14,
          pattern: "^[A-Z2-7]{14}$",
        },
        description:
          "The unique 14-character identifier of the QR code to retrieve.\nThis is the code value returned when the QR code was created.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          'Comma-separated list of fields to include in the response. Available fields:\n- code: QR code identifier (always included)\n- prefilled_message: Pre-filled message text (always included)\n- deep_link_url: WhatsApp deep link URL (always included)\n- creation_time: Unix timestamp when QR code was created (first-party apps only)\n- qr_image_url.format(FORMAT): QR code image URL where FORMAT is SVG or PNG\n\nExample: "code,prefilled_message,qr_image_url.format(SVG)"\n',
      },
    ],
    response: {
      confidence: "contract",
      schema: "QrCodeResponse",
    },
  },
  {
    id: "deleteQrCode",
    command: "delete-qr-code",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{Phone-Number-ID}/message_qrdls/{QR-Code-ID}",
    },
    effect: "destructive",
    summary: "Delete Individual Message QR Code",
    description:
      "Permanently delete a specific QR code. Once deleted, the QR code and deep link become invalid.\nDeletion cannot be undone and affects any existing marketing materials using the QR code.\n",
    tags: ["Individual QR Code"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The WhatsApp Business Account phone number ID that owns the QR code to be deleted.\nThis ID is provided when you add a phone number to your WhatsApp Business Account.\n",
      },
      {
        name: "QR-Code-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          minLength: 14,
          maxLength: 14,
          pattern: "^[A-Z2-7]{14}$",
        },
        description:
          "The unique 14-character identifier of the QR code to delete.\nThis is the code value returned when the QR code was created.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "DeleteQrCodeResponse",
    },
  },
  {
    id: "sendEncryptedMessage",
    command: "send-encrypted-message",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/messages_encrypted",
    },
    effect: "write",
    summary: "Send Encrypted Message",
    description:
      "Send encrypted messages using JWE (JSON Web Encryption) format. This endpoint provides an additional layer of security on top of existing standard TLS/SSL by accepting pre-encrypted message payloads and returning encrypted responses.\n\n**Important Notes:**\n- Only successful responses will be encrypted\n- Error responses will be returned unencrypted if the underlying JSON is incorrectly formatted\n- Payload encryption must be enabled for the phone number using the `POST /<Phone-Number-ID>/settings` endpoint\n- The encrypted payload must follow the same structure as the original `/messages` endpoint\n\n**Prerequisites:**\n- User Access Token with `whatsapp_business_messaging` permission\n- Valid `Phone-Number-ID` for your registered WhatsApp Business account\n- Payload encryption enabled for the phone number\n- Properly formatted JWE token containing encrypted message payload using supported algorithms\n\n**Supported Algorithms:**\n- **Content Encryption:** A128GCM, A256GCM...",
    tags: ["Encrypted Messages"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "The ID of the phone number used to send the message. Retrieved from the WhatsApp Business Account.",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "EncryptedMessageRequest",
    },
    response: {
      confidence: "contract",
      schema: "EncryptedMessageResponse",
    },
  },
  {
    id: "getOfficialBusinessAccountStatus",
    command: "get-official-business-account-status",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/official_business_account",
    },
    effect: "read",
    summary: "Get Official Business Account Status",
    description:
      "Retrieve the Official Business Account (OBA) status and related information for a WhatsApp Business Account phone number.\n\n**Use Cases:**\n- Check current OBA verification status\n- Monitor OBA application progress\n- Retrieve status messages for business account verification\n- Validate business credibility status\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nOBA status information can be cached for moderate periods, but status may change\nduring verification processes. Implement appropriate cache invalidation strategies.\n",
    tags: ["Official Business Account"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nstatus entity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (oba_status, status_message).\nAvailable fields: oba_status, status_message\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "OfficialBusinessAccountStatus",
    },
  },
  {
    id: "requestOfficialBusinessAccount",
    command: "request-official-business-account",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/official_business_account",
    },
    effect: "write",
    summary: "Update Official Business Account Status",
    description:
      "Update or modify the Official Business Account (OBA) status for a WhatsApp Business Account phone number.\nThis endpoint allows businesses to submit new applications, withdraw existing applications, or resubmit\nafter addressing rejection reasons.\n\n**Use Cases:**\n- Submit initial Official Business Account application\n- Withdraw pending OBA application\n- Resubmit OBA application after addressing rejection feedback\n- Update application data for pending applications\n\n**Application Data Requirements:**\nWhen submitting or resubmitting an OBA application, certain business information may be required\ndepending on the current status and previous submissions.\n\n**Rate Limiting:**\nStandard Graph API rate limits apply with additional restrictions on application submissions\nto prevent abuse. Use appropriate retry logic with exponential backoff.\n\n**Status Transitions:**\n- Applications can only be submitted when no active application exists\n- Withdrawals are only allowed for pending applications\n- Resubmissions are only allowed after rejection\n",
    tags: ["Official Business Account"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nstatus entity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "OfficialBusinessAccountUpdateRequest",
    },
    response: {
      confidence: "contract",
      schema: "OfficialBusinessAccountUpdateResponse",
    },
  },
  {
    id: "getPhoneNumber",
    command: "get-phone-number",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}",
    },
    effect: "read",
    summary: "Retrieve WhatsApp Business Phone Number Information",
    description:
      "Retrieve comprehensive information about a WhatsApp Business phone number using its unique ID (CSID).\nThis endpoint provides phone number status, verification details, quality metrics, and configuration information.\n\n**Core Information Returned:**\n- Phone number ID and display format\n- Verification status and verified business name\n- Quality rating based on message delivery performance\n- Code verification status for two-step verification\n- Display name certification status (when requested)\n\n**Quality Rating System:**\nThe quality rating reflects how recipients have been receiving messages from this phone number:\n- **GREEN**: High quality - messages are being delivered and engaged with well\n- **YELLOW**: Medium quality - some delivery or engagement issues detected\n- **RED**: Low quality - significant delivery or engagement problems\n- **NA**: Quality rating not yet determined (new phone numbers)\n\n**Display Name Status:**\nWhen requesting the `name_status` field, you'll receive the current verification status:\n- **APPROVED**: Business display name has been verified and is ready to use\n- **AVAILABLE_WITHOUT_REVIEW**: Display name is ready to use without additional review\n- **DECLINED**: Business display name verification was rejected\n- **EXPIRED**: Display name approval has expired\n- **PENDING_REVIEW**: Display name verification request is under review\n- **NONE**: No display name verification request exists\n\n**Code Verification Status:**\nIndicates the two-step verification status:\n- **VERIFIED**: Phone number has completed two-step verification\n- **UNVERIFIED**: Two-step verification is pending or incomplete\n\n**Use Cases:**\n- Monitor phone number quality and delivery performance\n- Check verification and display name status\n- Validate phone number configuration before sending messages\n- Retrieve display information for business profiles\n- Audit phone number compliance and status\n\nFor more information on quality ratings, see [WhatsApp Business Account Message Quality Rating](https://www.facebook.com/business/help/896873687365001).\n",
    tags: ["Phone Numbers"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account phone number ID (CSID). This unique identifier is assigned when you\nregister the phone number with WhatsApp Business API and can be found in your WhatsApp Business Manager.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of additional fields to include in the response. If not specified,\nonly default fields (id, display_phone_number, verified_name, quality_rating) are returned.\n\n**Available Fields:**\n- `name_status`: Display name verification status\n- `code_verification_status`: Two-step verification status for the phone number\n\n**Field Values:**\n\n**name_status** values:\n- `APPROVED`: Display name approved and ready to use\n- `AVAILABLE_WITHOUT_REVIEW`: Display name ready without additional review\n- `DECLINED`: Display name verification rejected\n- `EXPIRED`: Display name approval has expired\n- `PENDING_REVIEW`: Display name verification under review\n- `NONE`: No display name verification request exists\n\n**code_verification_status** values:\n- `VERIFIED`: Phone number has completed two-step verification\n- `UNVERIFIED`: Two-step verification pending or incomplete\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "PhoneNumberInfo",
    },
  },
  {
    id: "updatePhoneNumber",
    command: "update-phone-number",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}",
    },
    effect: "write",
    summary: "Update WhatsApp Business Account Phone Number Status and Configuration",
    description:
      "Update the status and configuration of a WhatsApp Business Account phone number.\nThis endpoint supports comprehensive phone number management including status updates,\nwebhook configuration, security settings, and business profile management.\n\n**Supported Operations:**\n- Update connection status between WhatsApp Business Account and phone number\n- Configure webhook endpoints for message delivery notifications\n- Set up two-step verification and security notifications\n- Update display names for name verification\n- Configure search visibility and privacy settings\n- Set username for the WhatsApp Business Account\n- Override webhook callback URIs for message notifications\n\n**Business Logic Requirements:**\n- App must be linked to the WhatsApp Business Account\n- Webhook subscription must exist before configuring callback URI overrides\n- Callback URI verification is performed for external URLs\n- Internal URLs are allowed for development environments\n\n**Rate Limiting:**\nWhatsApp use case throttling applies. Use appropriate retry logic with exponential backoff.\n\n**Security Validations:**\n- App-to-WABA linking validation enforced\n- Webhook callback URI verification required for external URLs\n- Business integration system user checks for AI bot onboarding\n- Capability checks for first-party app access\n",
    tags: ["Phone Numbers"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account phone number ID (CSID). This ID is provided when you\nregister the phone number and can be found in your WhatsApp Business Manager.\n",
      },
    ],
    request: {
      required: false,
      confidence: "contract",
      schema: "PhoneNumberStatusUpdateRequest",
    },
    response: {
      confidence: "contract",
      schema: "UpdatePhoneNumberResponse",
    },
  },
  {
    id: "deregisterPhoneNumber",
    command: "deregister-phone-number",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/deregister",
    },
    effect: "destructive",
    summary: "Deregister WhatsApp Business Phone Number",
    description:
      "Deregister a WhatsApp Business phone number from the Facebook Hosted System.\nThis operation removes the phone number from the WhatsApp Business Platform\nand makes it available for re-registration if needed.\n\n\n**Important Notes:**\n- Phone number must be currently linked in Facebook Hosted System\n- Phone number must be registered on the WhatsApp Business Platform\n- Cannot deregister phone numbers associated with SMB accounts\n- Rate limiting is enforced to prevent abuse\n- Deregistration triggers activity logging for audit purposes\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply with additional restrictions for registration\noperations. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nDeregistration status changes are immediate and should not be cached.\n",
    tags: ["Phone Number Management"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The ID of the phone number to deregister. This ID is provided when you register\nthe phone number and can be found in your WhatsApp Business Account settings.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "DeregisterResponse",
    },
  },
  {
    id: "getMessageHistory",
    command: "get-message-history",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/message_history",
    },
    effect: "read",
    summary: "Get WhatsApp Business Account Message History",
    description:
      "Retrieve paginated message history for a WhatsApp Business Account phone number,\nincluding delivery status events, timestamps, and webhook update information.\n\n\n**Use Cases:**\n- Track message delivery status and events\n- Monitor webhook delivery and update states\n- Retrieve historical message delivery information\n- Debug message delivery issues and webhook failures\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nMessage history data can be cached for moderate periods, but delivery status events\nmay change frequently. Implement appropriate cache invalidation strategies.\n\n\n**Pagination:**\nThis endpoint supports cursor-based pagination. Use the `after` and `before` cursors\nfrom the response to navigate through results.\n",
    tags: ["Message History"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account phone number ID. This ID is provided when you register\nthe phone number and can be found in your WhatsApp Business Manager or through phone number APIs.\n",
      },
      {
        name: "message_id",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Filter results by specific WhatsApp message ID (WAMID). When provided,\nonly message history for this specific message will be returned.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, message_id).\nAvailable fields: id, message_id, events{delivery_status,webhook_update_state,timestamp,application,webhook_uri,error_description}\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of message history entries to return per page.\nDefault is 25, maximum is 100.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the next page of results.\nThis value comes from the `paging.cursors.after` field in previous responses.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the previous page of results.\nThis value comes from the `paging.cursors.before` field in previous responses.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "MessageHistoryResponse",
    },
  },
  {
    id: "registerPhoneNumber",
    command: "register-phone-number",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/register",
    },
    effect: "destructive",
    summary: "Register WhatsApp Business Phone Number",
    description:
      "Register a WhatsApp Business phone number for messaging capabilities and enable\ntwo-step verification. This is a required step before sending messages through\nthe WhatsApp Business Cloud API.\n\n\n**Registration Process:**\n1. Phone number must be in UNVERIFIED status\n2. Provide a 6-digit PIN for two-step verification\n3. Optionally provide backup data for account migration\n4. Registration activates messaging capabilities\n\n\n**Migration Support:**\nFor migrating from on-premises WhatsApp Business API, include backup data\nwith password and encrypted account information.\n\n\n**Rate Limiting:**\nRegistration attempts are rate-limited to prevent abuse. Standard Graph API\nrate limits apply with additional restrictions for registration endpoints.\n\n\n**Security Requirements:**\n- Two-step verification is mandatory for all registered numbers\n- PIN must be securely stored and managed by the business\n- Registration enables webhook delivery and message sending capabilities\n",
    tags: ["Phone Number Registration"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The ID of the phone number to register. This ID is provided when the phone number\nis added to your WhatsApp Business Account and can be found in WhatsApp Manager.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "WhatsAppBusinessPhoneNumberRegistrationRequest",
    },
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessPhoneNumberRegistrationResponse",
    },
  },
  {
    id: "requestVerificationCode",
    command: "request-verification-code",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/request_code",
    },
    effect: "write",
    summary: "Request Phone Number Verification Code",
    description:
      "Request a verification code for a WhatsApp Business phone number via SMS or voice call.\nThis is the first step in the phone number verification process.\n\n\n**Use Cases:**\n- Initial verification of newly added phone numbers\n- Re-verification when phone number status requires it\n- Switching between SMS and voice verification methods\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Additional rate limiting may be enforced\nfor verification code requests to prevent abuse.\n\n**Security:**\nVerification codes are sent only to the registered phone number and expire\nafter a short time period. Multiple failed attempts may result in temporary blocking.\n",
    tags: ["Phone Number Verification"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nstatus entity (EntWhatsAppBusinessAccountToNumberCurrentStatus) and can be\nobtained from your WhatsApp Business Account phone numbers list.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "RequestCodeRequest",
    },
    response: {
      confidence: "contract",
      schema: "RequestCodeResponse",
    },
  },
  {
    id: "getPhoneNumberSettings",
    command: "get-phone-number-settings",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/settings",
    },
    effect: "read",
    summary: "Get phone number settings",
    description:
      "Retrieve current settings for a WhatsApp Business phone number.\nReturns calling settings, payload encryption settings, and data\nstorage configurations.\n",
    tags: ["Settings"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "include_sip_credentials",
        in: "query",
        required: false,
        schema: {
          default: false,
          type: "boolean",
        },
        description: "Include SIP credentials in the response (requires additional permissions)",
      },
    ],
    response: {
      confidence: "contract",
      schema: "PhoneNumberSettingsResponse",
    },
  },
  {
    id: "updatePhoneNumberSettings",
    command: "update-phone-number-settings",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/settings",
    },
    effect: "write",
    summary: "Update phone number settings",
    description:
      "Update various settings for a WhatsApp Business phone number.\nYou can configure calling settings, user identity change settings,\npayload encryption, and data storage configurations.\nOnly one feature setting can be specified per request.\n",
    tags: ["Settings"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "contract",
      schema: "UpdatePhoneNumberSettingsRequest",
    },
    response: {
      confidence: "contract",
      schema: "UpdatePhoneNumberSettingsResponse",
    },
  },
  {
    id: "verifyPhoneNumberCode",
    command: "verify-phone-number-code",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/verify_code",
    },
    effect: "write",
    summary: "Verify Phone Number Verification Code",
    description:
      "Verify a phone number verification code for a WhatsApp Business Account phone number.\nThis endpoint is used to complete the phone number verification process by submitting\nthe verification code received via SMS or voice call.\n\n\n**Use Cases:**\n- Complete phone number verification during initial setup\n- Verify phone number ownership for messaging capabilities\n- Finalize phone number registration process\n- Complete phone number migration verification\n\n\n**Rate Limiting:**\nVerification attempts are rate-limited to prevent abuse. Failed attempts may result\nin temporary blocking. Use appropriate retry logic with exponential backoff.\n\n\n**Security:**\nVerification codes are time-limited (typically 10 minutes) and single-use.\nMultiple failed attempts may trigger additional security measures.\n",
    tags: ["Phone Number Verification"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The WhatsApp Business Account phone number ID that needs verification.\nThis ID is provided when you add a phone number to your WhatsApp Business Account.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "VerifyCodeRequest",
    },
    response: {
      confidence: "contract",
      schema: "VerifyCodeResponse",
    },
  },
  {
    id: "getEncryptionPublicKey",
    command: "get-encryption-public-key",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_business_encryption",
    },
    effect: "read",
    summary: "Get Business Encryption Public Key",
    description:
      "Retrieve the current business public key and its signature verification status.\n\nThis endpoint returns the public key that is currently configured for encrypting\nmessage payloads and indicates whether the stored signature is valid or has a mismatch.\n\n**Use Cases:**\n- Verify current encryption configuration\n- Check public key signature validation status\n- Retrieve public key for client-side encryption setup\n- Monitor encryption key status for security compliance\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nPublic key information can be cached for moderate periods, but signature status\nmay change and should be checked regularly for security validation.\n",
    tags: ["Flows", "Setup Endpoint Encryption", "Business Encryption"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nentity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\nall available fields will be returned.\nAvailable fields: business_public_key, business_public_key_signature_status\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetEncryptionPublicKeyResponse",
    },
  },
  {
    id: "setEncryptionPublicKey",
    command: "set-encryption-public-key",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_business_encryption",
    },
    effect: "write",
    summary: "Set Business Encryption Public Key",
    description:
      "Upload and configure a business public key for message payload encryption.\n\nThis endpoint accepts a business public key in PEM format, validates it,\nand stores it with a cryptographic signature for future use in encrypting\nmessage payloads and data channel requests.\n\n**Use Cases:**\n- Initial setup of encryption for WhatsApp Business messaging\n- Update existing public key for key rotation\n- Enable secure payload encryption for sensitive business communications\n- Configure encryption keys for compliance requirements\n\n**Key Requirements:**\n- Must be a valid RSA public key in PEM format\n- Key must meet Meta's security standards for encryption\n- Only one active public key per phone number at a time\n- Previous keys are replaced when new ones are uploaded\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Key uploads may have additional\nsecurity-related rate limiting to prevent abuse.\n",
    tags: ["Business Encryption"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nentity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "WhatsAppBusinessEncryptionUploadRequest",
      contentType: "multipart/form-data",
    },
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessEncryptionUploadResponse",
    },
  },
  {
    id: "getBusinessProfile",
    command: "get-business-profile",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_business_profile",
    },
    effect: "read",
    summary: "Get WhatsApp Business Profile",
    description:
      "Retrieve comprehensive information about a WhatsApp Business Profile, including\nbusiness details, contact information, and profile settings.\n\n\n**Use Cases:**\n- Retrieve current business profile information\n- Check business contact details and settings\n- Verify business vertical and website information\n- Get profile picture URL and about section\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nBusiness profile information can be cached for moderate periods, but should be\nrefreshed periodically to ensure accuracy.\n",
    tags: ["WhatsApp Business Profile"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nstatus entity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (messaging_product, about, address, description, email, profile_picture_url, websites, vertical).\nAvailable fields: messaging_product, about, address, description, email, profile_picture_url, websites, vertical\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessProfileResponse",
    },
  },
  {
    id: "updateBusinessProfile",
    command: "update-business-profile",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_business_profile",
    },
    effect: "write",
    summary: "Update WhatsApp Business Profile",
    description:
      "Update WhatsApp Business Profile information including business details,\ncontact information, and profile settings.\n\n\n**Use Cases:**\n- Update business description and contact information\n- Modify business address and website information\n- Change business vertical classification\n- Update profile picture using Resumable Upload API\n- Update profile picture and about section\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Profile Picture Updates:**\nTo update the profile picture, first use the Resumable Upload API to obtain a\nprofile_picture_handle, then include it in the request.\n",
    tags: ["WhatsApp Business Profile"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nstatus entity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "WhatsAppBusinessProfileUpdateRequest",
    },
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessProfileUpdateResponse",
    },
  },
  {
    id: "getCommerceSettings",
    command: "get-commerce-settings",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_commerce_settings",
    },
    effect: "read",
    summary: "Get commerce settings",
    description:
      "- Guide: [Sell Products & Services](https://developers.facebook.com/docs/business-messaging/whatsapp/catalogs/sell-products-and-services) (Cloud API)\n- Guide: [Sell Products & Services](https://developers.facebook.com/docs/whatsapp/on-premises/guides/commerce-guides) (On-Premises API)\n- Endpoint reference: [WhatsApp Business Phone Number > WhatsApp Commerce Settings](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/whatsapp_commerce_settings)",
    tags: ["Commerce Settings"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetCommerceSettingsResponse",
    },
  },
  {
    id: "setCommerceSettings",
    command: "set-commerce-settings",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/whatsapp_commerce_settings",
    },
    effect: "write",
    summary: "Set or update commerce settings",
    description:
      "- Guide: [Sell Products & Services](https://developers.facebook.com/docs/business-messaging/whatsapp/catalogs/sell-products-and-services) (Cloud API)\n- Guide: [Sell Products & Services](https://developers.facebook.com/docs/whatsapp/on-premises/guides/commerce-guides) (On-Premises API)\n- Endpoint reference: [WhatsApp Business Phone Number > WhatsApp Commerce Settings](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/whatsapp_commerce_settings)",
    tags: ["Commerce Settings"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "is_cart_enabled",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "is_catalog_visible",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "SetCommerceSettingsResponse",
    },
  },
  {
    id: "getBusinessComplianceInfo",
    command: "get-business-compliance-info",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Phone-Number-ID}/business_compliance_info",
    },
    effect: "read",
    summary: "Get Business Compliance Information",
    description:
      "Retrieve comprehensive business compliance information for a WhatsApp Business Account phone number,\nincluding entity details, registration status, and required contact information for regulatory compliance.\n\n\n**Use Cases:**\n- Retrieve business compliance information for regulatory reporting\n- Verify business entity registration status and contact details\n- Access grievance officer and customer care information\n- Support compliance audits and regulatory verification processes\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nCompliance information can be cached for moderate periods, but should be refreshed regularly\nto ensure accuracy for regulatory purposes. Implement appropriate cache invalidation strategies.\n",
    tags: ["Business Compliance"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account phone number ID. This ID can be found in your\nWhatsApp Business Manager or through phone number management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned. Available fields: messaging_product, entity_name,\nentity_type, entity_type_custom, is_registered, grievance_officer_details, customer_care_details\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetBusinessComplianceInfoResponse",
    },
  },
  {
    id: "updateBusinessComplianceInfo",
    command: "update-business-compliance-info",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/business_compliance_info",
    },
    effect: "write",
    summary: "Update Business Compliance Information",
    description:
      'Create or update comprehensive business compliance information for a WhatsApp Business Account phone number,\nincluding entity details, registration status, and required contact information for regulatory compliance.\n\n\n**Use Cases:**\n- Set business compliance information for regulatory reporting\n- Update business entity registration status and details\n- Configure grievance officer and customer care contact information\n- Ensure compliance data accuracy for regulatory purposes\n- Support compliance setup for new business operations\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Validation Rules:**\n- `entity_name` is required and must be between 2 and 128 characters\n- `entity_type` is required and must be a valid entity type enum value\n- `entity_type_custom` is mandatory when `entity_type` is "Other"\n- `entity_type_custom` cannot be used with non-"Other" entity types\n- `is_registered` can only be used with "Other" or "Partnership" entity types\n- `grievance_officer_details` is required with complete contact information\n- `customer_care_details` is required with contact information\n- Phone numbers must be valid international format with country code\n- Email addresses must be valid format and under 128 characters\n',
    tags: ["Business Compliance"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account phone number ID. This ID can be found in your\nWhatsApp Business Manager or through phone number management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "BusinessComplianceInfoUpdateRequest",
    },
    response: {
      confidence: "contract",
      schema: "UpdateBusinessComplianceInfoResponse",
    },
  },
  {
    id: "getMedia",
    command: "get-media",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Media-ID}",
    },
    effect: "read",
    summary: "Retrieve Media URL",
    description:
      "To retrieve your media’s URL, make a **GET** call to **`/{{Media-ID}}`**. Use the returned URL to download the media file. Note that clicking this URL (i.e. performing a generic GET) will not return the media; you must include an access token. For more information, see [Download Media](https://developers.facebook.com/docs/business-messaging/whatsapp/business-phone-numbers/media#download-media).\n\nYou can also use the optional query **`?phone_number_id`** for **`Retrieve Media URL`** and **`Delete Media`**. This parameter checks to make sure the media belongs to the phone number before retrieval or deletion.\n\n#### Response\n\nA successful response includes an object with a media URL. The URL is only valid for 5 minutes. To use this URL, see [Download Media](https://developers.facebook.com/docs/business-messaging/whatsapp/business-phone-numbers/media#download-media).",
    tags: ["Media"],
    parameters: [
      {
        name: "Media-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
      {
        name: "phone_number_id",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Specifies that this action only be performed if the media belongs to the provided phone number.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetMediaResponse",
    },
  },
  {
    id: "deleteMedia",
    command: "delete-media",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{Media-ID}",
    },
    effect: "destructive",
    summary: "Delete Media",
    description:
      "To delete media, make a **DELETE** call to the ID of the media you want to delete.\n\n## Prerequisites\n- [User Access Token](https://developers.facebook.com/docs/facebook-login/access-tokens#usertokens) with **`whatsapp_business_messaging`** permission\n- Media object ID from either uploading media endpoint or media message Webhooks",
    tags: ["Media"],
    parameters: [
      {
        name: "Media-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
      {
        name: "phone_number_id",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Specifies that deletion of the media  only be performed if the media belongs to the provided phone number.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "DeleteMediaResponse",
    },
  },
  {
    id: "getMessageHistoryEvents",
    command: "get-message-history-events",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Message-History-ID}/events",
    },
    effect: "read",
    summary: "Get WhatsApp Message History Events",
    description:
      "Retrieve paginated message delivery status events for a specific message history entry,\nincluding delivery status occurrences, timestamps, and application information.\n\n\n**Use Cases:**\n- Track detailed message delivery status events and transitions\n- Monitor delivery status occurrence timestamps\n- Retrieve application information for delivery events\n- Debug message delivery issues and status changes\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nMessage history events can be cached for short periods, but delivery status events\nmay change frequently. Implement appropriate cache invalidation strategies.\n\n\n**Pagination:**\nThis endpoint supports cursor-based pagination. Use the `after` and `before` cursors\nfrom the response to navigate through results.\n",
    tags: ["Message History Events"],
    parameters: [
      {
        name: "Message-History-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Message History ID. This ID is provided when you retrieve\nmessage history and can be found through message history APIs.\n",
      },
      {
        name: "status_filter",
        in: "query",
        required: false,
        schema: {
          type: "ref",
          ref: "WhatsAppMessageDeliveryStatus",
        },
        description:
          "Filter results by specific delivery status. When provided,\nonly events with this delivery status will be returned.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (cursor, node{id,delivery_status,occurrence_timestamp}).\nAvailable fields: cursor, node{id,delivery_status,error_description,occurrence_timestamp,status_timestamp,application}\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of message history events to return per page.\nDefault is 25, maximum is 100.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the next page of results.\nThis value comes from the `paging.cursors.after` field in previous responses.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Cursor for pagination. Use this to get the previous page of results.\nThis value comes from the `paging.cursors.before` field in previous responses.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "MessageHistoryEventsResponse",
    },
  },
  {
    id: "getAssignedWhatsAppBusinessAccounts",
    command: "get-assigned-whats-app-business-accounts",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{User-ID}/assigned_whatsapp_business_accounts",
    },
    effect: "read",
    summary: "Get Assigned WhatsApp Business Accounts",
    description:
      "Retrieve WhatsApp Business Accounts that have been assigned to a specific user.\nThis endpoint provides information about account assignments, permissions, and\ncurrent status corresponding to the GraphAssignedWhatsAppBusinessAccountsEdge node.\n\n\n**Use Cases:**\n- Retrieve all WhatsApp Business Accounts assigned to a user\n- Check user permissions for specific accounts\n- Monitor account assignment status and changes\n- Validate user access before performing business operations\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nAssignment information can be cached for short periods, but permissions and status\nmay change frequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["Assigned WhatsApp Business Accounts"],
    parameters: [
      {
        name: "User-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "The user ID for whom to retrieve assigned WhatsApp Business Accounts.\nThis must be a valid user ID within your solution or partnership.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, name, status).\nAvailable fields: id, name, status, assignment_date, permissions, business_id, phone_numbers\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of accounts to return per page. Default is 25, maximum is 100.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the next page of results.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the previous page of results.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "AssignedAccountsResponse",
    },
  },
  {
    id: "getWhatsAppAccountNumberDetails",
    command: "get-whats-app-account-number-details",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WhatsApp-Account-Number-ID}",
    },
    effect: "read",
    summary: "Get WhatsApp Account Number Details",
    description:
      "Retrieve comprehensive details about a WhatsApp Account Number, including its current status,\nverification information, quality rating, and configuration settings.\n\n**Use Cases:**\n- Monitor account number status and quality rating\n- Verify account number configuration before messaging operations\n- Check verification and approval status\n- Retrieve display name and business profile information\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nAccount number details can be cached for short periods, but status information may change\nfrequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Account Numbers"],
    parameters: [
      {
        name: "WhatsApp-Account-Number-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Account Number ID. This ID represents the account number entity\nand can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, display_phone_number, status).\nAvailable fields: id, display_phone_number, verified_name, status, quality_rating,\ncountry_code, country_dial_code, code_verification_status, name_status,\nmessaging_limit_tier, account_mode, certificate, is_official_business_account\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppAccountNumber",
    },
  },
  {
    id: "getAssignedUsers",
    command: "get-assigned-users",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WhatsApp-Business-Account-ID}/assigned_users",
    },
    effect: "read",
    summary: "List Assigned Users",
    description:
      "Retrieve a list of users assigned to the WhatsApp Business Account with their permissions\nand user details. This endpoint supports pagination and filtering capabilities.\n\n\n**Use Cases:**\n- Audit user access to WhatsApp Business Account\n- Retrieve user permission assignments for compliance\n- List all users with access for management purposes\n- Monitor user access patterns and assignments\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nUser assignment data can be cached for short periods, but permission changes may occur\nfrequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Business Account Users"],
    parameters: [
      {
        name: "WhatsApp-Business-Account-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID is provided when you create the account\nand can be found in your Business Manager or through account management APIs.\n",
      },
      {
        name: "business",
        in: "query",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Business ID that owns or has access to the WhatsApp Business Account.\nThis parameter is required to specify the business context for user assignments.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, name). Available fields: id, name, business, user_type\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of assigned users to return per page. Default is 25, maximum is 100.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the next page of results.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the previous page of results.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "AssignedUsersResponse",
    },
  },
  {
    id: "addAssignedUser",
    command: "add-assigned-user",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WhatsApp-Business-Account-ID}/assigned_users",
    },
    effect: "write",
    summary: "Add User to WhatsApp Business Account",
    description:
      "Add a user to the WhatsApp Business Account with specified permission tasks.\nThis operation grants the user access to perform specific actions on the account\nbased on the provided permission tasks.\n\n\n**Use Cases:**\n- Grant user access to WhatsApp Business Account management\n- Assign specific permission tasks for granular access control\n- Add new team members to WhatsApp Business Account operations\n- Configure user permissions for different business roles\n\n\n**Permission Tasks:**\nDifferent permission tasks grant access to different WhatsApp Business Account features:\n- MANAGE: General account management permissions\n- DEVELOP: Development and API access permissions\n- MANAGE_TEMPLATES: Message template management\n- MANAGE_PHONE: Phone number management\n- MESSAGING: Send and receive messages\n- FULL_CONTROL: Complete access to all account features\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n",
    tags: ["WhatsApp Business Account Users"],
    parameters: [
      {
        name: "WhatsApp-Business-Account-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID is provided when you create the account\nand can be found in your Business Manager or through account management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "AddAssignedUserRequest",
      contentType: "application/x-www-form-urlencoded",
    },
    response: {
      confidence: "contract",
      schema: "SuccessResponse",
    },
  },
  {
    id: "removeAssignedUser",
    command: "remove-assigned-user",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{WhatsApp-Business-Account-ID}/assigned_users",
    },
    effect: "write",
    summary: "Remove User from WhatsApp Business Account",
    description:
      "Remove a user's access from the WhatsApp Business Account. This operation revokes\nall permissions and access rights for the specified user on the account.\n\n\n**Use Cases:**\n- Revoke user access when they leave the organization\n- Remove temporary access grants\n- Clean up user permissions for security compliance\n- Manage user lifecycle and access control\n\n\n**Important Notes:**\n- This operation removes ALL permissions for the user on this WhatsApp Business Account\n- The user will lose access to all account features and data\n- This action cannot be undone - the user must be re-added if access is needed again\n- Webhooks may be triggered to notify of user access changes\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n",
    tags: ["WhatsApp Business Account Users"],
    parameters: [
      {
        name: "WhatsApp-Business-Account-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID is provided when you create the account\nand can be found in your Business Manager or through account management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "RemoveAssignedUserRequest",
      contentType: "application/x-www-form-urlencoded",
    },
    response: {
      confidence: "contract",
      schema: "SuccessResponse",
    },
  },
  {
    id: "configureConversationalAutomation",
    command: "configure-conversational-automation",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{Phone-Number-ID}/conversational_automation",
    },
    effect: "write",
    summary: "Configure Conversational Automation",
    description:
      "Configure conversational automation settings for a WhatsApp Business Account phone number,\nincluding welcome messages, conversation prompts (ice breakers), and bot commands.\n\n\n**Use Cases:**\n- Set up automated welcome messages for new customer conversations\n- Configure conversation prompts to guide customer interactions\n- Define bot commands for common customer service scenarios\n- Update existing automation settings\n- Enable or disable specific automation features\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Validation:**\n- Command names must be unique within the same phone number\n- Prompts and command descriptions must comply with WhatsApp Business policies\n- Maximum limits are enforced for prompts and commands\n",
    tags: ["Conversational Automation"],
    parameters: [
      {
        name: "Phone-Number-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business phone number ID. This ID represents the phone number\nentity and can be obtained from your WhatsApp Business Account phone numbers list.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "ConversationalAutomationRequest",
    },
    response: {
      confidence: "contract",
      schema: "ConversationalAutomationResponse",
    },
  },
  {
    id: "getCreditLines",
    command: "get-credit-lines",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{Business-ID}/extendedcredits",
    },
    effect: "read",
    summary: "Get credit lines",
    description:
      "- Endpoint reference: [Business > Extendedcredits](https://developers.facebook.com/docs/marketing-api/reference/extended-credit/)",
    tags: ["Billing"],
    parameters: [
      {
        name: "Business-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetCreditLinesResponse",
    },
  },
  {
    id: "listPhoneNumbers",
    command: "list-phone-numbers",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}/phone_numbers",
    },
    effect: "read",
    summary: "Get WhatsApp Business Account Phone Numbers",
    description:
      "Retrieve all phone numbers associated with a WhatsApp Business Account, including their\nstatus, verification details, and configuration information.\n\n**Use Cases:**\n- List all phone numbers in a WhatsApp Business Account\n- Monitor phone number status and verification progress\n- Check phone number quality ratings and messaging limits\n- Retrieve phone number configuration details\n\n**Filtering:**\nYou can filter results using the `filtering` parameter with JSON-encoded filter conditions.\nSupported filters include account_mode, messaging_limit_tier, and is_official_business_account.\n\n**Sorting:**\nResults can be sorted by creation_time or last_onboarded_time in ascending or descending order.\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nPhone number data can be cached for short periods, but status information may change\nfrequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["Phone Number Management"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through the business management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned. Available fields include: id, display_phone_number,\nverified_name, status, quality_rating, country_code, country_dial_code,\ncode_verification_status, unified_cert_status, account_mode, host_platform,\nmessaging_limit_tier, is_official_business_account, username\n",
      },
      {
        name: "filtering",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "JSON-encoded array of filter conditions. Each filter should specify field, operator, and value.\nSupported fields: account_mode, messaging_limit_tier, is_official_business_account\n",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["creation_time.asc", "creation_time.desc", "last_onboarded_time.asc", "last_onboarded_time.desc"],
        },
        description:
          "Sort field and direction. Format: field_name.asc or field_name.desc\nSupported fields: creation_time, last_onboarded_time\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of phone numbers to return per page",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination - retrieve records after this cursor",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination - retrieve records before this cursor",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessAccountPhoneNumbersConnection",
    },
  },
  {
    id: "createPhoneNumber",
    command: "create-phone-number",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WABA-ID}/phone_numbers",
    },
    effect: "write",
    summary: "Create WhatsApp Business Account Phone Number",
    description:
      "Create a new phone number registration within a WhatsApp Business Account. This endpoint\ninitiates the phone number onboarding process, including verification and business name approval.\n\n**Use Cases:**\n- Add new phone numbers to a WhatsApp Business Account\n- Migrate phone numbers from on-premises to Cloud API\n- Register pre-verified phone numbers for BSP scenarios\n- Initiate phone number verification and business name approval process\n\n**Prerequisites:**\n- WhatsApp Business Account must have available phone number slots\n- Phone number must not be already registered with WhatsApp Business\n- Business must meet WhatsApp Business API requirements\n- Appropriate permissions and app review completion\n\n**Process Flow:**\n1. Submit phone number and business name for registration\n2. Phone number verification code will be sent (if not pre-verified)\n3. Business name will be submitted for review\n4. Monitor status through GET endpoint until approval\n\n**Rate Limiting:**\nPhone number creation is subject to strict rate limits to prevent abuse.\nStandard Graph API rate limits also apply.\n\n**Migration Support:**\nSet migrate_phone_number=true when migrating from on-premises API to Cloud API.\nAdditional validation and migration-specific logic will be applied.\n",
    tags: ["Phone Number Management"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID where the phone number will be added.\nThis ID can be found in your WhatsApp Manager or through business management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "PhoneNumberCreateRequest",
    },
    response: {
      confidence: "contract",
      schema: "PhoneNumberCreateResponse",
    },
  },
  {
    id: "listSchedules",
    command: "list-schedules",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}/schedules",
    },
    effect: "read",
    summary: "Get WhatsApp Business Account Schedules",
    description:
      "Retrieve all schedules associated with a WhatsApp Business Account, including their\nconfiguration, status, and execution details.\n\n**Use Cases:**\n- List all schedules in a WhatsApp Business Account\n- Monitor schedule status and performance\n- Check schedule configuration and timing details\n- Retrieve schedule execution history and metrics\n\n**Filtering:**\nYou can filter results using the `filtering` parameter with JSON-encoded filter conditions.\nSupported filters include status, schedule_type, and is_active.\n\n**Sorting:**\nResults can be sorted by created_time or updated_time in ascending or descending order.\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nSchedule data can be cached for short periods, but status information may change\nfrequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["Schedule Management"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through the business management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned. Available fields include: id, name, status,\nschedule_type, description, start_time, end_time, timezone, days_of_week,\ncreated_time, updated_time, is_active, recurrence_pattern\n",
      },
      {
        name: "filtering",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "JSON-encoded array of filter conditions. Each filter should specify field, operator, and value.\nSupported fields: status, schedule_type, is_active\n",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["created_time.asc", "created_time.desc", "updated_time.asc", "updated_time.desc"],
        },
        description:
          "Sort field and direction. Format: field_name.asc or field_name.desc\nSupported fields: created_time, updated_time\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of schedules to return per page",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination - retrieve records after this cursor",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination - retrieve records before this cursor",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessAccountSchedulesConnection",
    },
  },
  {
    id: "createSchedule",
    command: "create-schedule",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WABA-ID}/schedules",
    },
    effect: "write",
    summary: "Create WhatsApp Business Account Schedule",
    description:
      "Create a new schedule configuration within a WhatsApp Business Account. This endpoint\nallows businesses to set up automated scheduling for various operations such as business hours,\nautomated responses, and maintenance windows.\n\n**Use Cases:**\n- Create business hours schedules for automated responses\n- Set up maintenance windows for system operations\n- Configure automated message campaigns with timing\n- Establish recurring schedule patterns for business operations\n\n**Prerequisites:**\n- WhatsApp Business Account must have scheduling feature enabled\n- Appropriate permissions for schedule management\n- Valid timezone and time format specifications\n- Business must meet WhatsApp Business API requirements\n\n**Process Flow:**\n1. Submit schedule configuration with timing and recurrence details\n2. System validates schedule parameters and conflicts\n3. Schedule is created and activated based on is_active flag\n4. Monitor schedule status through GET endpoint\n\n**Rate Limiting:**\nSchedule creation is subject to rate limits to prevent abuse.\nStandard Graph API rate limits also apply.\n\n**Validation:**\n- Start time must be before end time\n- Timezone must be valid IANA timezone identifier\n- Days of week must be valid if specified\n- Recurrence pattern must be consistent with schedule type\n",
    tags: ["Schedule Management"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID where the schedule will be created.\nThis ID can be found in your WhatsApp Manager or through business management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "ScheduleCreateRequest",
    },
    response: {
      confidence: "contract",
      schema: "ScheduleCreateResponse",
    },
  },
  {
    id: "listSubscribedApps",
    command: "list-subscribed-apps",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}/subscribed_apps",
    },
    effect: "read",
    summary: "Get All Subscriptions for a WABA",
    description:
      "Retrieve a list of all applications currently subscribed to webhook events\nfor the specified WhatsApp Business Account.\n\n\n**Use Cases:**\n- Monitor which apps are subscribed to WABA webhook events\n- Audit subscription configurations and permissions\n- Verify subscription status before making changes\n- Retrieve subscription details for troubleshooting\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nSubscription data can be cached for short periods, but may change when apps\nsubscribe or unsubscribe. Implement appropriate cache invalidation strategies.\n",
    tags: ["Webhook Subscriptions"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through business management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned. Available fields: id, name, link\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "SubscribedAppsResponse",
    },
  },
  {
    id: "subscribeApp",
    command: "subscribe-app",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WABA-ID}/subscribed_apps",
    },
    effect: "write",
    summary: "Subscribe to WABA Webhooks",
    description:
      "Subscribe your application to webhook events for the specified WhatsApp Business Account.\nThis enables your app to receive real-time notifications for events such as message\ndeliveries, status updates, and other WABA activities.\n\n\n**Use Cases:**\n- Enable webhook notifications for your app\n- Configure custom callback URLs for webhook delivery\n- Set up webhook verification tokens for security\n- Override default app webhook settings for specific WABAs\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Subscription operations may have additional\nthrottling to prevent abuse.\n\n\n**Security:**\nAlways use HTTPS endpoints for webhook callbacks. Verify webhook authenticity\nusing the provided verification tokens and signature validation.\n",
    tags: ["Webhook Subscriptions"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through business management APIs.\n",
      },
    ],
    request: {
      required: false,
      confidence: "contract",
      schema: "SubscriptionRequest",
    },
    response: {
      confidence: "contract",
      schema: "SubscriptionResponse",
    },
  },
  {
    id: "unsubscribeApp",
    command: "unsubscribe-app",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{WABA-ID}/subscribed_apps",
    },
    effect: "write",
    summary: "Unsubscribe from WABA Webhooks",
    description:
      "Unsubscribe your application from webhook events for the specified WhatsApp Business Account.\nThis will stop your app from receiving webhook notifications for this WABA.\n\n\n**Use Cases:**\n- Disable webhook notifications when no longer needed\n- Clean up subscriptions during app decommissioning\n- Temporarily disable webhooks for maintenance\n- Remove subscriptions for WABAs no longer managed by your app\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Unsubscription operations are typically\nprocessed immediately.\n\n\n**Important:**\nUnsubscribing will immediately stop all webhook deliveries for this WABA.\nEnsure your application can handle the cessation of webhook events gracefully.\n",
    tags: ["Webhook Subscriptions"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through business management APIs.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "SubscriptionResponse",
    },
  },
  {
    id: "getTemplate",
    command: "get-template",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{TEMPLATE_ID}",
    },
    effect: "read",
    summary: "Get template by ID (default fields)",
    description:
      "- Guide: [Message Templates](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/overview)\n- Guide: [How To Monitor Quality Signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals)\n- Endpoint reference: [WhatsApp Message Template](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-hsm/)",
    tags: ["Templates"],
    parameters: [
      {
        name: "TEMPLATE_ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "GetTemplateResponse",
    },
  },
  {
    id: "editTemplate",
    command: "edit-template",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{TEMPLATE_ID}",
    },
    effect: "write",
    summary: "Edit template",
    description:
      "- Guide: [Message Templates](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/overview)\n- Guide: [How To Monitor Quality Signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals)\n- Endpoint reference: [WhatsApp Message Template](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-hsm/)",
    tags: ["Templates"],
    parameters: [
      {
        name: "TEMPLATE_ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "example",
      schema: "EditTemplateRequest",
    },
    response: {
      confidence: "contract",
      schema: "EditTemplateResponse",
    },
  },
  {
    id: "listTemplates",
    command: "list-templates",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}/message_templates",
    },
    effect: "read",
    summary: "Get template by name (default fields)",
    description:
      "- Guide: [Message Templates](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/overview)\n- Guide: [How To Monitor Quality Signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals)\n- Endpoint reference: [WhatsApp Business Account > Message Templates](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/)",
    tags: ["Templates"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "name",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    response: {
      confidence: "contract",
      schema: "ListTemplatesResponse",
    },
  },
  {
    id: "createTemplate",
    command: "create-template",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WABA-ID}/message_templates",
    },
    effect: "write",
    summary: "Create authentication template w/ OTP copy code button",
    description:
      "- Guide: [Authentication Templates with OTP Buttons](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/authentication-templates/authentication-templates)\n- Guide: [Message Templates](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/overview)\n- Guide: [How To Monitor Quality Signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals)\n- Endpoint reference: [WhatsApp Business Account > Message Templates](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/)",
    tags: ["Flows", "Send Flow"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
    ],
    request: {
      required: false,
      confidence: "example",
      schema: "CreateTemplateRequest",
    },
    response: {
      confidence: "contract",
      schema: "CreateTemplateResponse",
    },
  },
  {
    id: "deleteTemplate",
    command: "delete-template",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/{Version}/{WABA-ID}/message_templates",
    },
    effect: "destructive",
    summary: "Delete template by name",
    description:
      "- Guide: [Message Templates](https://developers.facebook.com/docs/business-messaging/whatsapp/templates/overview)\n- Guide: [How To Monitor Quality Signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals)\n- Endpoint reference: [WhatsApp Business Account > Message Templates](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/)",
    tags: ["Templates"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "name",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "hsm_id",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Template ID",
      },
    ],
    response: {
      confidence: "contract",
      schema: "DeleteTemplateResponse",
    },
  },
  {
    id: "listActivities",
    command: "list-activities",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}/activities",
    },
    effect: "read",
    summary: "Get WhatsApp Business Account Activities",
    description:
      "Retrieve activity logs and audit trails for a WhatsApp Business Account.\nThis endpoint returns a chronological list of activities performed on the account,\nincluding administrative actions, configuration changes, and operational events.\n\n**Use Cases:**\n- Monitor account configuration changes and administrative actions\n- Generate compliance and audit reports for regulatory requirements\n- Track user activities and permission modifications\n- Investigate security incidents and unauthorized access attempts\n- Monitor API usage patterns and operational events\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nActivity data can be cached for short periods, but recent activities may change\nfrequently. Implement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Business Account Activities"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID can be found in your WhatsApp Manager\nor through the business account management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, activity_type, timestamp, actor_type).\nAvailable fields: id, activity_type, timestamp, actor_type, actor_id, actor_name, description, details, ip_address, user_agent\n",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          default: 25,
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        description: "Maximum number of activity records to return per page. Default is 25, maximum is 100.\n",
      },
      {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the next page of results.\n",
      },
      {
        name: "before",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Cursor for pagination. Use this to get the previous page of results.\n",
      },
      {
        name: "since",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Unix timestamp or ISO 8601 date string. Only return activities that occurred after this time.\n",
      },
      {
        name: "until",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Unix timestamp or ISO 8601 date string. Only return activities that occurred before this time.\n",
      },
      {
        name: "activity_type",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Filter activities by type. Can be a single type or comma-separated list of types.\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "ActivityList",
    },
  },
  {
    id: "getBusinessAccount",
    command: "get-business-account",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-ID}",
    },
    effect: "read",
    summary: "Get WhatsApp Business Account Details",
    description:
      "Retrieve comprehensive details about a WhatsApp Business Account, including its\nconfiguration, status, and settings.\n\n**Use Cases:**\n- Retrieve WhatsApp Business Account configuration and details\n- Monitor account status and verification state\n- Check account ownership and business information\n- Validate account state before messaging operations\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n**Caching:**\nAccount details can be cached for moderate periods, but verification status may change.\nImplement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Business Account"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID is provided when you create the account\nand can be found in your WhatsApp Manager or through business management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id, name). Available fields: id, name, timezone_id,\nmessage_template_namespace, account_review_status, business_verification_status,\ncountry, ownership_type, primary_business_location\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessAccount",
    },
  },
  {
    id: "updateBusinessAccount",
    command: "update-business-account",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WABA-ID}",
    },
    effect: "write",
    summary: "Update WhatsApp Business Account",
    description:
      "Update configuration and settings for a WhatsApp Business Account.\n\n**Use Cases:**\n- Update WhatsApp Business Account name and configuration\n- Modify account settings and preferences\n- Update business information and verification details\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n",
    tags: ["WhatsApp Business Account"],
    parameters: [
      {
        name: "WABA-ID",
        in: "path",
        required: false,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Account ID. This ID is provided when you create the account\nand can be found in your WhatsApp Manager or through business management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "UpdateBusinessAccountRequest",
    },
    response: {
      confidence: "contract",
      schema: "UpdateBusinessAccountResponse",
    },
  },
  {
    id: "getBusinessBot",
    command: "get-business-bot",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WABA-Bot-ID}",
    },
    effect: "read",
    summary: "Get WhatsApp Business Bot Details",
    description:
      "Retrieve comprehensive details about a WhatsApp Business Bot, including its prompts,\ncommands, and welcome message configuration.\n\n\n**Use Cases:**\n- Retrieve bot configuration and automated response settings\n- Monitor available bot commands and their descriptions\n- Check welcome message enablement status\n- Validate bot state before implementing automation\n- Audit bot configuration for business compliance\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nBot details can be cached for moderate periods, but configuration may change\nwhen bot settings are updated. Implement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Business Bot"],
    parameters: [
      {
        name: "WABA-Bot-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Bot ID. This ID is provided when you create the bot\nand can be found in your Business Manager or through bot management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (prompts, commands, enable_welcome_message).\nAvailable fields: id, prompts, commands, enable_welcome_message\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessBot",
    },
  },
  {
    id: "getBusinessProfileById",
    command: "get-business-profile-by-id",
    binding: {
      kind: "http",
      method: "GET",
      path: "/{Version}/{WhatsApp-Business-Profile-ID}",
    },
    effect: "read",
    summary: "Get WhatsApp Business Profile Details",
    description:
      "Retrieve comprehensive details about a WhatsApp Business Profile, including business information,\ncontact details, and profile configuration.\n\n\n**Use Cases:**\n- Retrieve business profile information and metadata\n- Verify profile configuration and contact details\n- Check profile status and business information\n- Validate profile state before business operations\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n\n\n**Caching:**\nProfile details can be cached for moderate periods, but business information may change\noccasionally. Implement appropriate cache invalidation strategies.\n",
    tags: ["WhatsApp Business Profiles"],
    parameters: [
      {
        name: "WhatsApp-Business-Profile-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Profile ID. This ID is provided when the profile is created\nand can be found in your WhatsApp Business Manager or through business management APIs.\n",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description:
          "Comma-separated list of fields to include in the response. If not specified,\ndefault fields will be returned (id and any available profile fields).\nAvailable fields: id, account_name, description, email, about, address, vertical, websites, profile_picture_url, messaging_product\n",
      },
    ],
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessProfileNode",
    },
  },
  {
    id: "updateBusinessProfileById",
    command: "update-business-profile-by-id",
    binding: {
      kind: "http",
      method: "POST",
      path: "/{Version}/{WhatsApp-Business-Profile-ID}",
    },
    effect: "write",
    summary: "Update WhatsApp Business Profile",
    description:
      "Update the WhatsApp Business Profile information such as business description, email, address,\nand other profile details. This operation corresponds to the GraphWhatsAppBusinessProfilePost functionality.\n\n\n**Use Cases:**\n- Update business profile information and metadata\n- Modify contact details and business description\n- Change business vertical classification\n- Update website URLs and profile picture\n- Maintain current business profile information\n\n\n**Profile Picture Upload:**\nIt is recommended to use the Resumable Upload API to obtain an upload ID, then use this\nupload ID to obtain the picture handle for the `profile_picture_handle` field.\n\n\n**Rate Limiting:**\nStandard Graph API rate limits apply. Use appropriate retry logic with exponential backoff.\n",
    tags: ["WhatsApp Business Profiles"],
    parameters: [
      {
        name: "WhatsApp-Business-Profile-ID",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[0-9]+$",
        },
        description:
          "Your WhatsApp Business Profile ID. This ID is provided when the profile is created\nand can be found in your WhatsApp Business Manager or through business management APIs.\n",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "WhatsAppBusinessProfileUpdateRequest",
    },
    response: {
      confidence: "contract",
      schema: "WhatsAppBusinessProfileUpdateResponse",
    },
  },
]
