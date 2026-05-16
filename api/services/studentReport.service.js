const _ = require('lodash')
const {
  User,
  BodyPart,
  QuestionSet,
  QuestionSetResult,
  Sequelize,
  MultipleChoiceQuestionResult,
  CohortStudent,
  Region,
  TestRun,
  UserInformationEuWest,
  UserInformation,
  sequelize,
} = require('../../db/models')
const { getUserInfomationFromUserModel } = require('../api_util/api_util')

const PRACTICE_EXAM_IDS = { MR: 48, CT: 7 }

function getPracticeExamId() {
  return process.env.APP_MODALITY === 'CT' ? PRACTICE_EXAM_IDS.CT : PRACTICE_EXAM_IDS.MR
}

/**
 * Get student information including cohort details
 * @param {number} studentId - The ID of the student
 * @returns {Promise<Object>} Student with cohort information
 */
async function getStudentInfo(studentId) {
  return await User.findOne({
    where: { id: studentId },
    include: [
      {
        model: CohortStudent,
        as: 'cohortStudents',
        include: [
          {
            model: require('../../db/models').Cohort,
            as: 'cohort',
            attributes: ['name'],
          },
        ],
      },
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })
}

/**
 * Get exam data for a student, excluding practice exams based on APP_MODALITY
 * @param {number} studentId - The ID of the student
 * @returns {Promise<Array>} Filtered exam data
 */
async function getStudentExamData(studentId) {
  const examData = await User.findAll({
    raw: true,
    order: [Sequelize.col('questionSetResults.createdAt')],
    attributes: [
      ['id', 'userId'],
      [
        Sequelize.fn('COALESCE', Sequelize.col('userInfo.legalName'), Sequelize.col('userInfoEuWest.legalName')),
        'legalName',
      ],
      [Sequelize.col('questionSetResults.id'), 'questionSetResultId'],
      [Sequelize.col('questionSetResults.score'), 'questionSetResultScore'],
      [Sequelize.col('questionSetResults.createdAt'), 'timestamp'],
      [Sequelize.col('questionSetResults->questionSet->bodyPart.name'), 'bodyPart'],
      [Sequelize.col('questionSetResults->questionSet->bodyPart->region.name'), 'region'],
      [Sequelize.col('questionSetResults->testRun.isSandbox'), 'isSandbox'],
      [Sequelize.col('questionSetResults->testRun.score'), 'score'],
      [Sequelize.col('questionSetResults.sliceQuantScore'), 'sliceQuantScore'],
      [Sequelize.col('questionSetResults->testRun.secondsActive'), 'duration'],
      [Sequelize.col('questionSetResults->testRun.id'), 'testRunId'],
      [Sequelize.col('questionSetResults->testRun.preparedExamId'), 'preparedExamId'],
    ],
    where: { id: studentId },
    include: [
      {
        model: QuestionSetResult,
        required: true,
        as: 'questionSetResults',
        attributes: [],
        include: [
          {
            model: QuestionSet,
            required: true,
            as: 'questionSet',
            attributes: [],
            include: [
              {
                model: BodyPart,
                required: true,
                as: 'bodyPart',
                attributes: [],
                include: [
                  {
                    model: Region,
                    required: true,
                    as: 'region',
                    attributes: [],
                  },
                ],
              },
            ],
          },
          {
            model: TestRun,
            required: true,
            as: 'testRun',
            attributes: [],
          },
        ],
      },
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
        attributes: [],
      },
      {
        model: UserInformation,
        as: 'userInfo',
        attributes: [],
      },
    ],
  })

  // Filter out practice exam based on modality
  return examData.filter((exam) => exam.preparedExamId !== getPracticeExamId())
}

/**
 * Get multiple choice category averages for a student
 * Uses the same method as /statistics/mc/:whom/average_overall
 * @param {number} studentId - The ID of the student
 * @returns {Promise<Array>} Category averages
 */
