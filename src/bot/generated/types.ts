// GENERATED. DO NOT EDIT.
// Source: spec/bot/business-messaging-api_v23.0.yaml
// Run: pnpm bot:generate

/** Connected client business information and configuration */
export type ConnectedClientBusiness = {
  /** Unique identifier for the connected client business */
  id: string
  /** Name of the connected client business */
  name: string
  verification_status?: BusinessVerificationStatus
  business_status?: BusinessStatus
  /** Timestamp when the business connection was created */
  created_time?: string
  /** Timestamp when the business connection was last updated */
  updated_time?: string
}

/** Verification status of the connected client business */
export type BusinessVerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING" | "REJECTED"

/** Current status of the connected client business */
export type BusinessStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_APPROVAL"

/** Response containing list of connected client businesses */
export type ConnectedClientBusinessesResponse = {
  /** Array of connected client businesses */
  data?: Array<ConnectedClientBusiness>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging = {
  cursors?: {
    /** Cursor pointing to the start of the page of data */
    before?: string
    /** Cursor pointing to the end of the page of data */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** Standard Graph API error response */
export type GraphAPIError = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Request payload for creating a Multi-Partner Solution */
export type WhatsAppBusinessSolutionCreateRequest = {
  /** Configurable permissions granted to the solution owner app. Currently supports only MESSAGING permission. Use empty array if owner should not have configurable permissions. */
  owner_permissions: Array<WhatsAppBusinessAccountConfigurablePermissionTask>
  /** Facebook Application ID of the partner app that will participate in this solution. Must be a valid application ID accessible to the requesting entity. */
  partner_app_id: string
  /** Configurable permissions granted to the partner app. Currently supports only MESSAGING permission. Use empty array if partner should not have configurable permissions. */
  partner_permissions: Array<WhatsAppBusinessAccountConfigurablePermissionTask>
  /** Human-readable name for the Multi-Partner Solution. Used for identification and management purposes in partner dashboards and solution management interfaces. */
  solution_name: string
}

/** Successful response containing the created solution identifier */
export type WhatsAppBusinessSolutionCreateResponse = {
  /** Unique identifier for the newly created Multi-Partner Solution. Use this ID for subsequent solution management operations. */
  solution_id: string
}

/** Configurable permission tasks for WhatsApp Business Account access in Multi-Partner Solutions. Currently only MESSAGING permission is configurable through this API. */
export type WhatsAppBusinessAccountConfigurablePermissionTask = "MESSAGING"

/** Standard Graph API error response structure */
export type GraphAPIError1 = {
  error: {
    /** Human-readable error message describing the issue */
    message: string
    /** Error type classification for programmatic handling */
    type: string
    /** Numeric error code for specific error identification */
    code: number
    /** More specific error subcode when applicable */
    error_subcode?: number
    /** Facebook trace ID for debugging and support purposes */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Multi-Partner Solution details and configuration */
export type WhatsAppBusinessSolution = {
  /** Unique identifier for the Multi-Partner Solution */
  id: string
  /** Human-readable name of the Multi-Partner Solution */
  name: string
  status: WhatsAppBusinessSolutionStatus
  status_for_pending_request: WhatsAppBusinessSolutionPendingStatus
  owner_app?: ApplicationNode
  /** List of WhatsApp Business Account permissions granted to the solution owner */
  owner_permissions?: Array<WhatsAppBusinessAccountPermissionTask>
}

/** Current effective status of the Multi-Partner Solution */
export type WhatsAppBusinessSolutionStatus = "DRAFT" | "INITIATED" | "ACTIVE" | "REJECTED" | "DEACTIVATED"

/** Status of any pending solution status transition requests */
export type WhatsAppBusinessSolutionPendingStatus = "PENDING_ACTIVATION" | "PENDING_DEACTIVATION" | "NONE"

/** Granular permission tasks for WhatsApp Business Account access */
export type WhatsAppBusinessAccountPermissionTask =
  | "MANAGE"
  | "DEVELOP"
  | "MANAGE_TEMPLATES"
  | "MANAGE_PHONE"
  | "VIEW_COST"
  | "MANAGE_EXTENSIONS"
  | "VIEW_PHONE_ASSETS"
  | "MANAGE_PHONE_ASSETS"
  | "VIEW_TEMPLATES"
  | "VIEW_INSIGHTS"
  | "RECEIVE_INCOMING_MESSAGES"
  | "MANAGE_BILLING"
  | "MANAGE_USERS"
  | "MESSAGING"
  | "FULL_CONTROL"

/** Role of the application in relation to the Multi-Partner Solution */
export type WhatsAppBusinessSolutionApplicationRole = "OWNER" | "PARTNER"

/** Meta application that owns the Multi-Partner Solution */
export type ApplicationNode = {
  /** Unique identifier for the Meta application */
  id?: string
  /** Name of the Meta application */
  name?: string
}

/** Response containing list of Multi-Partner Solutions with pagination */
export type WhatsAppBusinessSolutionsResponse = {
  /** Array of Multi-Partner Solutions */
  data?: Array<WhatsAppBusinessSolution>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging1 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data that has been returned */
    before?: string
    /** Cursor pointing to the end of the page of data that has been returned */
    after?: string
  }
  /** Graph API endpoint URL for the previous page of data */
  previous?: string
  /** Graph API endpoint URL for the next page of data */
  next?: string
}

/** Request payload for adding a phone number to a business account */
export type AddPhoneNumbersRequest = {
  /** Phone number to add to the business account. Accepts E.164 format or formatted numbers with spaces, hyphens, and parentheses (e.g., +1234567890, +1 (631) 555-1000, +1-631-555-1000). The phone number will be normalized and validated by the endpoint. */
  phone_number: string
}

/** Response containing the ID of the successfully added phone number */
export type AddPhoneNumbersResponse = {
  /** Unique identifier for the preverified phone number entity that was created */
  id: string
}

/** Pre-verified phone number details and status information */
export type PreVerifiedPhoneNumber = {
  /** Unique identifier for the pre-verified phone number */
  id: string
  /** Formatted display version of the phone number */
  display_phone_number: string
  /** Country code prefix for the phone number */
  country_prefix?: number
  verification_status: PhoneNumberVerificationStatus
  availability_status?: PhoneNumberAvailabilityStatus
  /** Timestamp when the phone number was pre-verified */
  created_time?: string
  /** Timestamp when the phone number information was last updated */
  last_updated?: string
  /** List of WhatsApp Business features supported by this phone number */
  supported_features?: Array<WhatsAppBusinessFeature>
  /** ISO 3166-1 alpha-2 country code for the phone number */
  country_code?: string
  /** Geographic region or area for the phone number */
  region?: string
}

/** Current verification status of the pre-verified phone number */
export type PhoneNumberVerificationStatus = "VERIFIED" | "PENDING" | "FAILED" | "EXPIRED"

/** Current availability status of the pre-verified phone number */
export type PhoneNumberAvailabilityStatus = "AVAILABLE" | "IN_USE" | "RESERVED" | "UNAVAILABLE"

/** WhatsApp Business features supported by the phone number */
export type WhatsAppBusinessFeature =
  | "MESSAGING"
  | "BUSINESS_PROFILE"
  | "WEBHOOKS"
  | "TEMPLATES"
  | "ANALYTICS"
  | "COMMERCE"
  | "FLOWS"

/** Response containing list of pre-verified phone numbers */
export type PreVerifiedPhoneNumbersResponse = {
  /** List of pre-verified phone numbers */
  data: Array<PreVerifiedPhoneNumber>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging2 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data that has been returned */
    before?: string
    /** Cursor pointing to the end of the page of data that has been returned */
    after?: string
  }
  /** Graph API endpoint URL for the next page of results */
  next?: string
  /** Graph API endpoint URL for the previous page of results */
  previous?: string
}

/** WhatsApp Business Account details and configuration */
export type WhatsAppBusinessAccount = {
  /** Unique identifier for the WhatsApp Business Account */
  id: string
  /** Human-readable name of the WhatsApp Business Account */
  name: string
  account_review_status?: AccountReviewStatus
  /** Purchase order number associated with the account */
  purchase_order_number?: string
  /** List of audience segments associated with the account */
  audiences?: Array<string>
  ownership_type?: OwnershipType
  /** List of applications subscribed to this WABA */
  subscribed_apps?: Array<SubscribedApp>
  business_verification_status?: BusinessVerificationStatus
  /** Country code where the WABA is registered */
  country?: string
  /** Currency code for the WABA */
  currency?: string
  /** Timezone identifier for the WABA */
  timezone_id?: string
  on_behalf_of_business_info?: OnBehalfOfBusinessInfo
  /** Business hours and scheduling information */
  schedules?: Array<BusinessSchedule>
  /** Whether insights are enabled for this WABA */
  is_enabled_for_insights?: boolean
  dcc_config?: DCCConfig
  /** Message templates associated with the WABA */
  message_templates?: Array<MessageTemplate>
  /** Phone numbers associated with the WABA */
  phone_numbers?: Array<PhoneNumber>
}

/** Review status of the WhatsApp Business Account */
export type AccountReviewStatus = "APPROVED" | "PENDING" | "REJECTED" | "RESTRICTED"

/** Type of ownership for the WhatsApp Business Account */
export type OwnershipType = "SELF_OWNED" | "CLIENT_OWNED" | "AGENCY_OWNED"

/** Verification status of the business associated with the WABA */
export type BusinessVerificationStatus1 = "VERIFIED" | "UNVERIFIED" | "PENDING" | "REJECTED"

/** Application subscribed to the WABA */
export type SubscribedApp = {
  /** Application ID */
  id?: string
  /** Application name */
  name?: string
}

/** Information about the business on whose behalf the WABA operates */
export type OnBehalfOfBusinessInfo = {
  /** Business ID */
  id?: string
  /** Business name */
  name?: string
}

/** Business hours schedule information */
export type BusinessSchedule = {
  day_of_week?: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"
  /** Opening time in HH:MM format */
  open_time?: string
  /** Closing time in HH:MM format */
  close_time?: string
}

/** Data and Content Control configuration */
export type DCCConfig = {
  /** Whether DCC is enabled */
  enabled?: boolean
  /** URL to the DCC policy */
  policy_url?: string
}

/** Message template information */
export type MessageTemplate = {
  /** Template ID */
  id?: string
  /** Template name */
  name?: string
  status?: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED"
}

/** Phone number associated with the WABA */
export type PhoneNumber = {
  /** Phone number ID */
  id?: string
  /** Formatted phone number for display */
  display_phone_number?: string
  /** Verified business name for the phone number */
  verified_name?: string
}

/** Response containing list of client WhatsApp Business Accounts */
export type ClientWhatsAppBusinessAccountsResponse = {
  /** Array of client WhatsApp Business Accounts */
  data?: Array<WhatsAppBusinessAccount>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging3 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data */
    before?: string
    /** Cursor pointing to the end of the page of data */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** MM Lite onboarding request details */
export type MMLiteOnboardingRequest = {
  /** Unique identifier for the MM Lite onboarding request */
  request_id: string
}

/** WhatsApp Business Account owned by the business */
export type WhatsAppBusinessAccount1 = {
  /** Unique identifier for the WhatsApp Business Account */
  id: string
  /** Human-readable name of the WhatsApp Business Account */
  name: string
  /** Namespace identifier for message templates associated with this account */
  message_template_namespace: string
  /** Timezone identifier for the WhatsApp Business Account */
  timezone_id: string
}

/** Type of WhatsApp Business Account */
export type WhatsAppBusinessType = "ENTERPRISE" | "SMB"

/** Filter for accounts based on onboarding status */
export type WhatsAppBusinessAccountOnboardingFilter = "ONBOARDED" | "NOT_ONBOARDED" | "ALL"

/** Paginated collection of owned WhatsApp Business Accounts */
export type WhatsAppBusinessAccountsConnection = {
  /** Array of owned WhatsApp Business Account records */
  data: Array<WhatsAppBusinessAccount>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging4 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data that has been returned */
    before?: string
    /** Cursor pointing to the end of the page of data that has been returned */
    after?: string
  }
  /** URL for the next page of results */
  next?: string
  /** URL for the previous page of results */
  previous?: string
}

/** Request payload for sharing a pre-verified phone number with another business */
export type PreVerifiedPhoneNumberShareRequest = {
  /** Unique identifier of the pre-verified phone number to be shared. Must be a valid phone number ID that the requesting business owns or has sharing rights to. */
  preverified_id: string
  /** Business ID of the partner business that will receive access to the pre-verified phone number. Must be a valid business entity accessible to the requesting app. */
  partner_business_id: string
}

/** Specific permissions that can be granted for shared pre-verified phone numbers */
export type PreVerifiedPhoneNumberPermission =
  | "MESSAGING"
  | "VIEW_DETAILS"
  | "MANAGE_SETTINGS"
  | "VIEW_ANALYTICS"
  | "MANAGE_WEBHOOKS"

/** Response containing details of the successful phone number sharing operation */
export type PreVerifiedPhoneNumberShareResponse = {
  /** Indicates whether the sharing operation was successful */
  success: boolean
}

/** Current status of the phone number sharing relationship */
export type SharingStatus = "ACTIVE" | "PENDING" | "EXPIRED" | "REVOKED"

/** Details of the shared pre-verified phone number */
export type SharedPreVerifiedPhoneNumber = {
  /** Unique identifier for the pre-verified phone number */
  id?: string
  /** Formatted display version of the phone number */
  display_phone_number?: string
  /** Country code prefix for the phone number */
  country_prefix?: number
  /** Current verification status of the phone number */
  verification_status?: "VERIFIED" | "PENDING" | "FAILED"
}

/** Summary information about a business entity */
export type BusinessSummary = {
  /** Unique identifier for the business */
  id?: string
  /** Name of the business */
  name?: string
  /** Business verification status */
  verification_status?: "VERIFIED" | "UNVERIFIED" | "PENDING"
}

export type BlockedUser = {
  messaging_product?: string
  wa_id?: string
}

export type PaginationCursors = {
  after?: string
  before?: string
}

export type Paging = {
  cursors?: PaginationCursors
}

export type GetBlockedUsersData = {
  data?: Array<BlockedUser>
  paging?: Paging
}

export type BlockedUserOperation = {
  input?: string
  wa_id?: string
}

export type BlockUsersResult = {
  added_users?: Array<BlockedUserOperation>
}

export type UnblockUsersResult = {
  removed_users?: Array<BlockedUserOperation>
}

export type BlockUsersData = {
  block_users?: BlockUsersResult
  messaging_product?: string
}

export type UnblockUsersData = {
  block_users?: UnblockUsersResult
  messaging_product?: string
}

export type CallPermissionCheckResponsePayload = {
  /** Messaging product */
  messaging_product: string
  /** Call permission details */
  permission: {
    /** Current permission status for calling this user */
    status: "granted" | "pending" | "denied" | "expired"
    /** Unix timestamp when the permission expires (if applicable) */
    expiration_time?: string
  }
  /** Available actions and their restrictions */
  actions?: Array<{
    /** Name of the action */
    action_name: "start_call" | "send_call_permission_request"
    /** Whether the business can perform this action */
    can_perform_action: boolean
    /** Rate limits for this action */
    limits?: Array<{
      /** Time period for the limit */
      time_period: string
      /** Current usage count */
      current_usage: number
      /** Maximum allowed usage */
      max_allowed: number
      /** Unix timestamp when the limit resets */
      limit_expiration_time?: string
    }>
  }>
}

export type CallRequestPayload = {
  /** Messaging product */
  messaging_product: string
  /** The number being called (callee) */
  to: string
  /** The action being taken on the given call ID */
  action: "connect" | "pre_accept" | "accept" | "reject" | "terminate"
  /** Contains the session description protocol (SDP) type and description language */
  session?: {
    /** SDP type - "offer" for connect action, "answer" for accept action */
    sdp_type: "offer" | "answer"
    /** The SDP info of the device on the other end of the call. The SDP must be compliant with RFC 8866 */
    sdp: string
  }
  /** An arbitrary string you can pass in that is useful for tracking and logging purposes. Any app subscribed to the "calls" webhook field on your WhatsApp Business Account can receive this string, as it is included in the calls object within the subsequent Call Terminate Webhook payload. Cloud API does not process this field. Maximum 512 characters */
  biz_opaque_callback_data?: string
}

export type CallTerminateRequestPayload = {
  /** Messaging product */
  messaging_product: string
  /** The WhatsApp call ID */
  call_id: string
  /** Action to terminate the call */
  action: "terminate"
}

export type CallResponsePayload = {
  messaging_product?: string
  calls?: Array<{
    id?: string
  }>
}

export type CallTerminateResponsePayload = {
  success?: boolean
}

export type ErrorObject = {
  /** Human-readable description of the error */
  message: string
  /** Error type classification */
  type: string
  /** Numeric error code */
  code: number
}

export type ErrorResponse = {
  error: ErrorObject
}

export type ErrorObject1 = ErrorObject

export type ErrorResponse1 = ErrorResponse

export type PagingInfo = {
  cursors?: {
    /** Before cursor */
    before?: string
    /** After cursor */
    after?: string
  }
  /** Previous page URL */
  previous?: string
  /** Next page URL */
  next?: string
}

export type TemplateObject = {
  /** Name of the template. */
  name: string
  /** Contains a `language` object. Specifies the language the template may be rendered in */
  language: LanguageObject
  /** Array of `components` objects containing the parameters of the message. */
  components?: Array<TemplateComponent>
}

export type LanguageObject = {
  /** The language policy the message should follow. */
  policy: "deterministic"
  /** The code of the language or locale to use (e.g., `"en"`, `"en_US"`). */
  code: string
}

export type TemplateComponent = HeaderComponent | BodyComponent | ButtonComponent

export type HeaderComponent = {
  type: "header"
  /** Required when `type=button`. Not used for other types. Type of button to create. */
  sub_type?: "quick_reply" | "url" | "catalog"
  /** Parameters for the header component, which can be `image`, `video`, `document`, or `text`. [15, 16] */
  parameters?: Array<ParameterObject>
  /** Required when `type=button`. Not used for other types. Position index of the button (0-9). */
  index?: string
}

export type BodyComponent = {
  type: "body"
  /** Required when `type=button`. Not used for other types. Type of button to create. */
  sub_type?: "quick_reply" | "url" | "catalog"
  /** Parameters for the body component, which can be `text`, `currency`, or `date_time`. [17] */
  parameters?: Array<ParameterObject>
  /** Required when `type=button`. Not used for other types. Position index of the button (0-9). */
  index?: string
}

export type ButtonComponent = {
  type: "button"
  sub_type: "quick_reply" | "url" | "catalog"
  /** Parameters for the button component, which are `payload` for quick reply or `text` for URL buttons. */
  parameters: Array<ButtonParameterObject>
  index: string
}

export type ParameterObject =
  | CurrencyParameter
  | DateTimeParameter
  | DocumentParameter
  | ImageParameter
  | TextParameter
  | VideoParameter

export type TextParameter = {
  type: "text"
  /** The message's text. */
  text: string
}

export type CurrencyParameter = {
  type: "currency"
  currency: CurrencyObject
}

export type DateTimeParameter = {
  type: "date_time"
  date_time: DateTimeObject
}

export type DocumentParameter = {
  type: "document"
  /** Only PDF documents are supported for media-based message templates. Captions not supported. */
  document: MediaObject
}

export type ImageParameter = {
  type: "image"
  /** A media object of type image. Captions not supported. [15] */
  image: MediaObject
}

export type VideoParameter = {
  type: "video"
  /** A media object of type video. Captions not supported. [16] */
  video: MediaObject
}

export type CurrencyObject = {
  /** Default text if localization fails. */
  fallback_value: string
  /** Currency code as defined in ISO 4217. */
  code: string
  /** Amount multiplied by 1000 (e.g., 100000 for $100.00). */
  amount_1000: number
}

export type DateTimeObject = {
  /** Default text. For Cloud API, this fallback value is always used. */
  fallback_value: string
}

/** A media object. Either `id` or `link` is required. */
export type MediaObject =
  | {
      /** The media object ID. **Required when `link` is not used.** */
      id: string
    }
  | {
      /** The protocol and URL of the media to be sent (HTTP/HTTPS only). */
      link: string
    }

export type ButtonParameterObject = ButtonPayloadParameter | ButtonTextParameter

export type ButtonPayloadParameter = {
  type: "payload"
  /** Developer-defined payload that is returned when the quick reply button is clicked. */
  payload: string
}

export type ButtonTextParameter = {
  type: "text"
  /** Developer-provided suffix that is appended to the predefined prefix URL in the template. */
  text: string
}

export type MarketingMessageRequestPayload = {
  /** Messaging service used. Must be "whatsapp" */
  messaging_product: "whatsapp"
  /** Type of recipient. Must be "individual" */
  recipient_type: "individual"
  /** WhatsApp ID or phone number of the message recipient */
  to: string
  /** Type of message. Must be "template" for marketing messages */
  type: "template"
  template: TemplateObject
  /** Optional product policy setting */
  product_policy?: "CLOUD_API_FALLBACK" | "STRICT"
  /** Optional flag to control message activity sharing */
  message_activity_sharing?: boolean
}

/** The status of a WhatsApp message: - `accepted`: The message has been accepted by WhatsApp and is being processed - `held_for_quality_assessment`: The message is being held for quality assessment before delivery - `paused`: The message delivery has been paused */
export type MessageStatus = "accepted" | "held_for_quality_assessment" | "paused"

export type MarketingMessageResponsePayload = {
  contacts?: Array<{
    input?: string
    wa_id?: string
  }>
  messages?: Array<{
    id?: string
    message_status?: MessageStatus
  }>
  messaging_product?: string
}

/** Common properties shared by all message types */
export type BaseMessageProperties = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  /** The type of message */
  type: string
  context?: MessageContext
}

/** Context information for replying to a message */
export type MessageContext = {
  /** The ID of the message to which this message is a reply. */
  message_id?: string
}

/** A media object. Either `id` or `link` is required. */
export type MediaObject1 =
  | {
      /** The media object ID. **Required when `link` is not used.** */
      id: string
      /** Optional caption for the media */
      caption?: string
    }
  | {
      /** The protocol and URL of the media to be sent (HTTP/HTTPS only). */
      link: string
      /** Optional caption for the media */
      caption?: string
    }

export type Message =
  | TextMessage
  | AudioMessage
  | DocumentMessage
  | ImageMessage
  | LocationMessage
  | VideoMessage
  | StickerMessage
  | ReactionMessage
  | InteractiveMessage
  | TemplateMessage
  | ContactsMessage

export type TextMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "text"
  context?: MessageContext
  text: {
    /** The text of the message. */
    body?: string
    preview_url?: boolean
  }
}

export type AudioMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "audio"
  context?: MessageContext
  audio: MediaObject
}

