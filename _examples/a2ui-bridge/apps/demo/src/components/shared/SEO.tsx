import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
}

const SITE_NAME = 'A2UI Bridge';
const SITE_URL = 'https://a2ui.southleft.com';
const DEFAULT_DESCRIPTION = 'Let AI agents build real user interfaces. A React implementation of Google\'s A2UI protocol for AI-generated UIs using your design system.';
const OG_IMAGE = '/og-image.jpg';

export function SEO({ title, description = DEFAULT_DESCRIPTION, path = '' }: SEOProps) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="title" content={pageTitle} />
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${SITE_URL}${OG_IMAGE}`} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${OG_IMAGE}`} />
    </Helmet>
  );
}

export default SEO;
