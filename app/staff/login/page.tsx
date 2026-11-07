import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/staff/LoginForm';

export const metadata: Metadata = { title: 'Staff sign in · HomeStretch' };

export default function StaffLogin() {
  return (
    <main className="min-h-screen bg-paper px-8 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
