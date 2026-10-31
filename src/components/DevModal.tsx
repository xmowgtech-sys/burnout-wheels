'use client';

import { useState, useEffect } from 'react';

export default function DevModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('dev_modal_dismissed');
    if (!isDismissed) {
      setShowModal(true);
    }
  }, []);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-yellow-500/30 bg-neutral-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
          <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">Site Under Development</h3>
        <p className="text-sm text-neutral-400 mb-6">
          Welcome to <span className="text-yellow-500 font-semibold">Burnout Wheels</span>! We are working hard to optimize our shop pipeline. Some features may be undergoing tuning.
        </p>

        <button
          onClick={() => {
            sessionStorage.setItem('dev_modal_dismissed', 'true');
            setShowModal(false);
          }}
          className="w-full rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-yellow-400 cursor-pointer"
        >
          OK, that's fine
        </button>
      </div>
    </div>
  );
}
