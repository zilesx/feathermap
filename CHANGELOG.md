# FeatherMap changelog

## 2026-08-04 — Dev profile, taxonomy filters, and band-report correction

- Kept the account header and close control visible while scrolling and reserved internal card space for the responsive account-action footer.
- Replaced internal count-range slugs with formatted labels using en dashes, thousands separators, tabular numbers, and accessible bird-count labels.
- Rebuilt species refinement around explicit all, none, and partial states so individual selections no longer clear or lock the entire category.
- Replaced the oversized species-filter Done control with a compact close button in the sticky refinement header.
- Positioned species refinement below the independent timeframe control so both filters remain available and retain their state.
- Added Category → Species → optional Subspecies hierarchy to banded-bird reporting with dependent resets and server-side relationship validation.
- Added the dedicated `banded_encounter` sighting behavior and stopped passing invalid encounter types into the sighting behavior enum.
- Added friendly submission states and double-submit protection to banded-bird reports.

## 2026-08-04 — Dev map continuity, banded activity, and session policy

- Kept privacy-safe aggregate activity visible through regional zooms so reports no longer disappear at the former zoom-7 handoff.
- Reduced broad-zoom dot size, removed the thick white “candy” border, scaled dots by aggregate bird volume, and added subtle deterministic separation.
- Linked banded-bird reports to normal protected sightings so they participate in map, timeframe, filtering, detail, commenting, saving, moderation, and owner-deletion workflows.
- Added star markers for linked banded-bird activity at regional and local zooms.
- Added idempotent band-report submission, server-side species/subspecies validation, duplicate-band moderation candidates, double-submit protection, and success-only form reset.
- Added `migrate_banded_activity_sessions.sql` for band-report idempotency indexes and the standard 72-hour user-session policy.
- Added silent short-lived access-token refresh while retaining a visible countdown for actual application-session expiry.
- Constrained catalog Edit and Edit reference actions and corrected the oversized self-service account deletion control.

## 2026-08-04 — Dev resilient reporting, errors, and map interaction

- Fixed the canvas activity layer initialization order that caused the page to render briefly and then go black.
- Replaced raw browser `Failed to fetch` messages with operation-specific guidance across the map, accounts, reporting, feedback, and Admin Portal.
- Kept temporary session-refresh network failures from signing users out and added a dismissible connection status.
- Split report creation from photo upload so a failed photo never causes a duplicate sighting submission.
- Added a persistent, retryable photo-upload notice that targets the already-created report.
- Corrected report-count choices to render numeric labels instead of internal slugs, including thousands separators.
- Replaced hundreds of zoomed-out DOM density markers with a single high-DPI canvas activity layer.
- Stabilized wheel and pointer movement states, reduced per-wheel zoom increments, and prevented decorative overlays from intercepting map gestures.

## 2026-08-04 — Dev reporting, filters, map interaction, and banded birds

- Fixed report submission preflight failures by allowing FeatherMap platform and version headers through API CORS.
- Made category filters drive aggregate map cells, cleared incompatible taxonomy selections, and suppressed stale aggregate dots for empty or subspecies-filtered results.
- Standardized every zoom level on administrator-managed category colors with saturated markers, white halos, dark outlines, and stronger selected states.
- Added smoother cursor-anchored wheel zooming and delayed aggregate refreshes until zoom gestures settle.
- Replaced the oversized taxonomy action with an All checkbox, added explicit dismissal, and supported Escape and outside-click closure.
- Collapsed the reporting species list after selection and added a compact selection summary that reopens the picker.
- Removed Popular areas and place search from the active reporting workflow while retaining current location, map selection, and saved locations.
- Formatted all bird-count choices from numeric bounds using range dashes and thousands separators.
- Added privacy-protected banded-bird reports, a user entry form, API endpoints, and database schema.
- Added a synthetic flyway-oriented bridge-data generator through August 4, 2026 and updated the default category palette for improved contrast.

