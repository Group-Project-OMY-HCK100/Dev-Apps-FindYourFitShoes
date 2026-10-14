const { spawnSync } = require('child_process');

const result = spawnSync(process.execPath, ['--test', 'tests/integration/api-socket.test.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    RUN_DB_TESTS: '1',
    LLM_PROVIDER: '',
    LLM_API_KEY: '',
    GEMINI_API_KEY: '',
  },
});
process.exit(result.status ?? 1);
