const fs = require('fs')
const path = require('path')
const axios = require('axios')
const express = require('express')

const CACHE_DIR = path.join(__dirname, `../../s3cache`)
// This makes it use the local filesystem's s3 cache, which only works during local development - the idea is to not need to connect to the internet to dev on Scanlab (so no need to dl files from s3 constantly locally)
const USE_CACHE = !process.env.NODE_ENV // On a local dev machine, this env var is undefined; anywhere else it's defined
const IS_DOWNLOADING_BY_FILEPATH = {} // {filePath: Promise} tracks in-flight downloads

if (USE_CACHE) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function getLocalFilePath(bucketName, pathKey) {
  return path.join(CACHE_DIR, bucketName, pathKey)
}

function isFileFullyCached(bucketName, pathKey) {
  let filePath = getLocalFilePath(bucketName, pathKey)
  try {
    const stats = fs.statSync(filePath)
    return stats.size > 0
  } catch {
    return false
  }
}

async function startCachingAsNeeded(url, bucketName, pathKey) {
  if (!USE_CACHE) {
    return
  }

  let filePath = getLocalFilePath(bucketName, pathKey)
  let folderPath = path.dirname(filePath)

  // If already downloading, return the existing promise
  if (IS_DOWNLOADING_BY_FILEPATH[filePath]) {
    return IS_DOWNLOADING_BY_FILEPATH[filePath]
  }

  // Track the download with a promise so concurrent callers can await it
  IS_DOWNLOADING_BY_FILEPATH[filePath] = (async () => {
    try {
      fs.mkdirSync(folderPath, { recursive: true })

      const response = await axios({
        method: 'get',
        responseType: 'stream',
        url,
      })

      // Write to a temp file first, then rename — prevents serving partial files
      const tmpPath = filePath + '.tmp'
      const writer = fs.createWriteStream(tmpPath)

      await new Promise((resolve, reject) => {
        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error', reject)
        response.data.on('error', reject)
      })

      // Verify the download produced a non-empty file
      const stats = fs.statSync(tmpPath)
      if (stats.size === 0) {
        fs.unlinkSync(tmpPath)
        throw new Error('Downloaded file is empty')
      }

      // Atomic rename — express.static will only see the complete file
      fs.renameSync(tmpPath, filePath)
      console.log('S3Cache - File Cached:', bucketName, pathKey, `(${stats.size} bytes)`)
    } catch (error) {
      // Clean up temp file if it exists
      const tmpPath = filePath + '.tmp'
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath)
      }
      // Clean up 0-byte target file if it exists
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath)
          if (stats.size === 0) fs.unlinkSync(filePath)
        } catch { /* ignore */ }
      }
      console.error('S3Cache - Error Caching File:', bucketName, pathKey, error.message || error)
    } finally {
      // Allow retry on next request
      delete IS_DOWNLOADING_BY_FILEPATH[filePath]
    }
  })()

  return IS_DOWNLOADING_BY_FILEPATH[filePath]
}

// Gets the same URL passed in if not caching; will auto-cache files and return local url instead once they are ready otherwise
// url - where to remotely download from if not in cache yet
// bucketName / pathKey - used for where to store locally
function getS3CachedUrl(url, bucketName, pathKey) {
  if (!USE_CACHE) {
    return url
  }

  if (!isFileFullyCached(bucketName, pathKey)) {
    console.log('S3Cache Miss: ', bucketName, pathKey)
    startCachingAsNeeded(url, bucketName, pathKey)
    // Return the remote url while we're still caching
    return url
  } else {
    console.log('S3Cache Hit: ', bucketName, pathKey)
    // Return the local cache url
    return `http://localhost:6200/s3cache/${bucketName}/${pathKey}`
  }
}

// Serve the static files over our express server
function mountS3Cache(app) {
  if (USE_CACHE) {
    app.use('/s3cache', express.static(CACHE_DIR))
  }
}

module.exports = {
  getS3CachedUrl,
  mountS3Cache,
}
