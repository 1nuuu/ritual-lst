import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";
import { ScrollMagic } from "@/components/ScrollMagic";

export default function Home() {
  return (
    <>
      <ScrollMagic />
      <Nav />
      <Hero />
      <hr className="section-divider" />
      <HowItWorks />
      <Footer />
    </>
  );
}
