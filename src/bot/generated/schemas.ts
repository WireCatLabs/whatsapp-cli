// GENERATED. DO NOT EDIT.
// Source: spec/bot/business-messaging-api_v23.0.yaml
// Run: pnpm bot:generate

import { int64, integer, number } from "@wirecat/cli-base/codegen/runtime"
import * as v from "valibot"
import type * as T from "./types.js"

export const ConnectedClientBusiness: v.GenericSchema<unknown, T.ConnectedClientBusiness> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  verification_status: v.optional(v.lazy(() => BusinessVerificationStatus)),
  business_status: v.optional(v.lazy(() => BusinessStatus)),
  created_time: v.optional(v.string()),
  updated_time: v.optional(v.string()),
})

export const BusinessVerificationStatus: v.GenericSchema<unknown, T.BusinessVerificationStatus> = v.picklist([
  "VERIFIED",
  "UNVERIFIED",
  "PENDING",
  "REJECTED",
])

export const BusinessStatus: v.GenericSchema<unknown, T.BusinessStatus> = v.picklist([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_APPROVAL",
])

export const ConnectedClientBusinessesResponse: v.GenericSchema<unknown, T.ConnectedClientBusinessesResponse> =
  v.looseObject({
    data: v.optional(v.array(v.lazy(() => ConnectedClientBusiness))),
    paging: v.optional(v.lazy(() => CursorPaging)),
  })

export const CursorPaging: v.GenericSchema<unknown, T.CursorPaging> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const GraphAPIError: v.GenericSchema<unknown, T.GraphAPIError> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessSolutionCreateRequest: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionCreateRequest> =
  v.looseObject({
    owner_permissions: v.pipe(v.array(v.lazy(() => WhatsAppBusinessAccountConfigurablePermissionTask)), v.maxLength(1)),
    partner_app_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
    partner_permissions: v.pipe(
      v.array(v.lazy(() => WhatsAppBusinessAccountConfigurablePermissionTask)),
      v.maxLength(1),
    ),
    solution_name: v.pipe(v.string(), v.minLength(2), v.maxLength(75)),
  })

export const WhatsAppBusinessSolutionCreateResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionCreateResponse
> = v.looseObject({
  solution_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
})

export const WhatsAppBusinessAccountConfigurablePermissionTask: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountConfigurablePermissionTask
> = v.picklist(["MESSAGING"])

export const GraphAPIError1: v.GenericSchema<unknown, T.GraphAPIError1> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessSolution: v.GenericSchema<unknown, T.WhatsAppBusinessSolution> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(75)),
  status: v.lazy(() => WhatsAppBusinessSolutionStatus),
  status_for_pending_request: v.lazy(() => WhatsAppBusinessSolutionPendingStatus),
  owner_app: v.optional(v.lazy(() => ApplicationNode)),
  owner_permissions: v.optional(v.array(v.lazy(() => WhatsAppBusinessAccountPermissionTask))),
})

export const WhatsAppBusinessSolutionStatus: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionStatus> = v.picklist([
  "DRAFT",
  "INITIATED",
  "ACTIVE",
  "REJECTED",
  "DEACTIVATED",
])

export const WhatsAppBusinessSolutionPendingStatus: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionPendingStatus> =
  v.picklist(["PENDING_ACTIVATION", "PENDING_DEACTIVATION", "NONE"])

export const WhatsAppBusinessAccountPermissionTask: v.GenericSchema<unknown, T.WhatsAppBusinessAccountPermissionTask> =
  v.picklist([
    "MANAGE",
    "DEVELOP",
    "MANAGE_TEMPLATES",
    "MANAGE_PHONE",
    "VIEW_COST",
    "MANAGE_EXTENSIONS",
    "VIEW_PHONE_ASSETS",
    "MANAGE_PHONE_ASSETS",
    "VIEW_TEMPLATES",
    "VIEW_INSIGHTS",
    "RECEIVE_INCOMING_MESSAGES",
    "MANAGE_BILLING",
    "MANAGE_USERS",
    "MESSAGING",
    "FULL_CONTROL",
  ])

export const WhatsAppBusinessSolutionApplicationRole: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionApplicationRole
> = v.picklist(["OWNER", "PARTNER"])

export const ApplicationNode: v.GenericSchema<unknown, T.ApplicationNode> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const WhatsAppBusinessSolutionsResponse: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionsResponse> =
  v.looseObject({
    data: v.optional(v.array(v.lazy(() => WhatsAppBusinessSolution))),
    paging: v.optional(v.lazy(() => CursorPaging)),
  })

export const CursorPaging1: v.GenericSchema<unknown, T.CursorPaging1> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const AddPhoneNumbersRequest: v.GenericSchema<unknown, T.AddPhoneNumbersRequest> = v.looseObject({
  phone_number: v.string(),
})

export const AddPhoneNumbersResponse: v.GenericSchema<unknown, T.AddPhoneNumbersResponse> = v.looseObject({
  id: v.string(),
})

export const PreVerifiedPhoneNumber: v.GenericSchema<unknown, T.PreVerifiedPhoneNumber> = v.looseObject({
  id: v.string(),
  display_phone_number: v.string(),
  country_prefix: v.optional(integer({ minimum: 1, maximum: 999 })),
  verification_status: v.lazy(() => PhoneNumberVerificationStatus),
  availability_status: v.optional(v.lazy(() => PhoneNumberAvailabilityStatus)),
  created_time: v.optional(v.string()),
  last_updated: v.optional(v.string()),
  supported_features: v.optional(v.array(v.lazy(() => WhatsAppBusinessFeature))),
  country_code: v.optional(v.pipe(v.string(), v.regex(/^[A-Z]{2}$/))),
  region: v.optional(v.string()),
})

export const PhoneNumberVerificationStatus: v.GenericSchema<unknown, T.PhoneNumberVerificationStatus> = v.picklist([
  "VERIFIED",
  "PENDING",
  "FAILED",
  "EXPIRED",
])

export const PhoneNumberAvailabilityStatus: v.GenericSchema<unknown, T.PhoneNumberAvailabilityStatus> = v.picklist([
  "AVAILABLE",
  "IN_USE",
  "RESERVED",
  "UNAVAILABLE",
])

export const WhatsAppBusinessFeature: v.GenericSchema<unknown, T.WhatsAppBusinessFeature> = v.picklist([
  "MESSAGING",
  "BUSINESS_PROFILE",
  "WEBHOOKS",
  "TEMPLATES",
  "ANALYTICS",
  "COMMERCE",
  "FLOWS",
])

export const PreVerifiedPhoneNumbersResponse: v.GenericSchema<unknown, T.PreVerifiedPhoneNumbersResponse> =
  v.looseObject({
    data: v.array(v.lazy(() => PreVerifiedPhoneNumber)),
    paging: v.optional(v.lazy(() => CursorPaging)),
  })

export const CursorPaging2: v.GenericSchema<unknown, T.CursorPaging2> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  next: v.optional(v.string()),
  previous: v.optional(v.string()),
})

export const WhatsAppBusinessAccount: v.GenericSchema<unknown, T.WhatsAppBusinessAccount> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  account_review_status: v.optional(v.lazy(() => AccountReviewStatus)),
  purchase_order_number: v.optional(v.string()),
  audiences: v.optional(v.array(v.string())),
  ownership_type: v.optional(v.lazy(() => OwnershipType)),
  subscribed_apps: v.optional(v.array(v.lazy(() => SubscribedApp))),
  business_verification_status: v.optional(v.lazy(() => BusinessVerificationStatus)),
  country: v.optional(v.pipe(v.string(), v.regex(/^[A-Z]{2}$/))),
  currency: v.optional(v.pipe(v.string(), v.regex(/^[A-Z]{3}$/))),
  timezone_id: v.optional(v.string()),
  on_behalf_of_business_info: v.optional(v.lazy(() => OnBehalfOfBusinessInfo)),
  schedules: v.optional(v.array(v.lazy(() => BusinessSchedule))),
  is_enabled_for_insights: v.optional(v.boolean()),
  dcc_config: v.optional(v.lazy(() => DCCConfig)),
  message_templates: v.optional(v.array(v.lazy(() => MessageTemplate))),
  phone_numbers: v.optional(v.array(v.lazy(() => PhoneNumber))),
})

export const AccountReviewStatus: v.GenericSchema<unknown, T.AccountReviewStatus> = v.picklist([
  "APPROVED",
  "PENDING",
  "REJECTED",
  "RESTRICTED",
])

export const OwnershipType: v.GenericSchema<unknown, T.OwnershipType> = v.picklist([
  "SELF_OWNED",
  "CLIENT_OWNED",
  "AGENCY_OWNED",
])

export const BusinessVerificationStatus1: v.GenericSchema<unknown, T.BusinessVerificationStatus1> = v.picklist([
  "VERIFIED",
  "UNVERIFIED",
  "PENDING",
  "REJECTED",
])

export const SubscribedApp: v.GenericSchema<unknown, T.SubscribedApp> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const OnBehalfOfBusinessInfo: v.GenericSchema<unknown, T.OnBehalfOfBusinessInfo> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const BusinessSchedule: v.GenericSchema<unknown, T.BusinessSchedule> = v.looseObject({
  day_of_week: v.optional(v.picklist(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])),
  open_time: v.optional(v.pipe(v.string(), v.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))),
  close_time: v.optional(v.pipe(v.string(), v.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))),
})

export const DCCConfig: v.GenericSchema<unknown, T.DCCConfig> = v.looseObject({
  enabled: v.optional(v.boolean()),
  policy_url: v.optional(v.string()),
})

export const MessageTemplate: v.GenericSchema<unknown, T.MessageTemplate> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  status: v.optional(v.picklist(["APPROVED", "PENDING", "REJECTED", "DISABLED"])),
})

export const PhoneNumber: v.GenericSchema<unknown, T.PhoneNumber> = v.looseObject({
  id: v.optional(v.string()),
  display_phone_number: v.optional(v.string()),
  verified_name: v.optional(v.string()),
})

export const ClientWhatsAppBusinessAccountsResponse: v.GenericSchema<
  unknown,
  T.ClientWhatsAppBusinessAccountsResponse
> = v.looseObject({
  data: v.optional(v.array(v.lazy(() => WhatsAppBusinessAccount))),
  paging: v.optional(v.lazy(() => CursorPaging)),
})

export const CursorPaging3: v.GenericSchema<unknown, T.CursorPaging3> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const MMLiteOnboardingRequest: v.GenericSchema<unknown, T.MMLiteOnboardingRequest> = v.looseObject({
  request_id: v.string(),
})

export const WhatsAppBusinessAccount1: v.GenericSchema<unknown, T.WhatsAppBusinessAccount1> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  message_template_namespace: v.string(),
  timezone_id: v.string(),
})

export const WhatsAppBusinessType: v.GenericSchema<unknown, T.WhatsAppBusinessType> = v.picklist(["ENTERPRISE", "SMB"])

export const WhatsAppBusinessAccountOnboardingFilter: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountOnboardingFilter
> = v.picklist(["ONBOARDED", "NOT_ONBOARDED", "ALL"])

export const WhatsAppBusinessAccountsConnection: v.GenericSchema<unknown, T.WhatsAppBusinessAccountsConnection> =
  v.looseObject({
    data: v.array(v.lazy(() => WhatsAppBusinessAccount)),
    paging: v.optional(v.lazy(() => CursorPaging)),
  })

export const CursorPaging4: v.GenericSchema<unknown, T.CursorPaging4> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  next: v.optional(v.string()),
  previous: v.optional(v.string()),
})

export const PreVerifiedPhoneNumberShareRequest: v.GenericSchema<unknown, T.PreVerifiedPhoneNumberShareRequest> =
  v.looseObject({
    preverified_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
    partner_business_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
  })

export const PreVerifiedPhoneNumberPermission: v.GenericSchema<unknown, T.PreVerifiedPhoneNumberPermission> =
  v.picklist(["MESSAGING", "VIEW_DETAILS", "MANAGE_SETTINGS", "VIEW_ANALYTICS", "MANAGE_WEBHOOKS"])

export const PreVerifiedPhoneNumberShareResponse: v.GenericSchema<unknown, T.PreVerifiedPhoneNumberShareResponse> =
  v.looseObject({
    success: v.boolean(),
  })

export const SharingStatus: v.GenericSchema<unknown, T.SharingStatus> = v.picklist([
  "ACTIVE",
  "PENDING",
  "EXPIRED",
  "REVOKED",
])

export const SharedPreVerifiedPhoneNumber: v.GenericSchema<unknown, T.SharedPreVerifiedPhoneNumber> = v.looseObject({
  id: v.optional(v.string()),
  display_phone_number: v.optional(v.string()),
  country_prefix: v.optional(integer({ minimum: 1, maximum: 999 })),
  verification_status: v.optional(v.picklist(["VERIFIED", "PENDING", "FAILED"])),
})

export const BusinessSummary: v.GenericSchema<unknown, T.BusinessSummary> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  verification_status: v.optional(v.picklist(["VERIFIED", "UNVERIFIED", "PENDING"])),
})

export const BlockedUser: v.GenericSchema<unknown, T.BlockedUser> = v.looseObject({
  messaging_product: v.optional(v.string()),
  wa_id: v.optional(v.string()),
})

export const PaginationCursors: v.GenericSchema<unknown, T.PaginationCursors> = v.looseObject({
  after: v.optional(v.string()),
  before: v.optional(v.string()),
})

export const Paging: v.GenericSchema<unknown, T.Paging> = v.looseObject({
  cursors: v.optional(v.lazy(() => PaginationCursors)),
})

export const GetBlockedUsersData: v.GenericSchema<unknown, T.GetBlockedUsersData> = v.looseObject({
  data: v.optional(v.array(v.lazy(() => BlockedUser))),
  paging: v.optional(v.lazy(() => Paging)),
})

export const BlockedUserOperation: v.GenericSchema<unknown, T.BlockedUserOperation> = v.looseObject({
  input: v.optional(v.string()),
  wa_id: v.optional(v.string()),
})

export const BlockUsersResult: v.GenericSchema<unknown, T.BlockUsersResult> = v.looseObject({
  added_users: v.optional(v.array(v.lazy(() => BlockedUserOperation))),
})

export const UnblockUsersResult: v.GenericSchema<unknown, T.UnblockUsersResult> = v.looseObject({
  removed_users: v.optional(v.array(v.lazy(() => BlockedUserOperation))),
})

export const BlockUsersData: v.GenericSchema<unknown, T.BlockUsersData> = v.looseObject({
  block_users: v.optional(v.lazy(() => BlockUsersResult)),
  messaging_product: v.optional(v.string()),
})

export const UnblockUsersData: v.GenericSchema<unknown, T.UnblockUsersData> = v.looseObject({
  block_users: v.optional(v.lazy(() => UnblockUsersResult)),
  messaging_product: v.optional(v.string()),
})

export const CallPermissionCheckResponsePayload: v.GenericSchema<unknown, T.CallPermissionCheckResponsePayload> =
  v.looseObject({
    messaging_product: v.string(),
    permission: v.looseObject({
      status: v.picklist(["granted", "pending", "denied", "expired"]),
      expiration_time: v.optional(int64()),
    }),
    actions: v.optional(
      v.array(
        v.looseObject({
          action_name: v.picklist(["start_call", "send_call_permission_request"]),
          can_perform_action: v.boolean(),
          limits: v.optional(
            v.array(
              v.looseObject({
                time_period: v.string(),
                current_usage: integer(),
                max_allowed: integer(),
                limit_expiration_time: v.optional(int64()),
              }),
            ),
          ),
        }),
      ),
    ),
  })

export const CallRequestPayload: v.GenericSchema<unknown, T.CallRequestPayload> = v.looseObject({
  messaging_product: v.string(),
  to: v.string(),
  action: v.picklist(["connect", "pre_accept", "accept", "reject", "terminate"]),
  session: v.optional(
    v.looseObject({
      sdp_type: v.picklist(["offer", "answer"]),
      sdp: v.string(),
    }),
  ),
  biz_opaque_callback_data: v.optional(v.pipe(v.string(), v.maxLength(512))),
})

