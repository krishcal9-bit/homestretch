import { FamilyHeader } from '@/components/FamilyHeader';
import { Flow } from '@/components/flow/Flow';

export default function StartPage() {
  return (
    <>
      <FamilyHeader />
      <main id="main" className="mx-auto max-w-[560px] px-5 pb-16">
        <Flow />
      </main>
    </>
  );
}