## 2026-08-04 — Dev account-creation reliability fix

- Corrected new-account initialization so the required profile is created before the application session ledger is written.
- Added cleanup for partially initialized authentication accounts and replaced leaked database constraint errors with a friendly account-setup message.
- Added regression coverage that enforces profile-before-session ordering for signup.

## 2026-08-04 — Dev map, session, reporting, and visual stabilization

- Fixed large map queries by batching report metadata lookups and safely handling non-JSON upstream errors instead of returning an internal server error.
- Delayed the first map and density requests until signed-in preferences resolve, eliminating the incorrect default-range request and duplicate reload.
- Added centralized expired-session recovery for the map and Admin Portal, including a clear sign-in prompt and return to the requested admin page.
- Increased local marker visibility, preserved category colors, and maintained a readable minimum size through zoom transitions.
- Restored administrator-configured count ranges to the report form and removed the detached count overlay from the reporting workflow.
- Moved private harvest access into the account action bar as a normal Harvest journal action.
- Rebalanced light-mode surfaces, headers, close controls, action bars, borders, and shadows for lower contrast and consistent readability.
- Corrected Platform feature-card sizing so responsive Save controls remain inside their cards at wide and narrow viewport sizes.

## 2026-08-04 — Dev configurable global bird-count ranges

- Added administrator-managed global report-count ranges with editable labels, minimums, optional maximums, descriptions, ordering, visibility, and archival status.
- Replaced the fixed reporting choices with responsive controls: up to eight active ranges render as fast-select buttons, while larger catalogs use a compact dropdown.
- Preserved the legacy flock-band field for compatibility while storing immutable range labels, bounds, and estimated-bird snapshots on every new report.
- Migrated existing reports into compatible historical snapshots and seeded ranges from small groups through mass concentrations exceeding 100,000 birds.
- Added API-side range validation, overlap protection, catalog-management permissions, audit events, and safe archival instead of destructive deletion.
- Updated privacy-safe heatmap aggregation and local marker sizing to account for configured bird volumes.

## 2026-07-31 — Dev taxonomy, private harvest journal, and map UX safeguards

- Enforced each signed-in user's saved default map history on map initialization while retaining the 30-day fallback.
- Added an application confirmation step before deleting a report and replaced the misleading owner action button with a noninteractive ownership status.
- Kept the activity summary card clear of the map legend across desktop and narrow layouts.
- Expanded the catalog with optional subspecies, regional populations, hybrids, and variants beneath parent species, including administrator management and nested map filters.
- Added optional subtype selection to bird reports without forcing users to identify beyond the parent species.
- Added a private harvest journal that records outings, birds observed, hunter count, duration, multiple species/subspecies harvest lines, notes, and private harvest-rate statistics separately from public sightings.
- Extended the semantic theme surface model so modal headers, overlays, controls, danger states, and system-selected light mode use consistent contrast.
- Reinforced Platform feature-card layout constraints so controls and save actions remain inside their cards.

## 2026-07-31 — Dev light-theme close controls

- Restored visible close glyphs on modal, panel, activity-card, and administrator-detail controls in explicit light mode and system-selected light mode.
- Added consistent high-contrast hover and keyboard-focus states for close controls.

## 2026-07-31 — Dev 30-day map default

- Changed the initial map timeframe from six months to the past 30 days for the web client and account preference fallback.
- Retained the full timeframe selector and custom date-range support.

## 2026-07-31 — Dev self-service account deletion

- Added a guarded account-deletion flow requiring the current password, an exact `DELETE` confirmation, and an explicit permanence acknowledgement.
- Protected the final active Super Administrator from accidental deletion and rate-limited deletion attempts.
- Added transaction-safe cleanup for administrative references, retained anonymized audit history, removed user-owned data through database cascades, revoked the Auth identity and sessions, and cleaned up uploaded objects.
- Added responsive danger-state styling, clear deletion scope, failure feedback, and automated coverage for the UI, API, and migration contract.

