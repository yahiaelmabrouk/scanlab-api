'use strict'
module.exports = (sequelize, DataTypes) => {
  const StackQuestion = sequelize.define(
    'StackQuestion',
    {
      questionText: DataTypes.TEXT,
      difficulty: DataTypes.INTEGER,
      questionSet: DataTypes.INTEGER,
      questionType: DataTypes.INTEGER,
      phaseNum: DataTypes.INTEGER, // Used for CT Acq (post contrast) question
      postContrast: DataTypes.BOOLEAN,
      title: DataTypes.TEXT,
      hideSetDelay: DataTypes.BOOLEAN,
      order: DataTypes.INTEGER,
      initialSelection: DataTypes.JSON, // DEPRECATED - these live inside the answers now, as `ID_proposed`
      ignoreInPlaneRotation: DataTypes.BOOLEAN,
      answers: DataTypes.JSON,
      freebie: DataTypes.BOOLEAN,
      alterVolumeView: DataTypes.BOOLEAN, // true: turn on Volume View, false: turn off Volume View, null: leave as-is
      gradeContats: DataTypes.BOOLEAN,
      dontGradeEfficiency: DataTypes.BOOLEAN,
      dontGradePixelShift: DataTypes.BOOLEAN,
      hasSpecialtyOptions: DataTypes.BOOLEAN,
      alterSpacingThickness: DataTypes.BOOLEAN, // true: set Spacing/Thickness to what admin set for the current answer when changing answers/questions; false/null: try to keep user's value
      hdBranchId: DataTypes.TEXT, // For branching Dicom, where each StackQuestion can be set to load a different 'branch' of Dicom images when doing a Scan (this looks at the Dicom filenames to figure out which branch they are)
      ldBranchId: DataTypes.TEXT, // Like above, but for "Add Localizer" button instead of Scan
      contrastRangePresetId: DataTypes.INTEGER,
      initialLocalizerWhitelist: DataTypes.JSON,
      displayVariants: DataTypes.JSON,
      displayVariantSelectionId: DataTypes.TEXT,
      //[{
      // "id": "9de6f1f9-8158-49f7-b403-e4c3389be6d2",
      // "name": "Answer Name",
      // "criteria": "",
      // "citation": "",
      // "0_min": {...} // correct answer min selection
      // "0_max": {...} // correct answer max selection
      // "0_proposed": {...} // initial selection when picking answer for user
      //}]
    },
    {}
  )
  StackQuestion.associate = function (models) {
    StackQuestion.belongsTo(models.QuestionSet, { foreignKey: 'questionSet' })
    // Only used for Change patient position question
    StackQuestion.belongsTo(models.PatientPositionSet, { as: 'patientPositionSet', foreignKey: 'positionSetId' })
  }
  return StackQuestion
}
