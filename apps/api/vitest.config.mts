import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Testlar bazaga ulanmaydi — sof funksiyalar sinaladi
    globals: false,
  },
});
