import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../../context/TaskContext';
import { 
  FileSpreadsheet, Upload, Download, Trash2, AlertCircle, 
  Image as ImageIcon, Paperclip, Eye, X, ZoomIn, FileText, Check, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export const TaskAttachmentsSection = ({ task }) => {
  const { addAttachment, deleteAttachment } = useTasks();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // Lightbox photo
  const fileInputRef = useRef(null);

  const attachments = task.task_attachments || [];

  const isImageAttachment = (att) => {
    const ext = att.file_name?.split('.').pop()?.toLowerCase();
    return att.mime_type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  };

  const processAndUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ok = await addAttachment(task.id, file);
      if (ok) successCount++;
    }

    setUploading(false);
  };

  const handleFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await processAndUploadFiles(files);
      e.target.value = '';
    }
  };

  // Global Clipboard Paste Listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const filesToUpload = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            let fileName = file.name;
            // Clean up generic clipboard file names with timestamp
            if (!fileName || fileName === 'image.png' || fileName === 'blob') {
              const timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const ext = file.type.split('/')[1] || 'png';
              fileName = `photo_${timeStr}.${ext}`;
            }
            const namedFile = new File([file], fileName, { type: file.type });
            filesToUpload.push(namedFile);
          }
        }
      }

      if (filesToUpload.length > 0) {
        e.preventDefault();
        toast.loading('Pasting photo from clipboard...', { id: 'paste-upload' });
        await processAndUploadFiles(filesToUpload);
        toast.dismiss('paste-upload');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [task.id]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await processAndUploadFiles(files);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          <Paperclip className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span>Attachments & Photos ({attachments.length})</span>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Uploading...' : 'Upload'}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*, .xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Interactive Drop Zone (Drag & Drop + Paste + Click) */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all select-none ${
          isDragging
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/15 ring-2 ring-blue-500/20 scale-[1.01]'
            : 'border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500/60 bg-white/70 dark:bg-[#28292f]/40 hover:bg-slate-50 dark:hover:bg-[#28292f]'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-2xs">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {isDragging ? '✨ Drop photos or files here!' : 'Drop photos or spreadsheets here'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            or press <kbd className="px-1.5 py-0.5 rounded-md font-mono text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-600">Ctrl+V</kbd> to paste photo, or click to browse
          </div>
        </div>
      </div>

      {/* Format Info Badge */}
      <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-[#24252d] border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
        <span>Accepts <strong>Photos</strong> (PNG, JPG, WebP, GIF) and <strong>Spreadsheets</strong> (XLSX, XLS, CSV).</span>
      </div>

      {/* Attachments List */}
      <div className="space-y-2">
        {attachments.map((att) => {
          const isImage = isImageAttachment(att);

          return (
            <div
              key={att.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-[#28292f] border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-xs shadow-xs"
            >
              {/* Thumbnail / Icon & File Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {isImage ? (
                  <div
                    onClick={() => setPreviewImage(att)}
                    className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 cursor-pointer group bg-slate-100 dark:bg-slate-800"
                    title="Click to view full photo"
                  >
                    <img
                      src={att.file_url}
                      alt={att.file_name}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <span
                    onClick={() => isImage && setPreviewImage(att)}
                    className={`font-semibold text-slate-800 dark:text-slate-200 block truncate ${
                      isImage ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''
                    }`}
                  >
                    {att.file_name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {isImage ? 'Photo' : 'Excel/CSV'}
                    </span>
                    {att.file_size && (
                      <span>
                        {att.file_size > 1024 * 1024
                          ? `${(att.file_size / (1024 * 1024)).toFixed(1)} MB`
                          : `${Math.round(att.file_size / 1024)} KB`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions: View, Download, Delete */}
              <div className="flex items-center gap-1 shrink-0">
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(att)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="View Full Size"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                )}

                <a
                  href={att.file_url}
                  download={att.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>

                {deleteAttachment && (
                  <button
                    type="button"
                    onClick={() => deleteAttachment(task.id, att.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete Attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Photo Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-[#1c1d22] rounded-2xl p-3 shadow-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 gap-4">
              <div className="truncate font-bold text-xs text-slate-800 dark:text-slate-200">
                {previewImage.file_name}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewImage.file_url}
                  download={previewImage.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo View */}
            <div className="overflow-auto flex items-center justify-center max-h-[75vh]">
              <img
                src={previewImage.file_url}
                alt={previewImage.file_name}
                className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