## 2026-07-31 — Dev session reliability, responsive controls, and category map iteration

- Made Supabase authentication administration tolerant of empty and non-JSON responses, and changed suspension to report profile and session-revocation outcomes independently instead of returning a misleading generic error.
- Added signup and authenticated-request session recording, throttled last-seen updates, individual logout revocation, session status data, administrator revocation endpoints, and suspension-aware session details.
- Added configurable application-session warning, idle, staff, and absolute lifetime policies plus a web countdown that can refresh or end the session and coordinates changes across browser tabs.
- Rebuilt Platform feature cards around resilient card-level controls so action buttons remain inside their containers at desktop, tablet, and mobile widths.
- Added accessible predefined-role permission details, human-readable descriptions, and sensitive-operation indicators.
- Applied shared light-mode modal and button corrections, restored the Send feedback primary action, separated the map legend from the activity card, and made feedback titles open their details.
- Connected category catalog colors to aggregate and local map activity, including mixed-category composition metadata and privacy-safe category aggregation.
- Added configurable HTTPS bird-reference sources and public learn-more links.
- Replaced retired API defaults with environment-driven FeatherMap hosts and added tests preventing development and production endpoint leakage.

## 2026-07-30 — Dev account suspension safeguards

- Replaced one-click account suspension with a reasoned, duration-aware confirmation workflow that clearly warns administrators about login blocking and session revocation.
- Prevented administrators from suspending or unlocking themselves and protected the final active Super Administrator.
- Enforced suspension during password login, revoked active sessions on suspension, and added explicit unlock handling for Support, Security, and Super Administrators.
- Added suspension metadata, authentication-unlock cleanup, security notifications, detailed audit events, and clear account-status indicators.

## 2026-07-30 — Dev modal and administration polish

- Rebalanced light-mode account and activity modals with layered pale-sage surfaces, softer borders, and readable nested controls.
- Removed user role assignment from Platform while retaining the predefined role catalog; access changes remain in User administration.
- Standardized User Details profile-save actions with the shared administrative primary-button styling.

## 2026-07-29 — Feedback detail crash fix

- Fixed the shared private screenshot gallery reading a cleared React image event during deferred state updates.
- Captures image dimensions synchronously before updating gallery state, restoring feedback detail views for both users and administrators.

## 2026-07-29 — Feedback workflow refinement

- Replaced staff and duplicate UUID entry fields with searchable, human-readable associations plus Assign to Me and Unassigned shortcuts.
- Automatically marks linked duplicate feedback appropriately and shows the original feedback title and context.
- Added authenticated full-size screenshot lightboxes with zoom, pan, fit, keyboard navigation, previous/next controls, and image metadata.
- Added persistent unread feedback indicators on the map Feedback launcher, My Feedback tab, and individual feedback list entries.
- Marks only the opened feedback conversation’s notifications as read and polls for new staff updates.
- Standardized Send Response and workflow button styling.
- Applied title case to all visible feedback statuses and priorities.
- Removed the unfinished GitHub issue control and the redundant administrative diagnostics note.
- Corrected the feedback migration for the deployed RBAC permission schema.

## 2026-07-29 — Private product feedback workflow

- Added an authenticated in-app feedback experience for bugs, feature requests, usability issues, data corrections, safety/privacy concerns, and other product feedback.
- Added optional sanitized screenshots with client compression and server-side metadata scrubbing.
- Added explicit, opt-in safe diagnostics that exclude tokens, passwords, query strings, and protected activity coordinates.
- Added user feedback history, status tracking, staff conversations, resolution summaries, and account notifications.
- Added a dedicated administrative feedback queue with active/history filters, categories, priority, assignment, internal notes, user-visible responses, duplicate linking, and optional sanitized GitHub issue references.
- Added private feedback, message, attachment, storage, RBAC, audit, and notification infrastructure.
- Kept product feedback separate from community-content reporting and moderation.