async function getStudentCategoryAverages(studentId) {
  try {
    const { findMCAverageParams } = require('../statistics')
    const mcAverageData = await sequelize.query(findMCAverageParams({ id: studentId }), {
      type: sequelize.QueryTypes.SELECT,
    })
    return mcAverageData.map((item) => ({
      categoryName: item.category,
      overallAverageScore: parseFloat(item.score).toFixed(2),
    }))
  } catch (error) {
    console.log('No multiple choice data found for student:', studentId)
    return []
  }
}

/**
 * Get multiple choice data for critical thinking scores
 * @param {number} studentId - The ID of the student
 * @returns {Promise<Array>} MC data for critical thinking calculations
 */
async function getStudentMcData(studentId) {
  try {
    return await User.findAll({
      raw: true,
      order: [Sequelize.col('multipleChoiceQuestionResults.createdAt')],
      attributes: [
        ['id', 'userId'],
        [Sequelize.col('multipleChoiceQuestionResults.score'), 'score'],
        [Sequelize.col('multipleChoiceQuestionResults.createdAt'), 'timestamp'],
        [Sequelize.col('multipleChoiceQuestionResults->testRun.id'), 'testRunId'],
      ],
      where: { id: studentId },
      include: [
        {
          model: MultipleChoiceQuestionResult,
          required: true,
          as: 'multipleChoiceQuestionResults',
          attributes: [],
          include: [
            {
              model: TestRun,
              required: true,
              as: 'testRun',
              attributes: [],
            },
          ],
        },
      ],
    })
  } catch (error) {
    console.log('No detailed multiple choice data found for student:', studentId)
    return []
  }
}

/**
 * Calculate body part summaries from exam data
 * Only uses non-sandbox exams for averageScore and bestScore
 * @param {Array} examData - Filtered exam data
 * @returns {Array} Body part summaries
 */
function calculateBodyPartSummaries(examData) {
  const examsByBodyPart = _.groupBy(examData, 'bodyPart')

  return Object.keys(examsByBodyPart).map((bodyPartName) => {
    const exams = examsByBodyPart[bodyPartName]
    const sandboxCount = exams.filter((e) => e.isSandbox).length
    const nonSandboxCount = exams.filter((e) => !e.isSandbox).length

    // Only calculate averageScore and bestScore from non-sandbox exams
    const nonSandboxExams = exams.filter((e) => !e.isSandbox)
    const nonSandboxScores = nonSandboxExams
      .map((e) => parseFloat(e.score || e.questionSetResultScore))
      .filter((s) => !isNaN(s))

    return {
      bodyPartName: bodyPartName,
      region: exams[0].region,
      averageScore:
        nonSandboxScores.length > 0
          ? (nonSandboxScores.reduce((a, b) => a + b, 0) / nonSandboxScores.length).toFixed(2)
          : '0.00',
      bestScore: nonSandboxScores.length > 0 ? Math.max(...nonSandboxScores).toFixed(2) : '0.00',
      takenInSandbox: sandboxCount,
      takenInNonSandbox: nonSandboxCount,
    }
  })
}

/**
 * Calculate detailed exam data by body part
 * @param {Array} examData - Filtered exam data
 * @param {Array} mcData - MC data for critical thinking scores
 * @returns {Array} Exam details by body part
 */
function calculateExamDetails(examData, mcData) {
  const examsByBodyPart = _.groupBy(examData, 'bodyPart')
  const mcByTestRun = _.groupBy(mcData, 'testRunId')

  return Object.keys(examsByBodyPart).map((bodyPartName) => {
    const exams = examsByBodyPart[bodyPartName]

    const examDetails = exams.map((exam) => {
      const mcScores = mcByTestRun[exam.testRunId] || []
      const criticalThinkingScore =
        mcScores.length > 0
          ? (mcScores.reduce((sum, mc) => sum + parseFloat(mc.score || 0), 0) / mcScores.length).toFixed(2)
          : null

      return {
        dateTaken: exam.timestamp,
        timeElapsed: exam.duration
          ? `${Math.floor(exam.duration / 60)}:${(exam.duration % 60).toString().padStart(2, '0')}`
          : null,
        overallScore: parseFloat(exam.score || exam.questionSetResultScore || 0).toFixed(2),
        clinicalScore: parseFloat(exam.sliceQuantScore || exam.questionSetResultScore || 0).toFixed(2),
        criticalThinkingScore: criticalThinkingScore,
        mode: exam.isSandbox ? 'Sandbox' : 'Non-Sandbox',
      }
    })

    const sandboxCount = exams.filter((e) => e.isSandbox).length
    const nonSandboxCount = exams.filter((e) => !e.isSandbox).length

    return {
      bodyPartName: bodyPartName,
      examDetails: examDetails,
      overallAttemptsSummary: {
        sandboxModeTotal: sandboxCount,
        nonSandboxModeTotal: nonSandboxCount,
      },
    }
  })
}

