import { useId, type ComponentProps } from 'react';
import { CircleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TextFieldProps extends ComponentProps<typeof Input> {
  label: string;
  /** Message d'erreur de validation, affiché sous le champ et relié à lui. */
  error?: string;
  /** Aide permanente, par exemple « 12 caractères minimum ». */
  hint?: string;
}

/** Label + champ + aide + erreur, avec les liens d'accessibilité (RGAA). */
export function TextField({
  label,
  error,
  hint,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="h-11 text-base aria-invalid:border-2 aria-invalid:border-destructive"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive"
        >
          <CircleAlert className="size-4" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
