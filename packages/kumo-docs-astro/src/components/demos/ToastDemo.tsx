import { Button, Toasty, useKumoToastManager, Link } from "@cloudflare/kumo";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

function ToastTriggerButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Toast created",
          description: "This is a toast notification.",
        })
      }
    >
      Show toast
    </Button>
  );
}

export function ToastBasicDemo() {
  return (
    <Toasty>
      <ToastTriggerButton />
    </Toasty>
  );
}

function ToastTitleOnlyButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Settings saved",
        })
      }
    >
      Title only
    </Button>
  );
}

export function ToastTitleOnlyDemo() {
  return (
    <Toasty>
      <ToastTitleOnlyButton />
    </Toasty>
  );
}

function ToastDescriptionOnlyButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          description: "Your changes have been saved successfully.",
        })
      }
    >
      Description only
    </Button>
  );
}

export function ToastDescriptionOnlyDemo() {
  return (
    <Toasty>
      <ToastDescriptionOnlyButton />
    </Toasty>
  );
}

/** Success toast with green accent border and check icon. */
function ToastSuccessButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      variant="primary"
      onClick={() =>
        toastManager.add({
          title: "Deployed successfully",
          description: "Your Worker is now live.",
          variant: "success",
        })
      }
    >
      Deploy Worker
    </Button>
  );
}

export function ToastSuccessDemo() {
  return (
    <Toasty>
      <ToastSuccessButton />
    </Toasty>
  );
}

function ToastMultipleButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() => {
        toastManager.add({
          title: "First toast",
          description: "This is the first notification.",
        });
        setTimeout(() => {
          toastManager.add({
            title: "Second toast",
            description: "This is the second notification.",
          });
        }, 500);
        setTimeout(() => {
          toastManager.add({
            title: "Third toast",
            description: "This is the third notification.",
          });
        }, 1000);
      }}
    >
      Show multiple toasts
    </Button>
  );
}

export function ToastMultipleDemo() {
  return (
    <Toasty>
      <ToastMultipleButton />
    </Toasty>
  );
}

function ToastErrorButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Deployment failed",
          description: "Unable to connect to the server.",
          variant: "error",
        })
      }
    >
      Show error toast
    </Button>
  );
}

export function ToastErrorDemo() {
  return (
    <Toasty>
      <ToastErrorButton />
    </Toasty>
  );
}

function ToastWarningButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Rate limit warning",
          description: "You're approaching your API quota.",
          variant: "warning",
        })
      }
    >
      Show warning toast
    </Button>
  );
}

export function ToastWarningDemo() {
  return (
    <Toasty>
      <ToastWarningButton />
    </Toasty>
  );
}

/** Info toast with blue accent border and info icon. */
function ToastInfoButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "New version available",
          description: "Kumo v4.2 includes performance improvements.",
          variant: "info",
        })
      }
    >
      Show info toast
    </Button>
  );
}

export function ToastInfoDemo() {
  return (
    <Toasty>
      <ToastInfoButton />
    </Toasty>
  );
}

function ToastCustomContentButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          content: (
            <div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon />
                <Link href="/">my-first-worker</Link> created!
              </div>
            </div>
          ),
        })
      }
    >
      Show custom content
    </Button>
  );
}

export function ToastCustomContentDemo() {
  return (
    <Toasty>
      <ToastCustomContentButton />
    </Toasty>
  );
}

function ToastActionsButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Need help?",
          description: "Get assistance with your deployment.",
          actions: [
            {
              children: "Support",
              variant: "secondary",
              onClick: () => console.log("Support clicked"),
            },
            {
              children: "Ask AI",
              variant: "primary",
              onClick: () => console.log("Ask AI clicked"),
            },
          ],
        })
      }
    >
      Show with actions
    </Button>
  );
}

export function ToastActionsDemo() {
  return (
    <Toasty>
      <ToastActionsButton />
    </Toasty>
  );
}

function ToastPromiseButton() {
  const toastManager = useKumoToastManager();

  const simulateDeployment = () => {
    return new Promise<{ name: string }>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          resolve({ name: "my-worker" });
        } else {
          reject(new Error("Network error"));
        }
      }, 2000);
    });
  };

  return (
    <Button
      onClick={() =>
        toastManager.promise(simulateDeployment(), {
          loading: {
            title: "Deploying...",
            description: "Please wait while we deploy your Worker.",
          },
          success: (data) => ({
            title: "Deployed!",
            description: `Worker "${data.name}" is now live.`,
          }),
          error: (err) => ({
            title: "Deployment failed",
            description: err.message,
            variant: "error",
          }),
        })
      }
    >
      Deploy with promise
    </Button>
  );
}

export function ToastPromiseDemo() {
  return (
    <Toasty>
      <ToastPromiseButton />
    </Toasty>
  );
}

// --- Persistent (no auto-dismiss) ---

function ToastPersistentButton() {
  const toastManager = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Action required",
          description:
            "This toast will stay visible until you dismiss it manually.",
          variant: "warning",
          timeout: 0,
        })
      }
    >
      Show persistent toast
    </Button>
  );
}

export function ToastPersistentDemo() {
  return (
    <Toasty>
      <ToastPersistentButton />
    </Toasty>
  );
}

// --- Top position (using Base UI primitives directly) ---

import { Toast, cn } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react/dist/ssr";

function TopPositionToastButton() {
  const toastManager = Toast.useToastManager();

  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Heads up!",
          description: "This toast appears from the top of the viewport.",
        })
      }
    >
      Show top toast
    </Button>
  );
}

function TopPositionToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      swipeDirection="up"
      className={cn(
        "absolute right-0 top-0 left-0 z-[calc(1000-var(--toast-index))] mx-auto w-full origin-top select-none",
        "rounded-xl border border-kumo-fill bg-kumo-control bg-clip-padding p-4 shadow-lg",
        "h-[var(--height)]",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)+(var(--toast-index)*var(--gap))+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--peek))+(var(--shrink)*var(--height))))_scale(var(--scale))]",
        "[transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s]",
        "after:absolute after:bottom-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-[ending-style]:opacity-0 data-[expanded]:h-[var(--toast-height)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-[limited]:opacity-0 data-[starting-style]:[transform:translateY(-150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(-150%)]",
        "data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-[expanded]:data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-[expanded]:data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-[expanded]:data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-[expanded]:data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
      )}
    >
      <Toast.Content className="overflow-hidden transition-opacity [transition-duration:250ms] data-[behind]:pointer-events-none data-[behind]:opacity-0 data-[expanded]:pointer-events-auto data-[expanded]:opacity-100">
        <Toast.Title className="text-[0.975rem] leading-5 font-medium text-kumo-default" />
        <Toast.Description className="text-[0.925rem] leading-5 text-kumo-subtle" />
        <Toast.Close
          className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded border-none bg-transparent text-current/50 hover:bg-kumo-contrast/10 hover:text-current"
          aria-label="Close"
        >
          <XIcon className="h-3 w-3" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export function ToastTopPositionDemo() {
  return (
    <Toast.Provider>
      <TopPositionToastButton />
      <Toast.Portal>
        <Toast.Viewport className="fixed top-4 right-0 bottom-auto left-0 z-50 mx-auto flex w-full max-w-[340px]">
          <TopPositionToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
