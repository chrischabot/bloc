'use client';

import type React from 'react';
import { useState } from 'react';
import type { PropertyDef } from './TableView';

interface FilterClause {
  id: string;
  property: string;
  operator: string;
  value: string;
}

interface SortClause {
  id: string;
  property: string;
  direction: 'ascending' | 'descending';
}

const OPERATOR_BY_TYPE: Record<string, string[]> = {
  title: ['equals', 'does_not_equal', 'contains', 'starts_with', 'is_empty', 'is_not_empty'],
  rich_text: ['equals', 'does_not_equal', 'contains', 'starts_with', 'is_empty', 'is_not_empty'],
  number: [
    'equals',
    'does_not_equal',
    'greater_than',
    'less_than',
    'greater_than_or_equal_to',
    'less_than_or_equal_to',
    'is_empty',
    'is_not_empty',
  ],
  checkbox: ['equals', 'does_not_equal'],
  select: ['equals', 'does_not_equal', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'does_not_contain', 'is_empty', 'is_not_empty'],
  status: ['equals', 'does_not_equal', 'is_empty', 'is_not_empty'],
  date: ['equals', 'before', 'after', 'on_or_before', 'on_or_after', 'is_empty', 'is_not_empty'],
  url: ['equals', 'does_not_equal', 'contains', 'is_empty', 'is_not_empty'],
};

function operatorsFor(type: string): string[] {
  return OPERATOR_BY_TYPE[type] ?? ['equals', 'is_empty', 'is_not_empty'];
}

export interface FilterSortValue {
  filters: FilterClause[];
  sorts: SortClause[];
}

export default function FilterSortPanel({
  properties,
  onChange,
}: {
  properties: PropertyDef[];
  onChange?: (value: FilterSortValue) => void;
}): React.JSX.Element {
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [sorts, setSorts] = useState<SortClause[]>([]);
  const filterable = properties.filter((p) => OPERATOR_BY_TYPE[p.type] !== undefined);
  const titleProp = filterable[0];

  function emit(next: FilterSortValue): void {
    onChange?.(next);
  }

  function addFilter(): void {
    if (!titleProp) return;
    const op = operatorsFor(titleProp.type)[0] ?? 'equals';
    const clause: FilterClause = {
      id: `f-${filters.length + 1}-${Date.now()}`,
      property: titleProp.name,
      operator: op,
      value: '',
    };
    const next = [...filters, clause];
    setFilters(next);
    emit({ filters: next, sorts });
  }

  function updateFilter(id: string, patch: Partial<FilterClause>): void {
    const next = filters.map((f) => {
      if (f.id !== id) return f;
      const merged: FilterClause = { ...f, ...patch };
      // Reset operator if the property changed and current operator is invalid for the new type.
      if (patch.property !== undefined && patch.property !== f.property) {
        const newProp = filterable.find((p) => p.name === patch.property);
        if (newProp) {
          const validOps = operatorsFor(newProp.type);
          if (!validOps.includes(merged.operator)) {
            merged.operator = validOps[0] ?? 'equals';
          }
        }
      }
      return merged;
    });
    setFilters(next);
    emit({ filters: next, sorts });
  }

  function removeFilter(id: string): void {
    const next = filters.filter((f) => f.id !== id);
    setFilters(next);
    emit({ filters: next, sorts });
  }

  function addSort(): void {
    if (!titleProp) return;
    const clause: SortClause = {
      id: `s-${sorts.length + 1}-${Date.now()}`,
      property: titleProp.name,
      direction: 'ascending',
    };
    const next = [...sorts, clause];
    setSorts(next);
    emit({ filters, sorts: next });
  }

  function updateSort(id: string, patch: Partial<SortClause>): void {
    const next = sorts.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSorts(next);
    emit({ filters, sorts: next });
  }

  function removeSort(id: string): void {
    const next = sorts.filter((s) => s.id !== id);
    setSorts(next);
    emit({ filters, sorts: next });
  }

  return (
    <div className="fspanel">
      <div className="fspanel__section">
        <header className="fspanel__head">
          <h3>Filters</h3>
          <button type="button" onClick={addFilter} className="fspanel__cta" disabled={!titleProp}>
            + Add filter
          </button>
        </header>
        {filters.length === 0 && <p className="fspanel__empty">No filters applied.</p>}
        <ul className="fspanel__list">
          {filters.map((f) => {
            const prop = filterable.find((p) => p.name === f.property);
            const ops = prop ? operatorsFor(prop.type) : [];
            const needsValue = !f.operator.startsWith('is_');
            return (
              <li key={f.id} className="fspanel__row">
                <select
                  value={f.property}
                  onChange={(e) => updateFilter(f.id, { property: e.target.value })}
                  aria-label="Filter property"
                >
                  {filterable.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
                  aria-label="Filter operator"
                >
                  {ops.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {needsValue && (
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    placeholder="value"
                    aria-label="Filter value"
                  />
                )}
                <button
                  type="button"
                  className="fspanel__remove"
                  onClick={() => removeFilter(f.id)}
                  aria-label={`Remove filter ${f.id}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="fspanel__section">
        <header className="fspanel__head">
          <h3>Sorts</h3>
          <button type="button" onClick={addSort} className="fspanel__cta" disabled={!titleProp}>
            + Add sort
          </button>
        </header>
        {sorts.length === 0 && <p className="fspanel__empty">No sorts applied.</p>}
        <ul className="fspanel__list">
          {sorts.map((s) => (
            <li key={s.id} className="fspanel__row">
              <select
                value={s.property}
                onChange={(e) => updateSort(s.id, { property: e.target.value })}
                aria-label="Sort property"
              >
                {filterable.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={s.direction}
                onChange={(e) =>
                  updateSort(s.id, {
                    direction: e.target.value as 'ascending' | 'descending',
                  })
                }
                aria-label="Sort direction"
              >
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </select>
              <button
                type="button"
                className="fspanel__remove"
                onClick={() => removeSort(s.id)}
                aria-label={`Remove sort ${s.id}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
