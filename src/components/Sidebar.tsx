'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Image as ImageIcon, Settings, LogOut, Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { APP_NAME } from '@/config/brand';

const NAV_ITEMS = [
  { href: '/',          label: 'Estúdio de Criação', icon: LayoutGrid },
  { href: '/gallery',   label: 'Minha Galeria',       icon: ImageIcon  },
  { href: '/settings',  label: 'Conta e Cota',        icon: Settings   },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen fixed left-0 top-0 border-r border-slate-800 z-50">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-black text-lg tracking-tight">{APP_NAME}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors',
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400 font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-medium text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair da Conta
        </button>
      </div>
    </aside>
  );
}
