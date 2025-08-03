import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to practice interface
  redirect('/practice');
}
