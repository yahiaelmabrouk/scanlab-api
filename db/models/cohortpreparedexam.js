'use strict'
module.exports = (sequelize, DataTypes) => {
  const CohortPreparedExam = sequelize.define(
    'CohortPreparedExam',
    {
      examId: DataTypes.INTEGER,
      cohortId: DataTypes.INTEGER,
    },
    {}
  )
  CohortPreparedExam.associate = function (models) {
    CohortPreparedExam.belongsTo(models.Cohort, { as: 'cohort', foreignKey: 'cohortId' })
  }
  return CohortPreparedExam
}
