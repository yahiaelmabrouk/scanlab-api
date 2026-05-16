'use strict'
module.exports = (sequilize, Datatypes) => {
  const ContrastRangePreset = sequilize.define('ContrastRangePreset', {
    weighting: {
      type: Datatypes.STRING,
      allowNull: true,
    },
    magPrep: {
      type: Datatypes.STRING,
      allowNull: true,
    },
    sequence: {
      type: Datatypes.STRING,
      allowNull: true,
    },
    bodyPartId: {
      type: Datatypes.INTEGER,
      allowNull: true,
    },
    ranges: {
      type: Datatypes.JSONB,
      allowNull: true,
    },
  })
  return ContrastRangePreset
}