export const CallTerminateRequestPayload: v.GenericSchema<unknown, T.CallTerminateRequestPayload> = v.looseObject({
  messaging_product: v.string(),
  call_id: v.string(),
  action: v.picklist(["terminate"]),
})

export const CallResponsePayload: v.GenericSchema<unknown, T.CallResponsePayload> = v.looseObject({
  messaging_product: v.optional(v.string()),
  calls: v.optional(
    v.array(
      v.looseObject({
        id: v.optional(v.string()),
      }),
    ),
  ),
})

export const CallTerminateResponsePayload: v.GenericSchema<unknown, T.CallTerminateResponsePayload> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const ErrorObject: v.GenericSchema<unknown, T.ErrorObject> = v.looseObject({
  message: v.string(),
  type: v.string(),
  code: integer(),
})

export const ErrorResponse: v.GenericSchema<unknown, T.ErrorResponse> = v.looseObject({
  error: v.lazy(() => ErrorObject),
})

export const ErrorObject1: v.GenericSchema<unknown, T.ErrorObject1> = v.lazy(() => ErrorObject)

export const ErrorResponse1: v.GenericSchema<unknown, T.ErrorResponse1> = v.lazy(() => ErrorResponse)

export const PagingInfo: v.GenericSchema<unknown, T.PagingInfo> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const TemplateObject: v.GenericSchema<unknown, T.TemplateObject> = v.looseObject({
  name: v.string(),
  language: v.lazy(() => LanguageObject),
  components: v.optional(v.array(v.lazy(() => TemplateComponent))),
})

export const LanguageObject: v.GenericSchema<unknown, T.LanguageObject> = v.looseObject({
  policy: v.picklist(["deterministic"]),
  code: v.string(),
})

export const TemplateComponent: v.GenericSchema<unknown, T.TemplateComponent> = v.union([
  v.lazy(() => HeaderComponent),
  v.lazy(() => BodyComponent),
  v.lazy(() => ButtonComponent),
])

export const HeaderComponent: v.GenericSchema<unknown, T.HeaderComponent> = v.looseObject({
  type: v.literal("header"),
  sub_type: v.optional(v.picklist(["quick_reply", "url", "catalog"])),
  parameters: v.optional(v.pipe(v.array(v.lazy(() => ParameterObject)), v.minLength(1))),
  index: v.optional(v.pipe(v.string(), v.regex(/^[2-6, 11-14]$/))),
})

export const BodyComponent: v.GenericSchema<unknown, T.BodyComponent> = v.looseObject({
  type: v.literal("body"),
  sub_type: v.optional(v.picklist(["quick_reply", "url", "catalog"])),
  parameters: v.optional(v.array(v.lazy(() => ParameterObject))),
  index: v.optional(v.pipe(v.string(), v.regex(/^[2-6, 11-14]$/))),
})

export const ButtonComponent: v.GenericSchema<unknown, T.ButtonComponent> = v.looseObject({
  type: v.literal("button"),
  sub_type: v.picklist(["quick_reply", "url", "catalog"]),
  parameters: v.pipe(v.array(v.lazy(() => ButtonParameterObject)), v.minLength(1)),
  index: v.pipe(v.string(), v.regex(/^[2-6, 11-14]$/)),
})

export const ParameterObject: v.GenericSchema<unknown, T.ParameterObject> = v.union([
  v.lazy(() => CurrencyParameter),
  v.lazy(() => DateTimeParameter),
  v.lazy(() => DocumentParameter),
  v.lazy(() => ImageParameter),
  v.lazy(() => TextParameter),
  v.lazy(() => VideoParameter),
])

export const TextParameter: v.GenericSchema<unknown, T.TextParameter> = v.looseObject({
  type: v.literal("text"),
  text: v.pipe(v.string(), v.maxLength(32768)),
})

export const CurrencyParameter: v.GenericSchema<unknown, T.CurrencyParameter> = v.looseObject({
  type: v.literal("currency"),
  currency: v.lazy(() => CurrencyObject),
})

export const DateTimeParameter: v.GenericSchema<unknown, T.DateTimeParameter> = v.looseObject({
  type: v.literal("date_time"),
  date_time: v.lazy(() => DateTimeObject),
})

export const DocumentParameter: v.GenericSchema<unknown, T.DocumentParameter> = v.looseObject({
  type: v.literal("document"),
  document: v.lazy(() => MediaObject),
})

export const ImageParameter: v.GenericSchema<unknown, T.ImageParameter> = v.looseObject({
  type: v.literal("image"),
  image: v.lazy(() => MediaObject),
})

export const VideoParameter: v.GenericSchema<unknown, T.VideoParameter> = v.looseObject({
  type: v.literal("video"),
  video: v.lazy(() => MediaObject),
})

export const CurrencyObject: v.GenericSchema<unknown, T.CurrencyObject> = v.looseObject({
  fallback_value: v.string(),
  code: v.string(),
  amount_1000: integer(),
})

export const DateTimeObject: v.GenericSchema<unknown, T.DateTimeObject> = v.looseObject({
  fallback_value: v.string(),
})

export const MediaObject: v.GenericSchema<unknown, T.MediaObject> = v.union([
  v.looseObject({
    id: v.string(),
  }),
  v.looseObject({
    link: v.string(),
  }),
])

export const ButtonParameterObject: v.GenericSchema<unknown, T.ButtonParameterObject> = v.union([
  v.lazy(() => ButtonPayloadParameter),
  v.lazy(() => ButtonTextParameter),
])

export const ButtonPayloadParameter: v.GenericSchema<unknown, T.ButtonPayloadParameter> = v.looseObject({
  type: v.literal("payload"),
  payload: v.string(),
})

export const ButtonTextParameter: v.GenericSchema<unknown, T.ButtonTextParameter> = v.looseObject({
  type: v.literal("text"),
  text: v.string(),
})

export const MarketingMessageRequestPayload: v.GenericSchema<unknown, T.MarketingMessageRequestPayload> = v.looseObject(
  {
    messaging_product: v.picklist(["whatsapp"]),
    recipient_type: v.picklist(["individual"]),
    to: v.string(),
    type: v.picklist(["template"]),
    template: v.lazy(() => TemplateObject),
    product_policy: v.optional(v.picklist(["CLOUD_API_FALLBACK", "STRICT"])),
    message_activity_sharing: v.optional(v.boolean()),
  },
)

export const MessageStatus: v.GenericSchema<unknown, T.MessageStatus> = v.picklist([
  "accepted",
  "held_for_quality_assessment",
  "paused",
])

export const MarketingMessageResponsePayload: v.GenericSchema<unknown, T.MarketingMessageResponsePayload> =
  v.looseObject({
    contacts: v.optional(
      v.array(
        v.looseObject({
          input: v.optional(v.string()),
          wa_id: v.optional(v.string()),
        }),
      ),
    ),
    messages: v.optional(
      v.array(
        v.looseObject({
          id: v.optional(v.string()),
          message_status: v.optional(v.lazy(() => MessageStatus)),
        }),
      ),
    ),
    messaging_product: v.optional(v.string()),
  })

export const BaseMessageProperties: v.GenericSchema<unknown, T.BaseMessageProperties> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.string(),
  context: v.optional(v.lazy(() => MessageContext)),
})

export const MessageContext: v.GenericSchema<unknown, T.MessageContext> = v.looseObject({
  message_id: v.optional(v.string()),
})

export const MediaObject1: v.GenericSchema<unknown, T.MediaObject1> = v.union([
  v.looseObject({
    id: v.string(),
    caption: v.optional(v.pipe(v.string(), v.maxLength(1024))),
  }),
  v.looseObject({
    link: v.string(),
    caption: v.optional(v.pipe(v.string(), v.maxLength(1024))),
  }),
])

export const Message: v.GenericSchema<unknown, T.Message> = v.union([
  v.lazy(() => TextMessage),
  v.lazy(() => AudioMessage),
  v.lazy(() => DocumentMessage),
  v.lazy(() => ImageMessage),
  v.lazy(() => LocationMessage),
  v.lazy(() => VideoMessage),
  v.lazy(() => StickerMessage),
  v.lazy(() => ReactionMessage),
  v.lazy(() => InteractiveMessage),
  v.lazy(() => TemplateMessage),
  v.lazy(() => ContactsMessage),
])

export const TextMessage: v.GenericSchema<unknown, T.TextMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("text"),
  context: v.optional(v.lazy(() => MessageContext)),
  text: v.looseObject({
    body: v.optional(v.string()),
    preview_url: v.optional(v.boolean()),
  }),
})

export const AudioMessage: v.GenericSchema<unknown, T.AudioMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("audio"),
  context: v.optional(v.lazy(() => MessageContext)),
  audio: v.lazy(() => MediaObject),
})

export const VideoMessage: v.GenericSchema<unknown, T.VideoMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("video"),
  context: v.optional(v.lazy(() => MessageContext)),
  video: v.lazy(() => MediaObject),
})

export const DocumentMessage: v.GenericSchema<unknown, T.DocumentMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("document"),
  context: v.optional(v.lazy(() => MessageContext)),
  document: v.lazy(() => MediaObject),
})

export const ImageMessage: v.GenericSchema<unknown, T.ImageMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("image"),
  context: v.optional(v.lazy(() => MessageContext)),
  image: v.lazy(() => MediaObject),
})

export const LocationMessage: v.GenericSchema<unknown, T.LocationMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("location"),
  context: v.optional(v.lazy(() => MessageContext)),
  location: v.looseObject({
    address: v.optional(v.string()),
    latitude: v.optional(v.string()),
    longitude: v.optional(v.string()),
    name: v.optional(v.string()),
  }),
})

export const StickerMessage: v.GenericSchema<unknown, T.StickerMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("sticker"),
  context: v.optional(v.lazy(() => MessageContext)),
  sticker: v.union([
    v.looseObject({
      id: v.string(),
    }),
    v.looseObject({
      link: v.string(),
    }),
  ]),
})

export const ReactionMessage: v.GenericSchema<unknown, T.ReactionMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("reaction"),
  context: v.optional(v.lazy(() => MessageContext)),
  reaction: v.looseObject({
    emoji: v.optional(v.string()),
    message_id: v.optional(v.string()),
  }),
})

export const InteractiveMessage: v.GenericSchema<unknown, T.InteractiveMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("interactive"),
  context: v.optional(v.lazy(() => MessageContext)),
  interactive: v.lazy(() => InteractiveObject),
})

export const InteractiveObject: v.GenericSchema<unknown, T.InteractiveObject> = v.looseObject({
  type: v.picklist(["button", "call_permission_request", "catalog_message", "list", "product", "product_list", "flow"]),
  header: v.optional(v.lazy(() => HeaderObject)),
  body: v.optional(v.lazy(() => BodyObject)),
  footer: v.optional(v.lazy(() => FooterObject)),
  action: v.lazy(() => ActionObject),
})

export const HeaderObject: v.GenericSchema<unknown, T.HeaderObject> = v.looseObject({
  type: v.picklist(["text", "video", "image", "document"]),
  text: v.optional(v.pipe(v.string(), v.maxLength(60))),
  sub_text: v.optional(v.pipe(v.string(), v.maxLength(60))),
  document: v.optional(v.lazy(() => MediaObject)),
  image: v.optional(v.lazy(() => MediaObject)),
  video: v.optional(v.lazy(() => MediaObject)),
})

export const BodyObject: v.GenericSchema<unknown, T.BodyObject> = v.looseObject({
  text: v.pipe(v.string(), v.maxLength(1024)),
})

export const FooterObject: v.GenericSchema<unknown, T.FooterObject> = v.looseObject({
  text: v.pipe(v.string(), v.maxLength(60)),
})

export const ActionObject: v.GenericSchema<unknown, T.ActionObject> = v.union([
  v.looseObject({
    button: v.pipe(v.string(), v.maxLength(20)),
    sections: v.pipe(v.array(v.lazy(() => SectionObject)), v.minLength(1), v.maxLength(10)),
  }),
  v.looseObject({
    buttons: v.pipe(
      v.array(
        v.looseObject({
          type: v.picklist(["reply"]),
          reply: v.looseObject({
            id: v.pipe(v.string(), v.maxLength(256)),
            title: v.pipe(v.string(), v.maxLength(20)),
          }),
        }),
      ),
      v.minLength(1),
      v.maxLength(3),
    ),
  }),
  v.looseObject({
    catalog_id: v.string(),
    product_retailer_id: v.optional(v.string()),
    sections: v.optional(v.pipe(v.array(v.lazy(() => SectionObject)), v.minLength(1), v.maxLength(10))),
  }),
  v.looseObject({
    name: v.picklist(["catalog_message"]),
    parameters: v.looseObject({
      thumbnail_product_retailer_id: v.string(),
    }),
  }),
  v.looseObject({
    name: v.picklist(["flow"]),
    parameters: v.union([v.looseObject({}), v.looseObject({})]),
  }),
  v.looseObject({
    name: v.picklist(["call_permission_request"]),
  }),
])

export const SectionObject: v.GenericSchema<unknown, T.SectionObject> = v.looseObject({
  title: v.optional(v.pipe(v.string(), v.maxLength(24))),
  product_items: v.optional(
    v.pipe(
      v.array(
        v.looseObject({
          product_retailer_id: v.string(),
        }),
      ),
      v.minLength(1),
      v.maxLength(30),
    ),
  ),
  rows: v.optional(
    v.pipe(
      v.array(
        v.looseObject({
          id: v.pipe(v.string(), v.maxLength(200)),
          title: v.pipe(v.string(), v.maxLength(24)),
          description: v.optional(v.pipe(v.string(), v.maxLength(72))),
        }),
      ),
      v.maxLength(10),
    ),
  ),
})

export const TemplateMessage: v.GenericSchema<unknown, T.TemplateMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("template"),
  context: v.optional(v.lazy(() => MessageContext)),
  template: v.lazy(() => TemplateObject),
})

export const ContactsMessage: v.GenericSchema<unknown, T.ContactsMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("contacts"),
  context: v.optional(v.lazy(() => MessageContext)),
  contacts: v.pipe(v.array(v.lazy(() => ContactObject)), v.minLength(1), v.maxLength(5)),
})

export const ContactObject: v.GenericSchema<unknown, T.ContactObject> = v.looseObject({
  addresses: v.optional(v.array(v.lazy(() => AddressObject))),
  birthday: v.optional(v.string()),
  emails: v.optional(v.array(v.lazy(() => EmailObject))),
  name: v.optional(v.lazy(() => NameObject)),
  org: v.optional(v.lazy(() => OrganizationObject)),
  phones: v.optional(v.array(v.lazy(() => PhoneObject))),
  urls: v.optional(v.array(v.lazy(() => UrlObject))),
})

export const AddressObject: v.GenericSchema<unknown, T.AddressObject> = v.looseObject({
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  country_code: v.optional(v.string()),
  state: v.optional(v.string()),
  street: v.optional(v.string()),
  type: v.optional(v.picklist(["HOME", "WORK"])),
  zip: v.optional(v.string()),
})

export const EmailObject: v.GenericSchema<unknown, T.EmailObject> = v.looseObject({
  email: v.string(),
  type: v.optional(v.picklist(["HOME", "WORK"])),
})

export const NameObject: v.GenericSchema<unknown, T.NameObject> = v.looseObject({
  first_name: v.optional(v.string()),
  formatted_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  middle_name: v.optional(v.string()),
  prefix: v.optional(v.string()),
  suffix: v.optional(v.string()),
})

export const OrganizationObject: v.GenericSchema<unknown, T.OrganizationObject> = v.looseObject({
  company: v.optional(v.string()),
  department: v.optional(v.string()),
  title: v.optional(v.string()),
})

export const PhoneObject: v.GenericSchema<unknown, T.PhoneObject> = v.looseObject({
  phone: v.string(),
  type: v.optional(v.picklist(["HOME", "WORK"])),
  wa_id: v.optional(v.string()),
})

export const UrlObject: v.GenericSchema<unknown, T.UrlObject> = v.looseObject({
  type: v.optional(v.picklist(["HOME", "WORK"])),
  url: v.string(),
})

