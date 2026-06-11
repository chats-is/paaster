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
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup, EditorView } from "codemirror";
import { Check, Copy, Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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

type EditorProps = {
  theme?: string;
  value?: string;
  language?: string;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  fill?: boolean;
  onChange?: (value: string) => void;
};

export function Editor({
  theme,
  value,
  language,
  readOnly = false,
  className,
  minHeight = "11rem",
  maxHeight = "32rem",
  fill = false,
  onChange,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const languageCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = viewRef.current?.state.doc.toString() || value || "";
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClear = () => {
    const view = viewRef.current;
    if (!view) return;

    const length = view.state.doc.length;
    if (length === 0) return;

    // Replacing the whole doc triggers the updateListener, which calls onChange("")
    view.dispatch({ changes: { from: 0, to: length, insert: "" } });
    view.focus();
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      languageCompartment.current.of(getLanguage(language)),
      themeCompartment.current.of(theme === "dark" ? oneDark : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": fill ? { height: "100%" } : { maxHeight },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-content": {
          paddingRight: "16px",
          minHeight,
        },
      }),
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
    viewRef.current.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
      editorRef.current = null;
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (viewRef.current && value) {
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

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(
          theme === "dark" ? oneDark : []
        ),
      });
    }
  }, [theme]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Top toolbar with format and copy button */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border border-b-0 rounded-t-sm">
        <span className="text-sm text-muted-foreground font-medium">
          {language || "plaintext"}
        </span>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear"
              title="Clear"
              className="size-7 opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={handleClear}
              type="button"
              disabled={!value && (viewRef.current?.state.doc.length ?? 0) === 0}
            >
              <Eraser className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy"
            title="Copy"
            className="size-7 opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={handleCopy}
            type="button"
            disabled={!value && (viewRef.current?.state.doc.length ?? 0) === 0}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>
      {/* Editor container */}
      <div
        className={cn(
          "relative rounded-b-sm overflow-hidden border",
          fill && "flex-1 min-h-0"
        )}
      >
        <div ref={editorRef} className={cn(fill && "h-full")} />
      </div>
    </div>
  );
}
