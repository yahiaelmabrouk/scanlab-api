'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionProbe = sequelize.define(
    'QuestionProbe',
    {
      scanDirection: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      visibleProbes: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
    },
    {}
  )
  QuestionProbe.associate = function (models) {
    QuestionProbe.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
  }
  return QuestionProbe
}