export type VideoMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "video"
  context?: MessageContext
  video: MediaObject
}

export type DocumentMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "document"
  context?: MessageContext
  document: MediaObject
}

export type ImageMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "image"
  context?: MessageContext
  image: MediaObject
}

export type LocationMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "location"
  context?: MessageContext
  location: {
    /** The address of the location. */
    address?: string
    /** The latitude of the location. */
    latitude?: string
    /** The longitude of the location. */
    longitude?: string
    /** The name of the location. */
    name?: string
  }
}

export type StickerMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "sticker"
  context?: MessageContext
  sticker:
    | {
        /** The ID of the sticker. */
        id: string
      }
    | {
        /** The URL of the sticker. */
        link: string
      }
}

export type ReactionMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "reaction"
  context?: MessageContext
  reaction: {
    /** emoji */
    emoji?: string
    /** reacted message-id */
    message_id?: string
  }
}

export type InteractiveMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "interactive"
  context?: MessageContext
  interactive: InteractiveObject
}

/** An object containing the content for an interactive message. */
export type InteractiveObject = {
  /** The type of interactive message to send. */
  type: "button" | "call_permission_request" | "catalog_message" | "list" | "product" | "product_list" | "flow"
  header?: HeaderObject
  body?: BodyObject
  footer?: FooterObject
  action: ActionObject
}

/** Header content displayed on top of a message. Required for 'product_list' type. Cannot be set for 'product' type. */
export type HeaderObject = {
  /** The header type. */
  type: "text" | "video" | "image" | "document"
  /** Text for the header. Required if 'type' is 'text'. Emojis supported, no markdown. */
  text?: string
  /** Optional sub-text for the header. Emojis supported, no markdown. */
  sub_text?: string
  /** Contains the media object for this document. Required if 'type' is 'document'. */
  document?: MediaObject
  /** Contains the media object for this image. Required if 'type' is 'image'. */
  image?: MediaObject
  /** Contains the media object for this video. Required if 'type' is 'video'. */
  video?: MediaObject
}

/** An object with the body of the message. Optional for 'product' type, required for other interactive message types. */
export type BodyObject = {
  /** The content of the message body. Emojis and markdown are supported. */
  text: string
}

/** An object with the footer of the message. Optional. */
export type FooterObject = {
  /** The footer content. Emojis, markdown, and links are supported. */
  text: string
}

/** Action you want the user to perform after reading the message. Its structure varies by interactive message type. */
export type ActionObject =
  | {
      /** Button content for List Messages. Cannot be empty, must be unique. Emojis supported, no markdown. */
      button: string
      /** Array of section objects. */
      sections: Array<SectionObject>
    }
  | {
      /** Array of button objects. */
      buttons: Array<{
        /** Only supported type is "reply" for Reply Button. */
        type: "reply"
        reply: {
          /** Unique identifier for your button. No leading/trailing spaces. */
          id: string
          /** Button title. Cannot be empty, must be unique. Emojis supported, no markdown. */
          title: string
        }
      }>
    }
  | {
      /** Unique identifier of the Facebook catalog linked to your WhatsApp Business Account. */
      catalog_id: string
      /** Unique identifier of the product in a catalog. Required for Single Product Messages. */
      product_retailer_id?: string
      /** Array of section objects. */
      sections?: Array<SectionObject>
    }
  | {
      name: "catalog_message"
      parameters: {
        /** Product retailer ID for the thumbnail. */
        thumbnail_product_retailer_id: string
      }
    }
  | {
      name: "flow"
      parameters: Record<string, unknown> | Record<string, unknown>
    }
  | {
      name: "call_permission_request"
    }

/** A section object, used in List Messages and Multi-Product Messages. */
export type SectionObject = {
  /** Title of the section. Required if the message has more than one section. Max 24 characters. */
  title?: string
  /** Array of product objects. */
  product_items?: Array<{
    /** Unique identifier of the product in a catalog. */
    product_retailer_id: string
  }>
  /** Contains a list of rows. */
  rows?: Array<{
    /** Unique row identifier. */
    id: string
    /** Row title. */
    title: string
    /** Optional row description. */
    description?: string
  }>
}

