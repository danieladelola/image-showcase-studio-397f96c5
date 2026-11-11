import { ArrowRight, Building2, MapPin, Eye, Factory, Home, Layers, Lightbulb, ShieldCheck, Smile, Target, FileText, MessageCircle, Phone, Handshake, Leaf, Newspaper, PlugZap, Sun, Wrench } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageFrame, PageHero } from "@/components/site-layout";
import productsHero from "@/assets/products-hero-system.jpg";
import newsHero from "@/assets/news-hero-rooftop.jpg";
import { QuoteForm } from "@/components/quote-form";
import { ProductShop } from "@/components/product-shop";
import { POST_CATEGORIES, categoryLabel, type PostCategory, type PostSummary } from "@/lib/post-types";
import impactHero from "@/assets/impact-family-living-room-clean.jpg";
import impactHomework from "@/assets/impact-family-homework.jpg";
import impactDinner from "@/assets/impact-family-dinner.jpg";
import impactKitchen from "@/assets/impact-family-kitchen-clean.jpg";
import impactPorch from "@/assets/impact-family-porch.jpg";
import teamPhotoSrc from "@/assets/ruwata-field-team.png";
const teamPhoto = { url: teamPhotoSrc };
import portraitPhotoSrc from "@/assets/ruwata-solar-technician.png";
const portraitPhoto = { url: portraitPhotoSrc };
import productPhotoSrc from "@/assets/ruwata-installation-team.webp";
const productPhoto = { url: productPhotoSrc };
import aboutHeroPhotoSrc from "@/assets/ruwata-about-hero.png";
const aboutHeroPhoto = { url: aboutHeroPhotoSrc };


const systemOptions = ["2.5 kVA", "10 kVA", "20 kVA", "30 kVA"];

const impactMoments = [
  { image: impactHomework, title: "Homework after dark", text: "Steady light means children can keep reading and learning long after sunset." },
  { image: impactDinner, title: "Dinner together", text: "Family meals stay bright and comfortable, without the noise of a generator." },
  { image: impactKitchen, title: "A working kitchen", text: "Fans, fridges, and appliances keep running when grid power is uncertain." },
  { image: impactPorch, title: "A home that glows", text: "Solar on the roof, lights on inside — energy the whole household can count on." },
];

const impactBenefits = [
  { Icon: Lightbulb, title: "Light when it matters", text: "Keep essential lighting on through evenings and outages." },
  { Icon: PlugZap, title: "Appliances keep running", text: "Power fans, fridges, TVs, and devices the household relies on." },
  { Icon: Leaf, title: "Less generator dependence", text: "Reduce reliance on fuel, noise, and fumes at home and at work." },
  { Icon: Smile, title: "More peace of mind", text: "Greater control over your electricity supply, day and night." },
];

