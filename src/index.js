import { existsSync, statSync } from 'fs'
import { createFilter } from '@rollup/pluginutils'

export default function getServeVirtual (required) {
  const { transform, include, exclude, test: rawTest, transformsOn = [] } = required,
        test = resolveTest(include, exclude, rawTest)

  return ({ app, watcher, resolver }) => {
    // some sort of generic watching?
    transformsOn.forEach(eventType => {
      watcher.on(eventType, async file => {
        const source = await cachedRead(null, file)
  
        if (test({ id: file, createFilter })) {
          const timestamp = Date.now(),
                payload = {}
  
          // reload the content component
          watcher.send(payload)
        }
      })
    })
  
    // inject Koa middleware
    app.use(async (ctx, next) => {
      const file = resolver.requestToFile(ctx.path)
  
      if (test({ id: file, createFilter })) {
        // Assert that file can't exist, or it won't be handled here
        if (existsSync(file) && statSync(file).isFile()) {
          console.warn(`vite-serve-virtual: Cannot treat existing file ${file} as virtual`)
          return next()
        }

        const { type, source } = ensureTransformed(transform({ id: file }))
              
        switch (type) {
        case 'vue':
          ctx.vue = true
          break
        default:
          ctx.type = type
          break
        }

        ctx.body = source
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

// type Transformed {
//   source: string,
//   type: string
// }

function ensureTransformed (input/*: string | Transformed */)/*: Transformed */ {
  return typeof input === 'string' ? { source: input, type: 'js' } : input
}