## 2026-07-29 — Clear location feedback and policy-aware administration

- Added an in-map location progress indicator, cancellation control, and clear success, denial, and unavailable states before the map recenters.
- Added readable active-role badges to the user directory while retaining Manage Access as the editing control.
- Standardized Platform action sizing, typography, alignment, focus states, and responsive behavior.
- Made sensitive role-change MFA step-up conditional on the configured staff MFA policy instead of requiring MFA when it is optional or disabled.
- Added coverage for role labels, location feedback, Platform action styling, and policy-aware MFA enforcement.

## 2026-07-29 — Admin workspace structure and unified MFA policy

- Moved Platform Controls and Catalog Setup inside the shared administration workspace so CSS grid placement can no longer render them underneath the sidebar.
- Added explicit display labels for every administration tab and separated those labels from internal route keys.
- Normalized page headings and navigation capitalization, including Catalog Setup and FeatherMap branding.
- Consolidated administrator and moderator MFA requirements under the single Staff MFA Policy selector.
- Removed the two contradictory per-role MFA checkboxes from the editable interface.
- Added aligned administrator and moderator enforcement summaries that update with the selected policy.
- Kept legacy MFA booleans synchronized automatically when the unified policy is saved for backward compatibility.
- Preserved step-up verification as a separate setting for sensitive administrative actions.

## 2026-07-29 — Admin layout and access-management polish

- Rebuilt Platform feature cards around container width so intermediate desktop and tablet layouts no longer clip controls behind the sidebar.
- Normalized every administration navigation label to the same font, size, weight, spacing, and capitalization.
- Removed positional pseudo-element navigation labels and rendered Catalog Setup directly.
- Expanded the Audit workspace to the available viewport height, removed its fixed 250-pixel list limit, and added responsive sticky column headings.
- Preserved readable audit card rows on narrow mobile screens and proportional columns on large displays.
- Standardized the Save Access action with proper sizing, spacing, focus, disabled, and saving states.
- Added live effective-permission previews while administrators select roles.
- Added `PUT` to API CORS preflight responses so browser-based role changes reach the API.
- Preserved actual API error messages for protected operations such as self-demotion, final-super-administrator removal, and MFA step-up.

## 2026-07-29 — Responsive administration and complete RBAC controls

- Made audit rows scale across desktop, tablet, and mobile layouts, including safe wrapping for long actors, targets, devices, actions, and timestamps.
- Replaced the user directory’s legacy three-role selector with dedicated multi-role access management.
- Added full predefined-role selection, effective permission visibility, required change reasons, and user-specific access controls.
- Hid the legacy compatibility role from editable user profile fields.
- Made Platform administration load roles, feature flags, and synchronization health independently so one failed endpoint no longer leaves the entire page blank.
- Added explicit Platform loading, empty, permission, and endpoint error states.
- Converted every existing legacy administrator to a non-expiring `super_admin` assignment with an idempotent audit record.
- Permanently granted Supabase `service_role` access to the RBAC, feature-flag, and synchronization tables.
- Connected the FeatherMap API to the Supabase Docker network through tracked Compose configuration, with configurable network and Supabase service names.

## 2026-07-29 — Platform foundation, controlled rollout, and map selection

