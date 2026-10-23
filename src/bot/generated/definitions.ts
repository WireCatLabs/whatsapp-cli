// GENERATED. DO NOT EDIT.
// Source: spec/bot/business-messaging-api_v23.0.yaml
// Run: pnpm bot:generate

import type { SchemaNode } from "@wirecat/cli-base/codegen"

export const definitions: Readonly<Record<string, SchemaNode>> = {
  ConnectedClientBusiness: {
    description: "Connected client business information and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the connected client business",
        type: "string",
      },
      name: {
        description: "Name of the connected client business",
        type: "string",
        minLength: 1,
        maxLength: 255,
      },
      verification_status: {
        type: "ref",
        ref: "BusinessVerificationStatus",
      },
      business_status: {
        type: "ref",
        ref: "BusinessStatus",
      },
      created_time: {
        description: "Timestamp when the business connection was created",
        type: "string",
      },
      updated_time: {
        description: "Timestamp when the business connection was last updated",
        type: "string",
      },
    },
    required: ["id", "name"],
  },
  BusinessVerificationStatus: {
    description: "Verification status of the connected client business",
    type: "string",
    enum: ["VERIFIED", "UNVERIFIED", "PENDING", "REJECTED"],
  },
  BusinessStatus: {
    description: "Current status of the connected client business",
    type: "string",
    enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL"],
  },
  ConnectedClientBusinessesResponse: {
    description: "Response containing list of connected client businesses",
    type: "object",
    properties: {
      data: {
        description: "Array of connected client businesses",
        type: "array",
        items: {
          type: "ref",
          ref: "ConnectedClientBusiness",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: [],
  },
  CursorPaging: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  GraphAPIError: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessSolutionCreateRequest: {
    description: "Request payload for creating a Multi-Partner Solution",
    type: "object",
    properties: {
      owner_permissions: {
        description:
          "Configurable permissions granted to the solution owner app. Currently supports\nonly MESSAGING permission. Use empty array if owner should not have configurable permissions.\n",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountConfigurablePermissionTask",
        },
        maxItems: 1,
      },
      partner_app_id: {
        description:
          "Facebook Application ID of the partner app that will participate in this solution.\nMust be a valid application ID accessible to the requesting entity.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
      partner_permissions: {
        description:
          "Configurable permissions granted to the partner app. Currently supports\nonly MESSAGING permission. Use empty array if partner should not have configurable permissions.\n",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountConfigurablePermissionTask",
        },
        maxItems: 1,
      },
      solution_name: {
        description:
          "Human-readable name for the Multi-Partner Solution. Used for identification\nand management purposes in partner dashboards and solution management interfaces.\n",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
    },
    required: ["owner_permissions", "partner_app_id", "partner_permissions", "solution_name"],
  },
  WhatsAppBusinessSolutionCreateResponse: {
    description: "Successful response containing the created solution identifier",
    type: "object",
    properties: {
      solution_id: {
        description:
          "Unique identifier for the newly created Multi-Partner Solution.\nUse this ID for subsequent solution management operations.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
    },
    required: ["solution_id"],
  },
  WhatsAppBusinessAccountConfigurablePermissionTask: {
    description:
      "Configurable permission tasks for WhatsApp Business Account access in Multi-Partner Solutions.\nCurrently only MESSAGING permission is configurable through this API.\n",
    type: "string",
    enum: ["MESSAGING"],
  },
  GraphAPIError1: {
    description: "Standard Graph API error response structure",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message describing the issue",
            type: "string",
          },
          type: {
            description: "Error type classification for programmatic handling",
            type: "string",
          },
          code: {
            description: "Numeric error code for specific error identification",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when applicable",
            type: "integer",
          },
          fbtrace_id: {
            description: "Facebook trace ID for debugging and support purposes",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessSolution: {
    description: "Multi-Partner Solution details and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the Multi-Partner Solution",
        type: "string",
      },
      name: {
        description: "Human-readable name of the Multi-Partner Solution",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
      status: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionStatus",
      },
      status_for_pending_request: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionPendingStatus",
      },
      owner_app: {
        type: "ref",
        ref: "ApplicationNode",
      },
      owner_permissions: {
        description: "List of WhatsApp Business Account permissions granted to the solution owner",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPermissionTask",
        },
      },
    },
    required: ["id", "name", "status", "status_for_pending_request"],
  },
  WhatsAppBusinessSolutionStatus: {
    description: "Current effective status of the Multi-Partner Solution",
    type: "string",
    enum: ["DRAFT", "INITIATED", "ACTIVE", "REJECTED", "DEACTIVATED"],
  },
  WhatsAppBusinessSolutionPendingStatus: {
    description: "Status of any pending solution status transition requests",
    type: "string",
    enum: ["PENDING_ACTIVATION", "PENDING_DEACTIVATION", "NONE"],
  },
  WhatsAppBusinessAccountPermissionTask: {
    description: "Granular permission tasks for WhatsApp Business Account access",
    type: "string",
    enum: [
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
    ],
  },
  WhatsAppBusinessSolutionApplicationRole: {
    description: "Role of the application in relation to the Multi-Partner Solution",
    type: "string",
    enum: ["OWNER", "PARTNER"],
  },
  ApplicationNode: {
    description: "Meta application that owns the Multi-Partner Solution",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the Meta application",
        type: "string",
      },
      name: {
        description: "Name of the Meta application",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessSolutionsResponse: {
    description: "Response containing list of Multi-Partner Solutions with pagination",
    type: "object",
    properties: {
      data: {
        description: "Array of Multi-Partner Solutions",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessSolution",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: [],
  },
  CursorPaging1: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data that has been returned",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data that has been returned",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "Graph API endpoint URL for the previous page of data",
        type: "string",
      },
      next: {
        description: "Graph API endpoint URL for the next page of data",
        type: "string",
      },
    },
    required: [],
  },
  AddPhoneNumbersRequest: {
    description: "Request payload for adding a phone number to a business account",
    type: "object",
    properties: {
      phone_number: {
        description:
          "Phone number to add to the business account. Accepts E.164 format or formatted numbers\nwith spaces, hyphens, and parentheses (e.g., +1555-0104, +1555-0134, +1555-0135).\nThe phone number will be normalized and validated by the endpoint.\n",
        type: "string",
      },
    },
    required: ["phone_number"],
  },
  AddPhoneNumbersResponse: {
    description: "Response containing the ID of the successfully added phone number",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the preverified phone number entity that was created",
        type: "string",
      },
    },
    required: ["id"],
  },
  PreVerifiedPhoneNumber: {
    description: "Pre-verified phone number details and status information",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the pre-verified phone number",
        type: "string",
      },
      display_phone_number: {
        description: "Formatted display version of the phone number",
        type: "string",
      },
      country_prefix: {
        description: "Country code prefix for the phone number",
        type: "integer",
        minimum: 1,
        maximum: 999,
      },
      verification_status: {
        type: "ref",
        ref: "PhoneNumberVerificationStatus",
      },
      availability_status: {
        type: "ref",
        ref: "PhoneNumberAvailabilityStatus",
      },
      created_time: {
        description: "Timestamp when the phone number was pre-verified",
        type: "string",
      },
      last_updated: {
        description: "Timestamp when the phone number information was last updated",
        type: "string",
      },
      supported_features: {
        description: "List of WhatsApp Business features supported by this phone number",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessFeature",
        },
      },
      country_code: {
        description: "ISO 3166-1 alpha-2 country code for the phone number",
        type: "string",
        pattern: "^[A-Z]{2}$",
      },
      region: {
        description: "Geographic region or area for the phone number",
        type: "string",
      },
    },
    required: ["id", "display_phone_number", "verification_status"],
  },
  PhoneNumberVerificationStatus: {
    description: "Current verification status of the pre-verified phone number",
    type: "string",
    enum: ["VERIFIED", "PENDING", "FAILED", "EXPIRED"],
  },
  PhoneNumberAvailabilityStatus: {
    description: "Current availability status of the pre-verified phone number",
    type: "string",
    enum: ["AVAILABLE", "IN_USE", "RESERVED", "UNAVAILABLE"],
  },
  WhatsAppBusinessFeature: {
    description: "WhatsApp Business features supported by the phone number",
    type: "string",
    enum: ["MESSAGING", "BUSINESS_PROFILE", "WEBHOOKS", "TEMPLATES", "ANALYTICS", "COMMERCE", "FLOWS"],
  },
  PreVerifiedPhoneNumbersResponse: {
    description: "Response containing list of pre-verified phone numbers",
    type: "object",
    properties: {
      data: {
        description: "List of pre-verified phone numbers",
        type: "array",
        items: {
          type: "ref",
          ref: "PreVerifiedPhoneNumber",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: ["data"],
  },
  CursorPaging2: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data that has been returned",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data that has been returned",
            type: "string",
          },
        },
        required: [],
      },
      next: {
        description: "Graph API endpoint URL for the next page of results",
        type: "string",
      },
      previous: {
        description: "Graph API endpoint URL for the previous page of results",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessAccount: {
    description: "WhatsApp Business Account details and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Account",
        type: "string",
      },
      name: {
        description: "Human-readable name of the WhatsApp Business Account",
        type: "string",
        minLength: 1,
        maxLength: 255,
      },
      account_review_status: {
        type: "ref",
        ref: "AccountReviewStatus",
      },
      purchase_order_number: {
        description: "Purchase order number associated with the account",
        type: "string",
      },
      audiences: {
        description: "List of audience segments associated with the account",
        type: "array",
        items: {
          type: "string",
        },
      },
      ownership_type: {
        type: "ref",
        ref: "OwnershipType",
      },
      subscribed_apps: {
        description: "List of applications subscribed to this WABA",
        type: "array",
        items: {
          type: "ref",
          ref: "SubscribedApp",
        },
      },
      business_verification_status: {
        type: "ref",
        ref: "BusinessVerificationStatus",
      },
      country: {
        description: "Country code where the WABA is registered",
        type: "string",
        pattern: "^[A-Z]{2}$",
      },
      currency: {
        description: "Currency code for the WABA",
        type: "string",
        pattern: "^[A-Z]{3}$",
      },
      timezone_id: {
        description: "Timezone identifier for the WABA",
        type: "string",
      },
      on_behalf_of_business_info: {
        type: "ref",
        ref: "OnBehalfOfBusinessInfo",
      },
      schedules: {
        description: "Business hours and scheduling information",
        type: "array",
        items: {
          type: "ref",
          ref: "BusinessSchedule",
        },
      },
      is_enabled_for_insights: {
        description: "Whether insights are enabled for this WABA",
        type: "boolean",
      },
      dcc_config: {
        type: "ref",
        ref: "DCCConfig",
      },
      message_templates: {
        description: "Message templates associated with the WABA",
        type: "array",
        items: {
          type: "ref",
          ref: "MessageTemplate",
        },
      },
      phone_numbers: {
        description: "Phone numbers associated with the WABA",
        type: "array",
        items: {
          type: "ref",
          ref: "PhoneNumber",
        },
      },
    },
    required: ["id", "name"],
  },
  AccountReviewStatus: {
    description: "Review status of the WhatsApp Business Account",
    type: "string",
    enum: ["APPROVED", "PENDING", "REJECTED", "RESTRICTED"],
  },
  OwnershipType: {
    description: "Type of ownership for the WhatsApp Business Account",
    type: "string",
    enum: ["SELF_OWNED", "CLIENT_OWNED", "AGENCY_OWNED"],
  },
  BusinessVerificationStatus1: {
    description: "Verification status of the business associated with the WABA",
    type: "string",
    enum: ["VERIFIED", "UNVERIFIED", "PENDING", "REJECTED"],
  },
  SubscribedApp: {
    description: "Application subscribed to the WABA",
    type: "object",
    properties: {
      id: {
        description: "Application ID",
        type: "string",
      },
      name: {
        description: "Application name",
        type: "string",
      },
    },
    required: [],
  },
  OnBehalfOfBusinessInfo: {
    description: "Information about the business on whose behalf the WABA operates",
    type: "object",
    properties: {
      id: {
        description: "Business ID",
        type: "string",
      },
      name: {
        description: "Business name",
        type: "string",
      },
    },
    required: [],
  },
  BusinessSchedule: {
    description: "Business hours schedule information",
    type: "object",
    properties: {
      day_of_week: {
        type: "string",
        enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      },
      open_time: {
        description: "Opening time in HH:MM format",
        type: "string",
        pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
      },
      close_time: {
        description: "Closing time in HH:MM format",
        type: "string",
        pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
      },
    },
    required: [],
  },
  DCCConfig: {
    description: "Data and Content Control configuration",
    type: "object",
    properties: {
      enabled: {
        description: "Whether DCC is enabled",
        type: "boolean",
      },
      policy_url: {
        description: "URL to the DCC policy",
        type: "string",
      },
    },
    required: [],
  },
  MessageTemplate: {
    description: "Message template information",
    type: "object",
    properties: {
      id: {
        description: "Template ID",
        type: "string",
      },
      name: {
        description: "Template name",
        type: "string",
      },
      status: {
        type: "string",
        enum: ["APPROVED", "PENDING", "REJECTED", "DISABLED"],
      },
    },
    required: [],
  },
  PhoneNumber: {
    description: "Phone number associated with the WABA",
    type: "object",
    properties: {
      id: {
        description: "Phone number ID",
        type: "string",
      },
      display_phone_number: {
        description: "Formatted phone number for display",
        type: "string",
      },
      verified_name: {
        description: "Verified business name for the phone number",
        type: "string",
      },
    },
    required: [],
  },
  ClientWhatsAppBusinessAccountsResponse: {
    description: "Response containing list of client WhatsApp Business Accounts",
    type: "object",
    properties: {
      data: {
        description: "Array of client WhatsApp Business Accounts",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccount",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: [],
  },
  CursorPaging3: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  MMLiteOnboardingRequest: {
    description: "MM Lite onboarding request details",
    type: "object",
    properties: {
      request_id: {
        description: "Unique identifier for the MM Lite onboarding request",
        type: "string",
      },
    },
    required: ["request_id"],
  },
  WhatsAppBusinessAccount1: {
    description: "WhatsApp Business Account owned by the business",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Account",
        type: "string",
      },
      name: {
        description: "Human-readable name of the WhatsApp Business Account",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      message_template_namespace: {
        description: "Namespace identifier for message templates associated with this account",
        type: "string",
      },
      timezone_id: {
        description: "Timezone identifier for the WhatsApp Business Account",
        type: "string",
      },
    },
    required: ["id", "name", "message_template_namespace", "timezone_id"],
  },
  WhatsAppBusinessType: {
    description: "Type of WhatsApp Business Account",
    type: "string",
    enum: ["ENTERPRISE", "SMB"],
  },
  WhatsAppBusinessAccountOnboardingFilter: {
    description: "Filter for accounts based on onboarding status",
    type: "string",
    enum: ["ONBOARDED", "NOT_ONBOARDED", "ALL"],
  },
  WhatsAppBusinessAccountsConnection: {
    description: "Paginated collection of owned WhatsApp Business Accounts",
    type: "object",
    properties: {
      data: {
        description: "Array of owned WhatsApp Business Account records",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccount",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: ["data"],
  },
  CursorPaging4: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data that has been returned",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data that has been returned",
            type: "string",
          },
        },
        required: [],
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
    },
    required: [],
  },
  PreVerifiedPhoneNumberShareRequest: {
    description: "Request payload for sharing a pre-verified phone number with another business",
    type: "object",
    properties: {
      preverified_id: {
        description:
          "Unique identifier of the pre-verified phone number to be shared.\nMust be a valid phone number ID that the requesting business owns or has sharing rights to.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
      partner_business_id: {
        description:
          "Business ID of the partner business that will receive access to the pre-verified phone number.\nMust be a valid business entity accessible to the requesting app.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
    },
    required: ["preverified_id", "partner_business_id"],
  },
  PreVerifiedPhoneNumberPermission: {
    description: "Specific permissions that can be granted for shared pre-verified phone numbers",
    type: "string",
    enum: ["MESSAGING", "VIEW_DETAILS", "MANAGE_SETTINGS", "VIEW_ANALYTICS", "MANAGE_WEBHOOKS"],
  },
  PreVerifiedPhoneNumberShareResponse: {
    description: "Response containing details of the successful phone number sharing operation",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the sharing operation was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  SharingStatus: {
    description: "Current status of the phone number sharing relationship",
    type: "string",
    enum: ["ACTIVE", "PENDING", "EXPIRED", "REVOKED"],
  },
  SharedPreVerifiedPhoneNumber: {
    description: "Details of the shared pre-verified phone number",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the pre-verified phone number",
        type: "string",
      },
      display_phone_number: {
        description: "Formatted display version of the phone number",
        type: "string",
      },
      country_prefix: {
        description: "Country code prefix for the phone number",
        type: "integer",
        minimum: 1,
        maximum: 999,
      },
      verification_status: {
        description: "Current verification status of the phone number",
        type: "string",
        enum: ["VERIFIED", "PENDING", "FAILED"],
      },
    },
    required: [],
  },
  BusinessSummary: {
    description: "Summary information about a business entity",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the business",
        type: "string",
      },
      name: {
        description: "Name of the business",
        type: "string",
      },
      verification_status: {
        description: "Business verification status",
        type: "string",
        enum: ["VERIFIED", "UNVERIFIED", "PENDING"],
      },
    },
    required: [],
  },
  BlockedUser: {
    type: "object",
    properties: {
      messaging_product: {
        type: "string",
      },
      wa_id: {
        type: "string",
      },
    },
    required: [],
  },
  PaginationCursors: {
    type: "object",
    properties: {
      after: {
        type: "string",
      },
      before: {
        type: "string",
      },
    },
    required: [],
  },
  Paging: {
    type: "object",
    properties: {
      cursors: {
        type: "ref",
        ref: "PaginationCursors",
      },
    },
    required: [],
  },
  GetBlockedUsersData: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "ref",
          ref: "BlockedUser",
        },
      },
      paging: {
        type: "ref",
        ref: "Paging",
      },
    },
    required: [],
  },
  BlockedUserOperation: {
    type: "object",
    properties: {
      input: {
        type: "string",
      },
      wa_id: {
        type: "string",
      },
    },
    required: [],
  },
  BlockUsersResult: {
    type: "object",
    properties: {
      added_users: {
        type: "array",
        items: {
          type: "ref",
          ref: "BlockedUserOperation",
        },
      },
    },
    required: [],
  },
  UnblockUsersResult: {
    type: "object",
    properties: {
      removed_users: {
        type: "array",
        items: {
          type: "ref",
          ref: "BlockedUserOperation",
        },
      },
    },
    required: [],
  },
  BlockUsersData: {
    type: "object",
    properties: {
      block_users: {
        type: "ref",
        ref: "BlockUsersResult",
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  UnblockUsersData: {
    type: "object",
    properties: {
      block_users: {
        type: "ref",
        ref: "UnblockUsersResult",
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  CallPermissionCheckResponsePayload: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging product",
        type: "string",
      },
      permission: {
        description: "Call permission details",
        type: "object",
        properties: {
          status: {
            description: "Current permission status for calling this user",
            type: "string",
            enum: ["granted", "pending", "denied", "expired"],
          },
          expiration_time: {
            description: "Unix timestamp when the permission expires (if applicable)",
            type: "integer",
            format: "int64",
          },
        },
        required: ["status"],
      },
      actions: {
        description: "Available actions and their restrictions",
        type: "array",
        items: {
          type: "object",
          properties: {
            action_name: {
              description: "Name of the action",
              type: "string",
              enum: ["start_call", "send_call_permission_request"],
            },
            can_perform_action: {
              description: "Whether the business can perform this action",
              type: "boolean",
            },
            limits: {
              description: "Rate limits for this action",
              type: "array",
              items: {
                type: "object",
                properties: {
                  time_period: {
                    description: "Time period for the limit",
                    type: "string",
                  },
                  current_usage: {
                    description: "Current usage count",
                    type: "integer",
                  },
                  max_allowed: {
                    description: "Maximum allowed usage",
                    type: "integer",
                  },
                  limit_expiration_time: {
                    description: "Unix timestamp when the limit resets",
                    type: "integer",
                    format: "int64",
                  },
                },
                required: ["time_period", "current_usage", "max_allowed"],
              },
            },
          },
          required: ["action_name", "can_perform_action"],
        },
      },
    },
    required: ["messaging_product", "permission"],
  },
  CallRequestPayload: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging product",
        type: "string",
      },
      to: {
        description: "The number being called (callee)",
        type: "string",
      },
      action: {
        description: "The action being taken on the given call ID",
        type: "string",
        enum: ["connect", "pre_accept", "accept", "reject", "terminate"],
      },
      session: {
        description: "Contains the session description protocol (SDP) type and description language",
        type: "object",
        properties: {
          sdp_type: {
            description: 'SDP type - "offer" for connect action, "answer" for accept action',
            type: "string",
            enum: ["offer", "answer"],
          },
          sdp: {
            description:
              "The SDP info of the device on the other end of the call. The SDP must be compliant with RFC 8866",
            type: "string",
          },
        },
        required: ["sdp_type", "sdp"],
      },
      biz_opaque_callback_data: {
        description:
          'An arbitrary string you can pass in that is useful for tracking and logging purposes. Any app subscribed to the "calls" webhook field on your WhatsApp Business Account can receive this string, as it is included in the calls object within the subsequent Call Terminate Webhook payload. Cloud API does not process this field. Maximum 512 characters\n',
        type: "string",
        maxLength: 512,
      },
    },
    required: ["messaging_product", "to", "action"],
  },
  CallTerminateRequestPayload: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging product",
        type: "string",
      },
      call_id: {
        description: "The WhatsApp call ID",
        type: "string",
      },
      action: {
        description: "Action to terminate the call",
        type: "string",
        enum: ["terminate"],
      },
    },
    required: ["messaging_product", "call_id", "action"],
  },
  CallResponsePayload: {
    type: "object",
    properties: {
      messaging_product: {
        type: "string",
      },
      calls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  CallTerminateResponsePayload: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  ErrorObject: {
    type: "object",
    properties: {
      message: {
        description: "Human-readable description of the error",
        type: "string",
      },
      type: {
        description: "Error type classification",
        type: "string",
      },
      code: {
        description: "Numeric error code",
        type: "integer",
      },
    },
    required: ["message", "type", "code"],
  },
  ErrorResponse: {
    type: "object",
    properties: {
      error: {
        type: "ref",
        ref: "ErrorObject",
      },
    },
    required: ["error"],
  },
  ErrorObject1: {
    type: "ref",
    ref: "ErrorObject",
  },
  ErrorResponse1: {
    type: "ref",
    ref: "ErrorResponse",
  },
  PagingInfo: {
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Before cursor",
            type: "string",
          },
          after: {
            description: "After cursor",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "Previous page URL",
        type: "string",
      },
      next: {
        description: "Next page URL",
        type: "string",
      },
    },
    required: [],
  },
  TemplateObject: {
    type: "object",
    properties: {
      name: {
        description: "Name of the template.",
        type: "string",
      },
      language: {
        description: "Contains a `language` object. Specifies the language the template may be rendered in",
        type: "ref",
        ref: "LanguageObject",
      },
      components: {
        description: "Array of `components` objects containing the parameters of the message.",
        type: "array",
        items: {
          type: "ref",
          ref: "TemplateComponent",
        },
      },
    },
    required: ["name", "language"],
  },
  LanguageObject: {
    type: "object",
    properties: {
      policy: {
        description: "The language policy the message should follow.",
        type: "string",
        enum: ["deterministic"],
      },
      code: {
        description: 'The code of the language or locale to use (e.g., `"en"`, `"en_US"`).',
        type: "string",
      },
    },
    required: ["policy", "code"],
  },
  TemplateComponent: {
    type: "object",
    properties: {
      type: {
        description: "Describes the component type.",
        type: "string",
        enum: ["header", "body", "button"],
      },
      sub_type: {
        description: "Required when `type=button`. Not used for other types. Type of button to create.",
        type: "string",
        enum: ["quick_reply", "url", "catalog"],
      },
      parameters: {
        description: "Array of parameter objects with the content of the message.",
        type: "array",
        items: {
          type: "unknown",
        },
      },
      index: {
        description: "Required when `type=button`. Not used for other types. Position index of the button (0-9).",
        type: "string",
        pattern: "^[2-6, 11-14]$",
      },
    },
    required: ["type"],
  },
  HeaderComponent: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "TemplateComponent",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["header"],
          },
          parameters: {
            description:
              "Parameters for the header component, which can be `image`, `video`, `document`, or `text`. [15, 16]",
            type: "array",
            items: {
              type: "ref",
              ref: "ParameterObject",
            },
            minItems: 1,
          },
        },
        required: [],
      },
    ],
  },
  BodyComponent: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "TemplateComponent",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["body"],
          },
          parameters: {
            description: "Parameters for the body component, which can be `text`, `currency`, or `date_time`. [17]",
            type: "array",
            items: {
              type: "ref",
              ref: "ParameterObject",
            },
          },
        },
        required: [],
      },
    ],
  },
  ButtonComponent: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "TemplateComponent",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["button"],
          },
          sub_type: {
            type: "string",
            enum: ["quick_reply", "url", "catalog"],
          },
          index: {
            type: "string",
            pattern: "^[2-6, 11-14]$",
          },
          parameters: {
            description:
              "Parameters for the button component, which are `payload` for quick reply or `text` for URL buttons.",
            type: "array",
            items: {
              type: "ref",
              ref: "ButtonParameterObject",
            },
            minItems: 1,
          },
        },
        required: ["sub_type", "index", "parameters"],
      },
    ],
  },
  ParameterObject: {
    type: "object",
    properties: {
      type: {
        description:
          'Describes the parameter type. For text-based templates, only `"currency"`, `"date_time"`, and `"text"` are supported.',
        type: "string",
        enum: ["currency", "date_time", "document", "image", "text", "video"],
      },
    },
    required: ["type"],
  },
  TextParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text"],
          },
          text: {
            description: "The message's text.",
            type: "string",
            maxLength: 32768,
          },
        },
        required: ["text"],
      },
    ],
  },
  CurrencyParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["currency"],
          },
          currency: {
            type: "ref",
            ref: "CurrencyObject",
          },
        },
        required: ["currency"],
      },
    ],
  },
  DateTimeParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["date_time"],
          },
          date_time: {
            type: "ref",
            ref: "DateTimeObject",
          },
        },
        required: ["date_time"],
      },
    ],
  },
  DocumentParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["document"],
          },
          document: {
            description: "Only PDF documents are supported for media-based message templates. Captions not supported.",
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["document"],
      },
    ],
  },
  ImageParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["image"],
          },
          image: {
            description: "A media object of type image. Captions not supported. [15]",
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["image"],
      },
    ],
  },
  VideoParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["video"],
          },
          video: {
            description: "A media object of type video. Captions not supported. [16]",
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["video"],
      },
    ],
  },
  CurrencyObject: {
    type: "object",
    properties: {
      fallback_value: {
        description: "Default text if localization fails.",
        type: "string",
      },
      code: {
        description: "Currency code as defined in ISO 4217.",
        type: "string",
      },
      amount_1000: {
        description: "Amount multiplied by 1000 (e.g., 100000 for $100.00).",
        type: "integer",
        format: "int32",
      },
    },
    required: ["fallback_value", "code", "amount_1000"],
  },
  DateTimeObject: {
    type: "object",
    properties: {
      fallback_value: {
        description: "Default text. For Cloud API, this fallback value is always used.",
        type: "string",
      },
    },
    required: ["fallback_value"],
  },
  MediaObject: {
    description: "A media object. Either `id` or `link` is required.",
    type: "union",
    of: [
      {
        type: "object",
        properties: {
          id: {
            description: "The media object ID. **Required when `link` is not used.**",
            type: "string",
          },
        },
        required: ["id"],
      },
      {
        type: "object",
        properties: {
          link: {
            description: "The protocol and URL of the media to be sent (HTTP/HTTPS only).",
            type: "string",
          },
        },
        required: ["link"],
      },
    ],
  },
  ButtonParameterObject: {
    type: "object",
    properties: {
      type: {
        description: "Indicates the type of parameter for the button.",
        type: "string",
        enum: ["payload", "text"],
      },
    },
    required: ["type"],
  },
  ButtonPayloadParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ButtonParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["payload"],
          },
          payload: {
            description: "Developer-defined payload that is returned when the quick reply button is clicked.",
            type: "string",
          },
        },
        required: ["payload"],
      },
    ],
  },
  ButtonTextParameter: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "ButtonParameterObject",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text"],
          },
          text: {
            description: "Developer-provided suffix that is appended to the predefined prefix URL in the template.",
            type: "string",
          },
        },
        required: ["text"],
      },
    ],
  },
  MarketingMessageRequestPayload: {
    type: "object",
    properties: {
      messaging_product: {
        description: 'Messaging service used. Must be "whatsapp"',
        type: "string",
        enum: ["whatsapp"],
      },
      recipient_type: {
        description: 'Type of recipient. Must be "individual"',
        type: "string",
        enum: ["individual"],
      },
      to: {
        description: "WhatsApp ID or phone number of the message recipient",
        type: "string",
      },
      type: {
        description: 'Type of message. Must be "template" for marketing messages',
        type: "string",
        enum: ["template"],
      },
      template: {
        type: "ref",
        ref: "TemplateObject",
      },
      product_policy: {
        description: "Optional product policy setting",
        type: "string",
        enum: ["CLOUD_API_FALLBACK", "STRICT"],
      },
      message_activity_sharing: {
        description: "Optional flag to control message activity sharing",
        type: "boolean",
      },
    },
    required: ["messaging_product", "recipient_type", "to", "type", "template"],
  },
  MessageStatus: {
    description:
      "The status of a WhatsApp message:\n- `accepted`: The message has been accepted by WhatsApp and is being processed\n- `held_for_quality_assessment`: The message is being held for quality assessment before delivery\n- `paused`: The message delivery has been paused\n",
    type: "string",
    enum: ["accepted", "held_for_quality_assessment", "paused"],
  },
  MarketingMessageResponsePayload: {
    type: "object",
    properties: {
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            input: {
              type: "string",
            },
            wa_id: {
              type: "string",
            },
          },
          required: [],
        },
      },
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            message_status: {
              type: "ref",
              ref: "MessageStatus",
            },
          },
          required: [],
        },
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  BaseMessageProperties: {
    description: "Common properties shared by all message types",
    type: "object",
    properties: {
      messaging_product: {
        type: "string",
      },
      recipient_type: {
        description: "The type of recipient.",
        type: "string",
        enum: ["individual", "group"],
      },
      to: {
        description: "The recipient's phone number for individual messages, and group-id for group message.",
        type: "string",
      },
      type: {
        description: "The type of message",
        type: "string",
      },
      context: {
        type: "ref",
        ref: "MessageContext",
      },
    },
    required: ["messaging_product", "recipient_type", "to", "type"],
  },
  MessageContext: {
    description: "Context information for replying to a message",
    type: "object",
    properties: {
      message_id: {
        description: "The ID of the message to which this message is a reply.",
        type: "string",
      },
    },
    required: [],
  },
  MediaObject1: {
    description: "A media object. Either `id` or `link` is required.",
    type: "union",
    of: [
      {
        type: "object",
        properties: {
          id: {
            description: "The media object ID. **Required when `link` is not used.**",
            type: "string",
          },
          caption: {
            description: "Optional caption for the media",
            type: "string",
            maxLength: 1024,
          },
        },
        required: ["id"],
      },
      {
        type: "object",
        properties: {
          link: {
            description: "The protocol and URL of the media to be sent (HTTP/HTTPS only).",
            type: "string",
          },
          caption: {
            description: "Optional caption for the media",
            type: "string",
            maxLength: 1024,
          },
        },
        required: ["link"],
      },
    ],
  },
  Message: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "TextMessage",
      },
      {
        type: "ref",
        ref: "AudioMessage",
      },
      {
        type: "ref",
        ref: "DocumentMessage",
      },
      {
        type: "ref",
        ref: "ImageMessage",
      },
      {
        type: "ref",
        ref: "LocationMessage",
      },
      {
        type: "ref",
        ref: "VideoMessage",
      },
      {
        type: "ref",
        ref: "StickerMessage",
      },
      {
        type: "ref",
        ref: "ReactionMessage",
      },
      {
        type: "ref",
        ref: "InteractiveMessage",
      },
      {
        type: "ref",
        ref: "TemplateMessage",
      },
      {
        type: "ref",
        ref: "ContactsMessage",
      },
    ],
  },
  TextMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text"],
          },
          text: {
            type: "object",
            properties: {
              body: {
                description: "The text of the message.",
                type: "string",
              },
              preview_url: {
                type: "boolean",
              },
            },
            required: [],
          },
        },
        required: ["text"],
      },
    ],
  },
  AudioMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["audio"],
          },
          audio: {
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["audio"],
      },
    ],
  },
  VideoMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["video"],
          },
          video: {
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["video"],
      },
    ],
  },
  DocumentMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["document"],
          },
          document: {
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["document"],
      },
    ],
  },
  ImageMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["image"],
          },
          image: {
            type: "ref",
            ref: "MediaObject",
          },
        },
        required: ["image"],
      },
    ],
  },
  LocationMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["location"],
          },
          location: {
            type: "object",
            properties: {
              address: {
                description: "The address of the location.",
                type: "string",
              },
              latitude: {
                description: "The latitude of the location.",
                type: "string",
              },
              longitude: {
                description: "The longitude of the location.",
                type: "string",
              },
              name: {
                description: "The name of the location.",
                type: "string",
              },
            },
            required: [],
          },
        },
        required: ["location"],
      },
    ],
  },
  StickerMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["sticker"],
          },
          sticker: {
            type: "union",
            of: [
              {
                type: "object",
                properties: {
                  id: {
                    description: "The ID of the sticker.",
                    type: "string",
                  },
                },
                required: ["id"],
              },
              {
                type: "object",
                properties: {
                  link: {
                    description: "The URL of the sticker.",
                    type: "string",
                  },
                },
                required: ["link"],
              },
            ],
          },
        },
        required: ["sticker"],
      },
    ],
  },
  ReactionMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["reaction"],
          },
          reaction: {
            type: "object",
            properties: {
              emoji: {
                description: "emoji",
                type: "string",
              },
              message_id: {
                description: "reacted message-id",
                type: "string",
              },
            },
            required: [],
          },
        },
        required: ["reaction"],
      },
    ],
  },
  InteractiveMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["interactive"],
          },
          interactive: {
            type: "ref",
            ref: "InteractiveObject",
          },
        },
        required: ["interactive"],
      },
    ],
  },
  InteractiveObject: {
    description: "An object containing the content for an interactive message.",
    type: "object",
    properties: {
      type: {
        description: "The type of interactive message to send.",
        type: "string",
        enum: ["button", "call_permission_request", "catalog_message", "list", "product", "product_list", "flow"],
      },
      header: {
        type: "ref",
        ref: "HeaderObject",
      },
      body: {
        type: "ref",
        ref: "BodyObject",
      },
      footer: {
        type: "ref",
        ref: "FooterObject",
      },
      action: {
        type: "ref",
        ref: "ActionObject",
      },
    },
    required: ["type", "action"],
  },
  HeaderObject: {
    description:
      "Header content displayed on top of a message. Required for 'product_list' type. Cannot be set for 'product' type.",
    type: "object",
    properties: {
      type: {
        description: "The header type.",
        type: "string",
        enum: ["text", "video", "image", "document"],
      },
      text: {
        description: "Text for the header. Required if 'type' is 'text'. Emojis supported, no markdown.",
        type: "string",
        maxLength: 60,
      },
      sub_text: {
        description: "Optional sub-text for the header. Emojis supported, no markdown.",
        type: "string",
        maxLength: 60,
      },
      document: {
        description: "Contains the media object for this document. Required if 'type' is 'document'.",
        type: "ref",
        ref: "MediaObject",
      },
      image: {
        description: "Contains the media object for this image. Required if 'type' is 'image'.",
        type: "ref",
        ref: "MediaObject",
      },
      video: {
        description: "Contains the media object for this video. Required if 'type' is 'video'.",
        type: "ref",
        ref: "MediaObject",
      },
    },
    required: ["type"],
  },
  BodyObject: {
    description:
      "An object with the body of the message. Optional for 'product' type, required for other interactive message types.",
    type: "object",
    properties: {
      text: {
        description: "The content of the message body. Emojis and markdown are supported.",
        type: "string",
        maxLength: 1024,
      },
    },
    required: ["text"],
  },
  FooterObject: {
    description: "An object with the footer of the message. Optional.",
    type: "object",
    properties: {
      text: {
        description: "The footer content. Emojis, markdown, and links are supported.",
        type: "string",
        maxLength: 60,
      },
    },
    required: ["text"],
  },
  ActionObject: {
    description:
      "Action you want the user to perform after reading the message. Its structure varies by interactive message type.",
    type: "union",
    of: [
      {
        type: "object",
        properties: {
          button: {
            description:
              "Button content for List Messages. Cannot be empty, must be unique. Emojis supported, no markdown.",
            type: "string",
            maxLength: 20,
          },
          sections: {
            description: "Array of section objects.",
            type: "array",
            items: {
              type: "ref",
              ref: "SectionObject",
            },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ["button", "sections"],
      },
      {
        type: "object",
        properties: {
          buttons: {
            description: "Array of button objects.",
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  description: 'Only supported type is "reply" for Reply Button.',
                  type: "string",
                  enum: ["reply"],
                },
                reply: {
                  type: "object",
                  properties: {
                    id: {
                      description: "Unique identifier for your button. No leading/trailing spaces.",
                      type: "string",
                      maxLength: 256,
                    },
                    title: {
                      description: "Button title. Cannot be empty, must be unique. Emojis supported, no markdown.",
                      type: "string",
                      maxLength: 20,
                    },
                  },
                  required: ["id", "title"],
                },
              },
              required: ["type", "reply"],
            },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ["buttons"],
      },
      {
        type: "object",
        properties: {
          catalog_id: {
            description: "Unique identifier of the Facebook catalog linked to your WhatsApp Business Account.",
            type: "string",
          },
          product_retailer_id: {
            description: "Unique identifier of the product in a catalog. Required for Single Product Messages.",
            type: "string",
          },
          sections: {
            description: "Array of section objects.",
            type: "array",
            items: {
              type: "ref",
              ref: "SectionObject",
            },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ["catalog_id"],
      },
      {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["catalog_message"],
          },
          parameters: {
            type: "object",
            properties: {
              thumbnail_product_retailer_id: {
                description: "Product retailer ID for the thumbnail.",
                type: "string",
              },
            },
            required: ["thumbnail_product_retailer_id"],
          },
        },
        required: ["name", "parameters"],
      },
      {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["flow"],
          },
          parameters: {
            type: "union",
            of: [
              {
                type: "object",
                properties: {},
                required: ["flow_id"],
              },
              {
                type: "object",
                properties: {},
                required: ["flow_name"],
              },
            ],
          },
        },
        required: ["name", "parameters"],
      },
      {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["call_permission_request"],
          },
        },
        required: ["name"],
      },
    ],
  },
  SectionObject: {
    description: "A section object, used in List Messages and Multi-Product Messages.",
    type: "object",
    properties: {
      title: {
        description: "Title of the section. Required if the message has more than one section. Max 24 characters.",
        type: "string",
        maxLength: 24,
      },
      product_items: {
        description: "Array of product objects.",
        type: "array",
        items: {
          type: "object",
          properties: {
            product_retailer_id: {
              description: "Unique identifier of the product in a catalog.",
              type: "string",
            },
          },
          required: ["product_retailer_id"],
        },
        minItems: 1,
        maxItems: 30,
      },
      rows: {
        description: "Contains a list of rows.",
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              description: "Unique row identifier.",
              type: "string",
              maxLength: 200,
            },
            title: {
              description: "Row title.",
              type: "string",
              maxLength: 24,
            },
            description: {
              description: "Optional row description.",
              type: "string",
              maxLength: 72,
            },
          },
          required: ["id", "title"],
        },
        maxItems: 10,
      },
    },
    required: [],
  },
  TemplateMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["template"],
          },
          template: {
            type: "ref",
            ref: "TemplateObject",
          },
        },
        required: ["template"],
      },
    ],
  },
  ContactsMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["contacts"],
          },
          contacts: {
            type: "array",
            items: {
              type: "ref",
              ref: "ContactObject",
            },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ["contacts"],
      },
    ],
  },
  ContactObject: {
    type: "object",
    properties: {
      addresses: {
        description: "Full contact address(es)",
        type: "array",
        items: {
          type: "ref",
          ref: "AddressObject",
        },
      },
      birthday: {
        description: "Date of birth (YYYY-MM-DD format)",
        type: "string",
      },
      emails: {
        description: "Contact email address(es)",
        type: "array",
        items: {
          type: "ref",
          ref: "EmailObject",
        },
      },
      name: {
        description: "Contact name object",
        type: "ref",
        ref: "NameObject",
      },
      org: {
        description: "Contact organization information",
        type: "ref",
        ref: "OrganizationObject",
      },
      phones: {
        description: "Contact phone number(s)",
        type: "array",
        items: {
          type: "ref",
          ref: "PhoneObject",
        },
      },
      urls: {
        description: "Contact URL(s)",
        type: "array",
        items: {
          type: "ref",
          ref: "UrlObject",
        },
      },
    },
    required: [],
  },
  AddressObject: {
    type: "object",
    properties: {
      city: {
        description: "City name",
        type: "string",
      },
      country: {
        description: "Full country name",
        type: "string",
      },
      country_code: {
        description: "Two-letter ISO country code",
        type: "string",
      },
      state: {
        description: "State abbreviation",
        type: "string",
      },
      street: {
        description: "Street address",
        type: "string",
      },
      type: {
        description: "Address type",
        type: "string",
        enum: ["HOME", "WORK"],
      },
      zip: {
        description: "ZIP code",
        type: "string",
      },
    },
    required: [],
  },
  EmailObject: {
    type: "object",
    properties: {
      email: {
        description: "Email address",
        type: "string",
      },
      type: {
        description: "Email type",
        type: "string",
        enum: ["HOME", "WORK"],
      },
    },
    required: ["email"],
  },
  NameObject: {
    type: "object",
    properties: {
      first_name: {
        description: "First name",
        type: "string",
      },
      formatted_name: {
        description: "Formatted full name",
        type: "string",
      },
      last_name: {
        description: "Last name",
        type: "string",
      },
      middle_name: {
        description: "Middle name",
        type: "string",
      },
      prefix: {
        description: "Name prefix",
        type: "string",
      },
      suffix: {
        description: "Name suffix",
        type: "string",
      },
    },
    required: [],
  },
  OrganizationObject: {
    type: "object",
    properties: {
      company: {
        description: "Company name",
        type: "string",
      },
      department: {
        description: "Department name",
        type: "string",
      },
      title: {
        description: "Job title",
        type: "string",
      },
    },
    required: [],
  },
  PhoneObject: {
    type: "object",
    properties: {
      phone: {
        description: "Phone number",
        type: "string",
      },
      type: {
        description: "Phone type",
        type: "string",
        enum: ["HOME", "WORK"],
      },
      wa_id: {
        description: "WhatsApp ID",
        type: "string",
      },
    },
    required: ["phone"],
  },
  UrlObject: {
    type: "object",
    properties: {
      type: {
        description: "URL type",
        type: "string",
        enum: ["HOME", "WORK"],
      },
      url: {
        description: "URL",
        type: "string",
      },
    },
    required: ["url"],
  },
  MessageResponsePayload: {
    type: "object",
    properties: {
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            input: {
              type: "string",
            },
            wa_id: {
              type: "string",
            },
          },
          required: [],
        },
      },
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            message_status: {
              type: "ref",
              ref: "MessageStatus",
            },
          },
          required: [],
        },
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  MarkMessageRequestPayload: {
    type: "object",
    properties: {
      message_id: {
        type: "string",
      },
      messaging_product: {
        type: "string",
      },
      status: {
        type: "string",
      },
    },
    required: ["message_id", "messaging_product", "status"],
  },
  MarkMessageResponsePayload: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  QrCodeDetails: {
    description: "Complete details of a message QR code",
    type: "object",
    properties: {
      code: {
        description: "Unique 14-character QR code identifier",
        type: "string",
        pattern: "^[A-Z2-7]{14}$",
      },
      prefilled_message: {
        description: "Pre-filled message text that appears in customer chat",
        type: "string",
      },
      deep_link_url: {
        description: "WhatsApp deep link URL for direct conversation initiation",
        type: "string",
      },
      creation_time: {
        description: "Unix timestamp when QR code was created (first-party apps only)",
        type: "integer",
      },
      qr_image_url: {
        description: "QR code image download URL (when format specified in fields)",
        type: "string",
      },
    },
    required: ["code", "prefilled_message", "deep_link_url"],
  },
  QrCodeList: {
    description: "List of message QR codes with pagination information",
    type: "object",
    properties: {
      data: {
        description: "Array of QR code objects",
        type: "array",
        items: {
          type: "ref",
          ref: "QrCodeDetails",
        },
      },
      paging: {
        description:
          "Pagination information for navigating through large result sets.\nContains cursors for accessing previous and next pages of results.\n",
        type: "object",
        properties: {
          cursors: {
            type: "object",
            properties: {
              before: {
                description: "Cursor for accessing the previous page of results",
                type: "string",
              },
              after: {
                description: "Cursor for accessing the next page of results",
                type: "string",
              },
            },
            required: [],
          },
          previous: {
            description: "URL for the previous page of results",
            type: "string",
          },
          next: {
            description: "URL for the next page of results",
            type: "string",
          },
        },
        required: [],
      },
    },
    required: ["data"],
  },
  CreateQrCodeRequest: {
    description: "Request payload for creating a new message QR code",
    type: "object",
    properties: {
      prefilled_message: {
        description: "Pre-filled message text (max 140 characters) that appears in customer chat",
        type: "string",
        maxLength: 140,
      },
      generate_qr_image: {
        description: "QR image format. When specified, response includes qr_image_url",
        type: "string",
        enum: ["PNG", "SVG"],
      },
    },
    required: ["prefilled_message"],
  },
  UpdateQrCodeRequest: {
    description: "Request payload for updating an existing message QR code",
    type: "object",
    properties: {
      code: {
        description: "14-character QR code identifier to update",
        type: "string",
        minLength: 14,
        maxLength: 14,
        pattern: "^[A-Z2-7]{14}$",
      },
      prefilled_message: {
        description: "New pre-filled message text (max 140 characters)",
        type: "string",
        maxLength: 140,
      },
    },
    required: ["code", "prefilled_message"],
  },
  QrCodeResponse: {
    description: "Response containing QR code details after creation or update",
    type: "object",
    properties: {
      code: {
        description:
          "Unique 14-character identifier for the QR code. This code is used\nfor future updates or deletions.\n",
        type: "string",
        pattern: "^[A-Z2-7]{14}$",
      },
      prefilled_message: {
        description:
          "The pre-filled message text associated with this QR code.\nThis text appears when customers use the QR code.\n",
        type: "string",
      },
      deep_link_url: {
        description:
          "WhatsApp deep link URL that can be used directly without QR code scanning.\nCustomers can click this link to start a conversation with the pre-filled message.\n",
        type: "string",
      },
      qr_image_url: {
        description:
          "URL to download the QR code image. Only present if generate_qr_image\nparameter was specified in the request. Image format matches the requested format.\n",
        type: "string",
      },
    },
    required: ["code", "prefilled_message", "deep_link_url"],
  },
  GraphAPIError2: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  QrCodeResponse1: {
    description: "Individual QR code response containing a single QR code in data array format",
    type: "object",
    properties: {
      data: {
        description: "Array containing the single QR code object (maintains consistency with collection endpoint)",
        type: "array",
        items: {
          type: "ref",
          ref: "QrCodeDetails",
        },
        minItems: 1,
        maxItems: 1,
      },
    },
    required: ["data"],
  },
  DeleteQrCodeResponse: {
    description: "Response confirming successful QR code deletion",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the QR code was successfully deleted",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError3: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  EncryptedMessageRequest: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging service used for the request. Use whatsapp.",
        type: "string",
        enum: ["whatsapp"],
      },
      encrypted_contents: {
        description:
          "JWE payload with encrypted messages structure. This should be a valid JWE token containing the encrypted message payload.",
        type: "string",
      },
    },
    required: ["messaging_product", "encrypted_contents"],
  },
  EncryptedMessageResponse: {
    type: "object",
    properties: {
      encrypted_contents: {
        description:
          "JWE payload with encrypted messages response structure. Contains the encrypted response from the WhatsApp Business API.",
        type: "string",
      },
    },
    required: ["encrypted_contents"],
  },
  ErrorResponse2: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Error message describing what went wrong",
            type: "string",
          },
          type: {
            description: "Error type",
            type: "string",
          },
          code: {
            description: "Error code",
            type: "integer",
          },
          error_subcode: {
            description: "Error subcode for more specific error identification",
            type: "integer",
          },
        },
        required: [],
      },
    },
    required: [],
  },
  OfficialBusinessAccountStatus: {
    description: "Official Business Account status information for a WhatsApp Business Account phone number",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Account phone number",
        type: "string",
      },
      oba_status: {
        type: "ref",
        ref: "WhatsAppBusinessAppealStatus",
      },
      status_message: {
        description: "Human-readable message describing the current Official Business Account status",
        type: "string",
      },
    },
    required: ["id", "oba_status", "status_message"],
  },
  OfficialBusinessAccountUpdateRequest: {
    description: "Request payload for updating Official Business Account status",
    type: "object",
    properties: {
      business_website_url: {
        description: "Official business website URL",
        type: "string",
      },
      primary_country_of_operation: {
        description: "Primary country where the business operates",
        type: "string",
      },
      primary_language: {
        description: "Primary language used by the business",
        type: "string",
      },
      parent_business_or_brand: {
        description: "Parent business or brand name",
        type: "string",
        maxLength: 255,
      },
      supporting_links: {
        description: "Supporting links that demonstrate business notability (minimum 5, maximum 10)",
        type: "array",
        items: {
          type: "string",
        },
        minItems: 5,
        maxItems: 10,
      },
      additional_supporting_information: {
        description: "Additional information to support the Official Business Account application",
        type: "string",
        maxLength: 1000,
      },
    },
    required: ["business_website_url", "primary_country_of_operation"],
  },
  OfficialBusinessAccountUpdateResponse: {
    description: "Response for Official Business Account status update operation",
    type: "object",
    properties: {
      success: {
        description: "Indicates if the operation was successful",
        type: "boolean",
      },
      message: {
        description: "Human-readable message describing the result of the operation",
        type: "string",
      },
      updated_status: {
        type: "ref",
        ref: "OfficialBusinessAccountStatus",
      },
      tracking_id: {
        description: "Unique identifier for tracking the application/update request",
        type: "string",
      },
    },
    required: ["success", "message"],
  },
  WhatsAppBusinessAppealStatus: {
    description: "Official Business Account appeal and verification status",
    type: "string",
    enum: ["PENDING", "APPROVED", "REJECTED", "UNDER_REVIEW", "EXPIRED", "CANCELLED"],
  },
  PhoneNumberInfo: {
    description: "Phone number information and status",
    type: "object",
    properties: {
      id: {
        description: "The ID associated with the phone number",
        type: "string",
      },
      display_phone_number: {
        description: "The string representation of the phone number",
        type: "string",
      },
      verified_name: {
        description: "The verified name associated with the phone number",
        type: "string",
      },
      quality_rating: {
        description:
          "The quality rating of the phone number based on how messages have been received by recipients in recent days.\n- GREEN: High Quality\n- YELLOW: Medium Quality\n- RED: Low Quality\n- NA: Quality has not been determined\n",
        type: "string",
        enum: ["GREEN", "YELLOW", "RED", "NA"],
      },
      code_verification_status: {
        description:
          "The two-step verification status for the phone number indicating whether the number has completed two-step verification.\n- VERIFIED: Phone number has completed two-step verification\n- UNVERIFIED: Two-step verification is pending or incomplete\n",
        type: "string",
        enum: ["VERIFIED", "UNVERIFIED"],
      },
      name_status: {
        description:
          "The status of a display name associated with a specific phone number.\n- APPROVED: The display name has been approved and is ready to use.\n- AVAILABLE_WITHOUT_REVIEW: The display name is ready to use without review.\n- DECLINED: The display name has not been approved.\n- EXPIRED: The display name approval has expired.\n- PENDING_REVIEW: The display name is under review.\n- NONE: No display name verification request exists.\n",
        type: "string",
        enum: ["APPROVED", "AVAILABLE_WITHOUT_REVIEW", "DECLINED", "EXPIRED", "PENDING_REVIEW", "NONE"],
      },
    },
    required: [],
  },
  MessageRequest: {
    description: "Request to send a message via WhatsApp Business API",
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging service used for the request",
        type: "string",
        enum: ["whatsapp"],
      },
      recipient_type: {
        description: "Type of recipient",
        default: "individual",
        type: "string",
        enum: ["individual", "group"],
      },
      to: {
        description: "Recipient's phone number (with country code) or group ID",
        type: "string",
      },
      type: {
        description: "Type of message being sent",
        type: "string",
        enum: [
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
        ],
      },
      text: {
        type: "ref",
        ref: "TextMessage",
      },
      context: {
        type: "ref",
        ref: "MessageContext",
      },
    },
    required: ["messaging_product", "to", "type"],
  },
  TextMessage1: {
    type: "object",
    properties: {
      body: {
        description: "Text content of the message",
        type: "string",
        maxLength: 4096,
      },
      preview_url: {
        description: "Whether to show URL preview",
        default: false,
        type: "boolean",
      },
    },
    required: ["body"],
  },
  MessageContext1: {
    type: "object",
    properties: {
      message_id: {
        description: "ID of message being replied to",
        type: "string",
      },
    },
    required: [],
  },
  SettingsRequest: {
    description: "Request to update phone number settings",
    type: "object",
    properties: {
      calling: {
        type: "ref",
        ref: "CallingSettings",
      },
    },
    required: [],
  },
  CallingSettings: {
    type: "object",
    properties: {
      status: {
        description: "Enable or disable calling feature",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      call_icon_visibility: {
        description: "Control visibility of the call icon",
        type: "string",
        enum: ["visible", "hidden"],
      },
    },
    required: ["status"],
  },
  RegisterRequest: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging service used for the request",
        type: "string",
        enum: ["whatsapp"],
      },
      pin: {
        description: "6-digit PIN for two-step verification",
        type: "string",
        pattern: "^[0-9]{6}$",
      },
    },
    required: ["messaging_product", "pin"],
  },
  VerifyCodeRequest: {
    type: "object",
    properties: {
      code: {
        description: "6-digit verification code received via SMS or voice",
        type: "string",
        pattern: "^[0-9]{6}$",
      },
    },
    required: ["code"],
  },
  TwoStepVerificationRequest: {
    type: "object",
    properties: {
      pin: {
        description: "6-digit PIN for two-step verification",
        type: "string",
        pattern: "^[0-9]{6}$",
      },
    },
    required: ["pin"],
  },
  PhoneNumberStatusUpdateRequest: {
    description: "Request to update phone number status and configuration",
    type: "object",
    properties: {
      connection_status: {
        type: "ref",
        ref: "WhatsAppBusinessAccountToNumberStatus",
      },
      webhook_url: {
        description: "Webhook URL for receiving message notifications",
        type: "string",
      },
      whatsapp_business_api_data: {
        type: "ref",
        ref: "WhatsAppBusinessApiData",
      },
      pin: {
        description: "Two-step verification PIN (can be empty string)",
        type: "string",
      },
      search_visibility: {
        type: "ref",
        ref: "WAAPIBusinessGlobalSearchStateStatus",
      },
      webhook_configuration: {
        type: "ref",
        ref: "WebhookConfiguration",
      },
      new_display_name: {
        description: "New display name for name verification request",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
      username: {
        description: "Username for the WhatsApp Business Account",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessApiData: {
    description: "WhatsApp Business API configuration data",
    type: "object",
    properties: {
      pin: {
        description: "Two-step verification PIN (can be empty string)",
        type: "string",
      },
      show_security_notifications: {
        description: "Whether to show security notifications",
        type: "boolean",
      },
      notify_user_change_number: {
        description: "Whether to notify users when changing number",
        type: "boolean",
      },
    },
    required: [],
  },
  WebhookConfiguration: {
    description: "Webhook configuration settings",
    type: "object",
    properties: {
      override_callback_uri: {
        description: "Override callback URI for webhook notifications (can be empty string)",
        type: "string",
      },
      verify_token: {
        description: "Token used to verify webhook requests",
        type: "string",
      },
    },
    required: ["override_callback_uri"],
  },
  WhatsAppBusinessAccountToNumberStatus: {
    description: "Connection status between WhatsApp Business Account and phone number",
    type: "string",
    enum: [
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
    ],
  },
  WAAPIBusinessGlobalSearchStateStatus: {
    description: "Search visibility status for the WhatsApp Business Account",
    type: "string",
    enum: ["VISIBLE", "HIDDEN"],
  },
  MessageResponse: {
    description: "Response from sending a message",
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging service",
        type: "string",
        enum: ["whatsapp"],
      },
      contacts: {
        description: "Contact information",
        type: "array",
        items: {
          type: "ref",
          ref: "ContactResponse",
        },
      },
      messages: {
        description: "Message information",
        type: "array",
        items: {
          type: "ref",
          ref: "MessageResponseItem",
        },
      },
    },
    required: ["messaging_product", "contacts", "messages"],
  },
  ContactResponse: {
    type: "object",
    properties: {
      input: {
        description: "Input phone number",
        type: "string",
      },
      wa_id: {
        description: "WhatsApp ID",
        type: "string",
      },
    },
    required: ["input"],
  },
  MessageResponseItem: {
    type: "object",
    properties: {
      id: {
        description: "Message ID",
        type: "string",
      },
    },
    required: ["id"],
  },
  SuccessResponse: {
    description: "Generic success response",
    type: "object",
    properties: {
      success: {
        description: "Operation success status",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError4: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  DeregisterResponse: {
    description: "Response indicating successful phone number deregistration",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the deregistration was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError5: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppMessageHistory: {
    description: "WhatsApp message history entry with delivery status information",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the message history entry",
        type: "string",
      },
      message_id: {
        description: "WhatsApp message ID (WAMID) for the message",
        type: "string",
      },
      events: {
        description: "Message delivery status events and occurrences",
        type: "object",
        properties: {
          data: {
            description: "Array of delivery status events",
            type: "array",
            items: {
              type: "ref",
              ref: "MessageDeliveryStatusEvent",
            },
          },
          paging: {
            type: "ref",
            ref: "PaginationInfo",
          },
        },
        required: [],
      },
    },
    required: ["id", "message_id"],
  },
  MessageDeliveryStatusEvent: {
    description: "Message delivery status event occurrence",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the delivery status event",
        type: "string",
      },
      delivery_status: {
        type: "ref",
        ref: "WhatsAppMessageDeliveryStatus",
      },
      webhook_update_state: {
        type: "ref",
        ref: "WebhookUpdateState",
      },
      timestamp: {
        description: "Unix timestamp when the delivery status event occurred",
        type: "integer",
        format: "int64",
      },
      application: {
        description: "Application information for the event",
        type: "object",
        properties: {
          id: {
            description: "Application ID that processed the event",
            type: "string",
          },
        },
        required: [],
      },
      webhook_uri: {
        description: "Webhook URI where the event was delivered",
        type: "string",
      },
      error_description: {
        description: "Error description if the delivery failed",
        type: "string",
      },
    },
    required: ["id", "delivery_status", "timestamp"],
  },
  WhatsAppMessageDeliveryStatus: {
    description: "Message delivery status",
    type: "string",
    enum: ["SENT", "DELIVERED", "READ", "FAILED", "DELETED"],
  },
  WebhookUpdateState: {
    description: "State of webhook update delivery",
    type: "string",
    enum: ["PENDING", "DELIVERED", "FAILED", "RETRYING"],
  },
  MessageHistoryResponse: {
    description: "Paginated response containing message history entries",
    type: "object",
    properties: {
      data: {
        description: "Array of message history entries",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppMessageHistory",
        },
      },
      paging: {
        type: "ref",
        ref: "PaginationInfo",
      },
    },
    required: [],
  },
  PaginationInfo: {
    description: "Pagination information for navigating through results",
    type: "object",
    properties: {
      cursors: {
        description: "Pagination cursors for navigation",
        type: "object",
        properties: {
          before: {
            description: "Cursor for the previous page of results",
            type: "string",
          },
          after: {
            description: "Cursor for the next page of results",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessPhoneNumberRegistrationRequest: {
    description: "Request payload for registering a WhatsApp Business phone number",
    type: "object",
    properties: {
      messaging_product: {
        description: "Must be 'whatsapp' to indicate WhatsApp Business messaging product",
        type: "string",
        enum: ["whatsapp"],
      },
      pin: {
        description: "6-digit PIN for two-step verification setup",
        type: "string",
        minLength: 6,
        maxLength: 6,
        pattern: "^[0-9]{6}$",
      },
      backup: {
        type: "ref",
        ref: "WhatsAppBusinessAccountBackup",
      },
      data_localization_region: {
        type: "ref",
        ref: "WhatsAppDataLocalizationRegion",
      },
      meta_store_retention_minutes: {
        description: "Message retention period in minutes (deprecated in v21+)",
        type: "integer",
        minimum: 60,
        maximum: 60,
      },
    },
    required: ["messaging_product", "pin"],
  },
  WhatsAppBusinessAccountBackup: {
    description: "Backup data for migrating existing WhatsApp Business accounts",
    type: "object",
    properties: {
      password: {
        description: "Backup password for account migration",
        type: "string",
      },
      data: {
        description: "Encrypted backup data for account migration",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppDataLocalizationRegion: {
    description: "Data localization region for message storage (deprecated in v21+)",
    type: "string",
    enum: ["AE", "AU", "BH", "BR", "CA", "CH", "DE", "GB", "ID", "IN", "JP", "KR", "SG", "ZA"],
  },
  WhatsAppBusinessPhoneNumberRegistrationResponse: {
    description: "Response from phone number registration request",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the registration was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError6: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  RequestCodeRequest: {
    description: "Request body for requesting a verification code",
    type: "object",
    properties: {
      code_method: {
        description: "Method for receiving the verification code",
        type: "string",
        enum: ["SMS", "VOICE"],
      },
      language: {
        description: "Language locale for the verification message",
        type: "string",
        minLength: 5,
        maxLength: 5,
        pattern: "^[a-z]{2}_[A-Z]{2}$",
      },
    },
    required: ["code_method", "language"],
  },
  RequestCodeResponse: {
    description: "Response after successfully requesting a verification code",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the verification code request was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  CallingSettingsRequest: {
    type: "object",
    properties: {
      calling: {
        type: "ref",
        ref: "CallingSettings",
      },
    },
    required: ["calling"],
  },
  CallingSettings1: {
    type: "object",
    properties: {
      status: {
        description: "Enable or disable calling feature",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      call_icon_visibility: {
        description: "Control visibility of the call icon",
        type: "string",
        enum: ["visible", "hidden"],
      },
      video: {
        type: "ref",
        ref: "VideoSettings",
      },
      sip: {
        type: "ref",
        ref: "SipSettings",
      },
      srtp_key_exchange_protocol: {
        description: "SRTP key exchange protocol",
        type: "string",
        enum: ["DTLS-SRTP", "SDES-SRTP"],
      },
    },
    required: ["status"],
  },
  VideoSettings: {
    type: "object",
    properties: {
      status: {
        description: "Enable or disable video calling",
        type: "string",
        enum: ["enabled", "disabled"],
      },
    },
    required: ["status"],
  },
  SipSettings: {
    type: "object",
    properties: {
      status: {
        description: "Enable or disable SIP calling",
        type: "string",
        enum: ["enabled", "disabled"],
      },
    },
    required: ["status"],
  },
  UserIdentityChangeSettingsRequest: {
    type: "object",
    properties: {
      user_identity_change: {
        type: "ref",
        ref: "UserIdentityChangeSettings",
      },
    },
    required: ["user_identity_change"],
  },
  UserIdentityChangeSettings: {
    type: "object",
    properties: {
      enabled: {
        description: "Enable or disable user identity change notifications",
        type: "boolean",
      },
    },
    required: ["enabled"],
  },
  PayloadEncryptionSettingsRequest: {
    type: "object",
    properties: {
      payload_encryption: {
        type: "ref",
        ref: "PayloadEncryptionSettings",
      },
    },
    required: ["payload_encryption"],
  },
  PayloadEncryptionSettings: {
    type: "object",
    properties: {
      status: {
        description: "Enable or disable payload encryption",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      client_encryption_key: {
        description: "Base64-encoded public key for payload encryption\n(required when enabling encryption)\n",
        type: "string",
      },
    },
    required: ["status"],
  },
  StorageConfigurationSettingsRequest: {
    type: "object",
    properties: {
      storage_configuration: {
        type: "ref",
        ref: "StorageConfigurationSettings",
      },
    },
    required: ["storage_configuration"],
  },
  StorageConfigurationSettings: {
    type: "object",
    properties: {
      enabled: {
        description: "Enable or disable custom storage configuration",
        type: "boolean",
      },
      region: {
        description: "Data storage region",
        type: "string",
      },
    },
    required: ["enabled"],
  },
  PhoneNumberSettingsResponse: {
    type: "object",
    properties: {
      calling: {
        type: "ref",
        ref: "CallingSettingsResponse",
      },
      payload_encryption: {
        type: "ref",
        ref: "PayloadEncryptionSettingsResponse",
      },
      storage_configuration: {
        type: "ref",
        ref: "StorageConfigurationSettingsResponse",
      },
    },
    required: ["calling", "storage_configuration"],
  },
  CallingSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "Current calling feature status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      call_icon_visibility: {
        description: "Current call icon visibility setting",
        type: "string",
        enum: ["visible", "hidden"],
      },
      ip_addresses: {
        type: "object",
        properties: {
          default: {
            description: "Default IP addresses for calling",
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: ["default"],
      },
      callback_permission_status: {
        description: "Callback permission status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      srtp_key_exchange_protocol: {
        description: "SRTP key exchange protocol (optional)",
        type: "string",
        enum: ["DTLS-SRTP", "SDES-SRTP"],
      },
      call_hours: {
        type: "ref",
        ref: "CallHoursSettings",
      },
      call_icons: {
        type: "ref",
        ref: "CallIconsSettings",
      },
      sip: {
        type: "ref",
        ref: "SipSettingsResponse",
      },
      video: {
        type: "ref",
        ref: "VideoSettingsResponse",
      },
      audio: {
        type: "ref",
        ref: "AudioSettingsResponse",
      },
      restrictions: {
        type: "ref",
        ref: "CallingRestrictionsResponse",
      },
    },
    required: ["status", "call_icon_visibility", "ip_addresses", "callback_permission_status"],
  },
  CallHoursSettings: {
    type: "object",
    properties: {
      status: {
        description: "Call hours feature status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      timezone: {
        description: "Timezone for call hours",
        type: "string",
      },
      day_of_week_start: {
        description: "Start day of the week",
        type: "string",
      },
    },
    required: ["status"],
  },
  CallIconsSettings: {
    type: "object",
    properties: {
      restrict_to_user_countries: {
        description: "List of countries where call icons are restricted",
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [],
  },
  SipSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "SIP calling status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      servers: {
        description: "SIP server configuration",
        type: "array",
        items: {
          type: "ref",
          ref: "SipServerInfo",
        },
      },
    },
    required: ["status"],
  },
  SipServerInfo: {
    type: "object",
    properties: {
      app_id: {
        description: "Application ID for SIP server",
        type: "string",
      },
      hostname: {
        description: "SIP server hostname",
        type: "string",
      },
      port: {
        description: "SIP server port (optional)",
        type: "integer",
      },
      password: {
        description: "SIP password (only included when include_sip_credentials=true)",
        type: "string",
      },
    },
    required: ["app_id", "hostname"],
  },
  VideoSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "Video calling status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
    },
    required: ["status"],
  },
  AudioSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "Audio calling status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
    },
    required: [],
  },
  CallingRestrictionsResponse: {
    type: "object",
    properties: {
      restrictions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              description: "Type of restriction",
              type: "string",
            },
            expiration: {
              description: "Expiration timestamp for the restriction",
              type: "integer",
              format: "int64",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  PayloadEncryptionSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "Payload encryption status",
        type: "string",
        enum: ["enabled", "disabled"],
      },
      client_encryption_key_fingerprint: {
        description: "Client encryption key fingerprint (when encryption is enabled)",
        type: "string",
      },
      cloud_encryption_key: {
        description: "Cloud encryption key (when encryption is enabled)",
        type: "string",
      },
    },
    required: ["status"],
  },
  StorageConfigurationSettingsResponse: {
    type: "object",
    properties: {
      status: {
        description: "Data storage configuration status",
        type: "string",
        enum: ["default", "in_country_storage_enabled"],
      },
      data_localization_region: {
        description: "Data localization region (when in-country storage is enabled)",
        type: "string",
      },
    },
    required: ["status"],
  },
  VerifyCodeRequest1: {
    description: "Request payload for phone number verification code verification",
    type: "object",
    properties: {
      code: {
        description: "The verification code received via SMS or voice call",
        type: "string",
        pattern: "^[0-9]{6}$",
      },
    },
    required: ["code"],
  },
  VerifyCodeResponse: {
    description: "Response from phone number verification code verification",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the verification code was successfully verified",
        type: "boolean",
      },
      id: {
        description: "The phone number ID that was verified",
        type: "string",
      },
    },
    required: ["success"],
  },
  GraphAPIError7: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessEncryptionInfo: {
    description: "Business encryption public key information and verification status",
    type: "object",
    properties: {
      business_public_key: {
        description:
          "The business public key used for encrypting message payloads.\nThis key is used to encrypt data channel requests and responses.\n",
        type: "string",
      },
      business_public_key_signature_status: {
        type: "ref",
        ref: "BusinessPublicKeyVerificationStatus",
      },
    },
    required: ["business_public_key", "business_public_key_signature_status"],
  },
  BusinessPublicKeyVerificationStatus: {
    description: "Status of business public key signature verification",
    type: "string",
    enum: ["VALID", "MISMATCH"],
  },
  WhatsAppBusinessEncryptionUploadRequest: {
    description: "Request payload for uploading business public key",
    type: "object",
    properties: {
      business_public_key: {
        description:
          "The business public key in PEM format to be uploaded and signed.\nMust be a valid RSA public key that will be used for payload encryption.\n",
        type: "string",
      },
    },
    required: ["business_public_key"],
  },
  WhatsAppBusinessEncryptionUploadResponse: {
    description: "Response after successful public key upload",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the public key was successfully uploaded and signed",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError8: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessProfile: {
    description: "WhatsApp Business Profile information and settings",
    type: "object",
    properties: {
      messaging_product: {
        description: "The messaging service used for the request",
        type: "string",
        enum: ["whatsapp"],
      },
      about: {
        description: "The text to display in business profile's About section",
        type: "string",
        minLength: 1,
        maxLength: 139,
      },
      address: {
        description: "The address of the business",
        type: "string",
        maxLength: 256,
      },
      description: {
        description: "Description of the business",
        type: "string",
        maxLength: 256,
      },
      email: {
        description: "The contact email address of the business",
        type: "string",
        maxLength: 128,
      },
      profile_picture_url: {
        description: "URL of the business profile picture",
        type: "string",
      },
      websites: {
        description: "URLs associated with the business",
        type: "array",
        items: {
          type: "string",
          maxLength: 256,
        },
        maxItems: 2,
      },
      vertical: {
        type: "ref",
        ref: "WhatsAppBusinessVertical",
      },
    },
    required: ["messaging_product"],
  },
  WhatsAppBusinessProfileUpdateRequest: {
    description: "Request payload for updating WhatsApp Business Profile",
    type: "object",
    properties: {
      messaging_product: {
        description: "The messaging service used for the request",
        type: "string",
        enum: ["whatsapp"],
      },
      about: {
        description: "The text to display in business profile's About section",
        type: "string",
        minLength: 1,
        maxLength: 139,
      },
      address: {
        description: "The address of the business",
        type: "string",
        maxLength: 256,
      },
      description: {
        description: "Description of the business",
        type: "string",
        maxLength: 256,
      },
      email: {
        description: "The contact email address of the business",
        type: "string",
        maxLength: 128,
      },
      profile_picture_handle: {
        description: "The handle of the profile picture generated from Resumable Upload API",
        type: "string",
      },
      websites: {
        description: "URLs associated with the business",
        type: "array",
        items: {
          type: "string",
          maxLength: 256,
        },
        maxItems: 2,
      },
      vertical: {
        type: "ref",
        ref: "WhatsAppBusinessVertical",
      },
    },
    required: ["messaging_product"],
  },
  WhatsAppBusinessVertical: {
    description: "The industry type of the business",
    type: "string",
    enum: [
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
    ],
  },
  WhatsAppBusinessProfileResponse: {
    description: "Response containing business profile information",
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            business_profile: {
              type: "ref",
              ref: "WhatsAppBusinessProfile",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  WhatsAppBusinessProfileUpdateResponse: {
    description: "Response after updating business profile",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the update was successful",
        type: "boolean",
      },
    },
    required: [],
  },
  BusinessComplianceInfo: {
    description: "WhatsApp Business Account compliance information and regulatory details",
    type: "object",
    properties: {
      whatsapp_business_account_id: {
        description: "Unique identifier for the WhatsApp Business Account",
        type: "string",
      },
      messaging_product: {
        description: "Messaging product identifier, always 'whatsapp' for WhatsApp Business",
        type: "string",
        enum: ["whatsapp"],
      },
      entity_name: {
        description: "Legal name of the business entity",
        type: "string",
      },
      entity_type: {
        description: "Type of business entity (e.g., Partnership, Private Limited Company, etc.)",
        type: "string",
      },
      entity_type_custom: {
        description: "Custom entity type description when standard types don't apply",
        type: "string",
      },
      is_registered: {
        description: "Whether the business entity is officially registered with regulatory authorities",
        type: "boolean",
      },
      grievance_officer_details: {
        type: "ref",
        ref: "GrievanceOfficerDetails",
      },
      customer_care_details: {
        type: "ref",
        ref: "CustomerCareDetails",
      },
    },
    required: ["whatsapp_business_account_id"],
  },
  GrievanceOfficerDetails: {
    description: "Contact information for the designated grievance officer",
    type: "object",
    properties: {
      name: {
        description: "Full name of the grievance officer",
        type: "string",
      },
      email: {
        description: "Email address for grievance officer contact",
        type: "string",
      },
      mobile_number: {
        description: "Mobile phone number for grievance officer (with country code)",
        type: "string",
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
      landline_number: {
        description: "Landline phone number for grievance officer (with country code)",
        type: "string",
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
    },
    required: [],
  },
  CustomerCareDetails: {
    description: "Contact information for customer care and support",
    type: "object",
    properties: {
      email: {
        description: "Email address for customer care contact",
        type: "string",
      },
      mobile_number: {
        description: "Mobile phone number for customer care (with country code)",
        type: "string",
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
      landline_number: {
        description: "Landline phone number for customer care (with country code)",
        type: "string",
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
    },
    required: [],
  },
  BusinessComplianceInfoUpdateRequest: {
    description: "Request object for updating WhatsApp Business Account compliance information",
    type: "object",
    properties: {
      messaging_product: {
        description: "Messaging product identifier, must be 'whatsapp'",
        type: "string",
        enum: ["whatsapp"],
      },
      entity_name: {
        description: "Legal name of the business entity",
        type: "string",
        minLength: 2,
        maxLength: 128,
      },
      entity_type: {
        type: "ref",
        ref: "BusinessEntityType",
      },
      entity_type_custom: {
        description: 'Custom entity type description when entity_type is "OTHER". Required for OTHER entity type.',
        type: "string",
        maxLength: 1024,
      },
      is_registered: {
        description:
          'Whether the business entity is officially registered with regulatory authorities. Can only be used with "OTHER" or "PARTNERSHIP" entity types.',
        type: "boolean",
      },
      grievance_officer_details: {
        type: "ref",
        ref: "GrievanceOfficerUpdateDetails",
      },
      customer_care_details: {
        type: "ref",
        ref: "CustomerCareUpdateDetails",
      },
    },
    required: ["messaging_product", "entity_name", "entity_type", "grievance_officer_details", "customer_care_details"],
  },
  BusinessEntityType: {
    description: "Type of business entity for compliance purposes",
    type: "string",
    enum: [
      "LIMITED_LIABILITY_PARTNERSHIP",
      "SOLE_PROPRIETORSHIP",
      "PARTNERSHIP",
      "PUBLIC_COMPANY",
      "PRIVATE_COMPANY",
      "OTHER",
    ],
  },
  GrievanceOfficerUpdateDetails: {
    description: "Contact information for the designated grievance officer",
    type: "object",
    properties: {
      name: {
        description: "Full name of the grievance officer",
        type: "string",
        maxLength: 128,
      },
      email: {
        description: "Email address for grievance officer contact",
        type: "string",
        maxLength: 128,
      },
      mobile_number: {
        description: "Mobile phone number for grievance officer (with country code)",
        type: "string",
        maxLength: 20,
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
      landline_number: {
        description: "Landline phone number for grievance officer (with country code)",
        type: "string",
        maxLength: 20,
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
    },
    required: ["name", "email"],
  },
  CustomerCareUpdateDetails: {
    description: "Contact information for customer care and support",
    type: "object",
    properties: {
      email: {
        description: "Email address for customer care contact",
        type: "string",
        maxLength: 128,
      },
      mobile_number: {
        description: "Mobile phone number for customer care (with country code)",
        type: "string",
        maxLength: 20,
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
      landline_number: {
        description: "Landline phone number for customer care (with country code)",
        type: "string",
        maxLength: 20,
        pattern: "^\\\\+[1-9]\\\\d{1,14}$",
      },
    },
    required: ["email"],
  },
  ApiError: {
    type: "object",
    properties: {
      code: {
        description: "Error code",
        type: "integer",
      },
      message: {
        description: "Error message",
        type: "string",
      },
      title: {
        description: "Error title",
        type: "string",
      },
      error_data: {
        type: "object",
        properties: {
          details: {
            description: "Error details",
            type: "string",
          },
        },
        required: [],
      },
    },
    required: [],
  },
  GroupInfo: {
    type: "object",
    properties: {
      id: {
        description: "Group ID",
        type: "string",
      },
      messaging_product: {
        type: "string",
      },
      join_approval_mode: {
        description: "Join approval mode for the group",
        type: "string",
        enum: ["approval_required", "auto_approve"],
      },
      subject: {
        description: "Group subject",
        type: "string",
      },
      description: {
        description: "Group description",
        type: "string",
      },
      suspended: {
        description: "Returns true if the group has been suspended by WhatsApp",
        type: "boolean",
      },
      creation_timestamp: {
        description: "UNIX timestamp in seconds at which the group was created",
        type: "integer",
      },
      participants: {
        description: "List of participants in the group",
        type: "array",
        items: {
          type: "object",
          properties: {
            wa_id: {
              description: "WhatsApp user ID",
              type: "string",
            },
          },
          required: [],
        },
      },
      total_participant_count: {
        description: "Total number of participants in the group, excluding your business",
        type: "integer",
      },
    },
    required: [],
  },
  WhatsAppMessageHistoryEventsEdge: {
    description: "Edge containing message delivery status occurrence with pagination cursor",
    type: "object",
    properties: {
      cursor: {
        description: "Pagination cursor for this edge",
        type: "string",
      },
      node: {
        type: "ref",
        ref: "WhatsAppBusinessMessageDeliveryStatusOccurrence",
      },
    },
    required: ["node"],
  },
  WhatsAppBusinessMessageDeliveryStatusOccurrence: {
    description: "Message delivery status occurrence with detailed event information",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the message delivery status occurrence",
        type: "string",
      },
      delivery_status: {
        type: "ref",
        ref: "WhatsAppMessageDeliveryStatus",
      },
      error_description: {
        description: "Error description if the delivery encountered an error",
        type: "string",
      },
      occurrence_timestamp: {
        description: "Unix timestamp when the delivery status occurrence happened",
        type: "integer",
        format: "int64",
      },
      status_timestamp: {
        description: "Unix timestamp when the status was recorded",
        type: "integer",
        format: "int64",
      },
      application: {
        type: "ref",
        ref: "ApplicationNode",
      },
    },
    required: ["id", "delivery_status", "occurrence_timestamp"],
  },
  WhatsAppMessageDeliveryStatus1: {
    description: "Message delivery status",
    type: "string",
    enum: ["ACCEPTED", "DELIVERED", "ERROR", "READ", "SENT"],
  },
  ApplicationNode1: {
    description: "Meta application that processed the delivery status event",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the Meta application",
        type: "string",
      },
      name: {
        description: "Name of the Meta application",
        type: "string",
      },
    },
    required: [],
  },
  MessageHistoryEventsResponse: {
    description: "Paginated response containing message history events",
    type: "object",
    properties: {
      data: {
        description: "Array of message history event edges",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppMessageHistoryEventsEdge",
        },
      },
      paging: {
        type: "ref",
        ref: "PaginationInfo",
      },
    },
    required: [],
  },
  PaginationInfo1: {
    description: "Pagination information for navigating through results",
    type: "object",
    properties: {
      cursors: {
        description: "Pagination cursors for navigation",
        type: "object",
        properties: {
          before: {
            description: "Cursor for the previous page of results",
            type: "string",
          },
          after: {
            description: "Cursor for the next page of results",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessAccountMigrationIntent: {
    description: "WhatsApp Business Account migration intent details and status",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the migration intent",
        type: "string",
      },
      status: {
        type: "ref",
        ref: "WhatsAppBusinessAccountMigrationStatus",
      },
    },
    required: ["id", "status"],
  },
  WhatsAppBusinessAccountMigrationStatus: {
    description: "Current status of the WhatsApp Business Account migration intent",
    type: "string",
    enum: ["ACCEPTED", "COMPLETED", "INITIATED", "REJECTED"],
  },
  PreVerifiedPhoneNumberValidation: {
    description: "Pre-verified phone number validation details and status",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the pre-verified phone number",
        type: "string",
      },
      country_prefix: {
        description: "Country code prefix for the phone number",
        type: "integer",
        minimum: 1,
        maximum: 999,
      },
      display_phone_number: {
        description: "Formatted display version of the phone number",
        type: "string",
      },
      error_msg: {
        description: "Error message if validation failed",
        type: "string",
      },
      is_input_id_valid: {
        description: "Whether the provided phone number ID is valid",
        type: "boolean",
      },
    },
    required: ["is_input_id_valid"],
  },
  WhatsAppBusinessPreVerifiedPhoneNumberPartnersResponse: {
    description: "Response containing partner businesses for a pre-verified phone number",
    type: "object",
    properties: {
      data: {
        description: "List of partner businesses with access to the pre-verified phone number",
        type: "array",
        items: {
          type: "ref",
          ref: "BusinessPartner",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: ["data"],
  },
  BusinessPartner: {
    description: "Business entity that has partner access to the pre-verified phone number",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the partner business",
        type: "string",
      },
      name: {
        description: "Name of the partner business",
        type: "string",
      },
      created_time: {
        description: "ISO 8601 timestamp when the business was created",
        type: "string",
      },
      updated_time: {
        description: "ISO 8601 timestamp when the business was last updated",
        type: "string",
      },
      verification_status: {
        description: "Business verification status",
        type: "string",
        enum: ["not_verified", "pending", "verified"],
      },
      primary_page: {
        description: "Primary Facebook Page ID associated with the business",
        type: "string",
      },
      timezone_id: {
        description: "Timezone identifier for the business location",
        type: "integer",
      },
      two_factor_type: {
        description: "Two-factor authentication method configured for the business",
        type: "string",
        enum: ["none", "admin_required"],
      },
    },
    required: ["id", "name"],
  },
  CursorPaging5: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data that has been returned",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data that has been returned",
            type: "string",
          },
        },
        required: [],
      },
      next: {
        description: "Graph API endpoint URL for the next page of results",
        type: "string",
      },
      previous: {
        description: "Graph API endpoint URL for the previous page of results",
        type: "string",
      },
    },
    required: [],
  },
  RequestCodeRequest1: {
    description: "Request body for requesting verification code",
    type: "object",
    properties: {
      code_method: {
        type: "ref",
        ref: "PhoneVerificationMethodCode",
      },
      language: {
        description:
          "Language/locale code for the verification message. Must be a valid locale identifier.\nThe verification message will be sent in this language if supported.\nSupports various formats including xx_XX, xx-XX, and extended locale codes.\n",
        type: "string",
      },
    },
    required: ["code_method", "language"],
  },
  PhoneVerificationMethodCode: {
    description: "Method for receiving the verification code",
    type: "string",
    enum: ["SMS", "VOICE"],
  },
  RequestCodeResponse1: {
    description: "Response after successfully requesting verification code",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the verification code request was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  VerifyCodeRequest2: {
    description: "Request payload for verifying OTP code",
    type: "object",
    properties: {
      code: {
        description:
          "The numeric verification code received via SMS or voice call.\nThis code is provided after calling the request_code endpoint.\n",
        type: "string",
        minLength: 4,
        maxLength: 8,
        pattern: "^[0-9]+$",
      },
    },
    required: ["code"],
  },
  VerifyCodeResponse1: {
    description: "Response indicating successful code verification",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the code verification was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GraphAPIError9: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessSolutionAccessToken: {
    description: "Granular BISU access token response for Multi-Partner Solution partners",
    type: "object",
    properties: {
      access_token: {
        description: "Granular BISU access token for accessing customer business resources",
        type: "string",
      },
      expires_at: {
        description: "Unix timestamp indicating when the access token expires",
        type: "integer",
        format: "int64",
      },
    },
    required: ["access_token", "expires_at"],
  },
  WhatsAppBusinessSolution1: {
    description: "WhatsApp Business Multi-Partner Solution object with core node fields only",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Solution",
        type: "string",
      },
      name: {
        description: "Human-readable name for the solution (UGC text, 2-75 characters)",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
      status: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionStatus",
      },
      status_for_pending_request: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionPendingStatus",
      },
      owner_permissions: {
        description: "Array of permissions granted to the solution owner",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPermissionTask",
        },
      },
    },
    required: ["id", "name", "status", "status_for_pending_request"],
  },
  WhatsAppBusinessSolutionStatus1: {
    description: "Current status of the WhatsApp Business Solution",
    type: "string",
    enum: ["DRAFT", "INITIATED", "ACTIVE", "REJECTED", "DEACTIVATED", "PENDING_DEACTIVATION"],
  },
  WhatsAppBusinessSolutionPendingStatus1: {
    description: "Status of any pending requests for the solution",
    type: "string",
    enum: ["PENDING_ACTIVATION", "PENDING_DEACTIVATION", "NONE"],
  },
  GraphAPIError10: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error type classification",
            type: "string",
            enum: ["OAuthException", "GraphMethodException", "GraphAPIException"],
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode",
            type: "integer",
          },
          fbtrace_id: {
            description: "Internal trace ID for debugging",
            type: "string",
          },
          is_transient: {
            description: "Whether this error might be resolved by retrying",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessSolutionAcceptRequest: {
    description: "Request payload for accepting a Multi-Partner Solution invitation",
    type: "object",
    properties: {
      partner_app_id: {
        description:
          "ID of the partner application accepting the solution invitation.\nThis must match the app ID that received the original invitation.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
      log_session_id: {
        description:
          "Optional session identifier for logging and debugging purposes.\nUsed to track the acceptance flow across multiple API calls.\n",
        type: "string",
      },
    },
    required: ["partner_app_id"],
  },
  WhatsAppBusinessSolutionAcceptResponse: {
    description: "Successful response confirming solution acceptance",
    type: "object",
    properties: {
      solution_id: {
        description: "ID of the Multi-Partner Solution that was accepted",
        type: "string",
      },
      partner_status: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionPartnerStatus",
      },
      success: {
        description: "Indicates whether the acceptance was successful",
        type: "boolean",
      },
      message: {
        description: "Human-readable confirmation message",
        type: "string",
      },
      update_time: {
        description: "Timestamp when the acceptance was processed",
        type: "string",
      },
    },
    required: ["solution_id", "partner_status", "success"],
  },
  WhatsAppBusinessSolutionPartnerStatus: {
    description: "Current status of the partner's participation in the Multi-Partner Solution",
    type: "string",
    enum: ["DRAFT", "INITIATED", "NOTIFICATION_SENT", "ACCEPTED", "REJECTED", "DEACTIVATED"],
  },
  WhatsAppBusinessSolution2: {
    description: "Multi-Partner Solution details after rejecting deactivation request",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the Multi-Partner Solution",
        type: "string",
      },
      name: {
        description: "Human-readable name of the Multi-Partner Solution",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
      status: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionStatus",
      },
      status_for_pending_request: {
        type: "ref",
        ref: "WhatsAppBusinessSolutionPendingStatus",
      },
      owner_app: {
        type: "ref",
        ref: "ApplicationNode",
      },
      owner_permissions: {
        description: "List of WhatsApp Business Account permissions granted to the solution owner",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPermissionTask",
        },
      },
    },
    required: ["id", "name", "status", "status_for_pending_request"],
  },
  GraphAPIError11: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error type classification",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  SolutionRejectRequest: {
    description: "Request payload for rejecting a Multi-Partner Solution request",
    type: "object",
    properties: {
      request_type: {
        description: "Type of request being rejected",
        type: "string",
        enum: ["PARTNERSHIP_REQUEST", "DEACTIVATION_REQUEST"],
      },
      rejection_reason: {
        description: "Optional reason for rejecting the request",
        type: "string",
        maxLength: 500,
      },
      partner_app_id: {
        description:
          "The app ID of the requesting partner. Required when request_type is PARTNERSHIP_REQUEST, not used for DEACTIVATION_REQUEST",
        type: "string",
        pattern: "^[0-9]+$",
      },
    },
    required: ["request_type"],
  },
  SolutionRejectResponse: {
    description: "Successful response for solution rejection operation",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the rejection was successful",
        type: "boolean",
      },
      solution_id: {
        description: "The ID of the Multi-Partner Solution",
        type: "string",
      },
      rejected_request_type: {
        description: "Type of request that was rejected",
        type: "string",
        enum: ["PARTNERSHIP_REQUEST", "DEACTIVATION_REQUEST"],
      },
      rejection_timestamp: {
        description: "ISO 8601 timestamp when the rejection was processed",
        type: "string",
      },
      partner_app_id: {
        description: "App ID of the partner whose request was rejected (for partnership rejections)",
        type: "string",
      },
    },
    required: ["success", "solution_id", "rejected_request_type"],
  },
  WhatsAppBusinessSolutionDeactivationRequest: {
    description: "Request payload for sending a Multi-Partner Solution deactivation request",
    type: "object",
    properties: {
      reason: {
        description: "Optional reason for the deactivation request",
        type: "string",
        maxLength: 500,
      },
    },
    required: [],
  },
  WhatsAppBusinessSolutionDeactivationResponse: {
    description: "Successful response for deactivation request submission",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the deactivation request was successfully submitted",
        type: "boolean",
      },
      message: {
        description: "Human-readable message describing the result",
        type: "string",
      },
      request_id: {
        description: "Unique identifier for tracking the deactivation request",
        type: "string",
      },
    },
    required: ["success", "message"],
  },
  AssignedWhatsAppBusinessAccount: {
    description: "WhatsApp Business Account assigned to a user",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Account",
        type: "string",
      },
      name: {
        description: "Display name of the WhatsApp Business Account",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      status: {
        type: "ref",
        ref: "WhatsAppBusinessAccountStatus",
      },
      assignment_date: {
        description: "Date and time when the account was assigned to the user",
        type: "string",
      },
      permissions: {
        description: "List of permissions granted to the user for this account",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPermission",
        },
      },
      business_id: {
        description: "Business ID that owns this WhatsApp Business Account",
        type: "string",
      },
      phone_numbers: {
        description: "Phone numbers associated with this WhatsApp Business Account",
        type: "array",
        items: {
          type: "ref",
          ref: "PhoneNumberInfo",
        },
      },
    },
    required: ["id", "name", "status"],
  },
  WhatsAppBusinessAccountStatus: {
    description: "Current status of the WhatsApp Business Account",
    type: "string",
    enum: ["ACTIVE", "PENDING", "RESTRICTED", "DISABLED"],
  },
  WhatsAppBusinessAccountPermission: {
    description: "Permission level for WhatsApp Business Account access",
    type: "string",
    enum: [
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
    ],
  },
  PhoneNumberInfo1: {
    description: "Phone number information for WhatsApp Business Account",
    type: "object",
    properties: {
      id: {
        description: "Phone number ID",
        type: "string",
      },
      display_phone_number: {
        description: "Formatted phone number for display",
        type: "string",
      },
      verified_name: {
        description: "Verified business name for this phone number",
        type: "string",
      },
      status: {
        description: "Status of the phone number",
        type: "string",
        enum: ["CONNECTED", "DISCONNECTED", "MIGRATED", "PENDING", "DELETED"],
      },
    },
    required: [],
  },
  AssignedAccountsResponse: {
    description: "Response containing assigned WhatsApp Business Accounts",
    type: "object",
    properties: {
      data: {
        description: "List of assigned WhatsApp Business Accounts",
        type: "array",
        items: {
          type: "ref",
          ref: "AssignedWhatsAppBusinessAccount",
        },
      },
      paging: {
        type: "ref",
        ref: "PagingInfo",
      },
    },
    required: ["data"],
  },
  PagingInfo1: {
    description: "Pagination information for the response",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor for the previous page",
            type: "string",
          },
          after: {
            description: "Cursor for the next page",
            type: "string",
          },
        },
        required: [],
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppAccountNumber: {
    description: "WhatsApp Account Number details and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Account Number",
        type: "string",
      },
      display_phone_number: {
        description: "Phone number in international format for display purposes",
        type: "string",
      },
      verified_name: {
        description: "Business name verified for this phone number",
        type: "string",
      },
      status: {
        type: "ref",
        ref: "WhatsAppAccountNumberStatus",
      },
      quality_rating: {
        type: "ref",
        ref: "WhatsAppPhoneNumberQualityRating",
      },
      country_code: {
        description: "ISO 3166-1 alpha-2 country code",
        type: "string",
      },
      country_dial_code: {
        description: "Country dialing code",
        type: "string",
      },
      code_verification_status: {
        type: "ref",
        ref: "WhatsAppCodeVerificationStatus",
      },
      name_status: {
        type: "ref",
        ref: "WhatsAppDisplayNameStatus",
      },
      messaging_limit_tier: {
        description: "Current messaging limit tier for the account number",
        type: "string",
        enum: ["TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"],
      },
      account_mode: {
        type: "ref",
        ref: "WhatsAppBusinessSandboxEligibility",
      },
      certificate: {
        description: "Business certificate information for the account number",
        type: "string",
      },
      is_official_business_account: {
        description: "Whether this is an official business account",
        type: "boolean",
      },
    },
    required: ["id", "display_phone_number", "status"],
  },
  WhatsAppAccountNumberStatus: {
    description: "Current status of the WhatsApp Account Number",
    type: "string",
    enum: ["CONNECTED", "DISCONNECTED", "UNVERIFIED", "PENDING", "FLAGGED", "RESTRICTED"],
  },
  WhatsAppPhoneNumberQualityRating: {
    description: "Quality rating based on message delivery and user feedback",
    type: "string",
    enum: ["GREEN", "YELLOW", "RED", "NA"],
  },
  WhatsAppCodeVerificationStatus: {
    description: "Two-step verification status for the phone number",
    type: "string",
    enum: ["VERIFIED", "UNVERIFIED"],
  },
  WhatsAppDisplayNameStatus: {
    description: "Status of the display name associated with the phone number",
    type: "string",
    enum: ["APPROVED", "AVAILABLE_WITHOUT_REVIEW", "DECLINED", "EXPIRED", "PENDING_REVIEW", "NONE"],
  },
  WhatsAppBusinessSandboxEligibility: {
    description: "Account mode indicating sandbox or live environment",
    type: "string",
    enum: ["LIVE", "SANDBOX"],
  },
  AssignedUser: {
    description: "User assigned to WhatsApp Business Account with permissions",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the assigned user",
        type: "string",
      },
      name: {
        description: "Display name of the assigned user",
        type: "string",
      },
      business: {
        type: "ref",
        ref: "BusinessNode",
      },
      user_type: {
        type: "ref",
        ref: "AssignedUserType",
      },
    },
    required: ["id", "name"],
  },
  AssignedUserType: {
    description: "Type of user assignment",
    type: "string",
    enum: ["BUSINESS_USER", "SYSTEM_USER", "PERSONAL_USER"],
  },
  BusinessNode: {
    description: "Business entity associated with the user",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the business",
        type: "string",
      },
      name: {
        description: "Name of the business",
        type: "string",
      },
    },
    required: [],
  },
  AssignedUsersResponse: {
    description: "Response containing list of assigned users with pagination",
    type: "object",
    properties: {
      data: {
        description: "Array of assigned users",
        type: "array",
        items: {
          type: "ref",
          ref: "AssignedUser",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
      summary: {
        type: "ref",
        ref: "AssignedUsersSummary",
      },
    },
    required: ["data"],
  },
  AssignedUsersSummary: {
    description: "Summary information about assigned users",
    type: "object",
    properties: {
      total_count: {
        description: "Total number of assigned users",
        type: "integer",
      },
    },
    required: [],
  },
  CursorPaging6: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data",
            type: "string",
          },
        },
        required: [],
      },
      next: {
        description: "Graph API endpoint for the next page of results",
        type: "string",
      },
      previous: {
        description: "Graph API endpoint for the previous page of results",
        type: "string",
      },
    },
    required: [],
  },
  SuccessResponse1: {
    description: "Standard success response for write operations",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the operation was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  ConversationalAutomationRequest: {
    description: "Request payload for configuring conversational automation settings",
    type: "object",
    properties: {
      enable_welcome_message: {
        description: "Whether to enable welcome messages for new conversations",
        default: false,
        type: "boolean",
      },
      prompts: {
        description: "List of conversation prompts (ice breakers) to help guide customer interactions",
        default: [],
        type: "array",
        items: {
          description: "Individual conversation prompt text",
          type: "string",
          maxLength: 80,
        },
        maxItems: 3,
      },
      commands: {
        description: "List of bot commands for automated responses",
        default: [],
        type: "array",
        items: {
          type: "ref",
          ref: "BotCommand",
        },
        maxItems: 30,
      },
    },
    required: [],
  },
  BotCommand: {
    description: "Bot command configuration for automated responses",
    type: "object",
    properties: {
      command_name: {
        description: "Name of the bot command (without leading slash)",
        type: "string",
        maxLength: 30,
        pattern: "^[a-zA-Z0-9_]+$",
      },
      command_description: {
        description: "Description of what the command does",
        type: "string",
        maxLength: 256,
      },
    },
    required: ["command_name", "command_description"],
  },
  ConversationalAutomationResponse: {
    description: "Response after successfully configuring conversational automation",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the automation configuration was successful",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  BusinessOwnedObjectOnBehalfOfRequest: {
    description: "On-behalf request details for business owned objects",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the on-behalf request",
        type: "string",
      },
      status: {
        type: "ref",
        ref: "BusinessRequestStatus",
      },
      business_owned_object: {
        description: "ID of the business owned object (WhatsApp Business Account) for this request",
        type: "string",
      },
      receiving_business: {
        type: "ref",
        ref: "BusinessNode",
      },
      requesting_business: {
        type: "ref",
        ref: "BusinessNode",
      },
    },
    required: ["id", "status", "business_owned_object"],
  },
  BusinessRequestStatus: {
    description: "Current status of the business request",
    type: "string",
    enum: ["APPROVE", "DECLINE", "IN_PROGRESS", "EXPIRED", "PENDING", "CANCELED", "INVALID"],
  },
  BusinessNode1: {
    description: "Business entity information",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the business",
        type: "string",
      },
      name: {
        description: "Name of the business",
        type: "string",
      },
    },
    required: [],
  },
  PaginationInfo2: {
    description: "Pagination information for cursor-based pagination",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page",
            type: "string",
          },
        },
        required: [],
      },
      paging: {
        type: "object",
        properties: {
          previous: {
            description: "URL for the previous page of results",
            type: "string",
          },
          next: {
            description: "URL for the next page of results",
            type: "string",
          },
        },
        required: [],
      },
    },
    required: [],
  },
  InProgressOnBehalfRequestResponse: {
    description: "Response containing in-progress on-behalf requests with pagination",
    type: "object",
    properties: {
      data: {
        description: "Array of in-progress on-behalf requests",
        type: "array",
        items: {
          type: "ref",
          ref: "BusinessOwnedObjectOnBehalfOfRequest",
        },
      },
      paging: {
        type: "ref",
        ref: "PaginationInfo",
      },
    },
    required: ["data"],
  },
  OBOMobilityIntentNode: {
    description: "WhatsApp Business Account OBO Mobility Intent Node",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the OBO Mobility Intent Node",
        type: "string",
      },
      waba: {
        type: "ref",
        ref: "WhatsAppBusinessAccount",
      },
      solution: {
        type: "ref",
        ref: "WhatsAppBusinessSolution",
      },
      status: {
        description: "Current status of the OBO mobility intent",
        type: "string",
        enum: ["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "FAILED"],
      },
      created_time: {
        description: "Timestamp when the OBO mobility intent was created (ISO 8601 format)",
        type: "string",
      },
      updated_time: {
        description: "Timestamp when the OBO mobility intent was last updated (ISO 8601 format)",
        type: "string",
      },
    },
    required: ["id", "waba", "solution"],
  },
  WhatsAppBusinessAccount2: {
    description: "WhatsApp Business Account information",
    type: "object",
    properties: {
      id: {
        description: "WhatsApp Business Account ID",
        type: "string",
      },
      name: {
        description: "Business account name",
        type: "string",
      },
      status: {
        description: "Current status of the business account",
        type: "string",
        enum: ["ACTIVE", "INACTIVE", "PENDING"],
      },
    },
    required: ["id", "name"],
  },
  WhatsAppBusinessSolution3: {
    description: "WhatsApp Business Solution information",
    type: "object",
    properties: {
      id: {
        description: "Solution ID",
        type: "string",
      },
      name: {
        description: "Solution name",
        type: "string",
      },
      partner_id: {
        description: "Partner ID associated with the solution",
        type: "string",
      },
      status: {
        description: "Current status of the solution",
        type: "string",
        enum: ["ACTIVE", "INACTIVE", "PENDING"],
      },
    },
    required: ["id", "name"],
  },
  OBOMobilityIntentRequest: {
    description: "Request payload for OBO mobility intent operations",
    type: "object",
    properties: {
      solution_id: {
        description: "Unique identifier for the WhatsApp Business Solution",
        type: "string",
      },
      intent_type: {
        type: "ref",
        ref: "MobilityIntentType",
      },
      target_solution_id: {
        description: "Target solution ID for mobility operations (required for transfers)",
        type: "string",
      },
      mobility_reason: {
        description: "Reason for the mobility intent",
        type: "string",
        maxLength: 500,
      },
      scheduled_execution_time: {
        description: "Scheduled time for mobility execution (ISO 8601 format)",
        type: "string",
      },
      metadata: {
        description: "Additional metadata for the mobility operation",
        type: "object",
        properties: {},
        required: [],
      },
    },
    required: ["solution_id", "intent_type"],
  },
  MobilityIntentType: {
    description: "Type of mobility intent operation",
    type: "string",
    enum: [
      "INITIATE_TRANSFER",
      "CONFIRM_TRANSFER",
      "CANCEL_TRANSFER",
      "REQUEST_HANDOVER",
      "APPROVE_HANDOVER",
      "REJECT_HANDOVER",
    ],
  },
  OBOMobilityIntentResponse: {
    description: "Response for OBO mobility intent operations",
    type: "object",
    properties: {
      success: {
        description: "Indicates if the mobility intent operation was successful",
        type: "boolean",
      },
      mobility_intent_id: {
        description: "Unique identifier for the mobility intent request",
        type: "string",
      },
      status: {
        description: "Current status of the mobility intent",
        type: "string",
        enum: ["PENDING", "APPROVED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED"],
      },
      estimated_completion_time: {
        description: "Estimated completion time for the mobility operation (ISO 8601 format)",
        type: "string",
      },
      approval_required: {
        description: "Indicates if additional approval is required for the operation",
        type: "boolean",
      },
      next_steps: {
        description: "List of next steps required to complete the mobility operation",
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: ["success", "mobility_intent_id"],
  },
  WhatsAppBusinessAccountPhoneNumber: {
    description: "WhatsApp Business Account phone number details and status information",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the phone number status record",
        type: "string",
      },
      display_phone_number: {
        description: "Phone number in international format for display purposes",
        type: "string",
      },
      verified_name: {
        description: "Business name verified for this phone number",
        type: "string",
      },
      status: {
        type: "ref",
        ref: "WhatsAppPhoneNumberStatus",
      },
      quality_rating: {
        type: "ref",
        ref: "WhatsAppPhoneNumberQualityRating",
      },
      country_code: {
        description: "ISO 3166-1 alpha-2 country code",
        type: "string",
      },
      country_dial_code: {
        description: "Country dialing code",
        type: "string",
      },
      code_verification_status: {
        type: "ref",
        ref: "WhatsAppCodeVerificationStatus",
      },
      unified_cert_status: {
        type: "ref",
        ref: "WhatsAppBusinessUnifiedCertStatus",
      },
      account_mode: {
        type: "ref",
        ref: "WhatsAppBusinessSandboxEligibility",
      },
      host_platform: {
        type: "ref",
        ref: "WhatsAppBusinessAccountHostPlatform",
      },
      messaging_limit_tier: {
        description: "Current messaging limit tier for the phone number",
        type: "string",
        enum: ["TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"],
      },
      is_official_business_account: {
        description: "Whether this is an official business account",
        type: "boolean",
      },
      username: {
        description: "WhatsApp username for the business account (if available)",
        nullable: true,
        type: "string",
      },
    },
    required: ["id", "display_phone_number", "status"],
  },
  WhatsAppPhoneNumberStatus: {
    description: "Current status of the phone number in the WhatsApp Business Account",
    type: "string",
    enum: ["PENDING", "LINKED", "UNLINKED", "DELETED", "MIGRATED", "BANNED", "RESTRICTED"],
  },
  WhatsAppPhoneNumberQualityRating1: {
    description: "Quality rating for the phone number based on messaging patterns",
    type: "string",
    enum: ["GREEN", "YELLOW", "RED", "UNKNOWN"],
  },
  WhatsAppCodeVerificationStatus1: {
    description: "Status of phone number verification code",
    type: "string",
    enum: ["VERIFIED", "NOT_VERIFIED"],
  },
  WhatsAppBusinessUnifiedCertStatus: {
    description: "Unified certification status combining business and name verification",
    type: "string",
    enum: ["APPROVED", "NAME_PENDING_REVIEW", "NAME_NOT_APPROVED", "ACCOUNT_REVIEW_NOT_STARTED", "LIMITED_ACCESS"],
  },
  WhatsAppBusinessSandboxEligibility1: {
    description: "Account mode indicating sandbox or live environment eligibility",
    type: "string",
    enum: ["LIVE", "SANDBOX"],
  },
  WhatsAppBusinessAccountHostPlatform: {
    description: "Platform hosting the WhatsApp Business Account",
    type: "string",
    enum: ["CLOUD_API", "ON_PREMISE", "NOT_APPLICABLE"],
  },
  WhatsAppBusinessAccountPhoneNumbersConnection: {
    description: "Paginated collection of WhatsApp Business Account phone numbers",
    type: "object",
    properties: {
      data: {
        description: "Array of phone number records",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPhoneNumber",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: ["data"],
  },
  CursorPaging7: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  PhoneNumberCreateRequest: {
    description: "Request payload for creating a new phone number registration",
    type: "object",
    properties: {
      phone_number: {
        description: "Phone number in E.164 format without the + prefix",
        type: "string",
        pattern: "^[1-9][0-9]{6,14}$",
      },
      verified_name: {
        description: "Business name to be verified for this phone number",
        type: "string",
        minLength: 2,
        maxLength: 75,
      },
      cc: {
        description: "Country code for the phone number",
        type: "string",
        pattern: "^[0-9]{1,3}$",
      },
      migrate_phone_number: {
        description: "Whether this is a phone number migration from on-premises",
        default: false,
        type: "boolean",
      },
      preverified_id: {
        description: "Pre-verified phone number ID for BSP scenarios",
        type: "string",
      },
    },
    required: ["phone_number", "verified_name"],
  },
  PhoneNumberCreateResponse: {
    description: "Response after successfully creating a phone number registration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the created phone number status record",
        type: "string",
      },
    },
    required: ["id"],
  },
  WhatsAppBusinessAccountSchedule: {
    description: "WhatsApp Business Account schedule configuration and details",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the schedule",
        type: "string",
      },
      name: {
        description: "Human-readable name for the schedule",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      status: {
        type: "ref",
        ref: "WhatsAppScheduleStatus",
      },
      schedule_type: {
        type: "ref",
        ref: "WhatsAppScheduleType",
      },
      description: {
        description: "Optional description of the schedule purpose",
        type: "string",
        maxLength: 500,
      },
      start_time: {
        description: "Schedule start time in HH:MM format",
        type: "string",
      },
      end_time: {
        description: "Schedule end time in HH:MM format",
        type: "string",
      },
      timezone: {
        description: "Timezone identifier for the schedule",
        type: "string",
      },
      days_of_week: {
        description: "Days of the week when the schedule is active",
        type: "array",
        items: {
          type: "ref",
          ref: "DayOfWeek",
        },
      },
      created_time: {
        description: "ISO 8601 timestamp when the schedule was created",
        type: "string",
      },
      updated_time: {
        description: "ISO 8601 timestamp when the schedule was last updated",
        type: "string",
      },
      is_active: {
        description: "Whether the schedule is currently active",
        type: "boolean",
      },
      recurrence_pattern: {
        type: "ref",
        ref: "RecurrencePattern",
      },
    },
    required: ["id", "name", "status", "schedule_type"],
  },
  WhatsAppScheduleStatus: {
    description: "Current status of the schedule",
    type: "string",
    enum: ["ACTIVE", "INACTIVE", "PAUSED", "EXPIRED", "DRAFT"],
  },
  WhatsAppScheduleType: {
    description: "Type of schedule configuration",
    type: "string",
    enum: ["BUSINESS_HOURS", "AUTOMATED_RESPONSE", "MESSAGE_CAMPAIGN", "MAINTENANCE_WINDOW", "CUSTOM"],
  },
  DayOfWeek: {
    description: "Day of the week",
    type: "string",
    enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  },
  RecurrencePattern: {
    description: "Pattern for recurring schedules",
    type: "object",
    properties: {
      frequency: {
        type: "string",
        enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
      },
      interval: {
        description: "Interval between recurrences",
        type: "integer",
        minimum: 1,
      },
      end_date: {
        description: "End date for the recurrence pattern",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessAccountSchedulesConnection: {
    description: "Paginated collection of WhatsApp Business Account schedules",
    type: "object",
    properties: {
      data: {
        description: "Array of schedule records",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountSchedule",
        },
      },
      paging: {
        type: "ref",
        ref: "CursorPaging",
      },
    },
    required: ["data"],
  },
  CursorPaging8: {
    description: "Cursor-based pagination information",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  ScheduleCreateRequest: {
    description: "Request payload for creating a new schedule",
    type: "object",
    properties: {
      name: {
        description: "Human-readable name for the schedule",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      schedule_type: {
        type: "ref",
        ref: "WhatsAppScheduleType",
      },
      description: {
        description: "Optional description of the schedule purpose",
        type: "string",
        maxLength: 500,
      },
      start_time: {
        description: "Schedule start time in HH:MM format",
        type: "string",
      },
      end_time: {
        description: "Schedule end time in HH:MM format",
        type: "string",
      },
      timezone: {
        description: "Timezone identifier for the schedule",
        default: "UTC",
        type: "string",
      },
      days_of_week: {
        description: "Days of the week when the schedule is active",
        type: "array",
        items: {
          type: "ref",
          ref: "DayOfWeek",
        },
      },
      is_active: {
        description: "Whether the schedule should be active upon creation",
        default: true,
        type: "boolean",
      },
      recurrence_pattern: {
        type: "ref",
        ref: "RecurrencePattern",
      },
    },
    required: ["name", "schedule_type", "start_time", "end_time"],
  },
  ScheduleCreateResponse: {
    description: "Response after successfully creating a schedule",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the created schedule",
        type: "string",
      },
    },
    required: ["id"],
  },
  SetOBOMobilityIntentRequest: {
    description: "Request payload for setting OBO mobility intent",
    type: "object",
    properties: {
      waba_id: {
        description: "WhatsApp Business Account ID for which to set OBO mobility intent",
        type: "string",
        pattern: "^[0-9]+$",
      },
      solution_id: {
        description: "Unique identifier for the Multi-Partner Solution",
        type: "string",
        pattern: "^[0-9]+$",
      },
      app_id: {
        description: "Application ID requesting OBO mobility intent",
        type: "string",
        pattern: "^[0-9]+$",
      },
      actor_id: {
        description: "Actor ID performing the OBO mobility intent operation",
        type: "string",
        pattern: "^[0-9]+$",
      },
      client_mutation_id: {
        description: "Client-provided mutation identifier for request tracking",
        type: "string",
        maxLength: 255,
      },
    },
    required: ["waba_id"],
  },
  SetOBOMobilityIntentResponse: {
    description: "Response for setting OBO mobility intent",
    type: "object",
    properties: {
      success: {
        description: "Indicates if the OBO mobility intent was set successfully",
        type: "boolean",
      },
      intent_id: {
        description: "Unique identifier for the created OBO mobility intent",
        type: "string",
      },
      client_mutation_id: {
        description: "Client-provided mutation identifier echoed back",
        type: "string",
      },
      error_msg: {
        description: "Error message if the operation failed",
        type: "string",
      },
    },
    required: ["success"],
  },
  SetSolutionMigrationIntentRequest: {
    description: "Request payload for setting solution migration intent",
    type: "object",
    properties: {
      solution_id: {
        description: "Unique identifier for the Multi-Partner Solution",
        type: "string",
        pattern: "^[0-9]+$",
      },
      migration_intent: {
        type: "ref",
        ref: "SolutionMigrationIntent",
      },
      target_solution_id: {
        description: "Target solution ID for migration (required for certain migration intents)",
        type: "string",
        pattern: "^[0-9]+$",
      },
      migration_reason: {
        description: "Reason for the migration intent",
        type: "string",
        maxLength: 500,
      },
      scheduled_migration_time: {
        description: "Scheduled time for migration execution (ISO 8601 format)",
        type: "string",
      },
    },
    required: ["solution_id", "migration_intent"],
  },
  SolutionMigrationIntent: {
    description: "Intent for solution migration",
    type: "string",
    enum: ["INITIATE_MIGRATION", "CANCEL_MIGRATION", "CONFIRM_MIGRATION", "SCHEDULE_MIGRATION"],
  },
  SetSolutionMigrationIntentResponse: {
    description: "Response for setting solution migration intent",
    type: "object",
    properties: {
      success: {
        description: "Indicates if the migration intent was set successfully",
        type: "boolean",
      },
      migration_intent_id: {
        description: "Unique identifier for the migration intent request",
        type: "string",
      },
      status: {
        description: "Current status of the migration intent",
        type: "string",
        enum: ["PENDING", "APPROVED", "REJECTED", "SCHEDULED"],
      },
      estimated_completion_time: {
        description: "Estimated completion time for the migration (ISO 8601 format)",
        type: "string",
      },
    },
    required: ["success", "migration_intent_id"],
  },
  SolutionsList: {
    description: "Paginated list of Multi-Partner Solutions",
    type: "object",
    properties: {
      data: {
        description: "Array of Multi-Partner Solutions associated with the WABA",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessSolution",
        },
      },
      paging: {
        type: "ref",
        ref: "Paging",
      },
    },
    required: ["data"],
  },
  Paging1: {
    description: "Pagination information for cursor-based pagination",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data that has been returned",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data that has been returned",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "Graph API endpoint URL for the previous page of data",
        type: "string",
      },
      next: {
        description: "Graph API endpoint URL for the next page of data",
        type: "string",
      },
    },
    required: [],
  },
  GraphAPIError12: {
    description: "Standard Graph API error response",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          message: {
            description: "Human-readable error message",
            type: "string",
          },
          type: {
            description: "Error category type",
            type: "string",
          },
          code: {
            description: "Numeric error code",
            type: "integer",
          },
          error_subcode: {
            description: "More specific error subcode when available",
            type: "integer",
          },
          fbtrace_id: {
            description: "Unique identifier for debugging and support requests with Meta",
            type: "string",
          },
          is_transient: {
            description: "Indicates whether this error is temporary and the request should be retried",
            type: "boolean",
          },
          error_user_title: {
            description: "User-friendly error title for display purposes",
            type: "string",
          },
          error_user_msg: {
            description: "User-friendly error message for display purposes",
            type: "string",
          },
        },
        required: ["message", "type", "code"],
      },
    },
    required: ["error"],
  },
  WhatsAppBusinessApiData1: {
    description: "Application subscription data for WhatsApp Business Account",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the subscribed application",
        type: "string",
      },
      name: {
        description: "Name of the subscribed application",
        type: "string",
      },
      link: {
        description: "URL link to the application",
        type: "string",
      },
    },
    required: ["id", "name"],
  },
  SubscribedApp1: {
    description: "Subscribed application details",
    type: "object",
    properties: {
      whatsapp_business_api_data: {
        type: "ref",
        ref: "WhatsAppBusinessApiData",
      },
      override_callback_uri: {
        description: "Custom webhook callback URL for this subscription",
        type: "string",
      },
    },
    required: ["whatsapp_business_api_data"],
  },
  SubscribedAppsResponse: {
    description: "Response containing list of subscribed applications",
    type: "object",
    properties: {
      data: {
        description: "Array of subscribed applications",
        type: "array",
        items: {
          type: "ref",
          ref: "SubscribedApp",
        },
      },
    },
    required: ["data"],
  },
  SubscriptionRequest: {
    description: "Request body for subscribing to WABA webhooks",
    type: "object",
    properties: {
      override_callback_uri: {
        description: "Custom webhook callback URL to override app default",
        type: "string",
      },
      verify_token: {
        description: "Verification token for webhook security",
        type: "string",
      },
    },
    required: [],
  },
  SubscriptionResponse: {
    description: "Response after successful subscription operation",
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the subscription operation was successful",
        type: "boolean",
      },
      data: {
        description: "Array containing subscription details",
        type: "array",
        items: {
          type: "ref",
          ref: "SubscribedApp",
        },
      },
    },
    required: ["success"],
  },
  WhatsAppBusinessAccountActivity: {
    description: "WhatsApp Business Account activity record",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the activity record",
        type: "string",
      },
      activity_type: {
        type: "ref",
        ref: "ActivityType",
      },
      timestamp: {
        description: "ISO 8601 timestamp when the activity occurred",
        type: "string",
      },
      actor_type: {
        type: "ref",
        ref: "ActorType",
      },
      actor_id: {
        description: "ID of the user or system that performed the activity",
        type: "string",
      },
      actor_name: {
        description: "Name of the user or system that performed the activity",
        type: "string",
      },
      description: {
        description: "Human-readable description of the activity",
        type: "string",
      },
      details: {
        description: "Additional structured details about the activity",
        type: "object",
        properties: {},
        required: [],
      },
      ip_address: {
        description: "IP address from which the activity was performed (when available)",
        type: "string",
      },
      user_agent: {
        description: "User agent string from the client that performed the activity",
        type: "string",
      },
    },
    required: ["id", "activity_type", "timestamp", "actor_type"],
  },
  ActivityType: {
    description: "Type of activity performed on the WhatsApp Business Account",
    type: "string",
    enum: [
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
    ],
  },
  ActorType: {
    description: "Type of entity that performed the activity",
    type: "string",
    enum: ["USER", "SYSTEM", "API", "ADMIN", "AUTOMATED_PROCESS"],
  },
  ActivityList: {
    description: "Paginated list of WhatsApp Business Account activities",
    type: "object",
    properties: {
      data: {
        description: "Array of activity records",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountActivity",
        },
      },
      paging: {
        type: "ref",
        ref: "Paging",
      },
    },
    required: ["data"],
  },
  Paging2: {
    description: "Pagination information for activity results",
    type: "object",
    properties: {
      cursors: {
        type: "object",
        properties: {
          before: {
            description: "Cursor pointing to the start of the page of data",
            type: "string",
          },
          after: {
            description: "Cursor pointing to the end of the page of data",
            type: "string",
          },
        },
        required: [],
      },
      previous: {
        description: "Graph API endpoint URL for the previous page of results",
        type: "string",
      },
      next: {
        description: "Graph API endpoint URL for the next page of results",
        type: "string",
      },
    },
    required: [],
  },
  WhatsAppBusinessAccount3: {
    description: "WhatsApp Business Account details and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Account",
        type: "string",
      },
      name: {
        description: "Human-readable name of the WhatsApp Business Account",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      timezone_id: {
        description: "Timezone identifier for the WhatsApp Business Account",
        type: "string",
      },
      message_template_namespace: {
        description: "Message template namespace for the WhatsApp Business Account",
        type: "string",
      },
      account_review_status: {
        type: "ref",
        ref: "WhatsAppBusinessAccountReviewStatus",
      },
      business_verification_status: {
        type: "ref",
        ref: "WhatsAppBusinessAccountVerificationStatus",
      },
      country: {
        description: "Country code for the WhatsApp Business Account",
        type: "string",
      },
      ownership_type: {
        type: "ref",
        ref: "WhatsAppBusinessAccountOwnershipType",
      },
      primary_business_location: {
        description: "Primary business location for the WhatsApp Business Account",
        type: "string",
      },
    },
    required: ["id", "name"],
  },
  WhatsAppBusinessAccountReviewStatus: {
    description: "Review status of the WhatsApp Business Account",
    type: "string",
    enum: ["PENDING", "APPROVED", "REJECTED", "LIMIT_REACHED"],
  },
  WhatsAppBusinessAccountVerificationStatus: {
    description: "Business verification status of the WhatsApp Business Account",
    type: "string",
    enum: ["VERIFIED", "UNVERIFIED", "PENDING"],
  },
  WhatsAppBusinessAccountOwnershipType: {
    description: "Ownership type of the WhatsApp Business Account",
    type: "string",
    enum: ["SELF_OWNED", "CLIENT_OWNED", "AGENCY_OWNED"],
  },
  WhatsAppBusinessBot: {
    description: "WhatsApp Business Bot configuration and details",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Bot",
        type: "string",
      },
      prompts: {
        description: "List of bot prompts and automated responses",
        type: "array",
        items: {
          type: "string",
        },
      },
      commands: {
        description: "List of available bot commands and their descriptions",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessBotCommand",
        },
      },
      enable_welcome_message: {
        description: "Whether the welcome message is enabled for this bot",
        type: "boolean",
      },
    },
    required: ["id"],
  },
  WhatsAppBusinessBotCommand: {
    description: "Bot command configuration with name and description",
    type: "object",
    properties: {
      command_name: {
        description: "Name of the bot command",
        type: "string",
      },
      command_description: {
        description: "Description of what the command does",
        type: "string",
      },
    },
    required: ["command_name", "command_description"],
  },
  WhatsAppBusinessProfileNode: {
    description: "WhatsApp Business Profile node details and configuration",
    type: "object",
    properties: {
      id: {
        description: "Unique identifier for the WhatsApp Business Profile",
        type: "string",
      },
      account_name: {
        description: "Name of the business account",
        type: "string",
        minLength: 1,
        maxLength: 75,
      },
      description: {
        description: "Business description text",
        type: "string",
        minLength: 1,
        maxLength: 256,
      },
      email: {
        description: "Contact email address of the business",
        type: "string",
        maxLength: 128,
      },
      about: {
        description: "About section text for the business profile",
        type: "string",
        minLength: 1,
        maxLength: 139,
      },
      address: {
        description: "Physical address of the business",
        type: "string",
        maxLength: 256,
      },
      vertical: {
        type: "ref",
        ref: "WhatsAppBusinessVertical",
      },
      websites: {
        description: "List of website URLs associated with the business",
        type: "array",
        items: {
          type: "string",
          maxLength: 256,
        },
        maxItems: 2,
      },
      profile_picture_url: {
        description: "URL of the business profile picture",
        type: "string",
      },
      profile_picture_handle: {
        description: "Handle of the profile picture for upload operations",
        type: "string",
      },
      messaging_product: {
        description: "The messaging service used",
        type: "string",
        enum: ["whatsapp"],
      },
    },
    required: ["id"],
  },
  WhatsAppBusinessProfileUpdateRequest1: {
    description: "Request payload for updating WhatsApp Business Profile information",
    type: "object",
    properties: {
      messaging_product: {
        description: "The messaging service used for the request",
        type: "string",
        enum: ["whatsapp"],
      },
      account_name: {
        description: "Name of the business account",
        type: "string",
        minLength: 1,
        maxLength: 75,
      },
      description: {
        description: "Business description text",
        type: "string",
        minLength: 1,
        maxLength: 256,
      },
      email: {
        description: "Contact email address of the business",
        type: "string",
        maxLength: 128,
      },
      about: {
        description: "About section text for the business profile",
        type: "string",
        minLength: 1,
        maxLength: 139,
      },
      address: {
        description: "Physical address of the business",
        type: "string",
        maxLength: 256,
      },
      vertical: {
        type: "ref",
        ref: "WhatsAppBusinessVertical",
      },
      websites: {
        description: "List of website URLs associated with the business",
        type: "array",
        items: {
          type: "string",
          maxLength: 256,
        },
        maxItems: 2,
      },
      profile_picture_handle: {
        description: "Handle of the profile picture generated from Resumable Upload API",
        type: "string",
      },
    },
    required: ["messaging_product"],
  },
  WhatsAppBusinessProfileUpdateResponse1: {
    description: "Response from updating WhatsApp Business Profile",
    type: "object",
    properties: {
      id: {
        description: "WhatsApp Business Profile ID that was updated",
        type: "string",
      },
      success: {
        description: "Indicates if the update was successful",
        type: "boolean",
      },
    },
    required: [],
  },
  WhatsAppBusinessVertical1: {
    description: "Industry vertical classification for the business",
    type: "string",
    enum: [
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
    ],
  },
  WebhookPayload: {
    type: "object",
    properties: {
      object: {
        description: "Always 'whatsapp_business_account' for these webhooks.",
        type: "string",
      },
      entry: {
        type: "array",
        items: {
          type: "ref",
          ref: "Entry",
        },
      },
    },
    required: ["object", "entry"],
  },
  Entry: {
    type: "object",
    properties: {
      id: {
        description: "WhatsApp Business Account ID.",
        type: "string",
      },
      changes: {
        type: "array",
        items: {
          type: "ref",
          ref: "Change",
        },
      },
    },
    required: ["id", "changes"],
  },
  Change: {
    type: "object",
    properties: {
      value: {
        type: "union",
        of: [
          {
            type: "ref",
            ref: "IncomingMessageValueGeneral",
          },
          {
            type: "ref",
            ref: "IncomingMessageValueSystem",
          },
          {
            type: "ref",
            ref: "StatusMessageValue",
          },
          {
            type: "ref",
            ref: "GroupValue",
          },
        ],
      },
      field: {
        description:
          "The field indicate to what object is the webhook related:\n- messages: the webhook is related to messages from consumer or status of message sent by business to consumer.\n- group_lifecycle_update: the webhook is related to group creation and deletion.\n- group_settings_update: the webhook is related to group settings update.\n- group_participant_update: the webhook is related to participants joining and leaving the groups.\n",
        type: "string",
        enum: ["messages", "group_lifecycle_update", "group_settings_update", "group_participant_update"],
      },
    },
    required: ["value", "field"],
  },
  Metadata: {
    type: "object",
    properties: {
      display_phone_number: {
        description: "Business display phone number.",
        type: "string",
      },
      phone_number_id: {
        description: "Business phone number ID.",
        type: "string",
      },
    },
    required: ["display_phone_number", "phone_number_id"],
  },
  ContactProfile: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        properties: {
          name: {
            description: "WhatsApp user's name as it appears in their profile in the WhatsApp client.",
            type: "string",
          },
        },
        required: ["name"],
      },
      wa_id: {
        description: "WhatsApp user ID. Note that a WhatsApp user's ID and phone number may not always match.",
        type: "string",
      },
    },
    required: ["profile"],
  },
  IncomingMessageValueGeneral: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Always 'whatsapp'.",
        type: "string",
      },
      metadata: {
        type: "ref",
        ref: "Metadata",
      },
      contacts: {
        description: "Array of contact profiles for the sender. Included for all non-system incoming messages.",
        type: "array",
        items: {
          type: "ref",
          ref: "ContactProfile",
        },
      },
      messages: {
        description: "Array of message objects. The structure varies based on the 'type' property.",
        type: "array",
        items: {
          type: "ref",
          ref: "IncomingMessage",
        },
      },
    },
    required: ["messaging_product", "metadata", "contacts", "messages"],
  },
  IncomingMessageValueSystem: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Always 'whatsapp'.",
        type: "string",
      },
      metadata: {
        type: "ref",
        ref: "Metadata",
      },
      messages: {
        description: "Array containing only 'system' message objects.",
        type: "array",
        items: {
          type: "ref",
          ref: "SystemMessage",
        },
      },
    },
    required: ["messaging_product", "metadata", "messages"],
  },
  StatusMessageValue: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Always 'whatsapp'.",
        type: "string",
      },
      metadata: {
        type: "ref",
        ref: "Metadata",
      },
      statuses: {
        description: "Array of status objects.",
        type: "array",
        items: {
          type: "ref",
          ref: "Statuses",
        },
      },
    },
    required: ["messaging_product", "metadata", "statuses"],
  },
  Statuses: {
    type: "object",
    properties: {
      id: {
        description: "Unique WhatsApp message ID the status is associated with.",
        type: "string",
      },
      status: {
        type: "string",
        enum: ["sent", "delivered", "read", "failed"],
      },
      timestamp: {
        type: "string",
      },
      recipient_id: {
        description: "Recipeint phone number.",
        type: "string",
      },
      group_id: {
        description: "Group ID if the message was sent to a group.",
        type: "string",
      },
      conversation: {
        type: "ref",
        ref: "Conversation",
      },
      pricing: {
        type: "ref",
        ref: "Pricing",
      },
      errors: {
        type: "array",
        items: {
          type: "ref",
          ref: "StatusError",
        },
      },
    },
    required: ["id", "status", "timestamp", "recipient_id"],
  },
  Conversation: {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
      expiration_timestamp: {
        type: "string",
      },
      origin: {
        type: "ref",
        ref: "ConversationOrigin",
      },
    },
    required: [],
  },
  ConversationOrigin: {
    type: "object",
    properties: {
      type: {
        type: "string",
      },
    },
    required: [],
  },
  Pricing: {
    type: "object",
    properties: {
      billable: {
        type: "boolean",
      },
      pricing_model: {
        type: "string",
        enum: ["CBP", "PMP"],
      },
      category: {
        type: "string",
      },
    },
    required: [],
  },
  StatusError: {
    type: "object",
    properties: {
      code: {
        type: "integer",
      },
      title: {
        type: "string",
      },
      message: {
        type: "string",
      },
      error_data: {
        type: "ref",
        ref: "ErrorData",
      },
      href: {
        type: "string",
      },
    },
    required: [],
  },
  ErrorData: {
    type: "object",
    properties: {
      details: {
        type: "string",
      },
    },
    required: [],
  },
  GroupValue: {
    type: "object",
    properties: {
      messaging_product: {
        description: "Always 'whatsapp'.",
        type: "string",
      },
      metadata: {
        type: "ref",
        ref: "Metadata",
      },
      groups: {
        description: "Array of group objects.",
        type: "array",
        items: {
          type: "ref",
          ref: "Groups",
        },
      },
    },
    required: ["messaging_product", "metadata", "groups"],
  },
  Groups: {
    type: "object",
    properties: {
      timestamp: {
        description: "Unix timestamp of the group event",
        type: "integer",
      },
      group_id: {
        description: "Unique identifier for the group",
        type: "string",
      },
      type: {
        description: "Type of group event",
        type: "string",
        enum: [
          "group_create",
          "group_delete",
          "group_settings_update",
          "group_add_participants",
          "group_remove_participants",
        ],
      },
      request_id: {
        description: "Unique identifier for the request",
        type: "string",
      },
      subject: {
        description: "Group subject/name",
        type: "string",
      },
      description: {
        description: "Group description",
        type: "string",
      },
      added_participants: {
        description: "List of participants added to the group",
        type: "array",
        items: {
          type: "ref",
          ref: "GroupParticipant",
        },
      },
      removed_participants: {
        description: "List of participants removed from the group",
        type: "array",
        items: {
          type: "ref",
          ref: "GroupParticipant",
        },
      },
      profile_picture: {
        description: "Group profile picture information",
        type: "ref",
        ref: "GroupProfilePicture",
      },
    },
    required: ["timestamp", "group_id", "type", "request_id"],
  },
  GroupParticipant: {
    type: "object",
    properties: {
      input: {
        description: "Input phone number or WhatsApp ID",
        type: "string",
      },
      wa_id: {
        description: "WhatsApp ID of the participant",
        type: "string",
      },
    },
    required: [],
  },
  GroupProfilePicture: {
    type: "object",
    properties: {
      mime_type: {
        description: "MIME type of the profile picture",
        type: "string",
      },
      sha256: {
        description: "SHA256 hash of the profile picture",
        type: "string",
      },
    },
    required: [],
  },
  BaseMessageProperties1: {
    type: "object",
    properties: {
      from: {
        description:
          "WhatsApp user phone number. Note that a WhatsApp user's phone number and ID may not always match.",
        type: "string",
      },
      id: {
        description: "Unique WhatsApp message ID.",
        type: "string",
      },
      timestamp: {
        description: "Unix timestamp indicating when the webhook was triggered.",
        type: "string",
      },
    },
    required: ["from", "id", "timestamp"],
  },
  IncomingMessage: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "TextMessage",
      },
      {
        type: "ref",
        ref: "ReactionMessage",
      },
      {
        type: "ref",
        ref: "AudioMessage",
      },
      {
        type: "ref",
        ref: "DocumentMessage",
      },
      {
        type: "ref",
        ref: "ImageMessage",
      },
      {
        type: "ref",
        ref: "StickerMessage",
      },
      {
        type: "ref",
        ref: "VideoMessage",
      },
      {
        type: "ref",
        ref: "LocationMessage",
      },
      {
        type: "ref",
        ref: "ContactSharingMessage",
      },
      {
        type: "ref",
        ref: "UnsupportedMessage",
      },
      {
        type: "ref",
        ref: "ButtonMessage",
      },
      {
        type: "ref",
        ref: "InteractiveMessageReply",
      },
      {
        type: "ref",
        ref: "OrderMessage",
      },
    ],
  },
  TextMessage2: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text"],
          },
          text: {
            type: "object",
            properties: {
              body: {
                description: "Text body of the message.",
                type: "string",
              },
            },
            required: ["body"],
          },
          context: {
            type: "ref",
            ref: "ContextObject",
          },
          referral: {
            type: "ref",
            ref: "ReferralObject",
          },
        },
        required: ["type", "text"],
      },
    ],
  },
  ContextObject: {
    description: 'Only included if message via a "Message business" button.',
    type: "object",
    properties: {
      from: {
        description: "Business display phone number.",
        type: "string",
      },
      id: {
        description: 'WhatsApp message ID of the message the user used to access the "Message business" button.',
        type: "string",
      },
      referred_product: {
        type: "object",
        properties: {
          catalog_id: {
            description: "Product catalog ID.",
            type: "string",
          },
          product_retailer_id: {
            description: "Product ID.",
            type: "string",
          },
        },
        required: ["catalog_id", "product_retailer_id"],
      },
    },
    required: ["from", "id", "referred_product"],
  },
  ReferralObject: {
    description: "Only included if message via a Click to WhatsApp ad.",
    type: "object",
    properties: {
      source_url: {
        description: "Ad URL.",
        type: "string",
      },
      source_id: {
        description: "Ad ID.",
        type: "string",
      },
      source_type: {
        type: "string",
        enum: ["ad", "post"],
      },
      body: {
        description: "Ad primary text.",
        type: "string",
      },
      headline: {
        description: "Ad headline.",
        type: "string",
      },
      media_type: {
        type: "string",
        enum: ["image", "video"],
      },
      image_url: {
        description: "Only included for image media_type.",
        type: "string",
      },
      video_url: {
        description: "Only included for video media_type.",
        type: "string",
      },
      thumbnail_url: {
        description: "Only included for video media_type.",
        type: "string",
      },
      ctwa_clid: {
        description: "Ad click ID.",
        type: "string",
      },
      welcome_message: {
        type: "object",
        properties: {
          text: {
            description: "Ad greeting text.",
            type: "string",
          },
        },
        required: ["text"],
      },
    },
    required: ["source_url", "source_id", "source_type", "body", "headline", "media_type", "ctwa_clid"],
  },
  ReactionMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["reaction"],
          },
          reaction: {
            type: "object",
            properties: {
              message_id: {
                description: "WhatsApp message ID of the message the WhatsApp user reacted to.",
                type: "string",
              },
              emoji: {
                description: "Emoji sent by the WhatsApp user as a reaction.",
                type: "string",
              },
            },
            required: ["message_id", "emoji"],
          },
        },
        required: ["type", "reaction"],
      },
    ],
  },
  MediaMessageProperties: {
    type: "object",
    properties: {
      mime_type: {
        description: "Media asset MIME type.",
        type: "string",
      },
      sha256: {
        description: "Media asset SHA-256 hash.",
        type: "string",
      },
      id: {
        description: "Media asset ID. A GET request on this ID can provide the asset URL.",
        type: "string",
      },
    },
    required: ["mime_type", "sha256", "id"],
  },
  AudioMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["audio"],
          },
          audio: {
            type: "allOf",
            of: [
              {
                type: "ref",
                ref: "MediaMessageProperties",
              },
              {
                type: "object",
                properties: {
                  voice: {
                    description:
                      "Boolean indicating if audio is a recording made with the WhatsApp client voice recording feature (true) or not (false).",
                    type: "boolean",
                  },
                },
                required: ["voice"],
              },
            ],
          },
        },
        required: ["type", "audio"],
      },
    ],
  },
  DocumentMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["document"],
          },
          document: {
            type: "allOf",
            of: [
              {
                type: "ref",
                ref: "MediaMessageProperties",
              },
              {
                type: "object",
                properties: {
                  filename: {
                    description: "Media asset filename.",
                    type: "string",
                  },
                },
                required: ["filename"],
              },
            ],
          },
        },
        required: ["type", "document"],
      },
    ],
  },
  ImageMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["image"],
          },
          image: {
            type: "allOf",
            of: [
              {
                type: "ref",
                ref: "MediaMessageProperties",
              },
              {
                type: "object",
                properties: {
                  caption: {
                    description: "Media asset caption text.",
                    type: "string",
                  },
                },
                required: [],
              },
            ],
          },
        },
        required: ["type", "image"],
      },
    ],
  },
  StickerMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["sticker"],
          },
          sticker: {
            type: "allOf",
            of: [
              {
                type: "ref",
                ref: "MediaMessageProperties",
              },
              {
                type: "object",
                properties: {
                  animated: {
                    description: "Boolean indicating if the sticker is animated (true) or not (false).",
                    type: "boolean",
                  },
                },
                required: ["animated"],
              },
            ],
          },
        },
        required: ["type", "sticker"],
      },
    ],
  },
  VideoMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["video"],
          },
          video: {
            type: "allOf",
            of: [
              {
                type: "ref",
                ref: "MediaMessageProperties",
              },
              {
                type: "object",
                properties: {
                  caption: {
                    description: "Media asset caption text.",
                    type: "string",
                  },
                },
                required: [],
              },
            ],
          },
        },
        required: ["type", "video"],
      },
    ],
  },
  LocationMessage1: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["location"],
          },
          location: {
            type: "object",
            properties: {
              address: {
                description: "Location address.",
                type: "string",
              },
              latitude: {
                description: "Location latitude.",
                type: "number",
              },
              longitude: {
                description: "Location longitude.",
                type: "number",
              },
              name: {
                description: "Location name.",
                type: "string",
              },
              url: {
                description: "Location URL. Usually only included for business locations.",
                type: "string",
              },
            },
            required: ["address", "latitude", "longitude", "name"],
          },
        },
        required: ["type", "location"],
      },
    ],
  },
  ContactSharingMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["contacts"],
          },
          contacts: {
            description:
              "Array of contact objects. Many contact object properties may be omitted if the WhatsApp user chooses not to share them, or their device prevents them from being shared.",
            type: "array",
            items: {
              type: "ref",
              ref: "ContactObject",
            },
          },
        },
        required: ["type", "contacts"],
      },
    ],
  },
  ContactObject1: {
    type: "object",
    properties: {
      addresses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            city: {
              description: "City mentioned in the contact address",
              type: "string",
            },
            country: {
              description: "Country mentioned in the contact address",
              type: "string",
            },
            country_code: {
              description: "ISO country code for the contact address",
              type: "string",
            },
            state: {
              description: "State mentioned in the contact address",
              type: "string",
            },
            street: {
              description: "Street mentioned in the contact address",
              type: "string",
            },
            type: {
              description: "Type of address, such as home or work",
              type: "string",
            },
            zip: {
              description: "Zip code in the contact address",
              type: "string",
            },
          },
          required: [],
        },
      },
      birthday: {
        description: "Contact birthday (YYYY-MM-DD).",
        type: "string",
      },
      emails: {
        type: "array",
        items: {
          type: "object",
          properties: {
            email: {
              description: "Email address of the contact",
              type: "string",
            },
            type: {
              description: "Type of email, such as personal or work",
              type: "string",
            },
          },
          required: [],
        },
      },
      name: {
        type: "object",
        properties: {
          formatted_name: {
            description: "Contact's formatted name",
            type: "string",
          },
          first_name: {
            description: "Contact’s first name",
            type: "string",
          },
          last_name: {
            description: "Contact’s last name",
            type: "string",
          },
          middle_name: {
            description: "Contact’s middle name",
            type: "string",
          },
          suffix: {
            description: "Contact’s name suffix",
            type: "string",
          },
          prefix: {
            description: "Contact’s name prefix",
            type: "string",
          },
        },
        required: ["formatted_name"],
      },
      org: {
        type: "object",
        properties: {
          company: {
            description: "Name of the company where the contact works",
            type: "string",
          },
          department: {
            description: "Name of the department where the contact works",
            type: "string",
          },
          title: {
            description: "Contact's job title",
            type: "string",
          },
        },
        required: [],
      },
      phones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phone: {
              description: "Contact’s Phone number",
              type: "string",
            },
            wa_id: {
              description:
                "Contact's WhatsApp Number. Note that a WhatsApp user's ID and phone number may not always match.",
              type: "string",
            },
            type: {
              description: "Type of phone number. For example, cell, mobile, main, iPhone, home, work, etc.",
              type: "string",
            },
          },
          required: [],
        },
      },
      urls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: {
              description: "Website URL associated with the contact or their company",
              type: "string",
            },
            type: {
              description: "Type of website. For example, company, work, personal, Facebook Page, Instagram, etc.",
              type: "string",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  UnsupportedMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["unsupported", "unknown"],
          },
          errors: {
            type: "array",
            items: {
              type: "ref",
              ref: "ErrorObject",
            },
          },
        },
        required: ["type", "errors"],
      },
    ],
  },
  ErrorObject2: {
    type: "object",
    properties: {
      code: {
        description: "Error code.",
        type: "integer",
      },
      title: {
        description: "Error code title.",
        type: "string",
      },
      message: {
        description: "Error code message.",
        type: "string",
      },
      error_data: {
        type: "object",
        properties: {
          details: {
            description: "Error code details.",
            type: "string",
          },
        },
        required: ["details"],
      },
      href: {
        description: "Link to error code documentation.",
        type: "string",
      },
    },
    required: ["code", "title", "message", "error_data"],
  },
  ButtonMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["button"],
          },
          context: {
            type: "object",
            properties: {
              from: {
                description: "Business display phone number.",
                type: "string",
              },
              id: {
                description: "WhatsApp message ID of the message containing the button the WhatsApp user tapped.",
                type: "string",
              },
            },
            required: ["from", "id"],
          },
          button: {
            type: "object",
            properties: {
              payload: {
                description: "Quick-reply button payload.",
                type: "string",
              },
              text: {
                description: "Quick-reply button label text.",
                type: "string",
              },
            },
            required: ["payload", "text"],
          },
        },
        required: ["type", "context", "button"],
      },
    ],
  },
  InteractiveMessageReply: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["interactive"],
          },
          context: {
            type: "object",
            properties: {
              from: {
                description: "Business display phone number.",
                type: "string",
              },
              id: {
                description: "WhatsApp message ID of the message containing the interactive component the user tapped.",
                type: "string",
              },
            },
            required: ["from", "id"],
          },
          interactive: {
            type: "object",
            properties: {
              type: {
                description: "Type of interactive reply (list_reply or button_reply).",
                type: "string",
                enum: ["list_reply", "button_reply"],
              },
            },
            required: ["type"],
          },
        },
        required: ["type", "context", "interactive"],
      },
    ],
  },
  InteractiveListReplyContent: {
    type: "object",
    properties: {
      list_reply: {
        type: "object",
        properties: {
          id: {
            description: "Row ID.",
            type: "string",
          },
          title: {
            description: "Row title.",
            type: "string",
          },
          description: {
            description: "Row description.",
            type: "string",
          },
        },
        required: ["id", "title", "description"],
      },
    },
    required: ["list_reply"],
  },
  InteractiveButtonReplyContent: {
    type: "object",
    properties: {
      button_reply: {
        type: "object",
        properties: {
          id: {
            description: "Button ID.",
            type: "string",
          },
          title: {
            description: "Button label text.",
            type: "string",
          },
        },
        required: ["id", "title"],
      },
    },
    required: ["button_reply"],
  },
  OrderMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["order"],
          },
          order: {
            type: "object",
            properties: {
              catalog_id: {
                description: "Product catalog ID.",
                type: "string",
              },
              text: {
                description: "Empty string.",
                type: "string",
              },
              product_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_retailer_id: {
                      description: "Product ID.",
                      type: "string",
                    },
                    quantity: {
                      description: "Product quantity.",
                      type: "integer",
                    },
                    item_price: {
                      description: "Individual product price.",
                      type: "number",
                    },
                    currency: {
                      description: "Catalog currency code.",
                      type: "string",
                    },
                  },
                  required: ["product_retailer_id", "quantity", "item_price", "currency"],
                },
              },
            },
            required: ["catalog_id", "text", "product_items"],
          },
        },
        required: ["type", "order"],
      },
    ],
  },
  SystemMessage: {
    type: "allOf",
    of: [
      {
        type: "ref",
        ref: "BaseMessageProperties",
      },
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["system"],
          },
          system: {
            type: "object",
            properties: {
              body: {
                description: "Description of the system change (e.g., user changed number).",
                type: "string",
              },
              wa_id: {
                description:
                  "The user's WhatsApp ID. On user_changed_number messages this is the new phone number. Omitted when the user has no phone number visible to the business.",
                type: "string",
              },
              type: {
                description:
                  "Type of system message. user_changed_number reports a change to the user's phone number and carries the new number. user_changed_user_id reports a change to the user's business-scoped user ID, with no phone number included.",
                type: "string",
                enum: ["user_changed_number", "user_changed_user_id"],
              },
              user_id: {
                description:
                  "The user's current business-scoped user ID (BSUID). Omitted when business-scoped user IDs are not enabled for the business.",
                type: "string",
              },
              parent_user_id: {
                description:
                  "The user's current business-scoped user ID (BSUID) scoped to the parent business portfolio. Omitted when the business is not onboarded to parent-scoped IDs.",
                type: "string",
              },
              previous_user_id: {
                description:
                  "The business-scoped user ID (BSUID) the user had before the change. Omitted when the previous BSUID is unavailable.",
                type: "string",
              },
              previous_parent_user_id: {
                description:
                  "The parent-scoped business-scoped user ID (BSUID) the user had before the change. Omitted when the previous parent BSUID is unavailable.",
                type: "string",
              },
            },
            required: ["body", "type"],
          },
        },
        required: ["type", "system"],
      },
    ],
  },
  GetBusinessPortfolioResponse: {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
      name: {
        type: "string",
      },
      timezone_id: {
        type: "number",
      },
    },
    required: [],
  },
  BlockUsersRequest: {
    type: "object",
    properties: {
      block_users: {
        type: "array",
        items: {
          type: "object",
          properties: {
            user: {
              type: "string",
            },
          },
          required: [],
        },
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  UnblockUsersRequest: {
    type: "object",
    properties: {
      block_users: {
        type: "array",
        items: {
          type: "object",
          properties: {
            user: {
              type: "string",
            },
          },
          required: [],
        },
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  ManageCallsRequest: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "CallRequestPayload",
      },
      {
        type: "ref",
        ref: "CallTerminateRequestPayload",
      },
    ],
  },
  ManageCallsResponse: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "CallResponsePayload",
      },
      {
        type: "ref",
        ref: "CallTerminateResponsePayload",
      },
    ],
  },
  UploadMediaRequest: {
    type: "object",
    properties: {
      file: {
        type: "string",
        format: "binary",
      },
      messaging_product: {
        type: "string",
      },
    },
    required: [],
  },
  UploadMediaResponse: {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
    },
    required: [],
  },
  CreateOrUpdateQrCodeRequest: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "CreateQrCodeRequest",
      },
      {
        type: "ref",
        ref: "UpdateQrCodeRequest",
      },
    ],
  },
  UpdatePhoneNumberResponse: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "MessageResponse",
      },
      {
        type: "ref",
        ref: "SuccessResponse",
      },
    ],
  },
  UpdatePhoneNumberSettingsRequest: {
    type: "union",
    of: [
      {
        type: "ref",
        ref: "CallingSettingsRequest",
      },
      {
        type: "ref",
        ref: "UserIdentityChangeSettingsRequest",
      },
      {
        type: "ref",
        ref: "PayloadEncryptionSettingsRequest",
      },
      {
        type: "ref",
        ref: "StorageConfigurationSettingsRequest",
      },
    ],
  },
  UpdatePhoneNumberSettingsResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  GetEncryptionPublicKeyResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessEncryptionInfo",
        },
      },
    },
    required: [],
  },
  GetCommerceSettingsResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            is_cart_enabled: {
              type: "boolean",
            },
            is_catalog_visible: {
              type: "boolean",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  SetCommerceSettingsResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  GetBusinessComplianceInfoResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "ref",
          ref: "BusinessComplianceInfo",
        },
      },
    },
    required: [],
  },
  UpdateBusinessComplianceInfoResponse: {
    type: "object",
    properties: {
      success: {
        description: "Indicates whether the compliance information was successfully updated",
        type: "boolean",
      },
    },
    required: ["success"],
  },
  GetMediaResponse: {
    type: "object",
    properties: {
      file_size: {
        type: "string",
      },
      id: {
        type: "string",
      },
      messaging_product: {
        type: "string",
      },
      mime_type: {
        type: "string",
      },
      sha256: {
        type: "string",
      },
      url: {
        type: "string",
      },
    },
    required: [],
  },
  DeleteMediaResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  AddAssignedUserRequest: {
    type: "object",
    properties: {
      user: {
        description:
          "User ID of the person to add to the WhatsApp Business Account.\nThis must be a valid Facebook user ID.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
      tasks: {
        description:
          "Array of permission tasks to grant to the user. These tasks determine\nwhat actions the user can perform on the WhatsApp Business Account.\n",
        type: "array",
        items: {
          type: "ref",
          ref: "WhatsAppBusinessAccountPermissionTask",
        },
        minItems: 1,
        maxItems: 16,
      },
    },
    required: ["user", "tasks"],
  },
  RemoveAssignedUserRequest: {
    type: "object",
    properties: {
      user: {
        description:
          "User ID of the person to remove from the WhatsApp Business Account.\nThis must be a valid Facebook user ID that is currently assigned to the account.\n",
        type: "string",
        pattern: "^[0-9]+$",
      },
    },
    required: ["user"],
  },
  GetCreditLinesResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            legal_entity_name: {
              type: "string",
            },
          },
          required: [],
        },
      },
    },
    required: [],
  },
  GetTemplateResponse: {
    type: "object",
    properties: {
      category: {
        type: "string",
      },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                  },
                  type: {
                    type: "string",
                  },
                },
                required: [],
              },
            },
            example: {
              type: "object",
              properties: {
                body_text: {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
              required: [],
            },
            format: {
              type: "string",
            },
            text: {
              type: "string",
            },
            type: {
              type: "string",
            },
          },
          required: [],
        },
      },
      id: {
        type: "string",
      },
      language: {
        type: "string",
      },
      name: {
        type: "string",
      },
      status: {
        type: "string",
      },
    },
    required: [],
  },
  EditTemplateRequest: {
    type: "object",
    properties: {
      category: {
        type: "string",
      },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                  },
                  type: {
                    type: "string",
                  },
                },
                required: [],
              },
            },
            example: {
              type: "object",
              properties: {
                body_text: {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
              required: [],
            },
            format: {
              type: "string",
            },
            text: {
              type: "string",
            },
            type: {
              type: "string",
            },
          },
          required: [],
        },
      },
      language: {
        type: "string",
      },
      name: {
        type: "string",
      },
    },
    required: [],
  },
  EditTemplateResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  ListTemplatesResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
            },
            components: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  buttons: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: {
                          type: "string",
                        },
                        type: {
                          type: "string",
                        },
                      },
                      required: [],
                    },
                  },
                  example: {
                    type: "object",
                    properties: {
                      body_text: {
                        type: "array",
                        items: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                      },
                    },
                    required: [],
                  },
                  format: {
                    type: "string",
                  },
                  text: {
                    type: "string",
                  },
                  type: {
                    type: "string",
                  },
                },
                required: [],
              },
            },
            id: {
              type: "string",
            },
            language: {
              type: "string",
            },
            name: {
              type: "string",
            },
            status: {
              type: "string",
            },
          },
          required: [],
        },
      },
      paging: {
        type: "object",
        properties: {
          cursors: {
            type: "object",
            properties: {
              after: {
                type: "string",
              },
              before: {
                type: "string",
              },
            },
            required: [],
          },
        },
        required: [],
      },
    },
    required: [],
  },
  CreateTemplateRequest: {
    type: "object",
    properties: {
      category: {
        type: "string",
      },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  flow_action: {
                    type: "string",
                  },
                  flow_id: {
                    type: "string",
                  },
                  navigate_screen: {
                    type: "string",
                  },
                  text: {
                    type: "string",
                  },
                  type: {
                    type: "string",
                  },
                },
                required: [],
              },
            },
            text: {
              type: "string",
            },
            type: {
              type: "string",
            },
          },
          required: [],
        },
      },
      language: {
        type: "string",
      },
      name: {
        type: "string",
      },
    },
    required: [],
  },
  CreateTemplateResponse: {
    type: "object",
    properties: {
      category: {
        type: "string",
      },
      id: {
        type: "string",
      },
      status: {
        type: "string",
      },
    },
    required: [],
  },
  DeleteTemplateResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
  UpdateBusinessAccountRequest: {
    type: "object",
    properties: {
      name: {
        description: "Updated name for the WhatsApp Business Account",
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      timezone_id: {
        description: "Updated timezone identifier for the WhatsApp Business Account",
        type: "string",
      },
    },
    required: [],
  },
  UpdateBusinessAccountResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
      },
    },
    required: [],
  },
}
