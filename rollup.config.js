import path from 'path'
import { defineConfig } from 'rollup'
import ts from 'rollup-plugin-typescript2'
import replace from '@rollup/plugin-replace'
import { terser } from 'rollup-plugin-terser'
import { version } from './package.json'

const builds = {
  'cjs-dev': {
    format: 'cjs',
    env: 'development',
  },
  'cjs-prod': {
    format: 'cjs',
    env: 'production',
  },
  'esm-dev': {
    format: 'esm',
    env: 'development',
  },
  'esm-prod': {
    format: 'esm',
    env: 'production',
  },
  'umd-dev': {
    format: 'umd',
    env: 'development',
  },
  'umd-prod': {
    format: 'umd',
    env: 'production',
  },
}

function createConfig(name) {
  const { format, env } = builds[name]
  const isProd = env === 'production'
  return defineConfig({
    input: path.resolve(__dirname, './src/index.ts'),
    output: {
      file: path.resolve(
        __dirname,
        `./dist/reactivity.${[format, isProd && 'min']
          .filter(Boolean)
          .join('.')}.js`,
      ),
      format,
      banner:
        '/*!\n' +
        ` * @dupfei/reactivity v${version}\n` +
        ` * (c) 2022-${new Date().getFullYear()} dupfei\n` +
        ' * Released under the MIT License.\n' +
        ' */',
      name: 'Reactivity',
      exports: 'auto',
    },
    plugins: [
      ts({
        tsconfig: './src/tsconfig.json',
        include: ['./src/**/*'],
        useTsconfigDeclarationDir: true,
        tsconfigOverride: {
          target: 'es5',
          declaration: false,
        },
      }),
      replace({
        preventAssignment: true,
        values: {
          __VERSION__: `"${version}"`,
          __DEV__: !isProd,
        },
      }),
      isProd &&
        terser({
          toplevel: true,
          compress: {
            ecma: 5,
            pure_getters: true,
          },
          format: {
            ascii_only: true,
          },
          safari10: true,
        }),
    ].filter(Boolean),
  })
}

let config
if (process.env.TARGET) {
  config = createConfig(process.env.TARGET)
} else {
  config = Object.keys(builds).reduce((acc, name) => {
    acc.push(createConfig(name))
    return acc
  }, [])
}

export default config
