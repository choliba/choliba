/** Apaga branches locais já mergeadas em develop, preservando master e develop. */
import { join } from 'node:path';

import { cleanBranches } from '../packages/core/src/git';

const repoRoot = join(import.meta.dirname, '..');

console.log('🧹 Limpando branches locais já mergeadas em develop (mantendo master e develop)...');
console.log('   Dica: rode `git pull` em develop antes, senão branches recém-mergeadas ficam de fora.');

try {
  const { deleted, skipped, switchedTo } = cleanBranches({ protectedBranches: ['master', 'develop'], root: repoRoot });
  if (switchedTo !== undefined) {
    console.log(`🔀 Trocado para ${switchedTo}`);
  }
  for (const name of deleted) {
    console.log(`🗑️  ${name}`);
  }
  for (const name of skipped) {
    console.log(`⏭️  ${name} (não mergeada em develop, mantida)`);
  }
  console.log(deleted.length === 0 ? '✨ Nada para limpar.' : `✅ ${String(deleted.length)} branch(es) removida(s).`);
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