- Replaced the report form’s map-center shortcut with an interactive map-selection mode that supports tap placement, pan and zoom refinement, explicit confirmation, and cancellation.
- Added client-generated report UUIDs and API idempotency so retrying the same report cannot create duplicates.
- Added browser-local IndexedDB report drafts with explicit draft, queued, syncing, failed, and submitted states; failed or offline submissions preserve their draft instead of discarding user work.
- Added shared service contracts for location, camera, secure storage, drafts, networking, synchronization, map caching, and notifications to keep the web application ready for later native iOS and Android adapters.
- Added structured API errors that distinguish retryable failures, conflicts requiring edits, authentication, permission, and server failures.
- Added predefined composable RBAC roles and granular permissions for moderation, support, catalog, operations, security, and super administration.
- Added multiple role assignments per user, permission explanations, required change reasons, self-elevation prevention, final-super-administrator protection, optional MFA step-up for sensitive role changes, and complete mutation auditing.
- Added database-backed feature flags with environment defaults, deterministic percentage rollout, platform and role rules, client-version floors, expiring user overrides, evaluation explanations, and emergency disable precedence.
- Added an administrator Platform section for feature management, individual user overrides, predefined role assignment, and synchronization/client-version visibility.
- Added synchronization event storage for duplicate submissions, successful submissions, failures, platforms, versions, retry counts, and queue age.
- Kept native packaging, native background execution, native secure storage/filesystem/maps, push delivery, AI species identification, full jurisdiction-aware regulations, external data sources, SMTP, and arbitrary custom roles tabled for later iterations.

## 2026-07-28 — Custom and delayed report locations

- Added report-location choices for the current device, current map center, saved locations, popular locations, and place search.
- Added an explicit observation date and time with a seven-day initial reporting window.
- Based report freshness, map placement, and expiration on observation time rather than submission time.
- Added independently recorded submission time, location source, and calculated delay context.
- Enforced coordinate, future-time, and maximum-age validation in the API.
- Preserved randomized location protection for every location source.
- Added submission source and delay context to moderation details and user activity auditing.
- Added an editable administrative maximum-report-delay setting.
- Avoided attaching a current regional weather snapshot to observations delayed by more than one hour.
- Kept offline drafts, synchronization, retries, SMTP, external data, expanded regulations, and push notifications deferred.

## 2026-07-28 — Continuous regional activity markers

- Removed the empty map-visualization gap between regional density and close-range markers.
- Switched zoom levels 7 through 12 to visible protected-report dots so sparse privacy cells cannot disappear as they subdivide.
- Enforced a 10-pixel minimum dot diameter with higher flock bands scaling up to 17 pixels.
- Preserved randomized report zones and click-to-open activity behavior for regional dots.
- Replaced the large black close-range circles with compact red map pins at zoom 12 and closer.

## 2026-07-28 — Species-aware migration map and large-scale test data

- Kept red, privacy-safe aggregate activity dots visible from national scale through zoom 12.
- Sized aggregate dots using estimated birds derived from the reported flock band and species flock profile.
- Limited black numbered report markers to zoom 12 and closer.
- Added editable species flock minimum, midpoint, maximum, occasional ceiling, aggregation behavior, habitats, and flyway membership.
- Added a species-selectable migration layer with generalized seasonal north/south arrows across the four North American flyways.
- Added explicit language that the migration layer is modeled context rather than live tracking or precise biological boundaries.
- Added a deterministic, removable SQL generator for 100,000 synthetic reports across two years, constrained to configured species flyways and seasonal latitude progression.
- Reworked map aggregation to include all eligible reports in the selected one-year window instead of sampling only the newest 1,000.

## 2026-07-28 — Report-choice feedback and continuous activity density

- Restored unmistakable selected states for species and flock-size choices across Light, Dark, and System themes.
- Added selected-option checkmarks and visible keyboard focus treatment.
- Automatically selects the first enabled catalog species when a saved/default species is unavailable.
- Extended red privacy-safe activity dots from national through regional and city-scale views.
- Increased aggregation resolution progressively as the map zooms in while keeping dot sizes tightly bounded.
- Removed the intermediate black/green cluster circles.
- Delayed individual activity markers until close local zoom and reduced them to compact localized markers.
- Exposed configured density and local-marker zoom thresholds in the aggregation response.

## 2026-07-23 — Unified themes, catalog setup, and readable administration

