import React, { useState, useRef } from 'react';
import { Camera, User, Upload, X } from 'lucide-react';
import { userService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  editable?: boolean;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  size = 'md',
  className = '',
  editable = false,
  onClick,
}) => {
  const { user, updateUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  // Function to compress image (skip GIFs to preserve animation)
  const compressImage = (file: File, maxWidth: number = 400, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      // Don't compress GIFs to preserve animation
      if (file.type === 'image/gif') {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, file.type, quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Vui lòng chọn file ảnh hợp lệ (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (5MB, but allow larger GIFs up to 10MB since they can't be compressed)
    const maxSize = file.type === 'image/gif' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeText = file.type === 'image/gif' ? '10MB' : '5MB';
      alert(`Kích thước file không được vượt quá ${maxSizeText}`);
      return;
    }

    try {
      // Show preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Compress image (GIFs will be skipped to preserve animation)
      const processedFile = await compressImage(file);
      
      setIsUploading(true);

      // Upload to server
      const updatedUser = await userService.updateAvatar(processedFile);
      
      // Update user in auth context
      updateUser(updatedUser);
      
      // Clear preview
      setPreview(null);
      
      alert('Cập nhật avatar thành công!');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      
      if (error.response?.status === 413) {
        alert('File quá lớn. Vui lòng chọn ảnh nhỏ hơn.');
      } else if (error.response?.status === 400) {
        alert(error.response.data || 'File không hợp lệ.');
      } else if (error.code === 'ERR_NETWORK') {
        alert('Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.');
      } else {
        alert('Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại.');
      }
      
      setPreview(null);
    } finally {
      setIsUploading(false);
      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (editable && !isUploading) {
      fileInputRef.current?.click();
    } else if (onClick) {
      onClick();
    }
  };

  const handleCancelPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displaySrc = preview || src || user?.avatar;
  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          overflow-hidden 
          bg-gradient-to-r from-primary-500 to-primary-600 
          flex items-center justify-center 
          text-white font-medium
          avatar-image
          ${editable ? 'cursor-pointer hover:opacity-80' : ''}
          ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
          transition-opacity duration-200
        `}
        onClick={handleClick}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={alt}
            className="w-full h-full object-cover avatar-image"
            onError={(e) => {
              // Fallback to user icon if image fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <User className={iconSizeClasses[size]} />
        )}

        {editable && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center rounded-full">
            <Camera className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity duration-200" />
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isUploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Preview actions */}
      {preview && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            onClick={handleCancelPreview}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors duration-200"
            title="Hủy"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
      )}
    </div>
  );
};

export default Avatar;