export const MessageResponsePayload: v.GenericSchema<unknown, T.MessageResponsePayload> = v.looseObject({
  contacts: v.optional(
    v.array(
      v.looseObject({
        input: v.optional(v.string()),
        wa_id: v.optional(v.string()),
      }),
    ),
  ),
  messages: v.optional(
    v.array(
      v.looseObject({
        id: v.optional(v.string()),
        message_status: v.optional(v.lazy(() => MessageStatus)),
      }),
    ),
  ),
  messaging_product: v.optional(v.string()),
})

export const MarkMessageRequestPayload: v.GenericSchema<unknown, T.MarkMessageRequestPayload> = v.looseObject({
  message_id: v.string(),
  messaging_product: v.string(),
  status: v.string(),
})

export const MarkMessageResponsePayload: v.GenericSchema<unknown, T.MarkMessageResponsePayload> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const QrCodeDetails: v.GenericSchema<unknown, T.QrCodeDetails> = v.looseObject({
  code: v.pipe(v.string(), v.regex(/^[A-Z2-7]{14}$/)),
  prefilled_message: v.string(),
  deep_link_url: v.string(),
  creation_time: v.optional(integer()),
  qr_image_url: v.optional(v.string()),
})

export const QrCodeList: v.GenericSchema<unknown, T.QrCodeList> = v.looseObject({
  data: v.array(v.lazy(() => QrCodeDetails)),
  paging: v.optional(
    v.looseObject({
      cursors: v.optional(
        v.looseObject({
          before: v.optional(v.string()),
          after: v.optional(v.string()),
        }),
      ),
      previous: v.optional(v.string()),
      next: v.optional(v.string()),
    }),
  ),
})

export const CreateQrCodeRequest: v.GenericSchema<unknown, T.CreateQrCodeRequest> = v.looseObject({
  prefilled_message: v.pipe(v.string(), v.maxLength(140)),
  generate_qr_image: v.optional(v.picklist(["PNG", "SVG"])),
})

export const UpdateQrCodeRequest: v.GenericSchema<unknown, T.UpdateQrCodeRequest> = v.looseObject({
  code: v.pipe(v.string(), v.minLength(14), v.maxLength(14), v.regex(/^[A-Z2-7]{14}$/)),
  prefilled_message: v.pipe(v.string(), v.maxLength(140)),
})

export const QrCodeResponse: v.GenericSchema<unknown, T.QrCodeResponse> = v.looseObject({
  code: v.pipe(v.string(), v.regex(/^[A-Z2-7]{14}$/)),
  prefilled_message: v.string(),
  deep_link_url: v.string(),
  qr_image_url: v.optional(v.string()),
})

export const GraphAPIError2: v.GenericSchema<unknown, T.GraphAPIError2> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const QrCodeResponse1: v.GenericSchema<unknown, T.QrCodeResponse1> = v.looseObject({
  data: v.pipe(v.array(v.lazy(() => QrCodeDetails)), v.minLength(1), v.maxLength(1)),
})

export const DeleteQrCodeResponse: v.GenericSchema<unknown, T.DeleteQrCodeResponse> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError3: v.GenericSchema<unknown, T.GraphAPIError3> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const EncryptedMessageRequest: v.GenericSchema<unknown, T.EncryptedMessageRequest> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  encrypted_contents: v.string(),
})

export const EncryptedMessageResponse: v.GenericSchema<unknown, T.EncryptedMessageResponse> = v.looseObject({
  encrypted_contents: v.string(),
})

export const ErrorResponse2: v.GenericSchema<unknown, T.ErrorResponse2> = v.looseObject({
  error: v.optional(
    v.looseObject({
      message: v.optional(v.string()),
      type: v.optional(v.string()),
      code: v.optional(integer()),
      error_subcode: v.optional(integer()),
    }),
  ),
})

export const OfficialBusinessAccountStatus: v.GenericSchema<unknown, T.OfficialBusinessAccountStatus> = v.looseObject({
  id: v.string(),
  oba_status: v.lazy(() => WhatsAppBusinessAppealStatus),
  status_message: v.string(),
})

export const OfficialBusinessAccountUpdateRequest: v.GenericSchema<unknown, T.OfficialBusinessAccountUpdateRequest> =
  v.looseObject({
    business_website_url: v.string(),
    primary_country_of_operation: v.string(),
    primary_language: v.optional(v.string()),
    parent_business_or_brand: v.optional(v.pipe(v.string(), v.maxLength(255))),
    supporting_links: v.optional(v.pipe(v.array(v.string()), v.minLength(5), v.maxLength(10))),
    additional_supporting_information: v.optional(v.pipe(v.string(), v.maxLength(1000))),
  })

export const OfficialBusinessAccountUpdateResponse: v.GenericSchema<unknown, T.OfficialBusinessAccountUpdateResponse> =
  v.looseObject({
    success: v.boolean(),
    message: v.string(),
    updated_status: v.optional(v.lazy(() => OfficialBusinessAccountStatus)),
    tracking_id: v.optional(v.string()),
  })

export const WhatsAppBusinessAppealStatus: v.GenericSchema<unknown, T.WhatsAppBusinessAppealStatus> = v.picklist([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "UNDER_REVIEW",
  "EXPIRED",
  "CANCELLED",
])

export const PhoneNumberInfo: v.GenericSchema<unknown, T.PhoneNumberInfo> = v.looseObject({
  id: v.optional(v.string()),
  display_phone_number: v.optional(v.string()),
  verified_name: v.optional(v.string()),
  quality_rating: v.optional(v.picklist(["GREEN", "YELLOW", "RED", "NA"])),
  code_verification_status: v.optional(v.picklist(["VERIFIED", "UNVERIFIED"])),
  name_status: v.optional(
    v.picklist(["APPROVED", "AVAILABLE_WITHOUT_REVIEW", "DECLINED", "EXPIRED", "PENDING_REVIEW", "NONE"]),
  ),
})

export const MessageRequest: v.GenericSchema<unknown, T.MessageRequest> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  recipient_type: v.optional(v.picklist(["individual", "group"])),
  to: v.string(),
  type: v.picklist([
    "text",
    "image",
    "audio",
    "video",
    "document",
    "location",
    "contacts",
    "template",
    "interactive",
    "reaction",
    "sticker",
  ]),
  text: v.optional(v.lazy(() => TextMessage)),
  context: v.optional(v.lazy(() => MessageContext)),
})

export const TextMessage1: v.GenericSchema<unknown, T.TextMessage1> = v.looseObject({
  body: v.pipe(v.string(), v.maxLength(4096)),
  preview_url: v.optional(v.boolean()),
})

export const MessageContext1: v.GenericSchema<unknown, T.MessageContext1> = v.looseObject({
  message_id: v.optional(v.string()),
})

export const SettingsRequest: v.GenericSchema<unknown, T.SettingsRequest> = v.looseObject({
  calling: v.optional(v.lazy(() => CallingSettings)),
})

export const CallingSettings: v.GenericSchema<unknown, T.CallingSettings> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  call_icon_visibility: v.optional(v.picklist(["visible", "hidden"])),
})

export const RegisterRequest: v.GenericSchema<unknown, T.RegisterRequest> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  pin: v.pipe(v.string(), v.regex(/^[0-9]{6}$/)),
})

export const VerifyCodeRequest: v.GenericSchema<unknown, T.VerifyCodeRequest> = v.looseObject({
  code: v.pipe(v.string(), v.regex(/^[0-9]{6}$/)),
})

export const TwoStepVerificationRequest: v.GenericSchema<unknown, T.TwoStepVerificationRequest> = v.looseObject({
  pin: v.pipe(v.string(), v.regex(/^[0-9]{6}$/)),
})

export const PhoneNumberStatusUpdateRequest: v.GenericSchema<unknown, T.PhoneNumberStatusUpdateRequest> = v.looseObject(
  {
    connection_status: v.optional(v.lazy(() => WhatsAppBusinessAccountToNumberStatus)),
    webhook_url: v.optional(v.string()),
    whatsapp_business_api_data: v.optional(v.lazy(() => WhatsAppBusinessApiData)),
    pin: v.optional(v.string()),
    search_visibility: v.optional(v.lazy(() => WAAPIBusinessGlobalSearchStateStatus)),
    webhook_configuration: v.optional(v.lazy(() => WebhookConfiguration)),
    new_display_name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(75))),
    username: v.optional(v.string()),
  },
)

export const WhatsAppBusinessApiData: v.GenericSchema<unknown, T.WhatsAppBusinessApiData> = v.looseObject({
  pin: v.optional(v.string()),
  show_security_notifications: v.optional(v.boolean()),
  notify_user_change_number: v.optional(v.boolean()),
})

export const WebhookConfiguration: v.GenericSchema<unknown, T.WebhookConfiguration> = v.looseObject({
  override_callback_uri: v.string(),
  verify_token: v.optional(v.string()),
})

export const WhatsAppBusinessAccountToNumberStatus: v.GenericSchema<unknown, T.WhatsAppBusinessAccountToNumberStatus> =
  v.picklist([
    "CONNECTED",
    "DISCONNECTED",
    "PENDING",
    "FLAGGED",
    "RESTRICTED",
    "RATE_LIMITED",
    "MESSAGING_LIMIT_TIER_0",
    "MESSAGING_LIMIT_TIER_1",
    "MESSAGING_LIMIT_TIER_2",
    "MESSAGING_LIMIT_TIER_3",
    "MESSAGING_LIMIT_TIER_4",
  ])

export const WAAPIBusinessGlobalSearchStateStatus: v.GenericSchema<unknown, T.WAAPIBusinessGlobalSearchStateStatus> =
  v.picklist(["VISIBLE", "HIDDEN"])

export const MessageResponse: v.GenericSchema<unknown, T.MessageResponse> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  contacts: v.array(v.lazy(() => ContactResponse)),
  messages: v.array(v.lazy(() => MessageResponseItem)),
})

export const ContactResponse: v.GenericSchema<unknown, T.ContactResponse> = v.looseObject({
  input: v.string(),
  wa_id: v.optional(v.string()),
})

export const MessageResponseItem: v.GenericSchema<unknown, T.MessageResponseItem> = v.looseObject({
  id: v.string(),
})

export const SuccessResponse: v.GenericSchema<unknown, T.SuccessResponse> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError4: v.GenericSchema<unknown, T.GraphAPIError4> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
  }),
})

export const DeregisterResponse: v.GenericSchema<unknown, T.DeregisterResponse> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError5: v.GenericSchema<unknown, T.GraphAPIError5> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppMessageHistory: v.GenericSchema<unknown, T.WhatsAppMessageHistory> = v.looseObject({
  id: v.string(),
  message_id: v.string(),
  events: v.optional(
    v.looseObject({
      data: v.optional(v.array(v.lazy(() => MessageDeliveryStatusEvent))),
      paging: v.optional(v.lazy(() => PaginationInfo)),
    }),
  ),
})

export const MessageDeliveryStatusEvent: v.GenericSchema<unknown, T.MessageDeliveryStatusEvent> = v.looseObject({
  id: v.string(),
  delivery_status: v.lazy(() => WhatsAppMessageDeliveryStatus),
  webhook_update_state: v.optional(v.lazy(() => WebhookUpdateState)),
  timestamp: int64(),
  application: v.optional(
    v.looseObject({
      id: v.optional(v.string()),
    }),
  ),
  webhook_uri: v.optional(v.string()),
  error_description: v.optional(v.string()),
})

export const WhatsAppMessageDeliveryStatus: v.GenericSchema<unknown, T.WhatsAppMessageDeliveryStatus> = v.picklist([
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "DELETED",
])

export const WebhookUpdateState: v.GenericSchema<unknown, T.WebhookUpdateState> = v.picklist([
  "PENDING",
  "DELIVERED",
  "FAILED",
  "RETRYING",
])

export const MessageHistoryResponse: v.GenericSchema<unknown, T.MessageHistoryResponse> = v.looseObject({
  data: v.optional(v.array(v.lazy(() => WhatsAppMessageHistory))),
  paging: v.optional(v.lazy(() => PaginationInfo)),
})

export const PaginationInfo: v.GenericSchema<unknown, T.PaginationInfo> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const WhatsAppBusinessPhoneNumberRegistrationRequest: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessPhoneNumberRegistrationRequest
> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  pin: v.pipe(v.string(), v.minLength(6), v.maxLength(6), v.regex(/^[0-9]{6}$/)),
  backup: v.optional(v.lazy(() => WhatsAppBusinessAccountBackup)),
  data_localization_region: v.optional(v.lazy(() => WhatsAppDataLocalizationRegion)),
  meta_store_retention_minutes: v.optional(integer({ minimum: 60, maximum: 60 })),
})

export const WhatsAppBusinessAccountBackup: v.GenericSchema<unknown, T.WhatsAppBusinessAccountBackup> = v.looseObject({
  password: v.optional(v.string()),
  data: v.optional(v.string()),
})

export const WhatsAppDataLocalizationRegion: v.GenericSchema<unknown, T.WhatsAppDataLocalizationRegion> = v.picklist([
  "AE",
  "AU",
  "BH",
  "BR",
  "CA",
  "CH",
  "DE",
  "GB",
  "ID",
  "IN",
  "JP",
  "KR",
  "SG",
  "ZA",
])

export const WhatsAppBusinessPhoneNumberRegistrationResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessPhoneNumberRegistrationResponse
> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError6: v.GenericSchema<unknown, T.GraphAPIError6> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const RequestCodeRequest: v.GenericSchema<unknown, T.RequestCodeRequest> = v.looseObject({
  code_method: v.picklist(["SMS", "VOICE"]),
  language: v.pipe(v.string(), v.minLength(5), v.maxLength(5), v.regex(/^[a-z]{2}_[A-Z]{2}$/)),
})

export const RequestCodeResponse: v.GenericSchema<unknown, T.RequestCodeResponse> = v.looseObject({
  success: v.boolean(),
})

export const CallingSettingsRequest: v.GenericSchema<unknown, T.CallingSettingsRequest> = v.looseObject({
  calling: v.lazy(() => CallingSettings),
})

export const CallingSettings1: v.GenericSchema<unknown, T.CallingSettings1> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  call_icon_visibility: v.optional(v.picklist(["visible", "hidden"])),
  video: v.optional(v.lazy(() => VideoSettings)),
  sip: v.optional(v.lazy(() => SipSettings)),
  srtp_key_exchange_protocol: v.optional(v.picklist(["DTLS-SRTP", "SDES-SRTP"])),
})

export const VideoSettings: v.GenericSchema<unknown, T.VideoSettings> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
})

export const SipSettings: v.GenericSchema<unknown, T.SipSettings> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
})

export const UserIdentityChangeSettingsRequest: v.GenericSchema<unknown, T.UserIdentityChangeSettingsRequest> =
  v.looseObject({
    user_identity_change: v.lazy(() => UserIdentityChangeSettings),
  })

export const UserIdentityChangeSettings: v.GenericSchema<unknown, T.UserIdentityChangeSettings> = v.looseObject({
  enabled: v.boolean(),
})

export const PayloadEncryptionSettingsRequest: v.GenericSchema<unknown, T.PayloadEncryptionSettingsRequest> =
  v.looseObject({
    payload_encryption: v.lazy(() => PayloadEncryptionSettings),
  })

export const PayloadEncryptionSettings: v.GenericSchema<unknown, T.PayloadEncryptionSettings> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  client_encryption_key: v.optional(v.string()),
})

export const StorageConfigurationSettingsRequest: v.GenericSchema<unknown, T.StorageConfigurationSettingsRequest> =
  v.looseObject({
    storage_configuration: v.lazy(() => StorageConfigurationSettings),
  })

export const StorageConfigurationSettings: v.GenericSchema<unknown, T.StorageConfigurationSettings> = v.looseObject({
  enabled: v.boolean(),
  region: v.optional(v.string()),
})

export const PhoneNumberSettingsResponse: v.GenericSchema<unknown, T.PhoneNumberSettingsResponse> = v.looseObject({
  calling: v.lazy(() => CallingSettingsResponse),
  payload_encryption: v.optional(v.lazy(() => PayloadEncryptionSettingsResponse)),
  storage_configuration: v.lazy(() => StorageConfigurationSettingsResponse),
})

