import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

// ラベル付きの入力欄
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="flex flex-col items-stretch gap-1.5">
      <span>{label}</span>
      {children}
    </Label>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
