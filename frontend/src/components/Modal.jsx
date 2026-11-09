import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useRef } from "react";
export default function Modal({ open, onOpenChange, title, description, children, wide = false }) {
  const returnFocus = useRef(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px]" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-ink bg-card shadow-[8px_8px_0_#1e1d1825] ${wide ? "max-w-5xl" : "max-w-xl"}`}
        >
          <header className="flex items-center justify-between gap-4 border-b border-ink px-6 py-5 md:px-8">
            <Dialog.Title className="font-serif text-2xl md:text-3xl">{title}</Dialog.Title>
            <Dialog.Close className="p-2 hover:bg-wash" aria-label="关闭弹窗">
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Description className={description ? "px-8 pt-5 text-muted" : "sr-only"}>
            {description || title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
