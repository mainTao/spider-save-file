const fs = require('fs');
const path = require('path')
const downloadFile = require('../index')
const http = require('http')
const assert = require('assert')

const server = http.createServer((req, res) => {
  if (req.path === '')
    res.end();
});
server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// server.listen(80);

let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'

const downloadPath = 'download'
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath);
}

function clearDownloadPath() {
  let files = fs.readdirSync(downloadPath)
  for (const file of files) {
    fs.unlinkSync(path.join(downloadPath, file))
  }
}

describe('redirect', function () {

  it('http 302', async function () {
    let file = await downloadFile({
      url: 'http://baidu.com',
      options: {
        headers: {
          'user-agent': userAgent
        },
      },
      downloadPath,
      fileName: 'baidu-http.html',
    })
    console.log(1)
  })

  it('https 302', async function () {
    let file = await downloadFile({
      url: 'https://baidu.com',
      options: {
        headers: {
          'user-agent': userAgent
        },
      },
      downloadPath,
      fileName: 'baidu-https.html',
    })
    console.log(1)
  })

  afterEach(async () => {
    clearDownloadPath()
  })

})


describe('content-disposition', function () {

  it('mp4', async function () {
    let file = await downloadFile({
      url: 'https://uskid.oss-cn-beijing.aliyuncs.com/temp/liulishuo-result.mp4',
      downloadPath,
    })
    assert(file.fileName === 'liulishuo-ai.mp4')
  })

  afterEach(async () => {
    clearDownloadPath()
  })
})

describe('basename', function () {

  it('mp4', async function () {
      let file = await downloadFile({
        url: 'https://uskid.oss-cn-beijing.aliyuncs.com/temp/liulishuo-pre',
        downloadPath,
      })
      assert(file.fileName === 'liulishuo-pre.mp4')
      assert(file.contentLength > 0)
  })

  afterEach(async () => {
    // clearDownloadPath()
  })
})