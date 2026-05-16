'use strict'
module.exports = (sequelize, DataTypes) => {
  const StackQuestionResultComment = sequelize.define(
    'StackQuestionResultComment',
    {
      comment: DataTypes.STRING,
      seenAt: DataTypes.DATE(6),
      lastedUpdatedAt: DataTypes.DATE(6),
      seen: DataTypes.BOOLEAN,
    },
    {}
  )
  StackQuestionResultComment.associate = function (models) {
    StackQuestionResultComment.belongsTo(models.User, {
      as: 'viewedUser',
      foreignKey: 'viewedUserId',
      onDelete: 'SET NULL',
    })
    StackQuestionResultComment.belongsTo(models.User, {
      as: 'commentedUser',
      foreignKey: 'commentedUserId',
      onDelete: 'CASCADE',
    })
    StackQuestionResultComment.belongsTo(models.StackQuestionResult, {
      as: 'stackQuestionResult',
      foreignKey: 'stackQuestionResultId',
      onDelete: 'CASCADE',
    })
  }
  return StackQuestionResultComment
}
