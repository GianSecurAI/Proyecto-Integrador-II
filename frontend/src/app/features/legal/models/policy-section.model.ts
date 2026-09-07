/**
 * Content model for the four static policy pages (`pages/privacy-policy`, `pages/refund-policy`,
 * `pages/terms-of-service`, `pages/shipping-policy`) and their shared
 * `components/policy-section-list` renderer.
 *
 * Adapted from the repeated "heading + subtitle + vertical stack of numbered cards" structure
 * observed across all four corresponding Figma frames (fileKey `e1l878xWPLq1W1KVJ0wHrx`, nodes
 * `3:2180`, `3:2435`, `3:2676`, `3:2905`) — a purely structural/visual pattern, not the reference
 * copy itself (that copy belongs to a different, unrelated company and is not reused here; see
 * each page's own doc comment for the Ar Makers 3D-specific content decisions).
 */
export interface PolicySection {
  /** Rendered as an `<h2>` inside `policy-section-list` — never skip to `<h3>` here. */
  readonly heading: string;
  /** One or more paragraphs, rendered in order. */
  readonly body: readonly string[];
  /** Optional bullet list rendered after `body`, for sections that enumerate discrete items. */
  readonly list?: readonly string[];
}
