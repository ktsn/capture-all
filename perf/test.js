const path = require('path')
const { performance, PerformanceObserver } = require('perf_hooks')
const { captureAll } = require('../')

const N = 100
const CONCURRENCY = 4

function range(len) {
  return Array.apply(null, Array(len)).map((_, i) => i)
}

const targets = range(N).map(() => {
  return {
    url:
      'file://' +
      path
        .resolve(__dirname, '../test/fixture.html')
        .split(path.sep)
        .join('/')
  }
})

function run() {
  performance.mark('start')
  return captureAll(targets, { concurrency: CONCURRENCY }).then(() => {
    performance.mark('end')
    performance.measure('start to end', 'start', 'end')
  })
}

const obs = new PerformanceObserver(list => {
  const entry = list.getEntries()[0]
  console.log(entry.name, entry.duration / 1000 + 's')
})
obs.observe({
  entryTypes: ['measure'],
  buffered: false
})

run()
