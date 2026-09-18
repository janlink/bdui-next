import { beforeEach } from 'bun:test';
import { useBeadsStore } from '../state/store';

// bun test shares one module registry per process, so every test file sees the
// same Zustand store instance. A file that leaves a mutated flag behind (e.g.
// notificationsEnabled: false) changes what the next file's tests observe, which
// makes the suite order-dependent: green locally, red in CI. Capturing the store
// once here, before any test file runs, and restoring it before every test keeps
// each test reading the real defaults regardless of file order.
const pristine = useBeadsStore.getState();

beforeEach(() => {
  useBeadsStore.setState(pristine, true);
});
