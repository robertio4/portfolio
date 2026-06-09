import type { Lang } from '../i18n';

export interface FAQItem {
  q: string;
  a: string;
}

// Shown when the daily request cap is reached (the chatbot is temporarily off).
// Mirrors what the assistant would answer, so a visitor still gets the essentials.
// Kept factual and in sync with the CV in doc/ — third person, plain text (no markdown).
export const fallbackFaq: Record<Lang, FAQItem[]> = {
  es: [
    {
      q: '¿Quién es Roberto?',
      a: 'Roberto Rodríguez es Tech Lead y Senior Full Stack Engineer afincado en Madrid, con más de 10 años de experiencia construyendo productos digitales y liderando equipos. Trabaja en la intersección entre ingeniería y producto, con foco reciente en integración de IA y LLMs aplicados a negocio.',
    },
    {
      q: '¿Qué experiencia tiene?',
      a: 'Hasta 2026 fue Tech Lead Frontend en Harmonix (antes Bloobirds), donde construyó desde cero la extensión de Chrome que se convirtió en el núcleo del producto: una capa inteligente sobre Salesforce con IA, usada por clientes como Iberia, Revolut o Sanitas. Antes lideró equipos frontend en Atresmedia y trabajó en Hollyvooz, Enxenio e Indra.',
    },
    {
      q: '¿Qué tecnologías domina?',
      a: 'Frontend con React, Next.js, TypeScript y Tailwind; backend con Node.js, PostgreSQL, MongoDB y Python; e IA aplicada: RAG, embeddings, búsqueda semántica y agentes conversacionales (LangChain, Gemini, OpenAI). También AWS, Docker, Cloudflare y CRMs como Salesforce, Dynamics y HubSpot.',
    },
    {
      q: '¿Qué proyectos ha construido?',
      a: 'Este mismo portfolio (robertorf.dev) es un chatbot bilingüe que responde sobre su perfil con RAG, desplegado en AWS con un sistema de protección de coste cero. También ha desarrollado Invoicing App (roferlim.vercel.app), una herramienta de facturación fullstack con gestión de clientes, facturación recurrente y dashboards en tiempo real.',
    },
    {
      q: '¿Cómo le contacto?',
      a: 'Por email en roberto.rgz.fdz@gmail.com, en LinkedIn (linkedin.com/in/robertorgzfdz) o en GitHub (github.com/robertio4). Está abierto a hablar sobre oportunidades profesionales y colaboración.',
    },
  ],
  en: [
    {
      q: 'Who is Roberto?',
      a: 'Roberto Rodríguez is a Tech Lead and Senior Full Stack Engineer based in Madrid, with 10+ years building digital products and leading teams. He works at the intersection of engineering and product, recently focused on integrating AI and LLMs into business.',
    },
    {
      q: 'What is his experience?',
      a: 'Until 2026 he was Tech Lead Frontend at Harmonix (formerly Bloobirds), where he built from scratch the Chrome extension that became the core product: an AI-powered intelligent layer over Salesforce, used by clients like Iberia, Revolut and Sanitas. Earlier he led frontend teams at Atresmedia and worked at Hollyvooz, Enxenio and Indra.',
    },
    {
      q: 'What technologies does he master?',
      a: 'Frontend with React, Next.js, TypeScript and Tailwind; backend with Node.js, PostgreSQL, MongoDB and Python; and applied AI: RAG, embeddings, semantic search and conversational agents (LangChain, Gemini, OpenAI). Also AWS, Docker, Cloudflare and CRMs like Salesforce, Dynamics and HubSpot.',
    },
    {
      q: 'What projects has he built?',
      a: 'This very portfolio (robertorf.dev) is a bilingual chatbot that answers about his profile using RAG, deployed on AWS with a zero-cost protection system. He also built Invoicing App (roferlim.vercel.app), a full-stack invoicing tool with client management, recurring billing and real-time dashboards.',
    },
    {
      q: 'How can I get in touch?',
      a: 'By email at roberto.rgz.fdz@gmail.com, on LinkedIn (linkedin.com/in/robertorgzfdz) or GitHub (github.com/robertio4). He is open to chatting about professional opportunities and collaboration.',
    },
  ],
};
