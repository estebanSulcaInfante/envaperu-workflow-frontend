import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});