export type TemplateMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "template"
  context?: MessageContext
  template: TemplateObject
}

export type ContactsMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "contacts"
  context?: MessageContext
  contacts: Array<ContactObject>
}

export type ContactObject = {
  /** Full contact address(es) */
  addresses?: Array<AddressObject>
  /** Date of birth (YYYY-MM-DD format) */
  birthday?: string
  /** Contact email address(es) */
  emails?: Array<EmailObject>
  /** Contact name object */
  name?: NameObject
  /** Contact organization information */
  org?: OrganizationObject
  /** Contact phone number(s) */
  phones?: Array<PhoneObject>
  /** Contact URL(s) */
  urls?: Array<UrlObject>
}

export type AddressObject = {
  /** City name */
  city?: string
  /** Full country name */
  country?: string
  /** Two-letter ISO country code */
  country_code?: string
  /** State abbreviation */
  state?: string
  /** Street address */
  street?: string
  /** Address type */
  type?: "HOME" | "WORK"
  /** ZIP code */
  zip?: string
}

export type EmailObject = {
  /** Email address */
  email: string
  /** Email type */
  type?: "HOME" | "WORK"
}

export type NameObject = {
  /** First name */
  first_name?: string
  /** Formatted full name */
  formatted_name?: string
  /** Last name */
  last_name?: string
  /** Middle name */
  middle_name?: string
  /** Name prefix */
  prefix?: string
  /** Name suffix */
  suffix?: string
}

export type OrganizationObject = {
  /** Company name */
  company?: string
  /** Department name */
  department?: string
  /** Job title */
  title?: string
}

export type PhoneObject = {
  /** Phone number */
  phone: string
  /** Phone type */
  type?: "HOME" | "WORK"
  /** WhatsApp ID */
  wa_id?: string
}

export type UrlObject = {
  /** URL type */
  type?: "HOME" | "WORK"
  /** URL */
  url: string
}

export type MessageResponsePayload = {
  contacts?: Array<{
    input?: string
    wa_id?: string
  }>
  messages?: Array<{
    id?: string
    message_status?: MessageStatus
  }>
  messaging_product?: string
}

export type MarkMessageRequestPayload = {
  message_id: string
  messaging_product: string
  status: string
}

export type MarkMessageResponsePayload = {
  success?: boolean
}

/** Complete details of a message QR code */
export type QrCodeDetails = {
  /** Unique 14-character QR code identifier */
  code: string
  /** Pre-filled message text that appears in customer chat */
  prefilled_message: string
  /** WhatsApp deep link URL for direct conversation initiation */
  deep_link_url: string
  /** Unix timestamp when QR code was created (first-party apps only) */
  creation_time?: number
  /** QR code image download URL (when format specified in fields) */
  qr_image_url?: string
}

/** List of message QR codes with pagination information */
export type QrCodeList = {
  /** Array of QR code objects */
  data: Array<QrCodeDetails>
  /** Pagination information for navigating through large result sets. Contains cursors for accessing previous and next pages of results. */
  paging?: {
    cursors?: {
      /** Cursor for accessing the previous page of results */
      before?: string
      /** Cursor for accessing the next page of results */
      after?: string
    }
    /** URL for the previous page of results */
    previous?: string
    /** URL for the next page of results */
    next?: string
  }
}

/** Request payload for creating a new message QR code */
export type CreateQrCodeRequest = {
  /** Pre-filled message text (max 140 characters) that appears in customer chat */
  prefilled_message: string
  /** QR image format. When specified, response includes qr_image_url */
  generate_qr_image?: "PNG" | "SVG"
}

/** Request payload for updating an existing message QR code */
export type UpdateQrCodeRequest = {
  /** 14-character QR code identifier to update */
  code: string
  /** New pre-filled message text (max 140 characters) */
  prefilled_message: string
}

/** Response containing QR code details after creation or update */
export type QrCodeResponse = {
  /** Unique 14-character identifier for the QR code. This code is used for future updates or deletions. */
  code: string
  /** The pre-filled message text associated with this QR code. This text appears when customers use the QR code. */
  prefilled_message: string
  /** WhatsApp deep link URL that can be used directly without QR code scanning. Customers can click this link to start a conversation with the pre-filled message. */
  deep_link_url: string
  /** URL to download the QR code image. Only present if generate_qr_image parameter was specified in the request. Image format matches the requested format. */
  qr_image_url?: string
}

/** Standard Graph API error response */
export type GraphAPIError2 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Individual QR code response containing a single QR code in data array format */
export type QrCodeResponse1 = {
  /** Array containing the single QR code object (maintains consistency with collection endpoint) */
  data: Array<QrCodeDetails>
}

/** Response confirming successful QR code deletion */
export type DeleteQrCodeResponse = {
  /** Indicates whether the QR code was successfully deleted */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError3 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

export type EncryptedMessageRequest = {
  /** Messaging service used for the request. Use whatsapp. */
  messaging_product: "whatsapp"
  /** JWE payload with encrypted messages structure. This should be a valid JWE token containing the encrypted message payload. */
  encrypted_contents: string
}

export type EncryptedMessageResponse = {
  /** JWE payload with encrypted messages response structure. Contains the encrypted response from the WhatsApp Business API. */
  encrypted_contents: string
}

export type ErrorResponse2 = {
  error?: {
    /** Error message describing what went wrong */
    message?: string
    /** Error type */
    type?: string
    /** Error code */
    code?: number
    /** Error subcode for more specific error identification */
    error_subcode?: number
  }
}

/** Official Business Account status information for a WhatsApp Business Account phone number */
export type OfficialBusinessAccountStatus = {
  /** Unique identifier for the WhatsApp Business Account phone number */
  id: string
  oba_status: WhatsAppBusinessAppealStatus
  /** Human-readable message describing the current Official Business Account status */
  status_message: string
}

/** Request payload for updating Official Business Account status */
export type OfficialBusinessAccountUpdateRequest = {
  /** Official business website URL */
  business_website_url: string
  /** Primary country where the business operates */
  primary_country_of_operation: string
  /** Primary language used by the business */
  primary_language?: string
  /** Parent business or brand name */
  parent_business_or_brand?: string
  /** Supporting links that demonstrate business notability (minimum 5, maximum 10) */
  supporting_links?: Array<string>
  /** Additional information to support the Official Business Account application */
  additional_supporting_information?: string
}

/** Response for Official Business Account status update operation */
export type OfficialBusinessAccountUpdateResponse = {
  /** Indicates if the operation was successful */
  success: boolean
  /** Human-readable message describing the result of the operation */
  message: string
  updated_status?: OfficialBusinessAccountStatus
  /** Unique identifier for tracking the application/update request */
  tracking_id?: string
}

/** Official Business Account appeal and verification status */
export type WhatsAppBusinessAppealStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "UNDER_REVIEW"
  | "EXPIRED"
  | "CANCELLED"

/** Phone number information and status */
export type PhoneNumberInfo = {
  /** The ID associated with the phone number */
  id?: string
  /** The string representation of the phone number */
  display_phone_number?: string
  /** The verified name associated with the phone number */
  verified_name?: string
  /** The quality rating of the phone number based on how messages have been received by recipients in recent days. - GREEN: High Quality - YELLOW: Medium Quality - RED: Low Quality - NA: Quality has not been determined */
  quality_rating?: "GREEN" | "YELLOW" | "RED" | "NA"
  /** The two-step verification status for the phone number indicating whether the number has completed two-step verification. - VERIFIED: Phone number has completed two-step verification - UNVERIFIED: Two-step verification is pending or incomplete */
  code_verification_status?: "VERIFIED" | "UNVERIFIED"
  /** The status of a display name associated with a specific phone number. - APPROVED: The display name has been approved and is ready to use. - AVAILABLE_WITHOUT_REVIEW: The display name is ready to use without review. - DECLINED: The display name has not been approved. - EXPIRED: The display name approval has expired. - PENDING_REVIEW: The display name is under review. - NONE: No display name verification request exists. */
  name_status?: "APPROVED" | "AVAILABLE_WITHOUT_REVIEW" | "DECLINED" | "EXPIRED" | "PENDING_REVIEW" | "NONE"
}

/** Request to send a message via WhatsApp Business API */
export type MessageRequest = {
  /** Messaging service used for the request */
  messaging_product: "whatsapp"
  /** Type of recipient */
  recipient_type?: "individual" | "group"
  /** Recipient's phone number (with country code) or group ID */
  to: string
  /** Type of message being sent */
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "location"
    | "contacts"
    | "template"
    | "interactive"
    | "reaction"
    | "sticker"
  text?: TextMessage
  context?: MessageContext
}

export type TextMessage1 = {
  /** Text content of the message */
  body: string
  /** Whether to show URL preview */
  preview_url?: boolean
}

export type MessageContext1 = {
  /** ID of message being replied to */
  message_id?: string
}

/** Request to update phone number settings */
export type SettingsRequest = {
  calling?: CallingSettings
}

export type CallingSettings = {
  /** Enable or disable calling feature */
  status: "enabled" | "disabled"
  /** Control visibility of the call icon */
  call_icon_visibility?: "visible" | "hidden"
}

export type RegisterRequest = {
  /** Messaging service used for the request */
  messaging_product: "whatsapp"
  /** 6-digit PIN for two-step verification */
  pin: string
}

export type VerifyCodeRequest = {
  /** 6-digit verification code received via SMS or voice */
  code: string
}

export type TwoStepVerificationRequest = {
  /** 6-digit PIN for two-step verification */
  pin: string
}

/** Request to update phone number status and configuration */
export type PhoneNumberStatusUpdateRequest = {
  connection_status?: WhatsAppBusinessAccountToNumberStatus
  /** Webhook URL for receiving message notifications */
  webhook_url?: string
  whatsapp_business_api_data?: WhatsAppBusinessApiData
  /** Two-step verification PIN (can be empty string) */
  pin?: string
  search_visibility?: WAAPIBusinessGlobalSearchStateStatus
  webhook_configuration?: WebhookConfiguration
  /** New display name for name verification request */
  new_display_name?: string
  /** Username for the WhatsApp Business Account */
  username?: string
}

/** WhatsApp Business API configuration data */
export type WhatsAppBusinessApiData = {
  /** Two-step verification PIN (can be empty string) */
  pin?: string
  /** Whether to show security notifications */
  show_security_notifications?: boolean
  /** Whether to notify users when changing number */
  notify_user_change_number?: boolean
}

/** Webhook configuration settings */
export type WebhookConfiguration = {
  /** Override callback URI for webhook notifications (can be empty string) */
  override_callback_uri: string
  /** Token used to verify webhook requests */
  verify_token?: string
}

/** Connection status between WhatsApp Business Account and phone number */
export type WhatsAppBusinessAccountToNumberStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "PENDING"
  | "FLAGGED"
  | "RESTRICTED"
  | "RATE_LIMITED"
  | "MESSAGING_LIMIT_TIER_0"
  | "MESSAGING_LIMIT_TIER_1"
  | "MESSAGING_LIMIT_TIER_2"
  | "MESSAGING_LIMIT_TIER_3"
  | "MESSAGING_LIMIT_TIER_4"

/** Search visibility status for the WhatsApp Business Account */
export type WAAPIBusinessGlobalSearchStateStatus = "VISIBLE" | "HIDDEN"

/** Response from sending a message */
export type MessageResponse = {
  /** Messaging service */
  messaging_product: "whatsapp"
  /** Contact information */
  contacts: Array<ContactResponse>
  /** Message information */
  messages: Array<MessageResponseItem>
}

export type ContactResponse = {
  /** Input phone number */
  input: string
  /** WhatsApp ID */
  wa_id?: string
}

export type MessageResponseItem = {
  /** Message ID */
  id: string
}

/** Generic success response */
export type SuccessResponse = {
  /** Operation success status */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError4 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
  }
}

