import { existsSync, statSync } from 'fs'
import { createFilter } from '@rollup/pluginutils'
import LRUCache from 'lru-cache'
import mime from 'mime-types'

const getETag = require('etag')

const defaultOptions = {
  toCacheStatus: () => 'valid',
}

export default function createServeVirtual (required, options) {
  const { transform, include, exclude, test: rawTest } = required,
        { toCacheStatus, cache: cacheOptions } = options || defaultOptions,
        test = resolveTest(include, exclude, rawTest),
        cache = new LRUCache(cacheOptions)

  return ({ app, watcher, resolver }) => {  
    // hot reload virtual files when necessary
    // TODO: not sure if this is possible, since it would be a side effect of other file changes
    // watcher.on('change', async id => {
    //   if (toCacheStatus(id) === 'invalid') {
    //     const timestamp = Date.now()
    //     //       { source } = ensureTransformed(transform({ id }))

    //     // // reload the content component
    //     // watcher.send(id, timestamp, source)
    //   }
    // })

    // inject Koa middleware
    app.use(async (ctx, next) => {
      const file = resolver.requestToFile(ctx.path),
            id = file
  
      if (test({ id, createFilter })) {
        // Assert that file doesn't exist, or it won't be handled here
        if (existsSync(file) && statSync(file).isFile()) {
          console.warn(`vite-serve-virtual: Cannot treat existing file ${file} as virtual`)
          return next()
        }

        const { type, source, etag } = await cachedRead({ ctx, id, cache, toCacheStatus, transform })

        ctx.type = mime.lookup(type) || 'application/octet-stream'
        if (type === 'vue') {
          ctx.vue = true
        }
        ctx.body = source
        ctx.etag = etag
      }
  
      await next()
    })
  }
}

function resolveTest (include, exclude, test) {
  return typeof test === 'function'
    ? test
    : ({ id, createFilter }) => createFilter(include, exclude)(id)
}

// Adapted from Vite https://github.com/vitejs/vite/blob/ba7442fffd1f4787bd542f09dae93bc3197e33f9/src/node/utils/fsUtils.ts#L29
async function cachedRead ({ ctx, id, cache, toCacheStatus, transform }) {
  const cached = cache.get(id),
        { type, source, etag } = (() => {
          switch (toCacheStatus(id)) {
            case 'valid':
              return cached || ensureTransformed(transform({ id }))
            case 'invalid':
              return ensureTransformed(transform({ id }))
          }
        })()

  if (ctx) {
    ctx.set('Cache-Control', 'no-cache')
    // a private marker in case the user ticks "disable cache" during dev
    ctx.__notModified = true
  }

  if (!cached) {
    cache.set(id, { type, source, etag })
  }

  return { type, source, etag }
}

// type Transformed {
//   source: string,
//   type: string,
// }

function ensureTransformed (transformed/*: string | Transformed */)/*: Transformed */ {
  if (typeof transformed === 'string') {
    const etag = getETag(transformed)
    return { source: transformed, type: 'js', etag }
  }

  const { source, type } = transformed,
        etag = getETag(source)
  
  return { source, type, etag }
}
