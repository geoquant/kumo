import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogRoot,
  DialogTitle,
  DialogClose,
} from "../../components/dialog";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { cn } from "../../utils/cn";
import {
  CheckIcon,
  CopyIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Banner } from "../../components/banner";
import { useLocalize } from "../../localize/index.js";
import { resolveAriaLabel } from "../../utils/resolve-aria-label";

export const KUMO_DELETE_RESOURCE_VARIANTS = {
  size: {
    sm: {
      classes: "",
      description: "Small dialog for simple delete confirmations",
    },
    base: {
      classes: "",
      description: "Default delete confirmation dialog size",
    },
  },
} as const;

export const KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type KumoDeleteResourceSize =
  keyof typeof KUMO_DELETE_RESOURCE_VARIANTS.size;

export interface KumoDeleteResourceVariantsProps {
  size?: KumoDeleteResourceSize;
}

export interface DeleteResourceProps extends KumoDeleteResourceVariantsProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The type of resource being deleted (e.g., "Zone", "Worker", "KV Namespace") */
  resourceType: string;
  /** The name of the specific resource being deleted */
  resourceName: string;
  /** Callback when delete is confirmed */
  onDelete: () => void | Promise<void>;
  /** Whether the delete action is in progress */
  isDeleting?: boolean;
  /** Whether the confirmation input should be case-sensitive (default: true) */
  caseSensitive?: boolean;
  /** Custom delete button text (defaults to "Delete {resourceType}") */
  deleteButtonText?: string;
  /** Additional className for the dialog */
  className?: string;
  /** Error message to display if the delete action fails */
  errorMessage?: string;
  /** Optional aria-label override for the close button. */
  closeAriaLabel?: string;
  /** Optional aria-label override for the resource-name copy button. */
  copyResourceNameAriaLabel?: string;
  /** Optional aria-label override for the confirmation input. */
  confirmInputAriaLabel?: string;
}

export function DeleteResource({
  open,
  onOpenChange,
  resourceType,
  resourceName,
  onDelete,
  isDeleting = false,
  caseSensitive = true,
  deleteButtonText,
  size = KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS.size,
  errorMessage,
  className,
  closeAriaLabel,
  copyResourceNameAriaLabel,
  confirmInputAriaLabel,
}: DeleteResourceProps) {
  const { term } = useLocalize();
  const [confirmationInput, setConfirmationInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmationInput("");
      setCopied(false);
    }
  }, [open]);

  const normalizeForComparison = useCallback(
    (str: string) => (caseSensitive ? str : str.toLowerCase()),
    [caseSensitive],
  );

  const isConfirmed =
    normalizeForComparison(confirmationInput) ===
    normalizeForComparison(resourceName);

  const normalizedDeleteButtonText = deleteButtonText?.trim();
  const deleteActionLabel =
    normalizedDeleteButtonText && normalizedDeleteButtonText.length > 0
      ? normalizedDeleteButtonText
      : term("delete-resource-type", resourceType);

  const handleDelete = useCallback(async () => {
    if (!isConfirmed || isDeleting) return;
    await onDelete();
  }, [isConfirmed, isDeleting, onDelete]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(resourceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [resourceName]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog size={size} className={cn("p-0", className)}>
        <div className="flex items-center justify-between border-b border-kumo-line px-6 py-4">
          <DialogTitle className="text-lg font-semibold">
            {term("delete-resource", resourceName)}
          </DialogTitle>
          <DialogClose
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                shape="square"
                size="sm"
                aria-label={resolveAriaLabel(closeAriaLabel, term("close"))}
                disabled={isDeleting}
              >
                <XIcon size={18} />
              </Button>
            )}
          />
        </div>

        <div className="flex flex-col p-6 gap-4">
          <div className="flex flex-col gap-2">
            {errorMessage && (
              <Banner icon={<WarningCircleIcon />} variant="error">
                {errorMessage}
              </Banner>
            )}
            <p className="text-base text-kumo-subtle max-w-prose text-pretty">
              {term(
                "delete-action-cannot-be-undone",
                resourceName,
                resourceType,
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-base flex-wrap">
              <span>{term("type-to-confirm", resourceName)}</span>
              <button
                className="font-mono text-sm inline-flex items-center font-semibold bg-kumo-tint hover:bg-kumo-fill rounded-md px-2 py-1 group hover:cursor-pointer"
                onClick={handleCopy}
                aria-label={resolveAriaLabel(
                  copyResourceNameAriaLabel,
                  term("copy-resource-name-to-clipboard", resourceName),
                )}
              >
                <span className="leading-none">{resourceName}</span>
                {copied ? (
                  <CheckIcon size={12} weight="bold" className="ms-1.5" />
                ) : (
                  <CopyIcon
                    size={12}
                    weight="bold"
                    className="text-kumo-subtle group-hover:text-kumo-default ms-1.5"
                  />
                )}
              </button>
            </div>
            <Input
              placeholder={resourceName}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={resolveAriaLabel(
                confirmInputAriaLabel,
                term("confirm-deletion-aria-label", resourceName),
              )}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-kumo-line px-6 py-4">
          <DialogClose
            render={(props) => (
              <Button {...props} variant="secondary" disabled={isDeleting}>
                {term("cancel")}
              </Button>
            )}
          />
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
          >
            {deleteActionLabel}
          </Button>
        </div>
      </Dialog>
    </DialogRoot>
  );
}

DeleteResource.displayName = "DeleteResource";
