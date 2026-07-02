"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Save,
  StickyNote,
  Calendar,
  Users,
  UserPlus,
  FileDown,
  MoreVertical,
  ChevronRight,
  AlertCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,//test
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

type Priority = "Low" | "Medium" | "High";

interface Collaborator {
  userId: string;
  name: string;
  email: string;
  referenceId: string;
  role: string;
  department: string;
  invitedAt: string;
}//test

interface Note {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  collaborators: Collaborator[];
  createdBy: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  status?: boolean; // true = active, false = deleted (soft delete)
}

interface User {
  _id: string;
  Firstname?: string;
  Lastname?: string;
  Name?: string;
  Email: string;
  ReferenceID?: string;
  Role: string;
  Department: string;
  Status?: string;
  profilePicture?: string;
}

export default function NotesPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";

  const [notes, setNotes] = useState<Note[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNotePriority, setNewNotePriority] = useState<Priority>("Medium");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Medium");
  const [userName, setUserName] = useState("User");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /* ── Auth guard ── */
  useEffect(() => {
    if (userId === null) return;
    if (!userId) {
      window.location.href = "/login";
    }
  }, [userId]);

  /* ── Fetch current user data ── */
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        const first = d.Firstname ?? "";
        const last = d.Lastname ?? "";
        const name = `${first} ${last}`.trim() || d.Name || "User";
        setUserName(name);
        setCurrentUser({
          _id: userId,
          Firstname: d.Firstname,
          Lastname: d.Lastname,
          Name: d.Name,
          Email: d.Email,
          ReferenceID: d.ReferenceID,
          Role: d.Role,
          Department: d.Department,
          profilePicture: d.profilePicture,
        });
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [userId]);

  /* ── Fetch all users for collaboration ── */
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?list=engineering-it&viewerId=${userId}`)
      .then((r) => r.json())
      .then((data: User[]) => {
        setAllUsers(data.filter((u) => u._id !== userId));
      })
      .catch(console.error);
  }, [userId]);

  /* ── Load notes from Firebase ── */
  useEffect(() => {
    if (!userId) return;

    const notesQuery = query(
      collection(db, "notes"),
      where("status", "==", true),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const loadedNotes: Note[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "",
            content: data.content || "",
            priority: data.priority || "Medium",
            collaborators: data.collaborators || [],
            createdBy: data.createdBy || "Unknown",
            createdByUserId: data.createdByUserId || "",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          };
        });
        setNotes(loadedNotes);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load notes:", error);
        toast.error("Failed to load notes");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  /* ── Check if user has full access (Engineering Manager or IT) ── */
  const hasFullAccess = useCallback(() => {
    if (!currentUser) return false;
    const isEngineeringManager =
      currentUser.Department === "Engineering" && currentUser.Role === "Manager";
    const isIT = currentUser.Department === "IT";
    return isEngineeringManager || isIT;
  }, [currentUser]);

  /* ── Check if user can view note ── */
  const canViewNote = useCallback(
    (note: Note) => {
      if (!currentUser || !userId) return false;
      if (hasFullAccess()) return true;
      if (note.createdByUserId === userId) return true;
      return note.collaborators?.some((c) => c.userId === userId) ?? false;
    },
    [currentUser, userId, hasFullAccess]
  );

  /* ── Filtered notes (by visibility + search) ── */
  const filteredNotes = notes.filter((note) => {
    if (!canViewNote(note)) return false;
    const search = searchTerm.toLowerCase();
    return (
      note.title.toLowerCase().includes(search) ||
      note.content.toLowerCase().includes(search)
    );
  });

  /* ── Sort by priority then updatedAt ── */
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  /* ── Create note ── */
  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      // Create new note
      await addDoc(collection(db, "notes"), {
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        priority: newNotePriority,
        collaborators: [],
        createdBy: userName,
        createdByUserId: userId || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: true, // Active by default
      });

      setNewNoteTitle("");
      setNewNoteContent("");
      setNewNotePriority("Medium");
      setIsCreateDialogOpen(false);
      toast.success("Note created successfully");
    } catch (error) {
      console.error("Failed to create note:", error);
      toast.error("Failed to create note");
    }
  };

  /* ── Edit note ── */
  const handleEditNote = async () => {
    if (!selectedNote) return;
    if (!editTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      const noteRef = doc(db, "notes", selectedNote.id);
      await updateDoc(noteRef, {
        title: editTitle.trim(),
        content: editContent.trim(),
        priority: editPriority,
        updatedAt: Timestamp.now(),
      });
      setIsEditDialogOpen(false);
      setSelectedNote(null);
      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Failed to update note:", error);
      toast.error("Failed to update note");
    }
  };

  /* ── Delete note (Soft Delete) ── */
  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    try {
      // Soft delete: update status to false instead of hard delete
      await updateDoc(doc(db, "notes", selectedNote.id), {
        status: false,
        updatedAt: new Date().toISOString(),
      });
      setIsDeleteDialogOpen(false);
      setSelectedNote(null);
      setIsDetailsDialogOpen(false);
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error("Failed to delete note");
    }
  };

  /* ── Add collaborator ── */
  const handleAddCollaborator = async (user: User) => {
    if (!selectedNote) return;

    const isAlreadyCollaborator = selectedNote.collaborators?.some(
      (c) => c.userId === user._id
    ) ?? false;
    if (isAlreadyCollaborator) {
      toast.error("User is already a collaborator");
      return;
    }

    const first = user.Firstname ?? "";
    const last = user.Lastname ?? "";
    const name = `${first} ${last}`.trim() || user.Name || user.Email;

    const newCollaborator: Collaborator = {
      userId: user._id,
      name,
      email: user.Email,
      referenceId: user.ReferenceID || "",
      role: user.Role,
      department: user.Department,
      invitedAt: new Date().toISOString(),
    };

    try {
      const noteRef = doc(db, "notes", selectedNote.id);
      const updatedCollaborators = [...(selectedNote.collaborators || []), newCollaborator];
      await updateDoc(noteRef, {
        collaborators: updatedCollaborators,
        updatedAt: Timestamp.now(),
      });
      setSelectedNote({
        ...selectedNote,
        collaborators: updatedCollaborators,
      });
      toast.success(`${name} added as collaborator`);
    } catch (error) {
      console.error("Failed to add collaborator:", error);
      toast.error("Failed to add collaborator");
    }
  };

  /* ── Remove collaborator ── */
  const handleRemoveCollaborator = async (collaboratorUserId: string) => {
    if (!selectedNote) return;

    try {
      const noteRef = doc(db, "notes", selectedNote.id);
      const updatedCollaborators = (selectedNote.collaborators || []).filter(
        (c) => c.userId !== collaboratorUserId
      );
      await updateDoc(noteRef, {
        collaborators: updatedCollaborators,
        updatedAt: Timestamp.now(),
      });
      setSelectedNote({
        ...selectedNote,
        collaborators: updatedCollaborators,
      });
      toast.success("Collaborator removed");
    } catch (error) {
      console.error("Failed to remove collaborator:", error);
      toast.error("Failed to remove collaborator");
    }
  };

  /* ── Export PDF ── */
  const handleExportPDF = (note: Note) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(note.title, margin, y);
    y += 10;

    // Priority
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Priority: ${note.priority}`, margin, y);
    y += 8;

    // Created info
    doc.text(`Created by: ${note.createdBy}`, margin, y);
    y += 6;
    doc.text(`Date: ${formatDate(note.createdAt)}`, margin, y);
    y += 10;

    // Content
    doc.setFontSize(11);
    const splitContent = doc.splitTextToSize(note.content, pageWidth - margin * 2);
    doc.text(splitContent, margin, y);

    // Save
    doc.save(`${note.title.replace(/[^a-z0-9]/gi, "_")}_note.pdf`);
    toast.success("PDF exported successfully");
  };

  /* ── Open dialogs ── */
  const openDetailsDialog = (note: Note) => {
    setSelectedNote(note);
    setIsDetailsDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditPriority(note.priority);
    setIsEditDialogOpen(true);
    setIsDetailsDialogOpen(false);
  };

  const openDeleteDialog = (note: Note) => {
    setSelectedNote(note);
    setIsDeleteDialogOpen(true);
  };

  const openCollaboratorDialog = (note: Note) => {
    setSelectedNote(note);
    setCollaboratorSearch("");
    setIsCollaboratorDialogOpen(true);
    setIsDetailsDialogOpen(false);
  };

  /* ── Format date ── */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /* ── Get priority color ── */
  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "High":
        return isComic
          ? "bg-red-400 text-gray-900 border-2 border-gray-800"
          : "bg-red-600 text-white";
      case "Medium":
        return isComic
          ? "bg-yellow-400 text-gray-900 border-2 border-gray-800"
          : "bg-yellow-500 text-white";
      case "Low":
        return isComic
          ? "bg-blue-400 text-gray-900 border-2 border-gray-800"
          : "bg-blue-500 text-white";
    }
  };

  /* ── Get priority icon ── */
  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case "High":
        return <ArrowUp className="h-3 w-3" />;
      case "Medium":
        return <Minus className="h-3 w-3" />;
      case "Low":
        return <ArrowDown className="h-3 w-3" />;
    }
  };

  /* ── Filter available users for collaboration ── */
  const availableUsers = allUsers.filter(
    (user) =>
      !selectedNote?.collaborators.some((c) => c.userId === user._id) &&
      user._id !== selectedNote?.createdByUserId &&
      user.Department === "Engineering" &&
      user.Status === "Active"
  );

  const filteredAvailableUsers = availableUsers.filter(
    (user) =>
      user.Firstname?.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
      user.Lastname?.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
      user.Name?.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
      user.Email.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
      user.ReferenceID?.toLowerCase().includes(collaboratorSearch.toLowerCase())
  );

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* ── HEADER ── */}
      <div
        className={`px-4 md:px-6 pt-4 md:pt-6 pb-3 shrink-0 bg-white ${
          isComic
            ? "border-b-4 border-gray-800"
            : "border-b border-gray-200"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <StickyNote
                className={`h-6 w-6 ${isComic ? "text-red-500" : "text-red-600"}`}
              />
              <h1
                className={`text-xl md:text-2xl text-gray-900 ${
                  isComic
                    ? "font-comic-title comic-text-shadow"
                    : "font-formal-title"
                }`}
              >
                Notes
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-37.5 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 ${
                  isComic ? "font-comic border-2 border-gray-300" : ""
                }`}
              />
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className={`${
                isComic
                  ? "comic-button bg-linear-to-r from-green-400 to-emerald-400 font-comic"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New Note</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
          <p
            className={`text-sm text-gray-600 ${
              isComic ? "font-comic" : "font-formal"
            }`}
          >
            {sortedNotes.length} note{sortedNotes.length !== 1 ? "s" : ""} •
            Priority-based sorting
          </p>
          {hasFullAccess() && (
            <Badge
              variant="outline"
              className={`${isComic ? "font-comic" : "font-formal"}`}
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Manager/IT Access
            </Badge>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className={`flex-1 overflow-auto p-4 md:p-6 ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className={`p-6 rounded-full mb-4 ${
                isComic ? "bg-yellow-100" : "bg-gray-100"
              }`}
            >
              <StickyNote
                className={`h-12 w-12 ${
                  isComic ? "text-yellow-600" : "text-gray-400"
                }`}
              />
            </div>
            <p
              className={`text-lg text-gray-600 ${
                isComic ? "font-comic" : "font-formal"
              }`}
            >
              {searchTerm ? "No notes found" : "No notes yet"}
            </p>
            <p
              className={`text-sm text-gray-400 mt-1 ${
                isComic ? "font-comic" : "font-formal"
              }`}
            >
              {searchTerm
                ? "Try a different search term"
                : hasFullAccess()
                ? "Create your first note or view collaborator notes"
                : "Create your first note to get started"}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className={`mt-4 ${
                  isComic
                    ? "comic-button bg-linear-to-r from-blue-400 to-purple-400 font-comic"
                    : ""
                }`}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedNotes.map((note) => (
              <Card
                key={note.id}
                className={`overflow-hidden group cursor-pointer ${
                  isComic
                    ? "comic-card comic-hover-lift"
                    : "formal-card hover:shadow-lg transition-shadow"
                }`}
                onClick={() => openDetailsDialog(note)}
              >
                <CardHeader
                  className={`p-4 pb-2 ${
                    isComic
                      ? "bg-linear-to-r from-yellow-100 to-orange-100 border-b-2 border-gray-800"
                      : "bg-gray-50 border-b"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle
                      className={`text-base break-words flex-1 leading-tight ${
                        isComic
                          ? "font-comic-title text-gray-900"
                          : "font-formal-title"
                      }`}
                    >
                      {note.title || "Untitled Note"}
                    </CardTitle>
                    <Badge
                      className={`shrink-0 flex items-center gap-1 text-xs ${getPriorityColor(
                        note.priority
                      )} ${isComic ? "font-comic" : "font-formal"}`}
                    >
                      {getPriorityIcon(note.priority)}
                      {note.priority}
                    </Badge>
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs text-gray-500 mt-1 ${
                      isComic ? "font-comic" : "font-formal"
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    <span>
                      {(note.collaborators?.length ?? 0) + 1} member
                      {(note.collaborators?.length ?? 0) !== 0 ? "s" : ""}
                    </span>
                    {(note.createdByUserId === userId ||
                      hasFullAccess()) && (
                      <span className="text-green-600">• Owner</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <p
                    className={`text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap ${
                      isComic ? "font-comic" : "font-formal"
                    }`}
                  >
                    {note.content || "No content"}
                  </p>
                  <div
                    className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                      isComic
                        ? "border-gray-300 font-comic"
                        : "border-gray-200 font-formal"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(note.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailsDialog(note);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          isComic
                            ? "hover:bg-blue-100 text-blue-600"
                            : "hover:bg-gray-100 text-gray-600"
                        }`}
                        title="View Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── NOTE DETAILS DIALOG ── */}
      <Dialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      >
        <DialogContent
          className={`max-w-2xl ${
            isComic ? "comic-card border-4 border-gray-800" : ""
          }`}
        >
          {selectedNote && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle
                      className={`flex items-start gap-2 text-lg sm:text-xl mb-2 ${
                        isComic
                          ? "font-comic-title"
                          : "font-formal-title"
                      }`}
                    >
                      <StickyNote
                        className={`h-5 w-5 shrink-0 mt-0.5 ${
                          isComic ? "text-red-500" : "text-red-600"
                        }`}
                      />
                      <span className="break-words">{selectedNote.title || "Untitled Note"}</span>
                    </DialogTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`flex items-center gap-1 ${getPriorityColor(
                          selectedNote.priority
                        )} ${isComic ? "font-comic" : "font-formal"}`}
                      >
                        {getPriorityIcon(selectedNote.priority)}
                        {selectedNote.priority} Priority
                      </Badge>
                      <span
                        className={`text-xs text-gray-500 ${
                          isComic ? "font-comic" : "font-formal"
                        }`}
                      >
                        <Clock className="h-3 w-3 inline mr-1" />
                        Created: {formatDate(selectedNote.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {/* Content */}
                <div
                  className={`p-4 rounded-lg bg-gray-50 whitespace-pre-wrap ${
                    isComic
                      ? "font-comic border-2 border-gray-200"
                      : "font-formal"
                  }`}
                >
                  {selectedNote.content || "No content"}
                </div>

                {/* Collaborators */}
                <div
                  className={`border-t pt-4 ${
                    isComic ? "border-gray-300" : "border-gray-200"
                  }`}
                >
                  <h4
                    className={`text-sm font-medium mb-3 ${
                      isComic ? "font-comic-title" : "font-formal-title"
                    }`}
                  >
                    <Users className="h-4 w-4 inline mr-1" />
                    Collaborators ({selectedNote.collaborators?.length ?? 0})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {/* Owner */}
                    <Badge
                      variant="outline"
                      className={`${isComic ? "font-comic" : "font-formal"}`}
                    >
                      <span className="font-medium">{selectedNote.createdBy}</span>
                      <span className="text-gray-500 ml-1">(Owner)</span>
                    </Badge>
                    {/* Collaborators */}
                    {selectedNote.collaborators.map((collab) => (
                      <Badge
                        key={collab.userId}
                        variant="outline"
                        className={`${isComic ? "font-comic" : "font-formal"}`}
                      >
                        {collab.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 flex flex-col sm:flex-row sm:flex-wrap">
                {(selectedNote.createdByUserId === userId ||
                  hasFullAccess()) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openEditDialog(selectedNote)}
                      className={`w-full sm:w-auto ${isComic ? "font-comic" : ""}`}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openCollaboratorDialog(selectedNote)}
                      className={`w-full sm:w-auto ${isComic ? "font-comic" : ""}`}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add Collaborator
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleExportPDF(selectedNote)}
                  className={`w-full sm:w-auto ${isComic ? "font-comic" : ""}`}
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Export PDF
                </Button>
                {(selectedNote.createdByUserId === userId ||
                  hasFullAccess()) && (
                  <Button
                    variant="destructive"
                    onClick={() => openDeleteDialog(selectedNote)}
                    className={`w-full sm:w-auto ${isComic ? "font-comic" : ""}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    setSelectedNote(null);
                  }}
                  className={`w-full sm:w-auto ${isComic ? "font-comic" : ""}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CREATE DIALOG ── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          className={`max-w-lg ${
            isComic ? "comic-card border-4 border-gray-800" : ""
          }`}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                isComic
                  ? "font-comic-title text-xl"
                  : "font-formal-title"
              }`}
            >
              <Plus className="h-5 w-5" />
              Create New Note
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Title *
              </label>
              <Input
                placeholder="Enter note title..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className={isComic ? "font-comic border-2" : ""}
              />
            </div>

            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Priority
              </label>
              <Select
                value={newNotePriority}
                onValueChange={(v) => setNewNotePriority(v as Priority)}
              >
                <SelectTrigger className={isComic ? "font-comic border-2" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">
                    <span className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-red-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-yellow-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="Low">
                    <span className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-blue-500" />
                      Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Content
              </label>
              <Textarea
                placeholder="Write your note here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className={`min-h-37.5 ${isComic ? "font-comic border-2" : ""}`}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewNoteTitle("");
                setNewNoteContent("");
                setNewNotePriority("Medium");
              }}
              className={isComic ? "font-comic" : ""}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              className={`${
                isComic
                  ? "comic-button bg-linear-to-r from-green-400 to-emerald-400 font-comic"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className={`max-w-lg ${
            isComic ? "comic-card border-4 border-gray-800" : ""
          }`}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                isComic
                  ? "font-comic-title text-xl"
                  : "font-formal-title"
              }`}
            >
              <Edit2 className="h-5 w-5" />
              Edit Note
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Title *
              </label>
              <Input
                placeholder="Enter note title..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={isComic ? "font-comic border-2" : ""}
              />
            </div>

            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Priority
              </label>
              <Select
                value={editPriority}
                onValueChange={(v) => setEditPriority(v as Priority)}
              >
                <SelectTrigger className={isComic ? "font-comic border-2" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">
                    <span className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-red-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-yellow-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="Low">
                    <span className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-blue-500" />
                      Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                className={`text-sm font-medium ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Content
              </label>
              <Textarea
                placeholder="Write your note here..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={`min-h-37.5 ${isComic ? "font-comic border-2" : ""}`}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setIsDetailsDialogOpen(true); // Return to details dialog
              }}
              className={isComic ? "font-comic" : ""}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleEditNote}
              className={`${
                isComic
                  ? "comic-button bg-linear-to-r from-blue-400 to-purple-400 font-comic"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Save className="h-4 w-4 mr-1" />
              Update Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COLLABORATOR DIALOG ── */}
      <Dialog
        open={isCollaboratorDialogOpen}
        onOpenChange={setIsCollaboratorDialogOpen}
      >
        <DialogContent
          className={`max-w-lg ${
            isComic ? "comic-card border-4 border-gray-800" : ""
          }`}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                isComic
                  ? "font-comic-title text-xl"
                  : "font-formal-title"
              }`}
            >
              <Users className="h-5 w-5" />
              Manage Collaborators
            </DialogTitle>
            <DialogDescription
              className={isComic ? "font-comic" : "font-formal"}
            >
              Invite users to view and collaborate on this note. Only invited
              users + Engineering Managers/IT can access it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Collaborators */}
            {selectedNote && (selectedNote.collaborators?.length ?? 0) > 0 && (
              <div>
                <h4
                  className={`text-sm font-medium mb-2 ${
                    isComic ? "font-comic" : "font-formal"
                  }`}
                >
                  Current Collaborators
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedNote.collaborators.map((collab) => (
                    <div
                      key={collab.userId}
                      className={`flex items-center justify-between p-2 rounded ${
                        isComic
                          ? "bg-gray-100 border-2 border-gray-300"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={`text-xs ${
                              isComic
                                ? "bg-blue-200 text-blue-800"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {collab.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              isComic ? "font-comic" : "font-formal"
                            }`}
                          >
                            {collab.name}
                          </p>
                          <p
                            className={`text-xs text-gray-500 ${
                              isComic ? "font-comic" : "font-formal"
                            }`}
                          >
                            {collab.referenceId || collab.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCollaborator(collab.userId)}
                        className={`text-red-600 ${
                          isComic ? "font-comic" : ""
                        }`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Collaborator */}
            <div>
              <h4
                className={`text-sm font-medium mb-2 ${
                  isComic ? "font-comic" : "font-formal"
                }`}
              >
                Add Collaborator
              </h4>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by name, email, or ID..."
                  value={collaboratorSearch}
                  onChange={(e) => setCollaboratorSearch(e.target.value)}
                  className={`pl-9 ${
                    isComic ? "font-comic border-2" : ""
                  }`}
                />
              </div>

              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredAvailableUsers.length === 0 ? (
                    <p
                      className={`text-center text-gray-500 py-4 ${
                        isComic ? "font-comic" : "font-formal"
                      }`}
                    >
                      {collaboratorSearch
                        ? "No users found"
                        : "Type to search users"}
                    </p>
                  ) : (
                    filteredAvailableUsers.map((user) => {
                      const first = user.Firstname ?? "";
                      const last = user.Lastname ?? "";
                      const name =
                        `${first} ${last}`.trim() || user.Name || user.Email;
                      return (
                        <button
                          key={user._id}
                          onClick={() => handleAddCollaborator(user)}
                          className={`w-full flex items-center gap-3 p-2 rounded text-left transition-colors ${
                            isComic
                              ? "hover:bg-yellow-100 border-2 border-transparent hover:border-gray-800"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={user.profilePicture} />
                            <AvatarFallback
                              className={`${
                                isComic
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isComic ? "font-comic" : "font-formal"
                              }`}
                            >
                              {name}
                            </p>
                            <p
                              className={`text-xs text-gray-500 truncate ${
                                isComic ? "font-comic" : "font-formal"
                              }`}
                            >
                              ID: {user.ReferenceID || "N/A"} • {user.Department}{" "}
                              • {user.Role}
                            </p>
                            <p
                              className={`text-xs text-gray-400 truncate ${
                                isComic ? "font-comic" : "font-formal"
                              }`}
                            >
                              {user.Email}
                            </p>
                          </div>
                          <UserPlus
                            className={`h-4 w-4 shrink-0 ${
                              isComic ? "text-green-600" : "text-green-500"
                            }`}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsCollaboratorDialogOpen(false);
                setIsDetailsDialogOpen(true);
              }}
              className={isComic ? "font-comic" : ""}
            >
              <X className="h-4 w-4 mr-1" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent
          className={`max-w-md ${
            isComic ? "comic-card border-4 border-gray-800" : ""
          }`}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 text-red-600 ${
                isComic
                  ? "font-comic-title text-xl"
                  : "font-formal-title"
              }`}
            >
              <Trash2 className="h-5 w-5" />
              Delete Note
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className={isComic ? "font-comic" : "font-formal"}>
              Are you sure you want to delete{" "}
              <strong>"{selectedNote?.title || "Untitled Note"}"</strong>?
            </p>
            <p
              className={`text-sm text-gray-500 mt-2 ${
                isComic ? "font-comic" : "font-formal"
              }`}
            >
              This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                // Don't reopen details dialog
              }}
              className={isComic ? "font-comic" : ""}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteNote}
              variant="destructive"
              className={isComic ? "font-comic" : ""}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
