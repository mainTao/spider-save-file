const https = require('https');
const http = require('http');
const urlUtil = require('url')
const fs = require('fs');
const path = require('path')
const mime = require('./mime-extension')

async function downloadFile({
  url,
  options,
  downloadPath,
  fileName,
  onProgress,
  progressInterval
}) {
  return new Promise((resolve, reject) => {
    // 如果路径不存在报错

    let startTime = new Date
    let client = url.startsWith('https://') ? https : http
    if (!options) {
      options = {}
    }
    const request = client.get(url, options, async function (response) {
      if ([301, 302, 307].includes(response.statusCode)) {
        url = response.headers['location']
        resolve(downloadFile({
          url,
          options,
          downloadPath,
          fileName,
          onProgress,
          progressInterval
        }))
      } else if (response.statusCode >= 400) {
        reject(response)
      } else { // download
        let downloadedLength = 0 // 下载下来的总字节数
        let lastPeriodLength = 0 // 上个周期下载到的字节数
        let timer

        let contentLength = parseInt(response.headers['content-length'])
        if (!fileName) { // 如果没有指明名字
          // 先看 content-dispositon 
          let contentDisposition = response.headers['content-disposition']
          if (contentDisposition) {
            let matches = contentDisposition.match(/filename="(.*)"/)
            fileName = matches && matches[1]
          }

          if (!fileName) { // content-disposition 没有再看 content-type
            // 要结合着 content-type 和 URL 里可能的文件名后缀名一起来定扩展名
            let parsed = urlUtil.parse(url)
            fileName = path.posix.basename(parsed.pathname)
            if(!fileName){ // 没有文件名，用hostname
              fileName = parsed.hostname
            }
            // 从 content-type 获得扩展名
            let fileExt = path.extname(fileName)
            let extension = mime.getExtension(response.headers['content-type'], fileExt)
            if (fileExt !== extension) {
              fileName += `.${extension}`
            }
          }
        }

        let fullPath = path.join(downloadPath, fileName)
        let fileStream = fs.createWriteStream(fullPath);

        fileStream.on('finish', () => {
          resolve({
            fileName,
            fullPath,
            startTime,
            endTime: new Date,
            contentLength
          })
          clearInterval(timer)
        })

        fileStream.on('error', (err) => {
          fs.unlink(fileStream)
          reject(err)
          clearInterval(timer)
        })

        response.pipe(fileStream);

        // download progress
        if (typeof onProgress === 'function') {
          response.on('data', (chunk) => {
            downloadedLength += chunk.length
            lastPeriodLength += chunk.length
          })
          timer = setInterval(() => {
            let currentSpeed = lastPeriodLength / progressInterval / 1000 // Unit: Bytes per second
            onProgress({
              downloadedLength,
              contentLength,
              currentSpeed
            })
            lastPeriodLength = 0
          }, interval);
        }

      }

    })

    request.on('error', (err) => {
      reject(err)
    })
  })
}

module.exports = downloadFile