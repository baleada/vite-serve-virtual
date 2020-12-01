import { configureable } from '@baleada/prepare'

const shared = configureable()
        .input('src/index.js')
        .external([
          'fs',
          '@rollup/pluginutils',
          'lru-cache',
          'mime-types',
          'etag',
        ])
        .resolve()

export default [
  shared
    .delete({ targets: 'lib/*', verbose: true })
    .esm({ file: 'lib/index.js', target: 'node' })
    .analyze()
    .configure(),
  shared
    .cjs({ file: 'lib/index.cjs', target: 'node' })
    .configure(),
]

