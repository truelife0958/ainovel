/**
 * Returns all tabbable focusable elements inside a given root, in DOM order.
 * Used by the Modal focus trap and anywhere focus cycling is needed.
 *
 * @param {Element | null | undefined} root
 * @returns {HTMLElement[]}
 */
export function queryFocusableElements(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}
