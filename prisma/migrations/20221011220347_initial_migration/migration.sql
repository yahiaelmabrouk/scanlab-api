-- CreateEnum
CREATE TYPE "enum_RegistrationCodes_status" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "BodyParts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "BodyParts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortManagers" (
    "id" SERIAL NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CohortManagers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortPreparedExams" (
    "id" SERIAL NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "examId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CohortPreparedExams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortStudents" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "cohortId" INTEGER NOT NULL,
    "registrationCodeId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "settingsFromManager" JSON NOT NULL DEFAULT '{}',

    CONSTRAINT "CohortStudents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohorts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "availableRegistrationCodesCount" INTEGER NOT NULL DEFAULT 0,
    "studentsCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "adminSettings" JSONB NOT NULL DEFAULT '{}',
    "expirationLength" VARCHAR(255),

    CONSTRAINT "Cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DicomFileSets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "regionId" INTEGER,
    "flipSagittal" BOOLEAN,
    "type" VARCHAR(255),
    "linkedDicoms" JSON,
    "userViewOnlyAllowed" BOOLEAN NOT NULL DEFAULT false,
    "bodyPartId" INTEGER,
    "localizerNames" JSONB DEFAULT '{}',

    CONSTRAINT "DicomFileSets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinUploadToDicomFileSet" (
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "uploadId" INTEGER NOT NULL,
    "dicomFileSetId" INTEGER NOT NULL,

    CONSTRAINT "JoinUploadToDicomFileSet_pkey" PRIMARY KEY ("uploadId","dicomFileSetId")
);

