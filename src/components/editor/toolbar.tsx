"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { siteCopy } from "@/content/site";
import {
  saveButtonBusy,
  saveButtonPrimary,
  saveShortcutTooltip,
  type SaveStatus,
} from "@/features/documents/save-state";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  editor: Editor | null;
  saveStatus: SaveStatus;
  onSave: () => void;
  isMac?: boolean;
};

type ToggleProps = {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarToggle({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: ToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn(pressed && "bg-accent text-accent-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({
  editor,
  saveStatus,
  onSave,
  isMac = false,
}: ToolbarProps) {
  const busy = saveButtonBusy(saveStatus);
  const primary = saveButtonPrimary(saveStatus);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="border-border flex flex-wrap items-center gap-1 border-b py-2"
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolbarToggle
          label="Bold"
          pressed={editor?.isActive("bold") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Italic"
          pressed={editor?.isActive("italic") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Heading 2"
          pressed={editor?.isActive("heading", { level: 2 }) ?? false}
          disabled={!editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Heading 3"
          pressed={editor?.isActive("heading", { level: 3 }) ?? false}
          disabled={!editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Bullet list"
          pressed={editor?.isActive("bulletList") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Numbered list"
          pressed={editor?.isActive("orderedList") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Quote"
          pressed={editor?.isActive("blockquote") ?? false}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Undo"
          pressed={false}
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" aria-hidden />
        </ToolbarToggle>
        <ToolbarToggle
          label="Redo"
          pressed={false}
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" aria-hidden />
        </ToolbarToggle>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={primary ? "default" : "secondary"}
                disabled={busy || (!primary && saveStatus === "saved")}
                aria-busy={busy || undefined}
                onClick={onSave}
              >
                <Save className="size-4" aria-hidden />
                {siteCopy.documents.save}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{saveShortcutTooltip(isMac)}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
