const { empty } = require('@baleada/prepare')
      compile = require('./compile')

function prepare () {
  empty('lib')
  compile()
}

prepare()
