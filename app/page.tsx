import { FamilyHeader } from '@/components/FamilyHeader';
import { Landing } from '@/components/landing/Landing';

export default function Home() {
  return (
    <>
      <FamilyHeader variant="landing" />
      <main id="main">
        <Landing />
      </main>
    </>
  );
}