/** Response indicating successful phone number deregistration */
export type DeregisterResponse = {
  /** Indicates whether the deregistration was successful */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError5 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** WhatsApp message history entry with delivery status information */
export type WhatsAppMessageHistory = {
  /** Unique identifier for the message history entry */
  id: string
  /** WhatsApp message ID (WAMID) for the message */
  message_id: string
  /** Message delivery status events and occurrences */
  events?: {
    /** Array of delivery status events */
    data?: Array<MessageDeliveryStatusEvent>
    paging?: PaginationInfo
  }
}

/** Message delivery status event occurrence */
export type MessageDeliveryStatusEvent = {
  /** Unique identifier for the delivery status event */
  id: string
  delivery_status: WhatsAppMessageDeliveryStatus
  webhook_update_state?: WebhookUpdateState
  /** Unix timestamp when the delivery status event occurred */
  timestamp: string
  /** Application information for the event */
  application?: {
    /** Application ID that processed the event */
    id?: string
  }
  /** Webhook URI where the event was delivered */
  webhook_uri?: string
  /** Error description if the delivery failed */
  error_description?: string
}

/** Message delivery status */
export type WhatsAppMessageDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "DELETED"

/** State of webhook update delivery */
export type WebhookUpdateState = "PENDING" | "DELIVERED" | "FAILED" | "RETRYING"

/** Paginated response containing message history entries */
export type MessageHistoryResponse = {
  /** Array of message history entries */
  data?: Array<WhatsAppMessageHistory>
  paging?: PaginationInfo
}

/** Pagination information for navigating through results */
export type PaginationInfo = {
  /** Pagination cursors for navigation */
  cursors?: {
    /** Cursor for the previous page of results */
    before?: string
    /** Cursor for the next page of results */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** Request payload for registering a WhatsApp Business phone number */
export type WhatsAppBusinessPhoneNumberRegistrationRequest = {
  /** Must be 'whatsapp' to indicate WhatsApp Business messaging product */
  messaging_product: "whatsapp"
  /** 6-digit PIN for two-step verification setup */
  pin: string
  backup?: WhatsAppBusinessAccountBackup
  data_localization_region?: WhatsAppDataLocalizationRegion
  /** Message retention period in minutes (deprecated in v21+) */
  meta_store_retention_minutes?: number
}

/** Backup data for migrating existing WhatsApp Business accounts */
export type WhatsAppBusinessAccountBackup = {
  /** Backup password for account migration */
  password?: string
  /** Encrypted backup data for account migration */
  data?: string
}

/** Data localization region for message storage (deprecated in v21+) */
export type WhatsAppDataLocalizationRegion =
  | "AE"
  | "AU"
  | "BH"
  | "BR"
  | "CA"
  | "CH"
  | "DE"
  | "GB"
  | "ID"
  | "IN"
  | "JP"
  | "KR"
  | "SG"
  | "ZA"

/** Response from phone number registration request */
export type WhatsAppBusinessPhoneNumberRegistrationResponse = {
  /** Indicates whether the registration was successful */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError6 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Request body for requesting a verification code */
export type RequestCodeRequest = {
  /** Method for receiving the verification code */
  code_method: "SMS" | "VOICE"
  /** Language locale for the verification message */
  language: string
}

/** Response after successfully requesting a verification code */
export type RequestCodeResponse = {
  /** Indicates whether the verification code request was successful */
  success: boolean
}

export type CallingSettingsRequest = {
  calling: CallingSettings
}

export type CallingSettings1 = {
  /** Enable or disable calling feature */
  status: "enabled" | "disabled"
  /** Control visibility of the call icon */
  call_icon_visibility?: "visible" | "hidden"
  video?: VideoSettings
  sip?: SipSettings
  /** SRTP key exchange protocol */
  srtp_key_exchange_protocol?: "DTLS-SRTP" | "SDES-SRTP"
}

export type VideoSettings = {
  /** Enable or disable video calling */
  status: "enabled" | "disabled"
}

export type SipSettings = {
  /** Enable or disable SIP calling */
  status: "enabled" | "disabled"
}

export type UserIdentityChangeSettingsRequest = {
  user_identity_change: UserIdentityChangeSettings
}

export type UserIdentityChangeSettings = {
  /** Enable or disable user identity change notifications */
  enabled: boolean
}

export type PayloadEncryptionSettingsRequest = {
  payload_encryption: PayloadEncryptionSettings
}

export type PayloadEncryptionSettings = {
  /** Enable or disable payload encryption */
  status: "enabled" | "disabled"
  /** Base64-encoded public key for payload encryption (required when enabling encryption) */
  client_encryption_key?: string
}

export type StorageConfigurationSettingsRequest = {
  storage_configuration: StorageConfigurationSettings
}

export type StorageConfigurationSettings = {
  /** Enable or disable custom storage configuration */
  enabled: boolean
  /** Data storage region */
  region?: string
}

export type PhoneNumberSettingsResponse = {
  calling: CallingSettingsResponse
  payload_encryption?: PayloadEncryptionSettingsResponse
  storage_configuration: StorageConfigurationSettingsResponse
}

export type CallingSettingsResponse = {
  /** Current calling feature status */
  status: "enabled" | "disabled"
  /** Current call icon visibility setting */
  call_icon_visibility: "visible" | "hidden"
  ip_addresses: {
    /** Default IP addresses for calling */
    default: Array<string>
  }
  /** Callback permission status */
  callback_permission_status: "enabled" | "disabled"
  /** SRTP key exchange protocol (optional) */
  srtp_key_exchange_protocol?: "DTLS-SRTP" | "SDES-SRTP"
  call_hours?: CallHoursSettings
  call_icons?: CallIconsSettings
  sip?: SipSettingsResponse
  video?: VideoSettingsResponse
  audio?: AudioSettingsResponse
  restrictions?: CallingRestrictionsResponse
}

export type CallHoursSettings = {
  /** Call hours feature status */
  status: "enabled" | "disabled"
  /** Timezone for call hours */
  timezone?: string
  /** Start day of the week */
  day_of_week_start?: string
}

export type CallIconsSettings = {
  /** List of countries where call icons are restricted */
  restrict_to_user_countries?: Array<string>
}

export type SipSettingsResponse = {
  /** SIP calling status */
  status: "enabled" | "disabled"
  /** SIP server configuration */
  servers?: Array<SipServerInfo>
}

export type SipServerInfo = {
  /** Application ID for SIP server */
  app_id: string
  /** SIP server hostname */
  hostname: string
  /** SIP server port (optional) */
  port?: number
  /** SIP password (only included when include_sip_credentials=true) */
  password?: string
}

export type VideoSettingsResponse = {
  /** Video calling status */
  status: "enabled" | "disabled"
}

export type AudioSettingsResponse = {
  /** Audio calling status */
  status?: "enabled" | "disabled"
}

export type CallingRestrictionsResponse = {
  restrictions?: Array<{
    /** Type of restriction */
    type?: string
    /** Expiration timestamp for the restriction */
    expiration?: string
  }>
}

export type PayloadEncryptionSettingsResponse = {
  /** Payload encryption status */
  status: "enabled" | "disabled"
  /** Client encryption key fingerprint (when encryption is enabled) */
  client_encryption_key_fingerprint?: string
  /** Cloud encryption key (when encryption is enabled) */
  cloud_encryption_key?: string
}

export type StorageConfigurationSettingsResponse = {
  /** Data storage configuration status */
  status: "default" | "in_country_storage_enabled"
  /** Data localization region (when in-country storage is enabled) */
  data_localization_region?: string
}

/** Request payload for phone number verification code verification */
export type VerifyCodeRequest1 = {
  /** The verification code received via SMS or voice call */
  code: string
}

/** Response from phone number verification code verification */
export type VerifyCodeResponse = {
  /** Indicates whether the verification code was successfully verified */
  success: boolean
  /** The phone number ID that was verified */
  id?: string
}

/** Standard Graph API error response */
export type GraphAPIError7 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Business encryption public key information and verification status */
export type WhatsAppBusinessEncryptionInfo = {
  /** The business public key used for encrypting message payloads. This key is used to encrypt data channel requests and responses. */
  business_public_key: string
  business_public_key_signature_status: BusinessPublicKeyVerificationStatus
}

/** Status of business public key signature verification */
export type BusinessPublicKeyVerificationStatus = "VALID" | "MISMATCH"

/** Request payload for uploading business public key */
export type WhatsAppBusinessEncryptionUploadRequest = {
  /** The business public key in PEM format to be uploaded and signed. Must be a valid RSA public key that will be used for payload encryption. */
  business_public_key: string
}

/** Response after successful public key upload */
export type WhatsAppBusinessEncryptionUploadResponse = {
  /** Indicates whether the public key was successfully uploaded and signed */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError8 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** WhatsApp Business Profile information and settings */
export type WhatsAppBusinessProfile = {
  /** The messaging service used for the request */
  messaging_product: "whatsapp"
  /** The text to display in business profile's About section */
  about?: string
  /** The address of the business */
  address?: string
  /** Description of the business */
  description?: string
  /** The contact email address of the business */
  email?: string
  /** URL of the business profile picture */
  profile_picture_url?: string
  /** URLs associated with the business */
  websites?: Array<string>
  vertical?: WhatsAppBusinessVertical
}

/** Request payload for updating WhatsApp Business Profile */
export type WhatsAppBusinessProfileUpdateRequest = {
  /** The messaging service used for the request */
  messaging_product: "whatsapp"
  /** The text to display in business profile's About section */
  about?: string
  /** The address of the business */
  address?: string
  /** Description of the business */
  description?: string
  /** The contact email address of the business */
  email?: string
  /** The handle of the profile picture generated from Resumable Upload API */
  profile_picture_handle?: string
  /** URLs associated with the business */
  websites?: Array<string>
  vertical?: WhatsAppBusinessVertical
}

/** The industry type of the business */
export type WhatsAppBusinessVertical =
  | "OTHER"
  | "AUTO"
  | "BEAUTY"
  | "APPAREL"
  | "EDU"
  | "ENTERTAIN"
  | "EVENT_PLAN"
  | "FINANCE"
  | "GROCERY"
  | "GOVT"
  | "HOTEL"
  | "HEALTH"
  | "NONPROFIT"
  | "PROF_SERVICES"
  | "RETAIL"
  | "TRAVEL"
  | "RESTAURANT"
  | "ALCOHOL"
  | "ONLINE_GAMBLING"
  | "PHYSICAL_GAMBLING"
  | "OTC_DRUGS"

/** Response containing business profile information */
export type WhatsAppBusinessProfileResponse = {
  data?: Array<{
    business_profile?: WhatsAppBusinessProfile
  }>
}

/** Response after updating business profile */
export type WhatsAppBusinessProfileUpdateResponse = {
  /** Indicates whether the update was successful */
  success?: boolean
}

/** WhatsApp Business Account compliance information and regulatory details */
export type BusinessComplianceInfo = {
  /** Unique identifier for the WhatsApp Business Account */
  whatsapp_business_account_id: string
  /** Messaging product identifier, always 'whatsapp' for WhatsApp Business */
  messaging_product?: "whatsapp"
  /** Legal name of the business entity */
  entity_name?: string
  /** Type of business entity (e.g., Partnership, Private Limited Company, etc.) */
  entity_type?: string
  /** Custom entity type description when standard types don't apply */
  entity_type_custom?: string
  /** Whether the business entity is officially registered with regulatory authorities */
  is_registered?: boolean
  grievance_officer_details?: GrievanceOfficerDetails
  customer_care_details?: CustomerCareDetails
}

/** Contact information for the designated grievance officer */
export type GrievanceOfficerDetails = {
  /** Full name of the grievance officer */
  name?: string
  /** Email address for grievance officer contact */
  email?: string
  /** Mobile phone number for grievance officer (with country code) */
  mobile_number?: string
  /** Landline phone number for grievance officer (with country code) */
  landline_number?: string
}

/** Contact information for customer care and support */
export type CustomerCareDetails = {
  /** Email address for customer care contact */
  email?: string
  /** Mobile phone number for customer care (with country code) */
  mobile_number?: string
  /** Landline phone number for customer care (with country code) */
  landline_number?: string
}

/** Request object for updating WhatsApp Business Account compliance information */
export type BusinessComplianceInfoUpdateRequest = {
  /** Messaging product identifier, must be 'whatsapp' */
  messaging_product: "whatsapp"
  /** Legal name of the business entity */
  entity_name: string
  entity_type: BusinessEntityType
  /** Custom entity type description when entity_type is "OTHER". Required for OTHER entity type. */
  entity_type_custom?: string
  /** Whether the business entity is officially registered with regulatory authorities. Can only be used with "OTHER" or "PARTNERSHIP" entity types. */
  is_registered?: boolean
  grievance_officer_details: GrievanceOfficerUpdateDetails
  customer_care_details: CustomerCareUpdateDetails
}

/** Type of business entity for compliance purposes */
export type BusinessEntityType =
  | "LIMITED_LIABILITY_PARTNERSHIP"
  | "SOLE_PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "PUBLIC_COMPANY"
  | "PRIVATE_COMPANY"
  | "OTHER"

/** Contact information for the designated grievance officer */
export type GrievanceOfficerUpdateDetails = {
  /** Full name of the grievance officer */
  name: string
  /** Email address for grievance officer contact */
  email: string
  /** Mobile phone number for grievance officer (with country code) */
  mobile_number?: string
  /** Landline phone number for grievance officer (with country code) */
  landline_number?: string
}

/** Contact information for customer care and support */
export type CustomerCareUpdateDetails = {
  /** Email address for customer care contact */
  email: string
  /** Mobile phone number for customer care (with country code) */
  mobile_number?: string
  /** Landline phone number for customer care (with country code) */
  landline_number?: string
}

export type ApiError = {
  /** Error code */
  code?: number
  /** Error message */
  message?: string
  /** Error title */
  title?: string
  error_data?: {
    /** Error details */
    details?: string
  }
}

export type GroupInfo = {
  /** Group ID */
  id?: string
  messaging_product?: string
  /** Join approval mode for the group */
  join_approval_mode?: "approval_required" | "auto_approve"
  /** Group subject */
  subject?: string
  /** Group description */
  description?: string
  /** Returns true if the group has been suspended by WhatsApp */
  suspended?: boolean
  /** UNIX timestamp in seconds at which the group was created */
  creation_timestamp?: number
  /** List of participants in the group */
  participants?: Array<{
    /** WhatsApp user ID */
    wa_id?: string
  }>
  /** Total number of participants in the group, excluding your business */
  total_participant_count?: number
}

/** Edge containing message delivery status occurrence with pagination cursor */
export type WhatsAppMessageHistoryEventsEdge = {
  /** Pagination cursor for this edge */
  cursor?: string
  node: WhatsAppBusinessMessageDeliveryStatusOccurrence
}

/** Message delivery status occurrence with detailed event information */
export type WhatsAppBusinessMessageDeliveryStatusOccurrence = {
  /** Unique identifier for the message delivery status occurrence */
  id: string
  delivery_status: WhatsAppMessageDeliveryStatus
  /** Error description if the delivery encountered an error */
  error_description?: string
  /** Unix timestamp when the delivery status occurrence happened */
  occurrence_timestamp: string
  /** Unix timestamp when the status was recorded */
  status_timestamp?: string
  application?: ApplicationNode
}

/** Message delivery status */
export type WhatsAppMessageDeliveryStatus1 = "ACCEPTED" | "DELIVERED" | "ERROR" | "READ" | "SENT"

/** Meta application that processed the delivery status event */
export type ApplicationNode1 = {
  /** Unique identifier for the Meta application */
  id?: string
  /** Name of the Meta application */
  name?: string
}

/** Paginated response containing message history events */
export type MessageHistoryEventsResponse = {
  /** Array of message history event edges */
  data?: Array<WhatsAppMessageHistoryEventsEdge>
  paging?: PaginationInfo
}

/** Pagination information for navigating through results */
export type PaginationInfo1 = {
  /** Pagination cursors for navigation */
  cursors?: {
    /** Cursor for the previous page of results */
    before?: string
    /** Cursor for the next page of results */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** WhatsApp Business Account migration intent details and status */
export type WhatsAppBusinessAccountMigrationIntent = {
  /** Unique identifier for the migration intent */
  id: string
  status: WhatsAppBusinessAccountMigrationStatus
}

/** Current status of the WhatsApp Business Account migration intent */
export type WhatsAppBusinessAccountMigrationStatus = "ACCEPTED" | "COMPLETED" | "INITIATED" | "REJECTED"

/** Pre-verified phone number validation details and status */
export type PreVerifiedPhoneNumberValidation = {
  /** Unique identifier for the pre-verified phone number */
  id?: string
  /** Country code prefix for the phone number */
  country_prefix?: number
  /** Formatted display version of the phone number */
  display_phone_number?: string
  /** Error message if validation failed */
  error_msg?: string
  /** Whether the provided phone number ID is valid */
  is_input_id_valid: boolean
}

/** Response containing partner businesses for a pre-verified phone number */
export type WhatsAppBusinessPreVerifiedPhoneNumberPartnersResponse = {
  /** List of partner businesses with access to the pre-verified phone number */
  data: Array<BusinessPartner>
  paging?: CursorPaging
}

/** Business entity that has partner access to the pre-verified phone number */
export type BusinessPartner = {
  /** Unique identifier for the partner business */
  id: string
  /** Name of the partner business */
  name: string
  /** ISO 8601 timestamp when the business was created */
  created_time?: string
  /** ISO 8601 timestamp when the business was last updated */
  updated_time?: string
  /** Business verification status */
  verification_status?: "not_verified" | "pending" | "verified"
  /** Primary Facebook Page ID associated with the business */
  primary_page?: string
  /** Timezone identifier for the business location */
  timezone_id?: number
  /** Two-factor authentication method configured for the business */
  two_factor_type?: "none" | "admin_required"
}

/** Cursor-based pagination information */
export type CursorPaging5 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data that has been returned */
    before?: string
    /** Cursor pointing to the end of the page of data that has been returned */
    after?: string
  }
  /** Graph API endpoint URL for the next page of results */
  next?: string
  /** Graph API endpoint URL for the previous page of results */
  previous?: string
}

/** Request body for requesting verification code */
export type RequestCodeRequest1 = {
  code_method: PhoneVerificationMethodCode
  /** Language/locale code for the verification message. Must be a valid locale identifier. The verification message will be sent in this language if supported. Supports various formats including xx_XX, xx-XX, and extended locale codes. */
  language: string
}

/** Method for receiving the verification code */
export type PhoneVerificationMethodCode = "SMS" | "VOICE"

/** Response after successfully requesting verification code */
export type RequestCodeResponse1 = {
  /** Indicates whether the verification code request was successful */
  success: boolean
}

/** Request payload for verifying OTP code */
export type VerifyCodeRequest2 = {
  /** The numeric verification code received via SMS or voice call. This code is provided after calling the request_code endpoint. */
  code: string
}

/** Response indicating successful code verification */
export type VerifyCodeResponse1 = {
  /** Indicates whether the code verification was successful */
  success: boolean
}

/** Standard Graph API error response */
export type GraphAPIError9 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Granular BISU access token response for Multi-Partner Solution partners */
export type WhatsAppBusinessSolutionAccessToken = {
  /** Granular BISU access token for accessing customer business resources */
  access_token: string
  /** Unix timestamp indicating when the access token expires */
  expires_at: string
}

/** WhatsApp Business Multi-Partner Solution object with core node fields only */
export type WhatsAppBusinessSolution1 = {
  /** Unique identifier for the WhatsApp Business Solution */
  id: string
  /** Human-readable name for the solution (UGC text, 2-75 characters) */
  name: string
  status: WhatsAppBusinessSolutionStatus
  status_for_pending_request: WhatsAppBusinessSolutionPendingStatus
  /** Array of permissions granted to the solution owner */
  owner_permissions?: Array<WhatsAppBusinessAccountPermissionTask>
}

/** Current status of the WhatsApp Business Solution */
export type WhatsAppBusinessSolutionStatus1 =
  | "DRAFT"
  | "INITIATED"
  | "ACTIVE"
  | "REJECTED"
  | "DEACTIVATED"
  | "PENDING_DEACTIVATION"

/** Status of any pending requests for the solution */
export type WhatsAppBusinessSolutionPendingStatus1 = "PENDING_ACTIVATION" | "PENDING_DEACTIVATION" | "NONE"

/** Standard Graph API error response */
export type GraphAPIError10 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error type classification */
    type: "OAuthException" | "GraphMethodException" | "GraphAPIException"
    /** Numeric error code */
    code: number
    /** More specific error subcode */
    error_subcode?: number
    /** Internal trace ID for debugging */
    fbtrace_id?: string
    /** Whether this error might be resolved by retrying */
    is_transient?: boolean
    /** User-friendly error title */
    error_user_title?: string
    /** User-friendly error message */
    error_user_msg?: string
  }
}

/** Request payload for accepting a Multi-Partner Solution invitation */
export type WhatsAppBusinessSolutionAcceptRequest = {
  /** ID of the partner application accepting the solution invitation. This must match the app ID that received the original invitation. */
  partner_app_id: string
  /** Optional session identifier for logging and debugging purposes. Used to track the acceptance flow across multiple API calls. */
  log_session_id?: string
}

/** Successful response confirming solution acceptance */
export type WhatsAppBusinessSolutionAcceptResponse = {
  /** ID of the Multi-Partner Solution that was accepted */
  solution_id: string
  partner_status: WhatsAppBusinessSolutionPartnerStatus
  /** Indicates whether the acceptance was successful */
  success: boolean
  /** Human-readable confirmation message */
  message?: string
  /** Timestamp when the acceptance was processed */
  update_time?: string
}

/** Current status of the partner's participation in the Multi-Partner Solution */
export type WhatsAppBusinessSolutionPartnerStatus =
  | "DRAFT"
  | "INITIATED"
  | "NOTIFICATION_SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "DEACTIVATED"

/** Multi-Partner Solution details after rejecting deactivation request */
export type WhatsAppBusinessSolution2 = {
  /** Unique identifier for the Multi-Partner Solution */
  id: string
  /** Human-readable name of the Multi-Partner Solution */
  name: string
  status: WhatsAppBusinessSolutionStatus
  status_for_pending_request: WhatsAppBusinessSolutionPendingStatus
  owner_app?: ApplicationNode
  /** List of WhatsApp Business Account permissions granted to the solution owner */
  owner_permissions?: Array<WhatsAppBusinessAccountPermissionTask>
}

/** Standard Graph API error response */
export type GraphAPIError11 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error type classification */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Request payload for rejecting a Multi-Partner Solution request */
export type SolutionRejectRequest = {
  /** Type of request being rejected */
  request_type: "PARTNERSHIP_REQUEST" | "DEACTIVATION_REQUEST"
  /** Optional reason for rejecting the request */
  rejection_reason?: string
  /** The app ID of the requesting partner. Required when request_type is PARTNERSHIP_REQUEST, not used for DEACTIVATION_REQUEST */
  partner_app_id?: string
}

/** Successful response for solution rejection operation */
export type SolutionRejectResponse = {
  /** Indicates whether the rejection was successful */
  success: boolean
  /** The ID of the Multi-Partner Solution */
  solution_id: string
  /** Type of request that was rejected */
  rejected_request_type: "PARTNERSHIP_REQUEST" | "DEACTIVATION_REQUEST"
  /** ISO 8601 timestamp when the rejection was processed */
  rejection_timestamp?: string
  /** App ID of the partner whose request was rejected (for partnership rejections) */
  partner_app_id?: string
}

/** Request payload for sending a Multi-Partner Solution deactivation request */
export type WhatsAppBusinessSolutionDeactivationRequest = {
  /** Optional reason for the deactivation request */
  reason?: string
}

/** Successful response for deactivation request submission */
export type WhatsAppBusinessSolutionDeactivationResponse = {
  /** Indicates whether the deactivation request was successfully submitted */
  success: boolean
  /** Human-readable message describing the result */
  message: string
  /** Unique identifier for tracking the deactivation request */
  request_id?: string
}

/** WhatsApp Business Account assigned to a user */
export type AssignedWhatsAppBusinessAccount = {
  /** Unique identifier for the WhatsApp Business Account */
  id: string
  /** Display name of the WhatsApp Business Account */
  name: string
  status: WhatsAppBusinessAccountStatus
  /** Date and time when the account was assigned to the user */
  assignment_date?: string
  /** List of permissions granted to the user for this account */
  permissions?: Array<WhatsAppBusinessAccountPermission>
  /** Business ID that owns this WhatsApp Business Account */
  business_id?: string
  /** Phone numbers associated with this WhatsApp Business Account */
  phone_numbers?: Array<PhoneNumberInfo>
}

/** Current status of the WhatsApp Business Account */
export type WhatsAppBusinessAccountStatus = "ACTIVE" | "PENDING" | "RESTRICTED" | "DISABLED"

/** Permission level for WhatsApp Business Account access */
export type WhatsAppBusinessAccountPermission =
  | "MANAGE"
  | "DEVELOP"
  | "MANAGE_TEMPLATES"
  | "MANAGE_PHONE"
  | "VIEW_COST"
  | "MANAGE_EXTENSIONS"
  | "VIEW_PHONE_ASSETS"
  | "MANAGE_PHONE_ASSETS"
  | "VIEW_TEMPLATES"
  | "VIEW_INSIGHTS"
  | "RECEIVE_INCOMING_MESSAGES"
  | "MANAGE_BILLING"
  | "MANAGE_USERS"
  | "MESSAGING"
  | "FULL_CONTROL"

/** Phone number information for WhatsApp Business Account */
export type PhoneNumberInfo1 = {
  /** Phone number ID */
  id?: string
  /** Formatted phone number for display */
  display_phone_number?: string
  /** Verified business name for this phone number */
  verified_name?: string
  /** Status of the phone number */
  status?: "CONNECTED" | "DISCONNECTED" | "MIGRATED" | "PENDING" | "DELETED"
}

/** Response containing assigned WhatsApp Business Accounts */
export type AssignedAccountsResponse = {
  /** List of assigned WhatsApp Business Accounts */
  data: Array<AssignedWhatsAppBusinessAccount>
  paging?: PagingInfo
}

/** Pagination information for the response */
export type PagingInfo1 = {
  cursors?: {
    /** Cursor for the previous page */
    before?: string
    /** Cursor for the next page */
    after?: string
  }
  /** URL for the next page of results */
  next?: string
  /** URL for the previous page of results */
  previous?: string
}

/** WhatsApp Account Number details and configuration */
export type WhatsAppAccountNumber = {
  /** Unique identifier for the WhatsApp Account Number */
  id: string
  /** Phone number in international format for display purposes */
  display_phone_number: string
  /** Business name verified for this phone number */
  verified_name?: string
  status: WhatsAppAccountNumberStatus
  quality_rating?: WhatsAppPhoneNumberQualityRating
  /** ISO 3166-1 alpha-2 country code */
  country_code?: string
  /** Country dialing code */
  country_dial_code?: string
  code_verification_status?: WhatsAppCodeVerificationStatus
  name_status?: WhatsAppDisplayNameStatus
  /** Current messaging limit tier for the account number */
  messaging_limit_tier?: "TIER_50" | "TIER_250" | "TIER_1K" | "TIER_10K" | "TIER_100K" | "TIER_UNLIMITED"
  account_mode?: WhatsAppBusinessSandboxEligibility
  /** Business certificate information for the account number */
  certificate?: string
  /** Whether this is an official business account */
  is_official_business_account?: boolean
}

/** Current status of the WhatsApp Account Number */
export type WhatsAppAccountNumberStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "UNVERIFIED"
  | "PENDING"
  | "FLAGGED"
  | "RESTRICTED"

/** Quality rating based on message delivery and user feedback */
export type WhatsAppPhoneNumberQualityRating = "GREEN" | "YELLOW" | "RED" | "NA"

/** Two-step verification status for the phone number */
export type WhatsAppCodeVerificationStatus = "VERIFIED" | "UNVERIFIED"

/** Status of the display name associated with the phone number */
export type WhatsAppDisplayNameStatus =
  | "APPROVED"
  | "AVAILABLE_WITHOUT_REVIEW"
  | "DECLINED"
  | "EXPIRED"
  | "PENDING_REVIEW"
  | "NONE"

/** Account mode indicating sandbox or live environment */
export type WhatsAppBusinessSandboxEligibility = "LIVE" | "SANDBOX"

/** User assigned to WhatsApp Business Account with permissions */
export type AssignedUser = {
  /** Unique identifier for the assigned user */
  id: string
  /** Display name of the assigned user */
  name: string
  business?: BusinessNode
  user_type?: AssignedUserType
}

/** Type of user assignment */
export type AssignedUserType = "BUSINESS_USER" | "SYSTEM_USER" | "PERSONAL_USER"

/** Business entity associated with the user */
export type BusinessNode = {
  /** Unique identifier for the business */
  id?: string
  /** Name of the business */
  name?: string
}

/** Response containing list of assigned users with pagination */
export type AssignedUsersResponse = {
  /** Array of assigned users */
  data: Array<AssignedUser>
  paging?: CursorPaging
  summary?: AssignedUsersSummary
}

/** Summary information about assigned users */
export type AssignedUsersSummary = {
  /** Total number of assigned users */
  total_count?: number
}

/** Cursor-based pagination information */
export type CursorPaging6 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data */
    before?: string
    /** Cursor pointing to the end of the page of data */
    after?: string
  }
  /** Graph API endpoint for the next page of results */
  next?: string
  /** Graph API endpoint for the previous page of results */
  previous?: string
}

/** Standard success response for write operations */
export type SuccessResponse1 = {
  /** Indicates whether the operation was successful */
  success: boolean
}

/** Request payload for configuring conversational automation settings */
export type ConversationalAutomationRequest = {
  /** Whether to enable welcome messages for new conversations */
  enable_welcome_message?: boolean
  /** List of conversation prompts (ice breakers) to help guide customer interactions */
  prompts?: Array<string>
  /** List of bot commands for automated responses */
  commands?: Array<BotCommand>
}

/** Bot command configuration for automated responses */
export type BotCommand = {
  /** Name of the bot command (without leading slash) */
  command_name: string
  /** Description of what the command does */
  command_description: string
}

/** Response after successfully configuring conversational automation */
export type ConversationalAutomationResponse = {
  /** Indicates whether the automation configuration was successful */
  success: boolean
}

/** On-behalf request details for business owned objects */
export type BusinessOwnedObjectOnBehalfOfRequest = {
  /** Unique identifier for the on-behalf request */
  id: string
  status: BusinessRequestStatus
  /** ID of the business owned object (WhatsApp Business Account) for this request */
  business_owned_object: string
  receiving_business?: BusinessNode
  requesting_business?: BusinessNode
}

/** Current status of the business request */
export type BusinessRequestStatus =
  | "APPROVE"
  | "DECLINE"
  | "IN_PROGRESS"
  | "EXPIRED"
  | "PENDING"
  | "CANCELED"
  | "INVALID"

/** Business entity information */
export type BusinessNode1 = {
  /** Unique identifier for the business */
  id?: string
  /** Name of the business */
  name?: string
}

/** Pagination information for cursor-based pagination */
export type PaginationInfo2 = {
  cursors?: {
    /** Cursor pointing to the start of the page */
    before?: string
    /** Cursor pointing to the end of the page */
    after?: string
  }
  paging?: {
    /** URL for the previous page of results */
    previous?: string
    /** URL for the next page of results */
    next?: string
  }
}

/** Response containing in-progress on-behalf requests with pagination */
export type InProgressOnBehalfRequestResponse = {
  /** Array of in-progress on-behalf requests */
  data: Array<BusinessOwnedObjectOnBehalfOfRequest>
  paging?: PaginationInfo
}

/** WhatsApp Business Account OBO Mobility Intent Node */
export type OBOMobilityIntentNode = {
  /** Unique identifier for the OBO Mobility Intent Node */
  id: string
  waba: WhatsAppBusinessAccount
  solution: WhatsAppBusinessSolution
  /** Current status of the OBO mobility intent */
  status?: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED"
  /** Timestamp when the OBO mobility intent was created (ISO 8601 format) */
  created_time?: string
  /** Timestamp when the OBO mobility intent was last updated (ISO 8601 format) */
  updated_time?: string
}

/** WhatsApp Business Account information */
export type WhatsAppBusinessAccount2 = {
  /** WhatsApp Business Account ID */
  id: string
  /** Business account name */
  name: string
  /** Current status of the business account */
  status?: "ACTIVE" | "INACTIVE" | "PENDING"
}

/** WhatsApp Business Solution information */
export type WhatsAppBusinessSolution3 = {
  /** Solution ID */
  id: string
  /** Solution name */
  name: string
  /** Partner ID associated with the solution */
  partner_id?: string
  /** Current status of the solution */
  status?: "ACTIVE" | "INACTIVE" | "PENDING"
}

/** Request payload for OBO mobility intent operations */
export type OBOMobilityIntentRequest = {
  /** Unique identifier for the WhatsApp Business Solution */
  solution_id: string
  intent_type: MobilityIntentType
  /** Target solution ID for mobility operations (required for transfers) */
  target_solution_id?: string
  /** Reason for the mobility intent */
  mobility_reason?: string
  /** Scheduled time for mobility execution (ISO 8601 format) */
  scheduled_execution_time?: string
  /** Additional metadata for the mobility operation */
  metadata?: Record<string, unknown>
}

/** Type of mobility intent operation */
export type MobilityIntentType =
  | "INITIATE_TRANSFER"
  | "CONFIRM_TRANSFER"
  | "CANCEL_TRANSFER"
  | "REQUEST_HANDOVER"
  | "APPROVE_HANDOVER"
  | "REJECT_HANDOVER"

/** Response for OBO mobility intent operations */
export type OBOMobilityIntentResponse = {
  /** Indicates if the mobility intent operation was successful */
  success: boolean
  /** Unique identifier for the mobility intent request */
  mobility_intent_id: string
  /** Current status of the mobility intent */
  status?: "PENDING" | "APPROVED" | "REJECTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
  /** Estimated completion time for the mobility operation (ISO 8601 format) */
  estimated_completion_time?: string
  /** Indicates if additional approval is required for the operation */
  approval_required?: boolean
  /** List of next steps required to complete the mobility operation */
  next_steps?: Array<string>
}

/** WhatsApp Business Account phone number details and status information */
export type WhatsAppBusinessAccountPhoneNumber = {
  /** Unique identifier for the phone number status record */
  id: string
  /** Phone number in international format for display purposes */
  display_phone_number: string
  /** Business name verified for this phone number */
  verified_name?: string
  status: WhatsAppPhoneNumberStatus
  quality_rating?: WhatsAppPhoneNumberQualityRating
  /** ISO 3166-1 alpha-2 country code */
  country_code?: string
  /** Country dialing code */
  country_dial_code?: string
  code_verification_status?: WhatsAppCodeVerificationStatus
  unified_cert_status?: WhatsAppBusinessUnifiedCertStatus
  account_mode?: WhatsAppBusinessSandboxEligibility
  host_platform?: WhatsAppBusinessAccountHostPlatform
  /** Current messaging limit tier for the phone number */
  messaging_limit_tier?: "TIER_50" | "TIER_250" | "TIER_1K" | "TIER_10K" | "TIER_100K" | "TIER_UNLIMITED"
  /** Whether this is an official business account */
  is_official_business_account?: boolean
  /** WhatsApp username for the business account (if available) */
  username?: string | null
}

/** Current status of the phone number in the WhatsApp Business Account */
export type WhatsAppPhoneNumberStatus =
  | "PENDING"
  | "LINKED"
  | "UNLINKED"
  | "DELETED"
  | "MIGRATED"
  | "BANNED"
  | "RESTRICTED"

/** Quality rating for the phone number based on messaging patterns */
export type WhatsAppPhoneNumberQualityRating1 = "GREEN" | "YELLOW" | "RED" | "UNKNOWN"

/** Status of phone number verification code */
export type WhatsAppCodeVerificationStatus1 = "VERIFIED" | "NOT_VERIFIED"

/** Unified certification status combining business and name verification */
export type WhatsAppBusinessUnifiedCertStatus =
  | "APPROVED"
  | "NAME_PENDING_REVIEW"
  | "NAME_NOT_APPROVED"
  | "ACCOUNT_REVIEW_NOT_STARTED"
  | "LIMITED_ACCESS"

/** Account mode indicating sandbox or live environment eligibility */
export type WhatsAppBusinessSandboxEligibility1 = "LIVE" | "SANDBOX"

/** Platform hosting the WhatsApp Business Account */
export type WhatsAppBusinessAccountHostPlatform = "CLOUD_API" | "ON_PREMISE" | "NOT_APPLICABLE"

/** Paginated collection of WhatsApp Business Account phone numbers */
export type WhatsAppBusinessAccountPhoneNumbersConnection = {
  /** Array of phone number records */
  data: Array<WhatsAppBusinessAccountPhoneNumber>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging7 = {
  cursors?: {
    /** Cursor pointing to the start of the page */
    before?: string
    /** Cursor pointing to the end of the page */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** Request payload for creating a new phone number registration */
export type PhoneNumberCreateRequest = {
  /** Phone number in E.164 format without the + prefix */
  phone_number: string
  /** Business name to be verified for this phone number */
  verified_name: string
  /** Country code for the phone number */
  cc?: string
  /** Whether this is a phone number migration from on-premises */
  migrate_phone_number?: boolean
  /** Pre-verified phone number ID for BSP scenarios */
  preverified_id?: string
}

/** Response after successfully creating a phone number registration */
export type PhoneNumberCreateResponse = {
  /** Unique identifier for the created phone number status record */
  id: string
}

/** WhatsApp Business Account schedule configuration and details */
export type WhatsAppBusinessAccountSchedule = {
  /** Unique identifier for the schedule */
  id: string
  /** Human-readable name for the schedule */
  name: string
  status: WhatsAppScheduleStatus
  schedule_type: WhatsAppScheduleType
  /** Optional description of the schedule purpose */
  description?: string
  /** Schedule start time in HH:MM format */
  start_time?: string
  /** Schedule end time in HH:MM format */
  end_time?: string
  /** Timezone identifier for the schedule */
  timezone?: string
  /** Days of the week when the schedule is active */
  days_of_week?: Array<DayOfWeek>
  /** ISO 8601 timestamp when the schedule was created */
  created_time?: string
  /** ISO 8601 timestamp when the schedule was last updated */
  updated_time?: string
  /** Whether the schedule is currently active */
  is_active?: boolean
  recurrence_pattern?: RecurrencePattern
}

/** Current status of the schedule */
export type WhatsAppScheduleStatus = "ACTIVE" | "INACTIVE" | "PAUSED" | "EXPIRED" | "DRAFT"

/** Type of schedule configuration */
export type WhatsAppScheduleType =
  | "BUSINESS_HOURS"
  | "AUTOMATED_RESPONSE"
  | "MESSAGE_CAMPAIGN"
  | "MAINTENANCE_WINDOW"
  | "CUSTOM"

/** Day of the week */
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

/** Pattern for recurring schedules */
export type RecurrencePattern = {
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
  /** Interval between recurrences */
  interval?: number
  /** End date for the recurrence pattern */
  end_date?: string
}

/** Paginated collection of WhatsApp Business Account schedules */
export type WhatsAppBusinessAccountSchedulesConnection = {
  /** Array of schedule records */
  data: Array<WhatsAppBusinessAccountSchedule>
  paging?: CursorPaging
}

/** Cursor-based pagination information */
export type CursorPaging8 = {
  cursors?: {
    /** Cursor pointing to the start of the page */
    before?: string
    /** Cursor pointing to the end of the page */
    after?: string
  }
  /** URL for the previous page of results */
  previous?: string
  /** URL for the next page of results */
  next?: string
}

/** Request payload for creating a new schedule */
export type ScheduleCreateRequest = {
  /** Human-readable name for the schedule */
  name: string
  schedule_type: WhatsAppScheduleType
  /** Optional description of the schedule purpose */
  description?: string
  /** Schedule start time in HH:MM format */
  start_time: string
  /** Schedule end time in HH:MM format */
  end_time: string
  /** Timezone identifier for the schedule */
  timezone?: string
  /** Days of the week when the schedule is active */
  days_of_week?: Array<DayOfWeek>
  /** Whether the schedule should be active upon creation */
  is_active?: boolean
  recurrence_pattern?: RecurrencePattern
}

/** Response after successfully creating a schedule */
export type ScheduleCreateResponse = {
  /** Unique identifier for the created schedule */
  id: string
}

/** Request payload for setting OBO mobility intent */
export type SetOBOMobilityIntentRequest = {
  /** WhatsApp Business Account ID for which to set OBO mobility intent */
  waba_id: string
  /** Unique identifier for the Multi-Partner Solution */
  solution_id?: string
  /** Application ID requesting OBO mobility intent */
  app_id?: string
  /** Actor ID performing the OBO mobility intent operation */
  actor_id?: string
  /** Client-provided mutation identifier for request tracking */
  client_mutation_id?: string
}

/** Response for setting OBO mobility intent */
export type SetOBOMobilityIntentResponse = {
  /** Indicates if the OBO mobility intent was set successfully */
  success: boolean
  /** Unique identifier for the created OBO mobility intent */
  intent_id?: string
  /** Client-provided mutation identifier echoed back */
  client_mutation_id?: string
  /** Error message if the operation failed */
  error_msg?: string
}

/** Request payload for setting solution migration intent */
export type SetSolutionMigrationIntentRequest = {
  /** Unique identifier for the Multi-Partner Solution */
  solution_id: string
  migration_intent: SolutionMigrationIntent
  /** Target solution ID for migration (required for certain migration intents) */
  target_solution_id?: string
  /** Reason for the migration intent */
  migration_reason?: string
  /** Scheduled time for migration execution (ISO 8601 format) */
  scheduled_migration_time?: string
}

/** Intent for solution migration */
export type SolutionMigrationIntent =
  | "INITIATE_MIGRATION"
  | "CANCEL_MIGRATION"
  | "CONFIRM_MIGRATION"
  | "SCHEDULE_MIGRATION"

/** Response for setting solution migration intent */
export type SetSolutionMigrationIntentResponse = {
  /** Indicates if the migration intent was set successfully */
  success: boolean
  /** Unique identifier for the migration intent request */
  migration_intent_id: string
  /** Current status of the migration intent */
  status?: "PENDING" | "APPROVED" | "REJECTED" | "SCHEDULED"
  /** Estimated completion time for the migration (ISO 8601 format) */
  estimated_completion_time?: string
}

/** Paginated list of Multi-Partner Solutions */
export type SolutionsList = {
  /** Array of Multi-Partner Solutions associated with the WABA */
  data: Array<WhatsAppBusinessSolution>
  paging?: Paging
}

/** Pagination information for cursor-based pagination */
export type Paging1 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data that has been returned */
    before?: string
    /** Cursor pointing to the end of the page of data that has been returned */
    after?: string
  }
  /** Graph API endpoint URL for the previous page of data */
  previous?: string
  /** Graph API endpoint URL for the next page of data */
  next?: string
}

/** Standard Graph API error response */
export type GraphAPIError12 = {
  error: {
    /** Human-readable error message */
    message: string
    /** Error category type */
    type: string
    /** Numeric error code */
    code: number
    /** More specific error subcode when available */
    error_subcode?: number
    /** Unique identifier for debugging and support requests with Meta */
    fbtrace_id?: string
    /** Indicates whether this error is temporary and the request should be retried */
    is_transient?: boolean
    /** User-friendly error title for display purposes */
    error_user_title?: string
    /** User-friendly error message for display purposes */
    error_user_msg?: string
  }
}

/** Application subscription data for WhatsApp Business Account */
export type WhatsAppBusinessApiData1 = {
  /** Unique identifier for the subscribed application */
  id: string
  /** Name of the subscribed application */
  name: string
  /** URL link to the application */
  link?: string
}

/** Subscribed application details */
export type SubscribedApp1 = {
  whatsapp_business_api_data: WhatsAppBusinessApiData
  /** Custom webhook callback URL for this subscription */
  override_callback_uri?: string
}

/** Response containing list of subscribed applications */
export type SubscribedAppsResponse = {
  /** Array of subscribed applications */
  data: Array<SubscribedApp>
}

/** Request body for subscribing to WABA webhooks */
export type SubscriptionRequest = {
  /** Custom webhook callback URL to override app default */
  override_callback_uri?: string
  /** Verification token for webhook security */
  verify_token?: string
}

/** Response after successful subscription operation */
export type SubscriptionResponse = {
  /** Indicates whether the subscription operation was successful */
  success: boolean
  /** Array containing subscription details */
  data?: Array<SubscribedApp>
}

/** WhatsApp Business Account activity record */
export type WhatsAppBusinessAccountActivity = {
  /** Unique identifier for the activity record */
  id: string
  activity_type: ActivityType
  /** ISO 8601 timestamp when the activity occurred */
  timestamp: string
  actor_type: ActorType
  /** ID of the user or system that performed the activity */
  actor_id?: string
  /** Name of the user or system that performed the activity */
  actor_name?: string
  /** Human-readable description of the activity */
  description?: string
  /** Additional structured details about the activity */
  details?: Record<string, unknown>
  /** IP address from which the activity was performed (when available) */
  ip_address?: string
  /** User agent string from the client that performed the activity */
  user_agent?: string
}

/** Type of activity performed on the WhatsApp Business Account */
export type ActivityType =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_UPDATED"
  | "ACCOUNT_DELETED"
  | "PHONE_NUMBER_ADDED"
  | "PHONE_NUMBER_REMOVED"
  | "PHONE_NUMBER_VERIFIED"
  | "USER_ADDED"
  | "USER_REMOVED"
  | "USER_ROLE_CHANGED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_REVOKED"
  | "TEMPLATE_CREATED"
  | "TEMPLATE_UPDATED"
  | "TEMPLATE_DELETED"
  | "WEBHOOK_CONFIGURED"
  | "API_ACCESS_GRANTED"
  | "API_ACCESS_REVOKED"
  | "BILLING_UPDATED"
  | "COMPLIANCE_ACTION"
  | "SECURITY_EVENT"

/** Type of entity that performed the activity */
export type ActorType = "USER" | "SYSTEM" | "API" | "ADMIN" | "AUTOMATED_PROCESS"

/** Paginated list of WhatsApp Business Account activities */
export type ActivityList = {
  /** Array of activity records */
  data: Array<WhatsAppBusinessAccountActivity>
  paging?: Paging
}

/** Pagination information for activity results */
export type Paging2 = {
  cursors?: {
    /** Cursor pointing to the start of the page of data */
    before?: string
    /** Cursor pointing to the end of the page of data */
    after?: string
  }
  /** Graph API endpoint URL for the previous page of results */
  previous?: string
  /** Graph API endpoint URL for the next page of results */
  next?: string
}

/** WhatsApp Business Account details and configuration */
export type WhatsAppBusinessAccount3 = {
  /** Unique identifier for the WhatsApp Business Account */
  id: string
  /** Human-readable name of the WhatsApp Business Account */
  name: string
  /** Timezone identifier for the WhatsApp Business Account */
  timezone_id?: string
  /** Message template namespace for the WhatsApp Business Account */
  message_template_namespace?: string
  account_review_status?: WhatsAppBusinessAccountReviewStatus
  business_verification_status?: WhatsAppBusinessAccountVerificationStatus
  /** Country code for the WhatsApp Business Account */
  country?: string
  ownership_type?: WhatsAppBusinessAccountOwnershipType
  /** Primary business location for the WhatsApp Business Account */
  primary_business_location?: string
}

/** Review status of the WhatsApp Business Account */
export type WhatsAppBusinessAccountReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "LIMIT_REACHED"

/** Business verification status of the WhatsApp Business Account */
export type WhatsAppBusinessAccountVerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING"

/** Ownership type of the WhatsApp Business Account */
export type WhatsAppBusinessAccountOwnershipType = "SELF_OWNED" | "CLIENT_OWNED" | "AGENCY_OWNED"

/** WhatsApp Business Bot configuration and details */
export type WhatsAppBusinessBot = {
  /** Unique identifier for the WhatsApp Business Bot */
  id: string
  /** List of bot prompts and automated responses */
  prompts?: Array<string>
  /** List of available bot commands and their descriptions */
  commands?: Array<WhatsAppBusinessBotCommand>
  /** Whether the welcome message is enabled for this bot */
  enable_welcome_message?: boolean
}

/** Bot command configuration with name and description */
export type WhatsAppBusinessBotCommand = {
  /** Name of the bot command */
  command_name: string
  /** Description of what the command does */
  command_description: string
}

/** WhatsApp Business Profile node details and configuration */
export type WhatsAppBusinessProfileNode = {
  /** Unique identifier for the WhatsApp Business Profile */
  id: string
  /** Name of the business account */
  account_name?: string
  /** Business description text */
  description?: string
  /** Contact email address of the business */
  email?: string
  /** About section text for the business profile */
  about?: string
  /** Physical address of the business */
  address?: string
  vertical?: WhatsAppBusinessVertical
  /** List of website URLs associated with the business */
  websites?: Array<string>
  /** URL of the business profile picture */
  profile_picture_url?: string
  /** Handle of the profile picture for upload operations */
  profile_picture_handle?: string
  /** The messaging service used */
  messaging_product?: "whatsapp"
}

/** Request payload for updating WhatsApp Business Profile information */
export type WhatsAppBusinessProfileUpdateRequest1 = {
  /** The messaging service used for the request */
  messaging_product: "whatsapp"
  /** Name of the business account */
  account_name?: string
  /** Business description text */
  description?: string
  /** Contact email address of the business */
  email?: string
  /** About section text for the business profile */
  about?: string
  /** Physical address of the business */
  address?: string
  vertical?: WhatsAppBusinessVertical
  /** List of website URLs associated with the business */
  websites?: Array<string>
  /** Handle of the profile picture generated from Resumable Upload API */
  profile_picture_handle?: string
}

/** Response from updating WhatsApp Business Profile */
export type WhatsAppBusinessProfileUpdateResponse1 = {
  /** WhatsApp Business Profile ID that was updated */
  id?: string
  /** Indicates if the update was successful */
  success?: boolean
}

/** Industry vertical classification for the business */
export type WhatsAppBusinessVertical1 =
  | "UNDEFINED"
  | "OTHER"
  | "AUTO"
  | "BEAUTY"
  | "APPAREL"
  | "EDU"
  | "ENTERTAIN"
  | "EVENT_PLAN"
  | "FINANCE"
  | "GROCERY"
  | "GOVT"
  | "HOTEL"
  | "HEALTH"
  | "NONPROFIT"
  | "PROF_SERVICES"
  | "RETAIL"
  | "TRAVEL"
  | "RESTAURANT"
  | "NOT_A_BIZ"

export type WebhookPayload = {
  /** Always 'whatsapp_business_account' for these webhooks. */
  object: string
  entry: Array<Entry>
}

export type Entry = {
  /** WhatsApp Business Account ID. */
  id: string
  changes: Array<Change>
}

export type Change = {
  value: IncomingMessageValueGeneral | IncomingMessageValueSystem | StatusMessageValue | GroupValue
  /** The field indicate to what object is the webhook related: - messages: the webhook is related to messages from consumer or status of message sent by business to consumer. - group_lifecycle_update: the webhook is related to group creation and deletion. - group_settings_update: the webhook is related to group settings update. - group_participant_update: the webhook is related to participants joining and leaving the groups. */
  field: "messages" | "group_lifecycle_update" | "group_settings_update" | "group_participant_update"
}

export type Metadata = {
  /** Business display phone number. */
  display_phone_number: string
  /** Business phone number ID. */
  phone_number_id: string
}

export type ContactProfile = {
  profile: {
    /** WhatsApp user's name as it appears in their profile in the WhatsApp client. */
    name: string
  }
  /** WhatsApp user ID. Note that a WhatsApp user's ID and phone number may not always match. */
  wa_id?: string
}

export type IncomingMessageValueGeneral = {
  /** Always 'whatsapp'. */
  messaging_product: string
  metadata: Metadata
  /** Array of contact profiles for the sender. Included for all non-system incoming messages. */
  contacts: Array<ContactProfile>
  /** Array of message objects. The structure varies based on the 'type' property. */
  messages: Array<IncomingMessage>
}

export type IncomingMessageValueSystem = {
  /** Always 'whatsapp'. */
  messaging_product: string
  metadata: Metadata
  /** Array containing only 'system' message objects. */
  messages: Array<SystemMessage>
}

export type StatusMessageValue = {
  /** Always 'whatsapp'. */
  messaging_product: string
  metadata: Metadata
  /** Array of status objects. */
  statuses: Array<Statuses>
}

export type Statuses = {
  /** Unique WhatsApp message ID the status is associated with. */
  id: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: string
  /** Recipeint phone number. */
  recipient_id: string
  /** Group ID if the message was sent to a group. */
  group_id?: string
  conversation?: Conversation
  pricing?: Pricing
  errors?: Array<StatusError>
}

export type Conversation = {
  id?: string
  expiration_timestamp?: string
  origin?: ConversationOrigin
}

export type ConversationOrigin = {
  type?: string
}

export type Pricing = {
  billable?: boolean
  pricing_model?: "CBP" | "PMP"
  category?: string
}

export type StatusError = {
  code?: number
  title?: string
  message?: string
  error_data?: ErrorData
  href?: string
}

export type ErrorData = {
  details?: string
}

export type GroupValue = {
  /** Always 'whatsapp'. */
  messaging_product: string
  metadata: Metadata
  /** Array of group objects. */
  groups: Array<Groups>
}

export type Groups = {
  /** Unix timestamp of the group event */
  timestamp: number
  /** Unique identifier for the group */
  group_id: string
  /** Type of group event */
  type:
    | "group_create"
    | "group_delete"
    | "group_settings_update"
    | "group_add_participants"
    | "group_remove_participants"
  /** Unique identifier for the request */
  request_id: string
  /** Group subject/name */
  subject?: string
  /** Group description */
  description?: string
  /** List of participants added to the group */
  added_participants?: Array<GroupParticipant>
  /** List of participants removed from the group */
  removed_participants?: Array<GroupParticipant>
  /** Group profile picture information */
  profile_picture?: GroupProfilePicture
}

export type GroupParticipant = {
  /** Input phone number or WhatsApp ID */
  input?: string
  /** WhatsApp ID of the participant */
  wa_id?: string
}

export type GroupProfilePicture = {
  /** MIME type of the profile picture */
  mime_type?: string
  /** SHA256 hash of the profile picture */
  sha256?: string
}

export type BaseMessageProperties1 = {
  /** WhatsApp user phone number. Note that a WhatsApp user's phone number and ID may not always match. */
  from: string
  /** Unique WhatsApp message ID. */
  id: string
  /** Unix timestamp indicating when the webhook was triggered. */
  timestamp: string
}

export type IncomingMessage =
  | TextMessage
  | ReactionMessage
  | AudioMessage
  | DocumentMessage
  | ImageMessage
  | StickerMessage
  | VideoMessage
  | LocationMessage
  | ContactSharingMessage
  | UnsupportedMessage
  | UnsupportedMessage
  | ButtonMessage
  | InteractiveMessageReply
  | OrderMessage

export type TextMessage2 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "text"
  context?: ContextObject
  text: {
    /** Text body of the message. */
    body: string
  }
  referral?: ReferralObject
}

/** Only included if message via a "Message business" button. */
export type ContextObject = {
  /** Business display phone number. */
  from: string
  /** WhatsApp message ID of the message the user used to access the "Message business" button. */
  id: string
  referred_product: {
    /** Product catalog ID. */
    catalog_id: string
    /** Product ID. */
    product_retailer_id: string
  }
}

/** Only included if message via a Click to WhatsApp ad. */
export type ReferralObject = {
  /** Ad URL. */
  source_url: string
  /** Ad ID. */
  source_id: string
  source_type: "ad" | "post"
  /** Ad primary text. */
  body: string
  /** Ad headline. */
  headline: string
  media_type: "image" | "video"
  /** Only included for image media_type. */
  image_url?: string
  /** Only included for video media_type. */
  video_url?: string
  /** Only included for video media_type. */
  thumbnail_url?: string
  /** Ad click ID. */
  ctwa_clid: string
  welcome_message?: {
    /** Ad greeting text. */
    text: string
  }
}

export type ReactionMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "reaction"
  context?: MessageContext
  reaction: {
    /** WhatsApp message ID of the message the WhatsApp user reacted to. */
    message_id: string
    /** Emoji sent by the WhatsApp user as a reaction. */
    emoji: string
  }
}

