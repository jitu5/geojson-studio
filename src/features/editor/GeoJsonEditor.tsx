import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { type Diagnostic, lintGutter, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorSelection, EditorState, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/** Marks transactions we make ourselves, so they are not echoed back as user edits or cursor moves. */
const External = Annotation.define<boolean>();

const flashEffect = StateEffect.define<{ from: number; to: number } | null>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(flashEffect)) {
        deco = e.value ? Decoration.set([Decoration.mark({ class: 'cm-flash' }).range(e.value.from, e.value.to)]) : Decoration.none;
      }
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

/** All colours are QBDS CSS variables, so the editor follows .dark without a second theme. */
const qbdsTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--surface-base)',
    color: 'var(--text-primary)',
    fontSize: '12px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: "'Roboto Mono', monospace", lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--text-primary)', paddingBlock: '8px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-primary)',
    color: 'var(--text-tertiary)',
    borderRight: '1px solid var(--border-divider)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--stateslayer-overlay-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--stateslayer-overlay-hover)', color: 'var(--text-secondary)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--fill-tertiary) !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--fill-muted)', outline: '1px solid var(--border-secondary)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--fill-muted)',
    border: 'none',
    color: 'var(--text-secondary)',
  },
  '.cm-flash': { backgroundColor: 'var(--stateslayer-overlay-pressed)', transition: 'background-color 200ms' },
  '.cm-panels': { backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border-divider)' },
  '.cm-search input, .cm-search button': { font: 'inherit', fontSize: '12px' },
  '.cm-textfield': {
    backgroundColor: 'var(--fill-onsurface-ui-3)',
    border: '1px solid var(--border-tertiary)',
    color: 'var(--text-primary)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--fill-muted)',
    border: '1px solid var(--border-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: '0',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--fill-primary)',
    color: 'var(--text-primary-inverse)',
    border: 'none',
  },
  '.cm-diagnostic': { borderLeftWidth: '0', padding: '4px 8px' },
  '.cm-lint-marker-error': { content: "''" },
});

const qbdsHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--text-information)' },
  { tag: t.string, color: 'var(--text-success)' },
  { tag: t.number, color: 'var(--text-warning)' },
  { tag: [t.bool, t.null], color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: [t.separator, t.brace, t.squareBracket, t.punctuation], color: 'var(--text-tertiary)' },
  { tag: t.invalid, color: 'var(--text-error)' },
]);

export interface EditorHandle {
  selectRange: (from: number, to: number) => void;
  flash: (from: number, to: number) => void;
  focus: () => void;
}

interface Props {
  value: string;
  /** Bump to push `value` into the editor (loads, clear, undo). Typing never bumps it. */
  version: number;
  readOnly?: boolean;
  diagnostics: Diagnostic[];
  onChange: (text: string) => void;
  onCursor: (offset: number, selectedText: string) => void;
  onDropFiles?: (files: File[]) => void;
}

export const GeoJsonEditor = forwardRef<EditorHandle, Props>(function GeoJsonEditor(
  { value, version, readOnly = false, diagnostics, onChange, onCursor, onDropFiles },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCursor, onDropFiles });
  callbacks.current = { onChange, onCursor, onDropFiles };
  const readOnlyCompartment = useRef(new Compartment());
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          lintGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          search({ top: true }),
          json(),
          syntaxHighlighting(qbdsHighlight),
          qbdsTheme,
          flashField,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'GeoJSON editor' }),
          readOnlyCompartment.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, ...lintKeymap]),
          EditorView.domEventHandlers({
            drop: event => {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (!files.length || !callbacks.current.onDropFiles) return false;
              event.preventDefault();
              event.stopPropagation();
              callbacks.current.onDropFiles(files);
              return true;
            },
          }),
          EditorView.updateListener.of(update => {
            const external = update.transactions.some(tr => tr.annotation(External));
            if (update.docChanged && !external) callbacks.current.onChange(update.state.doc.toString());
            if (update.selectionSet && !update.docChanged && !external) {
              const sel = update.state.selection.main;
              callbacks.current.onCursor(sel.head, update.state.sliceDoc(sel.from, sel.to));
            }
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
      window.clearTimeout(flashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; value/readOnly sync below
  }, []);

  // Push external value changes (loads) without echoing them back.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === value) return;
    v.dispatch({ changes: { from: 0, to: current.length, insert: value }, annotations: External.of(true) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on version bumps
  }, [version]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const safe = diagnostics
      .filter(d => d.from <= len)
      .map(d => ({ ...d, to: Math.min(d.to, len) }));
    v.dispatch(setDiagnostics(v.state, safe));
  }, [diagnostics]);

  useImperativeHandle(
    ref,
    () => ({
      selectRange(from, to) {
        const v = view.current;
        if (!v) return;
        const len = v.state.doc.length;
        const range = EditorSelection.range(Math.min(from, len), Math.min(to, len));
        v.dispatch({
          selection: EditorSelection.create([range]),
          effects: EditorView.scrollIntoView(range.from, { y: 'start', yMargin: 48 }),
          annotations: External.of(true),
        });
      },
      flash(from, to) {
        const v = view.current;
        if (!v) return;
        const len = v.state.doc.length;
        v.dispatch({ effects: flashEffect.of({ from: Math.min(from, len), to: Math.min(to, len) }) });
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => view.current?.dispatch({ effects: flashEffect.of(null) }), 1200);
      },
      focus() {
        view.current?.focus();
      },
    }),
    [],
  );

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
});
