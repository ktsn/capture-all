# capture-all

Flexible utility to get screenshots from Web pages

## Install

```sh
$ npm i capture-all
# or
$ yarn add capture-all
```

## Example

```js
const { captureAll } = require('capture-all')
const fs = require('fs')

captureAll([
  {
    // Web page URL which will be captured
    url: 'https://www.google.com/',

    // Selector for capturing element
    target: 'body',

    // Selectors to hide from capture
    hidden: ['#gb', '#fbar'],

    // Viewport size of a browser
    viewport: {
      width: 1024,
      height: 800
    }
  }
]).then(results => {
  results.forEach((result, i) => {
    fs.writeFileSync(`result-${i}.png`, result.image)
  })
})
```

## API

### `captureAll(targets: CaptureTarget[], options?: CaptureOptions): Promise<CaptureResult[]>`

Capture screenshots of Web pages which specified by `targets` and return an array of `CaptureResult` object including captured image buffer.

`CaptureTarget` may have the following properties:

* `url`: Web page URL which will be captured (required)
* `target`: a selector for capturing element
* `hidden`: an array of selector to hide matched elements from captured image
* `viewport`: viewport size of browser

`CaptureOptions` may have the following properties:

* `concurrency`: a number of process which will be created for capture
* `puppeteer`: an object passed to [`puppeteer.launch`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions)

`CaptureResult` has the following properties:

* `image`: captured image buffer
* `url`: captured Web page URL
* `target`: a selector of captured element
* `hidden`: an array of selector which is hidden from captured image
* `viewport`: viewport size of browser

### `createCaptureStream(targets: CaptureTarget[], options?: CaptureOptions): ReadableStream<CaptureResult>`

Similar to `captureAll` but returns readable stream of `CaptureResult` instead.

## License

MIT