- Unified Light, Dark, and System appearance values across the map, account surfaces, dialogs, administration, forms, tables, and moderation workspace.
- Removed delayed color transitions so changing appearance updates the interface immediately.
- Replaced the species-only administrative experience with Catalog Setup for categories and species.
- Added category creation and editing for display name, color, icon label, order, visibility, and stable internal ID.
- Added category fields and validation to Supabase with audited category administration endpoints.
- Replaced user-activity GUIDs and raw device strings with readable actions, content summaries, changed fields, and concise device labels.
- Replaced duplicate-report GUID comparisons with report summaries and retained identifiers only for internal actions.
- Restyled the activity filter action to align with the surrounding controls.

## 2026-07-23 — Admin CORS correction and scalable national activity

- Corrected the successful admin-overview response so it includes the requesting production origin, fixing the misleading browser `Failed to fetch` error on authenticated admin pages.
- Marked API JSON responses as non-cacheable to prevent authenticated or administrative responses from being retained by browsers or edge caches.
- Temporarily changed the initial map timeframe to six months for migration-data testing.
- Replaced fixed nationwide aggregation with zoom-adaptive privacy cells and compact point groups that gain detail as the map zooms in.
- Added regression coverage for authenticated CORS, aggregation scaling, the temporary timeframe, and FeatherMap favicon metadata.
- Replaced the generic starter favicon with the FeatherMap feather mark.

## 2026-07-22 — FeatherMap product rebrand

- Renamed the product from Flyway to FeatherMap across the primary map, account, authentication, recovery, administration, metadata, API messaging, tests, and documentation.
- Updated the monogram with a feather-inspired CSS treatment while preserving the compact, accessible header footprint.
- Renamed package metadata to `feathermap` without changing database identifiers or deployment service names.
- Preserved the existing `flyway-app.zileslabs.com` and `flyway-api.zileslabs.com` domains as requested.
- Preserved existing browser storage keys so signed-in sessions and saved sightings survive the rebrand.

## 2026-07-22 — Configurable activity-map visualizations

- Preserved the existing category heatmap as the default visualization.
- Added Splatter, Weather, Hexbin, Species Dominance, and Activity Cluster views using the same privacy-aggregated map data.
- Added an unobtrusive map-view selector for temporary changes without altering account defaults.
- Added profile-synchronized default visualization, reduced-motion, and colorblind-safe map preferences.
- Added adaptive legends and responsive controls for desktop and mobile layouts.
- Extended API preference validation so unsupported visualization values cannot be stored.

## 2026-07-22 — Light-theme map contrast correction

- Kept map-overlay controls on an opaque dark surface in Light and System-Light modes so labels remain readable over bright map tiles.
- Restored clear active and inactive states for bird filters.
- Corrected contrast for the location card, account avatar, zoom controls, activity markers, clusters, heatmap legend, and map attribution.
- Added regression coverage for the light-theme map overlay rules.

## 2026-07-22 — Dark-theme readability correction

- Increased dark-theme contrast for primary, secondary, muted, placeholder, and disabled text.
- Strengthened panel, form-field, table-row, modal, and moderation-workspace boundaries.
- Made map overlays more opaque and improved dark map-tile legibility.
- Added clearer keyboard focus indicators while preserving the existing Flyway dark visual language.

## 2026-07-22 — Moderation workspace, appearance themes, and stable activity map

- Redesigned the moderation queue around reporter context, content previews, risk signals, assignment and date filters, and historical status filtering.
- Added an auditable moderation detail view with report reasons, user trust context, attachments, related activity, duplicate signals, decision history, internal notes, and reason-required actions.
- Preserved protected-location guarantees by excluding exact coordinates from moderation responses.
- Added profile-synchronized System, Dark, and Light appearance preferences with immediate application and startup theme restoration.
- Stabilized report clusters by anchoring membership to geographic world coordinates and discrete zoom levels instead of viewport-relative rounding.
- Replaced low-contrast heatmap pastels with a high-visibility category palette for ducks, geese, cranes, doves, shorebirds, upland birds, and other activity.
- Added a heatmap category legend and represented activity strength through cell size and brightness while retaining aggregation privacy thresholds.

