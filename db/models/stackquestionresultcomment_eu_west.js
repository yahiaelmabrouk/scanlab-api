'use strict'
module.exports = (sequelize, DataTypes) => {
  const StackQuestionResultCommentEuWest = sequelize.define(
    'StackQuestionResultCommentEuWest',
    {
      comment: DataTypes.STRING,
      seenAt: DataTypes.DATE(6),
      lastedUpdatedAt: DataTypes.DATE(6),
      seen: DataTypes.BOOLEAN,
      viewedUserId: DataTypes.INTEGER, // Foreign key to User
      commentedUserId: DataTypes.INTEGER, // Foreign key to User
      stackQuestionResultId: DataTypes.INTEGER, // Foreign key to StackQuestionResult
    },
    {
      schema: 'eu_west_server_public', // Specify the schema here
      tableName: 'StackQuestionResultComments', // Optional: explicitly set table name (useful if it differs from model name)
    }
  )
  StackQuestionResultCommentEuWest.associate = function (models) {
    StackQuestionResultCommentEuWest.belongsTo(models.User, {
      as: 'viewedUser',
      foreignKey: 'viewedUserId',
      onDelete: 'SET NULL',
    })
    StackQuestionResultCommentEuWest.belongsTo(models.User, {
      as: 'commentedUser',
      foreignKey: 'commentedUserId',
      onDelete: 'CASCADE',
    })
    StackQuestionResultCommentEuWest.belongsTo(models.StackQuestionResultEuWest, {
      as: 'stackQuestionResult',
      foreignKey: 'stackQuestionResultId',
      onDelete: 'CASCADE',
      schema: 'eu_west_server_public',
    })
  }
  return StackQuestionResultCommentEuWest
}
