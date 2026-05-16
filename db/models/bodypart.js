'use strict'
module.exports = (sequelize, DataTypes) => {
  const BodyPart = sequelize.define(
    'BodyPart',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      withOut: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      withOnly: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      withOutWith: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      contrastTypes: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {}
  )
  BodyPart.associate = function (models) {
    BodyPart.belongsTo(models.BodyPart, { as: 'base', foreignKey: 'baseId' })
    BodyPart.belongsTo(models.Region, { as: 'region', foreignKey: 'regionId' })
    BodyPart.hasMany(models.QuestionSet, { as: 'questionSets', foreignKey: 'bodyPartId' })
    BodyPart.hasMany(models.PatientPosition, { as: 'patientPositions', foreignKey: 'bodyPartId' })
    BodyPart.hasMany(models.InjectionAttribute, { as: 'injectionAttributes', foreignKey: 'bodyPartId' })
    BodyPart.hasMany(models.DigitalLocalizer, { as: 'digitalLocalizers', foreignKey: 'bodyPartId' })
    BodyPart.hasMany(models.QuestionProbe, { as: 'questionProbes', foreignKey: 'bodyPartId' })
    // BodyPart.hasMany(models.DicomFileSet, { as: 'dicomFileSet', foreignKey: 'bodyPartId' })
  }
  return BodyPart
}
