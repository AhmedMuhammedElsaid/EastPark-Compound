import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register Your Unit',
  description: 'Register your EastPark unit to receive your resident app invitation after verification.',
  alternates: { canonical: '/register-unit' },
  openGraph: {
    title: 'Register Your EastPark Unit',
    description: 'Join the EastPark resident platform by registering your compound unit.',
    url: '/register-unit',
  },
};

export default function RegisterUnitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
