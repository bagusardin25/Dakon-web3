import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * A modal built on <dialog>: focus is trapped and restored by the browser, Escape closes it,
 * and a click on the backdrop closes it too.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  labelId,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  labelId: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={labelId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className="dialog__head">
            <h2 id={labelId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="dialog__body">{children}</div>
        </>
      )}
    </dialog>
  )
}
