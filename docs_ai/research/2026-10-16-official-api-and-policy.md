# WhatsApp official platform and policy: research for a two-mode CLI (checked 2026-10-16)

How to read the tags:
- **[P]**: I read this on a Meta or WhatsApp page myself.
- **[P-snippet]**: the page is Meta's or WhatsApp's own, but it loads with JavaScript, so I saw its text only as a search-engine excerpt.
- **[S]**: secondary source (press or vendor) only. Not confirmed on a Meta page.

Meta moved its WhatsApp docs from `developers.facebook.com/docs/whatsapp/...` to `developers.facebook.com/documentation/business-messaging/whatsapp/...`. Many old URLs now return 404. Adding `.md` to a new URL gives a clean text version of the page, and there is an index at [llms.txt](https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt).

---

## 1. Cloud API

### Getting access [P]
Source: [Get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
1. Register as a Meta developer. Create an app with the use case "Connect with customers through WhatsApp".
2. In API Setup, connect an existing WhatsApp Business Account (WABA) or create one. Keep the WABA ID.
3. Use the test "From" number that Meta provides, or add your own number. Keep the phone-number ID.
4. The access token from "Generate access token" "expires quickly and is not suitable for development purposes".
5. For a permanent token: in Business Settings, create a **system user**. Give it the app (Manage app) and the WABA (Full control). Then generate a token with the scopes `business_management`, `whatsapp_business_messaging` and `whatsapp_business_management`.
6. The page sends you to a separate guide to add and register a real business number.

### Graph API version [P]
- Latest version: **v26.0, released 2026-07-29**. v25.0 came out 2026-02-18 and v24.0 on 2025-10-08 ([changelog](https://developers.facebook.com/docs/graph-api/changelog)).
- The WhatsApp doc samples still use v25.0 ([send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages.md)). The get-started page still uses v23.0.
- **For the CLI:** make the version a setting. Default it to v25.0 or v26.0.

### Inbound messages need a webhook [P]
Source: [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint.md)
- You need an HTTPS endpoint with a valid certificate. "Self-signed certificates are not supported."
- Verification: Meta sends a GET request with `hub.mode=subscribe`, `hub.challenge` and `hub.verify_token`. You check the token and reply with the challenge.
- Each payload is signed. The header `X-Hub-Signature-256: sha256=<hex>` is an HMAC-SHA256 of the raw body, keyed with the app secret.
- Meta retries failed deliveries "with decreasing frequency until the request succeeds, for up to 7 days". Duplicates are possible. Payloads can be up to 3 MB. Mutual TLS is supported, and Meta recommends it over IP allowlists. Some webhooks are not sent while the app is in Dev mode ([webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview.md)).
- **There is no polling endpoint.** The docs describe only push delivery.
- **Impact on a local CLI:** you need one of these:
  - a public tunnel (Cloudflare Tunnel, ngrok), or
  - a small always-on receiver (for example a Cloudflare Worker or a Hetzner box) that stores events, which the CLI then pulls.

  I think the receiver is the better option. Meta retries for 7 days, and a laptop that is offline should not lose events.

### Message types [P]
Source: [send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages.md)
- **Inside the service window:** text, image, video, audio, document, sticker, location, contacts, address request, reaction.
- **Interactive messages:** reply buttons, list, CTA URL, location request, voice-call button, Flows.
- **Commerce messages** are also supported.
- You can reply to a specific message (contextual reply).
- Templates are required outside the window. "Non-template messages work only inside the 24-hour customer service window" ([get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)).

### Media [P]
Source: [media](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md)

| Type | Max size |
|---|---|
| Audio (AAC, AMR, MP3, M4A, OGG/Opus mono) | 16 MB |
| Document | 100 MB |
| Image (JPEG, PNG) | 5 MB |
| Video (MP4, 3GP) | 16 MB |
| Sticker (WebP) | 100 KB static, 500 KB animated |

- Media you upload persists for 30 days.
- Media IDs that arrive in webhooks expire after 7 days.
- A download URL is valid for only **5 minutes**.

### Read receipts and typing indicator [P]
- One POST to `/<PHONE_NUMBER_ID>/messages` does both. The body has `status: "read"`, the `message_id` and `typing_indicator: {type: "text"}`.
- The indicator disappears when you reply or after 25 seconds, whichever comes first ([typing indicators](https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators.md)).

### What it cannot do
- **No polling, no "list chats", no "fetch history".** The API surface is send plus webhooks. Inbound messages arrive only by webhook ([webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview.md)). This point is my inference: I found no read or list endpoint for messages in the docs index ([llms.txt](https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt)).
- **The only past history** you can get is the 180-day sync when you onboard a Business-app number through Coexistence (section 5).
- **No free-form outbound message to a user** who has not written to you in the last 24 hours. You must send a paid template.

### Groups API: exists, but small [P]
Source: [Groups](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups.md); added 2025-10-06 per the [changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog/)
- "Open to all businesses with an Official Business Account (OBA)". An OBA is the verified business badge.
- Maximum **8 participants**. Up to 10,000 groups per business number. One Cloud API business per group.
- Users join only by an invite link.
- Supported: text, media and templates.
- Not supported: interactive messages, calls, disappearing messages, view-once, edit and delete.
- "Groups are not available for WhatsApp Business app phone numbers." So no groups on a Coexistence number.
- **Impact:** groups are not usable for a solo developer without the OBA badge.

## 2. On-Premises API: shut down [P]
Source: [sunset page](https://developers.facebook.com/docs/whatsapp/on-premises/sunset)

| Date | What happened |
|---|---|
| 2024-01-09 | New features ship to Cloud API only |
| 2024-07-01 | New numbers can register only on Cloud API |
| **2025-10-23** | The final version (v2.63) expired. Messages to or from numbers still on On-Premises are no longer delivered |

The [changelog](https://developers.facebook.com/docs/whatsapp/on-premises/changelog) names v2.61.1 as the last release, which conflicts with v2.63. This is a small conflict and does not matter for us: **only the Cloud API is left.**

## 3. Pricing and limits [P]
Source: [pricing](https://developers.facebook.com/docs/whatsapp/pricing); [pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)

### How you pay
- **Per message since 2025-07-01.** Before that date, Meta charged per conversation.
- You pay **only for delivered template messages**. The rate depends on the template category and the recipient's country code.
- **Customer service window (CSW):** 24 hours that start each time the user messages you. Inside it:
  - non-template replies are free (the webhook marks them `free_customer_service`);
  - "Utility templates delivered within an open customer service window are free".
- **Free entry point:** a user who arrives from a Click-to-WhatsApp ad or a Facebook Page button opens a 72-hour window. Inside it, everything is free, templates included.
- Template categories: **marketing, utility, authentication**.
- Meta changes prices only on the first day of a quarter.

### 2026 changes
| Date | Change |
|---|---|
| 2026-01-01 | India marketing rate up. France and Egypt marketing rates down. North America utility and authentication rates down |
| 2026-04-01 | Several country changes. Eight new billing currencies |
| **2026-07-01** | Current rate cards. **Spain**, Italy and the UK got higher marketing rates. Some markets became standalone, with their own volume tiers |
| 2026-10-01 | More markets moved out of the "Rest of" regions: Bangladesh, Iraq, Nepal, Sri Lanka down; Kazakhstan, Kuwait, Morocco, Oman, Ukraine up |
| By 2026-12-31 | India customers must bill in INR |
| By 2027-06-30 | Brazil customers must bill in BRL |

### AI Providers fee [P]
Source: [AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers.md); [changelog 2026-05-12](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog/)
- From 2026-02-16, Meta charges "AI Providers" for **every non-template message** to users in markets where Meta must legally allow them:
  - Italy: from 2026-02-16;
  - Brazil: from 2026-03-11;
  - 29 EU/EEA countries: from 2026-03-11.
- **From 2026-05-13 the charge stopped in the EU/EEA. Brazil remains.**
- The rate is in Meta's rate card, not on the page. Press reports give about €0.057 per message for Italy [S] ([lapaasvoice](https://lapaasvoice.com/whatsapp-italy-ai-chatbot-charges-meta-api-2026/)).

### Templates [P]
Source: [templates overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview.md)
- Every template is reviewed automatically. "Review can take up to 24 hours."
- Statuses include APPROVED, PAUSED and DISABLED.
- Limits: 250 templates per WABA when the business is unverified, 6,000 when verified. You can create at most 100 per hour.
- Low quality ratings lead to pause, then disable.

### Messaging limits [P]
Source: [messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md)
- The limit counts **unique users per rolling 24 hours that you message outside a service window**.
- Tiers: 250 (new business portfolio) → 2,000 → 10,000 → 100,000 → unlimited.
- The limit is shared by every number in the **business portfolio**.
- To reach 2,000, do one of these: business verification, or deliver 2,000 high-quality messages in 30 days.
- After that, the limit rises automatically: about 6 hours after you use at least half your limit over 7 days with good quality.

## 4. Policy: AI chatbot ban, usernames and BSUID

### General-purpose AI assistants: banned since 2026-01-15
- **What Meta's own page says [P]:** AI Providers are "only permitted to offer general-purpose AI assistants on the WhatsApp Business Platform where Meta is legally required to permit this use case", under the terms updated 2026-01-15. Meta defines AI Providers as "Providers and developers of artificial intelligence or machine learning technologies, such as large language models … generative artificial intelligence platforms, general-purpose artificial intelligence assistants" ([AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers.md)).
- **The terms clause itself:** I could not read it. The terms page ([Meta Terms for WhatsApp Business Platform](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), which `whatsapp.com/legal/business-solution-terms` now redirects to) blocks fetching. **Its wording is [S].** Press quotes it as follows:
  - AI Providers are barred "directly or indirectly" when AI is the "primary (rather than incidental or ancillary) functionality", "as determined by Meta in its sole discretion";
  - a business may still hire an AI Provider as its Solution Provider;
  - Business Solution Data may not train AI models, except fine-tuning for the business's own exclusive use.

  Sources: [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/), [MediaNama](https://www.medianama.com/2025/10/223-whatsapp-bans-external-ai-providers-business-api/).
- **What remains allowed:** AI used *incidentally* to the business's service, such as support bots, bookings or order status. Meta told TechCrunch the ban does not hit customer-service AI [S].
- **Impact on the CLI:** a "chat with my LLM over WhatsApp" bot for the public is out of bounds. An LLM that helps the owner triage their own business inbox fits "incidental" use. This is my reading of the policy, not a ruling from Meta.

### Usernames and BSUID [P]
Source: [Business-scoped user IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids.md)
- **BSUID** means "business-scoped user ID": a per-business ID for a user. BSUIDs have appeared in webhooks since **early April 2026**, as `user_id`, `from_user_id` and `recipient_user_id`. The user's `username` is also sent when they have one.
- Businesses can reserve usernames from **2026-06-29**.
- **Sending to a BSUID has been supported since July 2026.** Put the BSUID in `recipient` and leave out `to`. If you send both, `to` wins. Error 131062 means the BSUID cannot be used for that message. BSUIDs cannot be used for one-tap, zero-tap or copy-code authentication templates.
- **When a user adopts a username,** their phone number (`wa_id` / `from`) is left out of webhooks. Exceptions:
  - you and the user messaged or called each other within the last 30 days (counted per business number);
  - the user is in your contact book.
- A `REQUEST_CONTACT_INFO` button, available since early July 2026, asks the user for their number.
- The page gives no general release date for usernames to users. It says only "gradually in 2026".
- **Impact on the CLI:** use the BSUID as the main contact key, not the phone number.

## 5. WhatsApp Business app and Coexistence

- **The Business app has no API** of its own. The only programmatic route is to onboard its number to the Cloud API through Coexistence. This is my inference: the docs offer no other route.
- **How Coexistence works [P]** ([onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)):
  - It runs through **Embedded Signup**, Meta's sign-up flow for partners.
  - The owner enters the app's number and confirms it with a code shown in the Business app.
  - The owner then chooses whether to share chat history.
  - Who can run it: "**You must already be a Solution Partner or Tech Provider.**" It needs Business app version 2.24.17 or later.
- **History [P]:** messages from the last **180 days** (about 6 months), delivered in three phases. You must start the sync within 24 hours of onboarding, or the owner must offboard and repeat the flow. Messages that later arrive in the phone app reach you as `smb_message_echoes` webhooks ([BSUID page, coexistence section](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids.md)).
- **Limitations [P]:**
  - "Group chats will not be synchronized."
  - View-once and disappearing messages are turned off in 1:1 chats.
  - Broadcast lists become read-only.
  - Existing linked devices are unlinked. Up to 4 companions can be linked again, but not Windows or WearOS.
  - Throughput is fixed at **20 messages per second**.
  - Messages sent from the phone app stay free.
  - The link breaks if the phone is inactive for about 14 days (`PRIMARY_INACTIVITY`).
- **Countries:** the Meta page lists no country restrictions. The changelog of 2025-10-23 added "new supported countries/regions" [P] ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog/)). Vendors report that the EU and UK went live in November 2025 and that most remaining countries followed by 2026 [S] ([ChakraHQ](https://chakrahq.com/article/whatsapp-coexistence-live-eu-uk-europe-whatsapp-business-for-api-live/)).
- **Can a solo developer do it for their own number?** Meta's page says only that you must already be a Tech Provider or Solution Partner.
  - So: **not as a plain direct developer.**
  - You could register yourself as a Tech Provider. I think this needs business verification and app review for Advanced Access to the WhatsApp permissions, but I did not confirm this; the [Tech Provider page](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider.md) does not list the requirements.
  - Vendor posts describe onboarding through a provider's (BSP's) Embedded Signup [S].
  - **Treat it as possible but heavy. Verify it before you plan on it.**

## 6. Personal accounts: terms, enforcement, EU third-party chats

### WhatsApp Terms of Service [P]
- **Global terms** ([terms of service](https://www.whatsapp.com/legal/terms-of-service), effective 2021-01-04):
  - Acceptable Use (e) forbids "sending illegal or impermissible communications such as bulk messaging, auto-messaging, auto-dialing, and the like".
  - "Harm To WhatsApp Or Our Users" forbids, "directly, indirectly, through automated or other means": (a) "reverse engineer, alter, modify, create derivative works from, decompile, or extract code from our Services"; (e) "create accounts … through unauthorized or automated means"; (f) "collect information of or about our users in any impermissible or unauthorized manner"; (i) "create software or APIs that function substantially the same as our Services".
- **EEA terms** ([terms of service EEA](https://www.whatsapp.com/legal/terms-of-service-eea), **effective 2026-08-17**). These apply to Slava in Spain. They have the same clauses, plus (c) "gain or attempt to gain unauthorized access to our Services or systems" and (h) "distribute or make our Services available over a network where they could be used by multiple devices at the same time, except as authorized through tools we have expressly provided via our Services".
- **Messaging Guidelines** ([messaging guidelines](https://www.whatsapp.com/legal/messaging-guidelines)) forbid: "use unofficial clients, bulk messaging, auto-messaging, auto-dialing, or automation to harm WhatsApp or our users". Note the qualifier "to harm". Possible penalties: temporary or permanent suspension.
- **Impact:** a self-written linked-device client is an unofficial client. It is very likely outside the terms, whatever volume it sends.

### Enforcement history
- **2019:** WhatsApp announced legal action against unauthorized automated or bulk messaging from **2019-12-07**, including action based on off-platform evidence such as a company's public marketing claims. It also said it bans about 2 million accounts a month for bulk or automated behaviour.
  - WhatsApp's own page exists: [Unauthorized use of automated or bulk messaging](https://faq.whatsapp.com/5957850900902049/?locale=en_US). It loads with JavaScript, so I saw only its title.
  - The details are [S]: [SecurityWeek](https://www.securityweek.com/whatsapp-will-take-legal-action-against-automated-or-bulk-messaging), [MediaNama](https://www.medianama.com/2019/06/223-whatsapp-will-use-public-information-to-take-legal-action-against-bulk-senders-other-violators-from-december-7/).
- **2022-10:** Meta sued the makers of the modified apps HeyMods, Highlight Mobi and HeyWhatsApp (N.D. Cal., case 3:22-cv-05711). The charge: the apps took over more than 1 million WhatsApp accounts to send spam [S] ([SC Media](https://www.scworld.com/brief/application-security/chinese-firms-sued-by-meta-for-stealing-1m-whatsapp-accounts)). I did not fetch Meta's own newsroom post about it.
- **For scale:** I found no lawsuit against a single developer who automates only their own account. The usual penalty is an account ban. This conclusion comes from the absence of results, so it is not verified.

### EU DMA interoperability: no route for a personal-account client [P]
- On 2025-11-14 Meta announced third-party chats in Europe with **BirdyChat and Haiket** ([Meta newsroom](https://about.fb.com/news/2025/11/messaging-interoperability-whatsapp-enables-third-party-chats-for-users-in-europe/)). How it works:
  - the WhatsApp user must turn it on (opt-in);
  - Android and iOS only;
  - 1:1 chats only; groups come later;
  - the partner app must use end-to-end encryption equal to WhatsApp's.
- The [WhatsApp help center](https://faq.whatsapp.com/1142481766359885/?cms_platform=web) confirms the feature: "only available in select regions".
- **How a service joins:** it signs Meta's **Reference Offer** (a contract for messaging *service providers*, published 2024-09-06). Its users then message WhatsApp users from **their own accounts on that service** ([Meta Engineering](https://engineering.fb.com/2024/03/06/security/whatsapp-messenger-messaging-interoperability-eu/)).
- **What this means for us:**
  - The DMA does **not** let a third-party client log in to, or automate, a person's own WhatsApp account. That is my reading of the design: interoperability links separate services, not clients.
  - To use this route, we would have to run a whole E2EE messaging service, sign the Reference Offer, and pass Meta's security and anti-spam requirements. Then our users would *message* WhatsApp users as an outside service. That is not a CLI for your own WhatsApp account.
  - I found no 2026 status update beyond "rolling out in the coming months".

## 7. Ban risk for linked-device automation
Sources: WhatsApp help center pages [P-snippet], plus the Messaging Guidelines [P].
- **Unofficial apps** ([About unofficial apps](https://faq.whatsapp.com/520312452657376/?locale=en_US)): using an unofficial version of WhatsApp can lead to a temporary or permanent ban. **Linking your account to an unofficial app or website, now or in the past, may lead to a ban.** This hits the linked-device approach directly.
- **Temporary bans** ([About temporarily banned accounts](https://faq.whatsapp.com/1848531392146538/?locale=en_US)): a temporary ban usually means you use an unofficial version or harvest information (scraping). If you do not stop, the ban may become permanent.
- **Restricted accounts** ([About restricted accounts](https://faq.whatsapp.com/717472490411581/?cms_platform=web)): "spam, automated, or bulk messaging" can lead to a ban. A restricted account can still message existing chats, but cannot start new chats or create groups until the restriction ends. WhatsApp may ask for an ID document and a selfie.
- **Scraping** ([About harvesting personal information](https://faq.whatsapp.com/434518851968943)): collecting data at scale violates the terms. It can lead to a temporary or permanent ban.
- **Unwanted contact:** the Messaging Guidelines list "repeated unwanted contact" as spam ([messaging guidelines](https://www.whatsapp.com/legal/messaging-guidelines)).
- **Practical rules** (my inference from the pages above):
  - Never cold-message unknown numbers.
  - Never send in bulk.
  - Never bulk-scrape contacts or groups.
  - Keep the client read-mostly, at human pace.
  - Use a number you can afford to lose.
  - Show a ban warning when the user first logs in.

## 8. Official MCP server, CLI and SDKs
- **Node.js SDK:** archived. `github.com/WhatsApp/WhatsApp-Nodejs-SDK` has `archived: true`, last push 2023-06-07 [P] (checked with `gh api repos/WhatsApp/WhatsApp-Nodejs-SDK`).
- **Other official repos:** the WhatsApp GitHub org has no current Cloud API SDK and no MCP repo. It has Flows tools, OTP SDKs, Checkout examples and a proxy. The On-Premises setup scripts repo is archived [P] (`gh api orgs/WhatsApp/repos`).
- **WhatsApp Business Tools MCP** (an MCP server lets an AI agent call a service's tools):
  - A Meta developer-blog post titled "Announcing WhatsApp Business Tools MCP", dated **2026-09-15**, appears in search results [P-snippet]. Its URL returned an empty page when I fetched it.
  - Press reports [S] ([TechCrunch](https://techcrunch.com/?p=3164453), [The New Stack](https://thenewstack.io/meta-mcp-whatsapp-business-claude/)) say it:
    - runs setup: creating the WABA, adding and verifying a number, registering it for the Cloud API, templates, webhook testing and test sends;
    - works in Claude, Codex, ChatGPT and Cursor;
    - acts with the connecting person's access and logs every action;
    - is a beta with a gradual rollout.
  - **It is a setup and admin tool, not an inbox.**
- **Official CLI:** I found none.

---

## Gaps (not verified)
- The verbatim AI Providers clause in the Meta Terms for WhatsApp Business Platform: the page does not render outside a browser.
- The full text of the help-center pages: JavaScript-rendered, seen as excerpts only.
- What a solo developer needs to become a Tech Provider: business verification and app review are my guess.
- The official Business Tools MCP docs page and endpoint.
- The 2026 rollout status of EU third-party chats.
- Meta's own newsroom post on the HeyMods lawsuit.
