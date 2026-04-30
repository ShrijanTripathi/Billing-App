"use client";

const WIDTH_CLASSES = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export default function Modal({ title, open, onClose, children, size = "md" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${WIDTH_CLASSES[size] || WIDTH_CLASSES.md}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
