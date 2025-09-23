import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to conversation interface (Clara system)
  redirect('/conversation');
}