/**
 * Format the complete student report data
 * @param {Object} student - Student information
 * @param {Array} examData - Filtered exam data
 * @param {Array} categoryAverages - Category averages
 * @param {Array} mcData - MC data
 * @returns {Object} Complete formatted report data
 */
function formatStudentReportData(student, examData, categoryAverages, mcData) {
  const exportDate = new Date().toISOString()
  const cohortStudent = student.cohortStudents[0]
  const userInfo = getUserInfomationFromUserModel(student)

  // General Info
  const generalInfo = {
    studentName: userInfo.legalName,
    studentId: student.id,
    studentEmail: student.email,
    cohortName: cohortStudent.cohort.name,
    registrationDate: userInfo.createdAt,
    exportDate: exportDate,
  }

  // Calculate summaries and details
  const bodyPartSummaries = calculateBodyPartSummaries(examData)
  const examDetailsByBodyPart = calculateExamDetails(examData, mcData)

  return {
    generalInfo: generalInfo,
    examSummaryInfo: {
      bodyParts: bodyPartSummaries,
      categories: categoryAverages,
    },
    examDetails: examDetailsByBodyPart,
  }
}

/**
 * Main service function to get complete student report data
 * @param {number} studentId - The ID of the student
 * @returns {Promise<Object>} Complete student report data
 */
async function getStudentReportData(studentId) {
  // Get all required data
  const [student, examData, categoryAverages, mcData] = await Promise.all([
    getStudentInfo(studentId),
    getStudentExamData(studentId),
    getStudentCategoryAverages(studentId),
    getStudentMcData(studentId),
  ])

  if (!student) {
    throw new Error('Student not found')
  }

  const cohortStudent = student.cohortStudents[0]
  if (!cohortStudent) {
    throw new Error('Student is not part of any cohort')
  }

  return formatStudentReportData(student, examData, categoryAverages, mcData)
}

/**
 * Get bulk exam data for multiple students
 * @param {Array} studentIds - Array of student IDs
 * @returns {Promise<Object>} Object mapping student IDs to their exam data
 */
async function getBulkExamData(studentIds) {
  const examData = await User.findAll({
    raw: true,
    order: [Sequelize.col('questionSetResults.createdAt')],
    attributes: [
      ['id', 'userId'],
      [
        Sequelize.fn('COALESCE', Sequelize.col('userInfo.legalName'), Sequelize.col('userInfoEuWest.legalName')),
        'legalName',
      ],
      [Sequelize.col('questionSetResults.id'), 'questionSetResultId'],
      [Sequelize.col('questionSetResults.score'), 'questionSetResultScore'],
      [Sequelize.col('questionSetResults.createdAt'), 'timestamp'],
      [Sequelize.col('questionSetResults->questionSet->bodyPart.name'), 'bodyPart'],
      [Sequelize.col('questionSetResults->questionSet->bodyPart->region.name'), 'region'],
      [Sequelize.col('questionSetResults->testRun.isSandbox'), 'isSandbox'],
      [Sequelize.col('questionSetResults->testRun.score'), 'score'],
      [Sequelize.col('questionSetResults.sliceQuantScore'), 'sliceQuantScore'],
      [Sequelize.col('questionSetResults->testRun.secondsActive'), 'duration'],
      [Sequelize.col('questionSetResults->testRun.id'), 'testRunId'],
      [Sequelize.col('questionSetResults->testRun.preparedExamId'), 'preparedExamId'],
    ],
    where: { id: { [Sequelize.Op.in]: studentIds } },
    include: [
      {
        model: QuestionSetResult,
        required: true,
        as: 'questionSetResults',
        attributes: [],
        include: [
          {
            model: QuestionSet,
            required: true,
            as: 'questionSet',
            attributes: [],
            include: [
              {
                model: BodyPart,
                required: true,
                as: 'bodyPart',
                attributes: [],
                include: [
                  {
                    model: Region,
                    required: true,
                    as: 'region',
                    attributes: [],
                  },
                ],
              },
            ],
          },
          {
            model: TestRun,
            required: true,
            as: 'testRun',
            attributes: [],
          },
        ],
      },
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
        attributes: [],
      },
      {
        model: UserInformation,
        as: 'userInfo',
        attributes: [],
      },
    ],
  })

  // Filter out practice exam based on modality and group by student
  const filteredData = examData.filter((exam) => exam.preparedExamId !== getPracticeExamId())
  return _.groupBy(filteredData, 'userId')
}

