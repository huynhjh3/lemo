import React from "react";
import { X } from "lucide-react";
import { T } from "../theme.js";
import { Card } from "./ui.jsx";

export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full" style={{ maxWidth: 480 }}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: T.text, fontFamily: T.fontDisplay }}>{title}</h3>
            <button onClick={onClose} style={{ color: T.textFaint }}>
              <X size={16} />
            </button>
          </div>
          {children}
        </Card>
      </div>
    </div>
  );
}
