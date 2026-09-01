import RootSessionBootstrap from '@/components/RootSessionBootstrap';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus homepage — Marketing redesign (paper + serif, identity-first)
// ─────────────────────────────────────────────────────────────────────────────

import NavBar from './_components/NavBar';
import HeroSection from './_components/HeroSection';
import ProblemSection from './_components/ProblemSection';
import PrimitiveSection from './_components/PrimitiveSection';
import UnlocksSection from './_components/UnlocksSection';
import CeremonialSection from './_components/CeremonialSection';
import PillarsSection from './_components/PillarsSection';
import StripesSection from './_components/StripesSection';
import FrameSection from './_components/FrameSection';
import FinalCTASection from './_components/FinalCTASection';
import FooterSection from './_components/FooterSection';
import MarketingReveal from './_components/MarketingReveal';

export default function HomePage() {
  return (
    <div className="marketing-home min-h-screen overflow-x-hidden">
      <RootSessionBootstrap />
      <MarketingReveal />

      <NavBar />
      <HeroSection />
      <ProblemSection />
      <PrimitiveSection />
      <UnlocksSection />
      <CeremonialSection />
      <PillarsSection />
      <StripesSection />
      <FrameSection />
      <FinalCTASection />
      <FooterSection />
    </div>
  );
}
