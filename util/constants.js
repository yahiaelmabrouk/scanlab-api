const bodyPartIds = {
  carotidArteries: 101,
  thoracicAorta: 102,
  renalArteries: 105,
  leftVentricular: 106,
  leftRightVentricular: 107,
}

const categoryIds = {
  angiography: 10,
  cardiac: 11,
  contrastBolus: 12,
  patientScreening: 3,
  anatomy: 6,
}

const cardiacBodyPartIds = [bodyPartIds.leftVentricular, bodyPartIds.leftRightVentricular]
const angioExamBodyPartIds = [bodyPartIds.carotidArteries, bodyPartIds.thoracicAorta, bodyPartIds.renalArteries]

const INJECTION_MODE = {
  CONTRAST_ONLY: 1,
  CONTRAST_AND_SALINE: 2,
}

const DICOM_CATEGORY = {
  FOR_CTQ: 1,
  FOR_TEST: 0,
}

const CLIENT_PRODUCTION_HOSTNAMES = ['app.scanlabct.com', 'app.scanlabmr.com']

const INJECT_CONDITION = {
  SET_VOLUME: 1,
  WEIGHT_BASED: 2,
}

const USER_AREA = {
  US_EAST: 'us_east', // default to US East
  EU_WEST: 'eu_west',
}

const CARDIAC_LEVEL = {
  INITIAL: 1,
  BETA_BLOCKER: 2,
  NITRO: 3,
  STRESS: 4,
  NITRO_WITH_BB: 5,
}

module.exports = {
  DICOM_CATEGORY,
  angioExamBodyPartIds,
  bodyPartIds,
  categoryIds,
  cardiacBodyPartIds,
  INJECTION_MODE,
  CLIENT_PRODUCTION_HOSTNAMES,
  INJECT_CONDITION,
  USER_AREA,
  CARDIAC_LEVEL,
}
