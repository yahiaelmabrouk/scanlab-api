function examAssignedTemplate(examName, deepLink) {
  return {
    subject: `New exam assigned: ${examName}`,
    html: `
      <p>A new exam has been assigned to you in ScanLab: <strong>${examName}</strong>.</p>
      <p><a href="${deepLink}">Open the exam</a></p>
    `,
  }
}

function feedbackReceivedTemplate(submissionName, deepLink) {
  return {
    subject: `Feedback received on: ${submissionName}`,
    html: `
      <p>Your instructor has left feedback on your submission: <strong>${submissionName}</strong>.</p>
      <p><a href="${deepLink}">View feedback in ScanLab</a></p>
    `,
  }
}

function cohortAccountOpenedTemplate(cohortName, deepLink) {
  return {
    subject: `Your ScanLab account is ready`,
    html: `
      <p>Your ScanLab account for <strong>${cohortName}</strong> is now open and ready to use.</p>
      <p><a href="${deepLink}">Go to ScanLab</a></p>
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
  emailVerificationTemplate,
}