export type MediaMessageProperties = {
  /** Media asset MIME type. */
  mime_type: string
  /** Media asset SHA-256 hash. */
  sha256: string
  /** Media asset ID. A GET request on this ID can provide the asset URL. */
  id: string
}

export type AudioMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "audio"
  context?: MessageContext
  audio: {
    /** Media asset MIME type. */
    mime_type: string
    /** Media asset SHA-256 hash. */
    sha256: string
    /** Media asset ID. A GET request on this ID can provide the asset URL. */
    id: string
    /** Boolean indicating if audio is a recording made with the WhatsApp client voice recording feature (true) or not (false). */
    voice: boolean
  }
}

export type DocumentMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "document"
  context?: MessageContext
  document: {
    /** Media asset MIME type. */
    mime_type: string
    /** Media asset SHA-256 hash. */
    sha256: string
    /** Media asset ID. A GET request on this ID can provide the asset URL. */
    id: string
    /** Media asset filename. */
    filename: string
  }
}

export type ImageMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "image"
  context?: MessageContext
  image: {
    /** Media asset MIME type. */
    mime_type: string
    /** Media asset SHA-256 hash. */
    sha256: string
    /** Media asset ID. A GET request on this ID can provide the asset URL. */
    id: string
    /** Media asset caption text. */
    caption?: string
  }
}

