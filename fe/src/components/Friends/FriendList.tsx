import React, { useState, useEffect, useCallback } from 'react';
import { User, Friendship } from '../../types';
import { UserPlus, Check, X, Search, AlertCircle, Mail, User as UserIcon } from 'lucide-react';
import { userService } from '../../services/api';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

interface FriendListProps {
  friends: User[];
  friendRequests: Friendship[];
  onSendFriendRequest: (email: string) => void;
  onAcceptFriendRequest: (requestId: string) => void;
  onDeclineFriendRequest: (requestId: string) => void;
  onStartChat: (userId: string) => void;
  currentUserId: string;
}

export const FriendList: React.FC<FriendListProps> = ({
  friends,
  friendRequests,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onStartChat,
  currentUserId,
}) => {  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Friend search states
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  // Kiểm tra nếu friends là undefined hoặc null thì thiết lập mảng rỗng
  const safetyFriends = Array.isArray(friends) ? friends : [];

  // Lọc bạn bè dựa trên truy vấn tìm kiếm
  const filteredFriends = safetyFriends.filter(friend => {
    if (!friend) return false;
    const nameMatch = friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const emailMatch = friend.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return nameMatch || emailMatch;
  });
  // Kiểm tra nếu friendRequests là undefined hoặc null thì thiết lập mảng rỗng
  const safetyFriendRequests = Array.isArray(friendRequests) ? friendRequests : [];

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (email: string) => {
      if (email.length < 3) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setSearchError('');

      try {
        const results = await userService.searchUsers(email);
        setSearchResults(results);
        setShowResults(true);
      } catch (err) {
        console.error('Error searching users:', err);
        setSearchError('Không thể tìm kiếm người dùng. Vui lòng thử lại.');
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  // Handle email input change
  useEffect(() => {
    debouncedSearch(searchEmail);
    
    // Clear messages when typing
    if (searchEmail !== '') {
      setError('');
      setSuccessMessage('');
    }
  }, [searchEmail, debouncedSearch]);

  // Reset search when switching tabs
  useEffect(() => {
    if (activeTab !== 'add') {
      setSearchEmail('');
      setSearchResults([]);
      setShowResults(false);
      setSearchError('');
    }
  }, [activeTab]);

  // Tính toán số lượng cho tabs
  const pendingCount = safetyFriendRequests.length;  // Xử lý gửi yêu cầu kết bạn
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      await onSendFriendRequest(searchEmail.trim());
      setSearchEmail('');
      setSearchResults([]);
      setShowResults(false);
      setSuccessMessage('Đã gửi lời mời kết bạn thành công!');
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Không thể gửi lời mời kết bạn. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const tabs = [
    { id: 'friends' as const, label: 'Bạn bè', count: safetyFriends.length },
    { id: 'requests' as const, label: 'Yêu cầu kết bạn', count: pendingCount },
    { id: 'add' as const, label: 'Thêm bạn', count: 0 },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white/50 backdrop-blur-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' && (
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm bạn bè..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/70 backdrop-blur-sm"
              />
            </div>            {/* Friends List */}
            <div className="space-y-2">
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 glass rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                    onClick={() => onStartChat(friend.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {friend.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {friend.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>                      <div>
                        <h3 className="font-medium text-gray-900">{friend.name || 'Không có tên'}</h3>
                        <p className="text-sm text-gray-500">{friend.email}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {friend.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {filteredFriends.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {safetyFriends.length === 0 ? 'Chưa có bạn bè' : 'Không tìm thấy bạn bè'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="p-4">
            <div className="space-y-3">
              {friendRequests.map((request) => (
                <div key={request.id} className="glass rounded-lg p-4">                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {request.requester?.name?.charAt(0).toUpperCase() || 'R'}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{request.requester?.name || 'Unknown User'}</h3>
                        <p className="text-sm text-gray-500">{request.requester?.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onAcceptFriendRequest(request.id)}
                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeclineFriendRequest(request.id)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {friendRequests.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Không có yêu cầu kết bạn nào
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="p-4">
            <form onSubmit={handleSendRequest} className="space-y-4">              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email của bạn bè
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="email"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Nhập địa chỉ email để tìm kiếm..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/70 backdrop-blur-sm"
                    required
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {showResults && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Kết quả tìm kiếm:</h3>
                  
                  {searchResults.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.map((user) => {
                        // Check if user is already a friend
                        const isAlreadyFriend = safetyFriends.some(friend => friend.id === user.id);
                        // Check if user is current user
                        const isCurrentUser = user.id === currentUserId;
                        // Check if there's already a pending request
                        const hasPendingRequest = safetyFriendRequests.some(
                          request => request.requester?.id === user.id || request.receiver?.id === user.id
                        );

                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 glass rounded-lg border border-gray-200 hover:bg-white/20 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-r from-primary-400 to-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                                  {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                                </div>
                                {user.isOnline && (
                                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {user.name || 'Người dùng không tên'}
                                </h4>
                                <p className="text-sm text-gray-500">{user.email}</p>
                                {user.isOnline !== undefined && (
                                  <p className="text-xs text-gray-400">
                                    {user.isOnline ? 'Đang hoạt động' : 'Không hoạt động'}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {isCurrentUser ? (
                                <span className="text-sm text-gray-500 italic">Chính bạn</span>
                              ) : isAlreadyFriend ? (
                                <span className="text-sm text-green-600 flex items-center">
                                  <Check className="w-4 h-4 mr-1" />
                                  Đã là bạn bè
                                </span>
                              ) : hasPendingRequest ? (
                                <span className="text-sm text-orange-600">Đã gửi yêu cầu</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSearchEmail(user.email);
                                    setShowResults(false);
                                  }}
                                  className="px-3 py-1 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors flex items-center space-x-1"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  <span>Chọn</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 glass rounded-lg">
                      <UserIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>Không tìm thấy người dùng với email này</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Kiểm tra lại email hoặc thử với email khác
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Search Error */}
              {searchError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}{error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              {successMessage && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-600 text-sm flex items-center">
                  <Check className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !searchEmail.trim()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Gửi yêu cầu kết bạn</span>
                  </>
                )}
              </button>
            </form>            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Cách thêm bạn bè</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Nhập ít nhất 3 ký tự để tìm kiếm người dùng</li>
                <li>• Xem trước thông tin người dùng trước khi gửi yêu cầu</li>
                <li>• Chọn "Chọn" để điền email tự động</li>
                <li>• Họ sẽ nhận được yêu cầu kết bạn từ bạn</li>
                <li>• Khi được chấp nhận, bạn có thể bắt đầu trò chuyện!</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
