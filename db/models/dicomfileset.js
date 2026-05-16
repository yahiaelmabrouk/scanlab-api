'use strict'
module.exports = (sequelize, DataTypes) => {
  const DicomFileSet = sequelize.define(
    'DicomFileSet',
    {
      name: DataTypes.STRING,
      type: DataTypes.STRING,
      linkedDicoms: DataTypes.JSON,
      userViewOnlyAllowed: DataTypes.BOOLEAN, // feature on home page for "Playground" Dicom Viewer?
      flipSagittal: {
        type: DataTypes.BOOLEAN,
        get() {
          // Avoid nulls
          return this.getDataValue('flipSagittal') ? true : false
        },
      },
      flipAxial: {
        type: DataTypes.BOOLEAN,
        get() {
          // Avoid nulls
          return this.getDataValue('flipAxial') ? true : false
        },
      },
      flipCoronal: {
        type: DataTypes.BOOLEAN,
        get() {
          // Avoid nulls
          return this.getDataValue('flipCoronal') ? true : false
        },
      },
      localizerNames: {
        allowNull: true,
        defaultValue: {},
        type: DataTypes.JSONB,
      },
      isUltraLab: DataTypes.BOOLEAN,
      localizerBoundingBoxes: DataTypes.JSON,
      scanBoundingBoxes: DataTypes.JSON,
      //DICOM_CATEGORY
      dicomCategory: DataTypes.INTEGER,
      availablePositions: {
        allowNull: true,
        defaultValue: null,
        type: DataTypes.JSONB,
      },
    },
    {}
  )
  DicomFileSet.associate = function (models) {
    // associations can be defined here
    DicomFileSet.belongsToMany(models.Upload, {
      as: 'Uploads',
      through: 'JoinUploadToDicomFileSet',
      foreignKey: 'dicomFileSetId',
    })
    DicomFileSet.belongsTo(models.Region, { as: 'region', foreignKey: 'regionId' }) // Dicom is really just of a Region
    DicomFileSet.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' }) // The Dicom is often not specific enough to be just one Body Part, which is why QuestionSets have a BodyPart of the Region which the Dicom is; but Playground Mode shows Dicom as one of their BodyParts, so this is for that homepage dropdown
  }
  return DicomFileSet
}
