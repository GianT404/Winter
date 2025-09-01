import React, { useState, useRef } from 'react';
import { Send, Smile, Paperclip, X, File as FileIcon } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Message } from '../../types';
import { ReplyPreview } from './ReplyPreview';

interface MessageInputProps {
  onSendMessage: (content: string, messageType?: 'Text' | 'Image' | 'File', file?: File, replyToMessageId?: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTyping,
  disabled = false,
  replyToMessage,
  onCancelReply,
}) => {  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | undefined>(undefined);  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || selectedFile) && !disabled && !isSending) {
      setIsSending(true);
      
      try {
        if (selectedFile) {
          const messageType = selectedFile.type.startsWith('image/') ? 'Image' : 'File';
          await onSendMessage(message.trim() || selectedFile.name, messageType, selectedFile, replyToMessage?.id);
        } else {
          await onSendMessage(message.trim(), 'Text', undefined, replyToMessage?.id);
        }
        
        setMessage('');
        setSelectedFile(null);
        setFilePreview(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = '40px'; // reset về min-height cố định
        }
        // Note: Reply state will be cleared in ChatApp after message is sent
      } catch (error) {
        console.error('Error sending message:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 144); // giới hạn chiều cao max 144px
      textareaRef.current.style.height = `${newHeight}px`;
    }

    onTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };  return (
    <div className="flex-shrink-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 relative">
      {/* Reply Preview */}
      {replyToMessage && onCancelReply && (
        <ReplyPreview 
          replyToMessage={replyToMessage}
          onCancelReply={onCancelReply}
        />
      )}
      
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full right-4 z-50 mb-2">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            autoFocusSearch={false}
            skinTonesDisabled
            width={300}
            height={400}
          />
        </div>
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="mb-3 bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center space-x-3">
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                <FileIcon className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={removeFile}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {disabled && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
          Bạn không thể gửi tin nhắn tại thời điểm này.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder={disabled ? "Messaging is unavailable" : "Nhập tin nhắn 😾..."}
            disabled={disabled}
            rows={1}
            style={{ minHeight: '41px', maxHeight: '144px', overflowY: 'auto' }}
            className="w-full px-5 py-3 pr-24 rounded-3xl border border-gray-300 bg-white text-gray-900 placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              resize-none shadow-sm transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,*"
          />

          {/* Action buttons */}
          <div className="absolute right-3 bottom-2 flex items-center space-x-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:text-blue-600 transition-colors text-gray-400"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:text-blue-600 transition-colors text-gray-400"
              aria-label="Emoji picker"
              title="Emoji picker"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
        </div>        <button
          type="submit"
          disabled={(!message.trim() && !selectedFile) || disabled || isSending}
          className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
            rounded-full shadow-lg hover:shadow-xl transition-all duration-200
            text-white disabled:cursor-not-allowed flex items-center justify-center
            flex-shrink-0"
          aria-label={isSending ? "Sending..." : "Send message"}
          title={isSending ? "Sending..." : "Send message"}
        >
          <Send className={`w-5 h-5 ${isSending ? 'animate-pulse' : ''}`} />
        </button>
      </form>
    </div>
  );
};
