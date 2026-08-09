import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import './Modal.css';

const ModalHeaderActionsContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

export function useModalHeaderActions() {
  return useContext(ModalHeaderActionsContext);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  useEffect(() => {
    if (!open) setHeaderActions(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-pop-in" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            {headerActions && <div className="modal-header-actions">{headerActions}</div>}
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        <ModalHeaderActionsContext.Provider value={setHeaderActions}>
          <div className="modal-body">{children}</div>
        </ModalHeaderActionsContext.Provider>
      </div>
    </div>
  );
}
