import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  guidance = "Try a broader keyword, switch weeks, or come back after the next curated update.",
}: {
  title: string;
  description: string;
  guidance?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {guidance}
        </p>
      </CardContent>
    </Card>
  );
}
