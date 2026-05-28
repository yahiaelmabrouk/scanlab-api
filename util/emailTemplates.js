function examAssignedTemplate(examName) {
  return {
    subject: `New exam assigned: ${examName}`,
    html: `
      <p>A new exam has been assigned to you in ScanLab: <strong>${examName}</strong>.</p>
    `,
  }
}

function feedbackReceivedTemplate(submissionName) {
  return {
    subject: `Feedback received on: ${submissionName}`,
    html: `
      <p>Your instructor has left feedback on your submission: <strong>${submissionName}</strong>.</p>
    `,
  }
}

function cohortAccountOpenedTemplate(cohortName) {
  return {
    subject: `Your ScanLab account is ready`,
    html: `
      <p>Your ScanLab account for <strong>${cohortName}</strong> is now open and ready to use.</p>
    `,
  }
}

function examUnlockedTemplate(examNames) {
  return {
    subject: `New exam unlocked`,
    html: `
      <p>Your instructor has unlocked the following in ScanLab: <strong>${examNames}</strong>.</p>
      <p>You can now access it from your exam list.</p>
    `,
  }
}

function examSandboxEnabledTemplate(examNames) {
  return {
    subject: `Sandbox mode enabled`,
    html: `
      <p>Your instructor has enabled sandbox mode for: <strong>${examNames}</strong>.</p>
      <p>You can now practice freely in sandbox mode.</p>
    `,
  }
}

function examSandboxDisabledTemplate(examNames) {
  return {
    subject: `Sandbox mode disabled`,
    html: `
      <p>Your instructor has turned off sandbox mode for: <strong>${examNames}</strong>.</p>
    `,
  }
}

function feedbackRepliedTemplate(studentName) {
  return {
    subject: `${studentName} responded to your feedback`,
    html: `
      <p><strong>${studentName}</strong> responded to your feedback!</p>
    `,
  }
}

function studentExamCompletedTemplate(studentName, examName) {
  return {
    subject: `${studentName} completed a prepared exam`,
    html: `
      <p><strong>${studentName}</strong> completed a prepared exam of <strong>${examName}</strong>.</p>
    `,
  }
}

function newFeatureTemplate(featureName) {
  return {
    subject: `New feature available: ${featureName}`,
    html: `
      <p>We've just released a new feature in ScanLab: <strong>${featureName}</strong>.</p>
      <p>Log in to check it out!</p>
    `,
  }
}

function knownBugTemplate(bugDescription) {
  return {
    subject: `Known issue: ${bugDescription}`,
    html: `
      <p>We're aware of an issue in ScanLab and are working on a fix:</p>
      <p><strong>${bugDescription}</strong></p>
      <p>Thanks for your patience.</p>
    `,
  }
}

function accountExpiringTemplate(days) {
  const dayWord = days === 1 ? 'day' : 'days'
  return {
    subject: `Your ScanLab account expires in ${days} ${dayWord}`,
    html: `
      <p>Heads up — your ScanLab account will expire in <strong>${days} ${dayWord}</strong>.</p>
      <p>Please contact your administrator if you'd like to renew your access.</p>
    `,
  }
}

function emailVerificationTemplate(name, verificationLink) {
  return {
    subject: `Verify your ScanLab email address`,
    html: `
      <p>Hey ${name},</p>
      <p>Thanks for signing up for ScanLab! Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you did not create a ScanLab account you can ignore this email.</p>
    `,
  }
}

module.exports = {
  examAssignedTemplate,
  feedbackReceivedTemplate,
  cohortAccountOpenedTemplate,
  examUnlockedTemplate,
  examSandboxEnabledTemplate,
  examSandboxDisabledTemplate,
  feedbackRepliedTemplate,
  studentExamCompletedTemplate,
  newFeatureTemplate,
  knownBugTemplate,
  accountExpiringTemplate,
  emailVerificationTemplate,
}
