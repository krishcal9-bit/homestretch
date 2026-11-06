import { FamilyHeader } from '@/components/FamilyHeader';
import { Welcome } from '@/components/flow/Welcome';

export default function Home() {
  return (
    <>
      <FamilyHeader />
      <main id="main" className="mx-auto max-w-[560px] px-5 pb-16">
        <Welcome />
      </main>
    </>
  );
}
