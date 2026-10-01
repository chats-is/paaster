"use client";

import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { placeholder as cmPlaceholder } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const getLanguage = (language?: string) => {
  switch (language) {
    case "javascript":
    case "typescript":
      return javascript();
    case "python":
      return python();
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    case "xml":
      return xml();
    case "sql":
      return sql();
    case "php":
      return php();
    case "java":
      return java();
    case "cpp":
    case "c":
      return cpp();
    case "rust":
      return rust();
    case "go":
      return go();
    case "yaml":
      return yaml();
    default:
      return [];
  }
};

// No frame, transparent background, quiet gutter.
const frameless = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "#a3aebb",
    paddingLeft: "10px",
  },
  // Translucent so the selection layer underneath stays visible.
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "rgba(30, 70, 130, .05)",
  },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
    { backgroundColor: "rgba(47, 111, 207, .22)" },
  ".cm-placeholder": { color: "#a3aebb" },
});

type EditorProps = {
  value?: string;
  language?: string;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  /** Initial focus when the editor sits in a dialog opened with showModal(). */
  autoFocus?: boolean;
  onChange?: (value: string) => void;
};

// A frameless CodeMirror editor that takes on the surface it sits on.
export function Editor({
  value,
  language,
  readOnly = false,
  className,
  minHeight = "11rem",
  maxHeight = "32rem",
  placeholder,
  autoFocus = false,
  onChange,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const languageCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      languageCompartment.current.of(getLanguage(language)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { maxHeight },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-content": {
          paddingRight: "16px",
          minHeight,
        },
      }),
      frameless,
      placeholder ? cmPlaceholder(placeholder) : [],
      autoFocus ? EditorView.contentAttributes.of({ autofocus: "" }) : [],
    ];

    const state = EditorState.create({
      doc: value || "",
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      editorRef.current = null;
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (viewRef.current && value !== undefined) {
      const currentValue = viewRef.current.state.doc.toString();

      if (currentValue !== value) {
        const transaction = viewRef.current.state.update({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
          annotations: [Transaction.remote.of(true)],
        });

        viewRef.current.dispatch(transaction);
      }
    }
  }, [value]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: languageCompartment.current.reconfigure(getLanguage(language)),
      });
    }
  }, [language]);

  return <div ref={editorRef} className={cn("min-w-0", className)} />;
}
