#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), '6fb-python-test-'));
const requestedPython = process.env.SIXFB_TEST_PYTHON?.trim();
const systemCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
const candidates = requestedPython ? [requestedPython] : systemCandidates;
let result;
let pythonExecutable;

try {
  for (const executable of candidates) {
    result = spawnSync(executable, ['-m', 'compileall', '-q', 'python/tools'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PYTHONPYCACHEPREFIX: cacheDir },
      timeout: 120_000,
    });
    if (!result.error || result.error.code !== 'ENOENT') {
      pythonExecutable = executable;
      break;
    }
  }

  if (!result || result.error || result.status !== 0) {
    if (result?.stdout) process.stderr.write(result.stdout);
    if (result?.stderr) process.stderr.write(result.stderr);
    throw result?.error || new Error(`Python compilation exited ${result?.status}`);
  }
  const preflight = spawnSync(pythonExecutable, ['-c', [
    'import sys, os',
    "sys.path.insert(0, 'python/tools')",
    'from pipeline.ai_composer import assert_remotion_ready, remotion_prerequisite_error',
    'from pipeline.full_pipeline import main, pipeline_failure_error',
    "assert pipeline_failure_error({'status': 'failed', 'error': 'selection failed'}) == 'selection failed'",
    "assert pipeline_failure_error({'status': 'complete', 'clips': []}) == 'Pipeline completed without producing clips'",
    "assert pipeline_failure_error({'status': 'complete', 'clips': [{'path': 'clip.mp4'}]}) is None",
    "args = ['--video', 'fixture.mp4', '--no-post']",
    "assert main(args, pipeline_runner=lambda **kwargs: {'status': 'failed', 'error': 'requested stage failed'}) == 1",
    "assert main(args, pipeline_runner=lambda **kwargs: {'status': 'complete', 'clips': []}) == 1",
    "assert main(args, pipeline_runner=lambda **kwargs: {'status': 'complete', 'clips': [{'path': 'clip.mp4'}]}) == 0",
    "import contextlib, io",
    "def unexpected_failure(**kwargs):",
    "    raise Exception('unexpected injected failure')",
    "captured_error = io.StringIO()",
    "with contextlib.redirect_stderr(captured_error):",
    "    assert main(args, pipeline_runner=unexpected_failure) == 1",
    "assert captured_error.getvalue().strip() == '[pipeline] ERROR: unexpected injected failure'",
    "assert 'Traceback' not in captured_error.getvalue()",
    "assert main(['--video', 'fixture.mp4', '--post'], pipeline_runner=lambda **kwargs: {'status': 'complete', 'clips': [{'path': 'clip.mp4'}]}) == 1",
    "expected_remotion_error = remotion_prerequisite_error()",
    "assert expected_remotion_error",
    "def assert_remotion_failure(extra_args):",
    "    captured_output = io.StringIO()",
    "    captured_error = io.StringIO()",
    "    with contextlib.redirect_stdout(captured_output), contextlib.redirect_stderr(captured_error):",
    "        status = main(['--video', 'missing.mp4', *extra_args])",
    "    assert status == 1",
    "    assert captured_error.getvalue().strip() == f'[pipeline] ERROR: {expected_remotion_error}'",
    "    assert 'charmap' not in captured_error.getvalue().lower()",
    "for extra_args in (['--notify'], ['--studio-export'], ['--research'], ['--experiment']):",
    "    assert_remotion_failure(extra_args)",
    "calls = []",
    "def capture_runner(**kwargs):",
    "    calls.append(kwargs)",
    "    return {'status': 'complete', 'clips': [{'path': 'clip.mp4'}]}",
    "assert main(args, pipeline_runner=capture_runner) == 0",
    "assert calls[-1]['research'] is False and calls[-1]['run_experiment'] is False",
    "assert main(args + ['--research'], pipeline_runner=capture_runner) == 0",
    "assert calls[-1]['research'] is True",
    "assert main(args + ['--experiment'], pipeline_runner=capture_runner) == 0",
    "assert calls[-1]['run_experiment'] is True",
    "assert main(args + ['--format', 'auto'], pipeline_runner=capture_runner) == 0",
    "assert calls[-1]['aspect_ratio'] == 'auto'",
    "assert main(args + ['--format', 'split'], pipeline_runner=capture_runner) == 0",
    "assert calls[-1]['aspect_ratio'] == 'split'",
    "import subprocess",
    "legacy_codepage_env = os.environ.copy()",
    "legacy_codepage_env.pop('PYTHONUTF8', None)",
    "legacy_codepage_env['PYTHONIOENCODING'] = 'cp1252'",
    "redirected_unicode = subprocess.run([sys.executable, 'python/tools/pipeline/full_pipeline.py', '--video', 'missing.mp4', '--notify'], capture_output=True, text=True, encoding='utf-8', env=legacy_codepage_env)",
    "assert redirected_unicode.returncode == 1",
    "assert redirected_unicode.stdout == '[pipeline] ⚠️  --notify requires --compose (need clip specs). Enabling --compose.\\n'",
    "assert redirected_unicode.stderr.strip() == f'[pipeline] ERROR: {expected_remotion_error}'",
    "redirected_combined = redirected_unicode.stdout + redirected_unicode.stderr",
    "assert 'traceback' not in redirected_combined.lower()",
    "assert 'unicodeencodeerror' not in redirected_combined.lower()",
    "assert 'charmap' not in redirected_combined.lower()",
    "assert '\ufffd' not in redirected_combined",
    "invalid_format = subprocess.run([sys.executable, 'python/tools/pipeline/full_pipeline.py', '--video', 'fixture.mp4', '--format', 'landscape'], capture_output=True, text=True)",
    "assert invalid_format.returncode == 2 and 'invalid choice' in invalid_format.stderr",
    "invalid_clips = subprocess.run([sys.executable, 'python/tools/pipeline/full_pipeline.py', '--video', 'fixture.mp4', '--clips', '0'], capture_output=True, text=True)",
    "assert invalid_clips.returncode == 2 and 'must be a positive integer' in invalid_clips.stderr",
    "import inspect",
    "source = inspect.getsource(__import__('pipeline.full_pipeline', fromlist=['run_pipeline']).run_pipeline)",
    "assert 'if research_requested and api_key:' in source",
    "assert 'Research requested but ANTHROPIC_API_KEY is not set' in source",
    'error = remotion_prerequisite_error()',
    'if error:',
    '    try:',
    '        assert_remotion_ready()',
    '    except RuntimeError as exc:',
    "        assert 'Remotion composition is unavailable' in str(exc)",
    '    else:',
    "        raise AssertionError('missing Remotion workspace did not fail closed')",
    "print('Remotion prerequisite and redirected UTF-8 preflights passed.')",
  ].join('\n')], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PYTHONPYCACHEPREFIX: cacheDir },
    timeout: 30_000,
  });
  if (preflight.stdout) process.stdout.write(preflight.stdout);
  if (preflight.stderr) process.stderr.write(preflight.stderr);
  if (preflight.error || preflight.status !== 0) {
    throw preflight.error || new Error(`Remotion prerequisite preflight exited ${preflight.status}`);
  }
  console.log('Python source compilation passed.');
} finally {
  fs.rmSync(cacheDir, { recursive: true, force: true });
}
