/**
 * @jest-environment node
 *
 * REGRESSION GUARDS — Google Ads API field names in publish.ts.
 *
 * Background: 2026-06-06 incident — the publish path was sending
 * `urlExpansionOptOut: true` on the campaign create operation. Google Ads
 * REST API responded:
 *   "Unknown name 'urlExpansionOptOut' at 'operations[0].create': Cannot
 *    find field." (HTTP 400)
 *
 * Root cause: the field `campaign.url_expansion_opt_out` was
 * PERFORMANCE_MAX only and has been REMOVED from current Google Ads API
 * (see release notes — replaced by assetAutomationSettings.
 * FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION in v22+). My yesterday's edit
 * added the field without checking it was still valid OR applicable to
 * SEARCH campaigns. Every campaign publish failed at the API call.
 *
 * Caught by the Bristol BS1 forensic-validation pilot (the FIRST publish
 * after the edit). The 4 already-live campaigns predate the edit and were
 * unaffected.
 *
 * This file holds source-string assertions that prevent the same class of
 * bug from re-entering publish.ts. If a future commit re-introduces any of
 * the forbidden tokens, this test will fail at jest time — before the code
 * can be deployed and the API can reject it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLISH_SRC = readFileSync(
  resolve(__dirname, "../google-ads-publish.ts"),
  "utf8",
);

describe("google-ads-publish.ts — Google Ads field-name regression guards", () => {
  /**
   * The PMax-only / removed field that broke the Bristol publish on
   * 2026-06-06. Must never appear inside an actual mutate payload. (The
   * documentation comment is allowed to mention it — the test only
   * forbids the assignment form.)
   */
  it("never sends `urlExpansionOptOut:` on a campaign create (removed PMax-only field)", () => {
    expect(PUBLISH_SRC).not.toMatch(/\burlExpansionOptOut\s*:/);
  });

  /**
   * The snake_case form is what the REST API expects internally, but the
   * google-ads-api client takes camelCase. Snake_case in our publish
   * source would be a different kind of mistake — either way, neither
   * should appear on a campaign create.
   */
  it("never sends `url_expansion_opt_out:` on a campaign create", () => {
    expect(PUBLISH_SRC).not.toMatch(/url_expansion_opt_out\s*:/);
  });

  /**
   * Defensive: the pre-v22 prefix form, also PMax-only. If someone tries
   * to "fix" the regression by switching to this name, this guard fires
   * with the same reasoning.
   */
  it("never sends `finalUrlExpansionOptOut:` on a campaign create", () => {
    expect(PUBLISH_SRC).not.toMatch(/\bfinalUrlExpansionOptOut\s*:/);
  });

  /**
   * Anchor test: confirms the forensic-validation network settings
   * remain in publish.ts. If someone removes targetSearchNetwork: false
   * the campaign starts billing Search Partners again. This is the §15
   * forensic-validation core control.
   */
  it("still pins network settings to forensic-validation defaults (§15)", () => {
    expect(PUBLISH_SRC).toMatch(/targetSearchNetwork\s*:\s*false/);
    expect(PUBLISH_SRC).toMatch(/targetContentNetwork\s*:\s*false/);
    expect(PUBLISH_SRC).toMatch(/targetPartnerSearchNetwork\s*:\s*false/);
    expect(PUBLISH_SRC).toMatch(/targetGoogleSearch\s*:\s*true/);
  });
});