export const CallingSettingsResponse: v.GenericSchema<unknown, T.CallingSettingsResponse> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  call_icon_visibility: v.picklist(["visible", "hidden"]),
  ip_addresses: v.looseObject({
    default: v.array(v.string()),
  }),
  callback_permission_status: v.picklist(["enabled", "disabled"]),
  srtp_key_exchange_protocol: v.optional(v.picklist(["DTLS-SRTP", "SDES-SRTP"])),
  call_hours: v.optional(v.lazy(() => CallHoursSettings)),
  call_icons: v.optional(v.lazy(() => CallIconsSettings)),
  sip: v.optional(v.lazy(() => SipSettingsResponse)),
  video: v.optional(v.lazy(() => VideoSettingsResponse)),
  audio: v.optional(v.lazy(() => AudioSettingsResponse)),
  restrictions: v.optional(v.lazy(() => CallingRestrictionsResponse)),
})

export const CallHoursSettings: v.GenericSchema<unknown, T.CallHoursSettings> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  timezone: v.optional(v.string()),
  day_of_week_start: v.optional(v.string()),
})

export const CallIconsSettings: v.GenericSchema<unknown, T.CallIconsSettings> = v.looseObject({
  restrict_to_user_countries: v.optional(v.array(v.string())),
})

export const SipSettingsResponse: v.GenericSchema<unknown, T.SipSettingsResponse> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
  servers: v.optional(v.array(v.lazy(() => SipServerInfo))),
})

export const SipServerInfo: v.GenericSchema<unknown, T.SipServerInfo> = v.looseObject({
  app_id: v.string(),
  hostname: v.string(),
  port: v.optional(integer()),
  password: v.optional(v.string()),
})

export const VideoSettingsResponse: v.GenericSchema<unknown, T.VideoSettingsResponse> = v.looseObject({
  status: v.picklist(["enabled", "disabled"]),
})

export const AudioSettingsResponse: v.GenericSchema<unknown, T.AudioSettingsResponse> = v.looseObject({
  status: v.optional(v.picklist(["enabled", "disabled"])),
})

export const CallingRestrictionsResponse: v.GenericSchema<unknown, T.CallingRestrictionsResponse> = v.looseObject({
  restrictions: v.optional(
    v.array(
      v.looseObject({
        type: v.optional(v.string()),
        expiration: v.optional(int64()),
      }),
    ),
  ),
})

export const PayloadEncryptionSettingsResponse: v.GenericSchema<unknown, T.PayloadEncryptionSettingsResponse> =
  v.looseObject({
    status: v.picklist(["enabled", "disabled"]),
    client_encryption_key_fingerprint: v.optional(v.string()),
    cloud_encryption_key: v.optional(v.string()),
  })

export const StorageConfigurationSettingsResponse: v.GenericSchema<unknown, T.StorageConfigurationSettingsResponse> =
  v.looseObject({
    status: v.picklist(["default", "in_country_storage_enabled"]),
    data_localization_region: v.optional(v.string()),
  })

export const VerifyCodeRequest1: v.GenericSchema<unknown, T.VerifyCodeRequest1> = v.looseObject({
  code: v.pipe(v.string(), v.regex(/^[0-9]{6}$/)),
})

export const VerifyCodeResponse: v.GenericSchema<unknown, T.VerifyCodeResponse> = v.looseObject({
  success: v.boolean(),
  id: v.optional(v.string()),
})

export const GraphAPIError7: v.GenericSchema<unknown, T.GraphAPIError7> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessEncryptionInfo: v.GenericSchema<unknown, T.WhatsAppBusinessEncryptionInfo> = v.looseObject(
  {
    business_public_key: v.string(),
    business_public_key_signature_status: v.lazy(() => BusinessPublicKeyVerificationStatus),
  },
)

export const BusinessPublicKeyVerificationStatus: v.GenericSchema<unknown, T.BusinessPublicKeyVerificationStatus> =
  v.picklist(["VALID", "MISMATCH"])

export const WhatsAppBusinessEncryptionUploadRequest: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessEncryptionUploadRequest
> = v.looseObject({
  business_public_key: v.string(),
})

export const WhatsAppBusinessEncryptionUploadResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessEncryptionUploadResponse
> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError8: v.GenericSchema<unknown, T.GraphAPIError8> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessProfile: v.GenericSchema<unknown, T.WhatsAppBusinessProfile> = v.looseObject({
  messaging_product: v.picklist(["whatsapp"]),
  about: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(139))),
  address: v.optional(v.pipe(v.string(), v.maxLength(256))),
  description: v.optional(v.pipe(v.string(), v.maxLength(256))),
  email: v.optional(v.pipe(v.string(), v.maxLength(128))),
  profile_picture_url: v.optional(v.string()),
  websites: v.optional(v.pipe(v.array(v.pipe(v.string(), v.maxLength(256))), v.maxLength(2))),
  vertical: v.optional(v.lazy(() => WhatsAppBusinessVertical)),
})

export const WhatsAppBusinessProfileUpdateRequest: v.GenericSchema<unknown, T.WhatsAppBusinessProfileUpdateRequest> =
  v.looseObject({
    messaging_product: v.picklist(["whatsapp"]),
    about: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(139))),
    address: v.optional(v.pipe(v.string(), v.maxLength(256))),
    description: v.optional(v.pipe(v.string(), v.maxLength(256))),
    email: v.optional(v.pipe(v.string(), v.maxLength(128))),
    profile_picture_handle: v.optional(v.string()),
    websites: v.optional(v.pipe(v.array(v.pipe(v.string(), v.maxLength(256))), v.maxLength(2))),
    vertical: v.optional(v.lazy(() => WhatsAppBusinessVertical)),
  })

export const WhatsAppBusinessVertical: v.GenericSchema<unknown, T.WhatsAppBusinessVertical> = v.picklist([
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "ALCOHOL",
  "ONLINE_GAMBLING",
  "PHYSICAL_GAMBLING",
  "OTC_DRUGS",
])

export const WhatsAppBusinessProfileResponse: v.GenericSchema<unknown, T.WhatsAppBusinessProfileResponse> =
  v.looseObject({
    data: v.optional(
      v.array(
        v.looseObject({
          business_profile: v.optional(v.lazy(() => WhatsAppBusinessProfile)),
        }),
      ),
    ),
  })

export const WhatsAppBusinessProfileUpdateResponse: v.GenericSchema<unknown, T.WhatsAppBusinessProfileUpdateResponse> =
  v.looseObject({
    success: v.optional(v.boolean()),
  })

export const BusinessComplianceInfo: v.GenericSchema<unknown, T.BusinessComplianceInfo> = v.looseObject({
  whatsapp_business_account_id: v.string(),
  messaging_product: v.optional(v.picklist(["whatsapp"])),
  entity_name: v.optional(v.string()),
  entity_type: v.optional(v.string()),
  entity_type_custom: v.optional(v.string()),
  is_registered: v.optional(v.boolean()),
  grievance_officer_details: v.optional(v.lazy(() => GrievanceOfficerDetails)),
  customer_care_details: v.optional(v.lazy(() => CustomerCareDetails)),
})

export const GrievanceOfficerDetails: v.GenericSchema<unknown, T.GrievanceOfficerDetails> = v.looseObject({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  mobile_number: v.optional(v.pipe(v.string(), v.regex(/^\\+[1-9]\\d{1,14}$/))),
  landline_number: v.optional(v.pipe(v.string(), v.regex(/^\\+[1-9]\\d{1,14}$/))),
})

export const CustomerCareDetails: v.GenericSchema<unknown, T.CustomerCareDetails> = v.looseObject({
  email: v.optional(v.string()),
  mobile_number: v.optional(v.pipe(v.string(), v.regex(/^\\+[1-9]\\d{1,14}$/))),
  landline_number: v.optional(v.pipe(v.string(), v.regex(/^\\+[1-9]\\d{1,14}$/))),
})

export const BusinessComplianceInfoUpdateRequest: v.GenericSchema<unknown, T.BusinessComplianceInfoUpdateRequest> =
  v.looseObject({
    messaging_product: v.picklist(["whatsapp"]),
    entity_name: v.pipe(v.string(), v.minLength(2), v.maxLength(128)),
    entity_type: v.lazy(() => BusinessEntityType),
    entity_type_custom: v.optional(v.pipe(v.string(), v.maxLength(1024))),
    is_registered: v.optional(v.boolean()),
    grievance_officer_details: v.lazy(() => GrievanceOfficerUpdateDetails),
    customer_care_details: v.lazy(() => CustomerCareUpdateDetails),
  })

export const BusinessEntityType: v.GenericSchema<unknown, T.BusinessEntityType> = v.picklist([
  "LIMITED_LIABILITY_PARTNERSHIP",
  "SOLE_PROPRIETORSHIP",
  "PARTNERSHIP",
  "PUBLIC_COMPANY",
  "PRIVATE_COMPANY",
  "OTHER",
])

export const GrievanceOfficerUpdateDetails: v.GenericSchema<unknown, T.GrievanceOfficerUpdateDetails> = v.looseObject({
  name: v.pipe(v.string(), v.maxLength(128)),
  email: v.pipe(v.string(), v.maxLength(128)),
  mobile_number: v.optional(v.pipe(v.string(), v.maxLength(20), v.regex(/^\\+[1-9]\\d{1,14}$/))),
  landline_number: v.optional(v.pipe(v.string(), v.maxLength(20), v.regex(/^\\+[1-9]\\d{1,14}$/))),
})

export const CustomerCareUpdateDetails: v.GenericSchema<unknown, T.CustomerCareUpdateDetails> = v.looseObject({
  email: v.pipe(v.string(), v.maxLength(128)),
  mobile_number: v.optional(v.pipe(v.string(), v.maxLength(20), v.regex(/^\\+[1-9]\\d{1,14}$/))),
  landline_number: v.optional(v.pipe(v.string(), v.maxLength(20), v.regex(/^\\+[1-9]\\d{1,14}$/))),
})

export const ApiError: v.GenericSchema<unknown, T.ApiError> = v.looseObject({
  code: v.optional(integer()),
  message: v.optional(v.string()),
  title: v.optional(v.string()),
  error_data: v.optional(
    v.looseObject({
      details: v.optional(v.string()),
    }),
  ),
})

export const GroupInfo: v.GenericSchema<unknown, T.GroupInfo> = v.looseObject({
  id: v.optional(v.string()),
  messaging_product: v.optional(v.string()),
  join_approval_mode: v.optional(v.picklist(["approval_required", "auto_approve"])),
  subject: v.optional(v.string()),
  description: v.optional(v.string()),
  suspended: v.optional(v.boolean()),
  creation_timestamp: v.optional(integer()),
  participants: v.optional(
    v.array(
      v.looseObject({
        wa_id: v.optional(v.string()),
      }),
    ),
  ),
  total_participant_count: v.optional(integer()),
})

export const WhatsAppMessageHistoryEventsEdge: v.GenericSchema<unknown, T.WhatsAppMessageHistoryEventsEdge> =
  v.looseObject({
    cursor: v.optional(v.string()),
    node: v.lazy(() => WhatsAppBusinessMessageDeliveryStatusOccurrence),
  })

export const WhatsAppBusinessMessageDeliveryStatusOccurrence: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessMessageDeliveryStatusOccurrence
> = v.looseObject({
  id: v.string(),
  delivery_status: v.lazy(() => WhatsAppMessageDeliveryStatus),
  error_description: v.optional(v.string()),
  occurrence_timestamp: int64(),
  status_timestamp: v.optional(int64()),
  application: v.optional(v.lazy(() => ApplicationNode)),
})

export const WhatsAppMessageDeliveryStatus1: v.GenericSchema<unknown, T.WhatsAppMessageDeliveryStatus1> = v.picklist([
  "ACCEPTED",
  "DELIVERED",
  "ERROR",
  "READ",
  "SENT",
])

export const ApplicationNode1: v.GenericSchema<unknown, T.ApplicationNode1> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const MessageHistoryEventsResponse: v.GenericSchema<unknown, T.MessageHistoryEventsResponse> = v.looseObject({
  data: v.optional(v.array(v.lazy(() => WhatsAppMessageHistoryEventsEdge))),
  paging: v.optional(v.lazy(() => PaginationInfo)),
})

export const PaginationInfo1: v.GenericSchema<unknown, T.PaginationInfo1> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const WhatsAppBusinessAccountMigrationIntent: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountMigrationIntent
> = v.looseObject({
  id: v.string(),
  status: v.lazy(() => WhatsAppBusinessAccountMigrationStatus),
})

export const WhatsAppBusinessAccountMigrationStatus: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountMigrationStatus
> = v.picklist(["ACCEPTED", "COMPLETED", "INITIATED", "REJECTED"])

export const PreVerifiedPhoneNumberValidation: v.GenericSchema<unknown, T.PreVerifiedPhoneNumberValidation> =
  v.looseObject({
    id: v.optional(v.string()),
    country_prefix: v.optional(integer({ minimum: 1, maximum: 999 })),
    display_phone_number: v.optional(v.string()),
    error_msg: v.optional(v.string()),
    is_input_id_valid: v.boolean(),
  })

export const WhatsAppBusinessPreVerifiedPhoneNumberPartnersResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessPreVerifiedPhoneNumberPartnersResponse
> = v.looseObject({
  data: v.array(v.lazy(() => BusinessPartner)),
  paging: v.optional(v.lazy(() => CursorPaging)),
})

export const BusinessPartner: v.GenericSchema<unknown, T.BusinessPartner> = v.looseObject({
  id: v.string(),
  name: v.string(),
  created_time: v.optional(v.string()),
  updated_time: v.optional(v.string()),
  verification_status: v.optional(v.picklist(["not_verified", "pending", "verified"])),
  primary_page: v.optional(v.string()),
  timezone_id: v.optional(integer()),
  two_factor_type: v.optional(v.picklist(["none", "admin_required"])),
})

export const CursorPaging5: v.GenericSchema<unknown, T.CursorPaging5> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  next: v.optional(v.string()),
  previous: v.optional(v.string()),
})

export const RequestCodeRequest1: v.GenericSchema<unknown, T.RequestCodeRequest1> = v.looseObject({
  code_method: v.lazy(() => PhoneVerificationMethodCode),
  language: v.string(),
})

export const PhoneVerificationMethodCode: v.GenericSchema<unknown, T.PhoneVerificationMethodCode> = v.picklist([
  "SMS",
  "VOICE",
])

export const RequestCodeResponse1: v.GenericSchema<unknown, T.RequestCodeResponse1> = v.looseObject({
  success: v.boolean(),
})

export const VerifyCodeRequest2: v.GenericSchema<unknown, T.VerifyCodeRequest2> = v.looseObject({
  code: v.pipe(v.string(), v.minLength(4), v.maxLength(8), v.regex(/^[0-9]+$/)),
})

export const VerifyCodeResponse1: v.GenericSchema<unknown, T.VerifyCodeResponse1> = v.looseObject({
  success: v.boolean(),
})

export const GraphAPIError9: v.GenericSchema<unknown, T.GraphAPIError9> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessSolutionAccessToken: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionAccessToken> =
  v.looseObject({
    access_token: v.string(),
    expires_at: int64(),
  })

export const WhatsAppBusinessSolution1: v.GenericSchema<unknown, T.WhatsAppBusinessSolution1> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(75)),
  status: v.lazy(() => WhatsAppBusinessSolutionStatus),
  status_for_pending_request: v.lazy(() => WhatsAppBusinessSolutionPendingStatus),
  owner_permissions: v.optional(v.array(v.lazy(() => WhatsAppBusinessAccountPermissionTask))),
})

export const WhatsAppBusinessSolutionStatus1: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionStatus1> = v.picklist([
  "DRAFT",
  "INITIATED",
  "ACTIVE",
  "REJECTED",
  "DEACTIVATED",
  "PENDING_DEACTIVATION",
])

export const WhatsAppBusinessSolutionPendingStatus1: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionPendingStatus1
> = v.picklist(["PENDING_ACTIVATION", "PENDING_DEACTIVATION", "NONE"])

