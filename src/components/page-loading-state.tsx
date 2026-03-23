import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PageLoadingState({
  title,
  description,
  blocks = 3,
}: {
  title: string;
  description: string;
  blocks?: number;
}) {
  return (
    <section className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {Array.from({ length: blocks }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 pt-2">
              <div className="h-4 w-28 animate-pulse rounded-full bg-border/70" />
              <div className="h-8 w-3/4 animate-pulse rounded-full bg-border/60" />
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded-full bg-border/50" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-border/50" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-border/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
