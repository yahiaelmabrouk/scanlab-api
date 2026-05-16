'use strict'

/*
Migration Steps:

Create QuestionMedia
Create QuestionMediaDicom
Add column to QuestionMediaUpload (questionMediaId) (allow null)
Create entry in QuestionMedia for each QuestionMediaUpload (take multipleChoiceQuestionId)
Update each row in QuestionMediaUpload to get id from QuestionMedia as questionMediaId (us multipleChoiceQuestionId)
Remove multipleChoiceQuestionId column from QuestionMediaUpload
*/

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'QuestionMedia',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          multipleChoiceQuestionId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'MultipleChoiceQuestions',
              key: 'id',
            },
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      )
      await queryInterface.createTable(
        'QuestionMediaDicoms',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          questionMediaId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'QuestionMedia',
              key: 'id',
            },
          },
          dicomFileSetId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'DicomFileSets',
              key: 'id',
            },
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      )
      await queryInterface.addColumn(
        'QuestionMediaUploads',
        'questionMediaId',
        {
          type: Sequelize.INTEGER,
          references: {
            model: 'QuestionMedia',
            key: 'id',
          },
        },
        { transaction }
      )

      await queryInterface.sequelize.query(
        `
      INSERT INTO 
        "QuestionMedia" ("multipleChoiceQuestionId", "createdAt", "updatedAt")
      SELECT
        "multipleChoiceQuestionId", "createdAt", "updatedAt"
      FROM
        "QuestionMediaUploads";
      `,
        { transaction }
      )

      await queryInterface.sequelize.query(
        `
      UPDATE 
        "QuestionMediaUploads" QMU
      SET
        "questionMediaId" = QM.id
      FROM
        "QuestionMedia" QM
      WHERE
        QM."multipleChoiceQuestionId" = QMU."multipleChoiceQuestionId";
      `,
        { transaction }
      )

      await queryInterface.removeColumn('QuestionMediaUploads', 'multipleChoiceQuestionId', { transaction })
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'QuestionMediaUploads',
        'multipleChoiceQuestionId',
        {
          type: Sequelize.INTEGER,
          references: {
            model: 'MultipleChoiceQuestions',
            key: 'id',
          },
        },
        { transaction }
      )

      await queryInterface.sequelize.query(
        `
      UPDATE 
        "QuestionMediaUploads" QMU
      SET
        "multipleChoiceQuestionId" = QM."multipleChoiceQuestionId"
      FROM
        "QuestionMedia" QM
      WHERE
        QM."id" = QMU."questionMediaId";
      `,
        { transaction }
      )
      await queryInterface.removeColumn('QuestionMediaUploads', 'questionMediaId', { transaction })
      await queryInterface.dropTable('QuestionMediaDicoms', { transaction })
      await queryInterface.dropTable('QuestionMedia', { transaction })
    })
  },
}
