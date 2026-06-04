import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import { runAllChecks, type CheckResult } from '../core/setup/checks.js';
import pc from 'picocolors';

export interface DoctorResult {
  checks: CheckResult[];
  allOk: boolean;
}

export async function doctorHandler(
  ctx: CommandContext,
  _input: Record<string, unknown>,
): Promise<DoctorResult> {
  const checks = await runAllChecks(ctx.config);
  const allOk = checks.every((c) => c.ok);
  return { checks, allOk };
}

export function renderDoctor(data: DoctorResult, _output: OutputContext): void {
  for (const check of data.checks) {
    const icon = !check.ok ? pc.red('✖') : check.warn ? pc.yellow('⚠') : pc.green('✔');
    process.stdout.write(`  ${icon}  ${check.name.padEnd(14)} ${check.message}\n`);
    if ((!check.ok || check.warn) && check.hint) {
      process.stdout.write(`         ${pc.dim(check.hint)}\n`);
    }
  }
  process.stdout.write('\n');
  if (data.allOk) {
    process.stdout.write(pc.green('All checks passed.\n'));
  } else {
    process.stdout.write(pc.red('Some checks failed. Run `streamnet setup` to fix.\n'));
  }
}