export function ImpactPage() {
  return (
    <PageFrame>
      <section className="about-hero">
        <img src={impactHero} alt="Happy family relaxing together in a brightly lit living room at night" className="about-hero-image" fetchPriority="high" width={1920} height={1088} />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="site-wrap about-hero-copy">
          <span className="eyebrow eyebrow-plain text-amber">Our Impact</span>
          <h1 className="about-hero-title">Power that helps daily life keep moving.</h1>
          <p className="about-hero-description max-w-2xl">Solar can help keep essential appliances running and reduce dependence on generators. RUWATA starts with what a customer needs and plans a complete system around it — and supplies the ACs, freezers, TVs, generators, pumping machines and solar generators homes rely on.</p>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="mx-auto mb-12 grid max-w-2xl justify-items-center gap-4 text-center">
            <span className="eyebrow eyebrow-plain">What reliable power changes</span>
            <h2 className="section-heading">More light. More living.</h2>
            <p className="text-lead">Reliable electricity shows up in the small, everyday moments that make a house feel like home.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {impactBenefits.map(({ Icon, title, text }) => (
              <article key={title} className="about-card group">
                <span className="grid size-12 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-primary-foreground"><Icon aria-hidden="true" className="size-6" /></span>
                <h3 className="mt-6 font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-card pt-0">
        <div className="site-wrap">
          <div className="mb-12 grid gap-4 lg:grid-cols-2 lg:items-end">
            <div className="grid gap-4">
              <span className="eyebrow eyebrow-plain">Everyday moments</span>
              <h2 className="section-heading">Life, lit up.</h2>
            </div>
            <p className="text-lead lg:max-w-md lg:justify-self-end">From homework to dinner time, dependable solar power gives families more of the evenings they enjoy.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {impactMoments.map(({ image, title, text }) => (
              <article key={title} className="home-product group min-h-[24rem]">
                <img src={image} alt={title} className="home-product-image" loading="lazy" width={1280} height={960} />
                <div className="home-product-shade" aria-hidden="true" />
                <div className="relative mt-auto grid gap-2 p-7">
                  <h3 className="font-heading text-2xl font-semibold">{title}</h3>
                  <p className="max-w-md text-sm leading-6 text-primary-foreground/80">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-purpose-band">
        <div className="site-wrap grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="grid justify-items-start gap-5">
            <span className="eyebrow eyebrow-plain text-amber">Measured, not assumed</span>
            <h2 className="section-heading text-primary-foreground">Every project should tell its own story.</h2>
            <p className="max-w-xl text-base leading-8 text-primary-foreground/75">System performance and customer outcomes vary. Future project profiles will include the customer’s challenge, system size, installation photos, and measured results where those details are available.</p>
          </div>
          <div className="about-pillar">
            <span className="grid size-12 place-items-center rounded-xl bg-amber text-brand-deep"><Sun aria-hidden="true" className="size-6" /></span>
            <h3 className="mt-6 font-heading text-xl font-semibold">Project profiles are being prepared.</h3>
            <p className="mt-2 text-sm leading-7 text-primary-foreground/75">Verified results and customer testimonials will be shared when available.</p>
          </div>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="home-cta">
            <div className="grid content-center justify-items-start gap-5 p-8 sm:p-12 lg:p-16">
              <span className="eyebrow eyebrow-plain text-amber">Your home, powered</span>
              <h2 className="section-heading text-primary-foreground">Ready to bring reliable light home?</h2>
              <p className="max-w-lg text-base leading-8 text-primary-foreground/75">Tell us what you need to power and we’ll help you find the right solar system for your home or business.</p>
              <Button asChild className="mt-2 h-12 rounded-full px-7 font-bold"><Link to="/contact-us">Request a Solar Quote <ArrowRight aria-hidden="true" /></Link></Button>
            </div>
            <img src={impactPorch} alt="Smiling family outside their solar-powered home at dusk" loading="lazy" className="h-full min-h-72 w-full object-cover" width={1280} height={960} />
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

const aboutHighlights = [
  { Icon: Factory, label: "Factory-direct products" },
  { Icon: Home, label: "Homes & apartments" },
  { Icon: Building2, label: "Offices & businesses" },
  { Icon: Layers, label: "Complete power systems" },
];

const aboutPillars = [
  { Icon: Target, title: "Our Mission", text: "To empower homes and businesses with reliable, efficient, and affordable solar energy solutions that promote greater energy independence." },
  { Icon: Eye, title: "Our Vision", text: "To become a leading and trusted provider of quality solar energy products and complete power solutions for residential and commercial customers." },
  { Icon: ShieldCheck, title: "Our Commitment", text: "We are committed to quality, transparency, customer satisfaction, and helping customers make informed energy decisions." },
];

const aboutReasons = [
  { Icon: Factory, title: "Factory-Direct Sourcing", text: "We source products directly from factories to deliver quality equipment and competitive value." },
  { Icon: Building2, title: "Solutions for Every Scale", text: "From a single apartment to a large business facility, we offer solar products suited to different electricity requirements." },
  { Icon: Layers, title: "Complete Solar Packages", text: "Get compatible solar equipment and complete system options from one trusted source." },
  { Icon: Lightbulb, title: "Professional Product Guidance", text: "We help customers understand their electricity needs and identify suitable solar products." },
  { Icon: Smile, title: "Customer Satisfaction", text: "Our priority is helping every customer make a confident and informed purchasing decision." },
  { Icon: Sun, title: "Ready When You Are", text: "Share your power requirements and our team will help you explore suitable options." },
];

const aboutFaqs = [
  ["What does Ruwata offer?", "We provide factory-direct solar products and complete solar energy systems for residential and commercial customers. We also sell air conditioners, freezers, TVs, generators, pumping machines and solar generators."],
  ["Do you sell air conditioners, freezers, TVs and generators?", "Yes. Alongside solar equipment, you can buy air conditioners, chest freezers, smart TVs, petrol generators, pumping machines and solar generators in our shop with Add to Cart or Buy Now."],
  ["Can I buy a complete solar system?", "Yes. We offer complete solar packages with suitable components based on your energy requirements."],
  ["Are your products factory-direct?", "Yes. Our solar equipment is sourced directly from factories."],
  ["Do you supply solar products for businesses?", "Yes. Our solutions serve small businesses, offices, and larger commercial establishments."],
  ["Can you help me choose the right solar capacity?", "Yes. We can guide you in selecting suitable solar products based on the appliances and equipment you need to power."],
  ["Can solar power work at night?", "Yes. Solar systems with appropriate battery storage can supply electricity at night, depending on battery capacity and electricity usage."],
  ["Do your products come with a warranty?", "Applicable warranty terms depend on the product and will be communicated before purchase."],
  ["How do I request a quotation?", "Contact us through our website or WhatsApp with your power requirements."],
];

export function AboutPage() {
  return (
    <PageFrame>
      <section className="about-hero">
        <img src={aboutHeroPhoto.url} alt="RUWATA solar team" className="about-hero-image" fetchPriority="high" />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="site-wrap about-hero-copy">
          <span className="eyebrow eyebrow-plain text-primary-foreground">About RUWATA</span>
          <h1 className="about-hero-title">Your Trusted Partner in Solar Energy Solutions</h1>
          <p className="about-hero-description">Quality energy. Greater confidence.</p>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <img src={teamPhoto.url} alt="RUWATA solar team working with solar panels" className="aspect-[4/5] w-full rounded-2xl object-cover shadow-xl" loading="lazy" />
            <div className="about-badge">
              <span className="grid size-11 place-items-center rounded-full bg-brand text-primary-foreground"><Sun aria-hidden="true" className="size-5" /></span>
              <div><p className="font-heading text-base font-bold">Factory-direct</p><p className="text-xs text-muted-foreground">Quality solar equipment</p></div>
            </div>
          </div>
          <div className="grid content-start justify-items-start gap-5">
            <span className="eyebrow eyebrow-plain">Who we are</span>
            <h2 className="section-heading">Reliable electricity belongs in everyday life.</h2>
            <p className="text-lead">At Ruwata, we believe reliable electricity is essential to comfortable living, business growth, and everyday productivity. We are a solar energy solutions company dedicated to providing quality, factory-direct solar products and complete power systems for residential and commercial customers, alongside air conditioners, freezers, TVs, generators, pumping machines and solar generators.</p>
            <p className="text-lead">Every customer has unique electricity needs. That is why we help you identify suitable solar panels, inverters, batteries, and other essential components — and by sourcing directly from factories, we make dependable solar technology more accessible at competitive value.</p>
            <ul className="mt-2 grid w-full gap-3 sm:grid-cols-2">
              {aboutHighlights.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-semibold">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-brand" />{label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="about-purpose-band">
        <div className="site-wrap">
          <div className="mx-auto mb-12 grid max-w-2xl justify-items-center gap-4 text-center">
            <span className="eyebrow eyebrow-plain text-amber">What guides us</span>
            <h2 className="section-heading text-primary-foreground">A more dependable energy future.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {aboutPillars.map(({ Icon, title, text }) => (
              <article key={title} className="about-pillar">
                <span className="grid size-12 place-items-center rounded-xl bg-amber text-brand-deep"><Icon aria-hidden="true" className="size-6" /></span>
                <h3 className="mt-6 font-heading text-2xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-primary-foreground/75">{text}</p>
              </article>
            ))}
          </div>
          <blockquote className="mx-auto mt-14 max-w-3xl text-center">
            <p className="font-heading text-xl leading-9 text-primary-foreground sm:text-2xl">“At Ruwata, we are not simply supplying solar products. We are helping people and businesses build a more dependable energy future.”</p>
            <footer className="mt-5 font-heading text-sm font-bold uppercase tracking-widest text-amber">RUWATA — Quality Energy. Greater Confidence.</footer>
          </blockquote>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="mx-auto mb-12 grid max-w-3xl justify-items-center gap-4 text-center">
            <span className="eyebrow eyebrow-plain">Why Ruwata?</span>
            <h2 className="section-heading">More Than Products. A Smarter Way to Power Your World.</h2>
            <p className="text-lead">Choosing the right solar energy system is an important investment. We believe customers deserve clear information, quality equipment, competitive pricing, and dependable customer service.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {aboutReasons.map(({ Icon, title, text }) => (
              <article key={title} className="about-card group">
                <span className="grid size-12 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-primary-foreground"><Icon aria-hidden="true" className="size-6" /></span>
                <h3 className="mt-5 font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Button asChild className="h-12 px-6 font-bold"><Link to="/contact-us">CHOOSE RUWATA TODAY <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="section-space border-t border-border bg-card">
        <div className="site-wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="grid content-start justify-items-start gap-4 lg:sticky lg:top-28 lg:self-start">
            <span className="eyebrow eyebrow-plain">Frequently asked questions</span>
            <h2 className="section-heading">Good questions lead to better energy decisions.</h2>
            <p className="text-lead">Here are a few things customers often ask us about solar products and systems.</p>
          </div>
          <div className="faq-list">
            {aboutFaqs.map(([question, answer]) => (
              <details key={question} className="faq-item"><summary>{question}</summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="about-quote-band">
        <div className="site-wrap about-quote-content">
          <div className="grid gap-4">
            <span className="eyebrow eyebrow-plain text-primary-foreground">Your solar journey starts here</span>
            <h2 className="section-heading text-primary-foreground">Let’s find the right power solution for you.</h2>
          </div>
          <Button asChild variant="secondary" className="h-12 px-6 font-bold"><Link to="/contact-us">GET A SOLAR QUOTE <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>
    </PageFrame>
  );
}

const sizingSteps = [
  { title: "Tell us what you power", text: "Share the appliances and equipment you want to run, and for how long." },
  { title: "We size your system", text: "Our team recommends panels, inverter, and battery capacity to match." },
  { title: "Installed and ready", text: "Your complete system is supplied factory-direct and professionally installed." },
];

export function ProductsPage() {
  return (
    <PageFrame>
      <section className="about-hero">
        <img src={productsHero} alt="Wall-mounted solar inverter and battery storage in a bright room" className="about-hero-image" fetchPriority="high" width={1920} height={1088} />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="site-wrap about-hero-copy">
          <span className="eyebrow eyebrow-plain text-amber">Our Products</span>
          <h1 className="about-hero-title">The right system starts with what you need to power.</h1>
          <p className="about-hero-description max-w-2xl">RUWATA supplies complete solar systems and the equipment that brings them together, plus air conditioners, freezers, TVs, generators, pumping machines and solar generators. System size depends on your power needs, not a one-size-fits-all runtime or promise.</p>
        </div>
      </section>

      <ProductShop />

      <section className="about-purpose-band">
        <div className="site-wrap grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="grid justify-items-start gap-5">
            <span className="eyebrow eyebrow-plain text-amber">System options</span>
            <h2 className="section-heading text-primary-foreground">Explore a starting size.</h2>
            <p className="max-w-xl text-base leading-8 text-primary-foreground/75">System options include 2.5 kVA, 10 kVA, 20 kVA, and 30 kVA, with larger systems available based on project requirements.</p>
            <p className="max-w-xl text-base leading-8 text-primary-foreground/75">The right system depends on what you need to power and for how long. Our team can help size your system around those needs.</p>
            <Button asChild className="mt-2 h-12 px-7 font-bold"><Link to="/contact-us">Find the right size <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {systemOptions.map((option) => (
              <div key={option} className="about-pillar grid min-h-36 content-center justify-items-center gap-2 text-center">
                <span className="font-heading text-4xl font-semibold text-amber">{option}</span>
                <span className="text-sm text-primary-foreground/70">System option</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="mx-auto mb-12 grid max-w-2xl justify-items-center gap-4 text-center">
            <span className="eyebrow eyebrow-plain">How it works</span>
            <h2 className="section-heading">From your needs to a working system.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {sizingSteps.map((step, index) => (
              <article key={step.title} className="about-card">
                <span className="font-heading text-4xl font-semibold text-brand">0{index + 1}</span>
                <h3 className="mt-5 font-heading text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

const newsTopicImages: Record<PostCategory, { image: string; alt: string; text: string }> = {
  guides: { image: productPhoto.url, alt: "RUWATA installer working on solar panels", text: "Understand your options and size a solar system." },
  company: { image: aboutHeroPhoto.url, alt: "RUWATA team member showing a customer a portable solar panel", text: "News and announcements from the RUWATA team." },
  projects: { image: impactPorch, alt: "Family outside their solar-powered home at dusk", text: "Installation stories with verified project information." },
};

const newsDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function PostCard({ post, large }: { post: PostSummary; large?: boolean }) {
  const fallback = newsTopicImages[post.category];
  return (
    <article className={`group grid content-start overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${large ? "md:col-span-2 lg:grid-cols-2" : ""}`}>
      <Link to="/news/$slug" params={{ slug: post.slug }} className="overflow-hidden" tabIndex={-1} aria-hidden="true">
        <img src={post.coverImage?.url ?? fallback.image} alt="" className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${large ? "aspect-[4/3] h-full lg:aspect-auto" : "aspect-[4/3]"}`} loading="lazy" />
      </Link>
      <div className={`grid content-start gap-3 ${large ? "p-6 lg:p-10" : "p-6"}`}>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand"><Newspaper aria-hidden="true" className="size-4" />{categoryLabel(post.category)}</span>
        <h3 className={`font-heading font-bold leading-snug text-foreground ${large ? "text-2xl lg:text-3xl" : "text-lg"}`}>
          <Link to="/news/$slug" params={{ slug: post.slug }} className="hover:text-brand">{post.title}</Link>
        </h3>
        {post.excerpt && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>}
        <span className="mt-2 border-t border-border pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {post.publishedAt ? newsDate.format(new Date(post.publishedAt)) : ""} · {post.readingMinutes} min read
        </span>
      </div>
    </article>
  );
}

export function NewsPage({ posts, category }: { posts: PostSummary[]; category?: PostCategory | undefined }) {
  return (
    <PageFrame>
      <section className="about-hero">
        <img src={newsHero} alt="Solar technician on a Lagos rooftop beside solar panels at sunset" className="about-hero-image" fetchPriority="high" width={1920} height={1088} />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="site-wrap about-hero-copy">
          <span className="eyebrow eyebrow-plain text-amber">News &amp; Insights</span>
          <h1 className="about-hero-title">Ideas and updates from RUWATA.</h1>
          <p className="about-hero-description max-w-2xl">Practical solar guides, company updates, and project stories from our team.</p>
        </div>
      </section>

      <section id="topics" className="section-space scroll-mt-20 bg-card">
        <div className="site-wrap">
          <div className="mb-10 grid gap-6 lg:grid-cols-2 lg:items-end">
            <div className="grid gap-4">
              <span className="eyebrow eyebrow-plain">Latest articles</span>
              <h2 className="section-heading">News, guides, and project stories.</h2>
            </div>
            <nav aria-label="Filter by category" className="flex flex-wrap gap-2 lg:justify-self-end">
              <Link to="/news" search={{}} className="news-chip" data-active={!category || undefined}>All</Link>
              {POST_CATEGORIES.map((c) => (
                <Link key={c.key} to="/news" search={{ category: c.key }} className="news-chip" data-active={category === c.key || undefined}>{c.label}</Link>
              ))}
            </nav>
          </div>
          {posts.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {POST_CATEGORIES.map(({ key, label }) => {
                const t = newsTopicImages[key];
                return (
                  <article key={key} className="grid content-start overflow-hidden rounded-2xl border border-border bg-card">
                    <img src={t.image} alt={t.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    <div className="grid gap-3 p-6">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand"><Newspaper aria-hidden="true" className="size-4" />{label}</span>
                      <p className="text-sm leading-6 text-muted-foreground">{t.text}</p>
                      <span className="mt-2 border-t border-border pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Articles coming soon</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="about-purpose-band">
        <div className="site-wrap grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="grid justify-items-start gap-4">
            <span className="eyebrow eyebrow-plain text-amber">Have a question?</span>
            <h2 className="section-heading text-primary-foreground">Can’t wait for the next guide?</h2>
            <p className="max-w-lg text-base leading-8 text-primary-foreground/75">Tell us what you want to power and our team will help you explore suitable solar options today.</p>
          </div>
          <Button asChild className="h-12 w-fit rounded-full px-7 font-bold lg:justify-self-end"><Link to="/contact-us">Request a Solar Quote <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>
    </PageFrame>
  );
}


export function ContactPage() {
  return (
    <PageFrame>
      <section className="about-hero">
        <img src={productPhoto.url} alt="RUWATA installer working on solar panels" className="about-hero-image" fetchPriority="high" />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="site-wrap about-hero-copy">
          <span className="eyebrow eyebrow-plain text-primary-foreground">Contact Us</span>
          <h1 className="about-hero-title">Let’s Power Your Home or Business</h1>
          <p className="about-hero-description">Looking for quality solar panels, inverters, batteries, a complete solar power system, or an AC, freezer, TV or generator? Ruwata is ready to help you find a solution that fits your energy requirements and budget.</p>
        </div>
      </section>
      <section id="quote-form" className="section-space scroll-mt-20 bg-card">
        <div className="site-wrap split-section items-start">
          <div className="grid content-start justify-items-start gap-5">
            <span className="eyebrow eyebrow-plain">Request a Quote</span>
            <h2 className="section-heading">Tell us about your energy needs.</h2>
            <p className="text-lead">Provide your name, contact details, location, property type, energy requirements, and preferred budget.</p>
            <p className="text-lead">Our team will help you explore suitable options.</p>
            <div className="mt-2 grid gap-4 border-t border-border pt-5 text-sm">
              <p className="flex items-center gap-3"><Sun aria-hidden="true" className="size-5 shrink-0 text-brand" />Solar panels, inverters, batteries, and complete systems</p>
              <p className="flex items-center gap-3"><PlugZap aria-hidden="true" className="size-5 shrink-0 text-brand" />Air conditioners, freezers, TVs, generators, pumping machines, and solar generators</p>
              <p className="flex items-center gap-3"><Building2 aria-hidden="true" className="size-5 text-brand" />Homes, apartments, offices, and businesses</p>
            </div>
            <div className="mt-4 grid w-full gap-4">
              <p className="flex items-center gap-3 font-heading text-base font-semibold"><MapPin aria-hidden="true" className="size-5 shrink-0 text-brand" />17 Toyin Street, Ikeja, Lagos</p>
              <iframe
                title="Map showing RUWATA at 17 Toyin Street, Ikeja, Lagos"
                src="https://maps.google.com/maps?q=17%20Toyin%20Street%2C%20Ikeja%2C%20Lagos&z=16&output=embed"
                className="aspect-[16/10] w-full rounded-xl border border-border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
          <div className="w-full min-w-0 border border-border bg-background p-5 sm:p-8"><QuoteForm /></div>
        </div>
      </section>
      <section className="dark-band py-14 text-center">
        <p className="font-heading text-2xl font-bold sm:text-3xl">RUWATA — <span className="text-brand">Powering Your World.</span></p>
      </section>
    </PageFrame>
  );
}
