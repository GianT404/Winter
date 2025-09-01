import React, { useState } from 'react';
import { User } from '../../types';
import { MessageCircle, Users, Settings, LogOut, UsersRound } from 'lucide-react';
import Avatar from '../UI/Avatar';
interface SidebarProps {
  user: User;
  activeSection: 'chats' | 'friends' | 'groups' | 'settings';
  onSectionChange: (section: 'chats' | 'friends' | 'groups' | 'settings') => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeSection,
  onSectionChange,
  onLogout,
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const menuItems = [
    { id: 'chats' as const, icon: MessageCircle, label: 'Chat' },
    { id: 'groups' as const, icon: UsersRound, label: 'Nhóm' },
    { id: 'friends' as const, icon: Users, label: 'Bạn bè' },
    { id: 'settings' as const, icon: Settings, label: 'Cài đặt' },
  ];

  return (
    <div className="w-16 lg:w-64 bg-white/10 backdrop-blur-md border-r border-white/20 flex flex-col">      {/* User Profile */}
      <div className="p-4 border-b border-white/20">
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:bg-white/10 rounded-lg p-2 transition-colors duration-200"
        >
          <div className="relative">
            <Avatar
              src={user.avatar}
              alt={user.name}
              size="md"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="hidden lg:block">
            <div>
              Xin chào, {user.name}
            </div>
             
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-700 hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden lg:block">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
