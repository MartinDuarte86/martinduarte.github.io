export default function MartinDuarteWebsite() {
  const services = [
    {
      title: "Diagnostico de arquitectura de datos",
      description:
        "Evaluacion del estado actual para detectar cuellos de botella, deuda tecnica y riesgos.",
      bullets: [
        "Mapa de arquitectura actual",
        "Riesgos tecnicos y operativos",
        "Costos y complejidad",
        "Prioridades inmediatas",
      ],
    },
    {
      title: "Blueprint de arquitectura objetivo",
      description:
        "Definicion de una arquitectura futura entendible para liderazgo y equipos.",
      bullets: [
        "Arquitectura logica y fisica",
        "Modelo de integraciones",
        "Estandares de plataforma",
        "Lineamientos para escalar",
      ],
    },
    {
      title: "Estrategia de plataforma de datos",
      description:
        "Defino la estrategia de plataforma para alinear tecnologia, integraciones y modelo operativo.",
      bullets: [
        "Seleccion de tecnologias",
        "Estrategia de integracion",
        "Modelo operativo",
        "Capacidades prioritarias",
      ],
    },
    {
      title: "Roadmap de modernizacion",
      description:
        "Plan accionable, por etapas, para evolucionar la plataforma sin detener la operacion.",
      bullets: [
        "Plan por etapas",
        "Priorizacion",
        "Quick wins",
        "Riesgos de transicion",
      ],
    },
    {
      title: "Acompanamiento fractional",
      description:
        "Direccion arquitectonica continua para organizaciones que necesitan criterio senior.",
      bullets: [
        "Revision de decisiones",
        "Mentoria a equipos",
        "Alineacion con negocio",
        "Evolucion de arquitectura",
      ],
    },
  ];

  const cases = [
    {
      title: "Modernizacion de plataforma heredada",
      problem: "Base historica costosa y dificil de escalar.",
      intervention: "Assessment, arquitectura objetivo y roadmap.",
      outcome: "Menos riesgo tecnico y mejor visibilidad de prioridades.",
    },
    {
      title: "Plataforma que crecio sin estandar",
      problem: "Pipelines e integraciones acumuladas sin una arquitectura coherente.",
      intervention: "Ordenamiento de componentes y modelo operativo.",
      outcome: "Menos complejidad y decisiones tecnicas mas consistentes.",
    },
    {
      title: "Base insuficiente para analitica avanzada",
      problem: "El negocio quiere acelerar IA o analitica sin una base madura.",
      intervention: "Evaluacion de brechas y priorizacion de capacidades.",
      outcome: "Hoja de ruta mas solida antes de nuevas inversiones.",
    },
    {
      title: "Desarrollo de App",
      problem:
        "Unificar en una sola experiencia la gestion de tareas, presupuesto, gastos e inversiones sin perder claridad para el usuario final.",
      intervention:
        "Desarrollo de una app web autenticada con frontend estatico, backend en Express y modulos conectados para tareas tipo Eisenhower, equipos, presupuestos y portfolio financiero.",
      outcome:
        "Una plataforma mas ordenada, facil de usar y preparada para seguir creciendo con automatizaciones, reportes y mejor visibilidad operativa.",
      link: "desarrollo-de-app-resumen.pdf",
      linkLabel: "Ver resumen del caso",
    },
    {
      title: "Dashboard de Futuros",
      problem:
        "Centralizar posiciones abiertas, balances y riesgo operativo de multiples mercados de futuros en una sola vista en tiempo real.",
      intervention:
        "Desarrollo de un dashboard web con backend en Node y Express, integracion con Binance y BingX, WebSockets para actualizacion continua y alertas de take profit o stop loss.",
      outcome:
        "Mejor visibilidad de capital, PnL y exposicion por posicion para tomar decisiones mas rapidas con una operacion mas controlada.",
      link: "futuretx-app-summary.pdf",
      linkLabel: "Ver resumen del caso",
    },
  ];

  return (
    <div className="min-h-screen bg-[#07111f] px-6 py-16 text-white">
      <main className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="grid gap-6 rounded-[28px] border border-white/10 bg-white/5 p-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
              Arquitectura de datos para decisiones mas claras
            </p>
            <h1 className="mt-4 font-['Space_Grotesk'] text-5xl leading-none lg:text-7xl">
              Moderniza tu plataforma de datos sin sumar complejidad innecesaria
            </h1>
            <p className="mt-5 max-w-3xl text-lg text-slate-300">
              Ayudo a empresas a ordenar su arquitectura, reducir riesgo tecnico y definir
              un roadmap de modernizacion que el negocio pueda entender y ejecutar.
            </p>
          </div>
          <div className="w-full max-w-[480px] self-center justify-self-end rounded-[24px] border border-white/10 bg-slate-950/40 p-6 text-slate-300 lg:w-full">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-white/10 py-4 first:pt-0 last:border-b-0 last:pb-0">
              <p className="font-['Space_Grotesk'] text-4xl leading-none text-white">01</p>
              <p className="leading-6">Plataformas que crecieron mas rapido que su arquitectura.</p>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-white/10 py-4">
              <p className="font-['Space_Grotesk'] text-4xl leading-none text-white">02</p>
              <p className="leading-6">Costos, deuda tecnica o integraciones que frenan decisiones.</p>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 pb-0 pt-4">
              <p className="font-['Space_Grotesk'] text-4xl leading-none text-white">03</p>
              <p className="leading-6">Necesidad de una hoja de ruta clara antes de invertir mas.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[28px] border border-white/10 bg-white/5 p-8">
            <h2 className="font-['Space_Grotesk'] text-3xl">Por que trabajar conmigo</h2>
            <p className="mt-4 text-slate-300">
              Combino criterio tecnico, priorizacion ejecutiva y una mirada de evolucion de
              plataforma para evitar inversiones desordenadas.
            </p>
          </article>
          <article className="rounded-[28px] border border-white/10 bg-white/5 p-8">
            <h2 className="font-['Space_Grotesk'] text-3xl">Contextos donde agrego valor</h2>
            <p className="mt-4 text-slate-300">
              Arquitectura de datos, cloud y analitica avanzada en escenarios donde hay que
              equilibrar urgencia, escalabilidad y simplicidad operativa.
            </p>
          </article>
        </section>

        <section className="space-y-4">
          <h2 className="font-['Space_Grotesk'] text-4xl">Servicios</h2>
          <div className="grid gap-4">
            {services.map((service) => (
              <article
                key={service.title}
                className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-8 lg:grid-cols-[1fr_280px]"
              >
                <div>
                  <h3 className="font-['Space_Grotesk'] text-2xl">{service.title}</h3>
                  <p className="mt-3 text-slate-300">{service.description}</p>
                </div>
                <ul className="space-y-3 text-slate-200">
                  {service.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {cases.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-white/10 bg-white/5 p-8">
              <h3 className="font-['Space_Grotesk'] text-2xl">{item.title}</h3>
              <p className="mt-4 text-sm font-semibold text-white">Problema</p>
              <p className="mt-1 text-slate-300">{item.problem}</p>
              <p className="mt-4 text-sm font-semibold text-white">Intervencion</p>
              <p className="mt-1 text-slate-300">{item.intervention}</p>
              <p className="mt-4 text-sm font-semibold text-white">Resultado esperado</p>
              <p className="mt-1 text-slate-300">{item.outcome}</p>
              {item.link ? (
                <p className="mt-4">
                  <a
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 font-semibold text-emerald-100 transition hover:-translate-y-px"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.linkLabel}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </section>

        <section className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Contacto</p>
            <h2 className="mt-4 font-['Space_Grotesk'] text-4xl">
              Si estas evaluando modernizar tu plataforma de datos, conversemos
            </h2>
            <p className="mt-4 text-slate-300">
              Podemos tener una primera conversacion simple para entender tu contexto,
              ordenar prioridades y ver si tiene sentido trabajar juntos en arquitectura,
              modernizacion o evolucion de plataforma.
            </p>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
              Podemos conversar sobre
            </p>
            <p className="mt-4 text-slate-300">
              El estado actual de tu plataforma, una estrategia de modernizacion por etapas,
              la arquitectura objetivo que necesitarias o el acompanamiento arquitectonico
              para tomar mejores decisiones.
            </p>
          </aside>
        </section>
      </main>
    </div>
  );
}
