import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Youtube from "@tiptap/extension-youtube";
import { TableKit } from "@tiptap/extension-table";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Columns3,
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { countWords } from "@/lib/post-seo";

type Props = {
  initialHtml: string;
  onChange: (html: string) => void;
  /** Uploads an image file and returns its URL, or null when it failed (the uploader shows its own error). */
  onUpload: (file: File) => Promise<string | null>;
  invalid?: boolean;
};

type BlockType = "p" | "h2" | "h3" | "h4" | "code";

export function RichEditor({ initialHtml, onChange, onUpload, invalid }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [html, setHtml] = useState(initialHtml);
  const [fullscreen, setFullscreen] = useState(false);
  const [dialog, setDialog] = useState<null | "link" | "image" | "youtube">(null);
  const [uploading, setUploading] = useState(0);
  const uploadRef = useRef(onUpload);
  uploadRef.current = onUpload;

  async function insertFiles(editor: Editor, files: File[], pos?: number) {
    for (const file of files.filter((f) => f.type.startsWith("image/"))) {
      setUploading((n) => n + 1);
      try {
        const url = await uploadRef.current(file);
        if (!url) continue;
        const chain = editor.chain().focus();
        (pos != null ? chain.insertContentAt(pos, { type: "image", attrs: { src: url, alt: "" } }) : chain.setImage({ src: url, alt: "" })).run();
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: null, target: null } },
      }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Youtube.configure({ nocookie: true, width: 640, height: 360, modestBranding: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Start writing your post… Use the toolbar to add headings, photos, links and videos." }),
      CharacterCount,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "rte-content article-body", "aria-label": "Post content" },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some((f) => f.type.startsWith("image/")) || !editorRef.current) return false;
        void insertFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.some((f) => f.type.startsWith("image/")) || !editorRef.current) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(editorRef.current, files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const block: BlockType = e.isActive("heading", { level: 2 })
        ? "h2"
        : e.isActive("heading", { level: 3 })
          ? "h3"
          : e.isActive("heading", { level: 4 })
            ? "h4"
            : e.isActive("codeBlock")
              ? "code"
              : "p";
      const text = e.state.doc.textContent;
      return {
        block,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: e.isActive("highlight"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        quote: e.isActive("blockquote"),
        link: e.isActive("link"),
        table: e.isActive("table"),
        image: e.isActive("image"),
        align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        words: countWords(text.trim()),
        chars: e.storage.characterCount?.characters?.() ?? text.length,
      };
    },
  });

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  function switchMode(next: "visual" | "html") {
    if (!editor || next === mode) return;
    if (next === "html") setHtml(editor.getHTML());
    else {
      editor.commands.setContent(html, { emitUpdate: true });
    }
    setMode(next);
  }

  const setBlock = (b: BlockType) => {
    if (!editor) return;
    const c = editor.chain().focus();
    if (b === "p") c.setParagraph().run();
    else if (b === "code") c.toggleCodeBlock().run();
    else c.setHeading({ level: Number(b.slice(1)) as 2 | 3 | 4 }).run();
  };

  const disabled = !editor || mode === "html";
  const minutes = Math.max(1, Math.round((state?.words ?? 0) / 200));

  return (
    <div className="rte" data-fullscreen={fullscreen || undefined} data-invalid={invalid || undefined}>
      <div className="rte-tabs">
        <div className="flex items-center gap-1" role="tablist" aria-label="Editor mode">
          <button type="button" role="tab" aria-selected={mode === "visual"} onClick={() => switchMode("visual")}>Visual</button>
          <button type="button" role="tab" aria-selected={mode === "html"} onClick={() => switchMode("html")}>HTML</button>
        </div>
        <div className="flex items-center gap-1">
          {uploading > 0 && <span className="flex items-center gap-1.5 px-2 text-xs font-bold text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Uploading photo…</span>}
          <ToolButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </ToolButton>
        </div>
      </div>

      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        <select
          className="rte-select"
          aria-label="Text style"
          value={state?.block ?? "p"}
          disabled={disabled}
          onChange={(e) => setBlock(e.target.value as BlockType)}
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="code">Code block</option>
        </select>
        <Divider />
        <ToolButton label="Bold (Ctrl+B)" active={state?.bold} disabled={disabled} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={state?.italic} disabled={disabled} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></ToolButton>
        <ToolButton label="Underline (Ctrl+U)" active={state?.underline} disabled={disabled} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon /></ToolButton>
        <ToolButton label="Strikethrough" active={state?.strike} disabled={disabled} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough /></ToolButton>
        <ToolButton label="Highlight" active={state?.highlight} disabled={disabled} onClick={() => editor?.chain().focus().toggleHighlight().run()}><Highlighter /></ToolButton>
        <Divider />
        <ToolButton label="Bulleted list" active={state?.bullet} disabled={disabled} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></ToolButton>
        <ToolButton label="Numbered list" active={state?.ordered} disabled={disabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolButton>
        <ToolButton label="Quote" active={state?.quote} disabled={disabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote /></ToolButton>
        <ToolButton label="Divider line" disabled={disabled} onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus /></ToolButton>
        <Divider />
        <ToolButton label="Align left" active={state?.align === "left"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("left").run()}><AlignLeft /></ToolButton>
        <ToolButton label="Align centre" active={state?.align === "center"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("center").run()}><AlignCenter /></ToolButton>
        <ToolButton label="Align right" active={state?.align === "right"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("right").run()}><AlignRight /></ToolButton>
        <ToolButton label="Justify" active={state?.align === "justify"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}><AlignJustify /></ToolButton>
        <Divider />
        <ToolButton label="Insert link" active={state?.link} disabled={disabled} onClick={() => setDialog("link")}><Link2 /></ToolButton>
        <ToolButton label="Add photo" disabled={disabled} onClick={() => setDialog("image")}><ImagePlus /></ToolButton>
        <ToolButton label="Embed YouTube video" disabled={disabled} onClick={() => setDialog("youtube")}><YoutubeIcon /></ToolButton>
        <ToolButton label="Insert table" disabled={disabled} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon /></ToolButton>
        <ToolButton label="Code" disabled={disabled} active={state?.block === "code"} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 /></ToolButton>
        <Divider />
        <ToolButton label="Clear formatting" disabled={disabled} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser /></ToolButton>
        <ToolButton label="Undo (Ctrl+Z)" disabled={disabled || !state?.canUndo} onClick={() => editor?.chain().focus().undo().run()}><Undo2 /></ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={disabled || !state?.canRedo} onClick={() => editor?.chain().focus().redo().run()}><Redo2 /></ToolButton>
      </div>

      {state?.table && mode === "visual" && (
        <div className="rte-subbar" role="toolbar" aria-label="Table">
          <span className="font-bold text-muted-foreground">Table:</span>
          <SubButton onClick={() => editor?.chain().focus().addRowBefore().run()}><Rows3 /> Row above</SubButton>
          <SubButton onClick={() => editor?.chain().focus().addRowAfter().run()}><Rows3 /> Row below</SubButton>
          <SubButton onClick={() => editor?.chain().focus().addColumnBefore().run()}><Columns3 /> Column left</SubButton>
          <SubButton onClick={() => editor?.chain().focus().addColumnAfter().run()}><Columns3 /> Column right</SubButton>
          <SubButton onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>Header row</SubButton>
          <SubButton onClick={() => editor?.chain().focus().deleteRow().run()}><Trash2 /> Row</SubButton>
          <SubButton onClick={() => editor?.chain().focus().deleteColumn().run()}><Trash2 /> Column</SubButton>
          <SubButton danger onClick={() => editor?.chain().focus().deleteTable().run()}><Trash2 /> Delete table</SubButton>
        </div>
      )}
      {state?.image && mode === "visual" && <ImageAltBar editor={editor!} />}

      <div className="rte-body">
        {mode === "visual" ? (
          editor ? <EditorContent editor={editor} /> : <div className="rte-content article-body text-muted-foreground">Loading editor…</div>
        ) : (
          <textarea
            className="rte-html"
            spellCheck={false}
            aria-label="Post HTML"
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              onChange(e.target.value);
            }}
          />
        )}
      </div>

      <div className="rte-status">
        <span>{state?.words ?? 0} words</span>
        <span>{state?.chars ?? 0} characters</span>
        <span>~{minutes} min read</span>
        <span className="ml-auto hidden sm:inline">Tip: paste or drag photos straight into the post.</span>
      </div>

      {editor && (
        <>
          <LinkDialog open={dialog === "link"} onClose={() => setDialog(null)} editor={editor} />
          <ImageDialog open={dialog === "image"} onClose={() => setDialog(null)} editor={editor} onUpload={(f) => uploadRef.current(f)} />
          <YoutubeDialog open={dialog === "youtube"} onClose={() => setDialog(null)} editor={editor} />
        </>
      )}
    </div>
  );
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean | undefined; disabled?: boolean | undefined; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="rte-btn" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function SubButton({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="rte-sub-btn" data-danger={danger || undefined} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

const Divider = () => <span className="rte-divider" aria-hidden="true" />;

function ImageAltBar({ editor }: { editor: Editor }) {
  const attrs = editor.getAttributes("image") as { alt?: string; src?: string };
  const [alt, setAlt] = useState(attrs.alt ?? "");
  useEffect(() => setAlt(attrs.alt ?? ""), [attrs.src, attrs.alt]);
  return (
    <div className="rte-subbar">
      <span className="font-bold text-muted-foreground">Photo:</span>
      <input
        className="admin-input min-h-8 max-w-sm flex-1 py-1 text-sm"
        placeholder="Describe this photo (alt text)"
        aria-label="Photo description"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => editor.chain().updateAttributes("image", { alt: alt.trim() }).run()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.chain().focus().updateAttributes("image", { alt: alt.trim() }).run();
          }
        }}
      />
      <SubButton danger onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 /> Remove photo</SubButton>
    </div>
  );
}

