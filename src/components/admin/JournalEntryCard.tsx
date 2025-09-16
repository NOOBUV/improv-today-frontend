'use client';

import { useState } from 'react';
import { JournalEntry } from '@/types/journal';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onUpdateStatus: (id: string, status: JournalEntry['status']) => Promise<void>;
}

export function JournalEntryCard({ entry, onUpdateStatus }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(entry.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = entry.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleStatusUpdate = async (newStatus: JournalEntry['status']) => {
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(entry.entry_id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: JournalEntry['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'posted':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-medium text-gray-900">
              {formatDate(entry.entry_date)}
            </h3>
            <span
              className={clsx(
                'px-2 py-1 text-xs font-medium rounded-full',
                getStatusColor(entry.status)
              )}
            >
              {entry.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {/* Status Update Dropdown */}
            <select
              value={entry.status}
              onChange={(e) => handleStatusUpdate(e.target.value as JournalEntry['status'])}
              disabled={isUpdatingStatus}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
            </select>

            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
            >
              <svg
                className={clsx('w-5 h-5 transition-transform', isExpanded && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              <div className="prose max-w-none text-gray-700 mb-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {entry.content}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  Created: {new Date(entry.created_at).toLocaleDateString()}
                  {entry.updated_at && entry.updated_at !== entry.created_at && (
                    <span className="ml-2">
                      • Updated: {new Date(entry.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview when collapsed */}
      {!isExpanded && (
        <div className="p-4 bg-gray-50">
          <p className="text-sm text-gray-600 line-clamp-2">
            {entry.content.substring(0, 150)}...
          </p>
        </div>
      )}
    </div>
  );
}