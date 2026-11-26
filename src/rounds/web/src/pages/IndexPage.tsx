/**
 * Every test, newest first: how many rounds and configurations it ran, and
 * its last round. Filtered by every field of the rounds (RoundFilters), the
 * test first: a test shows when one of its rounds passes, and its row is the
 * latest round that passes; in its agents, the matching ones are marked.
 */

import type { ReactNode } from 'react';

import { changeSummary } from '../components/Config';
import { useFilters } from '../components/FilterBar';
import { RoundFilters } from '../components/RoundFilters';
import { Grade } from '../components/Scores';
import { RecentRounds } from '../components/RecentRounds';
import { TestsNav } from '../components/TestsNav';
import { RECENT_ROUNDS_IN_TABLE } from '../constants';
import { XyChart } from '../components/XyChart';
import { recentTests, type Round } from '../data';
import {
  cost,
  count,
  duration,
  providerOf,
  title,
  tokensShort,
  when,
} from '../format';
import { applyFilters, isFiltering, rowMatches } from '../filters';
import { ROUND_FIELDS, roundSpec } from '../round-filters';
import { roundHref, rowLink, testHref } from '../route';
import { changedFiles, roundTokens, rulesOf } from '../summary';

/** The index filters by every field, the test first. */
const SPEC = roundSpec(ROUND_FIELDS);

export function IndexPage(): ReactNode {
  const { state, setState } = useFilters();
  // Here, not at the module's top: the records are loaded (main.tsx) after
  // the modules are imported, and a list made at import would stay empty.
  const allRounds: readonly Round[] = recentTests.flatMap(
    (test) => test.rounds,
  );
  const active = isFiltering(state);
  // A test shows when one of its rounds passes; its row is the latest that
  // passes (with no filter, its last round), so the row's numbers match.
  const passing = new Set(applyFilters(allRounds, SPEC, state));
  const shown = recentTests.flatMap((test) => {
    const round = test.rounds.findLast((r) => passing.has(r));
    return round === undefined ? [] : [{ test, round }];
  });
  const shownTests = shown.map(({ test }) => test);

  return (
    <main className="page">
      <TestsNav />
      <header>
        <span className="eyebrow">bun run rounds · rounds.data</span>
        <h1>Testes</h1>
        <p>
          Um teste é uma declaração na pasta <code>rounds.definitions</code>.
          Cada vez que ela roda é uma rodada, e cada rodada diz o que mudou
          desde a anterior: modelo, CLI, política, pedidos.
        </p>
      </header>

      <section className="block" aria-labelledby="todos">
        <h2 id="todos">Todos os testes, do mais recente</h2>
        <RoundFilters
          rounds={allRounds}
          fields={ROUND_FIELDS}
          storageKey="indice"
          state={state}
          onChange={setState}
        />
        <p className="note" aria-live="polite">
          {shown.length === recentTests.length
            ? `Todos os ${String(recentTests.length)} testes`
            : `${String(shown.length)} de ${String(recentTests.length)} testes`}
          {active &&
            shown.length > 0 &&
            ' · cada linha mostra a rodada mais recente que passa pelo filtro, e os agentes que casam com ele estão destacados'}
        </p>
        {shown.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Teste</th>
                  <th scope="col">Rodadas</th>
                  <th scope="col">Agentes na última rodada</th>
                  <th scope="col">Última rodada</th>
                  <th scope="col">Tempo</th>
                  <th scope="col">Tokens</th>
                  <th scope="col">Custo</th>
                  <th scope="col">Arquivos</th>
                  <th scope="col">Regras</th>
                  <th scope="col">Nota</th>
                  <th scope="col">Eficácia</th>
                  <th scope="col">Eficiência</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ test, round: last }) => {
                  const { record } = last;
                  const changed =
                    last.previous === undefined
                      ? 'primeira rodada'
                      : changeSummary(record, last.previous).join(', ') ||
                        'nada: mesma configuração';
                  return (
                    <tr key={test.key} {...rowLink(testHref(test.key))}>
                      <th scope="row">
                        <a href={testHref(test.key)}>
                          <small>
                            {count(
                              test.configurations,
                              'configuração',
                              'configurações',
                            )}
                          </small>
                          {test.title}
                        </a>
                      </th>
                      <td>
                        <div className="rounds-cell">
                          <RecentRounds
                            test={test}
                            shown={RECENT_ROUNDS_IN_TABLE}
                          />
                        </div>
                      </td>
                      <td>
                        {Object.entries(record.actors).map(([name, actor]) => (
                          <div
                            key={name}
                            className={
                              active
                                ? rowMatches(
                                    { test: test.key, role: name, actor },
                                    SPEC.choices,
                                    state,
                                  )
                                  ? 'agent match'
                                  : 'agent dim'
                                : 'agent'
                            }
                          >
                            {title(name)}:{' '}
                            <span className="muted">{providerOf(actor)}</span>
                          </div>
                        ))}
                      </td>
                      <td>
                        <a href={roundHref(record.id)}>Rodada {last.index}</a>
                        <div className="muted">
                          {when(record.timing.startedAt)}
                        </div>
                        {record.label !== undefined && (
                          <div className="label">“{record.label}”</div>
                        )}
                        <div className="muted">mudou: {changed}</div>
                      </td>
                      <td>{duration(record.timing.durationMs)}</td>
                      <td>{tokensShort(roundTokens(record))}</td>
                      <td>{cost(record.totals.round.costUsd)}</td>
                      <td>{changedFiles(record) ?? '—'}</td>
                      <td>{rulesOf(record)}</td>
                      <td>
                        <Grade score={last.score.round.final} />
                      </td>
                      <td>
                        <Grade score={last.score.round.effectiveness.score} />
                      </td>
                      <td>
                        <Grade score={last.score.round.efficiency.score} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length === 0 && (
          <p className="note">Nenhum teste com esses filtros.</p>
        )}
      </section>

      {shown.length > 0 && (
        <section className="block" aria-labelledby="grafico">
          <h2 id="grafico">Gráfico dos agentes do filtro</h2>
          <XyChart
            tests={shownTests}
            matches={(role, actor) =>
              // The chart's tests are already the chosen ones.
              rowMatches({ test: '', role, actor }, SPEC.choices, state, 'test')
            }
          />
        </section>
      )}
    </main>
  );
}