function LinkDialog({ open, onClose, editor }: { open: boolean; onClose: () => void; editor: Editor }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [newTab, setNewTab] = useState(false);
  const hasLink = editor.isActive("link");

  useEffect(() => {
    if (!open) return;
    const attrs = editor.getAttributes("link") as { href?: string; target?: string };
    const { from, to } = editor.state.selection;
    setUrl(attrs.href ?? "");
    setNewTab(attrs.target === "_blank");
    setText(editor.state.doc.textBetween(from, to, " "));
  }, [open, editor]);

  function apply() {
    const href = url.trim();
    if (!href) return;
    const normalised = /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : `https://${href}`;
    const attrs = { href: normalised, target: newTab ? "_blank" : null };
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !hasLink) {
      chain.insertContent({ type: "text", text: text.trim() || normalised, marks: [{ type: "link", attrs }] }).run();
    } else chain.setLink(attrs).run();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasLink ? "Edit link" : "Insert link"}</DialogTitle>
          <DialogDescription>Link to a product, another page on your site (e.g. /our-products) or any website.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); apply(); }}>
          <label className="grid gap-1.5">
            <span className="admin-label">Web address</span>
            <input autoFocus className="admin-input" placeholder="https://… or /our-products" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          {editor.state.selection.empty && !hasLink && (
            <label className="grid gap-1.5">
              <span className="admin-label">Link text</span>
              <input className="admin-input" placeholder="Text people click" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
          )}
          <label className="flex items-center justify-between gap-3 text-sm font-bold">
            Open in a new tab <Switch checked={newTab} onCheckedChange={setNewTab} />
          </label>
          <DialogFooter className="gap-2">
            {hasLink && (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onClose(); }}>
                Remove link
              </Button>
            )}
            <Button type="submit" disabled={!url.trim()}>{hasLink ? "Update link" : "Insert link"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({ open, onClose, editor, onUpload }: { open: boolean; onClose: () => void; editor: Editor; onUpload: (f: File) => Promise<string | null> }) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSrc("");
      setAlt("");
    }
  }, [open]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await onUpload(file);
      if (url) setSrc(url);
    } finally {
      setBusy(false);
    }
  }

  function insert() {
    const url = src.trim();
    if (!/^(\/api\/public\/images\/|https:\/\/)/.test(url)) {
      toast.error("Upload a photo or paste an https:// image address.");
      return;
    }
    editor.chain().focus().setImage({ src: url, alt: alt.trim() }).run();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a photo</DialogTitle>
          <DialogDescription>Upload a JPG, PNG or WebP up to 5 MB, or paste an image address.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="rte-drop" disabled={busy}>
            {src ? (
              <img src={src} alt="" className="max-h-56 w-full rounded-lg object-contain" />
            ) : (
              <span className="grid justify-items-center gap-2 text-sm font-bold text-muted-foreground">
                {busy ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
                {busy ? "Uploading…" : "Click to upload a photo"}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          <label className="grid gap-1.5">
            <span className="admin-label">…or image address</span>
            <input className="admin-input" placeholder="https://" value={src} onChange={(e) => setSrc(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="admin-label">Describe the photo (alt text)</span>
            <input className="admin-input" placeholder="e.g. Installer fitting solar panels on a Lekki rooftop" value={alt} onChange={(e) => setAlt(e.target.value)} />
            <span className="text-xs text-muted-foreground">Helps Google and people using screen readers.</span>
          </label>
        </div>
        <DialogFooter>
          <Button type="button" onClick={insert} disabled={!src.trim() || busy}>Insert photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YoutubeDialog({ open, onClose, editor }: { open: boolean; onClose: () => void; editor: Editor }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (open) setUrl("");
  }, [open]);
  const valid = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i.test(url.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Embed a YouTube video</DialogTitle>
          <DialogDescription>Paste the link to a YouTube video.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
          onClose();
        }}>
          <input autoFocus className="admin-input" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {url && !valid && <p className="text-xs font-bold text-destructive">That doesn't look like a YouTube link.</p>}
          <DialogFooter>
            <Button type="submit" disabled={!valid}>Embed video</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
