"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function AccountPanel() {
  const router = useRouter();
  const uid = useId();
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Account deletion failed");
      }
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">Export your data</h3>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Your watch rules, events, alert history, and notification settings, as a JSON file.
          </p>
        </div>
        <Button asChild variant="outline" className="self-start">
          <a href="/api/account/export" download>
            <Download aria-hidden="true" />
            Export data
          </a>
        </Button>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">Delete your data</h3>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Permanently removes your watch rules, events, alerts, and alert destinations. This
            can’t be undone.
          </p>
        </div>
        <Field className="gap-2">
          <FieldLabel htmlFor={`${uid}-confirm`}>
            Type <span className="font-mono">DELETE</span> to confirm
          </FieldLabel>
          <Input
            id={`${uid}-confirm`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="max-w-48 font-mono"
          />
          {error ? (
            <FieldDescription className="text-[13px] text-destructive" role="alert">
              {error}
            </FieldDescription>
          ) : null}
        </Field>
        <Button
          type="button"
          variant="destructive"
          className="self-start"
          disabled={deleting || confirmation !== "DELETE"}
          onClick={() => void deleteAccount()}
        >
          {deleting ? "Deleting…" : "Delete my data"}
        </Button>
      </section>
    </div>
  );
}