/**
 * Get bulk MC data for multiple students
 * @param {Array} studentIds - Array of student IDs
 * @returns {Promise<Object>} Object mapping student IDs to their MC data
 */
async function getBulkMcData(studentIds) {
  try {
    const mcData = await User.findAll({
      raw: true,
      order: [Sequelize.col('multipleChoiceQuestionResults.createdAt')],
      attributes: [
        ['id', 'userId'],
        [Sequelize.col('multipleChoiceQuestionResults.score'), 'score'],
        [Sequelize.col('multipleChoiceQuestionResults.createdAt'), 'timestamp'],
        [Sequelize.col('multipleChoiceQuestionResults->testRun.id'), 'testRunId'],
      ],
      where: { id: { [Sequelize.Op.in]: studentIds } },
      include: [
        {
          model: MultipleChoiceQuestionResult,
          required: true,
          as: 'multipleChoiceQuestionResults',
          attributes: [],
          include: [
            {
              model: TestRun,
              required: true,
              as: 'testRun',
              attributes: [],
            },
          ],
        },
      ],
    })

    return _.groupBy(mcData, 'userId')
  } catch (error) {
    console.log('No bulk MC data found for students')
    return {}
  }
}

/**
 * Get bulk category averages for multiple students
 * @param {Array} studentIds - Array of student IDs
 * @returns {Promise<Object>} Object mapping student IDs to their category averages
 */
async function getBulkCategoryAverages(studentIds) {
  try {
    const { findMCAverageParams } = require('../statistics')
    const mcAverageData = await sequelize.query(
      findMCAverageParams({ id: { [Sequelize.Op.in]: studentIds } }),
      { type: sequelize.QueryTypes.SELECT }
    )

    // Group by student ID and format
    const groupedData = _.groupBy(mcAverageData, 'userId')
    return _.mapValues(groupedData, (items) =>
      items.map((item) => ({
        categoryName: item.category,
        overallAverageScore: parseFloat(item.score).toFixed(2),
      }))
    )
  } catch (error) {
    console.log('No bulk category averages found for students')
    return {}
  }
}

/**
 * Process students in batches to prevent timeout with optimized bulk queries
 * @param {Array} studentIds - Array of student IDs
 * @param {Array} cohortStudents - Array of cohort students
 * @param {Object} cohort - Cohort object
 * @param {number} batchSize - Number of students to process per batch
 * @returns {Promise<Array>} Array of student reports
 */