## 2026-07-19 — Administrator user activity and map report selection

- Added a dedicated administrator-only Activity section to user details with action, outcome, and date filters plus paginated history.
- Included outcome, target, timestamp, masked network context, device context, session context, and before/after detail access for user write activity.
- Kept administrator activity views auditable through the existing administrative audit trail.
- Changed report and cluster selection so a primary click or tap opens the compact activity card for the selected report.
- Added privacy-aware reporter attribution and an explicit **View details** action to the compact activity card.
- Kept the compact card synchronized with the selected map report while allowing the full detail modal to close back to that selection.
- Prevented right-click and other secondary mouse actions from selecting map reports while preserving keyboard and touch activation.

This changelog is organized around explicit product build approvals and major deployment milestones. Future entries are added whenever the project owner says **“build it.”**

## 2026-07-19 — Location picker, annual date ranges, audit context, and accessibility

- Added privacy-aware reporter attribution to activity-list entries.
- Enriched administrative audit results with readable actor names and action-specific target summaries while retaining identifiers for troubleshooting.
- Expanded standard map timeframes to six months and one year.
- Added custom start/end date filtering with a maximum one-year span and server-side validation.
- Raised privacy-safe report aggregation and heatmap support from 90 days to 365 days.
- Added a location picker with current location, curated popular migration locations, and synchronized saved locations.
- Added coarse coordinate rounding for saved locations and save/delete activity auditing.
- Added accessible names, pressed/expanded state semantics, live activity-list updates, stronger focus indicators, and labeled custom-date controls.
- Added `migrate_locations_year_ranges.sql`.

## 2026-07-18 — Authentication, attribution privacy, and observed weather

- Made Enter/Return submit sign-in, signup, and account-recovery forms.
- Added authentication progress states and duplicate-submission prevention.
- Simplified public attribution to a single yes/no profile preference.
- Public names are either first name plus last initial or `Flyway member`.
- Applied the same privacy-safe naming to reports and comments.
- Added optional user-reported sky, precipitation, wind, temperature, and visibility.
- Separated reported conditions from the automatically captured regional weather snapshot.
- Added realistic observed weather to the synthetic migration dataset.
- Added `migrate_attribution_observed_weather.sql`.

## 2026-07-17 — Sessions, confirmations, moderation history, and synthetic data

- Added a normal current-session Sign out action while retaining Sign out everywhere.
- Added persistent confirmation state, duplicate protection, self-confirmation prevention, and a disabled Confirmed state.
- Added active and historical moderation status filters with pagination support.
- Added resolved-case information and improved administrative user details.
- Added an admin-only user write-activity audit log with request, session, device, masked network, and before/after context.
- Added synthetic-record labeling and reversible batch deletion.
- Added a two-year, approximately 12,000-record US migration dataset modeled around broad flyway and seasonal patterns.
- Added `migrate_activity_history_synthetic.sql` and `seed_two_year_migration.sql`.

## 2026-07-17 — Administrative directory, species, audit, and marker reliability

- Made marker and cluster activation gesture-aware so taps open details without interfering with pan or pinch gestures.
- Added last-login information to the administrative user directory.
- Added administrative User Detail and profile editing.
- Added safe MFA factor inspection and audited MFA reset with session revocation.
- Added species editing, display order, seasonal dates, and regional relevance metadata.
- Replaced the user-facing `immutable_slug` wording with Internal ID.
- Added detailed audit views with actor, target, request, masked IP, and device context.
- Reconciled legacy display names with structured first and last names.
- Added `migrate_admin_directory_species.sql`.

## 2026-07-17 — Trust, map layers, profile, and moderation iteration

- Added duplicate detection with moderator/admin confirmation before merging.
- Added reporting of sightings, notes, photos, and comments.
- Added account session management, notification preferences, and account-wide session revocation.
- Added flyway map layers and future-layer foundations.
- Added hunting-regulation notices and liability-oriented disclaimers.
- Added automatic weather context to reports.
- Added client-side image compression and server-side EXIF/GPS metadata removal.
- Added protected reporter attribution and improved marker detail behavior.

