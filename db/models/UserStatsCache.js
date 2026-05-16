'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserStatsCache = sequelize.define('UserStatsCache', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // which user this cache is for
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // "statistics"  OR  "tests_whom"
    cacheType: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // did we include challenge mode scores for this cache?
    includeChallengeMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // the actual precomputed payload we will serve to clients
    // this is an array of rows for that user, same shape we already return today
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    lastUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    lastUsed: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'UserStatsCaches',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'cacheType', 'includeChallengeMode'],
      },
      {
        fields: ['lastUsed'],
      },
    ],
  })

  return UserStatsCache
}