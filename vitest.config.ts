import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['./tests/**/*'],
    clearMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