export const GraphAPIError10: v.GenericSchema<unknown, T.GraphAPIError10> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.picklist(["OAuthException", "GraphMethodException", "GraphAPIException"]),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessSolutionAcceptRequest: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionAcceptRequest> =
  v.looseObject({
    partner_app_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
    log_session_id: v.optional(v.string()),
  })

export const WhatsAppBusinessSolutionAcceptResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionAcceptResponse
> = v.looseObject({
  solution_id: v.string(),
  partner_status: v.lazy(() => WhatsAppBusinessSolutionPartnerStatus),
  success: v.boolean(),
  message: v.optional(v.string()),
  update_time: v.optional(v.string()),
})

export const WhatsAppBusinessSolutionPartnerStatus: v.GenericSchema<unknown, T.WhatsAppBusinessSolutionPartnerStatus> =
  v.picklist(["DRAFT", "INITIATED", "NOTIFICATION_SENT", "ACCEPTED", "REJECTED", "DEACTIVATED"])

export const WhatsAppBusinessSolution2: v.GenericSchema<unknown, T.WhatsAppBusinessSolution2> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(75)),
  status: v.lazy(() => WhatsAppBusinessSolutionStatus),
  status_for_pending_request: v.lazy(() => WhatsAppBusinessSolutionPendingStatus),
  owner_app: v.optional(v.lazy(() => ApplicationNode)),
  owner_permissions: v.optional(v.array(v.lazy(() => WhatsAppBusinessAccountPermissionTask))),
})

export const GraphAPIError11: v.GenericSchema<unknown, T.GraphAPIError11> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const SolutionRejectRequest: v.GenericSchema<unknown, T.SolutionRejectRequest> = v.looseObject({
  request_type: v.picklist(["PARTNERSHIP_REQUEST", "DEACTIVATION_REQUEST"]),
  rejection_reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
  partner_app_id: v.optional(v.pipe(v.string(), v.regex(/^[0-9]+$/))),
})

export const SolutionRejectResponse: v.GenericSchema<unknown, T.SolutionRejectResponse> = v.looseObject({
  success: v.boolean(),
  solution_id: v.string(),
  rejected_request_type: v.picklist(["PARTNERSHIP_REQUEST", "DEACTIVATION_REQUEST"]),
  rejection_timestamp: v.optional(v.string()),
  partner_app_id: v.optional(v.string()),
})

export const WhatsAppBusinessSolutionDeactivationRequest: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionDeactivationRequest
> = v.looseObject({
  reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
})

export const WhatsAppBusinessSolutionDeactivationResponse: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessSolutionDeactivationResponse
> = v.looseObject({
  success: v.boolean(),
  message: v.string(),
  request_id: v.optional(v.string()),
})

export const AssignedWhatsAppBusinessAccount: v.GenericSchema<unknown, T.AssignedWhatsAppBusinessAccount> =
  v.looseObject({
    id: v.string(),
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
    status: v.lazy(() => WhatsAppBusinessAccountStatus),
    assignment_date: v.optional(v.string()),
    permissions: v.optional(v.array(v.lazy(() => WhatsAppBusinessAccountPermission))),
    business_id: v.optional(v.string()),
    phone_numbers: v.optional(v.array(v.lazy(() => PhoneNumberInfo))),
  })

export const WhatsAppBusinessAccountStatus: v.GenericSchema<unknown, T.WhatsAppBusinessAccountStatus> = v.picklist([
  "ACTIVE",
  "PENDING",
  "RESTRICTED",
  "DISABLED",
])

export const WhatsAppBusinessAccountPermission: v.GenericSchema<unknown, T.WhatsAppBusinessAccountPermission> =
  v.picklist([
    "MANAGE",
    "DEVELOP",
    "MANAGE_TEMPLATES",
    "MANAGE_PHONE",
    "VIEW_COST",
    "MANAGE_EXTENSIONS",
    "VIEW_PHONE_ASSETS",
    "MANAGE_PHONE_ASSETS",
    "VIEW_TEMPLATES",
    "VIEW_INSIGHTS",
    "RECEIVE_INCOMING_MESSAGES",
    "MANAGE_BILLING",
    "MANAGE_USERS",
    "MESSAGING",
    "FULL_CONTROL",
  ])

export const PhoneNumberInfo1: v.GenericSchema<unknown, T.PhoneNumberInfo1> = v.looseObject({
  id: v.optional(v.string()),
  display_phone_number: v.optional(v.string()),
  verified_name: v.optional(v.string()),
  status: v.optional(v.picklist(["CONNECTED", "DISCONNECTED", "MIGRATED", "PENDING", "DELETED"])),
})

export const AssignedAccountsResponse: v.GenericSchema<unknown, T.AssignedAccountsResponse> = v.looseObject({
  data: v.array(v.lazy(() => AssignedWhatsAppBusinessAccount)),
  paging: v.optional(v.lazy(() => PagingInfo)),
})

export const PagingInfo1: v.GenericSchema<unknown, T.PagingInfo1> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  next: v.optional(v.string()),
  previous: v.optional(v.string()),
})

export const WhatsAppAccountNumber: v.GenericSchema<unknown, T.WhatsAppAccountNumber> = v.looseObject({
  id: v.string(),
  display_phone_number: v.string(),
  verified_name: v.optional(v.string()),
  status: v.lazy(() => WhatsAppAccountNumberStatus),
  quality_rating: v.optional(v.lazy(() => WhatsAppPhoneNumberQualityRating)),
  country_code: v.optional(v.string()),
  country_dial_code: v.optional(v.string()),
  code_verification_status: v.optional(v.lazy(() => WhatsAppCodeVerificationStatus)),
  name_status: v.optional(v.lazy(() => WhatsAppDisplayNameStatus)),
  messaging_limit_tier: v.optional(
    v.picklist(["TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"]),
  ),
  account_mode: v.optional(v.lazy(() => WhatsAppBusinessSandboxEligibility)),
  certificate: v.optional(v.string()),
  is_official_business_account: v.optional(v.boolean()),
})

export const WhatsAppAccountNumberStatus: v.GenericSchema<unknown, T.WhatsAppAccountNumberStatus> = v.picklist([
  "CONNECTED",
  "DISCONNECTED",
  "UNVERIFIED",
  "PENDING",
  "FLAGGED",
  "RESTRICTED",
])

export const WhatsAppPhoneNumberQualityRating: v.GenericSchema<unknown, T.WhatsAppPhoneNumberQualityRating> =
  v.picklist(["GREEN", "YELLOW", "RED", "NA"])

export const WhatsAppCodeVerificationStatus: v.GenericSchema<unknown, T.WhatsAppCodeVerificationStatus> = v.picklist([
  "VERIFIED",
  "UNVERIFIED",
])

export const WhatsAppDisplayNameStatus: v.GenericSchema<unknown, T.WhatsAppDisplayNameStatus> = v.picklist([
  "APPROVED",
  "AVAILABLE_WITHOUT_REVIEW",
  "DECLINED",
  "EXPIRED",
  "PENDING_REVIEW",
  "NONE",
])

export const WhatsAppBusinessSandboxEligibility: v.GenericSchema<unknown, T.WhatsAppBusinessSandboxEligibility> =
  v.picklist(["LIVE", "SANDBOX"])

export const AssignedUser: v.GenericSchema<unknown, T.AssignedUser> = v.looseObject({
  id: v.string(),
  name: v.string(),
  business: v.optional(v.lazy(() => BusinessNode)),
  user_type: v.optional(v.lazy(() => AssignedUserType)),
})

export const AssignedUserType: v.GenericSchema<unknown, T.AssignedUserType> = v.picklist([
  "BUSINESS_USER",
  "SYSTEM_USER",
  "PERSONAL_USER",
])

export const BusinessNode: v.GenericSchema<unknown, T.BusinessNode> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const AssignedUsersResponse: v.GenericSchema<unknown, T.AssignedUsersResponse> = v.looseObject({
  data: v.array(v.lazy(() => AssignedUser)),
  paging: v.optional(v.lazy(() => CursorPaging)),
  summary: v.optional(v.lazy(() => AssignedUsersSummary)),
})

export const AssignedUsersSummary: v.GenericSchema<unknown, T.AssignedUsersSummary> = v.looseObject({
  total_count: v.optional(integer()),
})

export const CursorPaging6: v.GenericSchema<unknown, T.CursorPaging6> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  next: v.optional(v.string()),
  previous: v.optional(v.string()),
})

export const SuccessResponse1: v.GenericSchema<unknown, T.SuccessResponse1> = v.looseObject({
  success: v.boolean(),
})

export const ConversationalAutomationRequest: v.GenericSchema<unknown, T.ConversationalAutomationRequest> =
  v.looseObject({
    enable_welcome_message: v.optional(v.boolean()),
    prompts: v.optional(v.pipe(v.array(v.pipe(v.string(), v.maxLength(80))), v.maxLength(3))),
    commands: v.optional(v.pipe(v.array(v.lazy(() => BotCommand)), v.maxLength(30))),
  })

export const BotCommand: v.GenericSchema<unknown, T.BotCommand> = v.looseObject({
  command_name: v.pipe(v.string(), v.maxLength(30), v.regex(/^[a-zA-Z0-9_]+$/)),
  command_description: v.pipe(v.string(), v.maxLength(256)),
})

export const ConversationalAutomationResponse: v.GenericSchema<unknown, T.ConversationalAutomationResponse> =
  v.looseObject({
    success: v.boolean(),
  })

export const BusinessOwnedObjectOnBehalfOfRequest: v.GenericSchema<unknown, T.BusinessOwnedObjectOnBehalfOfRequest> =
  v.looseObject({
    id: v.string(),
    status: v.lazy(() => BusinessRequestStatus),
    business_owned_object: v.string(),
    receiving_business: v.optional(v.lazy(() => BusinessNode)),
    requesting_business: v.optional(v.lazy(() => BusinessNode)),
  })

export const BusinessRequestStatus: v.GenericSchema<unknown, T.BusinessRequestStatus> = v.picklist([
  "APPROVE",
  "DECLINE",
  "IN_PROGRESS",
  "EXPIRED",
  "PENDING",
  "CANCELED",
  "INVALID",
])

export const BusinessNode1: v.GenericSchema<unknown, T.BusinessNode1> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const PaginationInfo2: v.GenericSchema<unknown, T.PaginationInfo2> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  paging: v.optional(
    v.looseObject({
      previous: v.optional(v.string()),
      next: v.optional(v.string()),
    }),
  ),
})

export const InProgressOnBehalfRequestResponse: v.GenericSchema<unknown, T.InProgressOnBehalfRequestResponse> =
  v.looseObject({
    data: v.array(v.lazy(() => BusinessOwnedObjectOnBehalfOfRequest)),
    paging: v.optional(v.lazy(() => PaginationInfo)),
  })

export const OBOMobilityIntentNode: v.GenericSchema<unknown, T.OBOMobilityIntentNode> = v.looseObject({
  id: v.string(),
  waba: v.lazy(() => WhatsAppBusinessAccount),
  solution: v.lazy(() => WhatsAppBusinessSolution),
  status: v.optional(v.picklist(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "FAILED"])),
  created_time: v.optional(v.string()),
  updated_time: v.optional(v.string()),
})

export const WhatsAppBusinessAccount2: v.GenericSchema<unknown, T.WhatsAppBusinessAccount2> = v.looseObject({
  id: v.string(),
  name: v.string(),
  status: v.optional(v.picklist(["ACTIVE", "INACTIVE", "PENDING"])),
})

export const WhatsAppBusinessSolution3: v.GenericSchema<unknown, T.WhatsAppBusinessSolution3> = v.looseObject({
  id: v.string(),
  name: v.string(),
  partner_id: v.optional(v.string()),
  status: v.optional(v.picklist(["ACTIVE", "INACTIVE", "PENDING"])),
})

export const OBOMobilityIntentRequest: v.GenericSchema<unknown, T.OBOMobilityIntentRequest> = v.looseObject({
  solution_id: v.string(),
  intent_type: v.lazy(() => MobilityIntentType),
  target_solution_id: v.optional(v.string()),
  mobility_reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
  scheduled_execution_time: v.optional(v.string()),
  metadata: v.optional(v.looseObject({})),
})

export const MobilityIntentType: v.GenericSchema<unknown, T.MobilityIntentType> = v.picklist([
  "INITIATE_TRANSFER",
  "CONFIRM_TRANSFER",
  "CANCEL_TRANSFER",
  "REQUEST_HANDOVER",
  "APPROVE_HANDOVER",
  "REJECT_HANDOVER",
])

export const OBOMobilityIntentResponse: v.GenericSchema<unknown, T.OBOMobilityIntentResponse> = v.looseObject({
  success: v.boolean(),
  mobility_intent_id: v.string(),
  status: v.optional(
    v.picklist(["PENDING", "APPROVED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
  ),
  estimated_completion_time: v.optional(v.string()),
  approval_required: v.optional(v.boolean()),
  next_steps: v.optional(v.array(v.string())),
})

export const WhatsAppBusinessAccountPhoneNumber: v.GenericSchema<unknown, T.WhatsAppBusinessAccountPhoneNumber> =
  v.looseObject({
    id: v.string(),
    display_phone_number: v.string(),
    verified_name: v.optional(v.string()),
    status: v.lazy(() => WhatsAppPhoneNumberStatus),
    quality_rating: v.optional(v.lazy(() => WhatsAppPhoneNumberQualityRating)),
    country_code: v.optional(v.string()),
    country_dial_code: v.optional(v.string()),
    code_verification_status: v.optional(v.lazy(() => WhatsAppCodeVerificationStatus)),
    unified_cert_status: v.optional(v.lazy(() => WhatsAppBusinessUnifiedCertStatus)),
    account_mode: v.optional(v.lazy(() => WhatsAppBusinessSandboxEligibility)),
    host_platform: v.optional(v.lazy(() => WhatsAppBusinessAccountHostPlatform)),
    messaging_limit_tier: v.optional(
      v.picklist(["TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"]),
    ),
    is_official_business_account: v.optional(v.boolean()),
    username: v.optional(v.nullable(v.string())),
  })

export const WhatsAppPhoneNumberStatus: v.GenericSchema<unknown, T.WhatsAppPhoneNumberStatus> = v.picklist([
  "PENDING",
  "LINKED",
  "UNLINKED",
  "DELETED",
  "MIGRATED",
  "BANNED",
  "RESTRICTED",
])

export const WhatsAppPhoneNumberQualityRating1: v.GenericSchema<unknown, T.WhatsAppPhoneNumberQualityRating1> =
  v.picklist(["GREEN", "YELLOW", "RED", "UNKNOWN"])

export const WhatsAppCodeVerificationStatus1: v.GenericSchema<unknown, T.WhatsAppCodeVerificationStatus1> = v.picklist([
  "VERIFIED",
  "NOT_VERIFIED",
])

export const WhatsAppBusinessUnifiedCertStatus: v.GenericSchema<unknown, T.WhatsAppBusinessUnifiedCertStatus> =
  v.picklist(["APPROVED", "NAME_PENDING_REVIEW", "NAME_NOT_APPROVED", "ACCOUNT_REVIEW_NOT_STARTED", "LIMITED_ACCESS"])

export const WhatsAppBusinessSandboxEligibility1: v.GenericSchema<unknown, T.WhatsAppBusinessSandboxEligibility1> =
  v.picklist(["LIVE", "SANDBOX"])

export const WhatsAppBusinessAccountHostPlatform: v.GenericSchema<unknown, T.WhatsAppBusinessAccountHostPlatform> =
  v.picklist(["CLOUD_API", "ON_PREMISE", "NOT_APPLICABLE"])

export const WhatsAppBusinessAccountPhoneNumbersConnection: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountPhoneNumbersConnection
> = v.looseObject({
  data: v.array(v.lazy(() => WhatsAppBusinessAccountPhoneNumber)),
  paging: v.optional(v.lazy(() => CursorPaging)),
})

export const CursorPaging7: v.GenericSchema<unknown, T.CursorPaging7> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const PhoneNumberCreateRequest: v.GenericSchema<unknown, T.PhoneNumberCreateRequest> = v.looseObject({
  phone_number: v.pipe(v.string(), v.regex(/^[1-9][0-9]{6,14}$/)),
  verified_name: v.pipe(v.string(), v.minLength(2), v.maxLength(75)),
  cc: v.optional(v.pipe(v.string(), v.regex(/^[0-9]{1,3}$/))),
  migrate_phone_number: v.optional(v.boolean()),
  preverified_id: v.optional(v.string()),
})

export const PhoneNumberCreateResponse: v.GenericSchema<unknown, T.PhoneNumberCreateResponse> = v.looseObject({
  id: v.string(),
})

export const WhatsAppBusinessAccountSchedule: v.GenericSchema<unknown, T.WhatsAppBusinessAccountSchedule> =
  v.looseObject({
    id: v.string(),
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
    status: v.lazy(() => WhatsAppScheduleStatus),
    schedule_type: v.lazy(() => WhatsAppScheduleType),
    description: v.optional(v.pipe(v.string(), v.maxLength(500))),
    start_time: v.optional(v.string()),
    end_time: v.optional(v.string()),
    timezone: v.optional(v.string()),
    days_of_week: v.optional(v.array(v.lazy(() => DayOfWeek))),
    created_time: v.optional(v.string()),
    updated_time: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    recurrence_pattern: v.optional(v.lazy(() => RecurrencePattern)),
  })

export const WhatsAppScheduleStatus: v.GenericSchema<unknown, T.WhatsAppScheduleStatus> = v.picklist([
  "ACTIVE",
  "INACTIVE",
  "PAUSED",
  "EXPIRED",
  "DRAFT",
])

export const WhatsAppScheduleType: v.GenericSchema<unknown, T.WhatsAppScheduleType> = v.picklist([
  "BUSINESS_HOURS",
  "AUTOMATED_RESPONSE",
  "MESSAGE_CAMPAIGN",
  "MAINTENANCE_WINDOW",
  "CUSTOM",
])

export const DayOfWeek: v.GenericSchema<unknown, T.DayOfWeek> = v.picklist([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
])

export const RecurrencePattern: v.GenericSchema<unknown, T.RecurrencePattern> = v.looseObject({
  frequency: v.optional(v.picklist(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])),
  interval: v.optional(integer({ minimum: 1 })),
  end_date: v.optional(v.string()),
})

export const WhatsAppBusinessAccountSchedulesConnection: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountSchedulesConnection
> = v.looseObject({
  data: v.array(v.lazy(() => WhatsAppBusinessAccountSchedule)),
  paging: v.optional(v.lazy(() => CursorPaging)),
})

export const CursorPaging8: v.GenericSchema<unknown, T.CursorPaging8> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const ScheduleCreateRequest: v.GenericSchema<unknown, T.ScheduleCreateRequest> = v.looseObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  schedule_type: v.lazy(() => WhatsAppScheduleType),
  description: v.optional(v.pipe(v.string(), v.maxLength(500))),
  start_time: v.string(),
  end_time: v.string(),
  timezone: v.optional(v.string()),
  days_of_week: v.optional(v.array(v.lazy(() => DayOfWeek))),
  is_active: v.optional(v.boolean()),
  recurrence_pattern: v.optional(v.lazy(() => RecurrencePattern)),
})

