/**
 * Default vendor UI settings for cohorts.
 * When adding a new vendor, add it here with scanlab: true by default.
 */
const DEFAULT_VENDOR_UIS = {
  ge: { lx: false, scanlab: true },
  philips: { r57: false, scanlab: true },
  siemens: { b19: false, xa: false, scanlab: true },
  hitachi: { scanlab: true },
  united: { scanlab: true },
  canon: { scanlab: true },
}

module.exports = { DEFAULT_VENDOR_UIS }
