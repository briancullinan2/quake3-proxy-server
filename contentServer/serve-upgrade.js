const { execCmd } = require('../utilities/exec.js')
const { renderIndex, renderFeature } = require('../utilities/render.js')
const { updatePageViewers } = require('../contentServer/session.js')

async function serveUpgrade(request, response, next) {
  let fetch = await execCmd('git', ['fetch'], {
    wait: true,
  })
  console.log(fetch)
  let status = await execCmd('git', ['status'], {
    wait: true,
  })
  console.log(status)
  if(!status.includes('up to date')) {
    Promise.resolve(execCmd('git', ['pull', '--ff'], {
      wait: true,
      detached: true,
    }).then(() => updatePageViewers('/upgrade')))
  }
  let index = renderIndex(`
    <div class="info-layout">
    <h2>Upgrading Proxy Service</h2>
    <h3>Fetch</h3>
    <pre>${fetch}</pre>
    <h3>Status</h3>
    <pre>${status}</pre>
    </div>`)
  return response.send(index)
}

module.exports = {
  serveUpgrade
}