export const ScheduleCreateResponse: v.GenericSchema<unknown, T.ScheduleCreateResponse> = v.looseObject({
  id: v.string(),
})

export const SetOBOMobilityIntentRequest: v.GenericSchema<unknown, T.SetOBOMobilityIntentRequest> = v.looseObject({
  waba_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
  solution_id: v.optional(v.pipe(v.string(), v.regex(/^[0-9]+$/))),
  app_id: v.optional(v.pipe(v.string(), v.regex(/^[0-9]+$/))),
  actor_id: v.optional(v.pipe(v.string(), v.regex(/^[0-9]+$/))),
  client_mutation_id: v.optional(v.pipe(v.string(), v.maxLength(255))),
})

export const SetOBOMobilityIntentResponse: v.GenericSchema<unknown, T.SetOBOMobilityIntentResponse> = v.looseObject({
  success: v.boolean(),
  intent_id: v.optional(v.string()),
  client_mutation_id: v.optional(v.string()),
  error_msg: v.optional(v.string()),
})

export const SetSolutionMigrationIntentRequest: v.GenericSchema<unknown, T.SetSolutionMigrationIntentRequest> =
  v.looseObject({
    solution_id: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
    migration_intent: v.lazy(() => SolutionMigrationIntent),
    target_solution_id: v.optional(v.pipe(v.string(), v.regex(/^[0-9]+$/))),
    migration_reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
    scheduled_migration_time: v.optional(v.string()),
  })

export const SolutionMigrationIntent: v.GenericSchema<unknown, T.SolutionMigrationIntent> = v.picklist([
  "INITIATE_MIGRATION",
  "CANCEL_MIGRATION",
  "CONFIRM_MIGRATION",
  "SCHEDULE_MIGRATION",
])

export const SetSolutionMigrationIntentResponse: v.GenericSchema<unknown, T.SetSolutionMigrationIntentResponse> =
  v.looseObject({
    success: v.boolean(),
    migration_intent_id: v.string(),
    status: v.optional(v.picklist(["PENDING", "APPROVED", "REJECTED", "SCHEDULED"])),
    estimated_completion_time: v.optional(v.string()),
  })

export const SolutionsList: v.GenericSchema<unknown, T.SolutionsList> = v.looseObject({
  data: v.array(v.lazy(() => WhatsAppBusinessSolution)),
  paging: v.optional(v.lazy(() => Paging)),
})

export const Paging1: v.GenericSchema<unknown, T.Paging1> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const GraphAPIError12: v.GenericSchema<unknown, T.GraphAPIError12> = v.looseObject({
  error: v.looseObject({
    message: v.string(),
    type: v.string(),
    code: integer(),
    error_subcode: v.optional(integer()),
    fbtrace_id: v.optional(v.string()),
    is_transient: v.optional(v.boolean()),
    error_user_title: v.optional(v.string()),
    error_user_msg: v.optional(v.string()),
  }),
})

export const WhatsAppBusinessApiData1: v.GenericSchema<unknown, T.WhatsAppBusinessApiData1> = v.looseObject({
  id: v.string(),
  name: v.string(),
  link: v.optional(v.string()),
})

export const SubscribedApp1: v.GenericSchema<unknown, T.SubscribedApp1> = v.looseObject({
  whatsapp_business_api_data: v.lazy(() => WhatsAppBusinessApiData),
  override_callback_uri: v.optional(v.string()),
})

export const SubscribedAppsResponse: v.GenericSchema<unknown, T.SubscribedAppsResponse> = v.looseObject({
  data: v.array(v.lazy(() => SubscribedApp)),
})

export const SubscriptionRequest: v.GenericSchema<unknown, T.SubscriptionRequest> = v.looseObject({
  override_callback_uri: v.optional(v.string()),
  verify_token: v.optional(v.string()),
})

export const SubscriptionResponse: v.GenericSchema<unknown, T.SubscriptionResponse> = v.looseObject({
  success: v.boolean(),
  data: v.optional(v.array(v.lazy(() => SubscribedApp))),
})

export const WhatsAppBusinessAccountActivity: v.GenericSchema<unknown, T.WhatsAppBusinessAccountActivity> =
  v.looseObject({
    id: v.string(),
    activity_type: v.lazy(() => ActivityType),
    timestamp: v.string(),
    actor_type: v.lazy(() => ActorType),
    actor_id: v.optional(v.string()),
    actor_name: v.optional(v.string()),
    description: v.optional(v.string()),
    details: v.optional(v.looseObject({})),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
  })

export const ActivityType: v.GenericSchema<unknown, T.ActivityType> = v.picklist([
  "ACCOUNT_CREATED",
  "ACCOUNT_UPDATED",
  "ACCOUNT_DELETED",
  "PHONE_NUMBER_ADDED",
  "PHONE_NUMBER_REMOVED",
  "PHONE_NUMBER_VERIFIED",
  "USER_ADDED",
  "USER_REMOVED",
  "USER_ROLE_CHANGED",
  "PERMISSION_GRANTED",
  "PERMISSION_REVOKED",
  "TEMPLATE_CREATED",
  "TEMPLATE_UPDATED",
  "TEMPLATE_DELETED",
  "WEBHOOK_CONFIGURED",
  "API_ACCESS_GRANTED",
  "API_ACCESS_REVOKED",
  "BILLING_UPDATED",
  "COMPLIANCE_ACTION",
  "SECURITY_EVENT",
])

export const ActorType: v.GenericSchema<unknown, T.ActorType> = v.picklist([
  "USER",
  "SYSTEM",
  "API",
  "ADMIN",
  "AUTOMATED_PROCESS",
])

export const ActivityList: v.GenericSchema<unknown, T.ActivityList> = v.looseObject({
  data: v.array(v.lazy(() => WhatsAppBusinessAccountActivity)),
  paging: v.optional(v.lazy(() => Paging)),
})

export const Paging2: v.GenericSchema<unknown, T.Paging2> = v.looseObject({
  cursors: v.optional(
    v.looseObject({
      before: v.optional(v.string()),
      after: v.optional(v.string()),
    }),
  ),
  previous: v.optional(v.string()),
  next: v.optional(v.string()),
})

export const WhatsAppBusinessAccount3: v.GenericSchema<unknown, T.WhatsAppBusinessAccount3> = v.looseObject({
  id: v.string(),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  timezone_id: v.optional(v.string()),
  message_template_namespace: v.optional(v.string()),
  account_review_status: v.optional(v.lazy(() => WhatsAppBusinessAccountReviewStatus)),
  business_verification_status: v.optional(v.lazy(() => WhatsAppBusinessAccountVerificationStatus)),
  country: v.optional(v.string()),
  ownership_type: v.optional(v.lazy(() => WhatsAppBusinessAccountOwnershipType)),
  primary_business_location: v.optional(v.string()),
})

export const WhatsAppBusinessAccountReviewStatus: v.GenericSchema<unknown, T.WhatsAppBusinessAccountReviewStatus> =
  v.picklist(["PENDING", "APPROVED", "REJECTED", "LIMIT_REACHED"])

export const WhatsAppBusinessAccountVerificationStatus: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessAccountVerificationStatus
> = v.picklist(["VERIFIED", "UNVERIFIED", "PENDING"])

export const WhatsAppBusinessAccountOwnershipType: v.GenericSchema<unknown, T.WhatsAppBusinessAccountOwnershipType> =
  v.picklist(["SELF_OWNED", "CLIENT_OWNED", "AGENCY_OWNED"])

export const WhatsAppBusinessBot: v.GenericSchema<unknown, T.WhatsAppBusinessBot> = v.looseObject({
  id: v.string(),
  prompts: v.optional(v.array(v.string())),
  commands: v.optional(v.array(v.lazy(() => WhatsAppBusinessBotCommand))),
  enable_welcome_message: v.optional(v.boolean()),
})

export const WhatsAppBusinessBotCommand: v.GenericSchema<unknown, T.WhatsAppBusinessBotCommand> = v.looseObject({
  command_name: v.string(),
  command_description: v.string(),
})

export const WhatsAppBusinessProfileNode: v.GenericSchema<unknown, T.WhatsAppBusinessProfileNode> = v.looseObject({
  id: v.string(),
  account_name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(75))),
  description: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  email: v.optional(v.pipe(v.string(), v.maxLength(128))),
  about: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(139))),
  address: v.optional(v.pipe(v.string(), v.maxLength(256))),
  vertical: v.optional(v.lazy(() => WhatsAppBusinessVertical)),
  websites: v.optional(v.pipe(v.array(v.pipe(v.string(), v.maxLength(256))), v.maxLength(2))),
  profile_picture_url: v.optional(v.string()),
  profile_picture_handle: v.optional(v.string()),
  messaging_product: v.optional(v.picklist(["whatsapp"])),
})

export const WhatsAppBusinessProfileUpdateRequest1: v.GenericSchema<unknown, T.WhatsAppBusinessProfileUpdateRequest1> =
  v.looseObject({
    messaging_product: v.picklist(["whatsapp"]),
    account_name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(75))),
    description: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
    email: v.optional(v.pipe(v.string(), v.maxLength(128))),
    about: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(139))),
    address: v.optional(v.pipe(v.string(), v.maxLength(256))),
    vertical: v.optional(v.lazy(() => WhatsAppBusinessVertical)),
    websites: v.optional(v.pipe(v.array(v.pipe(v.string(), v.maxLength(256))), v.maxLength(2))),
    profile_picture_handle: v.optional(v.string()),
  })

export const WhatsAppBusinessProfileUpdateResponse1: v.GenericSchema<
  unknown,
  T.WhatsAppBusinessProfileUpdateResponse1
> = v.looseObject({
  id: v.optional(v.string()),
  success: v.optional(v.boolean()),
})

export const WhatsAppBusinessVertical1: v.GenericSchema<unknown, T.WhatsAppBusinessVertical1> = v.picklist([
  "UNDEFINED",
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "NOT_A_BIZ",
])

export const WebhookPayload: v.GenericSchema<unknown, T.WebhookPayload> = v.looseObject({
  object: v.string(),
  entry: v.array(v.lazy(() => Entry)),
})

export const Entry: v.GenericSchema<unknown, T.Entry> = v.looseObject({
  id: v.string(),
  changes: v.array(v.lazy(() => Change)),
})

export const Change: v.GenericSchema<unknown, T.Change> = v.looseObject({
  value: v.union([
    v.lazy(() => IncomingMessageValueGeneral),
    v.lazy(() => IncomingMessageValueSystem),
    v.lazy(() => StatusMessageValue),
    v.lazy(() => GroupValue),
  ]),
  field: v.picklist(["messages", "group_lifecycle_update", "group_settings_update", "group_participant_update"]),
})

export const Metadata: v.GenericSchema<unknown, T.Metadata> = v.looseObject({
  display_phone_number: v.string(),
  phone_number_id: v.string(),
})

export const ContactProfile: v.GenericSchema<unknown, T.ContactProfile> = v.looseObject({
  profile: v.looseObject({
    name: v.string(),
  }),
  wa_id: v.optional(v.string()),
})

export const IncomingMessageValueGeneral: v.GenericSchema<unknown, T.IncomingMessageValueGeneral> = v.looseObject({
  messaging_product: v.string(),
  metadata: v.lazy(() => Metadata),
  contacts: v.array(v.lazy(() => ContactProfile)),
  messages: v.array(v.lazy(() => IncomingMessage)),
})

export const IncomingMessageValueSystem: v.GenericSchema<unknown, T.IncomingMessageValueSystem> = v.looseObject({
  messaging_product: v.string(),
  metadata: v.lazy(() => Metadata),
  messages: v.array(v.lazy(() => SystemMessage)),
})

export const StatusMessageValue: v.GenericSchema<unknown, T.StatusMessageValue> = v.looseObject({
  messaging_product: v.string(),
  metadata: v.lazy(() => Metadata),
  statuses: v.array(v.lazy(() => Statuses)),
})

export const Statuses: v.GenericSchema<unknown, T.Statuses> = v.looseObject({
  id: v.string(),
  status: v.picklist(["sent", "delivered", "read", "failed"]),
  timestamp: v.string(),
  recipient_id: v.string(),
  group_id: v.optional(v.string()),
  conversation: v.optional(v.lazy(() => Conversation)),
  pricing: v.optional(v.lazy(() => Pricing)),
  errors: v.optional(v.array(v.lazy(() => StatusError))),
})

export const Conversation: v.GenericSchema<unknown, T.Conversation> = v.looseObject({
  id: v.optional(v.string()),
  expiration_timestamp: v.optional(v.string()),
  origin: v.optional(v.lazy(() => ConversationOrigin)),
})

export const ConversationOrigin: v.GenericSchema<unknown, T.ConversationOrigin> = v.looseObject({
  type: v.optional(v.string()),
})

export const Pricing: v.GenericSchema<unknown, T.Pricing> = v.looseObject({
  billable: v.optional(v.boolean()),
  pricing_model: v.optional(v.picklist(["CBP", "PMP"])),
  category: v.optional(v.string()),
})

export const StatusError: v.GenericSchema<unknown, T.StatusError> = v.looseObject({
  code: v.optional(integer()),
  title: v.optional(v.string()),
  message: v.optional(v.string()),
  error_data: v.optional(v.lazy(() => ErrorData)),
  href: v.optional(v.string()),
})

