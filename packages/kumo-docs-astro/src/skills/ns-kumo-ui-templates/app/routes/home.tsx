import { GraphIcon } from "@phosphor-icons/react";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { Text } from "@cloudflare/kumo";
import { DocumentationCard } from "~/components/blocks/DocumentationCard";
import { NAV_SECTIONS } from "~/data/navigation";

export default function HomePage() {
  return (
    <ProductOverview
      titleIcon={<GraphIcon size={28} className="text-kumo-strong" />}
      title="Network Services UI Layouts"
      subtitle="Repository of layout examples, templates, and custom blocks for Network Services."
      hideRightColumn
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <div className="flex full-width py-4">
            <Text variant="heading3"><span className="text-kumo-subtle">{section.label}</span></Text>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:h-full">
            {section.links.map((link) => (
              <DocumentationCard
                key={link.to}
                title={link.label}
                description={link.description}
                href={link.to}
                openInNewTab={false}
              />
            ))}
          </div>
        </div>
      ))}
    </ProductOverview>
  );
}
