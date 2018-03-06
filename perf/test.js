const path = require('path')
const { performance } = require('perf_hooks')
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

performance.mark('start')
captureAll(targets, { concurrency: CONCURRENCY }).then(() => {
  performance.mark('end')
  performance.measure('start to end', 'start', 'end')
  const measure = performance.getEntriesByName('start to end')[0]
  console.log(measure.duration / 1000 + 's')
})
