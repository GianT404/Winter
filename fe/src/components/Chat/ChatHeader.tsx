import React, { useState } from 'react';
import { Conversation, User } from '../../types';
import { MoreVertical, Phone, Video, Shield, ShieldAlert } from 'lucide-react';
import UserMenu from './UserMenu';
import { UserBlockControls } from './UserBlockControls';
import Avatar from '../UI/Avatar';

interface ChatHeaderProps {
  conversation: Conversation;
  otherUser: User;
  recipient: User;
  isOnline: boolean;
  isBlocked: boolean;
  hasBlocked: boolean;
  onBlockStatusChange: (isBlocked: boolean, hasBlocked: boolean) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  conversation,
  otherUser,
  recipient, 
  isOnline, 
  isBlocked, 
  hasBlocked,
  onBlockStatusChange 
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  return (
    <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-white/50 backdrop-blur-sm">
      <div className="flex items-center space-x-3">        <div className="relative">
          <Avatar
            src={recipient?.avatar}
            alt={recipient?.name || 'User'}
            size="md"
          />
          {isOnline && !isBlocked && !hasBlocked && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div><div className="flex items-center">
          <div>
            <h3 className="font-semibold text-gray-900">{recipient?.name || 'Không có tên'}</h3>
            <p className="text-sm text-gray-500">
              {hasBlocked && <span className="text-red-500 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Bạn đã chặn</span>}
              {isBlocked && <span className="text-orange-500 flex items-center gap-1"><Shield className="w-3 h-3" /> Bạn bị chặn</span>}
              {!isBlocked && !hasBlocked && (isOnline ? 'Online' : '')}
            </p>
          </div>
        </div>
      </div>{/* Block controls */}
      <UserBlockControls
        userId={otherUser?.id || ''}
        username={otherUser?.name || 'Unknown User'}
        isBlocked={isBlocked}
        hasBlocked={hasBlocked}
        onBlockStatusChange={onBlockStatusChange}
      />

      <div className="flex items-center space-x-2">
        {/* {!isBlocked && !hasBlocked && (
          <>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Video className="w-5 h-5" />
            </button>
          </>
        )} */}
        <div className="relative">
          <button 
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <UserMenu 
            user={recipient}
            isOpen={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
            onBlockStatusChange={onBlockStatusChange}
          />
        </div>
      </div>
    </div>
  );
};