export type StickerMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "sticker"
  context?: MessageContext
  sticker: {
    /** Media asset MIME type. */
    mime_type: string
    /** Media asset SHA-256 hash. */
    sha256: string
    /** Media asset ID. A GET request on this ID can provide the asset URL. */
    id: string
    /** Boolean indicating if the sticker is animated (true) or not (false). */
    animated: boolean
  }
}

export type VideoMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "video"
  context?: MessageContext
  video: {
    /** Media asset MIME type. */
    mime_type: string
    /** Media asset SHA-256 hash. */
    sha256: string
    /** Media asset ID. A GET request on this ID can provide the asset URL. */
    id: string
    /** Media asset caption text. */
    caption?: string
  }
}

export type LocationMessage1 = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "location"
  context?: MessageContext
  location: {
    /** Location address. */
    address: string
    /** Location latitude. */
    latitude: number
    /** Location longitude. */
    longitude: number
    /** Location name. */
    name: string
    /** Location URL. Usually only included for business locations. */
    url?: string
  }
}

export type ContactSharingMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "contacts"
  context?: MessageContext
  /** Array of contact objects. Many contact object properties may be omitted if the WhatsApp user chooses not to share them, or their device prevents them from being shared. */
  contacts: Array<ContactObject>
}

export type ContactObject1 = {
  addresses?: Array<{
    /** City mentioned in the contact address */
    city?: string
    /** Country mentioned in the contact address */
    country?: string
    /** ISO country code for the contact address */
    country_code?: string
    /** State mentioned in the contact address */
    state?: string
    /** Street mentioned in the contact address */
    street?: string
    /** Type of address, such as home or work */
    type?: string
    /** Zip code in the contact address */
    zip?: string
  }>
  /** Contact birthday (YYYY-MM-DD). */
  birthday?: string
  emails?: Array<{
    /** Email address of the contact */
    email?: string
    /** Type of email, such as personal or work */
    type?: string
  }>
  name?: {
    /** Contact's formatted name */
    formatted_name: string
    /** Contact’s first name */
    first_name?: string
    /** Contact’s last name */
    last_name?: string
    /** Contact’s middle name */
    middle_name?: string
    /** Contact’s name suffix */
    suffix?: string
    /** Contact’s name prefix */
    prefix?: string
  }
  org?: {
    /** Name of the company where the contact works */
    company?: string
    /** Name of the department where the contact works */
    department?: string
    /** Contact's job title */
    title?: string
  }
  phones?: Array<{
    /** Contact’s Phone number */
    phone?: string
    /** Contact's WhatsApp Number. Note that a WhatsApp user's ID and phone number may not always match. */
    wa_id?: string
    /** Type of phone number. For example, cell, mobile, main, iPhone, home, work, etc. */
    type?: string
  }>
  urls?: Array<{
    /** Website URL associated with the contact or their company */
    url?: string
    /** Type of website. For example, company, work, personal, Facebook Page, Instagram, etc. */
    type?: string
  }>
}

