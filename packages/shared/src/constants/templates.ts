/**
 * Starter template definition for the Simple Mode gallery.
 */
export interface Template {
  slug: string;
  name: string;
  description: string;
  appType: string;
  spacesKey: string;
}

/**
 * Starter templates available in the Simple Mode gallery.
 */
export const TEMPLATES: Template[] = [
  {
    slug: 'nextjs-blog',
    name: 'Blog with Next.js',
    description: 'A simple blog. Customize the content and deploy.',
    appType: 'nextjs',
    spacesKey: 'liftoff-templates/nextjs-blog.zip',
  },
  {
    slug: 'portfolio',
    name: 'Portfolio site',
    description: 'A personal portfolio to showcase your work.',
    appType: 'nextjs',
    spacesKey: 'liftoff-templates/portfolio.zip',
  },
  {
    slug: 'express-api',
    name: 'REST API with Express',
    description: 'A basic REST API with Express.js and health checks.',
    appType: 'express',
    spacesKey: 'liftoff-templates/express-api.zip',
  },
  {
    slug: 'django-webapp',
    name: 'Django web app',
    description: 'A Django starter with admin panel and PostgreSQL.',
    appType: 'django',
    spacesKey: 'liftoff-templates/django-webapp.zip',
  },
  {
    slug: 'laravel-app',
    name: 'Laravel app',
    description: 'A Laravel starter with authentication scaffolding.',
    appType: 'laravel',
    spacesKey: 'liftoff-templates/laravel-app.zip',
  },
  {
    slug: 'static-html',
    name: 'Static HTML site',
    description: 'A simple HTML/CSS site served with a lightweight server.',
    appType: 'express',
    spacesKey: 'liftoff-templates/static-html.zip',
  },
] as const;
