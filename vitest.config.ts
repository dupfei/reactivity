import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    include: ['./tests/**/*'],
    clearMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
