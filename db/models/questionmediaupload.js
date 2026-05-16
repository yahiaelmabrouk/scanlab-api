'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionMediaUpload = sequelize.define(
    'QuestionMediaUpload',
    {
      alt: DataTypes.STRING,
      pathKey: DataTypes.STRING,
      filename: DataTypes.STRING,
      type: DataTypes.STRING, //mime type
      dimensions: DataTypes.JSON, // size(bytes), width, height, duration(if video)
    },
    {}
  )
  QuestionMediaUpload.associate = function (models) {
    // associations can be defined here
    QuestionMediaUpload.belongsTo(models.QuestionMedia, {
      as: 'questionMedia',
      foreignKey: 'questionMediaId',
    })
  }
  return QuestionMediaUpload
}
