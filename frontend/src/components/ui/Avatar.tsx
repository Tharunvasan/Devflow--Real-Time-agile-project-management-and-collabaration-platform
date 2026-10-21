import React from 'react';
import type { User } from '../../types';

interface AvatarProps {
  user?: User;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const colors = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-red-600',
  'bg-yellow-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
];

function getColor(name: string) {
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className = '' }) => {
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const color = user?.name ? getColor(user.name) : 'bg-dark-600';

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-dark-700 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-semibold text-white ring-2 ring-dark-700 flex-shrink-0 ${className}`}>
      {initials}
    </div>
  );
};
