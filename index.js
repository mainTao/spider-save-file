const https = require('https');
const http = require('http');
const urlUtil = require('url')
const fs = require('fs');
const path = require('path')
const mime = require('./mime-extension')

async function availableFilePath(downloadPath, fileName) {
  const checkName = async (downloadPath, tryName) => {
    return new Promise((resolve, reject) => {
      fs.access(path.join(downloadPath, tryName), fs.constants.F_OK, (err) => {
        if (err) { // 不存在同名文件，则表示可用
          resolve(tryName)
        } else {
          reject()
        }
      })
    })
  }
  let tryName = fileName
  let n = 0
  while (true) {
    try {
      let result = await checkName(downloadPath, tryName)
      if (result) {
        return result
      }
    } catch (error) {
      // 有重名文件，序号加一，再试探
      let {
        name,
        ext
      } = path.parse(fileName)
      name += ` (${++n})`
      tryName = name + ext
    }
  }

}

async function downloadFile({
  url,
  options, // http.request options
  downloadPath,
  fileName,
  onProgress,
  progressInterval
}) {
  return new Promise((resolve, reject) => {
    let startTime = new Date

    let urlObj = urlUtil.parse(url)
    let client = urlObj.protocol === 'https:' ? https : http
    let optionObj = {
      ...urlObj,
      ...options
    }

    if (!downloadPath) {
      downloadPath = '.' // 未指定则下载到当前目录
    }

    const request = client.request(optionObj, async function (response) {
      if ([301, 302, 307].includes(response.statusCode)) {
        url = response.headers['location']
        resolve(downloadFile({
          url,
          options, // 原 options
          downloadPath,
          fileName,
          onProgress,
          progressInterval
        }))
      } else if (response.statusCode >= 400) {
        reject(response)
      } else { // 正常返回，进入下载流程
        let downloadedBytes = 0 // 下载下来的总字节数
        let lastPeriodBytes = 0 // 上个周期下载到的字节数
        let timer

        let totalBytes = parseInt(response.headers['content-length'])
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
            if (!fileName) { // 没有文件名，用hostname
              fileName = parsed.hostname
            }
            // 从 content-type 获得扩展名
            let fileExt = path.extname(fileName).replace('.', '') // 通过名字解析出来后缀名（不带点）
            let ext = mime.getExtension(response.headers['content-type'], fileExt) // 通过 content-type 和文件名综合判断后缀名
            // 如果实际后缀名不是推断出来的，用推断出来的
            if (fileExt.toLowerCase() !== ext.toLowerCase()) {
              // 方法是在后面追加推断出的后缀名，而不是取代原来的
              fileName += `.${ext}`
            }
          }

          // 推断出扩展名后，看本地有没有同名文件，直到得到一个可用的文件名
          fileName = await availableFilePath(downloadPath, fileName)
        }

        let fullPath = path.join(downloadPath, fileName)
        let fileStream = fs.createWriteStream(fullPath)

        fileStream.on('finish', () => {
          resolve({
            fileName,
            fullPath,
            startTime,
            endTime: new Date,
            totalBytes
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
            downloadedBytes += chunk.length
            lastPeriodBytes += chunk.length
          })
          timer = setInterval(() => {
            let currentSpeed = lastPeriodBytes / progressInterval / 1000 // Unit: Bytes per second
            onProgress({
              downloadedBytes,
              contentLength: totalBytes,
              currentSpeed
            })
            lastPeriodBytes = 0
          }, interval);
        }
      }
    }).end()

    request.on('error', (err) => {
      reject(err)
    })
  })
}

module.exports = downloadFile