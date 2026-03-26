export default function MartinDuarteWebsite() {
  const services = [
    {
      id: "service-assessment",
      title: "Data Architecture Assessment",
      subtitle: "Current Data Architecture Diagnosis",
      description:
        "Diagnóstico completo del ecosistema de datos para entender el estado actual de la arquitectura, sus riesgos y oportunidades de evolución.",
      bullets: [
        "Mapa de arquitectura actual",
        "Evaluación de pipelines y ETL",
        "Identificación de riesgos técnicos",
        "Análisis de costos cloud",
        "Roadmap inicial de evolución",
      ],
    },
    {
      id: "service-blueprint",
      title: "Enterprise Data Architecture Blueprint",
      subtitle: "Target Enterprise Data Architecture Design",
      description:
        "Diseño de la arquitectura objetivo alineada con las necesidades analíticas y de negocio de la organización.",
      bullets: [
        "Arquitectura lógica",
        "Arquitectura física",
        "Definición de componentes",
        "Modelo de datos",
        "Estándares de arquitectura",
      ],
    },
    {
      id: "service-strategy",
      title: "Data Platform Strategy",
      subtitle: "Enterprise Data Platform Strategy",
      description:
        "Definición estratégica de la plataforma de datos moderna incluyendo arquitectura, tecnologías y modelo operativo.",
      bullets: [
        "Diseño de plataforma",
        "Selección de tecnologías",
        "Arquitectura de integración",
        "Estrategia de ingestión de datos",
        "Modelo de operación",
      ],
    },
    {
      id: "service-modernization",
      title: "Data Platform Modernization Program",
      subtitle: "Data Platform Modernization",
      description:
        "Programa estructurado para evolucionar plataformas legacy hacia arquitecturas modernas basadas en cloud y lakehouse.",
      bullets: [
        "Estrategia de migración",
        "Arquitectura target",
        "Plan de modernización",
        "Roadmap de implementación",
      ],
    },
    {
      id: "service-fractional",
      title: "Fractional Enterprise Data Architect",
      subtitle: "Ongoing Architecture Leadership",
      description:
        "Liderazgo arquitectónico continuo para organizaciones que necesitan dirección estratégica en su ecosistema de datos.",
      bullets: [
        "Revisiones de arquitectura",
        "Mentoring de equipos",
        "Decisiones tecnológicas",
        "Roadmap evolutivo",
      ],
    },
  ];

  const insightCategories = [
    "Todos",
    "Data Architecture",
    "Cloud & Lakehouse",
    "Modernization",
    "LinkedIn Post",
  ];

  const featuredInsight = {
    type: "Artículo destacado",
    category: "Data Architecture",
    date: "Próximamente",
    title: "Cómo evaluar una arquitectura de datos antes de modernizar una plataforma",
    description:
      "Un espacio destacado para artículos de profundidad sobre assessment, arquitectura objetivo, riesgos, costos y evolución de plataformas de datos empresariales.",
    cta: "Leer artículo completo",
  };

  const latestLinkedInArticle = {
    type: "Último artículo de LinkedIn",
    category: "LinkedIn Article",
    date: "Próximamente",
    title: "Tu artículo más importante va a vivir acá",
    description:
      "Esta sección está pensada para destacar el artículo o publicación más relevante de LinkedIn y convertirlo en una pieza central de autoridad dentro de tu web.",
    cta: "Ver en LinkedIn",
    href: "https://www.linkedin.com/",
  };

  const insights = [
    {
      type: "Artículo",
      category: "Data Architecture",
      date: "Próximamente",
      title: "Cómo evaluar una arquitectura de datos antes de modernizar una plataforma",
      description:
        "Contenido de profundidad para ayudar a organizaciones a entender su arquitectura actual antes de iniciar una transformación.",
      cta: "Leer artículo",
    },
    {
      type: "Publicación",
      category: "LinkedIn Post",
      date: "Próximamente",
      title: "Reflexiones breves sobre modernización, cloud, lakehouse y estrategia de datos",
      description:
        "Espacio para compartir publicaciones ejecutivas, aprendizajes y puntos de vista sobre arquitectura de datos empresarial.",
      cta: "Ver publicación",
    },
    {
      type: "Artículo",
      category: "Cloud & Lakehouse",
      date: "Próximamente",
      title: "Buenas prácticas para diseñar plataformas de datos modernas",
      description:
        "Contenido orientado a líderes, arquitectos y equipos que necesitan claridad para diseñar plataformas escalables y preparadas para analítica avanzada.",
      cta: "Leer artículo",
    },
    {
      type: "Artículo",
      category: "Modernization",
      date: "Próximamente",
      title: "Cuándo modernizar un Data Warehouse y cuándo rediseñar la plataforma completa",
      description:
        "Una mirada estratégica para diferenciar mejoras incrementales de transformaciones arquitectónicas de mayor impacto.",
      cta: "Leer artículo",
    },
    {
      type: "Publicación",
      category: "LinkedIn Post",
      date: "Próximamente",
      title: "Señales de que tu ecosistema de datos necesita un architecture assessment",
      description:
        "Ideas concretas para identificar síntomas de complejidad, deuda técnica y falta de escalabilidad en plataformas de datos.",
      cta: "Ver publicación",
    },
  ];

  const processSteps = [
    {
      number: "01",
      title: "Diagnose the Current Architecture",
      service: "Data Architecture Assessment",
      href: "#service-assessment",
      description:
        "Analizar el ecosistema de datos existente, identificar riesgos técnicos, complejidad y oportunidades de mejora.",
    },
    {
      number: "02",
      title: "Define the Target Architecture",
      service: "Enterprise Data Architecture Blueprint",
      href: "#service-blueprint",
      description:
        "Diseñar la arquitectura lógica y física que guiará la evolución de la plataforma de datos.",
    },
    {
      number: "03",
      title: "Design the Data Platform Strategy",
      service: "Data Platform Strategy",
      href: "#service-strategy",
      description:
        "Definir tecnologías, arquitectura de integración y modelo operativo de la plataforma.",
    },
    {
      number: "04",
      title: "Plan the Modernization",
      service: "Data Platform Modernization Program",
      href: "#service-modernization",
      description:
        "Definir la estrategia de migración y el roadmap para evolucionar plataformas legacy.",
    },
    {
      number: "05",
      title: "Provide Continuous Architecture Leadership",
      service: "Fractional Enterprise Data Architect",
      href: "#service-fractional",
      description:
        "Acompañar la evolución de la plataforma con liderazgo arquitectónico continuo.",
    },
  ];

  const useCases = [
    {
      title: "Modernización de Data Warehouse",
      description:
        "Migración de arquitecturas legacy hacia plataformas cloud modernas basadas en Lakehouse o arquitecturas analíticas modernas.",
    },
    {
      title: "Arquitectura de Plataforma Lakehouse",
      description:
        "Diseño de plataformas modernas utilizando tecnologías como Databricks, Snowflake o arquitecturas lakehouse.",
    },
    {
      title: "Arquitectura de Datos en Cloud",
      description:
        "Diseño de arquitecturas escalables en AWS o Azure para soportar analítica avanzada y crecimiento del negocio.",
    },
    {
      title: "Optimización de Costos de Plataforma",
      description:
        "Análisis de arquitecturas existentes para optimizar costos cloud y mejorar eficiencia operativa.",
    },
    {
      title: "Arquitectura para Analítica Avanzada",
      description:
        "Diseño de plataformas preparadas para machine learning, inteligencia artificial y analítica avanzada.",
    },
  ];

  const SectionTitle = ({ eyebrow, title, description }) => (
    <div className="max-w-3xl">
      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-sky-300">{eyebrow}</p>
      <h2 className="text-4xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-4 text-lg text-slate-300">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1120] text-white scroll-smooth">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <div className="text-lg font-semibold">Martín Duarte</div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Enterprise Data Architect
            </div>
          </div>

          <nav className="hidden gap-10 text-sm text-slate-300 md:flex">
            <a href="#services">Servicios</a>
            <a href="#usecases">Casos de uso</a>
            <a href="#insights">Insights</a>
            <a href="#contact">Contacto</a>
          </nav>

          <a
            href="#contact"
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
          >
            Conversemos
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 py-28">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="max-w-4xl">
              <h1 className="text-6xl font-semibold leading-tight">Martín Duarte</h1>

              <p className="mt-4 text-2xl text-sky-300">Enterprise Data Architect</p>

              <p className="mt-6 text-2xl text-slate-300">
                Modern Data Platforms • Lakehouse • Cloud Architecture
              </p>

              <p className="mt-6 max-w-2xl text-lg text-slate-400">
                Soy Enterprise Data Architect especializado en el diseño de plataformas de datos modernas y arquitecturas cloud escalables.
                Ayudo a organizaciones a definir estrategias de plataforma, evolucionar ecosistemas legacy y construir arquitecturas de datos preparadas para analítica avanzada y crecimiento empresarial.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href="#services"
                  className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black"
                >
                  Ver servicios
                </a>

                <a
                  href="#contact"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm"
                >
                  Agendar conversación
                </a>

                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-sky-400/40 bg-sky-400/10 px-6 py-3 text-sm text-sky-300 transition hover:bg-sky-400/20"
                >
                  Saber más sobre mí
                </a>
              </div>
            </div>

            <div className="w-full">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop"
                alt="Placeholder profile"
                className="h-[420px] w-full rounded-3xl border border-white/10 object-cover shadow-xl"
              />
              <p className="mt-3 text-sm text-slate-500">
                Imagen de placeholder. Reemplazar luego por foto profesional.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24">
          <SectionTitle
            eyebrow="Architecture Journey"
            title="Cómo evoluciona una arquitectura de datos"
            description="Un marco visual que ilustra cómo cada servicio contribuye a un proceso continuo y estructurado de evolución de la arquitectura de datos empresarial."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {processSteps.map((step) => (
              <a
                key={step.number}
                href={step.href}
                className="group block rounded-3xl border border-white/10 bg-[#0f172a] p-8 transition hover:border-sky-400/40 hover:bg-[#12203a]"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-semibold text-sky-300">{step.number}</div>
                </div>

                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>

                <p className="mt-3 text-sm text-sky-300">{step.service}</p>

                <p className="mt-4 text-sm leading-relaxed text-slate-400">{step.description}</p>
              </a>
            ))}
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-6 py-24">
          <SectionTitle
            eyebrow="Servicios"
            title="Enterprise Data Architecture Services"
            description="Servicios de consultoría enfocados en evaluar, diseñar y evolucionar arquitecturas de datos empresariales."
          />

          <div className="mt-16 grid gap-10">
            {services.map((service) => (
              <div
                id={service.id}
                key={service.title}
                className="scroll-mt-28 rounded-3xl border border-white/10 bg-[#0f172a] p-10"
              >
                <div className="grid gap-10 lg:grid-cols-2">
                  <div>
                    <h3 className="mt-3 text-3xl font-semibold">{service.title}</h3>

                    <p className="mt-3 text-lg text-slate-300">{service.subtitle}</p>

                    <p className="mt-6 text-slate-400">{service.description}</p>
                  </div>

                  <div>
                    <ul className="space-y-3 text-slate-300">
                      {service.bullets.map((b) => (
                        <li key={b}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="usecases" className="mx-auto max-w-7xl px-6 py-24">
          <SectionTitle
            eyebrow="Casos de uso"
            title="Dónde genero valor"
            description="Situaciones típicas donde las organizaciones requieren liderazgo en arquitectura de datos."
          />

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {useCases.map((usecase) => (
              <div
                key={usecase.title}
                className="rounded-3xl border border-white/10 bg-[#0f172a] p-8"
              >
                <h3 className="text-xl font-semibold">{usecase.title}</h3>

                <p className="mt-4 text-slate-400">{usecase.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="insights" className="mx-auto max-w-7xl px-6 py-24">
          <SectionTitle
            eyebrow="Insights"
            title="Artículos y publicaciones"
            description="Artículos técnicos, reflexiones estratégicas y publicaciones recientes sobre arquitectura de datos, plataformas modernas y modernización cloud."
          />

          <div className="mt-16 space-y-10">
            <article className="rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-violet-500/10 p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em]">
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white">
                      {latestLinkedInArticle.type}
                    </span>
                    <span className="text-sky-300">{latestLinkedInArticle.category}</span>
                    <span className="text-slate-400">{latestLinkedInArticle.date}</span>
                  </div>

                  <h3 className="mt-6 max-w-3xl text-3xl font-semibold leading-snug lg:text-4xl">
                    {latestLinkedInArticle.title}
                  </h3>
                  <p className="mt-5 max-w-2xl text-slate-300">
                    {latestLinkedInArticle.description}
                  </p>

                  <div className="mt-8">
                    <a
                      href={latestLinkedInArticle.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      {latestLinkedInArticle.cta}
                    </a>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0f172a]/70 p-8">
                  <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Contenido</p>
                  <h3 className="mt-4 text-3xl font-semibold">Ideas y experiencia en arquitectura de datos</h3>
                  <p className="mt-5 text-slate-400">
                    En esta sección se publican artículos y publicaciones que comparto en LinkedIn
                    sobre arquitectura de datos empresarial, modernización de plataformas,
                    lakehouse, cloud y estrategia tecnológica.
                  </p>
                  <p className="mt-4 text-slate-400">
                    El objetivo es compartir aprendizajes reales de proyectos,
                    buenas prácticas de arquitectura y reflexiones sobre cómo evolucionan
                    las plataformas de datos en organizaciones modernas.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    {insightCategories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 p-10">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em]">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white">
                    {featuredInsight.type}
                  </span>
                  <span className="text-sky-300">{featuredInsight.category}</span>
                  <span className="text-slate-400">{featuredInsight.date}</span>
                </div>

                <h3 className="mt-6 max-w-2xl text-3xl font-semibold leading-snug">
                  {featuredInsight.title}
                </h3>
                <p className="mt-5 max-w-2xl text-slate-300">{featuredInsight.description}</p>

                <div className="mt-8">
                  <a
                    href="#"
                    className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    {featuredInsight.cta}
                  </a>
                </div>
              </article>

              <div>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h3 className="text-2xl font-semibold">Últimos contenidos</h3>
                  <span className="text-sm text-slate-400">Artículos y publicaciones</span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {insights.map((item) => (
                    <article
                      key={item.title}
                      className="rounded-3xl border border-white/10 bg-[#0f172a] p-8 transition hover:border-white/20"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                          {item.type}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-sky-300">{item.category}</span>
                      </div>

                      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{item.date}</p>
                      <h3 className="mt-4 text-2xl font-semibold leading-snug">{item.title}</h3>
                      <p className="mt-4 text-slate-400">{item.description}</p>

                      <div className="mt-8">
                        <a
                          href="#"
                          className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                        >
                          {item.cta}
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-6 py-28">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 p-16">
            <h2 className="text-4xl font-semibold">Conversemos sobre tu arquitectura de datos</h2>

            <p className="mt-4 max-w-2xl text-slate-300">
              Si tu organización está evaluando modernizar su plataforma de datos o necesita claridad arquitectónica, podemos comenzar con una conversación.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="mailto:contact@example.com"
                className="rounded-full bg-white px-6 py-3 text-black"
              >
                Agendar conversación
              </a>

              <a
                href="https://wa.me/5490000000000?text=Hola%20Mart%C3%ADn%2C%20vi%20tu%20p%C3%A1gina%20web%20y%20me%20gustar%C3%ADa%20conversar%20sobre%20arquitectura%20de%20datos%20para%20mi%20organizaci%C3%B3n."
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/20"
              >
                Contactar por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <a
          href="https://wa.me/5490000000000?text=Hola%20Mart%C3%ADn%2C%20vi%20tu%20p%C3%A1gina%20web%20y%20me%20gustar%C3%ADa%20conversar%20sobre%20arquitectura%20de%20datos%20para%20mi%20organizaci%C3%B3n."
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-500 px-5 py-3 text-sm font-medium text-white shadow-2xl shadow-emerald-900/30 transition hover:scale-[1.02] hover:bg-emerald-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M20.52 3.48A11.86 11.86 0 0012.02 0C5.39 0 .02 5.37.02 12c0 2.12.55 4.18 1.6 6.01L0 24l6.18-1.6A11.93 11.93 0 0012.02 24C18.65 24 24 18.63 24 12c0-3.2-1.25-6.21-3.48-8.52zM12.02 21.82c-1.8 0-3.56-.48-5.1-1.38l-.36-.21-3.67.95.98-3.58-.24-.37A9.77 9.77 0 012.25 12c0-5.39 4.38-9.77 9.77-9.77 2.61 0 5.06 1.02 6.9 2.86A9.72 9.72 0 0121.79 12c0 5.39-4.38 9.82-9.77 9.82zm5.37-7.37c-.29-.15-1.71-.84-1.97-.94-.26-.1-.45-.15-.64.15-.19.29-.74.94-.91 1.13-.17.19-.34.22-.63.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.55-.88-2.12-.23-.56-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 1-.1 2.43.9 1.43 1.57 2.2 3.59 3.78 2.02 1.58 3.34 1.78 3.9 1.67.56-.11 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.2-.55-.34z" />
          </svg>
          <span>WhatsApp</span>
        </a>
      </main>
    </div>
  );
}
