import React from "react";
import FolderBrowser from "./FolderBrowser";

export default function FolderPickerModal({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (folder: { id: string; name: string }) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Escolher Pasta</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:underline">Fechar</button>
        </div>
        <FolderBrowser onSelect={(f) => { onPicked(f); onClose(); }} />
      </div>
    </div>
  );
}