## 2026-07-17 — Security, MFA, and dedicated administration

- Added authenticated password changes, email recovery, and admin-initiated recovery.
- Added SMTP configuration requirements, reset throttling, and failed-login lockout policy settings.
- Added generic TOTP MFA with QR activation and numeric verification.
- Made administrator TOTP optional and configurable.
- Moved administration from the account modal to a dedicated page.
- Added editable configuration controls, moderation queues, species CRUD, RBAC, and audit views.
- Fixed production black screens, QR rendering, overlapping controls, modal scrolling, map clicks, and passive wheel-listener errors.

## 2026-07-17 — Reports, media, and community participation

- Added report notes, photo uploads, comments, saves, and community confirmations.
- Added image compression and metadata stripping.
- Added content reporting and moderator review tools.
- Added weather snapshots and privacy-safe report attribution.

## 2026-07-17 — Bird catalog, time filters, and worldwide map

- Expanded the map from a limited region to the continental United States and worldwide navigation.
- Added 24-hour, 7-day, 30-day, and 90-day filters.
- Expanded the catalog beyond ducks to geese, cranes, swans, doves, shorebirds, and other migratory birds.
- Added improved map pan, wheel zoom, pinch zoom, clusters, heatmap foundations, and detail modals.

## 2026-07-22 — Weather-radar map redesign

- Replaced blurred, glowing, and animated activity halos with stable weather-radar intensity bands.
- Made Weather Radar the default map visualization for new profiles while preserving existing saved preferences.
- Added a low, moderate, high, and intense activity scale plus a compact bird-category key.
- Simplified map controls, clusters, and close-zoom markers with solid high-contrast surfaces and restrained selection states.
- Preserved privacy-safe aggregation, reduced-motion behavior, and colorblind-friendly map preferences.

## 2026-07-22 — Density map, actionable administration, and owner deletion

- Replaced zoomed-out bubble and alternate aggregate modes with compact red density points representing privacy-safe aggregate cells.
- Separated timeframe controls from bird-category filters and retained close-zoom report markers.
- Moved System, Light, and Dark appearance selection into Edit Profile and removed floating preference overlays.
- Added owner-authorized soft deletion for activity reports, immediate removal from public views, audit history, and a 30-day administrator restore path.
- Replaced generic admin totals with actionable moderation, security, suspended-account, deleted-report, and recent-staff-action sections.
- Enriched audit records with readable actors, targets, action labels, device summaries, field changes, and collapsed technical identifiers.
- Resized moderation controls for desktop and mobile and clearly marked submitted content as read-only.
- Added `migrate_owner_report_deletion.sql`.
- Added species visibility preferences and administrative catalog controls.

## 2026-07-17 — Live API, authentication, and RBAC

- Connected the application to the live server-side API.
- Added signup, login, logout, authenticated reporting, and account preferences.
- Differentiated anonymous and authenticated experiences.
- Added user, moderator, and administrator roles with server-enforced authorization.
- Kept Supabase access behind the API so client applications never receive database credentials.

## Infrastructure and deployment milestone

- Selected self-hosted Supabase for PostgreSQL, authentication, and object storage.
- Deployed the Flyway API in Docker on port 3001.
- Deployed the web application in Docker on port 3002.
- Configured Cloudflare Tunnel and DNS for `flyway-api.zileslabs.com` and `flyway-app.zileslabs.com`.
- Established GitHub as the source repository and added Docker-based deployment workflows.

## Initial product milestone

- Defined Flyway as a privacy-first migratory-bird activity application for iOS, Android, and web.
- Established randomized activity zones so reports do not expose exact hunting locations, blinds, or routes.
- Created the initial responsive map, reporting workflow, activity cards, and community-confirmation concept.