export type UnsupportedMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "unsupported" | "unknown"
  context?: MessageContext
  errors: Array<ErrorObject>
}

export type ErrorObject2 = {
  /** Error code. */
  code: number
  /** Error code title. */
  title: string
  /** Error code message. */
  message: string
  error_data: {
    /** Error code details. */
    details: string
  }
  /** Link to error code documentation. */
  href?: string
}

export type ButtonMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "button"
  context: {
    /** Business display phone number. */
    from: string
    /** WhatsApp message ID of the message containing the button the WhatsApp user tapped. */
    id: string
  }
  button: {
    /** Quick-reply button payload. */
    payload: string
    /** Quick-reply button label text. */
    text: string
  }
}

export type InteractiveMessageReply = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "interactive"
  context: {
    /** Business display phone number. */
    from: string
    /** WhatsApp message ID of the message containing the interactive component the user tapped. */
    id: string
  }
  interactive: {
    /** Type of interactive reply (list_reply or button_reply). */
    type: "list_reply" | "button_reply"
  }
}

export type InteractiveListReplyContent = {
  list_reply: {
    /** Row ID. */
    id: string
    /** Row title. */
    title: string
    /** Row description. */
    description: string
  }
}

export type InteractiveButtonReplyContent = {
  button_reply: {
    /** Button ID. */
    id: string
    /** Button label text. */
    title: string
  }
}

