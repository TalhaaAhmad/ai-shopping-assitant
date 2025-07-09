// app/admin/page.tsx (App Router) or pages/admin/index.tsx (Pages Router)

"use client"; // Remove this line if using Pages Router

import React, { useState, useEffect } from 'react';
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs"; // or your auth provider
import { api } from "../../convex/_generated/api";
import { Search, Users, MessageSquare, Activity, Eye, Calendar, TrendingUp, Shield, AlertCircle, X, User, Bot, Send } from 'lucide-react';

// Admin user IDs - should match your admin.ts file
const ADMIN_USER_IDS = [
  "user_2zJ2jWXawy5yFT2GkYTUeQUhdmF",
];

const AdminPage = () => {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Convex queries - only run when user is authenticated
  const stats = useQuery(api.admin.getConversationStats, user ? {} : "skip");
  const allChats = useQuery(api.admin.getAllChats, user ? { limit: 50 } : "skip");
  const allMessages = useQuery(api.admin.getAllMessages, user ? { limit: 100 } : "skip");
  const userActivity = useQuery(
    api.admin.getUserActivity, 
    user && selectedUser ? { userId: selectedUser } : "skip"
  );

  // Search functionality
  const searchConversations = useQuery(
    api.admin.searchConversations,
    user && searchTerm.length > 2 ? { searchTerm, limit: 20 } : "skip"
  );

  useEffect(() => {
    if (searchConversations) {
      setSearchResults(searchConversations);
    }
  }, [searchConversations]);

  // Update chat messages when a chat is selected
  useEffect(() => {
    if (selectedChat && allMessages) {
      const messages = allMessages.page
        .filter(m => m.chatId === selectedChat._id)
        .sort((a, b) => a.createdAt - b.createdAt);
      setChatMessages(messages);
    }
  }, [selectedChat, allMessages]);

  // Loading state
  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!user || !ADMIN_USER_IDS.includes(user.id)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have permission to access the admin dashboard.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Error handling
  if (!stats || !allChats || !allMessages) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Dashboard</h1>
          <p className="text-gray-600 mb-6">Please wait while we load the admin dashboard...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatContent = (content: string) => {
    return content.replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  };

  const openChatInterface = (chat: any) => {
    setSelectedChat(chat);
    setShowChatInterface(true);
  };

  const closeChatInterface = () => {
    setShowChatInterface(false);
    setSelectedChat(null);
    setChatMessages([]);
  };

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }: { title: string; value: number; icon: any; color?: string }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <Icon className={`w-8 h-8 text-${color}-500`} />
      </div>
    </div>
  );

  const ChatMessage = ({ message }: { message: any }) => (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          message.role === 'user' ? 'bg-blue-500 ml-2' : 'bg-gray-500 mr-2'
        }`}>
          {message.role === 'user' ? (
            message.imageUrl ? (
              <img 
                src={message.imageUrl} 
                alt="User avatar" 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4 text-white" />
            )
          ) : (
            <Bot className="w-4 h-4 text-white" />
          )}
        </div>
        <div className={`rounded-lg px-4 py-2 ${
          message.role === 'user' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-800'
        }`}>
          <div className="text-xs opacity-75 mb-1 flex items-center justify-between">
            <span>
              {message.role === 'user' && (message.username || message.email) ? (
                <span className="font-medium">
                  {message.username || `${message.firstName} ${message.lastName}`.trim() || message.email}
                </span>
              ) : ( 
                <span>Assistant</span>
              )}
            </span>
            <span>{formatDate(message.createdAt)}</span>
          </div>
          <div className="whitespace-pre-wrap break-words">
            {formatContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  );

  const ChatInterface = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold">{selectedChat?.title || 'Chat Conversation'}</h3>
              <div className="text-sm text-gray-600 flex items-center space-x-2">
                {selectedChat?.imageUrl && (
                  <img 
                    src={selectedChat.imageUrl} 
                    alt="User avatar" 
                    className="w-5 h-5 rounded-full object-cover"
                  />
                )}
                <span>
                  {selectedChat?.username || `${selectedChat?.firstName} ${selectedChat?.lastName}`.trim() || 'Unknown User'}
                </span>
                {selectedChat?.email && (
                  <span className="text-gray-500">({selectedChat.email})</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={closeChatInterface}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No messages in this conversation</p>
              </div>
            </div>
          ) : (
            chatMessages.map((message) => (
              <ChatMessage key={message._id} message={message} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Created: {formatDate(selectedChat?.createdAt || Date.now())}</span>
            <span>{chatMessages.length} messages</span>
          </div>
        </div>
      </div>
    </div>
  );

  const ChatsTable = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">All Conversations</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(searchTerm.length > 2 && searchResults ? searchResults.chats : allChats.page).map((chat: any) => {
                const messageCount = allMessages.page.filter(m => m.chatId === chat._id).length;
                return (
                  <tr key={chat._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MessageSquare className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {chat.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 mr-3">
                          {chat.imageUrl ? (
                            <img 
                              src={chat.imageUrl} 
                              alt="User avatar" 
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {chat.username || `${chat.firstName} ${chat.lastName}`.trim() || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500 font-mono truncate max-w-xs">
                            {chat.email || chat.userId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {messageCount} messages
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(chat.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openChatInterface(chat)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Chat</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search Results Summary */}
      {searchTerm.length > 2 && searchResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">
              Found {searchResults.chats.length} conversations and {searchResults.messages.length} messages
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Chats" value={stats.totalChats} icon={MessageSquare} />
        <StatCard title="Total Messages" value={stats.totalMessages} icon={Activity} />
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard 
          title="Avg Messages/Chat" 
          value={stats.totalChats > 0 ? Math.round(stats.totalMessages / stats.totalChats) : 0} 
          icon={TrendingUp} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Daily Activity
          </h3>
          <div className="space-y-2">
            {stats.dailyActivity.map((day, index) => (
              <div key={index} className="flex items-center">
                <span className="text-sm text-gray-600 w-24">{day.date}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 ml-4">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${Math.min((day.count / Math.max(...stats.dailyActivity.map(d => d.count))) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-800 ml-2 w-8">{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Message Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">User Messages</span>
              <span className="text-sm font-medium">{stats.messageStats.userMessages}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Assistant Messages</span>
              <span className="text-sm font-medium">{stats.messageStats.assistantMessages}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Messages</span>
                <span className="text-sm font-bold">{stats.totalMessages}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Top Users by Chat Count</h3>
        <div className="space-y-2">
          {Object.entries(stats.userStats || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([userId, count]) => {
              // Find user info from chats
              const userChat = allChats.page.find(chat => chat.userId === userId);
              const displayName = userChat ? 
                (userChat.username || `${userChat.firstName} ${userChat.lastName}`.trim() || userChat.email || userId) : 
                userId;
              
              return (
                <div key={userId} className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8">
                      {userChat?.imageUrl ? (
                        <img 
                          src={userChat.imageUrl} 
                          alt="User avatar" 
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
                      {userChat?.email && (
                        <span className="text-xs text-gray-500 truncate">{userChat.email}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium">{count} chats</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  const renderUsers = () => {
    // Get unique users with their info from chats
    const uniqueUsers = allChats.page.reduce((acc, chat) => {
      if (!acc[chat.userId]) {
        acc[chat.userId] = {
          userId: chat.userId,
          username: chat.username,
          firstName: chat.firstName,
          lastName: chat.lastName,
          email: chat.email,
          imageUrl: chat.imageUrl,
          chatCount: 0
        };
      }
      acc[chat.userId].chatCount++;
      return acc;
    }, {} as Record<string, any>);

    // Filter users based on search term
    const filteredUsers = Object.values(uniqueUsers).filter((user: any) => {
      if (!selectedUser) return true;
      const searchLower = selectedUser.toLowerCase();
      return (
        user.userId.toLowerCase().includes(searchLower) ||
        (user.username && user.username.toLowerCase().includes(searchLower)) ||
        (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      );
    });

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">User Activity</h2>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            />
            <button
              onClick={() => setSelectedUser('')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">All Users ({filteredUsers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user: any) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 mr-3">
                          {user.imageUrl ? (
                            <img 
                              src={user.imageUrl} 
                              alt="User avatar" 
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.username || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email || user.userId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.chatCount} chats
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedUser(user.userId)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors"
                      >
                        View Activity
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Activity Details */}
        {selectedUser && userActivity && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{userActivity.totalChats}</p>
                  <p className="text-sm text-gray-600">Total Chats</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{userActivity.totalMessages}</p>
                  <p className="text-sm text-gray-600">Total Messages</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {userActivity.totalChats > 0 ? Math.round(userActivity.totalMessages / userActivity.totalChats) : 0}
                  </p>
                  <p className="text-sm text-gray-600">Avg Messages/Chat</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Recent Chats</h3>
                <div className="space-y-2">
                  {userActivity.chats.map((chat) => (
                    <div key={chat._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{chat.title}</p>
                        <p className="text-sm text-gray-600">{chat.messageCount} messages</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-500">{formatDate(chat.lastActivity)}</p>
                        <button
                          onClick={() => openChatInterface(chat)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.firstName}</span>
              <span className="text-sm text-gray-600">Last updated: {formatDate(Date.now())}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'chats', label: 'Conversations', icon: MessageSquare },
              { key: 'users', label: 'Users', icon: Users },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'chats' && <ChatsTable />}
        {activeTab === 'users' && renderUsers()}
      </div>

      {/* Chat Interface Modal */}
      {showChatInterface && <ChatInterface />}
    </div>
  );
};

export default AdminPage;
