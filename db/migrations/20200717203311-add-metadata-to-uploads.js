'use strict';

const _ = require('lodash')
const { QuestionMediaUpload } = require('../models');
const { getUploadUrl } = require('../../api/api_util/aws')
const probe = require('probe-image-size');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'QuestionMediaUploads',
        'type',
        {
          type: Sequelize.STRING,
        },
        { transaction })

      await queryInterface.addColumn(
        'QuestionMediaUploads',
        'dimensions',
        {
          type: Sequelize.JSON,
        },
        { transaction })

      let questionMediaUploads = await QuestionMediaUpload.findAll({ transaction });
      function timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      for (const questionMedia of questionMediaUploads) {
        const url = await getUploadUrl(questionMedia.pathKey)
        await probe(url).then(val => {
          questionMedia.type = val.mime
          questionMedia.dimensions = { width: val.width, height: val.height }
        }).catch(async err => {
          await timeout(5000)
          await probe(url).then(val2 => {
            questionMedia.type = val2.mime
            questionMedia.dimensions = { width: val2.width, height: val2.height }
          }).catch(err2 => {
            console.log(err2, questionMedia)
            // assume image
            questionMedia.type = 'image/png'
            questionMedia.dimensions = { width: 500, height: 500 }
          })
        })

        await questionMedia.save({ transaction })
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'QuestionMediaUploads', // name of Source model
      'type', // key we want to remove
    )

    return queryInterface.removeColumn(
      'QuestionMediaUploads', // name of Source model
      'dimensions', // key we want to remove
    )
  }
};
