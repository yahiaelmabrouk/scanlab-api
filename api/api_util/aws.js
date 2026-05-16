const { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl: s3GetSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { createPresignedPost: s3CreatePresignedPost } = require('@aws-sdk/s3-presigned-post')
const { getSignedUrl: cfGetSignedUrl } = require('@aws-sdk/cloudfront-signer')
const { Upload } = require('@aws-sdk/lib-storage')
const { getS3CachedUrl } = require('./s3Cacher')
const moment = require('moment/moment')
const { USER_AREA } = require('../../util/constants')

const CLOUDFRONT_DOMAIN = 'd3azr9dsmntgz5.cloudfront.net'
const CLOUDFRONT_KEY_PAIR_ID = process.env.AWS_CLOUDFRONT_ACCESS_KEY || null
const CLOUDFRONT_PRIVATE_KEY =
  process.env.AWS_CLOUDFRONT_PRIVATE_KEY
    ? Buffer.from(process.env.AWS_CLOUDFRONT_PRIVATE_KEY, 'base64').toString('ascii')
    : null

const CLOUDFRONT_EU_WEST_DOMAIN = 'd1fdavak7f7uu.cloudfront.net'
const CLOUDFRONT_EU_WEST_KEY_PAIR_ID = process.env.AWS_CLOUDFRONT_EU_WEST_ACCESS_KEY || null
const CLOUDFRONT_EU_WEST_PRIVATE_KEY =
  process.env.AWS_CLOUDFRONT_EU_WEST_PRIVATE_KEY
    ? Buffer.from(process.env.AWS_CLOUDFRONT_EU_WEST_PRIVATE_KEY, 'base64').toString('ascii')
    : null

const S3_BUCKET = 'scanlab-uploads'
const S3_EU_BUCKET = 'scanlab-eu'
const S3_US_EAST = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const S3_EU_WEST = new S3Client({
  region: 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_EU_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_EU_SECRET_ACCESS_KEY || '',
  },
})

async function getUploadUrl(pathKey) {
  // Have presigned urls expire on the 2nd of the next month. Browsers only cache the urls if they match (which they only do if they keep expiring at the same time)
  // This way the caching works during the same current calendar month, without needing to store anything anywhere
  //  Make it the next day to give a little buffer from when they rotate (which would be as soon as it's the next month)
  let momentNextMonth = moment().add(1, 'months').startOf('month').add(1, 'days')

  let url
  if (CLOUDFRONT_KEY_PAIR_ID && CLOUDFRONT_PRIVATE_KEY) {
    url = cfGetSignedUrl({
      url: `https://${CLOUDFRONT_DOMAIN}/${pathKey}`,
      keyPairId: CLOUDFRONT_KEY_PAIR_ID,
      privateKey: CLOUDFRONT_PRIVATE_KEY,
      policy: JSON.stringify({
        Statement: [
          {
            Resource: `https://${CLOUDFRONT_DOMAIN}/*`,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': momentNextMonth.unix(),
              },
            },
          },
        ],
      }),
    })
  } else {
    url = await s3GetSignedUrl(
      S3_US_EAST,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: pathKey }),
      { expiresIn: momentNextMonth.diff(moment(), 'seconds') }
    )
  }

  return getS3CachedUrl(url, S3_BUCKET, pathKey)
}

// Get the uploaded user data
async function getUploadUrlForRegoin(pathKey, bucket = S3_BUCKET) {
  let momentNextMonth = moment().add(1, 'months').startOf('month').add(1, 'days')

  const isEU = bucket === S3_EU_BUCKET
  const domain = isEU ? CLOUDFRONT_EU_WEST_DOMAIN : CLOUDFRONT_DOMAIN
  const keyPairId = isEU ? CLOUDFRONT_EU_WEST_KEY_PAIR_ID : CLOUDFRONT_KEY_PAIR_ID
  const privateKey = isEU ? CLOUDFRONT_EU_WEST_PRIVATE_KEY : CLOUDFRONT_PRIVATE_KEY

  let url = ''
  if (keyPairId && privateKey) {
    url = cfGetSignedUrl({
      url: `https://${domain}/${pathKey}`,
      keyPairId,
      privateKey,
      policy: JSON.stringify({
        Statement: [
          {
            Resource: `https://${domain}/*`,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': momentNextMonth.unix(),
              },
            },
          },
        ],
      }),
    })
  } else {
    const client = isEU ? S3_EU_WEST : S3_US_EAST
    url = await s3GetSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: pathKey }),
      { expiresIn: momentNextMonth.diff(moment(), 'seconds') }
    )
  }

  return getS3CachedUrl(url, bucket, pathKey)
}

async function createPresignedPost(pathKey, bucket = S3_BUCKET, contentType = 'application/octet-stream') {
  const client = bucket === S3_EU_BUCKET ? S3_EU_WEST : S3_US_EAST
  const { url, fields } = await s3CreatePresignedPost(client, {
    Bucket: bucket,
    Key: pathKey,
    Fields: {
      acl: 'private',
      'Content-Type': contentType,
      'Cache-Control': 'public,max-age=315360000,immutable',
      success_action_status: '201',
    },
    Expires: 3 * 60 * 60, // 3 hours
  })
  return { url, fields }
}

async function copyObject(bucket, copySource, targetPathKey) {
  return await S3_US_EAST.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: targetPathKey,
    })
  )
}

async function deleteObject(bucket, pathKey) {
  return await S3_US_EAST.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: pathKey,
    })
  )
}

async function getSignedUrl(operation, pathKey, bucket = S3_BUCKET, contentType = 'application/json') {
  const CommandClass = operation === 'putObject' ? PutObjectCommand : require('@aws-sdk/client-s3').GetObjectCommand
  return await s3GetSignedUrl(
    S3_US_EAST,
    new CommandClass({
      Bucket: bucket,
      Key: pathKey,
      ContentType: contentType,
    })
  )
}

// Upload user data
async function s3Upload(bucket, pathKey, buf, contentType = 'image/jpeg') {
  const s3Client = bucket === S3_EU_BUCKET ? S3_EU_WEST : S3_US_EAST
  const upload = new Upload({
    client: s3Client,
    params: {
      Key: pathKey,
      Body: buf,
      Bucket: bucket,
      ContentType: contentType,
    },
  })
  return await upload.done()
}

function getS3BucketOfRegion(region) {
  if (region === USER_AREA.EU_WEST) {
    return S3_EU_BUCKET
  } else if (region === USER_AREA.US_EAST) {
    return S3_BUCKET
  } else {
    return S3_BUCKET
  }
}

module.exports = {
  CLOUDFRONT_DOMAIN,
  S3_BUCKET,
  S3_EU_BUCKET,
  createPresignedPost,
  copyObject,
  deleteObject,
  getSignedUrl,
  getUploadUrl,
  getUploadUrlForRegoin,
  s3Upload,
  getS3BucketOfRegion,
}