async function processStudentsBatched(studentIds, cohortStudents, cohort, batchSize = 10) {
  const studentReports = []
  const totalStudents = studentIds.length

  console.log(`Processing ${totalStudents} students in batches of ${batchSize}`)

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(totalStudents / batchSize)

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} students)`)

    // Get bulk data for the entire batch
    const [bulkExamData, bulkMcData, bulkCategoryAverages] = await Promise.all([
      getBulkExamData(batch),
      getBulkMcData(batch),
      getBulkCategoryAverages(batch),
    ])

    // Process each student in the batch using the pre-fetched bulk data
    const batchReports = await Promise.all(
      batch.map(async (studentId) => {
        try {
          const student = cohortStudents.find((cs) => cs.userId === studentId)
          if (!student) {
            throw new Error('Student not found in cohort')
          }

          const examData = bulkExamData[studentId] || []
          const mcData = bulkMcData[studentId] || []
          const categoryAverages = bulkCategoryAverages[studentId] || []

          // Format student data for batch processing
          const exportDate = new Date().toISOString()
          const userInfo = {
            legalName: student.user.legalName,
            email: student.user.email,
            createdAt: student.user.createdAt,
          }

          // General Info
          const generalInfo = {
            studentName: userInfo.legalName,
            studentId: student.userId,
            studentEmail: userInfo.email,
            cohortName: cohort.name,
            registrationDate: userInfo.createdAt,
            exportDate: exportDate,
          }

          // Calculate summaries and details
          const bodyPartSummaries = calculateBodyPartSummaries(examData)
          const examDetailsByBodyPart = calculateExamDetails(examData, mcData)

          return {
            generalInfo: generalInfo,
            examSummaryInfo: {
              bodyParts: bodyPartSummaries,
              categories: categoryAverages,
            },
            examDetails: examDetailsByBodyPart,
          }
        } catch (error) {
          // If a student has no data, return a minimal structure
          const student = cohortStudents.find((cs) => cs.userId === studentId)
          return {
            generalInfo: {
              studentName: student.user.legalName,
              studentId: student.userId,
              studentEmail: student.user.email,
              cohortName: cohort.name,
              registrationDate: student.user.createdAt,
              exportDate: new Date().toISOString(),
            },
            examSummaryInfo: {
              bodyParts: [],
              categories: [],
            },
            examDetails: [],
            error: error.message,
          }
        }
      })
    )

    studentReports.push(...batchReports)

    // Add small delay between batches to prevent overwhelming the database
    if (i + batchSize < studentIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return studentReports
}

/**
 * Get report data for all students in a cohort
 * @param {number} cohortId - The ID of the cohort
 * @returns {Promise<Object>} Complete cohort students report data
 */
async function getCohortStudentsReportData(cohortId) {
  // First, verify the cohort exists and get all students in the cohort
  const cohortStudents = await CohortStudent.findAll({
    where: { cohortId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: [
          'id',
          [
            Sequelize.literal(`
              COALESCE(
                "user->userInfo"."legalName",
                "user->userInfoEuWest"."legalName",
                'N/A'
              )
            `),
            'legalName',
          ],
          [
            Sequelize.literal(`
              COALESCE(
                "user->userInfo"."email",
                "user->userInfoEuWest"."email",
                'N/A'
              )
            `),
            'email',
          ],
          'createdAt',
        ],
        include: [
          {
            model: UserInformationEuWest,
            as: 'userInfoEuWest',
          },
          {
            model: UserInformation,
            as: 'userInfo',
          },
        ],
      },
      {
        model: require('../../db/models').Cohort,
        as: 'cohort',
        attributes: ['name'],
      },
    ],
  })

  if (!cohortStudents || cohortStudents.length === 0) {
    throw new Error('No students found in cohort')
  }

  const cohort = cohortStudents[0].cohort
  const studentIds = cohortStudents.map((cs) => cs.userId)

  // Use batched processing for large cohorts
  const batchSize = studentIds.length > 50 ? 10 : 25
  const studentReports = await processStudentsBatched(studentIds, cohortStudents, cohort, batchSize)

  return {
    cohortInfo: {
      cohortId: cohortId,
      cohortName: cohort.name,
      totalStudents: studentReports.length,
      exportDate: new Date().toISOString(),
    },
    students: studentReports,
  }
}

module.exports = {
  getStudentReportData,
  getCohortStudentsReportData,
  processStudentsBatched,
  getBulkExamData,
  getBulkMcData,
  getBulkCategoryAverages,
  getStudentInfo,
  getStudentExamData,
  getStudentCategoryAverages,
  getStudentMcData,
  calculateBodyPartSummaries,
  calculateExamDetails,
  formatStudentReportData,
}