export type OrderMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "order"
  context?: MessageContext
  order: {
    /** Product catalog ID. */
    catalog_id: string
    /** Empty string. */
    text: string
    product_items: Array<{
      /** Product ID. */
      product_retailer_id: string
      /** Product quantity. */
      quantity: number
      /** Individual product price. */
      item_price: number
      /** Catalog currency code. */
      currency: string
    }>
  }
}

export type SystemMessage = {
  messaging_product: string
  /** The type of recipient. */
  recipient_type: "individual" | "group"
  /** The recipient's phone number for individual messages, and group-id for group message. */
  to: string
  type: "system"
  context?: MessageContext
  system: {
    /** Description of the system change (e.g., user changed number). */
    body: string
    /** The user's WhatsApp ID. On user_changed_number messages this is the new phone number. Omitted when the user has no phone number visible to the business. */
    wa_id?: string
    /** Type of system message. user_changed_number reports a change to the user's phone number and carries the new number. user_changed_user_id reports a change to the user's business-scoped user ID, with no phone number included. */
    type: "user_changed_number" | "user_changed_user_id"
    /** The user's current business-scoped user ID (BSUID). Omitted when business-scoped user IDs are not enabled for the business. */
    user_id?: string
    /** The user's current business-scoped user ID (BSUID) scoped to the parent business portfolio. Omitted when the business is not onboarded to parent-scoped IDs. */
    parent_user_id?: string
    /** The business-scoped user ID (BSUID) the user had before the change. Omitted when the previous BSUID is unavailable. */
    previous_user_id?: string
    /** The parent-scoped business-scoped user ID (BSUID) the user had before the change. Omitted when the previous parent BSUID is unavailable. */
    previous_parent_user_id?: string
  }
}

export type GetBusinessPortfolioResponse = {
  id?: string
  name?: string
  timezone_id?: number
}

export type BlockUsersRequest = {
  block_users?: Array<{
    user?: string
  }>
  messaging_product?: string
}

export type UnblockUsersRequest = {
  block_users?: Array<{
    user?: string
  }>
  messaging_product?: string
}

export type ManageCallsRequest = CallRequestPayload | CallTerminateRequestPayload

export type ManageCallsResponse = CallResponsePayload | CallTerminateResponsePayload

export type UploadMediaRequest = {
  file?: string
  messaging_product?: string
}

export type UploadMediaResponse = {
  id?: string
}

export type CreateOrUpdateQrCodeRequest = CreateQrCodeRequest | UpdateQrCodeRequest

export type UpdatePhoneNumberResponse = MessageResponse | SuccessResponse

export type UpdatePhoneNumberSettingsRequest =
  | CallingSettingsRequest
  | UserIdentityChangeSettingsRequest
  | PayloadEncryptionSettingsRequest
  | StorageConfigurationSettingsRequest

export type UpdatePhoneNumberSettingsResponse = {
  success?: boolean
}

export type GetEncryptionPublicKeyResponse = {
  data?: Array<WhatsAppBusinessEncryptionInfo>
}

export type GetCommerceSettingsResponse = {
  data?: Array<{
    id?: string
    is_cart_enabled?: boolean
    is_catalog_visible?: boolean
  }>
}

export type SetCommerceSettingsResponse = {
  success?: boolean
}

export type GetBusinessComplianceInfoResponse = {
  data?: Array<BusinessComplianceInfo>
}

export type UpdateBusinessComplianceInfoResponse = {
  /** Indicates whether the compliance information was successfully updated */
  success: boolean
}

export type GetMediaResponse = {
  file_size?: string
  id?: string
  messaging_product?: string
  mime_type?: string
  sha256?: string
  url?: string
}

export type DeleteMediaResponse = {
  success?: boolean
}

export type AddAssignedUserRequest = {
  /** User ID of the person to add to the WhatsApp Business Account. This must be a valid Facebook user ID. */
  user: string
  /** Array of permission tasks to grant to the user. These tasks determine what actions the user can perform on the WhatsApp Business Account. */
  tasks: Array<WhatsAppBusinessAccountPermissionTask>
}

export type RemoveAssignedUserRequest = {
  /** User ID of the person to remove from the WhatsApp Business Account. This must be a valid Facebook user ID that is currently assigned to the account. */
  user: string
}

export type GetCreditLinesResponse = {
  data?: Array<{
    id?: string
    legal_entity_name?: string
  }>
}

export type GetTemplateResponse = {
  category?: string
  components?: Array<{
    buttons?: Array<{
      text?: string
      type?: string
    }>
    example?: {
      body_text?: Array<Array<string>>
    }
    format?: string
    text?: string
    type?: string
  }>
  id?: string
  language?: string
  name?: string
  status?: string
}

export type EditTemplateRequest = {
  category?: string
  components?: Array<{
    buttons?: Array<{
      text?: string
      type?: string
    }>
    example?: {
      body_text?: Array<Array<string>>
    }
    format?: string
    text?: string
    type?: string
  }>
  language?: string
  name?: string
}

export type EditTemplateResponse = {
  success?: boolean
}

export type ListTemplatesResponse = {
  data?: Array<{
    category?: string
    components?: Array<{
      buttons?: Array<{
        text?: string
        type?: string
      }>
      example?: {
        body_text?: Array<Array<string>>
      }
      format?: string
      text?: string
      type?: string
    }>
    id?: string
    language?: string
    name?: string
    status?: string
  }>
  paging?: {
    cursors?: {
      after?: string
      before?: string
    }
  }
}

export type CreateTemplateRequest = {
  category?: string
  components?: Array<{
    buttons?: Array<{
      flow_action?: string
      flow_id?: string
      navigate_screen?: string
      text?: string
      type?: string
    }>
    text?: string
    type?: string
  }>
  language?: string
  name?: string
}

export type CreateTemplateResponse = {
  category?: string
  id?: string
  status?: string
}

export type DeleteTemplateResponse = {
  success?: boolean
}

export type UpdateBusinessAccountRequest = {
  /** Updated name for the WhatsApp Business Account */
  name?: string
  /** Updated timezone identifier for the WhatsApp Business Account */
  timezone_id?: string
}

export type UpdateBusinessAccountResponse = {
  success?: boolean
}
