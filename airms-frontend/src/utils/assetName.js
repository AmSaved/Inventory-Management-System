/**
 * getAssetName
 * Extracts the per-item asset name stored in custom_fields by the blueprint
 * intake form, falling back to the product blueprint name if none is found.
 *
 * When users intake inventory they fill in blueprint fields; one of those is
 * typically the individual asset name (e.g. "Dell XPS 15 i7", "HP ProBook").
 * That value ends up in inventory.custom_fields under a key that depends on
 * the blueprint template definition.  We scan for common name-related keys.
 */

// Priority-ordered list of keys we look for in custom_fields
const ASSET_NAME_KEYS = [
  'asset_name',
  'asset name',
  'assetname',
  'item_name',
  'item name',
  'itemname',
  'name',
  'device_name',
  'device name',
  'devicename',
  'equipment_name',
  'equipment name',
  'label',
  'title',
  'description',
];

/**
 * Returns the best display name for an individual inventory record.
 *
 * @param {object} item - Inventory record (from the API).  Should have:
 *   - item.custom_fields  — JSONB object filled by the intake template
 *   - item.product        — Associated product blueprint (has .name)
 *   - item.serial_number  — Optional serial
 * @param {boolean} [includeProductFallback=true] - Whether to fall back to product name
 * @returns {string}
 */
export function getAssetName(item, includeProductFallback = true) {
  const cf = item?.custom_fields || item?.inventory?.custom_fields;

  if (cf && typeof cf === 'object') {
    // 1. Check priority keys (case-insensitive exact match)
    for (const target of ASSET_NAME_KEYS) {
      // Direct exact match
      if (cf[target] && String(cf[target]).trim()) {
        return String(cf[target]).trim();
      }
      // Case-insensitive scan over all keys
      const foundKey = Object.keys(cf).find(
        k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === target.replace(/[^a-z0-9]/g, '')
      );
      if (foundKey && cf[foundKey] && String(cf[foundKey]).trim()) {
        return String(cf[foundKey]).trim();
      }
    }
  }

  // 2. Fall back to product blueprint name
  if (includeProductFallback && item?.product?.name) {
    return item.product.name;
  }

  return item?.product?.name || 'Unknown Item';
}

/**
 * Returns the asset name WITH the product type in brackets when the names differ.
 * E.g. "Dell XPS 15 [Laptop]" or just "Laptop" if no custom name found.
 */
export function getAssetDisplayName(item) {
  const custom = getAssetName(item, false); // without fallback
  const productName = item?.product?.name || '';

  if (custom && custom !== productName) {
    return productName ? `${custom} [${productName}]` : custom;
  }
  return productName || 'Unknown Item';
}
