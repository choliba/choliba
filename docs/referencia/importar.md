# Importar o choliba

> Cada subcaminho do pacote instalado expõe a entrada de um pacote do choliba. A superfície é experimental até a 1.0.

Onde o choliba está instalado, importe o pacote `choliba`. Cada subcaminho da tabela é a entrada inteira daquele
pacote. A superfície é experimental até a 1.0: o nome de um subcaminho e o que ele exporta podem mudar antes disso.

Importar não roda o comando. O executável continua sendo o `bin`; `import 'choliba'` só entrega a casca.

| Subcaminho                       | O que se importa                                            |
| -------------------------------- | ----------------------------------------------------------- |
| `choliba`                        | `import { createCholibaShell } from 'choliba'`              |
| `choliba/core`                   | `import { createShell } from 'choliba/core'`                |
| `choliba/core/testing`           | `import { fakePlatform } from 'choliba/core/testing'`       |
| `choliba/agents`                 | `import { loadAgent } from 'choliba/agents'`                |
| `choliba/projects`               | `import { loadProjectSettings } from 'choliba/projects'`    |
| `choliba/runner`                 | `import { runnerShell } from 'choliba/runner'`              |
| `choliba/runner/env`             | `import { loadProjectEnv } from 'choliba/runner/env'`       |
| `choliba/runner/pages/base-page` | `import { BasePage } from 'choliba/runner/pages/base-page'` |
| `choliba/eslint`                 | `import choliba from 'choliba/eslint'`                      |
| `choliba/package.json`           | o manifesto do pacote instalado                             |

Um caminho que não está na tabela não resolve. `choliba/agents/src/x`, por exemplo, falha ao importar.

O `tsc` resolve os tipos de cada subcaminho. Dentro do repositório do choliba o código segue em `@choliba/core`,
`@choliba/agents` e os demais `@choliba/*`; esses nomes não existem no pacote instalado.

`choliba` exporta `createCholibaShell`, `cholibaShell`, `CHOLIBA_SHELL` e o tipo `Runtime`. `choliba/runner/env`
entrega `loadProjectEnv`, o ambiente do projeto a partir da pasta dele. `choliba/runner/pages/base-page` entrega a
`BasePage` (`goto`, `title`) para as specs de um projeto. `choliba/eslint` é a configuração que o
`eslint.config` da pasta de trabalho já espalha.