export const ErrorData: v.GenericSchema<unknown, T.ErrorData> = v.looseObject({
  details: v.optional(v.string()),
})

export const GroupValue: v.GenericSchema<unknown, T.GroupValue> = v.looseObject({
  messaging_product: v.string(),
  metadata: v.lazy(() => Metadata),
  groups: v.array(v.lazy(() => Groups)),
})

export const Groups: v.GenericSchema<unknown, T.Groups> = v.looseObject({
  timestamp: integer(),
  group_id: v.string(),
  type: v.picklist([
    "group_create",
    "group_delete",
    "group_settings_update",
    "group_add_participants",
    "group_remove_participants",
  ]),
  request_id: v.string(),
  subject: v.optional(v.string()),
  description: v.optional(v.string()),
  added_participants: v.optional(v.array(v.lazy(() => GroupParticipant))),
  removed_participants: v.optional(v.array(v.lazy(() => GroupParticipant))),
  profile_picture: v.optional(v.lazy(() => GroupProfilePicture)),
})

export const GroupParticipant: v.GenericSchema<unknown, T.GroupParticipant> = v.looseObject({
  input: v.optional(v.string()),
  wa_id: v.optional(v.string()),
})

export const GroupProfilePicture: v.GenericSchema<unknown, T.GroupProfilePicture> = v.looseObject({
  mime_type: v.optional(v.string()),
  sha256: v.optional(v.string()),
})

export const BaseMessageProperties1: v.GenericSchema<unknown, T.BaseMessageProperties1> = v.looseObject({
  from: v.string(),
  id: v.string(),
  timestamp: v.string(),
})

export const IncomingMessage: v.GenericSchema<unknown, T.IncomingMessage> = v.union([
  v.lazy(() => TextMessage),
  v.lazy(() => ReactionMessage),
  v.lazy(() => AudioMessage),
  v.lazy(() => DocumentMessage),
  v.lazy(() => ImageMessage),
  v.lazy(() => StickerMessage),
  v.lazy(() => VideoMessage),
  v.lazy(() => LocationMessage),
  v.lazy(() => ContactSharingMessage),
  v.lazy(() => UnsupportedMessage),
  v.lazy(() => UnsupportedMessage),
  v.lazy(() => ButtonMessage),
  v.lazy(() => InteractiveMessageReply),
  v.lazy(() => OrderMessage),
])

export const TextMessage2: v.GenericSchema<unknown, T.TextMessage2> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["text"]),
  context: v.optional(v.lazy(() => ContextObject)),
  text: v.looseObject({
    body: v.string(),
  }),
  referral: v.optional(v.lazy(() => ReferralObject)),
})

export const ContextObject: v.GenericSchema<unknown, T.ContextObject> = v.looseObject({
  from: v.string(),
  id: v.string(),
  referred_product: v.looseObject({
    catalog_id: v.string(),
    product_retailer_id: v.string(),
  }),
})

export const ReferralObject: v.GenericSchema<unknown, T.ReferralObject> = v.looseObject({
  source_url: v.string(),
  source_id: v.string(),
  source_type: v.picklist(["ad", "post"]),
  body: v.string(),
  headline: v.string(),
  media_type: v.picklist(["image", "video"]),
  image_url: v.optional(v.string()),
  video_url: v.optional(v.string()),
  thumbnail_url: v.optional(v.string()),
  ctwa_clid: v.string(),
  welcome_message: v.optional(
    v.looseObject({
      text: v.string(),
    }),
  ),
})

export const ReactionMessage1: v.GenericSchema<unknown, T.ReactionMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["reaction"]),
  context: v.optional(v.lazy(() => MessageContext)),
  reaction: v.looseObject({
    message_id: v.string(),
    emoji: v.string(),
  }),
})

export const MediaMessageProperties: v.GenericSchema<unknown, T.MediaMessageProperties> = v.looseObject({
  mime_type: v.string(),
  sha256: v.string(),
  id: v.string(),
})

export const AudioMessage1: v.GenericSchema<unknown, T.AudioMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["audio"]),
  context: v.optional(v.lazy(() => MessageContext)),
  audio: v.looseObject({
    mime_type: v.string(),
    sha256: v.string(),
    id: v.string(),
    voice: v.boolean(),
  }),
})

export const DocumentMessage1: v.GenericSchema<unknown, T.DocumentMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["document"]),
  context: v.optional(v.lazy(() => MessageContext)),
  document: v.looseObject({
    mime_type: v.string(),
    sha256: v.string(),
    id: v.string(),
    filename: v.string(),
  }),
})

export const ImageMessage1: v.GenericSchema<unknown, T.ImageMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["image"]),
  context: v.optional(v.lazy(() => MessageContext)),
  image: v.looseObject({
    mime_type: v.string(),
    sha256: v.string(),
    id: v.string(),
    caption: v.optional(v.string()),
  }),
})

export const StickerMessage1: v.GenericSchema<unknown, T.StickerMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["sticker"]),
  context: v.optional(v.lazy(() => MessageContext)),
  sticker: v.looseObject({
    mime_type: v.string(),
    sha256: v.string(),
    id: v.string(),
    animated: v.boolean(),
  }),
})

export const VideoMessage1: v.GenericSchema<unknown, T.VideoMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["video"]),
  context: v.optional(v.lazy(() => MessageContext)),
  video: v.looseObject({
    mime_type: v.string(),
    sha256: v.string(),
    id: v.string(),
    caption: v.optional(v.string()),
  }),
})

export const LocationMessage1: v.GenericSchema<unknown, T.LocationMessage1> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["location"]),
  context: v.optional(v.lazy(() => MessageContext)),
  location: v.looseObject({
    address: v.string(),
    latitude: number(),
    longitude: number(),
    name: v.string(),
    url: v.optional(v.string()),
  }),
})

export const ContactSharingMessage: v.GenericSchema<unknown, T.ContactSharingMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("contacts"),
  context: v.optional(v.lazy(() => MessageContext)),
  contacts: v.array(v.lazy(() => ContactObject)),
})

