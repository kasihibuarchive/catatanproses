"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Clock, Flame, MoreVertical, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  categoryDef,
  formatLogDuration,
  initials,
  type PracticeLog,
} from "@/lib/panggung";
import { cn } from "@/lib/utils";

interface LogCardProps {
  log: PracticeLog;
  onDelete: (log: PracticeLog) => Promise<void>;
}

export function LogCard({ log, onDelete }: LogCardProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cat = categoryDef(log.category);
  const CatIcon = cat.icon;
  const longNotes = log.notes.length > 280;

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(log);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card
      className={cn(
        "relative flex flex-col gap-3 p-4 transition-colors hover:border-primary/40 md:p-5",
        deleting && "pointer-events-none opacity-50"
      )}
    >
      <CardHeader className="p-0">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 border border-primary/25">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(log.actorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{log.actorName}</p>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(log.createdAt), {
                addSuffix: true,
                locale: localeId,
              })}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label={`Menu untuk log ${log.title}`}
                disabled={deleting}
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-0">
        <CardTitle className="font-display text-lg font-semibold">
          {log.title}
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", cat.badgeClass)}>
            <CatIcon className="size-3" aria-hidden="true" />
            {log.category}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {formatLogDuration(log.durationMin)}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Flame className="size-3" aria-hidden="true" />
            {log.intensity}
          </Badge>
          <span
            className="text-lg leading-none"
            title={`Mood: ${log.mood}`}
            aria-label={`Mood ${log.mood}`}
          >
            {log.mood}
          </span>
        </div>

        {log.notes && (
          <div>
            <p
              className={cn(
                "whitespace-pre-line text-sm text-muted-foreground",
                !notesExpanded && longNotes && "line-clamp-4"
              )}
            >
              {log.notes}
            </p>
            {longNotes && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-8 px-2 text-xs text-primary hover:text-primary"
                onClick={() => setNotesExpanded((v) => !v)}
              >
                {notesExpanded ? "Sembunyikan" : "Baca selengkapnya"}
              </Button>
            )}
          </div>
        )}

        {log.imagePath && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Lihat foto latihan ${log.title}`}
              >
                <img
                  src={log.imagePath}
                  alt={`Foto latihan ${log.title}`}
                  className="max-h-[420px] w-full rounded-xl border object-cover transition-opacity hover:opacity-90"
                  loading="lazy"
                />
              </button>
            </DialogTrigger>
            <DialogContent
              aria-describedby={undefined}
              className="max-w-4xl overflow-hidden p-2 sm:p-2"
            >
              <DialogTitle className="sr-only">{log.title}</DialogTitle>
              <img
                src={log.imagePath}
                alt={`Foto latihan ${log.title}`}
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus log ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                void handleDelete();
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
