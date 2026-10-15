import { choliba } from 'choliba';

process.stdout.write(`raiz: ${choliba.root}\n`);
process.stdout.write(`agentes em ${choliba.agents.dir}\n`);
for (const agent of choliba.agents.list()) {
  process.stdout.write(`- ${agent.id} ${agent.version}\n`);
}
for (const skill of choliba.skills.list()) {
  process.stdout.write(`skill ${skill.name}: ${skill.description}\n`);
}