export const ContactObject1: v.GenericSchema<unknown, T.ContactObject1> = v.looseObject({
  addresses: v.optional(
    v.array(
      v.looseObject({
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        country_code: v.optional(v.string()),
        state: v.optional(v.string()),
        street: v.optional(v.string()),
        type: v.optional(v.string()),
        zip: v.optional(v.string()),
      }),
    ),
  ),
  birthday: v.optional(v.string()),
  emails: v.optional(
    v.array(
      v.looseObject({
        email: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  name: v.optional(
    v.looseObject({
      formatted_name: v.string(),
      first_name: v.optional(v.string()),
      last_name: v.optional(v.string()),
      middle_name: v.optional(v.string()),
      suffix: v.optional(v.string()),
      prefix: v.optional(v.string()),
    }),
  ),
  org: v.optional(
    v.looseObject({
      company: v.optional(v.string()),
      department: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  ),
  phones: v.optional(
    v.array(
      v.looseObject({
        phone: v.optional(v.string()),
        wa_id: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  urls: v.optional(
    v.array(
      v.looseObject({
        url: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
})

export const UnsupportedMessage: v.GenericSchema<unknown, T.UnsupportedMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["unsupported", "unknown"]),
  context: v.optional(v.lazy(() => MessageContext)),
  errors: v.array(v.lazy(() => ErrorObject)),
})

export const ErrorObject2: v.GenericSchema<unknown, T.ErrorObject2> = v.looseObject({
  code: integer(),
  title: v.string(),
  message: v.string(),
  error_data: v.looseObject({
    details: v.string(),
  }),
  href: v.optional(v.string()),
})

export const ButtonMessage: v.GenericSchema<unknown, T.ButtonMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("button"),
  context: v.looseObject({
    from: v.string(),
    id: v.string(),
  }),
  button: v.looseObject({
    payload: v.string(),
    text: v.string(),
  }),
})

export const InteractiveMessageReply: v.GenericSchema<unknown, T.InteractiveMessageReply> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("interactive"),
  context: v.looseObject({
    from: v.string(),
    id: v.string(),
  }),
  interactive: v.looseObject({
    type: v.picklist(["list_reply", "button_reply"]),
  }),
})

export const InteractiveListReplyContent: v.GenericSchema<unknown, T.InteractiveListReplyContent> = v.looseObject({
  list_reply: v.looseObject({
    id: v.string(),
    title: v.string(),
    description: v.string(),
  }),
})

export const InteractiveButtonReplyContent: v.GenericSchema<unknown, T.InteractiveButtonReplyContent> = v.looseObject({
  button_reply: v.looseObject({
    id: v.string(),
    title: v.string(),
  }),
})

export const OrderMessage: v.GenericSchema<unknown, T.OrderMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.literal("order"),
  context: v.optional(v.lazy(() => MessageContext)),
  order: v.looseObject({
    catalog_id: v.string(),
    text: v.string(),
    product_items: v.array(
      v.looseObject({
        product_retailer_id: v.string(),
        quantity: integer(),
        item_price: number(),
        currency: v.string(),
      }),
    ),
  }),
})

export const SystemMessage: v.GenericSchema<unknown, T.SystemMessage> = v.looseObject({
  messaging_product: v.string(),
  recipient_type: v.picklist(["individual", "group"]),
  to: v.string(),
  type: v.picklist(["system"]),
  context: v.optional(v.lazy(() => MessageContext)),
  system: v.looseObject({
    body: v.string(),
    wa_id: v.optional(v.string()),
    type: v.picklist(["user_changed_number", "user_changed_user_id"]),
    user_id: v.optional(v.string()),
    parent_user_id: v.optional(v.string()),
    previous_user_id: v.optional(v.string()),
    previous_parent_user_id: v.optional(v.string()),
  }),
})

export const GetBusinessPortfolioResponse: v.GenericSchema<unknown, T.GetBusinessPortfolioResponse> = v.looseObject({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  timezone_id: v.optional(number()),
})

export const BlockUsersRequest: v.GenericSchema<unknown, T.BlockUsersRequest> = v.looseObject({
  block_users: v.optional(
    v.array(
      v.looseObject({
        user: v.optional(v.string()),
      }),
    ),
  ),
  messaging_product: v.optional(v.string()),
})

export const UnblockUsersRequest: v.GenericSchema<unknown, T.UnblockUsersRequest> = v.looseObject({
  block_users: v.optional(
    v.array(
      v.looseObject({
        user: v.optional(v.string()),
      }),
    ),
  ),
  messaging_product: v.optional(v.string()),
})

export const ManageCallsRequest: v.GenericSchema<unknown, T.ManageCallsRequest> = v.union([
  v.lazy(() => CallRequestPayload),
  v.lazy(() => CallTerminateRequestPayload),
])

export const ManageCallsResponse: v.GenericSchema<unknown, T.ManageCallsResponse> = v.union([
  v.lazy(() => CallResponsePayload),
  v.lazy(() => CallTerminateResponsePayload),
])

export const UploadMediaRequest: v.GenericSchema<unknown, T.UploadMediaRequest> = v.looseObject({
  file: v.optional(v.pipe(v.string(), v.startsWith("attach://"))),
  messaging_product: v.optional(v.string()),
})

export const UploadMediaResponse: v.GenericSchema<unknown, T.UploadMediaResponse> = v.looseObject({
  id: v.optional(v.string()),
})

export const CreateOrUpdateQrCodeRequest: v.GenericSchema<unknown, T.CreateOrUpdateQrCodeRequest> = v.union([
  v.lazy(() => CreateQrCodeRequest),
  v.lazy(() => UpdateQrCodeRequest),
])

export const UpdatePhoneNumberResponse: v.GenericSchema<unknown, T.UpdatePhoneNumberResponse> = v.union([
  v.lazy(() => MessageResponse),
  v.lazy(() => SuccessResponse),
])

export const UpdatePhoneNumberSettingsRequest: v.GenericSchema<unknown, T.UpdatePhoneNumberSettingsRequest> = v.union([
  v.lazy(() => CallingSettingsRequest),
  v.lazy(() => UserIdentityChangeSettingsRequest),
  v.lazy(() => PayloadEncryptionSettingsRequest),
  v.lazy(() => StorageConfigurationSettingsRequest),
])

export const UpdatePhoneNumberSettingsResponse: v.GenericSchema<unknown, T.UpdatePhoneNumberSettingsResponse> =
  v.looseObject({
    success: v.optional(v.boolean()),
  })

export const GetEncryptionPublicKeyResponse: v.GenericSchema<unknown, T.GetEncryptionPublicKeyResponse> = v.looseObject(
  {
    data: v.optional(v.array(v.lazy(() => WhatsAppBusinessEncryptionInfo))),
  },
)

export const GetCommerceSettingsResponse: v.GenericSchema<unknown, T.GetCommerceSettingsResponse> = v.looseObject({
  data: v.optional(
    v.array(
      v.looseObject({
        id: v.optional(v.string()),
        is_cart_enabled: v.optional(v.boolean()),
        is_catalog_visible: v.optional(v.boolean()),
      }),
    ),
  ),
})

export const SetCommerceSettingsResponse: v.GenericSchema<unknown, T.SetCommerceSettingsResponse> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const GetBusinessComplianceInfoResponse: v.GenericSchema<unknown, T.GetBusinessComplianceInfoResponse> =
  v.looseObject({
    data: v.optional(v.array(v.lazy(() => BusinessComplianceInfo))),
  })

export const UpdateBusinessComplianceInfoResponse: v.GenericSchema<unknown, T.UpdateBusinessComplianceInfoResponse> =
  v.looseObject({
    success: v.boolean(),
  })

export const GetMediaResponse: v.GenericSchema<unknown, T.GetMediaResponse> = v.looseObject({
  file_size: v.optional(v.string()),
  id: v.optional(v.string()),
  messaging_product: v.optional(v.string()),
  mime_type: v.optional(v.string()),
  sha256: v.optional(v.string()),
  url: v.optional(v.string()),
})

export const DeleteMediaResponse: v.GenericSchema<unknown, T.DeleteMediaResponse> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const AddAssignedUserRequest: v.GenericSchema<unknown, T.AddAssignedUserRequest> = v.looseObject({
  user: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
  tasks: v.pipe(v.array(v.lazy(() => WhatsAppBusinessAccountPermissionTask)), v.minLength(1), v.maxLength(16)),
})

export const RemoveAssignedUserRequest: v.GenericSchema<unknown, T.RemoveAssignedUserRequest> = v.looseObject({
  user: v.pipe(v.string(), v.regex(/^[0-9]+$/)),
})

export const GetCreditLinesResponse: v.GenericSchema<unknown, T.GetCreditLinesResponse> = v.looseObject({
  data: v.optional(
    v.array(
      v.looseObject({
        id: v.optional(v.string()),
        legal_entity_name: v.optional(v.string()),
      }),
    ),
  ),
})

export const GetTemplateResponse: v.GenericSchema<unknown, T.GetTemplateResponse> = v.looseObject({
  category: v.optional(v.string()),
  components: v.optional(
    v.array(
      v.looseObject({
        buttons: v.optional(
          v.array(
            v.looseObject({
              text: v.optional(v.string()),
              type: v.optional(v.string()),
            }),
          ),
        ),
        example: v.optional(
          v.looseObject({
            body_text: v.optional(v.array(v.array(v.string()))),
          }),
        ),
        format: v.optional(v.string()),
        text: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  id: v.optional(v.string()),
  language: v.optional(v.string()),
  name: v.optional(v.string()),
  status: v.optional(v.string()),
})

export const EditTemplateRequest: v.GenericSchema<unknown, T.EditTemplateRequest> = v.looseObject({
  category: v.optional(v.string()),
  components: v.optional(
    v.array(
      v.looseObject({
        buttons: v.optional(
          v.array(
            v.looseObject({
              text: v.optional(v.string()),
              type: v.optional(v.string()),
            }),
          ),
        ),
        example: v.optional(
          v.looseObject({
            body_text: v.optional(v.array(v.array(v.string()))),
          }),
        ),
        format: v.optional(v.string()),
        text: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  language: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const EditTemplateResponse: v.GenericSchema<unknown, T.EditTemplateResponse> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const ListTemplatesResponse: v.GenericSchema<unknown, T.ListTemplatesResponse> = v.looseObject({
  data: v.optional(
    v.array(
      v.looseObject({
        category: v.optional(v.string()),
        components: v.optional(
          v.array(
            v.looseObject({
              buttons: v.optional(
                v.array(
                  v.looseObject({
                    text: v.optional(v.string()),
                    type: v.optional(v.string()),
                  }),
                ),
              ),
              example: v.optional(
                v.looseObject({
                  body_text: v.optional(v.array(v.array(v.string()))),
                }),
              ),
              format: v.optional(v.string()),
              text: v.optional(v.string()),
              type: v.optional(v.string()),
            }),
          ),
        ),
        id: v.optional(v.string()),
        language: v.optional(v.string()),
        name: v.optional(v.string()),
        status: v.optional(v.string()),
      }),
    ),
  ),
  paging: v.optional(
    v.looseObject({
      cursors: v.optional(
        v.looseObject({
          after: v.optional(v.string()),
          before: v.optional(v.string()),
        }),
      ),
    }),
  ),
})

export const CreateTemplateRequest: v.GenericSchema<unknown, T.CreateTemplateRequest> = v.looseObject({
  category: v.optional(v.string()),
  components: v.optional(
    v.array(
      v.looseObject({
        buttons: v.optional(
          v.array(
            v.looseObject({
              flow_action: v.optional(v.string()),
              flow_id: v.optional(v.string()),
              navigate_screen: v.optional(v.string()),
              text: v.optional(v.string()),
              type: v.optional(v.string()),
            }),
          ),
        ),
        text: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  language: v.optional(v.string()),
  name: v.optional(v.string()),
})

export const CreateTemplateResponse: v.GenericSchema<unknown, T.CreateTemplateResponse> = v.looseObject({
  category: v.optional(v.string()),
  id: v.optional(v.string()),
  status: v.optional(v.string()),
})

export const DeleteTemplateResponse: v.GenericSchema<unknown, T.DeleteTemplateResponse> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const UpdateBusinessAccountRequest: v.GenericSchema<unknown, T.UpdateBusinessAccountRequest> = v.looseObject({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
  timezone_id: v.optional(v.string()),
})

export const UpdateBusinessAccountResponse: v.GenericSchema<unknown, T.UpdateBusinessAccountResponse> = v.looseObject({
  success: v.optional(v.boolean()),
})

export const schemas = {
  ConnectedClientBusiness,
  BusinessVerificationStatus,
  BusinessStatus,
  ConnectedClientBusinessesResponse,
  CursorPaging,
  GraphAPIError,
  WhatsAppBusinessSolutionCreateRequest,
  WhatsAppBusinessSolutionCreateResponse,
  WhatsAppBusinessAccountConfigurablePermissionTask,
  GraphAPIError1,
  WhatsAppBusinessSolution,
  WhatsAppBusinessSolutionStatus,
  WhatsAppBusinessSolutionPendingStatus,
  WhatsAppBusinessAccountPermissionTask,
  WhatsAppBusinessSolutionApplicationRole,
  ApplicationNode,
  WhatsAppBusinessSolutionsResponse,
  CursorPaging1,
  AddPhoneNumbersRequest,
  AddPhoneNumbersResponse,
  PreVerifiedPhoneNumber,
  PhoneNumberVerificationStatus,
  PhoneNumberAvailabilityStatus,
  WhatsAppBusinessFeature,
  PreVerifiedPhoneNumbersResponse,
  CursorPaging2,
  WhatsAppBusinessAccount,
  AccountReviewStatus,
  OwnershipType,
  BusinessVerificationStatus1,
  SubscribedApp,
  OnBehalfOfBusinessInfo,
  BusinessSchedule,
  DCCConfig,
  MessageTemplate,
  PhoneNumber,
  ClientWhatsAppBusinessAccountsResponse,
  CursorPaging3,
  MMLiteOnboardingRequest,
  WhatsAppBusinessAccount1,
  WhatsAppBusinessType,
  WhatsAppBusinessAccountOnboardingFilter,
  WhatsAppBusinessAccountsConnection,
  CursorPaging4,
  PreVerifiedPhoneNumberShareRequest,
  PreVerifiedPhoneNumberPermission,
  PreVerifiedPhoneNumberShareResponse,
  SharingStatus,
  SharedPreVerifiedPhoneNumber,
  BusinessSummary,
  BlockedUser,
  PaginationCursors,
  Paging,
  GetBlockedUsersData,
  BlockedUserOperation,
  BlockUsersResult,
  UnblockUsersResult,
  BlockUsersData,
  UnblockUsersData,
  CallPermissionCheckResponsePayload,
  CallRequestPayload,
  CallTerminateRequestPayload,
  CallResponsePayload,
  CallTerminateResponsePayload,
  ErrorObject,
  ErrorResponse,
  ErrorObject1,
  ErrorResponse1,
  PagingInfo,
  TemplateObject,
  LanguageObject,
  TemplateComponent,
  HeaderComponent,
  BodyComponent,
  ButtonComponent,
  ParameterObject,
  TextParameter,
  CurrencyParameter,
  DateTimeParameter,
  DocumentParameter,
  ImageParameter,
  VideoParameter,
  CurrencyObject,
  DateTimeObject,
  MediaObject,
  ButtonParameterObject,
  ButtonPayloadParameter,
  ButtonTextParameter,
  MarketingMessageRequestPayload,
  MessageStatus,
  MarketingMessageResponsePayload,
  BaseMessageProperties,
  MessageContext,
  MediaObject1,
  Message,
  TextMessage,
  AudioMessage,
  VideoMessage,
  DocumentMessage,
  ImageMessage,
  LocationMessage,
  StickerMessage,
  ReactionMessage,
  InteractiveMessage,
  InteractiveObject,
  HeaderObject,
  BodyObject,
  FooterObject,
  ActionObject,
  SectionObject,
  TemplateMessage,
  ContactsMessage,
  ContactObject,
  AddressObject,
  EmailObject,
  NameObject,
  OrganizationObject,
  PhoneObject,
  UrlObject,
  MessageResponsePayload,
  MarkMessageRequestPayload,
  MarkMessageResponsePayload,
  QrCodeDetails,
  QrCodeList,
  CreateQrCodeRequest,
  UpdateQrCodeRequest,
  QrCodeResponse,
  GraphAPIError2,
  QrCodeResponse1,
  DeleteQrCodeResponse,
  GraphAPIError3,
  EncryptedMessageRequest,
  EncryptedMessageResponse,
  ErrorResponse2,
  OfficialBusinessAccountStatus,
  OfficialBusinessAccountUpdateRequest,
  OfficialBusinessAccountUpdateResponse,
  WhatsAppBusinessAppealStatus,
  PhoneNumberInfo,
  MessageRequest,
  TextMessage1,
  MessageContext1,
  SettingsRequest,
  CallingSettings,
  RegisterRequest,
  VerifyCodeRequest,
  TwoStepVerificationRequest,
  PhoneNumberStatusUpdateRequest,
  WhatsAppBusinessApiData,
  WebhookConfiguration,
  WhatsAppBusinessAccountToNumberStatus,
  WAAPIBusinessGlobalSearchStateStatus,
  MessageResponse,
  ContactResponse,
  MessageResponseItem,
  SuccessResponse,
  GraphAPIError4,
  DeregisterResponse,
  GraphAPIError5,
  WhatsAppMessageHistory,
  MessageDeliveryStatusEvent,
  WhatsAppMessageDeliveryStatus,
  WebhookUpdateState,
  MessageHistoryResponse,
  PaginationInfo,
  WhatsAppBusinessPhoneNumberRegistrationRequest,
  WhatsAppBusinessAccountBackup,
  WhatsAppDataLocalizationRegion,
  WhatsAppBusinessPhoneNumberRegistrationResponse,
  GraphAPIError6,
  RequestCodeRequest,
  RequestCodeResponse,
  CallingSettingsRequest,
  CallingSettings1,
  VideoSettings,
  SipSettings,
  UserIdentityChangeSettingsRequest,
  UserIdentityChangeSettings,
  PayloadEncryptionSettingsRequest,
  PayloadEncryptionSettings,
  StorageConfigurationSettingsRequest,
  StorageConfigurationSettings,
  PhoneNumberSettingsResponse,
  CallingSettingsResponse,
  CallHoursSettings,
  CallIconsSettings,
  SipSettingsResponse,
  SipServerInfo,
  VideoSettingsResponse,
  AudioSettingsResponse,
  CallingRestrictionsResponse,
  PayloadEncryptionSettingsResponse,
  StorageConfigurationSettingsResponse,
  VerifyCodeRequest1,
  VerifyCodeResponse,
  GraphAPIError7,
  WhatsAppBusinessEncryptionInfo,
  BusinessPublicKeyVerificationStatus,
  WhatsAppBusinessEncryptionUploadRequest,
  WhatsAppBusinessEncryptionUploadResponse,
  GraphAPIError8,
  WhatsAppBusinessProfile,
  WhatsAppBusinessProfileUpdateRequest,
  WhatsAppBusinessVertical,
  WhatsAppBusinessProfileResponse,
  WhatsAppBusinessProfileUpdateResponse,
  BusinessComplianceInfo,
  GrievanceOfficerDetails,
  CustomerCareDetails,
  BusinessComplianceInfoUpdateRequest,
  BusinessEntityType,
  GrievanceOfficerUpdateDetails,
  CustomerCareUpdateDetails,
  ApiError,
  GroupInfo,
  WhatsAppMessageHistoryEventsEdge,
  WhatsAppBusinessMessageDeliveryStatusOccurrence,
  WhatsAppMessageDeliveryStatus1,
  ApplicationNode1,
  MessageHistoryEventsResponse,
  PaginationInfo1,
  WhatsAppBusinessAccountMigrationIntent,
  WhatsAppBusinessAccountMigrationStatus,
  PreVerifiedPhoneNumberValidation,
  WhatsAppBusinessPreVerifiedPhoneNumberPartnersResponse,
  BusinessPartner,
  CursorPaging5,
  RequestCodeRequest1,
  PhoneVerificationMethodCode,
  RequestCodeResponse1,
  VerifyCodeRequest2,
  VerifyCodeResponse1,
  GraphAPIError9,
  WhatsAppBusinessSolutionAccessToken,
  WhatsAppBusinessSolution1,
  WhatsAppBusinessSolutionStatus1,
  WhatsAppBusinessSolutionPendingStatus1,
  GraphAPIError10,
  WhatsAppBusinessSolutionAcceptRequest,
  WhatsAppBusinessSolutionAcceptResponse,
  WhatsAppBusinessSolutionPartnerStatus,
  WhatsAppBusinessSolution2,
  GraphAPIError11,
  SolutionRejectRequest,
  SolutionRejectResponse,
  WhatsAppBusinessSolutionDeactivationRequest,
  WhatsAppBusinessSolutionDeactivationResponse,
  AssignedWhatsAppBusinessAccount,
  WhatsAppBusinessAccountStatus,
  WhatsAppBusinessAccountPermission,
  PhoneNumberInfo1,
  AssignedAccountsResponse,
  PagingInfo1,
  WhatsAppAccountNumber,
  WhatsAppAccountNumberStatus,
  WhatsAppPhoneNumberQualityRating,
  WhatsAppCodeVerificationStatus,
  WhatsAppDisplayNameStatus,
  WhatsAppBusinessSandboxEligibility,
  AssignedUser,
  AssignedUserType,
  BusinessNode,
  AssignedUsersResponse,
  AssignedUsersSummary,
  CursorPaging6,
  SuccessResponse1,
  ConversationalAutomationRequest,
  BotCommand,
  ConversationalAutomationResponse,
  BusinessOwnedObjectOnBehalfOfRequest,
  BusinessRequestStatus,
  BusinessNode1,
  PaginationInfo2,
  InProgressOnBehalfRequestResponse,
  OBOMobilityIntentNode,
  WhatsAppBusinessAccount2,
  WhatsAppBusinessSolution3,
  OBOMobilityIntentRequest,
  MobilityIntentType,
  OBOMobilityIntentResponse,
  WhatsAppBusinessAccountPhoneNumber,
  WhatsAppPhoneNumberStatus,
  WhatsAppPhoneNumberQualityRating1,
  WhatsAppCodeVerificationStatus1,
  WhatsAppBusinessUnifiedCertStatus,
  WhatsAppBusinessSandboxEligibility1,
  WhatsAppBusinessAccountHostPlatform,
  WhatsAppBusinessAccountPhoneNumbersConnection,
  CursorPaging7,
  PhoneNumberCreateRequest,
  PhoneNumberCreateResponse,
  WhatsAppBusinessAccountSchedule,
  WhatsAppScheduleStatus,
  WhatsAppScheduleType,
  DayOfWeek,
  RecurrencePattern,
  WhatsAppBusinessAccountSchedulesConnection,
  CursorPaging8,
  ScheduleCreateRequest,
  ScheduleCreateResponse,
  SetOBOMobilityIntentRequest,
  SetOBOMobilityIntentResponse,
  SetSolutionMigrationIntentRequest,
  SolutionMigrationIntent,
  SetSolutionMigrationIntentResponse,
  SolutionsList,
  Paging1,
  GraphAPIError12,
  WhatsAppBusinessApiData1,
  SubscribedApp1,
  SubscribedAppsResponse,
  SubscriptionRequest,
  SubscriptionResponse,
  WhatsAppBusinessAccountActivity,
  ActivityType,
  ActorType,
  ActivityList,
  Paging2,
  WhatsAppBusinessAccount3,
  WhatsAppBusinessAccountReviewStatus,
  WhatsAppBusinessAccountVerificationStatus,
  WhatsAppBusinessAccountOwnershipType,
  WhatsAppBusinessBot,
  WhatsAppBusinessBotCommand,
  WhatsAppBusinessProfileNode,
  WhatsAppBusinessProfileUpdateRequest1,
  WhatsAppBusinessProfileUpdateResponse1,
  WhatsAppBusinessVertical1,
  WebhookPayload,
  Entry,
  Change,
  Metadata,
  ContactProfile,
  IncomingMessageValueGeneral,
  IncomingMessageValueSystem,
  StatusMessageValue,
  Statuses,
  Conversation,
  ConversationOrigin,
  Pricing,
  StatusError,
  ErrorData,
  GroupValue,
  Groups,
  GroupParticipant,
  GroupProfilePicture,
  BaseMessageProperties1,
  IncomingMessage,
  TextMessage2,
  ContextObject,
  ReferralObject,
  ReactionMessage1,
  MediaMessageProperties,
  AudioMessage1,
  DocumentMessage1,
  ImageMessage1,
  StickerMessage1,
  VideoMessage1,
  LocationMessage1,
  ContactSharingMessage,
  ContactObject1,
  UnsupportedMessage,
  ErrorObject2,
  ButtonMessage,
  InteractiveMessageReply,
  InteractiveListReplyContent,
  InteractiveButtonReplyContent,
  OrderMessage,
  SystemMessage,
  GetBusinessPortfolioResponse,
  BlockUsersRequest,
  UnblockUsersRequest,
  ManageCallsRequest,
  ManageCallsResponse,
  UploadMediaRequest,
  UploadMediaResponse,
  CreateOrUpdateQrCodeRequest,
  UpdatePhoneNumberResponse,
  UpdatePhoneNumberSettingsRequest,
  UpdatePhoneNumberSettingsResponse,
  GetEncryptionPublicKeyResponse,
  GetCommerceSettingsResponse,
  SetCommerceSettingsResponse,
  GetBusinessComplianceInfoResponse,
  UpdateBusinessComplianceInfoResponse,
  GetMediaResponse,
  DeleteMediaResponse,
  AddAssignedUserRequest,
  RemoveAssignedUserRequest,
  GetCreditLinesResponse,
  GetTemplateResponse,
  EditTemplateRequest,
  EditTemplateResponse,
  ListTemplatesResponse,
  CreateTemplateRequest,
  CreateTemplateResponse,
  DeleteTemplateResponse,
  UpdateBusinessAccountRequest,
  UpdateBusinessAccountResponse,
} as const