-- CreateTable
CREATE TABLE "MultipleChoiceQuestionResults" (
    "id" SERIAL NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "userId" INTEGER NOT NULL,
    "multipleChoiceQuestionId" INTEGER NOT NULL,
    "testRunId" INTEGER,
    "score" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "MultipleChoiceQuestionResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultipleChoiceQuestions" (
    "id" SERIAL NOT NULL,
    "questionText" TEXT,
    "choices" JSON,
    "answerExplanation" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "bodyPartId" INTEGER,
    "difficulty" INTEGER,
    "type" VARCHAR(255) NOT NULL DEFAULT 'MC',
    "range" JSON,
    "onlyForPreparedExams" BOOLEAN NOT NULL DEFAULT false,
    "globalQuestion" BOOLEAN NOT NULL DEFAULT false,
    "secondsToAnswer" INTEGER NOT NULL DEFAULT 45,
    "screeningForm" JSONB NOT NULL DEFAULT '{}',
    "hideQuestion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MultipleChoiceQuestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparedExams" (
    "id" SERIAL NOT NULL,
    "questions" JSON NOT NULL DEFAULT '{}',
    "title" TEXT NOT NULL DEFAULT 'New Prepared Exam',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "isSkill" BOOLEAN NOT NULL DEFAULT true,
    "isHiring" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PreparedExams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMedia" (
    "id" SERIAL NOT NULL,
    "multipleChoiceQuestionId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMediaDicoms" (
    "id" SERIAL NOT NULL,
    "questionMediaId" INTEGER,
    "dicomFileSetId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionMediaDicoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMediaUploads" (
    "id" SERIAL NOT NULL,
    "alt" VARCHAR(255),
    "pathKey" VARCHAR(255),
    "filename" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "type" VARCHAR(255),
    "dimensions" JSON,
    "questionMediaId" INTEGER,

    CONSTRAINT "QuestionMediaUploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSetResults" (
    "id" SERIAL NOT NULL,
    "score" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionSetId" INTEGER,
    "testRunId" INTEGER,
    "isChallengeMode" BOOLEAN,

    CONSTRAINT "QuestionSetResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "dicomFileSet" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "bodyPartId" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "rarity" VARCHAR(255) DEFAULT 'common',

    CONSTRAINT "QuestionSets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "anatomicalOrder" INTEGER,

    CONSTRAINT "Regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCodes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "used" BOOLEAN DEFAULT false,
    "cohortId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "expirationDate" TIMESTAMPTZ(6),
    "status" "enum_RegistrationCodes_status" NOT NULL DEFAULT 'active',
    "activationDate" TIMESTAMPTZ(6),
    "numOfDaysActive" INTEGER NOT NULL DEFAULT 365,
    "userId" INTEGER,

    CONSTRAINT "RegistrationCodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackQuestionResults" (
    "id" SERIAL NOT NULL,
    "score" DECIMAL(5,2),
    "attemptedAnswerIdentifier" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "answer" JSON,
    "questionSetResultId" INTEGER,
    "stackQuestionId" INTEGER,
    "groupScoreVariables" JSONB,
    "sliceViews" JSONB,
    "skipped" BOOLEAN,
    "freebie" BOOLEAN,

    CONSTRAINT "StackQuestionResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackQuestions" (
    "id" SERIAL NOT NULL,
    "questionText" TEXT,
    "answers" JSON,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "questionSet" INTEGER NOT NULL,
    "order" INTEGER,
    "difficulty" INTEGER,
    "initialSelection" JSON,
    "ignoreInPlaneRotation" BOOLEAN DEFAULT false,
    "freebie" BOOLEAN,
    "alterVolumeView" BOOLEAN,
    "alterSpacingThickness" BOOLEAN,

    CONSTRAINT "StackQuestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRuns" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "questions" JSON,
    "answers" JSON,
    "secondsActive" INTEGER,
    "timeStarted" TIMESTAMPTZ(6),
    "timeEnded" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "score" DECIMAL(5,2),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "preparedExamId" INTEGER,
    "bodyPartId" INTEGER,

    CONSTRAINT "TestRuns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslatedContents" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TranslatedContents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uploads" (
    "id" SERIAL NOT NULL,
    "pathKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "filename" TEXT,

    CONSTRAINT "Uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "vendorStylePreference" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "isAdmin" BOOLEAN,
    "passHash" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "legalName" VARCHAR(255) NOT NULL,
    "nickName" VARCHAR(255),
    "language" VARCHAR(255),
    "lastIP" VARCHAR(255),
    "preferredAnswerCriteriaByStackQuestionId" JSONB,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequelizeMeta" (
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "body_parts_region_id" ON "BodyParts"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortManagers_cohortId_userId_key" ON "CohortManagers"("cohortId", "userId");

-- CreateIndex
CREATE INDEX "question_sets_body_part_id" ON "QuestionSets"("bodyPartId");

-- CreateIndex
CREATE UNIQUE INDEX "Regions_anatomicalOrder_key" ON "Regions"("anatomicalOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCodes_code_key" ON "RegistrationCodes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_user_id" ON "Roles"("name", "userId");

-- CreateIndex
CREATE INDEX "stack_questions_question_set" ON "StackQuestions"("questionSet");

-- CreateIndex
CREATE UNIQUE INDEX "translated_contents_key" ON "TranslatedContents"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Uploads_pathKey_key" ON "Uploads"("pathKey");

-- AddForeignKey
ALTER TABLE "BodyParts" ADD CONSTRAINT "BodyParts_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Regions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortManagers" ADD CONSTRAINT "CohortManagers_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohorts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortManagers" ADD CONSTRAINT "CohortManagers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortStudents" ADD CONSTRAINT "CohortStudents_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohorts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortStudents" ADD CONSTRAINT "CohortStudents_registrationCodeId_fkey" FOREIGN KEY ("registrationCodeId") REFERENCES "RegistrationCodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortStudents" ADD CONSTRAINT "CohortStudents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DicomFileSets" ADD CONSTRAINT "DicomFileSets_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DicomFileSets" ADD CONSTRAINT "DicomFileSets_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Regions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JoinUploadToDicomFileSet" ADD CONSTRAINT "JoinUploadToDicomFileSet_dicomFileSetId_fkey" FOREIGN KEY ("dicomFileSetId") REFERENCES "DicomFileSets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JoinUploadToDicomFileSet" ADD CONSTRAINT "JoinUploadToDicomFileSet_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Uploads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestionResults" ADD CONSTRAINT "MultipleChoiceQuestionResults_multipleChoiceQuestionId_fkey" FOREIGN KEY ("multipleChoiceQuestionId") REFERENCES "MultipleChoiceQuestions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestionResults" ADD CONSTRAINT "MultipleChoiceQuestionResults_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestionResults" ADD CONSTRAINT "MultipleChoiceQuestionResults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestions" ADD CONSTRAINT "MultipleChoiceQuestions_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestions" ADD CONSTRAINT "MultipleChoiceQuestions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionMedia" ADD CONSTRAINT "QuestionMedia_multipleChoiceQuestionId_fkey" FOREIGN KEY ("multipleChoiceQuestionId") REFERENCES "MultipleChoiceQuestions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionMediaDicoms" ADD CONSTRAINT "QuestionMediaDicoms_dicomFileSetId_fkey" FOREIGN KEY ("dicomFileSetId") REFERENCES "DicomFileSets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionMediaDicoms" ADD CONSTRAINT "QuestionMediaDicoms_questionMediaId_fkey" FOREIGN KEY ("questionMediaId") REFERENCES "QuestionMedia"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionMediaUploads" ADD CONSTRAINT "QuestionMediaUploads_questionMediaId_fkey" FOREIGN KEY ("questionMediaId") REFERENCES "QuestionMedia"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionSetResults" ADD CONSTRAINT "QuestionSetResults_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSetResults" ADD CONSTRAINT "QuestionSetResults_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionSetResults" ADD CONSTRAINT "QuestionSetResults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionSets" ADD CONSTRAINT "QuestionSets_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionSets" ADD CONSTRAINT "QuestionSets_dicomFileSet_fkey" FOREIGN KEY ("dicomFileSet") REFERENCES "DicomFileSets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RegistrationCodes" ADD CONSTRAINT "RegistrationCodes_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohorts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StackQuestionResults" ADD CONSTRAINT "StackQuestionResults_questionSetResultId_fkey" FOREIGN KEY ("questionSetResultId") REFERENCES "QuestionSetResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackQuestionResults" ADD CONSTRAINT "StackQuestionResults_stackQuestionId_fkey" FOREIGN KEY ("stackQuestionId") REFERENCES "StackQuestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackQuestions" ADD CONSTRAINT "StackQuestions_questionSet_fkey" FOREIGN KEY ("questionSet") REFERENCES "QuestionSets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TestRuns" ADD CONSTRAINT "TestRuns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
