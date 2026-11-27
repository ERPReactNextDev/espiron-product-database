"use client";

import { useState } from "react";
import { Minus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

/* ---------------- Types ---------------- */

type Props = {
  technicalSpecificationId: string;

  title: string;

  onDelete: (technicalSpecificationId: string) => Promise<void>;

};

export default function AddProductDeleteTechnicalSpecification({

  technicalSpecificationId,

  title,

  onDelete,

}: Props) {

  const [open, setOpen] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {

    try {

      setDeleting(true);

      await onDelete(technicalSpecificationId);

      toast.success("Technical specification deleted");

      setOpen(false);

    } catch (error) {

      console.error(error);

      toast.error("Failed to delete technical specification");

    } finally {

      setDeleting(false);

    }

  };

  return (

    <Dialog open={open} onOpenChange={setOpen}>

      <DialogTrigger asChild>

        <Button size="icon" variant="outline">

          <Minus className="h-4 w-4" />

        </Button>

      </DialogTrigger>

      <DialogContent>

        <DialogHeader>

          <DialogTitle>Delete Technical Specification</DialogTitle>

        </DialogHeader>

        <p>

          Delete <b>{title}</b> ?

        </p>

        <DialogFooter>

          <Button disabled={deleting} onClick={() => setOpen(false)}>

            Cancel

          </Button>

          <Button disabled={deleting} variant="destructive" onClick={handleDelete}>

            Delete

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}