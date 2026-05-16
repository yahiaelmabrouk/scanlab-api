'use strict';

module.exports = {
  /**
     * @typedef {import('sequelize').Sequelize} Sequelize
     * @typedef {import('sequelize').QueryInterface} QueryInterface
     */
  
    /**
     * @param {QueryInterface} queryInterface
     * @param {Sequelize} Sequelize
     * @returns
     */
    up: async function(queryInterface, Sequelize) {
      return queryInterface.sequelize.transaction(async t => {
        await Promise.all([
          queryInterface.removeColumn('Uploads', 'userId', { transaction: t }),
          queryInterface.removeColumn('DicomFileSets', 'userId', { transaction: t }),
          queryInterface.removeColumn('Users', 'userId', { transaction: t })
        ])

        // Can't use bulkDelete since transaction can't be specified there
        await queryInterface.sequelize.query(`TRUNCATE TABLE "Users"`, { transaction: t })

        await Promise.all([
          queryInterface.addColumn('Users', 'passHash', {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
          }, { transaction: t }),
          queryInterface.addColumn('Users', 'email', {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
            unique: true
          }, { transaction: t }),
          queryInterface.addColumn('Users', 'legalName', {
            type: Sequelize.DataTypes.STRING,
            allowNull: false
          }, { transaction: t }),
          queryInterface.addColumn('Users', 'nickName', {
            type: Sequelize.DataTypes.STRING,
            allowNull: true
          }, { transaction: t })
          ])

          return Promise.resolve()
          })
    },
  
    down: function(queryInterface, Sequelize) {

    }
  }
