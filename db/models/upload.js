'use strict'
module.exports = (sequelize, DataTypes) => {
  const Upload = sequelize.define(
    'Upload',
    {
      pathKey: DataTypes.STRING,
      filename: DataTypes.TEXT,
    },
    {}
  )
  Upload.associate = function (models) {
    // associations can be defined here
    // https://medium.com/@andrewoons/how-to-define-sequelize-associations-using-migrations-de4333bf75a7
    // http://docs.sequelizejs.com/manual/associations.html#belongs-to-many-associations
    Upload.belongsToMany(models.DicomFileSet, {
      as: 'DicomFileSet',
      through: 'JoinUploadToDicomFileSet',
      foreignKey: 'uploadId',
    })
  }
  return Upload
}
